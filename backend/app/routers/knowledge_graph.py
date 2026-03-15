"""API endpoints for the Knowledge Graph Explorer."""

from __future__ import annotations

import json
import threading
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import KnowledgeGraphSnapshot, SimulationProject, Signal, StockQuote
from app.services.mirofish_client import MiroFishClient, MiroFishUnavailableError
from app.services.financial_ontology import build_financial_documents, map_signals_to_requirement
from app.config import get_settings

router = APIRouter(prefix="/api/knowledge-graph", tags=["knowledge-graph"])

settings = get_settings()

_build_tasks: dict[str, dict] = {}


@router.post("/build")
async def build_knowledge_graph(db: Session = Depends(get_db)):
    """Build or rebuild the financial knowledge graph from articles + signals."""
    task_id = f"kg_build_{int(datetime.utcnow().timestamp())}"
    _build_tasks[task_id] = {
        "status": "pending",
        "progress": 0,
        "message": "Starting knowledge graph build...",
    }

    thread = threading.Thread(
        target=_build_kg_background, args=(task_id,), daemon=True
    )
    thread.start()

    return {"task_id": task_id, "status": "started"}


def _build_kg_background(task_id: str):
    import asyncio

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(_build_kg_async(task_id))
    except Exception as e:
        _build_tasks[task_id] = {
            "status": "failed",
            "progress": 0,
            "message": str(e),
            "error": str(e),
        }
    finally:
        loop.close()


async def _build_kg_async(task_id: str):
    from app.database import SessionLocal

    db = SessionLocal()
    try:
        _build_tasks[task_id]["status"] = "processing"
        _build_tasks[task_id]["progress"] = 10
        _build_tasks[task_id]["message"] = "Collecting financial data..."

        documents = build_financial_documents(db=db)
        if not documents:
            raise ValueError("No articles or signals available to build graph")

        requirement = map_signals_to_requirement(
            "Build a comprehensive knowledge graph of the Canadian TSX stock market "
            "showing relationships between stocks, sectors, market events, and participants."
        )

        client = MiroFishClient()

        # Generate ontology
        _build_tasks[task_id]["progress"] = 25
        _build_tasks[task_id]["message"] = "Generating financial ontology..."
        ontology_resp = await client.generate_ontology(
            document_texts=documents,
            simulation_requirement=requirement,
            project_name=f"financial_kg_{int(datetime.utcnow().timestamp())}",
        )

        if not ontology_resp.get("success"):
            raise ValueError(f"Ontology failed: {ontology_resp.get('error')}")

        project_id = ontology_resp["data"]["project_id"]

        sim_project = SimulationProject(
            mirofish_project_id=project_id,
            name="Financial Knowledge Graph",
            project_type="knowledge_graph",
            status="ontology_generated",
        )
        db.add(sim_project)
        db.commit()

        # Build graph
        _build_tasks[task_id]["progress"] = 40
        _build_tasks[task_id]["message"] = "Building knowledge graph in Zep..."
        build_resp = await client.build_graph(project_id)

        if not build_resp.get("success"):
            raise ValueError(f"Graph build failed: {build_resp.get('error')}")

        graph_task_id = build_resp["data"]["task_id"]

        # Poll
        import asyncio
        for _ in range(150):
            await asyncio.sleep(2)
            status = await client.get_task_status(graph_task_id)
            task_data = status.get("data", {})
            progress = task_data.get("progress", 0)
            _build_tasks[task_id]["progress"] = 40 + int(progress * 0.5)
            _build_tasks[task_id]["message"] = task_data.get("message", "Building...")

            if status.get("success") and task_data.get("status") == "completed":
                graph_id = task_data.get("result", {}).get("graph_id")
                break
            if status.get("success") and task_data.get("status") == "failed":
                raise ValueError(f"Graph build failed: {task_data.get('error')}")
        else:
            raise ValueError("Graph build timed out")

        sim_project.graph_id = graph_id
        sim_project.status = "graph_completed"
        db.commit()

        # Fetch and cache graph data
        _build_tasks[task_id]["progress"] = 92
        _build_tasks[task_id]["message"] = "Caching graph data..."
        graph_data = await client.get_graph_data(graph_id)

        if graph_data.get("success"):
            data = graph_data["data"]
            snapshot = KnowledgeGraphSnapshot(
                graph_id=graph_id,
                snapshot_type="full",
                nodes_json=json.dumps(data.get("nodes", [])),
                edges_json=json.dumps(data.get("edges", [])),
                node_count=data.get("node_count", 0),
                edge_count=data.get("edge_count", 0),
                expires_at=datetime.utcnow() + timedelta(hours=6),
            )
            db.add(snapshot)
            db.commit()

        _build_tasks[task_id] = {
            "status": "completed",
            "progress": 100,
            "message": "Knowledge graph built successfully",
            "graph_id": graph_id,
        }

    except MiroFishUnavailableError as e:
        _build_tasks[task_id] = {
            "status": "failed",
            "progress": 0,
            "message": f"MiroFish unavailable: {e}",
            "error": str(e),
        }
    except Exception as e:
        _build_tasks[task_id] = {
            "status": "failed",
            "progress": 0,
            "message": str(e),
            "error": str(e),
        }
    finally:
        db.close()


@router.get("/status")
async def get_build_status():
    """Get the most recent build task status."""
    if not _build_tasks:
        return {"status": "none", "message": "No build tasks"}
    latest = list(_build_tasks.values())[-1]
    return latest


@router.get("/status/{task_id}")
async def get_build_task_status(task_id: str):
    task = _build_tasks.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.get("/data")
async def get_graph_data(
    sector: str | None = Query(None),
    ticker: str | None = Query(None),
    db: Session = Depends(get_db),
):
    """Get cached graph data, optionally filtered by sector or ticker."""
    # Find the latest valid snapshot
    query = db.query(KnowledgeGraphSnapshot).filter(
        KnowledgeGraphSnapshot.snapshot_type == "full"
    )
    snapshot = query.order_by(KnowledgeGraphSnapshot.created_at.desc()).first()

    if not snapshot:
        return {
            "nodes": [],
            "edges": [],
            "node_count": 0,
            "edge_count": 0,
            "status": "not_built",
            "message": "Knowledge graph has not been built yet. POST /api/knowledge-graph/build to create one.",
        }

    nodes = json.loads(snapshot.nodes_json)
    edges = json.loads(snapshot.edges_json)

    # Enrich stock nodes with live financial data
    nodes = _enrich_nodes(nodes, db)

    # Filter if requested
    if sector:
        sector_tickers = {
            t for t, s in settings.stock_sectors.items() if s == sector
        }
        node_uuids = set()
        filtered_nodes = []
        for node in nodes:
            node_name = node.get("name", "")
            if (
                node_name in sector_tickers
                or node_name == sector
                or not sector_tickers  # no filter if empty
            ):
                filtered_nodes.append(node)
                node_uuids.add(node.get("uuid"))
        nodes = filtered_nodes
        edges = [
            e
            for e in edges
            if e.get("source_node_uuid") in node_uuids
            and e.get("target_node_uuid") in node_uuids
        ]

    if ticker:
        # Show 2-hop neighborhood
        node_uuids = set()
        ticker_uuid = None
        for node in nodes:
            if node.get("name") == ticker:
                ticker_uuid = node.get("uuid")
                break

        if ticker_uuid:
            # 1st hop
            hop1 = {ticker_uuid}
            for e in edges:
                if e.get("source_node_uuid") == ticker_uuid:
                    hop1.add(e.get("target_node_uuid"))
                if e.get("target_node_uuid") == ticker_uuid:
                    hop1.add(e.get("source_node_uuid"))
            # 2nd hop
            hop2 = set(hop1)
            for e in edges:
                if e.get("source_node_uuid") in hop1:
                    hop2.add(e.get("target_node_uuid"))
                if e.get("target_node_uuid") in hop1:
                    hop2.add(e.get("source_node_uuid"))

            nodes = [n for n in nodes if n.get("uuid") in hop2]
            edges = [
                e
                for e in edges
                if e.get("source_node_uuid") in hop2
                and e.get("target_node_uuid") in hop2
            ]

    return {
        "nodes": nodes,
        "edges": edges,
        "node_count": len(nodes),
        "edge_count": len(edges),
        "graph_id": snapshot.graph_id,
        "built_at": snapshot.created_at.isoformat(),
    }


def _enrich_nodes(nodes: list[dict], db: Session) -> list[dict]:
    """Add live financial data to stock nodes."""
    # Get latest quotes
    quotes = {}
    for ticker in settings.tsx_stocks:
        quote = (
            db.query(StockQuote)
            .filter(StockQuote.ticker == ticker)
            .order_by(StockQuote.ingested_at.desc())
            .first()
        )
        if quote:
            quotes[ticker] = {
                "current_price": quote.current_price,
                "percent_change": quote.percent_change,
                "volume": quote.volume,
            }

    # Get signal counts
    signal_counts = {}
    recent_signals = (
        db.query(Signal.stock_ticker, Signal.sentiment)
        .filter(Signal.created_at >= datetime.utcnow() - timedelta(days=7))
        .all()
    )
    for ticker, sentiment in recent_signals:
        if ticker not in signal_counts:
            signal_counts[ticker] = {"total": 0, "positive": 0, "negative": 0}
        signal_counts[ticker]["total"] += 1
        if sentiment == "positive":
            signal_counts[ticker]["positive"] += 1
        elif sentiment == "negative":
            signal_counts[ticker]["negative"] += 1

    # Enrich
    for node in nodes:
        name = node.get("name", "")
        if name in quotes:
            node["financial_data"] = quotes[name]
        if name in signal_counts:
            node["signal_data"] = signal_counts[name]
        if name in settings.stock_sectors:
            node["sector"] = settings.stock_sectors[name]

    return nodes


@router.get("/search")
async def search_graph(
    q: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
):
    """Search graph nodes by name."""
    snapshot = (
        db.query(KnowledgeGraphSnapshot)
        .filter(KnowledgeGraphSnapshot.snapshot_type == "full")
        .order_by(KnowledgeGraphSnapshot.created_at.desc())
        .first()
    )
    if not snapshot:
        return {"results": []}

    nodes = json.loads(snapshot.nodes_json)
    q_lower = q.lower()
    results = [
        n for n in nodes if q_lower in (n.get("name", "") or "").lower()
    ]
    return {"results": results[:20]}

"""Async HTTP client for the MiroFish sidecar service."""

from __future__ import annotations

import io
import json
import logging
from typing import Any

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()


class MiroFishUnavailableError(Exception):
    """Raised when the MiroFish sidecar cannot be reached."""


class MiroFishClient:
    """Bridge between FastAPI and the MiroFish Flask backend."""

    def __init__(self) -> None:
        self.base_url = settings.mirofish_url.rstrip("/")
        self.timeout = settings.mirofish_timeout
        self._consecutive_failures = 0
        self._max_failures = 5  # circuit breaker threshold

    # ── helpers ──────────────────────────────────────────────

    def _client(self, timeout: int | None = None) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            base_url=self.base_url,
            timeout=timeout or self.timeout,
        )

    async def _request(
        self,
        method: str,
        path: str,
        *,
        json_data: dict | None = None,
        params: dict | None = None,
        files: Any = None,
        data: dict | None = None,
        timeout: int | None = None,
    ) -> dict:
        if self._consecutive_failures >= self._max_failures:
            # circuit breaker: check if service recovered
            try:
                await self.health_check()
            except Exception:
                raise MiroFishUnavailableError(
                    f"MiroFish circuit breaker open after {self._max_failures} failures"
                )

        try:
            async with self._client(timeout=timeout) as client:
                response = await client.request(
                    method,
                    path,
                    json=json_data,
                    params=params,
                    files=files,
                    data=data,
                )
                response.raise_for_status()
                self._consecutive_failures = 0
                return response.json()
        except httpx.ConnectError:
            self._consecutive_failures += 1
            raise MiroFishUnavailableError(
                f"Cannot connect to MiroFish at {self.base_url}"
            )
        except httpx.TimeoutException:
            self._consecutive_failures += 1
            raise MiroFishUnavailableError("MiroFish request timed out")
        except httpx.HTTPStatusError as e:
            self._consecutive_failures += 1
            raise MiroFishUnavailableError(
                f"MiroFish returned {e.response.status_code}: {e.response.text[:500]}"
            )

    # ── health ───────────────────────────────────────────────

    async def health_check(self) -> bool:
        try:
            async with self._client(timeout=5) as client:
                resp = await client.get("/health")
                ok = resp.status_code == 200
                if ok:
                    self._consecutive_failures = 0
                return ok
        except Exception:
            return False

    # ── graph / ontology ─────────────────────────────────────

    async def generate_ontology(
        self,
        document_texts: list[str],
        simulation_requirement: str,
        project_name: str = "financial_simulation",
        additional_context: str = "",
    ) -> dict:
        """Upload documents and generate ontology via MiroFish."""
        files = []
        for i, text in enumerate(document_texts):
            file_bytes = text.encode("utf-8")
            files.append(
                ("files", (f"document_{i}.txt", io.BytesIO(file_bytes), "text/plain"))
            )

        data = {
            "simulation_requirement": simulation_requirement,
            "project_name": project_name,
        }
        if additional_context:
            data["additional_context"] = additional_context

        return await self._request(
            "POST",
            "/api/graph/ontology/generate",
            files=files,
            data=data,
            timeout=300,
        )

    async def build_graph(
        self,
        project_id: str,
        chunk_size: int = 500,
        chunk_overlap: int = 50,
    ) -> dict:
        return await self._request(
            "POST",
            "/api/graph/build",
            json_data={
                "project_id": project_id,
                "chunk_size": chunk_size,
                "chunk_overlap": chunk_overlap,
            },
            timeout=300,
        )

    async def get_task_status(self, task_id: str) -> dict:
        return await self._request("GET", f"/api/graph/task/{task_id}")

    async def get_graph_data(self, graph_id: str) -> dict:
        return await self._request("GET", f"/api/graph/data/{graph_id}")

    # ── simulation ───────────────────────────────────────────

    async def create_simulation(
        self,
        project_id: str,
        graph_id: str,
        enable_twitter: bool = True,
        enable_reddit: bool = True,
    ) -> dict:
        return await self._request(
            "POST",
            "/api/simulation/create",
            json_data={
                "project_id": project_id,
                "graph_id": graph_id,
                "enable_twitter": enable_twitter,
                "enable_reddit": enable_reddit,
            },
        )

    async def prepare_simulation(
        self,
        simulation_id: str,
        simulation_requirement: str,
        document_text: str = "",
    ) -> dict:
        return await self._request(
            "POST",
            "/api/simulation/prepare",
            json_data={
                "simulation_id": simulation_id,
                "simulation_requirement": simulation_requirement,
                "document_text": document_text,
            },
            timeout=300,
        )

    async def start_simulation(
        self,
        simulation_id: str,
        platform: str = "parallel",
        max_rounds: int | None = None,
    ) -> dict:
        payload: dict[str, Any] = {
            "simulation_id": simulation_id,
            "platform": platform,
        }
        if max_rounds is not None:
            payload["max_rounds"] = max_rounds
        return await self._request(
            "POST", "/api/simulation/start", json_data=payload, timeout=300
        )

    async def get_run_status(self, simulation_id: str) -> dict:
        return await self._request(
            "GET", f"/api/simulation/{simulation_id}/run-status"
        )

    async def get_run_status_detail(self, simulation_id: str) -> dict:
        return await self._request(
            "GET", f"/api/simulation/{simulation_id}/run-status/detail"
        )

    async def get_simulation_state(self, simulation_id: str) -> dict:
        return await self._request("GET", f"/api/simulation/{simulation_id}")

    # ── report ───────────────────────────────────────────────

    async def generate_report(self, simulation_id: str) -> dict:
        return await self._request(
            "POST",
            "/api/report/generate",
            json_data={"simulation_id": simulation_id},
            timeout=600,
        )

    async def get_report_status(self) -> dict:
        return await self._request("GET", "/api/report/generate/status")

    async def get_report(self, report_id: str) -> dict:
        return await self._request("GET", f"/api/report/{report_id}")

    async def chat_with_report_agent(
        self, simulation_id: str, message: str, history: list[dict] | None = None
    ) -> dict:
        return await self._request(
            "POST",
            "/api/report/chat",
            json_data={
                "simulation_id": simulation_id,
                "message": message,
                "history": history or [],
            },
        )

    # ── graph search ─────────────────────────────────────────

    async def search_graph(self, graph_id: str, query: str) -> dict:
        return await self._request(
            "GET",
            f"/api/graph/data/{graph_id}",
            params={"query": query},
        )

from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from datetime import datetime, timedelta

from app.database import get_db
from app.models import Signal, SentimentData, Theme

router = APIRouter(prefix="/api/chat", tags=["chat"])


class ChatMessageInput(BaseModel):
    role: str
    content: str
    references: list[dict] = []


class ChatRequest(BaseModel):
    message: str
    conversation_history: list[ChatMessageInput] = []


class ChatResponse(BaseModel):
    response: str
    references: list[dict] = []
    suggested_queries: list[str] = []


@router.post("", response_model=ChatResponse)
def chat_endpoint(request: ChatRequest, db: Session = Depends(get_db)):
    """Send a message to the AI financial assistant."""
    from app.agents.chat import chat

    history = [{"role": m.role, "content": m.content} for m in request.conversation_history]

    result = chat(request.message, history, db)

    return ChatResponse(
        response=result["response"],
        references=result["references"],
        suggested_queries=result["suggested_queries"],
    )


@router.get("/suggestions", response_model=list[str])
def get_suggestions(db: Session = Depends(get_db)):
    """Get dynamic suggested queries based on current data."""
    suggestions = []
    cutoff = datetime.utcnow() - timedelta(days=7)

    # Based on recent signals
    recent_signals = db.query(Signal).filter(Signal.created_at >= cutoff).order_by(desc(Signal.confidence)).limit(3).all()
    if recent_signals:
        top = recent_signals[0]
        suggestions.append(f"What's the outlook for {top.stock_ticker}?")

    # Based on sectors with activity
    sector_counts = (
        db.query(Signal.sector, func.count(Signal.id))
        .filter(Signal.created_at >= cutoff)
        .group_by(Signal.sector)
        .order_by(func.count(Signal.id).desc())
        .limit(2)
        .all()
    )
    for sector, count in sector_counts:
        if sector:
            suggestions.append(f"What's happening in the {sector} sector?")

    # Based on themes
    themes = db.query(Theme).filter(Theme.created_at >= cutoff).order_by(desc(Theme.relevance_score)).limit(1).all()
    if themes:
        suggestions.append(f"Tell me about the '{themes[0].name}' theme")

    # Generic suggestions
    suggestions.extend([
        "What are the top bullish signals this week?",
        "Which sector has the best backtest accuracy?",
        "Show me the latest community sentiment",
        "What are the active investment themes?",
    ])

    # Deduplicate and limit
    seen = set()
    unique = []
    for s in suggestions:
        if s not in seen:
            seen.add(s)
            unique.append(s)
    return unique[:6]

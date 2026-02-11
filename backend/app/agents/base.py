from __future__ import annotations

import json
import re

from anthropic import Anthropic

from app.config import get_settings

settings = get_settings()
client = Anthropic(api_key=settings.anthropic_api_key)


def call_claude(system_prompt: str, user_prompt: str, max_tokens: int = 2000, temperature: float = 0.3) -> str:
    """Call Claude API and return the text response."""
    response = client.messages.create(
        model=settings.claude_model,
        max_tokens=max_tokens,
        temperature=temperature,
        system=system_prompt,
        messages=[{"role": "user", "content": user_prompt}],
    )
    return response.content[0].text


def call_claude_json(system_prompt: str, user_prompt: str, max_tokens: int = 2000, temperature: float = 0.3) -> dict | list:
    """Call Claude API and parse the response as JSON."""
    raw = call_claude(system_prompt, user_prompt, max_tokens, temperature)

    # Extract JSON from the response (handle markdown code blocks)
    json_match = re.search(r"```(?:json)?\s*([\s\S]*?)```", raw)
    if json_match:
        raw = json_match.group(1).strip()

    # Try to parse directly
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        # Try to find JSON array or object in the text
        for pattern in [r"\[[\s\S]*\]", r"\{[\s\S]*\}"]:
            match = re.search(pattern, raw)
            if match:
                try:
                    return json.loads(match.group())
                except json.JSONDecodeError:
                    continue
        raise ValueError(f"Could not parse JSON from Claude response: {raw[:200]}")

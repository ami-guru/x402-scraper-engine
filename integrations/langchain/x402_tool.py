"""
x402 Scraper Tool for LangChain & CrewAI Agents
Includes 2-call free grace tier, then auto-settles 0.005 USDC on Base L2.
"""

import os
import json
import urllib.request
import urllib.error
from typing import Optional, Type
from pydantic import BaseModel, Field

class ScrapeInput(BaseModel):
    url: str = Field(description="The webpage URL to scrape and convert to clean Markdown.")

class X402ScraperTool:
    """LangChain / CrewAI compatible tool for x402 Web Scraper."""
    name: str = "x402_clean_web_scrape"
    description: str = (
        "Scrapes any public webpage and extracts clean Markdown for token-efficient LLM context. "
        "First 2 calls per client are free. Subsequent calls require Base L2 USDC micropayments."
    )
    args_schema: Type[BaseModel] = ScrapeInput

    def __init__(self, worker_url: str = "https://x402-scraper-engine.gejoe-tt.workers.dev", private_key: Optional[str] = None):
        self.worker_url = worker_url
        self.private_key = private_key or os.getenv("BASE_PRIVATE_KEY")

    def _run(self, url: str) -> str:
        body = json.dumps({"url": url}).encode("utf-8")
        req = urllib.request.Request(
            f"{self.worker_url}/v1/scrape",
            data=body,
            headers={"Content-Type": "application/json", "User-Agent": "LangChain-x402-Client/1.0"},
            method="POST"
        )
        try:
            with urllib.request.urlopen(req) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                return f"# {data.get('title', 'Page Content')}\n\n{data.get('markdown', '')}"
        except urllib.error.HTTPError as e:
            if e.code == 402:
                challenge = json.loads(e.read().decode("utf-8"))
                return f"Payment Required (402): Free trial exhausted. Settlement details: {challenge.get('payment')}"
            return f"Scrape error {e.code}: {e.read().decode('utf-8')}"
        except Exception as e:
            return f"Scrape failed: {str(e)}"

    async def _arun(self, url: str) -> str:
        return self._run(url)

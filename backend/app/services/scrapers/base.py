from __future__ import annotations

import hashlib
import time
import random
from abc import ABC, abstractmethod
from datetime import datetime
from typing import List, Optional, Dict
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup


class BaseScraper(ABC):
    """
    Abstract base class for all web scrapers.
    Provides common functionality: HTTP requests, retry logic, rate limiting, error handling.
    """

    # Class-level configuration (override in subclasses)
    source_name: str = "Unknown Source"
    base_url: str = ""
    request_delay: float = 1.0  # Seconds to wait between requests
    max_retries: int = 3
    timeout: int = 30

    # User agents for rotation
    USER_AGENTS = [
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
        "Mozilla/5.0 (X11; Linux x86_64; rv:122.0) Gecko/20100101 Firefox/122.0",
    ]

    def __init__(self):
        self.last_request_time = 0.0
        self.session = requests.Session()

    def _get_headers(self) -> Dict[str, str]:
        """Return HTTP headers with rotated user agent."""
        return {
            "User-Agent": random.choice(self.USER_AGENTS),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Accept-Encoding": "gzip, deflate",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
        }

    def _rate_limit(self):
        """Enforce rate limiting between requests."""
        elapsed = time.time() - self.last_request_time
        if elapsed < self.request_delay:
            time.sleep(self.request_delay - elapsed)
        self.last_request_time = time.time()

    def _make_request(self, url: str, method: str = "GET", **kwargs) -> Optional[requests.Response]:
        """
        Make HTTP request with retry logic and error handling.

        Args:
            url: URL to fetch
            method: HTTP method (GET, POST, etc.)
            **kwargs: Additional arguments to pass to requests

        Returns:
            Response object or None if all retries failed
        """
        headers = kwargs.pop("headers", {})
        headers.update(self._get_headers())

        for attempt in range(self.max_retries):
            try:
                self._rate_limit()

                response = self.session.request(
                    method=method,
                    url=url,
                    headers=headers,
                    timeout=self.timeout,
                    **kwargs
                )

                # Handle rate limiting
                if response.status_code == 429:
                    retry_after = int(response.headers.get("Retry-After", 60))
                    print(f"{self.source_name}: Rate limited. Waiting {retry_after}s...")
                    time.sleep(retry_after)
                    continue

                # Raise for bad status codes
                response.raise_for_status()
                return response

            except requests.exceptions.Timeout:
                print(f"{self.source_name}: Timeout on attempt {attempt + 1}/{self.max_retries}")
                if attempt < self.max_retries - 1:
                    time.sleep(2 ** attempt)  # Exponential backoff
                continue

            except requests.exceptions.HTTPError as e:
                print(f"{self.source_name}: HTTP error {e.response.status_code} for {url}")
                if e.response.status_code in [403, 404]:
                    # Don't retry on forbidden/not found
                    return None
                if attempt < self.max_retries - 1:
                    time.sleep(2 ** attempt)
                continue

            except requests.exceptions.RequestException as e:
                print(f"{self.source_name}: Request failed: {e}")
                if attempt < self.max_retries - 1:
                    time.sleep(2 ** attempt)
                continue

        print(f"{self.source_name}: All retry attempts failed for {url}")
        return None

    def _parse_html(self, html: str) -> Optional[BeautifulSoup]:
        """Parse HTML content using BeautifulSoup."""
        try:
            return BeautifulSoup(html, "lxml")
        except Exception as e:
            print(f"{self.source_name}: Failed to parse HTML: {e}")
            return None

    def _fetch_and_parse(self, url: str, **kwargs) -> Optional[BeautifulSoup]:
        """Fetch URL and return parsed BeautifulSoup object."""
        response = self._make_request(url, **kwargs)
        if response and response.text:
            return self._parse_html(response.text)
        return None

    @staticmethod
    def hash_url(url: str) -> str:
        """Generate SHA256 hash of URL for deduplication."""
        return hashlib.sha256(url.encode()).hexdigest()

    @staticmethod
    def clean_text(text: str) -> str:
        """Clean and normalize text content."""
        if not text:
            return ""
        # Remove extra whitespace
        text = " ".join(text.split())
        return text.strip()

    @staticmethod
    def extract_domain(url: str) -> str:
        """Extract domain from URL."""
        try:
            parsed = urlparse(url)
            return parsed.netloc
        except:
            return ""

    @abstractmethod
    def scrape(self, *args, **kwargs):
        """
        Main scraping method to be implemented by subclasses.

        Should return a list of scraped items (Articles, StockQuotes, etc.)
        """
        pass

    def __enter__(self):
        """Context manager support."""
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Clean up resources."""
        self.session.close()
        return False

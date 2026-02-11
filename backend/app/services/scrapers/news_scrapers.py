from __future__ import annotations

import re
from datetime import datetime
from typing import List, Optional, Set
from urllib.parse import urljoin

from bs4 import BeautifulSoup
from sqlalchemy.orm import Session

from app.models import Article
from app.services.scrapers.base import BaseScraper


class _NewsScraperMixin:
    """Common helper methods for all news scrapers."""

    def _deduplicate_url(self, url: str, db: Optional[Session], seen_urls: Set[str]) -> bool:
        """Return True if this URL should be skipped (duplicate)."""
        if url in seen_urls:
            return True
        seen_urls.add(url)

        if db:
            url_hash = self.hash_url(url)
            existing = db.query(Article).filter(Article.url_hash == url_hash).first()
            if existing:
                return True
        return False

    def _build_article(self, url: str, title: str, article_data: dict) -> Article:
        """Create a standardized Article object."""
        return Article(
            title=article_data.get("title", title),
            content=article_data.get("content", ""),
            summary=article_data.get("summary", "")[:500],
            source=self.source_name,
            url=url,
            url_hash=self.hash_url(url),
            published_at=article_data.get("published_at"),
            ingested_at=datetime.utcnow(),
            processed=False,
        )

    def _extract_date(self, soup: BeautifulSoup) -> Optional[datetime]:
        """Extract published date from common patterns."""
        # Try <time datetime="..."> first
        time_tag = soup.find("time", {"datetime": True})
        if time_tag:
            try:
                date_str = time_tag.get("datetime")
                return datetime.fromisoformat(date_str.replace("Z", "+00:00"))
            except (ValueError, TypeError):
                pass

        # Try meta tags
        for prop in ["article:published_time", "datePublished", "og:article:published_time"]:
            meta = soup.find("meta", {"property": prop}) or soup.find("meta", {"name": prop})
            if meta:
                try:
                    date_str = meta.get("content", "")
                    return datetime.fromisoformat(date_str.replace("Z", "+00:00"))
                except (ValueError, TypeError):
                    pass

        return None

    def _extract_content(self, soup: BeautifulSoup, container_keywords: Optional[List[str]] = None) -> str:
        """Extract article content from common patterns."""
        keywords = container_keywords or ["article", "story", "entry", "content", "body"]
        paragraphs = []

        # Try to find article body container
        for keyword in keywords:
            container = soup.find(
                "div",
                class_=lambda x: x and keyword in str(x).lower() if x else False,
            )
            if container:
                ps = container.find_all("p")
                paragraphs = [self.clean_text(p.get_text()) for p in ps if p.get_text().strip()]
                if paragraphs:
                    break

        # Fallback: get all paragraphs
        if not paragraphs:
            ps = soup.find_all("p", limit=25)
            paragraphs = [self.clean_text(p.get_text()) for p in ps if p.get_text().strip()]

        return " ".join(paragraphs)

    def _scrape_generic_article(self, url: str, container_keywords: Optional[List[str]] = None) -> Optional[dict]:
        """Generic article page scraper that works for most news sites."""
        soup = self._fetch_and_parse(url)
        if not soup:
            return None

        data = {}

        # Title
        title_tag = soup.find("h1") or soup.find("title")
        if title_tag:
            data["title"] = self.clean_text(title_tag.get_text())

        # Date
        published_at = self._extract_date(soup)
        if published_at:
            data["published_at"] = published_at

        # Content
        content = self._extract_content(soup, container_keywords)
        data["content"] = content
        data["summary"] = content[:500] if content else data.get("title", "")

        return data if data.get("title") else None


class GlobeAndMailScraper(_NewsScraperMixin, BaseScraper):
    """Scraper for Globe and Mail Business section."""

    source_name = "Globe and Mail Business"
    base_url = "https://www.theglobeandmail.com"
    section_url = "https://www.theglobeandmail.com/business/"

    def scrape(self, limit: int = 20, db: Session = None) -> List[Article]:
        print(f"Scraping {self.source_name}...")
        articles = []
        seen_urls = set()

        soup = self._fetch_and_parse(self.section_url)
        if not soup:
            return articles

        # Globe and Mail article URLs always contain /article-
        for link in soup.find_all("a", href=True):
            if len(articles) >= limit:
                break

            href = link.get("href", "")
            if not href or "#" in href:
                continue

            url = urljoin(self.base_url, href) if href.startswith("/") else href
            if not url.startswith("http"):
                continue

            # Must be an article page (not navigation/category)
            if "/article-" not in url:
                continue

            if self._deduplicate_url(url, db, seen_urls):
                continue

            title = self.clean_text(link.get_text())
            if not title or len(title) < 10:
                continue

            article_data = self._scrape_generic_article(url, ["article"])
            if not article_data:
                continue

            articles.append(self._build_article(url, title, article_data))
            print(f"  Scraped: {articles[-1].title[:60]}...")

        print(f"Scraped {len(articles)} articles from {self.source_name}")
        return articles


class BNNBloombergScraper(_NewsScraperMixin, BaseScraper):
    """Scraper for BNN Bloomberg Canada."""

    source_name = "BNN Bloomberg"
    base_url = "https://www.bnnbloomberg.ca"
    section_url = "https://www.bnnbloomberg.ca"

    def scrape(self, limit: int = 20, db: Session = None) -> List[Article]:
        print(f"Scraping {self.source_name}...")
        articles = []
        seen_urls = set()

        soup = self._fetch_and_parse(self.section_url)
        if not soup:
            return articles

        # BNN article URLs contain year patterns like /2026/02/
        year_pattern = re.compile(r"/20\d{2}/\d{2}/")

        for link in soup.find_all("a", href=True):
            if len(articles) >= limit:
                break

            href = link.get("href", "")
            if not href or "#" in href:
                continue

            url = urljoin(self.base_url, href) if href.startswith("/") else href
            if not url.startswith("http"):
                continue

            # Must be from BNN and contain a date pattern
            if "bnnbloomberg.ca" not in url:
                continue
            if not year_pattern.search(url):
                continue

            if self._deduplicate_url(url, db, seen_urls):
                continue

            title = self.clean_text(link.get_text())
            if not title or len(title) < 10:
                continue

            article_data = self._scrape_generic_article(url, ["article"])
            if not article_data:
                continue

            articles.append(self._build_article(url, title, article_data))
            print(f"  Scraped: {articles[-1].title[:60]}...")

        print(f"Scraped {len(articles)} articles from {self.source_name}")
        return articles


class CBCNewsScraper(_NewsScraperMixin, BaseScraper):
    """Scraper for CBC News Business section."""

    source_name = "CBC News Business"
    base_url = "https://www.cbc.ca"
    section_url = "https://www.cbc.ca/news/business"

    def scrape(self, limit: int = 20, db: Session = None) -> List[Article]:
        print(f"Scraping {self.source_name}...")
        articles = []
        seen_urls = set()

        soup = self._fetch_and_parse(self.section_url)
        if not soup:
            return articles

        # CBC article URLs: /news/business/slug-with-numeric-id-9.XXXXXXX
        for link in soup.find_all("a", href=True):
            if len(articles) >= limit:
                break

            href = link.get("href", "")
            if not href or "#" in href:
                continue

            url = urljoin(self.base_url, href) if href.startswith("/") else href
            if not url.startswith("http"):
                continue

            # Must be a business article with a numeric ID at the end
            if "/news/business/" not in url:
                continue
            last_segment = url.rstrip("/").split("/")[-1]
            if not any(char.isdigit() for char in last_segment):
                continue

            if self._deduplicate_url(url, db, seen_urls):
                continue

            title = self.clean_text(link.get_text())
            if not title or len(title) < 10:
                continue

            article_data = self._scrape_generic_article(url, ["story", "article"])
            if not article_data:
                continue

            articles.append(self._build_article(url, title, article_data))
            print(f"  Scraped: {articles[-1].title[:60]}...")

        print(f"Scraped {len(articles)} articles from {self.source_name}")
        return articles


class TMXNewsScraper(_NewsScraperMixin, BaseScraper):
    """Scraper for TMX (Toronto Stock Exchange) news releases."""

    source_name = "TMX News"
    base_url = "https://www.tsx.com"
    section_url = "https://www.tsx.com/en/news"

    def scrape(self, limit: int = 20, db: Session = None) -> List[Article]:
        print(f"Scraping {self.source_name}...")
        articles = []
        seen_urls = set()

        soup = self._fetch_and_parse(self.section_url)
        if not soup:
            return articles

        # TMX uses 'news-list-item' divs with links like /en/news?id=1144&year=2026
        news_items = soup.find_all("div", class_="news-list-item")

        for item in news_items:
            if len(articles) >= limit:
                break

            link = item.find("a", href=True)
            if not link:
                continue

            href = link.get("href", "")
            url = urljoin(self.base_url, href) if href.startswith("/") else href

            # Must have id= parameter (indicates actual news release)
            if "id=" not in url:
                continue

            if self._deduplicate_url(url, db, seen_urls):
                continue

            title = self.clean_text(link.get_text())
            if not title or len(title) < 10:
                continue

            # For TMX news items, scrape the linked page
            article_data = self._scrape_generic_article(url, ["content", "article", "news"])
            if not article_data:
                # If page scrape fails, still create article from list data
                article_data = {"title": title, "content": title, "summary": title}

            articles.append(self._build_article(url, title, article_data))
            print(f"  Scraped: {articles[-1].title[:60]}...")

        print(f"Scraped {len(articles)} articles from {self.source_name}")
        return articles


class InvestmentExecutiveScraper(_NewsScraperMixin, BaseScraper):
    """Scraper for Investment Executive news."""

    source_name = "Investment Executive"
    base_url = "https://www.investmentexecutive.com"
    section_url = "https://www.investmentexecutive.com"

    # Generic category/section slugs to skip
    SKIP_SLUGS = {
        "industry-news", "from-the-regulators", "research-and-markets",
        "for-your-clients", "letters-to-the-editor", "in-depth",
        "insight", "building-your-business", "soundbites", "feature",
        "newspaper", "tools", "inside-track", "webinars", "news",
        "uncategorized", "equities", "writer",
    }

    def _is_article_url(self, url: str) -> bool:
        """Check if URL looks like an article (not a category/section page)."""
        url_path = url.replace(self.base_url, "").strip("/")
        path_parts = [p for p in url_path.split("/") if p]
        if not path_parts:
            return False

        # Must start with /news/ (the article section)
        if path_parts[0] != "news":
            return False

        # Skip if ALL parts are generic category names
        if all(p in self.SKIP_SLUGS for p in path_parts):
            return False

        # Last segment must be a real article slug: has hyphens and is long enough
        last_segment = path_parts[-1]
        if last_segment in self.SKIP_SLUGS:
            return False
        if "-" not in last_segment:
            return False
        # Real article slugs are typically longer than category slugs
        if len(last_segment) < 15:
            return False

        return True

    def scrape(self, limit: int = 20, db: Session = None) -> List[Article]:
        print(f"Scraping {self.source_name}...")
        articles = []
        seen_urls = set()

        soup = self._fetch_and_parse(self.section_url)
        if not soup:
            return articles

        # Scan all links and filter for article URLs
        for link in soup.find_all("a", href=True):
            if len(articles) >= limit:
                break

            href = link.get("href", "")
            if not href or "#" in href:
                continue

            url = urljoin(self.base_url, href) if href.startswith("/") else href
            if not url.startswith("http"):
                continue

            if "investmentexecutive.com" not in url:
                continue

            if not self._is_article_url(url):
                continue

            if self._deduplicate_url(url, db, seen_urls):
                continue

            title = self.clean_text(link.get_text())
            # Remove trailing "article image" text from IE's HTML
            title = re.sub(r"\s*article\s*(image)?\s*$", "", title, flags=re.IGNORECASE).strip()
            if not title or len(title) < 10:
                continue

            article_data = self._scrape_generic_article(url, ["entry", "article", "content"])
            if not article_data:
                continue

            articles.append(self._build_article(url, title, article_data))
            print(f"  Scraped: {articles[-1].title[:60]}...")

        print(f"Scraped {len(articles)} articles from {self.source_name}")
        return articles


class GlobalNewsScraper(_NewsScraperMixin, BaseScraper):
    """Scraper for Global News Money section."""

    source_name = "Global News Money"
    base_url = "https://globalnews.ca"
    section_url = "https://globalnews.ca/money/"

    def scrape(self, limit: int = 20, db: Session = None) -> List[Article]:
        print(f"Scraping {self.source_name}...")
        articles = []
        seen_urls = set()

        soup = self._fetch_and_parse(self.section_url)
        if not soup:
            return articles

        # Global News article URLs: /news/NUMERIC_ID/slug/
        article_pattern = re.compile(r"/news/\d+/")

        for link in soup.find_all("a", href=True):
            if len(articles) >= limit:
                break

            href = link.get("href", "")
            if not href or "#" in href:
                continue

            url = urljoin(self.base_url, href) if href.startswith("/") else href
            if not url.startswith("http"):
                continue

            if "globalnews.ca" not in url:
                continue
            if not article_pattern.search(url):
                continue

            if self._deduplicate_url(url, db, seen_urls):
                continue

            title = self.clean_text(link.get_text())
            if not title or len(title) < 10:
                continue

            article_data = self._scrape_generic_article(url, ["story", "article", "entry"])
            if not article_data:
                continue

            articles.append(self._build_article(url, title, article_data))
            print(f"  Scraped: {articles[-1].title[:60]}...")

        print(f"Scraped {len(articles)} articles from {self.source_name}")
        return articles


class FinancialPostScraper(_NewsScraperMixin, BaseScraper):
    """Scraper for Financial Post."""

    source_name = "Financial Post"
    base_url = "https://financialpost.com"
    section_url = "https://financialpost.com"

    # Category paths that indicate section pages, not articles
    SECTION_PATHS = {
        "category", "register", "sign-in", "newsletters", "subscribe",
        "my-account", "privacy", "terms", "about", "contact",
    }

    def scrape(self, limit: int = 20, db: Session = None) -> List[Article]:
        print(f"Scraping {self.source_name}...")
        articles = []
        seen_urls = set()

        soup = self._fetch_and_parse(self.section_url)
        if not soup:
            return articles

        # FP uses <article> tags with class 'article-card'
        article_tags = soup.find_all("article", class_=lambda x: x and "article-card" in x if x else False)

        for article_tag in article_tags:
            if len(articles) >= limit:
                break

            link = article_tag.find("a", href=True)
            if not link:
                continue

            href = link.get("href", "")
            url = urljoin(self.base_url, href) if href.startswith("/") else href
            if not url.startswith("http"):
                continue

            if "financialpost.com" not in url:
                continue

            # Skip section/utility pages
            url_path = url.replace("https://financialpost.com/", "").strip("/")
            first_segment = url_path.split("/")[0] if url_path else ""
            if first_segment in self.SECTION_PATHS:
                continue

            # Must have at least 2 path segments (e.g., /news/article-slug)
            if len(url_path.split("/")) < 2:
                continue

            if self._deduplicate_url(url, db, seen_urls):
                continue

            title = self.clean_text(link.get_text())
            # Remove "Subscriber only." prefix
            title = re.sub(r"^Subscriber only\.\s*", "", title, flags=re.IGNORECASE).strip()
            if not title or len(title) < 10:
                continue

            article_data = self._scrape_generic_article(url, ["article", "story", "content"])
            if not article_data:
                continue

            articles.append(self._build_article(url, title, article_data))
            print(f"  Scraped: {articles[-1].title[:60]}...")

        print(f"Scraped {len(articles)} articles from {self.source_name}")
        return articles


class YahooFinanceCanadaScraper(_NewsScraperMixin, BaseScraper):
    """Scraper for Yahoo Finance Canada news using RSS feed (more reliable than JS-rendered pages)."""

    source_name = "Yahoo Finance Canada"
    base_url = "https://ca.finance.yahoo.com"
    # Use RSS feed since Yahoo Finance pages are heavily JavaScript-rendered
    rss_url = "https://finance.yahoo.com/news/rssindex"

    def scrape(self, limit: int = 20, db: Session = None) -> List[Article]:
        import feedparser

        print(f"Scraping {self.source_name}...")
        articles = []
        seen_urls = set()

        try:
            feed = feedparser.parse(self.rss_url)
        except Exception as e:
            print(f"  Failed to parse RSS feed: {e}")
            return articles

        if not feed.entries:
            # Fallback: try scraping the main page
            return self._scrape_html_fallback(limit, db, seen_urls)

        for entry in feed.entries[:limit * 2]:
            if len(articles) >= limit:
                break

            url = entry.get("link", "")
            if not url:
                continue

            if self._deduplicate_url(url, db, seen_urls):
                continue

            title = self.clean_text(entry.get("title", ""))
            if not title or len(title) < 10:
                continue

            # Build article from RSS data
            content = self.clean_text(entry.get("summary", ""))
            published_at = None
            if entry.get("published_parsed"):
                try:
                    published_at = datetime(*entry.published_parsed[:6])
                except (TypeError, ValueError):
                    pass

            article_data = {
                "title": title,
                "content": content,
                "summary": content[:500] if content else title,
                "published_at": published_at,
            }

            # If content is short, try to fetch full article
            if len(content) < 200:
                full_data = self._scrape_generic_article(url, ["article", "caas-body", "body"])
                if full_data and len(full_data.get("content", "")) > len(content):
                    article_data["content"] = full_data["content"]
                    article_data["summary"] = full_data["content"][:500]

            articles.append(self._build_article(url, title, article_data))
            print(f"  Scraped: {articles[-1].title[:60]}...")

        print(f"Scraped {len(articles)} articles from {self.source_name}")
        return articles

    def _scrape_html_fallback(self, limit, db, seen_urls):
        """Fallback HTML scraping if RSS feed fails."""
        articles = []
        soup = self._fetch_and_parse(self.base_url)
        if not soup:
            return articles

        for link in soup.find_all("a", href=True):
            if len(articles) >= limit:
                break

            href = link.get("href", "")
            if not href or "#" in href:
                continue

            url = urljoin(self.base_url, href) if href.startswith("/") else href
            if not url.startswith("http"):
                continue

            if "/news/" not in url:
                continue
            news_path = url.split("/news/")[-1].strip("/")
            if not news_path:
                continue

            if self._deduplicate_url(url, db, seen_urls):
                continue

            title = self.clean_text(link.get_text())
            if not title or len(title) < 10:
                continue

            article_data = self._scrape_generic_article(url, ["article", "caas-body"])
            if not article_data:
                continue

            articles.append(self._build_article(url, title, article_data))
            print(f"  Scraped: {articles[-1].title[:60]}...")

        return articles

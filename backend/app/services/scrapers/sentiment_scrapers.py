from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime
from typing import List, Optional

from sqlalchemy.orm import Session

from app.models import SentimentData
from app.config import get_settings


class RedditScraper:
    """
    Reddit scraper for Canadian investing communities.
    Uses PRAW (Python Reddit API Wrapper) when credentials are available,
    falls back to public JSON API otherwise.
    """

    source_name = "Reddit"
    source_type = "community"

    # Subreddits to scrape
    DEFAULT_SUBREDDITS = ["CanadianInvestor", "CanadaFinance"]

    # Common TSX ticker patterns to detect in posts
    TICKER_PATTERN = re.compile(
        r"\b(?:(?:\$)?([A-Z]{1,5}(?:\.[A-Z]{1,2})?)(?:\.TO)?)\b"
    )

    @staticmethod
    def hash_url(url: str) -> str:
        return hashlib.sha256(url.encode()).hexdigest()

    def _extract_tickers(self, text: str) -> List[str]:
        """Extract stock ticker symbols from text."""
        settings = get_settings()
        known_tickers = set(settings.tsx_stocks.keys())
        # Also match without .TO suffix
        known_base = {t.replace(".TO", "") for t in known_tickers}

        found = set()
        for match in self.TICKER_PATTERN.finditer(text):
            symbol = match.group(1)
            if symbol in known_base:
                found.add(f"{symbol}.TO")
            elif f"{symbol}.TO" in known_tickers:
                found.add(f"{symbol}.TO")
            elif symbol in known_tickers:
                found.add(symbol)

        return list(found)

    def scrape_subreddit_json(self, subreddit: str, limit: int = 25,
                              sort: str = "hot", db: Optional[Session] = None) -> List[SentimentData]:
        """
        Scrape subreddit using Reddit's public JSON API (no auth needed).
        """
        import requests

        print(f"Scraping r/{subreddit} ({sort})...")
        posts = []

        url = f"https://www.reddit.com/r/{subreddit}/{sort}.json?limit={limit}"
        headers = {"User-Agent": "FinancialIntelligencePlatform/1.0"}

        try:
            response = requests.get(url, headers=headers, timeout=15)
            response.raise_for_status()
            data = response.json()
        except Exception as e:
            print(f"  Error fetching r/{subreddit}: {e}")
            return posts

        children = data.get("data", {}).get("children", [])
        if not children:
            print(f"  No posts found in r/{subreddit}")
            return posts

        for child in children:
            post_data = child.get("data", {})
            if not post_data:
                continue

            # Build the post URL
            permalink = post_data.get("permalink", "")
            post_url = f"https://www.reddit.com{permalink}" if permalink else ""
            if not post_url:
                continue

            # Check for duplicates
            url_hash = self.hash_url(post_url)
            if db:
                existing = db.query(SentimentData).filter(SentimentData.url_hash == url_hash).first()
                if existing:
                    continue

            # Extract content
            title = post_data.get("title", "")
            selftext = post_data.get("selftext", "")
            content = f"{title}\n\n{selftext}".strip()

            if not content or len(content) < 10:
                continue

            # Extract tickers mentioned
            tickers = self._extract_tickers(content)

            # Parse timestamp
            created_utc = post_data.get("created_utc")
            posted_at = datetime.utcfromtimestamp(created_utc) if created_utc else None

            sentiment_item = SentimentData(
                source=f"Reddit r/{subreddit}",
                source_type=self.source_type,
                content=content[:5000],  # Cap content length
                author=post_data.get("author", ""),
                url=post_url,
                url_hash=url_hash,
                posted_at=posted_at,
                ingested_at=datetime.utcnow(),
                upvotes=post_data.get("ups", 0),
                comments_count=post_data.get("num_comments", 0),
                tickers_mentioned=json.dumps(tickers) if tickers else None,
                processed=False,
            )

            posts.append(sentiment_item)

            if db:
                db.add(sentiment_item)

        if db:
            db.commit()

        print(f"  Scraped {len(posts)} posts from r/{subreddit}")
        return posts

    def scrape_with_praw(self, subreddit: str, limit: int = 25,
                         sort: str = "hot", db: Optional[Session] = None) -> List[SentimentData]:
        """
        Scrape subreddit using PRAW (requires Reddit API credentials).
        Falls back to JSON API if credentials are not configured.
        """
        settings = get_settings()

        if not settings.reddit_client_id or not settings.reddit_client_secret:
            print("  Reddit API credentials not configured, using JSON API fallback")
            return self.scrape_subreddit_json(subreddit, limit, sort, db)

        try:
            import praw
        except ImportError:
            print("  PRAW not installed, using JSON API fallback")
            return self.scrape_subreddit_json(subreddit, limit, sort, db)

        print(f"Scraping r/{subreddit} ({sort}) via PRAW...")
        posts = []

        try:
            reddit = praw.Reddit(
                client_id=settings.reddit_client_id,
                client_secret=settings.reddit_client_secret,
                user_agent=settings.reddit_user_agent,
            )

            sub = reddit.subreddit(subreddit)
            if sort == "hot":
                submissions = sub.hot(limit=limit)
            elif sort == "new":
                submissions = sub.new(limit=limit)
            elif sort == "top":
                submissions = sub.top(limit=limit, time_filter="week")
            else:
                submissions = sub.hot(limit=limit)

            for submission in submissions:
                post_url = f"https://www.reddit.com{submission.permalink}"
                url_hash = self.hash_url(post_url)

                if db:
                    existing = db.query(SentimentData).filter(SentimentData.url_hash == url_hash).first()
                    if existing:
                        continue

                content = f"{submission.title}\n\n{submission.selftext}".strip()
                if not content or len(content) < 10:
                    continue

                tickers = self._extract_tickers(content)

                posted_at = datetime.utcfromtimestamp(submission.created_utc) if submission.created_utc else None

                sentiment_item = SentimentData(
                    source=f"Reddit r/{subreddit}",
                    source_type=self.source_type,
                    content=content[:5000],
                    author=str(submission.author) if submission.author else "",
                    url=post_url,
                    url_hash=url_hash,
                    posted_at=posted_at,
                    ingested_at=datetime.utcnow(),
                    upvotes=submission.ups,
                    comments_count=submission.num_comments,
                    tickers_mentioned=json.dumps(tickers) if tickers else None,
                    processed=False,
                )

                posts.append(sentiment_item)
                if db:
                    db.add(sentiment_item)

            if db:
                db.commit()

        except Exception as e:
            print(f"  PRAW error: {e}, falling back to JSON API")
            return self.scrape_subreddit_json(subreddit, limit, sort, db)

        print(f"  Scraped {len(posts)} posts from r/{subreddit}")
        return posts

    def scrape_all(self, limit: int = 25, db: Optional[Session] = None) -> List[SentimentData]:
        """Scrape all configured subreddits."""
        all_posts = []
        for subreddit in self.DEFAULT_SUBREDDITS:
            posts = self.scrape_with_praw(subreddit, limit=limit, db=db)
            all_posts.extend(posts)
        return all_posts


class TwitterScraper:
    """
    Twitter/X scraper for Canadian financial news and market sentiment.
    Uses tweepy with Twitter API v2 (Bearer Token auth).
    Gracefully returns empty results if bearer token is not configured.
    """

    source_name = "Twitter"
    source_type = "social"

    TICKER_PATTERN = re.compile(
        r"\b(?:(?:\$)?([A-Z]{1,5}(?:\.[A-Z]{1,2})?)(?:\.TO)?)\b"
    )

    def __init__(self):
        settings = get_settings()
        self.bearer_token = settings.twitter_bearer_token
        self.accounts = settings.twitter_accounts
        self.keywords = settings.twitter_search_keywords
        self._client = None

    @staticmethod
    def hash_url(url: str) -> str:
        return hashlib.sha256(url.encode()).hexdigest()

    def _get_client(self):
        """Lazy-init tweepy client. Returns None if no bearer token."""
        if self._client is not None:
            return self._client
        if not self.bearer_token:
            return None
        try:
            import tweepy
            self._client = tweepy.Client(bearer_token=self.bearer_token, wait_on_rate_limit=True)
            return self._client
        except Exception as e:
            print(f"Twitter: Failed to initialise client: {e}")
            return None

    def _extract_tickers(self, text: str) -> List[str]:
        """Extract stock ticker symbols from text."""
        settings = get_settings()
        known_tickers = set(settings.tsx_stocks.keys())
        known_base = {t.replace(".TO", "") for t in known_tickers}

        found = set()
        for match in self.TICKER_PATTERN.finditer(text):
            symbol = match.group(1)
            if symbol in known_base:
                found.add(f"{symbol}.TO")
            elif f"{symbol}.TO" in known_tickers:
                found.add(f"{symbol}.TO")
            elif symbol in known_tickers:
                found.add(symbol)
        return list(found)

    def search_recent(self, query: str, limit: int = 20,
                      db: Optional[Session] = None) -> List[SentimentData]:
        """Search recent tweets using Twitter API v2."""
        client = self._get_client()
        if not client:
            return []

        import tweepy

        posts = []
        try:
            # Twitter API v2 recent search (last 7 days)
            response = client.search_recent_tweets(
                query=f"{query} -is:retweet lang:en",
                max_results=min(limit, 100),
                tweet_fields=["created_at", "public_metrics", "author_id"],
                user_fields=["username"],
                expansions=["author_id"],
            )

            if not response.data:
                return posts

            # Build author lookup
            users = {}
            if response.includes and "users" in response.includes:
                for user in response.includes["users"]:
                    users[user.id] = user.username

            for tweet in response.data:
                author = users.get(tweet.author_id, "unknown")
                tweet_url = f"https://twitter.com/{author}/status/{tweet.id}"
                url_hash = self.hash_url(tweet_url)

                # Dedup
                if db:
                    existing = db.query(SentimentData).filter(
                        SentimentData.url_hash == url_hash
                    ).first()
                    if existing:
                        continue

                content = tweet.text or ""
                if len(content) < 10:
                    continue

                tickers = self._extract_tickers(content)
                metrics = tweet.public_metrics or {}

                sentiment_item = SentimentData(
                    source=f"Twitter @{author}",
                    source_type=self.source_type,
                    content=content[:5000],
                    author=author,
                    url=tweet_url,
                    url_hash=url_hash,
                    posted_at=tweet.created_at,
                    ingested_at=datetime.utcnow(),
                    upvotes=metrics.get("like_count", 0),
                    comments_count=metrics.get("reply_count", 0),
                    tickers_mentioned=json.dumps(tickers) if tickers else None,
                    processed=False,
                )
                posts.append(sentiment_item)
                if db:
                    db.add(sentiment_item)

            if db:
                db.commit()

        except tweepy.errors.TooManyRequests:
            print("Twitter: Rate limit hit, returning partial results")
        except Exception as e:
            print(f"Twitter: Search error for '{query}': {e}")
            if db:
                db.rollback()

        return posts

    def scrape_accounts(self, limit: int = 10,
                        db: Optional[Session] = None) -> List[SentimentData]:
        """Fetch recent tweets from tracked financial accounts."""
        client = self._get_client()
        if not client:
            return []

        import tweepy

        all_posts = []
        for handle in self.accounts:
            try:
                # Look up user by username
                user_resp = client.get_user(username=handle)
                if not user_resp.data:
                    print(f"Twitter: User @{handle} not found")
                    continue

                user_id = user_resp.data.id

                # Get recent tweets from this user
                response = client.get_users_tweets(
                    id=user_id,
                    max_results=min(limit, 100),
                    tweet_fields=["created_at", "public_metrics"],
                    exclude=["retweets", "replies"],
                )

                if not response.data:
                    continue

                for tweet in response.data:
                    tweet_url = f"https://twitter.com/{handle}/status/{tweet.id}"
                    url_hash = self.hash_url(tweet_url)

                    if db:
                        existing = db.query(SentimentData).filter(
                            SentimentData.url_hash == url_hash
                        ).first()
                        if existing:
                            continue

                    content = tweet.text or ""
                    if len(content) < 10:
                        continue

                    tickers = self._extract_tickers(content)
                    metrics = tweet.public_metrics or {}

                    sentiment_item = SentimentData(
                        source=f"Twitter @{handle}",
                        source_type=self.source_type,
                        content=content[:5000],
                        author=handle,
                        url=tweet_url,
                        url_hash=url_hash,
                        posted_at=tweet.created_at,
                        ingested_at=datetime.utcnow(),
                        upvotes=metrics.get("like_count", 0),
                        comments_count=metrics.get("reply_count", 0),
                        tickers_mentioned=json.dumps(tickers) if tickers else None,
                        processed=False,
                    )
                    all_posts.append(sentiment_item)
                    if db:
                        db.add(sentiment_item)

                if db:
                    db.commit()

                print(f"  Twitter @{handle}: fetched tweets")

            except tweepy.errors.TooManyRequests:
                print(f"Twitter: Rate limit hit on @{handle}, stopping account scrape")
                break
            except Exception as e:
                print(f"Twitter: Error fetching @{handle}: {e}")
                if db:
                    db.rollback()

        return all_posts

    def scrape_all(self, limit: int = 25,
                   db: Optional[Session] = None) -> List[SentimentData]:
        """
        Scrape all Twitter sources: keyword search + tracked accounts.
        Returns combined, deduplicated results.
        """
        if not self.bearer_token:
            print("Twitter: No bearer token configured, skipping")
            return []

        print("Scraping Twitter/X...")
        all_posts = []
        seen_hashes = set()

        # 1. Keyword search (use top 3 keywords to stay within rate limits)
        for keyword in self.keywords[:3]:
            posts = self.search_recent(keyword, limit=limit, db=db)
            for p in posts:
                if p.url_hash not in seen_hashes:
                    all_posts.append(p)
                    seen_hashes.add(p.url_hash)

        # 2. Tracked accounts
        account_posts = self.scrape_accounts(limit=10, db=db)
        for p in account_posts:
            if p.url_hash not in seen_hashes:
                all_posts.append(p)
                seen_hashes.add(p.url_hash)

        print(f"  Twitter total: {len(all_posts)} posts scraped")
        return all_posts

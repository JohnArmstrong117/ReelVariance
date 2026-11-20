"""Pure helpers for MovieLens histograms, TMDB finance, and IMDb word counts."""

from __future__ import annotations

import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

TOKEN = re.compile(r"[a-z]{3,}")
TITLE_YEAR = re.compile(r"^(.*)\s\((\d{4})\)\s*$")
NO_GENRE = "(no genres listed)"
# IMAX is a MovieLens format tag, not a genre.
EXCLUDED_GENRES = {NO_GENRE, "IMAX"}
POSTER_BASE = "https://image.tmdb.org/t/p/w342"


def rating_to_bin(rating) -> int:
    """Map a MovieLens half-star rating onto bins 0..9 (0.5 through 5.0)."""
    return int(round(float(rating) * 2)) - 1


def year_from_timestamp(timestamp) -> int:
    return datetime.fromtimestamp(int(timestamp), timezone.utc).year


def parse_title(title: str) -> tuple[str, int | None]:
    text = (title or "").strip()
    match = TITLE_YEAR.match(text)
    if not match:
        return text, None
    return match.group(1).strip(), int(match.group(2))


def parse_genres(raw: str) -> list[str]:
    return [genre for genre in (raw or "").split("|") if genre and genre not in EXCLUDED_GENRES]


def normalize_imdb(imdb_id: str | None) -> str | None:
    text = (imdb_id or "").strip()
    if text.lower().startswith("tt"):
        text = text[2:]
    if not text.isdigit():
        return None
    return "tt" + text.zfill(7)


def parse_money(value) -> int:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return 0
    if number <= 0:
        return 0
    return int(number)


def finance_fields(meta: dict | None) -> tuple[int | None, int | None, str | None]:
    """Budget and revenue are kept only when both are positive. Poster is independent."""
    if not meta:
        return None, None, None
    poster_path = meta.get("poster_path") or None
    poster = POSTER_BASE + poster_path if poster_path else None
    budget = int(meta.get("budget") or 0)
    revenue = int(meta.get("revenue") or 0)
    if budget > 0 and revenue > 0:
        return budget, revenue, poster
    return None, None, poster


def load_stopwords(path: Path) -> set[str]:
    words = set()
    for line in path.read_text(encoding="utf-8").splitlines():
        word = line.split("#", 1)[0].strip().lower()
        if word:
            words.add(word)
    return words


def tokenize(text: str, stopwords: set[str]) -> list[str]:
    cleaned = (text or "").lower().replace("'", "").replace("\u2019", "")
    return [word for word in TOKEN.findall(cleaned) if word not in stopwords]


def aggregate_rows(rows, keep_ids: set[int] | None = None):
    """Lifetime and yearly 10-bin histograms.

    rows yields (movie_id, rating, unix_timestamp). keep_ids limits the pass.
    Yearly bins are stored only for years that received ratings, so they sum
    to the lifetime bins for every movie that is kept.
    """
    lifetime: dict[int, list[int]] = {}
    yearly: dict[int, dict[int, list[int]]] = {}
    for movie_id, rating, timestamp in rows:
        mid = int(movie_id)
        if keep_ids is not None and mid not in keep_ids:
            continue
        bin_index = rating_to_bin(rating)
        if bin_index < 0 or bin_index > 9:
            continue
        bins = lifetime.get(mid)
        if bins is None:
            bins = [0] * 10
            lifetime[mid] = bins
            yearly[mid] = {}
        bins[bin_index] += 1
        year = year_from_timestamp(timestamp)
        year_bins = yearly[mid].get(year)
        if year_bins is None:
            year_bins = [0] * 10
            yearly[mid][year] = year_bins
        year_bins[bin_index] += 1
    return lifetime, yearly


def build_movie_records(keep_ids, lifetime, yearly, movie_info, links, metadata, threshold: int):
    records = []
    year_min = None
    year_max = None
    finance_movies = 0
    for mid in sorted(keep_ids):
        info = movie_info.get(mid)
        bins = lifetime.get(mid)
        if info is None or bins is None or sum(bins) < threshold:
            continue
        timeline = []
        for year in sorted(yearly.get(mid, {})):
            year_bins = yearly[mid][year]
            if not any(year_bins):
                continue
            timeline.append({"year": year, "bins": year_bins})
            year_min = year if year_min is None else min(year_min, year)
            year_max = year if year_max is None else max(year_max, year)
        imdb = links.get(mid)
        budget, revenue, _poster = finance_fields(metadata.get(imdb) if imdb else None)
        if budget is not None:
            finance_movies += 1
        # movies_metadata poster paths are stale and 404 on the TMDB image CDN.
        records.append({
            "id": mid,
            "title": info["title"],
            "year": info["year"],
            "genres": info["genres"],
            "poster": None,
            "bins": bins,
            "timeline": timeline,
            "budget": budget,
            "revenue": revenue,
        })
    return records, year_min, year_max, finance_movies


def language_triples(review_iter_factory, imdb_to_movie: dict[str, int], stopwords: set[str], min_count: int = 30):
    """Sparse [wordIndex, stars, count] triples for linked movies.

    review_iter_factory() is called twice. Each review is a dict with movie_id,
    rating (IMDb 1-10), and review_text. Ratings are stored on the 0.5-5 star
    scale (IMDb score divided by 2). A review is stored once on its MovieLens id.
    Returns (words, movies, reviews_used).
    """
    counts: Counter[str] = Counter()
    for review in review_iter_factory():
        if imdb_to_movie.get(review.get("movie_id")) is None:
            continue
        if _imdb_rating(review.get("rating")) is None:
            continue
        counts.update(tokenize(review.get("review_text") or "", stopwords))
    words = sorted(word for word, count in counts.items() if count >= min_count)
    index = {word: position for position, word in enumerate(words)}
    cells: dict[int, dict[tuple[int, float], int]] = {}
    reviews_used = 0
    for review in review_iter_factory():
        mid = imdb_to_movie.get(review.get("movie_id"))
        rating = _imdb_rating(review.get("rating"))
        if mid is None or rating is None:
            continue
        reviews_used += 1
        bucket = cells.setdefault(mid, {})
        for word in tokenize(review.get("review_text") or "", stopwords):
            word_index = index.get(word)
            if word_index is None:
                continue
            key = (word_index, rating)
            bucket[key] = bucket.get(key, 0) + 1
    movies = {}
    for mid, bucket in cells.items():
        triples = [[word_index, rating, count] for (word_index, rating), count in sorted(bucket.items()) if count]
        if triples:
            movies[str(mid)] = triples
    return words, movies, reviews_used


def prune_language(words, language_movies, movie_genres, per_slice=30):
    """Keep words that can appear in a top-word cloud, with exact counts.

    The page shows 24 words. For each genre, each star rating, each genre-rating
    pair, and the whole catalog, the ``per_slice`` most common words are kept.
    A multi-genre selection can still miss a word that is outside that cutoff
    in every selected genre. Counts for the words that remain are exact.
    """
    global_counts = Counter()
    by_rating = {}
    by_genre = {}
    by_genre_rating = {}
    for movie_id, triples in language_movies.items():
        genres = movie_genres.get(int(movie_id), [])
        for word_index, rating, count in triples:
            global_counts[word_index] += count
            by_rating.setdefault(rating, Counter())[word_index] += count
            for genre in genres:
                by_genre.setdefault(genre, Counter())[word_index] += count
                by_genre_rating.setdefault((genre, rating), Counter())[word_index] += count
    keep = set()

    def take(counter):
        keep.update(word_index for word_index, _count in counter.most_common(per_slice))

    take(global_counts)
    for counter in by_rating.values():
        take(counter)
    for counter in by_genre.values():
        take(counter)
    for counter in by_genre_rating.values():
        take(counter)
    ordered = [index for index in range(len(words)) if index in keep]
    remap = {old: new for new, old in enumerate(ordered)}
    kept_words = [words[index] for index in ordered]
    kept_movies = {}
    for movie_id, triples in language_movies.items():
        compact = [[remap[word_index], rating, count] for word_index, rating, count in triples if word_index in remap]
        if compact:
            kept_movies[movie_id] = compact
    return kept_words, kept_movies


def imdb_to_stars(score: int) -> float:
    """Convert an IMDb 1-10 score to the 0.5-5 star scale used by MovieLens."""
    return score / 2


def _imdb_rating(value) -> float | None:
    """Validate an IMDb 1-10 score and return it as 0.5-5 stars."""
    try:
        rating = int(str(value).strip())
    except (TypeError, ValueError):
        return None
    if 1 <= rating <= 10:
        return imdb_to_stars(rating)
    return None

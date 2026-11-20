"""Build prototype/data/catalog.js from the local MovieLens, TMDB, and IMDb files."""

from __future__ import annotations

import argparse
import csv
import json
from collections import Counter
from pathlib import Path

from pipeline.aggregate import (
    aggregate_rows,
    build_movie_records,
    finance_fields,
    language_triples,
    prune_language,
    load_stopwords,
    normalize_imdb,
    parse_genres,
    parse_money,
    parse_title,
)

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_RATINGS = ROOT / "Data" / "MoviLens_32M_Dataset" / "ml-32m" / "ratings.csv"
DEFAULT_MOVIES = ROOT / "Data" / "MoviLens_32M_Dataset" / "ml-32m" / "movies.csv"
DEFAULT_LINKS = ROOT / "Data" / "MoviLens_32M_Dataset" / "ml-32m" / "links.csv"
DEFAULT_METADATA = ROOT / "Data" / "Additional_Film_Data" / "movies_metadata.csv"
DEFAULT_REVIEWS = ROOT / "Data" / "IMDB_Spoilers_DataSet" / "IMDB_reviews.json"
DEFAULT_STOPWORDS = Path(__file__).resolve().parent / "stopwords.txt"
DEFAULT_OUTPUT = ROOT / "prototype" / "data" / "catalog.js"


def main(argv=None) -> None:
    parser = argparse.ArgumentParser(description="Precompute the static Reel Variance catalog.")
    parser.add_argument("--min-ratings", type=int, default=1000)
    parser.add_argument("--min-word-count", type=int, default=30)
    parser.add_argument("--ratings", type=Path, default=DEFAULT_RATINGS)
    parser.add_argument("--movies", type=Path, default=DEFAULT_MOVIES)
    parser.add_argument("--links", type=Path, default=DEFAULT_LINKS)
    parser.add_argument("--metadata", type=Path, default=DEFAULT_METADATA)
    parser.add_argument("--reviews", type=Path, default=DEFAULT_REVIEWS)
    parser.add_argument("--stopwords", type=Path, default=DEFAULT_STOPWORDS)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args(argv)

    print(f"Counting ratings in {args.ratings}", flush=True)
    keep_ids = count_movie_ids(args.ratings, args.min_ratings)
    print(f"Films with at least {args.min_ratings} ratings: {len(keep_ids)}", flush=True)

    print("Aggregating lifetime and yearly histograms", flush=True)
    lifetime, yearly = aggregate_rows(iter_ratings(args.ratings, "aggregated"), keep_ids)

    movie_info = load_movies(args.movies)
    links = load_links(args.links)
    metadata = load_metadata(args.metadata)
    records, year_min, year_max, finance_movies = build_movie_records(
        keep_ids, lifetime, yearly, movie_info, links, metadata, args.min_ratings
    )
    validate_records(records)

    imdb_to_movie = {}
    for record in records:
        imdb = links.get(record["id"])
        if imdb:
            imdb_to_movie[imdb] = record["id"]
    stopwords = load_stopwords(args.stopwords)
    print(f"Counting IMDb review words in {args.reviews}", flush=True)
    words, language_movies, reviews_used = language_triples(
        lambda: iter_reviews(args.reviews),
        imdb_to_movie,
        stopwords,
        args.min_word_count,
    )
    genres_by_id = {record["id"]: record["genres"] for record in records}
    words, language_movies = prune_language(words, language_movies, genres_by_id)

    catalog = {
        "meta": {
            "ratingCountMin": args.min_ratings,
            "movieCount": len(records),
            "ratingYearMin": year_min,
            "ratingYearMax": year_max,
            "financeMovies": finance_movies,
            "imdbMoviesLinked": len(language_movies),
            "imdbReviewsUsed": reviews_used,
        },
        "movies": records,
        "language": {"words": words, "movies": language_movies},
    }
    write_catalog(args.output, catalog)
    print(
        f"Wrote {args.output} · {len(records)} films · {finance_movies} with budget and revenue · "
        f"{len(language_movies)} films with review words · {reviews_used} reviews · "
        f"rating years {year_min}–{year_max}",
        flush=True,
    )


def count_movie_ids(path: Path, threshold: int) -> set[int]:
    counts: Counter[int] = Counter()
    for movie_id, _rating, _timestamp in iter_ratings(path, "counted"):
        counts[movie_id] += 1
    return {movie_id for movie_id, count in counts.items() if count >= threshold}


def iter_ratings(path: Path, label: str = "ratings"):
    with path.open(encoding="utf-8", newline="") as handle:
        for index, row in enumerate(csv.DictReader(handle), start=1):
            if index % 5_000_000 == 0:
                print(f"  {label} {index:,} ratings", flush=True)
            yield int(row["movieId"]), row["rating"], row["timestamp"]


def load_movies(path: Path) -> dict[int, dict]:
    movies = {}
    with path.open(encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            title, year = parse_title(row["title"])
            movies[int(row["movieId"])] = {
                "title": title,
                "year": year,
                "genres": parse_genres(row["genres"]),
            }
    return movies


def load_links(path: Path) -> dict[int, str]:
    links = {}
    with path.open(encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            imdb = normalize_imdb(row.get("imdbId"))
            if imdb:
                links[int(row["movieId"])] = imdb
    return links


def load_metadata(path: Path) -> dict[str, dict]:
    metadata = {}
    with path.open(encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            if row is None:
                continue
            imdb = normalize_imdb(row.get("imdb_id"))
            if not imdb:
                continue
            poster = (row.get("poster_path") or "").strip()
            if poster in ("", "None", "null"):
                poster = None
            elif not poster.startswith("/"):
                poster = "/" + poster
            metadata[imdb] = {
                "budget": parse_money(row.get("budget")),
                "revenue": parse_money(row.get("revenue")),
                "poster_path": poster,
            }
    return metadata


def iter_reviews(path: Path):
    with path.open(encoding="utf-8") as handle:
        for index, line in enumerate(handle, start=1):
            if index % 100_000 == 0:
                print(f"  read {index:,} reviews", flush=True)
            line = line.strip()
            if line:
                yield json.loads(line)


def validate_records(records) -> None:
    seen = set()
    for record in records:
        if record["id"] in seen:
            raise SystemExit(f"Duplicate movie id {record['id']}")
        seen.add(record["id"])
        if len(record["bins"]) != 10:
            raise SystemExit(f"Movie {record['id']} does not have 10 rating bins")
        for index in range(10):
            yearly = sum(row["bins"][index] for row in record["timeline"])
            if yearly != record["bins"][index]:
                raise SystemExit(f"Movie {record['id']} yearly bins do not sum to the lifetime histogram")
        budget, revenue, _poster = finance_fields({
            "budget": record["budget"] or 0,
            "revenue": record["revenue"] or 0,
            "poster_path": None,
        })
        if (budget is None) != (record["budget"] is None) or (revenue is None) != (record["revenue"] is None):
            raise SystemExit(f"Movie {record['id']} has an incomplete budget/revenue pair")


def write_catalog(path: Path, catalog: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(catalog, ensure_ascii=True, separators=(",", ":"))
    path.write_text("window.REEL_CATALOG=" + payload + ";\n", encoding="utf-8")


if __name__ == "__main__":
    main()

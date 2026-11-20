# Static catalog

GitHub Pages only receives precomputed aggregates. This package reads the local datasets and writes [`prototype/data/catalog.js`](../prototype/data/catalog.js). The browser does not load the raw rating or review files.

From the repository root:

```sh
python -m pipeline
python -m pipeline.tests
```

`python -m pipeline` keeps MovieLens films with at least 1,000 ratings. For each film it writes a 10-bin lifetime histogram (0.5 through 5.0 stars) and the same histogram for each rating-submission year. Yearly bins sum to the lifetime bins.

Genres come from `movies.csv`. `(no genres listed)` and `IMAX` are dropped, because IMAX is a format tag rather than a genre.

TMDB budget and revenue are attached only when both are greater than zero. Poster paths in that metadata no longer resolve on the TMDB image CDN, so `poster` is null and the page does not request them. Films join to IMDb reviews through `links.csv` IMDb ids, not titles. Review words are lowercase tokens of at least three letters, with the stopwords in `stopwords.txt` removed. A word must occur at least 30 times in the linked reviews. The page shows 24 words at a time, so the catalog then keeps the 30 most common words for the whole set, for each genre, for each IMDb rating, and for each genre-rating pair. Counts for those words stay exact. A combination of genres can omit a word that falls outside that cutoff in every selected genre. Each linked movie stores sparse `[wordIndex, stars, count]` triples. IMDb scores (1–10) are divided by 2, so they sit on the same 0.5–5 half-star scale as MovieLens. A word's average rating on the page is computed from the stored triples, so it is approximate for words whose rarer ratings were pruned. Spoiler reviews are included as counts; review text is not written out.

The generated file is:

```js
window.REEL_CATALOG = {
  meta: { ratingCountMin, movieCount, ratingYearMin, ratingYearMax, financeMovies, imdbMoviesLinked, imdbReviewsUsed },
  movies: [{ id, title, year, genres, poster, bins, timeline: [{ year, bins }], budget, revenue }],
  language: { words: ["masterpiece"], movies: { "318": [[wordIndex, rating, count]] } }
};
```

Inputs, relative to the repository root:

- `Data/MoviLens_32M_Dataset/ml-32m/ratings.csv`
- `Data/MoviLens_32M_Dataset/ml-32m/movies.csv`
- `Data/MoviLens_32M_Dataset/ml-32m/links.csv`
- `Data/Additional_Film_Data/movies_metadata.csv`
- `Data/IMDB_Spoilers_DataSet/IMDB_reviews.json`

`python -m pipeline.tests` uses tiny in-memory rows and does not read those files.

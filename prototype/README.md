# Reel Variance: Prototype 1.0

A standalone web prototype for exploring audience disagreement about films. It provides a foundation for the team to integrate real data, add review analysis, and refine the interface. It uses plain HTML, CSS, and JavaScript, with no framework or build step.

## Run

Open `index.html` in a modern browser. No installation, API key, backend, or internet connection is needed. Posters are stored locally.

Alternatively, from the repository root:

```sh
python -m http.server 8000 --directory prototype
```

Then open http://localhost:8000. The prototype does not record or upload user activity.

## Views

- **Overview:** four coordinated genre charts: average film rating, average within-film variance, rating-distribution violins, and variance over rating submission periods. Shared controls set the minimum lifetime rating count and time grouping. Selecting a genre highlights it in all four charts. Exact values and methods are expandable.
- **Explore a film:** search and genre filtering, a scrollable film list, a poster and film details, average rating, sample variance, rating count, and a percentage histogram. Additional filters, sorting, and exact counts are expandable.
- **Compare films:** two directly selectable A/B slots, aligned rating statistics, histograms with shared axes, and a short numerical comparison. Selections stay synchronized with Explore a film.
- **How to read this:** an auxiliary explanation of the metrics, data limitations, and sources.

The layout adapts to desktop and mobile. Overview uses a compact 2-by-2 chart grid on desktop; mobile stacks charts and allows horizontal scrolling where needed.

## Files and responsibilities

| Path | Purpose |
| --- | --- |
| `index.html` | Page structure, navigation, controls, and visible explanatory text. |
| `styles.css` | Colors, typography, layout, responsive rules, and focus styles. |
| `data.js` | Synthetic fixtures, summary statistics, filtering, genre aggregation, violin densities, and simulated time partitions. Exposes `window.ReelData` in the browser and CommonJS exports for tests. |
| `app.js` | Film browser, selected-film details, percentage histograms, navigation, and shared comparison slots. |
| `charts.js` | The four Overview charts and coordinated genre selection. |
| `tests/data.test.cjs` | Nine tests covering statistics, filtering, genre weighting, time aggregation, and violin smoothing. |
| `posters/1.jpg` through `posters/12.jpg` | Corresponding theatrical posters, stored locally. |
| `posters/README.md` | Poster-to-film mapping and image source credits. |
| `README.md` | Setup, architecture, calculation definitions, and data-integration guidance. |

## Data status and calculation definitions

**All numerical charts currently use synthetic data for 12 films. They are not research findings.** Film titles and posters correspond to actual films, but the local fixture IDs are demo IDs, not their MovieLens IDs. No real rating records or review text are included.

- Ratings use ten bins: 0.5, 1.0, ..., 5.0 stars.
- Mean and count are calculated from those bins. Sample variance uses `sum(count * (rating - mean)^2) / (n - 1)`. Variance is undefined (`null`) for fewer than two ratings.
- Genre bars give each film equal weight when averaging movie means and within-film variances. Multi-genre films appear in every listed genre.
- Violins pool rating counts within each genre. They use Gaussian smoothing with a 0.25-star bandwidth, reflected boundaries at 0.5 and 5, and one shared width scale. Exact counts remain available because smoothing can affect apparent peaks.
- Yearly bins are deterministic simulated partitions that preserve each film's lifetime histogram. They cover release year, or 1995 if later, through 2023. They are not observed historical trends.
- Genre time curves average within-film variances for each period, using only films with at least two ratings in that period. The contributing films can change over time. Calendar periods may be partial.
- Comparison histograms share the 0.5-5 star axis and 0-100% scale. Counts are shown separately because sample sizes differ.

A minimum-count filter is not a statistical confidence guarantee. High variance does not by itself establish two opposing camps. Historical rating cohorts do not show that the same people changed their minds. There is no sentiment analysis, review-theme analysis, or recommendation system yet.

## Integrating real data

The data engineer should prepare small, per-movie aggregates offline rather than load 32 million raw rating rows into the browser. The data contract for each movie is:

```js
{
  id: 123,                     // Unique number; use the real movieId after integration.
  title: 'Example film',
  year: 2020,                  // Release year, not rating submission year.
  genres: ['Drama'],
  poster: 'posters/example.jpg',
  bins: [0, 0, 1, 3, 4, 6, 12, 20, 18, 9], // Counts at 0.5, 1.0, ..., 5.0 stars.
  timeline: [
    { year: 2020, bins: [0, 0, 1, 1, 2, 3, 6, 10, 8, 4] },
    { year: 2021, bins: [0, 0, 0, 2, 2, 3, 6, 10, 10, 5] }
  ]
}
```

`timeline.year` is the year of rating submission. In `data.js`, replace the synthetic fixture data and the `makeTimeline` call with real yearly aggregates. Retain the computed `count`, `mean`, and `variance` fields using `summarize(movie.bins)`. Ensure yearly bins sum to the lifetime bins for the chosen coverage period. Update poster mappings if movie IDs change.

Validate the aggregates before replacing the demo labels in `index.html`, `app.js`, and `charts.js`. Update the documented date coverage when using another dataset version.

The planned rating source is [MovieLens 32M](https://grouplens.org/datasets/movielens/32m/). Attribution: F. Maxwell Harper and Joseph A. Konstan. 2015. [The MovieLens Datasets: History and Context](https://doi.org/10.1145/2827872). Follow the dataset's existing README and license for actual data and derived aggregates.

The planned review-text source is the [IMDb Spoiler Dataset](https://www.kaggle.com/datasets/rmisra/imdb-spoiler-dataset). Use `links.csv` and IMDb IDs to link sources instead of matching titles. Keep their different rating scales explicit. Review text, spoiler handling, sentiment outputs, and theme evidence need a separate data contract; they are not implemented in this prototype.

## Continuing development

- **Data processing:** replace synthetic lifetime and yearly rating bins with verified MovieLens aggregates.
- **Machine learning:** connect IMDb reviews, evaluate sentiment results, and retain original review evidence for any theme summaries.
- **Visualization:** refine chart readability, interaction, and statistical explanations while preserving consistent comparison scales.
- **Frontend:** improve layout and navigation, add approved review interactions, and maintain keyboard and mobile support.

The current plain-JavaScript implementation is a starting point, not a requirement for the team's final framework. Existing datasets and `InitialExploration.ipynb` remain separate from this directory.

## Verification

With Node.js installed, run from the repository root:

```sh
node --check prototype/app.js
node --check prototype/charts.js
node --test prototype/tests/data.test.cjs
```

The automated tests cover data calculations, not browser layout. For UI changes, also check genre highlighting, search with no results, reset, keyboard film selection, direct A/B replacement, duplicate-film prevention, selection synchronization, and narrow mobile layouts. Manual browser checks during prototype development covered these flows and a 1366-by-768 Overview viewport.

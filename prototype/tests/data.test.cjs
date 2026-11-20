const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createReelData, summarize, filterMovies, genreSummary, timeSummary, violinDensity, genreTimeSeries } = require('../data.js');

const inline = createReelData({
  meta: { ratingCountMin: 2 },
  movies: [
    { id: 1, title: 'Horror One', year: 2000, genres: ['Horror'], bins: [10, 0, 0, 0, 0, 0, 0, 0, 0, 10], timeline: [{ year: 2001, bins: [10, 0, 0, 0, 0, 0, 0, 0, 0, 10] }], budget: null, revenue: null, poster: null },
    { id: 2, title: 'Comedy Arrival', year: 2001, genres: ['Comedy', 'Drama'], bins: [0, 0, 0, 0, 0, 0, 0, 0, 5, 5], timeline: [{ year: 2002, bins: [0, 0, 0, 0, 0, 0, 0, 0, 5, 5] }], budget: 100, revenue: 250, poster: null },
    { id: 3, title: 'Quiet Drama', year: 1999, genres: ['Drama'], bins: [0, 0, 0, 0, 0, 0, 0, 0, 0, 4], timeline: [{ year: 2000, bins: [0, 0, 0, 0, 0, 0, 0, 0, 0, 4] }], budget: 10, revenue: 0, poster: null }
  ],
  language: {
    words: ['dread', 'hilarious'],
    movies: {
      '1': [[0, 1, 5], [0, 5, 1]],
      '2': [[1, 4.5, 4], [1, 1, 1]]
    }
  }
});

test('identical means can conceal opposite distributions', () => {
  const consensus = summarize([0, 0, 0, 0, 2, 0, 0, 0, 0, 0]);
  const split = summarize([1, 0, 0, 0, 0, 0, 0, 0, 1, 0]);
  assert.equal(consensus.mean, split.mean);
  assert.equal(consensus.variance, 0);
  assert.equal(split.variance, 8);
});

test('sample variance matches the existing pandas ddof=1 convention', () => {
  assert.deepEqual(summarize([1, 0, 0, 0, 0, 0, 0, 0, 0, 1]), { count: 2, mean: 2.75, variance: 10.125 });
  assert.equal(summarize([1, 0, 0, 0, 0, 0, 0, 0, 0, 0]).variance, null);
  assert.deepEqual(summarize(Array(10).fill(0)), { count: 0, mean: null, variance: null });
});

test('combined filters and sorting retain only matching movies without mutating input', () => {
  const ids = inline.movies.map(movie => movie.id);
  const result = filterMovies(inline.movies, { genre: 'Drama', minimum: 5, search: '  AR  ', sort: 'mean' });
  assert.deepEqual(result.map(movie => movie.title), ['Comedy Arrival']);
  assert.deepEqual(inline.movies.map(movie => movie.id), ids);
  assert.deepEqual(filterMovies(inline.movies, { search: 'no such film' }), []);
});

test('genre metrics weight films equally and preserve multi-genre membership', () => {
  const films = [
    { genres: ['Drama', 'Comedy'], bins: [2, 0, 0, 0, 0, 0, 0, 0, 0, 0], mean: .5, variance: 0 },
    { genres: ['Drama'], bins: [0, 0, 0, 0, 0, 0, 0, 0, 0, 8], mean: 5, variance: 0 }
  ];
  const drama = genreSummary(films).find(genre => genre.genre === 'Drama');
  assert.equal(drama.mean, 2.75);
  assert.equal(drama.variance, 0);
  assert.equal(drama.count, 10);
  assert.equal(genreSummary(films).find(genre => genre.genre === 'Comedy').films, 1);
});

test('time groups conserve rating counts', () => {
  const rows = timeSummary([inline.movies[0]], 1);
  assert.equal(rows.reduce((sum, row) => sum + row.count, 0), inline.movies[0].count);
  for (const width of [1, 5, 10]) {
    const grouped = timeSummary([inline.movies[0]], width);
    assert.equal(grouped.reduce((sum, row) => sum + row.count, 0), inline.movies[0].count);
    assert.ok(grouped.every(row => width === 1 || row.year % width === 0));
  }
});

test('pooled time groups recompute statistics from bins', () => {
  const source = inline.movies.filter(movie => movie.genres.includes('Drama'));
  const rows = timeSummary(source, 10);
  assert.equal(rows.reduce((sum, row) => sum + row.count, 0), source.reduce((sum, movie) => sum + movie.count, 0));
  for (const row of rows) assert.deepEqual({ count: row.count, mean: row.mean, variance: row.variance }, summarize(row.bins));
});

test('genre histories average within-film variances instead of pooling different films', () => {
  const items = [
    { genres: ['Drama'], timeline: [{ year: 2020, bins: [2, 0, 0, 0, 0, 0, 0, 0, 0, 0] }] },
    { genres: ['Drama'], timeline: [{ year: 2020, bins: [0, 0, 0, 0, 0, 0, 0, 0, 0, 8] }] }
  ];
  assert.deepEqual(genreTimeSeries(items)[0].rows[0], { year: 2020, count: 10, films: 2, variance: 0 });
});

test('violin smoothing preserves bounds, symmetry, and approximately unit density area', () => {
  const points = violinDensity([1, 0, 0, 0, 0, 0, 0, 0, 0, 1]);
  assert.equal(points[0].rating, .5);
  assert.equal(points.at(-1).rating, 5);
  let area = 0;
  points.forEach((point, index) => {
    assert.ok(Math.abs(point.density - points.at(-1 - index).density) < 1e-10);
    if (index) area += (point.rating - points[index - 1].rating) * (point.density + points[index - 1].density) / 2;
  });
  assert.ok(Math.abs(area - 1) < .01);
  assert.ok(violinDensity(Array(10).fill(0)).every(point => point.density === 0));
});

test('sentiment color runs from orange at 1 star to blue at 5 stars', () => {
  const { sentimentColor } = inline;
  assert.equal(sentimentColor(1), 'rgb(217,100,26)');
  assert.equal(sentimentColor(0.5), sentimentColor(1));
  assert.equal(sentimentColor(3), 'rgb(143,139,125)');
  assert.equal(sentimentColor(5), 'rgb(31,111,181)');
  assert.notEqual(sentimentColor(2), sentimentColor(4));
});

test('review words follow star ratings and count a multi-genre film once', () => {
  const horror = inline.reviewWords(inline.movies, { genres: ['Horror'] });
  const comedyLow = inline.reviewWords(inline.movies, { genres: ['Comedy'], stars: 1 });
  const comedyHigh = inline.reviewWords(inline.movies, { genres: ['Comedy'], stars: 4.5 });
  const all = inline.reviewWords(inline.movies, {});
  assert.deepEqual(horror.map(row => row.word), ['dread']);
  assert.equal(comedyLow[0].count, 1);
  assert.equal(comedyHigh[0].count, 4);
  assert.equal(all.find(row => row.word === 'hilarious').count, 5);
  assert.equal(all.find(row => row.word === 'hilarious').genre, 'Comedy');
  assert.equal(comedyHigh[0].meanStars, 4.5);
  // dread: 5 mentions at 1 star and 1 at 5 stars -> (5 + 5) / 6
  assert.ok(Math.abs(horror[0].meanStars - 10 / 6) < 1e-9);
  // hilarious: 4 mentions at 4.5 stars and 1 at 1 star -> 19 / 5
  assert.ok(Math.abs(all.find(row => row.word === 'hilarious').meanStars - 3.8) < 1e-9);
});

test('IMAX is not treated as a genre', () => {
  const tagged = createReelData({
    movies: [{ id: 9, title: 'Tagged', year: 2010, genres: ['Action', 'IMAX'], bins: [1, 0, 0, 0, 0, 0, 0, 0, 0, 1], timeline: [], budget: null, revenue: null, poster: null }],
    language: { words: [], movies: {} }
  });
  assert.deepEqual(tagged.movies[0].genres, ['Action']);
  assert.deepEqual(tagged.genreSummary(tagged.movies).map(row => row.genre), ['Action']);
});

test('missing finance stays out of the profit aggregates', () => {
  assert.equal(inline.movies[1].profit, 150);
  assert.equal(inline.movies[0].budget, null);
  assert.equal(inline.movies[2].profit, null);
  assert.ok(inline.profitByRating(inline.movies).every(row => Number.isFinite(row.profit)));
  const financed = inline.profitByGenre(inline.movies).filter(row => row.films > 0);
  assert.ok(financed.every(row => Number.isFinite(row.profit) && Number.isFinite(row.budget)));
  assert.equal(financed.find(row => row.genre === 'Drama').films, 1);
  assert.ok(inline.controversySeries(inline.movies).length > 0);
});

test('catalog invariants hold for the generated MovieLens file', () => {
  const catalogPath = path.join(__dirname, '../data/catalog.js');
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(catalogPath, 'utf8'), sandbox);
  const catalog = sandbox.window.REEL_CATALOG;
  const real = createReelData(catalog);
  assert.ok(real.movies.length >= 4000);
  assert.equal(real.meta.ratingCountMin, 1000);
  assert.equal(real.meta.movieCount, real.movies.length);
  const toyStory = real.movies.find(movie => movie.id === 1);
  assert.equal(toyStory.title, 'Toy Story');
  for (const movie of real.movies) {
    assert.equal(movie.bins.length, 10);
    assert.ok(movie.count >= 1000);
    assert.equal(movie.count, movie.bins.reduce((sum, count) => sum + count, 0));
    assert.ok(movie.mean >= 0.5 && movie.mean <= 5 && movie.variance >= 0);
    for (let index = 0; index < 10; index++) {
      assert.equal(movie.timeline.reduce((sum, row) => sum + row.bins[index], 0), movie.bins[index]);
    }
    assert.equal(Number.isFinite(movie.budget), Number.isFinite(movie.revenue));
    if (movie.budget != null) assert.equal(movie.profit, movie.revenue - movie.budget);
  }
  assert.ok(real.movies.every(movie => !movie.genres.includes('IMAX')));
  assert.ok(!catalog.movies.some(movie => movie.genres.includes('IMAX')), 'regenerate catalog.js after changing genres');
  const words = real.reviewWords(real.movies, {});
  assert.ok(words.length > 0);
  assert.ok(words.every(word => word.count > 0 && word.word && word.genre));
  assert.ok(words.every(word => word.meanStars >= 0.5 && word.meanStars <= 5));
  const horror = real.reviewWords(real.movies, { genres: ['Horror'], stars: 1 });
  assert.ok(horror.length > 0);
  const onlyHalfStars = Object.values(catalog.language.movies).every(triples => triples.every(([, stars]) => stars >= 0.5 && stars <= 5 && Number.isInteger(stars * 2)));
  assert.ok(onlyHalfStars, 'review ratings should be half-star values from 0.5 to 5');
});

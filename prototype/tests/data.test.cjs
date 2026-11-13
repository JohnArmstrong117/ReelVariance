const { test } = require('node:test');
const assert = require('node:assert/strict');
const { movies, summarize, filterMovies, genreSummary, timeSummary, violinDensity, genreTimeSeries } = require('../data.js');

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
  const ids = movies.map(m => m.id);
  const result = filterMovies(movies, { genre: 'Drama', minimum: 2000, search: '  AR  ', sort: 'mean' });
  assert.deepEqual(result.map(m => m.title), ['Parasite', 'Interstellar', 'Arrival']);
  assert.deepEqual(movies.map(m => m.id), ids);
  assert.deepEqual(filterMovies(movies, { search: 'no such film' }), []);
});
test('fixtures have unique IDs, legal bins, and finite consistent statistics', () => {
  assert.equal(new Set(movies.map(m => m.id)).size, movies.length);
  for (const m of movies) {
    assert.equal(m.bins.length, 10);
    assert.ok(m.bins.every(n => Number.isInteger(n) && n >= 0));
    assert.ok(m.mean >= .5 && m.mean <= 5 && m.variance >= 0);
    assert.equal(m.count, m.bins.reduce((a, b) => a + b, 0));
  }
});

test('genre metrics weight films equally and preserve multi-genre membership', () => {
  const films = [
    { genres: ['Drama', 'Comedy'], bins: [2, 0, 0, 0, 0, 0, 0, 0, 0, 0], mean: .5, variance: 0 },
    { genres: ['Drama'], bins: [0, 0, 0, 0, 0, 0, 0, 0, 0, 8], mean: 5, variance: 0 }
  ];
  const drama = genreSummary(films).find(g => g.genre === 'Drama');
  assert.equal(drama.mean, 2.75);
  assert.equal(drama.variance, 0);
  assert.equal(drama.count, 10);
  assert.equal(genreSummary(films).find(g => g.genre === 'Comedy').films, 1);
});

test('year and decade partitions conserve counts without pre-release or future records', () => {
  for (const m of movies) {
    assert.ok(m.timeline.every(row => row.year >= Math.max(1995, m.year) && row.year <= 2023));
    for (let i = 0; i < 10; i++) assert.equal(m.timeline.reduce((sum, row) => sum + row.bins[i], 0), m.bins[i]);
    for (const width of [1, 5, 10]) {
      const rows = timeSummary([m], width);
      assert.equal(rows.reduce((sum, row) => sum + row.count, 0), m.count);
      assert.ok(rows.every(row => width === 1 || row.year % width === 0));
    }
  }
});

test('pooled time groups recompute statistics from bins', () => {
  const source = movies.filter(m => m.genres.includes('Drama'));
  const rows = timeSummary(source, 10);
  assert.equal(rows.reduce((sum, row) => sum + row.count, 0), source.reduce((sum, m) => sum + m.count, 0));
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
  points.forEach((p, i) => {
    assert.ok(Math.abs(p.density - points.at(-1 - i).density) < 1e-10);
    if (i) area += (p.rating - points[i - 1].rating) * (p.density + points[i - 1].density) / 2;
  });
  assert.ok(Math.abs(area - 1) < .01);
  assert.ok(violinDensity(Array(10).fill(0)).every(p => p.density === 0));
});

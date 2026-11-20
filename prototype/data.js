/* Rating math for the precomputed catalog in data/catalog.js.
   bins[i] = number of MovieLens ratings at (i + 1) / 2 stars. */
(function (root) {
  function summarize(bins) {
    const count = bins.reduce((a, b) => a + b, 0);
    const mean = count ? bins.reduce((sum, n, i) => sum + n * (i + 1) / 2, 0) / count : null;
    const variance = count > 1 ? bins.reduce((sum, n, i) => sum + n * ((i + 1) / 2 - mean) ** 2, 0) / (count - 1) : null;
    return { count, mean, variance };
  }
  function filterMovies(items, { search = '', genre = 'all', minimum = 0, sort = 'variance' } = {}) {
    return items.filter(m => m.title.toLowerCase().includes(search.trim().toLowerCase()) && (genre === 'all' || m.genres.includes(genre)) && m.count >= minimum)
      .sort((a, b) => (b[sort] ?? -Infinity) - (a[sort] ?? -Infinity) || a.id - b.id);
  }
  function genreSummary(items) {
    return [...new Set(items.flatMap(m => m.genres))].sort().map(genre => {
      const films = items.filter(m => m.genres.includes(genre));
      const bins = Array.from({ length: 10 }, (_, i) => films.reduce((sum, m) => sum + m.bins[i], 0));
      return { genre, films: films.length, count: bins.reduce((a, b) => a + b, 0), bins,
        mean: films.reduce((sum, m) => sum + m.mean, 0) / films.length,
        variance: films.reduce((sum, m) => sum + m.variance, 0) / films.length };
    });
  }
  function timeSummary(items, width = 1) {
    const groups = new Map();
    items.forEach(movie => movie.timeline.forEach(row => {
      const year = width === 1 ? row.year : Math.floor(row.year / width) * width;
      if (!groups.has(year)) groups.set(year, { year, bins: Array(10).fill(0), first: row.year, last: row.year });
      const group = groups.get(year);
      group.first = Math.min(group.first, row.year); group.last = Math.max(group.last, row.year);
      row.bins.forEach((n, i) => group.bins[i] += n);
    }));
    return [...groups.values()].sort((a, b) => a.year - b.year).map(row => ({ ...row, ...summarize(row.bins) }));
  }
  function violinDensity(bins) {
    const count = bins.reduce((a, b) => a + b, 0), bandwidth = .25;
    return Array.from({ length: 61 }, (_, index) => {
      const rating = .5 + index * 4.5 / 60;
      const density = count ? bins.reduce((sum, n, i) => {
        const center = (i + 1) / 2;
        // Reflect at the rating bounds so smoothing stays within 0.5–5 stars.
        return sum + n * [center, 1 - center, 10 - center].reduce((s, c) => s + Math.exp(-.5 * ((rating - c) / bandwidth) ** 2), 0);
      }, 0) / (count * bandwidth * Math.sqrt(2 * Math.PI)) : 0;
      return { rating, density };
    });
  }
  function genreTimeSeries(items, width = 1) {
    return [...new Set(items.flatMap(m => m.genres))].sort().map(genre => {
      const groups = new Map();
      items.filter(m => m.genres.includes(genre)).forEach(movie => timeSummary([movie], width).forEach(row => {
        if (!groups.has(row.year)) groups.set(row.year, { year: row.year, count: 0, variances: [] });
        const group = groups.get(row.year);
        group.count += row.count;
        if (row.variance !== null) group.variances.push(row.variance);
      }));
      return { genre, rows: [...groups.values()].sort((a, b) => a.year - b.year).map(row => ({ year: row.year, count: row.count, films: row.variances.length, variance: row.variances.length ? row.variances.reduce((a, b) => a + b, 0) / row.variances.length : null })) };
    });
  }
  const GENRE_COLORS = ['#5e8170', '#b17e49', '#60859b', '#aa7287', '#8d70a5', '#418b85', '#918344', '#c47a62', '#6d7e4e', '#7a5c4a', '#4f6f8f', '#a35d6a', '#8a6a4f', '#5c7a6e', '#9a6b8a', '#6b6e3a', '#b08968', '#4e6b78', '#7d5f78'];
  // Review sentiment ramp: orange at 1 star or below, a muted gray at 3, blue at 5.
  const SENTIMENT_STOPS = [[217, 100, 26], [143, 139, 125], [31, 111, 181]];
  function sentimentColor(stars) {
    const value = Number.isFinite(stars) ? Math.min(5, Math.max(1, stars)) : 3;
    const t = (value - 1) / 2;
    const [from, to, local] = t <= 1 ? [SENTIMENT_STOPS[0], SENTIMENT_STOPS[1], t] : [SENTIMENT_STOPS[1], SENTIMENT_STOPS[2], t - 1];
    return `rgb(${from.map((c, i) => Math.round(c + (to[i] - c) * local)).join(',')})`;
  }
  // IMAX is a MovieLens format tag, not a genre.
  const EXCLUDED_GENRES = new Set(['IMAX']);
  function hasMoney(movie) {
    return Number.isFinite(movie.budget) && movie.budget > 0 && Number.isFinite(movie.revenue) && movie.revenue > 0;
  }
  function createReelData(catalog) {
    const source = catalog || { movies: [], language: { words: [], movies: {} }, meta: {} };
    const language = source.language || { words: [], movies: {} };
    const enriched = (source.movies || []).map(movie => {
      const money = hasMoney(movie);
      return {
        ...movie,
        genres: (movie.genres || []).filter(genre => !EXCLUDED_GENRES.has(genre)),
        poster: movie.poster || null,
        budget: money ? movie.budget : null,
        revenue: money ? movie.revenue : null,
        profit: money ? movie.revenue - movie.budget : null,
        ...summarize(movie.bins)
      };
    });
    const genreOrder = [...new Set(enriched.flatMap(movie => movie.genres))].sort();
    function genreColor(genre) {
      const index = genreOrder.indexOf(genre);
      return GENRE_COLORS[(index < 0 ? 0 : index) % GENRE_COLORS.length];
    }
    // Each review is stored once. A selected genre matches when the film lists it.
    // The displayed count is not multiplied across a film's genres. The genre label is
    // the genre that contributes the most tokens among the films that match the filter,
    // and meanStars is the count-weighted mean star rating (0.5-5) of the matching mentions.
    function reviewWords(items, { genres = null, stars = 'all', limit = 24 } = {}) {
      const selected = Array.isArray(genres) ? genres.filter(Boolean) : [];
      const allGenres = selected.length === 0;
      const rating = stars === 'all' || stars === '' || stars == null ? null : Number(stars);
      const byId = new Map(items.map(movie => [movie.id, movie]));
      const totals = new Map();
      Object.entries(language.movies).forEach(([id, triples]) => {
        const movie = byId.get(Number(id));
        if (!movie) return;
        const matched = allGenres ? movie.genres : movie.genres.filter(genre => selected.includes(genre));
        if (!matched.length) return;
        const wordCounts = new Map();
        const wordStars = new Map();
        triples.forEach(([wordIndex, wordRating, count]) => {
          if (rating !== null && wordRating !== rating) return;
          wordCounts.set(wordIndex, (wordCounts.get(wordIndex) || 0) + count);
          wordStars.set(wordIndex, (wordStars.get(wordIndex) || 0) + count * wordRating);
        });
        wordCounts.forEach((count, wordIndex) => {
          const word = language.words[wordIndex];
          if (!word || !count) return;
          if (!totals.has(word)) totals.set(word, { word, count: 0, starSum: 0, byGenre: {} });
          const entry = totals.get(word);
          entry.count += count;
          entry.starSum += wordStars.get(wordIndex);
          matched.forEach(genre => { entry.byGenre[genre] = (entry.byGenre[genre] || 0) + count; });
        });
      });
      return [...totals.values()]
        .map(entry => {
          const topGenre = Object.entries(entry.byGenre).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
          return { word: entry.word, count: entry.count, genre: topGenre, meanStars: entry.starSum / entry.count };
        })
        .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
        .slice(0, limit);
    }
    function average(values) {
      const finite = values.filter(value => Number.isFinite(value));
      return finite.length ? finite.reduce((a, b) => a + b, 0) / finite.length : null;
    }
    function binKey(value, width) {
      return Math.floor(value / width) * width;
    }
    function controversySeries(items, { mode = 'profitsVsControversy', genre = null } = {}) {
      const pool = genre ? items.filter(m => m.genres.includes(genre)) : items;
      const groups = new Map();
      pool.forEach(movie => {
        let x, y, width;
        if (mode === 'controversyVsBudget') {
          if (!Number.isFinite(movie.budget) || movie.variance == null) return;
          width = 10_000_000;
          x = binKey(movie.budget, width);
          y = movie.variance;
        } else {
          if (movie.variance == null || !Number.isFinite(movie.profit)) return;
          width = 0.25;
          x = Math.round(movie.variance / width) * width;
          y = movie.profit;
        }
        if (y == null || !Number.isFinite(y)) return;
        if (!groups.has(x)) groups.set(x, []);
        groups.get(x).push(y);
      });
      return [...groups.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([x, values]) => ({ x, y: average(values), films: values.length }));
    }
    function profitByRating(items, { genre = null } = {}) {
      const pool = genre ? items.filter(m => m.genres.includes(genre)) : items;
      const groups = new Map();
      pool.forEach(movie => {
        if (movie.mean == null || !Number.isFinite(movie.profit)) return;
        const rating = Math.round(movie.mean * 2) / 2;
        if (!groups.has(rating)) groups.set(rating, []);
        groups.get(rating).push(movie.profit);
      });
      return [...groups.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([rating, values]) => ({ rating, profit: average(values), films: values.length }));
    }
    function profitByGenre(items, { genres = null } = {}) {
      const selected = Array.isArray(genres) && genres.length ? genres : genreOrder;
      return selected.map(genre => {
        const films = items.filter(m => m.genres.includes(genre) && Number.isFinite(m.profit) && Number.isFinite(m.budget));
        return {
          genre,
          profit: average(films.map(m => m.profit)),
          budget: average(films.map(m => m.budget)),
          films: films.length
        };
      });
    }
    return {
      movies: enriched,
      meta: source.meta || {},
      summarize,
      filterMovies,
      genreSummary,
      timeSummary,
      violinDensity,
      genreTimeSeries,
      genreColor,
      sentimentColor,
      reviewWords,
      controversySeries,
      profitByRating,
      profitByGenre
    };
  }
  const api = createReelData(root.REEL_CATALOG);
  const exported = { ...api, createReelData, summarize, filterMovies, genreSummary, timeSummary, violinDensity, genreTimeSeries };
  if (typeof module !== 'undefined' && module.exports) module.exports = exported;
  else root.ReelData = api;
})(typeof window === 'undefined' ? globalThis : window);

/* Synthetic interaction fixtures, NOT observed movie ratings.
   bins[i] = number of ratings at (i + 1) / 2 stars. */
(function (root) {
  const movies = [
    { id: 1, title: 'Everything Everywhere All at Once', year: 2022, genres: ['Adventure', 'Sci-Fi'], bins: [150, 100, 80, 70, 80, 90, 130, 200, 420, 680] },
    { id: 2, title: 'The Lighthouse', year: 2019, genres: ['Horror', 'Drama'], bins: [220, 150, 90, 80, 70, 100, 120, 160, 260, 440] },
    { id: 3, title: 'Interstellar', year: 2014, genres: ['Sci-Fi', 'Drama'], bins: [40, 50, 40, 60, 80, 160, 220, 500, 800, 1000] },
    { id: 4, title: 'Barbie', year: 2023, genres: ['Comedy', 'Fantasy'], bins: [210, 180, 120, 100, 120, 180, 210, 260, 320, 430] },
    { id: 5, title: 'Parasite', year: 2019, genres: ['Thriller', 'Drama'], bins: [10, 10, 20, 30, 50, 120, 270, 600, 900, 1100] },
    { id: 6, title: 'The Grand Budapest Hotel', year: 2014, genres: ['Comedy', 'Adventure'], bins: [5, 10, 15, 40, 80, 200, 420, 620, 480, 250] },
    { id: 7, title: 'Tenet', year: 2020, genres: ['Sci-Fi', 'Thriller'], bins: [180, 200, 140, 150, 180, 160, 200, 180, 260, 350] },
    { id: 8, title: 'Aftersun', year: 2022, genres: ['Drama'], bins: [25, 30, 20, 25, 40, 60, 80, 150, 240, 320] },
    { id: 9, title: 'The Banshees of Inisherin', year: 2022, genres: ['Comedy', 'Drama'], bins: [40, 50, 40, 80, 100, 160, 240, 320, 280, 220] },
    { id: 10, title: 'Arrival', year: 2016, genres: ['Sci-Fi', 'Drama'], bins: [10, 20, 20, 60, 100, 220, 420, 680, 640, 410] },
    { id: 11, title: 'The Lobster', year: 2015, genres: ['Comedy', 'Drama'], bins: [80, 65, 30, 25, 20, 25, 30, 50, 70, 95] },
    { id: 12, title: 'A Ghost Story', year: 2017, genres: ['Fantasy', 'Drama'], bins: [12, 8, 3, 2, 2, 3, 4, 6, 10, 14] }
  ];
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
  // Deterministic synthetic yearly partitions. They sum exactly to each film's
  // histogram; these dates are interaction fixtures, not historical observations.
  function makeTimeline(movie) {
    const start = Math.max(1995, movie.year);
    const years = Array.from({ length: 2024 - start }, (_, i) => start + i);
    const rows = years.map(year => ({ year, bins: Array(10).fill(0) }));
    movie.bins.forEach((count, bin) => {
      const weights = years.map((_, i) => 1 + ((i * (bin + 3) + movie.id + bin * bin) % 11));
      const total = weights.reduce((a, b) => a + b, 0);
      let allocated = 0;
      weights.forEach((weight, i) => {
        const n = i === weights.length - 1 ? count - allocated : Math.floor(count * weight / total);
        rows[i].bins[bin] = n; allocated += n;
      });
    });
    return rows;
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
  // Shared Overview / Language palette; sorted genre names keep colors stable.
  const GENRE_COLORS = ['#5e8170', '#b17e49', '#60859b', '#aa7287', '#8d70a5', '#418b85', '#918344'];
  const GENRE_ORDER = [...new Set(movies.flatMap(m => m.genres))].sort();
  function genreColor(genre) {
    const index = GENRE_ORDER.indexOf(genre);
    return GENRE_COLORS[(index < 0 ? 0 : index) % GENRE_COLORS.length];
  }
  // Content-word lexicons by genre and rating band. Stopwords are excluded.
  const STOPWORDS = new Set(['a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'for', 'from', 'had', 'has', 'have', 'he', 'her', 'his', 'i', 'if', 'in', 'into', 'is', 'it', 'its', 'me', 'my', 'of', 'on', 'or', 'our', 'she', 'so', 'than', 'that', 'the', 'their', 'them', 'then', 'there', 'these', 'they', 'this', 'to', 'too', 'was', 'we', 'were', 'what', 'when', 'which', 'who', 'will', 'with', 'you', 'your']);
  const REVIEW_LEXICON = {
    Adventure: {
      low: ['tedious', 'disjointed', 'predictable', 'flat', 'rushed', 'muddled'],
      mixed: ['quest', 'journey', 'spectacle', 'setpiece', 'worldbuilding', 'pace'],
      high: ['thrilling', 'inventive', 'breathtaking', 'epic', 'vivid', 'wonder']
    },
    Comedy: {
      low: ['unfunny', 'cringe', 'forced', 'awkward', 'dated', 'bland'],
      mixed: ['jokes', 'gags', 'satire', 'wit', 'timing', 'absurd'],
      high: ['hilarious', 'clever', 'charming', 'witty', 'delightful', 'sharp']
    },
    Drama: {
      low: ['melodramatic', 'slow', 'pretentious', 'heavy', 'bleak', 'distant'],
      mixed: ['character', 'performance', 'theme', 'emotion', 'dialogue', 'arc'],
      high: ['moving', 'powerful', 'intimate', 'poignant', 'layered', 'honest']
    },
    Fantasy: {
      low: ['confusing', 'overwrought', 'hollow', 'clunky', 'draggy', 'messy'],
      mixed: ['magic', 'myth', 'dreamlike', 'imagery', 'lore', 'atmosphere'],
      high: ['enchanting', 'imaginative', 'lyrical', 'striking', 'haunting', 'strange']
    },
    Horror: {
      low: ['boring', 'cheap', 'gimmicky', 'dull', 'jump', 'lifeless'],
      mixed: ['dread', 'tension', 'gore', 'unease', 'creepy', 'shadow'],
      high: ['terrifying', 'chilling', 'unsettling', 'nightmarish', 'visceral', 'eerie']
    },
    'Sci-Fi': {
      low: ['convoluted', 'cold', 'incoherent', 'empty', 'noisy', 'sterile'],
      mixed: ['ideas', 'future', 'science', 'paradox', 'vision', 'concept'],
      high: ['mindbending', 'ambitious', 'awe', 'original', 'cerebral', 'bold']
    },
    Thriller: {
      low: ['contrived', 'predictable', 'hollow', 'sloppy', 'thin', 'forgettable'],
      mixed: ['suspense', 'twist', 'plot', 'tension', 'mystery', 'pace'],
      high: ['gripping', 'taut', 'intense', 'clever', 'relentless', 'sharp']
    }
  };
  function ratingBand(binIndex) {
    if (binIndex <= 3) return 'low';
    if (binIndex <= 6) return 'mixed';
    return 'high';
  }
  function addWordTokens(totals, word, genre, amount) {
    if (!amount || STOPWORDS.has(word) || STOPWORDS.has(word.toLowerCase())) return;
    if (!totals.has(word)) totals.set(word, { word, count: 0, byGenre: {} });
    const entry = totals.get(word);
    entry.count += amount;
    entry.byGenre[genre] = (entry.byGenre[genre] || 0) + amount;
  }
  function distributeTokens(totals, words, genre, tokenCount, seed) {
    if (!tokenCount || !words.length) return;
    const weights = words.map((_, i) => 1 + ((seed * (i + 3) + i * i) % 7));
    const weightSum = weights.reduce((a, b) => a + b, 0);
    let allocated = 0;
    words.forEach((word, i) => {
      const n = i === words.length - 1 ? tokenCount - allocated : Math.floor(tokenCount * weights[i] / weightSum);
      addWordTokens(totals, word, genre, n);
      allocated += n;
    });
  }
  // Deterministic synthetic review-word counts from rating bins. Demo language only.
  function reviewWords(items, { genre = 'all', stars = 'all', limit = 24 } = {}) {
    const starBin = stars === 'all' ? null : Math.round(Number(stars) * 2) - 1;
    const totals = new Map();
    items.forEach(movie => {
      const genres = genre === 'all' ? movie.genres.slice(0, 1) : movie.genres.includes(genre) ? [genre] : [];
      genres.forEach(g => {
        const lexicon = REVIEW_LEXICON[g];
        if (!lexicon) return;
        movie.bins.forEach((count, bin) => {
          if (starBin !== null && bin !== starBin) return;
          const words = lexicon[ratingBand(bin)];
          const tokens = Math.max(0, Math.round(count * (genre === 'all' ? 0.35 : 0.55)));
          distributeTokens(totals, words, g, tokens, movie.id * 17 + bin * 3 + g.length);
        });
      });
    });
    return [...totals.values()]
      .map(entry => {
        const topGenre = Object.entries(entry.byGenre).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
        return { word: entry.word, count: entry.count, genre: topGenre };
      })
      .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
      .slice(0, limit);
  }
  const enriched = movies.map(m => ({ ...m, poster: `posters/${m.id}.jpg`, timeline: makeTimeline(m), ...summarize(m.bins) }));
  const api = { movies: enriched, summarize, filterMovies, genreSummary, timeSummary, violinDensity, genreTimeSeries, genreColor, reviewWords, STOPWORDS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ReelData = api;
})(typeof window === 'undefined' ? globalThis : window);

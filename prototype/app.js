/* Catalog-backed film browser. catalog.js must load before this file. */
(() => {
  const { movies, filterMovies, meta } = window.ReelData;
  const $ = id => document.getElementById(id);
  const LIST_CAP = 150;
  const state = { selected: null, comparison: [null, null], search: '', genre: 'all', minimum: 1000, sort: 'variance' };
  const escape = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const number = n => n.toLocaleString('en-US');
  const metric = n => n === null ? '—' : n.toFixed(2);
  function announce(message) { $('announcement').textContent = message; }
  function filmHistogram(movie) {
    const plotLeft = 47;
    const plotBottom = 232;
    const x = percent => plotLeft + percent * 2.8;
    const ticks = [0, 25, 50, 75, 100].map(percent => `<line x1="${x(percent)}" x2="${x(percent)}" y1="24" y2="${plotBottom}" stroke="#e0e7db" stroke-dasharray="3 4"/><text x="${x(percent)}" y="249" text-anchor="middle">${percent}%</text>`).join('');
    const bars = movie.bins.map((count, i) => {
      const stars = (i + 1) / 2;
      const y = 221 - i * 21;
      const share = movie.count ? count / movie.count * 100 : 0;
      const percentage = share.toFixed(1) + '%';
      const barWidth = x(share) - plotLeft;
      return `<g class="rating-bar" tabindex="0" role="img" aria-label="${stars} stars · ${number(count)} ratings · ${percentage}"><text x="40" y="${y + 4}" text-anchor="end">${stars}</text><rect x="${plotLeft}" y="${y - 6}" width="${barWidth}" height="12" rx="2" fill="#62856a"/><rect x="${plotLeft}" y="${y - 9}" width="${Math.max(barWidth, 12)}" height="18" fill="transparent"/><text class="rating-share" x="${x(share) + 14}" y="${y + 4}" aria-hidden="true">${percentage}</text></g>`;
    }).join('');
    return `<div class="histogram film-histogram"><svg viewBox="0 0 380 257" role="group" aria-label="${escape(movie.title)}: distribution of MovieLens ratings; percentage of ratings at each star value"><text x="8" y="15">Stars</text>${ticks}${bars}</svg></div>`;
  }
  function posterImage(movie, className, alt) {
    if (movie.poster) return `<img class="${className}" src="${escape(movie.poster)}" alt="${escape(alt)}" loading="lazy">`;
    return `<span class="${className} poster-missing" aria-hidden="true"></span>`;
  }
  function moviePanel(movie) {
    const checked = state.comparison.includes(movie.id);
    const year = movie.year == null ? 'Year unknown' : movie.year;
    return `<p class="eyebrow">EXPLORE A FILM</p><div class="poster-frame">${posterImage(movie, 'movie-poster', `${movie.title} theatrical poster`)}<span>${movie.poster ? 'POSTER · TMDB' : 'NO POSTER'}</span></div><h2>${escape(movie.title)}</h2><div class="metadata">${year} &nbsp;·&nbsp; ${movie.genres.map(escape).join(' / ') || 'No genre listed'}</div><div class="metric-grid"><div><span>Controversy Score</span><strong>${metric(movie.variance)}<small> stars²</small></strong></div><div><span>Average rating</span><strong>${metric(movie.mean)}<small> / 5</small></strong></div><div><span>Rating count</span><strong>${number(movie.count)}</strong></div></div><p class="sample">${number(movie.count)} MovieLens ratings · 0.5–5 star scale</p><p class="hist-title">HOW THE AUDIENCE RATED</p>${filmHistogram(movie)}<button class="secondary compare-toggle" data-id="${movie.id}" aria-pressed="${checked}">${checked ? '✓ Added to comparison — remove' : '+ Add to comparison'}</button>`;
  }
  function bindComparisonButtons(container) {
    container.querySelectorAll('.compare-toggle').forEach(button => button.addEventListener('click', () => toggleComparison(Number(button.dataset.id))));
  }
  function renderDetail() {
    const movie = movies.find(m => m.id === state.selected);
    $('detail').hidden = !movie;
    $('film-empty').hidden = Boolean(movie);
    if (movie) { $('detail').innerHTML = moviePanel(movie); bindComparisonButtons($('detail')); }
  }
  function selectMovie(id) {
    state.selected = id;
    renderExplore();
    announce(`Selected ${movies.find(m => m.id === id).title}. Rating details updated.`);
    // Preserve keyboard position after updating the selected row.
    $('film-list').querySelector(`[data-id="${id}"]`)?.focus({ preventScroll: true });
    if (window.innerWidth <= 700) $('detail').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function renderExplore() {
    const items = filterMovies(movies, state);
    if (!items.some(m => m.id === state.selected)) state.selected = items[0]?.id ?? null;
    const visible = items.slice(0, LIST_CAP);
    $('result-count').textContent = items.length > visible.length ? `Showing ${visible.length} of ${items.length} films` : `${items.length} of ${movies.length} films`;
    $('minimum-value').value = number(state.minimum);
    $('film-list').innerHTML = visible.length ? visible.map(m => `<div class="film-row ${m.id === state.selected ? 'selected' : ''}">${posterImage(m, 'swatch poster-thumb', '')}<button class="film-select" data-id="${m.id}" aria-pressed="${m.id === state.selected}"><strong>${escape(m.title)}</strong><small>${m.year || '—'} · ${escape(m.genres[0] || 'Unlisted')} · ${number(m.count)} ratings</small></button><div class="film-stat">${metric(m.variance)}<small>CONTROVERSY SCORE</small></div></div>`).join('') : '<div class="empty">No films match your lens. Try another title, lower the minimum ratings, or use Reset.</div>';
    $('film-list').querySelectorAll('.film-select').forEach(button => button.addEventListener('click', () => selectMovie(Number(button.dataset.id))));
    renderDetail();
  }
  function comparisonCard(movie, index) {
    if (!movie) return `<article class="compare-card compare-placeholder"><span class="comparison-letter">FILM ${index ? 'B' : 'A'}</span><h3>Choose a film above</h3></article>`;
    return `<article class="compare-card"><div class="compare-film-header">${posterImage(movie, 'compare-poster', `${movie.title} theatrical poster`)}<div><p class="eyebrow">FILM ${index ? 'B' : 'A'}</p><h3>${escape(movie.title)}</h3><p class="metadata">${movie.year || '—'} · ${movie.genres.map(escape).join(' / ') || 'No genre listed'}</p><button class="text-button compare-remove" data-slot="${index}" aria-label="Remove ${escape(movie.title)} from comparison">Remove film</button></div></div><div class="compare-metrics"><div><span>Controversy Score</span><strong>${metric(movie.variance)}<small> stars²</small></strong></div><div><span>Average rating</span><strong>${metric(movie.mean)}<small> / 5</small></strong></div><div><span>Rating count</span><strong>${number(movie.count)}</strong></div></div><p class="hist-title">HOW THE AUDIENCE RATED</p>${filmHistogram(movie)}</article>`;
  }
  const comparisonPickers = ['compare-left', 'compare-right'];
  function renderComparisonPicker(id, index) {
    const year = $(id + '-year').value;
    const genre = $(id + '-genre').value;
    const search = $(id + '-search').value.trim().toLowerCase();
    const current = state.comparison[index];
    const other = state.comparison[1 - index];
    const matches = movies.filter(movie => movie.id !== other
      && (!year || movie.year === Number(year))
      && (genre === 'all' || movie.genres.includes(genre))
      && movie.title.toLowerCase().includes(search))
      .sort((a, b) => a.title.localeCompare(b.title) || a.id - b.id);
    const selectedOutsideFilters = current !== null && !matches.some(movie => movie.id === current)
      ? movies.find(movie => movie.id === current)
      : null;
    let shown = matches.slice(0, LIST_CAP);
    if (current != null && !selectedOutsideFilters && !shown.some(movie => movie.id === current)) {
      const chosen = matches.find(movie => movie.id === current);
      if (chosen) shown = [chosen, ...shown];
    }
    const option = movie => `<option value="${movie.id}">${escape(movie.title)} (${movie.year || '—'})</option>`;
    $(id).innerHTML = '<option value="">Choose a film…</option>'
      + (selectedOutsideFilters ? option(selectedOutsideFilters) : '')
      + shown.map(option).join('');
    $(id).value = current ?? '';
    const status = $(id + '-status');
    if (!matches.length) {
      status.hidden = false;
      status.textContent = 'No matching films.';
    } else if (matches.length > LIST_CAP) {
      status.hidden = false;
      status.textContent = `Showing ${Math.min(shown.length, LIST_CAP)} of ${matches.length}. Search to narrow.`;
    } else status.hidden = true;
  }
  function renderComparison() {
    const slots = state.comparison.map(id => movies.find(m => m.id === id));
    const selection = slots.filter(Boolean);
    $('compare-count').textContent = selection.length;
    $('show-comparison').disabled = selection.length !== 2;
    $('clear-comparison').hidden = !selection.length;
    $('tray-selection').textContent = selection.length ? selection.map(m => m.title).join('  +  ') + (selection.length === 1 ? ' — choose one more film' : '') : 'Select two films to look beyond their scores.';
    comparisonPickers.forEach(renderComparisonPicker);
    $('comparison').innerHTML = slots.map(comparisonCard).join('');
    $('comparison').querySelectorAll('.compare-remove').forEach(button => button.addEventListener('click', () => {
      state.comparison[Number(button.dataset.slot)] = null;
      renderDetail(); renderComparison();
      $(Number(button.dataset.slot) ? 'compare-right' : 'compare-left').focus();
      announce('Film removed. Choose a replacement above.');
    }));
  }
  function toggleComparison(id) {
    if (state.comparison.includes(id)) { state.comparison = state.comparison.map(value => value === id ? null : value); announce('Film removed from comparison.'); }
    else if (state.comparison.every(Boolean)) { announce('Two films are already selected. Remove one or clear your selection to choose another.'); return; }
    else { state.comparison[state.comparison.indexOf(null)] = id; announce(`${movies.find(m => m.id === id).title} added. ${state.comparison.filter(Boolean).length} of 2 selected.`); }
    renderDetail(); renderComparison();
  }
  function showView(view) {
    document.body.classList.toggle('overview-active', view === 'overview');
    document.body.classList.toggle('film-active', view === 'explore');
    document.body.classList.toggle('compare-active', view === 'compare');
    document.body.classList.toggle('language-active', view === 'language');
    document.body.classList.toggle('controversy-active', view === 'controversy');
    document.body.classList.toggle('bias-active', view === 'bias');
    ['overview', 'explore', 'compare', 'language', 'controversy', 'bias', 'about'].forEach(name => { $(`${name}-view`).hidden = name !== view; });
    document.querySelector('.compare-tray').hidden = view !== 'explore';
    document.querySelectorAll('[data-view]').forEach(button => { button.classList.toggle('active', button.dataset.view === view); button.setAttribute('aria-pressed', String(button.dataset.view === view)); });
    if (view === 'compare') renderComparison();
  }
  const genres = [...new Set(movies.flatMap(movie => movie.genres))].sort();
  genres.forEach(genre => $('genre').add(new Option(genre, genre)));
  const years = [...new Set(movies.map(movie => movie.year).filter(year => year != null))].sort((a, b) => b - a);
  comparisonPickers.forEach((id, index) => {
    years.forEach(year => $(id + '-year').add(new Option(year, year)));
    genres.forEach(genre => $(id + '-genre').add(new Option(genre, genre)));
    $(id + '-year').addEventListener('change', () => renderComparisonPicker(id, index));
    $(id + '-genre').addEventListener('change', () => renderComparisonPicker(id, index));
    $(id + '-search').addEventListener('input', () => renderComparisonPicker(id, index));
  });
  ['search', 'genre', 'minimum', 'sort'].forEach(key => $(key).addEventListener(key === 'search' || key === 'minimum' ? 'input' : 'change', e => { state[key] = key === 'minimum' ? Number(e.target.value) : e.target.value; renderExplore(); announce(`${filterMovies(movies, state).length} films match your filters.`); }));
  $('reset').addEventListener('click', () => { Object.assign(state, { search: '', genre: 'all', minimum: 1000, sort: 'variance' }); ['search', 'genre', 'minimum', 'sort'].forEach(key => $(key).value = state[key]); renderExplore(); announce('Filters reset. Comparison selection retained.'); });
  document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => showView(button.dataset.view)));
  $('show-comparison').addEventListener('click', () => { showView('compare'); document.querySelector('[data-view="compare"]').focus(); });
  comparisonPickers.forEach((id, index) => $(id).addEventListener('change', event => {
    state.comparison[index] = event.target.value ? Number(event.target.value) : null;
    renderDetail(); renderComparison();
    announce('Comparison updated.');
  }));
  $('back-explore').addEventListener('click', () => showView('explore'));
  $('clear-comparison').addEventListener('click', () => { state.comparison = [null, null]; renderDetail(); renderComparison(); announce('Comparison cleared.'); });
  function renderSourceNotes() {
    const movieCount = Number(meta.movieCount || movies.length).toLocaleString('en-US');
    const minimum = Number(meta.ratingCountMin || 1000).toLocaleString('en-US');
    const yearsCovered = meta.ratingYearMin && meta.ratingYearMax ? `${meta.ratingYearMin}–${meta.ratingYearMax}` : 'the MovieLens window';
    const finance = Number(meta.financeMovies || 0).toLocaleString('en-US');
    const imdbMovies = Number(meta.imdbMoviesLinked || 0).toLocaleString('en-US');
    const imdbReviews = Number(meta.imdbReviewsUsed || 0).toLocaleString('en-US');
    const banner = $('data-banner-text');
    if (banner) banner.textContent = `MovieLens ml-32m, ${yearsCovered}. ${movieCount} films with at least ${minimum} ratings. IMDb review words for ${imdbMovies} of those films (${imdbReviews} reviews, 0.5–5 star scale). TMDB budget and revenue for ${finance} films, only when both are known.`;
    const coverage = $('about-coverage');
    if (coverage) coverage.textContent = `${movieCount} films with at least ${minimum} MovieLens ratings. Rating submissions in this catalog run from ${meta.ratingYearMin} through ${meta.ratingYearMax}. ${finance} films have both a TMDB budget and revenue. Review words cover ${imdbReviews} IMDb reviews across ${imdbMovies} linked films.`;
  }
  renderSourceNotes();
  renderExplore(); renderComparison(); showView('overview');
})();

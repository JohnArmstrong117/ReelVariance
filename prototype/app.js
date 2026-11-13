/* Local assets: the prototype also works by opening index.html directly. */
(() => {
  const { movies, filterMovies } = window.ReelData;
  const $ = id => document.getElementById(id);
  const state = { selected: 1, comparison: [null, null], search: '', genre: 'all', minimum: 100, sort: 'variance' };
  const escape = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const number = n => n.toLocaleString('en-US');
  const metric = n => n === null ? '—' : n.toFixed(2);
  function announce(message) { $('announcement').textContent = message; }
  function filmHistogram(movie) {
    const x = i => 53 + i * 62;
    const y = percent => 172 - percent * 1.35;
    const bars = movie.bins.map((count, i) => {
      const share = movie.count ? count / movie.count * 100 : 0;
      return `<rect x="${x(i)}" y="${y(share)}" width="39" height="${share * 1.35}" rx="3" fill="#62856a"><title>${(i + 1) / 2} stars · ${number(count)} ratings · ${share.toFixed(1)}%</title></rect><text class="bar-share" x="${x(i) + 19.5}" y="${y(share) - 7}" text-anchor="middle">${share.toFixed(1)}%</text><text x="${x(i) + 19.5}" y="192" text-anchor="middle">${(i + 1) / 2}</text>`;
    }).join('');
    const ticks = [0, 25, 50, 75, 100].map(percent => `<line x1="44" x2="665" y1="${y(percent)}" y2="${y(percent)}" stroke="#e0e7db" stroke-dasharray="3 4"/><text x="35" y="${y(percent) + 4}" text-anchor="end">${percent}%</text>`).join('');
    return `<div class="histogram film-histogram"><svg viewBox="0 0 690 218" role="img" aria-label="${escape(movie.title)}: distribution of synthetic ratings; percentage of ratings at each star value">${ticks}${bars}<text x="355" y="214" text-anchor="middle">Star rating</text></svg></div>`;
  }
  function moviePanel(movie) {
    const checked = state.comparison.includes(movie.id);
    return `<p class="eyebrow">EXPLORE A FILM · DEMO DATA</p><div class="poster-frame"><img class="movie-poster" src="${movie.poster}" alt="${escape(movie.title)} theatrical poster"><span>POSTER · ${movie.id <= 10 ? "TMDB" : "WIKIPEDIA"}</span></div><h2>${escape(movie.title)}</h2><div class="metadata">${movie.year} &nbsp;·&nbsp; ${movie.genres.map(escape).join(' / ')}</div><div class="metric-grid"><div><span>Average rating</span><strong>${metric(movie.mean)}<small> / 5</small></strong></div><div><span>Rating variance</span><strong>${metric(movie.variance)}<small> stars²</small></strong></div><div><span>Rating count</span><strong>${number(movie.count)}</strong></div></div><p class="sample">${number(movie.count)} synthetic ratings · 0.5–5 star scale</p><p class="hist-title">HOW THE AUDIENCE VOTED</p>${filmHistogram(movie)}<p class="distribution-note">A larger spread signals disagreement. Inspect the shape before calling it polarization.</p><details><summary class="hint">Read exact rating counts</summary><table><caption class="hint">Synthetic ratings for ${escape(movie.title)}</caption><thead><tr><th>Stars</th><th>Count</th><th>Share</th></tr></thead><tbody>${movie.bins.map((n, i) => `<tr><td>${(i + 1) / 2}</td><td>${number(n)}</td><td>${movie.count ? (100 * n / movie.count).toFixed(1) : '0.0'}%</td></tr>`).join('')}</tbody></table></details><button class="secondary compare-toggle" data-id="${movie.id}" aria-pressed="${checked}">${checked ? '✓ Added to comparison — remove' : '+ Add to comparison'}</button>`;
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
    $('result-count').textContent = `${items.length} of ${movies.length} demo films`;
    $('minimum-value').value = number(state.minimum);
    $('film-list').innerHTML = items.length ? items.map(m => `<div class="film-row ${m.id === state.selected ? 'selected' : ''}"><img class="swatch poster-thumb" src="${m.poster}" alt="" loading="lazy"><button class="film-select" data-id="${m.id}" aria-pressed="${m.id === state.selected}"><strong>${escape(m.title)}</strong><small>${m.year} · ${escape(m.genres[0])} · ${number(m.count)} ratings</small></button><div class="film-stat">${metric(m.variance)}<small>VARIANCE</small></div></div>`).join('') : '<div class="empty">No films match your lens. Try another title, lower the minimum ratings, or use Reset.</div>';
    $('film-list').querySelectorAll('.film-select').forEach(button => button.addEventListener('click', () => selectMovie(Number(button.dataset.id))));
    renderDetail();
  }
  function comparisonCard(movie, index) {
    if (!movie) return `<article class="compare-card compare-placeholder"><span class="comparison-letter">FILM ${index ? 'B' : 'A'}</span><h3>Choose a film above</h3><p>Its rating distribution and key figures will appear here.</p></article>`;
    return `<article class="compare-card"><div class="compare-film-header"><img src="${movie.poster}" alt="${escape(movie.title)} theatrical poster"><div><p class="eyebrow">FILM ${index ? 'B' : 'A'}</p><h3>${escape(movie.title)}</h3><p class="metadata">${movie.year} · ${movie.genres.map(escape).join(' / ')}</p><button class="text-button compare-remove" data-slot="${index}" aria-label="Remove ${escape(movie.title)} from comparison">Remove film</button></div></div><div class="compare-metrics"><div><span>Average rating</span><strong>${metric(movie.mean)}<small> / 5</small></strong></div><div><span>Rating variance</span><strong>${metric(movie.variance)}<small> stars²</small></strong></div><div><span>Rating count</span><strong>${number(movie.count)}</strong></div></div><p class="hist-title">HOW THE AUDIENCE VOTED</p>${filmHistogram(movie)}</article>`;
  }
  function renderComparison() {
    const slots = state.comparison.map(id => movies.find(m => m.id === id));
    const selection = slots.filter(Boolean);
    $('compare-count').textContent = selection.length;
    $('show-comparison').disabled = selection.length !== 2;
    $('clear-comparison').hidden = !selection.length;
    $('tray-selection').textContent = selection.length ? selection.map(m => m.title).join('  +  ') + (selection.length === 1 ? ' — choose one more film' : '') : 'Select two films to look beyond their scores.';
    ['compare-left', 'compare-right'].forEach((id, index) => {
      $(id).innerHTML = '<option value="">Choose a film…</option>' + movies.map(m => `<option value="${m.id}" ${m.id === state.comparison[1 - index] ? 'disabled' : ''}>${escape(m.title)} (${m.year})</option>`).join('');
      $(id).value = state.comparison[index] ?? '';
    });
    $('comparison').innerHTML = slots.map(comparisonCard).join('');
    $('comparison').querySelectorAll('.compare-remove').forEach(button => button.addEventListener('click', () => {
      state.comparison[Number(button.dataset.slot)] = null;
      renderDetail(); renderComparison();
      $(Number(button.dataset.slot) ? 'compare-right' : 'compare-left').focus();
      announce('Film removed. Choose a replacement above.');
    }));
    $('comparison-summary').hidden = selection.length !== 2;
    if (selection.length === 2) {
      const [a, b] = slots;
      const describe = (key, label, unit) => {
        if (metric(a[key]) === metric(b[key])) return `Both films have the same ${label} at displayed precision (${metric(a[key])}${unit}).`;
        const higher = a[key] > b[key] ? a : b;
        const lower = higher === a ? b : a;
        return `${escape(higher.title)} has the higher ${label} (${metric(higher[key])} vs ${metric(lower[key])}${unit}).`;
      };
      $('comparison-summary').innerHTML = `<h3>What differs?</h3><p>${describe('mean', 'average rating', ' / 5')}</p><p>${describe('variance', 'rating variance', ' stars²')}</p><small>Read the shapes above to see where ratings cluster. These figures describe the demo ratings, not the causes of disagreement.</small>`;
    }
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
  [...new Set(movies.flatMap(m => m.genres))].sort().forEach(genre => { const option = document.createElement('option'); option.value = option.textContent = genre; $('genre').append(option); });
  ['search', 'genre', 'minimum', 'sort'].forEach(key => $(key).addEventListener(key === 'search' || key === 'minimum' ? 'input' : 'change', e => { state[key] = key === 'minimum' ? Number(e.target.value) : e.target.value; renderExplore(); announce(`${filterMovies(movies, state).length} films match your filters.`); }));
  $('reset').addEventListener('click', () => { Object.assign(state, { search: '', genre: 'all', minimum: 100, sort: 'variance' }); ['search', 'genre', 'minimum', 'sort'].forEach(key => $(key).value = state[key]); renderExplore(); announce('Filters reset. Comparison selection retained.'); });
  document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => showView(button.dataset.view)));
  $('show-comparison').addEventListener('click', () => { showView('compare'); document.querySelector('[data-view="compare"]').focus(); });
  ['compare-left', 'compare-right'].forEach((id, index) => $(id).addEventListener('change', event => {
    state.comparison[index] = event.target.value ? Number(event.target.value) : null;
    renderDetail(); renderComparison();
    announce('Comparison updated.');
  }));
  $('back-explore').addEventListener('click', () => showView('explore'));
  $('clear-comparison').addEventListener('click', () => { state.comparison = [null, null]; renderDetail(); renderComparison(); announce('Comparison cleared.'); });
  renderExplore(); renderComparison(); showView('overview');
})();

/* Four coordinated Overview charts, driven by the precomputed catalog. */
(() => {
  const { movies, genreSummary, genreTimeSeries, violinDensity, genreColor, meta } = window.ReelData;
  const $ = id => document.getElementById(id);
  const esc = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = n => n === null ? '—' : n.toFixed(2);
  const color = genreColor;
  let selectedGenre = null;
  const muted = genre => selectedGenre && selectedGenre !== genre;
  // Genre and genre-year Controversy Scores stay under 1.4, so both charts use a fixed 0-2 scale.
  const VARIANCE_MAX = 2;
  const VARIANCE_TICKS = [0, 0.5, 1, 1.5, 2];

  const tickLabel = n => Number.isInteger(n) ? String(n) : n.toFixed(1);
  // max sets the full-width value; ticks are labelled and, with guides, drawn as faint marks.
  function bars(rows, key, { max = 5, ticks = [0, 1, 2, 3, 4, 5], guides = false } = {}) {
    const position = n => `--p:${n / max * 100}`;
    const guideMarks = guides ? `<div class="bar-guides" aria-hidden="true">${ticks.map(n => `<i style="${position(n)}"></i>`).join('')}</div>` : '';
    const axis = guides
      ? `<div class="bar-axis has-ticks" aria-hidden="true">${ticks.map(n => `<span style="${position(n)}">${tickLabel(n)}</span>`).join('')}</div>`
      : `<div class="bar-axis">${ticks.map(n => `<span>${tickLabel(n)}</span>`).join('')}</div>`;
    return `<div class="genre-bars"><div class="bar-rows">${guideMarks}${rows.map(row => `<button class="genre-bar ${selectedGenre === row.genre ? 'chosen' : ''} ${muted(row.genre) ? 'is-muted' : ''}" data-genre="${row.genre}" aria-pressed="${selectedGenre === row.genre}" style="--genre-color:${color(row.genre)}"><span>${row.genre}<small>${row.films} films</small></span><span class="bar-track"><i style="width:${Math.min(100, row[key] / max * 100)}%"></i></span><strong>${fmt(row[key])}</strong></button>`).join('')}</div>${axis}</div>`;
  }

  const VIOLINS_PER_ROW = 6;
  function violins(rows) {
    const w = 600, left = 37, right = 10, rowHeight = 150, plotTop = 12, plotHeight = 102;
    const rowCount = Math.max(1, Math.ceil(rows.length / VIOLINS_PER_ROW));
    const h = rowCount * rowHeight;
    const step = (w - left - right) / VIOLINS_PER_ROW;
    const yIn = (rowIndex, rating) => rowIndex * rowHeight + plotTop + (5 - rating) / 4.5 * plotHeight;
    const densities = rows.map(row => violinDensity(row.bins));
    // One density scale across every row keeps widths comparable between genres.
    const maxDensity = Math.max(.001, ...densities.flatMap(points => points.map(p => p.density)));
    const grids = Array.from({ length: rowCount }, (_, r) => {
      const lines = [1, 2, 3, 4, 5].map(n => `<line x1="${left}" x2="${w - right}" y1="${yIn(r, n)}" y2="${yIn(r, n)}" class="grid-line"/><text x="${left - 10}" y="${yIn(r, n) + 3}" text-anchor="end">${n}</text>`).join('');
      const mid = yIn(r, 2.75);
      return `${lines}<text x="12" y="${mid}" transform="rotate(-90 12 ${mid})" text-anchor="middle">Stars</text>`;
    }).join('');
    const shapes = rows.map((row, i) => {
      const r = Math.floor(i / VIOLINS_PER_ROW), slot = i % VIOLINS_PER_ROW;
      const center = left + step * (slot + .5), halfWidth = step * .34;
      const points = densities[i];
      const sides = [points.map(p => `${center - p.density / maxDensity * halfWidth},${yIn(r, p.rating)}`), [...points].reverse().map(p => `${center + p.density / maxDensity * halfWidth},${yIn(r, p.rating)}`)];
      const pooledMean = row.bins.reduce((sum, n, j) => sum + n * (j + 1) / 2, 0) / row.count;
      const labelY = r * rowHeight + plotTop + plotHeight + 20;
      return `<g role="button" tabindex="0" data-genre="${row.genre}" aria-pressed="${selectedGenre === row.genre}" aria-label="${row.genre}, ${row.count} pooled ratings; select to highlight" class="genre-mark ${muted(row.genre) ? 'is-muted' : ''}"><title>${row.genre} · ${row.count.toLocaleString('en-US')} ratings · pooled mean ${fmt(pooledMean)}</title><path d="M${sides[0].join('L')}L${sides[1].join('L')}Z" fill="${color(row.genre)}" fill-opacity=".40" stroke="${color(row.genre)}" stroke-width="${selectedGenre === row.genre ? 2.5 : 1.3}"/><line x1="${center - 5}" x2="${center + 5}" y1="${yIn(r, pooledMean)}" y2="${yIn(r, pooledMean)}" stroke="#203a32" stroke-width="2"/><text x="${center}" y="${labelY}" text-anchor="middle">${row.genre}</text></g>`;
    }).join('');
    return `<svg class="overview-svg violin-svg" viewBox="0 0 ${w} ${h}" role="group" aria-label="Genre rating distributions as smoothed violin plots, ${VIOLINS_PER_ROW} genres per row">${grids}${shapes}</svg>`;
  }

  function trends(series, width) {
    const w = 600, h = 160, left = 37, right = 24, top = 12, bottom = 29;
    const years = series.flatMap(s => s.rows.map(r => r.year));
    const start = Math.min(...years), end = Math.max(...years);
    const x = year => start === end ? (left + w - right) / 2 : left + (year - start) / (end - start) * (w - left - right);
    const y = n => h - bottom - Math.min(Math.max(n, 0), VARIANCE_MAX) / VARIANCE_MAX * (h - bottom - top);
    const grid = VARIANCE_TICKS.map(n => `<line x1="${left}" x2="${w - right}" y1="${y(n)}" y2="${y(n)}" class="grid-line"/><text x="${left - 9}" y="${y(n) + 3}" text-anchor="end">${tickLabel(n)}</text>`).join('');
    const allYears = [...new Set(years)].sort((a, b) => a - b);
    const ticks = allYears.filter((year, i) => i % Math.max(1, Math.ceil(allYears.length / 5)) === 0 || i === allYears.length - 1).map(year => `<text x="${x(year)}" y="${h - 9}" text-anchor="middle">${width === 10 ? `${year}s` : year}</text>`).join('');
    const lines = series.map(s => {
      let path = '', connected = false;
      const marks = s.rows.map(row => {
        if (row.variance === null) { connected = false; return ''; }
        path += `${connected ? 'L' : 'M'}${x(row.year)},${y(row.variance)} `; connected = true;
        const periodEnd = Math.min(meta.ratingYearMax || row.year + width - 1, row.year + width - 1);
        return `<circle cx="${x(row.year)}" cy="${y(row.variance)}" r="2.6" fill="${color(s.genre)}"><title>${s.genre} · ${row.year}${width > 1 ? '–' + periodEnd : ''} · variance ${fmt(row.variance)} · ${row.films} contributing films · n=${row.count}</title></circle>`;
      }).join('');
      return `<g class="genre-mark ${muted(s.genre) ? 'is-muted' : ''}" role="button" tabindex="0" data-genre="${s.genre}" aria-pressed="${selectedGenre === s.genre}" aria-label="${s.genre} Controversy Score over time; select to highlight"><path d="${path}" fill="none" stroke="${color(s.genre)}" stroke-width="${selectedGenre === s.genre ? 3 : 1.7}"/>${marks}</g>`;
    }).join('');
    return `<svg class="overview-svg" viewBox="0 0 ${w} ${h}" role="group" aria-label="Controversy Score by genre over MovieLens rating submission periods">${grid}${ticks}${lines}</svg><div class="genre-legend">${series.map(s => `<button data-genre="${s.genre}" aria-pressed="${selectedGenre === s.genre}" class="${muted(s.genre) ? 'is-muted' : ''}"><i style="background:${color(s.genre)}"></i>${s.genre}</button>`).join('')}</div>`;
  }

  function render() {
    const minimum = Number($('genre-minimum').value), width = Number($('time-period').value);
    const eligible = movies.filter(m => m.count >= minimum);
    const rows = genreSummary(eligible), series = genreTimeSeries(eligible, width);
    if (!rows.some(row => row.genre === selectedGenre)) selectedGenre = null;
    $('genre-summary').textContent = `${eligible.length} films · ${rows.length} genres`;
    $('genre-means').innerHTML = bars(rows, 'mean');
    $('genre-variances').innerHTML = bars(rows, 'variance', { max: VARIANCE_MAX, ticks: VARIANCE_TICKS, guides: true });
    $('genre-violins').innerHTML = violins(rows);
    $('genre-trends').innerHTML = trends(series, width);
    const row = rows.find(r => r.genre === selectedGenre);
    $('genre-insight').textContent = row ? `${row.genre} · ${row.films} films · average ${fmt(row.mean)} / 5 · Controversy Score ${fmt(row.variance)} stars² · highlighted across all charts.` : 'Select a genre in any chart to compare its Controversy Score, distribution, history, and average.';
    $('overview-view').querySelectorAll('[data-genre]').forEach(element => {
      const select = () => {
        const genre = element.dataset.genre;
        selectedGenre = selectedGenre === genre ? null : genre;
        render();
        $('overview-view').querySelector(`[data-genre="${genre}"]`)?.focus({ preventScroll: true });
      };
      element.addEventListener('click', select);
      if (element.tagName.toLowerCase() === 'g') element.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(); }
      });
    });
  }
  $('genre-minimum').addEventListener('change', render);
  $('time-period').addEventListener('change', render);
  $('genre-clear').addEventListener('click', () => { selectedGenre = null; render(); });
  render();
})();

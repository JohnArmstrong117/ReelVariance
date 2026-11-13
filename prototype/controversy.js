/* Controversy & Profits: synthetic finance charts with All / genre overlays. */
(() => {
  const { movies, genreColor, controversySeries, profitByRating, profitByGenre } = window.ReelData;
  const $ = id => document.getElementById(id);
  const esc = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const genres = [...new Set(movies.flatMap(m => m.genres))].sort();
  const ALL_COLOR = '#28664e';
  let showAll = true;
  let selectedGenres = new Set();

  function money(n) {
    if (n == null || !Number.isFinite(n)) return '—';
    const abs = Math.abs(n);
    if (abs >= 1e9) return `${n < 0 ? '-' : ''}$${(abs / 1e9).toFixed(1)}B`;
    if (abs >= 1e6) return `${n < 0 ? '-' : ''}$${(abs / 1e6).toFixed(0)}M`;
    return `$${Math.round(n).toLocaleString('en-US')}`;
  }

  function activeSeries() {
    const series = [];
    if (showAll || selectedGenres.size === 0) series.push({ key: 'all', label: 'All genres', color: ALL_COLOR, genre: null });
    [...selectedGenres].sort().forEach(genre => {
      series.push({ key: genre, label: genre, color: genreColor(genre), genre });
    });
    return series;
  }

  function legend(seriesList) {
    return `<div class="genre-legend language-legend">${seriesList.map(s => `<span><i style="background:${s.color}"></i>${esc(s.label)}</span>`).join('')}</div>`;
  }

  function lineChart(seriesList, mode, aria) {
    const w = 560, h = 210, left = 54, right = 14, top = 14, bottom = 34;
    const packed = seriesList.map(s => ({ ...s, rows: controversySeries(movies, { mode, genre: s.genre }) }));
    const xs = packed.flatMap(s => s.rows.map(r => r.x));
    const ys = packed.flatMap(s => s.rows.map(r => r.y));
    if (!xs.length) return '<p class="empty">No demo points match these filters.</p>';
    const xMin = Math.min(...xs), xMax = Math.max(...xs);
    const yMin = Math.min(0, ...ys), yMax = Math.max(...ys);
    const xSpan = xMax - xMin || 1, ySpan = yMax - yMin || 1;
    const x = v => left + (v - xMin) / xSpan * (w - left - right);
    const y = v => h - bottom - (v - yMin) / ySpan * (h - bottom - top);
    const yTicks = [yMin, yMin + ySpan / 2, yMax];
    const xTicks = [xMin, xMin + xSpan / 2, xMax];
    const yLabel = v => mode === 'controversyVsBudget' ? v.toFixed(2) : money(v);
    const xLabel = v => mode === 'controversyVsBudget' ? money(v) : v.toFixed(2);
    const grid = yTicks.map(v => `<line x1="${left}" x2="${w - right}" y1="${y(v)}" y2="${y(v)}" class="grid-line"/><text x="${left - 8}" y="${y(v) + 3}" text-anchor="end">${yLabel(v)}</text>`).join('');
    const axis = xTicks.map(v => `<text x="${x(v)}" y="${h - 10}" text-anchor="middle">${xLabel(v)}</text>`).join('');
    const paths = packed.map(s => {
      if (!s.rows.length) return '';
      const d = s.rows.map((r, i) => `${i ? 'L' : 'M'}${x(r.x).toFixed(1)},${y(r.y).toFixed(1)}`).join(' ');
      const dots = s.rows.map(r => `<circle cx="${x(r.x)}" cy="${y(r.y)}" r="2.8" fill="${s.color}"><title>${esc(s.label)} · x=${xLabel(r.x)} · y=${yLabel(r.y)} · ${r.films} films</title></circle>`).join('');
      return `<g><path d="${d}" fill="none" stroke="${s.color}" stroke-width="2.2"/>${dots}</g>`;
    }).join('');
    return `<svg class="overview-svg controversy-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(aria)}">${grid}${axis}${paths}</svg>${legend(packed)}`;
  }

  function ratingBars(seriesList) {
    const w = 560, h = 210, left = 54, right = 14, top = 14, bottom = 34;
    const packed = seriesList.map(s => ({ ...s, rows: profitByRating(movies, { genre: s.genre }) }));
    const ratings = [...new Set(packed.flatMap(s => s.rows.map(r => r.rating)))].sort((a, b) => a - b);
    if (!ratings.length) return '<p class="empty">No demo points match these filters.</p>';
    const profits = packed.flatMap(s => s.rows.map(r => r.profit));
    const yMin = Math.min(0, ...profits), yMax = Math.max(...profits);
    const ySpan = yMax - yMin || 1;
    const y = v => h - bottom - (v - yMin) / ySpan * (h - bottom - top);
    const groupWidth = (w - left - right) / ratings.length;
    const barWidth = Math.min(14, groupWidth / (packed.length + 0.6));
    const yTicks = [yMin, yMin + ySpan / 2, yMax];
    const grid = yTicks.map(v => `<line x1="${left}" x2="${w - right}" y1="${y(v)}" y2="${y(v)}" class="grid-line"/><text x="${left - 8}" y="${y(v) + 3}" text-anchor="end">${money(v)}</text>`).join('');
    const labels = ratings.map((rating, i) => `<text x="${left + groupWidth * (i + .5)}" y="${h - 10}" text-anchor="middle">${rating}</text>`).join('');
    const bars = ratings.map((rating, i) => packed.map((s, si) => {
      const row = s.rows.find(r => r.rating === rating);
      if (!row) return '';
      const cx = left + groupWidth * (i + .5) + (si - (packed.length - 1) / 2) * (barWidth + 2);
      const topY = y(Math.max(row.profit, 0));
      const baseY = y(0);
      const height = Math.max(1, Math.abs(baseY - topY));
      return `<rect x="${(cx - barWidth / 2).toFixed(1)}" y="${(row.profit >= 0 ? topY : baseY).toFixed(1)}" width="${barWidth}" height="${height.toFixed(1)}" fill="${s.color}" rx="2"><title>${esc(s.label)} · ${rating}★ · ${money(row.profit)} · ${row.films} films</title></rect>`;
    }).join('')).join('');
    return `<svg class="overview-svg controversy-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="Average demo profit by average star rating">${grid}${labels}${bars}</svg>${legend(packed)}`;
  }

  function radarChart(seriesList) {
    const size = 320, cx = size / 2, cy = size / 2 + 2, radius = 96;
    const BUDGET_COLOR = '#8a6235';
    const allOn = seriesList.some(s => s.key === 'all');
    const selected = seriesList.filter(s => s.key !== 'all').map(s => s.key);
    const axes = allOn || !selected.length ? profitByGenre(movies) : profitByGenre(movies, { genres: selected });
    if (!axes.length) return '<p class="empty">No demo points match these filters.</p>';
    const maxValue = Math.max(
      ...axes.map(a => Math.abs(a.profit || 0)),
      ...axes.map(a => Math.abs(a.budget || 0)),
      1
    );
    const angle = i => -Math.PI / 2 + i * 2 * Math.PI / axes.length;
    const point = (i, value) => {
      const r = Math.max(0, value) / maxValue * radius;
      return [cx + Math.cos(angle(i)) * r, cy + Math.sin(angle(i)) * r];
    };
    const polygonPath = values => axes.map((_, i) => {
      const [x, y] = point(i, values[i] || 0);
      return `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ') + 'Z';
    const ringScales = [1 / 3, 2 / 3, 1];
    const rings = ringScales.map(scale => {
      const d = axes.map((_, i) => {
        const [x, y] = point(i, maxValue * scale);
        return `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(' ') + 'Z';
      return `<path d="${d}" class="controversy-radar-ring"/>`;
    }).join('');
    // Tick labels along the first spoke (top), offset slightly to the right.
    const tickSpoke = 0;
    const tickAngle = angle(tickSpoke);
    const tickLabels = ringScales.map(scale => {
      const r = scale * radius;
      const x = cx + Math.cos(tickAngle) * r + 8;
      const y = cy + Math.sin(tickAngle) * r + 3;
      return `<text class="controversy-radar-tick" x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="start">${money(maxValue * scale)}</text>`;
    }).join('');
    const spokes = axes.map((row, i) => {
      const [x, y] = point(i, maxValue);
      const [lx, ly] = point(i, maxValue * 1.24);
      return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" class="controversy-radar-spoke"/><text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" dominant-baseline="middle">${esc(row.genre)}</text>`;
    }).join('');
    let shapes = '';
    const showFullWeb = allOn || !selected.length || selected.length >= 3;
    if (showFullWeb) {
      const profitFill = allOn || !selected.length ? '.16' : '.08';
      shapes += `<path d="${polygonPath(axes.map(a => a.profit || 0))}" fill="${ALL_COLOR}" fill-opacity="${profitFill}" stroke="${ALL_COLOR}" stroke-width="2"/>`;
      shapes += `<path d="${polygonPath(axes.map(a => a.budget || 0))}" class="controversy-radar-budget" fill="${BUDGET_COLOR}" fill-opacity=".08" stroke="${BUDGET_COLOR}" stroke-width="2" stroke-dasharray="5 3"/>`;
      shapes += axes.map((row, i) => {
        const [px, py] = point(i, row.profit || 0);
        const [bx, by] = point(i, row.budget || 0);
        return `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="3" fill="${ALL_COLOR}"><title>Profit · ${esc(row.genre)} · ${money(row.profit)} · ${row.films} films</title></circle>`
          + `<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="2.6" fill="${BUDGET_COLOR}"><title>Budget · ${esc(row.genre)} · ${money(row.budget)} · ${row.films} films</title></circle>`;
      }).join('');
    }
    selected.forEach(genre => {
      const index = axes.findIndex(a => a.genre === genre);
      if (index < 0) return;
      const row = axes[index];
      const [px, py] = point(index, row.profit || 0);
      const [bx, by] = point(index, row.budget || 0);
      const color = genreColor(genre);
      shapes += `<line x1="${cx}" y1="${cy}" x2="${px.toFixed(1)}" y2="${py.toFixed(1)}" stroke="${color}" stroke-width="2.2"/>`;
      shapes += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="5" fill="${color}" stroke="#fff" stroke-width="1.5"><title>${esc(genre)} profit · ${money(row.profit)} · ${row.films} films</title></circle>`;
      shapes += `<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="4" fill="none" stroke="${color}" stroke-width="1.6" stroke-dasharray="3 2"><title>${esc(genre)} budget · ${money(row.budget)} · ${row.films} films</title></circle>`;
    });
    const metricLegend = `<div class="genre-legend language-legend controversy-radar-legend">`
      + `<span><i style="background:${ALL_COLOR}"></i>Avg profit</span>`
      + `<span><i class="controversy-legend-dashed" style="background:${BUDGET_COLOR}"></i>Avg budget</span>`
      + `${seriesList.map(s => `<span><i style="background:${s.color}"></i>${esc(s.label)}</span>`).join('')}`
      + `</div>`;
    return `<svg class="overview-svg controversy-svg controversy-radar" viewBox="0 0 ${size} ${size}" role="img" aria-label="Average demo profit and budget in each genre">${rings}${spokes}${tickLabels}${shapes}</svg>${metricLegend}`;
  }

  function syncChips() {
    const allForced = selectedGenres.size === 0;
    $('controversy-genre-buttons').querySelectorAll('[data-genre]').forEach(button => {
      const genre = button.dataset.genre;
      const on = genre === 'all' ? (showAll || allForced) : selectedGenres.has(genre);
      button.classList.toggle('is-selected', on);
      button.setAttribute('aria-pressed', String(on));
    });
  }

  function render() {
    const series = activeSeries();
    $('controversy-summary').textContent = `${series.length} series · ${series.map(s => s.label).join(', ')}`;
    $('controversy-profits-line').innerHTML = lineChart(series, 'profitsVsControversy', 'Average demo profit versus Controversy Score');
    $('controversy-budget-line').innerHTML = lineChart(series, 'controversyVsBudget', 'Average Controversy Score versus budget');
    $('controversy-rating-bars').innerHTML = ratingBars(series);
    $('controversy-radar').innerHTML = radarChart(series);
    syncChips();
  }

  $('controversy-genre-buttons').innerHTML = [
    `<button type="button" class="language-genre-chip is-selected" data-genre="all" aria-pressed="true" style="--genre-color:${ALL_COLOR}"><i style="background:${ALL_COLOR}"></i>All</button>`,
    ...genres.map(genre => {
      const color = genreColor(genre);
      return `<button type="button" class="language-genre-chip" data-genre="${esc(genre)}" aria-pressed="false" style="--genre-color:${color}"><i style="background:${color}"></i>${esc(genre)}</button>`;
    })
  ].join('');

  $('controversy-genre-buttons').addEventListener('click', event => {
    const button = event.target.closest('[data-genre]');
    if (!button) return;
    const genre = button.dataset.genre;
    if (genre === 'all') {
      showAll = !showAll;
      if (!showAll && selectedGenres.size === 0) showAll = true;
    } else if (selectedGenres.has(genre)) {
      selectedGenres.delete(genre);
      if (!showAll && selectedGenres.size === 0) showAll = true;
    } else {
      selectedGenres.add(genre);
    }
    render();
  });

  $('controversy-reset').addEventListener('click', () => {
    showAll = true;
    selectedGenres = new Set();
    render();
  });

  render();
})();

/* Four coordinated Overview charts. All numerical fixtures remain synthetic. */
(() => {
  const { movies, genreSummary, genreTimeSeries, violinDensity } = window.ReelData;
  const $ = id => document.getElementById(id);
  const esc = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = n => n === null ? '—' : n.toFixed(2);
  const colors = ['#5e8170', '#b17e49', '#60859b', '#aa7287', '#8d70a5', '#418b85', '#918344'];
  const genres = [...new Set(movies.flatMap(m => m.genres))].sort();
  const color = genre => colors[genres.indexOf(genre) % colors.length];
  let selectedGenre = null;
  const muted = genre => selectedGenre && selectedGenre !== genre;

  function bars(rows, key) {
    return `<div class="genre-bars">${rows.map(row => `<button class="genre-bar ${selectedGenre === row.genre ? 'chosen' : ''} ${muted(row.genre) ? 'is-muted' : ''}" data-genre="${row.genre}" aria-pressed="${selectedGenre === row.genre}" style="--genre-color:${color(row.genre)}"><span>${row.genre}<small>${row.films} films</small></span><span class="bar-track"><i style="width:${row[key] / 5 * 100}%"></i></span><strong>${fmt(row[key])}</strong></button>`).join('')}<div class="bar-axis"><span>0</span><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span></div></div>`;
  }

  function violins(rows) {
    const w = 600, h = 188, top = 12, bottom = 34, left = 37, right = 10;
    const y = rating => h - bottom - (rating - .5) / 4.5 * (h - bottom - top);
    const step = (w - left - right) / rows.length;
    const densities = rows.map(row => violinDensity(row.bins));
    const maxDensity = Math.max(.001, ...densities.flatMap(points => points.map(p => p.density)));
    const grid = [1, 2, 3, 4, 5].map(n => `<line x1="${left}" x2="${w - right}" y1="${y(n)}" y2="${y(n)}" class="grid-line"/><text x="${left - 10}" y="${y(n) + 3}" text-anchor="end">${n}</text>`).join('');
    const shapes = rows.map((row, i) => {
      const center = left + step * (i + .5), halfWidth = step * .34;
      const points = densities[i];
      const sides = [points.map(p => `${center - p.density / maxDensity * halfWidth},${y(p.rating)}`), [...points].reverse().map(p => `${center + p.density / maxDensity * halfWidth},${y(p.rating)}`)];
      const pooledMean = row.bins.reduce((sum, n, j) => sum + n * (j + 1) / 2, 0) / row.count;
      return `<g role="button" tabindex="0" data-genre="${row.genre}" aria-pressed="${selectedGenre === row.genre}" aria-label="${row.genre}, ${row.count} pooled ratings; select to highlight" class="genre-mark ${muted(row.genre) ? 'is-muted' : ''}"><title>${row.genre} · ${row.count.toLocaleString('en-US')} ratings · pooled mean ${fmt(pooledMean)}</title><path d="M${sides[0].join('L')}L${sides[1].join('L')}Z" fill="${color(row.genre)}" fill-opacity=".40" stroke="${color(row.genre)}" stroke-width="${selectedGenre === row.genre ? 2.5 : 1.3}"/><line x1="${center - 5}" x2="${center + 5}" y1="${y(pooledMean)}" y2="${y(pooledMean)}" stroke="#203a32" stroke-width="2"/><text x="${center}" y="${h - 11}" text-anchor="middle">${row.genre}</text></g>`;
    }).join('');
    return `<svg class="overview-svg" viewBox="0 0 ${w} ${h}" role="group" aria-label="Genre rating distributions as smoothed violin plots">${grid}${shapes}<text x="9" y="88" transform="rotate(-90 9 88)" text-anchor="middle">Stars</text></svg>`;
  }

  function trends(series, width) {
    const w = 600, h = 160, left = 37, right = 14, top = 12, bottom = 29;
    const years = series.flatMap(s => s.rows.map(r => r.year));
    const start = Math.min(...years), end = Math.max(...years);
    const x = year => start === end ? (left + w - right) / 2 : left + (year - start) / (end - start) * (w - left - right);
    const maximum = Math.max(5, ...series.flatMap(s => s.rows.map(r => Math.ceil(r.variance ?? 0))));
    const y = n => h - bottom - n / maximum * (h - bottom - top);
    const grid = [0, 1, 2, 3, 4, 5].map(n => `<line x1="${left}" x2="${w - right}" y1="${y(n)}" y2="${y(n)}" class="grid-line"/><text x="${left - 9}" y="${y(n) + 3}" text-anchor="end">${n}</text>`).join('');
    const allYears = [...new Set(years)].sort((a, b) => a - b);
    const ticks = allYears.filter((year, i) => i % Math.max(1, Math.ceil(allYears.length / 5)) === 0 || i === allYears.length - 1).map(year => `<text x="${x(year)}" y="${h - 9}" text-anchor="middle">${width === 10 ? `${year}s` : year}</text>`).join('');
    const lines = series.map(s => {
      let path = '', connected = false;
      const marks = s.rows.map(row => {
        if (row.variance === null) { connected = false; return ''; }
        path += `${connected ? 'L' : 'M'}${x(row.year)},${y(row.variance)} `; connected = true;
        return `<circle cx="${x(row.year)}" cy="${y(row.variance)}" r="2.6" fill="${color(s.genre)}"><title>${s.genre} · ${row.year}${width > 1 ? '–' + Math.min(2023, row.year + width - 1) : ''} · variance ${fmt(row.variance)} · ${row.films} contributing films · n=${row.count}</title></circle>`;
      }).join('');
      return `<g class="genre-mark ${muted(s.genre) ? 'is-muted' : ''}" role="button" tabindex="0" data-genre="${s.genre}" aria-pressed="${selectedGenre === s.genre}" aria-label="${s.genre} disagreement over time; select to highlight"><path d="${path}" fill="none" stroke="${color(s.genre)}" stroke-width="${selectedGenre === s.genre ? 3 : 1.7}"/>${marks}</g>`;
    }).join('');
    return `<svg class="overview-svg" viewBox="0 0 ${w} ${h}" role="group" aria-label="Average within-film variance by genre over rating submission periods; simulated data">${grid}${ticks}${lines}</svg><div class="genre-legend">${series.map(s => `<button data-genre="${s.genre}" aria-pressed="${selectedGenre === s.genre}" class="${muted(s.genre) ? 'is-muted' : ''}"><i style="background:${color(s.genre)}"></i>${s.genre}</button>`).join('')}</div>`;
  }

  function render() {
    const minimum = Number($('genre-minimum').value), width = Number($('time-period').value);
    const eligible = movies.filter(m => m.count >= minimum);
    const rows = genreSummary(eligible), series = genreTimeSeries(eligible, width);
    if (!rows.some(row => row.genre === selectedGenre)) selectedGenre = null;
    $('genre-summary').textContent = `${eligible.length} films · ${rows.length} genres`;
    $('genre-means').innerHTML = bars(rows, 'mean');
    $('genre-variances').innerHTML = bars(rows, 'variance');
    $('genre-violins').innerHTML = violins(rows);
    $('genre-trends').innerHTML = trends(series, width);
    const row = rows.find(r => r.genre === selectedGenre);
    $('genre-insight').textContent = row ? `${row.genre} · ${row.films} films · average ${fmt(row.mean)} / 5 · within-film variance ${fmt(row.variance)} stars² · highlighted across all charts.` : 'Select a genre in any chart to compare its average, disagreement, distribution and history.';
    const counts = rows.map(row => `<tr><th>${row.genre}</th><td>${row.films}</td><td>${row.count}</td><td>${fmt(row.mean)}</td><td>${fmt(row.variance)}</td>${row.bins.map(n => `<td>${n}</td>`).join('')}</tr>`).join('');
    const history = series.flatMap(s => s.rows.map(row => `<tr><th>${s.genre}</th><td>${row.year}${width > 1 ? '–' + Math.min(2023, row.year + width - 1) : ''}</td><td>${row.films}</td><td>${row.count}</td><td>${fmt(row.variance)}</td></tr>`)).join('');
    $('overview-values').innerHTML = `<table class="period-table"><caption>Genre values and exact pooled rating counts</caption><thead><tr><th>Genre</th><th>Films</th><th>Ratings</th><th>Film mean</th><th>Film variance</th>${Array.from({length:10}, (_,i) => `<th>${(i+1)/2}★</th>`).join('')}</tr></thead><tbody>${counts}</tbody></table><table class="period-table"><caption>Simulated historical periods; average within-film variance</caption><thead><tr><th>Genre</th><th>Period</th><th>Contributing films</th><th>Ratings</th><th>Variance</th></tr></thead><tbody>${history}</tbody></table>`;
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

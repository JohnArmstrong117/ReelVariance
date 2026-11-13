/* Language of Reviews: synthetic word cloud and horizontal frequency bars. */
(() => {
  const { movies, reviewWords, genreColor } = window.ReelData;
  const $ = id => document.getElementById(id);
  const esc = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const number = n => n.toLocaleString('en-US');
  const genres = [...new Set(movies.flatMap(m => m.genres))].sort();
  let selectedWord = null;
  const measure = (() => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    return (word, size) => {
      ctx.font = `700 ${size}px Georgia, 'Times New Roman', serif`;
      const width = ctx.measureText(word).width;
      return { width, height: size * 1.15 };
    };
  })();

  function placeCloud(words) {
    const w = 640, h = 360, cx = w / 2, cy = h / 2;
    if (!words.length) return { w, h, items: [] };
    const max = words[0].count, min = words.at(-1).count;
    const sizeOf = count => 14 + (max === min ? 18 : (count - min) / (max - min) * 34);
    const placed = [];
    const overlaps = (a, b) => !(a.x + a.width / 2 + 4 < b.x - b.width / 2 || b.x + b.width / 2 + 4 < a.x - a.width / 2 || a.y + a.height / 2 + 2 < b.y - b.height / 2 || b.y + b.height / 2 + 2 < a.y - a.height / 2);
    words.forEach((row, index) => {
      const size = sizeOf(row.count);
      const box = measure(row.word, size);
      let angle = index * 2.4, radius = 0, x = cx, y = cy, found = false;
      for (let step = 0; step < 900; step++) {
        x = cx + Math.cos(angle) * radius;
        y = cy + Math.sin(angle) * radius * 0.72;
        const candidate = { x, y, width: box.width, height: box.height };
        const inside = x - box.width / 2 > 8 && x + box.width / 2 < w - 8 && y - box.height / 2 > 8 && y + box.height / 2 < h - 8;
        if (inside && !placed.some(p => overlaps(candidate, p))) { found = true; break; }
        angle += 0.35;
        radius += 0.55;
      }
      if (!found) { x = 24 + (index % 6) * (w / 6); y = 28 + Math.floor(index / 6) * 42; }
      placed.push({ ...row, x, y, size, width: box.width, height: box.height });
    });
    return { w, h, items: placed };
  }

  function orderedRows(rows) {
    if (!selectedWord || !rows.some(row => row.word === selectedWord)) return rows;
    const chosen = rows.find(row => row.word === selectedWord);
    return [chosen, ...rows.filter(row => row.word !== selectedWord)];
  }

  function cloudSvg(rows) {
    const { w, h, items } = placeCloud(rows);
    if (!items.length) return '<p class="empty">No demo words match these filters.</p>';
    // Transparent hit rects sit under each word so clicks are not treated as text selection.
    const marks = items.map(item => {
      const active = selectedWord === item.word;
      const muted = selectedWord && !active;
      const padX = 8, padY = 6;
      const rectX = item.x - item.width / 2 - padX;
      const rectY = item.y - item.height / 2 - padY;
      const rectW = item.width + padX * 2;
      const rectH = item.height + padY * 2;
      return `<g class="language-cloud-word ${active ? 'is-selected' : ''} ${muted ? 'is-muted' : ''}" role="button" tabindex="0" data-word="${esc(item.word)}" aria-pressed="${active}" aria-label="${esc(item.word)}, ${number(item.count)} mentions, ${esc(item.genre)}">
        <title>${esc(item.word)} · ${number(item.count)} mentions · ${esc(item.genre)}. Select to highlight.</title>
        <rect class="language-cloud-hit" x="${rectX.toFixed(1)}" y="${rectY.toFixed(1)}" width="${rectW.toFixed(1)}" height="${rectH.toFixed(1)}" rx="4"></rect>
        <text x="${item.x.toFixed(1)}" y="${item.y.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" fill="${genreColor(item.genre)}" font-size="${item.size.toFixed(1)}" font-family="Georgia, 'Times New Roman', serif" font-weight="700">${esc(item.word)}</text>
      </g>`;
    }).join('');
    return `<svg class="language-cloud" viewBox="0 0 ${w} ${h}" role="group" aria-label="Word cloud of the most common demo review words for the current filters. Select a word to highlight it and bring it to the top of the frequency list.">${marks}</svg>`;
  }

  function wordBars(rows) {
    const display = orderedRows(rows);
    if (!display.length) return '<p class="empty">No demo words match these filters.</p>';
    const max = Math.max(...rows.map(row => row.count), 1);
    const ticks = [0, Math.round(max / 2), max];
    const bars = display.map(row => {
      const active = selectedWord === row.word;
      return `<button type="button" class="genre-bar language-word-bar ${active ? 'chosen' : ''}" data-word="${esc(row.word)}" aria-pressed="${active}" style="--genre-color:${genreColor(row.genre)}"><span>${esc(row.word)}<small>${esc(row.genre)}</small></span><span class="bar-track"><i style="width:${row.count / max * 100}%"></i></span><strong>${number(row.count)}</strong></button>`;
    }).join('');
    return `<div class="genre-bars language-word-bars">${bars}<div class="bar-axis language-bar-axis"><span>${ticks[0]}</span><span>${number(ticks[1])}</span><span>${number(ticks[2])}</span></div></div>`;
  }

  function legend(rows, selectedGenre) {
    if (selectedGenre !== 'all') return `<div class="genre-legend language-legend"><span><i style="background:${genreColor(selectedGenre)}"></i>${esc(selectedGenre)}</span></div>`;
    const used = [...new Set(rows.map(r => r.genre))].sort();
    return `<div class="genre-legend language-legend">${used.map(g => `<span><i style="background:${genreColor(g)}"></i>${esc(g)}</span>`).join('')}</div>`;
  }

  function selectWord(word, source = 'cloud') {
    if (!word) return;
    selectedWord = selectedWord === word ? null : word;
    render();
    if (!selectedWord) return;
    const focusRoot = source === 'bars' ? $('language-bars') : $('language-cloud');
    const escapeWord = window.CSS && CSS.escape ? CSS.escape(selectedWord) : selectedWord.replace(/"/g, '\\"');
    focusRoot.querySelector(`[data-word="${escapeWord}"]`)?.focus({ preventScroll: true });
    $('language-bars').querySelector(`[data-word="${escapeWord}"]`)?.scrollIntoView({ block: 'nearest' });
  }

  function wordFromEvent(event) {
    const target = event.target instanceof Element ? event.target : null;
    return target?.closest?.('[data-word]') || null;
  }

  function bindSelection(root, source) {
    if (!root || root.dataset.selectionBound === 'true') return;
    root.dataset.selectionBound = 'true';
    root.addEventListener('pointerdown', event => {
      const hit = wordFromEvent(event);
      if (!hit) return;
      event.preventDefault();
    });
    root.addEventListener('click', event => {
      const hit = wordFromEvent(event);
      if (!hit) return;
      event.preventDefault();
      selectWord(hit.getAttribute('data-word'), source);
    });
    root.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const hit = wordFromEvent(event);
      if (!hit) return;
      event.preventDefault();
      selectWord(hit.getAttribute('data-word'), source);
    });
  }

  function render() {
    const genre = $('language-genre').value;
    const stars = $('language-stars').value;
    const rows = reviewWords(movies, { genre, stars });
    if (selectedWord && !rows.some(row => row.word === selectedWord)) selectedWord = null;
    const films = movies.filter(m => genre === 'all' || m.genres.includes(genre)).length;
    const starLabel = stars === 'all' ? 'all star ratings' : `${stars}★ ratings`;
    const genreLabel = genre === 'all' ? 'all genres' : genre;
    const selectionNote = selectedWord ? ` · selected “${selectedWord}”` : '';
    $('language-summary').textContent = `${rows.length} words · ${films} films · ${genreLabel} · ${starLabel}${selectionNote}`;
    $('language-cloud').innerHTML = cloudSvg(rows) + legend(rows, genre);
    $('language-bars').innerHTML = wordBars(rows);
  }

  genres.forEach(genre => {
    const option = document.createElement('option');
    option.value = option.textContent = genre;
    $('language-genre').append(option);
  });
  for (let stars = 0.5; stars <= 5; stars += 0.5) {
    const option = document.createElement('option');
    option.value = String(stars);
    option.textContent = `${stars}★`;
    $('language-stars').append(option);
  }
  bindSelection($('language-cloud'), 'cloud');
  bindSelection($('language-bars'), 'bars');
  $('language-genre').addEventListener('change', () => { selectedWord = null; render(); });
  $('language-stars').addEventListener('change', () => { selectedWord = null; render(); });
  $('language-reset').addEventListener('click', () => {
    $('language-genre').value = 'all';
    $('language-stars').value = 'all';
    selectedWord = null;
    render();
  });
  render();
})();

/** Statistics module. */
// Statistics calculations and chart rendering.

const STATISTIC_COLORS = [
  '#a9dfff',
  '#ffad66',
  '#b9e6b0',
  '#d7b5ff',
  '#ff9da4',
  '#9da9ff',
];
let statisticsWatchObserver = null;
let statisticsContinuationTimer = null;
let statisticsRequestedPaletteSource = '';

const statisticsTimeline = $('#statistics-timeline');
statisticsTimeline.addEventListener('scroll', () => {
  const section = $('#statistics-recent-watches');
  document.documentElement.classList.add('statistics-timeline-scrolling');
  section.classList.add('is-scrolling');
  clearTimeout(statisticsContinuationTimer);
  statisticsContinuationTimer = setTimeout(() => {
    section.classList.remove('is-scrolling');
    document.documentElement.classList.remove('statistics-timeline-scrolling');
    requestAnimationFrame(() => updateStatisticsTimelineEdges(statisticsTimeline));
    updateStatisticsBackgroundFromTimeline(statisticsTimeline);
  }, 240);
  updateStatisticsTimelineEdges(statisticsTimeline);
}, { passive: true });

/** Updates the app background from the poster nearest the timeline viewport center. */
function updateStatisticsBackgroundFromTimeline(timeline) {
  if (document.documentElement.dataset.dashboardSection !== 'statistics') return;

  const viewport = timeline.getBoundingClientRect();
  const center = viewport.left + timeline.clientLeft + timeline.clientWidth / 2;
  const visibleNodes = [...timeline.querySelectorAll('.statistics-watch-node:not(.statistics-watch-total)')]
    .filter((node) => {
      const marker = node.querySelector('.statistics-watch-marker');
      if (!marker) return false;
      const bounds = marker.getBoundingClientRect();
      return bounds.right >= viewport.left && bounds.left <= viewport.right;
    });
  const nearestNode = visibleNodes.reduce((nearest, node) => {
    const marker = node.querySelector('.statistics-watch-marker');
    if (!marker) return nearest;
    const bounds = marker.getBoundingClientRect();
    const distance = Math.abs(bounds.left + bounds.width / 2 - center);
    return !nearest || distance < nearest.distance ? { node, distance } : nearest;
  }, null)?.node;
  const poster = nearestNode?.querySelector('.statistics-watch-poster');
  const source = poster?.currentSrc || poster?.src;
  if (!source || source === statisticsRequestedPaletteSource) return;

  statisticsRequestedPaletteSource = source;
  const root = document.documentElement;
  const banner = $('#banner');
  root.style.setProperty('--app-poster-image', `url(${JSON.stringify(source)})`);
  delete root.dataset.pagePaletteFallback;
  getPosterPalette(source).then((palette) => {
    if (source !== statisticsRequestedPaletteSource
      || root.dataset.dashboardSection !== 'statistics') return;
    if (!palette) {
      updateGlassOpacityForPagePalette(null);
      // Avoid leaving the previous poster's colors in place if this image cannot be sampled.
      root.dataset.pagePaletteFallback = 'image';
      root.style.removeProperty('--app-poster-color-one');
      root.style.removeProperty('--app-poster-color-two');
      banner.style.removeProperty('--poster-color-one');
      banner.style.removeProperty('--poster-color-two');
      statisticsRequestedPaletteSource = '';
      return;
    }

    delete root.dataset.pagePaletteFallback;
    updateGlassOpacityForPagePalette(palette);
    root.style.setProperty('--app-poster-color-one', `rgb(${palette.pageOne.join(', ')})`);
    root.style.setProperty('--app-poster-color-two', `rgb(${palette.pageTwo.join(', ')})`);
    banner.style.setProperty('--poster-color-one', `rgb(${palette.bannerOne.join(', ')})`);
    banner.style.setProperty('--poster-color-two', `rgb(${palette.bannerTwo.join(', ')})`);
  });
}

/** Renders the summary metrics beside the featured banner. */
function renderStatsbar() {
  const watches = entries.flatMap((entry) => entry.watches);
  const average = watches.length
    ? (watches.reduce((sum, watch) => sum + Number(watch.score), 0) / watches.length).toFixed(1)
    : '—';

  $('#stat-titles').textContent = entries.length;
  $('#stat-watches').textContent = watches.length;
  $('#stat-rewatches').textContent = Math.max(0, watches.length - entries.length);

  const averageElement = $('#stat-average');
  averageElement.textContent = watches.length ? `${Number(average) * 10}%` : '—';
  if (watches.length) {
    averageElement.classList.add('valueChip', 'ratingValueChip', 'rating-valueChip');
    averageElement.style.setProperty('--rating-color', ratingColorForScore(average));
    averageElement.setAttribute('aria-label', `Average rating ${average} out of 10`);
    averageElement.style.color = ratingColorForScore(average);
  } else {
    averageElement.classList.remove('valueChip', 'ratingValueChip', 'rating-valueChip');
    averageElement.style.removeProperty('--rating-color');
    averageElement.removeAttribute('aria-label');
    averageElement.style.removeProperty('color');
  }
  if (typeof syncSidebarStatistics === 'function') syncSidebarStatistics();
}

/** Counts items grouped by a key returned from a callback. */
function countBy(items, getKey) {
  return items.reduce((counts, item) => {
    const key = getKey(item);
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

/** Sorts grouped counts using the supplied comparison rule. */
function sortedCounts(counts, compare) {
  return Object.entries(counts).sort(compare);
}

/** Calculates aggregate statistics from the current library. */
function getStatistics() {
  const watches = entries.flatMap((entry) => entry.watches);
  const genres = sortedCounts(
    countBy(entries, (entry) => entry.category || 'Uncategorised'),
    (a, b) => b[1] - a[1],
  );
  const years = sortedCounts(
    countBy(watches, (watch) => watchYear(watch) || 'Unknown'),
    (a, b) => b[0].localeCompare(a[0]),
  );
  const ratings = Array.from({ length: 21 }, (_, index) => index * 0.5)
    .map((rating) => [
      rating,
      watches.filter((watch) => Math.round(Number(watch.score) * 2) / 2 === rating).length,
    ]);
  const average = watches.length
    ? (watches.reduce((sum, watch) => sum + Number(watch.score), 0) / watches.length).toFixed(1)
    : '—';
  const mostRewatched = entries.reduce(
    (best, entry) => entry.watches.length > (best?.watches.length || 0) ? entry : best,
    null,
  );

  return { watches, genres, years, ratings, average, mostRewatched };
}

/** Creates one compact statistic card. */
function createSummaryCard(label, value, detail) {
  const card = document.createElement('article');
  card.className = 'stat-highlight';

  const title = document.createElement('small');
  title.textContent = label;
  const result = document.createElement('strong');
  result.textContent = value;
  const description = document.createElement('span');
  description.textContent = detail;

  card.append(title, result, description);
  return card;
}

/** Creates the average rating card and its rating meter. */
function createAverageRatingCard(average, watchCount) {
  const card = document.createElement('article');
  card.className = 'stat-highlight stat-average';

  const title = document.createElement('small');
  title.textContent = 'Average rating';

  const percentage = watchCount ? Math.round(Number(average) * 10) : 0;
  const value = document.createElement('strong');
  value.className = 'stat-rating-value';
  value.textContent = watchCount ? `${percentage}%` : '—';
  if (watchCount) {
    value.classList.add('valueChip', 'ratingValueChip', 'rating-valueChip');
    value.style.setProperty('--rating-color', ratingColorForScore(average));
  }

  const track = document.createElement('div');
  track.className = 'stat-rating-track';
  track.setAttribute('role', 'img');
  track.setAttribute('aria-label', watchCount ? `Average rating ${average} out of 10` : 'No ratings yet');
  track.style.setProperty('--rating-color', ratingColorForScore(average));
  const fill = document.createElement('span');
  fill.style.width = `${percentage}%`;
  track.append(fill);

  const description = document.createElement('span');
  description.textContent = 'across all watches';
  card.append(title, value, track, description);
  return card;
}

/** Creates an interactive chart of watched genres. */
function createGenreChart(genres) {
  const card = document.createElement('article');
  card.className = 'stat-chart stat-pie';
  card.innerHTML = '<h3>Genres</h3>';

  const layout = document.createElement('div');
  layout.className = 'pie-layout';
  const chart = document.createElement('div');
  chart.className = 'genre-chart';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('genre-pie');
  svg.setAttribute('viewBox', '0 0 200 200');
  svg.setAttribute('role', 'group');
  svg.setAttribute('aria-label', 'Interactive genre distribution chart');
  const legend = document.createElement('div');
  legend.className = 'stat-legend';

  const groups = genres.length > STATISTIC_COLORS.length
    ? [...genres.slice(0, STATISTIC_COLORS.length - 1), [
      'Other',
      genres.slice(STATISTIC_COLORS.length - 1).reduce((sum, [, count]) => sum + count, 0),
    ]]
    : genres;
  const total = groups.reduce((sum, [, count]) => sum + count, 0);
  const circumference = 2 * Math.PI * 70;
  const track = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  track.setAttribute('class', 'genre-pie-track');
  track.setAttribute('cx', '100');
  track.setAttribute('cy', '100');
  track.setAttribute('r', '70');
  svg.append(track);

  const center = document.createElement('div');
  center.className = 'genre-pie-center';
  const centerName = document.createElement('strong');
  const centerCount = document.createElement('span');
  center.append(centerName, centerCount);
  let selectedIndex = -1;
  const segments = [];
  const legendItems = [];

  function showGenre(index) {
    if (index < 0) {
      centerName.textContent = total ? 'All genres' : 'No data';
      centerCount.textContent = total ? `${total} titles` : 'Log a title';
      return;
    }
    const [name, count] = groups[index];
    centerName.textContent = name;
    centerCount.textContent = `${count} ${count === 1 ? 'title' : 'titles'} · ${Math.round(count / total * 100)}%`;
  }

  function selectGenre(index) {
    selectedIndex = index;
    segments.forEach((segment, itemIndex) => segment.classList.toggle('is-selected', itemIndex === index));
    legendItems.forEach((item, itemIndex) => item.setAttribute('aria-pressed', String(itemIndex === index)));
    showGenre(index);
  }

  let offset = 0;
  groups.forEach(([name, count], index) => {
    const length = count / (total || 1) * circumference;
    const segment = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    segment.classList.add('genre-segment');
    segment.setAttribute('cx', '100');
    segment.setAttribute('cy', '100');
    segment.setAttribute('r', '70');
    segment.setAttribute('stroke', STATISTIC_COLORS[index]);
    const visibleLength = Math.max(0, length - 3);
    segment.setAttribute('stroke-dasharray', `${visibleLength} ${Math.max(0, circumference - visibleLength)}`);
    segment.setAttribute('stroke-dashoffset', String(-offset));
    segment.setAttribute('transform', 'rotate(-90 100 100)');
    segment.setAttribute('tabindex', '0');
    segment.setAttribute('role', 'button');
    segment.setAttribute('aria-label', `${name}: ${count} ${count === 1 ? 'title' : 'titles'}, ${Math.round(count / total * 100)} percent`);
    segment.addEventListener('mouseenter', () => showGenre(index));
    segment.addEventListener('mouseleave', () => showGenre(selectedIndex));
    segment.addEventListener('focus', () => showGenre(index));
    segment.addEventListener('blur', () => showGenre(selectedIndex));
    segment.addEventListener('click', () => selectGenre(index));
    segment.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        selectGenre(index);
      }
    });
    svg.append(segment);
    segments.push(segment);

    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'stat-legend-item';
    item.setAttribute('aria-pressed', 'false');
    const swatch = document.createElement('i');
    swatch.style.background = STATISTIC_COLORS[index];
    const label = document.createElement('span');
    label.textContent = name;
    const amount = document.createElement('small');
    amount.textContent = String(count);
    item.append(swatch, label, amount);
    item.addEventListener('mouseenter', () => showGenre(index));
    item.addEventListener('mouseleave', () => showGenre(selectedIndex));
    item.addEventListener('focus', () => showGenre(index));
    item.addEventListener('blur', () => showGenre(selectedIndex));
    item.addEventListener('click', () => selectGenre(index));
    legend.append(item);
    legendItems.push(item);
    offset += length;
  });
  showGenre(-1);

  chart.append(svg, center);
  if (groups.length) layout.append(chart, legend);
  else {
    const empty = document.createElement('p');
    empty.className = 'stat-legend-empty';
    empty.textContent = 'Log titles to see your genre breakdown.';
    layout.append(chart, empty);
  }
  card.append(layout);
  return card;
}

/** Creates the distribution chart for logged ratings. */
function createRatingChart(ratings) {
  const card = document.createElement('article');
  card.className = 'stat-chart stat-bars';
  card.innerHTML = '<h3>Rating distribution</h3>';

  const chart = document.createElement('div');
  chart.className = 'rating-distribution';
  const largestCount = Math.max(...ratings.map(([, count]) => count), 1);

  ratings.forEach(([rating, count]) => {
    const heightPercent = count / largestCount * 100;
    const column = document.createElement('div');
    column.className = 'rating-bar';
    column.style.setProperty('--bar-height', `${heightPercent * 1.1}px`);
    const percentage = Math.round(Number(rating) * 10);
    column.setAttribute('aria-label', `${percentage}% rating: ${count} ${count === 1 ? 'watch' : 'watches'}`);
    column.innerHTML = `<small>${count}</small><i><em style="height:${heightPercent}%"></em></i><b>${percentage}%</b>`;
    chart.append(column);
  });

  card.append(chart);
  return card;
}

/** Renders the full statistics panel below the collection. */
function renderStatisticsPanel() {
  renderRecentWatchesTimeline();
  const { watches, genres, years, ratings, average, mostRewatched } = getStatistics();
  const grid = $('#statistics-grid');
  const topGenre = genres[0] || ['—', 0];

  const primarySummaries = document.createElement('div');
  primarySummaries.className = 'stat-summary-stack';
  primarySummaries.append(
    createSummaryCard('Most watched genre', topGenre[0], `${topGenre[1]} titles`),
    createAverageRatingCard(average, watches.length),
  );

  const secondarySummaries = document.createElement('div');
  secondarySummaries.className = 'stat-secondary-stack';
  secondarySummaries.append(
    createSummaryCard(
      'Most rewatched',
      mostRewatched?.title || '—',
      mostRewatched ? `${mostRewatched.watches.length} watches` : 'No rewatches yet',
    ),
    createSummaryCard(
      'Watching years',
      String(years.length),
      years[0]?.[0] || 'Start logging to see trends',
    ),
  );

  const chartStack = document.createElement('div');
  chartStack.className = 'stat-chart-stack';
  chartStack.append(createGenreChart(genres), createRatingChart(ratings));

  grid.replaceChildren(primarySummaries, secondarySummaries, chartStack);
}

/** Renders every logged watch event from oldest to newest, left to right. */
function renderRecentWatchesTimeline() {
  const section = $('#statistics-recent-watches');
  const timeline = $('#statistics-timeline');
  const recentWatches = getWatchHistory();

  section.hidden = recentWatches.length === 0;
  $('#banner').classList.toggle('has-statistics-timeline', recentWatches.length > 0);
  const nodes = recentWatches.map((event, index) => (
    createStatisticsWatch(event, index, false, recentWatches[index + 1])
  ));
  if (recentWatches.length) nodes.push(createStatisticsWatchTotal(recentWatches.length));
  timeline.replaceChildren(...nodes);
  observeStatisticsTimelineEntries(timeline);
  requestAnimationFrame(() => {
    timeline.scrollLeft = timeline.scrollWidth;
    updateStatisticsTimelineEdges(timeline);
    updateStatisticsBackgroundFromTimeline(timeline);
  });
}

/** Shows edge markers while more watch cards remain outside the timeline viewport. */
function updateStatisticsTimelineEdges(timeline) {
  const section = $('#statistics-recent-watches');
  const maxScrollLeft = timeline.scrollWidth - timeline.clientWidth;
  const hasMoreLeft = timeline.scrollLeft > 1;
  const hasMoreRight = maxScrollLeft - timeline.scrollLeft > 1;
  section.classList.toggle('has-more-left', hasMoreLeft);
  section.classList.toggle('has-more-right', hasMoreRight);

  const nodes = [...timeline.querySelectorAll('.statistics-watch-node:not(.statistics-watch-total)')];
  nodes.forEach((node) => node.classList.remove('has-continuation-left', 'has-continuation-right', 'has-cutoff-after'));
  const viewport = timeline.getBoundingClientRect();
  const viewportLeft = viewport.left + timeline.clientLeft;
  const viewportRight = viewportLeft + timeline.clientWidth;
  const visibleNodes = nodes.filter((node) => {
    const marker = node.querySelector('.statistics-watch-marker');
    if (!marker) return false;
    const bounds = marker.getBoundingClientRect();
    const center = bounds.left + bounds.width / 2;
    return center >= viewportLeft && center <= viewportRight;
  });

  if (hasMoreLeft && visibleNodes.length) {
    const firstVisible = visibleNodes[0];
    firstVisible.classList.add('has-continuation-left');
    firstVisible.previousElementSibling?.classList.add('has-cutoff-after');
  }
  if (hasMoreRight && visibleNodes.length) {
    visibleNodes[visibleNodes.length - 1].classList.add('has-continuation-right');
  }
}

/** Reveals watch cards as they enter the horizontal timeline viewport. */
function observeStatisticsTimelineEntries(timeline) {
  statisticsWatchObserver?.disconnect();
  const nodes = timeline.querySelectorAll('.statistics-watch-node');
  if (!('IntersectionObserver' in window)) {
    nodes.forEach((node) => node.classList.add('is-visible'));
    return;
  }

  statisticsWatchObserver = new IntersectionObserver((records) => {
    records.forEach((record) => {
      record.target.classList.toggle('is-visible', record.intersectionRatio >= 0.3);
    });
  }, { root: timeline, threshold: 0.3, rootMargin: '0px -48px' });
  nodes.forEach((node) => statisticsWatchObserver.observe(node));
}

/** Returns every watch event sorted from oldest to newest. */
function getWatchHistory() {
  return entries.flatMap((entry) => (entry.watches || []).map((watch) => ({ entry, watch })))
    .sort((a, b) => statisticsWatchDateKey(a.watch.date).localeCompare(statisticsWatchDateKey(b.watch.date)));
}

/** Normalizes full and partial dates for newest-first sorting. */
function statisticsWatchDateKey(date) {
  const match = String(date || '').match(/^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?/);
  return match ? `${match[1]}-${match[2] || '00'}-${match[3] || '00'}` : '';
}

/** Returns whether a watch is the title's first logged watch. */
function isFirstStatisticsWatch(entry, watch) {
  return watch.kind === 'first' || entry.watches.indexOf(watch) === entry.watches.length - 1;
}

/** Maps a watch ordinal from green through yellow and orange toward red. */
function watchCountColor(watchNumber) {
  const hue = Math.max(0, 140 - (watchNumber - 1) * 35);
  return `hsl(${hue} 72% 64%)`;
}

/** Returns the ordinal number for a watch in its title's history. */
function watchNumberForEntry(entry, watch) {
  return entry.watches.length - entry.watches.indexOf(watch);
}

/** Returns the rating color associated with a watch for the timeline. */
function statisticsWatchColor(entry, watch) {
  return ratingColorForScore(watch.score);
}

/** Creates the timeline endpoint showing the total number of watches. */
function createStatisticsWatchTotal(total, index = null, expanded = false) {
  const item = document.createElement('li');
  item.className = `statistics-watch-node statistics-watch-total${expanded ? ' statistics-full-timeline-node' : ''}`;
  item.style.setProperty('--watch-color', 'var(--blue)');
  if (expanded) {
    const row = Math.floor(index / 6);
    const position = index % 6;
    item.style.gridRow = String(row + 1);
    item.style.gridColumn = String(row % 2 === 0 ? 6 - position : position + 1);
  }

  const box = document.createElement('span');
  box.className = 'statistics-watch-marker statistics-watch-total-box';
  box.setAttribute('role', 'img');
  box.setAttribute('aria-label', `${total} total watches`);
  const count = document.createElement('strong');
  count.textContent = String(total);
  box.append(count);
  item.append(box);
  return item;
}

/** Creates a clickable poster, watch type, date, and timeline marker. */
function createStatisticsWatch({ entry, watch }, index, expanded = false, nextEvent = null) {
  const item = document.createElement('li');
  item.className = `statistics-watch-node ${index % 2 === 0 ? 'is-above' : 'is-below'}${expanded ? ' statistics-full-timeline-node' : ''}`;
  const watchColor = statisticsWatchColor(entry, watch);
  item.style.setProperty('--watch-color', watchColor);
  item.style.setProperty('--next-watch-color', nextEvent
    ? statisticsWatchColor(nextEvent.entry, nextEvent.watch)
    : 'var(--blue)');
  if (expanded) {
    const row = Math.floor(index / 6);
    const position = index % 6;
    item.style.gridRow = String(row + 1);
    item.style.gridColumn = String(row % 2 === 0 ? 6 - position : position + 1);
  }

  const card = document.createElement('button');
  card.className = `statistics-watch-card ${index % 2 ? 'is-bottom-card' : ''}`;
  card.type = 'button';
  card.title = entry.title;
  card.setAttribute('aria-label', `Open ${entry.title}, watched ${formatDate(watch.date)}`);
  card.addEventListener('click', () => {
    const dialog = $('#statistics-timeline-dialog');
    if (dialog.open) dialog.close();
    pendingDetailWatchSelection = {
      entryId: entry.id,
      watchIndex: entry.watches.indexOf(watch),
    };
    location.hash = `#entry/logged/${encodeURIComponent(entry.id)}`;
  });

  if (entry.poster) {
    const image = document.createElement('img');
    image.className = 'statistics-watch-poster';
    image.src = entry.poster;
    image.alt = `${entry.title} poster`;
    image.loading = 'lazy';
    image.decoding = 'async';
    card.append(image);
  } else {
    const placeholder = document.createElement('span');
    placeholder.className = 'statistics-watch-placeholder';
    placeholder.textContent = entry.title;
    card.append(placeholder);
  }

  const approximate = ['approximate', 'approximate-month', 'approximate-date'].includes(watch.precision);
  const firstWatch = isFirstStatisticsWatch(entry, watch);
  const date = document.createElement('time');
  date.className = 'statistics-watch-date';
  date.textContent = `${approximate ? '~' : ''}${formatDate(watch.date)}`;
  if (watch.date) date.dateTime = watch.date;
  const title = document.createElement('span');
  title.className = 'statistics-watch-title';
  title.textContent = entry.title;
  const copy = document.createElement('span');
  copy.className = 'statistics-watch-copy';
  copy.append(date, title);
  card.append(copy);

  const marker = document.createElement('span');
  const watchNumber = watchNumberForEntry(entry, watch);
  marker.className = `statistics-watch-marker ${firstWatch ? 'is-first-watch' : 'is-rewatch'}`;
  marker.textContent = String(watchNumber);
  marker.setAttribute('role', 'img');
  marker.setAttribute('aria-label', `Watch ${watchNumber}`);

  const leftContinuation = document.createElement('span');
  leftContinuation.className = 'statistics-watch-continuation is-left';
  leftContinuation.setAttribute('aria-hidden', 'true');
  const rightContinuation = document.createElement('span');
  rightContinuation.className = 'statistics-watch-continuation is-right';
  rightContinuation.setAttribute('aria-hidden', 'true');

  item.append(card, marker, leftContinuation, rightContinuation);
  return item;
}

/** Builds and draws the expanded serpentine watch timeline. */
function renderExpandedStatisticsTimeline() {
  const timeline = $('#statistics-full-timeline');
  const newestFirst = getWatchHistory().reverse();
  const nodes = newestFirst.map((event, index) => (
    createStatisticsWatch(event, index, true, newestFirst[index + 1])
  ));
  if (newestFirst.length) nodes.push(createStatisticsWatchTotal(newestFirst.length, newestFirst.length, true));
  timeline.replaceChildren(...nodes);
  requestAnimationFrame(drawExpandedStatisticsTimelinePath);
}

/** Draws a rounded path through the expanded timeline's watch markers. */
function drawExpandedStatisticsTimelinePath() {
  const canvas = $('#statistics-full-timeline-canvas');
  const timeline = $('#statistics-full-timeline');
  const svg = $('.statistics-full-timeline-path');
  const bounds = canvas.getBoundingClientRect();
  const width = Math.max(canvas.scrollWidth, bounds.width);
  const height = Math.max(canvas.scrollHeight, bounds.height);
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('width', width);
  svg.setAttribute('height', height);

  const points = [...timeline.querySelectorAll('.statistics-watch-marker')].map((marker) => {
    const markerBounds = marker.getBoundingClientRect();
    return {
      x: markerBounds.left + markerBounds.width / 2 - bounds.left,
      y: markerBounds.top + markerBounds.height / 2 - bounds.top,
      color: getComputedStyle(marker).color,
    };
  });
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  const segments = points.slice(0, -1).map((point, index) => {
    const nextPoint = points[index + 1];
    const gradientId = `statistics-watch-gradient-${index}`;
    const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    gradient.id = gradientId;
    gradient.setAttribute('gradientUnits', 'userSpaceOnUse');
    gradient.setAttribute('x1', point.x);
    gradient.setAttribute('y1', point.y);
    gradient.setAttribute('x2', nextPoint.x);
    gradient.setAttribute('y2', nextPoint.y);
    [[0, point.color], [1, nextPoint.color]].forEach(([offset, color]) => {
      const stop = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
      stop.setAttribute('offset', offset);
      stop.setAttribute('stop-color', color);
      gradient.append(stop);
    });
    defs.append(gradient);

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', `M ${point.x} ${point.y} L ${nextPoint.x} ${nextPoint.y}`);
    path.setAttribute('stroke', `url(#${gradientId})`);
    path.style.setProperty('--watch-color', point.color);
    return path;
  });
  svg.replaceChildren(defs, ...segments);
}

$('#statistics-timeline-expand').addEventListener('click', () => {
  renderExpandedStatisticsTimeline();
  $('#statistics-timeline-dialog').showModal();
});

$('#close-statistics-timeline').addEventListener('click', () => $('#statistics-timeline-dialog').close());
$('#statistics-timeline-dialog').addEventListener('click', (event) => {
  if (event.target === event.currentTarget) event.currentTarget.close();
});
window.addEventListener('resize', () => {
  updateStatisticsTimelineEdges($('#statistics-timeline'));
  if ($('#statistics-timeline-dialog').open) drawExpandedStatisticsTimelinePath();
});
/** Computes and renders library summary statistics and charts. */

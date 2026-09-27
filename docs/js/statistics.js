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
  averageElement.classList.toggle('stats-average-with-meter', watches.length > 0);
  if (watches.length) {
    const fill = `${Number(average) * 10}%`;
    averageElement.append(createRatingMeter(fill, ratingColorForScore(average)));
    averageElement.setAttribute('aria-label', `Average rating ${average} out of 10`);
  } else {
    averageElement.removeAttribute('aria-label');
  }
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
/** Computes and renders library summary statistics and charts. */

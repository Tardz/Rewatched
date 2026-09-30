/** Detail module. */
// Entry preview, full-page view, and watch timeline actions.

/** Displays an OMDb rating in the IMDb badge. */
function showImdbRating(rating) {
  $('#detail-imdb-score').textContent = rating;
  $('#detail-imdb').setAttribute('aria-label', `IMDb rating ${rating}`);
  $('#detail-imdb').hidden = false;
}

/** Fetches movie metadata from OMDb for a title. */
async function requestOmdbTitle(apiKey, entry, includeYear = true) {
  const url = new URL('https://www.omdbapi.com/');
  url.searchParams.set('apikey', apiKey);
  url.searchParams.set('t', entry.title);
  if (includeYear && entry.year) url.searchParams.set('y', entry.year);
  if (entry.type) url.searchParams.set('type', entry.type === 'Show' ? 'series' : 'movie');
  recordOmdbApiCall();
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Request failed (${response.status}).`);
  return response.json();
}

/** Renders the saved OMDb rating for an entry. */
function renderImdbRating(entry) {
  const ratingElement = $('#detail-imdb');
  ratingElement.hidden = true;
  const metadata = entry.metadata;
  if (!metadata?.imdbRating) return;
  const fetched = metadata.fetchedAt ? new Date(metadata.fetchedAt).toLocaleDateString() : '';
  showImdbRating(metadata.imdbRating);
  $('#detail-imdb-fetched').textContent = fetched ? `Fetched ${fetched}` : '';
}

/** Formats a runtime value as hours and minutes. */
function formatRuntime(runtime) {
  const minutes = Number.parseInt(runtime, 10);
  if (!Number.isFinite(minutes) || minutes <= 0) return runtime;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return hours ? `${hours}h ${remainingMinutes}m` : `${remainingMinutes}m`;
}

/** Keeps the plot/actors panel aligned with the entry banner. */
function syncDetailInfoPanelHeight() {
  const panel = $('#detail-actors-panel');
  const hero = $('.detail-hero');
  if (panel.hidden) return;
  const previousAlignSelf = hero.style.alignSelf;
  hero.style.alignSelf = 'start';
  const bannerHeight = hero.getBoundingClientRect().height;
  hero.style.alignSelf = previousAlignSelf;
  if (bannerHeight) panel.style.maxHeight = `${Math.ceil(bannerHeight)}px`;
}

const detailHeroResizeObserver = new ResizeObserver(syncDetailInfoPanelHeight);
detailHeroResizeObserver.observe($('.detail-hero'));

/** Switches between plot and actor information. */
function selectDetailInfoTab(tabName) {
  const actorsAvailable = !$('#detail-actors-tab').hidden;
  const plotAvailable = !$('#detail-plot-tab').hidden;
  const selectedTab = tabName === 'actors' && actorsAvailable
    ? 'actors'
    : plotAvailable ? 'plot' : 'actors';
  const panel = $('#detail-actors-panel');
  const currentTab = document.querySelector('.detail-info-tab.active')?.id === 'detail-plot-tab' ? 'plot' : 'actors';
  const shouldAnimate = selectedTab !== currentTab && !panel.hidden && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const grid = panel.closest('.detail-content-grid');
  const startingColumns = shouldAnimate && grid ? getComputedStyle(grid).gridTemplateColumns : '';
  const originalColumns = grid?.style.gridTemplateColumns || '';

  [['actors', actorsAvailable], ['plot', plotAvailable]].forEach(([name, available]) => {
    const selected = name === selectedTab;
    const tab = $(`#detail-${name}-tab`);
    tab.classList.toggle('active', selected);
    tab.setAttribute('aria-selected', String(selected));
    $(`#detail-${name}-content`).hidden = !selected;
  });

  if (shouldAnimate) {
    if (grid && startingColumns.split(' ').length > 1) {
      window.clearTimeout(grid.infoWidthResetTimer);
      grid.style.gridTemplateColumns = '';
      const targetColumns = getComputedStyle(grid).gridTemplateColumns;
      grid.style.gridTemplateColumns = startingColumns;
      grid.offsetHeight;
      grid.style.transition = 'grid-template-columns 320ms cubic-bezier(.2, .75, .25, 1)';
      grid.style.gridTemplateColumns = targetColumns;
      grid.addEventListener('transitionend', (event) => {
        if (event.propertyName !== 'grid-template-columns') return;
        window.clearTimeout(grid.infoWidthResetTimer);
        grid.style.gridTemplateColumns = originalColumns;
        grid.style.transition = '';
      }, { once: true });
      grid.infoWidthResetTimer = window.setTimeout(() => {
        grid.style.gridTemplateColumns = originalColumns;
        grid.style.transition = '';
      }, 380);
    }

  }
  syncDetailInfoPanelHeight();
}

$('#detail-actors-tab').addEventListener('click', () => selectDetailInfoTab('actors'));
$('#detail-plot-tab').addEventListener('click', () => selectDetailInfoTab('plot'));

/** Deletes a watch record and refreshes the timeline. */
function removeWatch(entry, index) {
  if (!confirm(`Remove this watch from “${entry.title}”?`)) return;
  entry.watches.splice(index, 1);
  if (!entry.watches.length) {
    entries = entries.filter((item) => item.id !== entry.id);
    location.hash = '#library';
  }
  bannerIndex = 0;
  save();
  render();
}

/** Builds one timeline node and its watch details/actions. */
function createTimelineItem(entry, watch, index) {
  const item = document.createElement('li');
  const watchNumber = watchNumberForEntry(entry, watch);
  item.style.setProperty('--watch-color', ratingColorForScore(watch.score));
  const heading = document.createElement('div');
  heading.className = 'timeline-entry-card';
  const title = document.createElement('strong');
  const score = document.createElement('span');
  const date = document.createElement('time');

  const approximate = ['approximate', 'approximate-month', 'approximate-date'].includes(watch.precision);
  const isFirstWatch = index === entry.watches.length - 1;
  title.textContent = isFirstWatch
    ? (approximate ? 'Approximate first watch' : 'First watch')
    : `${approximate ? 'Approximate ' : ''}Rewatch`;
  score.className = 'detail-rating-with-star';
  const scoreFill = `${Number(watch.score) * 10}%`;
  const scoreColor = ratingColorForScore(watch.score);
  const scoreValue = document.createElement('span');
  scoreValue.className = 'rating-value-chip';
  scoreValue.textContent = scoreFill;
  scoreValue.style.setProperty('--rating-color', scoreColor);
  score.append(scoreValue, createRatingMeter(scoreFill, scoreColor, 'rating-meter timeline-rating-meter'));
  score.setAttribute('aria-label', `Rating ${Number(watch.score).toFixed(1)} out of 10`);
  const olderWatch = entry.watches[index + 1];
  if (olderWatch) {
    const delta = Number(watch.score) - Number(olderWatch.score);
    if (delta !== 0) {
      score.classList.add(delta > 0 ? 'rating-improved' : 'rating-declined');
      score.dataset.change = delta > 0 ? '▲' : '▼';
    }
  }
  date.className = 'timeline-date';
  const approximatePrefix = approximate ? '~' : '';
  const formattedDate = formatDate(watch.date);
  const dateWithYear = formattedDate.match(/^(.*\s)(\d{4})$/);
  if (!$('#detail').classList.contains('is-fullscreen') && dateWithYear) {
    date.append(
      document.createTextNode(`${approximatePrefix}${dateWithYear[1]}`),
      document.createElement('br'),
      document.createTextNode(dateWithYear[2]),
    );
  } else {
    date.textContent = `${approximatePrefix}${formattedDate}`;
  }
  if (watch.date) date.dateTime = watch.date;

  const numberMarker = document.createElement('span');
  numberMarker.className = 'statistics-watch-marker detail-watch-number';
  numberMarker.textContent = String(watchNumber);
  numberMarker.setAttribute('role', 'img');
  numberMarker.setAttribute('aria-label', `Watch ${watchNumber}`);

  const actions = document.createElement('div');
  actions.className = 'timeline-actions';
  const edit = iconButton(`Edit watch`, 'Edit', () => openDialog(entry.id, false, index), 'timeline-edit action-edit');
  const remove = iconButton(`Remove watch`, 'Remove', () => removeWatch(entry, index), 'timeline-remove remove-button');
  actions.append(edit, remove);
  const ratingRow = document.createElement('div');
  ratingRow.className = 'timeline-rating-row';
  ratingRow.append(actions, score);
  heading.append(title, ratingRow);
  item.append(numberMarker, date, heading);

  item.tabIndex = 0;
  item.setAttribute('aria-pressed', 'false');
  item.addEventListener('click', (event) => {
    if (event.target.closest('button')) return;
    selectTimelineWatch(entry, index);
  });
  item.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      selectTimelineWatch(entry, index);
    }
  });
  return item;
}

/** Sizes timeline connector lines to fit their content. */
function updateTimelineConnectorLengths() {
  const timeline = $('#detail-timeline');
  timeline.querySelectorAll('.timeline-date').forEach((date) => {
    const item = date.closest('li');
    if (!item) return;
    const card = item.querySelector('.timeline-entry-card');
    const marker = item.querySelector('.detail-watch-number');
    if (!card || !marker) return;

    const itemBounds = item.getBoundingClientRect();
    const dateBounds = date.getBoundingClientRect();
    const cardBounds = card.getBoundingClientRect();
    const markerBounds = marker.getBoundingClientRect();
    const dateLeft = (markerBounds.right + cardBounds.left) / 2
      - itemBounds.left - dateBounds.width / 2;

    item.style.setProperty('--timeline-date-left', `${dateLeft}px`);
    item.style.setProperty('--timeline-date-width', `${dateBounds.width}px`);
    item.style.setProperty('--timeline-card-width', `${cardBounds.width}px`);
    item.style.setProperty('--timeline-marker-right', `${markerBounds.right - itemBounds.left - 1}px`);
  });
  const oldestWatch = timeline.lastElementChild;
  const timelineTop = timeline.getBoundingClientRect().top;
  const totalCount = $('#detail-watch-count');
  const spineTop = totalCount.hidden
    ? -8
    : totalCount.getBoundingClientRect().bottom - timelineTop;
  const spineHeight = oldestWatch
    ? oldestWatch.getBoundingClientRect().top + oldestWatch.getBoundingClientRect().height / 2 - timelineTop
    : 0;
  timeline.style.setProperty('--timeline-spine-top', `${spineTop}px`);
  timeline.style.setProperty('--timeline-spine-height', `${Math.max(0, spineHeight)}px`);
  const lineStart = totalCount.hidden ? timelineTop - 8 : totalCount.getBoundingClientRect().bottom;
  const lineEnd = oldestWatch
    ? oldestWatch.getBoundingClientRect().top + oldestWatch.getBoundingClientRect().height / 2
    : lineStart;
  const lineLength = Math.max(1, lineEnd - lineStart);
  const colorStops = [`var(--blue) 0%`];
  timeline.querySelectorAll('.detail-watch-number').forEach((marker) => {
    const markerBounds = marker.getBoundingClientRect();
    const position = Math.max(0, Math.min(100, ((markerBounds.top + markerBounds.height / 2 - lineStart) / lineLength) * 100));
    colorStops.push(`${getComputedStyle(marker).color} ${position}%`);
  });
  timeline.style.setProperty('--timeline-spine-background', `linear-gradient(to bottom, ${colorStops.join(', ')})`);
}

const timelineResizeObserver = new ResizeObserver(updateTimelineConnectorLengths);
timelineResizeObserver.observe($('#detail-timeline'));

/** Selects a watch record and displays its details. */
function selectTimelineWatch(entry, index) {
  $('#detail').dataset.selectedWatchIndex = String(index);
  document.querySelectorAll('.detail-timeline li').forEach((item, itemIndex) => {
    const selected = itemIndex === index;
    item.classList.toggle('is-selected', selected);
    item.setAttribute('aria-pressed', selected ? 'true' : 'false');
  });
  const panel = $('#timeline-notes-panel');
  panel.replaceChildren();
  const heading = document.createElement('h3');
  heading.textContent = 'Notes';
  const headingRow = document.createElement('div');
  headingRow.className = 'timeline-notes-heading';
  const watch = entry.watches[index];
  let originalNotes = watch.notes || '';
  const editor = document.createElement('div');
  editor.className = 'timeline-notes-editor';
  const content = document.createElement('textarea');
  content.className = 'timeline-notes-input';
  content.setAttribute('aria-label', `Notes for ${formatDate(watch.date)}`);
  content.placeholder = 'Add notes for this watch…';
  content.value = originalNotes;
  const actions = document.createElement('div');
  actions.className = 'timeline-actions timeline-notes-actions';
  actions.hidden = true;

  const saveButton = document.createElement('button');
  saveButton.className = 'timeline-edit timeline-note-save';
  saveButton.type = 'button';
  saveButton.setAttribute('aria-label', 'Save notes');
  saveButton.title = 'Save notes';
  saveButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';

  const discardButton = document.createElement('button');
  discardButton.className = 'timeline-remove timeline-note-discard';
  discardButton.type = 'button';
  discardButton.setAttribute('aria-label', 'Discard note changes');
  discardButton.title = 'Discard changes';
  discardButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>';

  const syncActions = () => {
    actions.hidden = content.value === originalNotes;
  };
  [saveButton, discardButton].forEach((button) => {
    button.addEventListener('mousedown', (event) => event.preventDefault());
  });
  content.addEventListener('focus', syncActions);
  content.addEventListener('input', syncActions);
  content.addEventListener('blur', syncActions);
  content.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (!actions.hidden) saveButton.click();
      return;
    }
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    content.blur();
  });
  saveButton.addEventListener('click', () => {
    content.value = content.value.trim();
    watch.notes = content.value;
    originalNotes = content.value;
    save();
    syncActions();
    content.blur();
  });
  discardButton.addEventListener('click', () => {
    content.value = originalNotes;
    syncActions();
    content.blur();
  });

  actions.append(saveButton, discardButton);
  headingRow.append(heading, actions);
  editor.append(content);
  const contentBox = document.createElement('div');
  contentBox.className = 'timeline-notes-content';
  contentBox.append(editor);
  panel.append(headingRow, contentBox);
}

/** Closes the entry detail view and returns to the collection. */
function hideDetail() {
  const detail = $('#detail');
  document.body.classList.remove('is-detail-view');
  $('.dashboard-layout').classList.remove('is-entry-fullscreen');
  detail.hidden = true;
  detail.classList.remove('is-fullscreen');
  delete detail.dataset.entryId;
  $('#detail-back').hidden = true;
  $('#statistics-panel').hidden = !$('.section-statistics').classList.contains('is-active');
  $('#library').hidden = !$('.section-library').classList.contains('is-active');
  $('.statsbar').hidden = false;
  $('#banner').hidden = entries.length === 0;
}

/** Applies poster-derived colors to the hover detail without changing the page palette. */
function updateDetailPosterPalette(entry) {
  const detail = $('#detail');
  detail.style.removeProperty('--detail-poster-color-one');
  detail.style.removeProperty('--detail-poster-color-two');
  detail.style.removeProperty('--detail-poster-image');
  delete detail.dataset.posterPaletteSource;
  delete detail.dataset.posterPaletteFallback;
  if (!entry.poster) return;

  detail.dataset.posterPaletteSource = entry.poster;
  detail.dataset.posterPaletteFallback = 'image';
  detail.style.setProperty('--detail-poster-image', `url(${JSON.stringify(entry.poster)})`);

  getPosterPalette(entry.poster).then((palette) => {
    if (detail.hidden
        || detail.dataset.entryId !== String(entry.id)
        || detail.dataset.posterPaletteSource !== entry.poster) return;
    if (!palette) return;

    delete detail.dataset.posterPaletteFallback;
    detail.style.setProperty('--detail-poster-color-one', `rgb(${palette.pageOne.join(', ')})`);
    detail.style.setProperty('--detail-poster-color-two', `rgb(${palette.pageTwo.join(', ')})`);
  });
}

/** Renders the entry banner, timeline, notes, and metadata panels. */
function renderDetail() {
  const match = /^#entry\/(logged|watchlist)\/([^/]+)(?:\/(full))?$/.exec(location.hash);
  if (!match) return hideDetail();
  if (typeof closeAppSidebar === 'function') closeAppSidebar();

  const view = match[1];
  const id = decodeURIComponent(match[2]);
  const fullscreen = match[3] === 'full';
  const entry = (view === 'watchlist' ? watchlist : entries).find((item) => item.id === id);
  if (!entry) {
    location.hash = '#library';
    return;
  }

  const detail = $('#detail');
  const sameEntryAlreadyOpen = detail.dataset.entryId === id;
  const previousSelectedIndex = sameEntryAlreadyOpen
    ? Number(detail.dataset.selectedWatchIndex)
    : 0;
  const requestedSelection = pendingDetailWatchSelection?.entryId === id
    ? pendingDetailWatchSelection.watchIndex
    : null;
  if (requestedSelection !== null) pendingDetailWatchSelection = null;
  const selectedWatchIndex = Number.isInteger(requestedSelection)
    ? requestedSelection
    : Number.isInteger(previousSelectedIndex) ? previousSelectedIndex : 0;
  document.body.classList.add('is-detail-view');
  $('.dashboard-layout').classList.toggle('is-entry-fullscreen', fullscreen);
  activeView = view;
  updateViewTabs();
  detail.dataset.entryId = id;
  detail.classList.toggle('is-watchlist', view === 'watchlist');
  detail.classList.toggle('is-fullscreen', fullscreen);
  detail.hidden = false;
  $('#detail-back').hidden = !fullscreen;
  $('#statistics-panel').hidden = fullscreen || !$('.section-statistics').classList.contains('is-active');
  $('#library').hidden = fullscreen || !$('.section-library').classList.contains('is-active');
  $('.statsbar').hidden = fullscreen;
  $('#banner').hidden = fullscreen || entries.length === 0;

  $('#detail-poster').replaceChildren(posterElement(entry, 'detail-poster-art'));
  updateDetailPosterPalette(entry);
  $('#detail-backdrop').hidden = !entry.poster;
  $('.detail-hero').classList.toggle('has-poster', Boolean(entry.poster));
  if (entry.poster) {
    $('#detail-backdrop-image').src = entry.poster;
    if (fullscreen) updateBannerPalette(entry.poster);
  } else {
    $('#detail-backdrop-image').removeAttribute('src');
    if (fullscreen) resetPagePalette();
  }
  $('#detail-kicker').textContent = `${view === 'watchlist' ? 'Watchlist' : 'Library'} · ${entry.type}${entry.year ? ` · ${entry.year}` : ''}`;
  $('#detail-director').textContent = entry.director ? `by ${entry.director}` : '';
  $('#detail-director').hidden = !entry.director;
  const runtime = entry.metadata?.runtime?.trim() || '';
  $('#detail-runtime').textContent = runtime ? formatRuntime(runtime) : '';
  $('#detail-runtime').hidden = !runtime || runtime === 'N/A';
  const actors = entry.metadata?.actors?.split(',').map((name) => name.trim()).filter(Boolean) || [];
  const actorList = $('#detail-actors');
  const actorTags = actors.map((name) => {
    const tag = document.createElement('span');
    tag.className = 'detail-actor-tag';
    tag.textContent = name;
    return tag;
  });
  if (!actors.length) {
    const emptyMessage = document.createElement('p');
    emptyMessage.className = 'detail-info-empty';
    emptyMessage.textContent = 'Cast details has not been saved for this title yet.';
    actorTags.push(emptyMessage);
  }
  actorList.replaceChildren(...actorTags);
  const plot = entry.metadata?.plot?.trim() || '';
  const plotText = $('#detail-plot');
  plotText.textContent = plot || 'Plot has not been saved for this title yet.';
  plotText.classList.toggle('detail-info-empty', !plot);
  $('#detail-actors-tab').hidden = false;
  $('#detail-plot-tab').hidden = false;
  $('#detail-actors-panel').hidden = false;
  selectDetailInfoTab(actors.length ? 'actors' : 'plot');
  renderImdbRating(entry);
  $('#detail-title').textContent = entry.title;
  const latestWatch = view === 'logged' ? latest(entry) : null;
  const detailMeta = $('#detail-meta');
  $('#detail-rating-value').textContent = '';
  $('#detail-latest-date').textContent = '';
  if (latestWatch) {
    const ratingValue = $('#detail-rating-value');
    ratingValue.textContent = `${Number(latestWatch.score) * 10}%`;
    ratingValue.classList.add('rating-value-chip');
    ratingValue.style.setProperty('--rating-color', ratingColorForScore(latestWatch.score));
    $('#detail-latest-date').textContent = `Watched ${formatDate(latestWatch.date)}`;
  }
  detailMeta.hidden = !latestWatch;
  const watchCount = entry.watches?.length || 0;
  $('#detail-watch-count').textContent = String(watchCount);
  $('#detail-watch-count').hidden = view !== 'logged';
  $('#detail-meta').classList.toggle('has-rating', Boolean(latestWatch));
  const oldDetailMeter = detailMeta.querySelector('.detail-meta-meter');
  oldDetailMeter?.remove();
  if (latestWatch) {
    const fill = `${Number(latestWatch.score) * 10}%`;
    const color = ratingColorForScore(latestWatch.score);
    detailMeta.insertBefore(createRatingMeter(fill, color, 'rating-meter detail-meta-meter'), $('#detail-latest-date'));
  }

  const actions = $('#detail-actions');
  actions.replaceChildren();
  actions.hidden = true;
  const fullActions = $('#detail-full-actions');
  fullActions.replaceChildren();
  if (view === 'logged') {
    fullActions.append(iconButton(
      `Log a rewatch for ${entry.title}`,
      'Rewatch',
      () => openDialog(entry.id, true),
      'timeline-rewatch-add action-rewatch',
    ));

    // Anchor the control beside the existing heading without changing its alignment.
    const heading = fullActions.parentElement;
    const titleRect = $('#detail-history-title').getBoundingClientRect();
    const headingRect = heading.getBoundingClientRect();
    fullActions.style.left = `${titleRect.right - headingRect.left + 8}px`;
    fullActions.style.top = `${titleRect.top - headingRect.top}px`;
  }

  const history = $('#detail-history');
  const timeline = $('#detail-timeline');
  timeline.replaceChildren();
  timeline.style.removeProperty('--timeline-spine-top');
  history.hidden = view === 'watchlist';
  detail.querySelector('.detail-note')?.remove();

  if (view === 'watchlist') {
    if (entry.notes) {
      const note = document.createElement('p');
      note.className = 'detail-note';
      note.textContent = entry.notes;
      actions.after(note);
    }
    return;
  }
  entry.watches.forEach((watch, index) => timeline.append(createTimelineItem(entry, watch, index)));
  updateTimelineConnectorLengths();
  if (entry.watches.length) {
    selectTimelineWatch(entry, Math.max(0, Math.min(selectedWatchIndex, entry.watches.length - 1)));
  }
  else $('#timeline-notes-panel').replaceChildren();
}

$('#detail-backdrop-image').addEventListener('error', () => {
  $('#detail-backdrop').hidden = true;
  $('.detail-hero').classList.remove('has-poster');
});

$('#detail-edit-movie').addEventListener('click', () => {
  const entryId = $('#detail').dataset.entryId;
  if (entryId) openDialog(entryId, false, null, true);
});
/** Builds entry detail views, watch timelines, metadata, and detail-page interactions. */

/** Collection module. */
// Collection filtering, cards, view tabs, and entry removal.

let collectionPage = 0;
let collectionPageCount = 1;
let collectionColumnCount = 0;
let folderReturnView = 'logged';
let collectionSwipeDistance = 0;
let collectionSwipeLastEventAt = 0;
let collectionSwipeLocked = false;
let collectionSwipeLockedDirection = 0;
let collectionSwipeReverseDistance = 0;
let collectionSwipeQuietEvents = 0;
let collectionSwipePeakDelta = 0;
let collectionSwipeReversePeakDelta = 0;
let collectionSwipeSettled = false;
let collectionPageDirection = 0;

/** Returns the number of entry-card columns at the current width. */
function getCollectionColumnCount() {
  const columns = getComputedStyle(collection).gridTemplateColumns;
  return columns === 'none' ? 1 : Math.max(1, columns.split(/\s+/).filter(Boolean).length);
}

const folderPicker = $('#library-folder-picker');
const folderList = $('#library-folder-list');
const folderPickerGroup = $('.folder-picker-group');

/** Collapses the folder picker to its compact control. */
function collapseFolderPicker() {
  if (folderPickerGroup.matches(':hover, :focus-within')) return;
  const currentFolder = folderList.querySelector('.is-collapsed-current');
  const previousPositions = new Map(
    [...folderList.children].map((folder) => [folder, folder.getBoundingClientRect().left]),
  );
  if (currentFolder) folderList.prepend(currentFolder);
  folderPicker.classList.add('is-collapsed');
  folderPickerGroup.classList.remove('is-expanded');

  requestAnimationFrame(() => {
    folderList.querySelectorAll('.collection-folder').forEach((folder) => {
      const previousLeft = previousPositions.get(folder);
      if (previousLeft === undefined) return;
      const offset = previousLeft - folder.getBoundingClientRect().left;
      if (Math.abs(offset) < 1) return;
      folder.animate(
        [{ transform: `translateX(${offset}px)` }, { transform: 'translateX(0)' }],
        { duration: 180, easing: 'ease' },
      );
    });
  });
}

/** Expands the folder picker to show available folders. */
function expandFolderPicker() {
  folderPicker.classList.remove('is-collapsed');
  folderPickerGroup.classList.add('is-expanded');
}

folderPickerGroup.addEventListener('pointerenter', expandFolderPicker);
folderPickerGroup.addEventListener('pointerleave', collapseFolderPicker);
folderPickerGroup.addEventListener('focusin', expandFolderPicker);
folderPickerGroup.addEventListener('focusout', collapseFolderPicker);

/** Updates active styling for library and watchlist view controls. */
function updateViewTabs() {
  const folderSelected = activeView === 'logged' && activeCollectionId !== 'all';
  const collapsedView = folderSelected ? folderReturnView : activeView;
  document.querySelectorAll('.library-view-option').forEach((button) => {
    const selected = !folderSelected && button.dataset.view === activeView;
    button.classList.toggle('is-collapsed-current', folderSelected && button.dataset.view === collapsedView);
    button.classList.toggle('active', selected);
    button.setAttribute('aria-selected', selected ? 'true' : 'false');
  });
}

/** Renders collection changes without collapsing its scroll position. */
function renderWithoutScrollCollapse() {
  const currentHeight = collection.getBoundingClientRect().height;
  if (currentHeight) collection.style.minHeight = `${Math.ceil(currentHeight)}px`;
  render();
  requestAnimationFrame(() => {
    collection.style.removeProperty('min-height');
  });
}

/** Renders the selectable list of collections. */
function renderCollectionPicker() {
  const list = $('#library-folder-list');
  const folderPicker = $('#library-folder-picker');
  const selectedView = activeView;
  const preserveOrder = !folderPicker.classList.contains('is-collapsed');
  const previousOrder = [...list.children].map((item) => item.dataset.folderId);
  let folders = [...customCollections];
  const hasSelectedFolder = selectedView === 'logged'
    && folders.some((candidate) => candidate.id === activeCollectionId);

  if (preserveOrder && previousOrder.length) {
    const positions = new Map(previousOrder.map((id, index) => [id, index]));
    folders.sort((a, b) => (positions.get(a.id) ?? Infinity) - (positions.get(b.id) ?? Infinity));
  } else {
    const collapsedFolderId = hasSelectedFolder ? activeCollectionId : folders[0]?.id;
    folders.sort((a, b) => Number(b.id === collapsedFolderId) - Number(a.id === collapsedFolderId));
  }

  list.replaceChildren();

  folderPicker.hidden = folders.length === 0;
  if (!folders.length) return;

  folders.forEach((folder, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'collection-tab';
    button.textContent = folder.name;
    const selected = selectedView === 'logged' && activeCollectionId === folder.id;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-pressed', selected ? 'true' : 'false');
    button.setAttribute('aria-label', `Open ${folder.name} folder`);
    button.addEventListener('click', () => {
      selectCollection(folder.id);
    });
    const item = document.createElement('div');
    item.className = 'collection-folder';
    item.dataset.folderId = folder.id;
    item.setAttribute('role', 'listitem');
    item.classList.toggle('is-collapsed-current', selected || (!hasSelectedFolder && index === 0));
    item.append(button);
    list.append(item);
  });
}

/** Preserves control order during expansion, then applies the compact order. */
function keepControlOrderUntilCollapsed(group, buttonSelector) {
  let releaseOrderTimer;

  const buttons = () => [...group.querySelectorAll(buttonSelector)];
  const lockOrder = () => {
    clearTimeout(releaseOrderTimer);
    buttons().forEach((button) => {
      button.style.order = getComputedStyle(button).order;
    });
  };
  const releaseOrderAfterCollapse = () => {
    clearTimeout(releaseOrderTimer);
    releaseOrderTimer = setTimeout(() => {
      if (group.matches(':hover, :focus-within')) return;
      buttons().forEach((button) => button.style.removeProperty('order'));
    }, 200);
  };

  group.addEventListener('pointerenter', lockOrder);
  group.addEventListener('pointerleave', releaseOrderAfterCollapse);
  group.addEventListener('focusin', lockOrder);
  group.addEventListener('focusout', releaseOrderAfterCollapse);
}

keepControlOrderUntilCollapsed(document.querySelector('.library-view-switcher'), '.library-view-option');
keepControlOrderUntilCollapsed($('#media-type-filters'), '.media-type-filter');

/** Selects a library or folder and refreshes the collection view. */
function selectCollection(collectionId) {
  if (activeCollectionId === 'all' || activeView === 'watchlist') folderReturnView = activeView;
  activeCollectionId = collectionId;
  activeView = 'logged';
  collectionPage = 0;
  updateViewTabs();
  renderWithoutScrollCollapse();
}

/** Deletes a folder and removes its ID from entries. */
function deleteCollection(folder) {
  if (!confirm(`Delete the “${folder.name}” collection? Its titles will remain in Library.`)) return;
  customCollections = customCollections.filter((item) => item.id !== folder.id);
  [entries, watchlist].forEach((items) => {
    items.forEach((entry) => {
      const collectionIds = entryCollectionIds(entry).filter((id) => id !== folder.id);
      if (collectionIds.length) entry.collectionIds = collectionIds;
      else delete entry.collectionIds;
      delete entry.collectionId;
    });
  });
  if (activeCollectionId === folder.id) activeCollectionId = 'all';
  save();
  render();
}

/** Starts the create-folder flow. */
function createCollection() {
  const collectionDialog = $('#collection-dialog');
  const nameInput = $('#collection-name');
  if (collectionDialog && nameInput) {
    nameInput.value = '';
    collectionDialog.showModal();
    nameInput.focus();
    return;
  }
  const name = window.prompt('Name this collection:')?.trim();
  finishCreateCollection(name);
}

/** Validates and creates a folder from the entered name. */
function finishCreateCollection(name) {
  name = name?.trim();
  if (!name) return;
  const existing = customCollections.find((folder) => folder.name.toLocaleLowerCase() === name.toLocaleLowerCase());
  if (existing) activeCollectionId = existing.id;
  else {
    const folder = { id: crypto.randomUUID(), name };
    customCollections.push(folder);
    activeCollectionId = folder.id;
    save();
  }
  activeView = 'logged';
  updateViewTabs();
  render();
}

let folderPickerEntry = null;

/** Opens the folder assignment picker for an entry. */
function openFolderPicker(entry) {
  folderPickerEntry = entry;
  const popover = $('#folder-popover');
  const list = $('#folder-popover-list');
  list.replaceChildren();
  if (!customCollections.length) {
    const empty = document.createElement('p');
    empty.textContent = 'Create a collection above the library first.';
    list.append(empty);
  } else {
    const selectedIds = entryCollectionIds(entry);
    customCollections.forEach((folder) => {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.value = folder.id;
      input.checked = selectedIds.includes(folder.id);
      input.addEventListener('change', saveFolderPickerSelection);
      label.append(input, document.createTextNode(folder.name));
      list.append(label);
    });
  }
  const button = document.activeElement;
  const rect = button.getBoundingClientRect();
  popover.hidden = false;
  popover.style.left = `${Math.min(rect.left, window.innerWidth - popover.offsetWidth - 12)}px`;
  popover.style.top = `${rect.bottom + 8}px`;
}

/** Saves the selected folder assignments for the entry. */
function saveFolderPickerSelection() {
  if (!folderPickerEntry) return;
  folderPickerEntry.collectionIds = [...document.querySelectorAll('#folder-popover-list input:checked')].map((input) => input.value);
  delete folderPickerEntry.collectionId;
  save();
}

/** Closes the folder assignment picker. */
function closeFolderPicker() {
  $('#folder-popover').hidden = true;
  folderPickerEntry = null;
}

document.addEventListener('click', (event) => {
  if (folderPickerEntry && !event.target.closest('.folder-popover') && !event.target.closest('.action-folder')) closeFolderPicker();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && folderPickerEntry) closeFolderPicker();
});

$('#collection-form')?.addEventListener('submit', (event) => {
  if (event.submitter?.value !== 'create') return;
  event.preventDefault();
  const dialog = $('#collection-dialog');
  finishCreateCollection($('#collection-name').value);
  dialog.close();
});

/** Removes an entry from the library or watchlist. */
function removeEntry(entry, isWatchlist) {
  if (!confirm(`Remove “${entry.title}”?`)) return;

  if (isWatchlist) watchlist = watchlist.filter((item) => item.id !== entry.id);
  else {
    entries = entries.filter((item) => item.id !== entry.id);
    bannerIndex = 0;
  }
  save();
  render();
}

/** Checks whether an entry matches the current search query. */
function matchesCollectionSearch(entry, query) {
  if (activeFilter !== 'all' && entry.type !== activeFilter) return false;
  if (!query) return true;

  return [
    entry.title,
    entry.type,
    entry.category,
    entry.year,
    entry.notes,
    ...(entry.watches || []).map((watch) => watch.notes),
  ].join(' ').toLocaleLowerCase().includes(query);
}

/** Refreshes filter and sort controls for the active collection. */
function updateCollectionTools(isWatchlist) {
  document.querySelectorAll('.logged-collection-tool').forEach((control) => {
    control.hidden = isWatchlist;
  });

  const yearSelect = $('#watched-year-filter');
  const availableYears = [...new Set(entries.flatMap((entry) => entry.watches.map(watchYear)).filter(Boolean))]
    .sort((a, b) => Number(b) - Number(a));
  yearSelect.replaceChildren(new Option('All years', 'all'));
  availableYears.forEach((year) => yearSelect.add(new Option(year, year)));
  if (!availableYears.includes(watchedYearFilter)) watchedYearFilter = 'all';
  yearSelect.value = watchedYearFilter;
  yearSelect.classList.toggle('active', watchedYearFilter !== 'all');
  $('#rating-filter').value = ratingFilter;
  $('#rating-filter').classList.toggle('active', ratingFilter !== 'all');

  const sortSelect = $('#collection-sort');
  const choices = isWatchlist
    ? [['priority-desc', 'Priority ↓'], ['recent', 'Recent'], ['title-asc', 'Title A–Z'], ['release-desc', 'Release ↓']]
    : [['watched-desc', 'Watched ↓'], ['recent', 'Recent'], ['rating-desc', 'Rating ↓'], ['rating-asc', 'Rating ↑'], ['title-asc', 'Title A–Z'], ['release-desc', 'Release ↓']];
  if (!choices.some(([value]) => value === collectionSort)) {
    collectionSort = isWatchlist ? 'priority-desc' : 'watched-desc';
  }
  sortSelect.replaceChildren(...choices.map(([value, label]) => new Option(label, value)));
  sortSelect.value = collectionSort;
  const defaultSort = isWatchlist ? 'priority-desc' : 'watched-desc';
  sortSelect.classList.toggle('active', collectionSort !== defaultSort);
}

/** Checks whether an entry passes the active collection filters. */
function matchesCollectionFilters(entry, isWatchlist) {
  if (isWatchlist) return true;
  if (activeCollectionId !== 'all' && !entryCollectionIds(entry).includes(activeCollectionId)) return false;
  if (watchedYearFilter !== 'all' && !entry.watches.some((watch) => watchYear(watch) === watchedYearFilter)) return false;
  if (ratingFilter !== 'all' && Number(latest(entry).score) < Number(ratingFilter)) return false;
  return true;
}

/** Sorts collection entries using the active sort option. */
function sortCollectionItems(items, isWatchlist) {
  return items.map((entry, index) => ({ entry, index })).sort((left, right) => {
    const a = left.entry;
    const b = right.entry;
    if (collectionSort === 'title-asc') return a.title.localeCompare(b.title);
    if (collectionSort === 'release-desc') return Number(b.year || 0) - Number(a.year || 0);
    if (collectionSort === 'priority-desc') return Number(b.priority || 3) - Number(a.priority || 3) || left.index - right.index;
    if (!isWatchlist && collectionSort === 'rating-desc') return Number(latest(b).score) - Number(latest(a).score);
    if (!isWatchlist && collectionSort === 'rating-asc') return Number(latest(a).score) - Number(latest(b).score);
    if (!isWatchlist && collectionSort === 'watched-desc') {
      const newestDate = (entry) => entry.watches.map((watch) => watch.date || '').sort().at(-1) || '';
      return newestDate(b).localeCompare(newestDate(a));
    }
    return left.index - right.index;
  }).map(({ entry }) => entry);
}

/** Updates page controls and counts for the visible collection. */
function updateCollectionPagination(totalItems, pageSize) {
  collectionPageCount = Math.max(1, Math.ceil(totalItems / pageSize));
  collectionPage = Math.min(collectionPage, collectionPageCount - 1);

  const pagination = $('#collection-pagination');
  pagination.hidden = false;
  $('#collection-page-status').textContent = `${collectionPage + 1} / ${collectionPageCount}`;
  $('#collection-page-previous').disabled = collectionPage === 0;
  $('#collection-page-next').disabled = collectionPage >= collectionPageCount - 1;
}

/** Moves the collection to an adjacent page. */
function changeCollectionPage(direction) {
  const nextPage = Math.max(0, Math.min(collectionPage + direction, collectionPageCount - 1));
  if (nextPage === collectionPage) return false;
  collectionPageDirection = direction;
  collectionPage = nextPage;
  renderCollection();
  return true;
}

/** Recalculates collection layout and paging after a resize. */
function handleCollectionResize() {
  const columns = getCollectionColumnCount();
  if (!collectionColumnCount) {
    collectionColumnCount = columns;
    return;
  }
  if (columns === collectionColumnCount) return;

  collectionColumnCount = columns;
  collectionPage = 0;
  const pageScroll = collection.scrollTop;
  const documentScroll = window.scrollY;
  renderCollection();
  requestAnimationFrame(() => {
    collection.scrollTop = pageScroll;
    window.scrollTo(0, documentScroll);
  });
}

/** Builds the card markup and actions for one entry. */
function createEntryCard(entry, isWatchlist) {
  const watch = isWatchlist ? null : latest(entry);
  const card = document.createElement('article');
  card.className = `entry${isWatchlist ? ' is-watchlist' : ''}`;

  const link = document.createElement('a');
  link.className = 'entry-link';
  link.href = `#entry/${activeView}/${encodeURIComponent(entry.id)}`;
  link.setAttribute('aria-label', `Open ${entry.title} details`);
  link.addEventListener('click', (event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    openEntryFromCard(card, link.href);
  });
  card.append(link, posterElement(entry, 'entry-poster'));

  const info = document.createElement('div');
  info.className = 'entry-info';
  const header = document.createElement('div');
  header.className = 'entry-header';
  const details = document.createElement('div');
  details.className = 'entry-details';

  const tag = document.createElement('span');
  tag.className = 'entry-tag';
  if (entry.category && entry.category.toLowerCase() !== entry.type.toLowerCase()) {
    tag.textContent = entry.category;
    let categoryHash = 0;
    for (const character of entry.category.toLocaleLowerCase()) {
      categoryHash = (categoryHash * 31 + character.codePointAt(0)) % 360;
    }
    tag.style.setProperty('--category-hue', categoryHash);
  }
  else {
    tag.classList.add('entry-tag-placeholder');
    tag.setAttribute('aria-hidden', 'true');
    tag.textContent = 'Genre';
  }

  const title = document.createElement('h3');
  title.textContent = entry.title;
  const type = document.createElement('div');
  type.className = 'entry-type';
  type.append(Object.assign(document.createElement('span'), { textContent: entry.type }));
  if (entry.year) {
    const year = document.createElement('span');
    year.className = 'entry-year';
    year.textContent = entry.year;
    type.append(year);
  }
  header.append(tag, title, type);

  if (watch) {
    const score = document.createElement('div');
    score.className = 'entry-score entry-rating-with-star';
    const scoreFill = `${Number(watch.score) * 10}%`;
    const scoreColor = ratingColorForScore(watch.score);
    score.append(document.createTextNode(scoreFill), createRatingMeter(scoreFill, scoreColor));
    score.setAttribute('aria-label', `Rating ${Number(watch.score).toFixed(1)} out of 10`);
    const date = document.createElement('div');
    date.className = 'entry-date';
    const approximate = watch.precision === 'approximate' || watch.precision === 'approximate-month';
    const watchLabel = entry.watches.length > 1
      ? `${approximate ? 'Approximate ' : ''}Rewatch`
      : `${approximate ? 'Approximate ' : ''}First watch`;
    date.textContent = `${watchLabel} · ${formatDate(watch.date)}`;
    details.append(score, date);
  } else if (isWatchlist) {
    const priority = Math.min(5, Math.max(1, Number(entry.priority) || 3));
    const indicator = document.createElement('div');
    indicator.className = 'entry-priority';
    indicator.dataset.priority = priority;
    indicator.setAttribute('aria-label', `Priority ${priority} out of 5`);
    for (let dot = 1; dot <= 5; dot++) {
      const marker = document.createElement('span');
      marker.classList.toggle('is-filled', dot <= priority);
      indicator.append(marker);
    }
    details.append(indicator);
  }

  const actions = document.createElement('div');
  actions.className = 'entry-actions';
  const actionList = isWatchlist
    ? [['Edit', () => openDialog(entry.id, false, null, true)], ['Remove', () => removeEntry(entry, true)]]
    : [['Rewatch', () => openDialog(entry.id, true)], ['Edit', () => openDialog(entry.id, false, null, true)], ['Folder', () => openFolderPicker(entry)], ['Remove', () => removeEntry(entry, false)]];

  actionList.forEach(([label, action]) => {
    const buttonLabel = label === 'Folder' ? `Add ${entry.title} to folder` : `${label} ${entry.title}`;
    const button = iconButton(buttonLabel, label, action, `action-${label.toLowerCase()}`);
    if (label === 'Remove') button.classList.add('remove-button');
    actions.append(button);
  });

  info.append(header, details);
  const tools = document.createElement('div');
  tools.className = 'entry-card-tools';
  tools.append(actions, iconButton(
    `Open ${entry.title} fullscreen`,
    'Fullscreen',
    () => openEntryFromCard(card, `#entry/${activeView}/${encodeURIComponent(entry.id)}/full`),
    'entry-open-fullscreen',
  ));
  card.append(info, tools);
  return card;
}

/** Opens a card’s entry in hover or fullscreen mode. */
function openEntryFromCard(card, destination) {
  if (card.classList.contains('is-opening')) return;
  const hash = destination.startsWith('#') ? destination : new URL(destination).hash;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    location.hash = hash;
    return;
  }
  card.classList.add('is-opening');
  window.setTimeout(() => {
    card.classList.remove('is-opening');
    location.hash = hash;
  }, 60);
}

/** Filters, sorts, pages, and renders the active collection. */
function renderCollection() {
  $('#library').hidden = false;
  collection.replaceChildren();
  const isWatchlist = activeView === 'watchlist';
  renderCollectionPicker();
  updateCollectionTools(isWatchlist);
  const items = isWatchlist ? watchlist : entries;
  const query = $('#library-search').value.trim().toLocaleLowerCase();
  const shown = sortCollectionItems(
    items.filter((entry) => matchesCollectionSearch(entry, query) && matchesCollectionFilters(entry, isWatchlist)),
    isWatchlist,
  );
  const watchlistEmpty = $('#watchlist-empty');
  const empty = $('#empty');

  $('#open-add').setAttribute('aria-label', isWatchlist ? 'Add to watchlist' : 'Log a watch');
  watchlistEmpty.hidden = !isWatchlist || items.length > 0 || Boolean(query) || activeFilter !== 'all';
  empty.hidden = shown.length > 0 || !watchlistEmpty.hidden;
  const hasCollectionFilter = !isWatchlist && (watchedYearFilter !== 'all' || ratingFilter !== 'all');
  if (query || hasCollectionFilter) {
    empty.textContent = 'No titles match your search or filters.';
  } else if (items.length) {
    empty.textContent = 'No titles match this filter.';
  } else if (isWatchlist) {
    empty.textContent = 'Nothing on your watchlist yet.';
  } else {
    empty.textContent = 'Nothing here yet. Log the first thing you watched.';
  }

  const columns = getCollectionColumnCount();
  collectionColumnCount = columns;
  const pageSize = columns * 4;
  updateCollectionPagination(shown.length, pageSize);
  const pageStart = collectionPage * pageSize;
  shown.slice(pageStart, pageStart + pageSize)
    .forEach((entry) => collection.append(createEntryCard(entry, isWatchlist)));

  collection.classList.remove('page-enter-forward', 'page-enter-backward');
  if (collectionPageDirection && collectionPageCount > 1) {
    void collection.offsetWidth;
    collection.classList.add(collectionPageDirection > 0 ? 'page-enter-forward' : 'page-enter-backward');
    collection.onanimationend = (event) => {
      if (!event.animationName.startsWith('collection-page-')) return;
      collection.classList.remove('page-enter-forward', 'page-enter-backward');
    };
  }
  collectionPageDirection = 0;

  requestAnimationFrame(() => {
    // A second pass accounts for fonts and images changing card dimensions.
    requestAnimationFrame(() => collectionColumnCount = getCollectionColumnCount());
  });
}

// Listen on the whole library card so trackpad swipes work over the toolbar and cards.
$('#library').addEventListener('wheel', (event) => {
  if (event.target.closest('.library-folder-list')) return;
  if (collectionPageCount < 2) return;

  const now = performance.now();
  if (now - collectionSwipeLastEventAt > 140) {
    collectionSwipeDistance = 0;
    collectionSwipeLocked = false;
    collectionSwipeLockedDirection = 0;
    collectionSwipeReverseDistance = 0;
    collectionSwipeQuietEvents = 0;
    collectionSwipePeakDelta = 0;
    collectionSwipeReversePeakDelta = 0;
    collectionSwipeSettled = false;
  }
  collectionSwipeLastEventAt = now;

  const horizontalDelta = event.shiftKey && Math.abs(event.deltaX) < 1
    ? event.deltaY
    : event.deltaX;
  const verticalDelta = event.shiftKey ? 0 : event.deltaY;
  const horizontalMagnitude = Math.abs(horizontalDelta);
  if (collectionSwipeLocked
    && Math.abs(verticalDelta) < 8
    && horizontalMagnitude <= Math.max(6, collectionSwipePeakDelta * 0.2)) {
    collectionSwipeDistance = 0;
    collectionSwipeReverseDistance = 0;
    collectionSwipeQuietEvents++;
    if (collectionSwipeQuietEvents >= 3) collectionSwipeSettled = true;
    return;
  }
  collectionSwipeQuietEvents = 0;

  if (Math.abs(horizontalDelta) < 2 || Math.abs(horizontalDelta) < Math.abs(verticalDelta) * 0.72) {
    collectionSwipeDistance = 0;
    return;
  }

  const swipeDirection = Math.sign(horizontalDelta);
  if (collectionSwipeLocked) {
    event.preventDefault();
    if (swipeDirection === collectionSwipeLockedDirection) {
      collectionSwipeReverseDistance = 0;
      collectionSwipeReversePeakDelta = 0;
      // A new, deliberate same-direction swipe has a fresh strong delta after
      // the previous gesture's momentum has tapered off. Re-arm on that
      // rebound, rather than requiring pointer movement or a long idle pause.
      if (!collectionSwipeSettled
        || horizontalMagnitude < Math.max(18, collectionSwipePeakDelta * 0.75)) return;
      collectionSwipeLocked = false;
      collectionSwipeLockedDirection = 0;
      collectionSwipeDistance = 0;
      collectionSwipePeakDelta = horizontalMagnitude;
      collectionSwipeReversePeakDelta = 0;
      collectionSwipeSettled = false;
    } else {
      // Only treat a direction change as a new swipe once it has its own
      // threshold-sized movement, so trackpad momentum wobble cannot skip pages.
      collectionSwipeReverseDistance += horizontalDelta;
      collectionSwipeReversePeakDelta = Math.max(collectionSwipeReversePeakDelta, horizontalMagnitude);
      if (Math.abs(collectionSwipeReverseDistance) < 52) return;

      const reverseDirection = Math.sign(collectionSwipeReverseDistance);
      changeCollectionPage(reverseDirection);
      collectionSwipeLockedDirection = reverseDirection;
      collectionSwipeReverseDistance = 0;
      collectionSwipePeakDelta = collectionSwipeReversePeakDelta;
      collectionSwipeReversePeakDelta = 0;
      collectionSwipeSettled = false;
      return;
    }
  }

  collectionSwipeDistance += horizontalDelta;
  collectionSwipePeakDelta = Math.max(collectionSwipePeakDelta, horizontalMagnitude);
  if (Math.abs(collectionSwipeDistance) < 52) return;

  const direction = Math.sign(collectionSwipeDistance);
  const changedPage = changeCollectionPage(direction);
  collectionSwipeDistance = 0;
  collectionSwipeLocked = true;
  collectionSwipeLockedDirection = direction;
  collectionSwipeReverseDistance = 0;
  collectionSwipeQuietEvents = 0;
  collectionSwipeReversePeakDelta = 0;
  collectionSwipeSettled = false;
  if (changedPage) event.preventDefault();
}, { passive: false });
/** Manages library and folder controls, collection filtering, paging, and entry cards. */

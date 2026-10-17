/** Collection module. */
// Collection filtering, cards, view tabs, and entry removal.

let collectionPage = 0;
let collectionPageCount = 1;
let collectionColumnCount = 0;
let collectionViewportWidth = 0;
const collectionRowsPerPage = 4;
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
const isReworkedCollection = document.documentElement.dataset.cssReworkPreview === 'true';

/** Returns the number of entry-card columns at the current width. */
function getCollectionColumnCount() {
  if (isReworkedCollection) {
    return Number.parseInt(getComputedStyle(collection).getPropertyValue('--workspace-entry-columns'), 10) || 1;
  }
  const columns = getComputedStyle(collection).gridTemplateColumns;
  return columns === 'none' ? 1 : Math.max(1, columns.split(/\s+/).filter(Boolean).length);
}

// The desktop entry point still uses the legacy folder markup while the
// isolated CSS preview uses the shared menu markup.
const folderDropdown = $('.folder-menu-wrapper, #library-folder-dropdown');
const folderPicker = folderDropdown?.querySelector('.menu-container, #library-folder-picker');
const folderList = folderPicker?.querySelector('[data-menu-options], #library-folder-list');
const folderButton = $('#library-folder-button');

/** Opens or closes the library folder menu. */
function setFolderMenuOpen(isOpen) {
  if (!folderPicker || !folderButton) return;
  folderPicker.hidden = !isOpen;
  folderDropdown?.classList.toggle('is-open', isOpen);
  folderButton.setAttribute('aria-expanded', String(isOpen));
  $('#nav-folder-button')?.setAttribute('aria-expanded', String(isOpen));
}

folderButton?.addEventListener('click', () => setFolderMenuOpen(folderPicker.hidden));

document.addEventListener('click', (event) => {
  if (!folderDropdown.contains(event.target)) setFolderMenuOpen(false);
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || !folderPicker || folderPicker.hidden) return;
  event.preventDefault();
  setFolderMenuOpen(false);
  folderButton?.focus();
});

const workspaceFilterMenuSelector = '.workspace-value-filter-wrapper, .workspace-year-filter-wrapper, .workspace-sort-wrapper';
const workspaceFilterMenus = [...document.querySelectorAll(workspaceFilterMenuSelector)];

function getWorkspaceFilterButton(wrapper) {
  return wrapper.querySelector(':scope > button, :scope > .workspace-sort-control > .workspace-sort-trigger');
}

/** Opens one workspace filter menu and closes the others. */
function setWorkspaceFilterMenuOpen(wrapper, isOpen) {
  const menu = wrapper.querySelector('.menu-container');
  const trigger = getWorkspaceFilterButton(wrapper);
  menu.hidden = !isOpen;
  wrapper.classList.toggle('is-open', isOpen);
  trigger.setAttribute('aria-expanded', String(isOpen));
}

function closeWorkspaceFilterMenus() {
  workspaceFilterMenus.forEach((wrapper) => setWorkspaceFilterMenuOpen(wrapper, false));
}

workspaceFilterMenus.forEach((wrapper) => {
  const trigger = getWorkspaceFilterButton(wrapper);
  const select = wrapper.querySelector('select');
  const resetButton = wrapper.querySelector('.workspace-filter-reset-button, .workspace-sort-reset-button');

  select.addEventListener('change', () => {
    if (select.id === 'collection-value-filter') {
      const selectedValues = [...select.selectedOptions].map((option) => Number(option.value));
      if (activeCollectionView === 'watchlist') priorityFilter = selectedValues;
      else ratingFilter = selectedValues;
    }
    if (select.id === 'watched-year-filter') {
      watchedYearFilter = [...select.selectedOptions].map((option) => option.value);
    }
    collectionPage = 0;
    renderCollection();
  });

  trigger.addEventListener('click', () => {
    const willOpen = wrapper.querySelector('.menu-container').hidden;
    closeWorkspaceFilterMenus();
    setWorkspaceFilterMenuOpen(wrapper, willOpen);
  });

  trigger.addEventListener('keydown', (event) => {
    if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
    event.preventDefault();
    closeWorkspaceFilterMenus();
    setWorkspaceFilterMenuOpen(wrapper, true);
    const options = [...wrapper.querySelectorAll('.menu-option')];
    const selectedOption = options.find((option) => option.classList.contains('active'));
    (selectedOption || (event.key === 'ArrowDown' ? options[0] : options[options.length - 1]))?.focus();
  });

  resetButton?.addEventListener('click', (event) => {
    event.stopPropagation();
    if (wrapper.classList.contains('workspace-sort-wrapper')) {
      collectionSort = activeCollectionView === 'watchlist' ? 'priority-desc' : 'watched-desc';
    } else {
      [...select.options].forEach((option) => { option.selected = false; });
      if (select.id === 'collection-value-filter') {
        if (activeCollectionView === 'watchlist') priorityFilter = [];
        else ratingFilter = [];
      }
      if (select.id === 'watched-year-filter') watchedYearFilter = [];
    }
    collectionPage = 0;
    renderCollection();
    setWorkspaceFilterMenuOpen(wrapper, true);
    resetButton.focus();
  });

  wrapper.addEventListener('click', (event) => {
    const option = event.target.closest('.menu-option');
    if (!option || !wrapper.contains(option)) return;
    event.stopPropagation();
    if (wrapper.classList.contains('workspace-sort-wrapper')) {
      collectionSort = option.dataset.filterValue;
      collectionPage = 0;
      renderCollection();
      setWorkspaceFilterMenuOpen(wrapper, true);
      wrapper.querySelector('.menu-option.active')?.focus();
      return;
    }
    const isMultiSelect = select.multiple;
    if (!isMultiSelect) setWorkspaceFilterMenuOpen(wrapper, false);
    if (isMultiSelect) {
      const matchingOption = [...select.options].find((item) => item.value === option.dataset.filterValue);
      if (matchingOption) matchingOption.selected = !matchingOption.selected;
    } else {
      select.value = option.dataset.filterValue;
    }
    select.dispatchEvent(new Event('change', { bubbles: true }));
    if (isMultiSelect) {
      setWorkspaceFilterMenuOpen(wrapper, true);
      [...wrapper.querySelectorAll('.menu-option')]
        .find((item) => item.dataset.filterValue === option.dataset.filterValue)
        ?.focus();
    } else {
      trigger.focus();
    }
  });
});

const sortDirectionButton = $('.workspace-sort-wrapper .workspace-direction-button');
sortDirectionButton?.addEventListener('click', (event) => {
  event.stopPropagation();
  const [sortKey, direction] = collectionSort.split('-');
  if (!['watched', 'recent', 'rating', 'priority', 'title', 'release'].includes(sortKey)) return;
  const sortWrapper = sortDirectionButton.closest('.workspace-sort-wrapper');
  const wasMenuOpen = !sortWrapper.querySelector('.menu-container').hidden;
  collectionSort = `${sortKey}-${direction === 'desc' ? 'asc' : 'desc'}`;
  collectionPage = 0;
  renderCollection();
  if (wasMenuOpen) setWorkspaceFilterMenuOpen(sortWrapper, true);
  sortDirectionButton.focus();
});

const resetCollectionFiltersButton = $('#reset-collection-filter-sort');
resetCollectionFiltersButton?.addEventListener('click', () => {
  activeFilter = 'all';
  watchedYearFilter = [];
  ratingFilter = [];
  priorityFilter = [];
  collectionSort = activeCollectionView === 'watchlist' ? 'priority-desc' : 'watched-desc';
  document.querySelectorAll('#media-type-filters .type-switch-option, #media-type-filters .media-type-filter').forEach((button) => {
    button.classList.toggle('active', button.dataset.filter === 'all');
  });
  collectionPage = 0;
  renderCollection();
});

document.addEventListener('click', (event) => {
  if (!event.target.closest(workspaceFilterMenuSelector)) closeWorkspaceFilterMenus();
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  const openMenu = workspaceFilterMenus.find((wrapper) => !wrapper.querySelector('.menu-container').hidden);
  if (!openMenu) return;
  event.preventDefault();
  setWorkspaceFilterMenuOpen(openMenu, false);
  getWorkspaceFilterButton(openMenu).focus();
});

/** Mirrors a native select's options and value into its reworked menu. */
function syncWorkspaceFilterMenu(select) {
  const wrapper = select.closest(workspaceFilterMenuSelector);
  if (!wrapper) return;

  const trigger = getWorkspaceFilterButton(wrapper);
  const menu = wrapper.querySelector('.menu-container');
  const triggerLabel = trigger.querySelector('.menu-button-label');
  const directionButton = wrapper.querySelector('.workspace-direction-button');
  const optionsContainer = wrapper.querySelector('[data-menu-options]');
  const selectedOptions = [...select.selectedOptions];
  const selectedOption = selectedOptions[0];
  const filterLabel = select.getAttribute('aria-label');
  const isValueFilter = select.id === 'collection-value-filter';
  const isPriorityFilter = isValueFilter && activeCollectionView === 'watchlist';
  menu.setAttribute('aria-label', filterLabel);
  const selectedText = select.multiple
    ? selectedOptions.length === 0
      ? isValueFilter ? (isPriorityFilter ? 'Any priority' : 'Any rating') : 'All years'
      : selectedOptions.length === 1
        ? selectedOption.textContent
        : `${selectedOptions.length} selected`
    : selectedOption?.textContent ?? '';
  const directionalSort = select.id === 'collection-sort' && /^(watched|recent|rating|priority|title|release)-(asc|desc)$/.exec(selectedOption?.value ?? '');
  triggerLabel.textContent = selectedText;
  if (directionButton) {
    directionButton.hidden = !directionalSort;
    if (directionalSort) {
      const direction = directionalSort[2];
      directionButton.textContent = direction === 'desc' ? '↓' : '↑';
      directionButton.setAttribute('aria-label', `Change sort to ${direction === 'desc' ? 'ascending' : 'descending'}`);
      directionButton.title = `Change to ${direction === 'desc' ? 'ascending' : 'descending'} order`;
    }
  }
  trigger.setAttribute('aria-label', `${filterLabel}: ${triggerLabel.textContent}`);
  trigger.classList.toggle('active', select.classList.contains('active'));
  wrapper.querySelector('.workspace-sort-control')?.classList.toggle('active', select.classList.contains('active'));

  optionsContainer.replaceChildren(...[...select.options].map((selectOption) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = isValueFilter
      ? 'menu-option menu-option-value'
      : 'menu-option level-3-styling';
    button.dataset.filterValue = selectOption.value;
    if (isValueFilter) {
      const valueChip = document.createElement('span');
      valueChip.className = isPriorityFilter
        ? 'value-chip-styling priority-value-chip'
        : 'value-chip-styling rating-value-chip';
      valueChip.textContent = selectOption.textContent;
      if (isPriorityFilter) {
        valueChip.style.setProperty('--priority-color', priorityColorForValue(Number(selectOption.value)));
      } else {
        valueChip.style.setProperty('--rating-color', ratingColorForScore(Number(selectOption.value) / 10));
      }
      button.append(valueChip);
    } else {
      button.textContent = selectOption.textContent;
    }
    button.setAttribute('aria-pressed', String(selectOption.selected));
    button.classList.toggle('active', selectOption.selected);
    return button;
  }));
}

/** Picks the palette color for a priority chip based on its priority level. */
function priorityColorForValue(priority) {
  const token = priority >= 4
    ? '--color-priority-high'
    : priority <= 2
      ? '--color-priority-low'
      : '--color-priority-medium';
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim();
}

const expandableSourceControls = [
  $('#collection-source-controls .library-view-switcher, #collection-source-controls .collection-view-switcher'),
  $('#media-type-filters'),
];
expandableSourceControls.forEach((control) => control.addEventListener('pointerenter', () => {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  control.classList.add('is-pointer-active');
}));
expandableSourceControls.forEach((control) => {
  control.addEventListener('pointerleave', () => {
    control.classList.remove('is-pointer-active');
    if (control.contains(document.activeElement)) document.activeElement.blur();
  });
});

/** Updates active styling for the Log and Backlog view controls. */
function updateViewTabs() {
  const folderSelected = activeCollectionView === 'logged' && activeCollectionId !== 'all';
  const collapsedView = folderSelected ? folderReturnView : activeCollectionView;
  document.querySelectorAll('#collection-source-controls .library-view-switcher > [data-view], #collection-source-controls .collection-view-switcher > [data-view]').forEach((button) => {
    const selected = !folderSelected && button.dataset.view === activeCollectionView;
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
  const list = folderList;
  if (!list || !folderButton) return;
  const selectedFolder = activeCollectionView === 'logged'
    ? customCollections.find((folder) => folder.id === activeCollectionId)
    : null;
  folderDropdown?.classList.toggle('folder-active', Boolean(selectedFolder));
  folderButton.setAttribute('aria-label', selectedFolder ? `Folder: ${selectedFolder.name}` : 'Choose a folder');
  folderButton.title = selectedFolder ? `Folder: ${selectedFolder.name}` : 'Choose a folder';
  const navFolderButton = $('#nav-folder-button');
  if (navFolderButton) {
    navFolderButton.classList.toggle('is-active', Boolean(selectedFolder));
    navFolderButton.setAttribute('aria-label', selectedFolder ? `Folder: ${selectedFolder.name}` : 'Choose a folder');
    navFolderButton.title = selectedFolder ? `Folder: ${selectedFolder.name}` : 'Choose a folder';
  }
  const folderButtonLabel = folderButton.lastElementChild;
  if (folderButtonLabel && folderButtonLabel.tagName !== 'IMG') {
    folderButtonLabel.textContent = selectedFolder?.name ?? '';
  }
  list.replaceChildren();

  if (!customCollections.length) {
    const empty = document.createElement('div');
    empty.textContent = 'No folders yet';
    list.append(empty);
    return;
  }

  customCollections.forEach((folder) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = document.documentElement.dataset.cssReworkPreview === 'true'
      ? 'menu-option level-3-styling entry-folder-choice'
      : 'entry-folder-choice';
    button.dataset.folderId = folder.id;
    button.textContent = folder.name;
    const selected = selectedFolder?.id === folder.id;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-pressed', selected ? 'true' : 'false');
    button.setAttribute('aria-label', `Open ${folder.name} folder`);
    button.title = folder.name;
    button.addEventListener('click', () => {
      setFolderMenuOpen(false);
      selectCollection(folder.id);
    });
    list.append(button);
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
      if (group.matches(':hover, :focus-within') || group.classList.contains('is-pointer-active')) return;
      buttons().forEach((button) => button.style.removeProperty('order'));
    }, 200);
  };

  group.addEventListener('pointerenter', lockOrder);
  group.addEventListener('pointerleave', releaseOrderAfterCollapse);
  group.addEventListener('focusin', lockOrder);
  group.addEventListener('focusout', releaseOrderAfterCollapse);
}

keepControlOrderUntilCollapsed(document.querySelector('.library-view-switcher, .collection-view-switcher'), '[data-view]');
keepControlOrderUntilCollapsed($('#media-type-filters'), '.type-switch-option');

/** Selects a library or folder and refreshes the collection view. */
function selectCollection(collectionId) {
  if (activeCollectionId === 'all' || activeCollectionView === 'watchlist') folderReturnView = activeCollectionView;
  activeCollectionId = collectionId;
  activeCollectionView = 'logged';
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
  activeCollectionView = 'logged';
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
  closeWorkspaceFilterMenus();
  document.querySelectorAll('#media-type-filters .type-switch-option, #media-type-filters .media-type-filter').forEach((button) => {
    button.classList.toggle('active', button.dataset.filter === activeFilter);
  });
  document.querySelectorAll('.logged-collection-tool').forEach((control) => {
    control.hidden = isWatchlist;
  });

  const yearSelect = $('#watched-year-filter');
  const yearFilterLabel = isWatchlist ? 'Filter by release year' : 'Filter by watched year';
  yearSelect.setAttribute('aria-label', yearFilterLabel);
  const availableYears = [...new Set(isWatchlist
    ? watchlist.map((entry) => String(entry.year || '')).filter(Boolean)
    : entries.flatMap((entry) => entry.watches.map(watchYear)).filter(Boolean))]
    .sort((a, b) => Number(b) - Number(a));
  watchedYearFilter = watchedYearFilter.filter((year) => availableYears.includes(year));
  yearSelect.replaceChildren(...availableYears.map((year) => new Option(year, year, false, watchedYearFilter.includes(year))));
  yearSelect.classList.toggle('active', watchedYearFilter.length > 0);
  const yearReset = $('.workspace-year-filter-wrapper .workspace-filter-reset-button');
  if (yearReset) yearReset.disabled = watchedYearFilter.length === 0;
  syncWorkspaceFilterMenu(yearSelect);
  const valueSelect = $('#collection-value-filter');
  const activeValueFilter = isWatchlist ? priorityFilter : ratingFilter;
  const valueOptions = isWatchlist
    ? [5, 4, 3, 2, 1].map((priority) => new Option(`P${priority}`, String(priority), false, priorityFilter.includes(priority)))
    : Array.from({ length: 21 }, (_, index) => 100 - index * 5)
      .map((rating) => new Option(`${rating}%`, String(rating), false, ratingFilter.includes(rating)));
  const valueLabel = isWatchlist ? 'priority' : 'rating';
  valueSelect.setAttribute('aria-label', `Filter by ${valueLabel}`);
  valueSelect.replaceChildren(...valueOptions);
  valueSelect.classList.toggle('active', activeValueFilter.length > 0);
  const valueButton = $('#collection-value-filter-button');
  valueButton.setAttribute('aria-label', `Filter by ${valueLabel}: ${isWatchlist ? 'Any priority' : 'Any rating'}`);
  const valueReset = $('.workspace-value-filter-wrapper .workspace-filter-reset-button');
  if (valueReset) {
    valueReset.disabled = activeValueFilter.length === 0;
    valueReset.setAttribute('aria-label', `Clear ${valueLabel} filter`);
    valueReset.title = `Clear ${valueLabel} filter`;
  }
  syncWorkspaceFilterMenu(valueSelect);

  const sortSelect = $('#collection-sort');
  const selectedSort = /^(watched|recent|rating|priority|title|release)-(asc|desc)$/.exec(collectionSort);
  const directionFor = (key, defaultDirection) => selectedSort?.[1] === key ? selectedSort[2] : defaultDirection;
  const choices = isWatchlist
    ? [[`priority-${directionFor('priority', 'desc')}`, 'Priority'], [`recent-${directionFor('recent', 'desc')}`, 'Logged'], [`title-${directionFor('title', 'asc')}`, 'Title'], [`release-${directionFor('release', 'desc')}`, 'Release']]
    : [[`watched-${directionFor('watched', 'desc')}`, 'Watched'], [`recent-${directionFor('recent', 'desc')}`, 'Logged'], [`rating-${directionFor('rating', 'desc')}`, 'Rating'], [`title-${directionFor('title', 'asc')}`, 'Title'], [`release-${directionFor('release', 'desc')}`, 'Release']];
  if (!choices.some(([value]) => value === collectionSort)) {
    collectionSort = isWatchlist ? 'priority-desc' : 'watched-desc';
  }
  sortSelect.replaceChildren(...choices.map(([value, label]) => new Option(label, value)));
  sortSelect.value = collectionSort;
  const defaultSort = isWatchlist ? 'priority-desc' : 'watched-desc';
  sortSelect.classList.toggle('active', collectionSort !== defaultSort);
  const sortReset = $('.workspace-sort-wrapper .workspace-sort-reset-button');
  if (sortReset) sortReset.disabled = collectionSort === defaultSort;
  const resetAll = $('#reset-collection-filter-sort');
  if (resetAll) {
    const hasActiveSettings = Boolean(
      activeFilter !== 'all' || watchedYearFilter.length || activeValueFilter.length || collectionSort !== defaultSort
    );
    resetAll.disabled = !hasActiveSettings;
    resetAll.classList.toggle('is-active', hasActiveSettings);
  }
  syncWorkspaceFilterMenu(sortSelect);
}

/** Checks whether an entry passes the active collection filters. */
function matchesCollectionFilters(entry, isWatchlist) {
  if (activeCollectionView === 'logged' && activeCollectionId !== 'all' && !entryCollectionIds(entry).includes(activeCollectionId)) return false;
  if (isWatchlist) {
    if (watchedYearFilter.length && !watchedYearFilter.includes(String(entry.year || ''))) return false;
    if (priorityFilter.length && !priorityFilter.includes(Number(entry.priority || 3))) return false;
    return true;
  }
  if (watchedYearFilter.length && !entry.watches.some((watch) => watchedYearFilter.includes(watchYear(watch)))) return false;
  if (ratingFilter.length && !ratingFilter.includes(Math.round(Number(latest(entry).score) * 10))) return false;
  return true;
}

/** Sorts collection entries using the active sort option. */
function sortCollectionItems(items, isWatchlist) {
  return items.map((entry, index) => ({ entry, index })).sort((left, right) => {
    const a = left.entry;
    const b = right.entry;
    const [sortKey, direction] = collectionSort.split('-');
    const directionFactor = direction === 'asc' ? 1 : -1;
    if (sortKey === 'title') return a.title.localeCompare(b.title) * directionFactor || left.index - right.index;
    if (sortKey === 'release') return (Number(a.year || 0) - Number(b.year || 0)) * directionFactor || left.index - right.index;
    if (isWatchlist && sortKey === 'priority') return (Number(a.priority || 3) - Number(b.priority || 3)) * directionFactor || left.index - right.index;
    if (!isWatchlist && sortKey === 'rating') return (Number(a.watches?.[0]?.score || 0) - Number(b.watches?.[0]?.score || 0)) * directionFactor || left.index - right.index;
    if (!isWatchlist && ['watched-desc', 'watched-asc'].includes(collectionSort)) {
      const newestDate = (entry) => (entry.watches || []).map((watch) => watch.date || '').sort().at(-1) || '';
      const dateOrder = newestDate(a).localeCompare(newestDate(b));
      return (collectionSort === 'watched-desc' ? -dateOrder : dateOrder) || left.index - right.index;
    }
    if (['recent-desc', 'recent-asc'].includes(collectionSort)) {
      return collectionSort === 'recent-desc' ? left.index - right.index : right.index - left.index;
    }
    return left.index - right.index;
  }).map(({ entry }) => entry);
}

/** Updates page controls and counts for the visible collection. */
function updateCollectionPaginationControls() {
  const pagination = $('#collection-pagination');
  pagination.hidden = false;
  $('#collection-page-status').textContent = `${collectionPage + 1} / ${collectionPageCount}`;
  $('#collection-page-previous').disabled = collectionPage === 0;
  $('#collection-page-next').disabled = collectionPage >= collectionPageCount - 1;
}

function updateCollectionPagination(totalItems, pageSize) {
  collectionPageCount = Math.max(1, Math.ceil(totalItems / pageSize));
  collectionPage = Math.min(collectionPage, collectionPageCount - 1);
  updateCollectionPaginationControls();
}

if (isReworkedCollection) {
  collection.addEventListener('scroll', () => {
    if (!collection.clientWidth) return;
    const page = Math.min(
      collectionPageCount - 1,
      Math.max(0, Math.round(collection.scrollLeft / collection.clientWidth)),
    );
    if (page === collectionPage) return;
    collectionPage = page;
    updateCollectionPaginationControls();
    bannerIndex = 0;
    renderBanner();
  }, { passive: true });
}

/** Moves the collection to an adjacent page. */
function changeCollectionPage(direction) {
  const nextPage = Math.max(0, Math.min(collectionPage + direction, collectionPageCount - 1));
  if (nextPage === collectionPage) return false;
  if (isReworkedCollection) {
    collectionPage = nextPage;
    collection.scrollTo({ left: nextPage * collection.clientWidth, behavior: 'smooth' });
    updateCollectionPaginationControls();
    bannerIndex = 0;
    renderBanner();
    return true;
  }
  collectionPageDirection = direction;
  collectionPage = nextPage;
  renderCollection();
  return true;
}

/** Recalculates collection layout and paging after a resize. */
function handleCollectionResize() {
  const columns = getCollectionColumnCount();
  const viewportWidth = collection.clientWidth;
  if (!collectionColumnCount) {
    collectionColumnCount = columns;
    collectionViewportWidth = viewportWidth;
    return;
  }
  if (columns === collectionColumnCount) {
    if (isReworkedCollection && viewportWidth !== collectionViewportWidth) {
      collectionViewportWidth = viewportWidth;
      collection.scrollLeft = collectionPage * viewportWidth;
    }
    return;
  }

  collectionColumnCount = columns;
  collectionViewportWidth = viewportWidth;
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
function createEntryCard(entry, isBacklogged, sourceView = activeCollectionView) {
  const watch = isBacklogged ? null : latest(entry);
  const isReworkPreview = document.documentElement.dataset.cssReworkPreview === 'true';
  const card = document.createElement('article');
  card.className = `${isReworkPreview ? 'workspace-banner-container banner-container' : 'workspace-content-entry'} level-2-styling entry ${isBacklogged ? 'is-backlogged' : 'is-logged'}`;
  if (isReworkPreview && entry.poster) {
    const posterSource = entry.poster;
    card.dataset.posterPaletteSource = posterSource;
    getPosterPalette(posterSource).then((palette) => {
      if (!palette || !card.isConnected || card.dataset.posterPaletteSource !== posterSource) return;
      card.style.setProperty('--entry-poster-color-one', `rgb(${palette.pageOne.join(', ')})`);
      card.style.setProperty('--entry-poster-color-two', `rgb(${palette.pageTwo.join(', ')})`);
    });
  }

  const link = document.createElement('a');
  link.className = `${isReworkPreview ? 'workspace-banner-link' : 'workspace-content-entry-link'} entry-link`;
  link.href = `#entry/${sourceView}/${encodeURIComponent(entry.id)}`;
  link.setAttribute('aria-label', `Open ${entry.title} details`);
  link.addEventListener('click', (event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    openEntryFromCard(card, link.href);
  });
  const poster = posterElement(entry, `${isReworkPreview ? 'banner-poster' : 'workspace-content-entry-poster'} entry-poster`);
  card.append(link, poster);

  const info = document.createElement('div');
  info.className = `${isReworkPreview ? 'banner-info-layout' : 'workspace-content-entry-detail'} entry-info`;
  const header = document.createElement('div');
  header.className = 'entry-header';
  const details = document.createElement('div');
  details.className = 'entry-details';

  const tag = document.createElement('span');
  tag.className = isReworkPreview
    ? 'category-chip-styling banner-category-chip'
    : 'workspace-content-entry-detail-tagChip entry-tag';
  if (entry.category && entry.category.toLowerCase() !== entry.type.toLowerCase()) {
    tag.textContent = entry.category;
    tag.style.setProperty('--category-hue', categoryHueForName(entry.category));
  }
  else {
    tag.classList.add('entry-tag-placeholder');
    if (isReworkPreview) tag.classList.add('is-placeholder');
    tag.setAttribute('aria-hidden', 'true');
    tag.textContent = 'Genre';
  }

  const title = document.createElement('h3');
  title.className = isReworkPreview
    ? 'banner-title'
    : 'workspace-content-entry-detail-title';
  title.textContent = entry.title;
  const heading = document.createElement('div');
  heading.className = 'banner-heading-layout';
  heading.append(title);
  const label = document.createElement('div');
  label.className = isReworkPreview
    ? 'banner-labels-layout'
    : 'entry-type';
  if (isReworkPreview) {
    const mediaType = entry.type.toLowerCase();
    const mediaIcon = document.createElement('span');
    mediaIcon.className = `type-chip-styling media-type-icon banner-type is-${mediaType}`;
    mediaIcon.setAttribute('role', 'img');
    mediaIcon.setAttribute('aria-label', entry.type);
    mediaIcon.innerHTML = appIconMarkup(mediaTypeIconName(entry.type), 'icon app-icon');
    poster.append(mediaIcon);
    label.append(tag);
  } else {
    label.textContent = entry.type;
  }
  if (entry.year) {
    const year = document.createElement('span');
    year.className = isReworkPreview
      ? 'text-chip-styling banner-release-date-chip'
      : 'workspace-content-entry-detail-year entry-year';
    if (isReworkPreview) {
      year.innerHTML = appIconMarkup('release', 'icon app-icon banner-release-date-icon');
      const yearLabel = document.createElement('span');
      yearLabel.className = 'banner-release-date-label';
      yearLabel.textContent = entry.year;
      year.append(yearLabel);
    } else {
      year.textContent = entry.year;
    }
    label.append(year);
  }
  if (isReworkPreview && watch) {
    const date = document.createElement('span');
    date.className = 'text-chip-styling banner-log-date-chip';
    date.innerHTML = appIconMarkup('watched', 'icon app-icon banner-log-date-icon');
    const dateLabel = document.createElement('span');
    dateLabel.className = 'banner-log-date-label';
    dateLabel.textContent = formatDate(watch.date);
    date.append(dateLabel);
    label.append(date);
  }
  if (isReworkPreview) {
    if (entry.director) {
      const director = document.createElement('span');
      director.className = 'app-text banner-director';
      director.textContent = `By ${entry.director}`;
      heading.append(director);
    }
    info.append(label, heading);
  } else {
    header.append(tag, label, title);
  }

  const meta = document.createElement('div');
  if (isReworkPreview) meta.className = 'banner-meta-layout';

  if (watch) {
    const score = document.createElement('div');
    score.className = isReworkPreview
      ? 'banner-value-layout'
      : 'workspace-content-entry-detail-rating entry-score entry-rating-with-star';
    const scoreFill = `${Number(watch.score) * 10}%`;
    const scoreColor = ratingColorForScore(watch.score);
    const scoreValue = document.createElement('span');
    scoreValue.className = isReworkPreview
      ? 'value-chip-styling rating-value-chip banner-ratings-chip'
      : 'workspace-content-entry-detail-ratingChip valueChip ratingValueChip rating-valueChip';
    scoreValue.textContent = `${Number(watch.score) * 10}%`;
    scoreValue.style.setProperty('--rating-color', scoreColor);
    const meterClass = isReworkPreview
      ? 'ratings-meter ratings-bar'
      : 'workspace-content-entry-detail-ratingsMeter ratingsMeter';
    score.append(scoreValue, createRatingMeter(scoreFill, scoreColor, meterClass));
    score.setAttribute('aria-label', `Rating ${Number(watch.score).toFixed(1)} out of 10`);
    if (isReworkPreview) {
      meta.append(score);
    } else {
      const date = document.createElement('div');
      date.className = 'workspace-content-entry-detail-date entry-date';
      date.textContent = `Watched ${formatDate(watch.date)}`;
      details.append(score, date);
    }
  } else if (isBacklogged) {
    const priority = Math.min(5, Math.max(1, Number(entry.priority) || 3));
    const priorityColor = priorityColorForValue(priority);
    const indicator = document.createElement('div');
    indicator.className = isReworkPreview
      ? 'priority-dots'
      : 'workspace-content-entry-detail-priorityDots entry-priority priorityDots';
    indicator.dataset.priority = priority;
    indicator.style.setProperty('--priority-color', priorityColor);
    indicator.setAttribute('aria-label', `Priority ${priority} out of 5`);
    for (let dot = 1; dot <= 5; dot++) {
      const marker = document.createElement('span');
      marker.classList.toggle('is-filled', dot <= priority);
      indicator.append(marker);
    }
    if (isReworkPreview) {
      const value = document.createElement('div');
      value.className = 'banner-value-layout';
      const priorityValue = document.createElement('span');
      priorityValue.className = 'value-chip-styling priority-value-chip';
      priorityValue.textContent = `P${priority}`;
      priorityValue.style.setProperty('--priority-color', priorityColor);
      value.append(priorityValue, indicator);
      meta.append(value);
    }
    else details.append(indicator);
  }

  const actions = document.createElement('div');
  actions.className = 'entry-actions';
  const actionList = isBacklogged
    ? [['Edit', () => openDialog(entry.id, false, null, true, 'watchlist')], ['Folder', () => openFolderPicker(entry)], ['Remove', () => removeEntry(entry, true)]]
    : [['Rewatch', () => openDialog(entry.id, true)], ['Edit', () => openDialog(entry.id, false, null, true)], ['Folder', () => openFolderPicker(entry)], ['Remove', () => removeEntry(entry, false)]];

  actionList.forEach(([label, action]) => {
    const buttonLabel = label === 'Folder' ? `Add ${entry.title} to folder` : `${label} ${entry.title}`;
    const button = iconButton(buttonLabel, label, action, `action-${label.toLowerCase()}`, isReworkPreview);
    if (label === 'Remove') button.classList.add('remove-button');
    actions.append(button);
  });

  if (isReworkPreview) {
    info.append(meta);
  } else {
    info.append(header, details);
  }
  const tools = document.createElement('div');
  tools.className = `${isReworkPreview ? 'workspace-tools-layout' : 'workspace-content-entry-tools'} entry-card-tools`;
  const fullscreen = iconButton(
    `Open ${entry.title} fullscreen`,
    'Fullscreen',
    () => openEntryFromCard(card, `#entry/${sourceView}/${encodeURIComponent(entry.id)}/full`),
    isReworkPreview ? 'action-fullscreen' : 'entry-open-fullscreen',
    isReworkPreview,
  );
  if (isReworkPreview) tools.append(...actions.children, fullscreen);
  else tools.append(actions, fullscreen);
  card.append(info, tools);
  return card;
}

/** Opens a card’s entry in hover or fullscreen mode. */
function openEntryFromCard(card, destination) {
  if (card.classList.contains('is-opening')) return;
  const hash = destination.startsWith('#') ? destination : new URL(destination).hash;
  if (reduceAnimationsEnabled || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    location.hash = hash;
    return;
  }
  card.classList.add('is-opening');
  window.setTimeout(() => {
    card.classList.remove('is-opening');
    location.hash = hash;
  }, 60);
}

/** Opens the first visible result when Enter is pressed in the collection search. */
$('#library-search').addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' || event.isComposing) return;
  const firstCard = collection.querySelector('.entry');
  if (!firstCard) return;

  event.preventDefault();
  const link = firstCard.querySelector('.entry-link');
  if (link) openEntryFromCard(firstCard, link.href);
});

/** Moves keyboard focus through visible entry cards using the arrow keys. */
collection.addEventListener('keydown', (event) => {
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
  const currentCard = event.target.closest('.entry');
  if (!currentCard || !collection.contains(currentCard)) return;

  const cards = [...collection.querySelectorAll('.entry')];
  const currentIndex = cards.indexOf(currentCard);
  const columns = getCollectionColumnCount();
  const indexDelta = {
    ArrowLeft: -1,
    ArrowRight: 1,
    ArrowUp: -columns,
    ArrowDown: columns,
  }[event.key];
  const nextCard = cards[currentIndex + indexDelta];
  if (!nextCard) return;

  event.preventDefault();
  nextCard.querySelector('.entry-link')?.focus({ preventScroll: true });
});

/** Filters, sorts, pages, and renders the active collection. */
function renderCollection() {
  $('#library').hidden = false;
  collection.replaceChildren();
  const isWatchlist = activeCollectionView === 'watchlist';
  const showingFolder = !isWatchlist && activeCollectionId !== 'all';
  renderCollectionPicker();
  updateCollectionTools(isWatchlist);
  const items = isWatchlist ? watchlist : showingFolder
    ? [...entries, ...watchlist.filter((entry) => entryCollectionIds(entry).includes(activeCollectionId))]
    : entries;
  const query = $('#library-search').value.trim().toLocaleLowerCase();
  const shown = sortCollectionItems(
    items.filter((entry) => {
      const entryIsWatchlist = watchlist.includes(entry);
      return matchesCollectionSearch(entry, query) && matchesCollectionFilters(entry, entryIsWatchlist);
    }),
    isWatchlist,
  );
  const watchlistEmpty = $('#watchlist-empty');
  const empty = $('#empty');
  const hasCollectionFilter = activeFilter !== 'all'
    || watchedYearFilter.length > 0
    || (isWatchlist ? priorityFilter.length > 0 : ratingFilter.length > 0);

  $('#open-add').setAttribute('aria-label', isWatchlist ? 'Add to watchlist' : 'Log a watch');
  watchlistEmpty.hidden = !isWatchlist || items.length > 0 || Boolean(query) || hasCollectionFilter;
  empty.hidden = shown.length > 0 || !watchlistEmpty.hidden;
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
  const pageSize = columns * collectionRowsPerPage;
  updateCollectionPagination(shown.length, pageSize);
  const appendEntryCard = (target, entry) => {
    const entryIsWatchlist = watchlist.includes(entry);
    const sourceView = entryIsWatchlist ? 'watchlist' : 'logged';
    target.append(createEntryCard(entry, entryIsWatchlist, sourceView));
  };
  if (isReworkedCollection) {
    for (let pageIndex = 0; pageIndex < collectionPageCount; pageIndex++) {
      const page = document.createElement('div');
      page.className = 'workspace-content-page';
      shown.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize)
        .forEach((entry) => appendEntryCard(page, entry));
      collection.append(page);
    }
    collection.scrollLeft = collectionPage * collection.clientWidth;
  } else {
    const pageStart = collectionPage * pageSize;
    shown.slice(pageStart, pageStart + pageSize)
      .forEach((entry) => appendEntryCard(collection, entry));
  }

  collection.classList.remove('page-enter-forward', 'page-enter-backward');
  if (!isReworkedCollection && collectionPageDirection && collectionPageCount > 1) {
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
  if (isReworkedCollection) renderBanner();
}

// Listen on the whole library card so trackpad swipes work over the toolbar and cards.
$('#library').addEventListener('wheel', (event) => {
  if (isReworkedCollection) return;
  if (event.target.closest('.folder-menu-wrapper [data-menu-options]')) return;
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

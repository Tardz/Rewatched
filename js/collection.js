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

// The current page uses the shared sidebar menu; index-old.html retains legacy markup.
const folderDropdown = $('.folder-menu-wrapper, #library-folder-dropdown');
const folderPicker = folderDropdown?.querySelector('.menu-container, #library-folder-picker');
const folderList = folderPicker?.querySelector('[data-menu-options], #library-folder-list');
const folderButton = $('.nav-folders-button, #library-folder-button');

/** Keep the sidebar popup over the app content and aligned with its trigger. */
function positionFolderMenu() {
  if (!isReworkedCollection || !folderPicker || !folderButton) return;
  const content = $('.app-content-container')?.getBoundingClientRect();
  const trigger = folderButton.getBoundingClientRect();
  if (!content) return;
  folderPicker.style.left = `${content.left + 8}px`;
  folderPicker.style.top = `${Math.max(content.top + 8, Math.min(trigger.top, content.bottom - folderPicker.offsetHeight - 8))}px`;
}

/** Opens or closes the library folder menu. */
function setFolderMenuOpen(isOpen) {
  if (!folderPicker || !folderButton) return;
  folderPicker.hidden = !isOpen;
  folderDropdown?.classList.toggle('is-open', isOpen);
  folderButton.setAttribute('aria-expanded', String(isOpen));
  if (isOpen) positionFolderMenu();
}

folderButton?.addEventListener('click', () => setFolderMenuOpen(folderPicker.hidden));

document.addEventListener('click', (event) => {
  if (folderDropdown && !folderDropdown.contains(event.target)) setFolderMenuOpen(false);
});

/* Open entry-card tools with the context menu; keep the panel styled through its closing transition. */
const entryCardToolsTimers = new WeakMap();

function setEntryCardToolsOpen(layout, isOpen) {
  const tools = layout.querySelector('.entry-card-tools');
  const pendingTimer = entryCardToolsTimers.get(layout);
  if (pendingTimer) {
    window.clearTimeout(pendingTimer);
    entryCardToolsTimers.delete(layout);
  }
  if (isOpen) {
    layout.classList.add('tools-visible', 'tools-open');
    tools?.classList.add('level-2-styling');
    return;
  }

  layout.classList.remove('tools-open');
  if (tools && layout.classList.contains('tools-visible')) {
    const timer = window.setTimeout(() => {
      if (!layout.classList.contains('tools-open')) {
        layout.classList.remove('tools-visible');
        tools.classList.remove('level-2-styling');
      }
      entryCardToolsTimers.delete(layout);
    }, 170);
    entryCardToolsTimers.set(layout, timer);
  }
}

collection.addEventListener('pointerout', (event) => {
  const layout = event.target.closest('.entry-card-layout.tools-open');
  if (!layout || layout.contains(event.relatedTarget)) return;
  setEntryCardToolsOpen(layout, false);
});

document.addEventListener('pointerdown', (event) => {
  if (event.target.closest('.entry-card-layout.tools-open')) return;
  collection.querySelectorAll('.entry-card-layout.tools-open').forEach((layout) => setEntryCardToolsOpen(layout, false));
});

document.addEventListener('contextmenu', () => {
  collection.querySelectorAll('.entry-card-layout.tools-open').forEach((layout) => setEntryCardToolsOpen(layout, false));
});

collection.addEventListener('contextmenu', (event) => {
  const layout = event.target.closest('.entry-card-layout');
  if (!layout) return;
  event.preventDefault();
  const shouldOpen = !layout.classList.contains('tools-open');
  collection.querySelectorAll('.entry-card-layout.tools-open').forEach((item) => setEntryCardToolsOpen(item, false));
  if (shouldOpen) setEntryCardToolsOpen(layout, true);
  event.stopPropagation();
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  collection.querySelectorAll('.entry-card-layout.tools-open').forEach((layout) => setEntryCardToolsOpen(layout, false));
});

window.addEventListener('resize', () => {
  if (folderPicker && !folderPicker.hidden) positionFolderMenu();
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || !folderPicker || folderPicker.hidden) return;
  event.preventDefault();
  setFolderMenuOpen(false);
  folderButton?.focus();
});

const workspaceFilterMenuSelector = '.workspace-type-menu-wrapper, .workspace-ratings-menu-wrapper, .workspace-year-menu-wrapper, .workspace-sort-menu-wrapper';
const workspaceFilterMenus = [...document.querySelectorAll(workspaceFilterMenuSelector)];
let hasPendingWorkspaceMenuChanges = false;

function getWorkspaceFilterButton(wrapper) {
  return wrapper.classList.contains('workspace-sort-menu-wrapper')
    ? wrapper.querySelector(':scope > .workspace-sort-menu-button')
    : wrapper.querySelector(':scope > button');
}

/** Opens one workspace filter menu and closes the others. */
function setWorkspaceFilterMenuOpen(wrapper, isOpen) {
  const menu = wrapper.querySelector('.menu-container');
  const trigger = getWorkspaceFilterButton(wrapper);
  menu.hidden = !isOpen;
  wrapper.classList.toggle('is-open', isOpen);
  trigger.setAttribute('aria-expanded', String(isOpen));
  document.body.classList.toggle(
    'workspace-filter-menu-open',
    workspaceFilterMenus.some((item) => !item.querySelector('.menu-container').hidden),
  );
}

function closeWorkspaceFilterMenus() {
  const wasOpen = workspaceFilterMenus.some((wrapper) => !wrapper.querySelector('.menu-container').hidden);
  workspaceFilterMenus.forEach((wrapper) => setWorkspaceFilterMenuOpen(wrapper, false));
  if (wasOpen && hasPendingWorkspaceMenuChanges) {
    hasPendingWorkspaceMenuChanges = false;
    renderCollection();
  }
}

workspaceFilterMenus.forEach((wrapper) => {
  const trigger = getWorkspaceFilterButton(wrapper);
  const select = wrapper.querySelector('select');
  const resetButton = wrapper.querySelector('.workspace-filter-reset-button, .workspace-sort-reset-button');
  const directionButton = wrapper.querySelector('.workspace-sort-direction-button');

  select?.addEventListener('change', () => {
    if (select.id === 'collection-value-filter') {
      const selectedValues = [...select.selectedOptions].map((option) => Number(option.value));
      const isPriorityFilter = select.getAttribute('aria-label') === 'Filter by priority';
      if (isPriorityFilter) priorityFilter = selectedValues;
      else {
        const addedValues = selectedValues.filter((value) => !ratingFilter.includes(value));
        if (selectedValues.length > 2 && addedValues.length) {
          const nextValue = addedValues.at(-1);
          const endpointToMove = ratingFilter.reduce((closest, value) => (
            Math.abs(value - nextValue) < Math.abs(closest - nextValue) ? value : closest
          ), ratingFilter[0]);
          ratingFilter = [...ratingFilter.filter((value) => value !== endpointToMove), nextValue];
        } else {
          const retainedValues = ratingFilter.filter((value) => selectedValues.includes(value));
          ratingFilter = [...retainedValues, ...addedValues].slice(0, 2);
          if (ratingFilter.length === 0) ratingFilter = [100, 0];
        }
        [...select.options].forEach((option) => {
          option.selected = ratingFilter.includes(Number(option.value));
        });
      }
    }
    if (select.id === 'release-year-filter') {
      const selectedYears = [...select.selectedOptions].map((option) => option.value);
      const addedYears = selectedYears.filter((year) => !releaseYearFilter.includes(year));
      if (selectedYears.length > 2 && addedYears.length) {
        const nextYear = addedYears.at(-1);
        const endpointToMove = releaseYearFilter.reduce((closest, year) => (
          Math.abs(Number(year) - Number(nextYear)) < Math.abs(Number(closest) - Number(nextYear)) ? year : closest
        ), releaseYearFilter[0]);
        releaseYearFilter = [...releaseYearFilter.filter((year) => year !== endpointToMove), nextYear];
      } else {
        releaseYearFilter = [
          ...releaseYearFilter.filter((year) => selectedYears.includes(year)),
          ...addedYears,
        ].slice(0, 2);
      }
      [...select.options].forEach((option) => {
        option.selected = releaseYearFilter.includes(option.value);
      });
    }
    collectionPage = 0;
    hasPendingWorkspaceMenuChanges = true;
    syncWorkspaceFilterMenu(select);
  });

  trigger.addEventListener('click', (event) => {
    const willOpen = wrapper.querySelector('.menu-container').hidden;
    closeWorkspaceFilterMenus();
    setWorkspaceFilterMenuOpen(wrapper, willOpen);
  });

  directionButton?.addEventListener('click', (event) => {
    event.stopPropagation();
    const [sortKey, direction] = collectionSort.split('-');
    if (!['watched', 'recent', 'rating', 'priority', 'title', 'release'].includes(sortKey)) return;
    collectionSort = `${sortKey}-${direction === 'desc' ? 'asc' : 'desc'}`;
    collectionPage = 0;
    hasPendingWorkspaceMenuChanges = true;
    select.value = collectionSort;
    syncWorkspaceFilterMenu(select);
    directionButton.focus();
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

  if (!select) return;

  resetButton?.addEventListener('click', (event) => {
    event.stopPropagation();
    if (wrapper.classList.contains('workspace-sort-menu-wrapper')) {
      collectionSort = activeCollectionView === 'watchlist' ? 'priority-desc' : 'watched-desc';
      select.value = collectionSort;
    } else {
      [...select.options].forEach((option) => { option.selected = false; });
      if (select.id === 'collection-value-filter') {
        if (activeCollectionView === 'watchlist') priorityFilter = [];
        else {
          ratingFilter = [100, 0];
          [...select.options].forEach((option) => {
            option.selected = ratingFilter.includes(Number(option.value));
          });
        }
      }
      if (select.id === 'release-year-filter') releaseYearFilter = [];
    }
    collectionPage = 0;
    hasPendingWorkspaceMenuChanges = true;
    syncWorkspaceFilterMenu(select);
    resetButton.focus();
  });

  wrapper.addEventListener('click', (event) => {
    const option = event.target.closest('.menu-option');
    if (!option || !wrapper.contains(option)) return;
    event.stopPropagation();
    if (wrapper.classList.contains('workspace-sort-menu-wrapper')) {
      collectionSort = option.dataset.filterValue;
      collectionPage = 0;
      hasPendingWorkspaceMenuChanges = true;
      select.value = collectionSort;
      syncWorkspaceFilterMenu(select);
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

const resetCollectionFiltersButton = $('.workspace-reset-button');
resetCollectionFiltersButton?.addEventListener('click', () => {
  hasPendingWorkspaceMenuChanges = false;
  activeFilters = [...workspaceMediaTypes];
  releaseYearFilter = [];
  ratingFilter = [100, 0];
  priorityFilter = [];
  collectionSort = activeCollectionView === 'watchlist' ? 'priority-desc' : 'watched-desc';
  collectionPage = 0;
  renderCollection();
});

document.addEventListener('click', (event) => {
  const openMenu = workspaceFilterMenus.find((wrapper) => !wrapper.querySelector('.menu-container').hidden);
  if (!openMenu || openMenu.querySelector('.menu-container').contains(event.target)) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  closeWorkspaceFilterMenus();
}, true);

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  const openMenu = workspaceFilterMenus.find((wrapper) => !wrapper.querySelector('.menu-container').hidden);
  if (!openMenu) return;
  event.preventDefault();
  closeWorkspaceFilterMenus();
  getWorkspaceFilterButton(openMenu).focus();
});

/** Mirrors a native select's options and value into its reworked menu. */
function syncWorkspaceFilterMenu(select) {
  const wrapper = select.closest(workspaceFilterMenuSelector);
  if (!wrapper) return;

  const trigger = getWorkspaceFilterButton(wrapper);
  const menu = wrapper.querySelector('.menu-container');
  const triggerLabel = trigger.querySelector('.menu-button-text');
  const directionButton = select.id === 'collection-sort'
    ? wrapper.querySelector('.workspace-sort-direction-button')
    : null;
  const directionIcon = directionButton?.querySelector('.masked-icon');
  const optionsContainer = wrapper.querySelector('[data-menu-options]');
  const selectedOptions = [...select.selectedOptions];
  const selectedOption = selectedOptions[0];
  const filterLabel = select.getAttribute('aria-label');
  const isValueFilter = select.id === 'collection-value-filter';
  const isPriorityFilter = isValueFilter && select.getAttribute('aria-label') === 'Filter by priority';
  const resetButton = wrapper.querySelector('.workspace-filter-reset-button, .workspace-sort-reset-button');
  if (resetButton) {
    const defaultSort = activeCollectionView === 'watchlist' ? 'priority-desc' : 'watched-desc';
    const hasActiveSetting = select.id === 'collection-sort'
      ? collectionSort !== defaultSort
      : select.id === 'release-year-filter'
        ? releaseYearFilter.length > 0
        : isPriorityFilter
          ? priorityFilter.length > 0
          : !isDefaultRatingRange(ratingFilter);
    resetButton.disabled = !hasActiveSetting;
  }
  const rangeValues = isValueFilter && !isPriorityFilter
    ? selectedOptions.map((option) => Number(option.value))
    : select.id === 'release-year-filter'
      ? selectedOptions.map((option) => Number(option.value))
      : [];
  const rangeBounds = rangeValues.length === 2
    ? [Math.min(...rangeValues), Math.max(...rangeValues)]
    : null;
  menu.setAttribute('aria-label', filterLabel);
  const selectedText = select.multiple
    ? selectedOptions.length === 0
      ? isValueFilter
        ? (isPriorityFilter ? 'P5 - P1' : `100 - 0${hideRatingChipPercentage ? '' : '%'}`)
        : select.id === 'release-year-filter'
          ? select.options.length
            ? `${select.options[0].value} - ${select.options[select.options.length - 1].value}`
            : 'No years'
          : 'All years'
      : isValueFilter && !isPriorityFilter && selectedOptions.length === 2
        ? `${Math.max(...selectedOptions.map((option) => Number(option.value)))} - ${Math.min(...selectedOptions.map((option) => Number(option.value)))}${hideRatingChipPercentage ? '' : '%'}`
        : select.id === 'release-year-filter' && selectedOptions.length === 2
          ? `${Math.max(...selectedOptions.map((option) => Number(option.value)))} - ${Math.min(...selectedOptions.map((option) => Number(option.value)))}`
        : selectedOptions.length === 1
          ? selectedOption.textContent
          : `${selectedOptions.length} selected`
    : selectedOption?.textContent ?? '';
  const directionalSort = select.id === 'collection-sort' && /^(watched|recent|rating|priority|title|release)-(asc|desc)$/.exec(selectedOption?.value ?? '');
  triggerLabel.textContent = selectedText;
  if (directionButton) {
    directionButton.disabled = !directionalSort;
    if (directionalSort) {
      const direction = directionalSort[2];
      directionIcon.dataset.direction = direction;
      directionButton.setAttribute('aria-label', `Change to ${direction === 'desc' ? 'ascending' : 'descending'} sort order`);
      directionButton.title = `Change to ${direction === 'desc' ? 'ascending' : 'descending'} order`;
    }
  }
  trigger.setAttribute('aria-label', `${filterLabel}: ${triggerLabel.textContent}`);
  trigger.classList.toggle('active', select.classList.contains('active'));

  optionsContainer.replaceChildren(...[...select.options].map((selectOption) => {
    const button = document.createElement('button');
    const optionValue = Number(selectOption.value);
    const isInSelectedRange = rangeBounds
      && optionValue >= rangeBounds[0]
      && optionValue <= rangeBounds[1];
    const isOptionActive = selectOption.selected || isInSelectedRange;
    button.type = 'button';
    button.className = isValueFilter
      ? 'menu-option menu-option-value level-3-styling'
      : 'menu-option level-3-styling';
    button.dataset.filterValue = selectOption.value;
    if (isValueFilter) {
      if (isOptionActive) {
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
    } else {
      button.textContent = selectOption.textContent;
    }
    button.setAttribute('aria-pressed', String(isOptionActive));
    button.classList.toggle('active', isOptionActive);
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

/** Updates active styling for the Log and Backlog view controls. */
function updateViewTabs() {
  const folderSelected = activeCollectionView === 'logged' && activeCollectionId !== 'all';
  const collapsedView = folderSelected ? folderReturnView : activeCollectionView;
  document.querySelectorAll('.workspace-controls-container :is(.library-view-switcher, .collection-view-switcher) > [data-view]').forEach((button) => {
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
  if (!isReworkedCollection) folderDropdown?.classList.toggle('folder-active', Boolean(selectedFolder));
  folderButton.setAttribute('aria-label', selectedFolder ? `Folder: ${selectedFolder.name}` : 'Choose a folder');
  folderButton.title = selectedFolder ? `Folder: ${selectedFolder.name}` : 'Choose a folder';
  if (isReworkedCollection) folderButton.classList.toggle('is-active', Boolean(selectedFolder));
  const folderButtonLabel = !isReworkedCollection && folderButton.lastElementChild;
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
      ? 'menu-option level-3-styling'
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


/** Selects a library or folder and refreshes the collection view. */
function selectCollection(collectionId) {
  if (activeCollectionId === 'all' || activeCollectionView === 'watchlist') folderReturnView = activeCollectionView;
  activeCollectionId = collectionId;
  activeCollectionView = 'logged';
  collectionPage = 0;
  updateViewTabs();
  renderWithoutScrollCollapse();
  if (typeof updateNavbarPageContext === 'function') updateNavbarPageContext();
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
  if (typeof updateNavbarPageContext === 'function') updateNavbarPageContext();
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
  if (typeof updateNavbarPageContext === 'function') updateNavbarPageContext();
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
  if (!activeFilters.includes(entry.type)) return false;
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
  const typeWrapper = $('.workspace-type-menu-wrapper');
  if (typeWrapper) {
    const trigger = getWorkspaceFilterButton(typeWrapper);
    const activeTypes = activeFilters;
    typeWrapper.querySelectorAll('.menu-option').forEach((button) => {
      const selected = activeTypes.includes(button.dataset.filter);
      button.classList.toggle('active', selected);
      button.setAttribute('aria-pressed', String(selected));
      const iconName = mediaTypeIconName(button.dataset.filter);
      let optionIcon = button.querySelector(':scope > .icon, :scope > .masked-icon');
      if (optionIcon && !optionIcon.classList.contains('masked-icon')) {
        optionIcon.classList.add('masked-icon', 'workspace-type-option-icon');
        optionIcon.removeAttribute('src');
      }
      if (optionIcon) {
        const iconUrl = appIconUrl(iconName);
        optionIcon.dataset.icon = iconName;
        optionIcon.style.webkitMaskImage = `url("${iconUrl}")`;
        optionIcon.style.maskImage = `url("${iconUrl}")`;
        optionIcon.style.setProperty(
          '--app-icon-state-color',
          selected ? 'var(--workspace-type-highlight, var(--color-text-secondary))' : 'var(--color-text-secondary)',
        );
      }
    });
    const selectedOptions = [...typeWrapper.querySelectorAll('.menu-option')]
      .filter((button) => activeTypes.includes(button.dataset.filter));
    const selectedLabels = selectedOptions.map((button) => button.querySelector('.menu-option-label')?.textContent.trim());
    const allTypesSelected = workspaceMediaTypes.every((type) => activeTypes.includes(type));
    const accessibleLabel = allTypesSelected
      ? 'All'
      : selectedLabels.length ? selectedLabels.join(', ') : 'No types';
    const selectedIcons = allTypesSelected
      ? ['all']
      : selectedOptions.map((button) => mediaTypeIconName(button.dataset.filter));
    const typeStateClass = activeTypes.length === 1 ? `is-${String(activeTypes[0]).toLowerCase()}` : '';
    trigger.classList.remove('is-movie', 'is-show', 'is-game', 'is-book');
    if (typeStateClass) trigger.classList.add(typeStateClass);
    trigger.querySelector('.menu-button-text').innerHTML = allTypesSelected
      ? `<span class="icon workspace-type-icon masked-icon" data-icon="all" style="--app-icon-state-color: var(--color-text-secondary); -webkit-mask-image: url('${appIconUrl('all')}'); mask-image: url('${appIconUrl('all')}')" aria-hidden="true"></span>`
      : selectedIcons.map((iconName) => {
      const matchingOption = selectedOptions.find((button) => mediaTypeIconName(button.dataset.filter) === iconName);
      const type = matchingOption?.dataset.filter;
      const colorToken = {
        Movie: '--color-media-film',
        Show: '--color-media-show',
        Game: '--color-media-game',
        Book: '--color-media-book',
      }[type];
      let markup = appIconMarkup(iconName, 'icon workspace-type-icon');
      if (colorToken) {
        markup = markup.includes('style="')
          ? markup.replace('style="', `style="--app-icon-state-color: var(${colorToken}); `)
          : markup.replace(' aria-hidden="true"', ` style="--app-icon-state-color: var(${colorToken})" aria-hidden="true"`);
      }
      return markup;
    }).join('');
    trigger.setAttribute('aria-label', `Entry type: ${accessibleLabel}`);
    trigger.classList.toggle('active', !allTypesSelected);
  }
  document.querySelectorAll('.logged-collection-tool').forEach((control) => {
    control.hidden = isWatchlist;
  });

  const yearSelect = $('#release-year-filter');
  const yearFilterLabel = 'Filter by release year';
  yearSelect.setAttribute('aria-label', yearFilterLabel);
  const activeCollectionItems = isWatchlist ? watchlist : activeCollectionId === 'all'
    ? entries
    : [...entries, ...watchlist.filter((entry) => entryCollectionIds(entry).includes(activeCollectionId))];
  const availableYears = [...new Set(activeCollectionItems
    .map((entry) => String(entry.year || '')).filter(Boolean))]
    .sort((a, b) => Number(b) - Number(a));
  releaseYearFilter = releaseYearFilter.filter((year) => availableYears.includes(year));
  yearSelect.replaceChildren(...availableYears.map((year) => new Option(year, year, false, releaseYearFilter.includes(year))));
  yearSelect.classList.toggle('active', releaseYearFilter.length > 0);
  const yearReset = $('.workspace-year-menu-wrapper .workspace-filter-reset-button');
  if (yearReset) yearReset.disabled = releaseYearFilter.length === 0;
  syncWorkspaceFilterMenu(yearSelect);
  const valueSelect = $('#collection-value-filter');
  const activeValueFilter = isWatchlist ? priorityFilter : ratingFilter;
  const hasActiveValueFilter = isWatchlist ? priorityFilter.length > 0 : !isDefaultRatingRange(ratingFilter);
  const valueOptions = isWatchlist
    ? [5, 4, 3, 2, 1].map((priority) => new Option(`P${priority}`, String(priority), false, priorityFilter.includes(priority)))
    : Array.from({ length: 21 }, (_, index) => 100 - index * 5)
      .map((rating) => new Option(formatRatingChipValue(rating), String(rating), false, ratingFilter.includes(rating)));
  const valueLabel = isWatchlist ? 'priority' : 'rating';
  valueSelect.setAttribute('aria-label', `Filter by ${valueLabel}`);
  valueSelect.replaceChildren(...valueOptions);
  valueSelect.classList.toggle('active', hasActiveValueFilter);
  const valueReset = $('.workspace-ratings-menu-wrapper .workspace-filter-reset-button');
  if (valueReset) {
    valueReset.disabled = !hasActiveValueFilter;
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
  const sortReset = $('.workspace-sort-menu-wrapper .workspace-sort-reset-button');
  if (sortReset) sortReset.disabled = collectionSort === defaultSort;
  const resetAll = $('.workspace-reset-button');
  if (resetAll) {
    const hasActiveSettings = Boolean(
      activeFilters.length < workspaceMediaTypes.length || releaseYearFilter.length || hasActiveValueFilter || collectionSort !== defaultSort
    );
    resetAll.disabled = !hasActiveSettings;
    resetAll.classList.toggle('is-active', hasActiveSettings);
  }
  syncWorkspaceFilterMenu(sortSelect);
}

/** Treat the full 100-to-0 rating span as the unfiltered default. */
function isDefaultRatingRange(values) {
  return values.length === 2 && Math.min(...values) === 0 && Math.max(...values) === 100;
}

/** Checks whether an entry passes the active collection filters. */
function matchesCollectionFilters(entry, isWatchlist) {
  if (activeCollectionView === 'logged' && activeCollectionId !== 'all' && !entryCollectionIds(entry).includes(activeCollectionId)) return false;
  if (releaseYearFilter.length) {
    const year = Number(entry.year || 0);
    const minYear = Math.min(...releaseYearFilter.map(Number));
    const maxYear = Math.max(...releaseYearFilter.map(Number));
    if (year < minYear || year > maxYear) return false;
  }
  if (isWatchlist) {
    if (priorityFilter.length && !priorityFilter.includes(Number(entry.priority || 3))) return false;
    return true;
  }
  if (ratingFilter.length && !isDefaultRatingRange(ratingFilter)) {
    const score = Math.round(Number(latest(entry).score) * 10);
    const minRating = Math.min(...ratingFilter);
    const maxRating = Math.max(...ratingFilter);
    if (score < minRating || score > maxRating) return false;
  }
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

/** Returns every item matching the active workspace view and filters. */
function getFilteredCollectionItems() {
  const isWatchlist = activeCollectionView === 'watchlist';
  const showingFolder = !isWatchlist && activeCollectionId !== 'all';
  const items = isWatchlist ? watchlist : showingFolder
    ? [...entries, ...watchlist.filter((entry) => entryCollectionIds(entry).includes(activeCollectionId))]
    : entries;
  const query = $('.library-search-container > .search-input').value.trim().toLocaleLowerCase();

  return sortCollectionItems(
    items.filter((entry) => {
      const entryIsWatchlist = watchlist.includes(entry);
      return matchesCollectionSearch(entry, query) && matchesCollectionFilters(entry, entryIsWatchlist);
    }),
    isWatchlist,
  );
}

/** Updates page controls and counts for the visible collection. */
function updateCollectionPaginationControls() {
  const pagination = $('.workspace-pagination-container > .pagination-container');
  const status = pagination.querySelector('.pagination-text-container');
  pagination.hidden = false;
  status.firstElementChild.textContent = `${collectionPage + 1}`;
  status.lastElementChild.textContent = `${collectionPageCount}`;
  pagination.querySelector('.pagination-prev-button').disabled = collectionPage === 0;
  pagination.querySelector('.pagination-next-button').disabled = collectionPage >= collectionPageCount - 1;
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
  const cardLayout = document.createElement('div');
  cardLayout.className = 'entry-card-layout';
  const card = document.createElement('article');
  card.className = `${isReworkPreview ? 'entry-container banner-container' : 'workspace-content-entry'} level-2-styling entry ${isBacklogged ? 'is-backlogged' : 'is-logged'}`;
  if (isReworkPreview && entry.poster) {
    const posterSource = entry.poster;
    card.dataset.posterPaletteSource = posterSource;
    let paletteRequested = false;
    const requestCardPalette = () => {
      if (document.documentElement.dataset.entryPosterBackdrop !== 'on') return;
      if (paletteRequested) return;
      paletteRequested = true;
      getPosterPalette(posterSource).then((palette) => {
        if (!palette || !card.isConnected || card.dataset.posterPaletteSource !== posterSource) return;
        card.style.setProperty('--entry-poster-color-one', `rgb(${palette.pageOne.join(', ')})`);
        card.style.setProperty('--entry-poster-color-two', `rgb(${palette.pageTwo.join(', ')})`);
      });
    };
    card.addEventListener('pointerenter', requestCardPalette, { once: true });
    card.addEventListener('focusin', requestCardPalette, { once: true });
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
  let mediaIcon;
  if (isReworkPreview) {
    const mediaType = entry.type.toLowerCase();
    mediaIcon = document.createElement('span');
    mediaIcon.className = `text-chip-styling media-type-icon banner-type is-${mediaType}`;
    mediaIcon.setAttribute('role', 'img');
    mediaIcon.setAttribute('aria-label', entry.type);
    mediaIcon.innerHTML = appIconMarkup(mediaTypeIconName(entry.type), 'icon');
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
      year.innerHTML = appIconMarkup('release', 'icon banner-release-date-icon');
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
    date.innerHTML = appIconMarkup('watched', 'icon banner-log-date-icon');
    const dateLabel = document.createElement('span');
    dateLabel.className = 'banner-log-date-label';
    dateLabel.textContent = formatDate(watch.date);
    date.append(dateLabel);
    label.append(date);
  }
  if (isReworkPreview) {
    label.append(mediaIcon);
    if (entry.director) {
      const director = document.createElement('span');
      director.className = 'banner-director';
      director.textContent = `By ${entry.director}`;
      heading.append(director);
    }
    info.append(label, heading);
  } else {
    header.append(tag, label, title);
  }

  const meta = document.createElement('div');
  if (isReworkPreview) meta.className = 'banner-meta-layout';
  const fullscreen = iconButton(
    `Open ${entry.title} fullscreen`,
    'Fullscreen',
    () => openEntryFromCard(card, `#entry/${sourceView}/${encodeURIComponent(entry.id)}/full`),
    isReworkPreview ? 'action-fullscreen' : 'entry-open-fullscreen',
    isReworkPreview,
  );
  if (isReworkPreview) {
    fullscreen.classList.remove('level-2-styling');
    fullscreen.classList.add('text-chip-styling');
  }

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
    scoreValue.textContent = formatRatingChipValue(Number(watch.score) * 10);
    scoreValue.style.setProperty('--rating-color', scoreColor);
    const meterClass = isReworkPreview
      ? 'ratings-meter ratings-bar'
      : 'workspace-content-entry-detail-ratingsMeter ratingsMeter';
    score.append(scoreValue, createRatingMeter(scoreFill, scoreColor, meterClass));
    score.setAttribute('aria-label', `Rating ${Number(watch.score).toFixed(1)} out of 10`);
    if (isReworkPreview) {
      meta.append(score, fullscreen);
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
      meta.append(value, fullscreen);
    }
    else details.append(indicator);
  }

  if (isReworkPreview && !fullscreen.parentElement) meta.append(fullscreen);

  const actions = document.createElement('div');
  actions.className = 'entry-actions';
  const actionList = isBacklogged
    ? [['Edit', () => openDialog(entry.id, false, null, true, 'watchlist')], ['Folder', () => openFolderPicker(entry)], ['Remove', () => removeEntry(entry, true)]]
    : [['Edit', () => openDialog(entry.id, false, null, true)], ['Rewatch', () => openDialog(entry.id, true)], ['Folder', () => openFolderPicker(entry)], ['Remove', () => removeEntry(entry, false)]];

  actionList.forEach(([label, action]) => {
    const buttonLabel = label === 'Folder' ? `Add ${entry.title} to folder` : `${label} ${entry.title}`;
    const button = iconButton(buttonLabel, label, action, `action-${label.toLowerCase()}`, isReworkPreview);
    if (isReworkPreview) {
      button.classList.remove('level-2-styling');
      button.classList.add('level-3-styling');
    }
    if (label === 'Remove') button.classList.add('remove-button');
    actions.append(button);
  });

  if (isReworkPreview) {
    info.append(meta);
  } else {
    info.append(header, details);
  }
  const tools = document.createElement('div');
  tools.className = 'entry-card-tools';
  if (isReworkPreview) tools.append(...actions.children);
  else tools.append(actions, fullscreen);
  if (isReworkPreview) {
    tools.addEventListener('click', () => setEntryCardToolsOpen(cardLayout, false));
    card.append(info);
    cardLayout.append(card, tools);
    return cardLayout;
  }
  card.append(info, tools);
  return card;
}

/** Opens an entry with the shared transition when enabled. */
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
$('.library-search-container > .search-input').addEventListener('keydown', (event) => {
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
  $('.library-section').hidden = false;
  collection.replaceChildren();
  const isWatchlist = activeCollectionView === 'watchlist';
  renderCollectionPicker();
  updateCollectionTools(isWatchlist);
  const query = $('.library-search-container > .search-input').value.trim().toLocaleLowerCase();
  const sourceItems = isWatchlist ? watchlist : activeCollectionId === 'all'
    ? entries
    : [...entries, ...watchlist.filter((entry) => entryCollectionIds(entry).includes(activeCollectionId))];
  const shown = getFilteredCollectionItems();
  const watchlistEmpty = $('#watchlist-empty');
  const empty = $('#empty');
  const hasCollectionFilter = activeFilters.length < workspaceMediaTypes.length
    || releaseYearFilter.length > 0
    || (isWatchlist ? priorityFilter.length > 0 : !isDefaultRatingRange(ratingFilter));

  $('.workspace-create-entry-button').setAttribute('aria-label', isWatchlist ? 'Add to watchlist' : 'Log a watch');
  watchlistEmpty.hidden = !isWatchlist || sourceItems.length > 0 || Boolean(query) || hasCollectionFilter;
  empty.hidden = shown.length > 0 || !watchlistEmpty.hidden;
  if (query || hasCollectionFilter) {
    empty.textContent = 'No titles match your search or filters.';
  } else if (sourceItems.length) {
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
  renderStatsbar();
  if (isReworkedCollection) renderBanner();
}

// Listen on the whole library card so trackpad swipes work over the toolbar and cards.
$('.library-section').addEventListener('wheel', (event) => {
  if (isReworkedCollection) return;
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

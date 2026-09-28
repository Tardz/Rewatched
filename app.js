/** App module. */
// Top-level navigation, filters, banner controls, and startup.

const LIBRARY_SCROLL_KEY = 'rerun-library-scroll-position';
let libraryScrollPosition = Number(sessionStorage.getItem(LIBRARY_SCROLL_KEY)) || 0;

const themeToggle = $('#toggle-theme');

/** Updates the theme toggle to reflect the active theme. */
function syncThemeToggle() {
  const isLight = document.documentElement.dataset.theme === 'light';
  const switchTo = isLight ? 'dark' : 'light';
  const label = `Switch to ${switchTo} mode`;
  themeToggle.setAttribute('aria-pressed', String(isLight));
  themeToggle.setAttribute('aria-label', label);
  themeToggle.title = label;
  themeToggle.innerHTML = switchTo === 'dark'
    ? '<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.4 15.2A8.5 8.5 0 0 1 8.8 3.6 8.5 8.5 0 1 0 20.4 15.2Z" /></svg>'
    : '<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" /></svg>';
}

syncThemeToggle();
themeToggle.addEventListener('click', () => {
  themePreference = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  localStorage.setItem(THEME_KEY, themePreference);
  applyTheme();
  syncThemeToggle();
});
systemTheme.addEventListener?.('change', syncThemeToggle);
if (!systemTheme.addEventListener) systemTheme.addListener(syncThemeToggle);

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

/** Returns whether a URL hash points to an entry view. */
function isEntryHash(hash) {
  return hash.startsWith('#entry/');
}

/** Returns whether a URL hash points to a fullscreen entry page. */
function isFullscreenEntryHash(hash) {
  return isEntryHash(hash) && hash.endsWith('/full');
}

/** Stores the current collection scroll position for navigation. */
function rememberLibraryScrollPosition() {
  libraryScrollPosition = window.scrollY;
  sessionStorage.setItem(LIBRARY_SCROLL_KEY, String(libraryScrollPosition));
}

/** Restores the saved collection scroll position. */
function restoreLibraryScrollPosition() {
  requestAnimationFrame(() => {
    window.scrollTo(0, libraryScrollPosition);
  });
}

// Banner controls

$('#previous').addEventListener('click', () => {
  slideBanner(-1);
});

$('#next').addEventListener('click', () => {
  slideBanner(1);
});

/** Opens the entry currently featured in the banner. */
function openBannerEntry() {
  const entry = entries.slice(0, 5)[bannerIndex];
  if (entry) location.hash = `#entry/logged/${encodeURIComponent(entry.id)}`;
}

$('#banner').addEventListener('click', (event) => {
  if (event.target.closest('button')) return;
  openBannerEntry();
});

$('#banner').addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  if (event.target.closest('button')) return;
  event.preventDefault();
  openBannerEntry();
});

$('#banner').addEventListener('wheel', (event) => {
  if (Math.abs(event.deltaX) <= Math.abs(event.deltaY) || bannerEntries().length < 2) return;
  event.preventDefault();

  if (Date.now() - lastSwipeAt < 550 || bannerSliding) return;
  swipeDistance += event.deltaX;
  if (Math.abs(swipeDistance) < 55) return;

  const direction = Math.sign(swipeDistance);
  swipeDistance = 0;
  lastSwipeAt = Date.now();
  slideBanner(direction);
}, { passive: false });

/** Synchronizes banner rotation controls with the current setting. */
function syncRotationControls() {
  $('#pause').textContent = paused ? 'Play' : 'Pause';
  $('#pause').setAttribute('aria-label', paused ? 'Resume rotation' : 'Pause rotation');
  $('#auto-rotate').checked = !paused;
}

/** Enables or disables automatic banner rotation. */
function setRotation(enabled) {
  paused = !enabled;
  localStorage.setItem(ROTATION_KEY, String(enabled));
  syncRotationControls();
}

$('#pause').addEventListener('click', () => {
  setRotation(paused);
});

/** Opens the settings dialog. */
function openSettings() {
  syncRotationControls();
  $('#theme-mode').value = themePreference;
  $('#poster-background').checked = posterBackgroundEnabled;
  updateBackupSummary();
  $('#omdb-api-key').value = localStorage.getItem(OMDB_API_KEY) || '';
  $('#settings-dialog').showModal();
}

$('#open-settings').addEventListener('click', openSettings);
$('#open-storage-settings').addEventListener('click', openSettings);
$('#close-settings').addEventListener('click', () => $('#settings-dialog').close());
$('#theme-mode').addEventListener('change', (event) => {
  themePreference = event.currentTarget.value;
  localStorage.setItem(THEME_KEY, themePreference);
  applyTheme();
});
$('#poster-background').addEventListener('change', (event) => {
  posterBackgroundEnabled = event.currentTarget.checked;
  localStorage.setItem(POSTER_BACKGROUND_KEY, String(posterBackgroundEnabled));
  document.documentElement.dataset.posterBackground = posterBackgroundEnabled ? 'on' : 'off';
});
$('#save-omdb-key').addEventListener('click', () => {
  const key = $('#omdb-api-key').value.trim();
  if (!key) {
    localStorage.removeItem(OMDB_API_KEY);
    $('#omdb-key-status').textContent = 'OMDb lookups are disabled. Previously saved details remain with their entries.';
    return;
  }

  localStorage.setItem(OMDB_API_KEY, key);
  $('#omdb-key-status').textContent = 'Key saved. OMDb is contacted only when you look up details for an entry.';
});
$('#detail-back').addEventListener('click', () => { location.hash = '#library'; });
$('#detail-close').addEventListener('click', () => { location.hash = '#library'; });
$('#detail-expand').addEventListener('click', () => {
  if (location.hash.startsWith('#entry/') && !location.hash.endsWith('/full')) {
    const detail = $('#detail');
    detail.classList.remove('is-expanding');
    // Reflow so the transition can be replayed when opening another entry.
    void detail.offsetWidth;
    detail.classList.add('is-expanding');
    location.hash = `${location.hash}/full`;
    window.setTimeout(() => detail.classList.remove('is-expanding'), 300);
  }
});
let fullscreenBackSwipe = 0;
let fullscreenBackSwipeTimer;
document.addEventListener('wheel', (event) => {
  if (!location.hash.endsWith('/full')) {
    fullscreenBackSwipe = 0;
    return;
  }

  if (event.deltaX >= 0 || Math.abs(event.deltaX) < Math.abs(event.deltaY) * 1.2) {
    fullscreenBackSwipe = 0;
    return;
  }

  fullscreenBackSwipe += event.deltaX;
  clearTimeout(fullscreenBackSwipeTimer);
  fullscreenBackSwipeTimer = setTimeout(() => { fullscreenBackSwipe = 0; }, 220);
  if (fullscreenBackSwipe <= -90) {
    fullscreenBackSwipe = 0;
    $('#detail-back').click();
  }
}, { passive: true });
$('#detail').addEventListener('click', (event) => {
  if (event.target === event.currentTarget && !event.currentTarget.classList.contains('is-fullscreen')) {
    location.hash = '#library';
  }
});

// Escape closes whichever popup is currently open, or leaves an entry page.
document.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'n') {
    event.preventDefault();
    openDialog();
    return;
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
    event.preventDefault();
    showStorageComparison();
    return;
  }
  if (event.key !== 'Escape') return;

  const openDialogs = [...document.querySelectorAll('dialog[open]')];
  if (openDialogs.length) {
    event.preventDefault();
    openDialogs.at(-1).close();
    return;
  }

  if (location.hash.startsWith('#entry/')) {
    event.preventDefault();
    location.hash = '#library';
  }
});
$('#auto-rotate').addEventListener('change', (event) => {
  setRotation(event.currentTarget.checked);
});


// Filters and view tabs

document.querySelectorAll('.media-type-filter').forEach((button) => {
  button.addEventListener('click', () => {
    activeFilter = button.dataset.filter;
    collectionPage = 0;

    document.querySelectorAll('.media-type-filter').forEach((item) => {
      item.classList.toggle('active', item === button);
    });

    render();
  });
});

document.querySelectorAll('.library-view-switcher, .media-type-filter-group').forEach((group) => {
  group.addEventListener('pointerleave', () => {
    if (group.contains(document.activeElement)) document.activeElement.blur();
  });
});

const librarySearch = $('#library-search');
const librarySearchBox = $('.library-search');
const librarySearchToggle = $('#library-search-toggle');
const librarySearchClear = $('#library-search-clear');

document.addEventListener('keydown', (event) => {
  if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'l'
    || location.hash.startsWith('#entry/')
    || document.querySelector('dialog[open]')) return;

  event.preventDefault();
  event.stopPropagation();
  librarySearchBox.classList.remove('is-escape-collapsed');
  librarySearchBox.classList.add('is-keyboard-expanded');
  librarySearch.focus();
  updateLibrarySearchExpandedState();
}, true);

/** Keeps the search control expanded while it contains a query or focus. */
function updateLibrarySearchExpandedState() {
  const hasQuery = librarySearch.value.length > 0;
  librarySearchBox.classList.toggle('has-query', hasQuery);
  librarySearchClear.hidden = !hasQuery;
  const expanded = hasQuery || (!librarySearchBox.classList.contains('is-escape-collapsed')
    && librarySearchBox.matches(':hover, :focus-within'));
  librarySearchToggle.setAttribute('aria-expanded', String(expanded));
  librarySearchToggle.setAttribute('aria-label', 'Focus search field');
  librarySearchToggle.title = 'Search titles';
}

librarySearchToggle.addEventListener('click', () => {
  librarySearchBox.classList.remove('is-escape-collapsed');
  librarySearch.focus();
});
librarySearchBox.addEventListener('pointerenter', updateLibrarySearchExpandedState);
librarySearchBox.addEventListener('pointerleave', () => {
  librarySearchBox.classList.remove('is-escape-collapsed');
  updateLibrarySearchExpandedState();
});
librarySearchBox.addEventListener('focusin', updateLibrarySearchExpandedState);
librarySearchBox.addEventListener('focusout', () => {
  librarySearchBox.classList.remove('is-keyboard-expanded');
  window.setTimeout(updateLibrarySearchExpandedState);
});
librarySearch.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  event.preventDefault();
  librarySearchBox.classList.add('is-escape-collapsed');
  librarySearch.blur();
  updateLibrarySearchExpandedState();
});

librarySearch.addEventListener('input', () => {
  updateLibrarySearchExpandedState();
  collectionPage = 0;
  render();
});

librarySearchClear.addEventListener('click', () => {
  librarySearch.value = '';
  librarySearch.dispatchEvent(new Event('input', { bubbles: true }));
  librarySearch.focus();
});

$('#add-collection').addEventListener('click', createCollection);
let collectionResizeFrame = 0;
window.addEventListener('resize', () => {
  cancelAnimationFrame(collectionResizeFrame);
  collectionResizeFrame = requestAnimationFrame(handleCollectionResize);
});
$('#collection-page-previous').addEventListener('click', () => changeCollectionPage(-1));
$('#collection-page-next').addEventListener('click', () => changeCollectionPage(1));
$('#watched-year-filter').addEventListener('change', (event) => {
  watchedYearFilter = event.currentTarget.value;
  collectionPage = 0;
  renderCollection();
});
$('#rating-filter').addEventListener('change', (event) => {
  ratingFilter = event.currentTarget.value;
  collectionPage = 0;
  renderCollection();
});
$('#collection-sort').addEventListener('change', (event) => {
  collectionSort = event.currentTarget.value;
  collectionPage = 0;
  renderCollection();
});
$('#reset-collection-filter-sort').addEventListener('click', () => {
  watchedYearFilter = 'all';
  ratingFilter = 'all';
  collectionSort = activeView === 'watchlist' ? 'priority-desc' : 'watched-desc';
  activeFilter = 'all';
  collectionPage = 0;
  $('#library-search').value = '';
  document.querySelectorAll('.media-type-filter').forEach((button) => button.classList.toggle('active', button.dataset.filter === 'all'));
  render();
});
window.addEventListener('hashchange', (event) => {
  const previousHash = new URL(event.oldURL).hash;
  const wasViewingEntry = isEntryHash(previousHash);
  const isViewingEntry = isEntryHash(location.hash);
  const wasFullscreen = isFullscreenEntryHash(previousHash);
  const isFullscreen = isFullscreenEntryHash(location.hash);

  if (isViewingEntry && !wasViewingEntry) rememberLibraryScrollPosition();
  // Do not rebuild the collection when opening or closing a hover entry.
  // Replacing its cards is what resets the collection's own scrollTop.
  if (isViewingEntry || wasViewingEntry) renderDetail();
  else render();
  if (isFullscreen) window.scrollTo(0, 0);
  else if (wasViewingEntry && (!isViewingEntry || wasFullscreen)) restoreLibraryScrollPosition();
});

document.querySelectorAll('.library-view-option').forEach((button) => {
  button.addEventListener('click', () => {
    const folderSelected = activeView === 'logged' && activeCollectionId !== 'all';
    activeView = folderSelected
      ? button.dataset.view
      : button.dataset.view === activeView
        ? (activeView === 'logged' ? 'watchlist' : 'logged')
        : button.dataset.view;
    if (activeView === 'logged') activeCollectionId = 'all';
    collectionPage = 0;
    updateViewTabs();
    resetBannerTimer();
    $('#banner').classList.remove('is-sliding');
    render();
    requestAnimationFrame(() => {
      $('#banner').classList.add('is-sliding');
      setTimeout(() => $('#banner').classList.remove('is-sliding'), 600);
    });
  });
});


// Automatic banner rotation and initial render

let bannerTimer;
/** Restarts the banner rotation timer. */
function resetBannerTimer() {
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => {
    if (!paused && !document.hidden && !$('#banner').hidden && bannerEntries().length > 1) {
      slideBanner(1);
    }
    resetBannerTimer();
  }, 6000);
}
resetBannerTimer();

populateYears();
syncRotationControls();
initializeFileStorage().finally(render);
/** App entry point: wires UI events, navigation, settings, keyboard shortcuts, and startup behavior. */

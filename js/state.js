/** State module. */
// Storage and initial state

const STORAGE_KEY = 'rerun-starter-entries';
const WATCHLIST_KEY = 'rerun-starter-watchlist';
const COLLECTIONS_KEY = 'rerun-starter-collections';
const GOOGLE_SEARCH_ID_KEY = 'rerun-google-search-id';
const ROTATION_KEY = 'rerun-banner-rotation';
const OMDB_API_KEY = 'rerun-omdb-api-key';
const THEME_KEY = 'rerun-theme-mode';
const POSTER_BACKGROUND_KEY = 'rerun-poster-background';
const systemTheme = matchMedia('(prefers-color-scheme: light)');
let themePreference = localStorage.getItem(THEME_KEY) || 'system';
let posterBackgroundEnabled = localStorage.getItem(POSTER_BACKGROUND_KEY) !== 'false';

/** Applies the selected light or dark theme to the document. */
function applyTheme() {
  document.documentElement.dataset.theme = themePreference === 'system'
    ? systemTheme.matches ? 'light' : 'dark'
    : themePreference;
}

applyTheme();
document.documentElement.dataset.posterBackground = posterBackgroundEnabled ? 'on' : 'off';
/** Applies the operating system theme when the system preference changes. */
const handleSystemThemeChange = () => {
  if (themePreference === 'system') applyTheme();
};
if (systemTheme.addEventListener) systemTheme.addEventListener('change', handleSystemThemeChange);
else systemTheme.addListener(handleSystemThemeChange);

let entries = [];
let watchlist = [];
let customCollections = [];

/** Orders an entry’s watch records chronologically. */
function sortEntryWatches(entry) {
  if (!Array.isArray(entry.watches)) return;

  const dateKey = (date) => {
    const match = String(date || '').match(/^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/);
    if (!match) return '';
    return `${match[1]}-${match[2] || '00'}-${match[3] || '00'}`;
  };

  // Keep the timeline newest first, regardless of when a watch was entered.
  entry.watches.sort((a, b) => dateKey(b.date).localeCompare(dateKey(a.date)));
}

try {
  entries = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  watchlist = JSON.parse(localStorage.getItem(WATCHLIST_KEY) || '[]');
  customCollections = JSON.parse(localStorage.getItem(COLLECTIONS_KEY) || '[]');
  entries.forEach(sortEntryWatches);
} catch (error) {
  console.warn('Could not read saved library.', error);
}

/** Finds the first document element matching a CSS selector. */
const $ = (selector) => document.querySelector(selector);

/** Creates a percentage meter with the color for its rating. */
function createRatingMeter(fill, color, className = 'rating-meter') {
  const meter = document.createElement('span');
  meter.className = className;
  meter.setAttribute('aria-hidden', 'true');
  const progress = document.createElement('span');
  progress.className = 'rating-meter-fill';
  progress.style.width = fill;
  progress.style.backgroundColor = color;
  meter.append(progress);
  return meter;
}

const form = $('#watch-form');
const dialog = $('#watch-dialog');
const posterDialog = $('#poster-dialog');
const collection = $('#collection');
let googleSearchReady = false;
let loadedGoogleSearchId = null;
let googleSearchLoading = false;

let bannerIndex = 0;
let editingId = null;
let activeFilter = 'all';
let activeView = 'logged';
let watchedYearFilter = 'all';
let ratingFilter = 'all';
let collectionSort = 'watched-desc';
let activeCollectionId = 'all';
const savedRotation = localStorage.getItem(ROTATION_KEY);
let paused = savedRotation === null
  ? matchMedia('(prefers-reduced-motion: reduce)').matches
  : savedRotation === 'false';
let bannerSliding = false;
let swipeDistance = 0;
let lastSwipeAt = 0;


// Helpers

/** Marks the current app state as changed and persists it when possible. */
function save() {
  entries.forEach(sortEntryWatches);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  localStorage.setItem(WATCHLIST_KEY, JSON.stringify(watchlist));
  localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(customCollections));
  // Keep the Electron quit prompt and save indicator aware of folder changes too.
  window.__rewatchedDirty = true;
  queueFileSave();
}

/** Commits form edits while preserving the prior entry and watch data. */
function saveFormChanges(previousEntries, previousWatchlist) {
  try {
    save();
    return true;
  } catch (error) {
    entries = previousEntries;
    watchlist = previousWatchlist;
    $('#poster-upload-status').textContent =
      'Could not save. Browser storage may be full; try a smaller image.';
    console.warn('Could not save library.', error);
    return false;
  }
}

/** Formats a date value for display. */
function formatDate(date) {
  if (!date) {
    return 'Unknown date';
  }
  if (/^\d{4}$/.test(date)) return date;
  if (/^\d{4}-\d{2}$/.test(date)) {
    return new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric' })
      .format(new Date(`${date}-01T12:00:00`));
  }

  const formatter = new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return formatter.format(new Date(`${date}T12:00:00`));
}

/** Returns the most recent watch record for an entry. */
function latest(entry) {
  return entry.watches[0];
}

/** Gets the year associated with a watch record. */
function watchYear(watch) {
  return /^\d{4}/.exec(watch?.date || '')?.[0] || '';
}

/** Returns the collection IDs assigned to an entry. */
function entryCollectionIds(entry) {
  if (Array.isArray(entry.collectionIds)) return entry.collectionIds;
  return entry.collectionId ? [entry.collectionId] : [];
}
/** Defines shared application state, persistence helpers, and common data formatting. */

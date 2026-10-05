/** State module. */
// Storage and initial state

const STORAGE_KEY = 'rerun-starter-entries';
const WATCHLIST_KEY = 'rerun-starter-watchlist';
const COLLECTIONS_KEY = 'rerun-starter-collections';
const GOOGLE_SEARCH_ID_KEY = 'rerun-google-search-id';
const ROTATION_KEY = 'rerun-banner-rotation';
const OMDB_API_KEY = 'rerun-omdb-api-key';
const OMDB_DAILY_USAGE_KEY = 'rerun-omdb-daily-usage';
const THEME_KEY = 'rerun-theme-mode';
const POSTER_BACKGROUND_KEY = 'rerun-poster-background';
const POSTER_BACKGROUND_STRENGTH_KEY = 'rerun-poster-background-strength';
const TACTILE_DASHBOARD_KEY = 'rerun-tactile-dashboard';
const GLASS_SURFACE_OPACITY_KEY = 'rerun-glass-surface-opacity';
const GLASS_TRANSPARENCY_KEY = 'rerun-glass-transparency';
const REDUCE_ANIMATIONS_KEY = 'rerun-reduce-animations';
const ICON_STYLE_KEY = 'rerun-icon-style';
const COLORED_ICONS_KEY = 'rerun-colored-icons';
const systemTheme = matchMedia('(prefers-color-scheme: light)');
const reduceMotionPreference = matchMedia('(prefers-reduced-motion: reduce)');
let themePreference = localStorage.getItem(THEME_KEY) || 'system';
let posterBackgroundEnabled = localStorage.getItem(POSTER_BACKGROUND_KEY) !== 'false';
const savedPosterBackgroundStrength = Number(localStorage.getItem(POSTER_BACKGROUND_STRENGTH_KEY));
let posterBackgroundStrength = Number.isFinite(savedPosterBackgroundStrength)
  ? Math.round(Math.max(0, Math.min(100, savedPosterBackgroundStrength)) / 5) * 5
  : 20;
let tactileDashboardEnabled = localStorage.getItem(TACTILE_DASHBOARD_KEY) !== 'false';
const savedGlassSurfaceOpacity = Number(localStorage.getItem(GLASS_SURFACE_OPACITY_KEY));
let glassSurfaceOpacity = Number.isFinite(savedGlassSurfaceOpacity)
  ? Math.max(60, Math.min(100, Math.round(savedGlassSurfaceOpacity / 5) * 5))
  : 80;
let glassTransparencyEnabled = localStorage.getItem(GLASS_TRANSPARENCY_KEY) !== 'false';
const savedReduceAnimations = localStorage.getItem(REDUCE_ANIMATIONS_KEY);
let reduceAnimationsEnabled = savedReduceAnimations === null
  ? reduceMotionPreference.matches
  : savedReduceAnimations === 'true';
const savedIconStyle = localStorage.getItem(ICON_STYLE_KEY);
const savedColorToggle = localStorage.getItem(COLORED_ICONS_KEY);
const fixedIconStyle = document.documentElement.dataset.fixedIconStyle;
let iconStylePreference = fixedIconStyle || savedIconStyle || (savedColorToggle === 'false' ? 'black' : 'color');
if (!['color', 'black', 'filled', 'original'].includes(iconStylePreference)) iconStylePreference = 'color';

const APP_ICON_FILES = {
  settings: { color: 'settings.png', black: 'settings.png', filled: 'setting.png' },
  light_mode: { color: 'light_mode.png', black: 'light_mode.png', filled: 'dark-mode.png' },
  dark_mode: { color: 'dark_mode.png', black: 'dark_mode.png', filled: 'dark-mode.png' },
  save: { color: 'save.png', black: 'save.png', filled: 'save.png' },
  history: { color: 'history.png', black: 'history.png', filled: 'history.png' },
  github: { color: 'github.png', black: 'github.png', filled: 'github.png' },
  library: { color: 'Library.png', black: 'library.png', filled: 'library.png' },
  statistics: { color: 'piechart.png', black: 'piechart.png', filled: 'piechart.png' },
  folder: { color: 'folder.png', black: 'folder.png', filled: 'folder.png' },
  'folder-action': { color: 'folder.png', black: 'folder.png', filled: 'folder.png' },
  search: { color: 'search.png', black: 'search.png', filled: 'search.png' },
  all: { color: 'all.png', black: 'all.png', filled: 'all.png' },
  movie: { color: 'dvd.png', black: 'dvd.png', filled: 'disc.png' },
  show: { color: 'tv.png', black: 'tv.png', filled: 'tv.png' },
  game: { color: 'game-controller.png', black: 'game-controller.png', filled: 'game-controller.png' },
  book: { color: 'book.png', black: 'books.png', filled: 'book.png' },
  play: { black: 'play.png' },
  pause: { black: 'pause.png' },
  'arrow-left': { black: 'arrow-left.png', filled: 'left.png' },
  'arrow-right': { black: 'arrow-right.png', filled: 'right.png' },
};

const APP_ICON_ORIGINALS = {
  settings: '<path d="M10.5 2.7h3l.5 2.1a7.8 7.8 0 0 1 1.8.8l1.9-1.1 2.1 2.1-1.1 1.9a7.8 7.8 0 0 1 .8 1.8l2.1.5v3l-2.1.5a7.8 7.8 0 0 1-.8 1.8l1.1 1.9-2.1 2.1-1.9-1.1a7.8 7.8 0 0 1-1.8.8l-.5 2.1h-3l-.5-2.1a7.8 7.8 0 0 1-1.8-.8l-1.9 1.1-2.1-2.1 1.1-1.9a7.8 7.8 0 0 1-.8-1.8l-2.1-.5v-3l2.1-.5a7.8 7.8 0 0 1 .8-1.8L4.2 6.6l2.1-2.1 1.9 1.1a7.8 7.8 0 0 1 1.8-.8z"/><circle cx="12" cy="12" r="3"/>',
  light_mode: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>',
  dark_mode: '<path d="M20.4 15.2A8.5 8.5 0 0 1 8.8 3.6 8.5 8.5 0 1 0 20.4 15.2Z"/>',
  save: '<path d="M5 3h12l4 4v14H3V5a2 2 0 0 1 2-2Z"/><path d="M7 3v6h10V3M7 21v-8h10v8M9 16h6"/>',
  history: '<path d="M3 8a9 9 0 1 1-.2 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
  github: '<path fill="currentColor" d="M12 .8a11.2 11.2 0 0 0-3.54 21.83c.56.1.77-.24.77-.54v-2.1c-3.14.68-3.8-1.33-3.8-1.33-.51-1.3-1.25-1.65-1.25-1.65-1.03-.7.08-.69.08-.69 1.14.08 1.74 1.17 1.74 1.17 1.01 1.73 2.65 1.23 3.3.94.1-.73.4-1.23.72-1.51-2.5-.28-5.13-1.25-5.13-5.56 0-1.23.44-2.24 1.16-3.03-.12-.29-.5-1.43.11-2.98 0 0 .95-.3 3.08 1.16a10.7 10.7 0 0 1 5.6 0c2.13-1.45 3.08-1.16 3.08-1.16.61 1.55.23 2.69.11 2.98.72.79 1.16 1.8 1.16 3.03 0 4.32-2.63 5.27-5.14 5.55.41.36.77 1.03.77 2.08v3.1c0 .3.2.65.78.54A11.2 11.2 0 0 0 12 .8Z"/>',
  library: '<path d="M4 5h3v14H4zM10.5 3.5h3V19h-3zM17 6h3v13h-3zM3 20h18"/>',
  statistics: '<circle cx="12" cy="12" r="9"/><path d="M12 12V3M12 12l7.8-4.5"/>',
  folder: '<path d="M3.5 10V7a1.5 1.5 0 0 1 1.5-1.5h4.3l2 2H19a1.5 1.5 0 0 1 1.5 1.5v1"/><path d="M4.5 10h16a1.5 1.5 0 0 1 1.4 2l-2.7 7a1.5 1.5 0 0 1-1.4 1H3.3a1.5 1.5 0 0 1-1.4-2l2.7-7A1.5 1.5 0 0 1 6 10"/>',
  'folder-action': '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2h6.5A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5z"/>',
  search: '<circle cx="10.8" cy="10.8" r="6.3"/><path d="m15.5 15.5 4.2 4.2"/>',
  all: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  movie: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.2"/><path d="M7.4 7.4a6.5 6.5 0 0 1 3-1.7M16.6 16.6a6.5 6.5 0 0 1-3 1.7"/>',
  show: '<path d="M7 3.5 12 7l5-3.5"/><rect x="3" y="7" width="18" height="13" rx="2"/><rect x="5.5" y="9.5" width="10" height="8" rx="1"/><circle cx="18.2" cy="12" r=".8"/><circle cx="18.2" cy="15.5" r=".8"/>',
  game: '<path d="M7 8h10a4 4 0 0 1 3.9 3.1l1 4.3a2.6 2.6 0 0 1-4.3 2.5l-2.2-2H8.6l-2.2 2a2.6 2.6 0 0 1-4.3-2.5l1-4.3A4 4 0 0 1 7 8Z"/><path d="M7 10.5v4m-2-2h4m7-1h.01M18 14h.01"/>',
  book: '<path d="M4 4.5h5.5A3.5 3.5 0 0 1 13 8v12a3.5 3.5 0 0 0-3.5-3.5H4z"/><path d="M20 4.5h-3A4 4 0 0 0 13 8v12a3.5 3.5 0 0 1 3.5-3.5H20z"/>',
  pause: '<rect x="6" y="4" width="4.5" height="16" rx="2.25"/><rect x="13.5" y="4" width="4.5" height="16" rx="2.25"/>',
  play: '<path d="M7.25 5.1c0-.88.96-1.42 1.72-.96l11.1 6.72a1.32 1.32 0 0 1 0 2.28l-11.1 6.72a1.12 1.12 0 0 1-1.72-.96z"/>',
};

const ORIGINAL_ICON_TEXT = {
  'arrow-left': '←',
  'arrow-right': '→',
};

/** Returns the PNG path for an app icon in the selected palette. */
function appIconPath(name) {
  const palettes = APP_ICON_FILES[name];
  if (!palettes) return '';
  const palette = palettes[iconStylePreference] ? iconStylePreference : 'black';
  return `assets/icons/${palette}/${palettes[palette]}`;
}

/** Resolves an icon asset relative to the running app page. */
function appIconUrl(name) {
  return new URL(appIconPath(name), document.baseURI).href;
}

/** Creates the original inline icon or text arrow for compatibility mode. */
function originalIconMarkup(name, className = 'icon app-icon', originalText = '') {
  if (originalText || ORIGINAL_ICON_TEXT[name]) {
    const text = originalText || ORIGINAL_ICON_TEXT[name];
    return `<span class="${className}" data-app-icon="${name}" data-app-icon-original-text="${text}" aria-hidden="true">${text}</span>`;
  }
  return `<svg class="${className}" data-app-icon="${name}" viewBox="0 0 24 24" aria-hidden="true">${APP_ICON_ORIGINALS[name] || ''}</svg>`;
}

/** Creates markup for an icon image that follows the selected icon style. */
function appIconMarkup(name, className = 'icon app-icon') {
  if (iconStylePreference === 'original') return originalIconMarkup(name, className);
  if (iconStylePreference === 'filled') {
    const url = appIconUrl(name);
    return `<span class="${className} filledIcon filled-icon" data-app-icon="${name}" style="-webkit-mask-image: url('${url}'); mask-image: url('${url}')" aria-hidden="true"></span>`;
  }
  return `<img class="${className}" data-app-icon="${name}" src="${appIconPath(name)}" alt="" aria-hidden="true">`;
}

/** Maps stored media names to the matching shared type icon. */
function mediaTypeIconName(type) {
  return ({ movie: 'movie', film: 'movie', show: 'show', game: 'game', book: 'book' })[
    String(type || '').toLowerCase()
  ] || 'movie';
}

/** Creates a stable tint hue for a category tag. */
function categoryHueForName(category) {
  let hue = 0;
  for (const character of String(category || '').toLocaleLowerCase()) {
    hue = (hue * 31 + character.codePointAt(0)) % 360;
  }
  return hue;
}

/** Creates a tinted Filled icon element from the PNG's alpha mask. */
function createFilledIconElement(name, className, originalText = '', hidden = false) {
  const replacement = document.createElement('span');
  replacement.className = `${className} filledIcon filled-icon`;
  replacement.dataset.appIcon = name;
  if (originalText) replacement.dataset.appIconOriginalText = originalText;
  const url = `url("${appIconUrl(name)}")`;
  replacement.style.webkitMaskImage = url;
  replacement.style.maskImage = url;
  replacement.setAttribute('aria-hidden', 'true');
  if (hidden) replacement.hidden = true;
  return replacement;
}

/** Switches existing icon nodes between PNG, mask, and original inline forms. */
function refreshAppIcons() {
  document.querySelectorAll('[data-app-icon]').forEach((icon) => {
    const name = icon.dataset.appIcon;
    const isOriginal = iconStylePreference === 'original';
    const isFilled = iconStylePreference === 'filled';
    const isFilledNode = icon.classList.contains('filledIcon') || icon.classList.contains('filled-icon');
    const iconClassName = icon.className.baseVal || icon.className;
    const nonFilledClassName = iconClassName.replace(/\b(?:filledIcon|filled-icon)\b/g, '').trim();
    if (isOriginal && (icon.tagName === 'IMG' || isFilledNode)) {
      const originalText = icon.dataset.appIconOriginalText || ORIGINAL_ICON_TEXT[name];
      const replacement = originalText
        ? document.createElement('span')
        : document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      replacement.className = nonFilledClassName;
      replacement.dataset.appIcon = name;
      if (originalText) {
        replacement.dataset.appIconOriginalText = originalText;
        replacement.textContent = originalText;
      } else {
        replacement.setAttribute('viewBox', '0 0 24 24');
        replacement.innerHTML = APP_ICON_ORIGINALS[name] || '';
      }
      replacement.setAttribute('aria-hidden', 'true');
      if (icon.hidden) replacement.hidden = true;
      icon.replaceWith(replacement);
      return;
    }
    if (isFilled && !isFilledNode) {
      const replacement = createFilledIconElement(
        name,
        nonFilledClassName,
        icon.dataset.appIconOriginalText,
        icon.hidden,
      );
      icon.replaceWith(replacement);
      return;
    }
    if (!isOriginal && !isFilled && icon.tagName !== 'IMG') {
      const replacement = document.createElement('img');
      replacement.className = nonFilledClassName;
      replacement.dataset.appIcon = name;
      if (icon.dataset.appIconOriginalText) replacement.dataset.appIconOriginalText = icon.dataset.appIconOriginalText;
      replacement.src = appIconPath(name);
      replacement.alt = '';
      replacement.setAttribute('aria-hidden', 'true');
      if (icon.hidden) replacement.hidden = true;
      icon.replaceWith(replacement);
      return;
    }
    if (!isOriginal && !isFilled && icon.tagName === 'IMG') icon.src = appIconPath(name);
    if (isFilled && isFilledNode) {
      const url = `url("${appIconUrl(name)}")`;
      icon.style.webkitMaskImage = url;
      icon.style.maskImage = url;
    }
  });
  document.documentElement.dataset.iconPalette = iconStylePreference === 'color' ? 'color' : 'black';
  document.documentElement.dataset.iconStyle = iconStylePreference;
}

/** Applies the selected light or dark theme to the document. */
function applyTheme() {
  document.documentElement.dataset.theme = themePreference === 'system'
    ? systemTheme.matches ? 'light' : 'dark'
    : themePreference;
}

applyTheme();
document.documentElement.dataset.posterBackground = posterBackgroundEnabled ? 'on' : 'off';
document.documentElement.style.setProperty('--poster-background-strength', `${posterBackgroundStrength}%`);
document.documentElement.dataset.themeGlass = tactileDashboardEnabled ? 'on' : 'off';
document.documentElement.style.setProperty('--glass-surface-opacity', `${glassSurfaceOpacity}%`);
document.documentElement.dataset.glassTransparency = glassTransparencyEnabled ? 'on' : 'off';
document.documentElement.dataset.glassOpaque = !glassTransparencyEnabled || glassSurfaceOpacity === 100 ? 'on' : 'off';
document.documentElement.dataset.reduceAnimations = reduceAnimationsEnabled ? 'on' : 'off';
refreshAppIcons();
/** Applies the operating system theme when the system preference changes. */
const handleSystemThemeChange = () => {
  if (themePreference === 'system') applyTheme();
};
if (systemTheme.addEventListener) systemTheme.addEventListener('change', handleSystemThemeChange);
else systemTheme.addListener(handleSystemThemeChange);

let entries = [];
let watchlist = [];
let customCollections = [];
let pendingDetailWatchSelection = null;

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

/** Returns today’s OMDb request count, using the device’s local calendar day. */
function getOmdbCallsToday() {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  try {
    const usage = JSON.parse(localStorage.getItem(OMDB_DAILY_USAGE_KEY) || 'null');
    return usage?.date === today ? Math.max(0, Number(usage.count) || 0) : 0;
  } catch {
    return 0;
  }
}

/** Refreshes the OMDb usage count shown in Settings. */
function updateOmdbCallCount() {
  const callsToday = getOmdbCallsToday();
  const count = $('#omdb-calls-today');
  if (count) count.textContent = String(callsToday);
  const lookupButton = $('#lookup-title-details');
  if (lookupButton) {
    lookupButton.title = `Look up movie or show details with OMDb.\nAPI calls made today: ${callsToday}`;
  }
}

updateOmdbCallCount();

/** Records an OMDb request for today and updates the Settings display. */
function recordOmdbApiCall() {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const count = getOmdbCallsToday() + 1;
  localStorage.setItem(OMDB_DAILY_USAGE_KEY, JSON.stringify({ date: today, count }));
  updateOmdbCallCount();
}

/** Creates a percentage meter with the color for its rating. */
function createRatingMeter(fill, color, className = 'ratingsMeter') {
  const meter = document.createElement('span');
  meter.className = className;
  meter.classList.add('ratingsMeter', 'rating-meter'); // Keep the old meter hook until the live CSS is migrated.
  meter.setAttribute('aria-hidden', 'true');
  const progress = document.createElement('span');
  progress.className = 'ratingFill';
  progress.style.width = fill;
  progress.style.backgroundColor = color;
  meter.style.setProperty('--rating-color', color);
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
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(watchlist));
    localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(customCollections));
  } catch (error) {
    // A linked JSON file (or the IndexedDB recovery copy) can hold more data
    // than the browser's small localStorage quota.
    if (typeof storageFileName === 'undefined' || storageFileName === 'Browser Vault') throw error;
    console.warn('Could not update the localStorage copy; file storage will continue.', error);
  }
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

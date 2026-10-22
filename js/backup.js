/** Backup module. */
// Portable JSON backups for entries and the watchlist.

let selectedBackup = null;
let selectedBackupFileName = '';
let backupStatusTimer = null;
let backupSummarySourceObserver = null;

/** Shows a backup result with its matching status color. */
function setBackupStatus(message, type = 'warning', detail = message) {
  const status = $('#backup-status');
  clearTimeout(backupStatusTimer);
  status.textContent = message;
  status.hidden = !message;
  if (message) {
    status.dataset.status = type;
    status.title = detail;
    status.setAttribute('aria-label', detail);
  } else {
    delete status.dataset.status;
    status.removeAttribute('title');
    status.removeAttribute('aria-label');
  }
  if (message) {
    backupStatusTimer = setTimeout(() => {
      if (status.textContent !== message) return;
      status.textContent = '';
      status.hidden = true;
      delete status.dataset.status;
      status.removeAttribute('title');
      status.removeAttribute('aria-label');
    }, 4000);
  }
}

/** Updates the backup dialog with a summary of the current data. */
function updateBackupSummary() {
  const watches = entries.reduce((count, entry) => count + entry.watches.length, 0);
  const summary = $('#backup-summary');
  if (!summary) return;
  const actions = summary.querySelector('.backup-actions') || summary.parentElement?.querySelector(':scope > .backup-actions');
  if (document.documentElement.dataset.cssReworkPreview !== 'true') {
    if (actions && summary.contains(actions)) summary.after(actions);
    summary.textContent = `${entries.length} logged titles · ${watches} watches · ${watchlist.length} watchlist items · ${customCollections.length} folders`;
    return;
  }
  const sourceName = document.createElement('span');
  sourceName.className = 'backup-summary-source-name';
  sourceName.textContent = $('.nav-storage-text')?.textContent || 'Browser';
  const sourceComparison = document.createElement('span');
  sourceComparison.className = 'backup-summary-source backup-summary-source-comparison level-5-styling';
  sourceComparison.append(sourceName);
  if (selectedBackup && selectedBackupFileName) {
    const combineBox = document.createElement('span');
    combineBox.className = 'backup-summary-combine-box';
    const combineIcon = document.createElement('span');
    combineIcon.className = 'masked-icon backup-summary-combine-icon';
    combineIcon.setAttribute('aria-hidden', 'true');
    combineBox.append(combineIcon);
    const incomingFile = document.createElement('span');
    incomingFile.className = 'backup-summary-incoming-file';
    incomingFile.textContent = selectedBackupFileName;
    sourceComparison.append(combineBox, incomingFile);
  }
  const sourceRow = document.createElement('div');
  sourceRow.className = 'backup-summary-source-row';
  sourceRow.append(sourceComparison);
  if (actions) sourceRow.append(actions);
  const stats = document.createElement('span');
  stats.className = 'backup-summary-stats';
  const countNotes = (loggedItems, backloggedItems = []) =>
    loggedItems.reduce((count, entry) => count + Number(Boolean(entry.notes?.trim())) +
      (entry.watches || []).reduce((watchCount, watch) => watchCount + Number(Boolean(watch.notes?.trim())), 0), 0) +
    backloggedItems.reduce((count, item) => count + Number(Boolean(item.notes?.trim())), 0);
  const currentCounts = {
    logged: entries.length,
    backlogged: watchlist.length,
    watches,
    folders: customCollections.length,
    notes: countNotes(entries, watchlist),
  };
  const selectedMode = document.querySelector('input[name="import-mode"]:checked')?.value || 'merge';
  const currentEntryIds = new Set(entries.map((entry) => entry.id));
  const currentWatchlistIds = new Set(watchlist.map((item) => item.id));
  const currentCollectionIds = new Set(customCollections.map((item) => item.id));
  const addedEntries = selectedBackup
    ? selectedBackup.entries.filter((entry) => !currentEntryIds.has(entry.id))
    : [];
  const addedWatchlist = selectedBackup
    ? selectedBackup.watchlist.filter((item) => !currentWatchlistIds.has(item.id))
    : [];
  const additions = selectedBackup ? {
    logged: addedEntries.length,
    backlogged: addedWatchlist.length,
    watches: addedEntries.reduce((count, entry) => count + entry.watches.length, 0),
    folders: selectedBackup.collections.filter((item) => !currentCollectionIds.has(item.id)).length,
    notes: countNotes(addedEntries, addedWatchlist),
  } : null;
  const replacementCounts = selectedBackup ? {
    logged: selectedBackup.entries.length,
    backlogged: selectedBackup.watchlist.length,
    watches: selectedBackup.entries.reduce((count, entry) => count + entry.watches.length, 0),
    folders: selectedBackup.collections.length,
    notes: countNotes(selectedBackup.entries, selectedBackup.watchlist),
  } : null;
  const typeCounts = (items) => items.reduce((counts, item) => {
    const type = item.type || 'Other';
    counts[type] = (counts[type] || 0) + 1;
    return counts;
  }, {});
  const currentTypeCounts = typeCounts([...entries, ...watchlist]);
  const addedTypeCounts = typeCounts([...addedEntries, ...addedWatchlist]);
  const incomingTypeCounts = selectedBackup
    ? typeCounts([...selectedBackup.entries, ...selectedBackup.watchlist])
    : {};
  const typeLabels = (types) => [...types].sort((a, b) => a.localeCompare(b)).map((type) => ({
    key: `type:${type}`,
    label: type === 'Movie' ? 'Movies' : type === 'Show' ? 'Shows' : type === 'Other' ? 'Other' : `${type}s`,
    current: currentTypeCounts[type] || 0,
    added: addedTypeCounts[type] || 0,
    incoming: incomingTypeCounts[type] || 0,
  }));
  const baseStats = [
    { key: 'logged', label: 'Logged items' },
    { key: 'backlogged', label: 'Backlogged items' },
    { key: 'watches', label: 'Watches' },
    { key: 'folders', label: 'Folders' },
    { key: 'notes', label: 'Notes' },
  ];
  const mediaItems = [...entries, ...watchlist, ...(selectedBackup?.entries || []), ...(selectedBackup?.watchlist || [])];
  const mediaTypes = new Set(mediaItems.map((item) => item.type || 'Other'));
  const mediaStats = typeLabels(mediaTypes).map(({ key, label, current, added, incoming }) => ({
    key,
    label,
    current,
    added,
    incoming,
  }));
  const summaryStats = [...baseStats, ...mediaStats];
  for (const { key, label, current: typeCurrent, added: typeAdded, incoming: typeIncoming } of summaryStats) {
    const currentValue = key.startsWith('type:') ? typeCurrent : currentCounts[key];
    const addedValue = key.startsWith('type:') ? typeAdded : additions?.[key];
    const incomingValue = key.startsWith('type:') ? typeIncoming : replacementCounts?.[key];
    const row = document.createElement('span');
    row.className = 'backup-summary-stat-row';
    const item = document.createElement('span');
    item.className = 'backup-summary-stat level-5-styling';
    const current = document.createElement('span');
    current.className = 'backup-summary-stat-current';
    current.textContent = `${currentValue} ${label}`;
    item.append(current);
    row.append(item);
    if (selectedBackup && selectedMode === 'replace') {
      current.classList.add('is-replaced');
      const result = document.createElement('span');
      result.className = 'backup-summary-stat backup-summary-stat-result level-5-styling';
      result.textContent = `${incomingValue} ${label}`;
      row.append(result);
    } else if (selectedBackup) {
      const change = document.createElement('span');
      change.className = 'backup-summary-stat backup-summary-stat-change level-5-styling';
      change.textContent = `+${addedValue}`;
      row.append(change);

      const fileCount = document.createElement('span');
      fileCount.className = 'backup-summary-stat backup-summary-stat-file level-5-styling';
      fileCount.textContent = `${incomingValue} ${label}`;
      row.append(fileCount);
    }
    stats.append(row);
  }
  summary.replaceChildren(sourceRow, stats);
  // The navbar abbreviates file names; the storage tree shows the full .json name.
  if (typeof updateStorageIndicator === 'function') updateStorageIndicator();
  backupSummarySourceObserver?.disconnect();
  const updateSummarySourceLayout = () => {
    const summaryRect = summary.getBoundingClientRect();
    const sourceNameRect = sourceName.getBoundingClientRect();
    const sourceNameCenter = sourceNameRect.left - summaryRect.left + sourceNameRect.width / 2;
    summary.style.setProperty('--backup-summary-trunk-offset', `${sourceNameCenter}px`);
  };
  updateSummarySourceLayout();
  backupSummarySourceObserver = new ResizeObserver(updateSummarySourceLayout);
  backupSummarySourceObserver.observe(sourceName);
}

/** Validates and normalizes a string field from imported backup data. */
function backupString(value, name, optional = false) {
  if (optional && (value === undefined || value === null)) return '';
  if (typeof value !== 'string') throw new Error(`Invalid ${name} in this file.`);
  return value;
}

/** Validates and normalizes a poster value from imported data. */
function backupPoster(value) {
  const poster = backupString(value, 'poster', true);
  if (poster && !/^(https?:\/\/|data:image\/(?:jpeg|png|webp|gif);base64,)/i.test(poster)) {
    throw new Error('A poster in this file has an unsupported address.');
  }
  return poster;
}

/** Normalizes stored external metadata while validating its fields. */
function backupMetadata(value) {
  if (value === undefined || value === null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid fetched metadata in this file.');
  const text = (field) => backupString(value[field], `metadata ${field}`, true);
  const fetchedAt = text('fetchedAt');
  if (fetchedAt && Number.isNaN(Date.parse(fetchedAt))) throw new Error('Invalid metadata fetch date in this file.');
  const query = value.query && typeof value.query === 'object' && !Array.isArray(value.query)
    ? {
      title: backupString(value.query.title, 'metadata query title', true),
      type: backupString(value.query.type, 'metadata query type', true),
      year: backupString(value.query.year, 'metadata query year', true),
    }
    : { title: '', type: '', year: '' };
  return {
    source: text('source'), fetchedAt, query,
    imdbId: text('imdbId'), imdbRating: text('imdbRating'), runtime: text('runtime'),
    plot: text('plot'), actors: text('actors'), writer: text('writer'), director: text('director'),
    genre: text('genre'), year: text('year'), poster: backupPoster(value.poster),
  };
}

/** Normalizes one title record from backup data. */
function backupTitle(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('This file contains an invalid title.');
  }

  const id = backupString(raw.id, 'title ID').trim();
  const title = backupString(raw.title, 'title').trim();
  if (!id || !title || !['Movie', 'Show'].includes(raw.type)) {
    throw new Error('This file contains an invalid title, ID, or type.');
  }

  const rawCollectionIds = Array.isArray(raw.collectionIds)
    ? raw.collectionIds
    : raw.collectionId ? [raw.collectionId] : [];
  const collectionIds = rawCollectionIds.map((value) => backupString(value, 'collection ID').trim()).filter(Boolean);

  return {
    id,
    title,
    director: backupString(raw.director, 'director', true),
    metadata: backupMetadata(raw.metadata),
    type: raw.type,
    category: backupString(raw.category, 'genre', true),
    year: raw.year === undefined || raw.year === null ? '' : String(raw.year),
    poster: backupPoster(raw.poster),
    collectionIds: [...new Set(collectionIds)],
  };
}

/** Parses and validates a complete backup before it is imported. */
function readBackup(data) {
  if (!data || data.format !== 'rerun-backup' || data.version !== 1 ||
      !Array.isArray(data.entries) || !Array.isArray(data.watchlist)) {
    throw new Error('Choose a Rewatched JSON file exported by this app.');
  }

  const importedEntries = data.entries.map((raw) => {
    const title = backupTitle(raw);
    if (!Array.isArray(raw.watches) || raw.watches.length === 0) {
      throw new Error(`“${title.title}” has no watch history.`);
    }

    title.watches = raw.watches.map((watch) => {
      if (!watch || typeof watch !== 'object' || Array.isArray(watch) ||
          watch.score === undefined || !Number.isFinite(Number(watch.score)) ||
          Number(watch.score) < 0 || Number(watch.score) > 10) {
        throw new Error(`“${title.title}” has an invalid watch score.`);
      }

      return {
        date: backupString(watch.date, 'watch date', true),
        score: Number(watch.score),
        notes: backupString(watch.notes, 'watch notes', true),
        kind: watch.kind === 'previous' ? 'previous' : 'first',
      };
    });
    return title;
  });

  const importedWatchlist = data.watchlist.map((raw) => ({
    ...backupTitle(raw),
    notes: backupString(raw.notes, 'watchlist notes', true),
    priority: Number.isInteger(Number(raw.priority)) && Number(raw.priority) >= 1 && Number(raw.priority) <= 5
      ? Number(raw.priority)
      : 3,
  }));

  for (const items of [importedEntries, importedWatchlist]) {
    if (new Set(items.map((item) => item.id)).size !== items.length) {
      throw new Error('This file contains duplicate title IDs.');
    }
  }

  const importedCollections = (Array.isArray(data.collections) ? data.collections : []).map((raw) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('This file contains an invalid collection.');
    const id = backupString(raw.id, 'collection ID').trim();
    const name = backupString(raw.name, 'collection name').trim();
    if (!id || !name) throw new Error('This file contains an invalid collection.');
    const entryIds = Array.isArray(raw.entryIds)
      ? raw.entryIds.map((value) => backupString(value, 'collection entry ID').trim()).filter(Boolean)
      : [];
    return { id, name, entryIds: [...new Set(entryIds)] };
  });

  // Older backups stored assignments only on each entry. New backups also
  // store folder contents, so accept either representation when loading.
  const entriesById = new Map(importedEntries.map((entry) => [entry.id, entry]));
  importedCollections.forEach((collection) => {
    collection.entryIds.forEach((entryId) => {
      const entry = entriesById.get(entryId);
      if (entry && !entry.collectionIds.includes(collection.id)) entry.collectionIds.push(collection.id);
    });
  });

  return { entries: importedEntries, watchlist: importedWatchlist, collections: importedCollections };
}

/** Downloads the current library as a JSON backup. */
function downloadBackup() {
  const backup = makeBackupSnapshot();
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `rewatched-export-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  window.dispatchEvent(new CustomEvent('rewatched:library-exported'));
  setBackupStatus('File exported', 'success');
}

/** Builds a serializable snapshot of the current app data. */
function makeBackupSnapshot() {
  return {
    format: 'rerun-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    entries,
    watchlist,
    collections: customCollections.map((collection) => ({
      ...collection,
      entryIds: entries
        .filter((entry) => entryCollectionIds(entry).includes(collection.id))
        .map((entry) => entry.id),
    })),
  };
}

/** Reads and imports the selected backup file. */
async function chooseBackup(file) {
  selectedBackup = null;
  selectedBackupFileName = '';
  $('#import-options').hidden = true;
  updateBackupSummary();
  setBackupStatus('');
  if (!file) return;

  if (file.size > 25 * 1024 * 1024) {
    setBackupStatus('File too large', 'error', 'This file is too large to use.');
    return;
  }

  try {
    selectedBackup = readBackup(JSON.parse(await file.text()));
    selectedBackupFileName = file.name;
    $('#import-options').hidden = false;
    updateBackupSummary();
  } catch (error) {
    setBackupStatus('Could not read file', 'error', error.message || 'Could not read this file.');
  }
}

/** Restores one saved setting or data value from a backup. */
function restoreStoredValue(key, value) {
  if (value === null) localStorage.removeItem(key);
  else localStorage.setItem(key, value);
}

/** Opens the file picker and starts the backup import flow. */
function importBackup() {
  if (!selectedBackup) return;

  const replace = document.querySelector('input[name="import-mode"]:checked').value === 'replace';
  if (replace && !confirm('Replace all current logged titles and watchlist items with this file?')) {
    return;
  }

  const merge = (current, incoming) => {
    const currentIds = new Set(current.map((item) => item.id));
    return [...current, ...incoming.filter((item) => !currentIds.has(item.id))];
  };
  const nextEntries = replace ? selectedBackup.entries : merge(entries, selectedBackup.entries);
  const nextWatchlist = replace ? selectedBackup.watchlist : merge(watchlist, selectedBackup.watchlist);
  const nextCollections = replace ? selectedBackup.collections : merge(customCollections, selectedBackup.collections);
  const previousEntries = localStorage.getItem(STORAGE_KEY);
  const previousWatchlist = localStorage.getItem(WATCHLIST_KEY);
  const previousCollections = localStorage.getItem(COLLECTIONS_KEY);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextEntries));
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(nextWatchlist));
    localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(nextCollections));
  } catch (error) {
    try {
      restoreStoredValue(STORAGE_KEY, previousEntries);
      restoreStoredValue(WATCHLIST_KEY, previousWatchlist);
      restoreStoredValue(COLLECTIONS_KEY, previousCollections);
    } catch (restoreError) {
      console.warn('Could not restore browser storage after import failed.', restoreError);
    }
    setBackupStatus('Could not apply file', 'error', 'Browser storage may be full; your current data was kept.');
    console.warn('Could not import backup.', error);
    return;
  }

  entries = nextEntries;
  watchlist = nextWatchlist;
  customCollections = nextCollections;
  queueFileSave();
  bannerIndex = 0;
  render();
  selectedBackup = null;
  selectedBackupFileName = '';
  $('#import-options').hidden = true;
  updateBackupSummary();
  setBackupStatus('File applied', 'success');
}

/** Loads the bundled demo library after confirming replacement of current data. */
async function loadDemoVault() {
  const button = $('#load-demo-vault');
  let demoStatusTimer = null;
  const demoStatus = (message, type, detail = message) => {
    if (showLoadStatus(message, type, detail)) return;
    const status = $('#demo-vault-status');
    clearTimeout(demoStatusTimer);
    status.textContent = detail;
    status.hidden = false;
    demoStatusTimer = setTimeout(() => {
      if (status.textContent === detail) status.hidden = true;
    }, 4000);
  };
  if (!confirm('Replace your current library, watchlist, and folders with the demo vault? If a storage file is connected, the demo may be saved to that file.')) return;

  button.disabled = true;
  demoStatus('Loading demo file…', 'warning');
  try {
    const response = await fetch('assets/demo_vault.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('Could not load assets/demo_vault.json.');
    const demo = readBackup(await response.json());
    const previousEntries = localStorage.getItem(STORAGE_KEY);
    const previousWatchlist = localStorage.getItem(WATCHLIST_KEY);
    const previousCollections = localStorage.getItem(COLLECTIONS_KEY);
    const oldEntries = entries;
    const oldWatchlist = watchlist;
    const oldCollections = customCollections;

    entries = demo.entries;
    watchlist = demo.watchlist;
    customCollections = demo.collections;
    try {
      save();
    } catch (error) {
      entries = oldEntries;
      watchlist = oldWatchlist;
      customCollections = oldCollections;
      restoreStoredValue(STORAGE_KEY, previousEntries);
      restoreStoredValue(WATCHLIST_KEY, previousWatchlist);
      restoreStoredValue(COLLECTIONS_KEY, previousCollections);
      throw error;
    }

    activeCollectionView = 'logged';
    activeCollectionId = 'all';
    activeFilters = [...workspaceMediaTypes];
    releaseYearFilter = [];
    ratingFilter = [100, 0];
    collectionSort = 'watched-desc';
    collectionPage = 0;
    bannerIndex = 0;
    $('.library-search-container > .search-input').value = '';
    render();
    updateBackupSummary();
    demoStatus('Demo file loaded', 'success', `Demo vault loaded: ${entries.length} titles, ${watchlist.length} watchlist items, and ${customCollections.length} folders.`);
  } catch (error) {
    demoStatus('Could not load demo file', 'error', error.message || 'Could not load the demo vault.');
  } finally {
    button.disabled = false;
  }
}

$('#export-backup').addEventListener('click', downloadBackup);
$('#choose-backup').addEventListener('click', () => {
  $('#backup-file').value = '';
  $('#backup-file').click();
});
$('#backup-file').addEventListener('change', (event) => {
  chooseBackup(event.target.files[0]);
});
$('#cancel-import').addEventListener('click', () => {
  selectedBackup = null;
  selectedBackupFileName = '';
  $('#backup-file').value = '';
  $('#import-options').hidden = true;
  setBackupStatus('');
  updateBackupSummary();
});
document.querySelectorAll('input[name="import-mode"]').forEach((input) => {
  input.addEventListener('change', updateBackupSummary);
});
$('#import-backup').addEventListener('click', importBackup);
$('#load-demo-vault').addEventListener('click', loadDemoVault);
updateBackupSummary();
/** Validates, imports, exports, and summarizes ReWatched backup data. */

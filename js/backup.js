/** Backup module. */
// Portable JSON backups for entries and the watchlist.

let selectedBackup = null;

/** Updates the backup dialog with a summary of the current data. */
function updateBackupSummary() {
  const watches = entries.reduce((count, entry) => count + entry.watches.length, 0);
  $('#backup-summary').textContent =
    `${entries.length} logged titles · ${watches} watches · ${watchlist.length} watchlist items · ${customCollections.length} folders`;
}

/** Validates and normalizes a string field from imported backup data. */
function backupString(value, name, optional = false) {
  if (optional && (value === undefined || value === null)) return '';
  if (typeof value !== 'string') throw new Error(`Invalid ${name} in backup.`);
  return value;
}

/** Validates and normalizes a poster value from imported data. */
function backupPoster(value) {
  const poster = backupString(value, 'poster', true);
  if (poster && !/^(https?:\/\/|data:image\/(?:jpeg|png|webp|gif);base64,)/i.test(poster)) {
    throw new Error('A poster in this backup has an unsupported address.');
  }
  return poster;
}

/** Normalizes stored external metadata while validating its fields. */
function backupMetadata(value) {
  if (value === undefined || value === null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid fetched metadata in backup.');
  const text = (field) => backupString(value[field], `metadata ${field}`, true);
  const fetchedAt = text('fetchedAt');
  if (fetchedAt && Number.isNaN(Date.parse(fetchedAt))) throw new Error('Invalid metadata fetch date in backup.');
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
    throw new Error('This backup contains an invalid title.');
  }

  const id = backupString(raw.id, 'title ID').trim();
  const title = backupString(raw.title, 'title').trim();
  if (!id || !title || !['Movie', 'Show'].includes(raw.type)) {
    throw new Error('This backup contains an invalid title, ID, or type.');
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
    throw new Error('Choose a Rerun JSON backup made by this app.');
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
      throw new Error('This backup contains duplicate title IDs.');
    }
  }

  const importedCollections = (Array.isArray(data.collections) ? data.collections : []).map((raw) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('This backup contains an invalid collection.');
    const id = backupString(raw.id, 'collection ID').trim();
    const name = backupString(raw.name, 'collection name').trim();
    if (!id || !name) throw new Error('This backup contains an invalid collection.');
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
  link.download = `rerun-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  $('#backup-status').textContent = 'Backup downloaded. Keep the JSON file somewhere safe.';
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
  $('#import-options').hidden = true;
  if (!file) return;

  if (file.size > 25 * 1024 * 1024) {
    $('#backup-status').textContent = 'This backup is too large to import.';
    return;
  }

  try {
    selectedBackup = readBackup(JSON.parse(await file.text()));
    $('#backup-preview').textContent =
      `${selectedBackup.entries.length} logged titles · ${selectedBackup.watchlist.length} watchlist items`;
    $('#import-options').hidden = false;
    $('#backup-status').textContent = 'Choose how to import this backup.';
  } catch (error) {
    $('#backup-status').textContent = error.message || 'Could not read this backup.';
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
  if (replace && !confirm('Replace all current logged titles and watchlist items with this backup?')) {
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
    $('#backup-status').textContent = 'Import failed. Browser storage may be full; your current data was kept.';
    console.warn('Could not import backup.', error);
    return;
  }

  entries = nextEntries;
  watchlist = nextWatchlist;
  customCollections = nextCollections;
  queueFileSave();
  bannerIndex = 0;
  render();
  updateBackupSummary();
  $('#backup-status').textContent =
    `Imported ${entries.length} logged titles and ${watchlist.length} watchlist items.`;
}

/** Loads the bundled demo library after confirming replacement of current data. */
async function loadDemoVault() {
  const button = $('#load-demo-vault');
  const status = $('#demo-vault-status');
  if (!confirm('Replace your current library, watchlist, and folders with the demo vault? If a storage file is connected, the demo may be saved to that file.')) return;

  button.disabled = true;
  status.textContent = 'Loading demo vault…';
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

    activeView = 'logged';
    activeCollectionId = 'all';
    activeFilter = 'all';
    watchedYearFilter = 'all';
    ratingFilter = 'all';
    collectionSort = 'watched-desc';
    collectionPage = 0;
    bannerIndex = 0;
    $('#library-search').value = '';
    render();
    updateBackupSummary();
    status.textContent = `Demo vault loaded: ${entries.length} titles, ${watchlist.length} watchlist items, and ${customCollections.length} folders.`;
  } catch (error) {
    status.textContent = error.message || 'Could not load the demo vault.';
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
$('#import-backup').addEventListener('click', importBackup);
$('#load-demo-vault').addEventListener('click', loadDemoVault);
updateBackupSummary();
/** Validates, imports, exports, and summarizes ReWatched backup data. */

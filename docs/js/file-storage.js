/** File storage module. */
// A user-chosen JSON file can be the active library in browsers with File System Access.
// Its handle is remembered in IndexedDB; localStorage remains a fallback copy.

const FILE_DB_NAME = 'rerun-file-storage';
const FILE_STORE_NAME = 'settings';
let storageFileHandle = null;
let fileSaveTimer = null;
let pendingFileWrite = Promise.resolve();
let suppressFileSave = false;
let fileStorageReady = false;
let useBasicFilePicker = false;
let storageFileName = 'Browser Vault';
window.__rewatchedDirty = false;

// Ask for confirmation when the app is closed while a file save is pending.
// Electron and regular browsers both turn this into their native leave-page dialog.
window.addEventListener('beforeunload', (event) => {
  // Electron shows its own save/discard dialog from the main process.
  if (navigator.userAgent.includes('Electron')) return;
  const indicator = $('#storage-save-indicator');
  if (!indicator || !window.__rewatchedDirty) return;
  event.preventDefault();
  event.returnValue = '';
});

/** Updates the visible saved/unsaved status indicator. */
function storageSaveState(state) {
  const indicator = $('#storage-save-indicator');
  if (!indicator) return;
  window.__rewatchedDirty = state === 'pending' || state === 'error';
  indicator.hidden = false;
  indicator.classList.toggle('is-pending', state === 'pending');
  indicator.classList.toggle('is-error', state === 'error');
  indicator.classList.toggle('is-saved', state === 'saved');
  const status = state === 'error'
    ? 'Could not save changes'
    : state === 'pending' ? 'Changes waiting to be saved' : 'All changes saved';
  indicator.title = status;
  indicator.setAttribute('aria-label', status);
  const checkButton = $('#open-storage-check');
  if (checkButton) {
    checkButton.title = `Storage Consistency Check — ${status}`;
    checkButton.setAttribute('aria-label', `Open Storage Consistency Check. ${status}`);
  }
}

/** Shows a brief confirmation message after a save. */
function showSaveToast(message) {
  const toast = $('#save-toast');
  if (!toast) return;
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(showSaveToast.timer);
  showSaveToast.timer = setTimeout(() => { toast.hidden = true; }, 2200);
}

/** Counts titles, watches, folders, and other saved data. */
function getStorageStats(data) {
  const savedEntries = Array.isArray(data.entries) ? data.entries : [];
  return {
    titles: savedEntries.length,
    watches: savedEntries.reduce((count, entry) => count + (Array.isArray(entry.watches) ? entry.watches.length : 0), 0),
    watchlist: Array.isArray(data.watchlist) ? data.watchlist.length : 0,
    folders: Array.isArray(data.collections) ? data.collections.length : 0,
  };
}

/** Displays one set of storage consistency counts. */
function renderStorageStats(prefix, stats) {
  $('#save-' + prefix + '-titles').textContent = stats.titles;
  $('#save-' + prefix + '-watches').textContent = stats.watches;
  $('#save-' + prefix + '-watchlist').textContent = stats.watchlist;
  $('#save-' + prefix + '-folders').textContent = stats.folders;
}

/** Reads the linked save file for comparison with app state. */
async function readSavedDataForComparison() {
  if (storageFileHandle) {
    let permission = await storageFileHandle.queryPermission({ mode: 'read' });
    if (permission !== 'granted' && storageFileHandle.requestPermission) {
      permission = await storageFileHandle.requestPermission({ mode: 'read' });
    }
    if (permission !== 'granted') throw new Error('File access needs to be renewed in Storage settings.');
    const file = await storageFileHandle.getFile();
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.entries) || !Array.isArray(data.watchlist)) {
      throw new Error(`${file.name} is not a Rewatched JSON file.`);
    }
    return { data };
  }

  if (useBasicFilePicker) {
    throw new Error('The selected JSON file cannot be reopened here. Reconnect it in Storage settings.');
  }

  return {
    data: {
      entries: JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'),
      watchlist: JSON.parse(localStorage.getItem(WATCHLIST_KEY) || '[]'),
      collections: JSON.parse(localStorage.getItem(COLLECTIONS_KEY) || '[]'),
    },
  };
}

/** Compares in-app counts with the linked save file. */
async function showStorageComparison() {
  const dialog = $('#save-confirmation-dialog');
  const appStats = getStorageStats(makeBackupSnapshot());
  const outcome = $('#save-confirmation-location');
  $('#save-confirmation-heading').textContent = 'Storage Consistency Check';
  outcome.textContent = '';
  outcome.classList.remove('is-match', 'has-error');
  renderStorageStats('app', appStats);
  ['titles', 'watches', 'watchlist', 'folders'].forEach((key) => {
    $('#save-json-' + key).textContent = '—';
  });
  $('#save-confirmation-time').textContent = `Checked: ${new Date().toLocaleString()}`;
  if (!dialog.open) dialog.showModal();
  const focusedElement = document.activeElement;
  if (focusedElement && dialog.contains(focusedElement)) focusedElement.blur();

  try {
    const saved = await readSavedDataForComparison();
    const fileStats = getStorageStats(saved.data);
    renderStorageStats('json', fileStats);
    const matches = Object.keys(appStats).every((key) => appStats[key] === fileStats[key]);
    outcome.textContent = matches
      ? 'All four counts match.'
      : 'The counts differ. Compare the rows above.';
    outcome.classList.toggle('is-match', matches);
    outcome.classList.toggle('has-error', !matches);
  } catch (error) {
    outcome.textContent = `Could not read saved data: ${error.message}`;
    outcome.classList.add('has-error');
  }
}

$('#open-storage-check').addEventListener('click', showStorageComparison);

$('#save-confirmation-save').addEventListener('click', async (event) => {
  const button = event.currentTarget;
  const outcome = $('#save-confirmation-location');
  button.disabled = true;
  button.textContent = 'Saving…';
  outcome.classList.remove('is-match', 'has-error');
  outcome.textContent = 'Saving current app data…';

  try {
    await saveLinkedFileNow();
    await showStorageComparison();
  } catch (error) {
    storageSaveState('error');
    outcome.textContent = `Could not save: ${error.message}`;
    outcome.classList.add('has-error');
  } finally {
    button.disabled = false;
    button.textContent = 'Save now';
  }
});

/** Writes current app data to the linked JSON file. */
async function saveLinkedFileNow() {
  const snapshot = makeBackupSnapshot();
  if (!storageFileHandle) {
    storageSaveState('saved');
    return { target: 'Browser storage', snapshot };
  }
  let permission = await storageFileHandle.queryPermission({ mode: 'readwrite' });
  if (permission !== 'granted' && storageFileHandle.requestPermission) {
    permission = await storageFileHandle.requestPermission({ mode: 'readwrite' });
  }
  if (permission !== 'granted') throw new Error('File access needs to be renewed. Choose Reconnect file.');
  const writer = await storageFileHandle.createWritable();
  try {
    await writer.write(JSON.stringify(snapshot, null, 2));
    await writer.close();
  } catch (error) {
    await writer.abort().catch(() => {});
    throw error;
  }
  clearTimeout(fileSaveTimer);
  storageSaveState('saved');
  fileStatus(`Saved to ${storageFileHandle.name}.`);
  return { target: storageFileHandle.name, snapshot };
}

/** Refreshes the storage indicator after state changes. */
function updateStorageIndicator() {
  $('#current-storage-name').textContent = storageFileName.replace(/\.[^.]+$/, '');
}

/** Displays a storage status or error message. */
function fileStatus(message) {
  updateStorageIndicator();
  if (!storageFileHandle) storageSaveState('saved');
  $('#file-storage-status').textContent = message;
  $('#reconnect-storage-file').hidden = !storageFileHandle;
  $('#disconnect-storage-file').hidden = !storageFileHandle;
}

/** Opens the browser database used to persist file access handles. */
function fileDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(FILE_DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(FILE_STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Reads or stores the remembered JSON file handle. */
async function rememberedFileHandle(replacement) {
  const database = await fileDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(FILE_STORE_NAME, replacement === undefined ? 'readonly' : 'readwrite');
      const store = transaction.objectStore(FILE_STORE_NAME);
      const request = replacement === undefined
        ? store.get('library')
        : replacement === null ? store.delete('library') : store.put(replacement, 'library');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    database.close();
  }
}

/** Returns configuration for the JSON file picker. */
function filePickerOptions() {
  return {
    types: [{ description: 'Rerun JSON', accept: { 'application/json': ['.json'] } }],
    excludeAcceptAllOption: true,
  };
}

/** Reads and parses a selected storage file. */
async function loadStorageFile(handle) {
  const file = await handle.getFile();
  if (file.size > 25 * 1024 * 1024) throw new Error('This JSON file is too large to load.');
  const library = readBackup(JSON.parse(await file.text()));
  return library;
}

/** Replaces app data with data loaded from storage. */
function useFileLibrary(library) {
  const oldEntries = entries;
  const oldWatchlist = watchlist;
  const oldCollections = customCollections;
  suppressFileSave = true;
  try {
    entries = library.entries;
    watchlist = library.watchlist;
    customCollections = library.collections || [];
    save();
  } catch (error) {
    entries = oldEntries;
    watchlist = oldWatchlist;
    customCollections = oldCollections;
    throw error;
  } finally {
    suppressFileSave = false;
  }
  bannerIndex = 0;
  updateBackupSummary();
  render();
}

/** Schedules a debounced autosave to the linked file. */
function queueFileSave() {
  if (suppressFileSave) {
    storageSaveState('saved');
    return;
  }
  if (!fileStorageReady) return;
  // save() has already written the browser copy synchronously. Without a
  // linked JSON file there is no delayed disk write to wait for.
  if (!storageFileHandle) {
    clearTimeout(fileSaveTimer);
    storageSaveState('saved');
    return;
  }
  storageSaveState('pending');
  clearTimeout(fileSaveTimer);
  fileSaveTimer = setTimeout(() => {
    const handle = storageFileHandle;
    const snapshot = JSON.stringify(makeBackupSnapshot(), null, 2);
    pendingFileWrite = pendingFileWrite.catch(() => {}).then(async () => {
      if (handle !== storageFileHandle) return;
      const permission = await handle.queryPermission({ mode: 'readwrite' });
      if (permission !== 'granted') {
        fileStatus(`File access needs to be renewed for ${handle.name}. Choose Reconnect file.`);
        storageSaveState('error');
        return;
      }
      const writer = await handle.createWritable();
      try {
        await writer.write(snapshot);
        await writer.close();
      } catch (error) {
        await writer.abort().catch(() => {});
        throw error;
      }
      fileStatus(`Auto-saved to ${handle.name}.`);
      storageSaveState('saved');
    }).catch((error) => {
      fileStatus(`Could not save ${handle.name}: ${error.message || 'file access failed'}. Browser copy is still saved.`);
      storageSaveState('error');
      console.warn('Could not auto-save storage file.', error);
    });
  }, 250);
}

/** Connects a file handle and initializes the app with its data. */
async function activateStorageFile(handle, library) {
  clearTimeout(fileSaveTimer);
  await pendingFileWrite;
  useFileLibrary(library);
  storageFileHandle = handle;
  storageFileName = handle.name;
  await rememberedFileHandle(handle);
  const permission = await handle.queryPermission({ mode: 'readwrite' });
  fileStatus(permission === 'granted'
    ? `Using ${handle.name}. Changes will save automatically.`
    : `Loaded ${handle.name}. Choose Reconnect file to allow automatic saving.`);
}

/** Restores the previously connected file during startup. */
async function initializeFileStorage() {
  fileStorageReady = true;
  if (!window.showOpenFilePicker || !window.showSaveFilePicker || !window.indexedDB) {
    useBasicFilePicker = true;
    $('#create-storage-file').disabled = true;
    fileStatus('You can choose a JSON file to load it. Automatic saving needs Chrome or Edge on localhost or HTTPS; use Export backup in this browser.');
    return;
  }
  try {
    const handle = await rememberedFileHandle();
    if (!handle) {
      fileStatus('No file selected. Your library is saved in this browser.');
      return;
    }
    storageFileHandle = handle;
    storageFileName = handle.name;
    const readPermission = await handle.queryPermission({ mode: 'read' });
    if (readPermission !== 'granted') {
      fileStatus(`Reconnect ${handle.name} to load it. Your browser copy is shown for now.`);
      return;
    }
    useFileLibrary(await loadStorageFile(handle));
    const writePermission = await handle.queryPermission({ mode: 'readwrite' });
    fileStatus(writePermission === 'granted'
      ? `Loaded ${handle.name}. Changes will save automatically.`
      : `Loaded ${handle.name}. Choose Reconnect file to allow automatic saving.`);
  } catch (error) {
    fileStatus(`Could not load linked file: ${error.message || 'access failed'}. Your browser copy is shown.`);
    console.warn('Could not load storage file.', error);
  }
}

/** Opens a picker to select an existing storage file. */
async function chooseStorageFile() {
  if (useBasicFilePicker || !window.showOpenFilePicker) {
    $('#storage-file-input').value = '';
    $('#storage-file-input').click();
    return;
  }
  try {
    const [handle] = await window.showOpenFilePicker(filePickerOptions());
    if (!handle) return;
    // Ask while the picker click still counts as a user action when possible.
    try {
      await handle.requestPermission({ mode: 'readwrite' });
    } catch (error) {
      console.warn('File opened for reading; write permission can be reconnected later.', error);
    }
    const library = await loadStorageFile(handle);
    if ((entries.length || watchlist.length) &&
        !confirm(`Load ${handle.name}? This will replace the library currently shown in the app. Your current browser data can be exported first.`)) return;
    await activateStorageFile(handle, library);
  } catch (error) {
    if (error.name === 'SecurityError' || error.name === 'NotAllowedError') {
      useBasicFilePicker = true;
      $('#create-storage-file').disabled = true;
      fileStatus('This browser cannot link a file here. Click Choose JSON file again to load it; use Export backup to save later changes.');
    } else if (error.name !== 'AbortError') {
      fileStatus(`Could not use file: ${error.message || 'access failed'}`);
    }
  }
}

/** Loads a file where persistent file handles are unavailable. */
async function loadBasicStorageFile(file) {
  if (!file) return;
  try {
    if (file.size > 25 * 1024 * 1024) throw new Error('This JSON file is too large to load.');
    const library = readBackup(JSON.parse(await file.text()));
    if ((entries.length || watchlist.length) &&
        !confirm(`Load ${file.name}? This will replace the library currently shown in the app.`)) return;
    clearTimeout(fileSaveTimer);
    await pendingFileWrite;
    storageFileHandle = null;
    storageFileName = file.name;
    if (window.indexedDB) await rememberedFileHandle(null);
    useFileLibrary(library);
    fileStatus(`Loaded ${file.name}. This browser cannot save back to it automatically; use Export backup after changes.`);
  } catch (error) {
    fileStatus(`Could not load file: ${error.message || 'invalid JSON'}`);
  }
}

/** Creates a new empty storage file and activates it. */
async function createStorageFile() {
  if (!window.showSaveFilePicker) return;
  try {
    const handle = await window.showSaveFilePicker({
      ...filePickerOptions(),
      suggestedName: 'rerun-library.json',
    });
    clearTimeout(fileSaveTimer);
    await pendingFileWrite;
    const writer = await handle.createWritable();
    await writer.write(JSON.stringify(makeBackupSnapshot(), null, 2));
    await writer.close();
    storageFileHandle = handle;
    storageFileName = handle.name;
    await rememberedFileHandle(handle);
    fileStatus(`Created ${handle.name}. Changes will save automatically.`);
  } catch (error) {
    if (error.name !== 'AbortError') fileStatus(`Could not create file: ${error.message || 'access failed'}`);
  }
}

/** Reconnects access to the previously selected storage file. */
async function reconnectStorageFile() {
  if (!storageFileHandle) return;
  try {
    const permission = await storageFileHandle.requestPermission({ mode: 'readwrite' });
    if (permission !== 'granted') {
      fileStatus(`Access to ${storageFileHandle.name} was not granted. Your browser copy is shown.`);
      return;
    }
    const library = await loadStorageFile(storageFileHandle);
    if ((entries.length || watchlist.length) &&
        !confirm(`Load ${storageFileHandle.name}? This will replace the library currently shown in the app.`)) return;
    useFileLibrary(library);
    fileStatus(`Loaded ${storageFileHandle.name}. Changes will save automatically.`);
  } catch (error) {
    fileStatus(`Could not reconnect file: ${error.message || 'access failed'}`);
  }
}

/** Stops using the linked file and clears its remembered handle. */
async function disconnectStorageFile() {
  clearTimeout(fileSaveTimer);
  await pendingFileWrite;
  await rememberedFileHandle(null);
  const previousFileName = storageFileName;
  storageFileHandle = null;
  storageFileName = 'Browser Vault';
  useFileLibrary({ entries: [], watchlist: [], collections: [] });
  fileStatus(`Stopped using ${previousFileName}. Started a new empty library; the file was left unchanged.`);
  showSaveToast('Started a new empty library');
}

$('#choose-storage-file').addEventListener('click', chooseStorageFile);
$('#storage-file-input').addEventListener('change', (event) => {
  loadBasicStorageFile(event.target.files[0]);
});
$('#create-storage-file').addEventListener('click', createStorageFile);
$('#reconnect-storage-file').addEventListener('click', reconnectStorageFile);
$('#disconnect-storage-file').addEventListener('click', () => {
  disconnectStorageFile().catch((error) => fileStatus(`Could not disconnect file: ${error.message}`));
});
/** Handles linked JSON storage files, autosaving, reconnection, and save-state UI. */

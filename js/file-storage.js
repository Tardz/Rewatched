/** File storage module. */
// A user-chosen JSON file can be the active library in browsers with File System Access.
// Its handle is remembered in IndexedDB; localStorage remains a fallback copy.

const FILE_DB_NAME = 'rerun-file-storage';
const FILE_STORE_NAME = 'settings';
const STORAGE_FILE_NAME_KEY = 'rerun-storage-file-name';
const STORAGE_EXPORTED_SNAPSHOT_KEY = 'rerun-exported-library-snapshot';
let storageFileHandle = null;
let fileSaveTimer = null;
let pendingFileWrite = Promise.resolve();
let suppressFileSave = false;
let fileStorageReady = false;
let useBasicFilePicker = false;
let useElectronStorage = false;
let browserFileImportedThisSession = false;
let browserFileNoticeDismissed = false;
let loadStatusTimer = null;
let storageFileName = localStorage.getItem(STORAGE_FILE_NAME_KEY) || 'Browser Vault';
let currentStorageSaveState = 'saved';
window.__rewatchedDirty = false;

// Ask for confirmation when the app is closed while a file save is pending.
// Electron and regular browsers both turn this into their native leave-page dialog.
window.addEventListener('beforeunload', (event) => {
  // Electron shows its own save/discard dialog from the main process.
  if (navigator.userAgent.includes('Electron')) return;
  const statusTarget = $('#storage-save-indicator') || $('.dashboard-save-button');
  if (!statusTarget || !window.__rewatchedDirty) return;
  event.preventDefault();
  event.returnValue = '';
});

/** Updates the saved/unsaved state on the legacy indicator or reworked save button. */
function storageSaveState(state) {
  const statusTarget = $('#storage-save-indicator') || $('.dashboard-save-button');
  currentStorageSaveState = state;
  window.__rewatchedDirty = state === 'pending' || state === 'error';
  if (statusTarget) {
    statusTarget.hidden = false;
    statusTarget.classList.toggle('is-pending', state === 'pending');
    statusTarget.classList.toggle('is-error', state === 'error');
    statusTarget.classList.toggle('is-saved', state === 'saved');
  }
  const status = state === 'error'
    ? 'Could not save changes'
    : state === 'pending' ? 'Changes waiting to be saved' : 'All changes saved';
  if (statusTarget?.id === 'storage-save-indicator') {
    statusTarget.title = status;
    statusTarget.setAttribute('aria-label', status);
  }
  const checkButton = $('.dashboard-save-button');
  if (checkButton) {
    checkButton.title = `Storage Consistency Check — ${status}`;
    checkButton.setAttribute('aria-label', `Open Storage Consistency Check. ${status}`);
  }
  updateStorageIndicator();
}

/** Returns a compact stable signature for the library, excluding export metadata. */
function getLibrarySnapshotSignature() {
  const snapshot = JSON.stringify({ entries, watchlist, collections: customCollections });
  let hash = 2166136261;
  for (let index = 0; index < snapshot.length; index += 1) {
    hash = Math.imul(hash ^ snapshot.charCodeAt(index), 16777619);
  }
  return `${snapshot.length}:${(hash >>> 0).toString(16)}`;
}

/** Records the current browser library as an exported copy. */
function markLibraryExported() {
  try {
    localStorage.setItem(STORAGE_EXPORTED_SNAPSHOT_KEY, getLibrarySnapshotSignature());
  } catch (error) {
    console.warn('Could not remember the exported library state.', error);
  }
  updateStorageIndicator();
}

window.addEventListener('rewatched:library-exported', markLibraryExported);

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
  if (useElectronStorage) {
    const file = await window.rewatchedStorage.load();
    if (!file) throw new Error('No storage file is selected.');
    return { data: JSON.parse(file.contents) };
  }

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
    throw new Error('The selected JSON file cannot be reopened here. Import it again in Storage settings.');
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

$('.dashboard-save-button').addEventListener('click', showStorageComparison);

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
  if (useElectronStorage) {
    clearTimeout(fileSaveTimer);
    await pendingFileWrite;
    await window.rewatchedStorage.save(JSON.stringify(snapshot, null, 2));
    storageSaveState('saved');
    fileStatus(`Saved to ${storageFileName}.`);
    return { target: storageFileName, snapshot };
  }
  if (!storageFileHandle) {
    storageSaveState('saved');
    return { target: 'Browser storage', snapshot };
  }
  let permission = await storageFileHandle.queryPermission({ mode: 'readwrite' });
  if (permission !== 'granted' && storageFileHandle.requestPermission) {
    permission = await storageFileHandle.requestPermission({ mode: 'readwrite' });
  }
  if (permission !== 'granted') throw new Error('File access needs to be renewed. Choose the file again.');
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

/** Refreshes the storage name on the legacy label or reworked button. */
function updateStorageIndicator() {
  const nameTarget = $('#current-storage-name') || $('.dashboard-storage-button');
  const isBrowserStorage = !useElectronStorage && !storageFileHandle;
  const activeStorageName = isBrowserStorage && !browserFileImportedThisSession
    ? 'Browser'
    : storageFileName === 'Browser Vault' ? 'Browser' : storageFileName;
  if (nameTarget) nameTarget.textContent = activeStorageName.replace(/\.[^.]+$/, '');
  const summarySource = document.querySelector('.backup-summary-source');
  const summarySourceName = summarySource?.querySelector('.backup-summary-source-name');
  if (summarySource) {
    summarySource.dataset.storageSource = activeStorageName === 'Browser' ? 'browser' : 'file';
    if (summarySourceName) summarySourceName.textContent = activeStorageName;
  }
  const navStorageName = $('.nav-storage-text');
  if (navStorageName) {
    navStorageName.textContent = activeStorageName.replace(/\.json$/i, '');
    const navSaveButton = $('.nav-storage-button');
    const navSaveIcon = $('.nav-storage-icon');
    let hasUnexportedData = false;
    if (isBrowserStorage) {
      const hasData = entries.length > 0 || watchlist.length > 0 || customCollections.length > 0;
      let exportedSignature = '';
      try {
        exportedSignature = localStorage.getItem(STORAGE_EXPORTED_SNAPSHOT_KEY) || '';
      } catch (error) {
        console.warn('Could not read the exported library state.', error);
      }
      hasUnexportedData = hasData && exportedSignature !== getLibrarySnapshotSignature();
    }
    const state = currentStorageSaveState === 'error'
      ? 'error'
      : currentStorageSaveState === 'pending' ? 'pending'
        : hasUnexportedData ? 'unexported' : 'saved';
    const stateLabel = state === 'unexported'
      ? 'Browser copy has not been exported'
      : state === 'error' ? 'Could not save storage changes'
        : state === 'pending' ? 'Storage changes are not saved yet' : 'Storage is up to date';
    navSaveIcon?.setAttribute('data-storage-state', state);
    navSaveIcon?.setAttribute(
      'data-storage-source',
      isBrowserStorage && !browserFileImportedThisSession ? 'browser' : 'file',
    );
    navSaveIcon?.setAttribute('title', stateLabel);
    navSaveButton?.setAttribute('aria-label', `${activeStorageName}. ${stateLabel}. Open storage settings`);
    navSaveButton?.setAttribute('title', `${activeStorageName} — ${stateLabel}`);
  }
}

/** Remembers the selected file's name even when the browser cannot retain its handle. */
function setStorageFileName(name) {
  storageFileName = name || 'Browser Vault';
  browserFileImportedThisSession = false;
  try {
    if (storageFileName === 'Browser Vault') localStorage.removeItem(STORAGE_FILE_NAME_KEY);
    else localStorage.setItem(STORAGE_FILE_NAME_KEY, storageFileName);
  } catch (error) {
    console.warn('Could not remember the selected storage file name.', error);
  }
  updateStorageIndicator();
  updateBrowserFileNotice();
}

/** Shows an important-info trigger when this browser cannot reopen its selected file. */
function updateBrowserFileNotice() {
  const button = document.querySelector('#storage-notice-info-button');
  const popup = document.querySelector('#storage-notice-info-help');
  if (!button || !popup || !document.querySelector('#load-status')) return;
  const show = useBasicFilePicker && storageFileName !== 'Browser Vault' && !browserFileNoticeDismissed;
  button.hidden = !show;
  if (show) {
    popup.textContent = `This browser cannot automatically reopen or save to ${storageFileName}. Your current library is saved in the browser storage. Import the previous file to connect it again or export the current browser storage to save it.`;
  } else {
    popup.hidden = true;
    button.setAttribute('aria-expanded', 'false');
  }
}

/** Hides the browser limitation notice after a file is successfully loaded. */
function dismissBrowserFileNotice() {
  browserFileNoticeDismissed = true;
  updateBrowserFileNotice();
}

/** Displays a compact action result beside the Load title. */
function showLoadStatus(message, type = 'warning', detail = message) {
  const status = document.querySelector('#load-status');
  if (!status) return false;
  pauseLoadStatusTimer();
  status.textContent = message;
  status.hidden = !message;
  status.dataset.status = type;
  if (type === 'warning' && message === 'Browser copy loaded') status.dataset.warningKind = 'browser-copy';
  else delete status.dataset.warningKind;
  status.title = detail;
  status.setAttribute('aria-label', detail);
  if (message) startLoadStatusTimer();
  return true;
}

/** Starts the Load message timer only while its settings panel is visible. */
function startLoadStatusTimer() {
  const status = document.querySelector('#load-status');
  if (!status || status.hidden || !status.textContent || !$('.settings-container')?.open || $('#settings-panel-storage')?.hidden) return;
  pauseLoadStatusTimer();
  const message = status.textContent;
  loadStatusTimer = setTimeout(() => {
    if (status.textContent !== message) return;
    status.textContent = '';
    status.hidden = true;
    delete status.dataset.status;
    delete status.dataset.warningKind;
    status.removeAttribute('title');
    status.removeAttribute('aria-label');
  }, 4000);
}

/** Pauses the Load message timer while its settings panel is hidden. */
function pauseLoadStatusTimer() {
  clearTimeout(loadStatusTimer);
  loadStatusTimer = null;
}

/** Displays a storage status or error message. */
function fileStatus(message, requestedType = '') {
  updateStorageIndicator();
  if (!storageFileHandle) storageSaveState('saved');
  const error = message.startsWith('Could not');
  const reconnect = /choose the file again|import .+ again|file access needs|browser-stored copy/i.test(message);
  const shortMessage = error
    ? (/save/i.test(message) ? 'Could not save file' : /create/i.test(message) ? 'Could not create file' : 'Could not load file')
    : /^This browser cannot link/.test(message) ? 'File access unavailable'
    : reconnect ? 'Reconnect file'
    : /^Created/.test(message) ? 'File created'
    : /^File downloaded/.test(message) ? 'File downloaded'
    : /^(Saved|Auto-saved)/.test(message) ? 'File saved'
    : /^(Loaded|Using)/.test(message) ? 'File loaded'
    : /^This browser cannot automatically reopen/.test(message) ? 'Browser copy loaded'
    : /^No file selected/.test(message) ? 'No file selected'
    : message;
  const type = requestedType || (error ? 'error' : reconnect || /^This browser cannot link|^No file selected|^File downloaded|^This browser cannot automatically reopen/.test(message) ? 'warning' : 'success');
  if (!showLoadStatus(shortMessage, type, message)) console.warn('Could not display the file status because the Load message element is missing.', message);
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
async function rememberedFileHandle(replacement, key = 'library') {
  const database = await fileDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(FILE_STORE_NAME, replacement === undefined ? 'readonly' : 'readwrite');
      const store = transaction.objectStore(FILE_STORE_NAME);
      const request = replacement === undefined
        ? store.get(key)
        : replacement === null ? store.delete(key) : store.put(replacement, key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    database.close();
  }
}

/** Stores a browser-side recovery copy for the selected file. */
function rememberedLibrarySnapshot(replacement) {
  return rememberedFileHandle(replacement, 'library-snapshot');
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
  if (window.indexedDB && storageFileName !== 'Browser Vault') {
    rememberedLibrarySnapshot(makeBackupSnapshot()).catch((error) => {
      console.warn('Could not update the saved library recovery copy.', error);
    });
  }
  if (useElectronStorage) {
    storageSaveState('pending');
    clearTimeout(fileSaveTimer);
    const snapshot = JSON.stringify(makeBackupSnapshot(), null, 2);
    fileSaveTimer = setTimeout(() => {
      pendingFileWrite = pendingFileWrite.catch(() => {}).then(() =>
        window.rewatchedStorage.save(snapshot)
      ).then(() => {
        fileStatus(`Auto-saved to ${storageFileName}.`);
        storageSaveState('saved');
      }).catch((error) => {
        fileStatus(`Could not save ${storageFileName}: ${error.message || 'file access failed'}.`);
        storageSaveState('error');
        console.warn('Could not auto-save storage file.', error);
      });
    }, 250);
    return;
  }
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
        fileStatus(`File access needs to be renewed for ${handle.name}. Choose the file again.`);
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
  storageFileHandle = handle;
  setStorageFileName(handle.name);
  await rememberedFileHandle(handle);
  useFileLibrary(library);
  await rememberedLibrarySnapshot(makeBackupSnapshot());
  dismissBrowserFileNotice();
  const permission = await handle.queryPermission({ mode: 'readwrite' });
  fileStatus(permission === 'granted'
    ? `Using ${handle.name}. Changes will save automatically.`
    : `Loaded ${handle.name}. Choose the file again to allow automatic saving.`);
}

/** Restores the previously connected file during startup. */
async function initializeFileStorage() {
  fileStorageReady = true;
  if (window.rewatchedStorage) {
    $('#create-storage-file').disabled = false;
    try {
      const file = await window.rewatchedStorage.load();
      if (!file) {
        useElectronStorage = false;
        setStorageFileName('Browser Vault');
        fileStatus('No file selected. Your library is saved in this app.');
        return;
      }
      const library = readBackup(JSON.parse(file.contents));
      useElectronStorage = true;
      setStorageFileName(file.name);
      useFileLibrary(library);
      await rememberedLibrarySnapshot(makeBackupSnapshot());
      dismissBrowserFileNotice();
      fileStatus(`Loaded ${file.name}. Changes will save automatically.`);
    } catch (error) {
      useElectronStorage = false;
      fileStatus(`Could not load linked file: ${error.message || 'access failed'}. Your app copy is shown.`);
      console.warn('Could not load Electron storage file.', error);
    }
    return;
  }

  if (!window.showOpenFilePicker || !window.showSaveFilePicker || !window.indexedDB) {
    useBasicFilePicker = true;
    $('#create-storage-file').disabled = false;
    if (storageFileName !== 'Browser Vault') await restoreRememberedLibrary();
    updateBrowserFileNotice();
    if (storageFileName !== 'Browser Vault') {
      fileStatus(`This browser cannot automatically reopen or save to ${storageFileName}.\n\nYour current library is saved in this browser.\n\nUse Export file to save a JSON copy.`);
    } else if (!$('#load-status')) {
      fileStatus('Choose a JSON file to load it. This browser keeps a browser copy, but cannot reopen or save back to the selected file. Use Export file to save your changes.');
    }
    return;
  }
  try {
    const handle = await rememberedFileHandle();
    if (!handle) {
      if (storageFileName !== 'Browser Vault') await restoreRememberedLibrary();
      fileStatus(storageFileName === 'Browser Vault'
        ? 'No file selected. Your library is saved in this browser.'
        : `Using a browser-stored copy of ${storageFileName}. Import the file again to restore file access.`);
      return;
    }
    storageFileHandle = handle;
    setStorageFileName(handle.name);
    let readPermission = await handle.queryPermission({ mode: 'read' });
    // Some browsers return "prompt" after a reload even though this handle is
    // still stored. Try to restore read access before falling back to the
    // browser copy; browsers that require a user gesture will keep returning
    // "prompt" and the file must be chosen again through Storage settings.
    if (readPermission !== 'granted' && handle.requestPermission) {
      try {
        readPermission = await handle.requestPermission({ mode: 'read' });
      } catch (error) {
        console.info('The saved file needs a user gesture to reconnect.', error);
      }
    }
    if (readPermission !== 'granted') {
      await restoreRememberedLibrary();
      fileStatus(`Import ${handle.name} again to load it. Your browser copy is shown for now.`);
      return;
    }
    const library = await loadStorageFile(handle);
    useFileLibrary(library);
    await rememberedLibrarySnapshot(makeBackupSnapshot());
    const writePermission = await handle.queryPermission({ mode: 'readwrite' });
    fileStatus(writePermission === 'granted'
      ? `Loaded ${handle.name}. Changes will save automatically.`
      : `Loaded ${handle.name}. Choose the file again to allow automatic saving.`);
  } catch (error) {
    fileStatus(`Could not load linked file: ${error.message || 'access failed'}. Your browser copy is shown.`);
    console.warn('Could not load storage file.', error);
  }
}

/** Restores the last loaded file copy when browser file access is unavailable. */
async function restoreRememberedLibrary() {
  try {
    const snapshot = await rememberedLibrarySnapshot();
    if (!snapshot) return false;
    useFileLibrary(readBackup(snapshot));
    return true;
  } catch (error) {
    console.warn('Could not restore the saved library copy.', error);
    return false;
  }
}

/** Opens a picker to select an existing storage file. */
async function chooseStorageFile() {
  if (window.rewatchedStorage) {
    try {
      const file = await window.rewatchedStorage.choose();
      if (!file) return;
      const library = readBackup(JSON.parse(file.contents));
      if ((entries.length || watchlist.length) &&
          !confirm(`Load ${file.name}? This will replace the library currently shown in the app.`)) return;
      await window.rewatchedStorage.remember(file.filePath);
      clearTimeout(fileSaveTimer);
      await pendingFileWrite;
      useElectronStorage = true;
      setStorageFileName(file.name);
      useFileLibrary(library);
      await rememberedLibrarySnapshot(makeBackupSnapshot());
      fileStatus(`Loaded ${file.name}. Changes will save automatically.`);
    } catch (error) {
      if (error.name !== 'AbortError') fileStatus(`Could not use file: ${error.message || 'access failed'}`);
    }
    return;
  }

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
      $('#create-storage-file').disabled = false;
      updateBrowserFileNotice();
      fileStatus('This browser cannot link a file here. Click Import file again to load it. Use Export file to save later changes.');
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
    setStorageFileName(file.name);
    browserFileImportedThisSession = true;
    updateStorageIndicator();
    if (window.indexedDB) await rememberedFileHandle(null);
    useFileLibrary(library);
    if (window.indexedDB) await rememberedLibrarySnapshot(makeBackupSnapshot());
    markLibraryExported();
    dismissBrowserFileNotice();
    fileStatus(`Loaded ${file.name} into this browser. To save your changes as a file, use Export file.`);
  } catch (error) {
    fileStatus(`Could not load file: ${error.message || 'invalid JSON'}`);
  }
}

/** Builds a new, empty library in the app's backup format. */
function emptyLibrarySnapshot() {
  return {
    format: 'rerun-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    entries: [],
    watchlist: [],
    collections: [],
  };
}

/** Downloads a JSON snapshot where file pickers are unavailable. */
function downloadStorageSnapshot(snapshot = makeBackupSnapshot()) {
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'vault.json';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  fileStatus('File downloaded. Import it to load it and enable automatic saving.', 'warning');
}

/** Creates a new empty storage file after confirming replacement of the current library. */
async function createStorageFile() {
  if (!confirm('Create a new empty file? Your current library will be replaced. Export it first if you want to keep a copy.')) return;

  const emptySnapshot = emptyLibrarySnapshot();
  const emptyLibrary = { entries: [], watchlist: [], collections: [] };

  if (window.rewatchedStorage) {
    try {
      const file = await window.rewatchedStorage.create(JSON.stringify(emptySnapshot, null, 2));
      if (!file) return;
      clearTimeout(fileSaveTimer);
      await pendingFileWrite;
      useElectronStorage = true;
      setStorageFileName(file.name);
      useFileLibrary(emptyLibrary);
      await rememberedLibrarySnapshot(makeBackupSnapshot());
      fileStatus(`Created an empty ${file.name}. Changes will save automatically.`);
    } catch (error) {
      if (error.name !== 'AbortError') fileStatus(`Could not create file: ${error.message || 'access failed'}`);
    }
    return;
  }

  if (!window.showSaveFilePicker || !window.indexedDB) {
    downloadStorageSnapshot(emptySnapshot);
    storageFileHandle = null;
    useElectronStorage = false;
    setStorageFileName('Browser Vault');
    useFileLibrary(emptyLibrary);
    if (window.indexedDB) {
      await rememberedFileHandle(null);
      await rememberedLibrarySnapshot(emptySnapshot);
    }
    fileStatus('Created an empty library and downloaded its JSON file. Later browser changes will need a new export to update that file.', 'warning');
    return;
  }
  try {
    const handle = await window.showSaveFilePicker({
      ...filePickerOptions(),
      suggestedName: 'vault.json',
    });
    clearTimeout(fileSaveTimer);
    await pendingFileWrite;
    const writer = await handle.createWritable();
    await writer.write(JSON.stringify(emptySnapshot, null, 2));
    await writer.close();
    storageFileHandle = handle;
    setStorageFileName(handle.name);
    await rememberedFileHandle(handle);
    useFileLibrary(emptyLibrary);
    await rememberedLibrarySnapshot(makeBackupSnapshot());
    fileStatus(`Created an empty ${handle.name}. Changes will save automatically.`);
  } catch (error) {
    if (error.name === 'SecurityError' || error.name === 'NotAllowedError') {
      useBasicFilePicker = true;
      $('#create-storage-file').disabled = false;
      downloadStorageSnapshot(emptySnapshot);
      storageFileHandle = null;
      useElectronStorage = false;
      setStorageFileName('Browser Vault');
      useFileLibrary(emptyLibrary);
      if (window.indexedDB) {
        await rememberedFileHandle(null);
        await rememberedLibrarySnapshot(emptySnapshot);
      }
      fileStatus('Created an empty library and downloaded its JSON file. Later browser changes will need a new export to update that file.', 'warning');
    } else if (error.name !== 'AbortError') {
      fileStatus(`Could not create file: ${error.message || 'access failed'}`);
    }
  }
}

$('#choose-storage-file').addEventListener('click', chooseStorageFile);
$('#storage-file-input').addEventListener('change', (event) => {
  loadBasicStorageFile(event.target.files[0]);
});
$('#create-storage-file').addEventListener('click', createStorageFile);
/** Handles linked JSON storage files, autosaving, reconnection, and save-state UI. */

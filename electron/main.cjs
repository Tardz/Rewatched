const { app, BrowserWindow, dialog, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

const projectRoot = path.resolve(__dirname, '..');
let mainWindow;
let reloadTimer;
let localServer;
let isQuitting = false;

function startLocalServer() {
  return new Promise((resolve) => {
    localServer = http.createServer((request, response) => {
      const requestPath = decodeURIComponent((request.url || '/').split('?')[0]);
      const relativePath = requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/, '');
      const filePath = path.resolve(projectRoot, relativePath);
      if (!filePath.startsWith(`${projectRoot}${path.sep}`)) {
        response.writeHead(403);
        response.end('Forbidden');
        return;
      }

      fs.readFile(filePath, (error, data) => {
        if (error) {
          response.writeHead(error.code === 'ENOENT' ? 404 : 500);
          response.end('Not found');
          return;
        }
        const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
        response.writeHead(200, { 'Content-Type': types[path.extname(filePath)] || 'application/octet-stream' });
        response.end(data);
      });
    });
    // Keep the origin stable so IndexedDB can remember the selected storage
    // file and API settings between Electron launches.
    localServer.listen(4173, '127.0.0.1', () => resolve(localServer.address().port));
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 900,
    minHeight: 650,
    title: 'Rewatched',
    backgroundColor: '#111318',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const port = await startLocalServer();
  mainWindow.loadURL(`http://127.0.0.1:${port}/index.html`);
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const target = new URL(url);
      if (target.protocol === 'https:' && target.hostname === 'github.com') {
        shell.openExternal(target.href);
      }
    } catch (error) {
      console.warn('Blocked an invalid external link:', error);
    }
    return { action: 'deny' };
  });

  if (process.env.OPEN_DEVTOOLS === '1') mainWindow.webContents.openDevTools();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function watchSourceFiles() {
  if (app.isPackaged) return;

  fs.watch(projectRoot, { recursive: true }, (_eventType, filename) => {
    if (!filename || filename.startsWith('node_modules') || filename.startsWith('.git')) return;
    if (!/\.(html|css|js|cjs)$/.test(filename)) return;
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.reload();
    }, 120);
  });
}

app.whenReady().then(async () => {
  await createWindow();
  watchSourceFiles();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', async (event) => {
  if (isQuitting || !mainWindow || mainWindow.isDestroyed()) return;

  event.preventDefault();
  let hasUnsavedChanges = false;
  try {
    hasUnsavedChanges = await mainWindow.webContents.executeJavaScript(
      "Boolean(window.__rewatchedDirty)",
      true,
    );
  } catch {
    hasUnsavedChanges = false;
  }

  if (!hasUnsavedChanges) {
    isQuitting = true;
    app.quit();
    return;
  }

  const choice = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    title: 'Unsaved changes',
    message: 'You have changes that have not been saved.',
    detail: 'Would you like to save them before closing Rewatched?',
    buttons: ['Save and quit', 'Quit without saving', 'Cancel'],
    defaultId: 0,
    cancelId: 2,
  });

  if (choice.response === 2) return;
  if (choice.response === 0) {
    try {
      await mainWindow.webContents.executeJavaScript(
        "typeof saveLinkedFileNow === 'function' ? saveLinkedFileNow() : Promise.resolve()",
        true,
      );
    } catch {
      return;
    }
  }
  isQuitting = true;
  app.quit();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

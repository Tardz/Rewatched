const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('rewatchedStorage', {
  load: () => ipcRenderer.invoke('storage:load'),
  choose: () => ipcRenderer.invoke('storage:choose'),
  remember: (filePath) => ipcRenderer.invoke('storage:remember', filePath),
  create: (contents) => ipcRenderer.invoke('storage:create', contents),
  save: (contents) => ipcRenderer.invoke('storage:save', contents),
  forget: () => ipcRenderer.invoke('storage:forget'),
});

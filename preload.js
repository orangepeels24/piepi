const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('piepi', {
  // Window
  minimize:        ()      => ipcRenderer.send('win-minimize'),
  maximize:        ()      => ipcRenderer.send('win-maximize'),
  close:           ()      => ipcRenderer.send('win-close'),

  // Store
  storeGet:        ()      => ipcRenderer.invoke('store-get'),
  storeSet:        (d)     => ipcRenderer.invoke('store-set', d),

  // Package cache
  cacheGet:        ()      => ipcRenderer.invoke('cache-get'),
  cacheSet:        (d)     => ipcRenderer.invoke('cache-set', d),

  // pip
  pipInstall:      (opts)  => ipcRenderer.invoke('pip-install', opts),

  // Python
  getInterpreters: ()      => ipcRenderer.invoke('get-interpreters'),
});

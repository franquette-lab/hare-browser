const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('downloadsApi', {
    onRender: (callback) => ipcRenderer.on('render-downloads', (_event, data) => callback(data)),
    openFolder: (id) => ipcRenderer.send('downloads-open-folder', id),
    cancel: (id) => ipcRenderer.send('downloads-cancel', id),
    remove: (id) => ipcRenderer.send('downloads-remove', id),
    clear: () => ipcRenderer.send('downloads-clear')
});

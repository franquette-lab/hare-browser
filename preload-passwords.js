const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('passwordApi', {
    onRenderPasswords: (callback) => {
        if (typeof callback === 'function') {
            ipcRenderer.on('render-passwords', (_event, data) => callback(data));
        }
    },
    savePassword: (entry) => ipcRenderer.send('pwd-ui-save', entry),
    deletePassword: (index) => ipcRenderer.send('pwd-ui-delete', index)
});

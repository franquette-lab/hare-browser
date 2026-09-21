// ==================
// preload-history.js
// ==================
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld(
    'historyApi',
    {
        // Permet à la page d'écouter les données envoyées par main.js
        onRenderHistory: (callback) => {
            ipcRenderer.on('render-history', (event, data) => callback(data));
        },
        // Fonctions d'action sécurisées vers le processus principal
        clearAllHistory: () => ipcRenderer.send('clear-all-history'),
        deleteSingleHistory: (index) => ipcRenderer.send('delete-single-history', index),
        historyClick: (url) => ipcRenderer.send('history-click', url)
    }
);

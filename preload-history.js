// ==================
// preload-history.js
// ==================

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld(
    'historyApi',
    {


        onRenderHistory: (callback) => {
 //         console.log("PRELOAD : écoute render-history");

            ipcRenderer.on('render-history', (event, data) => {
//              console.log("PRELOAD : render-history reçu");
                callback(data);
            });
        },

        onThemeChanged: (callback) => {
            ipcRenderer.on('history-theme-changed', (_event, isDarkMode) => callback(isDarkMode));
        },

        // Fonctions d'action sécurisées vers le processus principal
        clearAllHistory: () => ipcRenderer.send('clear-all-history'),
        deleteSingleHistory: (index) => ipcRenderer.send('delete-single-history', index),
        historyClick: (url) => ipcRenderer.send('history-click', url)
    }
);


// ------------------- //
// SCRIPT : preload.js //
// ------------------- //

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld(
    'api',
    {

        onAppTitle: (callback) => {
            ipcRenderer.on("app-title", (_, title) => {
                callback(title);
            });
        },
                
        // À insérer dans preload.js à l'intérieur de l'objet 'api'
        clearFavoris: () => ipcRenderer.invoke('clear-favoris'),

        getSystemTheme: () => ipcRenderer.invoke("get-system-theme"),

        getThemePreference: () => ipcRenderer.invoke("get-theme-preference"),

        saveThemePreference: (isDark) => ipcRenderer.invoke("save-theme-preference", isDark),
        
        sendDragStart: (panelId) => ipcRenderer.send("panel-drag-start", panelId),
        sendDragEnd: () => ipcRenderer.send("panel-drag-end"),

        setActivePanel: (panelId) => ipcRenderer.send("set-active-panel", panelId),

        navigate: (panelId, url) => ipcRenderer.send('navigate', panelId, url),

        goBack: (panelId) => ipcRenderer.invoke("go-back", panelId),

        goForward: (panelId) => ipcRenderer.invoke("go-forward", panelId),

        movePanel: (draggedPanelId, targetPanelId) => ipcRenderer.send('move-panel', draggedPanelId, targetPanelId),

        refresh: (panelId) => ipcRenderer.invoke("refresh", panelId),

        splitPanel: (panelId, direction) => ipcRenderer.send('split-panel', panelId, direction),

        // ====== DANS PRELOAD.JS -> DANS L'OBJET 'api' ======
        undo: () => ipcRenderer.send("undo"), // Ligne existante

        // AJOUTEZ CETTE LIGNE :
        openHistoryWindow: () => ipcRenderer.send("open-history-window"),

        // === AJOUTEZ CES 3 LIGNES ESSENTIELLES ICI ===
        getHistory: () => ipcRenderer.invoke('get-history'),

        // À insérer à l'intérieur de contextBridge.exposeInMainWorld('api', { ... })
        clearHistory: () => ipcRenderer.invoke("clear-history"),

        deleteHistoryItem: (index) => ipcRenderer.invoke("delete-history-item", index),


        onHistoryUpdated: (callback) => ipcRenderer.on('history-updated', (event, data) => callback(data)),
       
        // À ajouter dans l'objet 'api' de preload.js :
        onZoomChanged: (callback) => {
            ipcRenderer.on("zoom-changed", (event, maximizedPanelId) => callback(maximizedPanelId));
        },

        // À insérer à l'intérieur de contextBridge.exposeInMainWorld('api', { ... })
        toggleDarkMode: (enable) =>
            ipcRenderer.send('toggle-dark-mode-request', enable),

        onActivePanelChanged: (callback) => {
            ipcRenderer.on("active-panel-changed", (event, panel) => callback(panel));
        },
        onSplittersUpdated: (callback) => {
            ipcRenderer.on("splitters-updated", (event, splitters) => callback(splitters));
        },

        // À l'intérieur de contextBridge.exposeInMainWorld('api', { ... }) :
        onFocusUrlBar: (callback) => ipcRenderer.on("focus-url-bar", (event, panelId) => callback(panelId)),

        onPanelsUpdated: (callback) => {
            // === CORRECTION : Transmettre tous les arguments reçus (...args) ===
            ipcRenderer.on("panels-updated", (_event, ...args) => {
                callback(...args);
            });
        },

        onUndoAvailable: (callback) => {
            ipcRenderer.on("undo-available", (event, available) => callback(available));
        },

        onNavigationState: (callback) => {
            ipcRenderer.on("navigation-state",(_event, state) => callback(state));
        },

        // === FIX : Séparation correcte des fonctions IPC dans le contextBridge ===
        onDownloadProgress: (callback) => {
            ipcRenderer.on("download-progress", (event, data) => callback(data));
        },
        
        onDownloadDone: (callback) => {
            ipcRenderer.on("download-done", (event, data) => callback(data));
        },

        cancelDownload: (panelId) => {
            ipcRenderer.send("cancel-download", panelId);
        },

        closePanel: (panelId) => ipcRenderer.send("close-panel", panelId),

        // À insérer juste avant la fin de contextBridge.exposeInMainWorld('api', { ... })
        onToggleBookmarksBar: (callback) => ipcRenderer.on("toggle-bookmarks-bar", (event, visible) => callback(visible)),

        // À ajouter dans contextBridge.exposeInMainWorld('api', { ... })
        getFavoris: () => ipcRenderer.invoke('get-favoris'),

        toggleFavori: (data) => ipcRenderer.invoke('toggle-favori', data),
        
        // À ajouter juste en dessous de toggleFavori ou getFavoris dans preload.js :
        toggleBookmarksBarFromUI: () => ipcRenderer.send("toggle-bookmarks-bar-request"),

        onFavorisUpdated: (callback) => ipcRenderer.on('favoris-updated', (event, favoris) => callback(favoris)),
        
        // À ajouter dans l'objet 'api' de preload.js :
        onFocusUrlBar: (callback) => ipcRenderer.on("focus-url-bar", (event, panelId) => callback(panelId)),

        // À insérer à l'intérieur de l'objet exposé sous 'api' dans preload.js :
        onNavigationStateChanged: (callback) => {
            ipcRenderer.on("navigation-state-changed", (event, data) => callback(data));
        },

        // À insérer juste avant la fin de contextBridge.exposeInMainWorld('api', { ... })
        onTitleChanged: (callback) => ipcRenderer.on("app-title-changed", (event, title) => callback(title)),

        onSystemThemeChanged: (callback) => {
    ipcRenderer.on("system-theme-changed", (_, isDark) => {
        callback(isDark);
    });
}

    }
);


// Intercepte les requêtes de Long Press des pages internet et les pousse vers le système

/*
window.addEventListener("message", (event) => {
    if (event.data && event.data.source === "tile-browser-drag") {
        if (event.data.type === "start") {
            ipcRenderer.send("panel-drag-start", event.data.panelId);
        }
    }
});
*/

// Intercepte les requêtes de la poignée injectée et les pousse vers Electron
window.addEventListener("message", (event) => {
    if (!event.data) return;

    if (event.data.source === "tile-browser-focus") {
        ipcRenderer.send("set-active-panel-from-handle", event.data.panelId);
    }
    if (event.data.source === "handle-drag-start") {
        ipcRenderer.send("handle-drag-start", event.data.panelId);
    }
    if (event.data.source === "handle-drag-move") {
        ipcRenderer.send("handle-drag-move");
    }
    if (event.data.source === "handle-drag-end") {
        ipcRenderer.send("handle-drag-end");
    }
});

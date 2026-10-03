const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld(
    'api',
    {
        // --- ÉCOUTEURS SYSTÈME ET THÈME ---
        onAppTitle: (callback) => {
            ipcRenderer.on("app-title", (_, title) => callback(title));
        },
        
        onTitleChanged: (callback) => {
            ipcRenderer.on("app-title-changed", (event, title) => callback(title));
        },

        getSystemTheme: () => ipcRenderer.invoke("get-system-theme"),
        getThemePreference: () => ipcRenderer.invoke("get-theme-preference"),
        saveThemePreference: (isDark) => ipcRenderer.invoke("save-theme-preference", isDark),
        toggleDarkMode: (enable) => ipcRenderer.send('toggle-dark-mode-request', enable),
        
        onSystemThemeChanged: (callback) => {
            ipcRenderer.on("system-theme-changed", (_, isDark) => callback(isDark));
        },





        // --- GESTION GÉOMÉTRIE ET PANNEAUX ACTIFS ---
        setActivePanel: (panelId, options) => ipcRenderer.send("set-active-panel", panelId, options),
        closePanel: (panelId) => ipcRenderer.send("close-panel", panelId),
        splitPanel: (panelId, direction, isPrivate, initialUrl) => ipcRenderer.send('split-panel', panelId, direction, isPrivate, initialUrl),
        undo: () => ipcRenderer.send("undo"),
        
onActivePanelChanged: (callback) => {
    ipcRenderer.on("active-panel-changed", (_event, donneesPanel) => {
        if (typeof callback === "function" && donneesPanel) {
            callback(donneesPanel);
        }
    });
},
        openPasswordManagerWindow: () =>
    ipcRenderer.send("open-password-manager-window"),


        openHistoryWindow: () => ipcRenderer.send("open-history-window"),

        onPanelsUpdated: (callback) => {
            ipcRenderer.on("panels-updated", (_event, panelsList, zoomPanelId) => {
                if (typeof callback === "function") {
                    callback(panelsList, zoomPanelId);
                }
            });
        },




        onZoomChanged: (callback) => {
            ipcRenderer.on("zoom-changed", (event, maximizedPanelId) => callback(maximizedPanelId));
        },
        
        onSplittersUpdated: (callback) => {
            ipcRenderer.on("splitters-updated", (event, splitters) => callback(splitters));
        },

        // --- NAVIGATION ET ADRESSES ---
        navigate: (panelId, url) => ipcRenderer.send('navigate', panelId, url),
        goBack: (panelId) => ipcRenderer.invoke("go-back", panelId),
        goForward: (panelId) => ipcRenderer.invoke("go-forward", panelId),
        refresh: (panelId) => ipcRenderer.invoke("refresh", panelId),
        movePanel: (draggedPanelId, targetPanelId) => ipcRenderer.send('move-panel', draggedPanelId, targetPanelId),
        showUrlContextMenu: () => ipcRenderer.send("show-url-context-menu"),
        
        onFocusUrlBar: (callback) => {
            ipcRenderer.on("focus-url-bar", (_event, panelId) => callback(panelId));
        },
        
        onNavigationState: (callback) => {
            ipcRenderer.on("navigation-state", (_event, state) => callback(state));
        },
        
        onNavigationStateChanged: (callback) => {
            ipcRenderer.on("navigation-state-changed", (event, data) => callback(data));
        },

        onPageLoading: (callback) => {
            ipcRenderer.on("page-loading", (event, data) => callback(data));
        },

        openHelp: () => ipcRenderer.invoke('open-help'),


        on: (channel, func) => {
            const validChannels = ["system-theme-changed", "ai-sidebar-geometry-update", "toggle-ai-sidebar-keyboard-force"];
            if (validChannels.includes(channel)) {
                ipcRenderer.removeAllListeners(channel);
                ipcRenderer.on(channel, (event, ...args) => func(...args));
            }
        },

        // --- ASSISTANT IA ---
        toggleAiSidebar: (isVisible) => ipcRenderer.send("toggle-ai-sidebar-request", isVisible),
        
        nanobrowser: {
            getContext: () => ipcRenderer.invoke("nanobrowser-get-context"),
            executeAction: (actionType, argument) => ipcRenderer.invoke("nanobrowser-execute-action", { actionType, argument }),
            askOllama: (prompt, model) => ipcRenderer.invoke("nanobrowser-ask-ollama", { prompt, model })
        },

        // --- HISTORIQUE ---
        openHistoryWindow: () => ipcRenderer.send("open-history-window"),
        getHistory: () => ipcRenderer.invoke('get-history'),
        clearHistory: () => ipcRenderer.invoke("clear-history"),
        deleteHistoryItem: (index) => ipcRenderer.invoke("delete-history-item", index),
        onHistoryUpdated: (callback) => ipcRenderer.on('history-updated', (event, data) => callback(data)),

        // --- FAVORIS (BOOKMARKS) ---
        getFavoris: () => ipcRenderer.invoke('get-favoris'),
        clearFavoris: () => ipcRenderer.invoke('clear-favoris'),
        toggleFavori: (data) => ipcRenderer.invoke('toggle-favori', data),
        toggleBookmarksBarFromUI: () => ipcRenderer.send("toggle-bookmarks-bar-request"),
        onToggleBookmarksBar: (callback) => ipcRenderer.on("toggle-bookmarks-bar", (event, visible) => callback(visible)),
        onFavorisUpdated: (callback) => ipcRenderer.on('favoris-updated', (event, favoris) => callback(favoris)),

        // --- IMPRESSION & TELECHARGEMENTS ---
        printPanel: (panelId) => ipcRenderer.send("print-panel", panelId),
        onUndoAvailable: (callback) => ipcRenderer.on("undo-available", (event, available) => callback(available)),
        onSavePanelsShortcut: (callback) => ipcRenderer.on("save-panels-shortcut", callback),
        cancelDownload: (panelId) => ipcRenderer.send("cancel-download", panelId),
        onDownloadProgress: (callback) => ipcRenderer.on("download-progress", (event, data) => callback(data)),
        
        onDownloadDone: (callback) => {
            ipcRenderer.on("download-done", (event, data) => callback(data));
        }
    }
);

window.addEventListener("message", (event) => {
    if (!event.data) return;
    if (event.data.source === "tile-browser-focus") ipcRenderer.send("set-active-panel-from-handle", event.data.panelId);
    if (event.data.source === "handle-drag-start") ipcRenderer.send("handle-drag-start", event.data.panelId);
    if (event.data.source === "handle-drag-move") ipcRenderer.send("handle-drag-move");
    if (event.data.source === "handle-drag-end") ipcRenderer.send("handle-drag-end");
});

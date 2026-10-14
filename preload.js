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

        onFullscreenToolbarState: (callback) => {
            ipcRenderer.on("fullscreen-toolbar-state", (_event, state) => callback(state));
        },
        requestFullscreenToolbar: (visible) => {
            ipcRenderer.send("fullscreen-toolbar-request", visible);
        },
        toggleFullscreen: () => {
            ipcRenderer.send("toggle-fullscreen-request");
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

        // À insérer à l'intérieur de la configuration de contextBridge.exposeInMainWorld('api', { ... })
        adblock: {
            getExceptions: () => ipcRenderer.invoke('adblock-get-exceptions'),
            toggleException: (host) => ipcRenderer.invoke('adblock-toggle-exception', host),
            onExceptionsUpdated: (callback) => ipcRenderer.on('adblock-exceptions-updated', (event, data) => callback(data))
        },

        // --- NAVIGATION ET ADRESSES ---
        navigate: (panelId, url) => ipcRenderer.send('navigate', panelId, url),
        goBack: (panelId) => ipcRenderer.invoke("go-back", panelId),
        goForward: (panelId) => ipcRenderer.invoke("go-forward", panelId),
        refresh: (panelId) => ipcRenderer.invoke("refresh", panelId),
        findInPage: (panelId, text, action) => ipcRenderer.invoke("find-in-page", { panelId, text, action }),
        onOpenFindBar: (callback) => ipcRenderer.on("open-find-bar", (_event, panelId) => callback(panelId)),
        onFindInPageResult: (callback) => ipcRenderer.on("find-in-page-result", (_event, result) => callback(result)),
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

/*
        on: (channel, func) => {
            const validChannels = ["system-theme-changed", "ai-sidebar-geometry-update", "toggle-ai-sidebar-keyboard-force"];
            if (validChannels.includes(channel)) {
                ipcRenderer.removeAllListeners(channel);
                ipcRenderer.on(channel, (event, ...args) => func(...args));
            }
        },
*/

        // --- GESTION DE LA MISE EN VEILLE AUTOMATIQUE ---
        getAutoSleepPreference: () => ipcRenderer.invoke("get-autosleep-preference"),
        toggleAutoSleep: (enable) => ipcRenderer.send('toggle-autosleep-request', enable),
        onAutoSleepChanged: (callback) => ipcRenderer.on("autosleep-state-changed", (_event, enabled) => callback(enabled)),

        equalizeMosaic: () => ipcRenderer.send("equalize-mosaic-request"),

        // Remplacement dans preload.js pour un durcissement total :
        onSystemThemeChanged: (callback) => {
            ipcRenderer.on("system-theme-changed", (_, isDark) => callback(isDark));
        },
        onAiSidebarGeometryUpdate: (callback) => {
            ipcRenderer.on("ai-sidebar-geometry-update", (_, geometry) => callback(geometry));
        },
        getAiSidebarPreference: () => ipcRenderer.invoke("get-ai-sidebar-preference"),
        onAiSidebarVisibilityChanged: (callback) => {
            ipcRenderer.on("ai-sidebar-visibility-changed", (_event, visible) => callback(visible));
        },
        onTriggerAiAction: (callback) => {
            ipcRenderer.on("trigger-ai-action", (_, data) => callback(data));
        },
        onToggleAiSidebarKeyboardForce: (callback) => {
            ipcRenderer.on("toggle-ai-sidebar-keyboard-force", (_, force) => callback(force));
        },

        // Dans preload.js, sous la section // --- ASSISTANT IA ---
        toggleAiSidebar: (isVisible) => ipcRenderer.send("toggle-ai-sidebar-request", isVisible),
        onAiLoadingState: (callback) => ipcRenderer.on("ai-loading-state", (_, isLoading) => callback(isLoading)),
        
        // ✨ AJOUTEZ / VÉRIFIEZ CETTE LIGNE EXACTE :
        cancelAiRequest: () => ipcRenderer.send("cancel-ollama-request"),

        onReaderModeResult: (callback) => ipcRenderer.on("reader-mode-result", (event, data) => callback(data)),
        onReaderModeStateChanged: (callback) => ipcRenderer.on("reader-mode-state-changed", (_event, data) => callback(data)),
        toggleReaderMode: (panelId) => ipcRenderer.invoke("toggle-reader-mode", panelId),
        openDownloadsWindow: () => ipcRenderer.send("open-downloads-window"),
        duplicatePanel: (panelId) => ipcRenderer.send("duplicate-panel-request", panelId),
        showContainerMenu: (panelId) => ipcRenderer.send("show-container-menu", panelId),
        setAiSidebarWide: (wide) => ipcRenderer.send("set-ai-sidebar-wide", wide),
        onAiSidebarWidthChanged: (callback) => ipcRenderer.on("ai-sidebar-width-changed", (event, width) => callback(width)),

        nanobrowser: {
            getContext: () => ipcRenderer.invoke("nanobrowser-get-context"),
            executeAction: (actionType, argument) => ipcRenderer.invoke("nanobrowser-execute-action", { actionType, argument }),
            askOllama: (prompt, model, compareVisiblePanels = false, fullMode = false) =>
                ipcRenderer.invoke("nanobrowser-ask-ollama", { prompt, model, compareVisiblePanels, fullMode })
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

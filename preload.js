const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld(
    'api',
    {


        onSettingsWindowState: (callback) =>
            ipcRenderer.on(
                "settings-window-state",
                (_event, state) => callback(state)
            ),

        checkSettingsWindowOpened: () =>
            ipcRenderer.send("check-settings-window-opened"),        

        // --- ÉCOUTEURS SYSTÈME ET THÈME ---
        onAppTitle: (callback) => {
            ipcRenderer.on("app-title", (_, title) => callback(title));
        },
        
        // --- ÉCOUTEURS SYSTÈME ET THÈME ---
        onHistoryWindowState: (callback) => {
            ipcRenderer.on("history-window-state", (_, isOpen) => callback(isOpen));
        },
        checkHistoryWindowOpened: () => ipcRenderer.send("check-history-window-opened"),

        // ✨ AJOUT TÉLÉCHARGEMENTS : Transmet les signaux de la popup à index.html
        onDownloadsWindowState: (callback) => {
            ipcRenderer.on("downloads-window-state", (_, isOpen) => callback(isOpen));
        },
        checkDownloadsWindowOpened: () => ipcRenderer.send("check-downloads-window-opened"),

        
        onTitleChanged: (callback) => {
            ipcRenderer.on("app-title-changed", (event, title) => callback(title));
        },

        getLanguage: () => ipcRenderer.invoke("get-language"),
        setLanguage: (language) => ipcRenderer.invoke("set-language", language),
        openSettings: () => ipcRenderer.send("open-settings-window"),
        onLanguageChanged: (callback) => ipcRenderer.on("language-changed", (_event, language) => callback(language)),
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
        showSplitMenu: (panelId, anchor, isDark) => ipcRenderer.send("show-split-menu", panelId, anchor, isDark === true),
        undo: () => ipcRenderer.send("undo"),


        // ✨ AJOUTEZ CETTE LIGNE ICI :
        resetWorkspace: () => ipcRenderer.send("reset-workspace"),

        saveConfigToFile: () => ipcRenderer.invoke('save-config-to-file'),
        loadConfigFromFile: () => ipcRenderer.invoke('load-config-from-file'),
        
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
        onPanelLayoutUpdated: (callback) => {
            ipcRenderer.on("panel-layout-updated", (_event, panelsList) => {
                if (typeof callback === "function") callback(panelsList);
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


    openVideo: (videoFile) =>
        ipcRenderer.invoke("open-tutorial-video", videoFile),





        // --- NAVIGATION ET ADRESSES ---
        navigate: (panelId, url) => ipcRenderer.send('navigate', panelId, url),
        openHomePage: (panelId) => ipcRenderer.invoke("open-home-page", panelId),
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
        getAutoSleepDelayPreference: () => ipcRenderer.invoke("get-autosleep-delay-preference"),
        toggleAutoSleep: (enable) => ipcRenderer.send('toggle-autosleep-request', enable),
        onAutoSleepChanged: (callback) => ipcRenderer.on("autosleep-state-changed", (_event, enabled, delayMinutes) => callback(enabled, delayMinutes)),

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
            askOllama: (promptOrOptions, model, compareVisiblePanels = false, fullMode = false) => {
                // Accepte les deux formes utilisées par l'interface : objet d'options ou arguments positionnels.
                const options = promptOrOptions && typeof promptOrOptions === "object"
                    ? promptOrOptions
                    : { prompt: promptOrOptions, model, compareVisiblePanels, fullMode };
                return ipcRenderer.invoke("nanobrowser-ask-ollama", options);
            },
            getOllamaStatus: (model) => ipcRenderer.invoke("ollama-get-status", model),
            onOllamaStatusChanged: (callback) =>
                ipcRenderer.on("ollama-status-changed", (_event, status) => callback(status))
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
        setBookmarksBarVisible: (visible) => ipcRenderer.send("set-bookmarks-bar-visible", visible === true),
        onToggleBookmarksBar: (callback) => ipcRenderer.on("toggle-bookmarks-bar", (event, visible) => callback(visible)),
        onInitialBookmarksVisibility: (callback) => ipcRenderer.on("bookmarks-initial-visibility", (_event, visible) => callback(visible)),
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

contextBridge.exposeInMainWorld("tutorials", {
    openVideo: (videoFile) => {
        console.info("[Tutoriel] Appel IPC demandé depuis la fenêtre principale :", videoFile);
        return ipcRenderer.invoke("open-tutorial-video", videoFile);
    },
    openAiSidebar: () => {
        ipcRenderer.send("request-open-ai-sidebar");
    },
    // ✨ AJOUT : On expose la bascule de thème dans le même pont sécurisé !
    toggleTheme: () => {
        ipcRenderer.send("toggle-dark-mode-request-from-tile");
    }
});


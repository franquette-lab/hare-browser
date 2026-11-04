const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("settingsApi", {
    getLanguage: () => ipcRenderer.invoke("get-language"),
    setLanguage: (language) => ipcRenderer.invoke("set-language", language),
    onLanguageChanged: (callback) => ipcRenderer.on("language-changed", (_event, language) => callback(language)),
    getAutoSleepDelay: () => ipcRenderer.invoke("get-autosleep-delay-preference"),
    setAutoSleepDelay: (minutes) => ipcRenderer.invoke("set-autosleep-delay-preference", minutes),
    getFloatingNavigationEnabled: () => ipcRenderer.invoke("get-floating-navigation-preference"),
    setFloatingNavigationEnabled: (enabled) => ipcRenderer.invoke("set-floating-navigation-preference", enabled),
    getFloatingNavigationOpacity: () => ipcRenderer.invoke("get-floating-navigation-opacity"),
    setFloatingNavigationOpacity: (opacity) => ipcRenderer.invoke("set-floating-navigation-opacity", opacity),
    getBookmarksVisible: () => ipcRenderer.invoke("get-bookmarks-visibility-preference"),
    setBookmarksVisible: (visible) => ipcRenderer.invoke("set-bookmarks-visibility-preference", visible),
    getMainToolbarVisible: () => ipcRenderer.invoke("get-main-toolbar-visibility-preference"),
    setMainToolbarVisible: (visible) => ipcRenderer.invoke("set-main-toolbar-visibility-preference", visible),
    onMainToolbarVisibilityChanged: (callback) => ipcRenderer.on("main-toolbar-visibility-changed", (_event, visible) => callback(visible)),
    onBookmarksVisibilityChanged: (callback) => ipcRenderer.on("bookmarks-visibility-changed", (_event, visible) => callback(visible)),
    close: () => ipcRenderer.send("close-settings-window")
});

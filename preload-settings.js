const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("settingsApi", {
    getLanguage: () => ipcRenderer.invoke("get-language"),
    setLanguage: (language) => ipcRenderer.invoke("set-language", language),
    onLanguageChanged: (callback) => ipcRenderer.on("language-changed", (_event, language) => callback(language)),
    getAutoSleepDelay: () => ipcRenderer.invoke("get-autosleep-delay-preference"),
    setAutoSleepDelay: (minutes) => ipcRenderer.invoke("set-autosleep-delay-preference", minutes),
    getFloatingNavigationEnabled: () => ipcRenderer.invoke("get-floating-navigation-preference"),
    setFloatingNavigationEnabled: (enabled) => ipcRenderer.invoke("set-floating-navigation-preference", enabled),
    getBookmarksVisible: () => ipcRenderer.invoke("get-bookmarks-visibility-preference"),
    setBookmarksVisible: (visible) => ipcRenderer.invoke("set-bookmarks-visibility-preference", visible),
    onBookmarksVisibilityChanged: (callback) => ipcRenderer.on("bookmarks-visibility-changed", (_event, visible) => callback(visible)),
    close: () => ipcRenderer.send("close-settings-window")
});

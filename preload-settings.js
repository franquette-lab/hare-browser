const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("settingsApi", {
    getLanguage: () => ipcRenderer.invoke("get-language"),
    setLanguage: (language) => ipcRenderer.invoke("set-language", language),
    onLanguageChanged: (callback) => ipcRenderer.on("language-changed", (_event, language) => callback(language)),
    getAutoSleepDelay: () => ipcRenderer.invoke("get-autosleep-delay-preference"),
    setAutoSleepDelay: (minutes) => ipcRenderer.invoke("set-autosleep-delay-preference", minutes),
    close: () => ipcRenderer.send("close-settings-window")
});

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("settingsApi", {
    getLanguage: () => ipcRenderer.invoke("get-language"),
    setLanguage: (language) => ipcRenderer.invoke("set-language", language),
    onLanguageChanged: (callback) => ipcRenderer.on("language-changed", (_event, language) => callback(language)),
    close: () => ipcRenderer.send("close-settings-window")
});

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("splitMenuApi", {
    choose: (direction) => ipcRenderer.send("split-menu-choose", direction),
    dismiss: () => ipcRenderer.send("split-menu-dismiss")
});

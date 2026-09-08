// ------------------- //
// SCRIPT : preload.js //
// ------------------- //

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld(
    'api',
    {
        sendDragStart: (panelId) => ipcRenderer.send("panel-drag-start", panelId),
        sendDragEnd: () => ipcRenderer.send("panel-drag-end"),
        setActivePanel: (panelId) => ipcRenderer.send("set-active-panel", panelId),
        navigate: (panelId, url) => ipcRenderer.send('navigate', panelId, url),
        goBack: (panelId) => ipcRenderer.invoke("go-back", panelId),
        goForward: (panelId) => ipcRenderer.invoke("go-forward", panelId),

        movePanel: (draggedPanelId, targetPanelId) => ipcRenderer.send('move-panel', draggedPanelId, targetPanelId),

        refresh: (panelId) => ipcRenderer.invoke("refresh", panelId),
        splitPanel: (panelId, direction) => ipcRenderer.send('split-panel', panelId, direction),
        closePanel: (panelId) => ipcRenderer.send('close-panel', panelId),
        undo: () => ipcRenderer.send("undo"),
        
        onActivePanelChanged: (callback) => {
            ipcRenderer.on("active-panel-changed", (event, panel) => callback(panel));
        },
        onSplittersUpdated: (callback) => {
            ipcRenderer.on("splitters-updated", (event, splitters) => callback(splitters));
        },

        onPanelsUpdated: (callback) => {
            ipcRenderer.on("panels-updated", (_event, panels) => {
                callback(panels);
            });
        },
        onUndoAvailable: (callback) => {
            ipcRenderer.on("undo-available", (event, available) => callback(available));
        },

        onNavigationState: (callback) => {
            ipcRenderer.on("navigation-state",(_event, state) => callback(state));
        },

        // À insérer à l'intérieur de l'objet exposé sous 'api' dans preload.js :
        onNavigationStateChanged: (callback) => {
            ipcRenderer.on("navigation-state-changed", (event, data) => callback(data));
        }
    }
);

// Intercepte les requêtes de Long Press des pages internet et les pousse vers le système
window.addEventListener("message", (event) => {
    if (event.data && event.data.source === "tile-browser-drag") {
        if (event.data.type === "start") {
            ipcRenderer.send("panel-drag-start", event.data.panelId);
        }
    }
});

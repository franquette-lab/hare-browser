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

        // À ajouter dans l'objet 'api' de preload.js :
        onFocusUrlBar: (callback) => ipcRenderer.on("focus-url-bar", (event, panelId) => callback(panelId)),

        // À insérer à l'intérieur de l'objet exposé sous 'api' dans preload.js :
        onNavigationStateChanged: (callback) => {
            ipcRenderer.on("navigation-state-changed", (event, data) => callback(data));
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

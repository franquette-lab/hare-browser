// ------------------- //
// SCRIPT : preload.js //
// ------------------- //

const {
    contextBridge,
    ipcRenderer
} = require('electron');

contextBridge.exposeInMainWorld(
    'api',
    {


        // Dans preload.js, à ajouter dans l'objet 'api'
        sendDragStart: (panelId) => {
            ipcRenderer.send("panel-drag-start", panelId);
        },
        sendDragEnd: () => {
            ipcRenderer.send("panel-drag-end");
        },


setActivePanel: (panelId) => {
    ipcRenderer.send(
        "set-active-panel",
        panelId
    );
},
        
        navigate: (panelId, url) => {
            ipcRenderer.send(
                'navigate',
                panelId,
                url
            );
        },


        goBack: (panelId) =>
            ipcRenderer.invoke(
                "go-back",
                panelId
            ),

        goForward: (panelId) =>
            ipcRenderer.invoke(
                "go-forward",
                panelId
            ),


// Dans preload.js, à ajouter à la liste des fonctions de l'API
movePanel: (draggedPanelId, targetPanelId) => {
    ipcRenderer.send('move-panel', draggedPanelId, targetPanelId);
},



refresh: (panelId) =>
    ipcRenderer.invoke(
        "refresh",
        panelId
    ),

        splitPanel: (
            panelId,
            direction
        ) => {

            ipcRenderer.send(
                'split-panel',
                panelId,
                direction
            );

        },

        closePanel: (panelId) => {

            ipcRenderer.send(
                'close-panel',
                panelId
            );

        },

        undo: () =>
            ipcRenderer.send(
                "undo"
            ),

        onActivePanelChanged: (callback) => {
            ipcRenderer.on(
                "active-panel-changed",
                (event, panel) => { // <-- Correction ici : renommé en panel
                    callback(panel); // <-- Renvoie l'objet entier (id + bounds)
                }
            );
        },

        onSplittersUpdated: (callback) => {

            ipcRenderer.on(
                "splitters-updated",
                (event, splitters) => {

                    callback(
                        splitters
                    );

                }
            );

        },


        onPanelsUpdated: (callback) =>
            ipcRenderer.on(
                "panels-updated",
                (event, panels) =>
                    callback(panels)
            ),

        onUndoAvailable: (callback) =>
            ipcRenderer.on(
                "undo-available",
                (event, available) =>
                    callback(available)
            ),

                    startSplitterDrag: (
                        x,
                        y
                    ) => {

                        ipcRenderer.send(
                            "start-splitter-drag",
                            x,
                            y
                        );

                    },
 
            
        stopSplitterDrag: () => {
            ipcRenderer.send(
                "stop-splitter-drag"
            );
        },            


        

            }




            
);


// Tout à la fin de preload.js (en dehors du bloc contextBridge)
window.addEventListener("message", (event) => {
    if (event.data && event.data.source === "tile-browser-drag") {
        if (event.data.type === "start") {
            ipcRenderer.send("panel-drag-start", event.data.panelId);
        } else if (event.data.type === "end") {
            ipcRenderer.send("panel-drag-end");
        }
    }
});



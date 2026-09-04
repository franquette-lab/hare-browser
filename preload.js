const {
    contextBridge,
    ipcRenderer
} = require('electron');

contextBridge.exposeInMainWorld(
    'api',
    {


        
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

        onActivePanelChanged: (
            callback
        ) => {

            ipcRenderer.on(
                "active-panel-changed",
                (event, panelId) => {

                    callback(panelId);

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




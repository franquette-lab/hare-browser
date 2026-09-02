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
        


    }
);




// ---------------- //
// SCRIPT : main.js //
// ---------------- //

const {
    app,
    BrowserWindow,
    WebContentsView,
    BrowserView,
    ipcMain
} = require('electron');



const fs = require("fs");
const path = require("path");

const WORKSPACE_FILE =
    path.join(
        app.getPath("userData"),
        "workspace.json"
    );


const panelMap = new Map();

const MIN_PANEL_WIDTH = 150;

const panels = [];

const splitters = [];

// Tout en haut de main.js avec les autres variables globales
let borderView = null;


let win;

let rootNode = null;

let activePanel = null;

let nextPanelNumber = 4;

let draggedSplitter = null;

let splitterViews = [];

let forceRebuildSplitters = false;

let dragTimer = null;

let draggingRefresh = false;

let dragStartMouseX = 0;
let dragStartMouseY = 0;
let dragStartRatio = 0;

let resizingWindow = false;

let dragInProgress = false;

let resizeTimer = null;

const TOOLBAR_HEIGHT = 88;

let history = [];

let lastClosedPanel = null;

const SPLITTER_SIZE = 10;


function saveWorkspace()
{
    const snapshot =
        createSnapshot(
            rootNode
        );

    fs.writeFileSync(
        WORKSPACE_FILE,
        JSON.stringify(
            snapshot,
            null,
            2
        )
    );

    console.log(
        "Workspace sauvegardé"
    );
}


function updateActiveBorder(bounds) {
    if (!bounds) return;

    // Si la vue de bordure n'existe pas encore, on la crée
    if (!borderView) {
        borderView = new BrowserView();
        win.addBrowserView(borderView);
        
        // On charge un arrière-plan transparent avec une bordure bleue
        borderView.webContents.loadURL("data:text/html," + encodeURIComponent(`
            <html>
            <body style="margin:0; padding:0; box-sizing:border-box; border:3px solid #3b82f6; background:transparent; overflow:hidden;">
            </body>
            </html>
        `));
    }

    // On force Electron à placer la bordure tout au-dessus des autres vues
    try {
        const views = win.getBrowserViews();

        if (views.includes(borderView)) {
            win.setTopBrowserView(borderView);
        }
    }
    catch (err) {
        console.error("borderView error", err);
    }


    // On positionne la bordure exactement sur les contours du panneau
    borderView.setBounds({
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height
    });
}


function getDisplayText(urlString)
{
    try
    {
        const url = new URL(urlString);

        return decodeURIComponent(
            url.pathname.split("/").pop()
        ).replaceAll("_", " ");
    }
    catch
    {
        return urlString;
    }
}

function createSnapshot(node)
{
    if (node.type === "panel")
    {
        return {
            type: "panel",
            id: node.id,
            url: node.url,            
            realUrl: node.url
        };
    }



    
    return {
        type: "split",
        direction: node.direction,
        ratio: node.ratio,
        first: createSnapshot(node.first),
        second: createSnapshot(node.second)
    };
}

function saveState()
{
    history.push(
        JSON.stringify(
            createSnapshot(rootNode)
        )
    );

    if (history.length > 20)
    {
        fistory.shift();
    }
}

function restoreTree(snapshot)
{
    if (snapshot.type === "panel")
    {
        const view =
            new BrowserView();

        win.addBrowserView(view);

        view.webContents.loadURL(
            snapshot.url
        );

        const panel =
            new PanelNode(
                snapshot.id,
                view,
                snapshot.url
            );

        setupNavigationTracking(
            panel
        );

        return panel;
    }

    const split =
        new SplitNode(
            snapshot.direction
        );

    split.ratio =
        snapshot.ratio;

    split.first =
        restoreTree(
            snapshot.first
        );

    split.second =
        restoreTree(
            snapshot.second
        );

    return split;
}

class PanelNode {

    constructor(
        id,
        view,
        url = ""
    ) {

        console.log(
            "NEW PANEL",
            id,
            view
        );

        this.type = "panel";
        this.id = id;
        this.view = view;
        this.url = url;

    }

    toJSON() {

        return {
            type: this.type,
            id: this.id,
            url: this.url
        };

    }

}

class SplitNode {

    constructor(direction) {

        this.type = "split";

        this.direction = direction;

        this.first = null;

        this.second = null;

        this.ratio = 0.5;

    }

}

function findPanelNode(node, panelId) {

    if (!node) {
        return null;
    }

    if (
        node.type === "panel"
        && node.id === panelId
    ) {
        return node;
    }

    if (node.type === "split") {

        return (
            findPanelNode(
                node.first,
                panelId
            )
            ||
            findPanelNode(
                node.second,
                panelId
            )
        );

    }

    return null;

}

function findParentNode(
    current,
    panelId
) {

    if (!current) {
        return null;
    }

    if (
        current.type === "split"
    ) {

        if (
            current.first &&
            current.first.type === "panel" &&
            current.first.id === panelId
        ) {
            return current;
        }

        if (
            current.second &&
            current.second.type === "panel" &&
            current.second.id === panelId
        ) {
            return current;
        }

        return (
            findParentNode(
                current.first,
                panelId
            )
            ||
            findParentNode(
                current.second,
                panelId
            )
        );

    }

    return null;

}

function findFirstPanel(node)
{
    if (node.type === "panel") {
        return node;
    }

    return findFirstPanel(
        node.first
    );
}

function collectPanels(
    node,
    panels = []
)
{
    if (node.type === "panel")
    {
        panels.push({
            id: node.id,
            url: node.title || getDisplayText(node.url),
            realUrl: node.url
        });        

        return panels;
    }

    collectPanels(
        node.first,
        panels
    );

    collectPanels(
        node.second,
        panels
    );

    return panels;
}


function updatePanelUrl(panel, url)
{
    panel.title =
        panel.view.webContents.getTitle();

    win.webContents.send(
        "panels-updated",
        collectPanels(rootNode)
    );
}

function setupNavigationTracking(panel)
{
    console.log(
        "TRACK PANEL =",
        panel
    );

    if (!panel) {
        console.error(
            "panel undefined"
        );
        return;
    }

    if (!panel.view) {
        console.error(
            "panel.view undefined",
            panel
        );
        return;
    }

    panel.view.webContents.on(
        "did-navigate",
        (event, url) => {

            updatePanelUrl(
                panel,
                url
            );

        }
    );

    panel.view.webContents.on(
        "did-navigate-in-page",
        (event, url) => {

            updatePanelUrl(
                panel,
                url
            );

        }
    );



// Dans main.js, à l'intérieur de setupNavigationTracking(panel) :
panel.view.webContents.on(
    "focus",
    () => {
        console.log("FOCUS", panel.id);

        win.webContents.send(
            "active-panel-changed",
            {
                id: panel.id,
                bounds: panel.bounds
            }
        );

        // AJOUT : On dessine le rectangle bleu natif par-dessus la vue
        updateActiveBorder(panel.bounds);
    }
);





panel.view.webContents.on(
    "page-title-updated",
    (event, title) => {

        event.preventDefault();

        win.webContents.send(
            "title-changed",
            panel.id,
            title
        );

    }
);

}

function collectPanelNodes(
    node,
    panels = []
)
{
    if (node.type === "panel")
    {
        panels.push(node);
        return panels;
    }

    collectPanelNodes(
        node.first,
        panels
    );

    collectPanelNodes(
        node.second,
        panels
    );

    return panels;
}

function layoutNode(
    node,
    x,
    y,
    width,
    height
) {

    if (
        width <= 0 ||
        height <= 0
    ) {

        console.log(
            "BOUNDS INVALIDES",
            width,
            height
        );
        return;
    }

    console.log(
        node.type,
        x,
        y,
        width,
        height
    );

    if (node.type === "panel") {

        node.bounds = {
            x,
            y,
            width,
            height
        };

        console.log(
            node.id,
            x,
            y,
            width,
            height
        );

        node.view.setBounds({
            x,
            y,
            width,
            height
        });

        return;

    }


 
    if (node.direction === "vertical") {

        const firstWidth =
            Math.floor(
                width * node.ratio
            );

        splitters.push({
            node,
            direction: "vertical",

            x: x + firstWidth,
            y,

            width: SPLITTER_SIZE,
            height,

            parentX: x,
            parentWidth: width
        });

        console.log(
            "SPLITTER",
            x + firstWidth
        );

        layoutNode(
            node.first,
            x,
            y,
            firstWidth,
            height
        );

        layoutNode(
            node.second,
            x + firstWidth + SPLITTER_SIZE,
            y,
        width - firstWidth - SPLITTER_SIZE,

            height
        );

    }
    else {

        const firstHeight =
            Math.floor(
                height * node.ratio
            );


        splitters.push({
            node,
            direction: "horizontal",

            x,
            y: y + firstHeight,

            width,
            height: SPLITTER_SIZE,

            parentY: y,
            parentHeight: height
        });

        console.log(
            "SPLITTER",
            y + firstHeight
        );
                layoutNode(
                    node.first,
                    x,
                    y,
                    width,
                    firstHeight
                );

                layoutNode(
                    node.second,
                    x,
                    y + firstHeight,
                    width,
                    height - firstHeight
                );

    }

}

class Panel {

    constructor(id, url, view) {
        this.id = id;
        this.url = url;
        this.view = view;
    }

}

let splitPosition1 = 530;
let splitPosition2 = 1060;

ipcMain.on(
    "navigate",
    (event, panelId, url) => {

        const panel =
            findPanelNode(
                rootNode,
                panelId
            );

        if (
            panel &&
            panel.view
        )
        {
            panel.view.webContents.loadURL(
                url
            );
        }

    }
);

ipcMain.on(
    'move-splitter',
    (event, x) => {

        splitPosition = x;

        if (resizeTimer) {
            clearTimeout(resizeTimer);
        }

        resizeTimer = setTimeout(() => {

forceRebuildSplitters = true;
            resizeViews();
        }, 25);

    }
);

ipcMain.on(
    "undo",
    () => {

        console.log(
            "ANNULATION DEMANDEE"
        );

        console.log("UNDO");
        console.log(lastClosedPanel);

        if (!lastClosedPanel)
        {
            console.log(
                "Aucun panneau à restaurer"
            );

            return;
        }

        const view =
            new BrowserView();

        win.addBrowserView(
            view
        );
			
        view.webContents.loadURL(
            lastClosedPanel.url
        );

        const panel =
            new PanelNode(
                lastClosedPanel.id,
                view,
                lastClosedPanel.url
            );
    
        setupNavigationTracking(
            panel
        );

        const split =
            new SplitNode(
                "vertical"
            );

        split.first = panel;
        split.second = rootNode;

        rootNode = split;

        console.log(
            "ROOT APRES RESTAURATION",
            rootNode
        );

        forceRebuildSplitters = true;

        console.log(
            "URL à restaurer :",
            lastClosedPanel.url
        );

        resizeViews();

        win.webContents.send(
            "panels-updated",
            collectPanels(rootNode)
        );

        lastClosedPanel = null;

console.log(
    "ENVOI undo-available = false"
);


win.webContents.send(
    "undo-available",
    false
);
        


    }
);

ipcMain.on(
    "move-splitter",
    (
        event,
        mouseX,
        mouseY
    ) => {

        if (!draggedSplitter) {
            return;
        }

        if (
            draggedSplitter.direction ===
            "vertical"
        ) {

            draggedSplitter.node.ratio =
                mouseX /
                win.getContentSize()[0];

        }
        else {

            draggedSplitter.node.ratio =
                (
                    mouseY - TOOLBAR_HEIGHT
                )
                /
                (
                    win.getContentSize()[1] - TOOLBAR_HEIGHT
                );

        }

        draggedSplitter.node.ratio =
            Math.max(
                0.1,
                Math.min(
                    0.9,
                    draggedSplitter.node.ratio
                )
            );


forceRebuildSplitters = true;


        resizeViews();

    }
);

ipcMain.on(
    "stop-splitter-drag",
    () => {

        draggedSplitter = null;

    }
);

ipcMain.on(
    "start-splitter-drag",
    (event, mouseX, mouseY) => {

        console.log(
            "RECU",
            mouseX,
            mouseY
        );

        console.log(
            splitters
        );        

        const splitter =
            splitters.find(
                s =>

                    mouseX >= s.x &&
                    mouseX <= s.x + s.width
            );


                    console.log(
                    "SPLITTER CLIQUE :",
                    splitter
                );

            }
        );

ipcMain.on(
    "close-panel",
    (event, panelId) => {

        console.log(
            "FERMETURE DEMANDEE :",
            panelId
        );

        const node =
            findPanelNode(
                rootNode,
                panelId
            );

        if (!node) {

            console.log(
                "Panneau introuvable :",
                panelId
            );

            return;

        }

        const parent =
            findParentNode(
                rootNode,
                panelId
            );

        if (!parent) {

            console.log(
                "Impossible de fermer le dernier panneau"
            );

            return;
        }

        if (!node)
        {
            activePanel =
                collectPanels(rootNode)[0]?.id;

            return;
        }        

        saveState();

        const sibling =
            getSibling(
                parent,
                node
            );

        console.log(
            "SIBLING =",
            sibling
        );
        console.log(
            "NODE =",
            node
        );

        console.log(
            "PARENT =",
            parent
        );

        console.log(
            "SIBLING =",
            sibling
        );

        if (parent === rootNode)
        {
            rootNode = sibling;
        }
        else
        {
            replaceNode(
                rootNode,
                parent,
                sibling
            );
        }

        lastClosedPanel =
        {
            id: node.id,
            url: node.url,
            title: node.title || getDisplayText(node.url)
        };

        win.webContents.send(
            "undo-available",
            true
        );        




        

        
console.log(
    "ENVOI undo-available = true"
);


win.webContents.send(
    "enable-undo"
);




        win.removeBrowserView(
            node.view
        );



        const newActivePanel =
            findFirstPanel(
                sibling
            );

        activePanel =
            newActivePanel.id;

        console.log(
            "NOUVEAU PANNEAU ACTIF :",
            newActivePanel.id
        );

  
win.webContents.send(
    "active-panel-changed",
    {
        id: newActivePanel.id,
        bounds: newActivePanel.bounds
    }
);        
        forceRebuildSplitters = true;
                resizeViews();

        win.webContents.send(
            "panels-updated",
            collectPanels(rootNode)
        );

    }
);

function addPanel(url) {

    const view = new BrowserView();

    console.log(
    "CREATION SPLITTER",
    index,
    splitter.x,
    splitter.y,
    splitter.width,
    splitter.height
);

    win.addBrowserView(view);

    view.webContents.loadURL(url);

    panels.push(view);

forceRebuildSplitters = true;
    resizeViews();

}


function getDisplayText(urlString)
{
    try
    {
        const url = new URL(urlString);

        return decodeURIComponent(
            url.pathname.split("/").pop()
        ).replaceAll("_", " ");
    }
    catch
    {
        return urlString;
    }
}

function createDefaultLayout()
{

    leftView = new BrowserView();
    centerView = new BrowserView();
    rightView = new BrowserView();

    rootNode =
    new SplitNode("vertical");

    rootNode.first =
        new PanelNode(
            "panel1",
            leftView,
            "https://www.google.com"
        );

    rootNode.second =
        new SplitNode(
            "vertical"
        );

    rootNode.second.first =
        new PanelNode(
            "panel2",
            centerView,
            "https://fr.wikipedia.org"
        );

    rootNode.second.second =
        new PanelNode(
            "panel3",
            rightView,
            "https://github.com"
        );



    collectPanelNodes(rootNode)
        .forEach(
            (panel) => {

                setupNavigationTracking(
                    panel
                );

            }
        );

            console.log("ARBRE CREE");

    console.log(
        "panel1 =",
        rootNode.first.id
    );

    console.log(
        "panel2 =",
        rootNode.second.first.id
    );

    console.log(
        "panel3 =",
        rootNode.second.second.id
    );

}

function createWindow() {

    win = new BrowserWindow({

        width: 1600,
        height: 900,

        minWidth: 1000,
        minHeight: 700,

        backgroundColor: "#111827",

        titleBarStyle:
            process.platform === "darwin"
                ? "hiddenInset"
                : "default",

        webPreferences: {

            preload: path.join(
                __dirname,
                "preload.js"
            ),

            contextIsolation: true,
            nodeIntegration: false

        }



        


    });


        if (
        fs.existsSync(
            WORKSPACE_FILE
        )
    )
    {
        const snapshot =
            JSON.parse(
                fs.readFileSync(
                    WORKSPACE_FILE,
                    "utf8"
                )
            );

        rootNode =
            restoreTree(
                snapshot
            );
    }
    else
    {
        createDefaultLayout();
    }


    win.webContents.on(
        "before-input-event",
        (event, input) => {

            if (
                input.type === "mouseDown"
            ) {

                console.log(
                    "INPUT :",
                    input
                );

            }

        }
    );

    win.setMenu(null);

        win.webContents.openDevTools({
        mode: 'detach'
        });





    win.loadFile('index.html');

    win.webContents.on(
        'did-fail-load',
        (event, errorCode, errorDescription) => {

            console.log(
                'LOAD ERROR:',
                errorCode,
                errorDescription
            );

        }
    );

    forceRebuildSplitters = true;
        resizeViews();


    win.webContents.send(
        "panels-updated",
        collectPanels(rootNode)
    );



/*
    win.removeAllListeners(
        "resize"
    );

    win.on(
        "resize",
        () => {

            if (resizingWindow) {
                return;
            }

            resizingWindow = true;

            setTimeout(
                () => {

    forceRebuildSplitters = true;
                    resizeViews();

                    resizingWindow = false;

                },
                100
            );
        }
    );
*/

    // Remplacer l'ancien bloc win.on("resize") par celui-ci unique dans createWindow()
    win.removeAllListeners("resize");
    let resizeDebounceTimer = null;
    
    win.on("resize", () => {
        if (resizeDebounceTimer) clearTimeout(resizeDebounceTimer);
        resizeDebounceTimer = setTimeout(() => {
            if (win.isDestroyed()) return;
            forceRebuildSplitters = true;
            resizeViews();
        }, 30); // Petit délai pour laisser Electron respirer
    });


}


app.on(
    "before-quit",
    () => {

        saveWorkspace();
    }
);

console.log(
    app.getPath("userData")
);

function getSibling(
    parent,
    node
) {

    if (parent.first === node) {
        return parent.second;
    }

    return parent.first;

}

function replaceNode(
    current,
    target,
    replacement
) {

    if (!current) {
        return false;
    }

    if (current.first === target) {

        current.first =
            replacement;

        return true;

    }

    if (current.second === target) {

        current.second =
            replacement;

        return true;

    }

    if (current.type === "split") {

        return (
            replaceNode(
                current.first,
                target,
                replacement
            )
            ||
            replaceNode(
                current.second,
                target,
                replacement
            )
        );
    }
    return false;
}









function resizeViews() {

    const [width, height] =
        win.getContentSize();

    splitters.length = 0;

    if (forceRebuildSplitters)
    {
        console.log(
            "RECONSTRUCTION COMPLETE"
        );

        splitterViews.forEach(
            (splitterView) => {

                try {

                    win.removeBrowserView(
                        splitterView
                    );

                }
                catch (e) {

                    console.error(e);

                }

            }
        );

        splitterViews = [];

        forceRebuildSplitters = false;
    }

    layoutNode(
        rootNode,
        0,
        TOOLBAR_HEIGHT,
        width,
        height - TOOLBAR_HEIGHT
    );

    while (
        splitterViews.length >
        splitters.length
    ) {

        const oldSplitter =
            splitterViews.pop();

        try {

            win.removeBrowserView(
                oldSplitter
            );

        } catch (e) {

            console.error(e);

        }

    }

    splitters.forEach(

        (splitter, index) => {

            if (
                splitterViews[index]
            ) {

                console.log(
                    "MAJ SPLITTER",
                    index,
                    "=>",
                    splitter.x
                );

                splitterViews[index].setBounds({
                    x: splitter.x,
                    y: splitter.y,
                    width: splitter.width,
                    height: splitter.height
                });

                return;
            }


            console.log(
                "CREATION SPLITTER",
                index,
                "=>",
                splitter.x
            );

            const cursor =
                splitter.direction === "vertical"
                    ? "col-resize"
                    : "row-resize";

            const handleDirection =
                splitter.direction === "vertical"
                    ? "column"
                    : "row";


            const splitterView =
                new BrowserView();

            win.addBrowserView(
                splitterView
            );

            splitterViews.push(
                splitterView
            );            


            console.log(
                "SPLITTER BOUNDS",
                splitter.x,
                splitter.y,
                splitter.width,
                splitter.height
            );


            splitterView.setBounds({
                x: splitter.x,
                y: splitter.y,
                width: splitter.width,
                height: splitter.height
            });


            console.log(
                "BOUNDS",
                splitter.width,
                splitter.height
            );


            splitterView.webContents.loadURL(
                "data:text/html," +
                encodeURIComponent
                (`
                            <html>

                            <head>

                            <style>


                            html,
                            body {
                                margin: 0;
                                padding: 0;
                                overflow: hidden !important;
                            }

                            body {
                                box-sizing: border-box;

                                background: #374151;

                                display: flex;
                                align-items: center;
                                justify-content: center;

                                cursor: ${cursor};
                            }

                            * {
                                box-sizing: border-box;
                            }

                            ::-webkit-scrollbar {
                                width: 0;
                                height: 0;
                                display: none;
                            }

                            #handle {
                                position: absolute;

                                top: 50%;
                                left: 50%;

                                transform: translate(-50%, -50%);

                                display: flex;
                                flex-direction: ${handleDirection};
                                gap: 2px;
                            }  

                            body:hover {
                                                background: #808080;
                                                }
                                                #handle {
                                                    display: flex;
                                                    flex-direction: ${handleDirection};
                                                    gap: 2px;
                                                }

                                                .dot {
                                                    display: block;

                                                    width: 3px;
                                                    height: 3px;

                                                    background: #cfcfcf;

                                                    border-radius: 50%;
                                                }        </style>

                                                </head>

                                                <body>

                                                <div id="handle">
                                                <div class="dot"></div>
                                                <div class="dot"></div>
                                                <div class="dot"></div>
                                                </div>

                                                <script>

                                                let dragging = false;

                                                let startMouseX = 0;

                                                console.log("SPLITTER CHARGE");
                                                                    

                                                document.addEventListener(
                                                    "mousedown",
                                                    (event) => {

                                                        console.log(
                                                            "EVENT",
                                                            event.screenX,
                                                            event.screenY,
                                                            event.clientY,
                                                            event.pageY
                                                        );

                                                        console.log("MOUSEDOWN");

                                                                dragging = true;

                                                        console.log(
                                                            "DOWN VALUES",
                                                            event.screenX,
                                                            event.screenY,
                                                            event.clientY,
                                                            event.pageY
                                                        );

                                                        document.title =
                                                            "drag-start:" +
                                                            event.screenX +
                                                            ":" +
                                                            event.screenY;


                                                            }
                                                        );

                                                        document.addEventListener(
                                                            "mouseup",
                                                            () => {

                                                                dragging = false;

                                                                document.title =
                                                                    "drag-end";

                                                            }
                                                        );

                                                        document.addEventListener(
                                                            "mousemove",
                                                            (event) => {

                                                                if (!dragging) {
                                                                    return;
                                                                }

                                                                document.title =
                                                                    "move:" +
                                                                    event.screenX +
                                                                    ":" +
                                                                    event.screenY;
                                                    }
                                                );  

                                                </script>

                                                </body>

                                                </html>
                `)
          );




            splitterView.webContents.on(
                "did-finish-load",
                () => {
                    console.log(
                        "SPLITTER LOADED"
                    );
                }



            );

            let lastSplitterClickTime = 0;



            splitterView.webContents.on(
                "page-title-updated",
                (
                    event,
                    title
                ) => {

                    event.preventDefault();

                    console.log(
                        "TITLE RECU =",
                        title
                    );

            if (
                title === "reset-splitter"
            )
            {
                console.log(
                    "RESET SPLITTER RECU"
                );

                splitter.node.ratio = 0.5;

                resizeViews();

                return;
            }

            if (
                title === "drag-end"
            ) {

                console.log(
                    "DRAG END RECU"
                );

                win.setTitle(
                    "Tile Browser"
                );

                dragInProgress = false;


                return;
            }

            let lastDragStart = 0;

            if (
                title.startsWith("drag-start:")
            )
            {

                const now = Date.now();

                if (
                    now - lastSplitterClickTime < 300
                )
                {
                    console.log(
                        "DOUBLE CLICK SPLITTER"
                    );

                    splitter.node.ratio = 0.5;

                    resizeViews();

                    lastSplitterClickTime = 0;

                    return;
                }

                lastSplitterClickTime = now;
                dragInProgress = false;

                lastDragStart = now;

                console.log(
                    "DRAG START RECU",
                    dragInProgress
                );

                if (dragInProgress) {

                    console.log(
                        "DRAG START IGNORE"
                    );

                    return;
                }

                dragInProgress = true;

                const parts =
                    title
                        .slice(11)
                        .split(":");

                dragStartMouseX =
                    parseInt(parts[0]);

                dragStartMouseY =
                    parseInt(parts[1]);

                console.log(
                    "SPLITTER =",
                    splitter
                );

                dragStartRatio =
                    splitter.node.ratio;

                return;
            }

            if (
                title.startsWith("move:")
            )
            {

                if (!dragInProgress)
                {
                    return;
                }
                                                
                const raw =
                    title.slice(5);

                const parts =
                    raw.split(":");

                console.log(
                    "PARTS =",
                    parts
                );

                const mouseX =
                    Number(parts[0]);

                const mouseY =
                    Number(parts[1]);

                const mousePos =
                    parseInt(
                        title.slice(5)
                    );

                console.log(
                    "MOVE RECU",
                    title
                );

                if (
                    splitter.direction === "vertical"
                )
                {
                    const deltaX =
                        mouseX -
                        dragStartMouseX;

                    splitter.node.ratio =
                        dragStartRatio +
                        (
                            deltaX /
                            splitter.parentWidth
                        );
                }
                else
                {
                    const deltaY =
                        mouseY -
                        dragStartMouseY;

                    splitter.node.ratio =
                        dragStartRatio +
                        (
                            deltaY /
                            splitter.parentHeight
                        );
                }

                splitter.node.ratio =
                    Math.max(
                        0.1,
                        Math.min(
                            0.9,
                            splitter.node.ratio
                        )
                    );
                if (resizeTimer) {
                clearTimeout(resizeTimer);
                }

                if (resizeTimer) {
                    clearTimeout(resizeTimer);
                }

                resizeViews();
                currentSplitterRatio =
                    splitter.node.ratio;
    }

}
            ); 
            
            



        }
    );  

    console.log(
        "ENVOI SPLITTERS",
        splitters.length
    );
    win.webContents.send(
        "splitters-updated",
        splitters
    );


// À rajouter à la toute dernière ligne de la fonction resizeViews() dans main.js
if (borderView && activePanel) {
    const activeNode = findPanelNode(rootNode, activePanel);
    if (activeNode && activeNode.bounds) {
        borderView.setBounds(activeNode.bounds);

        try {
            const views = win.getBrowserViews();

            if (views.includes(borderView)) {
                win.setTopBrowserView(borderView);
            }
        }
        catch (err) {
            console.error("borderView error", err);
        }
        
    }
}

    // À mettre à la TOUTE DERNIÈRE LIGNE de votre fonction resizeViews() dans main.js
    if (borderView) {
        if (activePanel) {
            const activeNode = findPanelNode(rootNode, activePanel);
            if (activeNode && activeNode.bounds) {
                borderView.setBounds(activeNode.bounds);

                try {
                    const views = win.getBrowserViews();

                    if (views.includes(borderView)) {
                        win.setTopBrowserView(borderView);
                    }
                }
                catch (err) {
                    console.error("borderView error", err);
                }
                
            }
        } else {
            // S'il n'y a pas de panneau actif, on cache la bordure hors de l'écran
            borderView.setBounds({ x: -100, y: -100, width: 0, height: 0 });
        }
    }


    // À mettre à la TOUTE DERNIÈRE LIGNE de votre fonction resizeViews() dans main.js
    if (borderView && borderView.webContents && !borderView.webContents.isDestroyed()) {
        if (activePanel) {
            const activeNode = findPanelNode(rootNode, activePanel);
            if (activeNode && activeNode.bounds) {
                borderView.setBounds(activeNode.bounds);

                try {
                    const views = win.getBrowserViews();
                    if (views.includes(borderView)) {
                        win.setTopBrowserView(borderView);
                    }
                }
                catch (err) {
                    console.error("borderView error", err);
                }
            }
        } else {
            // S'il n'y a pas de panneau actif, on cache la bordure hors de l'écran
            borderView.setBounds({ x: -100, y: -100, width: 0, height: 0 });
        }
    }



}



// Dans main.js, gestion de l'événement de Drag & Drop entre panneaux
ipcMain.on("move-panel", (event, draggedPanelId, targetPanelId) => {
    console.log(`Drag & Drop : Déplacement de ${draggedPanelId} sur ${targetPanelId}`);

    // 1. Trouver les nœuds correspondants dans l'arbre
    const draggedNode = findPanelNode(rootNode, draggedPanelId);
    const targetNode = findPanelNode(rootNode, targetPanelId);

    if (!draggedNode || !targetNode || draggedPanelId === targetPanelId) return;

    // 2. Trouver les parents pour modifier la structure de l'arbre
    const draggedParent = findParentNode(rootNode, draggedPanelId);
    const targetParent = findParentNode(rootNode, targetPanelId);

    // Sauvegarde de l'état actuel pour le Undo au besoin
    saveState();

    // 3. Retirer le panneau déplacé de sa position d'origine
    if (!draggedParent) {
        // Si le panneau déplacé n'a pas de parent, c'est le seul panneau existant (impossible théoriquement ici)
        return;
    }

    const draggedSibling = getSibling(draggedParent, draggedNode);

    if (draggedParent === rootNode) {
        rootNode = draggedSibling;
    } else {
        const draggedGrandParent = findParentNode(rootNode, draggedParent.first.id === draggedPanelId ? draggedParent.second.id : draggedParent.first.id);
        // Note: une fonction utilitaire plus robuste pour trouver le parent du parent :
        const realDraggedGrandParent = findParentNode(rootNode, draggedParent.first.id); 
        // Remplacement simplifié :
        replaceNode(rootNode, draggedParent, draggedSibling);
    }

    // 4. Créer un nouveau SplitNode pour accueillir la cible et l'élément déplacé
    // Par défaut, on va scinder verticalement (côte à côte) à l'emplacement de la cible
    const newSplit = new SplitNode("vertical");
    newSplit.ratio = 0.5;

    // On récupère à nouveau le parent de la cible au cas où l'arbre a bougé suite au retrait du premier nœud
    const freshTargetParent = findParentNode(rootNode, targetPanelId);

    newSplit.first = targetNode;
    newSplit.second = draggedNode;

    if (!freshTargetParent) {
        // Si la cible était devenue la racine (root)
        rootNode = newSplit;
    } else {
        if (freshTargetParent.first === targetNode) {
            freshTargetParent.first = newSplit;
        } else {
            freshTargetParent.second = newSplit;
        }
    }

    // 5. Mettre à jour l'interface graphique
    activePanel = draggedPanelId; // On donne le focus au panneau déplacé
    forceRebuildSplitters = true;
    
    resizeViews();

    // Notifier le renderer de la nouvelle structure des inputs/onglets
    win.webContents.send("panels-updated", collectPanels(rootNode));
});



ipcMain.on(
    "set-active-panel",
    (event, panelId) => {

        const panel =
            findPanelNode(
                rootNode,
                panelId
            );

        if (!panel) {
            return;
        }

        activePanel = panelId;

        win.webContents.send(
            "active-panel-changed",
            {
                id: panel.id,
                bounds: panel.bounds
            }
        );

        updateActiveBorder(
            panel.bounds
        );
    }
);



        ipcMain.on(
            'move-splitter',
            (event, x) => {

                splitPosition = x;

                clearTimeout(
                    dragTimer
                );

                dragTimer =
                    setTimeout(
                        () => {

                            forceRebuildSplitters = true;
                            resizeViews();

                        },
                        16
                    );


            }
        );


        ipcMain.handle(
            "go-back",
            (
                event,
                panelId
            ) => {

                console.log(
                    "GO BACK",
                    panelId
                );

                const panel =
                    findPanelNode(
                        rootNode,
                        panelId
                    );

                console.log(
                    "PANEL =",
                    panel
                );

                if (
                    panel &&
                    panel.view
                ) {

                    console.log(
                        "canGoBack =",
                        panel.view.webContents.canGoBack()
                    );

                    if (
                        panel.view.webContents.canGoBack()
                    ) {

                        panel.view.webContents.goBack();

                    }

                }

            }
        );


        ipcMain.handle(
            "go-forward",
            (
                event,
                panelId
            ) => {

                console.log(
                    "GO FORWARD",
                    panelId
                );

                const panel =
                    findPanelNode(
                        rootNode,
                        panelId
                    );

                if (
                    panel &&
                    panel.view &&
                    panel.view.webContents.canGoForward()
                ) {

                    panel.view.webContents.goForward();

                }

            }
        );

        ipcMain.handle(
            "refresh",
            (
                event,
                panelId
            ) => {

                console.log(
                    "REFRESH",
                    panelId
                );

                const panel =
                    findPanelNode(
                        rootNode,
                        panelId
                    );

                if (
                    panel &&
                    panel.view
                ) {

                    panel.view.webContents.reload();

                }

            }
        );

        ipcMain.on(
            "split-panel",
            (event, panelId, direction) => {

        console.log(
            "Découpage",
            direction,
            "du panneau",
            panelId
        );

        const node =
            findPanelNode(
                rootNode,
                panelId
            );

        console.log(
            "Noeud trouvé :",
            node
        );

        const parent =
            findParentNode(
                rootNode,
                panelId
            );

        console.log(
            "Parent trouvé :",
            parent
        );

        if (!parent)
        {
            const newSplit =
                new SplitNode(
                    direction
                );

            const newView =
                new BrowserView();

            win.addBrowserView(
                newView
            );

            const newPanel =
                new PanelNode(
                    "panel" + nextPanelNumber++,
                    newView,
                    "https://www.bing.com"
                );

            setupNavigationTracking(
                newPanel
            );

            newSplit.first = node;
            newSplit.second = newPanel;

            rootNode = newSplit;

            forceRebuildSplitters = true;

            win.webContents.send(
                "panels-updated",
                collectPanels(rootNode)
            );

            newView.webContents.loadURL(
            "https://www.bing.com"
            );
            
            resizeViews();

            return;
        }           

        const newView =
            new BrowserView();

        win.addBrowserView(
            newView
        );

        newView.webContents.loadURL(
            'https://www.bing.com'
        );

        const newPanel =
            new PanelNode(
                "panel" + nextPanelNumber++,
                newView,
                "https://www.bing.com"
            );

        setupNavigationTracking(
            newPanel
        );            

        const newSplit =
            new SplitNode(
                direction
            );

        newSplit.first =
            node;

        newSplit.second =
            newPanel;

        if (parent.first === node) {

            parent.first =
                newSplit;

        }
        else if (
            parent.second === node
        ) {

            parent.second =
                newSplit;

        }

        console.log(
            "Nouveau panneau créé :",
            newPanel.id
        );

        console.log(
            "Nombre de panneaux :",
            nextPanelNumber - 1
        );

        console.dir(
            rootNode,
            { depth: null }
        );

        forceRebuildSplitters = true;

        saveState();

                        resizeViews();




                win.webContents.send(
                    "panels-updated",
                    collectPanels(rootNode)
                );
            }





);

app.whenReady().then(createWindow);

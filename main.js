const panelMap = new Map();

const MIN_PANEL_WIDTH = 150;

const panels = [];

const splitters = [];

let win;

let leftView;
let centerView;
let rightView;

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

const TOOLBAR_HEIGHT = 80;

let history = [];

let lastClosedPanel = null;



function createSnapshot(node)
{
    if (node.type === "panel")
    {
        return {
            type: "panel",
            id: node.id,
            url: node.url
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
        history.shift();
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
            url: node.url || ""
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
    panel.url = url;

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

panel.view.webContents.on(
    "focus",
    () => {

        console.log(
            "FOCUS",
            panel.id
        );

        win.webContents.send(
            "active-panel-changed",
            panel.id
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

            width: 20,
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
    x + firstWidth + 20,
    y,
width - firstWidth - 20,

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
            height: 20,

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

const {
    app,
    BrowserWindow,
    BrowserView,
    ipcMain
} = require('electron');

const path = require('path');

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
    'navigate',
    (event, panelId, url) => {

        if (panelId === 'panel1') {
            leftView.webContents.loadURL(url);
        }

        if (panelId === 'panel2') {
            centerView.webContents.loadURL(url);
        }

        if (panelId === 'panel3') {
            rightView.webContents.loadURL(url);
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

        resizeViews();

        win.webContents.send(
            "panels-updated",
            collectPanels(rootNode)
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

lastClosedPanel = {
    id: node.id,
    url: node.url
};

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
            newActivePanel.id
        );

        forceRebuildSplitters = true;
                resizeViews();

        win.webContents.send(
            "panels-updated",
            collectPanels(rootNode)
        );

    }
);

//////////////////////////////////
//////////////////////////////////
//////////////////////////////////


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

function createWindow() {

    win = new BrowserWindow({

        width: 1600,
        height: 900,

        webPreferences: {
            preload: path.join(
                __dirname,
                "preload.js"
            )
        }

    });

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


console.log(
    "leftView =",
    leftView
);

console.log(
    "centerView =",
    centerView
);

console.log(
    "rightView =",
    rightView
);

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
    
    win.setMenu(null);

    win.webContents.openDevTools({
      mode: 'detach'
    });

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

const node =
    findPanelNode(
        rootNode,
        "panel2"
    );

console.log(
    "Trouvé :",
    node.id
);

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

    win.setBrowserView(leftView);
    win.addBrowserView(centerView);
    win.addBrowserView(rightView);

forceRebuildSplitters = true;
    resizeViews();


    win.webContents.send(
    "panels-updated",
    collectPanels(rootNode)
);

    centerView.webContents.loadURL(
        'https://fr.wikipedia.org'
    );

    leftView.webContents.loadURL(
        'https://www.google.com'
    );

    centerView.webContents.loadURL(
        'https://fr.wikipedia.org'
    );

    rightView.webContents.loadURL(
        'https://www.github.com'
    );

    leftView.webContents.on(
        'did-finish-load',
        () => {
            console.log('Google chargé');
        }
    );

    leftView.webContents.on(
        'did-navigate',
        (event, url) => {

            win.webContents.send(
                'url-changed',
                'panel1',
                url
            );

        }
    );

    leftView.webContents.on(
        'did-navigate-in-page',
        (event, url) => {

            win.webContents.send(
                'url-changed',
                'panel1',
                url
            );

        }
    );

    centerView.webContents.on(
        'did-finish-load',
        () => {
            console.log('Wikipedia chargée');
        }
    );

    centerView.webContents.on(
        'did-navigate',
        (event, url) => {

            win.webContents.send(
                'url-changed',
                'panel2',
                url
            );

        }
    );

    centerView.webContents.on(
        'did-navigate-in-page',
        (event, url) => {

            win.webContents.send(
                'url-changed',
                'panel2',
                url
            );

        }
    );

    rightView.webContents.on(
        'did-finish-load',
        () => {
            console.log('GitHub chargé');
        }
    );

    rightView.webContents.on(
        'did-navigate',
        (event, url) => {

            win.webContents.send(
                'url-changed',
                'panel3',
                url
            );

        }
    );

    rightView.webContents.on(
        'did-navigate-in-page',
        (event, url) => {

            win.webContents.send(
                'url-changed',
                'panel3',
                url
            );

        }
    );

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

console.trace("AJOUT LISTENER");

    }
);

}

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



            const splitterView =
                new BrowserView();

            win.addBrowserView(
                splitterView
            );

            splitterViews.push(
                splitterView
            );            

            splitterView.setBounds({
                x: splitter.x,
                y: splitter.y,
                width: splitter.width,
                height: splitter.height
            });


            
/////////////////////////////////////////////
/////////////////////////////////////////////
/////////////////////////////////////////////

const cursor =
    splitter.direction === "vertical"
        ? "col-resize"
        : "row-resize";

splitterView.webContents.loadURL(
    "data:text/html," +
    encodeURIComponent(`
        <html>

        <body style="
            margin:0;
            background:red;
            cursor:${cursor};
        ">




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

console.trace(
    "AJOUT LISTENER page-title-updated"
);

splitterView.webContents.on(
    "page-title-updated",
                (
                    event,
                    title
                ) => {




if (
    title === "drag-end"
) {

    win.setTitle(
        "Tile Browser"
    );

    dragInProgress = false;

    console.log(
    "IGNORE DRAG START",
    dragInProgress
);

    return;
}


if (
    title.startsWith("drag-start:")
)
{
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

////////////////////////////////
////////////////////////////////
////////////////////////////////



    console.log(
        "ENVOI SPLITTERS",
        splitters.length
    );
    win.webContents.send(
        "splitters-updated",
        splitters
    );
}

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

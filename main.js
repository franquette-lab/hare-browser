// ---------------- //
// SCRIPT : main.js //
// ---------------- //

const {
    app,
    BrowserWindow,
    BrowserView,
    ipcMain,
    nativeImage
} = require('electron');

const fs = require("fs");
const path = require("path");

const splitters = [];

// Stockage des 4 bordures bleues
let borderViews = []; 

// === AJOUTEZ CETTE LIGNE JUSTE EN DESSOUS ===
let handleViews = {}; 


let win;
let rootNode = null;
let activePanel = null;
let nextPanelNumber = 4;
let draggedSplitter = null;
let splitterViews = [];
let forceRebuildSplitters = false;
let dragTimer = null;
let dragInProgress = false;
let resizeTimer = null;

//const TOOLBAR_HEIGHT = 88;
//const TOOLBAR_HEIGHT = 77;
  const TOOLBAR_HEIGHT = 77;
let history = [];
let lastClosedPanel = null;
const SPLITTER_SIZE = 10;

let leftView, centerView, rightView;


/*    

function updateActiveBorder(bounds) {
    // Supprimé pour éviter de bloquer les clics. 
    // La bordure est maintenant dessinée par #active-panel-frame dans index.html
    if (!bounds) return;

    if (!borderView) {
        borderView = new BrowserView();



        win.addBrowserView(borderView);

        borderView.setAutoResize({ width: true, height: true });
        
        borderView.webContents.loadURL("data:text/html," + encodeURIComponent(`
            <html>
            <body style="margin:0; padding:0; box-sizing:border-box; border:3px solid #3b82f6; background:transparent; overflow:hidden;">
            </body>
            </html>
        `));
    }

    try {
        const views = win.getBrowserViews();
        if (views.includes(borderView)) {
            win.setTopBrowserView(borderView);
        }
    } catch (err) {
        console.error("borderView error", err);
    }

    borderView.setBounds({ x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height });
}
*/

function updateActiveBorder(bounds) {
    if (!bounds) return;

    const BORDER_THICKNESS = 3; // Épaisseur du liseré bleu

    // Définition des coordonnées des 4 bordures autour du panneau
    const borderLayouts = [
        { x: bounds.x, y: bounds.y, width: bounds.width, height: BORDER_THICKNESS }, // TOP
        { x: bounds.x, y: bounds.y + bounds.height - BORDER_THICKNESS, width: bounds.width, height: BORDER_THICKNESS }, // BOTTOM
        { x: bounds.x, y: bounds.y, width: BORDER_THICKNESS, height: bounds.height }, // LEFT
        { x: bounds.x + bounds.width - BORDER_THICKNESS, y: bounds.y, width: BORDER_THICKNESS, height: bounds.height } // RIGHT
    ];

    // Création des 4 vues si elles n'existent pas encore
    if (borderViews.length === 0) {
        for (let i = 0; i < 4; i++) {
            const bView = new BrowserView();
            win.addBrowserView(bView);
            bView.webContents.loadURL("data:text/html," + encodeURIComponent(`
                <html><body style="margin:0; padding:0; background:#3b82f6; overflow:hidden;"></body></html>
            `));
            borderViews.push(bView);
        }
    }

    // Application des positions et mise au premier plan de chaque liseré
    borderLayouts.forEach((layout, index) => {
        const bView = borderViews[index];
        if (bView && !bView.webContents.isDestroyed()) {
            bView.setBounds(layout);
            try {
                win.setTopBrowserView(bView);
            } catch (e) {}
        }
    });
}

let handleDraggedPanelId = null; // Variable de suivi du déplacement global



function updatePanelHandles() {
    if (!win || win.isDestroyed()) return;

    const panelsList = collectPanelNodes(rootNode);
    const activeIds = panelsList.map(p => p.id);

    // 1. Nettoyer les poignées des panneaux qui ont été fermés
    Object.keys(handleViews).forEach(id => {
        if (!activeIds.includes(id)) {
            try { win.removeBrowserView(handleViews[id]); } catch(e) {}
            delete handleViews[id];
        }
    });

    // 2. Mettre à jour ou créer la poignée pour chaque panneau existant
    panelsList.forEach((panel) => {
        if (!panel.bounds) return;

        // Positionnement de la poignée en haut à gauche du panneau (avec un décalage de 6px)
        const handleBounds = {
            x: panel.bounds.x + 6,
            y: panel.bounds.y + 6,
            width: 24,
            height: 24
        };

        if (!handleViews[panel.id]) {
            const hView = new BrowserView();
            win.addBrowserView(hView);
			
			// CORRECTION : On ajoute ";charset=utf-8" juste après "data:text/html"
			hView.webContents.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(`
				<html><head><style>
				html, body { margin: 0; padding: 0; overflow: hidden !important; width: 100%; height: 100%; }
				#handle {
					width: 100%; height: 100%;
					background: #2d2d30; border: 1px solid #3c3c3c; border-radius: 4px;
					color: #cfcfcf; display: flex; align-items: center; justify-content: center;
					cursor: grab; font-family: sans-serif; font-size: 14px; user-select: none;
					box-shadow: 0 2px 4px rgba(0,0,0,0.3); box-sizing: border-box;
				}
				#handle:hover { background: #3f3f46; color: #ffffff; }
				</style></head><body>
				<div id="handle">⠿</div>
				<script>
					let dragging = false;
					document.getElementById("handle").addEventListener("mousedown", (e) => {
						if (e.button !== 0) return;
						dragging = true;
						document.title = "drag-start";
					});
					document.addEventListener("mouseup", () => {
						if (dragging) {
							dragging = false;
							document.title = "drag-end";
						}
					});
				</script></body></html>
			`));

            // Écoute des actions de la souris émises via le titre de la BrowserView de la poignée
            hView.webContents.on("page-title-updated", (event, title) => {
                event.preventDefault();
                
                if (title === "drag-start") {
                    activePanel = panel.id;
                    win.webContents.send("active-panel-changed", { id: panel.id, bounds: panel.bounds });
                    updateActiveBorder(panel.bounds);
                    handleDraggedPanelId = panel.id;
                }
                
                if (title === "drag-end" && handleDraggedPanelId) {
                    const { screen } = require('electron');
                    const mousePoint = screen.getCursorScreenPoint();
                    const winContentBounds = win.getContentBounds();
                    
                    const localX = mousePoint.x - winContentBounds.x;
                    const localY = mousePoint.y - winContentBounds.y;

                    const list = collectPanelNodes(rootNode);
                    let targetPanel = null;

                    for (const p of list) {
                        if (p.bounds && p.id !== handleDraggedPanelId) {
                            if (localX >= p.bounds.x && localX <= (p.bounds.x + p.bounds.width) &&
                                localY >= p.bounds.y && localY <= (p.bounds.y + p.bounds.height)) {
                                targetPanel = p;
                                break;
                            }
                        }
                    }

                    if (targetPanel) {
                        swapPanelsInTree(handleDraggedPanelId, targetPanel.id);
                    }
                    handleDraggedPanelId = null;
                }
            });

            handleViews[panel.id] = hView;
        }

        // Appliquer la position géométrique et la pousser au premier plan absolu
        const currentHandle = handleViews[panel.id];
        currentHandle.setBounds(handleBounds);
        try {
            win.setTopBrowserView(currentHandle);
        } catch(e) {}
    });
}



function getDisplayText(urlString) {
    try {
        const url = new URL(urlString);
        return decodeURIComponent(url.pathname.split("/").pop()).replaceAll("_", " ");
    } catch {
        return urlString;
    }
}

function createSnapshot(node) {
    if (node.type === "panel") {
        return { type: "panel", id: node.id, url: node.url, realUrl: node.url };
    }

    return {
        type: "split",
        direction: node.direction,
        ratio: node.ratio,
        first: createSnapshot(node.first),
        second: createSnapshot(node.second)
    };
}

function saveState() {
    history.push(JSON.stringify(createSnapshot(rootNode)));
    if (history.length > 20) history.shift();
}

class PanelNode {
    constructor(id, view, url = "") {
        this.type = "panel";
        this.id = id;
        this.view = view;
        this.url = url;
    }
    toJSON() {
        return { type: this.type, id: this.id, url: this.url };
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

function findPanelByWebContents(webContents) {
    function walk(node) {
        if (!node) return null;

        if (
            node.type === "panel" &&
            node.view &&
            node.view.webContents === webContents
        ) {
            return node;
        }

        return walk(node.first) || walk(node.second);
    }

    return walk(rootNode);
}   

function findPanelByView(view) {

    function walk(node) {
        if (!node) return null;

        if (node.type === "panel" && node.view === view) {
            return node;
        }

        return walk(node.first) || walk(node.second);
    }

    return walk(rootNode);
}

function findPanelNode(node, panelId) {
    if (!node) return null;
    if (node.type === "panel" && node.id === panelId) return node;
    if (node.type === "split") {
        return findPanelNode(node.first, panelId) || findPanelNode(node.second, panelId);
    }
    return null;
}

function findParentNode(current, panelId) {
    if (!current) return null;
    if (current.type === "split") {
        if (current.first && current.first.type === "panel" && current.first.id === panelId) return current;
        if (current.second && current.second.type === "panel" && current.second.id === panelId) return current;
        return findParentNode(current.first, panelId) || findParentNode(current.second, panelId);
    }
    return null;
}

function findFirstPanel(node) {
    if (node.type === "panel") return node;
    return findFirstPanel(node.first);
}

function collectPanels(node, panels = []) {
    if (!node) return panels;
    if (node.type === "panel") {
        panels.push({ id: node.id, url: node.title || getDisplayText(node.url), realUrl: node.url });        
        return panels;
    }
    collectPanels(node.first, panels);
    collectPanels(node.second, panels);
    return panels;
}

function collectPanelNodes(node, panels = []) {
    if (!node) return panels;
    if (node.type === "panel") {
        panels.push(node);
        return panels;
    }
    collectPanelNodes(node.first, panels);
    collectPanelNodes(node.second, panels);
    return panels;
}

function updatePanelUrl(panel, url) {
    panel.url = url;
    if (panel.view && !panel.view.webContents.isDestroyed()) {
        panel.title = panel.view.webContents.getTitle();
    }
    win.webContents.send("panels-updated", collectPanels(rootNode));
}

function updateNavigationButtons() {
    if (!activePanel) return;

    const panel = findPanelNode(rootNode, activePanel);
    if (!panel || !panel.view) return;

    win.webContents.send("navigation-state", {
//      canGoBack: panel.view.webContents.canGoBack(),
//      canGoForward: panel.view.webContents.canGoForward()
        canGoBack: panel.view.webContents.navigationHistory.canGoBack(),
        canGoForward: panel.view.webContents.navigationHistory.canGoForward()
    });
}

/*
function setupNavigationTracking(panel) {
    if (!panel || !panel.view) return;

    // Fonction centrale pour mettre à jour l'URL et notifier l'IHM des capacités de navigation
    function handleNavigationUpdate(url) {
        updatePanelUrl(panel, url);
        
        // On vérifie l'historique avec la nouvelle API recommandée
        const canGoBack = panel.view.webContents.navigationHistory.canGoBack();
        const canGoForward = panel.view.webContents.navigationHistory.canGoForward();
        
        // On envoie l'état des boutons au process de rendu (index.html)
        win.webContents.send("navigation-state-changed", {
            panelId: panel.id,
            canGoBack: canGoBack,
            canGoForward: canGoForward
        });
    }

    panel.view.webContents.on("did-navigate", (event, url) => handleNavigationUpdate(url));
    panel.view.webContents.on("did-navigate-in-page", (event, url) => handleNavigationUpdate(url));

    panel.view.webContents.on("focus", () => {
        activePanel = panel.id;
        win.webContents.send("active-panel-changed", { id: panel.id, bounds: panel.bounds });
        updateActiveBorder(panel.bounds);
        
        // Forcer la mise à jour des boutons dès que le panneau prend le focus
        win.webContents.send("navigation-state-changed", {
            panelId: panel.id,
            canGoBack: panel.view.webContents.navigationHistory.canGoBack(),
            canGoForward: panel.view.webContents.navigationHistory.canGoForward()
        });
    });


    panel.view.webContents.on("dom-ready", () => {
        panel.view.webContents.executeJavaScript(`
            if (!document.getElementById("tile-browser-drag-handle")) {
                const handle = document.createElement("div");
                handle.id = "tile-browser-drag-handle";
                handle.title = "Glisser pour déplacer le panneau";
                
                Object.assign(handle.style, {
                    position: "fixed",
                    top: "10px",
                    left: "10px",
                    width: "24px",
                    height: "24px",
                    backgroundColor: "#2d2d30",
                    border: "1px solid #3c3c3c",
                    borderRadius: "4px",
                    color: "#cfcfcf",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "grab",
                    zIndex: "2147483647",
                    fontSize: "14px",
                    userSelect: "none",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
                    fontFamily: "sans-serif"
                });
                
                handle.innerText = "⠿";

                handle.addEventListener("mouseenter", () => handle.style.backgroundColor = "#3f3f46");
                handle.addEventListener("mouseleave", () => handle.style.backgroundColor = "#2d2d30");

                let isDragging = false;
                
                handle.addEventListener("mousedown", (e) => {
                    if (e.button !== 0) return;
                    isDragging = true;
                    handle.style.cursor = "grabbing";
                    
                    // Active le panneau au clic
                    window.postMessage({ source: "tile-browser-focus", panelId: "${panel.id}" }, "*");
                    
                    // Signale au main process le début du drag manuel
                    window.postMessage({ source: "handle-drag-start", panelId: "${panel.id}" }, "*");
                });

                // Écoute les mouvements n'importe où dans la fenêtre
                window.addEventListener("mousemove", (e) => {
                    if (!isDragging) return;
                    // On envoie en continu l'événement de mouvement au process principal
                    window.postMessage({ source: "handle-drag-move" }, "*");
                });

                window.addEventListener("mouseup", () => {
                    if (isDragging) {
                        isDragging = false;
                        handle.style.cursor = "grab";
                        window.postMessage({ source: "handle-drag-end" }, "*");
                    }
                });
            }
        `).catch(err => console.error(err));
    });



    panel.view.setAutoResize({
        width: true,   
        height: true,  
        horizontal: false,
        vertical: false
    });
}
*/



/*
function layoutNode(node, x, y, width, height) {
    if (!node || width <= 0 || height <= 0) return;

    if (node.type === "panel") {
        node.bounds = { x, y, width, height };
        node.view.setBounds({ x, y, width, height });
        return;
    }

    if (node.direction === "vertical") {
        const firstWidth = Math.floor(width * node.ratio);
        splitters.push({
            node, direction: "vertical",
            x: x + firstWidth, y,
            width: SPLITTER_SIZE, height,
            parentX: x, parentWidth: width
        });
        layoutNode(node.first, x, y, firstWidth, height);
        layoutNode(node.second, x + firstWidth + SPLITTER_SIZE, y, width - firstWidth - SPLITTER_SIZE, height);
    } else {
        const firstHeight = Math.floor(height * node.ratio);
        splitters.push({
            node, direction: "horizontal",
            x, y: y + firstHeight,
            width, height: SPLITTER_SIZE,
            parentY: y, parentHeight: height
        });
        layoutNode(node.first, x, y, width, firstHeight);
        layoutNode(node.second, x, y + firstHeight, width, height - firstHeight);
    }
}
*/


function setupNavigationTracking(panel) {
    if (!panel || !panel.view) return;

    function handleNavigationUpdate(url) {
        updatePanelUrl(panel, url);
        const canGoBack = panel.view.webContents.navigationHistory.canGoBack();
        const canGoForward = panel.view.webContents.navigationHistory.canGoForward();
        win.webContents.send("navigation-state-changed", {
            panelId: panel.id, canGoBack: canGoBack, canGoForward: canGoForward
        });
    }

    panel.view.webContents.on("did-navigate", (event, url) => handleNavigationUpdate(url));
    panel.view.webContents.on("did-navigate-in-page", (event, url) => handleNavigationUpdate(url));

    panel.view.webContents.on("focus", () => {
        activePanel = panel.id;
        win.webContents.send("active-panel-changed", { id: panel.id, bounds: panel.bounds });
        updateActiveBorder(panel.bounds);
        win.webContents.send("navigation-state-changed", {
            panelId: panel.id,
            canGoBack: panel.view.webContents.navigationHistory.canGoBack(),
            canGoForward: panel.view.webContents.navigationHistory.canGoForward()
        });
    });

    panel.view.setAutoResize({ width: true, height: true, horizontal: false, vertical: false });
}


function layoutNode(node, x, y, width, height) {
    if (!node || width <= 0 || height <= 0) return;

/*
    if (node.type === "panel") {
        node.bounds = { x, y, width, height };
        
        // CORRECTION : On réduit la vue web de 2 pixels sur chaque bord.
        // Cela laisse apparaître la borderView qui se situe juste en dessous.
        if (node.view && !node.view.webContents.isDestroyed()) {
            node.view.setBounds({ 
                x: x + 2, 
                y: y + 2, 
                width: width - 4, 
                height: height - 4 
            });
        }
        return;
    }
*/

    if (node.type === "panel") {
        node.bounds = { x, y, width, height };
        if (node.view && !node.view.webContents.isDestroyed()) {
            // Rétablir les dimensions pleines d'origine
            node.view.setBounds({ x, y, width, height });
        }
        return;
    }


    if (node.direction === "vertical") {
        const firstWidth = Math.floor(width * node.ratio);
        splitters.push({
            node, direction: "vertical",
            x: x + firstWidth, y,
            width: SPLITTER_SIZE, height,
            parentX: x, parentWidth: width
        });
        layoutNode(node.first, x, y, firstWidth, height);
        layoutNode(node.second, x + firstWidth + SPLITTER_SIZE, y, width - firstWidth - SPLITTER_SIZE, height);
    } else {
        const firstHeight = Math.floor(height * node.ratio);
        splitters.push({
            node, direction: "horizontal",
            x, y: y + firstHeight,
            width, height: SPLITTER_SIZE,
            parentY: y, parentHeight: height
        });
        layoutNode(node.first, x, y, width, firstHeight);
        layoutNode(node.second, x, y + firstHeight, width, height - firstHeight);
    }
}



ipcMain.on("navigate", (event, panelId, url) => {
    const panel = findPanelNode(rootNode, panelId);
    if (panel && panel.view) panel.view.webContents.loadURL(url.startsWith('http') ? url : 'https://' + url);
});


/*
function swapPanelsInTree(idA, idB) {
    saveState();
    
    const nodeA = findPanelNode(rootNode, idA);
    const nodeB = findPanelNode(rootNode, idB);

    if (!nodeA || !nodeB) return;

    // 1. On permute TOUTES les propriétés, y compris les ID
    const tempId = nodeA.id;
    const tempView = nodeA.view;
    const tempUrl = nodeA.url;
    const tempTitle = nodeA.title;

    nodeA.id = nodeB.id;
    nodeA.view = nodeB.view;
    nodeA.url = nodeB.url;
    nodeA.title = nodeB.title;

    nodeB.id = tempId;
    nodeB.view = tempView;
    nodeB.url = tempUrl;
    nodeB.title = tempTitle;

    // 2. Ré-attache les vues pour forcer Electron à rafraîchir l'affichage
    win.addBrowserView(nodeA.view);
    win.addBrowserView(nodeB.view);

    // 3. Le focus suit le panneau déplacé (idA possède maintenant les données à l'emplacement B)
    activePanel = nodeA.id; 

    forceRebuildSplitters = true;
    resizeViews();

    // 4. Notification complète à l'IHM
    const updatedPanels = collectPanels(rootNode);
    win.webContents.send("panels-updated", updatedPanels);
    win.webContents.send("active-panel-changed", { id: nodeA.id, bounds: nodeA.bounds });
}
*/

function swapPanelsInTree(idA, idB) {
    saveState();
    
    const nodeA = findPanelNode(rootNode, idA);
    const nodeB = findPanelNode(rootNode, idB);

    if (!nodeA || !nodeB) return;

    const parentA = findParentNode(rootNode, idA);
    const parentB = findParentNode(rootNode, idB);

    if (!parentA || !parentB) return;

    // 1. On mémorise de quel côté (first ou second) se trouvaient les nœuds
    const isFirstA = (parentA.first === nodeA);
    const isFirstB = (parentB.first === nodeB);

    // 2. On effectue la permutation croisée dans l'arbre de manière atomique
    if (isFirstA) parentA.first = nodeB;
    else parentA.second = nodeB;

    if (isFirstB) parentB.first = nodeA;
    else parentB.second = nodeA;

    // 3. On maintient le focus sur le panneau déplacé (idA)
    activePanel = idA; 

    // 4. On force la reconstruction géométrique complète
    forceRebuildSplitters = true;
    resizeViews();

    // 5. Notification complète et immédiate à l'interface HTML
    win.webContents.send("panels-updated", collectPanels(rootNode));
    win.webContents.send("active-panel-changed", { id: nodeA.id, bounds: nodeA.bounds });
}


let panelBeingDragged = null;

ipcMain.on("panel-drag-start", (event, panelId) => {
    panelBeingDragged = panelId;
    const draggedNode = findPanelNode(rootNode, panelId);
    if (!draggedNode || !draggedNode.view) return;

    const emptyIcon = nativeImage.createFromBuffer(Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00,
        0x0D, 0x49, 0x44, 0x41, 0x54, 0x18, 0x57, 0x63, 0x60, 0x60, 0x60, 0x00,
        0x00, 0x00, 0x04, 0x00, 0x01, 0x27, 0x67, 0x22, 0xAF, 0x00, 0x00, 0x00,
        0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
    ]));

    draggedNode.view.webContents.startDrag({
        file: path.join(__dirname, 'index.html'),
        icon: emptyIcon
    });
});

/*
app.on('drag-end', () => {
    if (!panelBeingDragged) return;

    const { screen } = require('electron');
    const mousePoint = screen.getCursorScreenPoint();
    const winContentBounds = win.getContentBounds();
    const localX = mousePoint.x - winContentBounds.x;
    const localY = mousePoint.y - winContentBounds.y;

    const panelsList = collectPanelNodes(rootNode);
    let targetPanel = null;

    for (const p of panelsList) {
        if (p.bounds && p.id !== panelBeingDragged) {
            if (localX >= p.bounds.x && localX <= (p.bounds.x + p.bounds.width) &&
                localY >= p.bounds.y && localY <= (p.bounds.y + p.bounds.height)) {
                targetPanel = p;
                break;
            }
        }
    }

    if (targetPanel) {
        // Exécute le swap mis à jour
        swapPanelsInTree(panelBeingDragged, targetPanel.id);
    }
    
    panelBeingDragged = null;
});
*/
app.on('drag-end', () => {
    if (!panelBeingDragged) return;

    const { screen } = require('electron');
    const mousePoint = screen.getCursorScreenPoint();
    const winContentBounds = win.getContentBounds();
    const localX = mousePoint.x - winContentBounds.x;
    const localY = mousePoint.y - winContentBounds.y;

    const panelsList = collectPanelNodes(rootNode);
    let targetPanel = null;

    for (const p of panelsList) {
        if (p.bounds && p.id !== panelBeingDragged) {
            if (localX >= p.bounds.x && localX <= (p.bounds.x + p.bounds.width) &&
                localY >= p.bounds.y && localY <= (p.bounds.y + p.bounds.height)) {
                targetPanel = p;
                break;
            }
        }
    }

    if (targetPanel) {
        // Exécute le swap mis à jour
        swapPanelsInTree(panelBeingDragged, targetPanel.id);
    }
    
    panelBeingDragged = null;
});


    // === À PLACER DANS MAIN.JS AVEC LES AUTRES IPCMAIN ===
    ipcMain.on("move-panel", (event, draggedPanelId, targetPanelId) => {
        if (draggedPanelId && targetPanelId && draggedPanelId !== targetPanelId) {
            swapPanelsInTree(draggedPanelId, targetPanelId);
        }
    });


ipcMain.on("close-panel", (event, panelId) => {
    const node = findPanelNode(rootNode, panelId);
    if (!node) return;
    const parent = findParentNode(rootNode, panelId);
    if (!parent) return;

    saveState();
    const sibling = (parent.first === node) ? parent.second : parent.first;

    if (parent === rootNode) {
        rootNode = sibling;
    } else {
        replaceNode(rootNode, parent, sibling);
    }

    lastClosedPanel = { id: node.id, url: node.url, title: node.title || getDisplayText(node.url) };
    win.webContents.send("undo-available", true);        
    win.removeBrowserView(node.view);

    const newActivePanel = findFirstPanel(sibling);
    activePanel = newActivePanel.id;

    win.webContents.send("active-panel-changed", { id: newActivePanel.id, bounds: newActivePanel.bounds });        
    forceRebuildSplitters = true;
    resizeViews();
    win.webContents.send("panels-updated", collectPanels(rootNode));
});

/*
ipcMain.on("split-panel", (event, panelId, direction) => {
    const node = findPanelNode(rootNode, panelId);
    const parent = findParentNode(rootNode, panelId);

    const newView = new BrowserView();
    win.addBrowserView(newView);
    const defaultUrl = "https://www.bing.com";
    newView.webContents.loadURL(defaultUrl);

    const newPanelId = "panel" + nextPanelNumber++;
    const newPanel = new PanelNode(newPanelId, newView, defaultUrl);
    setupNavigationTracking(newPanel);            

    const newSplit = new SplitNode(direction);
    newSplit.ratio = 0.5;

    if (!parent) {
        newSplit.first = node;
        newSplit.second = newPanel;
        rootNode = newSplit;
    } else {
        if (parent.first === node) parent.first = newSplit;
        else parent.second = newSplit;
        newSplit.first = node;
        newSplit.second = newPanel;
    }

    saveState();
    activePanel = newPanelId;
    forceRebuildSplitters = true;
    resizeViews();
    win.webContents.send("panels-updated", collectPanels(rootNode));
});
*/
// CORRECTION : On ajoute bien "direction" dans les arguments reçus
ipcMain.on("split-panel", (event, panelId, direction) => {
    const node = findPanelNode(rootNode, panelId);
    const parent = findParentNode(rootNode, panelId);

    const newView = new BrowserView();
    win.addBrowserView(newView);
    const defaultUrl = "https://bing.com";
    newView.webContents.loadURL(defaultUrl);

    const newPanelId = "panel" + nextPanelNumber++;
    const newPanel = new PanelNode(newPanelId, newView, defaultUrl);
    setupNavigationTracking(newPanel);            

    const newSplit = new SplitNode(direction);
    newSplit.ratio = 0.5;

    if (!parent) {
        newSplit.first = node;
        newSplit.second = newPanel;
        rootNode = newSplit;
    } else {
        if (parent.first === node) parent.first = newSplit;
        else parent.second = newSplit;
        newSplit.first = node;
        newSplit.second = newPanel;
    }

    saveState();
    
    activePanel = newPanelId;
    
    forceRebuildSplitters = true;
    resizeViews();
    
    // 1. On notifie index.html du changement de liste des panneaux pour dessiner le nouvel onglet
    win.webContents.send("panels-updated", collectPanels(rootNode));
    
    // 2. On force IMMÉDIATEMENT l'interface à activer le focus visuel sur ce nouvel onglet
    win.webContents.send("active-panel-changed", { id: newPanel.id, bounds: newPanel.bounds });
    
    // 3. On dessine la bordure bleue autour du nouveau panneau
    updateActiveBorder(newPanel.bounds);
});


function createDefaultLayout() {
    leftView = new BrowserView();
    centerView = new BrowserView();
    rightView = new BrowserView();

    win.addBrowserView(leftView);
    win.addBrowserView(centerView);
    win.addBrowserView(rightView);

    leftView.webContents.loadURL("https://www.google.com");
    centerView.webContents.loadURL("https://fr.wikipedia.org");
    rightView.webContents.loadURL("https://github.com");

    rootNode = new SplitNode("vertical");
    rootNode.ratio = 0.33;

    rootNode.first = new PanelNode("panel1", leftView, "https://www.google.com");
    rootNode.second = new SplitNode("vertical");
    rootNode.second.ratio = 0.5;
    rootNode.second.first = new PanelNode("panel2", centerView, "https://fr.wikipedia.org");
    rootNode.second.second = new PanelNode("panel3", rightView, "https://github.com");

    collectPanelNodes(rootNode).forEach((panel) => {
        setupNavigationTracking(panel);
    });
}

function createWindow() {

    win = new BrowserWindow({
        width: 1600, height: 900,
        minWidth: 1000, minHeight: 700,
        backgroundColor: "#111827",
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    win.setMaxListeners(30);

process.on("warning", (warning) => {
    console.log("WARNING NAME:", warning.name);
    console.log("WARNING MESSAGE:", warning.message);
    console.log("WARNING STACK:", warning.stack);
});

    createDefaultLayout();
    win.setMenu(null);
    win.loadFile('index.html');

    forceRebuildSplitters = true;
    resizeViews();

    

    win.webContents.on('did-finish-load', () => {
        win.webContents.send("panels-updated", collectPanels(rootNode));
    });
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

    // Prise en charge du mode plein écran (Maximized / Fullscreen)
    win.on("maximize", () => {
        forceRebuildSplitters = true;
        resizeViews();
    });

    win.on("unmaximize", () => {
        forceRebuildSplitters = true;
        resizeViews();
    });

    win.on("enter-full-screen", () => {
        forceRebuildSplitters = true;
        resizeViews();
    });

    win.on("leave-full-screen", () => {
        forceRebuildSplitters = true;
        resizeViews();
    });




}

function replaceNode(current, target, replacement) {
    if (!current) return false;
    if (current.first === target) { current.first = replacement; return true; }
    if (current.second === target) { current.second = replacement; return true; }
    if (current.type === "split") {
        return replaceNode(current.first, target, replacement) || replaceNode(current.second, target, replacement);
    }
    return false;
}

/*
function brbringActiveViewToFront() {
    if (!win || win.isDestroyed() || !activePanel) return;
    
    const activeNode = findPanelNode(rootNode, activePanel);
    if (!activeNode || !activeNode.view) return;

    try {
        // 1. On s'assure que la bordure est bien présente
        if (borderView) {
            win.setTopBrowserView(borderView);
        }
        // 2. IMPORTANT : On pousse IMMÉDIATEMENT la véritable vue web au-dessus de la bordure.
        // Comme la vue web est plus petite de 3 pixels à cause de l'épaisseur de la bordure,
        // la bordure bleue reste visible sur les contours extérieurs mais la page capte 100% des clics.
        win.setTopBrowserView(activeNode.view);
    } catch (err) {
        console.error("Erreur d'ordonnancement des vues :", err);
    }
}
*/



function resizeViews() {
    if (win.isDestroyed()) return;
    
    // 1. Récupérer la taille réelle de la zone de contenu utile d'Electron
    const bounds = win.getContentBounds();
    const width = bounds.width;
    const height = bounds.height;
    
    splitters.length = 0;

    if (forceRebuildSplitters) {
        splitterViews.forEach((v) => { try { win.removeBrowserView(v); } catch(e) {} });
        splitterViews = [];
        forceRebuildSplitters = false;
    }

    // 2. IMPORTANT : On applique le layout géométrique des panneaux sous la barre d'outils
    layoutNode(rootNode, 0, TOOLBAR_HEIGHT, width, height - TOOLBAR_HEIGHT);

    while (splitterViews.length > splitters.length) {
        const oldSplitter = splitterViews.pop();
        try { win.removeBrowserView(oldSplitter); } catch (e) {}
    }

    // 3. Positionnement des splitters
    splitters.forEach((splitter, index) => {
        if (splitterViews[index]) {
            splitterViews[index].setBounds({ x: splitter.x, y: splitter.y, width: splitter.width, height: splitter.height });
            return;
        }

        const cursor = splitter.direction === "vertical" ? "col-resize" : "row-resize";
        const handleDirection = splitter.direction === "vertical" ? "column" : "row";


        const splitterView = new BrowserView();
        win.addBrowserView(splitterView);
        splitterViews.push(splitterView);
        
        
        



        splitterView.setBounds({ x: splitter.x, y: splitter.y, width: splitter.width, height: splitter.height });
        splitterView.webContents.loadURL("data:text/html," + encodeURIComponent(`
            <html><head><style>
            html, body { margin: 0; padding: 0; overflow: hidden !important; }
            body { box-sizing: border-box; background: #374151; display: flex; align-items: center; justify-content: center; cursor: ${cursor}; }
            #handle { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); display: flex; flex-direction: ${handleDirection}; gap: 2px; }  
            body:hover { background: #808080; }
            .dot { display: block; width: 3px; height: 3px; background: #cfcfcf; border-radius: 50%; }
            </style></head><body>
            <div id="handle"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>
            <script>
                let dragging = false;
                let dragStartX = 0, dragStartY = 0;
                document.addEventListener("dblclick", () => {
                    document.title = "reset-splitter";
                });
                document.addEventListener("mousedown", (e) => {
                    if (e.button !== 0) return;
                    dragging = true;
                    dragStartX = e.screenX;
                    dragStartY = e.screenY;
                    document.title = "drag-start:" + dragStartX + ":" + dragStartY;
                });
                document.addEventListener("mouseup", () => { dragging = false; document.title = "drag-end"; });
                document.addEventListener("mousemove", (e) => { 
                    if (dragging) document.title = "move:" + e.screenX + ":" + e.screenY; 
                });
            </script></body></html>
        `));

        splitterView.webContents.on("page-title-updated", (event, title) => {
            event.preventDefault();
            if (title === "reset-splitter") { splitter.node.ratio = 0.5; resizeViews(); return; }
            if (title === "drag-end") { win.setTitle("Tile Browser"); dragInProgress = false; return; }
            if (title.startsWith("drag-start:")) {
                dragInProgress = true;
                const parts = title.slice(11).split(":");
                dragStartMouseX = parseInt(parts[0]);
                dragStartMouseY = parseInt(parts[1]);
                dragStartRatio = splitter.node.ratio;
                return;
            }
            if (title.startsWith("move:") && dragInProgress) {
                const parts = title.slice(5).split(":");
                const mouseX = Number(parts[0]);
                const mouseY = Number(parts[1]);
                if (splitter.direction === "vertical") {
                    splitter.node.ratio = dragStartRatio + ((mouseX - dragStartMouseX) / splitter.parentWidth);
                } else {
                    splitter.node.ratio = dragStartRatio + ((mouseY - dragStartMouseY) / splitter.parentHeight);
                }
                splitter.node.ratio = Math.max(0.1, Math.min(0.9, splitter.node.ratio));
                resizeViews();
            }
        });
    });

    win.webContents.send("splitters-updated", splitters);


    
    // 4. Gérer la bordure active sans bloquer les clics de l'utilisateur
    /*
    if (borderView && borderView.webContents && !borderView.webContents.isDestroyed()) {
        if (activePanel) {
            const activeNode = findPanelNode(rootNode, activePanel);
            if (activeNode && activeNode.bounds) {
                borderView.setBounds(activeNode.bounds);
                
                try {
                    // Supprime puis ré-ajoute pour forcer un rafraîchissement d'ordre visuel
                    win.removeBrowserView(borderView);
                    win.addBrowserView(borderView);
                    
                    // IMPORTANT : On remonte le panneau Web ACTIF au-dessus de la bordure 
                    // pour que l'utilisateur puisse interagir et cliquer sur les liens.
                    if (activeNode.view) {
                        win.setTopBrowserView(activeNode.view);
                    }
                } catch (err) {
                    console.error("Erreur de gestion de l'ordre des calques :", err);
                }
            }
        } else {
            borderView.setBounds({ x: -100, y: -100, width: 0, height: 0 });
        }
    }
    */  

    // 4. Mettre à jour la position des liserés bleus
    if (activePanel) {
        const activeNode = findPanelNode(rootNode, activePanel);
        if (activeNode && activeNode.bounds) {
            updateActiveBorder(activeNode.bounds);
        }
    } else {
        borderViews.forEach(bView => {
            if (bView && !bView.webContents.isDestroyed()) {
                bView.setBounds({ x: -100, y: -100, width: 0, height: 0 });
            }
        });
    }

    // === AJOUT : On force le rafraîchissement des poignées de déplacement ===
    updatePanelHandles();

    win.webContents.send("splitters-updated", splitters);
}




ipcMain.on("set-active-panel", (event, panelId) => {
    const panel = findPanelNode(rootNode, panelId);
    if (!panel) return;
    activePanel = panelId;
    win.webContents.send("active-panel-changed", { id: panel.id, bounds: panel.bounds });
    updateActiveBorder(panel.bounds);
});


// Intercepte les demandes de focus issues de la poignée injectée
ipcMain.on("set-active-panel-from-handle", (event, panelId) => {
    const panel = findPanelNode(rootNode, panelId);
    if (!panel) return;
    activePanel = panelId;
    win.webContents.send("active-panel-changed", { id: panel.id, bounds: panel.bounds });
    updateActiveBorder(panel.bounds);
});



ipcMain.handle("go-back", (event, panelId) => {
    const panel = findPanelNode(rootNode, panelId);
    if (panel && panel.view && panel.view.webContents.navigationHistory.canGoBack()) {
        panel.view.webContents.navigationHistory.goBack();
		updateNavigationButtons();
    }
});

ipcMain.handle("go-forward", (event, panelId) => {
    const panel = findPanelNode(rootNode, panelId);
    if (panel && panel.view && panel.view.webContents.navigationHistory.canGoForward()) {
        panel.view.webContents.navigationHistory.goForward();
		updateNavigationButtons();
    }
});


ipcMain.handle("refresh", (event, panelId) => {
    const panel = findPanelNode(rootNode, panelId);
    if (panel && panel.view) panel.view.webContents.reload();
});

app.whenReady().then(createWindow);

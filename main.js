// ---------------- //
// SCRIPT : main.js //
// ---------------- //
const {
    app,
    BrowserWindow,
    BrowserView,
    ipcMain,
    nativeImage,
    dialog,
    globalShortcut, // <-- AJOUTEZ globalShortcut ICI
    shell           // <-- AJOUTEZ shell ICI pour gérer les fichiers et dossiers
} = require('electron');

// En haut de main.js avec vos autres variables globales
const APP_TITLE = "Hare Browser"; 

const fs = require("fs");
const path = require("path");

const splitters = [];

// ====== EN HAUT DE MAIN.JS WITH OTHER IMPORTS ======
const historyPath = path.join(app.getPath('userData'), 'navigation_history.json');

// Chemin vers le fichier de stockage des favoris
const favorisPath = path.join(app.getPath('userData'), 'favoris.json');

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

// En haut de main.js avec vos autres variables globales (ex: sous let handleViews = {})
let activeDownloads = {}; 

// Stocke l'ID du panneau actuellement zoomé/maximisé au premier plan (null si aucun)
let maximizedPanelId = null; 

// En haut de main.js, à la place de const TOOLBAR_HEIGHT = 105;
let isBookmarksBarVisible = true; // La barre est affichée par défaut
let TOOLBAR_HEIGHT = 105;         // Hauteur avec la barre de favoris (38 + 36 + 28 + corrections)
const TOOLBAR_MIN_HEIGHT = 77;   // Hauteur sans la barre (38 + 36 + corrections)


  let history = [];
let lastClosedPanel = null;
const SPLITTER_SIZE = 10;

let leftView, centerView, rightView;

const https = require("https");



// Fonction pour lire l'historique sur le disque
function getNavigationHistory() {
    try {
        if (!fs.existsSync(historyPath)) {
            fs.writeFileSync(historyPath, JSON.stringify([]));
            return [];
        }
        const data = fs.readFileSync(historyPath, 'utf-8');
        return JSON.parse(data);
    } catch (e) {
        console.error("Erreur lecture historique :", e);
        return [];
    }
}

// Fonction pour ajouter une entrée dans l'historique
function addToHistory(url, title) {

    if (!url || url.startsWith('data:') || url.startsWith('about:')) return;
    
    let historyList = getNavigationHistory();
    
    // Évite les doublons consécutifs exacts
    if (historyList.length > 0 && historyList[0].url === url) return;

    historyList.unshift({
        url,
        title: title || url,
        date: new Date().toISOString()
    });

    // Limite l'historique aux 1000 dernières entrées
    if (historyList.length > 1000) historyList.pop();

    fs.writeFileSync(historyPath, JSON.stringify(historyList, null, 2));
    
    // Optionnel : notifier l'IHM en temps réel si elle est ouverte
    if (win && !win.isDestroyed()) {
        win.webContents.send('history-updated', historyList);
    }
}

// Fonction pour lire les favoris sur le disque
function getFavoris() {
    try {
        if (!fs.existsSync(favorisPath)) {
            fs.writeFileSync(favorisPath, JSON.stringify([]));
            return [];
        }
        const data = fs.readFileSync(favorisPath, 'utf-8');
        return JSON.parse(data);
    } catch (e) {
        console.error("Erreur lors de la lecture des favoris :", e);
        return [];
    }
}

function registerDownloadHandler(session) {
    session.on('will-download', (event, item, webContents) => {
        const filename = item.getFilename();

        const panelNode = findPanelByWebContents(webContents);
        const panelId = panelNode ? panelNode.id : activePanel;

        // On enregistre l'objet de téléchargement pour ce panneau
        activeDownloads[panelId] = item;

        item.on('updated', (event, state) => {
            if (state === 'progressing' && !item.isPaused()) {
                const totalBytes = item.getTotalBytes();
                const receivedBytes = item.getReceivedBytes();
                
                if (totalBytes > 0) {
                    const percent = Math.round((receivedBytes / totalBytes) * 100);
                    if (win && !win.isDestroyed()) {
                        win.webContents.send('download-progress', { panelId, percent, filename });
                    }
                }
            }
        });

        item.once('done', (event, state) => {
            // Nettoyage de la référence
            delete activeDownloads[panelId];

            if (win && !win.isDestroyed()) {
                win.webContents.send('download-done', { panelId });
            }

            if (state === 'completed') {
                const finalPath = item.getSavePath();
                const ext = path.extname(filename).toLowerCase();
                const dangerousExtensions = ['.exe', '.msi', '.bat', '.cmd', '.vbs', '.sh', '.scr'];

                if (dangerousExtensions.includes(ext)) {
                    dialog.showMessageBox(win, {
                        type: 'warning',
                        buttons: ['Exécuter le fichier', 'Annuler'],
                        defaultId: 1,
                        cancelId: 1,
                        title: 'Alerte de sécurité',
                        message: `Téléchargement terminé : ${filename}`,
                        detail: "Ce type de fichier peut contenir des virus. Voulez-vous l'exécuter ?"
                    }).then((response) => {
                        if (response.response === 0) {
                            shell.openPath(finalPath).catch((e) => console.error(e));
                        }
                    });
                } else {
                    shell.openPath(finalPath).catch((e) => console.error(e));
                }
            }
        });
    });
}

function extractResults(data) {

    const results = [];

    for (const item of data.RelatedTopics || []) {

        if (item.Text) {
            results.push({
                title: item.Text,
                url: item.FirstURL
            });
        }

        if (item.Topics) {

            for (const topic of item.Topics) {

                results.push({
                    title: topic.Text,
                    url: topic.FirstURL
                });

            }
        }

    }

    return results;
}



async function buildSearchPage(query) {

    const data = await searchDuckDuckGo(query);

    const results = extractResults(data);

const htmlResults = results.map(r => `
<div class="result">
    ${r.url}
        ${r.title}
    </a>
    <div class="url">
        ${r.url}
    </div>
</div>
`).join("");

console.log("Résultats trouvés :", results.length);

console.log(results[0]);

/*
if (results.length === 0) {

    return `
    <!DOCTYPE html>
    <html>
    <body style="
        background:#202124;
        color:white;
        font-family:Segoe UI;
        padding:20px;
    ">
        <h1>Recherche : ${query}</h1>

        <p>Aucune réponse instantanée trouvée.</p>

        <p>
            Ouvrir les résultats DuckDuckGo :
        </p>

        ${`https://duckduckgo.com/?q=${encodeURIComponent(query)}`}
            Rechercher "${query}"
        </a>
    </body>
    </html>
    `;
}
*/

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>${query}</title>
        </head>
        <style>
body {
    font-family: Segoe UI, sans-serif;
    background: #202124;
    color: white;
}

.result {
    margin-bottom: 16px;
}

.result a {
    color: #8ab4f8;
    font-size: 18px;
    text-decoration: none;
}

.result a:hover {
    text-decoration: underline;
}

.url {
    color: #7cb342;
    font-size: 12px;
}
</style>

        <body>
            <h1>Recherche : ${query}</h1>
            ${htmlResults}
        </body>
        </html>
    `;
}




/*
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
*/

function updateActiveBorder(bounds) {
    if (!bounds || !win || win.isDestroyed()) return;

    const BORDER_THICKNESS = 2;

    const borderLayouts = [
        { x: bounds.x, y: bounds.y, width: bounds.width, height: BORDER_THICKNESS }, // TOP
        // Calque standard au ras du bas du panneau
        { x: bounds.x, y: bounds.y + bounds.height - BORDER_THICKNESS, width: bounds.width, height: BORDER_THICKNESS }, // BOTTOM
        { x: bounds.x, y: bounds.y, width: BORDER_THICKNESS, height: bounds.height }, // LEFT
        { x: bounds.x + bounds.width - BORDER_THICKNESS, y: bounds.y, width: BORDER_THICKNESS, height: bounds.height } // RIGHT
    ];

    

    // Création des 4 bordures si elles n'existent pas
    if (borderViews.length === 0) {
        for (let i = 0; i < 4; i++) {
            const bView = new BrowserView();
            win.addBrowserView(bView);
            
            // === CORRECTIF CRUCIAL A : Empêche le liseré d'intercepter les clics ===
            bView.webContents.setIgnoreMenuShortcuts(true);
            
            bView.webContents.loadURL("data:text/html," + encodeURIComponent(`
                <html><body style="margin:0; padding:0; background:#3b82f6; overflow:hidden;"></body></html>
            `));
            borderViews.push(bView);
        }
    }

    borderLayouts.forEach((layout, index) => {
        const bView = borderViews[index];
        if (bView && !bView.webContents.isDestroyed()) {
            bView.setBounds(layout);
            try {
                win.setTopBrowserView(bView);
                // Indique à Chromium de laisser passer le clic à travers le liseré bleu
                bView.webContents.userAgent = "InternalBorder";
            } catch (e) {}
        }
    });
}



let handleDraggedPanelId = null;


function updatePanelHandles() {
    if (!win || win.isDestroyed()) return;

    const panelsList = collectPanelNodes(rootNode);
    const activeIds = panelsList.map(p => p.id);

    // 1. Nettoyer les poignées des panneaux fermés
    Object.keys(handleViews).forEach(id => {
        if (!activeIds.includes(id)) {
            try { win.removeBrowserView(handleViews[id]); } catch(e) {}
            delete handleViews[id];
        }
    });

    // === CORRECTIF ABSOLU ===
    // On compte le nombre exact de vues web de navigation attachées à la fenêtre principale.
    // On exclut les liserés bleus ("InternalBorder"), les splitters et les autres poignées.
    const allViews = win.getBrowserViews();
    const realWebViews = allViews.filter(v => {
        if (!v.webContents || v.webContents.isDestroyed()) return false;
        const ua = v.webContents.getUserAgent();
        const url = v.webContents.getURL();
        // On élimine les vues internes du navigateur (liserés, data:text/html des boutons/splitters)
        return ua !== "InternalBorder" && !url.startsWith("data:text/html");
    });

    const isLastRemaining = (realWebViews.length === 1);

    // 2. Mettre à jour ou créer la poignée pour chaque panneau
    panelsList.forEach((panel) => {

        if (maximizedPanelId && panel.id !== maximizedPanelId) {
            if (handleViews[panel.id]) {
                try { handleViews[panel.id].setBounds({ x: -1000, y: -1000, width: 0, height: 0 }); } catch(e) {}
            }
            return; 
        }

        if (!panel.bounds) return;

        const isMaximized = (maximizedPanelId === panel.id);
        const expectedWidth = isLastRemaining ? 24 : (isMaximized ? 60 : 80);

        // Si la taille attendue change, destruction immédiate pour forcer Chromium à recharger le DOM HTML
        if (handleViews[panel.id]) {
            const currentBounds = handleViews[panel.id].getBounds();
            if (currentBounds.width !== expectedWidth) {
                try { win.removeBrowserView(handleViews[panel.id]); } catch(e) {}
                delete handleViews[panel.id];
            }
        }



        // Trouvez cette ligne ou équivalent dans la boucle panelsList.forEach((panel) => { ... })
        if (!handleViews[panel.id]) {
            const hView = new BrowserView();
            win.addBrowserView(hView);
            
            // CORRECTION VISUELLE : On force la détection dynamique du mode maximisé/zoomé ici
            const isMaximized = (maximizedPanelId === panel.id);
            const containerClass = isLastRemaining ? 'flex-1-btn' : (isMaximized ? 'flex-3-btns' : '');



            // ====== DANS MAIN.JS -> FONCTION updatePanelHandles() ======
            hView.webContents.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(`
                <html>
                <head>
                    <!-- CORRECTION 1 : Déclaration explicite de l'encodage -->
                    <meta charset="utf-8">
                    <style>
                    html, body { margin: 0; padding: 0; overflow: hidden !important; width: 100%; height: 100%; background: transparent; }
                    #container {
                        display: flex; width: 100%; height: 100%;
                        background: #2d2d30; border: 1px solid #3c3c3c; border-radius: 4px;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.3); box-sizing: border-box; overflow: hidden;
                    }
                    .btn {
                        flex: 1; height: 100%; color: #cfcfcf;
                        display: flex; align-items: center; justify-content: center;
                        font-family: sans-serif; font-size: 11px; user-select: none;
                    }
                    #drag-btn { cursor: grab; font-size: 13px; border-right: 1px solid #3c3c3c; }
                    #drag-btn:hover { background: #3f3f46; color: #ffffff; }
                    .action { cursor: pointer; }
                    #zoom-btn:hover { background: #15803d; color: #4ade80; }
                    #fullscreen-btn { border-left: 1px solid #3c3c3c; border-right: 1px solid #3c3c3c; }
                    #fullscreen-btn:hover { background: #1e3a8a; color: #3b82f6; }
                    #close-btn:hover { background: #991b1b; color: #fca5a5; }
                    
                    .flex-3-btns #drag-btn { display: none !important; }
                    .flex-3-btns #zoom-btn { background: #15803d; color: #4ade80; }
                    .flex-3-btns .action { flex: 1 1 33.33% !important; }
                    
                    .flex-1-btn #drag-btn, .flex-1-btn #zoom-btn, .flex-1-btn #fullscreen-btn { display: none !important; }
                    .flex-1-btn #close-btn { display: flex !important; flex: 1 1 100% !important; border: none !important; border-radius: 4px; }
                    </style>
                </head>
                <body>
                
                <div id="container" class="${containerClass}">
                    <!-- CORRECTION 2 : Utilisation d'entités HTML sécurisées pour éliminer les points d'interrogation -->
                    <div id="drag-btn" class="btn" title="Glisser pour déplacer">&#9776;</div>
                    <div id="zoom-btn" class="btn action" title="${isMaximized ? 'Restaurer la taille' : 'Agrandir'}">${isMaximized ? '&#128471;' : '&#128470;'}</div>
                    <div id="fullscreen-btn" class="btn action" title="Détacher">&#8599;</div>
                    <div id="close-btn" class="btn action" title="Fermer">&#10006;</div>
                </div>
                
                <script>
                    let dragging = false;
                    const dragBtn = document.getElementById("drag-btn");
                    if (dragBtn) {
                        dragBtn.addEventListener("mousedown", (e) => {
                            if (e.button !== 0) return;
                            dragging = true;
                            document.title = "drag-start";
                        });
                    }
                    document.addEventListener("mouseup", () => {
                        if (dragging) { dragging = false; document.title = "drag-end"; }
                    });
                    document.getElementById("zoom-btn").addEventListener("click", () => { document.title = "action-toggle-zoom"; });
                    document.getElementById("fullscreen-btn").addEventListener("click", () => { document.title = "action-fullscreen"; });
                    document.getElementById("close-btn").addEventListener("click", () => { document.title = "action-close"; });
                </script>
                </body>
                </html>
            `));


            hView.webContents.on("page-title-updated", (event, title) => {
                event.preventDefault();
                if (title === "drag-start") {
                    activePanel = panel.id;
                    win.webContents.send("active-panel-changed", { id: panel.id, bounds: panel.bounds });
                    updateActiveBorder(panel.bounds);
                    handleDraggedPanelId = panel.id;
                }
                if (title === "action-toggle-zoom") {
                    maximizedPanelId = maximizedPanelId === panel.id ? null : panel.id;
                    forceRebuildSplitters = true;
                    resizeViews();
                    win.webContents.send("zoom-changed", maximizedPanelId);
                    try { win.removeBrowserView(hView); } catch(e){}
                    delete handleViews[panel.id];
                    updatePanelHandles();
                    return;
                }
                if (title === "action-fullscreen") {
                    if (maximizedPanelId === panel.id) maximizedPanelId = null;
                    detachPanelToFullscreen(panel.id);
                }

                if (title === "action-close") {
                    if (isLastRemaining) {
                        // S'il ne reste qu'un panneau, cliquer sur la croix ferme proprement l'application
                        app.quit(); 
                    } else {
                        // S'il y a plusieurs panneaux, on ferme la tuile normalement
                        ipcMain.emit("close-panel", null, panel.id);
                    }
                    return;
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
                            if (localX >= p.bounds.x && localX <= (p.bounds.x + p.bounds.width) && localY >= p.bounds.y && localY <= (p.bounds.y + p.bounds.height)) {
                                targetPanel = p; break;
                            }
                        }
                    }
                    if (targetPanel) swapPanelsInTree(handleDraggedPanelId, targetPanel.id);
                    handleDraggedPanelId = null;
                }
            });

            handleViews[panel.id] = hView;
        }

        const handleBounds = {
            x: panel.bounds.x + 6,
            y: panel.bounds.y + 6,
            width: expectedWidth, 
            height: 24
        };

        const currentHandle = handleViews[panel.id];
        if (currentHandle) {
            currentHandle.setBounds(handleBounds);
            try { win.setTopBrowserView(currentHandle); } catch(e) {}
        }
    });
}




function findNeighborPanel(activeBounds, direction, panelsList) {
    if (!activeBounds) return null;
    
    let bestTarget = null;
    let minDistance = Infinity;

    // Centre du panneau actif
    const ax = activeBounds.x + activeBounds.width / 2;
    const ay = activeBounds.y + activeBounds.height / 2;

    panelsList.forEach(p => {
        if (p.id === activePanel || !p.bounds) return;

        // Centre du panneau cible
        const tx = p.bounds.x + p.bounds.width / 2;
        const ty = p.bounds.y + p.bounds.height / 2;

        const dx = tx - ax;
        const dy = ty - ay;

        let isValid = false;

        // Vérification stricte de la direction
        if (direction === 'Left' && dx < -10 && Math.abs(dy) < (activeBounds.height + p.bounds.height) / 2) isValid = true;
        if (direction === 'Right' && dx > 10 && Math.abs(dy) < (activeBounds.height + p.bounds.height) / 2) isValid = true;
        if (direction === 'Up' && dy < -10 && Math.abs(dx) < (activeBounds.width + p.bounds.width) / 2) isValid = true;
        if (direction === 'Down' && dy > 10 && Math.abs(dx) < (activeBounds.width + p.bounds.width) / 2) isValid = true;

        if (isValid) {
            // Calcul de la distance brute entre les centres
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < minDistance) {
                minDistance = distance;
                bestTarget = p;
            }
        }
    });

    return bestTarget;
}



function getDisplayText(urlString) {
    try {
        const url = new URL(urlString);
        return decodeURIComponent(url.pathname.split("/").pop()).replaceAll("_", " ");
    } catch {
        return urlString;
    }
}


function rebuildTreeFromSnapshot(snapshotNode, restoredView) {
    if (!snapshotNode) return null;

    if (snapshotNode.type === "panel") {
        // Si c'est le panneau qu'on vient de restaurer, on lui donne la nouvelle vue
        if (snapshotNode.id === lastClosedPanel.id) {
            return new PanelNode(snapshotNode.id, restoredView, snapshotNode.url);
        } else {
            // Sinon, on cherche le panneau déjà existant à l'écran pour récupérer sa vue actuelle
            const existingPanel = findPanelNode(rootNode, snapshotNode.id);
            return new PanelNode(snapshotNode.id, existingPanel ? existingPanel.view : null, snapshotNode.url);
        }
    }

    // Si c'est un nœud de division (split), on reconstruit ses deux enfants récursivement
    const splitNode = new SplitNode(snapshotNode.direction);
    splitNode.ratio = snapshotNode.ratio;
    splitNode.first = rebuildTreeFromSnapshot(snapshotNode.first, restoredView);
    splitNode.second = rebuildTreeFromSnapshot(snapshotNode.second, restoredView);
    return splitNode;
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

function isValidUrl(text) {
    try {
        new URL(text);
        return true;
    } catch {
        return false;
    }
}

function buildNavigationTarget(input) {

    input = input.trim();

    if (isValidUrl(input)) {
        return input;
    }

    if (/^[a-z0-9-]+\.[a-z]{2,}/i.test(input)) {
        return "https://" + input;
    }

//  return `https://searxng-hww1.onrender.com/search?q=${encodeURIComponent(input)}`;
    return `http://129.151.254.175:8080/search?q=${encodeURIComponent(input)}`;
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

//  win.webContents.send("panels-updated", collectPanels(rootNode));
    win.webContents.send("panels-updated", collectPanels(rootNode), maximizedPanelId);

}

function updateNavigationButtons() {
    if (!activePanel) return;

    const panel = findPanelNode(rootNode, activePanel);
    if (!panel || !panel.view) return;

    win.webContents.send("navigation-state", {
        canGoBack: panel.view.webContents.navigationHistory.canGoBack(),
        canGoForward: panel.view.webContents.navigationHistory.canGoForward()
    });
}


function setupNavigationTracking(panel) {
    if (!panel || !panel.view) return;


    // === AJOUT : Maintient le mode sombre configuré lors de l'ouverture d'un nouveau lien ===
    if (typeof panel.view.webContents.setForceDarkModeEnabled === 'function') {
        panel.view.webContents.setForceDarkModeEnabled(isDarkModeForced);
    }
    
    // === AJOUT : GESTION DES ERREURS HTTP (404, 500, etc.) ===
    panel.view.webContents.on("did-redirect-navigation", (event, url, isInPlace, isMainFrame) => {
        // Utile si le serveur redirige vers une page d'erreur spécifique
    });

    panel.view.webContents.on("did-navigate", (event, url, httpResponseCode, httpStatusText) => {
        // Si le code de réponse du serveur indique une erreur (ex: 404 Page introuvable, 503 Service indisponible)
        if (httpResponseCode >= 400) {

            console.log(`Erreur HTTP détectée [${httpResponseCode}]: ${httpStatusText}`);

//          const title = panel.view.webContents.getTitle();
//          addToHistory(url, title);
            addToHistory(url, panel.view.webContents.getTitle());
            const httpErrorHtml = `
                <!DOCTYPE html>
                <html>
                <body style="background:#1e1e1e; color:#f3f4f6; font-family:sans-serif; text-align:center; padding-top:100px;">
                    <div style="font-size:48px;">⚠️</div>
                    <h1 style="color:#ef4444;">Erreur ${httpResponseCode}</h1>
                    <p style="color:#9ca3af;">Le serveur a répondu : ${httpStatusText || 'Page introuvable ou indisponible'}</p>
                    <p style="font-family:monospace; background:#2d2d30; display:inline-block; padding:4px 8px; border-radius:4px; color:#facc15;">${url}</p>
                    <br><br>
                    <button style="background:#2563eb; color:white; border:none; padding:10px 20px; border-radius:6px; cursor:pointer;" onclick="window.location.reload()">Actualiser</button>
                </body>
                </html>
            `;
            panel.view.webContents.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(httpErrorHtml));
        } else {
            // === AJOUTEZ CES DEUX LIGNES POUR LES SITES NORMAUX ===
            const title = panel.view.webContents.getTitle();
            addToHistory(url, title);
        }
    });

    panel.view.webContents.on("focus", () => {
        activePanel = panel.id;
        
        // === CORRECTIF CRUCIAL B : Forcer la mise à jour géométrique à chaque clic dans la page ===
        if (win && !win.isDestroyed()) {
            win.webContents.send("active-panel-changed", { id: panel.id, bounds: panel.bounds });
            
            // Met également à jour l'état des en-têtes et des onglets de index.html
            win.webContents.send("panels-updated", collectPanels(rootNode), maximizedPanelId);
        }
        
        updateActiveBorder(panel.bounds);
        
        win.webContents.send("navigation-state-changed", {
            panelId: panel.id,
            canGoBack: panel.view.webContents.navigationHistory.canGoBack(),
            canGoForward: panel.view.webContents.navigationHistory.canGoForward()
        });
    });



    // ... vos écouteurs existants (before-input-event, did-navigate, focus, etc.) ...

    // === AJOUT : GESTION DES ERREURS RÉSEAU ===
    panel.view.webContents.on("did-fail-load", (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
        // On gère uniquement les erreurs du cadre principal, pas les pubs ou sous-éléments qui plantent
        if (!isMainFrame) return;

        // On ignore les annulations volontaires (ex: quand l'utilisateur clique sur "Annuler" ou change de page vite)
        if (errorDescription === "ERR_ABORTED") return;

        console.log(`Échec de chargement sur la tuile ${panel.id} [${errorCode}]: ${errorDescription} pour l'URL: ${validatedURL}`);

        // Génération d'une page d'erreur locale ultra-propre et stylisée au design de votre navigateur
        const errorHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <style>
                    body {
                        font-family: 'Segoe UI', system-ui, sans-serif;
                        background-color: #1e1e1e;
                        color: #f3f4f6;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        height: 100vh;
                        margin: 0;
                        padding: 20px;
                        box-sizing: border-box;
                        text-align: center;
                    }
                    .container { max-width: 500px; }
                    .icon { font-size: 48px; margin-bottom: 16px; }
                    h1 { font-size: 22px; margin-bottom: 8px; color: #f97316; font-weight: 600; }
                    p { font-size: 14px; color: #9ca3af; margin-bottom: 24px; line-height: 1.5; }
                    .url { font-family: monospace; background: #2d2d30; padding: 4px 8px; border-radius: 4px; color: #facc15; word-break: break-all; }
                    .btn-retry {
                        background-color: #2563eb;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        font-size: 14px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-weight: 500;
                        transition: background 0.2s;
                    }
                    .btn-retry:hover { background-color: #1d4ed8; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="icon">🌐</div>
                    <h1>Impossible d'accéder au site</h1>
                    <p>Une erreur réseau est survenue (<span style="color:#ef4444;">${errorDescription}</span>). Vérifiez votre connexion Internet ou l'adresse saisie.</p>
                    <p>Adresse ciblée : <br><span class="url">${validatedURL}</span></p>
                    <button class="btn-retry" onclick="window.location.reload()">Réessayer</button>
                </div>
            </body>
            </html>
        `;

        // On injecte le code HTML directement dans la BrowserView défaillante
        panel.view.webContents.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(errorHtml));
    });
}


/*
function layoutNode(node, x, y, width, height) {

    if (!node || width <= 0 || height <= 0) return;

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
*/

function layoutNode(node, x, y, width, height) {
    if (!node || width <= 0 || height <= 0) return;

    // SI UN PANNEAU EST MAXIMISÉ : On surcharge le comportement standard
    if (maximizedPanelId) {
        if (node.type === "panel") {
            if (node.id === maximizedPanelId) {
                // Le panneau maximisé prend TOUTE la place disponible
                node.bounds = { x, y, width, height };
                if (node.view && !node.view.webContents.isDestroyed()) {
                    node.view.setBounds({ x, y, width, height });
                }
            } else {
                // Les autres panneaux sont cachés en dehors de la fenêtre visible
                node.bounds = null;
                if (node.view && !node.view.webContents.isDestroyed()) {
                    node.view.setBounds({ x: -2000, y: -2000, width: 0, height: 0 });
                }
            }
            return;
        }
        // Si c'est un nœud de type split, on propage de manière invisible
        layoutNode(node.first, x, y, width, height);
        layoutNode(node.second, x, y, width, height);
        return;
    }

    // COMPORTEMENT STANDARD (Arbre de tuiles normal)
    if (node.type === "panel") {
        node.bounds = { x, y, width, height };
        if (node.view && !node.view.webContents.isDestroyed()) {
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


ipcMain.on("navigate", (event, panelId, input) => {

    const panel = findPanelNode(rootNode, panelId);

    if (!panel || !panel.view)
        return;

    panel.view.webContents.loadURL(
        buildNavigationTarget(input)
    );

});

// Écouteur pour intercepter le clic sur le bouton d'annulation de l'IHM
ipcMain.on("cancel-download", (event, panelId) => {
    const item = activeDownloads[panelId];
    if (item && !item.isDestroyed?.()) {
        console.log(`Téléchargement du panneau ${panelId} annulé manuellement.`);
        item.cancel();
    }
});


// Écouteur pour intercepter le clic sur la croix (X) de index.html
ipcMain.on("toggle-bookmarks-bar-request", () => {
    isBookmarksBarVisible = false;
    
    // On force la hauteur minimale (77px) pour faire remonter les fenêtres
    TOOLBAR_HEIGHT = TOOLBAR_MIN_HEIGHT; 
    
    // On prévient l'index.html de masquer la barre en CSS
    win.webContents.send("toggle-bookmarks-bar", false);
    
    // On force Electron à étirer les fenêtres vers le haut instantanément
    forceRebuildSplitters = true;
    resizeViews();
});

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


/*
ipcMain.on("close-panel", (event, panelId) => {
    const node = findPanelNode(rootNode, panelId);
    if (!node) return;
    const parent = findParentNode(rootNode, panelId);
    if (!parent) return;

    if (maximizedPanelId === panelId) maximizedPanelId = null; // Annule le zoom si détruit
    // (le reste de votre fonction close-panel reste identique...)

    
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
*/

ipcMain.on("close-panel", (event, panelId) => {
    // === VÉRIFICATION DU NOMBRE DE PANNEAUX RESTANTS ===
    const allViews = win.getBrowserViews();
    const realWebViews = allViews.filter(v => {
        if (!v.webContents || v.webContents.isDestroyed()) return false;
        const ua = v.webContents.getUserAgent();
        const url = v.webContents.getURL();
        return ua !== "InternalBorder" && !url.startsWith("data:text/html");
    });

    // Si l'utilisateur clique sur la croix alors qu'il n'y a plus qu'un panneau ouvert
    if (realWebViews.length <= 1) {
        app.quit(); // Déclenche la boîte de dialogue de confirmation de fermeture globale
        return;
    }

    // --- COMPORTEMENT STANDARD DE FERMETURE DE TUILE EN MOSAÏQUE ---
    const node = findPanelNode(rootNode, panelId);
    if (!node) return;
    const parent = findParentNode(rootNode, panelId);
    if (!parent) return;

    if (maximizedPanelId === panelId) maximizedPanelId = null; 
    
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


ipcMain.on("undo", (event) => {
    // 1. S'il n'y a pas d'historique ou si aucun panneau n'a été fermé, on annule
    if (history.length === 0 || !lastClosedPanel) return;

    // 2. On récupère la toute dernière structure d'arbre sauvegardée avant la fermeture
    const previousStateString = history.pop();
    const previousState = JSON.parse(previousStateString);

    // 3. On recrée une BrowserView toute neuve pour le panneau à restaurer
    const restoredView = new BrowserView();
    win.addBrowserView(restoredView);
    restoredView.webContents.loadURL(lastClosedPanel.url);

    // 4. On reconstruit l'arbre complet à partir du snapshot sauvegardé
    // Cette fonction utilitaire va ré-associer les BrowserViews existantes et injecter la nouvelle
    rootNode = rebuildTreeFromSnapshot(previousState, restoredView);

    // 5. On réactive le suivi de navigation pour le panneau restauré
    const restoredNode = findPanelNode(rootNode, lastClosedPanel.id);
    if (restoredNode) {
        setupNavigationTracking(restoredNode);
    }

    // 6. On applique le focus sur le panneau rouvert
    activePanel = lastClosedPanel.id;

    // 7. On nettoie la variable et on désactive le bouton dans l'IHM
    lastClosedPanel = null;
    win.webContents.send("undo-available", false);

    // 8. On force Electron à recalculer tout l'affichage géométrique
    forceRebuildSplitters = true;
    resizeViews();

    // 9. Mise à jour complète de la barre d'onglets HTML et du rectangle de focus
    win.webContents.send("panels-updated", collectPanels(rootNode));
    if (restoredNode && restoredNode.bounds) {
        win.webContents.send("active-panel-changed", { id: restoredNode.id, bounds: restoredNode.bounds });
        updateActiveBorder(restoredNode.bounds);
    }
});




// ====== À METTRE DANS MAIN.JS (AVEC LES AUTRES ÉCOUTEURS IPCMAIN) ======

// ====== LOGIQUE DE LA FENÊTRE D'HISTORIQUE CORRIGÉE ======
let historyWindow = null; 

ipcMain.on("open-history-window", () => {
    if (historyWindow && !historyWindow.isDestroyed()) {
        historyWindow.focus();
        return;
    }

    historyWindow = new BrowserWindow({
        width: 450,
        height: 600,
        title: "Historique de navigation",
        backgroundColor: "#1e1e1e",
        autoHideMenuBar: true,
        alwaysOnTop: true,
        webPreferences: {
            nodeIntegration: true, 
            contextIsolation: false 
        }
    });

     // Fonction interne pour reconstruire le HTML de la fenêtre d'historique
    function generateHistoryHtml() {
        const historyList = getNavigationHistory();
        
        // 1. Génération de la liste des éléments
        const itemsHtml = historyList.map((item, index) => `
            <div class="history-item">
                <div class="content" onclick="require('electron').ipcRenderer.send('history-click', '${item.url}')">
                    <div class="title">${item.title || item.url}</div>
                    <div class="url">${item.url}</div>
                </div>
                <!-- Bouton de suppression unique -->
                <div class="delete-btn" onclick="require('electron').ipcRenderer.send('delete-single-history', ${index})">✖</div>
            </div>
        `).join("");

        // 2. Génération dynamique du bouton "Effacer tout" ou vide
        const clearButtonHtml = historyList.length > 0 
            ? '<button class="clear-all-btn" onclick="require(\'electron\').ipcRenderer.send(\'clear-all-history\')">Effacer tout</button>' 
            : '';

        // 3. Génération dynamique du contenu principal (liste ou message vide)
        const contentHtml = historyList.length === 0 
            ? '<div id="empty">Aucun historique disponible.</div>' 
            : itemsHtml;

        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <style>
                    body { font-family: 'Segoe UI', sans-serif; background: #1e1e1e; color: #cfcfcf; margin: 0; padding: 12px; }
                    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #3c3c3c; padding-bottom: 8px; margin-bottom: 12px; }
                    h2 { color: white; margin: 0; font-size: 16px; }
                    .clear-all-btn { background: #991b1b; color: #fca5a5; border: none; font-size: 11px; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-weight: bold; }
                    .clear-all-btn:hover { background: #b91c1c; }
                    .history-item { display: flex; justify-content: space-between; align-items: center; padding: 8px; border-bottom: 1px solid #2d2d30; transition: background 0.2s; }
                    .history-item:hover { background: #2d2d30; }
                    .content { flex: 1; cursor: pointer; overflow: hidden; }
                    .title { font-size: 13px; font-weight: bold; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #ffffff; }
                    .url { font-size: 11px; color: #6b7280; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 2px; }
                    .delete-btn { color: #6b7280; cursor: pointer; padding: 4px 8px; font-size: 12px; transition: color 0.2s; }
                    .delete-btn:hover { color: #ef4444; }
                    #empty { color: #6b7280; font-size: 12px; text-align: center; margin-top: 40px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h2>🕒 Historique de navigation</h2>
                    ${clearButtonHtml}
                </div>
                <div id="history-container">
                    ${contentHtml}
                </div>
            </body>
            </html>
        `;
    }

    historyWindow.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(generateHistoryHtml()));

    // Écouteur pour rafraîchir la fenêtre d'historique en temps réel
    const refreshListener = () => {
        if (historyWindow && !historyWindow.isDestroyed()) {
            historyWindow.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(generateHistoryHtml()));
        }
    };
    ipcMain.on('history-data-changed', refreshListener);

    historyWindow.on("closed", () => {
        ipcMain.removeListener('history-data-changed', refreshListener);
        historyWindow = null;
    });
});

// ====== ENREGISTREMENT DES ACTIONS DE SUPPRESSION (À METTRE À LA SUITE DANS MAIN.JS) ======

// 1. Supprimer un seul élément
ipcMain.on('delete-single-history', (event, index) => {
    let historyList = getNavigationHistory();
    if (index >= 0 && index < historyList.length) {
        historyList.splice(index, 1);
        fs.writeFileSync(historyPath, JSON.stringify(historyList, null, 2));
        
        // On notifie la fenêtre d'historique et la fenêtre principale pour mettre à jour l'affichage
        ipcMain.emit('history-data-changed');
        if (win && !win.isDestroyed()) win.webContents.send('history-updated', historyList);
    }
});

// 2. Tout effacer d'un coup
ipcMain.on('clear-all-history', () => {
    fs.writeFileSync(historyPath, JSON.stringify([]));
    ipcMain.emit('history-data-changed');
    if (win && !win.isDestroyed()) win.webContents.send('history-updated', []);
});

// Écouteur pour charger le site quand on clique sur un lien de l'historique
ipcMain.on("history-click", (event, url) => {
    if (activePanel) {
        const panel = findPanelNode(rootNode, activePanel);
        if (panel && panel.view) {
            panel.view.webContents.loadURL(url);
            // Optionnel : fermer la fenêtre d'historique après le clic
            if (historyWindow && !historyWindow.isDestroyed()) {
                historyWindow.close();
            }
        }
    }
});

// ====== GESTION DU MODE SOMBRE À LA DEMANDE (VERSION CHROMIUM NATIVE) ======
// ====== GESTION DU MODE SOMBRE À LA DEMANDE (SESSION IMMERSIVE) ======
// ====== GESTION DU MODE SOMBRE À LA DEMANDE (AVEC RAFRAÎCHISSEMENT IMPOSÉ) ======
// ====== GESTION DU MODE SOMBRE À LA DEMANDE (INJECTION AVANCÉE) ======
let isDarkModeForced = false;

ipcMain.on('toggle-dark-mode-request', (event, enable) => {
    isDarkModeForced = enable;
    
    const { nativeTheme } = require('electron');
    nativeTheme.themeSource = isDarkModeForced ? 'dark' : 'light';

    const allViews = win.getBrowserViews();
    allViews.forEach(v => {
        if (!v.webContents || v.webContents.isDestroyed()) return;
        const url = v.webContents.getURL();
        if (url.startsWith('data:text/html') || v.webContents.getUserAgent() === "InternalBorder") return;

        // 1. Tente d'activer le mode natif s'il est supporté
        if (typeof v.webContents.setForceDarkModeEnabled === 'function') {
            v.webContents.setForceDarkModeEnabled(isDarkModeForced);
        }

        // 2. On force la page à se rafraîchir pour exécuter notre script injecté ci-dessous
        v.webContents.reloadIgnoringCache();
    });
});

// Script d'injection magique : s'exécute AVANT que Wikipédia ne calcule ses styles
app.on('web-contents-created', (event, webContents) => {
    // On injecte le code dès que le DOM commence à exister
    webContents.on('dom-ready', () => {
        if (!isDarkModeForced || !win || win.isDestroyed()) return;

        const url = webContents.getURL();
        if (url.startsWith('data:text/html')) return;

        // SCRIPT SPÉCIFIQUE WIKIPÉDIA & SITES MODERNES
        // Il ajoute les classes "mw-theme-client-dark" et force les balises HTML globales
        const scriptToInject = `
            (function() {
                // 1. Force la classe CSS native de Wikipédia pour le mode sombre
                document.documentElement.classList.add('mw-theme-client-dark');
                if (document.body) document.body.classList.add('mw-theme-client-dark');
                
                // 2. Pour les autres sites (comme Google), on applique un filtre CSS inversé 
                // mais BEAUCOUP PLUS PROPRE qui cible uniquement les fonds de page sans détruire le reste
                if (!window.location.hostname.includes('wikipedia.org')) {
                    const style = document.createElement('style');
                    style.id = 'hare-dark-fallback';
                    style.innerHTML = \`
                        html, body { background-color: #121212 !important; color: #e0e0e0 !important; }
                        a { color: #8ab4f8 !important; }
                    \`;
                    document.head.appendChild(style);
                }
            })();
        `;

        webContents.executeJavaScript(scriptToInject).catch(e => console.error("Erreur injection sombre:", e));
    });
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

    // Tout à la fin de la fonction createDefaultLayout() :
    collectPanelNodes(rootNode).forEach((panel) => {
        setupNavigationTracking(panel); // <-- C'est cet appel qui va injecter l'intercepteur de zoom
    });



}


function createWindow() {

/*    
    win = new BrowserWindow({
        width: 1600, height: 900,
        minWidth: 1000, minHeight: 700,
        backgroundColor: "#252526", // <-- Remplacer #111827 par #252526 (fond sombre identique aux barres)
        title: APP_TITLE,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false
        }
    });
*/
    win = new BrowserWindow({
        width: 1600, height: 900,
        minWidth: 1000, minHeight: 700,
        backgroundColor: "#252526",
        title: APP_TITLE,
        // === CONFIGURATION BARRE IMMERSIVE FRAMELESS ===
        frame: false,
        titleBarStyle: 'hidden',
        titleBarOverlay: {
            color: '#252526',       // Couleur de fond de la zone des boutons système (identique à votre toolbar)
            symbolColor: '#cfcfcf', // Couleur des icônes de contrôle (Réduire/Agrandir/Fermer)
            height: 38              // S'aligne parfaitement sur la hauteur de votre #toolbar-buttons (38px)
        },
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    // Configure le thème par défaut au démarrage de l'application
    const { nativeTheme } = require('electron');
    nativeTheme.themeSource = 'light'; // Démarre en mode clair par défaut


    win.setMaxListeners(30);

    // === APPLIQUER LE GESTIONNAIRE DE TÉLÉCHARGEMENT ===
    registerDownloadHandler(win.webContents.session);

    process.on("warning", (warning) => {
        console.log("WARNING NAME:", warning.name);
        console.log("WARNING MESSAGE:", warning.message);
        console.log("WARNING STACK:", warning.stack);
    });

    createDefaultLayout();

//  win.setMenu(null);
    // Configuration des raccourcis clavier via un menu invisible
    const { Menu } = require('electron');
    const template = [
        {
            label: 'Navigation',
            submenu: [
                {
                    label: 'Scinder verticalement',
                    accelerator: 'CmdOrCtrl+T',
                    click: () => {
                        if (activePanel) {
                            // On simule exactement l'action de l'IpcMain split-panel
                            ipcMain.emit('split-panel', null, activePanel, 'vertical');
                        }
                    }
                },
                {
                    label: 'Scinder horizontalement',
                    accelerator: 'CmdOrCtrl+H',
                    click: () => {
                        if (activePanel) {
                            ipcMain.emit('split-panel', null, activePanel, 'horizontal');
                        }
                    }
                },
                {
                    label: 'Fermer la tuile active',
                    accelerator: 'CmdOrCtrl+W',
                    click: () => {
                        if (activePanel) {
                            // On s'assure qu'il reste plus d'un panneau avant de fermer, 
                            // ou on laisse close-panel gérer selon votre logique existante
                            ipcMain.emit('close-panel', null, activePanel);
                        }
                    }
                },

                // === AJOUT : RACCOURCI CTRL+M POUR MAXIMISER/RESTAURER LA TUILE ACTIVE ===
                {
                    label: 'Maximiser / Restaurer la tuile active',
                    accelerator: 'CmdOrCtrl+M',
                    click: () => {
                        if (activePanel) {
                            // Si le panneau est déjà maximisé, on l'annule. Sinon, on le maximise.
                            if (maximizedPanelId === activePanel) {
                                maximizedPanelId = null;
                            } else {
                                maximizedPanelId = activePanel;
                            }

                            // 1. Force le recalcul géométrique complet des vues
                            forceRebuildSplitters = true;
                            resizeViews();

                            // 2. Notifie instantanément l'IHM HTML pour masquer/afficher les barres d'URL
                            win.webContents.send("zoom-changed", maximizedPanelId);

                            // 3. Recrée proprement la poignée flottante pour mettre à jour son icône (🗖 ou 🗗)
                            if (handleViews[activePanel]) {
                                try { win.removeBrowserView(handleViews[activePanel]); } catch(e){}
                                delete handleViews[activePanel];
                            }
                            updatePanelHandles();
                        }
                    }
                },


                // === AJOUT : TOUCHE ÉCHAP POUR QUITTER LE MODE MAXIMISÉ ===
                {
                    label: 'Quitter le mode agrandi',
                    accelerator: 'Escape',
                    click: () => {
                        // On n'agit que si un panneau est actuellement maximisé
                        if (maximizedPanelId) {
                            const panelIdToRestore = maximizedPanelId;
                            maximizedPanelId = null; // Désactive le zoom

                            // 1. Force le recalcul géométrique complet des vues pour afficher la mosaïque
                            forceRebuildSplitters = true;
                            resizeViews();

                            // 2. Notifie l'IHM HTML pour réafficher toutes les barres d'URL
                            win.webContents.send("zoom-changed", maximizedPanelId);

                            // 3. Recrée la poignée flottante du panneau pour remettre son icône à jour (🗖)
                            if (handleViews[panelIdToRestore]) {
                                try { win.removeBrowserView(handleViews[panelIdToRestore]); } catch(e){}
                                delete handleViews[panelIdToRestore];
                            }
                            updatePanelHandles();
                        }
                    }
                },



                // (Vos raccourcis précédents : Scinder, Fermer, Annuler...)
                {
                    label: 'Annuler la fermeture',
                    accelerator: 'CmdOrCtrl+Z',
                    click: () => {
                        ipcMain.emit('undo', null);
                    }
                },
                // === RÉINSTALLATION : RACCOURCIS D'HISTORIQUE DE NAVIGATION ===
                {
                    label: 'Page précédente',
                    accelerator: 'Alt+Left',
                    click: () => {
                        if (activePanel) {
                            const panel = findPanelNode(rootNode, activePanel);
                            if (panel && panel.view && panel.view.webContents.navigationHistory.canGoBack()) {
                                panel.view.webContents.navigationHistory.goBack();
                                updateNavigationButtons(); // Met à jour l'état visuel des boutons ← →
                            }
                        }
                    }
                },
                {
                    label: 'Page suivante',
                    accelerator: 'Alt+Right',
                    click: () => {
                        if (activePanel) {
                            const panel = findPanelNode(rootNode, activePanel);
                            if (panel && panel.view && panel.view.webContents.navigationHistory.canGoForward()) {
                                panel.view.webContents.navigationHistory.goForward();
                                updateNavigationButtons();
                            }
                        }
                    }
                },

                // (Vos raccourcis précédents : Scinder, Fermer, Précédent, Suivant, Ctrl+L...)
                {
                    label: 'Cibler la barre d\'adresse',
                    accelerator: 'CmdOrCtrl+L',
                    click: () => {
                        if (activePanel) {
                            win.webContents.focus(); 
                            win.webContents.send('focus-url-bar', activePanel);
                        }
                    }
                },



                // === AJOUT : NAVIGATION ENTRE LES TUILES AVEC CTRL+TAB / CTRL+SHIFT+TAB ===
                {
                    label: 'Tuile suivante',
                    accelerator: 'Ctrl+Tab',
                    click: () => {
                        const panelsList = collectPanelNodes(rootNode);
                        if (panelsList.length <= 1) return;

                        // Trouve l'index de la tuile actuellement active
                        const currentIndex = panelsList.findIndex(p => p.id === activePanel);
                        // Calcule l'index suivant (boucle au début si on est à la fin)
                        const nextIndex = (currentIndex + 1) % panelsList.length;
                        const nextPanel = panelsList[nextIndex];

                        if (nextPanel) {
                            // Active le panneau et met à jour l'IHM + la bordure bleue
                            activePanel = nextPanel.id;
                            win.webContents.send("active-panel-changed", { id: nextPanel.id, bounds: nextPanel.bounds });
                            updateActiveBorder(nextPanel.bounds);
                            if (nextPanel.view) nextPanel.view.webContents.focus();
                        }
                    }
                },
                {
                    label: 'Tuile précédente',
                    accelerator: 'Ctrl+Shift+Tab',
                    click: () => {
                        const panelsList = collectPanelNodes(rootNode);
                        if (panelsList.length <= 1) return;

                        const currentIndex = panelsList.findIndex(p => p.id === activePanel);
                        // Calcule l'index précédent (boucle à la fin si on est au début)
                        const prevIndex = (currentIndex - 1 + panelsList.length) % panelsList.length;
                        const prevPanel = panelsList[prevIndex];

                        if (prevPanel) {
                            activePanel = prevPanel.id;
                            win.webContents.send("active-panel-changed", { id: prevPanel.id, bounds: prevPanel.bounds });
                            updateActiveBorder(prevPanel.bounds);
                            if (prevPanel.view) prevPanel.view.webContents.focus();
                        }
                    }
                },

                // === AJOUT : RÉORGANISATION DES TUILES AU CLAVIER (ALT + SHIFT + FLÈCHES) ===
                {
                    label: 'Intervertir avec la tuile à gauche',
                    accelerator: 'Alt+Shift+Left',
                    click: () => moveActivePanelKeyboard('Left')
                },
                {
                    label: 'Intervertir avec la tuile à droite',
                    accelerator: 'Alt+Shift+Right',
                    click: () => moveActivePanelKeyboard('Right')
                },
                {
                    label: 'Intervertir avec la tuile au-dessus',
                    accelerator: 'Alt+Shift+Up',
                    click: () => moveActivePanelKeyboard('Up')
                },
                {
                    label: 'Intervertir avec la tuile en dessous',
                    accelerator: 'Alt+Shift+Down',
                    click: () => moveActivePanelKeyboard('Down')
                },



                // === RACCOURCI AVEC FENÊTRE DE VALIDATION (CTRL+Q) ===
                {
                    label: 'Quitter l\'application',
                    accelerator: 'CmdOrCtrl+Q',
                    click: () => {
                        const response = dialog.showMessageBoxSync(win, {
                            type: 'question',
                            buttons: ['Oui, quitter', 'Annuler'],
                            defaultId: 1,
                            cancelId: 1,
                            title: 'Confirmation',
                            message: `Êtes-vous sûr de vouloir fermer ${APP_TITLE} ?`, // === DYNAMIQUE ICI ===
                            detail: 'Tous vos panneaux et onglets ouverts seront perdus.'
                        });
                        if (response === 0) {
                            app.exit(0); 
                        }
                    }
                },

                // === AJOUT : RACCOURCI CTRL+SHIFT+B POUR MASQUER/AFFICHER LA BARRE DE FAVORIS ===
                {
                    label: 'Masquer/Afficher la barre de favoris',
                    accelerator: 'CmdOrCtrl+Shift+B',
                    click: () => {
                        if (!win || win.isDestroyed()) return;

                        // 1. On inverse l'état de visibilité
                        isBookmarksBarVisible = !isBookmarksBarVisible;
                        
                        // 2. On ajuste dynamiquement la hauteur de la zone d'outils
                        TOOLBAR_HEIGHT = isBookmarksBarVisible ? 105 : TOOLBAR_MIN_HEIGHT;

                        // 3. On informe l'IHM (index.html) pour masquer la barre physiquement en CSS
                        win.webContents.send("toggle-bookmarks-bar", isBookmarksBarVisible);

                        // 4. On force le redimensionnement immédiat des tuiles web au pixel près
                        forceRebuildSplitters = true;
                        resizeViews();
                    }
                },


                // À mettre dans votre tableau 'template' des menus dans main.js
                {
                    label: 'Afficher l\'historique',
                    accelerator: 'CmdOrCtrl+H',
                    click: () => {
                        // Envoie une demande à index.html pour exécuter toggleHistorySidebar()
                        win.webContents.send('focus-url-bar', activePanel); // astuce pour redonner le focus à l'IHM
                        win.webContents.executeJavaScript("toggleHistorySidebar()");
                    }
                },



                // === AJOUT : RACCOURCIS D'ACTUALISATION (F5 & CTRL+R) ===
                {
                    label: 'Actualiser la page (F5)',
                    accelerator: 'F5',
                    click: () => {
                        if (activePanel) {
                            const panel = findPanelNode(rootNode, activePanel);
                            if (panel && panel.view) {
                                panel.view.webContents.reload();
                            }
                        }
                    }
                },

                {
                    label: 'Actualiser la page (Ctrl+R)',
                    accelerator: 'CmdOrCtrl+R',
                    click: () => {
                        if (activePanel) {
                            const panel = findPanelNode(rootNode, activePanel);
                            if (panel && panel.view) {
                                panel.view.webContents.reload();
                            }
                        }
                    }
                }



            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    win.setMenu(menu);
    
    // === CORRECTIF VISUEL TOTAL ===
    win.setAutoHideMenuBar(true);
    win.setMenuBarVisibility(false); // Supprime définitivement la ligne vide sous Windows

    win.loadFile('index.html');

    forceRebuildSplitters = true;
    resizeViews();

    win.webContents.on('did-finish-load', () => {

        const url = win.webContents.getURL();
        const title = win.webContents.getTitle();
        addToHistory(url, title);

        win.webContents.send("panels-updated", collectPanels(rootNode));

        win.webContents.send("app-title-changed", APP_TITLE);
        win.setTitle(APP_TITLE);
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

    // Intercepte le clic sur la croix de fermeture de la fenêtre
    win.on('close', (e) => {
        // Empêche la fermeture immédiate
        e.preventDefault();

        const response = dialog.showMessageBoxSync(win, {
            type: 'question',
            buttons: ['Oui, quitter', 'Annuler'],
            defaultId: 1, // Met le focus initial sur "Annuler"
            cancelId: 1,  // === ENTRAÎNE QUE L'APPUI SUR ÉCHAP RENVOIE L'INDEX 1 (ANNULER) ===
            title: 'Confirmation',
            message: 'Êtes-vous sûr de vouloir fermer Tile Browser ?',
            detail: 'Tous vos panneaux et onglets ouverts seront perdus.'
        });

        // Seul l'index 0 ("Oui, quitter") détruit la fenêtre
        if (response === 0) {
            win.destroy(); 
        }
        // Si response === 1 (Annuler ou Échap), on ne fait rien, l'application reste ouverte !
    });


        // === ENREGISTREMENT DU RACCOURCI FORCE CTRL+M ===
    // 'CommandOrControl+M' est intercepté lorsque la fenêtre a le focus
    win.on('focus', () => {
        globalShortcut.register('CommandOrControl+M', () => {
            if (!win || win.isDestroyed() || !activePanel) return;

            // Logique de bascule de zoom identique
            if (maximizedPanelId === activePanel) {
                maximizedPanelId = null;
            } else {
                maximizedPanelId = activePanel;
            }

            forceRebuildSplitters = true;
            resizeViews();

            win.webContents.send("zoom-changed", maximizedPanelId);

            if (handleViews[activePanel]) {
                try { win.removeBrowserView(handleViews[activePanel]); } catch(e){}
                delete handleViews[activePanel];
            }
            updatePanelHandles();
        });
    });

    // Très important : Libérer le raccourci quand la fenêtre perd le focus 
    // pour éviter de bloquer le Ctrl+M des autres applications de votre PC
    win.on('blur', () => {
        globalShortcut.unregister('CommandOrControl+M');
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
function detachPanelToFullscreen(panelId) {
    const node = findPanelNode(rootNode, panelId);
    if (!node || !node.view) return;

    // 1. Sauvegarder l'URL actuelle du calque avant détachement
    const currentUrl = node.view.webContents.getURL();

    // 2. Créer une nouvelle fenêtre indépendante
    const fullscreenWin = new BrowserWindow({
        width: 1280,
        height: 720,
        backgroundColor: "#111827",
        autoHideMenuBar: true // Masque la barre de menu supérieure
    });

    // 3. Maximiser immédiatement la nouvelle fenêtre
    fullscreenWin.maximize();

    // 4. Décrocher la BrowserView de la fenêtre principale et l'attacher à la nouvelle
    try {
        win.removeBrowserView(node.view);
        fullscreenWin.setBrowserView(node.view);
        
        // Ajuster la vue pour qu'elle prenne 100% de la nouvelle fenêtre
        const fsBounds = fullscreenWin.getContentBounds();
        node.view.setBounds({ x: 0, y: 0, width: fsBounds.width, height: fsBounds.height });
        node.view.setAutoResize({ width: true, height: true });
        
        // Redonner le focus à la page web
        node.view.webContents.focus();
    } catch (err) {
        console.error("Erreur lors du transfert de calque :", err);
    }

    // 5. Gérer le redimensionnement de la nouvelle fenêtre indépendante
    fullscreenWin.on("resize", () => {
        if (fullscreenWin.isDestroyed()) return;
        const fsBounds = fullscreenWin.getContentBounds();
        try { node.view.setBounds({ x: 0, y: 0, width: fsBounds.width, height: fsBounds.height }); } catch(e) {}
    });

    // Nettoyer la vue si l'utilisateur ferme la fenêtre plein écran
    fullscreenWin.on("closed", () => {
        // Optionnel : vous pouvez détruire la vue ici si nécessaire
    });

    // 6. Fermer le panneau désormais vide dans la fenêtre principale du Tile Browser
    // On simule l'action du bouton Fermer pour ré-agencer l'arbre proprementresizeViews(
    const parent = findParentNode(rootNode, panelId);
    if (parent) {
        saveState();
        const sibling = (parent.first === node) ? parent.second : parent.first;

        if (parent === rootNode) {
            rootNode = sibling;
        } else {
            replaceNode(rootNode, parent, sibling);
        }

        // Supprimer définitivement sa poignée graphique
        try { win.removeBrowserView(handleViews[panelId]); } catch(e) {}
        delete handleViews[panelId];

        const newActivePanel = findFirstPanel(sibling);
        activePanel = newActivePanel.id;

        win.webContents.send("active-panel-changed", { id: newActivePanel.id, bounds: newActivePanel.bounds });        
        forceRebuildSplitters = true;
        resizeViews();
        win.webContents.send("panels-updated", collectPanels(rootNode));
    }
}



function resizeViews() {
    if (win.isDestroyed()) return;
    
    // 1. Récupérer la taille réelle de la zone de contenu utile d'Electron
    const bounds = win.getContentBounds();
    const width = bounds.width;
    const height = bounds.height;
    
    splitters.length = 0;

    // === AJOUT : Si un panneau est maximisé, on force la disparition des splitters ===
    if (maximizedPanelId) {
        forceRebuildSplitters = true;
    }

    if (forceRebuildSplitters) {
        splitterViews.forEach((v) => { try { win.removeBrowserView(v); } catch(e) {} });
        splitterViews = [];
        forceRebuildSplitters = false;
    }

    // === CORRECTIF : Réduit la hauteur pour empêcher le débordement en bas ===
    const HEIGHT_PADDING = 6; 
    // === CORRECTIF FINAL : Marge de 2px pour remonter le liseré ===
    // === CORRECTIF FINAL : Marge de 2px pour remonter le liseré ===
    const BOTTOM_MARGIN = 2;
    layoutNode(rootNode, 0, TOOLBAR_HEIGHT, width, height - TOOLBAR_HEIGHT - BOTTOM_MARGIN);



 
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

//          if (title === "drag-end") { win.setTitle("Tile Browser"); dragInProgress = false; return; }
            if (title === "drag-end") { 
                win.setTitle(APP_TITLE); // === REMPLACEZ "Tile Browser" PAR APP_TITLE ICI ===
                dragInProgress = false; 
                return; 
            }




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




    /*
        // 4. Mettre à jour la position des liserés bleus (Placé tout à la fin de resizeViews)
        if (activePanel) {
            const activeNode = findPanelNode(rootNode, activePanel);
            if (activeNode && activeNode.bounds) {
                updateActiveBorder(activeNode.bounds);
                
                // OPTIMISATION : On remonte également la poignée du panneau actif pour qu'elle reste accessible
                if (handleViews[activePanel]) {
                    try { win.setTopBrowserView(handleViews[activePanel]); } catch(e) {}
                }
            }
        } else {
            borderViews.forEach(bView => {
                if (bView && !bView.webContents.isDestroyed()) {
                    bView.setBounds({ x: -100, y: -100, width: 0, height: 0 });
                }
            });
        }
    */

    // 4. Mettre à jour la position des liserés bleus (Placé tout à la fin de resizeViews)
    if (activePanel) {
        const activeNode = findPanelNode(rootNode, activePanel);
        if (activeNode) {
            let targetBounds = null;

            // === CORRECTION : Si l'application est en mode maximisé/zoom ===
            if (maximizedPanelId) {
                if (activePanel === maximizedPanelId) {
                    // On récupère la taille utile complète de la fenêtre Electron (sous la barre d'outils)
                    const bounds = win.getContentBounds();
                    targetBounds = {
                        x: 0,
                        y: TOOLBAR_HEIGHT,
                        width: bounds.width,
                        height: bounds.height - TOOLBAR_HEIGHT
                    };
                }
            } else if (activeNode.bounds) {
                // Comportement mosaïque standard
                targetBounds = activeNode.bounds;
            }

            if (targetBounds) {
                updateActiveBorder(targetBounds);
                
                // OPTIMISATION : On remonte également la poignée du panneau actif pour qu'elle reste accessible
                if (handleViews[activePanel]) {
                    try { win.setTopBrowserView(handleViews[activePanel]); } catch(e) {}
                }
            } else {
                // Cache les liserés si le panneau actif fait partie des panneaux masqués
                borderViews.forEach(bView => {
                    if (bView && !bView.webContents.isDestroyed()) {
                        bView.setBounds({ x: -100, y: -100, width: 0, height: 0 });
                    }
                });
            }
        }
    } else {
        borderViews.forEach(bView => {
            if (bView && !bView.webContents.isDestroyed()) {
                bView.setBounds({ x: -100, y: -100, width: 0, height: 0 });
            }
        });
    }


    // === On force le rafraîchissement des poignées de déplacement ===
    updatePanelHandles();
    win.webContents.send("splitters-updated", splitters);
    
    // === SÉCURITÉ : On renvoie l'état du zoom ici aussi ===
    win.webContents.send("zoom-changed", maximizedPanelId); 
}


function moveActivePanelKeyboard(direction) {
    if (!activePanel || maximizedPanelId) return; // Désactivé si un panneau est zoomé

    const panelsList = collectPanelNodes(rootNode);
    const activeNode = findPanelNode(rootNode, activePanel);
    
    if (!activeNode || !activeNode.bounds) return;

    // Recherche de la tuile voisine dans la direction demandée
    const targetPanel = findNeighborPanel(activeNode.bounds, direction, panelsList);

    if (targetPanel) {
        // Utilise votre fonction atomique existante pour intervertir les places dans l'arbre
        swapPanelsInTree(activePanel, targetPanel.id);
    }
}


ipcMain.on("toggle-bookmarks-bar-request", () => {
    isBookmarksBarVisible = false;
    TOOLBAR_HEIGHT = TOOLBAR_MIN_HEIGHT;
    win.webContents.send("toggle-bookmarks-bar", false);
    forceRebuildSplitters = true;
    resizeViews();
});


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


// Écouteurs IPC pour que l'interface graphique puisse interagir avec les favoris
ipcMain.handle('get-favoris', () => {
    return getFavoris();
});

// ====== AVEC LES AUTRES IPCMAIN (EX: SOUS LES ÉCOUTEURS DE FAVORIS) ======
ipcMain.handle('get-history', () => {
    return getNavigationHistory();
});


ipcMain.handle('clear-history', () => {
    fs.writeFileSync(historyPath, JSON.stringify([]));
    if (win && !win.isDestroyed()) {
        win.webContents.send('history-updated', []);
    }
    return true;
});

// À placer avec vos autres ipcMain.handle (...)
ipcMain.handle('delete-history-item', async (event, index) => {
    try {
        let historyList = getNavigationHistory();
        if (index >= 0 && index < historyList.length) {
            historyList.splice(index, 1); // Supprime l'élément ciblé
            fs.writeFileSync(historyPath, JSON.stringify(historyList, null, 2));
            
            // Notifie la fenêtre principale
            if (win && !win.isDestroyed()) {
                win.webContents.send('history-updated', historyList);
            }
        }
        return historyList; // Renvoie la liste mise à jour à l'IHM
    } catch (e) {
        console.error("Erreur lors de la suppression d'un élément d'historique :", e);
        return getNavigationHistory();
    }
});



ipcMain.handle('toggle-favori', (event, { url, title }) => {
    let favoris = getFavoris();
    const index = favoris.findIndex(f => f.url === url);

    if (index >= 0) {
        // Si le site est déjà en favori, on le retire
        favoris.splice(index, 1);
        console.log(`Retiré des favoris : ${url}`);
    } else {
        // Sinon, on l'ajoute
        favoris.push({ url, title: title || url });
        console.log(`Ajouté aux favoris : ${url}`);
    }

    fs.writeFileSync(favorisPath, JSON.stringify(favoris, null, 2));
    
    // On renvoie la nouvelle liste et l'état mis à jour à l'IHM
    win.webContents.send('favoris-updated', favoris);
    return index < 0; // Renvoie true si ajouté, false si retiré
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

app.on('will-quit', () => {
    // Désactive absolument tous les raccourcis globaux propres à l'application
    globalShortcut.unregisterAll();
});

app.whenReady().then(createWindow);

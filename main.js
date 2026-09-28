// ---------------- //
// SCRIPT : main.js //
// ---------------- //

// Tout en haut de votre fichier main.js
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // Évite les blocages de certificats locaux

// DANS MAIN.JS -> Tout en haut du fichier (après les constantes et imports)
const {
    app,
    BrowserWindow,
    BrowserView,
    ipcMain,
    Menu,
    nativeImage,
    nativeTheme,
    dialog,
    globalShortcut,
    shell,
    safeStorage // <-- Assurez-vous que safeStorage est bien présent dans vos imports Electron
} = require('electron');

// === CORRECTIF ALERTE SECURITE WINDOWS ===
// Force Electron à utiliser une clé de chiffrement alternative interne au lieu de solliciter 
// l'API de protection Windows (DPAPI) qui génère l'invite d'identité bloquante en développement.
if (typeof safeStorage.setUseAlternativeEncryption === 'function') {
    safeStorage.setUseAlternativeEncryption(true);
}


// En haut de main.js avec vos autres variables globales
const APP_TITLE = "Hare Browser"; 

// Dans main.js -> Tout en haut
const fs = require('fs');
const fsPromises = require("fs").promises;
const path = require('path');

const appDataPath = app.getPath('userData');
if (!fs.existsSync(appDataPath)) {
    fs.mkdirSync(appDataPath, { recursive: true });
}


const splitters = [];

// DANS MAIN.JS -> Tout en haut du fichier avec vos variables de chemins :

// REMPLACEZ : const historyPath = path.join(__dirname, 'navigation_history.json');
// PAR CE CHEMIN SÉCURISÉ (Dans AppData comme vos favoris) :
const historyPath = path.join(app.getPath('userData'), 'navigation_history.json');


// Chemin vers le fichier de stockage des favoris
const favorisPath = path.join(app.getPath('userData'), 'favoris.json');

const themePath = path.join(app.getPath('userData'), 'theme.json');

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

//let TOOLBAR_HEIGHT = 77;
//const TOOLBAR_MIN_HEIGHT = 77;
let TOOLBAR_HEIGHT = 76; // 64
const TOOLBAR_MIN_HEIGHT = 77;

let history = [];
let lastClosedPanel = null;

const SPLITTER_SIZE = 10;

let leftView, centerView, rightView;
let isDarkModeForced = false;

let isAiSidebarVisible = false; // Par défaut, le volet est fermé


const https = require("https");



// DANS MAIN.JS -> GESTION ET AFFICHAGE DE LA POPUP NATIVE DE MOTS DE PASSE
let pwdWindow = null;

function updatePasswordWindowContent() {
    if (pwdWindow && !pwdWindow.isDestroyed()) {
        const passwordList = getStoredPasswords();
        pwdWindow.webContents.send('render-passwords', {
            list: passwordList,
            isDarkMode: isDarkModeForced
        });
    }
}



// DANS MAIN.JS -> Remplacez la fonction afficherMenuContextuelPanneau par celle-ci :

function afficherMenuContextuelPanneau(webContents, x, y) {
    const panel = findPanelByWebContents(webContents);
    const panelId = panel ? panel.id : activePanel;
    if (!panelId) return;

    const targetPanel = findPanelNode(rootNode, panelId);
    const isPrivate = targetPanel ? targetPanel.isPrivate : false;

    // NOUVEAU : Détecter si le mode zoom/maximisé est actif sur le navigateur
    const isZoomActive = maximizedPanelId !== null;

    const menuTemplate = [
        {
            label: `✨ Actions IA (Assistant)`,
            enabled: false
        },
        {
            label: "   📝 Résumer cette tuile web",
            click: () => {
                if (win && !win.isDestroyed()) {
                    if (!isAiSidebarVisible) ipcMain.emit("toggle-ai-sidebar-request", null, true);
                    win.webContents.send("trigger-ai-action", { action: "resume" });
                }
            }
        },
        {
            label: "   🔍 Analyser les mots-clés de la page",
            click: () => {
                if (win && !win.isDestroyed()) {
                    if (!isAiSidebarVisible) ipcMain.emit("toggle-ai-sidebar-request", null, true);
                    win.webContents.send("trigger-ai-action", { action: "keywords" });
                }
            }
        },
        { type: "separator" },
        {
            label: isZoomActive ? "🧱 Agencement (Désactivé en mode Zoom)" : "🧱 Agencement de la mosaïque",
            enabled: false
        },
        {
            label: "   ✂️ Scinder verticalement (Ctrl+T)",
            enabled: !isZoomActive, // NOUVEAU : Grisé si zoom actif
            click: () => ipcMain.emit('split-panel', null, panelId, 'vertical', false)
        },
        {
            label: "   ⚍ Scinder horizontalement (Ctrl+H)",
            enabled: !isZoomActive, // NOUVEAU : Grisé si zoom actif
            click: () => ipcMain.emit('split-panel', null, panelId, 'horizontal', false)
        },
        {
            label: isPrivate ? "   🕵️ Ouvrir une tuile publique classique" : "   🕵️ Scinder en Navigation Privée (Ctrl+Shift+N)",
            enabled: !isZoomActive, // NOUVEAU : Grisé si zoom actif
            click: () => ipcMain.emit('split-panel', null, panelId, 'vertical', !isPrivate)
        },
        { type: "separator" },
        {
            label: maximizedPanelId === panelId ? "🗗 Restaurer la taille de la mosaïque (Échap)" : "🗖 Maximiser cette tuile (Ctrl+M)",
            click: () => {
                maximizedPanelId = maximizedPanelId === panelId ? null : panelId;
                forceRebuildSplitters = true;
                resizeViews();
                win.webContents.send("zoom-changed", maximizedPanelId);
                updatePanelHandles();
            }
        },
        {
            label: "🖨️ Imprimer le contenu de la page (Ctrl+P)",
            click: () => ipcMain.emit('print-panel', null, panelId)
        },
        { type: "separator" },
        {
            label: "❌ Fermer cette tuile (Ctrl+W)",
            click: () => ipcMain.emit('close-panel', null, panelId)
        }
    ];

    const contextMenu = Menu.buildFromTemplate(menuTemplate);
    contextMenu.popup({ window: win, x, y });
}



function applyThemeToView(view) {

    if (!view || !view.webContents) {
        return;
    }

    if (typeof view.webContents.setForceDarkModeEnabled === 'function') {
        view.webContents.setForceDarkModeEnabled(
            isDarkModeForced
        );
    }

    if (isDarkModeForced) {

        const scriptToInject = `
            (function() {
                document.documentElement.classList.add('mw-theme-client-dark');

                if (document.body) {
                    document.body.classList.add('mw-theme-client-dark');
                }
            })();
        `;

        view.webContents.executeJavaScript(scriptToInject)
            .catch(console.error);
    }
}

function updateSplitterTheme() {
    splitterViews.forEach((splitterView) => {
        splitterView.webContents.reload();
    });
}

function getThemePreference() {
    try {
        if (!fs.existsSync(themePath)) {
            fs.writeFileSync(
                themePath,
                JSON.stringify({ darkMode: false }, null, 2)
            );
        }

        return JSON.parse(
            fs.readFileSync(themePath, "utf8")
        ).darkMode;
    } catch {
        return false;
    }
}

// ====== FONCTION DE SAUVEGARDE ASYNCHRONE ET ATOMIQUE SÉCURISÉE ======
// DANS MAIN.JS -> Remplacer la fonction safeWriteJsonAsync par cette version robuste

async function safeWriteJsonAsync(filePath, data) {
    const tmpPath = filePath + '.tmp';
    try {
        const jsonString = JSON.stringify(data, null, 2);
        
        // Écriture asynchrone du fichier temporaire
        await fsPromises.writeFile(tmpPath, jsonString, 'utf-8');
        
        // Remplacement atomique de l'ancien fichier
        await fsPromises.rename(tmpPath, filePath);
    } catch (error) {
        console.error(`[SYSTEME] Échec écriture asynchrone sur ${filePath}, tentative en mode direct...`);
        try {
            // Méthode de secours synchrone si Windows verrouille le renommage atomique asynchrone
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
            if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
        } catch (innerError) {
            console.error(`Erreur critique de sauvegarde sur ${filePath} :`, innerError);
        }
    }
}







// DANS MAIN.JS -> Remplacer le bloc complet de gestion des mots de passe

const passwordsPath = path.join(app.getPath('userData'), 'passwords.json');

// Forçage de l'encryption alternative (à placer juste avant app.whenReady())
app.on('ready', () => {
    if (safeStorage && typeof safeStorage.setUseAlternativeEncryption === 'function') {
        safeStorage.setUseAlternativeEncryption(true);
    }
});

function getStoredPasswords() {
    try {
        // Sécurité absolue : si le fichier n'existe pas, on le crée tout de suite proprement
        if (!fs.existsSync(passwordsPath)) {
            fs.writeFileSync(passwordsPath, JSON.stringify([], null, 2), 'utf-8');
            return [];
        }
        
        const rawData = fs.readFileSync(passwordsPath, 'utf-8');
        if (!rawData || !rawData.trim()) return [];
        
        const encryptedList = JSON.parse(rawData);
        if (!Array.isArray(encryptedList)) return [];
        
        return encryptedList.map(item => {
            try {
                if (safeStorage && safeStorage.isEncryptionAvailable() && item.password && item.password.startsWith('encrypted:')) {
                    const buffer = Buffer.from(item.password.replace('encrypted:', ''), 'base64');
                    return { ...item, password: safeStorage.decryptString(buffer) };
                }
            } catch (e) { 
                console.error("[PWD] Echec dechiffrement d'une ligne, fallback brut:", e); 
            }
            // Secours si non chiffré ou clé corrompue
            return { ...item, password: item.password ? item.password.replace('encrypted:', '') : "" }; 
        });
    } catch (e) {
        console.error("[PWD] Erreur critique lecture fichier, reinitialisation :", e);
        return [];
    }
}

async function savePasswordsSecurely(passwordList) {
    try {
        const encryptedList = passwordList.map(item => {
            if (safeStorage && safeStorage.isEncryptionAvailable() && item.password) {
                const encryptedBuffer = safeStorage.encryptString(item.password);
                return { ...item, password: 'encrypted:' + encryptedBuffer.toString('base64') };
            }
            return item;
        });
        // Utilisation de la méthode robuste safeWriteJsonAsync de votre projet
        await safeWriteJsonAsync(passwordsPath, encryptedList);
        return true;
    } catch (e) {
        console.error("[PWD] Erreur écriture securisee :", e);
        return false;
    }
}

// Dans main.js -> Remplacer l'écouteur "open-password-manager-window" complet

ipcMain.on("open-password-manager-window", () => {
    if (pwdWindow && !pwdWindow.isDestroyed()) {
        pwdWindow.focus();
        return;
    }

    // Crée la fenêtre avec les bordures standards de l'OS
    pwdWindow = new BrowserWindow({
        width: 350,
        height: 420,
        title: "Gestionnaire de mots de passe",
        backgroundColor: isDarkModeForced ? "#2d2d30" : "#ffffff",
        autoHideMenuBar: true,
        alwaysOnTop: true,
        resizable: false,
        webPreferences: {
            nodeIntegration: true, 
            contextIsolation: false 
        }
    });

    pwdWindow.loadFile(path.join(__dirname, 'passwords.html'));

    pwdWindow.webContents.on('did-finish-load', () => {
        updatePasswordWindowContent();
    });

    pwdWindow.on("closed", () => {
        pwdWindow = null;
    });
});


// Écouteurs d'actions émis depuis passwords.html
ipcMain.on('pwd-ui-save', async (event, entry) => {
    let list = getStoredPasswords();
    const existingIndex = list.findIndex(p => p.url === entry.url && p.username === entry.username);
    if (existingIndex >= 0) {
        list[existingIndex] = entry;
    } else {
        list.push(entry);
    }
    await savePasswordsSecurely(list);
    updatePasswordWindowContent(); // Rafraîchit l'affichage de la popup
});

ipcMain.on('pwd-ui-delete', async (event, index) => {
    let list = getStoredPasswords();
    if (index >= 0 && index < list.length) {
        list.splice(index, 1);
        await savePasswordsSecurely(list);
        updatePasswordWindowContent(); // Rafraîchit l'affichage de la popup
    }
});



// Ré-enregistrement des handles IPC nettoyés
ipcMain.removeHandler('pwd-get-all');
ipcMain.handle('pwd-get-all', () => {
    return getStoredPasswords();
});

ipcMain.removeHandler('pwd-save-entry');
ipcMain.handle('pwd-save-entry', async (event, entry) => {
    try {
        let list = getStoredPasswords();
        const existingIndex = list.findIndex(p => p.url === entry.url && p.username === entry.username);
        if (existingIndex >= 0) {
            list[existingIndex] = entry;
        } else {
            list.push(entry);
        }
        return await savePasswordsSecurely(list);
    } catch (e) {
        return false;
    }
});

ipcMain.removeHandler('pwd-delete-entry');
ipcMain.handle('pwd-delete-entry', async (event, index) => {
    try {
        let list = getStoredPasswords();
        if (index >= 0 && index < list.length) {
            list.splice(index, 1);
            return await savePasswordsSecurely(list);
        }
        return false;
    } catch (e) {
        return false;
    }
});




// ======================================================================
// FONCTIONS HISTORIQUE SÉCURISÉES (Anti-crash et Anti-corruption)
// ======================================================================

// Fonction pour lire l'historique sur le disque en toute sécurité
function getNavigationHistory() {
    try {
        if (!fs.existsSync(historyPath)) {
            // Utilisation d'un tableau vide de secours si le fichier n'existe pas
            fs.writeFileSync(historyPath, JSON.stringify([], null, 2), 'utf-8');
            return [];
        }
        const data = fs.readFileSync(historyPath, 'utf-8');
        
        // Sécurité si le fichier existe mais est totalement vide (0 Ko)
        if (!data.trim()) {
            fs.writeFileSync(historyPath, JSON.stringify([], null, 2), 'utf-8');
            return [];
        }
        
        return JSON.parse(data);
    } catch (e) {
        console.error("Erreur lecture historique (Fichier corrompu ou vide), réinitialisation :", e);
        // En cas de fichier JSON malformé, on réinitialise pour éviter le crash permanent
        try { fs.writeFileSync(historyPath, JSON.stringify([], null, 2), 'utf-8'); } catch(err) {}
        return [];
    }
}

// Fonction pour ajouter une entrée dans l'historique de manière asynchrone et atomique
async function addToHistory(url, title) {
    if (!url || url.startsWith('data:') || url.startsWith('about:')) return;
    
    try {
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

        // Écriture atomique sécurisée à la place du writeFileSync bloquant
        await safeWriteJsonAsync(historyPath, historyList);
        
        // Notifier l'IHM en temps réel si elle est ouverte
        if (win && !win.isDestroyed()) {
            win.webContents.send('history-updated', historyList);
        }
    } catch (error) {
        console.error("Erreur lors de l'ajout à l'historique :", error);
    }
}

// Fonction pour lire les favoris sur le disque en toute sécurité
function getFavoris() {
    try {
        if (!fs.existsSync(favorisPath)) {
            // Création d'un tableau de favoris vide par défaut
            fs.writeFileSync(favorisPath, JSON.stringify([], null, 2), 'utf-8');
            return [];
        }
        const data = fs.readFileSync(favorisPath, 'utf-8');
        
        // Sécurité si le fichier existe mais est totalement vide (0 Ko)
        if (!data.trim()) {
            fs.writeFileSync(favorisPath, JSON.stringify([], null, 2), 'utf-8');
            return [];
        }
        
        return JSON.parse(data);
    } catch (e) {
        console.error("Erreur lors de la lecture des favoris (Fichier corrompu ou vide), réinitialisation :", e);
        // Réparation automatique en cas de fichier JSON corrompu
        try { fs.writeFileSync(favorisPath, JSON.stringify([], null, 2), 'utf-8'); } catch(err) {}
        return [];
    }
}

function registerDownloadHandler(session) {
    if (!session) return;

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
                    // AJOUT SÉCURITÉ : On vérifie que la fenêtre et ses webContents ne sont pas détruits
                    if (win && !win.isDestroyed() && win.webContents && !win.webContents.isDestroyed()) {
                        win.webContents.send('download-progress', { panelId, percent, filename });
                    }
                }
            }
        });

        item.once('done', (event, state) => {
            // Nettoyage de la référence
            delete activeDownloads[panelId];

            // AJOUT SÉCURITÉ : On vérifie que la fenêtre et ses webContents ne sont pas détruits
            if (win && !win.isDestroyed() && win.webContents && !win.webContents.isDestroyed()) {
                win.webContents.send('download-done', { panelId });
            }

            if (state === 'completed') {
                const finalPath = item.getSavePath();
                const ext = path.extname(filename).toLowerCase();
                const dangerousExtensions = ['.exe', '.msi', '.bat', '.cmd', '.vbs', '.sh', '.scr'];

                // AJOUT SÉCURITÉ : On vérifie que la fenêtre existe toujours avant d'ouvrir la boîte de dialogue
                if (win && !win.isDestroyed()) {
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

    // 1. Nettoyer proprement les poignées des panneaux fermés
    Object.keys(handleViews).forEach(id => {
        if (!activeIds.includes(id)) {
            try { 
                win.removeBrowserView(handleViews[id]); 
                if (!handleViews[id].webContents.isDestroyed()) {
                    handleViews[id].webContents.destroy();
                }
            } catch(e) {}
            delete handleViews[id];
        }
    });

    // Compter les vraies vues de navigation web actives
    const allViews = win.getBrowserViews();
    const realWebViews = allViews.filter(v => {
        if (!v.webContents || v.webContents.isDestroyed()) return false;
        const ua = v.webContents.getUserAgent();
        const url = v.webContents.getURL();
        return ua !== "InternalBorder" && !url.startsWith("data:text/html");
    });

    // ====== MODIFICATION ICI ======
    // Au lieu de compter les BrowserViews (qui incluent les poignées et liserés en cours de reconstruction),
    // on utilise la liste réelle de vos panneaux (panelsList) issue de la structure de données.
    const isLastRemaining = (panelsList.length === 1);

    // 2. Mettre à jour ou créer la poignée pour chaque panneau
    panelsList.forEach((panel) => {
        // Si le panneau est masqué par le mode maximisé, on retire sa poignée
        if (maximizedPanelId && panel.id !== maximizedPanelId) {
            if (handleViews[panel.id]) {
                try {
                    win.removeBrowserView(handleViews[panel.id]);
                    if (!handleViews[panel.id].webContents.isDestroyed()) {
                        handleViews[panel.id].webContents.destroy();
                    }
                } catch(e) {}
                delete handleViews[panel.id];
            }
            return;
        }

        if (!panel.bounds) return;

        const isMaximized = (maximizedPanelId === panel.id);
        const expectedWidth = isLastRemaining ? 24 : (isMaximized ? 60 : 80);

        const handleBounds = {
            x: panel.bounds.x + 6,
            y: panel.bounds.y + 6,
            width: expectedWidth, 
            height: 24
        };

        // =============================================================
        // CHANGEMENT CRUCIAL AJUSTÉ : Si la vue existe déjà, on met à jour 
        // ses dimensions MAIS on ne s'arrête pas là si la largeur a changé !
        // =============================================================
        if (handleViews[panel.id]) {
            try {
                // On récupère les dimensions actuelles de la poignée stockée
                const currentBounds = handleViews[panel.id].getBounds();
                handleViews[panel.id].setBounds(handleBounds);
                win.setTopBrowserView(handleViews[panel.id]);
                
                // Si la poignée est déjà là mais que sa taille a changé (ex: passage de 24px à 60px après le mode sombre),
                // il faut détruire l'ancienne pour forcer la re-création complète du HTML ci-dessous.
                if (currentBounds.width === handleBounds.width) {
                    return; // Même taille, on s'arrête là sans recréer.
                } else {
                    win.removeBrowserView(handleViews[panel.id]);
                    handleViews[panel.id].webContents.destroy();
                    delete handleViews[panel.id];
                }
            } catch(e) {}
        }

        // Création initiale UNIQUE (S'exécute si handleViews[panel.id] n'existe pas ou vient d'être nettoyée)
        const hView = new BrowserView();
        win.addBrowserView(hView);
        
        const containerClass = isLastRemaining ? 'flex-1-btn' : (isMaximized ? 'flex-3-btns' : '');

        hView.webContents.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(`
            <html>
            <head>
                <meta charset="utf-8">
                <style>
                html, body { margin: 0; padding: 0; overflow: hidden !important; width: 100%; height: 100%; background: transparent; }
                #container {
                    display: flex; width: 100%; height: 100%;
                    background: #ffffff; border: 1px solid #d1d5db; border-radius: 4px;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.1); box-sizing: border-box; overflow: hidden;
                }
                .btn {
                    flex: 1; height: 100%; color: #1f2937;
                    display: flex; align-items: center; justify-content: center;
                    font-family: sans-serif; font-size: 11px; user-select: none;
                }
                #drag-btn { cursor: grab; font-size: 13px; border-right: 1px solid #d1d5db; }
                #drag-btn:hover { background: #f3f4f6; color: #000000; }
                .action { cursor: pointer; }
                #zoom-btn:hover { background: #dcfce7; color: #15803d; }
                #fullscreen-btn { border-left: 1px solid #d1d5db; border-right: 1px solid #d1d5db; }
                #fullscreen-btn:hover { background: #dbeafe; color: #1d4ed8; }
                #close-btn:hover { background: #fee2e2; color: #b91c1c; }
                
                ${isDarkModeForced ? `
                    #container { background: #2d2d30; border: 1px solid #3c3c3c; box-shadow: 0 2px 4px rgba(0,0,0,0.3); }
                    .btn { color: #cfcfcf; }
                    #drag-btn { border-right: 1px solid #3c3c3c; }
                    #drag-btn:hover { background: #3f3f46; color: #ffffff; }
                    #zoom-btn:hover { background: #15803d; color: #4ade80; }
                    #fullscreen-btn { border-left: 1px solid #3c3c3c; border-right: 1px solid #3c3c3c; }
                    #fullscreen-btn:hover { background: #1e3a8a; color: #3b82f6; }
                    #close-btn:hover { background: #991b1b; color: #fca5a5; }
                ` : ''}

                .flex-3-btns #drag-btn { display: none !important; }
                .flex-3-btns #zoom-btn { background: ${isDarkModeForced ? '#15803d' : '#dcfce7'}; color: ${isDarkModeForced ? '#4ade80' : '#15803d'}; }
                .flex-3-btns .action { flex: 1 1 33.33% !important; }
                
                .flex-1-btn #drag-btn, .flex-1-btn #zoom-btn, .flex-1-btn #fullscreen-btn { display: none !important; }
                .flex-1-btn #close-btn { display: flex !important; flex: 1 1 100% !important; border: none !important; border-radius: 4px; }
                </style>
            </head>
            <body>
            <div id="container" class="${containerClass}">
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
                return;
            }
            if (title === "action-fullscreen") {
                if (maximizedPanelId === panel.id) maximizedPanelId = null;
                detachPanelToFullscreen(panel.id);
            }
            if (title === "action-close") {
                if (isLastRemaining) {
                    app.quit(); 
                } else {
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
        hView.setBounds(handleBounds);
        try { win.setTopBrowserView(hView); } catch(e) {}
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
    constructor(id, view, url = "", isPrivate = false) {
        this.type = "panel";
        this.id = id;
        this.view = view;
        this.url = url;
        this.isPrivate = isPrivate; // Stocke l'état privé du panneau
    }
    toJSON() {
        return { type: this.type, id: this.id, url: this.url, isPrivate: this.isPrivate };
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

    // 1. Si c'est une URL valide ou une page locale
    if (input.includes("://") || input.startsWith("data:") || input.startsWith("about:")) {
        return input;
    }

    // 2. Si ça ressemble à un domaine direct sans espace (ex: google.com, wikipedia.org)
    if (/^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+(:[0-9]+)?(\/.*)?\$/.test(input) && !input.includes(" ")) {
        return "https://" + input;
    }

    // 3. Sinon, c'est une recherche de mots-clés sur Google
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


panels.push({ 
    id: node.id,
    url: node.url,
    realUrl: node.url,
    title: node.title,
    isPrivate: node.isPrivate
});
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

// Dans main.js -> Remplacez votre fonction updatePanelUrl par celle-ci :

function updatePanelUrl(panel, url) {
    // CORRECTIF : Si le panneau est privé et qu'il est sur la page d'accueil d'origine
    if (panel.isPrivate && (url.startsWith('data:text/html') || url === panel.url)) {
        panel.url = "Navigation Privée";
        panel.title = "Navigation Privée";
    } else {
        panel.url = url;
        if (panel.view && !panel.view.webContents.isDestroyed()) {
            panel.title = panel.view.webContents.getTitle();
        }
    }

    win.webContents.send("panels-updated", collectPanels(rootNode), maximizedPanelId);
}


function updateNavigationButtons() {

    if (!activePanel) {
        win.webContents.send("navigation-state", {
            canGoBack: false,
            canGoForward: false,
            hasActivePanel: false
        });
        return;
    }

    const panel = findPanelNode(rootNode, activePanel);

    if (!panel || !panel.view) {
        win.webContents.send("navigation-state", {
            canGoBack: false,
            canGoForward: false,
            hasActivePanel: false
        });
        return;
    }

    win.webContents.send("navigation-state", {
        canGoBack: panel.view.webContents.navigationHistory.canGoBack(),
        canGoForward: panel.view.webContents.navigationHistory.canGoForward(),
        hasActivePanel: true
    });
}

function setupNavigationTracking(panel) {

    if (!panel || !panel.view) return;

    let initialLoadFinished = false;


// Dans main.js -> À l'intérieur de la fonction setupNavigationTracking(panel)

    // Écouteur pour intercepter le clic droit sur la page web de la tuile
// Dans main.js -> À l'intérieur de setupNavigationTracking(panel)

// Écouteur pour intercepter le clic droit sur la page web de la tuile
panel.view.webContents.on("context-menu", (event, params) => {
    event.preventDefault();
    
    // === CORRECTIF : Forcer le focus sur ce panneau lors du clic droit ===
    activePanel = panel.id;
    if (win && !win.isDestroyed()) {
        // Met à jour le rectangle bleu de focus visuel autour de la tuile
        win.webContents.send("active-panel-changed", { id: panel.id, bounds: panel.bounds });
        // Met à jour la barre d'onglets supérieure
        win.webContents.send("panels-updated", collectPanels(rootNode), maximizedPanelId);
    }
    updateActiveBorder(panel.bounds);
    // ===================================================================

    // On affiche ensuite le menu d'actions au pixel près où se trouve la souris
    afficherMenuContextuelPanneau(panel.view.webContents, params.x, params.y);
});




panel.view.webContents.on("did-start-loading", () => {

    console.log(
        "START",
        panel.id,
        panel.view.webContents.getURL()
    );



        // Ignore le chargement initial au démarrage
 if (!initialLoadFinished) {
console.log("START BLOQUÉ");
return;
}


        if (win && !win.isDestroyed()) {
            win.webContents.send("page-loading", {
                panelId: panel.id,
                loading: true
            });
        }
    });

    panel.view.webContents.on("did-stop-loading", () => {


console.log(
"STOP",
panel.id,
panel.view.webContents.getURL()
);

        if (!initialLoadFinished) {
            initialLoadFinished = true;
            return;
        }

        if (win && !win.isDestroyed()) {
            win.webContents.send("page-loading", {
                panelId: panel.id,
                loading: false
            });
        }
    });
   

// Dans main.js -> Dans setupNavigationTracking -> did-finish-load

panel.view.webContents.on("did-finish-load", async () => {
    // ... (Votre code existant qui injecte le fichier injector.js) ...

    // === CORRECTIF CRUCIAL DE L'AUTOFILL AUTOMATIQUE ===
    if (!panel.isPrivate) { 
        const currentUrl = panel.view.webContents.getURL();
        try {
            // Appelle directement la fonction JavaScript locale sans passer par ipcMain.handlers
            let hostname = "";
            try {
                hostname = new URL(currentUrl).hostname.replace(/^www\./, "");
            } catch (e) {
                hostname = "";
            }

            if (hostname) {
                const list = getStoredPasswords(); // Récupère la liste décodée
                const matches = list.filter(p => p.url && p.url.includes(hostname));

                if (matches && matches.length > 0) {
                    const bestMatch = matches[0]; // Prend le premier compte correspondant
                    
                    console.log(`[PWD AUTOFILL] Correspondance trouvée pour ${hostname} : ${bestMatch.username}`);
                    
                    // Exécute la méthode d'autofill injectée dans le DOM de la tuile web
                    const fillScript = `
                        if (window.NanobrowserExecutor && typeof window.NanobrowserExecutor.autofillCredentials === 'function') {
                            window.NanobrowserExecutor.autofillCredentials("${bestMatch.username}", "${bestMatch.password}");
                        }
                        void 0;
                    `;
                    panel.view.webContents.executeJavaScript(fillScript).catch(() => {});
                }
            }
        } catch (err) { 
            console.error("Erreur Autofill résolue :", err); 
        }
    }
});





// -----------------------------------------------------------


    if (typeof panel.view.webContents.setForceDarkModeEnabled === 'function') {
        panel.view.webContents.setForceDarkModeEnabled(isDarkModeForced);
    }
    
    panel.view.webContents.on("did-navigate", (event, url, httpResponseCode, httpStatusText) => {
        if (httpResponseCode >= 400) {
            // ... Votre logique de gestion des erreurs HTML ...
        } else {
            const title = panel.view.webContents.getTitle();

            updateNavigationButtons();
            
            // MODIFICATION ICI : On n'enregistre PAS si le panneau est en navigation privée
            if (!panel.isPrivate) {
                addToHistory(url, title);
                updateHistoryWindowContent();   
            }

            updatePanelUrl(panel, url);

            // On informe immédiatement l'IHM du nouvel état de navigation de ce panneau spécifique
            if (win && !win.isDestroyed()) {
                win.webContents.send("navigation-state-changed", {
                    panelId: panel.id,
                    canGoBack: panel.view.webContents.navigationHistory.canGoBack(),
                    canGoForward: panel.view.webContents.navigationHistory.canGoForward()
                });
            }

        }
    });


    // === AJOUT : GESTION DES ERREURS HTTP (404, 500, etc.) ===
    panel.view.webContents.on("did-redirect-navigation", (event, url, isInPlace, isMainFrame) => {
        // Utile si le serveur redirige vers une page d'erreur spécifique
    });


        // Sécurité pour capter les changements de titres tardifs et les redirections invisibles
    panel.view.webContents.on("page-title-updated", (event, title) => {
        const currentUrl = panel.view.webContents.getURL();
        updatePanelUrl(panel, currentUrl);
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


    panel.view.webContents.on("did-fail-load", (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
        if (!isMainFrame) return;

        // Ignorer TOUTES les formes d'annulations de requêtes (code -3 dans Chromium ou ERR_ABORTED)
        if (errorDescription === "ERR_ABORTED" || errorCode === -3) return;

        console.log(`Échec de chargement sur la tuile ${panel.id} [${errorCode}]: ${errorDescription}`);
    
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

function layoutNode(node, x, y, width, height) {
    if (!node || width <= 0 || height <= 0) return;

    // SI UN PANNEAU EST MAXIMISÉ : On nettoie et on surcharge le comportement
    if (maximizedPanelId) {
        if (node.type === "panel") {
            if (node.id === maximizedPanelId) {
                // Le panneau maximisé prend TOUTE la place disponible
                node.bounds = { x, y, width, height };
                if (node.view && !node.view.webContents.isDestroyed()) {
                    node.view.setBounds({ x, y, width, height });
                }
            } else {
                // CORRECTIF : On écrase totalement les anciennes coordonnées 
                // pour forcer Chromium à effacer le panneau de l'affichage
                node.bounds = null;
                if (node.view && !node.view.webContents.isDestroyed()) {
                    node.view.setBounds({ x: -2000, y: -2000, width: 0, height: 0 });
                }
                
                // CORRECTIF : On détruit immédiatement la poignée flottante associée
                if (handleViews[node.id]) {
                    try { win.removeBrowserView(handleViews[node.id]); } catch(e) {}
                    delete handleViews[node.id];
                }
            }
            return;
        }
        // Si c'est un nœud de type split, on propage le nettoyage aux enfants
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


// À mettre avec vos autres ipcMain.handle dans main.js
ipcMain.removeHandler('pwd-find-for-url');
ipcMain.handle('pwd-find-for-url', (event, targetUrl) => {
    try {
        const hostname = new URL(targetUrl).hostname.replace(/^www\./, "");
        const list = getStoredPasswords();
        return list.filter(p => p.url && p.url.includes(hostname));
    } catch {
        return [];
    }
});



ipcMain.on("show-url-context-menu", (event) => {
    const menu = Menu.buildFromTemplate([
        { role: "undo", label: "Annuler" },
        { role: "redo", label: "Rétablir" },
        { type: "separator" },
        { role: "cut", label: "Couper" },
        { role: "copy", label: "Copier" },
        { role: "paste", label: "Coller" },
        { role: "delete", label: "Supprimer" },
        { type: "separator" },
        { role: "selectAll", label: "Tout sélectionner" }
    ]);

    menu.popup({
        window: BrowserWindow.fromWebContents(event.sender)
    });
});

// Dans main.js -> Écouteur pour modifier l'état et forcer le rafraîchissement géométrique
ipcMain.on("toggle-ai-sidebar-request", (event, isVisible) => {
    isAiSidebarVisible = isVisible;
    forceRebuildSplitters = true;
    resizeViews(); // Recalcule l'affichage des tuiles
    
    // NOUVEAU : On informe l'IHM de la hauteur exacte de la barre d'outils (TOOLBAR_HEIGHT)
    if (win && !win.isDestroyed()) {
        win.webContents.send("ai-sidebar-geometry-update", {
            topPosition: TOOLBAR_HEIGHT
        });
    }
});



ipcMain.on("navigate", (event, panelId, input) => {

console.log("NAVIGATE", panelId, input);

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
//  win.webContents.send("panels-updated", collectPanels(rootNode));

    win.webContents.send(
        "panels-updated",
        collectPanels(rootNode),
        maximizedPanelId
    );

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

    // === AJOUT PROTECTION NAVIGATION PRIVÉE : NETTOYAGE CYBER-SÉCURITÉ ===
    if (node.isPrivate && node.view && !node.view.webContents.isDestroyed()) {
        const privateSession = node.view.webContents.session;
        
        console.log(`Fermeture d'une tuile privée : Nettoyage complet de la partition : ${privateSession.getStoragePath()}`);
        
        // 1. Effacement complet des données de stockage (Cookies, LocalStorage, Cache, IndexedDB...)
        privateSession.clearStorageData({
            storages: ['cookies', 'localstorage', 'caches', 'indexeddb', 'websql', 'serviceworkers', 'cachestorage'],
            quotas: ['temporary', 'persistent', 'syncable']
        }).then(() => {
            console.log(`[Partition ${panelId}] Stockages et Cookies détruits avec succès.`);
        }).catch(err => console.error("Erreur destruction storage privé :", err));
        
        // 2. Vidage du cache d'historique HTTP de Chromium en mémoire
        privateSession.clearCache().catch(err => console.error("Erreur destruction cache privé :", err));
    }
    // ======================================================================

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

    win.webContents.send(
        "panels-updated",
        collectPanels(rootNode),
        maximizedPanelId
    );
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
//  win.webContents.send("panels-updated", collectPanels(rootNode));
    win.webContents.send(
        "panels-updated",
        collectPanels(rootNode),
        maximizedPanelId
    );

    if (restoredNode && restoredNode.bounds) {
        win.webContents.send("active-panel-changed", { id: restoredNode.id, bounds: restoredNode.bounds });
        updateActiveBorder(restoredNode.bounds);
    }
});

// 1. DÉCLARATION DE LA VARIABLE (Doit être en premier !)
let historyWindow = null; 

// ======================================================================
// BLOC HISTORIQUE NATIF CORRIGÉ VIA ARCHITECTURE IPC
// ======================================================================

// Fonction pour envoyer les données fraîches à la fenêtre d'historique
function updateHistoryWindowContent() {
    if (global.historyWindow && !global.historyWindow.isDestroyed()) {
        const historyList = getNavigationHistory();

        console.log("NB HISTORIQUE =", historyList.length);

        global.historyWindow.webContents.send('render-history', {
            historyList,
            isDarkMode: isDarkModeForced
        });
    }
}
// Écouteur pour ouvrir la fenêtre
ipcMain.on("open-history-window", () => {
    if (global.historyWindow && !global.historyWindow.isDestroyed()) {
        global.historyWindow.focus();
        return;
    }

    global.historyWindow = new BrowserWindow({
        width: 450,
        height: 600,
        title: "Historique de navigation",
        backgroundColor: isDarkModeForced ? "#1e1e1e" : "#f9fafb",
        autoHideMenuBar: true,
        alwaysOnTop: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload-history.js'), // <-- Charge le nouveau preload
            nodeIntegration: false,                              // <-- SÉCURITÉ : Désactivé
            contextIsolation: true                               // <-- SÉCURITÉ : Activé
        }
    });

    global.historyWindow.loadFile(path.join(__dirname, 'history.html'));

// global.historyWindow.webContents.openDevTools();

    global.historyWindow.webContents.on('did-finish-load', () => {
        updateHistoryWindowContent();
    });

    global.historyWindow.on("closed", () => {
        global.historyWindow = null;
    });
});

// 2. Écouteur de rafraîchissement au changement de données
// Écouteur de rafraîchissement au changement de données
ipcMain.on('history-data-changed', () => {
    updateHistoryWindowContent();
});

// D. Suppression d'une seule entrée d'historique
ipcMain.on('delete-single-history', (event, index) => {
    let historyList = getNavigationHistory();
    if (index >= 0 && index < historyList.length) {
        historyList.splice(index, 1);
        fs.writeFileSync(historyPath, JSON.stringify(historyList, null, 2));
        
        ipcMain.emit('history-data-changed');
        if (win && !win.isDestroyed()) win.webContents.send('history-updated', historyList);
    }
});

// E. Effacer tout l'historique d'un coup
ipcMain.on('clear-all-history', () => {
    fs.writeFileSync(historyPath, JSON.stringify([]));
    ipcMain.emit('history-data-changed');
    if (win && !win.isDestroyed()) win.webContents.send('history-updated', []);
});

// F. Clic sur un lien de l'historique
ipcMain.on("history-click", (event, url) => {
    if (activePanel) {
        const panel = findPanelNode(rootNode, activePanel);
        if (panel && panel.view) {
            panel.view.webContents.loadURL(url);
            if (historyWindow && !historyWindow.isDestroyed()) {
                historyWindow.close();
            }
        }
    }
});

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

// ====== GESTION DU MODE SOMBRE À LA DEMANDE (INJECTION AVANCÉE) ======
isDarkModeForced = getThemePreference();

// ====== DANS SCRIPT : main.js ======

// DANS MAIN.JS -> Remplacer l'écouteur 'toggle-dark-mode-request'

ipcMain.on('toggle-dark-mode-request', (event, enable) => {
    isDarkModeForced = enable;
    nativeTheme.themeSource = enable ? 'dark' : 'light';

// Mise à jour de la barre de titre Electron
if (win && !win.isDestroyed()) {
    win.setTitleBarOverlay({
        color: enable ? '#252526' : '#ffffff',
        symbolColor: enable ? '#cfcfcf' : '#1f2937',
        height: 38
    });

    win.setBackgroundColor(
        enable ? '#252526' : '#f3f4f6'
    );
}    

    // Force la recréation complète des poignées
    Object.keys(handleViews).forEach(id => {
        try {
            win.removeBrowserView(handleViews[id]);
            if (!handleViews[id].webContents.isDestroyed()) {
                handleViews[id].webContents.destroy();
            }
        } catch (e) {}

        delete handleViews[id];
    });

    updatePanelHandles();    

    // 1. Mise à jour de la fenêtre principale
    if (win && !win.isDestroyed()) {
        win.webContents.send('system-theme-changed', enable);
    }

    // 2. Traitement des tuiles web (BrowserViews)
    const allViews = win.getBrowserViews();
    allViews.forEach(v => {
        if (!v.webContents || v.webContents.isDestroyed()) return;
        const url = v.webContents.getURL();
        
        if (url.startsWith('data:text/html') || v.webContents.getUserAgent() === "InternalBorder") return;

        // Désactive ou active le mode sombre natif de Chromium
        if (typeof v.webContents.setForceDarkModeEnabled === 'function') {
            v.webContents.setForceDarkModeEnabled(enable);
        }

        if (enable) {
            // Mode Sombre : On injecte les styles
            const scriptToInject = `
                (function() {
                    document.documentElement.classList.add('mw-theme-client-dark');
                    if (document.body) document.body.classList.add('mw-theme-client-dark');
                    if (!document.getElementById('hare-dark-fallback')) {
                        const style = document.createElement('style');
                        style.id = 'hare-dark-fallback';
                        style.innerHTML = \`html, body { background-color: #121212 !important; color: #e0e0e0 !important; } a { color: #8ab4f8 !important; }\`;
                        document.head.appendChild(style);
                    }
                })();
            `;
            v.webContents.executeJavaScript(scriptToInject).catch(() => {});
        } else {
            // Mode Clair : On nettoie ET on force un rechargement léger pour vider le cache de rendu
            const scriptToRemove = `
                (function() {
                    document.documentElement.classList.remove('mw-theme-client-dark');
                    if (document.body) document.body.classList.remove('mw-theme-client-dark');
                    const style = document.getElementById('hare-dark-fallback');
                    if (style) style.remove();
                })();
            `;
            v.webContents.executeJavaScript(scriptToRemove).then(() => {
                // Force Wikipédia et les autres pages à réadopter le thème clair natif
                v.webContents.reloadIgnoringCache();
            }).catch(() => {
                v.webContents.reload();
            });
        }
    });

    // 3. CORRECTIF RADICAL pour la fenêtre de gestion des mots de passe
    if (pwdWindow && !pwdWindow.isDestroyed()) {
        // Si elle est ouverte, on la ferme et on la réouvre instantanément au même endroit.
        // Cela force Windows à recalculer les couleurs de la barre de titre et du cadre natif.
        const bounds = pwdWindow.getBounds();
        pwdWindow.close(); 
        
        // Petite temporisation de 50ms pour laisser le système détruire l'ancienne bordure
        setTimeout(() => {
            ipcMain.emit('open-password-manager-window');
            if (pwdWindow && !pwdWindow.isDestroyed()) {
                pwdWindow.setBounds(bounds);
            }
        }, 50);
    }

// === Rafraîchissement des éléments natifs ===

// Recrée les splitters avec les nouvelles couleurs
updateSplitterTheme();

forceRebuildSplitters = true;

// Recrée les poignées de déplacement
updatePanelHandles();

// Met à jour la fenêtre Historique si elle est ouverte
updateHistoryWindowContent();

// Recalcule la géométrie
resizeViews();


});




// Script d'injection magique : s'exécute AVANT que Wikipédia ne calcule ses styles
app.on('web-contents-created', (event, webContents) => {

    // On injecte le code dès que le DOM commence à exister
    webContents.on('dom-ready', () => {

        updateNavigationButtons();

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

// Dans main.js -> Recherchez ipcMain.on("split-panel", ...)
ipcMain.on("split-panel", (event, panelId, direction, isPrivate = false) => {

    const node = findPanelNode(rootNode, panelId);
    const parent = findParentNode(rootNode, panelId);    

    // ====== DANS MAIN.JS -> ipcMain.on("split-panel", ...) ======
    const newPanelId = "panel" + nextPanelNumber++;

    // CORRECTIF : Utiliser une partition en mémoire pure sans préfixe "persist:"
    // Le simple fait de l'appeler 'incognito_panelX' crée une session isolée et volatile.
    const viewOptions = {
        webPreferences: {
            partition: `incognito_${newPanelId}`,
            contextIsolation: true,
            nodeIntegration: false
        }
    };

    const newView = new BrowserView(viewOptions);
    win.addBrowserView(newView);


// ___________________________________________________________________________________________

// ====== DANS MAIN.JS -> ipcMain.on("split-panel", ...) ======

    // --- CORRECTION DU THÈME INCOGNITO ---
    // Au lieu de lire une variable globale, on demande directement à Electron son état réel
    const { nativeTheme } = require('electron');
    const isDark = nativeTheme.shouldUseDarkColors; 
    const themeClass = isDark ? "mw-theme-client-dark" : "mw-theme-client-light";

    // 1. Définition du code HTML / CSS de la page d'accueil privée mis à jour dynamiquement
    const incognitoHomeHtml = `
        <!DOCTYPE html>
        <html lang="fr" class="${themeClass}">
        <head>
            <meta charset="utf-8">
            <title>Navigation Privée</title>
            <style>
                /* CONFIGURATION DE LA GÉOMÉTRIE (Élimine l'air en bas) */
                html, body {
                    height: 100%;
                    margin: 0;
                    padding: 0;
                    overflow: hidden;
                }
                body {
                    font-family: 'Segoe UI', system-ui, sans-serif;
                    background-color: #f3f4f6; /* Gris clair par défaut */
                    color: #1f2937; /* Texte foncé par défaut */
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    box-sizing: border-box;
                    padding: 24px;
                    transition: background 0.2s, color 0.2s;
                }
                .container {
                    width: 100%;
                    max-width: 480px;
                    max-height: 95vh;
                    overflow-y: auto;
                    text-align: center;
                    background: #ffffff; /* Carte blanche */
                    padding: 24px;
                    border-radius: 12px;
                    border: 1px solid #e5e7eb;
                    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
                    box-sizing: border-box;
                }
                .icon {
                    font-size: 32px;
                    margin-bottom: 8px;
                }
                h1 {
                    font-size: 20px;
                    margin-top: 0;
                    margin-bottom: 12px;
                    color: #6b21a8; /* Violet foncé élégant */
                    font-weight: 600;
                }
                p {
                    font-size: 13px;
                    color: #4b5563;
                    line-height: 1.5;
                    margin-bottom: 20px;
                }
                .lists-container {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    text-align: left;
                    margin-bottom: 20px;
                }
                .list-box {
                    flex: 1;
                    background: #f9fafb;
                    padding: 12px;
                    border-radius: 8px;
                    border: 1px solid #e5e7eb;
                }
                .list-box h3 {
                    margin-top: 0;
                    font-size: 12.5px;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                .list-box.secure h3 { color: #16a34a; }
                .list-box.warn h3 { color: #d97706; }
                ul {
                    margin: 0;
                    padding-left: 18px;
                    font-size: 11.5px;
                    color: #374151;
                }
                li { margin-bottom: 6px; line-height: 1.4; }
                .btn-search {
                    background-color: #6b21a8;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    font-size: 13px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-weight: 500;
                    width: 100%;
                    box-sizing: border-box;
                    transition: background 0.2s;
                }
                .btn-search:hover { background-color: #7e22ce; }



/* 🕵️ BASCULE DYNAMIQUE DU MODE SOMBRE (Correction des sélecteurs) */
html.mw-theme-client-dark body {
    background-color: #120b18 !important; /* Votre fond violet très sombre d'origine */
    color: #e2e8f0 !important;
}
html.mw-theme-client-dark .container {
    background: #1e1229 !important;
    border-color: #4c1d95 !important;
    box-shadow: 0 10px 25px rgba(0,0,0,0.5) !important;
}
html.mw-theme-client-dark h1 { color: #c084fc !important; }
html.mw-theme-client-dark p { color: #94a3b8 !important; }
html.mw-theme-client-dark .list-box { background: #150b1d !important; border-color: #2e1065 !important; }
html.mw-theme-client-dark ul { color: #cbd5e1 !important; }
html.mw-theme-client-dark .list-box.secure h3 { color: #4ade80 !important; }
html.mw-theme-client-dark .list-box.warn h3 { color: #facc15 !important; }




            </style>
        </head>
        <body>
            <div class="container">
                <div class="icon">🕵️</div>
                <h1>Vous êtes en navigation privée</h1>
                <p>Désormais, les pages que vous consultez dans cette tuile ne seront pas mémorisées dans l'historique et vos cookies seront détruits à la fermeture du panneau.</p>
                
                <div class="lists-container">
                    <div class="list-box secure">
                        <h3>🔒 Ce qui est masqué</h3>
                        <ul>
                            <li>Historique de navigation locale</li>
                            <li>Cookies et données de session</li>
                            <li>Saisies dans les formulaires</li>
                            <li>Mémoire cache détruite à la fermeture</li>
                        </ul>
                    </div>
                    <div class="list-box warn">
                        <h3>⚠️ Visible malgré tout</h3>
                        <ul>
                            <li>Les sites web visités eux-mêmes</li>
                            <li>Votre administrateur réseau (école/travail)</li>
                            <li>Votre fournisseur d'accès internet</li>
                        </ul>
                    </div>
                </div>

                <!-- Redirection vers votre IP locale au clic -->
                <button class="btn-search" onclick="window.location.href='http://129.151.254.175:8080'">
                    Ouvrir le moteur de recherche privé
                </button>
            </div>
        </body>
        </html>
    `;

    // 2. Attribution de l'URL par défaut lors du split de panneau
    const defaultUrl = isPrivate 
        ? "data:text/html;charset=utf-8," + encodeURIComponent(incognitoHomeHtml) // Charge la page HTML ci-dessus
        : "https://bing.com"; // Mode public classique

    newView.webContents.loadURL(defaultUrl);

    // Passer le paramètre isPrivate au constructeur
    const newPanel = new PanelNode(newPanelId, newView, defaultUrl, isPrivate);
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
    
    win.webContents.send("panels-updated", collectPanels(rootNode), maximizedPanelId);
    win.webContents.send("active-panel-changed", { id: newPanel.id, bounds: newPanel.bounds });
    updateActiveBorder(newPanel.bounds);
});


function createDefaultLayout() {

    leftView = new BrowserView();
    centerView = new BrowserView();
    rightView = new BrowserView();

    [leftView, centerView, rightView].forEach(view => {

        view.webContents.once("did-finish-load", () => {

            applyThemeToView(view);

        });

    });

    win.addBrowserView(leftView);
    win.addBrowserView(centerView);
    win.addBrowserView(rightView);

    leftView.webContents.loadURL("https://www.google.com");
    centerView.webContents.loadURL("https://fr.wikipedia.org");
    rightView.webContents.loadURL("https://github.com");

    [leftView, centerView, rightView].forEach(view => {

        view.webContents.once('did-finish-load', () => {

            if (typeof view.webContents.setForceDarkModeEnabled === 'function') {
                view.webContents.setForceDarkModeEnabled(
                    isDarkModeForced
                );
            }

        });

    });

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

    updateNavigationButtons();
}

function createWindow() {

    isDarkModeForced = getThemePreference();

    win = new BrowserWindow({
        width: 1200,
        height: 800,
        frame: false,
        titleBarStyle: 'hidden',
        
        // MODIFICATION ICI : Fond dynamique au démarrage pour éviter la ligne noire
        backgroundColor: isDarkModeForced ? '#252526' : '#f3f4f6', 


        titleBarOverlay: {
            color: isDarkModeForced ? '#252526' : '#ffffff',
            symbolColor: isDarkModeForced ? '#cfcfcf' : '#1f2937',
            height: 38
        },
        
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    // Ouvre automatiquement les DevTools au démarrage de l'application
    win.webContents.openDevTools();

    win.setMaxListeners(30);

// Remplacez registerDownloadHandler(win.webContents.session); par :
    registerDownloadHandler(win.webContents.session);
    

    process.on("warning", (warning) => {
        console.log("WARNING NAME:", warning.name);
        console.log("WARNING MESSAGE:", warning.message);
        console.log("WARNING STACK:", warning.stack);
    });

    win.loadFile("index.html");

    win.webContents.on("did-finish-load", () => {
        win.webContents.send("app-title", APP_TITLE);
    });

    createDefaultLayout();

    collectPanelNodes(rootNode).forEach(panel => {
        if (
            panel.view &&
            typeof panel.view.webContents.setForceDarkModeEnabled === 'function'
        ) {
            panel.view.webContents.setForceDarkModeEnabled(isDarkModeForced);
        }
    });    




    // ====== DANS SCRIPT : main.js ======
    // À insérer à l'intérieur du tableau 'template' dans la fonction createWindow()

    const template = [
        {
            label: 'Navigation',
            submenu: [
                // === VOS RACCOURCIS DE SAUVEGARDE ET CHARGEMENT À AJOUTER ===
                {
                    label: 'Sauvegarder la configuration des panneaux',
                    accelerator: 'CmdOrCtrl+S',
                    click: async () => {
                        if (!rootNode) return;
                        const snapshot = createSnapshot(rootNode);
                        const { filePath } = await dialog.showSaveDialog(win, {
                            title: "Sauvegarder la configuration des panneaux",
                            defaultPath: path.join(app.getPath('documents'), 'hare-browser-layout.json'),
                            filters: [{ name: 'Fichiers Configuration (*.json)', extensions: ['json'] }]
                        });
                        if (filePath) {
                            try {
                                await fsPromises.writeFile(filePath, JSON.stringify(snapshot, null, 2), 'utf-8');
                                console.log("Configuration sauvegardée via raccourci.");
                            } catch (error) {
                                console.error("Erreur raccourci sauvegarde :", error);
                            }
                        }
                    }
                },

// DANS MAIN.JS -> Remplacez le bloc existant de l'accélérateur 'Escape' par celui-ci :

{
    label: 'Quitter le mode agrandi / Masquer l\'IA',
    accelerator: 'Escape',
    click: () => {
        let geometryChanged = false;

        // 1. Si le volet de l'assistant IA est visible, on le ferme
        if (isAiSidebarVisible) {
            isAiSidebarVisible = false;
            geometryChanged = true;
            // On prévient l'IHM (index.html) de ranger le volet en arrière-plan
            win.webContents.send("toggle-ai-sidebar-keyboard-force", false);
        }

        // 2. Si un panneau est maximisé (votre logique d'origine), on le restaure
        if (maximizedPanelId) {
            const panelIdToRestore = maximizedPanelId;
            maximizedPanelId = null;
            geometryChanged = true;

            win.webContents.send("zoom-changed", maximizedPanelId);

            if (handleViews[panelIdToRestore]) {
                try { win.removeBrowserView(handleViews[panelIdToRestore]); } catch(e){}
                delete handleViews[panelIdToRestore];
            }
        }

        // 3. Si la géométrie globale a bougé, on force Electron à recalculer l'écran
        if (geometryChanged) {
            forceRebuildSplitters = true;
            resizeViews();
            updatePanelHandles();
        }
    }
},



                {
                    label: 'Charger une configuration de panneaux',
                    accelerator: 'CmdOrCtrl+O',
                    click: async () => {
                        const { filePaths } = await dialog.showOpenDialog(win, {
                            title: "Charger une configuration de panneaux",
                            defaultPath: app.getPath('documents'),
                            properties: ['openFile'],
                            filters: [{ name: 'Fichiers Configuration (*.json)', extensions: ['json'] }]
                        });

                        if (filePaths && filePaths.length > 0) {
                            try {
                                const data = await fsPromises.readFile(filePaths[0], 'utf-8');
                                const snapshot = JSON.parse(data);

                                if (!snapshot || !snapshot.type) return;

                                saveState(); // Permet d'annuler l'import avec Ctrl+Z au besoin

                                // 1. Suppression propre des anciennes vues ouvertes à l'écran
                                const oldPanels = collectPanelNodes(rootNode);
                                oldPanels.forEach(p => {
                                    if (p.view) {
                                        try { win.removeBrowserView(p.view); p.view.webContents.destroy(); } catch(e) {}
                                    }
                                });

                                // 2. Fonction récursive de reconstruction
                                function rebuildTreeFromImport(node) {
                                    if (!node) return null;

                                    if (node.type === "panel") {
                                        const viewOptions = {
                                            webPreferences: {
                                                partition: node.isPrivate ? `incognito_panel_${Math.random()}` : undefined,
                                                contextIsolation: true,
                                                nodeIntegration: false
                                            }
                                        };
                                        const newView = new BrowserView(viewOptions);
                                        win.addBrowserView(newView);
                                        newView.webContents.loadURL(node.realUrl || node.url || "https://bing.com");

                                        const newNode = new PanelNode(node.id, newView, node.url, !!node.isPrivate);
                                        setupNavigationTracking(newNode);
                                        return newNode;
                                    }

                                    const splitNode = new SplitNode(node.direction);
                                    splitNode.ratio = node.ratio || 0.5;
                                    splitNode.first = rebuildTreeFromImport(node.first);
                                    splitNode.second = rebuildTreeFromImport(node.second);
                                    return splitNode;
                                }

                                // 3. Application du nouvel arbre importé
                                rootNode = rebuildTreeFromImport(snapshot);
                                maximizedPanelId = null; 

                                const firstPanel = findFirstPanel(rootNode);
                                if (firstPanel) activePanel = firstPanel.id;

                                // 4. Recalcul géométrique et notifications à l'IHM
                                forceRebuildSplitters = true;
                                resizeViews();

                                win.webContents.send("panels-updated", collectPanels(rootNode), maximizedPanelId);
                                if (firstPanel && firstPanel.bounds) {
                                    win.webContents.send("active-panel-changed", { id: firstPanel.id, bounds: firstPanel.bounds });
                                }

                                console.log("Configuration chargée via raccourci.");
                            } catch (error) {
                                console.error("Erreur raccourci chargement :", error);
                                dialog.showErrorBox("Erreur de chargement", "Le fichier sélectionné est corrompu ou malformé.");
                            }
                        }
                    }
                },
                
                {
                    label: 'Scinder verticalement',
                    accelerator: 'CmdOrCtrl+T',
                    click: () => {
                        let targetPanelId = activePanel;
                        
                        // Sécurité : Fallback sur le premier panneau de l'arbre
                        if (!targetPanelId && rootNode) {
                            const firstPanelNode = findFirstPanel(rootNode);
                            if (firstPanelNode) {
                                targetPanelId = firstPanelNode.id;
                            }
                        }

                        if (targetPanelId) {
                            ipcMain.emit('split-panel', null, targetPanelId, 'vertical');
                        }
                    }
                },
                {
                    label: 'Scinder horizontalement',
                    accelerator: 'CmdOrCtrl+H', // Attention si doublon avec l'historique, ajustez selon votre configuration
                    click: () => {
                        let targetPanelId = activePanel;
                        
                        // Sécurité : Fallback sur le premier panneau de l'arbre
                        if (!targetPanelId && rootNode) {
                            const firstPanelNode = findFirstPanel(rootNode);
                            if (firstPanelNode) {
                                targetPanelId = firstPanelNode.id;
                            }
                        }

                        if (targetPanelId) {
                            ipcMain.emit('split-panel', null, targetPanelId, 'horizontal');
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

                {
                    label: 'Nouvelle tuile privée',
                    accelerator: 'CmdOrCtrl+Shift+N',
                    click: () => {
                        // Si aucun panneau n'est actif, on cherche le premier panneau ouvert à l'écran
                        let targetPanelId = activePanel;
                        
                        if (!targetPanelId && rootNode) {
                            const firstPanelNode = findFirstPanel(rootNode);
                            if (firstPanelNode) {
                                targetPanelId = firstPanelNode.id;
                            }
                        }

                        // Si on a trouvé un panneau (actif ou repli de secours), on exécute le split
                        if (targetPanelId) {
                            ipcMain.emit('split-panel', null, targetPanelId, 'vertical', true);
                        }
                    }
                },

                {
                    label: 'Imprimer la tuile active',
                    accelerator: 'CmdOrCtrl+P',
                    click: () => {
                        if (activePanel) {
                            ipcMain.emit('print-panel', null, activePanel);
                        }
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

//      win.webContents.send("panels-updated", collectPanels(rootNode));
        win.webContents.send(
            "panels-updated",
            collectPanels(rootNode),
            maximizedPanelId
        );

        win.webContents.send("app-title-changed", APP_TITLE);

        win.setTitle(APP_TITLE);

        collectPanelNodes(rootNode).forEach(panel => {

            if (panel.view) {
                applyThemeToView(panel.view);
            }

        });

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



// ====== DANS MAIN.JS -> DANS LA FONCTION createWindow() ======

    // Intercepte le clic sur la croix de fermeture de la fenêtre
    win.on('close', (e) => {
        // Empêche la fermeture immédiate
        e.preventDefault();

        const response = dialog.showMessageBoxSync(win, {
            type: 'question',
            buttons: ['Oui, quitter', 'Annuler'],
            defaultId: 1, 
            cancelId: 1,  
            title: 'Confirmation',
            message: `Êtes-vous sûr de vouloir fermer ${APP_TITLE} ?`,
            detail: 'Tous vos panneaux et onglets ouverts seront perdus.'
        });

        // Seul l'index 0 ("Oui, quitter") détruit la fenêtre
        if (response === 0) {
            win.destroy(); 
        }
    });

    // ====== DANS MAIN.JS -> DANS LA FONCTION createWindow() ======

    // AJOUT ICI : Fermer automatiquement l'historique ET les mots de passe 
    // quand la fenêtre principale est détruite par l'utilisateur
    win.on('closed', () => {
        // Ferme la fenêtre d'historique si elle existe
        if (global.historyWindow && !global.historyWindow.isDestroyed()) {
            global.historyWindow.close();
        }
        
        // === CORRECTIF : Ferme la fenêtre des mots de passe si elle existe ===
        if (pwdWindow && !pwdWindow.isDestroyed()) {
            pwdWindow.close();
        }
    });
    


// DANS MAIN.JS -> Tout en bas de la fonction createWindow(), juste avant le dernier }

    // Raccourci global ultra-puissant pour la touche Échap
    win.on('focus', () => {
        globalShortcut.register('Escape', () => {
            if (!win || win.isDestroyed()) return;

            let geometryChanged = false;

            // 1. Si le volet IA est ouvert, on le ferme
            if (isAiSidebarVisible) {
                isAiSidebarVisible = false;
                geometryChanged = true;
                win.webContents.send("toggle-ai-sidebar-keyboard-force", false);
            }

            // 2. Si une tuile est agrandie, on la restaure
            if (maximizedPanelId) {
                const panelIdToRestore = maximizedPanelId;
                maximizedPanelId = null;
                geometryChanged = true;
                win.webContents.send("zoom-changed", maximizedPanelId);

                if (handleViews[panelIdToRestore]) {
                    try { win.removeBrowserView(handleViews[panelIdToRestore]); } catch(e){}
                    delete handleViews[panelIdToRestore];
                }
            }

            // 3. Si un changement a eu lieu, on recalcule l'écran
            if (geometryChanged) {
                forceRebuildSplitters = true;
                resizeViews();
                updatePanelHandles();
            }
        });
    });

    // Sécurité : On libère la touche Échap dès que le navigateur n'est plus au premier plan
    win.on('blur', () => {
        globalShortcut.unregister('Escape');
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

    // 6. Fermer le panneau désormais vide dans la fenêtre principale
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

//      win.webContents.send("panels-updated", collectPanels(rootNode));
        win.webContents.send(
            "panels-updated",
            collectPanels(rootNode),
            maximizedPanelId
        );

    }
}












// DANS MAIN.JS -> Dans la fonction resizeViews()

function resizeViews() {
    if (win.isDestroyed()) return;
    
    // 1. Récupérer la taille réelle de la zone de contenu utile d'Electron
    const bounds = win.getContentBounds();
    
    // CORRECTION ICI : Changez "const" par "let" pour s'autoriser à modifier la variable
    let width = bounds.width; 
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

    // === AJOUT DYNAMIQUE DE L'IA ===
    // Maintenant que width est un "let", cette ligne va fonctionner sans planter !
    if (isAiSidebarVisible) {
        width = width - 300;
    }

    // Le reste de votre fonction reste STRICTEMENT identique...
    layoutNode(rootNode, 0, TOOLBAR_HEIGHT, width, height - TOOLBAR_HEIGHT);

    while (splitterViews.length > splitters.length) {
        const oldSplitter = splitterViews.pop();
        try { win.removeBrowserView(oldSplitter); } catch (e) {}
    }

    const splitterBg = isDarkModeForced ? "#374151" : "#d1d5db";
    const splitterHover = isDarkModeForced ? "#808080" : "#9ca3af";
    const splitterDots = isDarkModeForced ? "#cfcfcf" : "#6b7280";

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
            body { box-sizing: border-box; background: ${splitterBg}; display: flex; align-items: center; justify-content: center; cursor: ${cursor}; }
            #handle { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); display: flex; flex-direction: ${handleDirection}; gap: 2px; }  
            body:hover { background: ${splitterHover}; }
            .dot { display: block; width: 3px; height: 3px; background: ${splitterDots}; border-radius: 50%; }
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

            if (title === "drag-end") { 
                win.setTitle(APP_TITLE);
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

    // 4. Mettre à jour la position des liserés bleus (Placé tout à la fin de resizeViews)
    if (activePanel) {
        const activeNode = findPanelNode(rootNode, activePanel);
        if (activeNode) {
            let targetBounds = null;

            // === REMPLACER PAR CE CODE CORRECTIF ===
            if (maximizedPanelId) {
                if (activePanel === maximizedPanelId) {
                    const bounds = win.getContentBounds();
                    targetBounds = {
                        x: 0,
                        y: TOOLBAR_HEIGHT,
                        width: bounds.width,
                        height: bounds.height - TOOLBAR_HEIGHT
                    };
                }
            } else if (activeNode && activeNode.bounds) {
                // Mode mosaïque standard : On aligne le liseré EXACTEMENT sur les dimensions calculées pour le panneau
                targetBounds = {
                    x: activeNode.bounds.x,
                    y: activeNode.bounds.y,
                    width: activeNode.bounds.width,
                    height: activeNode.bounds.height
                };
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

// À insérer avec vos autres écouteurs "ipcMain.on"
ipcMain.on("print-panel", (event, panelId) => {
    const panel = findPanelNode(rootNode, panelId);
    if (panel && panel.view && !panel.view.webContents.isDestroyed()) {
        // Lance la boîte de dialogue d'impression du système
        panel.view.webContents.print({
            silent: false,           // Affiche la boîte de dialogue système
            printBackground: true,  // Imprime les images et couleurs de fond
            deviceName: ''          // Imprimante par défaut
        });
    }
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

// À ajouter dans main.js avec vos autres ipcMain.handle
ipcMain.handle('clear-favoris', () => {
    try {
        // Écrit un tableau vide dans le fichier des favoris
        fs.writeFileSync(favorisPath, JSON.stringify([]));
        
        // Notifie l'IHM (index.html) pour forcer la mise à jour visuelle immédiate
        if (win && !win.isDestroyed()) {
            win.webContents.send('favoris-updated', []);
        }
        return true;
    } catch (e) {
        console.error("Erreur lors de la suppression des favoris :", e);
        return false;
    }
});

// À ajouter avec vos autres gestionnaires ipcMain (ex: sous ipcMain.handle('get-favoris', ...))

// 1. SAUVEGARDER LA CONFIGURATION DANS UN FICHIER
ipcMain.handle('save-config-to-file', async () => {
    if (!rootNode) return false;

    // Capture la structure actuelle de l'arbre (identique à votre système undo)
    const snapshot = createSnapshot(rootNode);

    const { filePath } = await dialog.showSaveDialog(win, {
        title: "Sauvegarder la configuration des panneaux",
        defaultPath: path.join(app.getPath('documents'), 'hare-browser-layout.json'),
        filters: [
            { name: 'Fichiers Configuration (*.json)', extensions: ['json'] }
        ]
    });

    if (filePath) {
        try {
            await fsPromises.writeFile(filePath, JSON.stringify(snapshot, null, 2), 'utf-8');
            return true;
        } catch (error) {
            console.error("Erreur lors de l'export de la configuration :", error);
            return false;
        }
    }
    return false;
});




// 2. CHARGER LA CONFIGURATION DEPUIS UN FICHIER
ipcMain.handle('load-config-from-file', async () => {
    const { filePaths } = await dialog.showOpenDialog(win, {
        title: "Charger une configuration de panneaux",
        defaultPath: app.getPath('documents'),
        properties: ['openFile'],
        filters: [
            { name: 'Fichiers Configuration (*.json)', extensions: ['json'] }
        ]
    });

    if (filePaths && filePaths.length > 0) {
        try {
            const data = await fsPromises.readFile(filePaths[0], 'utf-8');
            const snapshot = JSON.parse(data);

            // Validation minimale de la structure du fichier pour éviter les crashs
            if (!snapshot || (!snapshot.type)) return false;

            saveState(); // Permet d'annuler (Ctrl+Z) si le chargement ne plaît pas

            // Suppression propre des anciennes vues ouvertes à l'écran
            const oldPanels = collectPanelNodes(rootNode);
            oldPanels.forEach(p => {
                if (p.view) {
                    try { win.removeBrowserView(p.view); p.view.webContents.destroy(); } catch(e) {}
                }
            });

            // Fonction récursive pour reconstruire à la fois les objets PanelNode/SplitNode 
            // ET instancier leurs nouvelles BrowserViews associées
            function rebuildTreeFromImport(node) {
                if (!node) return null;

                if (node.type === "panel") {
                    const viewOptions = {
                        webPreferences: {
                            partition: node.isPrivate ? `incognito_panel_${Math.random()}` : undefined,
                            contextIsolation: true,
                            nodeIntegration: false
                        }
                    };
                    const newView = new BrowserView(viewOptions);
                    win.addBrowserView(newView);
                    newView.webContents.loadURL(node.realUrl || node.url || "https://bing.com");

                    const newNode = new PanelNode(node.id, newView, node.url, !!node.isPrivate);
                    setupNavigationTracking(newNode);
                    return newNode;
                }

                const splitNode = new SplitNode(node.direction);
                splitNode.ratio = node.ratio || 0.5;
                splitNode.first = rebuildTreeFromImport(node.first);
                splitNode.second = rebuildTreeFromImport(node.second);
                return splitNode;
            }

            // Application du nouvel arbre importé
            rootNode = rebuildTreeFromImport(snapshot);
            maximizedPanelId = null; // Sort du mode zoom si actif

            // Définition automatique du focus sur la toute première tuile trouvée
            const firstPanel = findFirstPanel(rootNode);
            if (firstPanel) activePanel = firstPanel.id;

            // Recalcul géométrique complet et notification immédiate à l'IHM
            forceRebuildSplitters = true;
            resizeViews();

            win.webContents.send("panels-updated", collectPanels(rootNode), maximizedPanelId);
            if (firstPanel && firstPanel.bounds) {
                win.webContents.send("active-panel-changed", { id: firstPanel.id, bounds: firstPanel.bounds });
            }

            return true;
        } catch (error) {
            console.error("Erreur lors de l'import de la configuration :", error);
            dialog.showErrorBox("Erreur de chargement", "Le fichier sélectionné est corrompu ou malformé.");
            return false;
        }
    }
    return false;
});



// Dans main.js -> Avec vos autres écouteurs ipcMain

// L'interface IA demande à récupérer le texte de la page active pour son LLM
ipcMain.handle("nanobrowser-get-context", async () => {
    if (!activePanel) return null;
    const panel = findPanelNode(rootNode, activePanel);
    if (!panel || !panel.view) return null;
    
    try {
        return await panel.view.webContents.executeJavaScript("window.NanobrowserExecutor.getPageContent()");
    } catch (e) {
        return null;
    }
});





// DANS MAIN.JS -> Au début de ipcMain.handle("nanobrowser-ask-ollama")

// DANS MAIN.JS -> Remplacer le gestionnaire complet "nanobrowser-ask-ollama"

ipcMain.handle("nanobrowser-ask-ollama", async (event, { prompt, model = "qwen2.5:1.5b" }) => {
    console.log("\n[IA DIAGNOSTIC] Déclenchement de la requête...");
    
    if (!activePanel) {
        console.log("[IA DIAGNOSTIC] Requête rejetée : Aucun panneau n'a le focus.");
        return "SELECT_PANEL_REQUIRED";
    }
    
    console.log("[IA DIAGNOSTIC] Tuile active ciblée :", activePanel);
    const panel = findPanelNode(rootNode, activePanel);
    if (!panel || !panel.view) return "Tuile introuvable.";

    // Déclaration de la variable en dehors de la Promesse pour y avoir accès partout
    let pageContent = null;

    try {
        // 1. Déploiement et exécution de l'injecteur DOM
        const injectorPath = path.join(__dirname, 'nanobrowser', 'injector.js');
        if (fs.existsSync(injectorPath)) {
            const scriptCode = fs.readFileSync(injectorPath, 'utf8');
            await panel.view.webContents.executeJavaScript(scriptCode + "; void 0;");
            console.log("[IA DIAGNOSTIC] Injecteur de texte déployé.");
        }

        // Un micro-délai pour laisser le moteur Chromium enregistrer l'objet dans le scope window
        await new Promise(r => setTimeout(r, 50));

        // 2. Récupération sécurisée du contenu textuel du DOM
        pageContent = await panel.view.webContents.executeJavaScript(`
            (function() {
                if (window.NanobrowserExecutor && typeof window.NanobrowserExecutor.getPageContent === 'function') {
                    return window.NanobrowserExecutor.getPageContent();
                }
                // Secours direct si l'objet window a sauté ou n'est pas prêt :
                return {
                    text: document.body.innerText || "",
                    url: window.location.href || "",
                    title: document.title || ""
                };
            })();
        `);

        if (!pageContent || !pageContent.text) {
            console.log("[IA DIAGNOSTIC] Échec de l'extraction du texte.");
            return "Impossible de lire le texte de la page courante.";
        }
        console.log("[IA DIAGNOSTIC] Contenu capturé avec succès (Longueur :", pageContent.text.length, "caractères).");

    } catch (err) {
        console.error("[IA DIAGNOSTIC] Erreur lors de l'extraction de la page :", err);
        return `Erreur lors de la lecture de la page web : ${err.message}`;
    }

    // 3. Traitement et envoi de la requête asynchrone à Ollama
    return new Promise((resolve) => {
        try {
            let systemInstruction = "";
            if (prompt.toLowerCase().includes("résumé") || prompt.toLowerCase().includes("resume")) {
                systemInstruction = `Tu es un assistant IA. Résume la page web suivante de façon concise en 3 points clés.\nTitre : ${pageContent.title}\nContenu : ${pageContent.text.substring(0, 5000)}`;
            } else {
                systemInstruction = `Tu es un assistant IA intégré au navigateur. Réponds à la question de l'utilisateur en utilisant les informations de la page web courante si nécessaire.\nTitre de la page : ${pageContent.title}\nContenu de la page : ${pageContent.text.substring(0, 5000)}`;
            }

            const postData = JSON.stringify({
                model: model,
                prompt: prompt,
                system: systemInstruction,
                stream: false
            });

            console.log(`[IA DIAGNOSTIC] Envoi de la requête HTTP à Ollama avec le modèle ${model}...`);
            const http = require('http');
            
            const req = http.request({
                hostname: '127.0.0.1',
                port: 11434,
                path: '/api/generate',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                },
                timeout: 120000
            }, (res) => {
                let body = '';
                res.setEncoding('utf8');
                res.on('data', (chunk) => body += chunk);
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(body);
                        console.log("[IA DIAGNOSTIC] Réponse reçue d'Ollama avec succès.");
                        resolve(parsed.response || "L'IA a renvoyé une réponse vide.");
                    } catch (e) {
                        console.log("[IA DIAGNOSTIC] Échec de la lecture du JSON d'Ollama.");
                        resolve("Erreur lors de l'analyse du format de la réponse renvoyée par Ollama.");
                    }
                });
            });

            req.on('error', (e) => {
                console.log("[IA DIAGNOSTIC] ERREUR RÉSEAU OLLAMA :", e.message);
                resolve(`Impossible de joindre l'IA locale. Vérifiez qu'Ollama est démarré en arrière-plan (${e.message}).`);
            });

            req.on('timeout', () => {
                req.destroy();
                console.log("[IA DIAGNOSTIC] ERREUR : Temps d'attente dépassé (Timeout).");
                resolve("L'IA locale a mis trop de temps à répondre (Délai d'attente dépassé).");
            });

            req.write(postData);
            req.end();

        } catch (innerError) {
            console.error("[IA DIAGNOSTIC] Erreur interne dans la promesse Ollama :", innerError);
            resolve(`Erreur interne de traitement : ${innerError.message}`);
        }
    });
});

// L'interface IA demande à exécuter une action (ex: cliquer sur un bouton)
ipcMain.handle("nanobrowser-execute-action", async (event, { actionType, argument }) => {
    if (!activePanel) return "No active panel";
    const panel = findPanelNode(rootNode, activePanel);
    if (!panel || !panel.view) return "Panel not found";
    
    if (actionType === "click") {
        return await panel.view.webContents.executeJavaScript(`window.NanobrowserExecutor.clickElement("${argument}")`);
    }
    // Ajoutez ici les autres types d'actions (scroll, fill, etc.)
});


ipcMain.handle("get-theme-preference", () => {
    return getThemePreference();
});

ipcMain.handle("save-theme-preference", (event, isDark) => {

    isDarkModeForced = isDark;

    fs.writeFileSync(
        themePath,
        JSON.stringify({ darkMode: isDark }, null, 2)
    );

    return true;
});

// ====== AVEC LES AUTRES IPCMAIN (EX: SOUS LES ÉCOUTEURS DE FAVORIS) ======
ipcMain.handle('get-history', () => {
    return getNavigationHistory();
});



ipcMain.handle('clear-history', async () => {
    await safeWriteJsonAsync(historyPath, []); // <-- Remplacement ici
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

// Remplacement du gestionnaire d'ajout/suppression des favoris
ipcMain.handle('toggle-favori', async (event, { url, title }) => {
    try {
        let favoris = getFavoris();
        const index = favoris.findIndex(f => f.url === url);

        if (index >= 0) {
            favoris.splice(index, 1);
        } else {
            favoris.push({ url, title: title || url });
        }

        // Sauvegarde sécurisée, asynchrone et atomique (.tmp -> renommé)
        await safeWriteJsonAsync(favorisPath, favoris); 
        
        if (win && !win.isDestroyed()) {
            win.webContents.send('favoris-updated', favoris);
        }
        return index < 0; // Renvoie vrai si ajouté, faux si retiré
    } catch (error) {
        console.error("Erreur lors du toggle-favori :", error);
        return false;
    }
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




// Ligne temporaire pour vider le fichier des favoris sur le disque
//  fs.writeFileSync(path.join(app.getPath('userData'), 'favoris.json'), JSON.stringify([]));

app.on('will-quit', () => {
    globalShortcut.unregisterAll();
});

app.whenReady().then(createWindow);


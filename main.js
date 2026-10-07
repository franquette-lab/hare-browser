// ---------------- //
// SCRIPT : main.js //
// ---------------- //

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
    screen,
    webContents,
    safeStorage, // <-- Assurez-vous que safeStorage est bien présent dans vos imports Electron
    session
} = require('electron');

const { extractMainArticleContent } = require('./nanobrowser/readability-light.js');


/**
 * Active le filtre publicitaire sur une session Electron spécifique.
 * @param {Session} targetSession - La session d'un panneau public ou privé.
 */
function enableAdBlockerForSession(targetSession) {
    if (!targetSession || !targetSession.webRequest) return;
    registerDownloadHandler(targetSession);

    // Filtre toutes les requêtes initiées par les protocoles HTTP/HTTPS
    const filter = { urls: ['http://*/*', 'https://*/*'] };

    targetSession.webRequest.onBeforeRequest(filter, (details, callback) => {
        const url = details.url.toLowerCase();

        if (isAdBlockExceptionRequest(details)) {
            callback({ cancel: false });
            return;
        }
        
        // Vérifie si l'URL contient l'un des filtres de la liste noire
        const shouldBlock = AD_BLOCKLIST.some(pattern => url.includes(pattern));

        if (shouldBlock) {
            console.log(`[ADBLOCK] Requête bloquée avec succès : ${details.url}`);
            // Annule le chargement de la ressource publicitaire avant son départ
            callback({ cancel: true });
        } else {
            // Laisse passer la requête légitime
            callback({ cancel: false });
        }
    });
}

function normalizeAdBlockHost(value) {
    if (typeof value !== "string" || !value.trim()) return "";
    try {
        const input = value.trim();
        return new URL(input.includes("://") ? input : `https://${input}`).hostname
            .toLowerCase()
            .replace(/\.$/, "")
            .replace(/^www\./, "");
    } catch {
        return "";
    }
}

function isAdBlockExceptionHost(hostname) {
    const host = normalizeAdBlockHost(hostname);
    if (!host) return false;
    return Array.from(adBlockExceptions).some((exception) =>
        host === exception || host.endsWith(`.${exception}`)
    );
}

async function toggleAdBlockException(hostname) {
    const host = normalizeAdBlockHost(hostname);
    if (!host) return Array.from(adBlockExceptions);

    if (adBlockExceptions.has(host)) {
        adBlockExceptions.delete(host);
    } else {
        adBlockExceptions.add(host);
    }

    const updatedExceptions = Array.from(adBlockExceptions).sort();
    await safeWriteJsonAsync(getAdBlockExceptionsPath(), updatedExceptions);
    if (win && !win.isDestroyed()) {
        win.webContents.send('adblock-exceptions-updated', updatedExceptions);
    }
    return updatedExceptions;
}

function isAdBlockExceptionRequest(details) {
    let requestHost = "";
    try {
        requestHost = new URL(details.url).hostname;
    } catch {}

    // N'autorise la destination directement que pour une navigation principale;
    // les ressources tierces ne sont autorisées que si leur page initiatrice l'est.
    if (details.resourceType === "mainFrame" && isAdBlockExceptionHost(requestHost)) {
        return true;
    }

    let initiatorHost = "";
    try {
        initiatorHost = new URL(details.initiator).hostname;
    } catch {}
    if (isAdBlockExceptionHost(initiatorHost)) return true;

    // Certains types de requêtes Chromium ne fournissent pas d'initiateur.
    if (!details.initiator && details.resourceType !== "mainFrame" && Number.isInteger(details.webContentsId)) {
        const sourceContents = webContents.fromId(details.webContentsId);
        if (sourceContents && !sourceContents.isDestroyed()) {
            try {
                return isAdBlockExceptionHost(new URL(sourceContents.getURL()).hostname);
            } catch {}
        }
    }
    return false;
}


function createSandboxedBrowserView(options = {}) {
    const webPreferences = options.webPreferences || {};
    return new BrowserView({
        ...options,
        webPreferences: {
            ...webPreferences,
            preload: webPreferences.preload || path.join(__dirname, 'preload-tile.js'),
            sandbox: true,
            contextIsolation: true,
            nodeIntegration: false
        }
    });
}


// Conteneurs de tuiles : une partition persistante par conteneur (cookies/stockage isolés, conservés entre les lancements).
const TILE_CONTAINERS = {
    perso: { label: "Personnel", color: "#3b82f6" },
    travail: { label: "Travail", color: "#f97316" },
    compte2: { label: "Compte 2", color: "#10b981" },
    compte3: { label: "Compte 3", color: "#ec4899" }
};
const configuredContainerSessions = new Set();

function isValidContainerId(containerId) {
    return typeof containerId === "string" && Object.prototype.hasOwnProperty.call(TILE_CONTAINERS, containerId);
}

function getContainerSession(containerId) {
    const containerSession = session.fromPartition(`persist:container_${containerId}`);
    if (!configuredContainerSessions.has(containerId)) {
        configuredContainerSessions.add(containerId);
        enableAdBlockerForSession(containerSession);
    }
    return containerSession;
}


// 🌟 CONFIGURATION LOGS CHROMIUM : Masque les alertes et erreurs de routage internes (Mojo/Blink)
// '3' coupe les logs de niveau INFO, WARNING et ERROR natifs de Chromium, ne laissant que les crashs critiques.
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';
app.commandLine.appendSwitch('log-level', '3'); 

// === CORRECTIF ALERTE SECURITE WINDOWS ===
// Force Electron à utiliser une clé de chiffrement alternative interne au lieu de solliciter 
// l'API de protection Windows (DPAPI) qui génère l'invite d'identité bloquante en développement.
if (typeof safeStorage.setUseAlternativeEncryption === 'function') {
    safeStorage.setUseAlternativeEncryption(true);
}

const APP_TITLE = "Hare Browser";
const SEARCH_ENGINE_HOST = "129.151.254.175";

// === CONFIGURATION DU BLOQUEUR DE PUBLICITÉS (ADBLOCKER) ===
// Liste de blocage simplifiée (Hôtes et mots-clés de trackers/pubs connus)
const AD_BLOCKLIST = [
    'googlesyndication.com',
    'google-analytics.com',
    'doubleclick.net',
    'adservice.google',
    '://twitter.com',
    'connect.facebook.net',
    'scorecardresearch.com',
    '/ads/',
    '/adserver/',
    'tracking'
];

let adBlockExceptions = new Set();



// Les modules Node sont chargés au premier accès, puis conservés en cache.
const nodeModuleCache = new Map();
function getNodeModule(moduleName) {
    if (!nodeModuleCache.has(moduleName)) {
        nodeModuleCache.set(moduleName, require(moduleName));
    }
    return nodeModuleCache.get(moduleName);
}

function lazyNodeModule(moduleName) {
    return new Proxy(Object.create(null), {
        get(_target, property) {
            const module = getNodeModule(moduleName);
            const value = module[property];
            return typeof value === "function" ? value.bind(module) : value;
        }
    });
}

const fs = lazyNodeModule("fs");
const fsPromises = lazyNodeModule("fs/promises");
const path = lazyNodeModule("path");

function getPathToFileURL(filePath) {
    return getNodeModule("url").pathToFileURL(filePath);
}

function getHomePageUrl() {
    return getPathToFileURL(path.join(__dirname, "home.html")).href;
}

const appDataPath = app.getPath('userData');

const splitters = [];

// REMPLACEZ : const historyPath = path.join(__dirname, 'navigation_history.json');
// PAR CE CHEMIN SÉCURISÉ (Dans AppData comme vos favoris) :
function getHistoryPath() {
    return path.join(appDataPath, 'navigation_history.json');
}

// Chemin vers le fichier de stockage des favoris
function getFavorisPath() {
    return path.join(appDataPath, 'favoris.json');
}

function getAdBlockExceptionsPath() {
    return path.join(appDataPath, 'adblock-exceptions.json');
}

function getThemePath() {
    return path.join(appDataPath, 'theme.json');
}

function getAutoSleepPath() {
    return path.join(appDataPath, 'autosleep.json');
}

function getAiSidebarPath() {
    return path.join(appDataPath, 'ai-sidebar.json');
}

function getSessionLayoutPath() {
    return path.join(appDataPath, 'last-session-layout.json');
}

// Stockage des 4 bordures bleues
let borderViews = []; 

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


// ==========================================
// ✨ PLACEZ LES DEUX LIGNES ICI TOUT EN HAUT
// ==========================================
const PANEL_IDLE_TIMEOUT = 15 * 60 * 1000;
let isAutoSleepEnabled = true; 


const panelIdleTimers = new Map();


let autoSleepEnabled = true;


function loadAutoSleepPreference() {
    try {
        const settings = JSON.parse(fs.readFileSync(getAutoSleepPath(), "utf-8"));
        autoSleepEnabled = typeof settings.enabled === "boolean" ? settings.enabled : true;
    } catch (error) {
        autoSleepEnabled = true;
        if (error.code !== "ENOENT") {
            console.error("Impossible de lire la préférence de veille automatique :", error);
        }
        saveAutoSleepPreference();
    }
    return autoSleepEnabled;
}

function saveAutoSleepPreference() {
    try {
        fs.mkdirSync(appDataPath, { recursive: true });
        fs.writeFileSync(getAutoSleepPath(), JSON.stringify({ enabled: autoSleepEnabled }, null, 2), "utf-8");
    } catch (error) {
        console.error("Impossible d’enregistrer la préférence de veille automatique :", error);
    }
}

// En haut de main.js avec vos autres variables globales (ex: sous let handleViews = {})
let activeDownloads = {}; 

// Stocke l'ID du panneau actuellement zoomé/maximisé au premier plan (null si aucun)
let maximizedPanelId = null; 

// En haut de main.js, à la place de const TOOLBAR_HEIGHT = 105;
let isBookmarksBarVisible = true; // La barre est affichée par défaut

let TOOLBAR_HEIGHT = 76;
const TOOLBAR_MIN_HEIGHT = 77;
const FULLSCREEN_COLLAPSED_TOOLBAR_HEIGHT = 8;
let normalToolbarHeight = TOOLBAR_HEIGHT;
let isFullscreenMode = false;
let isFullscreenToolbarVisible = true;
let lastAiSidebarTopPosition = TOOLBAR_HEIGHT;

let history = [];
let lastClosedPanel = null;

const SPLITTER_SIZE = 10;

let leftView, centerView, rightView;
let isDarkModeForced = false;

let isAiSidebarVisible = true; // Par défaut, le volet est ouvert désormais
let isAiSidebarWide = false;
let lastAiSidebarWidth = 300;

function getAiSidebarWidth(windowWidth) {
    return isAiSidebarWide ? Math.max(300, Math.min(760, Math.round(windowWidth * 0.6))) : 300;
}

ipcMain.on("set-ai-sidebar-wide", (_event, wide) => {
    const next = wide === true;
    if (next === isAiSidebarWide) return;
    isAiSidebarWide = next;
    resizeViews();
});

function loadAiSidebarPreference() {
    try {
        const preference = JSON.parse(fs.readFileSync(getAiSidebarPath(), "utf-8"));
        isAiSidebarVisible = typeof preference.visible === "boolean" ? preference.visible : true;
    } catch (error) {
        isAiSidebarVisible = true;
        if (error.code !== "ENOENT") {
            console.error("Impossible de lire la préférence du volet IA :", error);
        }
        saveAiSidebarPreference();
    }
    return isAiSidebarVisible;
}

function saveAiSidebarPreference() {
    try {
        fs.mkdirSync(appDataPath, { recursive: true });
        fs.writeFileSync(getAiSidebarPath(), JSON.stringify({ visible: isAiSidebarVisible }, null, 2), "utf-8");
    } catch (error) {
        console.error("Impossible d’enregistrer la préférence du volet IA :", error);
    }
}

function setAiSidebarVisible(visible) {
    isAiSidebarVisible = visible === true;
    saveAiSidebarPreference();

    forceRebuildSplitters = true;
    resizeViews();

    if (win && !win.isDestroyed()) {
        win.webContents.send("ai-sidebar-visibility-changed", isAiSidebarVisible);
        win.webContents.send("ai-sidebar-geometry-update", { topPosition: TOOLBAR_HEIGHT });
    }
    return isAiSidebarVisible;
}

let pwdWindow = null;
const findInPageRequests = new Map();

function setNormalToolbarHeight(height) {
    normalToolbarHeight = height;
    if (!isFullscreenMode || isFullscreenToolbarVisible) {
        TOOLBAR_HEIGHT = height;
        forceRebuildSplitters = true;
        resizeViews();
    }
}

function setFullscreenToolbarVisible(visible) {
    if (!isFullscreenMode || !win || win.isDestroyed()) return;

    isFullscreenToolbarVisible = visible;
    TOOLBAR_HEIGHT = visible ? normalToolbarHeight : FULLSCREEN_COLLAPSED_TOOLBAR_HEIGHT;
    win.webContents.send("fullscreen-toolbar-state", {
        fullscreen: true,
        visible
    });
    forceRebuildSplitters = true;
    resizeViews();
}

function updatePasswordWindowContent() {
    if (pwdWindow && !pwdWindow.isDestroyed()) {
        const passwordList = getStoredPasswords();
        pwdWindow.webContents.send('render-passwords', {
            list: passwordList,
            isDarkMode: isDarkModeForced
        });
    }
}

function afficherMenuContextuelPanneau(webContents, x, y) {
    const panel = findPanelByWebContents(webContents);
    const panelId = panel ? panel.id : activePanel;
    if (!panelId) return;

    const targetPanel = findPanelNode(rootNode, panelId);
    const isPrivate = targetPanel ? targetPanel.isPrivate : false;
    let currentSiteHost = "";
    try {
        const currentUrl = targetPanel?.view?.webContents?.getURL() || "";
        const parsedUrl = new URL(currentUrl);
        if (parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:") {
            currentSiteHost = normalizeAdBlockHost(parsedUrl.hostname);
        }
    } catch {}
    const siteHasAdBlockException = currentSiteHost && isAdBlockExceptionHost(currentSiteHost);

    // NOUVEAU : Détecter si le mode zoom/maximisé est actif sur le navigateur
    const isZoomActive = maximizedPanelId !== null;

    const menuTemplate = [
        {
            label: "✏️ Édition",
            enabled: false
        },
        { role: "cut", label: "   ✂️ Couper" },
        { role: "copy", label: "   📋 Copier" },
        { role: "paste", label: "   📌 Coller" },
        { role: "delete", label: "   🗑️ Supprimer" },
        { type: "separator" },
        { role: "selectAll", label: "   Sélectionner tout" },
        ...(currentSiteHost ? [
            { type: "separator" },
            {
                label: `   🛡️ ${siteHasAdBlockException ? "Réactiver" : "Désactiver"} le bloqueur sur ${currentSiteHost}`,
                click: async () => {
                    await toggleAdBlockException(currentSiteHost);
                    const panelToReload = findPanelNode(rootNode, panelId);
                    if (panelToReload?.view && !panelToReload.view.webContents.isDestroyed()) {
                        panelToReload.view.webContents.reload();
                    }
                }
            }
        ] : []),





        { type: "separator" },

        {
            label: "   ✂️ Scinder verticalement (Ctrl+T)",
            enabled: !isZoomActive, // Grisé si zoom actif
            click: () => ipcMain.emit('split-panel', null, panelId, 'vertical', false)
        },
        {
            label: "   ⚍ Scinder horizontalement (Ctrl+H)",
            enabled: !isZoomActive, // Grisé si zoom actif
            click: () => ipcMain.emit('split-panel', null, panelId, 'horizontal', false)
        },





        {
            label: isPrivate ? "   🕵️ Ouvrir une tuile publique classique" : "   🕵️ Scinder en Navigation Privée (Ctrl+Shift+N)",
            enabled: !isZoomActive,
            click: () => ipcMain.emit('split-panel', null, panelId, 'vertical', !isPrivate)
        },
        {
            label: "   🗂️ Scinder dans un conteneur isolé (comptes multiples)",
            enabled: !isZoomActive && !isPrivate,
            submenu: Object.entries(TILE_CONTAINERS).map(([id, container]) => ({
                label: container.label,
                click: () => ipcMain.emit('split-panel', null, panelId, 'vertical', false, id)
            }))
        },
        
        // === AJOUT : DUPLICATION DE TUILE À LA VOLÉE ===
        {
            label: "   📋 Dupliquer cette tuile (Ctrl+Shift+D)",
            enabled: !isZoomActive,
            click: () => {
                if (webContents && !webContents.isDestroyed()) {
                    const currentUrl = webContents.getURL();
                    // On transmet l'ID du panneau cible, l'URL à cloner, et le statut privé
                    ipcMain.emit('duplicate-panel', panelId, currentUrl, isPrivate);
                }
            }
        },


        { type: "separator" },

        // =========================================================================
        // ✨ NOUVEAU : ENTRÉE DYNAMIQUE POUR L'AUTO-VEILLE DANS LE MENU CONTEXTUEL
        // =========================================================================
        // =========================================================================
        // ✨ VERSION CORRIGÉE : ÉVITE LE CRASH IPC EN MODIFIANT DIRECTEMENT L'ÉTAT
        // =========================================================================
        {
            label: isAutoSleepEnabled 
                ? "   💤 Désactiver la veille automatique (15 min)" 
                : "   💤 Activer la veille automatique (15 min)",
            type: "checkbox",
            checked: isAutoSleepEnabled,
            click: () => {
                isAutoSleepEnabled = !isAutoSleepEnabled;
                console.log(`[Auto-Sleep Menu] Mode changé : ${isAutoSleepEnabled ? "ACTIVÉ" : "DÉSACTIVÉ"}`);

                if (!isAutoSleepEnabled) {
                    // Si désactivé, on nettoie immédiatement tous les minuteurs actifs
                    panelIdleTimers.forEach((timer) => clearTimeout(timer));
                    panelIdleTimers.clear();
                } else {
                    // Si réactivé, on replanifie la veille pour toutes les tuiles actives
                    const activePanels = collectPanelNodes(rootNode);
                    activePanels.forEach(panel => {
                        if (!panel.isSleeping) markPanelActivity(panel);
                    });
                }

                // 1. Informe l'IHM (index.html) pour synchroniser l'icône de la barre d'outils
                if (win && !win.isDestroyed()) {
                    win.webContents.send('autosleep-state-changed', isAutoSleepEnabled);
                }

                // 2. Sauvegarde immédiate dans theme.json
                safeWriteJsonAsync(getThemePath(), { 
                    darkMode: isDarkModeForced, 
                    autoSleep: isAutoSleepEnabled 
                });
            }
        },

        { type: "separator" },


        {
            label: "   📐 Égaliser les dimensions des tuiles (Ctrl+Shift+R)",
            // Calcul direct et sécurisé : désactivé si zoom actif OU s'il y a 1 tuile ou moins
            enabled: !(maximizedPanelId !== null || collectPanelNodes(rootNode).length <= 1),
            click: () => {
                if (!rootNode) return;
                saveState(); // Permet d'annuler avec Ctrl+Z
                resetTreeRatiosEqual(rootNode); // Réinitialise les ratios à 0.5
                forceRebuildSplitters = true;
                resizeViews(); // Relance le calcul géométrique
            }
        },

        { type: "separator" },
        {
            label: `✨ Actions IA (Assistant)`,
            enabled: false
        },
        {
            label: "   📝 Résumer cette tuile web",
            click: () => {
                if (win && !win.isDestroyed()) {
                    if (!isAiSidebarVisible) setAiSidebarVisible(true);
                    win.webContents.send("trigger-ai-action", { action: "resume" });
                }
            }
        },
        {
            label: "   🔍 Analyser les mots-clés de la page",
            click: () => {
                if (win && !win.isDestroyed()) {
                    if (!isAiSidebarVisible) setAiSidebarVisible(true);
                    win.webContents.send("trigger-ai-action", { action: "keywords" });
                }
            }
        },


        { type: "separator" },
        {
            label: "📌 Gestion du panneau",
            enabled: false
        },




        {
            label: maximizedPanelId === panelId ? "   🗗 Restaurer la taille de la mosaïque (Échap)" : "    🗖 Maximiser cette tuile (Ctrl+M)",
            click: () => {
                maximizedPanelId = maximizedPanelId === panelId ? null : panelId;
                forceRebuildSplitters = true;
                resizeViews();
                win.webContents.send("zoom-changed", maximizedPanelId);
                updatePanelHandles();
            }
        },
        {
            label: "   🖨️ Imprimer le contenu de la page (Ctrl+P)",
            click: () => ipcMain.emit('print-panel', null, panelId)
        },
        {
            label: "   ❌ Fermer cette tuile (Ctrl+W)",
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

    const scriptToInject = `
        (function() {
            const themeClass = ${JSON.stringify(isDarkModeForced ? "mw-theme-client-dark" : "mw-theme-client-light")};
            const otherThemeClass = ${JSON.stringify(isDarkModeForced ? "mw-theme-client-light" : "mw-theme-client-dark")};
            document.documentElement.classList.add(themeClass);
            document.documentElement.classList.remove(otherThemeClass);
            if (document.body) {
                document.body.classList.add(themeClass);
                document.body.classList.remove(otherThemeClass);
            }
        })();
    `;

    view.webContents.executeJavaScript(scriptToInject).catch(console.error);
}

function updateSplitterTheme() {
    splitterViews.forEach((splitterView) => {
        splitterView.webContents.reload();
    });
}

async function getThemePreference() {
    try {
        const rawPreference = await fsPromises.readFile(getThemePath(), "utf8");
        const preference = JSON.parse(rawPreference);
        return typeof preference.darkMode === "boolean" ? preference.darkMode : false;
    } catch (error) {
        if (error.code === "ENOENT") {
            try {
                await fsPromises.writeFile(
                    getThemePath(),
                    JSON.stringify({ darkMode: false }, null, 2),
                    "utf8"
                );
            } catch (writeError) {
                console.error("Impossible de créer le fichier de thème :", writeError);
            }
        } else {
            console.error("Impossible de lire les préférences de thème :", error);
        }
        return false;
    }
}

// ====== FONCTION DE SAUVEGARDE ASYNCHRONE ET ATOMIQUE SÉCURISÉE ======
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

function getPasswordsPath() {
    return path.join(appDataPath, 'passwords.json');
}

// Forçage de l'encryption alternative (à placer juste avant app.whenReady())
/*
app.on('ready', () => {
    if (safeStorage && typeof safeStorage.setUseAlternativeEncryption === 'function') {
        safeStorage.setUseAlternativeEncryption(true);
    }
});
*/
// Forçage de l'encryption alternative et initialisation de l'adblocker global
app.on('ready', () => {
    if (safeStorage && typeof safeStorage.setUseAlternativeEncryption === 'function') {
        safeStorage.setUseAlternativeEncryption(true);
    }
    
    // Charge les exceptions avant d'attacher le filtre aux sessions Electron.
    try {
        fs.mkdirSync(appDataPath, { recursive: true });
        const rawExceptions = fs.readFileSync(getAdBlockExceptionsPath(), 'utf-8');
        const parsedExceptions = JSON.parse(rawExceptions);
        if (Array.isArray(parsedExceptions)) {
            adBlockExceptions = new Set(parsedExceptions.map(normalizeAdBlockHost).filter(Boolean));
        } else {
            throw new Error('Le fichier des exceptions doit contenir un tableau JSON.');
        }
    } catch (error) {
        if (error.code !== 'ENOENT') {
            console.error('[ADBLOCK] Impossible de lire les exceptions :', error);
        }
        adBlockExceptions = new Set();
        try {
            fs.writeFileSync(getAdBlockExceptionsPath(), JSON.stringify([], null, 2), 'utf-8');
        } catch (writeError) {
            console.error('[ADBLOCK] Impossible de créer le fichier des exceptions :', writeError);
        }
    }

    // 🔥 Activation du bloqueur sur la session par défaut (tuiles classiques)
    enableAdBlockerForSession(session.defaultSession);
});



ipcMain.handle('adblock-get-exceptions', (event) => {
    if (!win || win.isDestroyed() || event.sender !== win.webContents) return [];
    return Array.from(adBlockExceptions);
});

ipcMain.handle('adblock-toggle-exception', async (event, requestedHost) => {
    if (!win || win.isDestroyed() || event.sender !== win.webContents) {
        return Array.from(adBlockExceptions);
    }

    const host = normalizeAdBlockHost(requestedHost);
    if (!host) return Array.from(adBlockExceptions);

    if (adBlockExceptions.has(host)) {
        adBlockExceptions.delete(host);
    } else {
        adBlockExceptions.add(host);
    }

    const updatedExceptions = Array.from(adBlockExceptions).sort();
    await safeWriteJsonAsync(getAdBlockExceptionsPath(), updatedExceptions);
    if (win && !win.isDestroyed()) {
        win.webContents.send('adblock-exceptions-updated', updatedExceptions);
    }
    return updatedExceptions;
});

function getStoredPasswords() {
    try {
        // Sécurité absolue : si le fichier n'existe pas, on le crée tout de suite proprement
        if (!fs.existsSync(getPasswordsPath())) {
            fs.writeFileSync(getPasswordsPath(), JSON.stringify([], null, 2), 'utf-8');
            return [];
        }
        
        const rawData = fs.readFileSync(getPasswordsPath(), 'utf-8');
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
        await safeWriteJsonAsync(getPasswordsPath(), encryptedList);
        return true;
    } catch (e) {
        console.error("[PWD] Erreur écriture securisee :", e);
        return false;
    }
}




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
            preload: path.join(__dirname, 'preload-passwords.js'),
            sandbox: true,
            nodeIntegration: false,
            contextIsolation: true
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
        if (!fs.existsSync(getHistoryPath())) {
            // Utilisation d'un tableau vide de secours si le fichier n'existe pas
            fs.writeFileSync(getHistoryPath(), JSON.stringify([], null, 2), 'utf-8');
            return [];
        }
        const data = fs.readFileSync(getHistoryPath(), 'utf-8');
        
        // Sécurité si le fichier existe mais est totalement vide (0 Ko)
        if (!data.trim()) {
            fs.writeFileSync(getHistoryPath(), JSON.stringify([], null, 2), 'utf-8');
            return [];
        }
        
        return JSON.parse(data);
    } catch (e) {
        console.error("Erreur lecture historique (Fichier corrompu ou vide), réinitialisation :", e);
        // En cas de fichier JSON malformé, on réinitialise pour éviter le crash permanent
        try { fs.writeFileSync(getHistoryPath(), JSON.stringify([], null, 2), 'utf-8'); } catch(err) {}
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
        await safeWriteJsonAsync(getHistoryPath(), historyList);
        
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
        if (!fs.existsSync(getFavorisPath())) {
            // Création d'un tableau de favoris vide par défaut
            fs.writeFileSync(getFavorisPath(), JSON.stringify([], null, 2), 'utf-8');
            return [];
        }
        const data = fs.readFileSync(getFavorisPath(), 'utf-8');
        
        // Sécurité si le fichier existe mais est totalement vide (0 Ko)
        if (!data.trim()) {
            fs.writeFileSync(getFavorisPath(), JSON.stringify([], null, 2), 'utf-8');
            return [];
        }
        
        return JSON.parse(data);
    } catch (e) {
        console.error("Erreur lors de la lecture des favoris (Fichier corrompu ou vide), réinitialisation :", e);
        // Réparation automatique en cas de fichier JSON corrompu
        try { fs.writeFileSync(getFavorisPath(), JSON.stringify([], null, 2), 'utf-8'); } catch(err) {}
        return [];
    }
}

const registeredDownloadSessions = new WeakSet();
const MAX_DOWNLOAD_ENTRIES = 100;
let downloadsList = [];
let nextDownloadId = 1;
let downloadsWindow = null;
let downloadsNotifyTimer = null;
const liveDownloadItems = new Map();

function getDownloadsPath() {
    return path.join(appDataPath, 'downloads.json');
}

function loadDownloadsList() {
    try {
        const stored = JSON.parse(fs.readFileSync(getDownloadsPath(), 'utf-8'));
        if (!Array.isArray(stored)) return;
        downloadsList = stored
            .filter((entry) => entry && typeof entry.filename === 'string')
            .slice(0, MAX_DOWNLOAD_ENTRIES)
            .map((entry) => ({
                id: nextDownloadId++,
                filename: entry.filename,
                path: typeof entry.path === 'string' ? entry.path : '',
                source: typeof entry.source === 'string' ? entry.source : '',
                state: entry.state === 'completed' || entry.state === 'cancelled' ? entry.state : 'interrupted',
                received: Number(entry.received) || 0,
                total: Number(entry.total) || 0,
                startedAt: Number(entry.startedAt) || 0,
                isPrivate: false
            }));
    } catch (error) {
        if (error.code !== 'ENOENT') console.error('Impossible de lire la liste des téléchargements :', error);
    }
}

// Les téléchargements des tuiles privées ne sont jamais écrits sur disque.
function saveDownloadsList() {
    void safeWriteJsonAsync(getDownloadsPath(), downloadsList.filter((entry) => !entry.isPrivate && entry.state !== 'progressing'));
}

function updateDownloadsWindowContent() {
    if (!downloadsWindow || downloadsWindow.isDestroyed()) return;
    const list = downloadsList.map((entry) => ({
        ...entry,
        fileExists: entry.state === 'completed' && !!entry.path && fs.existsSync(entry.path)
    }));
    downloadsWindow.setBackgroundColor(isDarkModeForced ? '#1e1e1e' : '#f9fafb');
    downloadsWindow.webContents.send('render-downloads', { list, isDarkMode: isDarkModeForced });
}

function notifyDownloadsChanged(immediate = false) {
    if (immediate) {
        if (downloadsNotifyTimer) clearTimeout(downloadsNotifyTimer);
        downloadsNotifyTimer = null;
        updateDownloadsWindowContent();
        return;
    }
    if (downloadsNotifyTimer) return;
    downloadsNotifyTimer = setTimeout(() => {
        downloadsNotifyTimer = null;
        updateDownloadsWindowContent();
    }, 250);
}

function findDownloadEntry(id) {
    return downloadsList.find((entry) => entry.id === Number(id));
}

ipcMain.on('open-downloads-window', () => {
    if (downloadsWindow && !downloadsWindow.isDestroyed()) {
        downloadsWindow.focus();
        updateDownloadsWindowContent();
        return;
    }

    downloadsWindow = new BrowserWindow({
        width: 520,
        height: 560,
        title: 'Téléchargements',
        backgroundColor: isDarkModeForced ? '#1e1e1e' : '#f9fafb',
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload-downloads.js'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true
        }
    });
    const thisWindow = downloadsWindow;
    thisWindow.loadFile(path.join(__dirname, 'downloads.html'));
    thisWindow.webContents.on('did-finish-load', updateDownloadsWindowContent);
    thisWindow.on('closed', () => {
        if (downloadsWindow === thisWindow) downloadsWindow = null;
    });
});

function isFromDownloadsWindow(event) {
    return downloadsWindow && !downloadsWindow.isDestroyed() && event.sender === downloadsWindow.webContents;
}

ipcMain.on('downloads-open-folder', (event, id) => {
    if (!isFromDownloadsWindow(event)) return;
    const entry = findDownloadEntry(id);
    if (entry && entry.path) shell.showItemInFolder(entry.path);
});

ipcMain.on('downloads-cancel', (event, id) => {
    if (!isFromDownloadsWindow(event)) return;
    const item = liveDownloadItems.get(Number(id));
    if (item) item.cancel();
});

ipcMain.on('downloads-remove', (event, id) => {
    if (!isFromDownloadsWindow(event)) return;
    const item = liveDownloadItems.get(Number(id));
    if (item) item.cancel();
    downloadsList = downloadsList.filter((entry) => entry.id !== Number(id));
    saveDownloadsList();
    notifyDownloadsChanged(true);
});

ipcMain.on('downloads-clear', (event) => {
    if (!isFromDownloadsWindow(event)) return;
    downloadsList = downloadsList.filter((entry) => entry.state === 'progressing');
    saveDownloadsList();
    notifyDownloadsChanged(true);
});

function registerDownloadHandler(session) {
    if (!session || registeredDownloadSessions.has(session)) return;
    registeredDownloadSessions.add(session);

    session.on('will-download', (event, item, webContents) => {
        const filename = item.getFilename();

        const panelNode = findPanelByWebContents(webContents);
        const panelId = panelNode ? panelNode.id : activePanel;

        // On enregistre l'objet de téléchargement pour ce panneau
        activeDownloads[panelId] = item;

        let source = '';
        try { source = new URL(item.getURL()).hostname.replace(/^www\./, ''); } catch {}
        const entry = {
            id: nextDownloadId++,
            filename,
            path: '',
            source,
            state: 'progressing',
            received: 0,
            total: item.getTotalBytes(),
            startedAt: Date.now(),
            isPrivate: panelNode?.isPrivate === true
        };
        downloadsList.unshift(entry);
        while (downloadsList.length > MAX_DOWNLOAD_ENTRIES) {
            const oldestIndex = downloadsList.map((e) => e.state).lastIndexOf('completed');
            downloadsList.splice(oldestIndex >= 0 ? oldestIndex : downloadsList.length - 1, 1);
        }
        liveDownloadItems.set(entry.id, item);
        notifyDownloadsChanged(true);

        item.on('updated', (_event, state) => {
            entry.received = item.getReceivedBytes();
            entry.total = item.getTotalBytes();
            entry.path = item.getSavePath() || entry.path;
            if (state === 'interrupted') entry.state = 'interrupted';
            notifyDownloadsChanged();
        });

        item.once('done', (_event, state) => {
            entry.state = state === 'completed' ? 'completed' : (state === 'cancelled' ? 'cancelled' : 'interrupted');
            entry.path = item.getSavePath() || entry.path;
            entry.received = item.getReceivedBytes();
            liveDownloadItems.delete(entry.id);
            saveDownloadsList();
            notifyDownloadsChanged(true);
            // Une fen\u00eatre d\u00e9j\u00e0 ouverte est seulement rafra\u00eechie, sans voler le focus.
            if (entry.state === 'completed' && (!downloadsWindow || downloadsWindow.isDestroyed())) {
                ipcMain.emit('open-downloads-window');
            }
        });

        item.on('updated', (event, state) => {
            if (state === 'progressing' && !item.isPaused()) {
                const totalBytes = item.getTotalBytes();
                const receivedBytes = item.getReceivedBytes();
                
                if (totalBytes > 0) {
                    const percent = Math.round((receivedBytes / totalBytes) * 100);
                    // AJOUT SÉCURITÉ : On vérifie que la fenêtre et ses webContents ne sont pas détrits
                    if (win && !win.isDestroyed() && win.webContents && !win.webContents.isDestroyed()) {
                        win.webContents.send('download-progress', { panelId, percent, filename });
                    }
                }
            }
        });

        item.once('done', (event, state) => {
            // Nettoyage de la référence
            delete activeDownloads[panelId];

            // AJOUT SÉCURITÉ : On vérifie que la fenêtre et ses webContents ne sont pas détrits
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


function updateActiveBorder(bounds, options) {
    if (!bounds || !win || win.isDestroyed()) return;

    const BORDER_THICKNESS = 2;
    const skipRaise = options && options.skipRaise;

    // 1. Déterminer si le panneau actuellement actif est privé pour adapter la couleur
    const currentActivePanelNode = findPanelNode(rootNode, activePanel);
    const isPrivateMode = currentActivePanelNode ? currentActivePanelNode.isPrivate === true : false;
    
    // ✨ CHOIX DE LA COULEUR : Bleu électrique (#3b82f6) pour le public, Violet Incognito (#a855f7) pour le privé
    const borderHexColor = isPrivateMode ? "#a855f7" : "#3b82f6";

    const borderLayouts = [
        { x: bounds.x, y: bounds.y, width: bounds.width, height: BORDER_THICKNESS }, // TOP
        { x: bounds.x, y: bounds.y + bounds.height - BORDER_THICKNESS, width: bounds.width, height: BORDER_THICKNESS }, // BOTTOM
        { x: bounds.x, y: bounds.y, width: BORDER_THICKNESS, height: bounds.height }, // LEFT
        { x: bounds.x + bounds.width - BORDER_THICKNESS, y: bounds.y, width: BORDER_THICKNESS, height: bounds.height } // RIGHT
    ];

    // 2. Création des 4 bordures si elles n'existent pas
    if (borderViews.length === 0) {
        for (let i = 0; i < 4; i++) {
            const bView = createSandboxedBrowserView();
            win.addBrowserView(bView);
            
            bView.webContents.setIgnoreMenuShortcuts(true);
            bView.webContents.userAgent = "InternalBorder";
            borderViews.push(bView);
        }
    }

    // 3. Mise à jour de la position ET de la couleur en temps réel
    borderLayouts.forEach((layout, index) => {
        const bView = borderViews[index];
        if (bView && !bView.webContents.isDestroyed()) {
            bView.setBounds(layout);
            
            // ✨ INJECTION DYNAMIQUE : Recharge la couleur appropriée si elle change
            bView.webContents.loadURL("data:text/html," + encodeURIComponent(`
                <html><body style="margin:0; padding:0; background:${borderHexColor}; overflow:hidden;"></body></html>
            `));
        }
    });

    if (!skipRaise) {
        borderViews.forEach((bView) => {
            if (bView && !bView.webContents.isDestroyed()) {
                try { win.setTopBrowserView(bView); } catch (error) {}
            }
        });
    }
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
        const hView = createSandboxedBrowserView();
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
            return new PanelNode(snapshotNode.id, existingPanel ? existingPanel.view : null, snapshotNode.url, existingPanel?.isPrivate === true, existingPanel?.containerId || null);
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
        const realUrl = node.isSleeping
            ? (node.sleepingUrl || node.url)
            : (node.view?.webContents && !node.view.webContents.isDestroyed()
                ? node.view.webContents.getURL()
                : node.url);
        return { type: "panel", id: node.id, url: node.url, realUrl, isPrivate: node.isPrivate, containerId: node.containerId || null };
    }

    return {
        type: "split",
        direction: node.direction,
        ratio: node.ratio,
        first: createSnapshot(node.first),
        second: createSnapshot(node.second)
    };
}

function getPersistablePanelUrl(panel) {
    if (!panel || panel.isPrivate) return getHomePageUrl();

    const currentUrl = panel.isSleeping
        ? (panel.sleepingUrl || panel.url)
        : (panel.view?.webContents && !panel.view.webContents.isDestroyed()
            ? panel.view.webContents.getURL()
            : panel.url);

    try {
        const parsedUrl = new URL(currentUrl);
        if (parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:") {
            parsedUrl.username = "";
            parsedUrl.password = "";
            return parsedUrl.href;
        }
        if (parsedUrl.protocol === "file:") {
            const filePath = getNodeModule("url").fileURLToPath(parsedUrl);
            const relativePath = path.relative(__dirname, filePath);
            if (relativePath && !relativePath.startsWith(`..${path.sep}`) && relativePath !== ".." && !path.isAbsolute(relativePath)) {
                return parsedUrl.href;
            }
            if (filePath === __filename) return parsedUrl.href;
        }
        if (parsedUrl.protocol === "about:" && parsedUrl.href === "about:blank") return "about:blank";
    } catch {}

    // Ne jamais conserver les pages data:, qui peuvent contenir des données de formulaire.
    return getHomePageUrl();
}

function createPersistedSessionSnapshot(node) {
    if (!node) return null;
    if (node.type === "panel") {
        return {
            type: "panel",
            id: node.id,
            url: getPersistablePanelUrl(node),
            isPrivate: false,
            containerId: node.containerId || null
        };
    }
    return {
        type: "split",
        direction: node.direction,
        ratio: node.ratio,
        first: createPersistedSessionSnapshot(node.first),
        second: createPersistedSessionSnapshot(node.second)
    };
}

let sessionSaveTimer = null;

function persistSessionLayout() {
    if (!rootNode) return;
    try {
        const snapshot = {
            version: 1,
            activePanelId: activePanel,
            tree: createPersistedSessionSnapshot(rootNode)
        };
        fs.writeFileSync(getSessionLayoutPath(), JSON.stringify(snapshot, null, 2), "utf-8");
    } catch (error) {
        console.error("Erreur de sauvegarde automatique de la disposition :", error);
    }
}

function scheduleSessionLayoutSave() {
    if (sessionSaveTimer) clearTimeout(sessionSaveTimer);
    sessionSaveTimer = setTimeout(() => {
        sessionSaveTimer = null;
        persistSessionLayout();
    }, 400);
}

function validatePersistedTree(node, depth = 0, panelCounter = { count: 0 }) {
    if (!node || depth > 32) return false;
    if (node.type === "panel") {
        panelCounter.count += 1;
        if (panelCounter.count > 32 || typeof node.id !== "string" || !/^panel\d+$/.test(node.id)) return false;
        panelCounter.ids ||= new Set();
        if (panelCounter.ids.has(node.id)) return false;
        panelCounter.ids.add(node.id);
        return true;
    }
    return node.type === "split" &&
        (node.direction === "vertical" || node.direction === "horizontal") &&
        Number.isFinite(node.ratio) && node.ratio >= 0.1 && node.ratio <= 0.9 &&
        validatePersistedTree(node.first, depth + 1, panelCounter) &&
        validatePersistedTree(node.second, depth + 1, panelCounter);
}

async function restorePersistedSession() {
    let storedSession;
    try {
        storedSession = JSON.parse(await fsPromises.readFile(getSessionLayoutPath(), "utf-8"));
    } catch {
        return false;
    }
    if (storedSession?.version !== 1 || !validatePersistedTree(storedSession.tree)) return false;

    let maxPanelNumber = 0;
    const restoreNode = async (savedNode) => {
        if (savedNode.type === "panel") {
            const id = /^panel\d+$/.test(savedNode.id) ? savedNode.id : `panel${++maxPanelNumber}`;
            const idNumber = Number(id.slice(5));
            if (Number.isFinite(idNumber)) maxPanelNumber = Math.max(maxPanelNumber, idNumber);
            const containerId = isValidContainerId(savedNode.containerId) ? savedNode.containerId : null;
            const view = createSandboxedBrowserView({
                webPreferences: { session: containerId ? getContainerSession(containerId) : session.defaultSession }
            });
            win.addBrowserView(view);
            const restoreUrl = getPersistablePanelUrl({ url: savedNode.url, isPrivate: false });
            const panel = new PanelNode(id, view, restoreUrl, false, containerId);
            setupNavigationTracking(panel);
            try {
                await view.webContents.loadURL(panel.url);
                applyThemeToView(view);
            } catch (error) {
                console.error(`Échec de restauration du panneau ${id} :`, error);
                panel.url = getHomePageUrl();
                await view.webContents.loadURL(panel.url).catch(() => {});
            }
            return panel;
        }

        const split = new SplitNode(savedNode.direction);
        split.ratio = savedNode.ratio;
        split.first = await restoreNode(savedNode.first);
        split.second = await restoreNode(savedNode.second);
        return split;
    };

    try {
        rootNode = await restoreNode(storedSession.tree);
        nextPanelNumber = Math.max(nextPanelNumber, maxPanelNumber + 1);
        maximizedPanelId = null;
        const savedActivePanel = findPanelNode(rootNode, storedSession.activePanelId);
        activePanel = savedActivePanel ? savedActivePanel.id : findFirstPanel(rootNode).id;
        forceRebuildSplitters = true;
        resizeViews();
        updateNavigationButtons();
        return true;
    } catch (error) {
        console.error("Erreur de restauration de la dernière session :", error);
        return false;
    }
}

function saveState() {
    history.push(JSON.stringify(createSnapshot(rootNode)));
    if (history.length > 20) history.shift();
}

class PanelNode {
    constructor(id, view, url = "", isPrivate = false, containerId = null) {
        this.type = "panel";
        this.id = id;
        this.view = view;
        this.url = url;
        this.isPrivate = isPrivate; // Stocke l'état privé du panneau
        this.containerId = isValidContainerId(containerId) ? containerId : null;
        this.session = view?.webContents && !view.webContents.isDestroyed()
            ? view.webContents.session
            : null;
        this.isSleeping = false;
        this.sleepingUrl = null;
    }
    toJSON() {
        return { type: this.type, id: this.id, url: this.url, isPrivate: this.isPrivate, containerId: this.containerId };
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

    if (input.toLowerCase() === "hare://home") {
        return getHomePageUrl();
    }

    if (input.toLowerCase() === "hare://help") {
        return getPathToFileURL(path.join(__dirname, "help.html")).href;
    }

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

async function openHelpInPanel(panel = findPanelNode(rootNode, activePanel) || collectPanelNodes(rootNode)[0]) {
    if (!panel?.view || panel.view.webContents.isDestroyed()) {
        return false;
    }

    activePanel = panel.id;
    await panel.view.webContents.loadFile(path.join(__dirname, "help.html"));
    return true;
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

function clearPanelIdleTimer(panelId) {
    const timer = panelIdleTimers.get(panelId);
    if (timer) clearTimeout(timer);
    panelIdleTimers.delete(panelId);
}

function markPanelActivity(panelOrId) {
    const panel = typeof panelOrId === 'string'
        ? findPanelNode(rootNode, panelOrId)
        : panelOrId;
    if (!panel || panel.isSleeping) return;

    clearPanelIdleTimer(panel.id);
    if (!autoSleepEnabled) return;

    panel.lastActivityAt = Date.now();
    panelIdleTimers.set(panel.id, setTimeout(() => {
        panelIdleTimers.delete(panel.id);
        if (autoSleepEnabled && findPanelNode(rootNode, panel.id) === panel) sleepPanel(panel);
    }, PANEL_IDLE_TIMEOUT));
}

function setAutoSleepEnabled(enabled) {
    autoSleepEnabled = enabled === true;
    panelIdleTimers.forEach((timer) => clearTimeout(timer));
    panelIdleTimers.clear();

    if (autoSleepEnabled) {
        collectPanelNodes(rootNode).forEach((panel) => {
            if (!panel.isSleeping) markPanelActivity(panel);
        });
    }

    saveAutoSleepPreference();
    return autoSleepEnabled;
}

function destroyPanelBrowserView(view) {
    if (!view || !view.webContents || view.webContents.isDestroyed()) return;
    try { if (win && !win.isDestroyed()) win.removeBrowserView(view); } catch (error) {}
    try { view.webContents.stop(); } catch (error) {}
    view.webContents.removeAllListeners();
    try { view.webContents.destroy(); } catch (error) {}
}

function sleepPanel(panel) {
    if (!panel || panel.isSleeping || !panel.view || !win || win.isDestroyed()) return;
    if (activeDownloads[panel.id]) {
        markPanelActivity(panel);
        return;
    }

    const originalView = panel.view;
    const contents = originalView.webContents;
    if (!contents || contents.isDestroyed()) return;

    const currentUrl = contents.getURL();
    panel.sleepingUrl = currentUrl && currentUrl !== 'about:blank'
        ? currentUrl
        : (panel.url || getHomePageUrl());
    panel.session = contents.session;
    panel.isSleeping = true;

    destroyPanelBrowserView(originalView);

    const placeholder = createSandboxedBrowserView({
        webPreferences: panel.session ? { session: panel.session } : {}
    });
    panel.view = placeholder;
    win.addBrowserView(placeholder);

    // 🌟 CORRECTIF THÈME : Déterminer dynamiquement la classe de thème active à injecter
    const currentThemeClass = isDarkModeForced ? "mw-theme-client-dark" : "mw-theme-client-light";

    const sleepingHtml = `<!doctype html><html lang="fr" class="${currentThemeClass}"><meta charset="utf-8"><title>Tuile en veille</title>
        <style>
        html,body{height:100%;margin:0}
        body{display:grid;place-items:center;background:#f3f4f6;color:#374151;font:15px 'Segoe UI',sans-serif}
        html.mw-theme-client-dark body{background:#1e1e1e;color:#cfcfcf}
        main{text-align:center;padding:24px}strong{display:block;margin-bottom:8px}small{color:#6b7280}
        </style>
        <body><main><strong>Cette tuile est en veille</strong><small>Cliquez ici pour recharger la page</small></main></body></html>`;
        
    placeholder.webContents.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(sleepingHtml));

    if (panel.bounds) placeholder.setBounds(panel.bounds);
    else placeholder.setBounds({ x: -2000, y: -2000, width: 0, height: 0 });
    resizeViews();
    if (handleViews[panel.id]) {
        try { win.setTopBrowserView(handleViews[panel.id]); } catch (error) {}
    }
    if (panel.id === activePanel && panel.bounds) updateActiveBorder(panel.bounds);
    console.log(`[Tab Sleeping] Tuile ${panel.id} mise en veille après 15 minutes d’inactivité.`);
}


function wakePanel(panel, targetUrl = null) {
    if (!panel || !panel.isSleeping || !win || win.isDestroyed()) return panel?.view || null;

    clearPanelIdleTimer(panel.id);
    const originalUrl = targetUrl || panel.sleepingUrl || panel.url || getHomePageUrl();
    const placeholder = panel.view;
    panel.isSleeping = false;
    panel.sleepingUrl = null;
    destroyPanelBrowserView(placeholder);

    const view = createSandboxedBrowserView({
        webPreferences: panel.session ? { session: panel.session } : {}
    });
    panel.view = view;
    win.addBrowserView(view);
    setupNavigationTracking(panel);
    markPanelActivity(panel);
    activePanel = panel.id;

    view.webContents.loadURL(originalUrl).catch((error) => {
        console.error(`[Tab Sleeping] Échec du rechargement de la tuile ${panel.id} :`, error);
    });
    resizeViews();
    if (handleViews[panel.id]) {
        try { win.setTopBrowserView(handleViews[panel.id]); } catch (error) {}
    }
    if (panel.bounds) updateActiveBorder(panel.bounds);
    view.webContents.focus();
    win.webContents.send('active-panel-changed', { id: panel.id, bounds: panel.bounds });
    win.webContents.send('panels-updated', collectPanels(rootNode), maximizedPanelId);
    return view;
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

// 🛠️ Dans main.js -> Remplacez la fonction collectPanels par celle-ci :
function collectPanels(node, panels = []) {
    if (!node) return panels;
    if (node.type === "panel") {
        panels.push({ 
            id: node.id,
            url: node.url,
            realUrl: node.isPrivate && node.isSleeping ? (node.sleepingUrl || node.url) : node.url,
            title: node.title,
            // ✨ CRUCIAL : Assure la transmission exacte du mode privé pour la liste supérieure
            isPrivate: node.isPrivate === true, 
            containerId: node.containerId || null,
            containerLabel: node.containerId ? TILE_CONTAINERS[node.containerId].label : "",
            containerColor: node.containerId ? TILE_CONTAINERS[node.containerId].color : "",
            searchQuery: node.searchQuery || ""
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

function updatePanelUrl(panel, url) {
    const previousUrl = panel.url;
    let nextUrl = url;

    try {
        const parsedUrl = new URL(url);
        if (parsedUrl.pathname === "/search" || parsedUrl.pathname.endsWith("/search")) {
            panel.searchQuery = parsedUrl.searchParams.get("q") || panel.searchQuery || "";
        } else {
            panel.searchQuery = "";
        }
    } catch {
        panel.searchQuery = "";
    }

    // Si le panneau est privé et qu'il est sur sa page d'accueil d'origine.
    if (panel.isPrivate && (url.startsWith('data:text/html') || url === panel.url)) {
        nextUrl = "Navigation Privée";
        panel.title = "Navigation Privée";
    } else {
        if (panel.view && !panel.view.webContents.isDestroyed()) {
            panel.title = panel.view.webContents.getTitle();
        }
    }

    panel.url = nextUrl;

    // Les sites peuvent modifier document.title plusieurs fois après le chargement.
    // Ces changements ne modifient pas l'adresse affichée : évite de rafraîchir
    // toute l'interface pour la même URL.
    if (previousUrl === nextUrl) return;

    win.webContents.send("panels-updated", collectPanels(rootNode), maximizedPanelId);
    scheduleSessionLayoutSave();
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
    markPanelActivity(panel);

    let initialLoadFinished = false;

    panel.view.webContents.on("before-input-event", (event, input) => {
        if (input.type === "keyDown" && input.key === "F1") {
            event.preventDefault();
            openHelpInPanel(panel).catch(console.error);
        }
        if (input.type === "keyDown" && (input.control || input.meta) && input.key.toLowerCase() === "f") {
            event.preventDefault();
            activePanel = panel.id;
            if (win && !win.isDestroyed()) {
                win.webContents.focus();
                win.webContents.send("open-find-bar", panel.id);
            }
        }
    });

    panel.view.webContents.on("found-in-page", (_event, result) => {
        if (!win || win.isDestroyed()) return;
        const currentFind = findInPageRequests.get(panel.id);
        if (!currentFind || result.requestId !== currentFind.requestId) return;
        win.webContents.send("find-in-page-result", {
            panelId: panel.id,
            requestId: result.requestId,
            activeMatchOrdinal: result.activeMatchOrdinal,
            matches: result.matches,
            finalUpdate: result.finalUpdate
        });
    });

    panel.view.webContents.on("will-navigate", (event, targetUrl) => {
        try {
            const target = new URL(targetUrl);

            // 1. 🔒 SÉCURITÉ : Liste blanche des protocoles autorisés pour la navigation web standard
            const allowedProtocols = ['http:', 'https:', 'data:', 'about:'];

            if (!allowedProtocols.includes(target.protocol) && target.protocol !== 'hare:') {
                event.preventDefault(); // Bloque instantanément la navigation
                console.warn(`[SÉCURITÉ] Protocole exotique bloqué à l'exécution : ${target.protocol}`);
                return;
            }

            // 2. Gestion de vos protocoles internes existants (hare://)
            if (target.protocol === "hare:") {
                event.preventDefault(); // Stoppe la navigation Chromium pour éviter l'écran blanc

                if (target.hostname === "home") {
                    panel.view.webContents.loadURL(getHomePageUrl());
                } else if (target.hostname === "help") {
                    openHelpInPanel(panel).catch(console.error);
                } else if (target.hostname === "history") {
                    ipcMain.emit("open-history-window");
                } else if (target.hostname === "private") {
                    activePanel = panel.id;
                    ipcMain.emit("split-panel", null, panel.id, "vertical", true);
                } else if (target.hostname === "close-panel") {
                    ipcMain.emit("close-panel", null, panel.id);
                } else if (target.hostname === "toggle-theme") {
                    ipcMain.emit('toggle-dark-mode-request', null, !isDarkModeForced);
                }
                return;
            }

            // 3. Votre vérification d'origine pour le moteur de recherche
            const isSearchEngineHome =
                target.hostname === SEARCH_ENGINE_HOST &&
                target.port === "8080" &&
                target.pathname === "/" &&
                !target.searchParams.has("q");

            if (isSearchEngineHome) {
                event.preventDefault();
                panel.view.webContents.loadURL(getHomePageUrl());
            }
        } catch (error) {
            console.debug("Impossible de vérifier l’URL d’accueil du moteur :", error);
        }
    });

    const syncSearchQueryFromPage = async () => {
        if (!panel.view || panel.view.webContents.isDestroyed()) return;
        try {
            const currentUrl = new URL(panel.view.webContents.getURL());
            const isSearchEnginePage = currentUrl.hostname === SEARCH_ENGINE_HOST;
            const isSearchResultsPage = currentUrl.pathname === "/search" || currentUrl.pathname.endsWith("/search");
            if (!isSearchEnginePage && !isSearchResultsPage) return;

            const query = await panel.view.webContents.executeJavaScript(
                'document.querySelector("input[name=\\"q\\"]")?.value?.trim() || ""'
            );
            panel.searchQuery = query;
            if (win && !win.isDestroyed()) {
                win.webContents.send("panels-updated", collectPanels(rootNode), maximizedPanelId);
            }
        } catch (error) {
            console.debug("Impossible de synchroniser la requête du moteur de recherche :", error);
        }
    };

    panel.view.webContents.on("did-navigate-in-page", () => {
        syncSearchQueryFromPage();
    });

    // Écouteur pour intercepter le clic droit sur la page web de la tuile
/*
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
*/
    // Écouteur pour intercepter le clic droit sur la page web de la tuile
    panel.view.webContents.on("context-menu", (event, params) => {
        event.preventDefault();
        
        // Forcer le focus et l'activation visuelle sur ce panneau
        activePanel = panel.id;
        if (win && !win.isDestroyed()) {
            win.webContents.send("active-panel-changed", { id: panel.id, bounds: panel.bounds });
            win.webContents.send("panels-updated", collectPanels(rootNode), maximizedPanelId);
        }
        updateActiveBorder(panel.bounds);

        // 🌟 CORRECTIF DES COORDONNÉES : Traduire les coordonnées locales en globales
        // Si le panneau a des dimensions et une position calculées dans la mosaïque
        let menuX = params.x;
        let menuY = params.y;

        if (panel.bounds) {
            menuX = panel.bounds.x + params.x;
            menuY = panel.bounds.y + params.y;
        }

        // On affiche maintenant le menu d'actions au pixel exact sous la souris
        afficherMenuContextuelPanneau(panel.view.webContents, menuX, menuY);
    });

    panel.view.webContents.on("did-start-loading", () => {

        // Ignore le chargement initial au démarrage
        if (!initialLoadFinished) {
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

    panel.view.webContents.on("did-finish-load", async () => {
        // ... (Votre code existant qui injecte le fichier injector.js) ...

        // === AUTOFILL : choix du compte lorsque plusieurs identifiants existent ===
        if (!panel.isPrivate) {
            const targetWebContents = panel.view.webContents;
            const currentUrl = targetWebContents.getURL();
            try {
                const normalizeHostname = (value) => {
                    try {
                        const url = value.includes("://") ? value : `https://${value}`;
                        return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
                    } catch {
                        return "";
                    }
                };

                const hostname = normalizeHostname(currentUrl);
                if (hostname) {
                    const matches = getStoredPasswords().filter((entry) =>
                        entry.url && normalizeHostname(entry.url) === hostname
                    );

                    if (matches.length > 0) {
                        let selectedCredential = matches[0];

                        if (matches.length > 1) {
                            const accountLabels = matches.map((entry) =>
                                entry.username || entry.url || "Compte sans identifiant"
                            );
                            const duplicateLabels = new Set(
                                accountLabels.filter((label, index) => accountLabels.indexOf(label) !== index)
                            );
                            const buttons = matches.map((entry, index) =>
                                duplicateLabels.has(accountLabels[index])
                                    ? `${accountLabels[index]} · ${entry.url}`
                                    : accountLabels[index]
                            );
                            buttons.push("Annuler");

                            const options = {
                                type: "question",
                                title: "Choisir un compte",
                                message: `Plusieurs identifiants sont enregistrés pour ${hostname}.`,
                                detail: "Sélectionnez le compte à remplir dans le formulaire.",
                                buttons,
                                defaultId: 0,
                                cancelId: matches.length,
                                noLink: true
                            };
                            const result = win && !win.isDestroyed()
                                ? await dialog.showMessageBox(win, options)
                                : await dialog.showMessageBox(options);

                            if (result.response < 0 || result.response >= matches.length) {
                                selectedCredential = null;
                            } else {
                                selectedCredential = matches[result.response];
                            }
                        }

                        // Ne pas remplir une page si elle a changé pendant l'affichage du choix.
                        const panelIsStillCurrent =
                            findPanelNode(rootNode, panel.id) === panel &&
                            panel.view &&
                            !targetWebContents.isDestroyed() &&
                            panel.view.webContents === targetWebContents &&
                            targetWebContents.getURL() === currentUrl;

                        if (selectedCredential && panelIsStillCurrent) {
                            const injectorPath = path.join(__dirname, "nanobrowser", "injector.js");
                            if (fs.existsSync(injectorPath)) {
                                const injectorCode = fs.readFileSync(injectorPath, "utf8");
                                await targetWebContents.executeJavaScript(injectorCode + "; void 0;");
                                await targetWebContents.executeJavaScript(
                                    `window.NanobrowserExecutor?.autofillCredentials?.(${JSON.stringify(selectedCredential.username || "")}, ${JSON.stringify(selectedCredential.password || "")}); void 0;`
                                );
                                console.log(`[PWD AUTOFILL] Compte sélectionné pour ${hostname} : ${selectedCredential.username}`);
                            }
                        }
                    }
                }
            } catch (err) {
                console.error("Erreur Autofill :", err);
            }
        }

        // Certains moteurs envoient le terme via POST : la requête n'est alors
        // pas dans l'URL et doit être lue dans le formulaire de la page.
        await syncSearchQueryFromPage();
    });

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


// 🛠️ Dans main.js -> À l'intérieur de setupNavigationTracking(), recherchez panel.view.webContents.on("focus", ...) :
panel.view.webContents.on("focus", () => {
    panel.lastActivityAt = Date.now();

    const panelChanged = activePanel !== panel.id;
    activePanel = panel.id;
    if (panelChanged) scheduleSessionLayoutSave();
    
    if (win && !win.isDestroyed() && win.webContents && !win.webContents.isDestroyed()) {
        // ✨ MODIFICATION ICI AUSSI : On ajoute 'isPrivate'
        win.webContents.send("active-panel-changed", {
            id: panel.id,
            bounds: panel.bounds,
            selectUrl: false,
            isPrivate: panel.isPrivate === true // 🌟 Transmettre l'état privé
        });

        if (panelChanged) {
            win.webContents.send("navigation-state-changed", {
                panelId: panel.id,
                canGoBack: panel.view.webContents.navigationHistory.canGoBack(),
                canGoForward: panel.view.webContents.navigationHistory.canGoForward()
            });
        }
    }

    updateActiveBorder(panel.bounds);
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

    // =============================================================================
    // SI UN PANNEAU EST MAXIMISÉ : On optimise la RAM et le CPU des tuiles masquées
    // =============================================================================
    if (maximizedPanelId) {
        if (node.type === "panel") {
            if (node.id === maximizedPanelId) {
                // Le panneau maximisé prend TOUTE la place disponible
                node.bounds = { x, y, width, height };
                if (node.view && !node.view.webContents.isDestroyed()) {
                    node.view.setBounds({ x, y, width, height });
                    
                    // 🚀 SORTIE DE SOMMEIL : On redonne 100% des performances au panneau actif
                    try {
                        node.view.webContents.setAudioMuted(false);
                    } catch (e) {}
                }
            } else {
                // CORRECTIF GÉOMÉTRIE : On efface le panneau de l'affichage
                node.bounds = null;
                if (node.view && !node.view.webContents.isDestroyed()) {
                    node.view.setBounds({ x: -2000, y: -2000, width: 0, height: 0 });
                    
                    // 💤 MISE EN SOMMEIL RECHERCHÉE : Économie RAM & CPU agressive
                    try {
                        // 1. Coupe les flux audio en arrière-plan
                        node.view.webContents.setAudioMuted(true);
                        
                        // 2. Force Chromium à suspendre l'exécution des timers JavaScript lourds (ex: animations, pubs)
                        if (typeof node.view.webContents.setBackgroundThrottling === 'function') {
                            node.view.webContents.setBackgroundThrottling(true);
                        }
                    } catch (e) {}
                }
                
                // CORRECTIF POIGNÉE : On détruit immédiatement la poignée flottante associée
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

    // ==========================================================
    // COMPORTEMENT STANDARD (Arbre de tuiles normal en mosaïque)
    // ==========================================================
    if (node.type === "panel") {
        node.bounds = { x, y, width, height };
        if (node.view && !node.view.webContents.isDestroyed()) {
            node.view.setBounds({ x, y, width, height });
            
            // 🚀 REVIREMENT : On s'assure que toutes les tuiles de la mosaïque ont leurs performances maximales
            try {
                node.view.webContents.setAudioMuted(false);
                if (typeof node.view.webContents.setBackgroundThrottling === 'function') {
                    node.view.webContents.setBackgroundThrottling(false); // Réveille le JS
                }
            } catch (e) {}
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


// Écouteur pour intercepter le clic sur le bouton 📐 de l'IHM
ipcMain.on("equalize-mosaic-request", () => {
    if (!rootNode) return;

    // 1. Sauvegarde l'état actuel dans le système d'historique (permet Ctrl+Z)
    saveState();

    // 2. Parcourt l'arbre binaire et applique le ratio 0.5 partout
    resetTreeRatiosEqual(rootNode); 

    // 3. Force Electron à reconstruire les séparateurs et rafraîchir l'affichage
    forceRebuildSplitters = true;
    resizeViews();

    console.log("[Mosaïque] Ratios égalisés via le bouton de la barre d'outils.");
});



ipcMain.on("show-url-context-menu", (event) => {
    const menu = Menu.buildFromTemplate([
//      { role: "undo", label: "Annuler" },
//      { role: "redo", label: "Rétablir" },
//      { type: "separator" },
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
    if (!win || win.isDestroyed() || event.sender !== win.webContents) return;
    setAiSidebarVisible(isVisible);
});

ipcMain.handle("get-ai-sidebar-preference", (event) => {
    if (!win || win.isDestroyed() || event.sender !== win.webContents) return true;
    return isAiSidebarVisible;
});

ipcMain.on('tile-activity', (event, activityType) => {
    const panel = findPanelByWebContents(event.sender);
    if (!panel) return;

    if (panel.isSleeping) {
        if (activityType === 'click') wakePanel(panel);
        return;
    }

    markPanelActivity(panel);
});

ipcMain.handle("get-autosleep-preference", (event) => {
    if (!win || win.isDestroyed() || event.sender !== win.webContents) return true;
    return autoSleepEnabled;
});

ipcMain.on("toggle-autosleep-request", (event, enabled) => {
    if (!win || win.isDestroyed() || event.sender !== win.webContents) return;
    const nextState = setAutoSleepEnabled(enabled);
    win.webContents.send("autosleep-state-changed", nextState);
});

ipcMain.on("navigate", (event, panelId, input) => {
    const panel = findPanelNode(rootNode, panelId);
    if (!panel) return;

    const navigatePanel = () => {
        if (!panel.view || panel.view.webContents.isDestroyed()) return;
        markPanelActivity(panel);
        panel.view.webContents.loadURL(buildNavigationTarget(input));
    };
    if (panel.isSleeping) {
        wakePanel(panel, buildNavigationTarget(input));
    } else {
        navigatePanel();
    }

    
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
    setNormalToolbarHeight(TOOLBAR_MIN_HEIGHT);
    
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
    win.webContents.send(
        "panels-updated",
        collectPanels(rootNode),
        maximizedPanelId
    );

    win.webContents.send("active-panel-changed", { id: nodeA.id, bounds: nodeA.bounds });
    updateActiveBorder(nodeA.bounds);
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

async function purgePrivateSession(targetSession, panelId) {
    const storagePath = targetSession.getStoragePath();
    console.log(`[SÉCURITÉ] Purge de la session privée ${panelId} (stockage: ${storagePath || 'mémoire volatile'}).`);

    try {
        await targetSession.closeAllConnections();
    } catch (error) {
        console.warn(`[SÉCURITÉ] Fermeture des connexions ${panelId} :`, error);
    }

    const cleanupResults = await Promise.allSettled([
        targetSession.clearData(),
        targetSession.clearAuthCache(),
        targetSession.clearCache()
    ]);
    cleanupResults.forEach((result) => {
        if (result.status === 'rejected') {
            console.error(`[SÉCURITÉ] Échec d'une opération de purge pour ${panelId} :`, result.reason);
        }
    });

    if (cleanupResults.every((result) => result.status === 'fulfilled')) {
        console.log(`[SÉCURITÉ] Données, authentification et cache de ${panelId} purgés.`);
    }
}

ipcMain.on("close-panel", (event, panelId) => {
    // === VÉRIFICATION DU NOMBRE DE PANNEAUX RESTANTS ===
    // Si l'utilisateur clique sur la croix alors qu'il n'y a plus qu'un panneau ouvert
    if (collectPanelNodes(rootNode).length <= 1) {
        app.quit(); // Déclenche la boîte de dialogue de confirmation de fermeture globale
        return;
    }

    // --- COMPORTEMENT STANDARD DE FERMETURE DE TUILE EN MOSAÏQUE ---
    const node = findPanelNode(rootNode, panelId);
    if (!node) return;
    clearPanelIdleTimer(panelId);

    // === OPTIMISATION RAM & SÉCURITÉ : NETTOYAGE AGRESSIF ET DESTRUCTION PROCESSUS ===
    if (node.view && !node.view.webContents.isDestroyed()) {
        const viewToDestroy = node.view;
        const targetSession = viewToDestroy.webContents.session;

        // 1. On décroche proprement la vue de la fenêtre principale avant sa suppression
        try { win.removeBrowserView(viewToDestroy); } catch(e) {}

        // 2. Si c'est une tuile privée, exécution du nettoyage complet de la session incognito
        if (node.isPrivate) {
            console.log(`Fermeture d'une tuile privée : Nettoyage complet de la partition : ${targetSession.getStoragePath()}`);
            
            targetSession.clearStorageData({
                storages: ['cookies', 'localstorage', 'caches', 'indexeddb', 'websql', 'serviceworkers', 'cachestorage'],
                quotas: ['temporary', 'persistent', 'syncable']
            }).then(() => {
                console.log(`[Partition ${panelId}] Stockages et Cookies détruits avec succès.`);
            }).catch(err => console.error("Erreur destruction storage privé :", err));
            
            targetSession.clearCache().catch(err => console.error("Erreur destruction cache privé :", err));
        }

        // 3. Suppression des écouteurs pour éviter les fuites de mémoire (Memory Leaks)
        viewToDestroy.webContents.removeAllListeners();

        if (node.isPrivate) {
            // Arrête immédiatement les scripts de la page avant d'effacer les données de session.
            try {
                viewToDestroy.webContents.stop();
                viewToDestroy.webContents.destroy();
            } catch (error) {
                console.warn(`[SÉCURITÉ] Destruction de la vue privée ${panelId} :`, error);
            }
            void purgePrivateSession(targetSession, panelId);
        } else {
            // Pour une tuile standard, attend la stabilisation de la page blanche avant destruction.
            viewToDestroy.webContents.loadURL("about:blank").then(() => {
                setTimeout(() => {
                    if (!viewToDestroy.webContents.isDestroyed()) {
                        viewToDestroy.webContents.destroy();
                        console.log(`[RAM] Processus Chromium de la tuile ${panelId} libéré proprement.`);
                    }
                }, 150);
            }).catch(() => {
                if (!viewToDestroy.webContents.isDestroyed()) viewToDestroy.webContents.destroy();
            });
        }
    }

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
    const restoredView = createSandboxedBrowserView();
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

// ==================================================
// BLOC HISTORIQUE NATIF CORRIGÉ VIA ARCHITECTURE IPC
// ==================================================

// Fonction pour envoyer les données fraîches à la fenêtre d'historique
function updateHistoryWindowContent() {
    const targetHistoryWindow = historyWindow && !historyWindow.isDestroyed()
        ? historyWindow
        : global.historyWindow;

    if (targetHistoryWindow && !targetHistoryWindow.isDestroyed()) {
        const historyList = getNavigationHistory();
        const themeIsDark = isDarkModeForced;

        targetHistoryWindow.setBackgroundColor(themeIsDark ? "#1e1e1e" : "#f9fafb");
        targetHistoryWindow.webContents.send('history-theme-changed', themeIsDark);
        targetHistoryWindow.webContents.send('render-history', {
            historyList,
            isDarkMode: themeIsDark
        });
        if (targetHistoryWindow.webContents.isLoading()) {
            targetHistoryWindow.webContents.once('did-finish-load', () => {
                if (!targetHistoryWindow.isDestroyed()) {
                    targetHistoryWindow.webContents.executeJavaScript(
                        `window.applyHistoryTheme?.(${JSON.stringify(themeIsDark)});`
                    ).catch(() => {});
                }
            });
        } else {
            targetHistoryWindow.webContents.executeJavaScript(
                `window.applyHistoryTheme?.(${JSON.stringify(themeIsDark)});`
            ).catch(() => {});
        }
    }
}
// Écouteur pour ouvrir la fenêtre
ipcMain.on("open-history-window", () => {
    const existingHistoryWindow = historyWindow && !historyWindow.isDestroyed()
        ? historyWindow
        : global.historyWindow;
    if (existingHistoryWindow && !existingHistoryWindow.isDestroyed()) {
        existingHistoryWindow.focus();
        updateHistoryWindowContent();
        return;
    }

    historyWindow = new BrowserWindow({
        width: 450,
        height: 600,
        title: "Historique de navigation",
        backgroundColor: isDarkModeForced ? "#1e1e1e" : "#f9fafb",
        autoHideMenuBar: true,
        alwaysOnTop: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload-history.js'), // <-- Charge le nouveau preload
            nodeIntegration: false,                              // <-- SÉCURITÉ : Désactivé
            contextIsolation: true,                              // <-- SÉCURITÉ : Activé
            sandbox: true
        }
    });

    global.historyWindow = historyWindow;
    historyWindow.loadFile(path.join(__dirname, 'history.html'));

    historyWindow.webContents.on('did-finish-load', () => {
        updateHistoryWindowContent();
    });

    historyWindow.on("closed", () => {
        historyWindow = null;
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
        fs.writeFileSync(getHistoryPath(), JSON.stringify(historyList, null, 2));
        
        ipcMain.emit('history-data-changed');
        if (win && !win.isDestroyed()) win.webContents.send('history-updated', historyList);
    }
});

// E. Effacer tout l'historique d'un coup
ipcMain.on('clear-all-history', () => {
    fs.writeFileSync(getHistoryPath(), JSON.stringify([]));
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

// A. Suppression d'une seule entrée d'historique
ipcMain.on('delete-single-history', async (event, index) => { // 🌟 Ajout de async
    let historyList = getNavigationHistory();
    if (index >= 0 && index < historyList.length) {
        historyList.splice(index, 1);
        
        // 🌟 Remplacement synchrone par asynchrone sécurisé
        await safeWriteJsonAsync(getHistoryPath(), historyList);
        
        ipcMain.emit('history-data-changed');
        if (win && !win.isDestroyed()) win.webContents.send('history-updated', historyList);
    }
});

// B. Effacer tout l'historique d'un coup
ipcMain.on('clear-all-history', async () => { // 🌟 Ajout de async
    // 🌟 Remplacement synchrone par asynchrone sécurisé
    await safeWriteJsonAsync(getHistoryPath(), []);
    
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

// Recalcul de la géométrie
resizeViews();

// Script d'injection magique : s'exécute AVANT que Wikipédia ne calcule ses styles
app.on('web-contents-created', (event, webContents) => {

    // On injecte le code dès que le DOM commence à exister
    webContents.on('dom-ready', () => {

        updateNavigationButtons();

        if (!win || win.isDestroyed()) return;

        const url = webContents.getURL();
        if (url.startsWith('data:text/html')) return;

        const scriptToInject = `
            (function() {
                const themeClass = ${JSON.stringify(isDarkModeForced ? "mw-theme-client-dark" : "mw-theme-client-light")};
                const otherThemeClass = ${JSON.stringify(isDarkModeForced ? "mw-theme-client-light" : "mw-theme-client-dark")};
                document.documentElement.classList.add(themeClass);
                document.documentElement.classList.remove(otherThemeClass);
                if (document.body) {
                    document.body.classList.add(themeClass);
                    document.body.classList.remove(otherThemeClass);
                }

                if (${JSON.stringify(isDarkModeForced)} && !window.location.hostname.includes('wikipedia.org') && !document.getElementById('hare-dark-fallback')) {
                    const style = document.createElement('style');
                    style.id = 'hare-dark-fallback';
                    style.innerHTML = \`
                        html, body { background-color: #121212 !important; color: #e0e0e0 !important; } a { color: #8ab4f8 !important; }
                    \`;
                    document.head.appendChild(style);
                }
            })();
        `;

        webContents.executeJavaScript(scriptToInject).catch(e => console.error("Erreur injection sombre:", e));
    });
});

// ====== ÉCOUTEUR : DUPLICATION DE TUILE ======
ipcMain.on("duplicate-panel", (panelId, urlToClone, isPrivate) => {
    const node = findPanelNode(rootNode, panelId);
    const parent = findParentNode(rootNode, panelId);    
    if (!node) return;

    const newPanelId = "panel" + nextPanelNumber++;

    // Configuration de la session (publique globale ou privée volatile isolée)
    let targetSession;
    if (isPrivate) {
        const privatePartition = `incognito_${newPanelId}`;
        targetSession = session.fromPartition(privatePartition, { cache: false });
        enableAdBlockerForSession(targetSession);
    } else {
        targetSession = session.defaultSession;
    }
	
    const viewOptions = {
        webPreferences: {
            session: targetSession,
            contextIsolation: true,
            nodeIntegration: false,
            backgroundThrottling: true,      
            offscreen: false,                
            spellcheck: false,               
            enableWebSQL: false,             
            webSecurity: true,
            allowRunningInsecureContent: false
        }
    };

    const newView = createSandboxedBrowserView(viewOptions);
    win.addBrowserView(newView);

    // Duplication des restrictions de permissions si la tuile d'origine est privée
    if (isPrivate) {
        const privateSession = newView.webContents.session;
        const deniedPermissions = ['geolocation', 'geolocation-approximate', 'media', 'notifications', 'midiSysex', 'sensors'];
        privateSession.setPermissionRequestHandler((webContents, permission, callback) => {
            if (deniedPermissions.includes(permission)) return callback(false);
            callback(true);
        });
        privateSession.setPermissionCheckHandler((_webContents, permission) => {
            return !deniedPermissions.includes(permission);
        });
    }

    // Chargement de l'URL clonée
    newView.webContents.loadURL(urlToClone || getHomePageUrl());

    // Création du nouveau PanelNode
    const newPanel = new PanelNode(newPanelId, newView, urlToClone, isPrivate);
    setupNavigationTracking(newPanel);            

    // Par défaut, on duplique via un split vertical à parts égales (0.5)
    const newSplit = new SplitNode("vertical");
    newSplit.ratio = 0.5;

    // Insertion du nouveau split dans l'arbre binaire
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

    // Sauvegarde de l'état (permet Ctrl+Z), focus et rafraîchissement géométrique
    saveState();
    activePanel = newPanelId;
    forceRebuildSplitters = true;
    resizeViews();
    
    // Notification générale à l'interface
    win.webContents.send("panels-updated", collectPanels(rootNode), maximizedPanelId);
    win.webContents.send("active-panel-changed", { id: newPanel.id, bounds: newPanel.bounds });
    updateActiveBorder(newPanel.bounds);
});

ipcMain.on("duplicate-panel-request", (event, panelId) => {
    if (!win || win.isDestroyed() || event.sender !== win.webContents) return;
    const panel = findPanelNode(rootNode, panelId);
    if (!panel || maximizedPanelId !== null) return;
    const url = panel.isSleeping ? (panel.sleepingUrl || panel.url) : panel.view?.webContents?.getURL();
    ipcMain.emit("duplicate-panel", panelId, url, panel.isPrivate === true);
});

ipcMain.on("show-container-menu", (event, panelId) => {
    if (!win || win.isDestroyed() || event.sender !== win.webContents) return;
    const panel = findPanelNode(rootNode, panelId);
    if (!panel || panel.isPrivate || maximizedPanelId !== null) return;

    Menu.buildFromTemplate(Object.entries(TILE_CONTAINERS).map(([id, container]) => ({
        label: container.label,
        click: () => ipcMain.emit("split-panel", null, panelId, "vertical", false, id)
    }))).popup({ window: win });
});

// ====== DANS MAIN.JS -> ipcMain.on("split-panel", ...) ======
ipcMain.on("split-panel", (event, panelId, direction, isPrivate = false, containerId = null) => {

    const node = findPanelNode(rootNode, panelId);
    const parent = findParentNode(rootNode, panelId);    

    const newPanelId = "panel" + nextPanelNumber++;
    if (isPrivate || !isValidContainerId(containerId)) containerId = null;

    let targetSession;
    if (isPrivate) {
        const privatePartition = `incognito_${newPanelId}`;
        targetSession = session.fromPartition(privatePartition, { cache: false });
        
        // 🔥 Activation du bloqueur sur cette nouvelle session privée
        enableAdBlockerForSession(targetSession);
    } else {
        targetSession = containerId ? getContainerSession(containerId) : session.defaultSession;
    }
	
    const viewOptions = {
        webPreferences: {
            session: targetSession, // ✨ Forcé pour toutes les tuiles publiques
            contextIsolation: true,
            nodeIntegration: false,
            
            // OPTIONS DE NETTOYAGE RAM EXISTANTES :
            backgroundThrottling: true,      
            offscreen: false,                
            spellcheck: false,               
            enableWebSQL: false,             
            webSecurity: true,
            allowRunningInsecureContent: false
        }
    };

    const newView = createSandboxedBrowserView(viewOptions);
    win.addBrowserView(newView);

    if (isPrivate) {
        const privateSession = newView.webContents.session;
        const deniedPermissions = [
            'geolocation',
            'geolocation-approximate',
            'media',
            'notifications',
            'midiSysex',
            'sensors'
        ];

        privateSession.setPermissionRequestHandler((webContents, permission, callback) => {
            if (deniedPermissions.includes(permission)) {
                console.log(`[SÉCURITÉ] Permission '${permission}' refusée en navigation privée.`);
                return callback(false);
            }
            callback(true);
        });
        privateSession.setPermissionCheckHandler((_webContents, permission) => {
            return !deniedPermissions.includes(permission);
        });
    }

    // --- CORRECTION DU THÈME INCOGNITO ---
    // Au lieu de lire une variable globale, on demande directement à Electron son état réel
    const isDark = isDarkModeForced;
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

    // Les nouvelles tuiles publiques démarrent sur l'accueil Hare Browser,
    // et non directement sur l'instance SearXNG.
    const defaultUrl = isPrivate
        ? "data:text/html;charset=utf-8," + encodeURIComponent(incognitoHomeHtml)
        : getHomePageUrl();

    newView.webContents.loadURL(defaultUrl);

    // Passer le paramètre isPrivate au constructeur
    const newPanel = new PanelNode(newPanelId, newView, defaultUrl, isPrivate, containerId);
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

















async function createDefaultLayout() {

    // On instancie uniquement 2 vues de navigation au lieu de 3
    leftView = createSandboxedBrowserView();
    centerView = createSandboxedBrowserView();

    win.addBrowserView(leftView);
    win.addBrowserView(centerView);

    const homePageUrl = getHomePageUrl();
    const welcomePageUrl = getPathToFileURL(path.join(__dirname, "welcome.html")).href;

    // Reconstruction de la structure de l'arbre en 2 panneaux verticaux (50/50)
    rootNode = new SplitNode("vertical");
    rootNode.ratio = 0.5; // Division parfaite au milieu de l'écran utile

    rootNode.first = new PanelNode("panel1", leftView, homePageUrl);
    rootNode.second = new PanelNode("panel2", centerView, welcomePageUrl);

    // Initialisation des écouteurs de navigation sur nos deux panneaux actifs
    collectPanelNodes(rootNode).forEach((panel) => {
        setupNavigationTracking(panel);
    });

    [leftView, centerView].forEach(view => {
        if (typeof view.webContents.setForceDarkModeEnabled === 'function') {
            view.webContents.setForceDarkModeEnabled(isDarkModeForced);
        }
    });

    // Termine home.html avant de démarrer welcome.html afin d'éviter deux
    // chargements initiaux simultanés.
    try {
        await leftView.webContents.loadURL(homePageUrl);
        applyThemeToView(leftView);
    } catch (error) {
        console.error("Erreur de chargement de la tuile d'accueil :", error);
    }

    try {
        await centerView.webContents.loadURL(welcomePageUrl);
        applyThemeToView(centerView);
    } catch (error) {
        console.error("Erreur de chargement de la tuile de bienvenue :", error);
    }

    updateNavigationButtons();
}

async function createWindow() {

    await fsPromises.mkdir(appDataPath, { recursive: true });
    loadAutoSleepPreference();  
    loadAiSidebarPreference();
    loadDownloadsList();
    isDarkModeForced = await getThemePreference();
    nativeTheme.themeSource = isDarkModeForced ? "dark" : "light";

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
            nodeIntegration: false,
            sandbox: true
        }
    });

  //win.setMaxListeners(30);
    win.setMaxListeners(0);

    registerDownloadHandler(win.webContents.session);

    process.on("warning", (warning) => {
        console.log("WARNING NAME:", warning.name);
        console.log("WARNING MESSAGE:", warning.message);
        console.log("WARNING STACK:", warning.stack);
    });

    win.webContents.on("did-finish-load", () => {
        win.webContents.send("app-title", APP_TITLE);
    });

    if (!(await restorePersistedSession())) {
        await createDefaultLayout();
    }

    collectPanelNodes(rootNode).forEach(panel => {
        if (
            panel.view &&
            typeof panel.view.webContents.setForceDarkModeEnabled === 'function'
        ) {
            panel.view.webContents.setForceDarkModeEnabled(isDarkModeForced);
        }
    });    

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

                /*
                {
                    label: "Ouvrir le gestionnaire des tâches",
                    accelerator: "CmdOrCtrl+Alt+T",
                    click: () => {
                        // La méthode correcte en Electron pour ouvrir les DevTools de la fenêtre 
                        // principale et accéder à l'onglet de monitoring des processus
                        if (win && !win.isDestroyed()) {
                            win.webContents.openDevTools({ mode: 'detach' });
                        }
                    }
                },
                */

                {
                    label: 'Réinitialiser la mosaïque à tailles égales',
                    accelerator: 'CmdOrCtrl+Shift+R',
                    click: () => {
                        if (!rootNode) return;

                        // 1. Sauvegarde l'état actuel dans l'historique pour permettre un Ctrl+Z
                        saveState();

                        // 2. Parcourt l'arbre et égalise tous les ratios
                        resetTreeRatiosEqual(rootNode);

                        // 3. Force Electron à recalculer et ré-afficher les vues web instantanément
                        forceRebuildSplitters = true;
                        resizeViews();

                        console.log("[Mosaïque] Ratios réinitialisés à parts égales.");
                    }
                },


                {
                    label: 'Afficher / Masquer le volet de l\'assistant IA',
                    accelerator: 'CmdOrCtrl+Shift+A',
                    click: () => {
                        if (!win || win.isDestroyed()) return;
                        setAiSidebarVisible(!isAiSidebarVisible);
                    }
                },
                {
                    label: 'Quitter le mode agrandi',
                    accelerator: 'Escape',
                    click: () => {
                        if (!win || win.isDestroyed()) return;

                        // Escape doit sortir du mode plein écran avant de restaurer une tuile agrandie.
                        if (win.isFullScreen()) {
                            win.setFullScreen(false);
                            return;
                        }

                        let geometryChanged = false;

                        // Escape ne sert plus à fermer le volet IA : il ne quitte que le mode agrandi.
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
                                        const newView = createSandboxedBrowserView(viewOptions);
                                        win.addBrowserView(newView);
                                        newView.webContents.loadURL(node.realUrl || node.url || "http://129.151.254.175:8080");

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

                {
                    label: 'Rechercher dans la page',
                    accelerator: 'CmdOrCtrl+F',
                    click: () => {
                        if (!win || win.isDestroyed() || !activePanel) return;
                        win.webContents.focus();
                        win.webContents.send('open-find-bar', activePanel);
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
                    label: 'Basculer le plein écran global',
                    accelerator: 'F11',
                    click: () => {
                        if (win && !win.isDestroyed()) {
                            win.setFullScreen(!win.isFullScreen());
                        }
                    }
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
                            detail: 'La disposition sera sauvegardée automatiquement pour la prochaine ouverture.'
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
                        setNormalToolbarHeight(isBookmarksBarVisible ? 105 : TOOLBAR_MIN_HEIGHT);

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
                    label: 'Afficher les téléchargements',
                    accelerator: 'CmdOrCtrl+J',
                    click: () => ipcMain.emit('open-downloads-window')
                },

                {
                    label: 'Dupliquer la tuile active',
                    accelerator: 'CmdOrCtrl+Shift+D',
                    click: () => {
                        if (activePanel) ipcMain.emit('duplicate-panel-request', { sender: win.webContents }, activePanel);
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
            if (!win || win.isDestroyed()) return;
            resizeViews();
        }, 30); // Petit délai pour laisser Electron respirer
    });

    // Prise en charge du mode plein écran (Maximized / Fullscreen)
    win.on("maximize", () => {
        resizeViews();
    });

    win.on("unmaximize", () => {
        resizeViews();
    });

    win.on("enter-full-screen", () => {
        normalToolbarHeight = TOOLBAR_HEIGHT;
        isFullscreenMode = true;
        isFullscreenToolbarVisible = false;
        TOOLBAR_HEIGHT = FULLSCREEN_COLLAPSED_TOOLBAR_HEIGHT;
        win.webContents.send("fullscreen-toolbar-state", { fullscreen: true, visible: false });
        forceRebuildSplitters = true;
        resizeViews();
    });

    win.on("leave-full-screen", () => {
        isFullscreenMode = false;
        isFullscreenToolbarVisible = true;
        TOOLBAR_HEIGHT = normalToolbarHeight;
        win.webContents.send("fullscreen-toolbar-state", { fullscreen: false, visible: true });
        forceRebuildSplitters = true;
        resizeViews();
    });

    // À mettre à la fin de la fonction createWindow() dans main.js
    app.on('web-contents-created', (event, contents) => {
        
        // 🔒 SÉCURITÉ A : Bloquer l'ouverture de nouvelles fenêtres non contrôlées
        contents.setWindowOpenHandler(({ url }) => {
            console.log(`[SÉCURITÉ GLOBALE] Ouverture de fenêtre bloquée pour l'URL : ${url}`);
            
            // Au lieu d'ouvrir une pop-up Electron instable, on force l'ouverture
            // sécurisée dans le navigateur par défaut du système d'exploitation de l'utilisateur.
            const { shell } = require('electron');
            shell.openExternal(url).catch(err => console.error(err));
            
            return { action: 'deny' }; // Refuse la création de la fenêtre interne Electron
        });

        // 🔒 SÉCURITÉ B : Bloquer les changements de navigation non sollicités sur le cadre parent
        contents.on('will-redirect', (navigationEvent, navigationUrl) => {
            // Optionnel : Vous pouvez analyser l'URL ici pour bloquer les redirections vers des protocoles dangereux
            if (navigationUrl.startsWith('file:') && !navigationUrl.includes(__dirname)) {
                navigationEvent.preventDefault(); // Interdit l'accès aux fichiers locaux de l'OS depuis le web
                console.warn(`[SÉCURITÉ GLOBALE] Tentative d'accès illégal aux fichiers locaux bloquée : ${navigationUrl}`);
            }
        });
    });

    // Intercepte le clic sur la croix de fermeture de la fenêtre principale
    win.on('close', (e) => {
        // Empêche la fermeture immédiate le temps de demander confirmation
        e.preventDefault();

        // 🌟 CORRECTIF CRUCIAL : On désactive temporairement le premier plan des fenêtres secondaires
        if (historyWindow && !historyWindow.isDestroyed()) {
            historyWindow.setAlwaysOnTop(false);
        }
        if (pwdWindow && !pwdWindow.isDestroyed()) {
            pwdWindow.setAlwaysOnTop(false);
        }

        // On affiche la boîte de dialogue en la liant à la fenêtre principale 'win'
        const response = dialog.showMessageBoxSync(win, {
            type: 'question',
            buttons: ['Oui, quitter', 'Annuler'],
            defaultId: 1, 
            cancelId: 1,  
            title: 'Confirmation',
            message: `Êtes-vous sûr de vouloir fermer ${APP_TITLE} ?`,
            detail: 'La disposition sera sauvegardée automatiquement pour la prochaine ouverture.'
        });

        // Seul l'index 0 ("Oui, quitter") détruit la fenêtre
        if (response === 0) {
            if (sessionSaveTimer) {
                clearTimeout(sessionSaveTimer);
                sessionSaveTimer = null;
            }
            saveAutoSleepPreference();
            persistSessionLayout();
            win.destroy(); 
        } else {
            // 🌟 RESTAURATION : Si l'utilisateur annule, on remet le "Always on Top" pour garder le comportement d'origine
            if (historyWindow && !historyWindow.isDestroyed()) {
                historyWindow.setAlwaysOnTop(true);
            }
            if (pwdWindow && !pwdWindow.isDestroyed()) {
                pwdWindow.setAlwaysOnTop(true);
            }
        }
    });

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

    // Escape ne sert qu'à quitter le mode agrandi / plein écran
    win.on('focus', () => {
        globalShortcut.register('Escape', () => {
            if (!win || win.isDestroyed()) return;

            if (win.isFullScreen()) {
                win.setFullScreen(false);
                return;
            }

            let geometryChanged = false;

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
        autoHideMenuBar: true, // Masque la barre de menu supérieure
        webPreferences: {
            sandbox: true,
            contextIsolation: true,
            nodeIntegration: false
        }
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

        win.webContents.send(
            "panels-updated",
            collectPanels(rootNode),
            maximizedPanelId
        );

    }
}





/**
 * Parcourt récursivement l'arbre binaire des fractionnements
 * et réinitialise tous les ratios à 0.5 (tailles égales).
 * @param {Object} node - Le nœud actuel de l'arbre (SplitNode ou PanelNode)
 */
function resetTreeRatiosEqual(node) {
    if (!node || node.type !== "split") return;

    // Réinitialise le ratio actuel au centre parfait (50/50)
    node.ratio = 0.5;

    // Continue le parcours récursif sur les enfants gauches/droits ou hauts/bas
    resetTreeRatiosEqual(node.first);
    resetTreeRatiosEqual(node.second);
}






function resizeViews() {
    if (!win || win.isDestroyed()) return;
    const bounds = win.getContentBounds();
    if (bounds.width <= 0 || bounds.height <= 0) return;

    // Keep the AI sidebar aligned with the top edge of the browser panels.
    if (lastAiSidebarTopPosition !== TOOLBAR_HEIGHT) {
        lastAiSidebarTopPosition = TOOLBAR_HEIGHT;
        win.webContents.send("ai-sidebar-geometry-update", {
            topPosition: TOOLBAR_HEIGHT
        });
    }
    
    let width = bounds.width; 
    const height = bounds.height;
    
    splitters.length = 0;

    if (forceRebuildSplitters) {
        splitterViews.forEach((v) => { try { win.removeBrowserView(v); } catch(e) {} });
        splitterViews = [];
        forceRebuildSplitters = false;
    }

    // L'assistant IA est rendu dans index.html ; on réserve sa largeur (élargie pour les comparaisons).
    if (isAiSidebarVisible) {
        const sidebarWidth = getAiSidebarWidth(bounds.width);
        if (sidebarWidth !== lastAiSidebarWidth) {
            lastAiSidebarWidth = sidebarWidth;
            win.webContents.send("ai-sidebar-width-changed", sidebarWidth);
        }
        width = width - sidebarWidth;
    }

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
        const cursor = splitter.direction === "vertical" ? "col-resize" : "row-resize";
        const handleDirection = splitter.direction === "vertical" ? "column" : "row";

        let splitterView;

        // Si la BrowserView du splitter existe déjà à cet index, on réutilise et met à jour ses dimensions
        if (splitterViews[index]) {
            splitterView = splitterViews[index];
            splitterView.setBounds({ x: splitter.x, y: splitter.y, width: splitter.width, height: splitter.height });
            return;
        }

        // Sinon, on instancie une nouvelle BrowserView sandboxée
        splitterView = createSandboxedBrowserView();
        win.addBrowserView(splitterView);
        splitterViews.push(splitterView);

        splitterView.setBounds({ x: splitter.x, y: splitter.y, width: splitter.width, height: splitter.height });
        splitterView.webContents.loadURL("data:text/html," + encodeURIComponent(`
            <html><head><style>
            html, body { margin: 0; padding: 0; overflow: hidden !important; width: 100%; height: 100%; }
            
            body { 
                box-sizing: border-box; 
                background: ${splitterBg}; 
                display: flex; 
                align-items: center; 
                justify-content: center; 
                cursor: ${cursor}; 
                /* ✨ TRANSITION FLUIDE : Anime la couleur de fond du splitter */
                transition: background 0.22s ease-in-out;
            }
            
            /* ✨ EFFET SURVOL DU SPLITTER : Changement de couleur fluide */
            body:hover { 
                background: ${splitterHover}; 
            }
            
            #handle { 
                position: absolute; 
                top: 50%; 
                left: 50%; 
                transform: translate(-50%, -50%); 
                display: flex; 
                flex-direction: ${handleDirection}; 
                gap: 2.5px; 
                padding: 4px;
                border-radius: 4px;
                background: transparent;
                /* ✨ TRANSITION : Prépare l'élargissement visuel de la zone des points */
                transition: background 0.2s ease-in-out;
            }
            
            /* ✨ ÉPAISSISSEMENT VISUEL AU SURVOL : Donne une sensation d'accroche */
            body:hover #handle {
                background: ${isDarkModeForced ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"};
            }

            .dot { 
                display: block; 
                width: 3px; 
                height: 3px; 
                background: ${splitterDots}; 
                border-radius: 50%; 
                /* ✨ TRANSITION UNIDIRECTIONNELLE : Permet un grossissement fluide */
                transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), background 0.2s;
            }
            
            /* ✨ ANIMATION MAGIQUE : Fait grossir les 3 points de 40% au survol */
            body:hover .dot { 
                transform: scale(1.4);
                background: ${isDarkModeForced ? "#ffffff" : "#4b5563"};
            }
            
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

    const serializableSplitters = splitters.map(({ node, ...splitter }) => splitter);
    win.webContents.send("splitters-updated", serializableSplitters);

    // 4. Mettre à jour la position des liserés bleus
    if (activePanel) {
        const activeNode = findPanelNode(rootNode, activePanel);
        if (activeNode) {
            let targetBounds = null;

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
                targetBounds = {
                    x: activeNode.bounds.x,
                    y: activeNode.bounds.y,
                    width: activeNode.bounds.width,
                    height: activeNode.bounds.height
                };
            }

            if (targetBounds) {
                updateActiveBorder(targetBounds);
            } else {
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

    updatePanelHandles();
    win.webContents.send("splitters-updated", serializableSplitters);
    win.webContents.send("zoom-changed", maximizedPanelId); 
    scheduleSessionLayoutSave();
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
    setNormalToolbarHeight(TOOLBAR_MIN_HEIGHT);
    win.webContents.send("toggle-bookmarks-bar", false);
    forceRebuildSplitters = true;
    resizeViews();
});

ipcMain.on("fullscreen-toolbar-request", (event, visible) => {
    setFullscreenToolbarVisible(visible === true);
});

ipcMain.on("toggle-fullscreen-request", () => {
    if (win && !win.isDestroyed()) {
        win.setFullScreen(!win.isFullScreen());
    }
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

// 🛠️ Dans main.js -> Recherchez l'écouteur "set-active-panel" :
ipcMain.on("set-active-panel", (event, panelId, options) => {
    const panel = findPanelNode(rootNode, panelId);
    if (!panel) return;
    
    if (panel.isSleeping && !keepChromeFocus) {
        wakePanel(panel);
        return;
    }

    activePanel = panelId;
    scheduleSessionLayoutSave();
    const keepChromeFocus = options && options.keepChromeFocus;
    
    // ✨ MODIFICATION ICI : On ajoute 'isPrivate' dans le message envoyé à index.html
    win.webContents.send("active-panel-changed", { 
        id: panel.id, 
        bounds: panel.bounds,
        isPrivate: panel.isPrivate === true // 🌟 Transmettre l'état privé à l'IHM
    });

    updateActiveBorder(panel.bounds, keepChromeFocus ? { skipRaise: true } : undefined);
    
    if (!keepChromeFocus) {
        win.webContents.send("panels-updated", collectPanels(rootNode), maximizedPanelId);
    }
    
    if (!keepChromeFocus && panel.view && !panel.view.webContents.isDestroyed()) {
        panel.view.webContents.focus();
    }
});

// Intercepte les demandes de focus issues de la poignée injectée
ipcMain.on("set-active-panel-from-handle", (event, panelId) => {
    const panel = findPanelNode(rootNode, panelId);
    if (!panel) return;
    activePanel = panelId;
    scheduleSessionLayoutSave();
    win.webContents.send("active-panel-changed", { id: panel.id, bounds: panel.bounds });
    updateActiveBorder(panel.bounds);
});

// Écouteurs IPC pour que l'interface graphique puisse interagir avec les favoris
ipcMain.handle('get-favoris', () => {
    return getFavoris();
});


ipcMain.handle('open-help', async () => {
    try {
        return await openHelpInPanel();
    } catch (error) {
        console.error("Erreur lors de l’ouverture de l’aide :", error);
        return false;
    }
});


// À ajouter dans main.js avec vos autres ipcMain.handle
ipcMain.handle('clear-favoris', () => {
    try {
        // Écrit un tableau vide dans le fichier des favoris
        fs.writeFileSync(getFavorisPath(), JSON.stringify([]));
        
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
            // À l'intérieur de ipcMain.handle('load-config-from-file') ->
            function rebuildTreeFromImport(node) {
                if (!node) return null;

                if (node.type === "panel") {
                    let targetSession;
                    const importedContainerId = isValidContainerId(node.containerId) && !node.isPrivate ? node.containerId : null;
                    if (node.isPrivate) {
                        targetSession = session.fromPartition(`incognito_panel_${Math.random()}`, { cache: false });
                    } else {
                        // ✨ PARTAGE INTELLIGENT : Utilise la session racine globale lors d'un import
                        targetSession = importedContainerId ? getContainerSession(importedContainerId) : session.defaultSession;
                    }

                    const viewOptions = {
                        webPreferences: {
                            session: targetSession,
                            contextIsolation: true,
                            nodeIntegration: false
                        }
                    };
                    const newView = createSandboxedBrowserView(viewOptions);
                    win.addBrowserView(newView);
                    newView.webContents.loadURL(node.realUrl || node.url || "http://129.151.254.175:8080");

                    const newNode = new PanelNode(node.id, newView, node.url, !!node.isPrivate, importedContainerId);
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

// L'interface IA demande à récupérer le texte de la page active pour son LLM
async function extractVisiblePanelContext(panel, fullMode = false) {
    if (!panel || panel.isSleeping || !panel.bounds ||
        panel.bounds.width <= 0 || panel.bounds.height <= 0 ||
        !panel.view?.webContents || panel.view.webContents.isDestroyed()) {
        return null;
    }

    const contents = panel.view.webContents;
    try {
        const page = await contents.executeJavaScript(`
            (() => {
                const clone = document.body ? document.body.cloneNode(true) : null;
                if (!clone) return { title: document.title || "", url: location.href || "", text: "" };

                // Prix fiable issu des données structurées (JSON-LD / microdata), évite de confondre avec éco-part ou mensualités
                const structured = [];
                const collectOffers = (node) => {
                    if (!node || typeof node !== "object") return;
                    if (Array.isArray(node)) { node.forEach(collectOffers); return; }
                    const type = [].concat(node["@type"] || []).join(",");
                    if (/Product/i.test(type) && node.name) structured.push("Produit : " + node.name);
                    if (/Offer/i.test(type)) {
                        const price = node.price ?? node.lowPrice;
                        if (price !== undefined) structured.push("Prix actuel du produit : " + price + " " + (node.priceCurrency || ""));
                    }
                    Object.values(node).forEach((value) => { if (value && typeof value === "object") collectOffers(value); });
                };
                document.querySelectorAll('script[type="application/ld+json"]').forEach((script) => {
                    try { collectOffers(JSON.parse(script.textContent)); } catch (e) {}
                });
                const metaPrice = document.querySelector('meta[property="product:price:amount"], meta[itemprop="price"], [itemprop="price"][content]');
                if (metaPrice && metaPrice.getAttribute("content")) structured.push("Prix actuel du produit : " + metaPrice.getAttribute("content"));
                const structuredText = Array.from(new Set(structured)).slice(0, 6).join("\\n");

                clone.querySelectorAll(
                    'script, style, noscript, iframe, canvas, svg, nav, header, footer, form, aside, dialog, [aria-hidden="true"]'
                ).forEach((element) => element.remove());

                const preferred = clone.querySelector(
                    'article, [role="main"], main, .post-content, .entry-content, .article-content'
                );
                const root = preferred || clone;
                const sections = Array.from(root.querySelectorAll('h1, h2, h3, h4, h5, h6, p, li, tr'))
                    .map((element) => (element.innerText || element.textContent || "").trim())
                    .filter((text) => text.length > 15);
                const text = (structuredText ? structuredText + "\\n\\n" : "") + (${fullMode ? "true" : "false"}
                    ? (document.body.innerText || "").trim()
                    : sections.length
                    ? sections.join("\\n\\n")
                    : (root.innerText || root.textContent || "").trim());

                return {
                    title: document.title || "Sans titre",
                    url: location.href || "",
                    text
                };
            })();
        `);

        const text = typeof page?.text === "string" ? page.text.trim() : "";
        if (!text) return null;
        let safeUrl = page.url || contents.getURL();
        try {
            const parsedUrl = new URL(safeUrl);
            parsedUrl.username = "";
            parsedUrl.password = "";
            parsedUrl.search = "";
            parsedUrl.hash = "";
            safeUrl = parsedUrl.href;
        } catch {}

        let siteName = panel.title || "Site";
        try { siteName = new URL(safeUrl).hostname.replace(/^www\./, ""); } catch {}

        return {
            panelId: panel.id,
            siteName,
            title: page.title || panel.title || "Sans titre",
            url: safeUrl,
            text: text.slice(0, fullMode ? 20000 : 5000)
        };
    } catch (error) {
        console.warn(`[RAG] Extraction impossible pour la tuile ${panel.id} :`, error.message);
        return null;
    }
}

const TILE_COUNT_WORDS = { un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6 };

// Détecte les demandes multi-tuiles ("mes 3 tuiles de gauche", "toutes les tuiles"...)
function isMultiTilePrompt(prompt) {
    return /\btuiles\b|\bonglets visibles\b|\bpages affich/i.test(prompt || "");
}

// Restreint et ordonne les tuiles selon "N tuiles de gauche/droite/haut/bas"
function selectPanelsByPrompt(panels, prompt) {
    const text = (prompt || "").toLowerCase();
    const match = text.match(/(?:(\d+|un|une|deux|trois|quatre|cinq|six)\s+)?(?:premi[eè]res?\s+|derni[eè]res?\s+)?tuiles?\s+(?:de |du |à |a |situées? (?:à |a )?)?(?:la |l')?(gauche|droite|haut|bas)/);
    const byX = (a, b) => a.bounds.x - b.bounds.x || a.bounds.y - b.bounds.y;
    const byY = (a, b) => a.bounds.y - b.bounds.y || a.bounds.x - b.bounds.x;
    if (!match) return [...panels].sort(byX);

    const count = match[1] ? (Number(match[1]) || TILE_COUNT_WORDS[match[1]]) : panels.length;
    const sorted = [...panels].sort({
        gauche: byX,
        droite: (a, b) => byX(b, a),
        haut: byY,
        bas: (a, b) => byY(b, a)
    }[match[2]]);
    return sorted.slice(0, count);
}

async function collectVisiblePanelsContext(prompt = "", fullMode = false) {
    const visiblePanels = selectPanelsByPrompt(collectPanelNodes(rootNode).filter((panel) =>
        !panel.isSleeping && panel.bounds &&
        panel.bounds.width > 0 && panel.bounds.height > 0 &&
        panel.view?.webContents && !panel.view.webContents.isDestroyed()
    ), prompt);

    const contexts = await Promise.all(visiblePanels.map((panel) => extractVisiblePanelContext(panel, fullMode)));
    return contexts.filter(Boolean);
}

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


ipcMain.handle("nanobrowser-ask-ollama", async (event, {
    prompt,
    model = "qwen2.5:1.5b",
    compareVisiblePanels: compareVisiblePanelsArg = false,
    fullMode = false
} = {}) => {
    let compareVisiblePanels = compareVisiblePanelsArg;
    console.log(`\n[IA RAG ${fullMode ? "COMPLET" : "LIGHT"}] Déclenchement de la requête...`);
    compareVisiblePanels = compareVisiblePanels || isMultiTilePrompt(prompt);
    
    if (!compareVisiblePanels && !activePanel) {
        return "SELECT_PANEL_REQUIRED";
    }

    const panel = activePanel ? findPanelNode(rootNode, activePanel) : null;
    if (!compareVisiblePanels && (!panel || !panel.view)) return "Tuile introuvable.";

    // 1. Activer immédiatement l'indicateur de chargement natif et de l'IHM
    if (win && !win.isDestroyed()) {
        win.setProgressBar(2, { mode: 'indeterminate' }); 
        win.webContents.send("ai-loading-state", true);
    }

    try {
        const pageContexts = compareVisiblePanels
            ? await collectVisiblePanelsContext(prompt, fullMode)
            : [await extractVisiblePanelContext(panel, fullMode)].filter(Boolean);
        if (pageContexts.length === 0) {
            return compareVisiblePanels
                ? "Aucune tuile visible ne contient de texte exploitable."
                : "La tuile active ne contient pas de texte exploitable.";
        }

        const contextBudget = fullMode ? 48000 : 15000;
        let remainingContext = contextBudget;
        const formattedContexts = pageContexts.map((page) => {
            const header = `Source ${page.siteName} — ${page.title} — ${page.url}`;
            const availableTextLength = Math.max(0, remainingContext - header.length - 100);
            const text = page.text.slice(0, Math.min(fullMode ? 20000 : 5000, availableTextLength));
            remainingContext -= header.length + text.length + 100;
            return `${header}\n${text}`;
        });

        const combinedContext = formattedContexts.join("\n\n--- CONTEXTE DE LA SOURCE SUIVANTE ---\n\n");
        const panelContextSummary = pageContexts
            .map((page) => `- ${page.siteName} : ${page.title} (${page.url})`)
            .join("\n");

        // Envoi et attente de la réponse de la requête HTTP vers Ollama
        const resultOllama = await new Promise((resolve, reject) => {
            try {
                let systemInstruction = "";
                if (prompt.toLowerCase().includes("résumé") || prompt.toLowerCase().includes("resume")) {
                    systemInstruction = compareVisiblePanels
                        ? `Tu es un assistant IA intégré au navigateur. Réponds en français, de façon claire et concise. Résume les informations pertinentes des tuiles visibles, en séparant les sources lorsque c'est utile. N'invente aucune donnée absente des extraits.\n\nTuiles fournies :\n${panelContextSummary}\n\nContenu extrait :\n${combinedContext}`
                        : `Tu es un assistant IA intégré au navigateur. Réponds en français de façon claire et concise en résumant uniquement la page active ci-dessous. N'invente aucune donnée absente de l'extrait.\n\nPage active :\n${panelContextSummary}\n\nContenu extrait :\n${combinedContext}`;
                } else {
                    systemInstruction = compareVisiblePanels
                        ? `Tu es un assistant IA intégré au navigateur. Réponds en français à la demande en te basant exclusivement sur le contenu des tuiles visibles. Compare leurs sources et construis un seul tableau Markdown : une colonne par produit/tuile, nomm\u00e9e d'apr\u00e8s le site ou le produit (jamais un identifiant de tuile), une ligne par caractéristique (prix, autonomie, poids, garantie...), sans répéter une même caractéristique sur plusieurs lignes. Pour le prix, utilise en priorité la ligne « Prix actuel du produit » de chaque source ; ignore éco-participation, mensualités et anciens prix. N'invente aucune donnée absente des extraits et précise lorsqu'une information manque.\n\nTuiles fournies :\n${panelContextSummary}\n\nContenu extrait de chaque tuile :\n${combinedContext}`
                        : `Tu es un assistant IA intégré au navigateur. Réponds en français à la demande en te basant exclusivement sur le contenu de la page active ci-dessous. N'invente aucune donnée absente de l'extrait et précise lorsqu'une information manque.\n\nPage active :\n${panelContextSummary}\n\nContenu extrait :\n${combinedContext}`;
                }

                const postData = JSON.stringify({
                    model: model,
                    prompt: prompt,
                    system: systemInstruction,
                    stream: false,
                    ...(fullMode ? { options: { num_ctx: 16384 } } : {})
                });

                const http = getNodeModule("http");
                const req = http.request({
                    hostname: '127.0.0.1',
                    port: 11434,
                    path: '/api/generate',
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(postData)
                    }
                }, (res) => {
                    let responseBody = '';
                    res.setEncoding('utf8');
                    res.on('data', (chunk) => responseBody += chunk);
                    res.on('end', () => {
                        if (res.statusCode < 200 || res.statusCode >= 300) {
                            resolve(`Erreur Ollama (${res.statusCode})`);
                            return;
                        }
                        try {
                            const result = JSON.parse(responseBody);
                            resolve(result.response || "L'IA locale a renvoyé une réponse vide.");
                        } catch (error) {
                            resolve(`Réponse Ollama invalide.`);
                        }
                    });
                });

                req.setTimeout(120000, () => req.destroy(new Error('Timeout')));
                req.on('error', (error) => resolve(`Impossible de joindre l'IA locale.`));

                req.write(postData);
                req.end();

            } catch (innerError) {
                reject(innerError);
            }
        });

        return resultOllama;

    } catch (err) {
        console.error("[IA RAG LIGHT] Erreur générale :", err);
        return `Erreur interne : ${err.message}`;
    } finally {
        // 2. Nettoyage et arrêt SYSTEMATIQUE de la barre de progression (Succès OU Échec)
        if (win && !win.isDestroyed()) {
            win.setProgressBar(-1); 
            win.webContents.send("ai-loading-state", false);
        }
    }
});

// L'interface IA demande à exécuter une action (ex: cliquer sur un bouton)
ipcMain.handle("nanobrowser-execute-action", async (event, { actionType, argument }) => {
    if (!activePanel) return "No active panel";
    const panel = findPanelNode(rootNode, activePanel);
    if (!panel || !panel.view) return "Panel not found";
    
    if (actionType === "click") {
        return await panel.view.webContents.executeJavaScript(`window.NanobrowserExecutor.clickElement("${argument}")`);
    }
});


ipcMain.handle("get-theme-preference", () => {
    return getThemePreference();
});

ipcMain.handle("save-theme-preference", async (event, isDark) => { // 🌟 Déjà async dans votre code
    isDarkModeForced = isDark === true;

    // 🌟 Remplacement synchrone par asynchrone sécurisé
    await safeWriteJsonAsync(getThemePath(), { darkMode: isDarkModeForced });

    return true;
});

ipcMain.on("toggle-dark-mode-request", (_event, enabled) => {
    isDarkModeForced = enabled === true;
    nativeTheme.themeSource = isDarkModeForced ? "dark" : "light";
    const backgroundColor = isDarkModeForced ? "#252526" : "#f3f4f6";

    if (win && !win.isDestroyed()) {
        win.setBackgroundColor(backgroundColor);
        if (typeof win.setTitleBarOverlay === "function") {
            win.setTitleBarOverlay({
                color: isDarkModeForced ? "#252526" : "#ffffff",
                symbolColor: isDarkModeForced ? "#cfcfcf" : "#1f2937",
                height: 38
            });
        }

        collectPanelNodes(rootNode).forEach((panel) => {
            if (!panel.view || panel.view.webContents.isDestroyed()) return;
            if (typeof panel.view.webContents.setForceDarkModeEnabled === "function") {
                panel.view.webContents.setForceDarkModeEnabled(isDarkModeForced);
            }
            applyThemeToView(panel.view);
        });

        Object.entries(handleViews).forEach(([panelId, handleView]) => {
            try { win.removeBrowserView(handleView); } catch (error) {}
            if (handleView.webContents && !handleView.webContents.isDestroyed()) {
                try { handleView.webContents.destroy(); } catch (error) {}
            }
            delete handleViews[panelId];
        });

        forceRebuildSplitters = true;
        resizeViews();
        win.webContents.send("system-theme-changed", isDarkModeForced);
        updateHistoryWindowContent();
        updateDownloadsWindowContent();
        updatePasswordWindowContent();
    }

    void safeWriteJsonAsync(getThemePath(), { darkMode: isDarkModeForced });
});


// ====== AVEC LES AUTRES IPCMAIN (EX: SOUS LES ÉCOUTEURS DE FAVORIS) ======
ipcMain.handle('get-history', () => {
    return getNavigationHistory();
});

ipcMain.handle('clear-history', async () => {
    await safeWriteJsonAsync(getHistoryPath(), []); // <-- Remplacement ici
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
            fs.writeFileSync(getHistoryPath(), JSON.stringify(historyList, null, 2));
            
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

function isInternalFavoriteUrl(url) {
    try {
        const parsedUrl = new URL(url);
        if (parsedUrl.protocol !== "file:") return false;
        const filename = path.basename(decodeURIComponent(parsedUrl.pathname)).toLowerCase();
        return ["welcome.html", "home.html", "help.html"].includes(filename);
    } catch {
        return false;
    }
}

// Remplacement du gestionnaire d'ajout/suppression des favoris
ipcMain.handle('toggle-favori', async (event, { url, title }) => {
    try {
        let favoris = getFavoris();
        const index = favoris.findIndex(f => f.url === url);

        if (index >= 0) {
            favoris.splice(index, 1);
        } else if (isInternalFavoriteUrl(url)) {
            return false;
        } else {
            favoris.push({ url, title: title || url });
        }

        // Sauvegarde sécurisée, asynchrone et atomique (.tmp -> renommé)
        await safeWriteJsonAsync(getFavorisPath(), favoris); 
        
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

ipcMain.handle("find-in-page", (event, { panelId, text, action = "start" } = {}) => {
    if (!win || win.isDestroyed() || event.sender !== win.webContents) return null;
    if (!panelId || panelId !== activePanel) return null;

    const panel = findPanelNode(rootNode, panelId);
    const contents = panel?.view?.webContents;
    if (!contents || contents.isDestroyed()) return null;

    if (action === "focus") {
        contents.focus();
        return { panelId, requestId: null };
    }

    if (action === "stop") {
        contents.stopFindInPage("clearSelection");
        findInPageRequests.delete(panelId);
        return null;
    }

    const searchText = typeof text === "string" ? text.trim().slice(0, 500) : "";
    if (!searchText) {
        contents.stopFindInPage("clearSelection");
        findInPageRequests.delete(panelId);
        win.webContents.send("find-in-page-result", {
            panelId,
            activeMatchOrdinal: 0,
            matches: 0,
            finalUpdate: true
        });
        return null;
    }

    const requestId = contents.findInPage(searchText, {
        forward: action !== "previous",
        findNext: action === "next" || action === "previous",
        matchCase: false
    });
    findInPageRequests.set(panelId, { requestId, text: searchText });
    return { panelId, requestId };
});

app.on('will-quit', () => {
    if (sessionSaveTimer) {
        clearTimeout(sessionSaveTimer);
        sessionSaveTimer = null;
    }
    saveAutoSleepPreference();
    persistSessionLayout();
    globalShortcut.unregisterAll();
});

/*
// ✨ LOG DE DIAGNOSTIC DE PROD : Afficher la RAM totale toutes les 10 secondes dans le terminal
app.whenReady().then(() => {

    setInterval(() => {

        if (!win || win.isDestroyed()) return;

        // 1. Récupérer les métriques de TOUS les processus actifs d'Electron
        const metrics = app.getAppMetrics();
        
        // 2. Additionner la mémoire de chaque processus (convertie en Mo)
        let totalWorkingSetMemory = 0;
        metrics.forEach(proc => {
            totalWorkingSetMemory += proc.memory.workingSetSize;
        });
        
        const totalMemoryMo = (totalWorkingSetMemory / 1024).toFixed(2);
        const activeProcessesCount = metrics.length;

        console.log(`[DIAGNOSTIC RAM REEL] Total application : ${totalMemoryMo} Mo | Processus actifs : ${activeProcessesCount}`);
    }, 10000); // Toutes les 10 secondes

    createWindow(); 
});
*/
app.whenReady().then(createWindow);

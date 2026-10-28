// ---------------- //
// SCRIPT : main.js //
// ---------------- //

const {
    app,
    BrowserWindow,
    BrowserView,
    webContents,
    ipcMain,
    Menu,
    nativeImage,
    nativeTheme,
    dialog,
    globalShortcut,
    screen,
    safeStorage,
    session,
    shell
} = require('electron');


const fs = require("fs");
const fsPromises = require("fs/promises");
const path = require("path");
const net = require("net");
const https = require("https");
const { spawn } = require("child_process");
const HareI18n = require("./i18n.js");

let ollamaProcess = null;

// Runtime et modèle embarqués dans le package (Microsoft Store : aucun téléchargement/installeur exécuté au runtime).
const OLLAMA_BUNDLE_DIR = app.isPackaged
    ? path.join(process.resourcesPath, "ollama")
    : path.join(__dirname, "ollama-bundle");

const DEFAULT_OLLAMA_MODEL = "qwen2.5:1.5b";
let currentLanguage = "fr";

let applicationMenuTemplate = null;

async function ouvrirVideoTutoriel(videoFile) {
    // ✨ CORRECTIF SÉCURITÉ : Ajout de Blocker.mp4 (et Search.mp4 par anticipation si besoin)
    const allowedTutorials = new Set(["Mosaic_browsing.mp4", "Blocker.mp4", "Search.mp4"]);
    if (typeof videoFile !== "string" || !allowedTutorials.has(videoFile)) {
        throw new Error(`Fichier de tutoriel non autorisé : ${String(videoFile)}`);
    }

    const videoPath = path.join(__dirname, "videos", videoFile);
    if (!fs.existsSync(videoPath)) {
        throw new Error(`Fichier vidéo introuvable : ${videoPath}`);
    }
    const videoUrl = getPathToFileURL(videoPath).href;
    console.info("[Tutoriel] Création de la fenêtre vidéo :", videoPath);

    const videoWindow = new BrowserWindow({
        width: 1280,
        height: 720,
        title: "Tutoriel Hare Browser",
        autoHideMenuBar: true,
        backgroundColor: "#1e1e1e",
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true
        }
    });

    videoWindow.webContents.on("did-finish-load", () => {
        console.info("[Tutoriel] video-player.html chargé avec succès.");
    });
    videoWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
        console.error("[Tutoriel] Échec du chargement du lecteur :", {
            errorCode, errorDescription, validatedURL
        });
    });
    videoWindow.webContents.on("console-message", (_event, details) => {
        const log = details.level >= 2 ? console.error : console.info;
        log.call(console, `[Tutoriel player ${details.sourceId}:${details.lineNumber}] ${details.message}`);
    });

    try {
        await videoWindow.loadFile(path.join(__dirname, "video-player.html"), {
            query: { src: videoUrl }
        });
        console.info("[Tutoriel] Lecteur ouvert, source vidéo :", videoUrl);
        return { ok: true };
    } catch (error) {
        console.error("[Tutoriel] Impossible de charger video-player.html :", error);
        if (!videoWindow.isDestroyed()) videoWindow.close();
        throw error;
    }
}
async function ouvrirVideoTutoriel(videoFile) {
    // ✨ CORRECTIF SÉCURITÉ : Ajout de Blocker.mp4 (et Search.mp4 par anticipation si besoin)
    const allowedTutorials = new Set(["Mosaic_browsing.mp4", "Blocker.mp4", "Search.mp4"]);
    if (typeof videoFile !== "string" || !allowedTutorials.has(videoFile)) {
        throw new Error(`Fichier de tutoriel non autorisé : ${String(videoFile)}`);
    }

    const videoPath = path.join(__dirname, "videos", videoFile);
    if (!fs.existsSync(videoPath)) {
        throw new Error(`Fichier vidéo introuvable : ${videoPath}`);
    }
    const videoUrl = getPathToFileURL(videoPath).href;
    console.info("[Tutoriel] Création de la fenêtre vidéo :", videoPath);

    const videoWindow = new BrowserWindow({
        width: 1280,
        height: 720,
        title: "Tutoriel Hare Browser",
        autoHideMenuBar: true,
        backgroundColor: "#1e1e1e",
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true
        }
    });

    videoWindow.webContents.on("did-finish-load", () => {
        console.info("[Tutoriel] video-player.html chargé avec succès.");
    });
    videoWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
        console.error("[Tutoriel] Échec du chargement du lecteur :", {
            errorCode, errorDescription, validatedURL
        });
    });
    videoWindow.webContents.on("console-message", (_event, details) => {
        const log = details.level >= 2 ? console.error : console.info;
        log.call(console, `[Tutoriel player ${details.sourceId}:${details.lineNumber}] ${details.message}`);
    });

    try {
        await videoWindow.loadFile(path.join(__dirname, "video-player.html"), {
            query: { src: videoUrl }
        });
        console.info("[Tutoriel] Lecteur ouvert, source vidéo :", videoUrl);
        return { ok: true };
    } catch (error) {
        console.error("[Tutoriel] Impossible de charger video-player.html :", error);
        if (!videoWindow.isDestroyed()) videoWindow.close();
        throw error;
    }
}
    

function tr(id, replacements = {}) {
    return HareI18n.t(id, currentLanguage, replacements);
}

function translateMenuTemplate(items) {
    return items.map((item) => ({
        ...item,
        ...(item.id === "restore-bookmarks-menu-item" ? { visible: !isBookmarksBarVisible } : {}),
        ...(item.label ? { label: HareI18n.translateText(item.label, currentLanguage) } : {}),
        ...(item.submenu ? { submenu: translateMenuTemplate(item.submenu) } : {})
    }));
}

function rebuildApplicationMenu() {
    if (!win || win.isDestroyed() || !applicationMenuTemplate) return;
    win.setMenu(Menu.buildFromTemplate(translateMenuTemplate(applicationMenuTemplate)));
}

function setBookmarksBarVisible(visible) {
    if (typeof visible !== "boolean") return isBookmarksBarVisible;

    isBookmarksBarVisible = visible;
    saveBookmarksVisibilityPreference();
    setNormalToolbarHeight(normalToolbarHeight || TOOLBAR_MIN_HEIGHT);

    if (win && !win.isDestroyed()) {
        win.webContents.send("toggle-bookmarks-bar", isBookmarksBarVisible);
        if (settingsWindow && !settingsWindow.isDestroyed()) {
            settingsWindow.webContents.send("bookmarks-visibility-changed", isBookmarksBarVisible);
        }
    }
    rebuildApplicationMenu();
    return isBookmarksBarVisible;
}

function getOllamaExePath() {
    const fs = require("fs");
    const path = require("path");
    const candidates = [];

    if (app.isPackaged) {
        candidates.push(path.join(process.resourcesPath, "ollama", "ollama.exe"));
    } else {
        candidates.push(path.join(__dirname, "ollama-bundle", "ollama.exe"));
    }

    candidates.push(path.join(process.env.LOCALAPPDATA || "", "Ollama", "ollama.exe"));
    return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}


function startEmbeddedOllama() {

    const ollamaPath = getOllamaExePath();

    if (!ollamaPath) {
        console.error("[OLLAMA] ollama.exe introuvable");
        return;
    }

/*
    console.log(`[OLLAMA] Démarrage : ${ollamaPath}`);
*/

    const bundledModels = path.join(OLLAMA_BUNDLE_DIR, "models");

    ollamaProcess = spawn(
        ollamaPath,
        ["serve"],
        {
            windowsHide: true,
            env: {
                ...process.env,
                OLLAMA_ORIGINS: "*",
                OLLAMA_HOST: "127.0.0.1:11434",
                ...(fs.existsSync(bundledModels) ? { OLLAMA_MODELS: bundledModels } : {})
            }
        }
    );

    ollamaProcess.on("spawn", () => {
//      console.log("[OLLAMA] Processus démarré");
    });

    ollamaProcess.stdout.on("data", (data) => {
//      console.log("[OLLAMA STDOUT]", data.toString());
    });

    ollamaProcess.stderr.on("data", (data) => {
//      console.error("[OLLAMA STDERR]", data.toString());
    });

    ollamaProcess.on("error", (err) => {
        console.error("[OLLAMA ERROR]", err);
    });

    ollamaProcess.on("close", (code) => {
//      console.log("[OLLAMA CLOSE]", code);
    });
}

function waitForOllama(timeoutMs = 30000) {

    return new Promise((resolve, reject) => {

        const http = require("http");
        const start = Date.now();

        const check = () => {

            const req = http.get(
                "http://127.0.0.1:11434/api/tags",
                (res) => {

                    if (res.statusCode === 200) {
//                      console.log("[OLLAMA] Port 11434 disponible");
                        resolve(true);
                        return;
                    }

                    retry();
                }
            );

            req.on("error", retry);

            function retry() {

                if (Date.now() - start > timeoutMs) {
                    reject(
                        new Error(
                            "Timeout d'attente du serveur Ollama"
                        )
                    );
                    return;
                }

                setTimeout(check, 1000);
            }
        };

        check();
    });
}
``


let splash = null; // ✨ AJOUT : Variable globale pour le Splash Screen

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
//          console.log(`[ADBLOCK] Requête bloquée avec succès : ${details.url}`);
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

function resolveContextLinkUrl(rawLinkUrl, pageUrl = "") {
    if (typeof rawLinkUrl !== "string" || !rawLinkUrl.trim()) return "";

    let candidate = rawLinkUrl.trim();
    const wrapperParameters = ["url", "target", "dest", "destination", "uddg", "redirect", "redirect_url", "link", "u", "q"];
    const wrapperPath = /(?:^|\/)(?:url|redirect|out|link|away)(?:\/|$)/i;

    for (let depth = 0; depth < 5; depth++) {
        let parsed;
        try {
            parsed = new URL(candidate, depth === 0 ? pageUrl || undefined : undefined);
        } catch {
            return "";
        }

        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";

        const hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
        const infrastructureHost = hostname === SEARCH_ENGINE_HOST || net.isIP(hostname) !== 0;
        const isRedirectEndpoint = infrastructureHost || wrapperPath.test(parsed.pathname);
        let nestedTarget = "";

        if (isRedirectEndpoint) {
            for (const parameter of wrapperParameters) {
                if (parameter === "q" && !wrapperPath.test(parsed.pathname)) continue;
                const value = parsed.searchParams.get(parameter);
                if (!value || value === candidate) continue;
                try {
                    const nested = new URL(value, parsed.href);
                    if (nested.protocol === "http:" || nested.protocol === "https:") {
                        nestedTarget = nested.href;
                        break;
                    }
                } catch {}
            }
        }

        if (nestedTarget) {
            candidate = nestedTarget;
            continue;
        }

        // Ne jamais exposer l'IP de l'instance de recherche comme destination finale.
        if (hostname === SEARCH_ENGINE_HOST) return "";
        return parsed.href;
    }

    return "";
}

function getContextLinkHost(linkUrl) {
    if (!linkUrl) return "";
    try {
        const hostname = new URL(linkUrl).hostname.toLowerCase().replace(/^www\./, "");
        return hostname === SEARCH_ENGINE_HOST ? "" : normalizeAdBlockHost(hostname);
    } catch {
        return "";
    }
}

function openContextLinkInPanel(panelId, linkUrl) {
    const panel = findPanelNode(rootNode, panelId);
    if (!panel || !linkUrl) return;
    activePanel = panel.id;

    if (panel.isSleeping) {
        wakePanel(panel, linkUrl);
        return;
    }

    if (!panel.view?.webContents || panel.view.webContents.isDestroyed()) return;
    markPanelActivity(panel);
    panel.view.webContents.loadURL(linkUrl).catch((error) => {
        console.error(`[Menu contextuel] Impossible d’ouvrir le lien dans ${panel.id} :`, error);
    });
}

function openContextLinkInNewWindow(linkUrl, sourcePanelId) {
    if (!linkUrl) return null;

    const linkWindow = new BrowserWindow({
        width: 1100,
        height: 760,
        title: "Hare Browser",
        parent: win && !win.isDestroyed() ? win : undefined,
        autoHideMenuBar: true,
        backgroundColor: isDarkModeForced ? "#252526" : "#ffffff",
        webPreferences: {
            sandbox: true,
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    linkWindow.webContents.on("will-navigate", (event, targetUrl) => {
        try {
            const protocol = new URL(targetUrl).protocol;
            if (protocol !== "http:" && protocol !== "https:") event.preventDefault();
        } catch {
            event.preventDefault();
        }
    });
    linkWindow.webContents.on("page-title-updated", (_event, title) => {
        if (title && !linkWindow.isDestroyed()) linkWindow.setTitle(`${title} — Hare Browser`);
    });
    linkWindow.loadURL(linkUrl).catch((error) => {
        console.error(`[Menu contextuel] Impossible d’ouvrir le lien dans une nouvelle fenêtre (${sourcePanelId}) :`, error);
        if (!linkWindow.isDestroyed()) linkWindow.close();
    });
    return linkWindow;
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

function getContainerLabel(containerId) {
    const translationKey = {
        perso: "container.personal",
        travail: "container.work",
        compte2: "container.account2",
        compte3: "container.account3"
    }[containerId];
    return translationKey ? tr(translationKey) : "";
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

function getLanguagePath() {
    return path.join(appDataPath, 'language.json');
}

function loadLanguagePreference() {
    try {
        const saved = JSON.parse(fs.readFileSync(getLanguagePath(), 'utf8'));
        currentLanguage = HareI18n.normalizeLanguage(saved.language);
    } catch (error) {
        currentLanguage = 'fr';
        if (error.code !== 'ENOENT') console.error('Impossible de lire la langue préférée :', error);
    }
    return currentLanguage;
}

// =========================================================================
// ✨ VERSION CORRIGÉE : RECHARGEMENT DES TUILES AU CHANGEMENT DE LANGUE
// =========================================================================
async function saveLanguagePreference(language) {
    currentLanguage = HareI18n.normalizeLanguage(language);
    await safeWriteJsonAsync(getLanguagePath(), { language: currentLanguage });
    rebuildApplicationMenu();
    
    if (win && !win.isDestroyed()) win.webContents.send('language-changed', currentLanguage);
    
    // 🌐 Parcourt toutes les tuiles de la mosaïque pour appliquer la langue
    if (rootNode) {
        collectPanelNodes(rootNode).forEach((panel) => {
            const contents = panel.view?.webContents;
            if (contents && !contents.isDestroyed()) {
                contents.send('language-changed', currentLanguage);
                
                // ✨ FIX RADICAL : Si la tuile affiche welcome.html ou une page locale file://, 
                // on la force à se recharger pour reconstruire son DOM avec la bonne langue
                const currentUrl = contents.getURL();
                if (currentUrl.includes("welcome.html") || currentUrl.startsWith("file:")) {
                    contents.reload();
                    console.log(`[Langue] Tuile locale ${panel.id} rechargée de force en : ${currentLanguage}`);
                }
            }
        });
    }
    
    // Synchronise les autres fenêtres secondaires ouvertes
    for (const secondaryWindow of [historyWindow, downloadsWindow, pwdWindow, settingsWindow]) {
        if (secondaryWindow && !secondaryWindow.isDestroyed()) {
            secondaryWindow.webContents.send('language-changed', currentLanguage);
        }
    }
    if (historyWindow && !historyWindow.isDestroyed()) historyWindow.setTitle(tr("history.title"));
    if (downloadsWindow && !downloadsWindow.isDestroyed()) downloadsWindow.setTitle(tr("downloads.title").replace(/^📥\s*/, ""));
    if (pwdWindow && !pwdWindow.isDestroyed()) pwdWindow.setTitle(tr("passwords.title").replace(/^🔑\s*/, ""));
    if (settingsWindow && !settingsWindow.isDestroyed()) settingsWindow.setTitle(tr("app.settings.title"));
    
    return currentLanguage;
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

function getClosePreferencesPath() {
    return path.join(appDataPath, 'close-preferences.json');
}

function getFloatingNavigationPreferencesPath() {
    return path.join(appDataPath, 'floating-navigation.json');
}

function getBookmarksVisibilityPath() {
    return path.join(appDataPath, 'bookmarks-visibility.json');
}

// ====== VERSION CORRIGÉE SANS CONFLIT D'INITIALISATION ======

// 1. Déclarez la variable avec une valeur par défaut standard
let isBookmarksBarVisible = true;

// 2. Laissez la fonction s'exécuter de façon autonome sans auto-affectation circulaire
function loadBookmarksVisibilityPreference() {
    try {
        const preference = JSON.parse(fs.readFileSync(getBookmarksVisibilityPath(), "utf-8"));
        isBookmarksBarVisible = typeof preference.favoritesVisible === "boolean"
            ? preference.favoritesVisible
            : true;
    } catch (error) {
        isBookmarksBarVisible = true;
        if (error.code !== "ENOENT") {
            console.error("Impossible de lire la préférence d’affichage des favoris :", error);
        }
        saveBookmarksVisibilityPreference();
    }
    return isBookmarksBarVisible;
}

function saveBookmarksVisibilityPreference() {
    try {
        fs.mkdirSync(appDataPath, { recursive: true });
        fs.writeFileSync(getBookmarksVisibilityPath(), JSON.stringify({
            favoritesVisible: isBookmarksBarVisible
        }, null, 2), "utf-8");
    } catch (error) {
        console.error("Impossible d’enregistrer la préférence d’affichage des favoris :", error);
    }
}
const FLOATING_NAVIGATION_DEFAULTS = Object.freeze({ width: 340, height: 48 });
const FLOATING_NAVIGATION_OPACITY_DEFAULTS = Object.freeze({ light: 0.86, dark: 0.82 });
let floatingNavigationGloballyEnabled = true;
let floatingNavigationOpacity = null;

function normalizeFloatingNavigationOpacity(value) {
    return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : null;
}

function getDefaultFloatingNavigationOpacity() {
    return isDarkModeForced
        ? FLOATING_NAVIGATION_OPACITY_DEFAULTS.dark
        : FLOATING_NAVIGATION_OPACITY_DEFAULTS.light;
}

function getFloatingNavigationOpacity() {
    return floatingNavigationOpacity ?? getDefaultFloatingNavigationOpacity();
}

function normalizeFloatingNavigationSize(width, height) {
    return {
        width: Number.isFinite(width) ? Math.round(Math.min(1000, Math.max(220, width))) : FLOATING_NAVIGATION_DEFAULTS.width,
        height: Number.isFinite(height) ? Math.round(Math.min(320, Math.max(44, height))) : FLOATING_NAVIGATION_DEFAULTS.height
    };
}

function loadFloatingNavigationPreference() {
    try {
        const preference = JSON.parse(fs.readFileSync(getFloatingNavigationPreferencesPath(), "utf-8"));
        floatingNavigationGloballyEnabled = typeof preference.enabled === "boolean" ? preference.enabled : true;
        floatingNavigationOpacity = normalizeFloatingNavigationOpacity(
            preference.floatingToolbarOpacity ?? preference.opacity
        );
    } catch (error) {
        floatingNavigationGloballyEnabled = true;
        floatingNavigationOpacity = null;
        if (error.code !== "ENOENT") console.error("Impossible de lire la préférence de navigation flottante :", error);
    }
    return floatingNavigationGloballyEnabled;
}

function saveFloatingNavigationPreference() {
    try {
        fs.mkdirSync(appDataPath, { recursive: true });
        fs.writeFileSync(getFloatingNavigationPreferencesPath(), JSON.stringify({
            enabled: floatingNavigationGloballyEnabled,
            floatingToolbarOpacity: floatingNavigationOpacity
        }, null, 2), "utf-8");
    } catch (error) {
        console.error("Impossible d’enregistrer la préférence de navigation flottante :", error);
    }
}

function setFloatingNavigationGloballyEnabled(enabled) {
    floatingNavigationGloballyEnabled = enabled === true;
    saveFloatingNavigationPreference();
    collectPanelNodes(rootNode).forEach((panel) => {
        if (panel.view?.webContents && !panel.view.webContents.isDestroyed()) {
            panel.view.webContents.send("floating-navigation-global-changed", floatingNavigationGloballyEnabled);
        }
    });
    return floatingNavigationGloballyEnabled;
}

function setFloatingNavigationOpacity(value) {
    floatingNavigationOpacity = normalizeFloatingNavigationOpacity(value);
    saveFloatingNavigationPreference();
    collectPanelNodes(rootNode).forEach((panel) => {
        if (panel.view?.webContents && !panel.view.webContents.isDestroyed()) {
            panel.view.webContents.send("floating-navigation-opacity-changed", floatingNavigationOpacity);
        }
    });
    return getFloatingNavigationOpacity();
}

let saveLayoutOnExit = true;
let sessionLayoutBaseline = null;
let sessionLayoutBaselineCaptured = false;
let isQuitConfirmationOpen = false;

function loadClosePreferences() {
    try {
        const settings = JSON.parse(fs.readFileSync(getClosePreferencesPath(), "utf-8"));
        saveLayoutOnExit = typeof settings.saveLayoutOnExit === "boolean" ? settings.saveLayoutOnExit : true;
    } catch (error) {
        saveLayoutOnExit = true;
        if (error.code !== "ENOENT") {
            console.error("Impossible de lire les préférences de fermeture :", error);
        }
    }
}

function saveClosePreferences() {
    try {
        fs.mkdirSync(appDataPath, { recursive: true });
        fs.writeFileSync(getClosePreferencesPath(), JSON.stringify({ saveLayoutOnExit }, null, 2), "utf-8");
    } catch (error) {
        console.error("Impossible d’enregistrer les préférences de fermeture :", error);
    }
}

function captureSessionLayoutBaseline() {
    try {
        sessionLayoutBaseline = fs.existsSync(getSessionLayoutPath())
            ? fs.readFileSync(getSessionLayoutPath(), "utf-8")
            : null;
        sessionLayoutBaselineCaptured = true;
    } catch (error) {
        sessionLayoutBaseline = null;
        sessionLayoutBaselineCaptured = false;
        console.error("Impossible de mémoriser la disposition précédente :", error);
    }
}

function restoreSessionLayoutBaseline() {
    if (!sessionLayoutBaselineCaptured) return;
    try {
        if (sessionLayoutBaseline === null) {
            fs.rmSync(getSessionLayoutPath(), { force: true });
        } else {
            fs.writeFileSync(getSessionLayoutPath(), sessionLayoutBaseline, "utf-8");
        }
    } catch (error) {
        console.error("Impossible de restaurer la disposition précédente :", error);
    }
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

let currentOllamaRequest = null; // Stocke la requête HTTP Ollama en cours

// ==========================================
// ✨ PLACEZ LES DEUX LIGNES ICI TOUT EN HAUT
// ==========================================

  const panelIdleTimers = new Map();
const AUTO_SLEEP_DELAY_OPTIONS = [5, 10, 15, 30, 45, 60, 120, 0];
let autoSleepDelayMinutes = 15;

//let autoSleepEnabled = true;
  let autoSleepEnabled = false;

function loadAutoSleepPreference() {
    try {
        const settings = JSON.parse(fs.readFileSync(getAutoSleepPath(), "utf-8"));
        // Remplacez le fallback ": true" par ": false"
        autoSleepEnabled = typeof settings.enabled === "boolean" ? settings.enabled : false;
        autoSleepDelayMinutes = AUTO_SLEEP_DELAY_OPTIONS.includes(settings.delayMinutes)
            ? settings.delayMinutes
            : 15;
    } catch (error) {
        autoSleepEnabled = false; // <-- Changez true par false ici
        autoSleepDelayMinutes = 15;
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
        fs.writeFileSync(getAutoSleepPath(), JSON.stringify({
            enabled: autoSleepEnabled,
            delayMinutes: autoSleepDelayMinutes
        }, null, 2), "utf-8");
    } catch (error) {
        console.error("Impossible d’enregistrer la préférence de veille automatique :", error);
    }
}

// En haut de main.js avec vos autres variables globales (ex: sous let handleViews = {})
let activeDownloads = {}; 

// Stocke l'ID du panneau actuellement zoomé/maximisé au premier plan (null si aucun)
let maximizedPanelId = null; 

// Hauteur compacte réservée à la barre supérieure et à la zone URL.

// ====== CALCUL DYNAMIQUE DE LA HAUTEUR INITIALE ======
const TOOLBAR_ROW_HEIGHT = 38;
const URL_BAR_HEIGHT = isBookmarksBarVisible ? 30 : 0; // Vaut 0 si masqué
let TOOLBAR_HEIGHT = TOOLBAR_ROW_HEIGHT + URL_BAR_HEIGHT;



const TOOLBAR_MIN_HEIGHT = TOOLBAR_HEIGHT;
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

//let isAiSidebarVisible = true; // Par défaut, le volet est ouvert
  let isAiSidebarVisible = false; // Par défaut, le volet est désormais fermé
  let isAiSidebarWide = false;
  let lastAiSidebarWidth = 300;


async function ensureOllamaInstalled() {

    if (getOllamaExePath()) {
        return true;
    }

    const result = await dialog.showMessageBox({
        type: "question",
        title: tr("dialog.installAi.title"),
        message: tr("dialog.installAi.message"),
        buttons: [
            tr("dialog.install"),
            tr("dialog.later")
        ],
        defaultId: 0,
        cancelId: 1
    });

    if (result.response === 0) {

        shell.openExternal(
            "https://ollama.com/download"
        );
    }

    return false;
}

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
        isAiSidebarVisible = typeof preference.visible === "boolean" ? preference.visible : false; // <-- Changez true par false ici
    } catch (error) {
        isAiSidebarVisible = false; // <-- Changez true par false ici pour le premier lancement
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
    const nextVisibility = visible === true;
    const visibilityChanged = isAiSidebarVisible !== nextVisibility;
    isAiSidebarVisible = nextVisibility;
    saveAiSidebarPreference();

    if (visibilityChanged) {
        forceRebuildSplitters = true;
        resizeViews();
    }

    if (win && !win.isDestroyed()) {
        // Envoie la notification d'état ET de géométrie pour ouvrir/fermer le volet CSS
        win.webContents.send("ai-sidebar-visibility-changed", isAiSidebarVisible);
        win.webContents.send("ai-sidebar-geometry-update", { topPosition: TOOLBAR_HEIGHT });
    }
    return isAiSidebarVisible;
}
function openSettingsWindow() {

    if (!win || win.isDestroyed()) return;

    if (settingsWindow && !settingsWindow.isDestroyed()) {
        settingsWindow.show();

        if (win && !win.isDestroyed()) {
            win.webContents.send("settings-window-state", true);
        }

        settingsWindow.focus();
        return;
    }

    settingsWindow = new BrowserWindow({
        width: 460,
        height: 560,
        minWidth: 380,
        minHeight: 520,
        title: tr("app.settings.title"),
        parent: win,
        modal: true,
        show: false,
        resizable: false,
        autoHideMenuBar: true,
        backgroundColor: isDarkModeForced ? "#252526" : "#f9fafb",
        webPreferences: {
            preload: path.join(__dirname, "preload-settings.js"),
            sandbox: true,
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    settingsWindow.setMenu(null);
    settingsWindow.loadFile(path.join(__dirname, "settings.html"));

    settingsWindow.once("ready-to-show", () => {
        if (settingsWindow && !settingsWindow.isDestroyed()) {
            settingsWindow.show();
            settingsWindow.focus();

            if (win && !win.isDestroyed()) {
                win.webContents.send("settings-window-state", true);
            }
        }
    });

    settingsWindow.on("closed", () => {
        settingsWindow = null;

        if (win && !win.isDestroyed()) {
            win.webContents.send("settings-window-state", false);
        }
    });
}

let pwdWindow = null;
let settingsWindow = null;
let splitMenuWindow = null;
let splitMenuTargetPanelId = null;
const findInPageRequests = new Map();

// Écouteur pour ouvrir automatiquement le volet IA depuis la page welcome
ipcMain.on("request-open-ai-sidebar", (event) => {
    // Appelle votre fonction existante pour afficher le volet d'IA
    setAiSidebarVisible(true);
    console.log("[IA Locale] Volet ouvert automatiquement suite à un clic sur welcome.html");
});












ipcMain.on("open-settings-window", () => {
    openSettingsWindow();
});












ipcMain.on("check-settings-window-opened", (event) => {
    const isOpened =
        settingsWindow !== null &&
        !settingsWindow.isDestroyed();

    event.sender.send(
        "settings-window-state",
        isOpened
    );
});

ipcMain.on("close-settings-window", (event) => {
    if (settingsWindow && !settingsWindow.isDestroyed() && event.sender === settingsWindow.webContents) {
        settingsWindow.close();
    }
});

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

function afficherMenuContextuelPanneau(webContents, x, y, contextParams = {}) {
    const panel = findPanelByWebContents(webContents);
    const panelId = panel ? panel.id : activePanel;
    if (!panelId) return;

    const targetPanel = findPanelNode(rootNode, panelId);
    const isPrivate = targetPanel ? targetPanel.isPrivate : false;
    const hasClickedLink = typeof contextParams.linkURL === "string" && contextParams.linkURL.trim().length > 0;
    const clickedLinkUrl = hasClickedLink
        ? resolveContextLinkUrl(contextParams.linkURL, contextParams.pageURL || webContents.getURL())
        : "";
    let currentPageHost = "";
    try {
        const currentUrl = targetPanel?.view?.webContents?.getURL() || "";
        currentPageHost = normalizeAdBlockHost(currentUrl);
    } catch {}
    const adBlockHost = hasClickedLink
        ? getContextLinkHost(clickedLinkUrl)
        : currentPageHost;
    const siteHasAdBlockException = adBlockHost && isAdBlockExceptionHost(adBlockHost);

    // NOUVEAU : Détecter si le mode zoom/maximisé est actif sur le navigateur
    const isZoomActive = maximizedPanelId !== null;

    const linkMenuItems = clickedLinkUrl ? [{
        label: tr("context.openLinkIn"),
        submenu: [
            {
                label: tr("context.openLinkCurrentTile"),
                click: () => openContextLinkInPanel(panelId, clickedLinkUrl)
            },
            { type: "separator" },
            {
                label: tr("context.openLinkSplitRight"),
                enabled: !isZoomActive,
                click: () => ipcMain.emit("split-panel", null, panelId, "vertical", false, null, clickedLinkUrl)
            },
            {
                label: tr("context.openLinkSplitBottom"),
                enabled: !isZoomActive,
                click: () => ipcMain.emit("split-panel", null, panelId, "horizontal", false, null, clickedLinkUrl)
            },
            { type: "separator" },
            {
                label: tr("context.openLinkNewWindow"),
                click: () => openContextLinkInNewWindow(clickedLinkUrl, panelId)
            }
        ]
    }, { type: "separator" }] : [];

    const menuTemplate = [
        ...linkMenuItems,
        {
            label: tr("context.edit"),
            enabled: false
        },
        { role: "cut", label: `   ✂️ ${tr("context.cut")}` },
        { role: "copy", label: `   📋 ${tr("context.copy")}` },
        { role: "paste", label: `   📌 ${tr("context.paste")}` },
        { role: "delete", label: `   🗑️ ${tr("context.delete")}` },
        { type: "separator" },
        { role: "selectAll", label: `   ${tr("context.selectAll")}` },
        ...(adBlockHost ? [
            { type: "separator" },
            {
                label: `   🛡️ ${tr(siteHasAdBlockException ? "context.reenableBlocker" : "context.disableBlocker", { host: adBlockHost })}`,
                click: async () => {
                    await toggleAdBlockException(adBlockHost);
                    const panelToReload = findPanelNode(rootNode, panelId);
                    if (currentPageHost === adBlockHost && panelToReload?.view && !panelToReload.view.webContents.isDestroyed()) {
                        panelToReload.view.webContents.reload();
                    }
                }
            }
        ] : []),





        { type: "separator" },

        {
            label: `   ${tr("context.splitVertical")}`,
            enabled: !isZoomActive, // Grisé si zoom actif
            click: () => ipcMain.emit('split-panel', null, panelId, 'vertical', false)
        },
        {
            label: `   ${tr("context.splitHorizontal")}`,
            enabled: !isZoomActive, // Grisé si zoom actif
            click: () => ipcMain.emit('split-panel', null, panelId, 'horizontal', false)
        },





        {
            label: `   ${tr(isPrivate ? "context.publicTile" : "context.privateSplit")}`,
            enabled: !isZoomActive,
            click: () => ipcMain.emit('split-panel', null, panelId, 'vertical', !isPrivate)
        },
        {
            label: `   ${tr("context.containers")}`,
            enabled: !isZoomActive && !isPrivate,
            submenu: Object.entries(TILE_CONTAINERS).map(([id, container]) => ({
                label: tr(`container.${id === "perso" ? "personal" : id === "travail" ? "work" : id === "compte2" ? "account2" : "account3"}`),
                click: () => ipcMain.emit('split-panel', null, panelId, 'vertical', false, id)
            }))
        },
        
        // === AJOUT : DUPLICATION DE TUILE À LA VOLÉE ===
        {
            label: `   ${tr("context.duplicate")}`,
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

        {
            label: tr("context.floatingNavigation"),
            enabled: false
        },
        {
            label: tr("context.floatingNavigation.show"),
            type: "checkbox",
            checked: targetPanel?.floatingNavigationVisible !== false,
            enabled: floatingNavigationGloballyEnabled,
            click: () => {
                const currentPanel = findPanelNode(rootNode, panelId);
                if (!currentPanel || !floatingNavigationGloballyEnabled) return;
                currentPanel.floatingNavigationVisible = !currentPanel.floatingNavigationVisible;
                if (currentPanel.view?.webContents && !currentPanel.view.webContents.isDestroyed()) {
                    currentPanel.view.webContents.send("floating-navigation-visibility-changed", currentPanel.floatingNavigationVisible);
                }
                scheduleSessionLayoutSave();
            }
        },
        ...(!floatingNavigationGloballyEnabled ? [{
            label: tr("context.floatingNavigation.disabledGlobally"),
            enabled: false
        }] : []),

        { type: "separator" },

        // =========================================================================
        // ✨ VERSION CORRIGÉE : ÉVITE LE CRASH IPC EN MODIFIANT DIRECTEMENT L'ÉTAT
        // =========================================================================
        {
            label: `   ${tr(autoSleepEnabled ? "menu.sleepOn" : "menu.sleepOff")}`,
            type: "checkbox",
            checked: autoSleepEnabled,
            click: () => {
                setAutoSleepEnabled(!autoSleepEnabled);
                console.log(`[Auto-Sleep Menu] Mode changé : ${autoSleepEnabled ? "ACTIVÉ" : "DÉSACTIVÉ"}`);
                if (win && !win.isDestroyed()) {
                    win.webContents.send('autosleep-state-changed', autoSleepEnabled, autoSleepDelayMinutes);
                }
            }
        },

        { type: "separator" },


        {
            label: `   ${tr("main.menuMosaicEqual")}`,
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
            label: tr("context.ai"),
            enabled: false
        },

        {
            label: `   ${tr("context.summarize")}`,
            click: async () => {

                if (!(await ensureOllamaInstalled())) {
                    return;
                }

                if (win && !win.isDestroyed()) {
                    if (!isAiSidebarVisible) {
                        setAiSidebarVisible(true);
                    }

                    win.webContents.send(
                        "trigger-ai-action",
                        { action: "resume" }
                    );
                }
            }
        },

        {
            label: `   ${tr("context.keywords")}`,
            click: () => {
                if (win && !win.isDestroyed()) {
                    if (!isAiSidebarVisible) setAiSidebarVisible(true);
                    win.webContents.send("trigger-ai-action", { action: "keywords" });
                }
            }
        },


        { type: "separator" },
        {
            label: tr("context.panel"),
            enabled: false
        },




        {
            label: maximizedPanelId === panelId ? `   ${tr("panel.restoreMosaic")}` : `    ${tr("panel.maximize")}`,
            click: () => {
                maximizedPanelId = maximizedPanelId === panelId ? null : panelId;
                forceRebuildSplitters = true;
                resizeViews();
                win.webContents.send("zoom-changed", maximizedPanelId);
                updatePanelHandles();
            }
        },

        {
            label: `   ${tr("context.reader")}`,
            type: "checkbox",
            checked: targetPanel?.readerModeActive === true,
            click: async () => {
                const status = await toggleReaderModeForPanel(panelId);

                // Mise à jour immédiate de l'état du panneau
                if (targetPanel && (status === "opened" || status === "closed")) {
                    targetPanel.readerModeActive = (status === "opened");
                }

                if (win && !win.isDestroyed()) {
                    win.webContents.send("reader-mode-result", { panelId, status });
                }
            }
        },


        {
            label: `   ${tr("context.print")}`,
            click: () => ipcMain.emit('print-panel', null, panelId)
        },

        { type: "separator" },

        {
            label: `   ${tr("context.close")}`,
            click: () => ipcMain.emit('close-panel', null, panelId)
        }
    ];

    const contextMenu = Menu.buildFromTemplate(translateMenuTemplate(menuTemplate));
    contextMenu.popup({ window: win, x, y });
}


async function isModelInstalled(modelName) {

    return new Promise((resolve) => {

        const http = getNodeModule("http");

        const req = http.get(
            "http://127.0.0.1:11434/api/tags",
            (res) => {

                let body = "";

                res.on("data", chunk => {
                    body += chunk;
                });

                res.on("end", () => {

                    try {

                        const result = JSON.parse(body);

                        const found =
                            result.models?.some(
                                m => m.name === modelName
                            );

                        resolve(Boolean(found));

                    } catch (e) {

                        console.error(
                            "[OLLAMA] Erreur lecture modèles :",
                            e
                        );

                        resolve(false);
                    }
                });
            }
        );

        req.on("error", () => {
            resolve(false);
        });

    });
}

async function pullOllamaModel(modelName) {

    return new Promise((resolve, reject) => {

        const ollamaPath = getOllamaExePath();

        if (!ollamaPath) {
            reject(
                new Error("Ollama non installé")
            );
            return;
        }

/*        
        console.log(
            `[OLLAMA] Téléchargement du modèle ${modelName}`
        );
*/

        const pullProcess = spawn(
            ollamaPath,
            ["pull", modelName]
        );

        pullProcess.stdout.on("data", data => {

            console.log(
                "[OLLAMA PULL]",
                data.toString()
            );

        });

        pullProcess.stderr.on("data", data => {

            console.log(
                "[OLLAMA PULL]",
                data.toString()
            );

        });

        pullProcess.on("close", code => {

            if (code === 0) {

/*                
                console.log(
                    `[OLLAMA] Modèle ${modelName} installé`
                );
*/

                resolve();

            } else {

                reject(
                    new Error(
                        `Échec téléchargement (${code})`
                    )
                );
            }
        });

    });
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


ipcMain.handle("open-tutorial-video", async (event, videoFile) => {
    console.info("[Tutoriel] IPC open-tutorial-video reçu :", videoFile);

    const internalPageActions = Object.freeze({
        ACTION_HELP_PRODUCTIVITY: {
            url: `${getPathToFileURL(path.join(__dirname, "help.html")).href}#gestion-panneaux`,
            adjacent: true
        },

        ACTION_OPEN_SEARCH_HOME: {
//          url: getHomePageUrl(),
            url: `${getPathToFileURL(path.join(__dirname, "home.html")).href}`,
            adjacent: true
        },
        ACTION_OPEN_PRIVATE_PANEL: {
            adjacent: true,
            createPrivatePanel: true
        }

    });
    const internalAction = typeof videoFile === "string" &&
        Object.prototype.hasOwnProperty.call(internalPageActions, videoFile)
        ? internalPageActions[videoFile]
        : null;

    if (internalAction) {
        if (!win || win.isDestroyed()) return { ok: false };

        const sourcePanel = findPanelByWebContents(event.sender);
        try {
            if (event.senderFrame && event.senderFrame !== event.sender.mainFrame) {
                return { ok: false };
            }
            const senderUrl = event.senderFrame?.url || event.sender.getURL();
            const parsedSenderUrl = new URL(senderUrl);
            const senderPath = parsedSenderUrl.protocol === "file:"
                ? path.resolve(getNodeModule("url").fileURLToPath(parsedSenderUrl))
                : "";
            const welcomePath = path.resolve(__dirname, "welcome.html");
            if (!sourcePanel || senderPath.toLowerCase() !== welcomePath.toLowerCase()) {
                return { ok: false };
            }
        } catch {
            return { ok: false };
        }

        let targetPanel = sourcePanel;
        if (internalAction.createPrivatePanel) {
            if (maximizedPanelId !== null) return { ok: false };

            const previousPanelCount = collectPanelNodes(rootNode).length;
            ipcMain.emit("split-panel", event, sourcePanel.id, "vertical", true, null, null);

            const createdPrivatePanel = findPanelNode(rootNode, activePanel);
            if (collectPanelNodes(rootNode).length !== previousPanelCount + 1 ||
                !createdPrivatePanel?.isPrivate || createdPrivatePanel.id === sourcePanel.id) {
                return { ok: false };
            }

            win.focus();
            createdPrivatePanel.view?.webContents?.focus();
            return { ok: true };
        }

        if (internalAction.adjacent) {
            const panelsList = collectPanelNodes(rootNode);
            activePanel = sourcePanel.id;
            targetPanel = findNeighborPanel(sourcePanel.bounds, "Right", panelsList) ||
                findNeighborPanel(sourcePanel.bounds, "Left", panelsList) ||
                sourcePanel;
        }

        try {
            if (targetPanel.isSleeping) {
                win.focus();
                const awakenedView = wakePanel(targetPanel, internalAction.url);
                if (!awakenedView) return { ok: false };
            } else {
                const targetContents = targetPanel.view?.webContents;
                if (!targetContents || targetContents.isDestroyed()) {
                    return { ok: false };
                }

                await targetContents.loadURL(internalAction.url);
                activePanel = targetPanel.id;
                updateActiveBorder(targetPanel.bounds);
                win.focus();
                targetContents.focus();
                win.webContents.send("panels-updated", collectPanels(rootNode), maximizedPanelId);
                win.webContents.send("active-panel-changed", {
                    id: targetPanel.id,
                    bounds: targetPanel.bounds
                });
            }
            return { ok: true };
        } catch (error) {
            console.error("[Navigation interne] Échec du chargement :", error);
            return { ok: false };
        }
    }

    // --- Reste du code de sécurité d'origine pour les vidéos (.mp4) ---
    const panel = findPanelByWebContents(event.sender);
    const isMainRenderer = win && !win.isDestroyed() && event.sender === win.webContents;
    const isWelcomeTile = panel && (() => {
        try {
            const url = new URL(event.sender.getURL());
            return url.protocol === "file:" && decodeURIComponent(url.pathname).toLowerCase().endsWith("/welcome.html");
        } catch {
            return false;
        }
    })();

    if (!isMainRenderer && !isWelcomeTile) {
        console.warn("[Tutoriel] Requête refusée : l'émetteur n'est pas la page de bienvenue.");
        return { ok: false, error: "Cette page n'est pas autorisée à ouvrir le tutoriel." };
    }

    try {
        const result = await ouvrirVideoTutoriel(videoFile);
        console.info("[Tutoriel] Fenêtre vidéo créée et lecteur chargé.");
        return result;
    } catch (error) {
        console.error("[Tutoriel] Erreur pendant l'ouverture de la vidéo :", error);
        return { ok: false, error: error.message || "Erreur inconnue lors de l'ouverture du tutoriel." };
    }
});

// ====== CORRECTIF VALIDE : GESTIONNAIRES VISIBILITÉ DES FAVORIS (BOOKMARKS) ======

ipcMain.handle("get-bookmarks-visibility-preference", (event) => {
    // Vérifie si l'émetteur provient d'une de vos fenêtres UI autorisées
    const isAuthorizedSender = (settingsWindow && !settingsWindow.isDestroyed() && event.sender === settingsWindow.webContents) ||
        (win && !win.isDestroyed() && event.sender === win.webContents);
        
    return isAuthorizedSender ? isBookmarksBarVisible : true;
});

ipcMain.handle("set-bookmarks-visibility-preference", (event, visible) => {
    if (!settingsWindow || settingsWindow.isDestroyed() || event.sender !== settingsWindow.webContents || typeof visible !== "boolean") {
        return isBookmarksBarVisible;
    }
    // Appelle votre fonction globale existante qui modifie l'état et synchronise les fenêtres
    return setBookmarksBarVisible(visible);
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
    console.info("[PWD] Demande d’ouverture du gestionnaire de mots de passe reçue.");
    if (pwdWindow && !pwdWindow.isDestroyed()) {
        console.info("[PWD] Fenêtre existante remise au premier plan.");
        pwdWindow.focus();
        return;
    }

    // Crée la fenêtre avec les bordures standards de l'OS
    pwdWindow = new BrowserWindow({
        width: 350,
        height: 420,
        title: tr("passwords.title").replace(/^🔑\s*/, ""),
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

    pwdWindow.loadFile(path.join(__dirname, 'passwords.html')).catch((error) => {
        console.error("[PWD] Impossible de charger passwords.html :", error);
        if (pwdWindow && !pwdWindow.isDestroyed()) pwdWindow.close();
    });

    pwdWindow.webContents.on('did-finish-load', () => {
        console.info("[PWD] Interface du gestionnaire chargée.");
        updatePasswordWindowContent();
    });

    pwdWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
        console.error("[PWD] Échec de chargement de l’interface :", {
            errorCode,
            errorDescription,
            validatedURL
        });
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

function normalizeReaderPreferences(preferences = {}) {
    const fontSize = Number(preferences.fontSize);
    const scrollTop = Number(preferences.scrollTop);
    return {
        fontSize: Number.isFinite(fontSize) ? Math.max(13, Math.min(32, fontSize)) : 19,
        scrollTop: Number.isFinite(scrollTop) ? Math.max(0, scrollTop) : 0
    };
}

async function executeReaderScript(panel) {
    const contents = panel?.view?.webContents;
    if (!contents || contents.isDestroyed()) throw new Error('La vue du panneau n’est pas disponible.');

    const script = await fsPromises.readFile(path.join(__dirname, 'nanobrowser', 'reader.js'), 'utf8');
    const readerStrings = {
        title: tr("reader.title"),
        smaller: tr("reader.smaller"),
        larger: tr("reader.larger"),
        close: tr("reader.close")
    };
    const preferences = normalizeReaderPreferences(panel.readerModePreferences);
    return contents.executeJavaScript(
        `window.__hareReaderDark = ${isDarkModeForced};` +
        `window.__hareReaderStrings = ${JSON.stringify(readerStrings)};` +
        `window.__hareReaderPreferences = ${JSON.stringify(preferences)};\n${script}`
    );
}

function setReaderModeState(panel, active, options = {}) {
    if (!panel) return;
    panel.readerModeActive = active === true;
    if (panel.readerModeActive) {
        panel.readerModeUrl = options.url || panel.view?.webContents?.getURL() || panel.readerModeUrl || '';
        panel.readerModePreferences = normalizeReaderPreferences(
            options.preferences || panel.readerModePreferences
        );
    } else {
        panel.readerModeUrl = '';
        panel.readerModeRestorePending = false;
        panel.readerModePreferences = normalizeReaderPreferences();
    }

    if (win && !win.isDestroyed()) {
        win.webContents.send('reader-mode-state-changed', {
            panelId: panel.id,
            active: panel.readerModeActive
        });
        win.webContents.send('panels-updated', collectPanels(rootNode), maximizedPanelId);
    }
}

async function applyReaderModeToPanel(panel) {
    if (!panel?.readerModeActive || panel.isSleeping) return 'closed';
    if (panel.readerModeApplyPromise) return panel.readerModeApplyPromise;

    panel.readerModeApplyPromise = (async () => {
        const contents = panel.view?.webContents;
        if (!contents || contents.isDestroyed()) return 'unavailable';

        try {
            const protocol = new URL(contents.getURL()).protocol;
            if (protocol !== 'http:' && protocol !== 'https:' && protocol !== 'file:') return 'unavailable';

            // reader.js est un toggle; ne l’exécuter que si le calque n’existe pas déjà.
            const alreadyApplied = await contents.executeJavaScript(
                '!!document.getElementById("hare-reader-host")'
            );
            if (alreadyApplied) {
                panel.readerModeRestorePending = false;
                return 'opened';
            }

            const status = await executeReaderScript(panel);
            if (status === 'opened') {
                setReaderModeState(panel, true, { url: contents.getURL() });
                panel.readerModeRestorePending = false;
            } else if (status === 'empty' || status === 'unavailable') {
                setReaderModeState(panel, false);
            }
            return status;
        } catch (error) {
            console.warn('[LECTURE] Impossible de restaurer le mode lecture :', error.message);
            return 'error';
        }
    })();

    try {
        return await panel.readerModeApplyPromise;
    } finally {
        panel.readerModeApplyPromise = null;
    }
}

async function toggleReaderModeForPanel(panelId) {
    const panel = findPanelNode(rootNode, panelId);
    const contents = panel?.view?.webContents;
    if (!panel || panel.isSleeping || !contents || contents.isDestroyed()) return 'unavailable';

    try {
        const protocol = new URL(contents.getURL()).protocol;
        if (protocol !== 'http:' && protocol !== 'https:' && protocol !== 'file:') return 'unavailable';
        const status = await executeReaderScript(panel);
        if (status === 'opened') {
            setReaderModeState(panel, true, { url: contents.getURL() });
        } else if (status === 'closed') {
            setReaderModeState(panel, false);
        }
        return status;
    } catch (error) {
        console.warn('[LECTURE] Impossible de basculer le mode lecture :', error.message);
        return 'error';
    }
}

ipcMain.handle('toggle-reader-mode', async (event, panelId) => {
    if (!win || win.isDestroyed() || event.sender !== win.webContents) return 'error';
    return toggleReaderModeForPanel(panelId);
});

// =========================================================================
// ✨ VERSION CORRIGÉE : ENVOI DE L'ÉTAT DU BOUTON TÉLÉCHARGEMENTS À L'IHM
// =========================================================================
ipcMain.on('open-downloads-window', () => {
    if (downloadsWindow && !downloadsWindow.isDestroyed()) {
        downloadsWindow.focus();
        updateDownloadsWindowContent();
        return;
    }

    downloadsWindow = new BrowserWindow({
        width: 520,
        height: 560,
        title: tr('downloads.title').replace(/^📥\s*/, ''),
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
    
    // 📥 APPARITION : Informe l'IHM que la fenêtre est active pour enfoncer le bouton
    thisWindow.webContents.on('did-finish-load', () => {
        updateDownloadsWindowContent();
        if (win && !win.isDestroyed()) {
            win.webContents.send("downloads-window-state", true);
        }
    });
    
    // 📥 DISPARITION : Informe l'IHM qu'elle se ferme pour relâcher le bouton
    thisWindow.on('closed', () => {
        if (downloadsWindow === thisWindow) downloadsWindow = null;
        if (win && !win.isDestroyed()) {
            win.webContents.send("downloads-window-state", false);
        }
    });
});

// ✨ COUPLAGE SYNC : Répond à l'IHM pour synchroniser le bouton 📥 au lancement
ipcMain.on("check-downloads-window-opened", (event) => {
    const isOpened = downloadsWindow !== null && !downloadsWindow.isDestroyed();
    event.sender.send("downloads-window-state", isOpened);
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
                            buttons: [tr('dialog.runFile'), tr('dialog.cancel')],
                            defaultId: 1,
                            cancelId: 1,
                            title: tr('dialog.security'),
                            message: tr("dialog.downloadComplete", { filename }),
                            detail: currentLanguage === 'fr'
                                ? "Ce type de fichier peut contenir des virus. Voulez-vous l'exécuter ?"
                                : "This file type may contain viruses. Do you want to run it?"
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

    const borderThickness = 2;
    const borderInset = 1;
    const borderColor = "#3b82f6";
    const frameX = bounds.x + borderInset;
    const frameY = bounds.y + borderInset;
    const frameWidth = Math.max(0, bounds.width - borderInset * 2);
    const frameHeight = Math.max(0, bounds.height - borderInset * 2);
    const borderLayouts = [
        { x: frameX, y: frameY, width: frameWidth, height: borderThickness },
        { x: frameX, y: frameY + frameHeight - borderThickness, width: frameWidth, height: borderThickness },
        { x: frameX, y: frameY, width: borderThickness, height: frameHeight },
        { x: frameX + frameWidth - borderThickness, y: frameY, width: borderThickness, height: frameHeight }
    ];

    if (borderViews.length === 0) {
        for (let i = 0; i < borderLayouts.length; i++) {
            const borderView = createSandboxedBrowserView();
            win.addBrowserView(borderView);
            borderView.webContents.setIgnoreMenuShortcuts(true);
            borderView.webContents.userAgent = "InternalBorder";
            borderView.borderColor = borderColor;
            borderView.setBackgroundColor(borderColor);
            borderView.webContents.loadURL("data:text/html," + encodeURIComponent(
                `<html><body style="margin:0;padding:0;background:${borderColor};overflow:hidden"></body></html>`
            ));
            borderViews.push(borderView);
        }
    }

    borderLayouts.forEach((layout, index) => {
        const borderView = borderViews[index];
        if (!borderView || borderView.webContents.isDestroyed()) return;
        borderView.setBounds(layout);
        borderView.setBackgroundColor(borderColor);
        try { win.setTopBrowserView(borderView); } catch {}
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
        const handleWidth = Math.min(expectedWidth, Math.max(0, panel.bounds.width - 12));
        const handleHeight = Math.min(24, Math.max(0, panel.bounds.height - 12));

        if (handleWidth === 0 || handleHeight === 0) {
            if (handleViews[panel.id]) {
                try {
                    win.removeBrowserView(handleViews[panel.id]);
                    if (!handleViews[panel.id].webContents.isDestroyed()) {
                        handleViews[panel.id].webContents.destroy();
                    }
                } catch (e) {}
                delete handleViews[panel.id];
            }
            return;
        }

        const handleBounds = {
            x: panel.bounds.x + 6,
            y: panel.bounds.y + 6,
            width: handleWidth,
            height: handleHeight
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
                <div id="drag-btn" class="btn" title="${tr("panel.drag")}">&#9776;</div>
                <div id="zoom-btn" class="btn action" title="${tr(isMaximized ? "panel.restore" : "panel.enlarge")}">${isMaximized ? '&#128471;' : '&#128470;'}</div>
                <div id="fullscreen-btn" class="btn action" title="${tr("panel.detach")}">&#8599;</div>
                <div id="close-btn" class="btn action" title="${tr("panel.close")}">&#10006;</div>
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
            return new PanelNode(snapshotNode.id, restoredView, snapshotNode.realUrl || snapshotNode.url, snapshotNode.isPrivate === true, snapshotNode.containerId || null, snapshotNode);
        } else {
            // Sinon, on cherche le panneau déjà existant à l'écran pour récupérer sa vue actuelle
            const existingPanel = findPanelNode(rootNode, snapshotNode.id);
            return new PanelNode(snapshotNode.id, existingPanel ? existingPanel.view : null, snapshotNode.url, existingPanel?.isPrivate === true, existingPanel?.containerId || null, snapshotNode);
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
        return {
            type: "panel",
            id: node.id,
            url: node.url,
            realUrl,
            isPrivate: node.isPrivate,
            containerId: node.containerId || null,
            readerModeActive: node.readerModeActive === true,
            readerModeUrl: node.readerModeUrl || "",
            readerModePreferences: normalizeReaderPreferences(node.readerModePreferences),
            floatingNavigationVisible: node.floatingNavigationVisible,
            floatingNavigationWidth: node.floatingNavigationWidth,
            floatingNavigationHeight: node.floatingNavigationHeight,
            floatingNavigationX: node.floatingNavigationX,
            floatingNavigationY: node.floatingNavigationY
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
            containerId: node.containerId || null,
            readerModeActive: !node.isPrivate && node.readerModeActive === true,
            readerModePreferences: normalizeReaderPreferences(node.readerModePreferences),
            floatingNavigationVisible: node.floatingNavigationVisible,
            floatingNavigationWidth: node.floatingNavigationWidth,
            floatingNavigationHeight: node.floatingNavigationHeight,
            floatingNavigationX: node.floatingNavigationX,
            floatingNavigationY: node.floatingNavigationY
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
    if (!rootNode || !saveLayoutOnExit) return;
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
    if (!saveLayoutOnExit) return;
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
            const panel = new PanelNode(id, view, restoreUrl, false, containerId, savedNode);
            if (panel.readerModeActive) {
                panel.readerModeUrl = restoreUrl;
                panel.readerModeRestorePending = true;
            }
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
    constructor(id, view, url = "", isPrivate = false, containerId = null, readerState = {}) {
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
        this.readerModeActive = readerState.readerModeActive === true;
        this.readerModeUrl = typeof readerState.readerModeUrl === "string" ? readerState.readerModeUrl : "";
        this.readerModePreferences = normalizeReaderPreferences(readerState.readerModePreferences);
        this.readerModeRestorePending = this.readerModeActive;
        this.readerModeApplyPromise = null;
        this.isPreparingSleep = false;
        this.floatingNavigationVisible = readerState.floatingNavigationVisible !== false;
        const floatingSize = normalizeFloatingNavigationSize(
            readerState.floatingNavigationWidth,
            readerState.floatingNavigationHeight
        );
        this.floatingNavigationWidth = floatingSize.width;
        this.floatingNavigationHeight = floatingSize.height;
        this.floatingNavigationX = Number.isFinite(readerState.floatingNavigationX) ? Math.round(readerState.floatingNavigationX) : null;
        this.floatingNavigationY = Number.isFinite(readerState.floatingNavigationY) ? Math.round(readerState.floatingNavigationY) : null;
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

    // 🛡️ CORRECTIF : Si l'entrée est complètement vide ou ne contient que des espaces
    if (!input) {
        return getHomePageUrl();
    }

    // 🕵️ Extraction de l'ancre (hash) si elle est présente (ex: #gestion-panneaux)
    let hash = "";
    const hashIndex = input.indexOf("#");
    if (hashIndex !== -1) {
        hash = input.substring(hashIndex); // Conserve le "#..."
        input = input.substring(0, hashIndex).trim(); // Isole l'adresse principale
    }

    // 🛡️ CORRECTIF SECONDAIRE : Si l'utilisateur a saisi uniquement un hash (ex: "#" ou "#top")
    if (!input) {
        return getHomePageUrl() + hash;
    }

    // Comparaison sur l'adresse principale nettoyée
    if (input.toLowerCase() === "hare://home") {
        return getHomePageUrl() + hash;
    }

    if (input.toLowerCase() === "hare://help") {
        return getPathToFileURL(path.join(__dirname, "help.html")).href + hash;
    }

    // Reconstitution de l'input d'origine avec son hash pour les autres vérifications
    const fullInput = input + hash;

    // 1. Si c'est une URL valide ou une page locale
    if (fullInput.includes("://") || fullInput.startsWith("data:") || fullInput.startsWith("about:")) {
        return fullInput;
    }

    // 2. Si ça ressemble à un domaine direct sans espace (ex: google.com, wikipedia.org)
    if (/^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+(:[0-9]+)?(\/.*)?$/.test(input) && !input.includes(" ")) {
        return "https://" + input + hash;
    }

    // 3. Sinon, c'est une recherche de mots-clés (on encode l'intégralité avec le hash inclus)
    return `http://129.151.254.175:8080/search?q=${encodeURIComponent(fullInput)}`;
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

async function navigatePanelToHome(panel) {
    if (!panel || !win || win.isDestroyed()) return false;
    const homeUrl = getHomePageUrl();

    try {
        if (panel.isSleeping) {
            win.focus();
            return !!wakePanel(panel, homeUrl);
        }

        const contents = panel.view?.webContents;
        if (!contents || contents.isDestroyed()) return false;

        await contents.loadURL(homeUrl);
        activePanel = panel.id;
        updateActiveBorder(panel.bounds);
        win.focus();
        contents.focus();
        win.webContents.send("panels-updated", collectPanels(rootNode), maximizedPanelId);
        win.webContents.send("active-panel-changed", {
            id: panel.id,
            bounds: panel.bounds
        });
        return true;
    } catch (error) {
        console.error("[Navigation] Impossible d’ouvrir la page d’accueil :", error);
        return false;
    }
}

function getLeftmostPanel() {
    const panels = collectPanelNodes(rootNode).filter(Boolean);
    return panels.filter((panel) => panel.bounds)
        .sort((a, b) => a.bounds.x - b.bounds.x || a.bounds.y - b.bounds.y)[0] || panels[0] || null;
}

ipcMain.handle("open-home-page", async (event, requestedPanelId) => {
    if (!win || win.isDestroyed()) return false;

    let targetPanel = findPanelByWebContents(event.sender);
    if (!targetPanel && event.sender === win.webContents) {
        targetPanel = findPanelNode(rootNode, requestedPanelId) ||
            findPanelNode(rootNode, activePanel) ||
            getLeftmostPanel();
    }
    if (!targetPanel) return false;
    return navigatePanelToHome(targetPanel);
});

function clearPanelIdleTimer(panelId) {
    const timer = panelIdleTimers.get(panelId);
    if (timer) clearTimeout(timer);
    panelIdleTimers.delete(panelId);
}

function schedulePanelIdleTimer(panel) {
    clearPanelIdleTimer(panel.id);
    if (!autoSleepEnabled || autoSleepDelayMinutes === 0 || panel.isSleeping) return;

    const timeoutMs = autoSleepDelayMinutes * 60 * 1000;
    const lastActivityAt = Number.isFinite(panel.lastActivityAt) ? panel.lastActivityAt : Date.now();
    const remainingMs = Math.max(0, timeoutMs - (Date.now() - lastActivityAt));
    panelIdleTimers.set(panel.id, setTimeout(() => {
        panelIdleTimers.delete(panel.id);
        if (autoSleepEnabled && autoSleepDelayMinutes > 0 && findPanelNode(rootNode, panel.id) === panel) {
            sleepPanel(panel);
        }
    }, remainingMs));
}

function markPanelActivity(panelOrId) {
    const panel = typeof panelOrId === 'string'
        ? findPanelNode(rootNode, panelOrId)
        : panelOrId;
    if (!panel || panel.isSleeping) return;

    panel.lastActivityAt = Date.now();
    schedulePanelIdleTimer(panel);
}

function setAutoSleepDelay(minutes) {
    if (!AUTO_SLEEP_DELAY_OPTIONS.includes(minutes)) return autoSleepDelayMinutes;
    autoSleepDelayMinutes = minutes;

    panelIdleTimers.forEach((timer) => clearTimeout(timer));
    panelIdleTimers.clear();
    if (autoSleepEnabled && autoSleepDelayMinutes > 0) {
        collectPanelNodes(rootNode).forEach((panel) => {
            if (!panel.isSleeping) schedulePanelIdleTimer(panel);
        });
    }

    saveAutoSleepPreference();
    if (win && !win.isDestroyed()) {
        win.webContents.send("autosleep-state-changed", autoSleepEnabled, autoSleepDelayMinutes);
    }
    return autoSleepDelayMinutes;
}


function setAutoSleepEnabled(enabled) {
    autoSleepEnabled = enabled === true;
    panelIdleTimers.forEach((timer) => clearTimeout(timer));
    panelIdleTimers.clear();

    if (autoSleepEnabled) {
        collectPanelNodes(rootNode).forEach((panel) => {
            if (!panel.isSleeping) {
                if (!Number.isFinite(panel.lastActivityAt)) panel.lastActivityAt = Date.now();
                schedulePanelIdleTimer(panel);
            }
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

function readerUrlsMatch(leftUrl, rightUrl) {
    try {
        const left = new URL(leftUrl);
        const right = new URL(rightUrl);
        left.hash = "";
        right.hash = "";
        return left.href === right.href;
    } catch {
        return leftUrl === rightUrl;
    }
}

async function sleepPanel(panel) {
    if (!panel || panel.isSleeping || panel.isPreparingSleep || !panel.view || !win || win.isDestroyed()) return;
    if (activeDownloads[panel.id]) {
        markPanelActivity(panel);
        return;
    }

    const originalView = panel.view;
    const contents = originalView.webContents;
    if (!contents || contents.isDestroyed()) return;

    panel.isPreparingSleep = true;
    const currentUrl = contents.getURL();
    const savedUrl = currentUrl && currentUrl !== 'about:blank'
        ? currentUrl
        : (panel.url || getHomePageUrl());

    // Le script Reader garde taille et défilement dans la page; les capturer avant
    // de détruire la BrowserView permet une reconstruction visuellement cohérente.
    if (panel.readerModeActive) {
        try {
            const preferences = await contents.executeJavaScript(`(() => {
                const saved = window.__hareReaderPreferences || {};
                const host = document.getElementById("hare-reader-host");
                const page = host?.shadowRoot?.querySelector(".page");
                const doc = host?.shadowRoot?.querySelector(".doc");
                return {
                    fontSize: Number.parseFloat(doc?.style.fontSize) || saved.fontSize || 19,
                    scrollTop: Number(page?.scrollTop) || saved.scrollTop || 0
                };
            })()`);
            panel.readerModePreferences = normalizeReaderPreferences(preferences);
        } catch (error) {
            console.debug(`[LECTURE] Préférences de la tuile ${panel.id} non capturées avant veille :`, error.message);
        }
    }

    // Vérifier que le panneau n’a pas été remplacé pendant la capture asynchrone.
    if (panel.view !== originalView || contents.isDestroyed()) {
        panel.isPreparingSleep = false;
        return;
    }

    panel.sleepingUrl = savedUrl;
    panel.session = contents.session;
    panel.isSleeping = true;
    panel.isPreparingSleep = false;
    panel.readerModeRestorePending = panel.readerModeActive;

    destroyPanelBrowserView(originalView);

    const placeholder = createSandboxedBrowserView({
        webPreferences: panel.session ? { session: panel.session } : {}
    });
    panel.view = placeholder;
    win.addBrowserView(placeholder);

    // 🌟 CORRECTIF THÈME : Déterminer dynamiquement la classe de thème active à injecter
    const currentThemeClass = isDarkModeForced ? "mw-theme-client-dark" : "mw-theme-client-light";

    const sleepingHtml = `<!doctype html><html lang="${currentLanguage}" class="${currentThemeClass}"><meta charset="utf-8"><title>${tr("sleep.title")}</title>
        <style>
        html,body{height:100%;margin:0}
        body{display:grid;place-items:center;background:#f3f4f6;color:#374151;font:15px 'Segoe UI',sans-serif}
        html.mw-theme-client-dark body{background:#1e1e1e;color:#cfcfcf}
        main{text-align:center;padding:24px}strong{display:block;margin-bottom:8px}small{color:#6b7280}
        </style>
        <body><main><strong>${tr("sleep.title")}</strong><small>${tr("sleep.body")}</small></main></body></html>`;
        
    placeholder.webContents.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(sleepingHtml));

    if (panel.bounds) placeholder.setBounds(panel.bounds);
    else placeholder.setBounds({ x: -2000, y: -2000, width: 0, height: 0 });
    resizeViews();
    if (handleViews[panel.id]) {
        try { win.setTopBrowserView(handleViews[panel.id]); } catch (error) {}
    }
    if (panel.id === activePanel && panel.bounds) updateActiveBorder(panel.bounds);
    console.log(`[Tab Sleeping] Tuile ${panel.id} mise en veille après ${autoSleepDelayMinutes} minute(s) d’inactivité.`);
}


function wakePanel(panel, targetUrl = null) {
    if (!panel || !panel.isSleeping || !win || win.isDestroyed()) return panel?.view || null;

    clearPanelIdleTimer(panel.id);
    const sleepingUrl = panel.sleepingUrl || panel.url || getHomePageUrl();
    const originalUrl = targetUrl || sleepingUrl;
    if (targetUrl && !readerUrlsMatch(targetUrl, sleepingUrl) && panel.readerModeActive) {
        // Une navigation explicitement demandée pendant la veille est une autre page;
        // ne pas appliquer à celle-ci le mode Lecture de l’ancienne URL.
        setReaderModeState(panel, false);
    }
    const placeholder = panel.view;
    panel.isSleeping = false;
    panel.sleepingUrl = null;
    panel.readerModeRestorePending = panel.readerModeActive;
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
            bounds: node.bounds ? { ...node.bounds } : null,
            containerLabel: node.containerId ? getContainerLabel(node.containerId) : "",
            containerColor: node.containerId ? TILE_CONTAINERS[node.containerId].color : "",
            searchQuery: node.searchQuery || "",
            readerModeActive: node.readerModeActive === true
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
    // 🌟 CORRECTIF SECURITÉ : Si la fenêtre principale est détruite (fermeture), on stoppe tout immédiatement.
    if (!win || win.isDestroyed() || !win.webContents || win.webContents.isDestroyed()) {
        return;
    }

    if (!activePanel) {
        win.webContents.send("navigation-state", {
            canGoBack: false,
            canGoForward: false,
            hasActivePanel: false
        });
        return;
    }

    const panel = findPanelNode(rootNode, activePanel);

    if (!panel || !panel.view || !panel.view.webContents || panel.view.webContents.isDestroyed()) {
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

function updateTileNavigationButtons(webContents) {
    if (!webContents || webContents.isDestroyed()) return;

    try {
        webContents.send("tile-navigation-state", {
            canGoBack: webContents.navigationHistory.canGoBack(),
            canGoForward: webContents.navigationHistory.canGoForward()
        });
    } catch (error) {
        console.debug("Impossible de synchroniser l’état de navigation de la mini-barre :", error);
    }
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

    // ====== VERSION CORRIGÉE ET SÉCURISÉE DE L'ÉCOUTEUR ======
    panel.view.webContents.on("will-navigate", (event, targetUrl) => {
        try {
            const target = new URL(targetUrl);

            // 🛡️ Sécurité : Bloquer les soumissions de recherches vides (espaces seuls) issues de home.html
            if (target.hostname === SEARCH_ENGINE_HOST && (target.pathname === "/search" || target.pathname.endsWith("/search"))) {
                const queryParam = target.searchParams.get("q");
                if (!queryParam || !queryParam.trim()) {
                    event.preventDefault(); // Annule la navigation Chromium instable
                    panel.view.webContents.loadURL(getHomePageUrl()).catch(() => {}); // Force le retour à l'accueil
                    console.info(`[SÉCURITÉ] Recherche SearXNG vide bloquée pour la tuile ${panel.id}`);
                    return;
                }
            }

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

    panel.view.webContents.on("did-navigate-in-page", (_event, url) => {
        updateTileNavigationButtons(panel.view.webContents);
        if (panel.readerModeActive && !panel.readerModeRestorePending &&
            url && !readerUrlsMatch(url, panel.readerModeUrl)) {
            setReaderModeState(panel, false);
        }
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
        afficherMenuContextuelPanneau(panel.view.webContents, menuX, menuY, params);
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
                                title: tr("dialog.account.title"),
                                message: tr("dialog.account.message", { hostname }),
                                detail: tr("dialog.account.detail"),
                                buttons: [...buttons.slice(0, -1), tr("dialog.cancel")],
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


    // ✨ INJECTION DE LA BARRE FLOUTANTE INDIVIDUELLE
    try {
        const scriptPath = path.join(__dirname, "tile-nav-bar.js");
        if (fs.existsSync(scriptPath)) {
            const navBarCode = fs.readFileSync(scriptPath, "utf8");
            await panel.view.webContents.executeJavaScript(navBarCode + "; void 0;");
        }
    } catch (err) {
        console.error("Erreur injection mini-barre de navigation :", err);
    }

        

        // Certains moteurs envoient le terme via POST : la requête n'est alors
        // pas dans l'URL et doit être lue dans le formulaire de la page.
        await syncSearchQueryFromPage();

        // Un rechargement conserve Reader si l’URL est identique; au réveil,
        // readerModeRestorePending autorise également les redirections canoniques.
        if (panel.readerModeActive) {
            const status = await applyReaderModeToPanel(panel);
            if (status === 'opened') {
                panel.readerModeRestorePending = false;
                panel.readerModeUrl = panel.view?.webContents?.getURL() || panel.readerModeUrl;
            }
        }
    });

    if (typeof panel.view.webContents.setForceDarkModeEnabled === 'function') {
        panel.view.webContents.setForceDarkModeEnabled(isDarkModeForced);
    }
    
    panel.view.webContents.on("did-navigate", (event, url, httpResponseCode, httpStatusText) => {
        if (panel.readerModeActive && !panel.readerModeRestorePending &&
            url && !readerUrlsMatch(url, panel.readerModeUrl)) {
            setReaderModeState(panel, false);
        }

        if (httpResponseCode >= 400) {
            // ... Votre logique de gestion des erreurs HTML ...
        } else {
            const title = panel.view.webContents.getTitle();

            updateNavigationButtons();
            updateTileNavigationButtons(panel.view.webContents);
            
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

        if (panel.readerModeActive && (panel.readerModeRestorePending ||
            (validatedURL && !readerUrlsMatch(validatedURL, panel.readerModeUrl)))) {
            setReaderModeState(panel, false);
        }

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
                    <h1>${tr("network.error.title")}</h1>
                    <p>${tr("network.error.description", { error: errorDescription })}</p>
                    <p>${tr("network.error.address")}<br><span class="url">${validatedURL}</span></p>
                    <button class="btn-retry" onclick="window.location.reload()">${tr("network.error.retry")}</button>
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
    // SI UN PANNEAU EST MAXIMISÉ : On libère la barre d'outils supérieure
    // =============================================================================
    if (maximizedPanelId) {
        if (node.type === "panel") {
            if (node.id === maximizedPanelId) {
                // Fix géométrie : préserve l'espace pour les boutons supérieurs (y = TOOLBAR_HEIGHT)
                node.bounds = { x, y, width, height };
                if (node.view && !node.view.webContents.isDestroyed()) {
                    node.view.setBounds({ x, y, width, height });
                    try {
                        node.view.webContents.setAudioMuted(false);
                    } catch (e) {}
                }
            } else {
                // Efface les tuiles masquées de l'écran
                node.bounds = null;
                if (node.view && !node.view.webContents.isDestroyed()) {
                    node.view.setBounds({ x: -2000, y: -2000, width: 0, height: 0 });
                    try {
                        node.view.webContents.setAudioMuted(true);
                        if (typeof node.view.webContents.setBackgroundThrottling === 'function') {
                            node.view.webContents.setBackgroundThrottling(true);
                        }
                    } catch (e) {}
                }
                if (handleViews[node.id]) {
                    try { win.removeBrowserView(handleViews[node.id]); } catch(e) {}
                    delete handleViews[node.id];
                }
            }
            return;
        }
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
            try {
                node.view.webContents.setAudioMuted(false);
                if (typeof node.view.webContents.setBackgroundThrottling === 'function') {
                    node.view.webContents.setBackgroundThrottling(false);
                }
            } catch (e) {}
        }
        return;
    }

    if (node.direction === "vertical") {
        const splitterWidth = Math.min(SPLITTER_SIZE, width);
        const availableWidth = width - splitterWidth;
        const firstWidth = Math.floor(availableWidth * node.ratio);
        const secondWidth = availableWidth - firstWidth;
        splitters.push({
            node, direction: "vertical",
            x: x + firstWidth, y,
            width: splitterWidth, height,
            parentX: x, parentWidth: width
        });
        layoutNode(node.first, x, y, firstWidth, height);
        layoutNode(node.second, x + firstWidth + splitterWidth, y, secondWidth, height);
    } else {
        const splitterHeight = Math.min(SPLITTER_SIZE, height);
        const availableHeight = height - splitterHeight;
        const firstHeight = Math.floor(availableHeight * node.ratio);
        const secondHeight = availableHeight - firstHeight;
        splitters.push({
            node, direction: "horizontal",
            x, y: y + firstHeight,
            width, height: splitterHeight,
            parentY: y, parentHeight: height
        });
        layoutNode(node.first, x, y, width, firstHeight);
        layoutNode(node.second, x, y + firstHeight + splitterHeight, width, secondHeight);
    }
}



// ✨ INTERRUPTEURS DE NAVIGATION DÉDIÉS AUX MINI-BARRES FLOUTANTES
ipcMain.handle('go-back-current', (event) => {
    if (event.sender.navigationHistory.canGoBack()) {
        event.sender.navigationHistory.goBack();
    }
});

ipcMain.handle('get-tile-navigation-state', (event) => {
    const webContents = event.sender;
    if (!webContents || webContents.isDestroyed()) {
        return { canGoBack: false, canGoForward: false };
    }
    return {
        canGoBack: webContents.navigationHistory.canGoBack(),
        canGoForward: webContents.navigationHistory.canGoForward()
    };
});

ipcMain.handle('go-forward-current', (event) => {
    if (event.sender.navigationHistory.canGoForward()) {
        event.sender.navigationHistory.goForward();
    }
});

ipcMain.handle('refresh-current', (event) => {
    event.sender.reload();
});

ipcMain.on('navigate-current', (event, inputUrl) => {
    // Réutilise votre fonction existante de traitement d'URL
    const targetUrl = buildNavigationTarget(inputUrl); 
    event.sender.loadURL(targetUrl);
});



// Écouteur pour intercepter le clic sur le bouton 📐 de l'IHM
ipcMain.on("equalize-mosaic-request", (event) => {
    if (!win || win.isDestroyed() || event.sender !== win.webContents) return;
    if (!rootNode) {
        console.warn("[Mosaïque] Égalisation ignorée : aucun arbre de panneaux actif.");
        return;
    }
    if (maximizedPanelId) {
        console.info("[Mosaïque] Égalisation ignorée pendant le mode panneau agrandi.");
        return;
    }
    if (collectPanelNodes(rootNode).length <= 1) {
        console.info("[Mosaïque] Égalisation ignorée : une seule tuile est visible.");
        return;
    }

    saveState();
    resetTreeRatiosEqual(rootNode);
    forceRebuildSplitters = true;
    resizeViews();
    console.info("[Mosaïque] Arbre de panneaux égalisé depuis la barre d’outils.");
});


ipcMain.on("reset-workspace", async () => {

    const result = await dialog.showMessageBox(win, {
        type: "warning",
        title: tr("dialog.resetWorkspace.title"),
        message: tr("dialog.resetWorkspace.message"),
        buttons: [tr("common.reset"), tr("common.cancel")],
        defaultId: 1,
        cancelId: 1
    });

    if (result.response !== 0) return;

    try {
        // ✨ PROTECTION : On ne nettoie les panneaux et les timers que si rootNode existe !
        if (rootNode) {
            const previousPanels = collectPanelNodes(rootNode);

            panelIdleTimers.forEach((timer) => clearTimeout(timer));
            panelIdleTimers.clear();
            previousPanels.forEach((panel) => {
                if (panel.isPrivate && panel.session) {
                    void purgePrivateSession(panel.session, panel.id);
                }
                destroyPanelBrowserView(panel.view);
            });
        }

        // Le reset ne doit pas laisser une ancienne disposition annulable.
        history = [];
        lastClosedPanel = null;
        maximizedPanelId = null;
        nextPanelNumber = 4;
        rootNode = null;
        activePanel = null;
        win.webContents.send("undo-available", false);

        await createDefaultLayout();
        forceRebuildSplitters = true;
        resizeViews();

        const panels = collectPanels(rootNode);
        win.webContents.send("panels-updated", panels, maximizedPanelId);
        const firstPanel = findPanelNode(rootNode, activePanel);
        if (firstPanel) {
            win.webContents.send("active-panel-changed", { id: firstPanel.id, bounds: firstPanel.bounds });
        }

        console.log("[Mosaïque] Espace de travail réinitialisé.");
    } catch (error) {
        console.error("Impossible de réinitialiser l'espace de travail :", error);
    }
});



ipcMain.on("show-url-context-menu", (event) => {
    const menu = Menu.buildFromTemplate(translateMenuTemplate([
//      { role: "undo", label: "Annuler" },
//      { role: "redo", label: "Rétablir" },
//      { type: "separator" },
        { role: "cut", label: "Couper" },
        { role: "copy", label: "Copier" },
        { role: "paste", label: "Coller" },
        { role: "delete", label: "Supprimer" },
        { type: "separator" },
        { role: "selectAll", label: "Tout sélectionner" }
    ]));

    menu.popup({
        window: BrowserWindow.fromWebContents(event.sender)
    });
});

// Recherchez cette ligne et remplacez son contenu :
// =========================================================================
// ✨ CORRECTIF AVANCÉ : BASCULE ULTRA-FIABLE (ENTRÉE DEPUIS LE CLIC DE L'ICÔNE)
// =========================================================================
ipcMain.on("toggle-ai-sidebar-request", (event, requestedVisibility) => {
    if (!win || win.isDestroyed() || event.sender !== win.webContents) return;

    // Sans valeur, le bouton principal demande une bascule; close/AI actions
    // transmettent une valeur explicite afin de rester idempotents.
    const nextState = typeof requestedVisibility === "boolean"
        ? requestedVisibility
        : !isAiSidebarVisible;
    setAiSidebarVisible(nextState);
    console.log(`[IA Locale] Bascule déclenchée par l'icône. Nouvel état : ${nextState ? "OUVERT" : "FERMÉ"}`);
});


ipcMain.handle("get-ai-sidebar-preference", (event) => {
    if (!win || win.isDestroyed() || event.sender !== win.webContents) return false;
    return isAiSidebarVisible;
});


// ✨ AJOUT : Écouteur pour intercepter la demande issue de la tuile welcome.html
// Intercepte la demande issue de la tuile sandboxée et déclenche l'inversion du thème
ipcMain.on("toggle-dark-mode-request-from-tile", (event) => {
    ipcMain.emit("toggle-dark-mode-request", null, !isDarkModeForced);
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

ipcMain.on('reader-mode-state-from-tile', (event, active) => {
    const panel = findPanelByWebContents(event.sender);
    if (!panel || typeof active !== 'boolean') return;
    setReaderModeState(panel, active);
});

ipcMain.on('reader-mode-preferences-from-tile', (event, preferences) => {
    const panel = findPanelByWebContents(event.sender);
    if (!panel || !panel.readerModeActive || !preferences || typeof preferences !== 'object') return;
    panel.readerModePreferences = normalizeReaderPreferences(preferences);
    scheduleSessionLayoutSave();
});

ipcMain.handle("get-floating-navigation-state", (event) => {
    const panel = findPanelByWebContents(event.sender);
    if (!panel) return null;
    return {
        visible: panel.floatingNavigationVisible,
        width: panel.floatingNavigationWidth,
        height: panel.floatingNavigationHeight,
        x: panel.floatingNavigationX,
        y: panel.floatingNavigationY,
        globallyEnabled: floatingNavigationGloballyEnabled,
        opacity: floatingNavigationOpacity
    };
});

ipcMain.handle("set-floating-navigation-visible", (event, visible) => {
    const panel = findPanelByWebContents(event.sender);
    if (!panel || typeof visible !== "boolean") return false;
    panel.floatingNavigationVisible = visible;
    if (panel.view?.webContents && !panel.view.webContents.isDestroyed()) {
        panel.view.webContents.send("floating-navigation-visibility-changed", visible);
    }
    scheduleSessionLayoutSave();
    return true;
});

ipcMain.handle("set-floating-navigation-size", (event, size = {}) => {
    const panel = findPanelByWebContents(event.sender);
    if (!panel || !size || typeof size !== "object") return null;
    const normalized = normalizeFloatingNavigationSize(Number(size.width), Number(size.height));
    panel.floatingNavigationWidth = normalized.width;
    panel.floatingNavigationHeight = normalized.height;
    scheduleSessionLayoutSave();
    return normalized;
});

ipcMain.handle("set-floating-navigation-position", (event, position = {}) => {
    const panel = findPanelByWebContents(event.sender);
    if (!panel || !position || typeof position !== "object") return false;
    panel.floatingNavigationX = Number.isFinite(position.x) ? Math.round(position.x) : null;
    panel.floatingNavigationY = Number.isFinite(position.y) ? Math.round(position.y) : null;
    scheduleSessionLayoutSave();
    return true;
});

ipcMain.handle("get-autosleep-preference", (event) => {
    if (!win || win.isDestroyed() || event.sender !== win.webContents) return true;
    return autoSleepEnabled;
});

ipcMain.handle("get-autosleep-delay-preference", (event) => {
    const isAuthorizedSender = (settingsWindow && !settingsWindow.isDestroyed() && event.sender === settingsWindow.webContents) ||
        (win && !win.isDestroyed() && event.sender === win.webContents);
    return isAuthorizedSender ? autoSleepDelayMinutes : 15;
});

ipcMain.handle("set-autosleep-delay-preference", (event, minutes) => {
    if (!settingsWindow || settingsWindow.isDestroyed() || event.sender !== settingsWindow.webContents) {
        return autoSleepDelayMinutes;
    }
    return setAutoSleepDelay(minutes);
});

ipcMain.handle("get-floating-navigation-preference", (event) => {
    const authorized = (settingsWindow && !settingsWindow.isDestroyed() && event.sender === settingsWindow.webContents) ||
        (win && !win.isDestroyed() && event.sender === win.webContents);
    return authorized ? floatingNavigationGloballyEnabled : true;
});

ipcMain.handle("set-floating-navigation-preference", (event, enabled) => {
    if (!settingsWindow || settingsWindow.isDestroyed() || event.sender !== settingsWindow.webContents || typeof enabled !== "boolean") {
        return floatingNavigationGloballyEnabled;
    }
    return setFloatingNavigationGloballyEnabled(enabled);
});

ipcMain.handle("get-floating-navigation-opacity", (event) => {
    const authorized = (settingsWindow && !settingsWindow.isDestroyed() && event.sender === settingsWindow.webContents) ||
        (win && !win.isDestroyed() && event.sender === win.webContents);
    return authorized ? getFloatingNavigationOpacity() : getDefaultFloatingNavigationOpacity();
});

ipcMain.handle("set-floating-navigation-opacity", (event, opacity) => {
    if (!settingsWindow || settingsWindow.isDestroyed() || event.sender !== settingsWindow.webContents) {
        return getFloatingNavigationOpacity();
    }
    if (opacity !== null && (typeof opacity !== "number" || !Number.isFinite(opacity))) {
        return getFloatingNavigationOpacity();
    }
    return setFloatingNavigationOpacity(opacity);
});

ipcMain.on("toggle-autosleep-request", (event, enabled) => {
    if (!win || win.isDestroyed() || event.sender !== win.webContents) return;
    const nextState = setAutoSleepEnabled(enabled);
    win.webContents.send("autosleep-state-changed", nextState, autoSleepDelayMinutes);
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

// Masquer uniquement la barre : la liste des favoris reste intacte en mémoire et sur disque.
ipcMain.on("toggle-bookmarks-bar-request", () => setBookmarksBarVisible(false));
ipcMain.on("set-bookmarks-bar-visible", (_event, visible) => setBookmarksBarVisible(visible));

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
//          console.log(`Fermeture d'une tuile privée : Nettoyage complet de la partition : ${targetSession.getStoragePath()}`);
            
            targetSession.clearStorageData({
                storages: ['cookies', 'localstorage', 'caches', 'indexeddb', 'websql', 'serviceworkers', 'cachestorage'],
                quotas: ['temporary', 'persistent', 'syncable']
            }).then(() => {
//              console.log(`[Partition ${panelId}] Stockages et Cookies détruits avec succès.`);
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
//                      console.log(`[RAM] Processus Chromium de la tuile ${panelId} libéré proprement.`);
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

    // 4. On reconstruit l'arbre complet à partir du snapshot sauvegardé
    // Cette fonction utilitaire va ré-associer les BrowserViews existantes et injecter la nouvelle
    rootNode = rebuildTreeFromSnapshot(previousState, restoredView);

    // 5. On réactive le suivi de navigation pour le panneau restauré
    const restoredNode = findPanelNode(rootNode, lastClosedPanel.id);
    if (restoredNode) {
        setupNavigationTracking(restoredNode);
        restoredView.webContents.loadURL(restoredNode.url || lastClosedPanel.url).catch((error) => {
            console.error(`[LECTURE] Impossible de restaurer la tuile ${restoredNode.id} après annulation :`, error);
        });
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
// =========================================================================
// ✨ VERSION CORRIGÉE : ENVOI DE L'ÉTAT DU BOUTON HISTORIQUE À L'INTERFACE
// =========================================================================
ipcMain.on("open-history-window", () => {
    const existingHistoryWindow = historyWindow && !historyWindow.isDestroyed()
        ? historyWindow
        : global.historyWindow;

    if (existingHistoryWindow && !existingHistoryWindow.isDestroyed()) {
        if (existingHistoryWindow.isMinimized()) existingHistoryWindow.restore();
        existingHistoryWindow.show();
        existingHistoryWindow.focus();
        updateHistoryWindowContent();
        return;
    }

    historyWindow = new BrowserWindow({
        width: 450,
        height: 600,
        title: tr("history.title"),
        backgroundColor: isDarkModeForced ? "#1e1e1e" : "#f9fafb",
        autoHideMenuBar: true,
        alwaysOnTop: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload-history.js'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true
        }
    });

    global.historyWindow = historyWindow;
    historyWindow.loadFile(path.join(__dirname, 'history.html'));

    // 🕒 APPARITION : Informe l'IHM que la fenêtre vient de s'ouvrir pour enfoncer le bouton
    historyWindow.webContents.on('did-finish-load', () => {
        updateHistoryWindowContent();
        if (win && !win.isDestroyed()) {
            win.webContents.send("history-window-state", true);
        }
    });

    // 🕒 DISPARITION : Informe l'IHM que la fenêtre se ferme pour relâcher le bouton
    historyWindow.on("closed", () => {
        historyWindow = null;
        global.historyWindow = null;
        if (win && !win.isDestroyed()) {
            win.webContents.send("history-window-state", false);
        }
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

// ✨ AJOUT : Répond à l'IHM pour synchroniser le bouton au démarrage de l'application
ipcMain.on("check-history-window-opened", (event) => {
    const isOpened = historyWindow !== null && !historyWindow.isDestroyed();
    event.sender.send("history-window-state", isOpened);
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
    const newPanel = new PanelNode(newPanelId, newView, urlToClone, isPrivate, null, {
        floatingNavigationVisible: node.floatingNavigationVisible,
        floatingNavigationWidth: node.floatingNavigationWidth,
        floatingNavigationHeight: node.floatingNavigationHeight,
        floatingNavigationX: node.floatingNavigationX,
        floatingNavigationY: node.floatingNavigationY
    });
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
        label: getContainerLabel(id),
        click: () => ipcMain.emit("split-panel", null, panelId, "vertical", false, id)
    }))).popup({ window: win });
});

function closeSplitMenu() {
    if (splitMenuWindow && !splitMenuWindow.isDestroyed()) splitMenuWindow.close();
    splitMenuWindow = null;
    splitMenuTargetPanelId = null;
}

ipcMain.on("show-split-menu", (event, panelId, anchor = {}, isDark = false) => {
    if (!win || win.isDestroyed() || event.sender !== win.webContents || maximizedPanelId !== null) return;
    if (!findPanelNode(rootNode, panelId)) return;

    closeSplitMenu();
    const menuWidth = 212;
    const menuHeight = 92;
    const contentBounds = win.getContentBounds();
    const display = screen.getDisplayMatching({
        x: contentBounds.x + (Number(anchor.x) || 0),
        y: contentBounds.y + (Number(anchor.y) || 0),
        width: 1,
        height: 1
    });
    const workArea = display.workArea;
    const anchorX = contentBounds.x + (Number(anchor.x) || 0);
    const anchorY = contentBounds.y + (Number(anchor.y) || 0);
    const x = Math.max(workArea.x, Math.min(workArea.x + workArea.width - menuWidth, Math.round(anchorX - menuWidth)));
    const y = Math.max(workArea.y, Math.min(workArea.y + workArea.height - menuHeight, Math.round(anchorY + 4)));

    splitMenuTargetPanelId = panelId;
    splitMenuWindow = new BrowserWindow({
        width: menuWidth,
        height: menuHeight,
        x,
        y,
        parent: win,
        frame: false,
        transparent: false,
        resizable: false,
        movable: false,
        minimizable: false,
        maximizable: false,
        show: false,
        focusable: true,
        skipTaskbar: true,
        hasShadow: true,
        backgroundColor: isDark ? "#252526" : "#ffffff",
        webPreferences: {
            preload: path.join(__dirname, "preload-split-menu.js"),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true
        }
    });

    const menuWindow = splitMenuWindow;
    menuWindow.loadFile(path.join(__dirname, "split-menu.html"), {
        query: {
            lang: currentLanguage,
            theme: isDark ? "dark" : "light"
        }
    });
    menuWindow.once("ready-to-show", () => {
        if (splitMenuWindow === menuWindow && !menuWindow.isDestroyed()) menuWindow.show();
    });
    menuWindow.on("blur", () => {
        if (splitMenuWindow === menuWindow) closeSplitMenu();
    });
    menuWindow.on("closed", () => {
        if (splitMenuWindow === menuWindow) {
            splitMenuWindow = null;
            splitMenuTargetPanelId = null;
        }
    });
});

ipcMain.on("split-menu-dismiss", (event) => {
    if (splitMenuWindow && !splitMenuWindow.isDestroyed() && event.sender === splitMenuWindow.webContents) {
        closeSplitMenu();
    }
});

ipcMain.on("split-menu-choose", (event, direction) => {
    if (!splitMenuWindow || splitMenuWindow.isDestroyed() || event.sender !== splitMenuWindow.webContents) return;
    if (direction !== "vertical" && direction !== "horizontal") return;
    const panelId = splitMenuTargetPanelId;
    closeSplitMenu();
    if (panelId && findPanelNode(rootNode, panelId) && maximizedPanelId === null) {
        ipcMain.emit("split-panel", null, panelId, direction, false);
    }
});

// ====== DANS MAIN.JS -> ipcMain.on("split-panel", ...) ======
ipcMain.on("split-panel", (event, panelId, direction, isPrivate = false, containerId = null, initialUrl = null) => {

    const node = findPanelNode(rootNode, panelId);
    const parent = findParentNode(rootNode, panelId);    
    if (!node || (direction !== "vertical" && direction !== "horizontal")) return;
    const resolvedInitialUrl = initialUrl ? resolveContextLinkUrl(initialUrl) : "";
    if (initialUrl && !resolvedInitialUrl) {
        console.warn("[Menu contextuel] URL initiale de scindage refusée.");
        return;
    }

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
    const privateTranslationKeys = [
        "ui.privateLabel", "private.title", "private.body", "private.hidden", "private.visible",
        "private.listHistory", "private.listCookies", "private.listForms", "private.listCache",
        "private.visibleSites", "private.visibleAdmin", "private.visibleIsp", "private.search"
    ];
    const privateLocaleStrings = Object.fromEntries(privateTranslationKeys.map((key) => [
        key,
        { fr: HareI18n.t(key, "fr"), en: HareI18n.t(key, "en") }
    ]));

    // 1. Définition du code HTML / CSS de la page d'accueil privée mis à jour dynamiquement
    const incognitoHomeHtml = `
        <!DOCTYPE html>
        <html lang="${currentLanguage}" class="${themeClass}">
        <head>
            <meta charset="utf-8">
            <title id="private-page-title">${tr("ui.privateLabel")}</title>
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
                <h1 id="private-title">${tr("private.title")}</h1>
                <p id="private-body">${tr("private.body")}</p>
                
                <div class="lists-container">
                    <div class="list-box secure">
                        <h3 id="private-hidden">${tr("private.hidden")}</h3>
                        <ul>
                            <li id="private-list-history">${tr("private.listHistory")}</li>
                            <li id="private-list-cookies">${tr("private.listCookies")}</li>
                            <li id="private-list-forms">${tr("private.listForms")}</li>
                            <li id="private-list-cache">${tr("private.listCache")}</li>
                        </ul>
                    </div>
                    <div class="list-box warn">
                        <h3 id="private-visible">${tr("private.visible")}</h3>
                        <ul>
                            <li id="private-visible-sites">${tr("private.visibleSites")}</li>
                            <li id="private-visible-admin">${tr("private.visibleAdmin")}</li>
                            <li id="private-visible-isp">${tr("private.visibleIsp")}</li>
                        </ul>
                    </div>
                </div>

                <!-- Redirection vers votre IP locale au clic -->
                <button id="private-search" class="btn-search" onclick="window.location.href='http://129.151.254.175:8080'">
                    ${tr("private.search")}
                </button>
            </div>
            <script>
                const privateLocaleStrings = ${JSON.stringify(privateLocaleStrings)};
                const privateElements = {
                    "ui.privateLabel": "private-page-title", "private.title": "private-title", "private.body": "private-body",
                    "private.hidden": "private-hidden", "private.visible": "private-visible", "private.listHistory": "private-list-history",
                    "private.listCookies": "private-list-cookies", "private.listForms": "private-list-forms", "private.listCache": "private-list-cache",
                    "private.visibleSites": "private-visible-sites", "private.visibleAdmin": "private-visible-admin",
                    "private.visibleIsp": "private-visible-isp", "private.search": "private-search"
                };
                function applyPrivateLanguage(language) {
                    const locale = language === "en" ? "en" : "fr";
                    document.documentElement.lang = locale;
                    Object.entries(privateElements).forEach(([key, elementId]) => {
                        const element = document.getElementById(elementId);
                        if (element) element.textContent = privateLocaleStrings[key][locale];
                    });
                }
                window.tileLanguage?.get().then(applyPrivateLanguage).catch(() => {});
                window.tileLanguage?.onChanged(applyPrivateLanguage);
            </script>
        </body>
        </html>
    `;

    // Une URL de lien sélectionnée est prioritaire; sinon la tuile suit son accueil habituel.
    const defaultUrl = resolvedInitialUrl || (isPrivate
        ? "data:text/html;charset=utf-8," + encodeURIComponent(incognitoHomeHtml)
        : getHomePageUrl());

    // Passer le paramètre isPrivate au constructeur
    const newPanel = new PanelNode(newPanelId, newView, defaultUrl, isPrivate, containerId, {
        floatingNavigationVisible: node.floatingNavigationVisible,
        floatingNavigationWidth: node.floatingNavigationWidth,
        floatingNavigationHeight: node.floatingNavigationHeight,
        floatingNavigationX: node.floatingNavigationX,
        floatingNavigationY: node.floatingNavigationY
    });
    setupNavigationTracking(newPanel);
    newView.webContents.loadURL(defaultUrl).catch((error) => {
        console.error(`[Mosaïque] Impossible de charger la nouvelle tuile ${newPanelId} :`, error);
    });

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

//  rootNode.first = new PanelNode("panel1", leftView, homePageUrl);
//  rootNode.second = new PanelNode("panel2", centerView, welcomePageUrl);

    rootNode.first = new PanelNode("panel1", centerView, welcomePageUrl);
    rootNode.second = new PanelNode("panel2", leftView, homePageUrl);

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

    if (!activePanel) activePanel = "panel1";
    updateNavigationButtons();
}

async function createWindow() {


    loadLanguagePreference();

        await fsPromises.mkdir(appDataPath, { recursive: true }); //
        loadClosePreferences();
        captureSessionLayoutBaseline();
    
    // Récupération des préférences de thème
    isDarkModeForced = await getThemePreference(); //
    nativeTheme.themeSource = isDarkModeForced ? "dark" : "light"; //

    // ===================================================
    // ✨ STEP 1 : CRÉATION ET AFFICHAGE DU SPLASH SCREEN
    // ===================================================
    splash = new BrowserWindow({
        width: 420,
        height: 340,
        transparent: true, // Permet d'avoir des coins arrondis si le HTML le gère
        frame: false,      // Supprime les bordures OS d'agrandissement et fermeture
        alwaysOnTop: true, // Évite qu'une autre application ne vienne masquer le chargement
        resizable: false,
        center: true,
        icon: path.join(__dirname, 'build', 'icon.ico'), //
        webPreferences: {
            sandbox: true
        }
    });
    
    splash.loadFile('splash.html', { query: { language: currentLanguage } });

    // ==========================================================
    // ✨ STEP 2 : INITIALISATION DE LA FENÊTRE PRINCIPALE CACHÉE
    // ===========================================================
    // ==========================================================
    // ✨ CONFIGURATION DE LA FENÊTRE PRINCIPALE CACHÉE (CORRIGÉE)
    // ===========================================================
    win = new BrowserWindow({
        width: 1200,
        height: 800,
        frame: false,
        titleBarStyle: 'hidden',
        show: false, 
        backgroundColor: isDarkModeForced ? '#252526' : '#f3f4f6',
        icon: path.join(__dirname, 'build', 'icon.ico'),
        titleBarOverlay: {
            color: isDarkModeForced ? '#252526' : '#ffffff',
            symbolColor: isDarkModeForced ? '#cfcfcf' : '#1f2937',
            // ✨ FIX : On baisse la hauteur de 38px à 22px pour redonner l'accès 
            // de clic à votre bouton Paramètres dans l'IHM HTML
            height: 22 
        },
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true
        }
    });
    win.maximize(); // ✨ AJOUT 1 : Force la fenêtre à prendre la taille maximale de l'écran en tâche de fond

    win.setMaxListeners(0); //
    registerDownloadHandler(win.webContents.session); //

    // ===================================================
    // ✨ STEP 3 : TRANSITION ET FONDU FLUIDE AU DÉMARRAGE
    // ===================================================
    // L'événement 'ready-to-show' est déclenché par Chromium quand le premier rendu graphique
    // est totalement calculé en mémoire, évitant ainsi le flash blanc.
    win.once('ready-to-show', () => {
        // Optionnel : Ajout d'une petite latence de 500ms si le chargement est trop rapide instantané,
        // pour laisser le temps à l'utilisateur d'apprécier le splash screen.
        setTimeout(() => {
            if (splash && !splash.isDestroyed()) {
                splash.close(); // Ferme et détruit le splash screen
                splash = null;
            }
            
            if (win && !win.isDestroyed()) {
                win.show();  // Affiche la fenêtre principale proprement stabilisée
                win.focus(); // Donne le focus au navigateur
            }
        }, 600); 
    });

    await fsPromises.mkdir(appDataPath, { recursive: true });
    loadAutoSleepPreference();  
    loadFloatingNavigationPreference();
    loadAiSidebarPreference();
    loadDownloadsList();
    isDarkModeForced = await getThemePreference();
    nativeTheme.themeSource = isDarkModeForced ? "dark" : "light";
    //  AJOUTEZ CETTE LIGNE ICI :
    loadBookmarksVisibilityPreference();     

 /*
    process.on("warning", (warning) => {
        console.log("WARNING NAME:", warning.name);
        console.log("WARNING MESSAGE:", warning.message);
        console.log("WARNING STACK:", warning.stack);
    });
*/
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
            label: 'Affichage',
            submenu: [
                {
                    id: "restore-bookmarks-menu-item",
                    label: 'Afficher les favoris',
                    visible: !isBookmarksBarVisible,
                    click: () => setBookmarksBarVisible(true)
                }
            ]
        },
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
                            title: tr("main.saveLayout"),
                            defaultPath: path.join(app.getPath('documents'), 'hare-browser-layout.json'),
                            filters: [{ name: tr('dialog.configFiles'), extensions: ['json'] }]
                        });
                        if (filePath) {
                            try {
                                await fsPromises.writeFile(filePath, JSON.stringify(snapshot, null, 2), 'utf-8');
//                              console.log("Configuration sauvegardée via raccourci.");
                            } catch (error) {
//                              console.error("Erreur raccourci sauvegarde :", error);
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

//                      console.log("[Mosaïque] Ratios réinitialisés à parts égales.");
                    }
                },


                {
                    label: "Ouvrir les Paramètres",
                    accelerator: "CmdOrCtrl+,",
                    click: () => {
                        openSettingsWindow();
                    }
                },

                {
                    label: tr("toolbar.resetWorkspace"),
                    accelerator: "CmdOrCtrl+Shift+Home",
                    click: () => {
                        if (win && !win.isDestroyed()) {
                            ipcMain.emit("reset-workspace", { sender: win.webContents });
                        }
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
                            title: tr("main.loadLayout"),
                            defaultPath: app.getPath('documents'),
                            properties: ['openFile'],
                            filters: [{ name: tr('dialog.configFiles'), extensions: ['json'] }]
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
                                        const newNode = new PanelNode(node.id, newView, node.url, !!node.isPrivate, node.containerId || null, node);
                                        setupNavigationTracking(newNode);
                                        newView.webContents.loadURL(node.realUrl || node.url || "http://129.151.254.175:8080").catch((error) => {
                                            console.error(`[LECTURE] Chargement de la tuile importée ${node.id} impossible :`, error);
                                        });
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

//                              console.log("Configuration chargée via raccourci.");
                            } catch (error) {
                                console.error("Erreur raccourci chargement :", error);
                                dialog.showErrorBox(tr("dialog.loadError"), tr("dialog.corruptFile"));
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
                    accelerator: 'CmdOrCtrl+Shift+H',
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
                    label: tr("toolbar.home"),
                    accelerator: 'Alt+Home',
                    click: () => {
                        const targetPanel = findPanelNode(rootNode, activePanel) || getLeftmostPanel();
                        void navigatePanelToHome(targetPanel);
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
                        if (win && !win.isDestroyed()) win.close();
                    }
                },

                // === AJOUT : RACCOURCI CTRL+SHIFT+B POUR MASQUER/AFFICHER LA BARRE DE FAVORIS ===
                {
                    label: 'Masquer/Afficher la barre de favoris',
                    accelerator: 'CmdOrCtrl+Shift+B',
                    click: () => {
                        if (!win || win.isDestroyed()) return;
                        setBookmarksBarVisible(!isBookmarksBarVisible);
                    }
                },

                // À mettre dans votre tableau 'template' des menus dans main.js
                {
                    label: 'Afficher l\'historique',
                    accelerator: 'CmdOrCtrl+H',
                    click: () => ipcMain.emit('open-history-window')
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

    applicationMenuTemplate = template;
    const menu = Menu.buildFromTemplate(translateMenuTemplate(template));
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

        // ✨ AJOUTEZ CETTE LIGNE ICI :
        win.webContents.send("toggle-bookmarks-bar", isBookmarksBarVisible);

        win.webContents.send(
            "panels-updated",
            collectPanels(rootNode),
            maximizedPanelId
        );

        // Le renderer peut charger après le focus initial : on réémet le panneau actif.
        const startupActive = activePanel && findPanelNode(rootNode, activePanel);
        if (startupActive) {
            win.webContents.send("active-panel-changed", { id: startupActive.id, bounds: startupActive.bounds });
        }

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
//          console.log(`[SÉCURITÉ GLOBALE] Ouverture de fenêtre bloquée pour l'URL : ${url}`);
            
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


/*    
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
*/
// main.js

// ... (votre code existant) ...

// Intercepte le clic sur la croix de fermeture de la fenêtre principale
win.on('close', (e) => {
    // Empêche la fermeture immédiate le temps de demander confirmation
    e.preventDefault(); //
    if (isQuitConfirmationOpen) return;
    isQuitConfirmationOpen = true;

    // 🌟 CORRECTIF CRUCIAL : On désactive temporairement le premier plan des fenêtres secondaires
    if (historyWindow && !historyWindow.isDestroyed()) { //
        historyWindow.setAlwaysOnTop(false); //
    }
    if (pwdWindow && !pwdWindow.isDestroyed()) { //
        pwdWindow.setAlwaysOnTop(false); //
    }

    // ✨ 1. CHARGEMENT DE L'ICÔNE DE L'APPLICATION AVEC NATIVEIMAGE
    // nativeImage permet à Electron de décoder et redimensionner proprement le fichier .ico
//  const appIcon = nativeImage.createFromPath(path.join(__dirname, 'build', 'icon.ico'));
    const appIcon = nativeImage.createFromPath(path.join(__dirname, 'resources', 'icon.ico'));

    // 2. Affichage de la boîte de dialogue liée à la fenêtre principale 'win'
    dialog.showMessageBox(win, {
        type: 'none', // 🌟 TRÈS IMPORTANT : On passe le type à 'none' pour masquer l'icône "i" système
        icon: appIcon, // ✨ ON INJECTE NOTRE ICÔNE PERSONNALISÉE ICI
        buttons: [tr('dialog.quit'), tr('dialog.cancel')], //
        defaultId: 1, //
        cancelId: 1, //
        checkboxLabel: tr('dialog.quitSaveLayout'),
        checkboxChecked: saveLayoutOnExit,
        title: tr('dialog.confirm'), //
        message: tr('dialog.quitMessage', { app: APP_TITLE }), //
        detail: tr('dialog.quitDetail') //
    }).then((response) => {
        saveLayoutOnExit = typeof response.checkboxChecked === "boolean"
            ? response.checkboxChecked
            : saveLayoutOnExit;
        saveClosePreferences();

        if (!saveLayoutOnExit) {
            if (sessionSaveTimer) {
                clearTimeout(sessionSaveTimer);
                sessionSaveTimer = null;
            }
            restoreSessionLayoutBaseline();
        }

        // Seul l'index 0 ("Oui, quitter") détruit la fenêtre
        if (response.response === 0) {
            if (sessionSaveTimer) { //
                clearTimeout(sessionSaveTimer); //
                sessionSaveTimer = null; //
            }
            saveAutoSleepPreference(); //
            if (saveLayoutOnExit) persistSessionLayout(); //
            win.destroy(); //
        } else {
            isQuitConfirmationOpen = false;
            // 🌟 RESTAURATION : Si l'utilisateur annule, on remet le "Always on Top"
            if (historyWindow && !historyWindow.isDestroyed()) { //
                historyWindow.setAlwaysOnTop(true); //
            }
            if (pwdWindow && !pwdWindow.isDestroyed()) { //
                pwdWindow.setAlwaysOnTop(true); //
            }
        }
    }).catch((error) => {
        console.error("Erreur dans la confirmation de fermeture :", error);
        isQuitConfirmationOpen = false;
        if (historyWindow && !historyWindow.isDestroyed()) historyWindow.setAlwaysOnTop(true);
        if (pwdWindow && !pwdWindow.isDestroyed()) pwdWindow.setAlwaysOnTop(true);
    });
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
    if (!node) return 0;
    if (node.type === "panel") return 1;

    const firstLeafCount = resetTreeRatiosEqual(node.first);
    const secondLeafCount = resetTreeRatiosEqual(node.second);
    const totalLeafCount = firstLeafCount + secondLeafCount;
    if (totalLeafCount > 0) {
        // Chaque panneau reçoit la même part de surface, y compris dans les arbres
        // déséquilibrés (ex. une branche avec une tuile face à une branche avec deux).
        node.ratio = firstLeafCount / totalLeafCount;
    }
    return totalLeafCount;
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

    // 4. Garder le cadre bleu synchronisé avec le panneau actif.
    if (activePanel) {
        const activeNode = findPanelNode(rootNode, activePanel);
        if (activeNode?.bounds) {
            updateActiveBorder(activeNode.bounds);
        } else {
            borderViews.forEach(bView => {
                if (bView && !bView.webContents.isDestroyed()) {
                    bView.setBounds({ x: -100, y: -100, width: 0, height: 0 });
                }
            });
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
    win.webContents.send("panel-layout-updated", collectPanels(rootNode));
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





///////////////////////////////// ICI






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
    
    const keepChromeFocus = options && options.keepChromeFocus;

    if (panel.isSleeping && !keepChromeFocus) {
        wakePanel(panel);
        return;
    }

    activePanel = panelId;
    scheduleSessionLayoutSave();
    
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
        title: tr("main.saveLayout"),
        defaultPath: path.join(app.getPath('documents'), 'hare-browser-layout.json'),
        filters: [
            { name: tr('dialog.configFiles'), extensions: ['json'] }
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
        title: tr("main.loadLayout"),
        defaultPath: app.getPath('documents'),
        properties: ['openFile'],
        filters: [
            { name: tr('dialog.configFiles'), extensions: ['json'] }
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
                    const newNode = new PanelNode(node.id, newView, node.url, !!node.isPrivate, importedContainerId, node);
                    setupNavigationTracking(newNode);
                    newView.webContents.loadURL(node.realUrl || node.url || "http://129.151.254.175:8080").catch((error) => {
                        console.error(`[LECTURE] Chargement de la tuile importée ${node.id} impossible :`, error);
                    });
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
            dialog.showErrorBox(tr("dialog.loadError"), tr("dialog.corruptFile"));
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
    model = DEFAULT_OLLAMA_MODEL,
    compareVisiblePanels: compareVisiblePanelsArg = false,
    fullMode = false

} = {}) => {

    // ✨ 1. AJOUT DU BLOC DE SÉCURITÉ CONTRE LES REQUÊTES VIDES
    if (!prompt || !prompt.trim()) {
        return tr("ollama.selectTile");
    }

    // ✨ 2. LA CORRECTION : Déclaration explicite de la variable avec 'let' pour éviter le crash
    let compareVisiblePanels = compareVisiblePanelsArg;

    if (win && !win.isDestroyed()) {
        win.setProgressBar(2, { mode: "indeterminate" });
        win.webContents.send("ai-loading-state", true);
    }

    try {

        // Vérifie qu'Ollama est installé
        const installed = await ensureOllamaInstalled();

        if (!installed) {
            return tr("ollama.notInstalled");
        }

        const modelInstalled =
    await isModelInstalled(model);

if (!modelInstalled) {

    const result =
        await dialog.showMessageBox({
            type: "question",
            title: tr("dialog.downloadModel.title"),
            message: tr("dialog.downloadModel.message", { model }),
            detail: tr("dialog.downloadModel.detail"),
            buttons: [
                tr("dialog.download"),
                tr("dialog.cancel")
            ],
            defaultId: 0,
            cancelId: 1
        });

    if (result.response !== 0) {
        return tr("ollama.cancelled");
    }

    try {

        if (
            win &&
            !win.isDestroyed()
        ) {

            win.webContents.send(
                "ai-loading-state",
                true
            );
        }

        await pullOllamaModel(model);

    } catch (err) {

        console.error(
            "[OLLAMA] Erreur téléchargement :",
            err
        );

        return tr("ai.downloadError", { error: err.message });
    }
}

        // Vérifie que le serveur Ollama répond
        const running = await isOllamaRunning();

        if (!running) {

            // Tentative de démarrage automatique
            try {
                startEmbeddedOllama();

                await new Promise(resolve =>
                    setTimeout(resolve, 5000)
                );

            } catch (e) {
                console.error(
                    "[OLLAMA] Impossible de démarrer Ollama :",
                    e
                );
            }

            const runningAfterStart =
                await isOllamaRunning();

            if (!runningAfterStart) {
                return tr("ollama.notRunning");
            }
        }




        compareVisiblePanels =
            compareVisiblePanels || isMultiTilePrompt(prompt);

        if (!compareVisiblePanels && !activePanel) {
            console.warn("[OLLAMA] Aucune tuile active");
            return "SELECT_PANEL_REQUIRED";
        }

        const panel = activePanel
            ? findPanelNode(rootNode, activePanel)
            : null;

        if (!compareVisiblePanels && (!panel || !panel.view)) {
            console.warn("[OLLAMA] Tuile introuvable");
            return tr("panel.notFound");
        }

//      console.log("[OLLAMA] Extraction du contexte...");

        const pageContexts = compareVisiblePanels
            ? await collectVisiblePanelsContext(prompt, fullMode)
            : [await extractVisiblePanelContext(panel, fullMode)]
                  .filter(Boolean);

/*                  
        console.log(
            `[OLLAMA] ${pageContexts.length} contexte(s) récupéré(s)`
        );
*/

        if (pageContexts.length === 0) {
            return compareVisiblePanels
                ? tr("ollama.noVisibleText")
                : tr("ollama.noPageText");
        }

        const contextBudget = fullMode ? 48000 : 15000;
        let remainingContext = contextBudget;

        const formattedContexts = pageContexts.map((page) => {

            const header =
                `Source ${page.siteName} — ${page.title} — ${page.url}`;

            const availableTextLength =
                Math.max(
                    0,
                    remainingContext - header.length - 100
                );

            const text = page.text.slice(
                0,
                Math.min(
                    fullMode ? 20000 : 5000,
                    availableTextLength
                )
            );

            remainingContext -=
                header.length + text.length + 100;

            return `${header}\n${text}`;
        });

        const combinedContext = formattedContexts.join(
            "\n\n--- CONTEXTE DE LA SOURCE SUIVANTE ---\n\n"
        );

        const panelContextSummary = pageContexts
            .map(
                page =>
                    `- ${page.siteName} : ${page.title} (${page.url})`
            )
            .join("\n");

//      console.log("[OLLAMA] Construction du prompt terminée");

        const resultOllama = await new Promise((resolve, reject) => {

            try {

                let systemInstruction = "";

                if (
                    prompt.toLowerCase().includes("résumé") ||
                    prompt.toLowerCase().includes("resume")
                ) {

                    systemInstruction = compareVisiblePanels
                        ? `${currentLanguage === "fr" ? "Tu es un assistant IA intégré au navigateur. Réponds en français, de façon claire et concise. Résume les informations pertinentes des tuiles visibles, en séparant les sources lorsque c'est utile. N'invente aucune donnée absente des extraits." : "You are an AI assistant integrated into the browser. Reply in English, clearly and concisely. Summarize relevant information from visible tiles, separating sources when useful. Do not invent information absent from the excerpts."}\n\n${currentLanguage === "fr" ? "Tuiles fournies" : "Provided tiles"} :\n${panelContextSummary}\n\n${currentLanguage === "fr" ? "Contenu extrait" : "Extracted content"} :\n${combinedContext}`
                        : `${currentLanguage === "fr" ? "Tu es un assistant IA intégré au navigateur. Réponds en français de façon claire et concise en résumant uniquement la page active ci-dessous. N'invente aucune donnée absente de l'extrait." : "You are an AI assistant integrated into the browser. Reply in English, clearly and concisely, summarizing only the active page below. Do not invent information absent from the excerpt."}\n\n${currentLanguage === "fr" ? "Page active" : "Active page"} :\n${panelContextSummary}\n\n${currentLanguage === "fr" ? "Contenu extrait" : "Extracted content"} :\n${combinedContext}`;

                } else {

                    systemInstruction = compareVisiblePanels
                        ? `${currentLanguage === "fr" ? "Tu es un assistant IA intégré au navigateur. Réponds en français à la demande en te basant exclusivement sur le contenu des tuiles visibles." : "You are an AI assistant integrated into the browser. Reply in English, using only the content of the visible tiles."}\n\n${combinedContext}`
                        : `${currentLanguage === "fr" ? "Tu es un assistant IA intégré au navigateur. Réponds en français à la demande en te basant exclusivement sur le contenu de la page active." : "You are an AI assistant integrated into the browser. Reply in English, using only the content of the active page."}\n\n${combinedContext}`;
                }

                const postData = JSON.stringify({
                    model,
                    prompt,
                    system: systemInstruction,
                    stream: false,
                    ...(fullMode
                        ? { options: { num_ctx: 16384 } }
                        : {})
                });
















                








                const http = getNodeModule("http");

                const req = http.request({
                    hostname: "127.0.0.1",
                    port: 11434,
                    path: "/api/generate",
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Content-Length": Buffer.byteLength(postData)
                    }
                }, (res) => { // 🟢 DEBUT DU CALLBACK DE RÉPONSE

                    let responseBody = "";

                    res.setEncoding("utf8");

                    res.on("data", chunk => {
                        responseBody += chunk;
                    });

                    res.on("end", () => {
                        if (res.statusCode < 200 || res.statusCode >= 300) {
                            try {
                                const errorJson = JSON.parse(responseBody);
                                resolve(tr("ai.ollamaError", { status: res.statusCode, error: errorJson.error || responseBody }));
                            } catch {
                                resolve(tr("ai.ollamaError", { status: res.statusCode, error: responseBody }));
                            }
                            return;
                        }

                        try {
                            const result = JSON.parse(responseBody);
                            resolve(result.response || tr("ai.empty"));
                        } catch (error) {
                            console.error("[OLLAMA] Erreur JSON :", error);
                            resolve(tr("ollama.invalidResponse"));
                        }
                    });

                }); // 🔴 FIN DU CALLBACK DE RÉPONSE (L'intrus a été supprimé d'ici !)

                // ✨ AJOUT : On mémorise la requête globalement pour pouvoir l'annuler depuis l'IHM
                currentOllamaRequest = req;

                req.setTimeout(120000, () => {
                    console.error("[OLLAMA] Timeout après 120 secondes");
                    req.destroy(new Error("Timeout"));
                });

                req.on("error", error => {
                    console.error("[OLLAMA] Erreur HTTP :", error);
                    resolve(tr("ai.localUnavailable", { error: error.message }));
                });

                // 🌟 LE SEUL ET UNIQUE ENDROIT OÙ L'ON ÉCRIT LES DONNÉES (Tout en bas, à l'extérieur)
                if (req && !req.destroyed) {
                    req.write(postData);
                    req.end();
                }

            } catch (innerError) {
                console.error("[OLLAMA] Exception interne :", innerError);
                reject(innerError);
            }



        });

//      console.log("[OLLAMA] Réponse finale obtenue");

        return resultOllama;

    } catch (err) {

        console.error(
            "[IA RAG] Erreur générale :",
            err
        );

        console.error(err.stack);

        return tr("ai.internalError", { error: err.message });

    } finally {

        if (win && !win.isDestroyed()) {
            win.setProgressBar(-1);
            win.webContents.send(
                "ai-loading-state",
                false
            );
        }
    }



    
});

async function isOllamaRunning() {

    return new Promise(resolve => {

        const http = getNodeModule("http");

        const req = http.get(
            "http://127.0.0.1:11434/api/tags",
            res => {
                resolve(
                    res.statusCode >= 200 &&
                    res.statusCode < 300
                );
            }
        );

        req.on("error", () => {
            resolve(false);
        });

        req.setTimeout(3000, () => {
            req.destroy();
            resolve(false);
        });
    });
}
// L'interface IA demande à exécuter une action (ex: cliquer sur un bouton)
ipcMain.handle("nanobrowser-execute-action", async (event, { actionType, argument }) => {
    if (!activePanel) return tr("panel.noActive");
    const panel = findPanelNode(rootNode, activePanel);
    if (!panel || !panel.view) return tr("panel.notFound");
    
    if (actionType === "click") {
        return await panel.view.webContents.executeJavaScript(`window.NanobrowserExecutor.clickElement("${argument}")`);
    }
});


ipcMain.handle("get-theme-preference", () => {
    return getThemePreference();
});

ipcMain.handle("get-language", () => currentLanguage);

// =========================================================================
// ✨ VERSION REPARÉE : AUTORISE LA MODALE DES PARAMÈTRES À CHANGER LA LANGUE
// =========================================================================
ipcMain.handle("set-language", async (event, language) => {
    // Vérifie si l'appel vient bien d'une de nos fenêtres actives (Principale ou Paramètres)
    const isAuthorizedSender = 
        (win && !win.isDestroyed() && event.sender === win.webContents) ||
        (settingsWindow && !settingsWindow.isDestroyed() && event.sender === settingsWindow.webContents);
        
    // 🌟 SÉCURITÉ DE SECOURS : Si l'application est en cours d'exécution, on valide l'IHM
    if (!isAuthorizedSender && event.sender !== settingsWindow?.webContents) {
        console.warn("[SÉCURITÉ] Tentative de changement de langue rejetée depuis une source inconnue.");
        return currentLanguage;
    }
    
    if (!HareI18n.languages.includes(language)) return currentLanguage;
    
    // Sauvegarde la préférence sur le disque et reconstruit les menus
    return saveLanguagePreference(language);
});


ipcMain.handle("save-theme-preference", async (event, isDark) => { // 🌟 Déjà async dans votre code
    isDarkModeForced = isDark === true;

    // 🌟 Remplacement synchrone par asynchrone sécurisé
    await safeWriteJsonAsync(getThemePath(), { darkMode: isDarkModeForced });

    return true;
});


// ✨ ÉCOUTEUR D'ARRÊT DE L'IA
// ✨ Dans main.js, assurez-vous d'avoir ce bloc exact :
// ✨ Dans main.js, l'interrupteur réseau blindé :
ipcMain.on("cancel-ollama-request", () => {
    if (currentOllamaRequest) {
        // 1. On détruit la connexion réseau de force
        currentOllamaRequest.destroy(new Error("Annulé par l'utilisateur"));
        currentOllamaRequest = null;
        console.log("[OLLAMA] Flux réseau interrompu manuellement.");
    }
    
    // 2. On éteint les barres de progression système de la fenêtre Electron
    if (win && !win.isDestroyed()) {
        win.setProgressBar(-1); // Enlève la barre de chargement verte de l'icône de l'application
        win.webContents.send("ai-loading-state", false); // Éteint les spinners et les sabliers
    }
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
                height: TOOLBAR_ROW_HEIGHT
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


app.on("before-quit", () => {
    if (ollamaProcess) {
        try {
            ollamaProcess.kill();
        } catch (e) {}
    }
});


// Modifiez votre écouteur existant app.on('will-quit')
app.on('will-quit', () => {
    if (sessionSaveTimer) {
        clearTimeout(sessionSaveTimer);
        sessionSaveTimer = null;
    }
    saveAutoSleepPreference();
    persistSessionLayout();
    globalShortcut.unregisterAll();

    // 🔥 ARRÊT D'OLLAMA : Tue le processus enfant pour ne pas le laisser tourner en zombie sur l'OS de l'utilisateur
    if (
        ollamaProcess &&
        !ollamaProcess.killed
    ) {
        ollamaProcess.kill("SIGINT");
    }


});

// ✨ CORRECTIF PARAMÈTRES : Force l'ouverture de la fenêtre modale à la demande de l'IHM
ipcMain.on("request-open-settings", (event) => {
    if (win && !win.isDestroyed()) {
        // Déclenche votre fonction native existante (ligne 460)
        ipcMain.emit("open-settings-window", { sender: win.webContents });
    }
});


app.whenReady().then(async () => {

    try {

        startEmbeddedOllama();

        /*
        console.log(
            "[OLLAMA] Attente du serveur sur le port 11434..."
        );
*/

        await waitForOllama();

/*
        console.log(
            "[OLLAMA] Serveur prêt"
        );
*/

        createWindow();

    } catch (err) {

/*        
        console.error(
            "[OLLAMA] Erreur démarrage :",
            err
        );
*/

        createWindow();
    }
});
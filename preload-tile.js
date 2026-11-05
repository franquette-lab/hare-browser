const { contextBridge, ipcRenderer } = require('electron');

let lastHoverReport = 0;
const recentSubmitGesture = new WeakMap();
let pendingPasswordSubmission = null;
let lastPasswordStateReport = 0;

function reportActivity(type) {
    const now = Date.now();
    if (type === 'hover' && now - lastHoverReport < 15000) return;
    if (type === 'hover') lastHoverReport = now;
    ipcRenderer.send('tile-activity', type);
}

document.addEventListener('pointermove', () => reportActivity('hover'), { capture: true, passive: true });
document.addEventListener('pointerover', () => reportActivity('hover'), { capture: true, passive: true });
document.addEventListener('pointerdown', () => reportActivity('click'), { capture: true, passive: true });

// Capture uniquement les soumissions explicites depuis le monde isolé du preload.
// Aucun événement DOM émis par la page ne peut fournir les identifiants au processus principal.
function markSubmitGesture(form) {
    if (form) recentSubmitGesture.set(form, Date.now());
}

document.addEventListener('click', (event) => {
    if (!event.isTrusted || !(event.target instanceof Element)) return;
    const submitControl = event.target.closest(
        'button, input[type="submit"], input[type="image"]'
    );
    markSubmitGesture(submitControl?.closest('form') || null);
}, true);

document.addEventListener('keydown', (event) => {
    if (!event.isTrusted || event.key !== 'Enter') return;
    const target = event.target;
    if (target instanceof HTMLInputElement) markSubmitGesture(target.form);
}, true);

function isVisibleEnabledInput(input) {
    return !input.disabled && input.type !== 'hidden' && input.getClientRects().length > 0;
}

function hasVisiblePasswordInput() {
    return Array.from(document.querySelectorAll('input[type="password"]')).some((input) =>
        isVisibleEnabledInput(input) && input.autocomplete.toLowerCase() !== 'new-password'
    );
}

function reportPostSubmitFormState() {
    const pending = pendingPasswordSubmission;
    if (!pending || Date.now() - pending.at > 45000) {
        pendingPasswordSubmission = null;
        return;
    }
    if (Date.now() - lastPasswordStateReport < 500) return;

    const passwordFormVisible = hasVisiblePasswordInput();
    const routeChanged = location.pathname !== pending.path;
    if (!passwordFormVisible && !routeChanged && Date.now() - pending.at < 2500) return;
    lastPasswordStateReport = Date.now();
    ipcRenderer.send('password-auth-state', {
        origin: location.origin,
        path: location.pathname,
        passwordFormVisible
    });
    if (!passwordFormVisible) pendingPasswordSubmission = null;
}

function collectSubmittedCredentials(form) {
    const inputs = Array.from(form.querySelectorAll('input')).filter(isVisibleEnabledInput);
    const passwordInputs = inputs.filter((input) =>
        input.type === 'password' && input.autocomplete.toLowerCase() !== 'new-password'
    );
    const passwordInput = passwordInputs.find((input) =>
        input.autocomplete.toLowerCase() === 'current-password'
    ) || (passwordInputs.length === 1 ? passwordInputs[0] : null);
    if (!passwordInput?.value) return null;

    const usernameInput = inputs.find((input) =>
        input.autocomplete.toLowerCase() === 'username'
    ) || inputs.find((input) => ['text', 'email', 'tel'].includes(input.type));
    if (!usernameInput?.value?.trim()) return null;

    let actionOrigin;
    try {
        actionOrigin = new URL(form.action || location.href, location.href).origin;
    } catch {
        return null;
    }

    return {
        origin: location.origin,
        path: location.pathname,
        actionOrigin,
        username: usernameInput.value,
        password: passwordInput.value
    };
}

function reportSubmittedCredentials(submitted, method) {
    ipcRenderer.send('password-form-submitted', {
        ...submitted,
        method
    });

    pendingPasswordSubmission = {
        origin: submitted.origin,
        path: submitted.path,
        at: Date.now()
    };
    lastPasswordStateReport = 0;
    setTimeout(reportPostSubmitFormState, 750);
    setTimeout(reportPostSubmitFormState, 2500);
    setTimeout(reportPostSubmitFormState, 6000);
    // Rattrape le cas où le routeur SPA a déjà changé d'URL avant le premier timer.
    reportPostSubmitFormState();
}

document.addEventListener('submit', (event) => {
    if (!event.isTrusted || !(event.target instanceof HTMLFormElement)) return;

    const form = event.target;
    const gestureAt = recentSubmitGesture.get(form) || 0;
    if (Date.now() - gestureAt > 2500) return;

    const submitted = collectSubmittedCredentials(form);
    if (!submitted) return;

    const method = form.method.toLowerCase();
    if (method === 'post') {
        reportSubmittedCredentials(submitted, 'post');
        return;
    }

    if (method === 'get') {
        // Les formulaires GET natifs peuvent placer les secrets dans l'URL. On ne
        // les capture que si le gestionnaire de page annule réellement la navigation
        // native (cas des formulaires SPA, dont certains omettent method="post").
        setTimeout(() => {
            if (event.defaultPrevented) reportSubmittedCredentials(submitted, 'spa');
        }, 0);
    }
}, true);

window.addEventListener('popstate', reportPostSubmitFormState, true);

const observePasswordFormChanges = () => {
    if (!document.documentElement) return;
    const observer = new MutationObserver(reportPostSubmitFormState);
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
};
if (document.documentElement) observePasswordFormChanges();
else document.addEventListener('DOMContentLoaded', observePasswordFormChanges, { once: true });

document.addEventListener('hare-reader-mode-state', (event) => {
    if (event.detail === false) ipcRenderer.send('reader-mode-state-from-tile', false);
});

document.addEventListener('hare-reader-mode-preferences', (event) => {
    ipcRenderer.send('reader-mode-preferences-from-tile', event.detail);
});

/**
 * -----------------------------------------------------------------
 * EXPOSITION DES APIS CONTEXTUELLES (CONTEXT ISOLATION)
 * -----------------------------------------------------------------
 */

// Permet au script injecté d'envoyer des ordres de navigation au processus principal
// Permet au script injecté d'envoyer des ordres de navigation au processus principal
contextBridge.exposeInMainWorld('tileNavigation', {
    goBack: () => ipcRenderer.invoke('go-back-current'),
    goForward: () => ipcRenderer.invoke('go-forward-current'),
    openHomePage: () => ipcRenderer.invoke("open-home-page"),
    reload: () => ipcRenderer.invoke('refresh-current'),
    loadUrl: (url) => ipcRenderer.send('navigate-current', url),
    getNavigationState: () => ipcRenderer.invoke('get-tile-navigation-state'),
    onNavigationState: (callback) => {
        ipcRenderer.on('tile-navigation-state', (_event, state) => callback(state));
    },
});


contextBridge.exposeInMainWorld("tileFloatingNavigation", {
    getState: () => ipcRenderer.invoke("get-floating-navigation-state"),
    setVisible: (visible) => ipcRenderer.invoke("set-floating-navigation-visible", visible),
    setSize: (size) => ipcRenderer.invoke("set-floating-navigation-size", size),
    setPosition: (position) => ipcRenderer.invoke("set-floating-navigation-position", position),
    onVisibilityChanged: (callback) => ipcRenderer.on("floating-navigation-visibility-changed", (_event, visible) => callback(visible)),
    onGlobalChanged: (callback) => ipcRenderer.on("floating-navigation-global-changed", (_event, enabled) => callback(enabled)),
    onOpacityChanged: (callback) => ipcRenderer.on("floating-navigation-opacity-changed", (_event, opacity) => callback(opacity))
});

contextBridge.exposeInMainWorld("tileTooltipGlass", Object.freeze({
    show: (text, rect) => ipcRenderer.send("tile-header-tooltip-show", text, rect),
    hide: () => ipcRenderer.send("tile-header-tooltip-hide")
}));

// Expose les méthodes IPC pour welcome.html à travers la sandbox Chromium
contextBridge.exposeInMainWorld('tutorials', {
    openVideo: (videoFile) => {
        console.info('[Tutoriel] Appel IPC demandé depuis une tuile :', videoFile);
        return ipcRenderer.invoke('open-tutorial-video', videoFile);
    },
    openAiSidebar: () => {
        console.info('[IA Locale] Envoi du signal IPC request-open-ai-sidebar');
        ipcRenderer.send('request-open-ai-sidebar');
    },
    toggleTheme: () => {
        console.info('[Thème] Envoi du signal IPC toggle-dark-mode-request-from-tile');
        ipcRenderer.send('toggle-dark-mode-request-from-tile');
    },
    openHistory: () => {
        console.info('[Historique] Envoi du signal IPC open-history-window-from-tile');
        ipcRenderer.send('open-history-window');
    }
});

// Permet à welcome.html de capter les changements de langue d'Electron
contextBridge.exposeInMainWorld("tileLanguage", {
    get: () => ipcRenderer.invoke("get-language"),
    getTooltipTranslations: () => ipcRenderer.invoke("get-tile-tooltip-translations"),
    onChanged: (callback) => {
        ipcRenderer.on("language-changed", (_event, language, translations) => callback(language, translations));
    }
});

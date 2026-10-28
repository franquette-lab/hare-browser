const { contextBridge, ipcRenderer } = require('electron');

let lastHoverReport = 0;

function reportActivity(type) {
    const now = Date.now();
    if (type === 'hover' && now - lastHoverReport < 15000) return;
    if (type === 'hover') lastHoverReport = now;
    ipcRenderer.send('tile-activity', type);
}

document.addEventListener('pointermove', () => reportActivity('hover'), { capture: true, passive: true });
document.addEventListener('pointerover', () => reportActivity('hover'), { capture: true, passive: true });
document.addEventListener('pointerdown', () => reportActivity('click'), { capture: true, passive: true });

document.addEventListener('hare-reader-mode-state', (event) => {
    if (event.detail === false) ipcRenderer.send('reader-mode-state-from-tile', false);
});

document.addEventListener('hare-reader-mode-preferences', (event) => {
    ipcRenderer.send('reader-mode-preferences-from-tile', event.detail);
});

document.addEventListener("hare-login-form-available", () => {
    if (process.isMainFrame) ipcRenderer.send("login-form-detected");
});

// Ne transmet que les identifiants explicitement soumis dans un formulaire de connexion.
if (process.isMainFrame) {
    const submittedForms = new WeakMap();
    const isUsableField = (field) => {
        if (!field || field.disabled || field.readOnly || field.type === "hidden") return false;
        const style = getComputedStyle(field);
        return style.display !== "none" && style.visibility !== "hidden" && field.getClientRects().length > 0;
    };

    document.addEventListener("submit", (event) => {
        if (!event.isTrusted) return;
        const form = event.target;
        if (!(form instanceof HTMLFormElement)) return;

        const now = Date.now();
        if (now - (submittedForms.get(form) || 0) < 1500) return;

        const passwordFields = Array.from(form.querySelectorAll('input[type="password"]')).filter(isUsableField);
        const passwordField = passwordFields.find((field) => field.autocomplete.toLowerCase() === "current-password") ||
            passwordFields.find((field) => field.autocomplete.toLowerCase() !== "new-password");
        if (!passwordField || !passwordField.value) return;

        const usernameSelectors = [
            'input[autocomplete~="username"]',
            'input[type="email"]',
            'input[type="text"]',
            'input:not([type])'
        ];
        let usernameField = null;
        for (const selector of usernameSelectors) {
            usernameField = Array.from(form.querySelectorAll(selector)).find(isUsableField);
            if (usernameField) break;
        }

        const username = usernameField?.value?.trim().slice(0, 2048) || "";
        const password = passwordField.value.slice(0, 4096);
        if (!username || !password) return;

        submittedForms.set(form, now);
        ipcRenderer.send("password-form-submitted", {
            pageUrl: location.href,
            username,
            password
        });
    }, true);
}


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
    }
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
    // ✨ AJOUT : Nouvelle méthode sécurisée pour ouvrir l'historique depuis welcome.html
    openHistory: () => {
        console.info('[Historique] Envoi du signal IPC open-history-window-from-tile');
        ipcRenderer.send('open-history-window'); // Réutilise directement l'écouteur existant de main.js !
    }
});

// ✨ AJOUT : Permet à welcome.html de capter les changements de langue d'Electron
contextBridge.exposeInMainWorld("tileLanguage", {
    // Récupère la langue actuelle stockée dans le processus principal
    get: () => ipcRenderer.invoke("get-language"),
    
    // Écoute en temps réel si l'utilisateur change la langue dans les paramètres
    onChanged: (callback) => {
        ipcRenderer.on("language-changed", (_event, language) => callback(language));
    }
});


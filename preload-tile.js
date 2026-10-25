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


// Permet au script injecté d'envoyer des ordres de navigation au processus principal
contextBridge.exposeInMainWorld('tileNavigation', {
    goBack: () => ipcRenderer.invoke('go-back-current'),
    goForward: () => ipcRenderer.invoke('go-forward-current'),
    reload: () => ipcRenderer.invoke('refresh-current'),
    loadUrl: (url) => ipcRenderer.send('navigate-current', url),
    getNavigationState: () => ipcRenderer.invoke('get-tile-navigation-state'),
    onNavigationState: (callback) => {
        ipcRenderer.on('tile-navigation-state', (_event, state) => callback(state));
    }
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


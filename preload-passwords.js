const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('passwordApi', {
    // Internationalisation sécurisée
    getLanguage: () => ipcRenderer.invoke('get-language'),
    onLanguageChanged: (callback) => {
        const subscription = (_event, language) => callback(language);
        ipcRenderer.on('language-changed', subscription);
        return () => ipcRenderer.removeListener('language-changed', subscription);
    },
    
    // Rendu asynchrone des identifiants (Assainissement des données entrantes)
    onRenderPasswords: (callback) => {
        // 🗑️ NETTOYAGE : Supprime les anciens écouteurs pour éviter que les signaux se mélangent
        ipcRenderer.removeAllListeners('render-passwords');
        
        const subscription = (_event, data) => {
            if (data && typeof data === 'object') {
                // Protection structurelle contre l'injection de prototypes (Conservée !)
                const cleanData = JSON.parse(JSON.stringify(data));
                callback(cleanData);
            }
        };
        
        ipcRenderer.on('render-passwords', subscription);
        return () => ipcRenderer.removeListener('render-passwords', subscription);
    },

    
    // Envoi d'actions nettoyées vers le Main Process
    savePassword: (entry) => {
        if (!entry || typeof entry !== 'object') return;
        ipcRenderer.send('pwd-ui-save', {
            url: String(entry.url || ''),
            username: String(entry.username || ''),
            password: String(entry.password || '')
        });
    },
    
    deletePassword: (index) => {
        const parsedIndex = parseInt(index, 10);
        if (Number.isFinite(parsedIndex) && parsedIndex >= 0) {
            ipcRenderer.send('pwd-ui-delete', parsedIndex);
        }
    }
});

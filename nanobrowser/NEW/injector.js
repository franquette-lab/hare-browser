// nanobrowser/injector.js

(function() {
    // Évite les injections multiples conflictuelles
    if (window.NanobrowserExecutor) return;

    window.NanobrowserExecutor = {
        /**
         * Nettoie le DOM actuel et extrait le texte brut exploitable pour le RAG
         * @returns {Object} Structure textuelle de la page
         */
        getPageContent: function() {
            try {
                // Cloner le body pour manipuler les éléments sans casser l'affichage de l'utilisateur
                const clone = document.body ? document.body.cloneNode(true) : null;
                if (!clone) {
                    return { title: document.title || "", url: location.href || "", text: "" };
                }

                // 1. Purge agressive des balises inutiles ou nuisibles à l'analyse textuelle
                const selectorsToRemove = 'script, style, noscript, iframe, canvas, svg, nav, header, footer, form, aside, dialog, [aria-hidden="true"]';
                clone.querySelectorAll(selectorsToRemove).forEach(el => el.remove());

                // 2. Cibler prioritairement les zones de contenu structurellement riches
                const mainContentArea = clone.querySelector('article, [role="main"], main, .post-content, .entry-content, .article-content');
                const rootSearch = mainContentArea || clone;

                // 3. Collecter sélectivement les blocs de texte textuels cohérents
                const textBlocks = Array.from(rootSearch.querySelectorAll('h1, h2, h3, h4, h5, h6, p, li, tr'))
                    .map(el => (el.innerText || el.textContent || "").trim())
                    .filter(text => text.length > 15); // Filtre les micro-textes, boutons isolés, etc.

                const cleanText = textBlocks.length > 0 
                    ? textBlocks.join("\n\n") 
                    : (rootSearch.innerText || rootSearch.textContent || "").trim();

                return {
                    title: document.title || "Page sans titre",
                    url: location.href || "",
                    text: cleanText
                };
            } catch (error) {
                console.error("[HARE INJECTOR] Échec extraction :", error);
                return { title: document.title, url: location.href, text: "Erreur lors du traitement RAG." };
            }
        },

        /**
         * Permet à l'assistant d'interagir par script (Ex: Remplissage de formulaire)
         */
        autofillCredentials: function(username, password) {
            const userInput = document.querySelector('input[type="text"], input[type="email"], input[name="login"]');
            const passInput = document.querySelector('input[type="password"]');
            
            if (userInput && passInput) {
                userInput.value = username;
                passInput.value = password;
                // Déclencher les événements natifs pour que les scripts des sites détectent la saisie
                userInput.dispatchEvent(new Event('input', { bubbles: true }));
                passInput.dispatchEvent(new Event('input', { bubbles: true }));
                console.log("[HARE AUTOFILL] Champs pré-remplis avec succès.");
            }
        }
    };
})();

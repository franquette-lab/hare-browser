// nanobrowser/injector.js
(function() {
    window.NanobrowserExecutor = {
        clickElement(selector) {
            const el = document.querySelector(selector);
            if (el) {
                el.click();
                return "Success";
            }
            return "Element not found";
        },
        
        getPageContent() {
            return {
                text: document.body.innerText || "",
                url: window.location.href || "",
                title: document.title || ""
            };
        }
    };
})();



// nanobrowser/injector.js -> Mettre à jour le script autonome
(function() {
    window.NanobrowserExecutor = {
        clickElement(selector) {
            const el = document.querySelector(selector);
            if (el) { el.click(); return "Success"; }
            return "Element not found";
        },
        
        getPageContent() {
            return {
                text: document.body.innerText || "",
                url: window.location.href || "",
                title: document.title || ""
            };
        },

        // NOUVEAU : Remplissage automatique des identifiants
        autofillCredentials(username, password) {
            // Recherche des champs de type password courants
            const passwordInput = document.querySelector('input[type="password"]');
            if (!passwordInput) return "No password field found";

            // Remonte le DOM pour trouver l'input texte ou e-mail le plus proche (l'identifiant)
            const form = passwordInput.closest('form') || document.body;
            const usernameInput = form.querySelector('input[type="text"], input[type="email"], input:not([type])');

            if (usernameInput) {
                usernameInput.value = username;
                usernameInput.dispatchEvent(new Event('input', { bubbles: true }));
                usernameInput.dispatchEvent(new Event('change', { bubbles: true }));
            }

            passwordInput.value = password;
            passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
            passwordInput.dispatchEvent(new Event('change', { bubbles: true }));

            return "Autofill Success";
        }
    };
})();


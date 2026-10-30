/**
 * -----------------------------------------------------------------
 * EXECUTEUR NANOBROWSER - INJECTEUR SECURISÉ DE FORMULAIRES (RAG)
 * -----------------------------------------------------------------
 */
(function () {


console.log("[PWD] Formulaire détecté");
console.log("[PWD] Soumission détectée");



    // Évite les injections multiples ou l'écrasement par des scripts malveillants de la page
    if (window.NanobrowserExecutor) return;
            // Fonction centralisée d'envoi vers le Preload (Durcie contre les Race Conditions)
            const triggerVaultSave = (user, pass) => {
                if (user && pass && user.length > 0 && pass.length > 0) {
                    console.log("[PWD-INJECTOR] Déclenchement du CustomEvent DOM pour la soumission...");
                    
                    // ✨ CORRECTIF ULTIME : Au lieu d'appeler window.tileNavigation (qui peut être indisponible),
                    // on lève un événement DOM natif que le Preload interceptera de manière transparente.
                    const submitEvent = new CustomEvent('nanobrowser-form-submitted', {
                        detail: {
                            pageUrl: window.location.href,
                            username: user,
                            password: pass
                        }
                    });
                    window.dispatchEvent(submitEvent);
                }
            };


    const Executor = {
        /**
         * Vérifie si un élément est authentique, visible à l'écran et exploitable par l'utilisateur.
         * Bloque les formulaires fantômes invisibles utilisés pour l'extraction de données.
         */
        isValidInputElement(el) {
            if (!el) return false;
            
            // Protection contre l'usurpation de type d'élément (Element Spoofing)
            if (el.tagName !== 'INPUT') return false;

            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            
            // L'élément doit avoir une existence géométrique réelle et ne pas être masqué par CSS
            const isVisible = rect.width > 0 && 
                              rect.height > 0 && 
                              style.display !== 'none' && 
                              style.visibility !== 'hidden' && 
                              style.opacity !== '0';

            if (!isVisible) return false;

            // L'élément doit être connecté au nœud racine réel du DOM principal
            return el.isConnected;
        },

        /**
         * Scane le document à la recherche d'un formulaire de connexion légitime.
         */
        hasLoginForm() {
            const inputs = document.getElementsByTagName('input');
            let hasPasswordField = false;
            let hasTextField = false;

            for (let i = 0; i < inputs.length; i++) {
                const input = inputs[i];
                if (!this.isValidInputElement(input)) continue;

                const type = (input.getAttribute('type') || '').toLowerCase();
                
                if (type === 'password') {
                    hasPasswordField = true;
                } else if (type === 'text' || type === 'email' || type === 'tel') {
                    hasTextField = true;
                }

                if (hasPasswordField && hasTextField) return true;
            }
            return false;
        },

        /**
         * Injecte de manière sécurisée les identifiants décidés par l'utilisateur.
         * Ne s'appuie pas sur des sélecteurs globaux altérables par la page.
         */
        autofillCredentials(username, password) {
            const inputs = document.getElementsByTagName('input');
            let passwordInput = null;
            let usernameInput = null;

            // 1. Recherche isolée et vérification d'intégrité des structures d'accueil
            for (let i = 0; i < inputs.length; i++) {
                const input = inputs[i];
                if (!this.isValidInputElement(input)) continue;

                const type = (input.getAttribute('type') || '').toLowerCase();

                if (type === 'password' && !passwordInput) {
                    passwordInput = input;
                } else if ((type === 'text' || type === 'email') && !usernameInput) {
                    // Analyse optionnelle pour cibler le champ d'identifiant le plus proche
                    const name = (input.getAttribute('name') || '').toLowerCase();
                    const id = (input.getAttribute('id') || '').toLowerCase();
                    if (/user|login|email|auth|pseudo/i.test(name) || /user|login|email|auth|pseudo/i.test(id)) {
                        usernameInput = input;
                    }
                }
            }

            // Fallback si aucun champ identifiant textuel n'a de nom explicite
            if (!usernameInput && passwordInput) {
                for (let i = 0; i < inputs.length; i++) {
                    const input = inputs[i];
                    if (!this.isValidInputElement(input)) continue;
                    const type = (input.getAttribute('type') || '').toLowerCase();
                    if (type === 'text' || type === 'email') {
                        usernameInput = input;
                        break;
                    }
                }
            }

            // 2. Remplissage et déclenchement des événements d'entrée natifs
            if (usernameInput && passwordInput) {
                usernameInput.value = username;
                passwordInput.value = password;

                // Forcer les frameworks JS (React, Angular, Vue) à valider le changement d'état interne
                const events = ['input', 'change'];
                events.forEach(eventName => {
                    usernameInput.dispatchEvent(new Event(eventName, { bubbles: true }));
                    passwordInput.dispatchEvent(new Event(eventName, { bubbles: true }));
                });
                return true;
            }
            return false;
        },

        /**
         * Capture la soumission légitime pour notifier l'application de sauvegarder l'entrée.
         * Version hybride : écoute le submit standard ET le clic JavaScript/Framework sur le bouton.
         */
        /**
         * Capture la soumission légitime pour notifier l'application de sauvegarder l'entrée.
         * Version hybride : écoute le submit standard, le clic ET la validation par touche Entrée.
         */
        setupSubmitInterception() {
            let lastTypedUsername = '';
            let lastTypedPassword = '';

            // 1. Capture en temps réel des saisies utilisateur
            document.addEventListener('input', (event) => {
                const input = event.target;
                if (!input || input.tagName !== 'INPUT') return;

                const type = (input.getAttribute('type') || '').toLowerCase();

                if (type === 'password') {
                    lastTypedPassword = input.value;
                } else if (type === 'text' || type === 'email') {
                    lastTypedUsername = input.value.trim();
                }
            }, { capture: true, passive: true });

            // Fonction d'envoi vers le Preload
            const triggerVaultSave = (user, pass) => {
                if (user && pass && user.length > 0 && pass.length > 0) {
                    if (window.tileNavigation && typeof window.tileNavigation.reportFormSubmitted === 'function') {
                        window.tileNavigation.reportFormSubmitted({
                            pageUrl: window.location.href, // Envoyé pour la validation d'origine
                            username: user,
                            password: pass
                        });
                    }
                }
            };

            // 2. Interception sur le clic du bouton de connexion
            document.addEventListener('click', (event) => {
                const target = event.target;
                if (!target) return;

                const isLoginButton = target.tagName === 'BUTTON' || 
                                    (target.tagName === 'INPUT' && (target.getAttribute('type') || '').toLowerCase() === 'submit') ||
                                    /login|connexion|submit|entrer|sign-in/i.test(target.className || '') ||
                                    /login|connexion|submit|entrer|sign-in/i.test(target.id || '');

                if (isLoginButton) {
                    // On n'envoie les données que si un bouton de validation a été pressé
                    triggerVaultSave(lastTypedUsername, lastTypedPassword);
                }
            }, { capture: true, passive: true });


            // ✨ CORRECTIF TOUCHE ENTRÉE : Capture la validation au clavier avant la redirection
            document.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    const target = event.target;
                    if (target && target.tagName === 'INPUT') {
                        setTimeout(() => {
                            if (lastTypedUsername.length > 0 && lastTypedPassword.length > 0) {
                                triggerVaultSave(lastTypedUsername, lastTypedPassword);
                            }
                        }, 60);
                    }
                }
            }, { capture: true, passive: true });

            // 3. Maintien du submit standard (Formulaires classiques)
            document.addEventListener('submit', (event) => {
                const form = event.target;
                if (!form || form.tagName !== 'FORM') return;

                const inputs = form.getElementsByTagName('input');
                let username = '';
                let password = '';

                for (let i = 0; i < inputs.length; i++) {
                    const input = inputs[i];
                    const type = (input.getAttribute('type') || '').toLowerCase();

                    if (type === 'password') {
                        password = input.value;
                    } else if (type === 'text' || type === 'email') {
                        if (input.value.trim().length > 0 && !username) {
                            username = input.value.trim();
                        }
                    }
                }

                const finalUser = username || lastTypedUsername;
                const finalPass = password || lastTypedPassword;

                if (finalUser.length > 0 && finalPass.length > 0) {
                    triggerVaultSave(finalUser, finalPass);
                }
            }, { capture: true, passive: true });

            console.log("[PWD] setupSubmitInterception installé avec support clavier");
        }
    };

console.log("[PWD] setupSubmitInterception exécuté");

    // Gel de l'objet pour empêcher sa modification malveillante par des scripts s'exécutant sur la page web
    Object.freeze(Executor);
    window.NanobrowserExecutor = Executor;

    // Lancement de l'écoute des soumissions de formulaires
// =====================================================================
// ✨ CONFIGURATION ET AMORÇAGE : ORDRE GÉOMÉTRIQUE SÉCURISÉ RECONSTRUIT
// =====================================================================

    // 1. D'abord, on installe les écouteurs d'événements sur le DOM (click, submit, keydown)
    // Cela permet d'initialiser les variables locales isolées 'lastTypedUsername' et 'lastTypedPassword'
    Executor.setupSubmitInterception();
    console.log("[PWD-INJECTOR] Écouteurs d'interception installés avec succès.");

    // 2. Ensuite, SEULEMENT APRÈS, on gèle l'objet pour la sécurité applicative
    // Évite les attaques par pollution de prototype ou modification par des scripts tiers malveillants
    Object.freeze(Executor);
    window.NanobrowserExecutor = Executor;

    // 3. Enfin, on lève l'alerte immédiate si un formulaire pré-rempli attend déjà
    if (Executor.hasLoginForm()) {
        if (window.tileNavigation && typeof window.tileNavigation.reportFormSubmitted === 'function') {
            ipcRenderer.send('login-form-detected');
        } else {
            window.dispatchEvent(new Event('nanobrowser-login-detected'));
        }
    }

    
})();
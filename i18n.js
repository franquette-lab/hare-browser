(function (root, factory) {
    const api = factory();
    if (typeof module !== "undefined" && module.exports) module.exports = api;
    if (root) root.HareI18n = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
    // Keep message IDs stable; add another catalog here when introducing a language.
    const catalogs = {
        fr: {
            "app.settings": "Paramètres (Ctrl+,)",
            "app.settings.title": "Paramètres de Hare Browser",
            "app.settings.language": "● Langue de l’interface",
            "app.settings.language.help": "Le changement est appliqué immédiatement et conservé pour les prochains démarrages.",
            "app.settings.language.fr": "Français",
            "app.settings.language.en": "English",
            "settings.interface.title": "● Interface",
            "settings.mainToolbar.visible": "Afficher la barre de menu principale",
            "app.settings.autoSleep": "● Mise en veille automatique",
            "app.settings.autoSleep.help": "Choisissez après combien de temps d’inactivité les tuiles sont mises en veille.",
            "settings.favorites.title": "● Favoris",
            "settings.favorites.visible": "Afficher les favoris",
            "settings.floatingNavigation.title": "● Barre de navigation flottante",
            "settings.floatingNavigation": "Afficher la barre de navigation flottante",
            "settings.floatingNavigation.description": "Contrôle l’affichage global ; les préférences propres à chaque tuile sont conservées.",
            "settings.floatingNavigation.opacity": "Transparence de la barre flottante",
            "settings.floatingNavigation.opacity.reset": "Réinitialiser",
            "app.settings.autoSleep.delay": "Délai avant mise en veille",
            "app.settings.autoSleep.saved": "Délai de mise en veille enregistré.",
            "app.settings.autoSleep.delay.1": "Immédiate",
            "app.settings.autoSleep.delay.5": "5 minutes",
            "app.settings.autoSleep.delay.10": "10 minutes",
            "app.settings.autoSleep.delay.15": "15 minutes",
            "app.settings.autoSleep.delay.30": "30 minutes",
            "app.settings.autoSleep.delay.45": "45 minutes",
            "app.settings.autoSleep.delay.60": "1 heure",
            "app.settings.autoSleep.delay.120": "2 heures",
            "app.settings.autoSleep.delay.0": "Jamais",
            "app.settings.close": "Fermer",
            "app.settings.saved": "Langue mise à jour.",
            "toolbar.back": "Revenir (Alt+Flèche gauche)",
            "toolbar.forward": "Avancer (Alt+Flèche droite)",
            "toolbar.home": "Accueil",
            "toolbar.refresh": "Actualiser (Ctrl+R ou F5)",
            "tileNavigation.address": "Adresse",
            "tileNavigation.hide": "Masquer la navigation flottante",
            "tileNavigation.drag": "Glisser pour déplacer",
            "tileNavigation.resize": "Redimensionner",
            "toolbar.darkMode": "Activer le mode sombre",
            "toolbar.history": "Historique (Ctrl+H)",
            "toolbar.downloads": "Téléchargements (Ctrl+J)",
            "toolbar.reader": "Mode lecture : affiche la page sans distractions",
            "toolbar.passwords": "Gestionnaire de mots de passe",
            "toolbar.saveLayout": "Sauver la configuration des panneaux (Ctrl+S)",
            "toolbar.loadLayout": "Charger une configuration des panneaux (Ctrl+O)",
            "toolbar.print": "Imprimer le panneau actif (Ctrl+P)",
            "toolbar.private": "Ouvrir une tuile privée à droite (Ctrl+Shift+N)",
            "toolbar.container": "Scinder dans un conteneur isolé (comptes multiples)",
            "toolbar.equalize": "Égaliser les dimensions des tuiles (Ctrl+Shift+R)",

            "toolbar.autoSleep.enabled": "Veille automatique activée",
            "toolbar.autoSleep.disabled": "Veille automatique désactivée",

            "toolbar.duplicate": "Dupliquer cette tuile (Ctrl+Shift+D)",
            "toolbar.splitRight": "Scinder à droite (Ctrl+T)",
            "toolbar.splitDown": "Scinder vers le bas (Ctrl+Maj+H)",
            "toolbar.ai": "Demander à l’IA Ollama (Ctrl+Shift+A)",
            "toolbar.help": "Aide de Hare Browser (F1 / Alt+Home)",
            "toolbar.undo": "Rouvrir le dernier panneau fermé (Ctrl+Z)",
            "toolbar.close": "Fermer le panneau actif (Ctrl+W)",
            "toolbar.fullscreen": "Activer le plein écran (F11)",
            "toolbar.clearBookmarks": "Effacer",
            "bookmarks.closed": "Favoris fermés",
            "bookmarks.restore": "Restaurer",
            "main.view": "Affichage",
            "main.restoreBookmarks": "Afficher les favoris",
            "toolbar.resetWorkspace": "Réinitialiser l'espace de travail (Ctrl+Shift+Home)",
            "find.label": "Rechercher dans la page",
            "find.placeholder": "Rechercher dans cette tuile",
            "find.previous": "Résultat précédent (Maj+Entrée)",
            "find.next": "Résultat suivant (Entrée)",
            "find.close": "Fermer (Échap)",
            "history.title": "Historique de navigation",
            "history.heading": "🕒 Historique de navigation",
            "history.clear": "Effacer tout",
            "history.empty": "Aucun historique disponible.",
            "history.delete": "Supprimer cet élément",
            "passwords.title": "🔑 Mots de passe enregistrés",
            "passwords.windowTitle": "🔑 Gestionnaire de mots de passe sécurisés",
            "passwords.site": "Site web (ex: github.com)",
            "passwords.username": "Identifiant / Adresse e-mail",
            "passwords.password": "Mot de passe secret",
            "passwords.save": "Enregistrer le compte",
            "passwords.empty": "Aucun mot de passe enregistré.",
            "passwords.delete": "Supprimer",
            "passwordPrompt.title": "Enregistrer le mot de passe ?",
            "passwordPrompt.message": "Enregistrer les identifiants de {site} pour {username} ?",
            "passwordPrompt.updateTitle": "Mettre à jour le mot de passe ?",
            "passwordPrompt.updateMessage": "Mettre à jour le mot de passe de {username} sur {site} ?",
            "passwordPrompt.save": "Enregistrer",
            "passwordPrompt.update": "Mettre à jour",
            "passwordPrompt.later": "Plus tard",
            "passwordPrompt.never": "Ne jamais pour ce site",
            "passwordPrompt.storageUnavailableTitle": "Stockage sécurisé indisponible",
            "passwordPrompt.storageUnavailable": "Le mot de passe n’a pas été enregistré car le coffre-fort sécurisé du système est indisponible.",
            "passwordPrompt.legacyMigrationBlockedTitle": "Migration du coffre-fort requise",
            "passwordPrompt.legacyMigrationBlocked": "D’anciens mots de passe sont encore en clair. Déverrouillez le coffre-fort sécurisé du système puis relancez Hare Browser pour les migrer. L’application va se fermer afin de ne pas utiliser ces identifiants en clair.",
            "passwordPrompt.legacyMigrationBlockedButton": "Fermer",
            "passwordPrompt.autofillTitle": "Utiliser un mot de passe enregistré ?",
            "passwordPrompt.autofillMessage": "Des identifiants enregistrés sont disponibles pour {site}.",
            "passwordPrompt.autofillDetail": "Choisissez un compte pour remplir le formulaire de connexion.",
            "passwordPrompt.unknownUsername": "Compte sans nom d’utilisateur",
            "downloads.title": "📥 Téléchargements",
            "downloads.windowTitle": "Téléchargements",
            "downloads.clear": "Effacer la liste",
            "downloads.empty": "Aucun téléchargement.",
            "downloads.cancel": "Annuler",
            "downloads.openFolder": "Ouvrir le dossier",
            "downloads.progress": "En cours — {percent}",
            "downloads.notFound": "Fichier introuvable (déplacé ou supprimé)",
            "downloads.cancelled": "Annulé",
            "downloads.interrupted": "Interrompu",
            "ai.title": "Assistant IA",
            "ai.ready": "✨ Assistant IA local prêt. Posez-moi une question sur vos tuiles ou demandez un résumé adaptatif.",
            "ai.loading": "⏳ L’IA analyse votre question et prépare une réponse...",
            "ai.compare": "Comparer les tuiles visibles",
            "ai.full": "Mode complet (Lent)",
            "ai.placeholder": "Posez une question sur cette page...",
            "ai.send": "Envoyer",
            "ai.analyzeCompare": "⏳ L’IA analyse les tuiles visibles pour préparer la comparaison...",
            "ai.analyzePage": "⏳ L’IA analyse le contenu de la tuile active...",
            "ai.analyzeKeywords": "⏳ L’IA analyse le contenu de la tuile active pour en extraire les mots-clés...",
            "ai.noPanel": "⚠️ Veuillez d’abord cliquer sur une tuile active pour l’analyser.",
            "ai.unreachable": "❌ Impossible de joindre l’instance Ollama locale. Vérifiez qu’Ollama est démarré sur le port 11434.",
            "ai.empty": "❌ L’IA a renvoyé une réponse vide.",
            "ai.actionImpossible": "⚠️ Action impossible",
            "ai.activateTile": "Veuillez d’abord activer une tuile web avant de lancer l’analyse.",
            "ai.ask": "Poser une question",
            "ai.stop": "🔴 Stop",
            "ai.summary": "Résumer",
            "ai.clear": "Effacer",
            "ai.close": "Fermer l’assistant IA",
            "ai.compareButton": "Comparer les tuiles",
            "ai.fullMode": "Mode complet (plus lent, plus précis)",
            "network.error.title": "Impossible d’accéder au site",
            "network.error.description": "Une erreur réseau est survenue ({error}). Vérifiez votre connexion Internet ou l’adresse saisie.",
            "network.error.address": "Adresse ciblée :",
            "network.error.retry": "Réessayer",
            "sleep.title": "Cette tuile est en veille",
            "sleep.body": "Cliquez ici pour recharger la page",
            "private.title": "Vous êtes en navigation privée",
            "private.body": "Désormais, les pages que vous consultez dans cette tuile ne seront pas mémorisées dans l’historique et vos cookies seront détruits à la fermeture du panneau.",
            "private.hidden": "🔒 Ce qui est masqué",
            "private.visible": "⚠️ Visible malgré tout",
            "private.search": "Ouvrir le moteur de recherche privé",
            "welcome.subtitle": "Mosaïque • Recherche • IA locale • Confidentialité",
            "welcome.close": "❌ Fermer la fenêtre",
            "welcome.history": "📜 Historique",
            "home.subtitle": "Votre espace de navigation privé",
            "home.search": "Rechercher avec Hare Browser...",
            "home.privateSearchToast.title": "Recherche privée ouverte",
            "home.privateSearchToast.message": "Propulsé par SearXNG. Recherchez sur le Web sans profilage publicitaire ni suivi.",
            "home.privateSearchToast.close": "Fermer la notification",
            "help.title": "Centre d’aide",
            "main.navigation": "Navigation",
            "main.saveLayout": "Sauvegarder la configuration des panneaux",
            "main.equalize": "Réinitialiser la mosaïque à tailles égales",
            "main.aiSidebar": "Afficher / Masquer le volet de l’assistant IA",
            "main.exitZoom": "Quitter le mode agrandi",
            "main.loadLayout": "Charger une configuration de panneaux",
            "main.splitVertical": "Scinder verticalement",
            "main.splitHorizontal": "Scinder horizontalement",
            "main.closeTile": "Fermer la tuile active",
            "main.maximizeTile": "Maximiser / Restaurer la tuile active",
            "main.undo": "Annuler la fermeture",
            "main.previous": "Page précédente",
            "main.next": "Page suivante",
            "main.find": "Rechercher dans la page",
            "main.focusAddress": "Cibler la barre d’adresse",
            "main.nextTile": "Tuile suivante",
            "main.previousTile": "Tuile précédente",
            "main.fullscreen": "Basculer le plein écran global",
            "main.quit": "Quitter l’application",
            "main.bookmarks": "Masquer/Afficher la barre de favoris",
            "main.showHistory": "Afficher l’historique",
            "main.showDownloads": "Afficher les téléchargements",
            "main.duplicate": "Dupliquer la tuile active",
            "main.private": "Nouvelle tuile privée",
            "main.print": "Imprimer la tuile active",
            "main.refresh": "Actualiser la page (F5)",
            "dialog.ok": "OK",
            "dialog.cancel": "Annuler",
            "dialog.confirm": "Confirmation",
            "dialog.quit": "Oui, quitter",
            "dialog.installAi.title": "Assistant IA",
            "dialog.installAi.message": "Cette fonctionnalité nécessite l’assistant IA local.",
            "dialog.install": "Installer",
            "dialog.later": "Plus tard",
            "dialog.downloadModel.title": "Téléchargement du modèle IA",
            "dialog.downloadModel.message": "Le modèle « {model} » n’est pas installé.",
            "dialog.downloadModel.detail": "Voulez-vous le télécharger automatiquement maintenant ?",
            "dialog.download": "Télécharger",
            "dialog.security": "Alerte de sécurité",
            "dialog.runFile": "Exécuter le fichier",
            "dialog.quitMessage": "Êtes-vous sûr de vouloir fermer {app} ?",
            "dialog.quitDetail": "Choisissez si la disposition actuelle doit être conservée pour le prochain démarrage.",
            "dialog.quitSaveLayout": "Sauvegarder automatiquement la disposition pour la prochaine ouverture",
            "dialog.loadError": "Erreur de chargement",
            "dialog.corruptFile": "Le fichier sélectionné est corrompu ou malformé.",
            "dialog.resetWorkspace.title": "Réinitialisation",
            "dialog.resetWorkspace.message": "Réinitialiser toutes les tuiles et revenir à la configuration par défaut ?",
            "common.reset": "Réinitialiser",
            "common.cancel": "Annuler",

            "context.edit": "✏️ Édition",
            "context.selectAll": "Sélectionner tout",
            "context.splitVertical": "✂️ Scinder verticalement (Ctrl+T)",
            "context.splitHorizontal": "⚍ Scinder horizontalement (Ctrl+Maj+H)",
            "context.privateSplit": "🕵️ Scinder en navigation privée (Ctrl+Shift+N)",
            "context.publicTile": "🕵️ Ouvrir une tuile publique classique",
            "context.duplicate": "📋 Dupliquer cette tuile (Ctrl+Shift+D)",
            "context.ai": "✨ Actions IA (Assistant)",
            "context.summarize": "📝 Résumer cette tuile web",
            "context.keywords": "🔍 Analyser les mots-clés de la page",
            "context.panel": "📌 Gestion du panneau",
            "context.displayOptions": "Options d'affichage",
            "context.floatingNavigation.show": "  Barre de navigation flottante",
            "context.mainToolbar.show": "  Barre de menu principale",
            "context.floatingNavigation.disabledGlobally": "Désactivée dans les paramètres globaux",
            "context.reader": "👓 Mode lecture",
            "context.print": "🖨️ Imprimer le contenu de la page (Ctrl+P)",
            "context.close": "❌ Fermer cette tuile (Ctrl+W)",

            "menu.saveLayout": "Sauvegarder l'agencement",
            "menu.switchLeft": "Intervertir avec la tuile à gauche",
            "menu.switchRight": "Intervertir avec la tuile à droite",
            "menu.switchUp": "Intervertir avec la tuile au-dessus",
            "menu.switchDown": "Intervertir avec la tuile en dessous",
            "menu.sleepOn": "⏸ Veille automatique activée (cliquer pour désactiver)",
            "menu.sleepOff": "💤 Veille automatique désactivée (cliquer pour activer)",
            "menu.bookmarks": "Masquer/Afficher la barre de favoris",
            "menu.autoSleepOn": "Activer la veille automatique",
            "menu.autoSleepOff": "Désactiver la veille automatique",

            "context.cut": "Couper",
            "context.copy": "Copier",
            "context.paste": "Coller",
            "context.delete": "Supprimer",
            "context.selectAllNative": "Tout sélectionner",
            "context.editNative": "Édition",
            "context.cutNative": "   ✂️ Couper",
            "context.copyNative": "   📋 Copier",
            "context.pasteNative": "   📌 Coller",
            "context.deleteNative": "   🗑️ Supprimer",
            "context.reenableBlocker": "Réactiver le bloqueur sur {host}",
            "context.disableBlocker": "Désactiver le bloqueur sur {host}",
            "context.openLinkIn": "📂 Ouvrir le lien dans...",
            "context.openLinkCurrentTile": "Ouvrir dans cette tuile",
            "context.openLinkSplitRight": "Scinder à droite",
            "context.openLinkSplitBottom": "Scinder vers le bas",
            "context.openLinkNewWindow": "Ouvrir dans une nouvelle fenêtre",
            "context.containers": "🗂️ Scinder dans un conteneur isolé (comptes multiples)",

            "container.personal": "Personnel",
            "container.work": "Travail",
            "container.account2": "Compte 2",
            "container.account3": "Compte 3",

            "dialog.account.title": "Choisir un compte",
            "dialog.account.message": "Plusieurs identifiants sont enregistrés pour {hostname}.",
            "dialog.account.detail": "Sélectionnez le compte à remplir dans le formulaire.",
            "dialog.downloadComplete": "Téléchargement terminé : {filename}",
            "dialog.configFiles": "Fichiers de configuration (*.json)",

            "panel.noActive": "Aucun panneau actif",
            "panel.notFound": "Tuile introuvable.",

            "main.menuEqualize": "Réinitialiser la mosaïque à tailles égales",
            "main.menuAi": "Afficher / Masquer le volet de l’assistant IA",
            "main.menuSplit": "Scinder verticalement",
            "main.menuHorizontal": "Scinder horizontalement",
            "main.menuClose": "Fermer la tuile active",
            "main.menuTileMax": "Maximiser / Restaurer la tuile active",
            "main.menuBack": "Page précédente",
            "main.menuForward": "Page suivante",
            "main.menuFind": "Rechercher dans la page",
            "main.menuAddress": "Cibler la barre d’adresse",
            "main.menuNextTile": "Tuile suivante",
            "main.menuPrevTile": "Tuile précédente",
            "main.menuFullScreen": "Basculer le plein écran global",
            "main.menuQuit": "Quitter l’application",
            "main.menuHistory": "Afficher l’historique",
            "main.menuDownloads": "Afficher les téléchargements",
            "main.menuDuplicate": "Dupliquer la tuile active",
            "main.menuPrivate": "Nouvelle tuile privée",
            "main.menuPrint": "Imprimer la tuile active",
            "main.menuRefresh": "Actualiser la page (F5)",
            "main.menuRefreshCtrl": "Actualiser la page (Ctrl+R)",
            "main.menuSwitchLeft": "Intervertir avec la tuile à gauche",
            "main.menuSwitchRight": "Intervertir avec la tuile à droite",
            "main.menuSwitchUp": "Intervertir avec la tuile au-dessus",
            "main.menuSwitchDown": "Intervertir avec la tuile en dessous",

            "welcome.title": "Bienvenue",
            "welcome.tileNav": "🧩 Navigation mosaïque",
            "welcome.tileNavText": "Naviguez sur plusieurs sites simultanément grâce aux panneaux redimensionnables.",
            "welcome.adblock": "🚫 Bloqueur intégré",
            "welcome.adblockText": "Publicités et trackers masqués par défaut pour accélérer le chargement.",
            "welcome.search": "🔍 Recherche privée",
            "welcome.searchText": "Recherchez avec SearXNG, un métamoteur open source et respectueux de la vie privée.",
            "welcome.localAi": "✨ IA locale",
            "welcome.localAiText": "Une IA locale et sans cloud pour plus de confidentialité et d'écologie.",
            "welcome.privacy": "🔒 Confidentialité",
            "welcome.privacyText": "Une IA locale et sans cloud distant pour plus de confidentialité et d'écologie.",
            "welcome.themes": "🌗 Clair / Sombre",
            "welcome.themesText": "Basculez instantanément entre les modes clair et sombre selon vos préférences.",
            "welcome.history": "📜 Historique",
            "welcome.historyText": "Retrouvez facilement les pages récemment visitées depuis l’historique intégré.",
            "welcome.productivity": "⚡ Productivité, espaces",
            "welcome.productivityText": "Scindez vos panneaux, pilotez au clavier et sauvegardez vos dispositions.",

            "home.featureSpeed": "🐇 Rapidité",
            "home.featurePrivacy": "🔒 Confidentialité",
            "home.featureAi": "✨ IA locale",

            "help.welcome": "Bienvenue dans le centre d’aide officiel de <strong>Hare Browser</strong>. Ce navigateur web combine un environnement de navigation multi-panneaux avancé (mode mosaïque dynamique), un moteur de recherche SearXNG respectueux de la vie privée et un assistant d’intelligence artificielle locale propulsé par Ollama.",
            "help.mac": "🍏 Configuration macOS : Pour les utilisateurs d’Apple Mac, remplacez systématiquement la touche Ctrl par la touche Cmd (Commande) pour l’ensemble des raccourcis ci-dessous.",
            "help.panels": "🧱 Gestion des panneaux & fonctionnement du fractionnement",
            "help.panelsIntro": "Le cœur de Hare Browser repose sur un arbre binaire de division (Split Nodes). Chaque panneau actif peut être subdivisé géométriquement à l’infini pour organiser votre espace de travail sans manipuler des dizaines d’onglets superposés traditionnels.",
            "help.shortcuts": "⌨️ Répertoire Exhaustif des Raccourcis Clavier",
            "help.panelLayout": "🧱 Gestion des Panneaux & Agencement",
            "help.diagramsTitle": "Schémas géométriques de fractionnement des tuiles :",
            "help.splitV.desc": "<strong>1. Scission Verticale Initiale (Ctrl&nbsp;+&nbsp;T) :</strong> Divise l'espace actif en deux colonnes égales et ouvre une nouvelle tuile indépendante sur le flanc droit.",
            "help.diagram.splitV": `    ┌──────────────────────────────────────┐          ┌──────────────────┬──────────────────┐
    │                                      │          │                  │                  │
    │                                      │ Ctrl + T │                  │                  │
    │            PANNEAU INITIAL           │ ───────> │  PANNEAU INITIAL │  NOUVELLE TUILE  │
    │               (Actif)                │          │                  │     (À droite)   │
    │                                      │          │                  │                  │
    └──────────────────────────────────────┘          └──────────────────┴──────────────────┘
`,
            "help.splitH.desc": "<strong>2. Scission Horizontale Subsidiaire (Ctrl + H) :</strong> Sélectionne un panneau spécifique et le fracture en deux rangées horizontales, créant une nouvelle tuile en contrebas.",
            "help.diagram.splitH": `    ┌──────────────────┬───────────────────┐          ┌──────────────────┬──────────────────┐
    │                  │      FOCUS        │          │                  │   TUILE DU HAUT  │
    │                  │     (Actif)       │ Ctrl + H │                  ├──────────────────┤
    │ PANNEAU INITIAL  ├───────────────────┤ ───────> │ PANNEAU INITIAL  │                  │
    │                  │                   │          │                  │  NOUVELLE TUILE  │
    │                  │                   │          │                  │     (En bas)     │
    └──────────────────┴───────────────────┘          └──────────────────┴──────────────────┘
`,
            "help.plus.title": "➕ Scinder un panneau avec le bouton +",
            "help.plus.intro": "Vous pouvez créer rapidement un nouveau panneau sans utiliser le clavier. Cliquez simplement sur le bouton <strong>+</strong> situé à droite de la barre d'adresse du panneau actif.",
            "help.plus.news": "💡 <strong>Nouveauté</strong> : un clic sur le bouton <strong>+</strong> fait désormais apparaître un sous-menu contextuel vous laissant le choix entre <strong>\"Scinder à droite\"</strong> (division verticale) ou <strong>\"Scinder vers le bas\"</strong> (division horizontale).",
            "help.diagram.plus": `        ┌──────────────────────────────┐
        │                          [+] │
        │                              │
        │      PANNEAU ACTIF           │
        │                              │
        │                              │
        └──────────────────────────────┘
                       │
         Clic sur +    │
      ┌────────────────┴────────────────┐
      ▼ (Scinder à droite)              ▼ (Scinder vers le bas)
┌───────────────┬───────────────┐ ┌──────────────────────────────┐
│               │               │ │                              │
│               │ NOUVEAU       │ │        PANNEAU ACTIF         │
│ PANNEAU ACTIF │ PANNEAU       │ │                              │
│               │ (À droite)    │ ├──────────────────────────────┤
│               │               │ │       NOUVEAU PANNEAU        │
└───────────────┴───────────────┘ │          (En bas)            │
                                  └──────────────────────────────┘
`,
            "help.plus.outro": "Le bouton <strong>+</strong> combine à la souris les mêmes actions que les raccourcis clavier <code>Ctrl + T</code> et <code>Ctrl + Shift + H</code>. Cette approche visuelle est idéale pour partitionner à la volée votre espace de travail et configurer votre mosaïque de sites entièrement à la souris.",
            "help.ctx.title": "🖱️ Menu contextuel des panneaux",
            "help.ctx.intro": "Chaque panneau de navigation dispose d'un menu contextuel accessible par <strong>clic droit</strong>. Ce menu regroupe les principales actions de gestion du contenu, les fonctions d'intelligence artificielle et les outils d'agencement de la mosaïque.",
            "help.ctx.tip": "💡 Astuce : un clic droit dans un panneau permet d'accéder rapidement aux commandes les plus courantes sans utiliser les raccourcis clavier.",
            "help.ctx.editTitle": "✏️ Édition",
            "help.ctx.cut": "<strong>Couper</strong> (Ctrl + X)",
            "help.ctx.copy": "<strong>Copier</strong> (Ctrl + C)",
            "help.ctx.paste": "<strong>Coller</strong> (Ctrl + V)",
            "help.ctx.delete": "<strong>Supprimer</strong>",
            "help.ctx.selectAll": "<strong>Sélectionner tout</strong> (Ctrl + A)",
            "help.ctx.aiTitle": "✨ Actions IA (Assistant)",
            "help.ctx.summarize": "<strong>Résumer cette tuile web</strong> : génère un résumé rapide de la page affichée.",
            "help.ctx.keywords": "<strong>Analyser les mots-clés de la page</strong> : extrait les principaux thèmes et mots importants du contenu.",
            "help.ctx.layoutTitle": "🧱 Agencement de la mosaïque",
            "help.ctx.splitV": "<strong>Scinder verticalement</strong> (Ctrl + T) : crée un nouveau panneau à droite.",
            "help.ctx.splitH": "<strong>Scinder horizontalement</strong> (Ctrl + H) : crée un nouveau panneau en dessous.",
            "help.ctx.splitPrivate": "<strong>Scinder en Navigation Privée</strong> (Ctrl + Shift + N) : ouvre un nouveau panneau privé isolé.",
            "help.ctx.splitContainer": "<strong>Scinder dans un conteneur isolé</strong> (🗂️ dans la barre d'outils) : ouvre un nouveau panneau dans un conteneur (Personnel, Travail, Compte 2, Compte 3) pour se connecter à plusieurs comptes simultanément.",
            "help.ctx.duplicate": "<strong>Dupliquer cette tuile</strong> (Ctrl + Shift + D, 📋 dans la barre d'outils, ou clic droit sur la tuile) : ouvre une copie du panneau à sa droite, sur la même adresse. La copie d'une tuile privée reste privée ; celle d'une tuile conteneur est créée dans la session par défaut.",
            "help.ctx.panelTitle": "📌 Gestion du panneau",
            "help.ctx.maximize": "<strong>Maximiser cette tuile</strong> (Ctrl + M) : agrandit temporairement le panneau sélectionné.",
            "help.ctx.print": "<strong>Imprimer le contenu de la page</strong> (Ctrl + P).",
            "help.ctx.close": "<strong>Fermer cette tuile</strong> (Ctrl + W).",
            "help.diagram.menu": `                         │ Clic droit sur un panneau
                         │
                         ▼
        ┌───────────────────────────────┐
        │ ✏️ Édition                    │
        │ ✨ Actions IA                 │
        │ 🧱 Agencement de la mosaïque  │
        │ 📌 Gestion du panneau         │
        └───────────────────────────────┘
`,
            "help.ctx.outro": "Le menu contextuel constitue le point d'accès central à la plupart des fonctionnalités de gestion des panneaux. Il permet notamment de construire rapidement un espace de travail en mosaïque, d'analyser une page avec l'assistant IA et de gérer le contenu affiché sans quitter le panneau actif.",
            "help.th.shortcut": "Raccourci Clavier",
            "help.th.layout": "Action Système & Comportement Géométrique",
            "help.th.swap": "Direction de la Permutation dans la Mosaïque",
            "help.th.zoom": "Effet sur la Zone d'Affichage utile",
            "help.th.focus": "Déplacement du Focus Applicatif",
            "help.th.web": "Action de Navigation Internet & Comportement",
            "help.th.system": "Action Globale de l'Application & Cycle de vie",
            "help.row.splitV": "<strong>Scinder verticalement</strong> — Divise le panneau actif en deux verticalement et ouvre une nouvelle tuile à droite.",
            "help.row.splitH": "<strong>Scinder horizontalement</strong> — Divise le panneau actif en deux horizontalement et ouvre une nouvelle tuile en bas.",
            "help.row.close": "<strong>Fermer la tuile active</strong> — Ferme immédiatement le panneau sur lequel vous vous trouvez et réajuste les ratios des tuiles voisines. Si une seule tuile reste ouverte, ferme l'application.",
            "help.row.undo": "<strong>Annuler la fermeture</strong> — Rouvre instantanément le tout dernier panneau fermé en restaurant son URL et son emplacement exact dans la mosaïque.",
            "help.key.save": "<code>Cmd&nbsp;ou&nbsp;Ctrl&nbsp;+&nbsp;S</code>",
            "help.row.save": "<strong>Sauvegarder l'agencement</strong> — Exporte la structure actuelle de votre mosaïque de tuiles dans un fichier JSON pour la recharger plus tard.",
            "help.key.load": "<code>Cmd&nbsp;ou&nbsp;Ctrl&nbsp;+&nbsp;O</code>",
            "help.row.load": "<strong>Charger un agencement</strong> — Importe un fichier de configuration JSON pour restaurer instantanément un espace de travail complet.",
            "help.key.equalize": "<code>Cmd&nbsp;ou&nbsp;Ctrl&nbsp;+&nbsp;R</code>",
            "help.row.equalize": "<strong>Égaliser la mosaïque</strong> — Réinitialise instantanément l'intégralité de la mosaïque à des tailles égales, peu importe le nombre de tuiles actives, en repositionnant tous les séparateurs au centre.",
            "help.swap.title": "🔄 Réorganisation des Tuiles au Clavier",
            "help.swap.intro": "Permet d'intervertir instantanément l'emplacement physique du panneau actif avec le panneau adjacent dans la direction ciblée, sans utiliser la poignée de glissement à la souris.",
            "help.row.swapLeft": "<strong>Intervertir à gauche</strong> — Échange la position du panneau actif avec la tuile située immédiatement sur sa gauche.",
            "help.row.swapRight": "<strong>Intervertir à droite</strong> — Échange la position du panneau actif avec la tuile située immédiatement sur sa droite.",
            "help.row.swapUp": "<strong>Intervertir au-dessus</strong> — Échange la position du panneau actif avec la tuile située immédiatement au-dessus.",
            "help.row.swapDown": "<strong>Intervertir en dessous</strong> — Échange la position du panneau actif avec la tuile située immédiatement en dessous.",
            "help.zoom.title": "🔍 Mode Agrandi & Zoom Géométrique",
            "help.row.fullscreen": "<strong>Plein écran de l'application</strong> — Masque les bordures, la barre de titre et la barre d'outils. Déplacez la souris tout en haut de l'écran pour afficher temporairement les outils sans quitter le plein écran; ils se replient après quelques instants. Appuyez de nouveau sur F11 pour revenir au mode fenêtre normal.",
            "help.row.maximize": "<strong>Maximiser / Restaurer une tuile</strong> — Alterne entre le mode agrandi pour la tuile active (100 % de l'espace utile de la mosaïque) et le mode mosaïque d'origine. Les autres tuiles sont temporairement masquées mais la fenêtre de l'application reste visible.",
            "help.row.escape": "<strong>Quitter le mode agrandi / Restaurer la tuile</strong> — Raccourci global qui sort de l'affichage plein écran (F11) de l'application, mais qui restaure également la mosaïque d'origine si une tuile était maximisée (Ctrl+M).",
            "help.key.aiToggle": "<code>Cmd&nbsp;ou&nbsp;Ctrl&nbsp;+&nbsp;Shift&nbsp;+&nbsp;A</code>",
            "help.row.aiToggle": "<strong>Masquer/Afficher l'Assistant IA</strong> — Alterne l'affichage du volet latéral de l'Assistant IA et réajuste dynamiquement la géométrie de la mosaïque.",
            "help.focus.title": "🧭 Navigation entre les Tuiles (Focus clavier)",
            "help.row.nextTile": "<strong>Tuile suivante</strong> — Alterne le focus et le liseré bleu vers le panneau suivant (dans le sens des aiguilles d'une montre).",
            "help.row.prevTile": "<strong>Tuile précédente</strong> — Alterne le focus et le liseré bleu vers le panneau précédent (sens inverse des aiguilles d'une montre).",
            "help.web.title": "🌐 Navigation Web (Dans la tuile ayant le focus)",
            "help.web.intro": "Ces commandes s'appliquent directement au contenu internet affiché dans le panneau actif possédant le focus visuel (liseré bleu).",
            "help.row.address": "<strong>Cibler la barre d'adresse</strong> — Donne instantanément le focus au champ de saisie d'URL du panneau actif et sélectionne l'intégralité du texte pour taper une nouvelle adresse.",
            "help.row.back": "<strong>Page précédente</strong> — Recule d'un niveau dans l'historique de navigation de la page web active.",
            "help.row.forward": "<strong>Page suivante</strong> — Avance d'un niveau dans l'historique de navigation de la page web active.",
            "help.key.refresh": "<code>F5</code>&nbsp;&nbsp;ou&nbsp;&nbsp;<code>Ctrl&nbsp;+&nbsp;R</code>",
            "help.row.refresh": "<strong>Actualiser la page</strong> — Recharge le contenu du site internet chargé dans la tuile active.",
            "help.row.print": "<strong>Imprimer la tuile active</strong> — Ouvre la boîte de dialogue d'impression du système d'exploitation pour le document en cours de consultation.",
            "help.key.help": "<code>F1</code>&nbsp;&nbsp;ou&nbsp;&nbsp;<code>Alt&nbsp;+&nbsp;Home</code>",
            "help.row.help": "<strong>Aide</strong> — Charge instantanément ce centre d'aide au sein du panneau actif.",
            "help.sys.title": "❌ Système & Sécurité",
            "help.sys.intro": "Commandes globales affectant l'interface générale de l'application, la gestion des données de navigation et la sécurité du cycle de vie du navigateur.",
            "help.row.private": "<strong>Nouvelle tuile privée</strong> — Crée une scission verticale isolée en mode de navigation privée. Les cookies et le cache sont détruits dès la fermeture de ce panneau.",
            "help.row.downloads": "<strong>Téléchargements</strong> — Ouvre la fenêtre du gestionnaire de téléchargements (bouton 📥 de la barre d'outils).",
            "help.row.duplicate": "<strong>Dupliquer la tuile active</strong> — Ouvre une copie du panneau actif à sa droite, sur la même adresse. La copie d'une tuile privée reste privée.",
            "help.row.bookmarks": "<strong>Masquer/Afficher les favoris</strong> — Alterne l'affichage de la barre de favoris supérieure et réajuste dynamiquement la géométrie de la mosaïque.",
            "help.key.history": "<code>Ctrl&nbsp;+&nbsp;H</code>&nbsp;(global)",
            "help.row.history": "<strong>Afficher l'historique</strong> — Ouvre et bascule le focus vers le volet latéral dédié à l'historique global de navigation.",
            "help.row.settings": "<strong>Paramètres</strong> — Ouvre instantanément la fenêtre des paramètres de l'application, accessible également via le bouton 🛠️ de la barre d'outils.",
            "help.row.quit": "<strong>Quitter l'application</strong> — Interrompt proprement les processus de Hare Browser. Une boîte de dialogue de confirmation de sécurité vous est présentée pour éviter la perte accidentelle de vos tuiles en cours.",
            "help.adv.title": "🏗️ Fonctions Avancées",
            "help.ai.title": "✨ Assistant IA Ollama Local",
            "help.ai.body": "Hare Browser embarque un agent conversationnel autonome connecté à votre instance locale d'Ollama. Il est capable d'analyser le contenu textuel de votre page web active pour générer des résumés concis en trois points clés ou en extraire des mots-clés spécifiques, garantissant une confidentialité totale (aucune donnée n'est transmise à un serveur tiers ou Cloud externe).",
            "help.sec.title": "🕵️ Cyber-Sécurité et Navigation Privée",
            "help.sec.body": "Lorsque vous ouvrez une tuile privée, le navigateur instancie une partition en mémoire pure volatile (session <code>incognito</code> isolée). Lors de la fermeture de cette tuile, un script détruit automatiquement toutes les traces locales résiduelles de manière irréversible : cookies, LocalStorage, bases IndexedDB, session et cache d'historique de rendu HTTP de Chromium.",
            "help.reader.title": "👓 Mode Lecture",
            "help.reader.body": "Le bouton 👓 transforme la page affichée en une vue épurée : seuls le titre, le texte, les images et les tableaux de l'article sont conservés, sans menus, publicités, bandeaux ni commentaires. Il est disponible à trois endroits : dans la barre d'outils (il agit sur la tuile active), dans la barre d'adresse de chaque tuile, et dans le menu contextuel (clic droit, « Mode lecture »).",
            "help.reader.comfort": "<strong>Confort de lecture</strong> : texte centré en police à empattements, adapté au mode clair ou sombre de l'application. Les boutons <strong>A−</strong> / <strong>A+</strong> ajustent la taille du texte.",
            "help.reader.exit": "<strong>Quitter</strong> : cliquez sur ✕ dans la barre du mode lecture, ou sur 👓 à nouveau. La page d'origine n'est pas rechargée : vous retrouvez exactement votre position.",
            "help.reader.limits": "<strong>Limites</strong> : indisponible sur les pages internes ou en veille. Si la page contient trop peu de texte, l'icône affiche brièvement ⚠️.",
            "help.dl.title": "📥 Gestionnaire de Téléchargements",
            "help.dl.body": "Le bouton 📥 de la barre d'outils (ou <code>Ctrl + J</code>) ouvre une fenêtre qui liste vos téléchargements en cours et passés, avec le nom du fichier, la taille et le site d'origine.",
            "help.dl.running": "<strong>En cours</strong> : une barre de progression est affichée et le bouton « Annuler » interrompt le téléchargement.",
            "help.dl.done": "<strong>Terminés</strong> : le bouton « Ouvrir le dossier » affiche le fichier dans l'Explorateur. Si le fichier a été déplacé ou supprimé, la ligne l'indique.",
            "help.dl.list": "<strong>Liste</strong> : ✕ retire une ligne, « Effacer la liste » retire tous les téléchargements terminés (les fichiers ne sont jamais supprimés). L'historique est conservé entre les lancements, sauf pour les tuiles privées : leurs téléchargements ne sont jamais enregistrés sur disque.",
            "help.cont.title": "🗂️ Tuiles Conteneurs (Multi-Comptes)",
            "help.cont.body": "Chaque conteneur dispose de sa propre partition persistante : cookies, LocalStorage et sessions y sont isolés des autres conteneurs et de la session par défaut. Vous pouvez ainsi ouvrir deux tuiles côte à côte et vous connecter à deux comptes Google ou Outlook différents en même temps. Contrairement à la navigation privée, les connexions sont conservées entre les lancements.",
            "help.cont.open": "<strong>Ouverture</strong> : bouton 🗂️ de la barre d'outils, ou clic droit sur une tuile puis « Scinder dans un conteneur isolé (comptes multiples) », puis choix du conteneur.",
            "help.cont.mark": "<strong>Repérage</strong> : l'onglet d'une tuile conteneur est surmonté d'un liseré coloré ; le nom du conteneur s'affiche au survol.",
            "help.cont.limits": "<strong>Limites</strong> : indisponible depuis une tuile privée ou en mode agrandi. « Dupliquer cette tuile » crée la copie dans la session par défaut, pas dans le même conteneur.",
            "help.block.title": "🚫 Bloqueur de Publicités & Trackers Intégré",
            "help.block.body": "Chaque requête réseau émise par une tuile (qu'elle soit publique ou privée) est analysée à la volée par le processus principal de l'application via l'API <code>webRequest</code> d'Electron.",
            "help.block.speed": "<strong>Vitesse accrue</strong> : Les scripts publicitaires lourds et les images intrusives sont annulés <strong>avant</strong> leur téléchargement.",
            "help.block.privacy": "<strong>Respect total de la vie privée</strong> : Bloque nativement les mouchards de suivi comportementaux des régies publicitaires majeures.",
            "help.block.incognito": "<strong>Protection Incognito</strong> : Le filtrage s'applique de manière hermétique sur vos partitions volatiles sans laisser de traces en mémoire.",
            "help.block.disable": "<strong>Désactiver le bloqueur sur un site</strong> : si un site fonctionne mal, cliquez sur l'icône 🛡️ de sa barre d'adresse, ou faites un clic droit sur la tuile puis « Désactiver le bloqueur sur <em>nom-du-site</em> ». La page est rechargée sans filtrage. L'icône devient verte pour indiquer l'exception ; un nouveau clic réactive le bloqueur. Les exceptions sont enregistrées par site et conservées entre les lancements.",
            "help.pwd.title": "🔑 Gestionnaire de Mots de Passe Sécurisé",
            "help.pwd.body": "Vos identifiants et mots de passe enregistrés sont protégés par chiffrement fort. En mode développement ou sur les systèmes cibles compatibles, le navigateur s'appuie sur le module <code>safeStorage</code> pour appliquer un chiffrement asymétrique interne (Alternative Encryption), bloquant toute lecture non autorisée du fichier de stockage par des applications tierces.",
            "help.footer": "Hare Browser • Bâti sur Electron • Moteur IA Ollama • Recherche SearXNG",
            "welcome.footer": "Hare Browser : productif, privé, moderne.",
            "welcome.credits": "Propulsé par SearXNG • Ollama • Electron",
            "welcome.themeButton": "🌗 Thème",
            "home.speed": "🐇 Rapidité",
            "home.privacy": "🔒 Respect vie privée",
            "home.mosaic": "🧩 Navigation mosaïque",
            "home.blocking": "🚫 Blocage actif",
            "home.credits": "Propulsé par SearXNG",
            "home.version": "2026.9.10+ba055b3e0 • un métamoteur respectueux de la vie privée",
            "private.listHistory": "Historique de navigation locale",
            "private.listCookies": "Cookies et données de session",
            "private.listForms": "Saisies dans les formulaires",
            "private.listCache": "Mémoire cache détruite à la fermeture",
            "private.visibleSites": "Les sites web visités eux-mêmes",
            "private.visibleAdmin": "Votre administrateur réseau (école/travail)",
            "private.visibleIsp": "Votre fournisseur d’accès internet",
            "splash.loading": "Initialisation de la mosaïque d’onglets...",
            "splash.title": "Chargement...",
            "reader.unavailable": "Mode lecture indisponible pour cette page.",
            "reader.error": "Impossible d’activer le mode lecture.",
            "reader.title": "Mode lecture",
            "reader.smaller": "Texte plus petit",
            "reader.larger": "Texte plus grand",
            "reader.close": "Retour à la page normale",
            "ollama.notInstalled": "Assistant IA non installé.",
            "ollama.cancelled": "Téléchargement du modèle annulé.",
            "ollama.notRunning": "L’assistant IA est installé mais n’est pas démarré.",
            "ollama.selectTile": "Veuillez saisir une question avant de cliquer sur Poser une question.",
            "ollama.noVisibleText": "Aucune tuile visible ne contient de texte exploitable.",
            "ollama.noPageText": "La tuile active ne contient pas de texte exploitable.",
            "ui.privateLabel": "Navigation privée",
            "ui.searchLabel": "Recherche",
            "ui.searchEngine": "Moteur de recherche Hare Browser",
            "ui.addFavorite": "Ajouter aux favoris",
            "ui.removeFavorite": "Retirer des favoris",
            "ui.splitTile": "Scinder ce panneau",
            "ui.splitRight": "Scinder à droite",
            "ui.splitDown": "Scinder vers le bas",
            "ui.readerTooltip": "Mode lecture (nettoie la page pour lire sans distractions)",
            "ui.zoomDisabled": "(Désactivé en mode Zoom)",
            "ui.readerUnavailable": "Mode lecture indisponible pour cette page.",
            "ui.readerError": "Impossible d’activer le mode lecture.",
            "ui.error": "Erreur",
            "ui.container": "Conteneur : {name}",
            "adblock.reenable": "Réactiver le bloqueur sur {host}",
            "adblock.disable": "Désactiver le bloqueur sur {host}",
            "ai.sidebarPrompt": "Question sur une page ou sur vos tuiles",
            "ai.clearHistory": "Effacer l’historique de l’assistant",
            "ai.compareTooltip": "Comparer le contenu de toutes les tuiles visibles",
            "ai.fullTooltip": "Mode complet : envoie l’intégralité du texte des pages (jusqu’à 20 000 caractères par tuile) au lieu de l’extraction allégée. Plus précis mais plus lent.",
            "bookmarks.clear": "Effacer les favoris",
            "passwords.urlExample": "Ex: google.com",
            "passwords.usernameShort": "Identifiant / E-mail",
            "passwords.passwordShort": "Mot de passe",
            "passwords.saveShort": "Enregistrer",
            "welcome.searchLabel": "🔍 Recherche respectueuse",
            "home.featureSearch": "🔍 Recherche privée",
            "menu.sleepDisabled": "⏸ Désactiver la veille automatique",
            "menu.sleepEnabled": "💤 Activer la veille automatique",
            "main.menuSaveConfig": "Sauvegarder la configuration des panneaux",
            "main.menuLoadConfig": "Charger une configuration de panneaux",
            "main.menuSleepLabel": "Veille automatique",
            "main.menuMosaicEqual": "📐 Égaliser les dimensions des tuiles (Ctrl+Shift+R)",
            "main.menuBookmarkBar": "Masquer/Afficher la barre de favoris",
            "main.menuSaveLayoutTitle": "Sauvegarder la configuration des panneaux",
            "main.menuCloseApp": "Quitter l’application",
            "fullscreen.enter": "Activer le plein écran (F11)",
            "fullscreen.exit": "Quitter le plein écran (F11)",
            "fullscreen.enterLabel": "Activer le plein écran",
            "fullscreen.exitLabel": "Quitter le plein écran",
            "toolbar.lightMode": "Activer le mode clair",
            "panel.noneSelected": "Aucun panneau sélectionné",
            "panel.closeActive": "Fermer le panneau actif",
            "panel.drag": "Glisser pour déplacer",
            "panel.restore": "Restaurer la taille",
            "panel.enlarge": "Agrandir",
            "panel.detach": "Détacher",
            "panel.close": "Fermer",
            "panel.restoreMosaic": "🗗 Restaurer la taille de la mosaïque (Échap)",
            "panel.maximize": "🗖 Maximiser cette tuile (Ctrl+M)",
            "history.confirmClear": "Voulez-vous vraiment effacer tout votre historique ?",
            "ai.summaryActiveTitle": "Résumer la page active",
            "ai.stopGenerationTitle": "Interrompre la génération en cours",
            "ai.availableAfterResponse": "Disponible après la réponse en cours",
            "main.refreshCtrl": "Actualiser la page (Ctrl+R)",
            "menu.itemClearHistory": "Effacer tout votre historique",
            "ai.summaryPrompt": "Fais-moi un résumé concis en trois points clés de cette page.",
            "ai.keywordPrompt": "Extrais les mots-clés et les thèmes principaux de ce texte sous forme de liste.",
            "ai.loadingCompare": "⏳ L’IA analyse les tuiles visibles pour préparer la comparaison...",
            "ai.loadingPage": "⏳ L’IA analyse le contenu de la tuile active...",
            "ai.loadingKeywords": "⏳ L’IA analyse le contenu de la tuile active pour en extraire les mots-clés...",
            "ai.loadingQuestion": "⏳ L’IA analyse votre question et prépare une réponse...",
            "ai.emptyResponse": "❌ L’IA a renvoyé une réponse vide.",
            "ai.ipcError": "❌ Impossible de joindre le pont IPC ({error})",
            "ai.downloadError": "Impossible de télécharger automatiquement le modèle : {error}",
            "ai.ollamaError": "Erreur Ollama ({status}) : {error}",
            "ai.internalError": "Erreur interne : {error}",
            "ai.localUnavailable": "Impossible de joindre l’IA locale : {error}",
            "ai.ollamaChecking": "Vérification d’Ollama sur {url}…",
            "ai.ollamaUnavailable": "Impossible de contacter Ollama sur {url}. Vérifiez qu’Ollama est démarré et qu’un modèle est installé.",
            "ai.ollamaModelMissing": "Ollama répond, mais le modèle {model} est absent.",
            "ai.ollamaModelInstalled": "Ollama répond ; modèle {model} installé. Il sera chargé avant la première question.",
            "ai.ollamaModelLoading": "Chargement du modèle {model} dans Ollama…",
            "ai.ollamaReady": "Ollama prêt — modèle {model} chargé.",
            "ai.modelMissing": "Modèle Ollama introuvable : {model}",
            "ai.inputEmpty": "Veuillez saisir une question avant de valider.",
            "ai.analyzeLabel": "Analyse...",
            "ai.cancelled": "Demande annulée.",
            "bookmarks.empty": "Aucun favori (⭐)",
            "bookmarks.removeOne": "Supprimer ce favori",
            "bookmarks.confirmClear": "Voulez-vous vraiment effacer tous vos favoris ?",
            "reader.enabled": "Mode lecture activé — cliquer pour revenir à la page",
            "reader.disabled": "Mode lecture désactivé — cliquer pour lire sans distractions",
            "reader.notEnoughText": "Pas assez de texte à afficher en mode lecture sur cette page",
            "reader.unavailablePage": "Mode lecture indisponible sur cette page",
            "download.progressTitle": "Téléchargement : {filename} ({percent} %)",
            "ai.loadingSummary": "L’IA analyse le contenu de la tuile active...",
            "ai.loadingComparison": "L’IA analyse les tuiles visibles pour préparer la comparaison...",
            "ai.loadingPrompt": "L’IA analyse votre question et prépare une réponse...",
            "ai.actionUnavailable": "⚠️ Action impossible",
            "ai.activateTileLong": "Veuillez d’abord activer une tuile web avant de lancer l’analyse.",
            "ai.bridgeError": "❌ Impossible de joindre le pont IPC ({error})",
            "ai.autoSummaryPrompt": "Fais-moi un résumé concis des 3 points clés de cet article.",
            "ai.summaryPrompt": "Fais-moi un résumé concis en trois points clés de cette page.",
            "ai.instructions.enter": "Saisissez un texte pour",
            "ai.instructions.click": "Cliquer sur",
            "ai.instructions.analyze": "pour analyser la tuile active.",
            "ai.instructions.use": "Utiliser",
            "ai.instructions.compare": "pour demander une analyse croisée des pages visibles.",
            "sleep.disabled": "Veille automatique désactivée",
            "sleep.enabled": "Veille automatique activée",
            "sleep.enabledDelay": "Veille automatique activée : délai de {duration}",
            "ollama.invalidResponse": "Réponse Ollama invalide.",
            "welcome.tooltip.tutorial": "Cliquez pour lancer le tutoriel vidéo",
            "welcome.tooltip.openHelp": "Cliquez pour ouvrir la page d'aide",
            "welcome.tooltip.openHome": "Cliquez pour ouvrir la page d'accueil",
            "welcome.tooltip.openPrivate": "Cliquez pour ouvrir la navigation privée",
            "welcome.internalPage.error": "Impossible d'ouvrir la page demandée.",
            "welcome.tooltip.ai": "Cliquez pour ouvrir l'assistant IA local",
            "welcome.tooltip.theme": "Cliquez pour basculer entre les modes clair et sombre",
            "welcome.tooltip.history": "Cliquez pour ouvrir la fenêtre d'historique"

        },
        en: {
            "app.settings": "Settings (Ctrl+,)",
            "app.settings.title": "Hare Browser Settings",
            "app.settings.language": "● Interface language",
            "app.settings.language.help": "Changes apply immediately and are saved for your next launch.",
            "app.settings.language.fr": "Français",
            "app.settings.language.en": "English",
            "settings.interface.title": "● Interface",
            "settings.mainToolbar.visible": "Show the main toolbar",
            "app.settings.autoSleep": "● Automatic sleep",
            "app.settings.autoSleep.help": "Choose how long a tile must be inactive before it goes to sleep.",
            "settings.favorites.title": "● Favorites",
            "settings.favorites.visible": "Show favorites",
            "settings.floatingNavigation.title": "● Floating navigation bar",
            "settings.floatingNavigation": "Show the floating navigation bar",
            "settings.floatingNavigation.description": "Controls the app-wide display; each tile’s own preference is preserved.",
            "settings.floatingNavigation.opacity": "Floating navigation bar opacity",
            "settings.floatingNavigation.opacity.reset": "Reset",
            "app.settings.autoSleep.delay": "Sleep after",
            "app.settings.autoSleep.saved": "Automatic sleep delay saved.",
            "app.settings.autoSleep.delay.1": "Now",
            "app.settings.autoSleep.delay.5": "5 minutes",
            "app.settings.autoSleep.delay.10": "10 minutes",
            "app.settings.autoSleep.delay.15": "15 minutes",
            "app.settings.autoSleep.delay.30": "30 minutes",
            "app.settings.autoSleep.delay.45": "45 minutes",
            "app.settings.autoSleep.delay.60": "1 hour",
            "app.settings.autoSleep.delay.120": "2 hours",
            "app.settings.autoSleep.delay.0": "Never",
            "app.settings.close": "Close",
            "app.settings.saved": "Language updated.",
            "toolbar.back": "Back (Alt+Left)",
            "toolbar.forward": "Forward (Alt+Right)",
            "toolbar.home": "Home",
            "toolbar.refresh": "Refresh (Ctrl+R or F5)",
            "tileNavigation.address": "Address",
            "tileNavigation.hide": "Hide floating navigation",
            "tileNavigation.drag": "Drag to move",
            "tileNavigation.resize": "Resize",
            "toolbar.darkMode": "Enable dark mode",
            "toolbar.history": "History (Ctrl+H)",
            "toolbar.downloads": "Downloads (Ctrl+J)",
            "toolbar.reader": "Reader mode: view the page without distractions",
            "toolbar.passwords": "Password manager",
            "toolbar.saveLayout": "Save panel layout (Ctrl+S)",
            "toolbar.loadLayout": "Load panel layout (Ctrl+O)",
            "toolbar.print": "Print active panel (Ctrl+P)",
            "toolbar.private": "Open a private tile to the right (Ctrl+Shift+N)",
            "toolbar.container": "Split into an isolated container (multiple accounts)",
            "toolbar.equalize": "Equalize tile sizes (Ctrl+Shift+R)",

            "toolbar.autoSleep.enabled": "Automatic sleep is on",
            "toolbar.autoSleep.disabled": "Automatic sleep is off",

            "toolbar.duplicate": "Duplicate this tile (Ctrl+Shift+D)",
            "toolbar.splitRight": "Split to the right (Ctrl+T)",
            "toolbar.splitDown": "Split downward (Ctrl+Shift+H)",
            "toolbar.ai": "Ask Ollama AI (Ctrl+Shift+A)",
            "toolbar.help": "Hare Browser help (F1 / Alt+Home)",
            "toolbar.undo": "Reopen the last closed panel (Ctrl+Z)",
            "toolbar.close": "Close the active panel (Ctrl+W)",
            "toolbar.fullscreen": "Enable full screen (F11)",
            "toolbar.clearBookmarks": "Clear",
            "bookmarks.closed": "Bookmarks closed",
            "bookmarks.restore": "Restore",
            "main.view": "View",
            "main.restoreBookmarks": "Show bookmarks",
            "find.label": "Find in page",
            "find.placeholder": "Find in this tile",
            "find.previous": "Previous result (Shift+Enter)",
            "find.next": "Next result (Enter)",
            "find.close": "Close (Esc)",
            "history.title": "Browsing history",
            "history.heading": "🕒 Browsing history",
            "history.clear": "Clear all",
            "history.empty": "No history available.",
            "history.delete": "Delete this item",
            "passwords.title": "🔑 Saved passwords",
            "passwords.windowTitle": "🔑 Secure Password Manager",
            "passwords.site": "Website (e.g. github.com)",
            "passwords.username": "Username / Email address",
            "passwords.password": "Secret password",
            "passwords.save": "Save account",
            "passwords.empty": "No saved passwords.",
            "passwords.delete": "Delete",
            "passwordPrompt.title": "Save password?",
            "passwordPrompt.message": "Save the credentials for {site} with username {username}?",
            "passwordPrompt.updateTitle": "Update saved password?",
            "passwordPrompt.updateMessage": "Update the password for {username} on {site}?",
            "passwordPrompt.save": "Save",
            "passwordPrompt.update": "Update",
            "passwordPrompt.later": "Not now",
            "passwordPrompt.never": "Never for this site",
            "passwordPrompt.storageUnavailableTitle": "Secure storage unavailable",
            "passwordPrompt.storageUnavailable": "The password was not saved because the system credential store is unavailable.",
            "passwordPrompt.legacyMigrationBlockedTitle": "Password vault migration required",
            "passwordPrompt.legacyMigrationBlocked": "Some older passwords are still stored in plain text. Unlock the system credential store and restart Hare Browser to migrate them. The application will close to avoid using those credentials in plain text.",
            "passwordPrompt.legacyMigrationBlockedButton": "Close",
            "passwordPrompt.autofillTitle": "Use a saved password?",
            "passwordPrompt.autofillMessage": "Saved accounts are available for {site}.",
            "passwordPrompt.autofillDetail": "Choose an account to fill the login form.",
            "passwordPrompt.unknownUsername": "Account without a username",
            "downloads.title": "📥 Downloads",
            "downloads.windowTitle": "Downloads",
            "downloads.clear": "Clear list",
            "downloads.empty": "No downloads.",
            "downloads.cancel": "Cancel",
            "downloads.openFolder": "Show in folder",
            "downloads.progress": "In progress — {percent}",
            "downloads.notFound": "File not found (moved or deleted)",
            "downloads.cancelled": "Cancelled",
            "downloads.interrupted": "Interrupted",
            "ai.title": "AI assistant",
            "ai.ready": "✨ Local AI assistant is ready. Ask about your tiles or request a summary.",
            "ai.loading": "⏳ AI is preparing an answer to your question...",
            "ai.compare": "Compare visible tiles",
            "ai.full": "Full mode (slow)",
            "ai.placeholder": "Ask a question about this page...",
            "ai.send": "Send",
            "ai.analyzeCompare": "⏳ AI is analyzing visible tiles for comparison...",
            "ai.analyzePage": "⏳ AI is analyzing the active tile...",
            "ai.analyzeKeywords": "⏳ AI is extracting keywords from the active tile...",
            "ai.noPanel": "⚠️ Select an active tile before analyzing it.",
            "ai.unreachable": "❌ Could not reach the local Ollama instance. Make sure Ollama is running on port 11434.",
            "ai.empty": "❌ The AI returned an empty response.",
            "ai.actionImpossible": "⚠️ Action unavailable",
            "ai.activateTile": "Select a web tile before starting the analysis.",
            "ai.ask": "Ask a question",
            "ai.stop": "🔴 Stop",
            "ai.summary": "Summarize",
            "ai.clear": "Clear",
            "ai.close": "Close AI assistant",
            "ai.compareButton": "Compare tiles",
            "ai.fullMode": "Full mode (slower, more accurate)",
            "network.error.title": "This site can’t be reached",
            "network.error.description": "A network error occurred ({error}). Check your internet connection or the address you entered.",
            "network.error.address": "Address:",
            "network.error.retry": "Try again",
            "sleep.title": "This tile is asleep",
            "sleep.body": "Click here to reload the page",
            "private.title": "You’re browsing privately",
            "private.body": "Pages viewed in this tile won’t be saved to history, and its cookies will be deleted when the panel closes.",
            "private.hidden": "🔒 What is hidden",
            "private.visible": "⚠️ Still visible to",
            "private.search": "Open private search engine",
            "welcome.subtitle": "Mosaic • Search • Local AI • Privacy",
            "welcome.close": "❌ Close window",
            "welcome.history": "📜 History",
            "home.subtitle": "Your private browsing space",
            "home.search": "Search with Hare Browser...",
            "home.privateSearchToast.title": "Private Search Opened",
            "home.privateSearchToast.message": "Powered by SearXNG. Search the web without advertising profiles or tracking.",
            "home.privateSearchToast.close": "Close notification",
            "help.title": "Help Center",
            "main.navigation": "Navigation",
            "main.saveLayout": "Save panel layout",
            "main.equalize": "Reset mosaic to equal sizes",
            "main.aiSidebar": "Show / Hide AI assistant sidebar",
            "main.exitZoom": "Exit enlarged mode",
            "main.loadLayout": "Load panel layout",
            "main.splitVertical": "Split vertically",
            "main.splitHorizontal": "Split horizontally",
            "main.closeTile": "Close active tile",
            "main.maximizeTile": "Maximize / Restore active tile",
            "main.undo": "Undo close",
            "main.previous": "Back",
            "main.next": "Forward",
            "main.find": "Find in page",
            "main.focusAddress": "Focus address bar",
            "main.nextTile": "Next tile",
            "main.previousTile": "Previous tile",
            "main.fullscreen": "Toggle full screen",
            "main.quit": "Quit application",
            "main.bookmarks": "Show/Hide bookmarks bar",
            "main.showHistory": "Show history",
            "main.showDownloads": "Show downloads",
            "main.duplicate": "Duplicate active tile",
            "main.private": "New private tile",
            "main.print": "Print active tile",
            "main.refresh": "Refresh page (F5)",
            "dialog.ok": "OK",
            "dialog.cancel": "Cancel",
            "dialog.confirm": "Confirm",
            "dialog.quit": "Quit",
            "dialog.installAi.title": "AI assistant",
            "dialog.installAi.message": "This feature requires the local AI assistant.",
            "dialog.install": "Install",
            "dialog.later": "Later",
            "dialog.downloadModel.title": "Download AI model",
            "dialog.downloadModel.message": "The model “{model}” is not installed.",
            "dialog.downloadModel.detail": "Would you like to download it now?",
            "dialog.download": "Download",
            "dialog.security": "Security warning",
            "dialog.runFile": "Run file",
            "dialog.quitMessage": "Are you sure you want to close {app}?",
            "dialog.quitDetail": "Choose whether to keep the current layout for the next time you start the application.",
            "dialog.quitSaveLayout": "Automatically save the layout for the next launch",
            "dialog.loadError": "Load error",
            "dialog.corruptFile": "The selected file is corrupted or malformed.",
            
            "dialog.resetWorkspace.title": "Workspace Reset",
            "dialog.resetWorkspace.message": "Reset all tiles and restore the default layout?",
            "common.reset": "Reset",
            "common.cancel": "Cancel",





            "context.edit": "✏️ Edit",
            "context.selectAll": "Select all",
            "context.splitVertical": "✂️ Split vertically (Ctrl+T)",
            "context.splitHorizontal": "⚍ Split horizontally (Ctrl+Shift+H)",
            "context.privateSplit": "🕵️ Split into private browsing (Ctrl+Shift+N)",
            "context.publicTile": "🕵️ Open a regular public tile",
            "context.duplicate": "📋 Duplicate this tile (Ctrl+Shift+D)",
            "context.ai": "✨ AI actions (Assistant)",
            "context.summarize": "📝 Summarize this web tile",
            "context.keywords": "🔍 Analyze page keywords",
            "context.panel": "📌 Panel management",
//          "context.floatingNavigation": "Floating navigation",
            "context.displayOptions": "Display options",
            "context.floatingNavigation.show": "  Floating navigation bar",
            "context.mainToolbar.show": "  Main toolbar",
            "context.floatingNavigation.disabledGlobally": "Disabled in global settings",
            "context.reader": "👓 Reader mode",
            "context.print": "🖨️ Print page content (Ctrl+P)",
            "context.close": "❌ Close this tile (Ctrl+W)",
            "menu.saveLayout": "Save layout",
            "menu.switchLeft": "Swap with tile to the left",
            "menu.switchRight": "Swap with tile to the right",
            "menu.switchUp": "Swap with tile above",
            "menu.switchDown": "Swap with tile below",

            "menu.sleepOn": "Disable automatic sleep",
            "menu.sleepOff": "Enable automatic sleep",
            
            "menu.bookmarks": "Show/Hide bookmarks bar",
            "menu.autoSleepOn": "Enable automatic sleep",
            "menu.autoSleepOff": "Disable automatic sleep",
            "context.cut": "Cut",
            "context.copy": "Copy",
            "context.paste": "Paste",
            "context.delete": "Delete",
            "context.selectAllNative": "Select all",
            "context.editNative": "Edit",
            "context.cutNative": "   ✂️ Cut",
            "context.copyNative": "   📋 Copy",
            "context.pasteNative": "   📌 Paste",
            "context.deleteNative": "   🗑️ Delete",
            "context.reenableBlocker": "Re-enable the blocker on {host}",
            "context.disableBlocker": "Disable the blocker on {host}",
            "context.openLinkIn": "📂 Open link in...",
            "context.openLinkCurrentTile": "Open in this tile",
            "context.openLinkSplitRight": "Split to the right",
            "context.openLinkSplitBottom": "Split downward",
            "context.openLinkNewWindow": "Open in a new window",
            "context.containers": "🗂️ Split into an isolated container (multiple accounts)",
            "container.personal": "Personal",
            "container.work": "Work",
            "container.account2": "Account 2",
            "container.account3": "Account 3",
            "dialog.account.title": "Choose an account",
            "dialog.account.message": "Several credentials are saved for {hostname}.",
            "dialog.account.detail": "Select the account to fill in the form.",
            "dialog.downloadComplete": "Download complete: {filename}",
            "dialog.configFiles": "Configuration files (*.json)",
            "panel.noActive": "No active panel",
            "panel.notFound": "Tile not found.",
            "main.menuEqualize": "Reset mosaic to equal sizes",
            "main.menuAi": "Show / Hide AI assistant sidebar",
            "main.menuSplit": "Split vertically",
            "main.menuHorizontal": "Split horizontally",
            "main.menuClose": "Close active tile",
            "main.menuTileMax": "Maximize / Restore active tile",
            "main.menuBack": "Back",
            "main.menuForward": "Forward",
            "main.menuFind": "Find in page",
            "main.menuAddress": "Focus address bar",
            "main.menuNextTile": "Next tile",
            "main.menuPrevTile": "Previous tile",
            "main.menuFullScreen": "Toggle full screen",
            "main.menuQuit": "Quit application",
            "main.menuHistory": "Show history",
            "main.menuDownloads": "Show downloads",
            "main.menuDuplicate": "Duplicate active tile",
            "main.menuPrivate": "New private tile",
            "main.menuPrint": "Print active tile",
            "main.menuRefresh": "Refresh page (F5)",
            "main.menuRefreshCtrl": "Refresh page (Ctrl+R)",
            "main.menuSwitchLeft": "Swap with tile to the left",
            "main.menuSwitchRight": "Swap with tile to the right",
            "main.menuSwitchUp": "Swap with tile above",
            "main.menuSwitchDown": "Swap with tile below",
            "welcome.title": "Welcome",
            "welcome.tileNav": "🧩 Mosaic browsing",
            "welcome.tileNavText": "Organize browsing into independent, resizable panels to view several sites at once.",
            "welcome.adblock": "🚫 Built-in blocker",
            "welcome.adblockText": "Ads and trackers are blocked by default in public and private tiles to speed up loading.",
            "welcome.search": "🔍 Private search",

            "welcome.searchText": "Search privately and securely with SearXNG, the open-source metasearch engine.",
            
            "welcome.localAi": "✨ Local AI",
            "welcome.localAiText": "A local AI, with no remote cloud, for greater privacy and a lower environmental impact.",
            "welcome.privacy": "🔒 Privacy",
            "welcome.privacyText": "Private browsing, reduced tracking, and greater control over your personal data.",
            "welcome.themes": "🌗 Light and dark themes",
            "welcome.themesText": "Switch instantly between light and dark modes to suit your preference.",
            "welcome.historyText": "Easily find recently visited pages in the built-in history.",
            "welcome.productivity": "⚡ Smart workspaces",
            "welcome.productivityText": "Make multitasking easier: split panels, use keyboard controls, and save layouts.",
            "home.featureSpeed": "🐇 Speed",
            "home.featurePrivacy": "🔒 Privacy",
            "home.featureAi": "✨ Local AI",
            "help.welcome": "Welcome to the official <strong>Hare Browser</strong> help center. This web browser combines an advanced multi-panel browsing environment (dynamic mosaic mode), a privacy-friendly SearXNG search engine, and a local AI assistant powered by Ollama.",
            "help.mac": "🍏 macOS setup: On Apple Mac, replace Ctrl with Cmd (Command) for all the keyboard shortcuts below.",
            "help.panels": "🧱 Panel management & splitting",
            "help.panelsIntro": "Hare Browser is built around a binary split tree (split nodes). Each active panel can be split repeatedly to organize your workspace without managing dozens of traditional overlapping tabs.",
            "help.shortcuts": "⌨️ Complete Keyboard Shortcut Reference",
            "help.panelLayout": "🧱 Panel Management & Layout",
            "help.diagramsTitle": "Geometric tile-splitting diagrams:",
            "help.splitV.desc": "<strong>1. Initial Vertical Split (Ctrl&nbsp;+&nbsp;T):</strong> Divides the active space into two equal columns and opens a new, independent tile on the right side.",
            "help.diagram.splitV": `    ┌──────────────────────────────────────┐          ┌──────────────────┬──────────────────┐
    │                                      │          │                  │                  │
    │                                      │ Ctrl + T │                  │                  │
    │            INITIAL PANEL             │ ───────> │  INITIAL PANEL   │     NEW TILE     │
    │               (Active)               │          │                  │      (Right)     │
    │                                      │          │                  │                  │
    └──────────────────────────────────────┘          └──────────────────┴──────────────────┘
`,
            "help.splitH.desc": "<strong>2. Secondary Horizontal Split (Ctrl + H):</strong> Selects a specific panel and splits it into two horizontal rows, creating a new tile below.",
            "help.diagram.splitH": `    ┌──────────────────┬───────────────────┐          ┌──────────────────┬──────────────────┐
    │                  │      FOCUS        │          │                  │      TOP TILE    │
    │                  │     (Active)      │ Ctrl + H │                  ├──────────────────┤
    │ INITIAL PANEL    ├───────────────────┤ ───────> │ INITIAL PANEL    │                  │
    │                  │                   │          │                  │     NEW TILE     │
    │                  │                   │          │                  │     (Bottom)     │
    └──────────────────┴───────────────────┘          └──────────────────┴──────────────────┘
`,
            "help.plus.title": "➕ Split a panel with the + button",
            "help.plus.intro": "You can quickly create a new panel without using the keyboard. Simply click the <strong>+</strong> button located to the right of the active panel's address bar.",
            "help.plus.news": "💡 <strong>New</strong>: clicking the <strong>+</strong> button now opens a context submenu that lets you choose between <strong>“Split to the right”</strong> (vertical split) or <strong>“Split downward”</strong> (horizontal split).",
            "help.diagram.plus": `        ┌──────────────────────────────┐
        │                          [+] │
        │                              │
        │       ACTIVE PANEL           │
        │                              │
        │                              │
        └──────────────────────────────┘
                       │
         Click on +    │
      ┌────────────────┴────────────────┐
      ▼ (Split right)                   ▼ (Split down)
┌───────────────┬───────────────┐ ┌──────────────────────────────┐
│               │               │ │                              │
│               │ NEW           │ │         ACTIVE PANEL         │
│ ACTIVE PANEL  │ PANEL         │ │                              │
│               │ (Right)       │ ├──────────────────────────────┤
│               │               │ │          NEW PANEL           │
└───────────────┴───────────────┘ │          (Bottom)            │
                                  └──────────────────────────────┘
`,
            "help.plus.outro": "The <strong>+</strong> button provides the same actions as the <code>Ctrl + T</code> and <code>Ctrl + Shift + H</code> keyboard shortcuts, using the mouse. This visual approach is ideal for partitioning your workspace on the fly and setting up your mosaic of sites entirely with the mouse.",
            "help.ctx.title": "🖱️ Panel context menu",
            "help.ctx.intro": "Each browsing panel has a context menu available by <strong>right-clicking</strong>. This menu groups the main content management actions, the artificial intelligence features, and the mosaic layout tools.",
            "help.ctx.tip": "💡 Tip: a right-click inside a panel gives quick access to the most common commands without using keyboard shortcuts.",
            "help.ctx.editTitle": "✏️ Edit",
            "help.ctx.cut": "<strong>Cut</strong> (Ctrl + X)",
            "help.ctx.copy": "<strong>Copy</strong> (Ctrl + C)",
            "help.ctx.paste": "<strong>Paste</strong> (Ctrl + V)",
            "help.ctx.delete": "<strong>Delete</strong>",
            "help.ctx.selectAll": "<strong>Select all</strong> (Ctrl + A)",
            "help.ctx.aiTitle": "✨ AI actions (Assistant)",
            "help.ctx.summarize": "<strong>Summarize this web tile</strong>: generates a quick summary of the displayed page.",
            "help.ctx.keywords": "<strong>Analyze page keywords</strong>: extracts the main themes and important words from the content.",
            "help.ctx.layoutTitle": "🧱 Mosaic layout",
            "help.ctx.splitV": "<strong>Split vertically</strong> (Ctrl + T): creates a new panel on the right.",
            "help.ctx.splitH": "<strong>Split horizontally</strong> (Ctrl + H): creates a new panel below.",
            "help.ctx.splitPrivate": "<strong>Split into private browsing</strong> (Ctrl + Shift + N): opens a new isolated private panel.",
            "help.ctx.splitContainer": "<strong>Split into an isolated container</strong> (🗂️ in the toolbar): opens a new panel in a container (Personal, Work, Account 2, Account 3) so you can sign in to several accounts at the same time.",
            "help.ctx.duplicate": "<strong>Duplicate this tile</strong> (Ctrl + Shift + D, 📋 in the toolbar, or right-click the tile): opens a copy of the panel to its right, on the same address. A copy of a private tile stays private; a copy of a container tile is created in the default session.",
            "help.ctx.panelTitle": "📌 Panel management",
            "help.ctx.maximize": "<strong>Maximize this tile</strong> (Ctrl + M): temporarily enlarges the selected panel.",
            "help.ctx.print": "<strong>Print page content</strong> (Ctrl + P).",
            "help.ctx.close": "<strong>Close this tile</strong> (Ctrl + W).",
            "help.diagram.menu": `                         │ Right-click on a panel
                         │
                         ▼
        ┌───────────────────────────────┐
        │ ✏️ Edit                       │
        │ ✨ AI actions                 │
        │ 🧱 Mosaic layout              │
        │ 📌 Panel management           │
        └───────────────────────────────┘
`,
            "help.ctx.outro": "The context menu is the central access point for most panel management features. It lets you quickly build a mosaic workspace, analyze a page with the AI assistant, and manage the displayed content without leaving the active panel.",
            "help.th.shortcut": "Keyboard Shortcut",
            "help.th.layout": "System Action & Geometric Behavior",
            "help.th.swap": "Swap Direction in the Mosaic",
            "help.th.zoom": "Effect on the Usable Display Area",
            "help.th.focus": "Application Focus Movement",
            "help.th.web": "Web Navigation Action & Behavior",
            "help.th.system": "Global Application Action & Lifecycle",
            "help.row.splitV": "<strong>Split vertically</strong> — Splits the active panel in two vertically and opens a new tile on the right.",
            "help.row.splitH": "<strong>Split horizontally</strong> — Splits the active panel in two horizontally and opens a new tile at the bottom.",
            "help.row.close": "<strong>Close the active tile</strong> — Immediately closes the panel you are on and readjusts the ratios of the neighboring tiles. If only one tile remains open, closes the application.",
            "help.row.undo": "<strong>Undo close</strong> — Instantly reopens the most recently closed panel, restoring its URL and its exact position in the mosaic.",
            "help.key.save": "<code>Cmd&nbsp;or&nbsp;Ctrl&nbsp;+&nbsp;S</code>",
            "help.row.save": "<strong>Save layout</strong> — Exports the current structure of your tile mosaic to a JSON file so you can reload it later.",
            "help.key.load": "<code>Cmd&nbsp;or&nbsp;Ctrl&nbsp;+&nbsp;O</code>",
            "help.row.load": "<strong>Load a layout</strong> — Imports a JSON configuration file to instantly restore a complete workspace.",
            "help.key.equalize": "<code>Cmd&nbsp;or&nbsp;Ctrl&nbsp;+&nbsp;R</code>",
            "help.row.equalize": "<strong>Equalize the mosaic</strong> — Instantly resets the entire mosaic to equal sizes, regardless of the number of active tiles, by repositioning all separators to the center.",
            "help.swap.title": "🔄 Reordering Tiles with the Keyboard",
            "help.swap.intro": "Instantly swaps the physical position of the active panel with the adjacent panel in the targeted direction, without using the drag handle with the mouse.",
            "help.row.swapLeft": "<strong>Swap left</strong> — Swaps the position of the active panel with the tile immediately to its left.",
            "help.row.swapRight": "<strong>Swap right</strong> — Swaps the position of the active panel with the tile immediately to its right.",
            "help.row.swapUp": "<strong>Swap above</strong> — Swaps the position of the active panel with the tile immediately above it.",
            "help.row.swapDown": "<strong>Swap below</strong> — Swaps the position of the active panel with the tile immediately below it.",
            "help.zoom.title": "🔍 Enlarged Mode & Geometric Zoom",
            "help.row.fullscreen": "<strong>Application full screen</strong> — Hides the borders, the title bar and the toolbar. Move the mouse to the very top of the screen to temporarily show the tools without leaving full screen; they collapse again after a few moments. Press F11 again to return to normal window mode.",
            "help.row.maximize": "<strong>Maximize / Restore a tile</strong> — Toggles between enlarged mode for the active tile (100% of the mosaic's usable space) and the original mosaic mode. The other tiles are temporarily hidden but the application window stays visible.",
            "help.row.escape": "<strong>Exit enlarged mode / Restore the tile</strong> — Global shortcut that exits the application's full-screen display (F11), and also restores the original mosaic if a tile was maximized (Ctrl+M).",
            "help.key.aiToggle": "<code>Cmd&nbsp;or&nbsp;Ctrl&nbsp;+&nbsp;Shift&nbsp;+&nbsp;A</code>",
            "help.row.aiToggle": "<strong>Show / Hide the AI Assistant</strong> — Toggles the AI Assistant side panel and dynamically readjusts the mosaic geometry.",
            "help.focus.title": "🧭 Navigating Between Tiles (Keyboard Focus)",
            "help.row.nextTile": "<strong>Next tile</strong> — Moves the focus and the blue outline to the next panel (clockwise).",
            "help.row.prevTile": "<strong>Previous tile</strong> — Moves the focus and the blue outline to the previous panel (counterclockwise).",
            "help.web.title": "🌐 Web Navigation (In the Focused Tile)",
            "help.web.intro": "These commands apply directly to the web content displayed in the active panel that has visual focus (blue outline).",
            "help.row.address": "<strong>Focus the address bar</strong> — Instantly gives focus to the URL input field of the active panel and selects all the text so you can type a new address.",
            "help.row.back": "<strong>Previous page</strong> — Goes back one step in the navigation history of the active web page.",
            "help.row.forward": "<strong>Next page</strong> — Goes forward one step in the navigation history of the active web page.",
            "help.key.refresh": "<code>F5</code>&nbsp;&nbsp;or&nbsp;&nbsp;<code>Ctrl&nbsp;+&nbsp;R</code>",
            "help.row.refresh": "<strong>Refresh the page</strong> — Reloads the content of the website loaded in the active tile.",
            "help.row.print": "<strong>Print the active tile</strong> — Opens the operating system's print dialog for the document currently being viewed.",
            "help.key.help": "<code>F1</code>&nbsp;&nbsp;or&nbsp;&nbsp;<code>Alt&nbsp;+&nbsp;Home</code>",
            "help.row.help": "<strong>Help</strong> — Instantly loads this help center in the active panel.",
            "help.sys.title": "❌ System & Security",
            "help.sys.intro": "Global commands affecting the application's overall interface, the management of browsing data and the security of the browser's lifecycle.",
            "help.row.private": "<strong>New private tile</strong> — Creates an isolated vertical split in private browsing mode. Cookies and cache are destroyed as soon as this panel is closed.",
            "help.row.downloads": "<strong>Downloads</strong> — Opens the download manager window (📥 button in the toolbar).",
            "help.row.duplicate": "<strong>Duplicate the active tile</strong> — Opens a copy of the active panel to its right, on the same address. A copy of a private tile stays private.",
            "help.row.bookmarks": "<strong>Show / Hide bookmarks</strong> — Toggles the display of the top bookmarks bar and dynamically readjusts the mosaic geometry.",
            "help.key.history": "<code>Ctrl&nbsp;+&nbsp;H</code>&nbsp;(global)",
            "help.row.history": "<strong>Show history</strong> — Opens and moves focus to the side panel dedicated to the global browsing history.",
            "help.row.settings": "<strong>Settings</strong> — Instantly opens the application settings window, also accessible via the 🛠️ button in the toolbar.",
            "help.row.quit": "<strong>Quit the application</strong> — Cleanly shuts down the Hare Browser processes. A security confirmation dialog is shown to prevent accidentally losing your open tiles.",
            "help.adv.title": "🏗️ Advanced Features",
            "help.ai.title": "✨ Local Ollama AI Assistant",
            "help.ai.body": "Hare Browser includes an autonomous conversational agent connected to your local Ollama instance. It can analyze the text content of your active web page to generate concise three-point summaries or extract specific keywords, guaranteeing complete privacy (no data is sent to a third-party server or external cloud).",
            "help.sec.title": "🕵️ Cyber-Security and Private Browsing",
            "help.sec.body": "When you open a private tile, the browser creates a purely volatile in-memory partition (an isolated <code>incognito</code> session). When this tile is closed, a script automatically and irreversibly destroys all residual local traces: cookies, LocalStorage, IndexedDB databases, the session and Chromium's HTTP rendering cache.",
            "help.reader.title": "👓 Reader Mode",
            "help.reader.body": "The 👓 button turns the displayed page into a clean view: only the article's title, text, images and tables are kept, without menus, ads, banners or comments. It is available in three places: in the toolbar (it acts on the active tile), in each tile's address bar, and in the context menu (right-click, “Reader mode”).",
            "help.reader.comfort": "<strong>Reading comfort</strong>: centered text in a serif font, adapted to the application's light or dark mode. The <strong>A−</strong> / <strong>A+</strong> buttons adjust the text size.",
            "help.reader.exit": "<strong>Exit</strong>: click ✕ in the reader mode bar, or 👓 again. The original page is not reloaded: you return to exactly your position.",
            "help.reader.limits": "<strong>Limits</strong>: unavailable on internal pages or on sleeping tiles. If the page contains too little text, the icon briefly shows ⚠️.",
            "help.dl.title": "📥 Download Manager",
            "help.dl.body": "The 📥 button in the toolbar (or <code>Ctrl + J</code>) opens a window listing your current and past downloads, with the file name, size and source site.",
            "help.dl.running": "<strong>In progress</strong>: a progress bar is displayed and the “Cancel” button interrupts the download.",
            "help.dl.done": "<strong>Completed</strong>: the “Show in folder” button reveals the file in Explorer. If the file was moved or deleted, the row says so.",
            "help.dl.list": "<strong>List</strong>: ✕ removes a row, “Clear list” removes all completed downloads (files are never deleted). History is kept between launches, except for private tiles: their downloads are never saved to disk.",
            "help.cont.title": "🗂️ Container Tiles (Multi-Account)",
            "help.cont.body": "Each container has its own persistent partition: cookies, LocalStorage and sessions are isolated from the other containers and from the default session. You can therefore open two tiles side by side and sign in to two different Google or Outlook accounts at the same time. Unlike private browsing, sign-ins are kept between launches.",
            "help.cont.open": "<strong>Opening</strong>: 🗂️ button in the toolbar, or right-click a tile then “Split into an isolated container (multiple accounts)”, then choose the container.",
            "help.cont.mark": "<strong>Identification</strong>: a container tile's tab is topped with a colored strip; the container name appears on hover.",
            "help.cont.limits": "<strong>Limits</strong>: unavailable from a private tile or in enlarged mode. “Duplicate this tile” creates the copy in the default session, not in the same container.",
            "help.block.title": "🚫 Built-in Ad & Tracker Blocker",
            "help.block.body": "Every network request issued by a tile (public or private) is analyzed on the fly by the application's main process through Electron's <code>webRequest</code> API.",
            "help.block.speed": "<strong>Faster loading</strong>: Heavy advertising scripts and intrusive images are cancelled <strong>before</strong> they are downloaded.",
            "help.block.privacy": "<strong>Full privacy</strong>: Natively blocks the behavioral tracking beacons of the major ad networks.",
            "help.block.incognito": "<strong>Incognito protection</strong>: Filtering is applied tightly on your volatile partitions without leaving traces in memory.",
            "help.block.disable": "<strong>Disable the blocker on a site</strong>: if a site misbehaves, click the 🛡️ icon in its address bar, or right-click the tile then “Disable the blocker on <em>site-name</em>”. The page is reloaded without filtering. The icon turns green to indicate the exception; clicking again re-enables the blocker. Exceptions are saved per site and kept between launches.",
            "help.pwd.title": "🔑 Secure Password Manager",
            "help.pwd.body": "Your saved credentials and passwords are protected by strong encryption. In development mode or on compatible target systems, the browser relies on the <code>safeStorage</code> module to apply internal asymmetric encryption (Alternative Encryption), preventing any unauthorized reading of the storage file by third-party applications.",
            "help.footer": "Hare Browser • Built on Electron • Ollama AI engine • SearXNG search",
            "welcome.footer": "Hare Browser: productive, private, modern.",
            "welcome.credits": "Powered by SearXNG • Ollama • Electron",
            "welcome.themeButton": "🌗 Theme",
            "home.speed": "🐇 Speed",
            "home.privacy": "🔒 Privacy",
            "home.mosaic": "🧩 Mosaic browsing",
            "home.blocking": "🚫 Blocking enabled",
            "home.credits": "Powered by SearXNG",
            "home.version": "2026.9.10+ba055b3e0 • a privacy-friendly metasearch engine",
            "private.listHistory": "Local browsing history",
            "private.listCookies": "Cookies and session data",
            "private.listForms": "Form entries",
            "private.listCache": "Cache cleared when the panel closes",
            "private.visibleSites": "The websites you visit",
            "private.visibleAdmin": "Your network administrator (school/work)",
            "private.visibleIsp": "Your internet service provider",
            "splash.loading": "Preparing your browsing mosaic...",
            "splash.title": "Loading...",
            "reader.unavailable": "Reader mode is unavailable for this page.",
            "reader.error": "Could not enable reader mode.",
            "reader.title": "Reader mode",
            "reader.smaller": "Smaller text",
            "reader.larger": "Larger text",
            "reader.close": "Back to normal page",
            "ollama.notInstalled": "AI assistant is not installed.",
            "ollama.cancelled": "Model download cancelled.",
            "ollama.notRunning": "The AI assistant is installed but not running.",
            "ollama.selectTile": "Enter a question before clicking Ask a question.",
            "ollama.noVisibleText": "No visible tile contains readable text.",
            "ollama.noPageText": "The active tile contains no readable text.",
            "ui.privateLabel": "Private Browsing",
            "ui.searchLabel": "Search",
            "ui.searchEngine": "Hare Browser search engine",
            "ui.addFavorite": "Add to bookmarks",
            "ui.removeFavorite": "Remove from bookmarks",
            "ui.splitTile": "Split this panel",
            "ui.splitRight": "Split to the right",
            "ui.splitDown": "Split downward",
            "ui.readerTooltip": "Reader mode (cleans up the page for distraction-free reading)",
            "ui.zoomDisabled": "(Disabled while zoomed)",
            "ui.readerUnavailable": "Reader mode is unavailable for this page.",
            "ui.readerError": "Could not enable reader mode.",
            "ui.error": "Error",
            "ui.container": "Container: {name}",
            "adblock.reenable": "Re-enable blocker on {host}",
            "adblock.disable": "Disable blocker on {host}",
            "ai.sidebarPrompt": "Question about a page or your tiles",
            "ai.clearHistory": "Clear assistant history",
            "ai.compareTooltip": "Compare the content of all visible tiles",
            "ai.fullTooltip": "Full mode: sends all page text (up to 20,000 characters per tile) instead of the lightweight extraction. More accurate but slower.",
            "bookmarks.clear": "Clear bookmarks",
            "passwords.urlExample": "e.g. google.com",
            "passwords.usernameShort": "Username / Email",
            "passwords.passwordShort": "Password",
            "passwords.saveShort": "Save",
            "welcome.searchLabel": "🔍 Private search",
            "home.featureSearch": "🔍 Private search",
            "menu.sleepDisabled": "💤 Disable automatic sleep",
            "menu.sleepEnabled": "💤 Enable automatic sleep",
            "main.menuSaveConfig": "Save panel layout",
            "main.menuLoadConfig": "Load panel layout",
            "main.menuSleepLabel": "Automatic sleep",
            "main.menuMosaicEqual": "📐 Equalize tile sizes (Ctrl+Shift+R)",
            "main.menuBookmarkBar": "Show/Hide bookmarks bar",
            "main.menuSaveLayoutTitle": "Save panel layout",
            "main.menuCloseApp": "Quit application",
            "fullscreen.enter": "Enable full screen (F11)",
            "fullscreen.exit": "Exit full screen (F11)",
            "fullscreen.enterLabel": "Enable full screen",
            "fullscreen.exitLabel": "Exit full screen",
            "toolbar.lightMode": "Enable light mode",
            "toolbar.resetWorkspace": "Reset workspace (Ctrl+Shift+Home)",
            "panel.noneSelected": "No panel selected",
            "panel.closeActive": "Close active panel",
            "panel.drag": "Drag to move",
            "panel.restore": "Restore size",
            "panel.enlarge": "Enlarge",
            "panel.detach": "Detach",
            "panel.close": "Close",
            "panel.restoreMosaic": "🗗 Restore mosaic size (Esc)",
            "panel.maximize": "🗖 Maximize this tile (Ctrl+M)",
            "history.confirmClear": "Are you sure you want to clear all your history?",
            "ai.summaryActiveTitle": "Summarize active page",
            "ai.stopGenerationTitle": "Stop the current generation",
            "ai.availableAfterResponse": "Available after the current response",
            "main.refreshCtrl": "Refresh page (Ctrl+R)",
            "menu.itemClearHistory": "Clear all browsing history",
            "ai.summaryPrompt": "Summarize this page in three concise key points.",
            "ai.keywordPrompt": "Extract the keywords and main themes from this text as a list.",
            "ai.loadingCompare": "⏳ AI is analyzing visible tiles for comparison...",
            "ai.loadingPage": "⏳ AI is analyzing the active tile...",
            "ai.loadingKeywords": "⏳ AI is extracting keywords from the active tile...",
            "ai.loadingQuestion": "⏳ AI is analyzing your question and preparing an answer...",
            "ai.emptyResponse": "❌ The AI returned an empty response.",
            "ai.ipcError": "❌ Could not reach the IPC bridge ({error})",
            "ai.downloadError": "Could not download the model automatically: {error}",
            "ai.ollamaError": "Ollama error ({status}): {error}",
            "ai.internalError": "Internal error: {error}",
            "ai.localUnavailable": "Could not reach local AI: {error}",
            "ai.ollamaChecking": "Checking Ollama at {url}…",
            "ai.ollamaUnavailable": "Cannot contact Ollama at {url}. Check that Ollama is running and a model is installed.",
            "ai.ollamaModelMissing": "Ollama responds, but model {model} is missing.",
            "ai.ollamaModelInstalled": "Ollama responds; model {model} is installed. It will load before the first question.",
            "ai.ollamaModelLoading": "Loading model {model} in Ollama…",
            "ai.ollamaReady": "Ollama is ready — model {model} is loaded.",
            "ai.modelMissing": "Ollama model not found: {model}",
            "ai.inputEmpty": "Enter a question before continuing.",
            "ai.analyzeLabel": "Analyzing...",
            "ai.cancelled": "Request cancelled.",
            "bookmarks.empty": "No bookmarks (⭐)",
            "bookmarks.removeOne": "Remove this bookmark",
            "bookmarks.confirmClear": "Are you sure you want to clear all bookmarks?",
            "reader.enabled": "Reader mode is on — click to return to the page",
            "reader.disabled": "Reader mode is off — click to read without distractions",
            "reader.notEnoughText": "There isn’t enough text to display in reader mode on this page",
            "reader.unavailablePage": "Reader mode is unavailable on this page",
            "download.progressTitle": "Downloading: {filename} ({percent}%)",
            "ai.loadingSummary": "AI is analyzing the active tile...",
            "ai.loadingComparison": "AI is analyzing visible tiles for comparison...",
            "ai.loadingPrompt": "AI is analyzing your question and preparing an answer...",
            "ai.actionUnavailable": "⚠️ Action unavailable",
            "ai.activateTileLong": "Select a web tile before starting the analysis.",
            "ai.bridgeError": "❌ Could not reach the IPC bridge ({error})",
            "ai.autoSummaryPrompt": "Summarize this article in three concise key points.",
            "ai.summaryPrompt": "Summarize this page in three concise key points.",
            "ai.instructions.enter": "Enter text to",
            "ai.instructions.click": "Click",
            "ai.instructions.analyze": "to analyze the active tile.",
            "ai.instructions.use": "Use",
            "ai.instructions.compare": "to compare the visible pages.",
            "sleep.disabled": "Automatic sleep is off",
            "sleep.enabled": "Automatic sleep is on",
            "sleep.enabledDelay": "Automatic sleep is on: delay is {duration}",
            "ollama.invalidResponse": "Invalid Ollama response.",
            "welcome.tooltip.tutorial": "Click to launch the video tutorial",
            "welcome.tooltip.openHelp": "Click to open the help page",
            "welcome.tooltip.openHome": "Click to open the home page",
            "welcome.tooltip.openPrivate": "Click to open private browsing",
            "welcome.internalPage.error": "Could not open the requested page.",
            "welcome.tooltip.ai": "Click to open the local AI assistant",
            "welcome.tooltip.theme": "Click to toggle between light and dark modes",
            "welcome.tooltip.history": "Click to open the browsing history window"


        }
    };

    const sourceToId = new Map();
    function canonicalize(text) {
        return String(text ?? "")
            .normalize("NFC")
            .replace(/[’‘`]/g, "'")
            .replace(/\s+/g, " ")
            .trim();
    }
    Object.entries(catalogs.fr).forEach(([id, text]) => sourceToId.set(canonicalize(text), id));
    Object.entries(catalogs.en).forEach(([id, text]) => sourceToId.set(canonicalize(text), id));

    function normalizeLanguage(language) {
        const candidate = typeof language === "string" ? language.toLowerCase().split("-")[0] : "";
        return Object.prototype.hasOwnProperty.call(catalogs, candidate) ? candidate : "fr";
    }

    function t(id, language = "fr", replacements = {}) {
        const lang = normalizeLanguage(language);
        let result = catalogs[lang][id] || catalogs.fr[id] || id;
        Object.entries(replacements).forEach(([key, value]) => {
            result = result.replaceAll(`{${key}}`, String(value));
        });
        return result;
    }

    function translateText(text, language = "fr") {
        const id = sourceToId.get(canonicalize(text));
        if (!id) return text;
        const translated = t(id, language);
        const leading = String(text).match(/^\s*/)?.[0] || "";
        const trailing = String(text).match(/\s*$/)?.[0] || "";
        return leading + translated + trailing;
    }

    function apply(rootElement, language = "fr") {
        if (!rootElement) return;
        const lang = normalizeLanguage(language);
        if (rootElement.documentElement) rootElement.documentElement.lang = lang;
        else if (rootElement.tagName === "HTML") rootElement.lang = lang;

        const scope = rootElement.nodeType === 9 ? rootElement.documentElement : rootElement;
        if (!scope) return;
        scope.querySelectorAll?.("[data-i18n]").forEach((element) => {
            const id = element.getAttribute("data-i18n");
            if (id && element.textContent !== t(id, lang)) element.textContent = t(id, lang);
        });

        // Variante pour les textes contenant du balisage (strong, code, entités) : catalogue de confiance uniquement.
        scope.querySelectorAll?.("[data-i18n-html]").forEach((element) => {
            const id = element.getAttribute("data-i18n-html");
            if (id && element.getAttribute("data-i18n-html-lang") !== lang) {
                element.innerHTML = t(id, lang);
                element.setAttribute("data-i18n-html-lang", lang);
            }
        });


        // Recherchez ce bloc existant dans la fonction apply() :
        scope.querySelectorAll?.("[data-i18n-title], [data-i18n-placeholder], [data-i18n-aria-label], [data-i18n-alt]").forEach((element) => {
            [
                ["data-i18n-title", "title"],
                ["data-i18n-placeholder", "placeholder"],
                ["data-i18n-aria-label", "aria-label"],
                ["data-i18n-alt", "alt"]
            ].forEach(([dataAttribute, targetAttribute]) => {
                const id = element.getAttribute(dataAttribute);
                // Pendant l'affichage de l'info-bulle, le title est mis de côté dans data-hare-tip.
                const target = targetAttribute === "title" && element.hasAttribute("data-hare-tip") ? "data-hare-tip" : targetAttribute;
                if (id && element.getAttribute(target) !== t(id, lang)) element.setAttribute(target, t(id, lang));
            });
        });

        // ✨ AJOUTEZ CE BLOC JUSTE EN DESSOUS POUR METTRE À JOUR L'ATTRIBUT DU CSS DES BULLES :
        scope.querySelectorAll?.("[data-i18n-tooltip]").forEach((element) => {
            const id = element.getAttribute("data-i18n-tooltip");
            if (id) {
                const translatedTooltip = t(id, lang);
                // Met à jour l'attribut data-tooltip lu par tooltip-glass.js
                if (element.getAttribute("data-tooltip") !== translatedTooltip) {
                    element.setAttribute("data-tooltip", translatedTooltip);
                }
            }
        });

        scope.querySelectorAll?.("[data-i18n-tooltip-key], [data-tooltip-key]").forEach((element) => {
            const id = element.getAttribute("data-i18n-tooltip-key") || element.getAttribute("data-tooltip-key");
            if (!id) return;
            const translatedTooltip = t(id, lang);
            if (element.getAttribute("data-hare-tip") !== translatedTooltip) element.setAttribute("data-hare-tip", translatedTooltip);
            if (element.getAttribute("data-tooltip") !== translatedTooltip) element.setAttribute("data-tooltip", translatedTooltip);
            if (element.getAttribute("title") !== translatedTooltip) element.setAttribute("title", translatedTooltip);
        });

        scope.querySelectorAll?.("[data-i18n-aria-label-key]").forEach((element) => {
            const id = element.getAttribute("data-i18n-aria-label-key");
            if (id) {
                const translatedLabel = t(id, lang);
                if (element.getAttribute("aria-label") !== translatedLabel) element.setAttribute("aria-label", translatedLabel);
            }
        });

        const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
        const textNodes = [];
        while (walker.nextNode()) textNodes.push(walker.currentNode);
        textNodes.forEach((node) => {
            const parent = node.parentElement;
            if (!parent || ["SCRIPT", "STYLE", "TEXTAREA", "INPUT"].includes(parent.tagName)) return;
            // Le contenu géré par une clé data-i18n* est déjà traduit : évite de réécrire (espaces de fin) en boucle.
            if (parent.closest?.("[data-i18n], [data-i18n-html]")) return;
            const translated = translateText(node.nodeValue, lang);
            if (translated !== node.nodeValue) node.nodeValue = translated;
        });

        scope.querySelectorAll?.("[title], [placeholder], [aria-label], [alt]").forEach((element) => {
            ["title", "placeholder", "aria-label", "alt"].forEach((attribute) => {
                if (element.hasAttribute(attribute)) {
                    const translated = translateText(element.getAttribute(attribute), lang);
                    if (translated !== element.getAttribute(attribute)) element.setAttribute(attribute, translated);
                }
            });
        });
        if (scope.title) scope.title = translateText(scope.title, lang);
    }

    async function attach(languageApi) {
        if (!languageApi) return;
        const getLanguage = languageApi.getLanguage || languageApi.get;
        const onLanguageChanged = languageApi.onLanguageChanged || languageApi.onChanged;
        if (typeof getLanguage !== "function") return;
        
        let current = "fr";
        try { current = normalizeLanguage(await getLanguage()); } catch {}
        
        // 1. Traduction de la page au démarrage
        apply(document, current);
        traduireLesInfoBullesWelcome(current);
        window.HareTooltipGlass?.refresh?.();

        // 2. Écoute dynamique du changement de langue (Bascule en temps réel)
        if (typeof onLanguageChanged === "function") {
            onLanguageChanged((language) => {
                current = normalizeLanguage(language);
                apply(document, current);
                traduireLesInfoBullesWelcome(current); // Met à jour les bulles d'aide
                window.HareTooltipGlass?.refresh?.();
            });
        }

        // 3. Fonction isolée de mise à jour des attributs CSS data-tooltip
        function traduireLesInfoBullesWelcome(lang) {
            document.querySelectorAll("[data-i18n-tooltip]").forEach((element) => {
                const id = element.getAttribute("data-i18n-tooltip");
                if (id) {
                    const texteTraduit = t(id, lang);
                    element.setAttribute("data-tooltip", texteTraduit);
                }
            });
        }

        // Observateur standard d'origine (inchangé, sécurisé contre les boucles)
        const observer = new MutationObserver(() => apply(document, current));
        observer.observe(document.documentElement, { 
            childList: true, 
            subtree: true, 
            characterData: true, 
            attributes: true, 
            attributeFilter: [
                "title", "placeholder", "aria-label", "alt",
                "data-i18n-tooltip-key", "data-tooltip-key", "data-i18n-aria-label-key"
            ]
        });
    }


    return { catalogs, languages: Object.keys(catalogs), t, translateText, apply, attach, normalizeLanguage };
});

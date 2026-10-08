// nanobrowser/reader.js

(function() {
    // Si le mode lecture est déjà initialisé, on gère l'action de fermeture
    if (document.getElementById('hare-reader-container')) {
        const container = document.getElementById('hare-reader-container');
        if (container.style.display !== 'none') {
            // Restauration de la page d'origine
            container.style.display = 'none';
            if (window.__hareOriginalBodyStyle) {
                document.body.setAttribute('style', window.__hareOriginalBodyStyle);
            } else {
                document.body.removeAttribute('style');
            }
            // Réafficher les enfants originaux du body
            Array.from(document.body.children).forEach(child => {
                if (el => el.id !== 'hare-reader-container') {
                    if (child.dataset && child.dataset.hareOriginalDisplay) {
                        child.style.display = child.dataset.hareOriginalDisplay;
                    } else {
                        child.style.display = '';
                    }
                }
            });
            
            // Émettre l'événement pour notifier l'environnement Electron du changement d'état
            document.dispatchEvent(new CustomEvent('hare-reader-mode-state', { detail: false })); //
            return 'closed'; //
        }
    }

    // --- 1. EXTRACTION DU CONTENU DE L'ARTICLE ---
    const pageTitle = document.title || "Sans titre";
    let articleTitle = "";
    const h1 = document.querySelector('h1');
    if (h1) {
        articleTitle = h1.innerText || h1.textContent;
    } else {
        articleTitle = pageTitle;
    }

    // Sélection des conteneurs d'articles potentiels (heuristique)
    const selectors = [
        'article', '[role="main"]', 'main', '.post-content', 
        '.entry-content', '.article-content', '#story', '.story'
    ];
    
    let mainElement = null;
    for (const selector of selectors) {
        const found = document.querySelector(selector);
        if (found && found.innerText.trim().length > 200) {
            mainElement = found;
            break;
        }
    }

    // Fallback sur le body complet si aucun conteneur structurel n'est trouvé
    if (!mainElement) {
        mainElement = document.body;
    }

    // Cloner la zone pour la nettoyer sans casser l'état de l'application web d'origine
    const contentClone = mainElement.cloneNode(true);

    // Purge des éléments parasites dégradant le confort de lecture (publicités, widgets, scripts)
    const noiseSelectors = 'script, style, noscript, iframe, canvas, svg, nav, header, footer, form, aside, dialog, .comments, .sidebar, #sidebar, .ads, .share-buttons';
    contentClone.querySelectorAll(noiseSelectors).forEach(el => el.remove());

    // Extraction et filtrage des éléments lisibles (paragraphes, sous-titres, listes, images)
    const readableElements = contentClone.querySelectorAll('h2, h3, h4, p, li, img, table');
    let articleHtmlContent = "";
    let extractedTextLength = 0;

    readableElements.forEach(node => {
        if (node.tagName.toLowerCase() === 'img') {
            const src = node.getAttribute('src');
            if (src && src.startsWith('http')) { // Conserve uniquement les images distantes valides
                articleHtmlContent += `<img src="${src}" alt="Image de l'article" style="max-width:100%; height:auto; border-radius:8px; margin:16px 0;">`;
            }
        } else {
            const text = node.innerText || node.textContent;
            const trimmed = text.trim();
            if (trimmed.length > 0) {
                extractedTextLength += trimmed.length;
                articleHtmlContent += `<${node.tagName.toLowerCase()}>${trimmed}</${node.tagName.toLowerCase()}>`;
            }
        }
    });

    // --- Heuristique de sécurité : Refus si le contenu est trop pauvre ---
    if (extractedTextLength < 150) {
        return 'unavailable'; //
    }

    // --- 2. CRÉATION DU CONTENEUR DE LECTURE DANS LE DOM ---
    let readerContainer = document.getElementById('hare-reader-container');
    if (!readerContainer) {
        readerContainer = document.createElement('div');
        readerContainer.id = 'hare-reader-container';
        document.body.appendChild(readerContainer);
    }

    // Détermination de la couleur de thème (héritée de l'état global Electron transmis via window.__hareReaderDark)
    const isDark = !!window.__hareReaderDark;

    // Génération de la structure HTML et de la feuille de style CSS injectée directement
    readerContainer.innerHTML = `
        <div id="hare-reader-toolbar">
            <div class="toolbar-brand">👓 Mode Lecture</div> <!-- -->
            <div class="toolbar-actions">
                <button onclick="window.__hareAdjustText(-2)" title="Diminuer la taille">A−</button> <!-- -->
                <button onclick="window.__hareAdjustText(2)" title="Augmenter la taille">A+</button> <!-- -->
                <button onclick="window.__hareToggleReaderTheme()" title="Changer le thème">🌗</button>
                <button id="hare-reader-close" class="close-btn" title="Quitter">✕</button> <!-- -->
            </div>
        </div>
        <div id="hare-reader-content-wrapper">
            <article class="hare-reader-article">
                <h1>${articleTitle}</h1>
                <hr style="border:0; border-top:1px solid var(--hr-color); margin-bottom:24px;">
                ${articleHtmlContent}
            </article>
        </div>
        <style>
            #hare-reader-container {
                position: fixed !important; top: 0 !important; left: 0 !important;
                width: 100vw !important; height: 100vh !important;
                z-index: 2147483647 !important; overflow-y: auto !important;
                font-family: Georgia, Cambria, "Times New Roman", Times, serif !important; /* Police à empattements adaptée */
                line-height: 1.62 !important; box-sizing: border-box !important;
                padding-top: 50px !important; transition: background 0.2s, color 0.2s !important;
            }
            
            /* Configuration des thèmes */
            #hare-reader-container.theme-light {
                background-color: #fbfbfb !important; color: #222222 !important;
                --toolbar-bg: #ffffff; --border-color: #e5e7eb; --hr-color: #eaeaea;
            }
            #hare-reader-container.theme-dark {
                background-color: #1a1a1a !important; color: #dddddd !important;
                --toolbar-bg: #2d2d2d; --border-color: #3c3c3c; --hr-color: #333333;
            }

            #hare-reader-toolbar {
                position: fixed !important; top: 0 !important; left: 0 !important;
                width: 100vw !important; height: 50px !important;
                background: var(--toolbar-bg) !important;
                border-bottom: 1px solid var(--border-color) !important;
                display: flex !important; align-items: center !important;
                justify-content: space-between !important; padding: 0 24px !important;
                font-family: -apple-system, system-ui, sans-serif !important; box-sizing: border-box !important;
            }
            .toolbar-brand { font-weight: 600 !important; font-size: 14px !important; }
            .toolbar-actions { display: flex !important; gap: 8px !important; }
            .toolbar-actions button {
                background: transparent !important; border: 1px solid var(--border-color) !important;
                color: inherit !important; padding: 6px 12px !important; border-radius: 4px !important;
                cursor: pointer !important; font-size: 13px !important; font-weight: 500 !important;
            }
            .toolbar-actions button:hover { background: rgba(128,128,128,0.1) !important; }
            .toolbar-actions .close-btn { color: #ff3b30 !important; font-weight: bold !important; }

            #hare-reader-content-wrapper {
                max-width: 680px !important; margin: 40px auto !important; /* Texte centré confortable */
                padding: 0 20px !important; box-sizing: border-box !important;
            }
            .hare-reader-article h1 { font-size: 32px !important; line-height: 1.25 !important; margin-bottom: 8px !important; font-family: system-ui, sans-serif !important; font-weight: 700 !important; }
            .hare-reader-article h2 { font-size: 22px !important; margin-top: 32px !important; margin-bottom: 12px !important; font-family: system-ui, sans-serif !important; }
            .hare-reader-article h3 { font-size: 18px !important; margin-top: 24px !important; margin-bottom: 8px !important; font-family: system-ui, sans-serif !important; }
            .hare-reader-article p { font-size: var(--hare-font-size, 18px) !important; margin-bottom: 20px !important; text-align: justify !important; }
            .hare-reader-article li { font-size: var(--hare-font-size, 18px) !important; margin-bottom: 10px !important; }
            
            /* Styles pour les tableaux inclus dans l'article */
            .hare-reader-article table { width: 100% !important; border-collapse: collapse !important; margin: 24px 0 !important; font-size: 14px !important; }
            .hare-reader-article th, .hare-reader-article td { border: 1px solid var(--border-color) !important; padding: 8px 12px !important; text-align: left !important; }
            .hare-reader-article th { background-color: rgba(128,128,128,0.05) !important; }
        </style>
    `;

    // --- 3. EXPOSITION DES MÉTHODES DE CONTRÔLE GÉOMÉTRIQUE (FONCTIONS WINDOW) ---
	// Ajustement de la taille du texte à la volée
	window.__hareAdjustText = function(offset) {
		const root = document.getElementById('hare-reader-container');
		let currentSize = parseInt(root.style.getPropertyValue('--hare-font-size')) || 18;
		currentSize = Math.max(14, Math.min(32, currentSize + offset)); // Bornes de sécurité entre 14px et 32px
		root.style.setProperty('--hare-font-size', currentSize + 'px');
	};
	// Alternance dynamique de thèmes
	window.__hareToggleReaderTheme = function() {
		const root = document.getElementById('hare-reader-container');
		if (root.classList.contains('theme-light')) {
		root.classList.remove('theme-light');
		root.classList.add('theme-dark');
		} else {
		root.classList.remove('theme-dark');
		root.classList.add('theme-light');
		}
	};
	// Application initiale du thème hérité
	readerContainer.className = isDark ? 'theme-dark' : 'theme-light';
	readerContainer.style.display = 'block';

	// --- 4. MASQUAGE ÉPROUVÉ DES ÉLÉMENTS DU SITE D'ORIGINE ---
	// Masquer les enfants directs du body pour forcer le focus exclusif sur l'article
	window.__hareOriginalBodyStyle = document.body.getAttribute('style') || "";

	document.body.style.overflow = 'hidden'; // Bloque le défilement de la page sous-jacente

	Array.from(document.body.children).forEach(child => {
		if (child.id !== 'hare-reader-container') {
			child.dataset.hareOriginalDisplay = child.style.display || "";
			child.style.display = 'none';
		}
	});

	// Attacher l'événement de fermeture sur la croix (✕) de la barre d'outils
	document.getElementById('hare-reader-close').addEventListener('click', () => {

	// Un second appel de ce fichier bascule (toggle) automatiquement l'affichage vers la fermeture
	// en lisant la première condition tout en haut.
	const path = require('path');
	const fs = require('fs');
	const scriptPath = path.join(__dirname, 'nanobrowser', 'reader.js');
	
	if (fs.existsSync(scriptPath)) {
		const script = fs.readFileSync(scriptPath, 'utf8');
		eval(script);
	}

	});
	
	return 'opened'; //
})();

(function() {
    // Évite d'injecter la barre plusieurs fois
    if (document.getElementById('hare-floating-nav')) return;

    // Récupération sécurisée du titre de l'application (fallback si non défini globalement)
    const applicationTitle = window.applicationTitle || "Hare Browser";
    let currentLanguage = "fr";

    // Recréation locale de la logique getDisplayUrl pour la barre autonome
    function getDisplayUrl(url, fallbackQuery = "") {
        try {
            const parsedUrl = new URL(url);
            if (parsedUrl.protocol === "file:") {
                const localPage = parsedUrl.pathname.toLowerCase();
                if (localPage.endsWith("/help.html")) return currentLanguage === "en" ? "Help" : "Aide";
                if (localPage.endsWith("/home.html")) return currentLanguage === "en" ? "Home" : "Accueil";
                if (localPage.endsWith("/welcome.html")) return currentLanguage === "en" ? "Welcome" : "Bienvenue";
            }
            
            // Vérification des fonctions globales du navigateur si existantes
            const isSearch = typeof window.isSearchResultsUrl === "function" ? window.isSearchResultsUrl(url) : false;
            const searchQuery = isSearch && typeof window.getSearchQueryFromUrl === "function"
                ? window.getSearchQueryFromUrl(url, fallbackQuery)
                : null;
                
            if (searchQuery !== null) return `${searchQuery} - ${currentLanguage === "en" ? "Search" : "Recherche"} ${applicationTitle}`;

            if (parsedUrl.hostname === "129.151.254.175") {
                return `${currentLanguage === "en" ? "Search engine" : "Moteur de recherche"} ${applicationTitle}`;
            }

            return parsedUrl.hostname.replace(/^www\./, "");
        } catch {
            return url || "";
        }
    }

    // 1. Création du conteneur de la barre flottante
    const navBar = document.createElement('div');
    navBar.id = 'hare-floating-nav';
    navBar.style = `
        position: fixed;
        top: 6px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 4px 8px;
        z-index: 2147483647;
        font-family: system-ui, sans-serif;
        transition: opacity 0.2s, background-color 0.15s, border-color 0.15s;
        touch-action: none;
    `;

    // Déplacement par la zone libre de la barre, sans gêner les boutons ni le champ URL.
    let dragOffsetX = 0;
    let dragOffsetY = 0;
    navBar.addEventListener('pointerdown', (event) => {
        if (event.button !== 0 || event.target.closest('button, input')) return;

        const bounds = navBar.getBoundingClientRect();
        dragOffsetX = event.clientX - bounds.left;
        dragOffsetY = event.clientY - bounds.top;
        navBar.style.left = `${bounds.left}px`;
        navBar.style.top = `${bounds.top}px`;
        navBar.style.transform = 'none';
        navBar.style.cursor = 'grabbing';
        navBar.setPointerCapture(event.pointerId);
        event.preventDefault();
    });

    navBar.addEventListener('pointermove', (event) => {
        if (!navBar.hasPointerCapture(event.pointerId)) return;

        const maxLeft = Math.max(0, window.innerWidth - navBar.offsetWidth);
        const maxTop = Math.max(0, window.innerHeight - navBar.offsetHeight);
        const left = Math.min(maxLeft, Math.max(0, event.clientX - dragOffsetX));
        const top = Math.min(maxTop, Math.max(0, event.clientY - dragOffsetY));
        navBar.style.left = `${left}px`;
        navBar.style.top = `${top}px`;
    });

    const stopDragging = (event) => {
        if (navBar.hasPointerCapture(event.pointerId)) {
            navBar.releasePointerCapture(event.pointerId);
            navBar.style.cursor = 'grab';
        }
    };
    navBar.addEventListener('pointerup', stopDragging);
    navBar.addEventListener('pointercancel', stopDragging);
    navBar.style.cursor = 'grab';

    navBar.addEventListener('dblclick', (event) => {
        if (event.target.closest('button, input')) return;

        navBar.style.left = '50%';
        navBar.style.top = '6px';
        navBar.style.transform = 'translateX(-50%)';
    });

    // Effet d'apparition au survol
    navBar.onmouseover = () => navBar.style.opacity = "1";
    navBar.onmouseout = () => navBar.style.opacity = "0.3";

function applyFloatingBarTheme() {
    const isDark = document.documentElement.classList.contains('dark') || 
                   document.body?.classList.contains('dark') || 
                   window.matchMedia('(prefers-color-scheme: dark)').matches;

    // Style du conteneur principal
    navBar.style.backgroundColor = isDark ? '#212121' : '#f4f4f5';
    navBar.style.border = isDark ? '1px solid #2d2d2d' : '1px solid #e4e4e7';
    navBar.style.borderRadius = '8px';
    navBar.style.boxShadow = isDark ? '0 4px 12px rgba(0,0,0,0.5)' : '0 4px 12px rgba(0,0,0,0.08)';

    // Style du champ de texte d'URL
    const input = document.getElementById('float-url');
    if (input) {
        input.style.backgroundColor = isDark ? '#212121' : '#f4f4f5';
        input.style.color = isDark ? '#8a8a8a' : '#71717a';
        input.style.border = isDark ? '1px solid #2d2d2d' : '1px solid #e4e4e7';
    }

    // Style des boutons
    document.querySelectorAll('#hare-floating-nav button').forEach(btn => {
        btn.style.color = isDark ? '#8a8a8a' : '#71717a';
    });
}

    // 2. Structure HTML interne (Utilisation immédiate de getDisplayUrl pour la valeur initiale)
    navBar.innerHTML = `
        <button id="float-back" style="background:none; border:none; cursor:pointer; font-size:11px; display:flex; align-items:center; justify-content:center; padding:4px; border-radius:4px; transition: color 0.15s;" 
            onmouseover="const isDark = document.documentElement.classList.contains('dark') || document.body?.classList.contains('dark') || window.matchMedia('(prefers-color-scheme: dark)').matches; this.style.color = isDark ? '#ffffff' : '#09090b';" 
            onmouseout="const isDark = document.documentElement.classList.contains('dark') || document.body?.classList.contains('dark') || window.matchMedia('(prefers-color-scheme: dark)').matches; this.style.color = isDark ? '#8a8a8a' : '#71717a';">◀</button>
        <button id="float-forward" style="background:none; border:none; cursor:pointer; font-size:11px; display:flex; align-items:center; justify-content:center; padding:4px; border-radius:4px; transition: color 0.15s;" 
            onmouseover="const isDark = document.documentElement.classList.contains('dark') || document.body?.classList.contains('dark') || window.matchMedia('(prefers-color-scheme: dark)').matches; this.style.color = isDark ? '#ffffff' : '#09090b';" 
            onmouseout="const isDark = document.documentElement.classList.contains('dark') || document.body?.classList.contains('dark') || window.matchMedia('(prefers-color-scheme: dark)').matches; this.style.color = isDark ? '#8a8a8a' : '#71717a';">▶</button>
        
<button id="float-reload"
    style="background:none; border:none; cursor:pointer;
           display:flex; align-items:center; justify-content:center;
           padding:4px; border-radius:4px; transition: color 0.15s;"
    onmouseover="const isDark = document.documentElement.classList.contains('dark') || document.body?.classList.contains('dark') || window.matchMedia('(prefers-color-scheme: dark)').matches; this.style.color = isDark ? '#ffffff' : '#09090b';"
    onmouseout="const isDark = document.documentElement.classList.contains('dark') || document.body?.classList.contains('dark') || window.matchMedia('(prefers-color-scheme: dark)').matches; this.style.color = isDark ? '#8a8a8a' : '#71717a';">

    <svg xmlns="http://w3.org" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 2v6h-6" />
        <path d="M20.49 15A9 9 0 1 1 21 8" />
    </svg>
</button>
    <input id="float-url" type="text" value="${getDisplayUrl(window.location.href)}" style="
        padding: 2px 8px;
        font-size: 11px;
        border-radius: 6px;
        width: 180px;
        text-align: left;
        outline: none;
        transition: background-color 0.15s, border-color 0.15s, color 0.15s;
    " />
    `;
	
	// 3. Injection dans la page web
	document.documentElement.appendChild(navBar);

	applyFloatingBarTheme();

	window.addEventListener('theme-changed', applyFloatingBarTheme);
	
	const observer = new MutationObserver(applyFloatingBarTheme);
	observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
	if(document.body) observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });

	const reloadSvg = document.querySelector('#float-reload svg');
	if (reloadSvg) {
		reloadSvg.style.transform = 'rotate(-90deg)';
	}

	// 4. Assignation des événements
    const backButton = document.getElementById('float-back');
    const forwardButton = document.getElementById('float-forward');
    backButton.title = currentLanguage === "en" ? "Back" : "Revenir";
    forwardButton.title = currentLanguage === "en" ? "Forward" : "Avancer";
    document.getElementById('float-reload').title = currentLanguage === "en" ? "Reload" : "Actualiser";

    const refreshDisplayedUrl = () => {
        const input = document.getElementById('float-url');
        if (input && document.activeElement !== input) input.value = getDisplayUrl(window.location.href);
    };
    window.tileLanguage?.get().then((language) => {
        currentLanguage = language === "en" ? "en" : "fr";
        backButton.title = currentLanguage === "en" ? "Back" : "Revenir";
        forwardButton.title = currentLanguage === "en" ? "Forward" : "Avancer";
        document.getElementById('float-reload').title = currentLanguage === "en" ? "Reload" : "Actualiser";
        refreshDisplayedUrl();
    }).catch(() => {});
    window.tileLanguage?.onChanged((language) => {
        currentLanguage = language === "en" ? "en" : "fr";
        backButton.title = currentLanguage === "en" ? "Back" : "Revenir";
        forwardButton.title = currentLanguage === "en" ? "Forward" : "Avancer";
        document.getElementById('float-reload').title = currentLanguage === "en" ? "Reload" : "Actualiser";
        refreshDisplayedUrl();
    });

    function updateNavigationState(state = {}) {
        backButton.disabled = state.canGoBack !== true;
        forwardButton.disabled = state.canGoForward !== true;
        [backButton, forwardButton].forEach((button) => {
            button.style.opacity = button.disabled ? '0.35' : '1';
            button.style.cursor = button.disabled ? 'not-allowed' : 'pointer';
        });
    }

    backButton.addEventListener('click', () => window.tileNavigation.goBack());
    forwardButton.addEventListener('click', () => window.tileNavigation.goForward());
	document.getElementById('float-reload').addEventListener('click', () => window.tileNavigation.reload());

    window.tileNavigation.onNavigationState(updateNavigationState);
    window.tileNavigation.getNavigationState()
        .then(updateNavigationState)
        .catch(() => updateNavigationState());
    
    document.getElementById('float-url').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            window.tileNavigation.loadUrl(e.target.value);
        }
    });

    // Met à jour la mini-barre d'adresse à intervalle avec getDisplayUrl
    setInterval(() => {
        const input = document.getElementById('float-url');
        if (input && document.activeElement !== input) {
            input.value = getDisplayUrl(window.location.href);
        }
    }, 2000);
})();

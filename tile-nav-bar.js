(function() {
    // Évite d'injecter la barre plusieurs fois
    if (document.getElementById('hare-floating-nav')) return;

    // 1. Création du conteneur de la barre flottante
    const navBar = document.createElement('div');
    navBar.id = 'hare-floating-nav';
    navBar.style = `
        position: fixed;
        top: 10px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 4px 8px;
        z-index: 2147483647;
        font-family: system-ui, sans-serif;
        transition: opacity 0.2s, background-color 0.15s, border-color 0.15s;
    `;

    // Effet d'apparition au survol
    navBar.onmouseover = () => navBar.style.opacity = "1";
    navBar.onmouseout = () => navBar.style.opacity = "0.3";

function applyFloatingBarTheme() {
    // Vérification robuste du mode sombre : classe 'dark' sur le HTML, le BODY, ou via les préférences système du navigateur
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

    // Style initial des boutons flèches
    document.querySelectorAll('#hare-floating-nav button').forEach(btn => {
        btn.style.color = isDark ? '#8a8a8a' : '#71717a';
    });
}

    // 2. Structure HTML interne (Boutons + Barre d'adresse miniature)
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

    <svg xmlns="http://w3.org"
         width="12"
         height="12"
         viewBox="0 0 24 24"
         fill="none"
         stroke="currentColor"
         stroke-width="2.5"
         stroke-linecap="round"
         stroke-linejoin="round">

        <path d="M21 2v6h-6" />
        <path d="M20.49 15A9 9 0 1 1 21 8" />

    </svg>
</button>
    <input id="float-url" type="text" value="${window.location.hostname}" style="
        padding: 2px 8px;
        font-size: 11px;
        border-radius: 6px;
        width: 150px;
        text-align: left;
        outline: none;
        transition: background-color 0.15s, border-color 0.15s, color 0.15s;
    " />
    `;
	
	// 3. Injection dans la page web
	document.documentElement.appendChild(navBar);

	applyFloatingBarTheme();

	// Écoute les changements de thèmes provoqués par le navigateur
	window.addEventListener('theme-changed', applyFloatingBarTheme);
	
	// Observateur en arrière-plan pour intercepter les changements de classe dynamiques sur la page
	const observer = new MutationObserver(applyFloatingBarTheme);
	observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
	if(document.body) observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });

	// Même orientation que le bouton principal
	const reloadSvg = document.querySelector('#float-reload svg');
	if (reloadSvg) {
		reloadSvg.style.transform = 'rotate(-90deg)';
	}

	// 4. Assignation des événements
	document.getElementById('float-back').addEventListener('click', () => window.tileNavigation.goBack());
	document.getElementById('float-forward').addEventListener('click', () => window.tileNavigation.goForward());
	document.getElementById('float-reload').addEventListener('click', () => window.tileNavigation.reload());
    
    // Validation de la saisie d'URL dans la mini-barre
    document.getElementById('float-url').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            window.tileNavigation.loadUrl(e.target.value);
        }
    });

    // Met à jour la mini-barre d'adresse si l'URL interne change
    setInterval(() => {
        const input = document.getElementById('float-url');
        if (input && document.activeElement !== input) {
            input.value = window.location.hostname;
        }
    }, 2000);
})();

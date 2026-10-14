(function() {
    // Évite d'injecter la barre plusieurs fois
    if (document.getElementById('hare-floating-nav')) return;

    // 1. Création du conteneur de la barre flottante
    const navBar = document.createElement('div');
    navBar.id = 'hare-floating-nav';
    navBar.style = `
        position: fixed; top: 10px; left: 50%; transform: translateX(-50%);
        display: flex; align-items: center; gap: 6px; padding: 4px 8px;
        background: rgba(37, 37, 38, 0.95); border: 1px solid #3c3c3c;
        border-radius: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        z-index: 2147483647; font-family: system-ui, sans-serif; opacity: 0.3;
        transition: opacity 0.2s ease-in-out; width: auto; max-width: 400px;
    `;

    // Effet d'apparition au survol pour ne pas masquer le site web inutilement
    navBar.onmouseover = () => navBar.style.opacity = "1";
    navBar.onmouseout = () => navBar.style.opacity = "0.3";

    // 2. Structure HTML interne (Boutons + Barre d'adresse miniature)
    navBar.innerHTML = `
        <button id="float-back" style="background:none; border:none; color:white; cursor:pointer; font-size:12px;">◀</button>
        <button id="float-forward" style="background:none; border:none; color:white; cursor:pointer; font-size:12px;">▶</button>
        <button id="float-reload" style="background:none; border:none; color:white; cursor:pointer; font-size:12px;">🔄</button>
        <input id="float-url" type="text" value="${window.location.hostname}" style="
            background: #2d2d30; border: 1px solid #555; color: #fff; padding: 2px 8px;
            font-size: 11px; border-radius: 10px; width: 180px; text-align: center;
        " />
    `;

    // 3. Injection dans la page web
    document.documentElement.appendChild(navBar);

    // 4. Assignation des événements de navigation aux boutons de la tuile
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

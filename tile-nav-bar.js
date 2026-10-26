(function () {
    if (document.getElementById("hare-floating-nav")) return;

    const applicationTitle = window.applicationTitle || "Hare Browser";
    let currentLanguage = "fr";
    let localVisible = true;
    let globallyEnabled = true;

    function getDisplayUrl(url, fallbackQuery = "") {
        try {
            const parsedUrl = new URL(url);
            if (parsedUrl.protocol === "file:") {
                const localPage = parsedUrl.pathname.toLowerCase();
                if (localPage.endsWith("/help.html")) return currentLanguage === "en" ? "Help" : "Aide";
                if (localPage.endsWith("/home.html")) return currentLanguage === "en" ? "Home" : "Accueil";
                if (localPage.endsWith("/welcome.html")) return currentLanguage === "en" ? "Welcome" : "Bienvenue";
            }
            const isSearch = typeof window.isSearchResultsUrl === "function" && window.isSearchResultsUrl(url);
            const query = isSearch && typeof window.getSearchQueryFromUrl === "function"
                ? window.getSearchQueryFromUrl(url, fallbackQuery)
                : null;
            if (query !== null) return `${query} - ${currentLanguage === "en" ? "Search" : "Recherche"} ${applicationTitle}`;
            if (parsedUrl.hostname === "129.151.254.175") {
                return `${currentLanguage === "en" ? "Search engine" : "Moteur de recherche"} ${applicationTitle}`;
            }
            return parsedUrl.hostname.replace(/^www\./, "");
        } catch {
            return url || "";
        }
    }

    const style = document.createElement("style");
    style.textContent = `
        #hare-floating-nav { position:fixed; top:6px; left:50%; transform:translateX(-50%); display:flex;
            align-items:center; gap:6px; box-sizing:border-box; width:340px; height:48px;
            min-width:min(220px, calc(100vw - 12px)); max-width:calc(100vw - 12px);
            min-height:min(44px, calc(100vh - 12px)); max-height:calc(100vh - 12px);
            padding:9px 24px 8px 8px; z-index:2147483647;
            font-family:system-ui,sans-serif; isolation:isolate; touch-action:none; overflow:hidden;
            user-select:none; -webkit-user-select:none;
            -webkit-backdrop-filter:blur(10px); backdrop-filter:blur(10px);
            transition:background-color .15s,border-color .15s,box-shadow .15s; }
        #hare-floating-nav button { flex:0 0 auto; min-width:24px; min-height:var(--nav-control-min-height, 22px); height:auto; box-sizing:border-box;
            display:flex; align-items:center; justify-content:center; padding:var(--nav-control-padding-y, 2px) .4em; border:0;
            border-radius:4px; background:transparent; cursor:pointer; font-size:var(--nav-font-size, 13px); line-height:1.25; }
        #hare-floating-nav button:disabled { cursor:not-allowed; }
        #hare-floating-nav #float-url { flex:1 1 auto; min-width:60px; min-height:var(--nav-url-min-height, 25px); width:auto; height:auto; box-sizing:border-box;
            padding:var(--nav-url-padding-y, 2px) .6em; border-radius:6px; text-align:left; outline:none;
            font-size:var(--nav-font-size, 13px); line-height:1.25; user-select:text; -webkit-user-select:text; }
        #hare-floating-nav .float-drag-handle { position:absolute; z-index:3; top:1px; left:50%;
            width:42px; height:8px; transform:translateX(-50%); border-radius:5px; cursor:grab;
            touch-action:none; opacity:.38;
            background:linear-gradient(90deg,transparent 16px,currentColor 16px 18px,transparent 18px 20px,
                currentColor 20px 22px,transparent 22px 24px,currentColor 24px 26px,transparent 26px); }
        #hare-floating-nav .float-drag-handle:hover { opacity:.8; }
        #hare-floating-nav .float-drag-handle:active { cursor:grabbing; }
        #hare-floating-nav #float-close { position:absolute; z-index:4; top:0; right:0; width:18px; min-width:18px;
            height:12px; min-height:0; padding:0 1px 1px 0; font-size:14px; line-height:10px; opacity:.55; cursor:pointer;
            border-radius:0 7px 0 5px; }
        #hare-floating-nav #float-close:hover { opacity:1; }
        #hare-floating-nav #float-close svg { display:block; width:12px; height:12px; flex:none; transform:translateX(1px); }
        #hare-floating-nav #float-reload svg { display:block; width:var(--nav-icon-size, 14px); height:var(--nav-icon-size, 14px); flex:none; }
        #hare-floating-nav .float-resize-handle { position:absolute; z-index:4; right:1px; bottom:1px; width:17px; height:17px;
            cursor:nwse-resize; opacity:.58; touch-action:none;
            background:linear-gradient(135deg,transparent 43%,currentColor 45%,currentColor 50%,transparent 52%,
            transparent 63%,currentColor 65%,currentColor 70%,transparent 72%,transparent 83%,currentColor 85%,currentColor 90%,transparent 92%); }
        #hare-floating-nav .float-resize-handle:hover { opacity:.9; }
    `;
    document.documentElement.appendChild(style);

    const navBar = document.createElement("div");
    navBar.id = "hare-floating-nav";
    navBar.style.visibility = "hidden";
    navBar.setAttribute("role", "toolbar");
    navBar.innerHTML = `
        <button id="float-back" type="button" title="Back" aria-label="Back">◀</button>
        <button id="float-forward" type="button" title="Forward" aria-label="Forward">▶</button>
        <button id="float-reload" type="button" title="Reload" aria-label="Reload">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 2v6h-6"/><path d="M20.49 15A9 9 0 1 1 21 8"/>
            </svg>
        </button>
        <input id="float-url" type="text" autocomplete="off" aria-label="Address">
        <button id="float-close" type="button" title="Hide floating navigation" aria-label="Hide floating navigation">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M6 6L18 18M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
            </svg>
        </button>
        <div class="float-drag-handle" role="presentation" title="Drag to move" aria-label="Drag to move"></div>
        <div class="float-resize-handle" role="presentation" title="Resize" aria-label="Resize"></div>
    `;
    document.documentElement.appendChild(navBar);

    const backButton = navBar.querySelector("#float-back");
    const forwardButton = navBar.querySelector("#float-forward");
    const reloadButton = navBar.querySelector("#float-reload");
    const addressInput = navBar.querySelector("#float-url");
    const closeButton = navBar.querySelector("#float-close");
    const dragHandle = navBar.querySelector(".float-drag-handle");
    const resizeHandle = navBar.querySelector(".float-resize-handle");

    function updateResponsiveControls(height = navBar.getBoundingClientRect().height) {
        // Smooth, continuous scale: 11px at 44px, 13px at 48px, then progressively up to 18px at 320px.
        const normalizedHeight = Math.max(44, Math.min(320, Number(height) || navBar.getBoundingClientRect().height));
        const fontSize = normalizedHeight <= 48
            ? 11 + ((normalizedHeight - 44) / 4) * 2
            : 13 + ((normalizedHeight - 48) / (320 - 48)) * 5;
        const controlPadding = Math.min(8, Math.max(2, 2 + (fontSize - 11) * 0.7));
        const urlPadding = Math.min(7, Math.max(2, 2 + (fontSize - 11) * 0.85));
        const iconSize = Math.min(20, Math.max(12, fontSize * 1.15));
        const controlMinHeight = fontSize * 1.25 + controlPadding * 2;
        const urlMinHeight = fontSize * 1.35 + urlPadding * 2 + 2;
        navBar.style.setProperty("--nav-font-size", `${fontSize.toFixed(2)}px`);
        navBar.style.setProperty("--nav-control-padding-y", `${controlPadding.toFixed(2)}px`);
        navBar.style.setProperty("--nav-url-padding-y", `${urlPadding.toFixed(2)}px`);
        navBar.style.setProperty("--nav-icon-size", `${iconSize.toFixed(2)}px`);
        navBar.style.setProperty("--nav-control-min-height", `${controlMinHeight.toFixed(2)}px`);
        navBar.style.setProperty("--nav-url-min-height", `${urlMinHeight.toFixed(2)}px`);
        // Direct assignment ensures the URL's computed font tracks the measured bar height in Chromium.
        addressInput.style.fontSize = `${fontSize.toFixed(2)}px`;
        addressInput.style.lineHeight = "1.25";
        [backButton, forwardButton, reloadButton].forEach((button) => {
            button.style.fontSize = `${fontSize.toFixed(2)}px`;
            button.style.paddingTop = `${controlPadding.toFixed(2)}px`;
            button.style.paddingBottom = `${controlPadding.toFixed(2)}px`;
        });
        addressInput.style.paddingTop = `${urlPadding.toFixed(2)}px`;
        addressInput.style.paddingBottom = `${urlPadding.toFixed(2)}px`;
        navBar.style.setProperty("--nav-control-gap", `${Math.max(5, Math.min(10, 5 + (height - 48) * 0.025))}px`);
        navBar.style.gap = "var(--nav-control-gap)";
    }

    function applyTheme() {
        const isDark = document.documentElement.classList.contains("dark") ||
            document.body?.classList.contains("dark") || window.matchMedia("(prefers-color-scheme: dark)").matches;
        navBar.style.backgroundColor = isDark ? "rgba(33,33,33,.82)" : "rgba(244,244,245,.86)";
        navBar.style.border = isDark ? "1px solid rgba(255,255,255,.16)" : "1px solid rgba(31,41,55,.18)";
        navBar.style.borderRadius = "8px";
        navBar.style.boxShadow = isDark ? "0 4px 12px rgba(0,0,0,.5)" : "0 4px 12px rgba(0,0,0,.1)";
        addressInput.style.backgroundColor = isDark ? "rgba(33,33,33,.58)" : "rgba(255,255,255,.65)";
        addressInput.style.color = isDark ? "#f3f4f6" : "#374151";
        addressInput.style.border = isDark ? "1px solid rgba(255,255,255,.16)" : "1px solid rgba(31,41,55,.18)";
        navBar.querySelectorAll("button, .float-drag-handle, .float-resize-handle").forEach((control) => control.style.color = isDark ? "#f3f4f6" : "#374151");
        resizeHandle.style.color = isDark ? "#f3f4f6" : "#374151";
    }

    function applyVisibility() {
        navBar.style.visibility = "visible";
        navBar.style.display = localVisible && globallyEnabled ? "flex" : "none";
    }

    function applyPosition(x, y) {
        if (Number.isFinite(x) && Number.isFinite(y)) {
            const left = Math.max(0, Math.min(window.innerWidth - navBar.offsetWidth, x));
            const top = Math.max(0, Math.min(window.innerHeight - navBar.offsetHeight, y));
            navBar.style.left = `${left}px`;
            navBar.style.top = `${top}px`;
            navBar.style.transform = "none";
        }
    }

    function updateNavigationState(state = {}) {
        backButton.disabled = state.canGoBack !== true;
        forwardButton.disabled = state.canGoForward !== true;
        [backButton, forwardButton].forEach((button) => button.style.opacity = button.disabled ? ".35" : "1");
    }

    let dragOffsetX = 0;
    let dragOffsetY = 0;
    dragHandle.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        const bounds = navBar.getBoundingClientRect();
        dragOffsetX = event.clientX - bounds.left;
        dragOffsetY = event.clientY - bounds.top;
        navBar.style.left = `${bounds.left}px`;
        navBar.style.top = `${bounds.top}px`;
        navBar.style.transform = "none";
        dragHandle.setPointerCapture(event.pointerId);
        dragHandle.style.cursor = "grabbing";
        event.preventDefault();
        event.stopPropagation();
    });
    dragHandle.addEventListener("pointermove", (event) => {
        if (!dragHandle.hasPointerCapture(event.pointerId)) return;
        const left = Math.max(0, Math.min(window.innerWidth - navBar.offsetWidth, event.clientX - dragOffsetX));
        const top = Math.max(0, Math.min(window.innerHeight - navBar.offsetHeight, event.clientY - dragOffsetY));
        navBar.style.left = `${left}px`;
        navBar.style.top = `${top}px`;
    });
    const finishDragging = (event) => {
        if (!dragHandle.hasPointerCapture(event.pointerId)) return;
        dragHandle.releasePointerCapture(event.pointerId);
        dragHandle.style.cursor = "grab";
        const bounds = navBar.getBoundingClientRect();
        window.tileFloatingNavigation?.setPosition({ x: bounds.left, y: bounds.top });
    };
    dragHandle.addEventListener("pointerup", finishDragging);
    dragHandle.addEventListener("pointercancel", finishDragging);
    navBar.addEventListener("dblclick", (event) => {
        if (event.target.closest("button, input, .float-resize-handle, .float-drag-handle")) return;
        navBar.style.left = "50%";
        navBar.style.top = "6px";
        navBar.style.transform = "translateX(-50%)";
        window.tileFloatingNavigation?.setPosition({ x: null, y: null });
    });

    let resizeStart = null;
    resizeHandle.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        const bounds = navBar.getBoundingClientRect();
        resizeStart = { x: event.clientX, y: event.clientY, width: bounds.width, height: bounds.height };
        resizeHandle.setPointerCapture(event.pointerId);
        event.preventDefault();
        event.stopPropagation();
    });
    resizeHandle.addEventListener("pointermove", (event) => {
        if (!resizeStart || !resizeHandle.hasPointerCapture(event.pointerId)) return;
        const minWidth = Math.min(220, Math.max(1, window.innerWidth - 12));
        const minHeight = Math.min(44, Math.max(1, window.innerHeight - 12));
        const width = Math.max(minWidth, Math.min(1000, resizeStart.width + event.clientX - resizeStart.x));
        const height = Math.max(minHeight, Math.min(320, resizeStart.height + event.clientY - resizeStart.y));
        navBar.style.width = `${Math.min(width, window.innerWidth - 12)}px`;
        navBar.style.height = `${Math.min(height, window.innerHeight - 12)}px`;
        updateResponsiveControls(navBar.getBoundingClientRect().height);
    });
    const finishResizing = (event) => {
        if (!resizeStart || !resizeHandle.hasPointerCapture(event.pointerId)) return;
        resizeHandle.releasePointerCapture(event.pointerId);
        resizeStart = null;
        window.tileFloatingNavigation?.setSize({ width: navBar.offsetWidth, height: navBar.offsetHeight });
    };
    resizeHandle.addEventListener("pointerup", finishResizing);
    resizeHandle.addEventListener("pointercancel", finishResizing);

    closeButton.addEventListener("click", () => {
        localVisible = false;
        applyVisibility();
        window.tileFloatingNavigation?.setVisible(false);
    });
    backButton.addEventListener("click", () => window.tileNavigation.goBack());
    forwardButton.addEventListener("click", () => window.tileNavigation.goForward());
    reloadButton.addEventListener("click", () => window.tileNavigation.reload());
    addressInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") window.tileNavigation.loadUrl(addressInput.value);
    });

    window.tileNavigation?.onNavigationState(updateNavigationState);
    window.tileNavigation?.getNavigationState().then(updateNavigationState).catch(() => updateNavigationState());
    window.tileFloatingNavigation?.onVisibilityChanged((visible) => {
        localVisible = visible === true;
        applyVisibility();
    });
    window.tileFloatingNavigation?.onGlobalChanged((enabled) => {
        globallyEnabled = enabled === true;
        applyVisibility();
    });

    const updateLanguage = (language) => {
        currentLanguage = language === "en" ? "en" : "fr";
        backButton.title = currentLanguage === "en" ? "Back" : "Revenir";
        forwardButton.title = currentLanguage === "en" ? "Forward" : "Avancer";
        reloadButton.title = currentLanguage === "en" ? "Reload" : "Actualiser";
        closeButton.title = currentLanguage === "en" ? "Hide floating navigation" : "Masquer la navigation flottante";
        closeButton.setAttribute("aria-label", closeButton.title);
        addressInput.setAttribute("aria-label", currentLanguage === "en" ? "Address" : "Adresse");
        dragHandle.title = currentLanguage === "en" ? "Drag to move" : "Glisser pour déplacer";
        dragHandle.setAttribute("aria-label", dragHandle.title);
        resizeHandle.title = currentLanguage === "en" ? "Resize" : "Redimensionner";
        resizeHandle.setAttribute("aria-label", resizeHandle.title);
    };
    window.tileLanguage?.get().then(updateLanguage).catch(() => {});
    window.tileLanguage?.onChanged(updateLanguage);

    window.tileFloatingNavigation?.getState().then((state) => {
        if (!state) return;
        localVisible = state.visible !== false;
        globallyEnabled = state.globallyEnabled !== false;
        navBar.style.width = `${state.width}px`;
        navBar.style.height = `${state.height}px`;
        applyPosition(state.x, state.y);
        updateResponsiveControls(state.height);
        applyVisibility();
    }).catch(() => applyVisibility());

    window.addEventListener("theme-changed", applyTheme);
    const observer = new MutationObserver(applyTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    if (document.body) observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    const sizeObserver = new ResizeObserver(() => updateResponsiveControls());
    sizeObserver.observe(navBar);
    applyTheme();
    updateResponsiveControls();
    addressInput.value = getDisplayUrl(window.location.href);
    setInterval(() => {
        if (document.activeElement !== addressInput) addressInput.value = getDisplayUrl(window.location.href);
    }, 2000);
})();

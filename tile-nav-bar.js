(function () {
    if (document.getElementById("hare-floating-nav")) return;

    const applicationTitle = window.applicationTitle || "Hare Browser";
    let currentLanguage = "fr";
    let localVisible = true;
    let globallyEnabled = true;
    let floatingNavigationOpacity = null;
    let floatingNavigationOpacityDefaults = null;

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
        #hare-floating-nav { 
            position: fixed !important; 
            top: 6px !important; 
            left: 50% !important; 
            transform: translateX(-50%) !important; 
            display: flex !important;
            align-items: center !important; 
            gap: var(--nav-control-gap, 6px) !important; 
            box-sizing: border-box !important; 
            width: 340px !important; 
            height: 48px !important;
            min-width: min(220px, calc(100vw - 12px)) !important; 
            max-width: calc(100vw - 12px) !important;
            min-height: min(44px, calc(100vh - 12px)) !important; 
            max-height: calc(100vh - 12px) !important;
            padding: 9px 24px 8px 8px !important; 
            z-index: 2147483647 !important;
            font-family: system-ui, -apple-system, sans-serif !important; 
            isolation: isolate !important; 
            touch-action: none !important; 
            overflow: hidden !important;
            user-select: none !important; 
            -webkit-user-select: none !important;
            -webkit-backdrop-filter: blur(10px) !important; 
            backdrop-filter: blur(10px) !important;
            margin: 0 !important;
            transform-origin: center top !important;
            zoom: normal !important;
            transition: background-color .15s, border-color .15s, box-shadow .15s !important; 
        }
        #hare-floating-nav button { 
            flex: 0 0 auto !important; 
            min-width: 24px !important; 
            min-height: var(--nav-control-min-height, 22px) !important; 
            width: auto !important; 
            height: auto !important; 
            box-sizing: border-box !important;
            display: flex !important; 
            align-items: center !important; 
            justify-content: center !important; 
            padding: var(--nav-control-padding-y, 2px) .4em !important; 
            border: 0 !important;
            border-radius: 4px !important; 
            background: transparent !important; 
            cursor: pointer !important; 
            font-size: var(--nav-font-size, 13px) !important; 
            line-height: 1.25 !important; 
            margin: 0 !important;
            text-transform: none !important;
        }
        #hare-floating-nav button:disabled { cursor: not-allowed !important; }
        #hare-floating-nav #float-url { 
            flex: 1 1 auto !important; 
            min-width: 60px !important; 
            min-height: var(--nav-url-min-height, 25px) !important; 
            width: auto !important; 
            height: auto !important; 
            box-sizing: border-box !important;
            padding: var(--nav-url-padding-y, 2px) .6em !important; 
            border-radius: 6px !important; 
            text-align: left !important; 
            outline: none !important;
            font-size: var(--nav-font-size, 13px) !important; 
            line-height: 1.25 !important; 
            user-select: text !important; 
            -webkit-user-select: text !important;
            margin: 0 !important;
            border: 1px solid transparent !important;
        }
        #hare-floating-nav .float-drag-handle { 
            position: absolute !important; 
            z-index: 3 !important; 
            top: 1px !important; 
            left: 50% !important;
            width: 42px !important; 
            height: 8px !important; 
            transform: translateX(-50%) !important; 
            border-radius: 5px !important; 
            cursor: grab !important;
            touch-action: none !important; 
            opacity: .38 !important;
            margin: 0 !important;
            background: linear-gradient(90deg,transparent 16px,currentColor 16px 18px,transparent 18px 20px,
                currentColor 20px 22px,transparent 22px 24px,currentColor 24px 26px,transparent 26px) !important; 
        }
        #hare-floating-nav .float-drag-handle:hover { opacity: .8 !important; }
        #hare-floating-nav .float-drag-handle:active { cursor: grabbing !important; }
        #hare-floating-nav #float-close { 
            position: absolute !important; 
            z-index: 4 !important; 
            top: 0 !important; 
            right: 0 !important; 
            width: 18px !important; 
            min-width: 18px !important;
            height: 12px !important; 
            min-height: 0 !important; 
            padding: 0 1px 1px 0 !important; 
            font-size: 14px !important; 
            line-height: 10px !important; 
            opacity: .55 !important; 
            cursor: pointer !important;
            border-radius: 0 7px 0 5px !important;
            background: transparent !important;
            border: none !important;
        }
        #hare-floating-nav #float-close:hover { opacity: 1 !important; }
        #hare-floating-nav #float-close svg { display: block !important; width: 12px !important; height: 12px !important; flex: none !important; transform: translateX(1px) !important; }
        #hare-floating-nav #float-reload svg { display: block !important; width: var(--nav-icon-size, 14px) !important; height: var(--nav-icon-size, 14px) !important; flex: none !important; }
        #hare-floating-nav .float-resize-handle { 
            position: absolute !important; 
            z-index: 4 !important; 
            right: 1px !important; 
            bottom: 1px !important; 
            width: 17px !important; 
            height: 17px !important;
            cursor: nwse-resize !important; 
            opacity: .58 !important; 
            touch-action: none !important;
            background: linear-gradient(135deg,transparent 43%,currentColor 45%,currentColor 50%,transparent 52%,
            transparent 63%,currentColor 65%,currentColor 70%,transparent 72%,transparent 83%,currentColor 85%,currentColor 90%,transparent 92%) !important; 
        }
        #hare-floating-nav .float-resize-handle:hover { opacity: .9 !important; }
    `;
    document.documentElement.appendChild(style);

    const navBar = document.createElement("div");
    navBar.id = "hare-floating-nav";
    navBar.style.visibility = "hidden";
    navBar.setAttribute("role", "toolbar");
    navBar.innerHTML = `
        <button id="float-back" type="button" title="Back" aria-label="Back">◀</button>
        <button id="float-forward" type="button" title="Forward" aria-label="Forward">▶</button>
        <button id="float-home" type="button" title="Home" aria-label="Home">🏠</button>
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
    const homeButton = navBar.querySelector("#float-home");
    const reloadButton = navBar.querySelector("#float-reload");
    const addressInput = navBar.querySelector("#float-url");
    const closeButton = navBar.querySelector("#float-close");
    const dragHandle = navBar.querySelector(".float-drag-handle");
    const resizeHandle = navBar.querySelector(".float-resize-handle");

    function updateResponsiveControls(height = null) {
        let rawHeight = height;
        if (!rawHeight) {
            rawHeight = navBar.style.height ? parseFloat(navBar.style.height) : 48;
        }
        
        const normalizedHeight = Math.max(44, Math.min(320, Number(rawHeight) || 48));
        
        const fontSize = normalizedHeight <= 52
            ? 13 
            : 13 + ((normalizedHeight - 48) / (320 - 48)) * 5;
            
        const controlPadding = Math.min(8, Math.max(2, 2 + (fontSize - 11) * 0.7));
        const urlPadding = Math.min(7, Math.max(2, 2 + (fontSize - 11) * 0.85));
        const iconSize = Math.min(20, Math.max(12, fontSize * 1.15));
        const controlMinHeight = fontSize * 1.25 + controlPadding * 2;
        const urlMinHeight = fontSize * 1.35 + urlPadding * 2 + 2;
        
        navBar.style.setProperty("--nav-font-size", `${fontSize.toFixed(2)}px`, "important");
        navBar.style.setProperty("--nav-control-padding-y", `${controlPadding.toFixed(2)}px`, "important");
        navBar.style.setProperty("--nav-url-padding-y", `${urlPadding.toFixed(2)}px`, "important");
        navBar.style.setProperty("--nav-icon-size", `${iconSize.toFixed(2)}px`, "important");
        navBar.style.setProperty("--nav-control-min-height", `${controlMinHeight.toFixed(2)}px`, "important");
        navBar.style.setProperty("--nav-url-min-height", `${urlMinHeight.toFixed(2)}px`, "important");
        
        addressInput.style.setProperty("font-size", `${fontSize.toFixed(2)}px`, "important");
        addressInput.style.setProperty("line-height", "1.25", "important");
        
        [backButton, forwardButton, reloadButton].forEach((button) => {
            button.style.setProperty("font-size", `${fontSize.toFixed(2)}px`, "important");
            button.style.setProperty("padding-top", `${controlPadding.toFixed(2)}px`, "important");
            button.style.setProperty("padding-bottom", `${controlPadding.toFixed(2)}px`, "important");
        });
        addressInput.style.setProperty("padding-top", `${urlPadding.toFixed(2)}px`, "important");
        addressInput.style.setProperty("padding-bottom", `${urlPadding.toFixed(2)}px`, "important");
        navBar.style.setProperty("--nav-control-gap", `${Math.max(5, Math.min(10, 5 + (normalizedHeight - 48) * 0.025))}px`, "important");
        navBar.style.setProperty("gap", "var(--nav-control-gap)", "important");
    }

    function applyTheme() {
        const isDark = document.documentElement.classList.contains("dark") ||
            document.body?.classList.contains("dark") || window.matchMedia("(prefers-color-scheme: dark)").matches;
        const themeOpacityDefault = floatingNavigationOpacityDefaults?.[isDark ? "dark" : "light"];
        const defaultOpacity = Number.isFinite(themeOpacityDefault) ? themeOpacityDefault : 1;
        const opacity = Number.isFinite(floatingNavigationOpacity)
            ? floatingNavigationOpacity
            : defaultOpacity;
        const opacityScale = defaultOpacity > 0 ? opacity / defaultOpacity : 0;
        navBar.style.setProperty("background-color", isDark ? `rgba(33,33,33,${opacity})` : `rgba(244,244,245,${opacity})`, "important");
        navBar.style.setProperty("backdrop-filter", opacity > 0 ? "blur(10px)" : "none", "important");
        navBar.style.setProperty("-webkit-backdrop-filter", opacity > 0 ? "blur(10px)" : "none", "important");
        navBar.style.setProperty("border", isDark ? "1px solid rgba(255,255,255,.16)" : "1px solid rgba(31,41,55,.18)", "important");
        navBar.style.setProperty("border-radius", "8px", "important");
        navBar.style.setProperty("box-shadow", opacity > 0 ? (isDark ? `0 4px 12px rgba(0,0,0,${Math.min(1, 0.5 * opacityScale)})` : `0 4px 12px rgba(0,0,0,${Math.min(1, 0.1 * opacityScale)})`) : "none", "important");
        const inputBackgroundOpacity = Math.min(1, (isDark ? 0.58 : 0.65) * opacityScale);
        addressInput.style.setProperty("background-color", isDark ? `rgba(33,33,33,${inputBackgroundOpacity})` : `rgba(255,255,255,${inputBackgroundOpacity})`, "important");
        addressInput.style.setProperty("color", isDark ? "#f3f4f6" : "#374151", "important");
        addressInput.style.setProperty("border", isDark ? "1px solid rgba(255,255,255,.16)" : "1px solid rgba(31,41,55,.18)", "important");
        navBar.querySelectorAll("button, .float-drag-handle, .float-resize-handle").forEach((control) => control.style.setProperty("color", isDark ? "#f3f4f6" : "#374151", "important"));
        resizeHandle.style.setProperty("color", isDark ? "#f3f4f6" : "#374151", "important");
    }

    function applyVisibility() {
        navBar.style.setProperty("visibility", "visible", "important");
        navBar.style.setProperty("display", localVisible && globallyEnabled ? "flex" : "none", "important");
    }

    function applyPosition(x, y) {
        if (Number.isFinite(x) && Number.isFinite(y)) {
            const left = Math.max(0, Math.min(window.innerWidth - navBar.offsetWidth, x));
            const top = Math.max(0, Math.min(window.innerHeight - navBar.offsetHeight, y));
            navBar.style.setProperty("left", `${left}px`, "important");
            navBar.style.setProperty("top", `${top}px`, "important");
            navBar.style.setProperty("transform", "none", "important");
        }
    }

    function updateNavigationState(state = {}) {
        backButton.disabled = state.canGoBack !== true;
        forwardButton.disabled = state.canGoForward !== true;
        [backButton, forwardButton].forEach((button) => button.style.setProperty("opacity", button.disabled ? ".35" : "1", "important"));
    }

    let dragOffsetX = 0;
    let dragOffsetY = 0;
    dragHandle.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        const bounds = navBar.getBoundingClientRect();
        dragOffsetX = event.clientX - bounds.left;
        dragOffsetY = event.clientY - bounds.top;
        navBar.style.setProperty("left", `${bounds.left}px`, "important");
        navBar.style.setProperty("top", `${bounds.top}px`, "important");
        navBar.style.setProperty("transform", "none", "important");
        dragHandle.setPointerCapture(event.pointerId);
        dragHandle.style.setProperty("cursor", "grabbing", "important");
        event.preventDefault();
        event.stopPropagation();
    });
    dragHandle.addEventListener("pointermove", (event) => {
        if (!dragHandle.hasPointerCapture(event.pointerId)) return;
        const left = Math.max(0, Math.min(window.innerWidth - navBar.offsetWidth, event.clientX - dragOffsetX));
        const top = Math.max(0, Math.min(window.innerHeight - navBar.offsetHeight, event.clientY - dragOffsetY));
        navBar.style.setProperty("left", `${left}px`, "important");
        navBar.style.setProperty("top", `${top}px`, "important");
    });
    const finishDragging = (event) => {
        if (!dragHandle.hasPointerCapture(event.pointerId)) return;
        dragHandle.releasePointerCapture(event.pointerId);
        dragHandle.style.setProperty("cursor", "grab", "important");
        const bounds = navBar.getBoundingClientRect();
        window.tileFloatingNavigation?.setPosition({ x: bounds.left, y: bounds.top });
    };
    dragHandle.addEventListener("pointerup", finishDragging);
    dragHandle.addEventListener("pointercancel", finishDragging);
    
    navBar.addEventListener("dblclick", (event) => {
        if (event.target.closest("button, input, .float-resize-handle, .float-drag-handle")) return;
        navBar.style.setProperty("left", "50%", "important");
        navBar.style.setProperty("top", "6px", "important");
        navBar.style.setProperty("transform", "translateX(-50%)", "important");
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
        navBar.style.setProperty("width", `${Math.min(width, window.innerWidth - 12)}px`, "important");
        navBar.style.setProperty("height", `${Math.min(height, window.innerHeight - 12)}px`, "important");
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
    homeButton.addEventListener("click", () => window.tileNavigation.openHomePage());
    reloadButton.addEventListener("click", () => window.tileNavigation.reload());
    addressInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") window.tileNavigation.loadUrl(addressInput.value);
    });

    addressInput.addEventListener("focus", () => {
        setTimeout(() => { addressInput.select(); }, 0);
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
    window.tileFloatingNavigation?.onOpacityChanged((opacity) => {
        floatingNavigationOpacity = Number.isFinite(opacity) ? Math.max(0, Math.min(1, opacity)) : null;
        applyTheme();
    });

    const updateLanguage = (language) => {
        currentLanguage = language === "en" ? "en" : "fr";
        backButton.title = currentLanguage === "en" ? "Back" : "Revenir";
        forwardButton.title = currentLanguage === "en" ? "Forward" : "Avancer";
        homeButton.title = currentLanguage === "en" ? "Home" : "Accueil";
        homeButton.setAttribute("aria-label", homeButton.title);
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
        floatingNavigationOpacity = Number.isFinite(state.opacity) ? Math.max(0, Math.min(1, state.opacity)) : null;
        floatingNavigationOpacityDefaults = state.opacityDefaults || null;
        navBar.style.setProperty("width", `${state.width}px`, "important");
        navBar.style.setProperty("height", `${state.height}px`, "important");
        applyPosition(state.x, state.y);
        updateResponsiveControls(state.height);
        applyTheme();
        applyVisibility();
    }).catch(() => applyVisibility());

    window.addEventListener("theme-changed", applyTheme);
    const observer = new MutationObserver(applyTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    if (document.body) observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    
    const sizeObserver = new ResizeObserver((entries) => {
        for (let entry of entries) {
            const h = entry.target.style.height ? parseFloat(entry.target.style.height) : entry.contentRect.height;
            updateResponsiveControls(h);
        }
    });
    sizeObserver.observe(navBar);
    
    applyTheme();
    updateResponsiveControls(48);
    addressInput.value = getDisplayUrl(window.location.href);
    
    setInterval(() => {
        if (document.activeElement !== addressInput) addressInput.value = getDisplayUrl(window.location.href);
    }, 2000);
})();

/*
 * Composant unique d'info-bulles « verre dépoli » de Hare Browser.
 * - Source du texte : attribut title (ou data-tooltip). Le texte n'est jamais modifié.
 * - Rendu dans un Shadow DOM isolé, en position fixe : jamais rogné par overflow, au-dessus de tout.
 * - Pages locales (file:) : attachement automatique. Pages web (barre flottante, mode lecture) : HareTooltipGlass.attach(racine).
 */
(function () {
    "use strict";
    if (window.HareTooltipGlass) return;

    var SHOW_DELAY = 450;
    var WARM_WINDOW = 400;
    var GAP = 6;
    var MARGIN = 6;

    var CSS =
        ":host{all:initial}" +
        ".tip{position:fixed;left:0;top:0;box-sizing:border-box;width:max-content;max-width:min(360px,calc(100vw - 12px));" +
        "padding:6px 10px;border-radius:10px;font:12px/1.35 'Segoe UI',system-ui,-apple-system,sans-serif;font-weight:normal;" +
        "white-space:pre-wrap;overflow-wrap:anywhere;text-align:left;pointer-events:none;" +
        "opacity:0;visibility:hidden;transform:scale(.94);" +
        "transition:opacity .16s ease,transform .16s ease,visibility 0s linear .16s;" +
        "-webkit-backdrop-filter:blur(10px) saturate(160%);backdrop-filter:blur(10px) saturate(160%);" +
        "background:rgba(255,255,255,.78);color:#111827;border:1px solid rgba(255,255,255,.65);" +
        "box-shadow:0 1px 2px rgba(15,23,42,.06),0 8px 24px rgba(15,23,42,.08),0 18px 48px rgba(15,23,42,.04)}" +
        ".tip.dark{background:rgba(28,28,32,.78);color:#f3f4f6;border-color:rgba(255,255,255,.14);" +
        "box-shadow:0 1px 2px rgba(0,0,0,.18),0 8px 24px rgba(0,0,0,.22),0 18px 48px rgba(0,0,0,.14)}" +
        ".tip.show{opacity:1;visibility:visible;transform:scale(1);transition:opacity .16s ease,transform .16s ease,visibility 0s}" +
        ".tip.overlay{left:50%!important;white-space:nowrap;word-break:normal;overflow-wrap:normal;transform:translateX(-50%) scale(.94);transform-origin:top center}" +
        ".tip.overlay.multiline{white-space:pre-wrap;overflow-wrap:anywhere}" +
        ".tip.overlay.show{transform:translateX(-50%) scale(1)}" +
        ".tip.overlay.start{left:6px!important;transform:scale(.94);transform-origin:top left}" +
        ".tip.overlay.start.show{transform:scale(1)}" +
        ".tip.overlay.end{left:calc(100% - 6px)!important;transform:translateX(-100%) scale(.94);transform-origin:top right}" +
        ".tip.overlay.end.show{transform:translateX(-100%) scale(1)}" +
        "@media (prefers-reduced-motion:reduce){.tip,.tip.show{transition:opacity .01s linear;transform:none}" +
        ".tip.overlay{transform:translateX(-50%)}.tip.overlay.start{transform:none}" +
        ".tip.overlay.end{transform:translateX(-100%)}}";

    var HOST_CSS = "position:fixed!important;left:0!important;top:0!important;width:0!important;height:0!important;" +
        "margin:0!important;padding:0!important;border:0!important;overflow:visible!important;display:block!important;" +
        "z-index:2147483647!important;pointer-events:none!important;transform:none!important;filter:none!important;" +
        "opacity:1!important;visibility:visible!important;contain:none!important";

    var attached = new WeakSet();
    var handled = new WeakSet();
    var config = { safeBottom: null };
    var state = { source: null, timer: 0, watch: 0, host: null, box: null, visible: false, lastHide: 0 };

    function textOf(el) {
        var value = el.getAttribute("data-hare-tip");
        if (value == null) value = el.getAttribute("title");
        if (value == null) value = el.getAttribute("data-tooltip");
        return value != null && value.trim() ? value : "";
    }

    function findSource(event, root) {
        var path = event.composedPath ? event.composedPath() : [event.target];
        var rootIndex = path.indexOf(root);
        if (rootIndex === -1) return null;
        for (var i = 0; i < rootIndex; i++) {
            var node = path[i];
            if (node === state.host) return null;
            if (node.nodeType === 1 && node.getAttribute && textOf(node)) return node;
        }
        return null;
    }

    // Retire le title natif pendant l'affichage pour éviter la double bulle ; l'état est restauré ensuite.
    function arm(el) {
        var title = el.getAttribute("title");
        if (title == null || !title.trim()) return;
        el.setAttribute("data-hare-tip", title);
        el.removeAttribute("title");
        if (!el.hasAttribute("aria-label") && !el.hasAttribute("aria-labelledby") && !(el.textContent || "").trim()) {
            el.setAttribute("aria-label", title);
            el.setAttribute("data-hare-tip-aria", "1");
        }
    }

    function disarm(el) {
        if (!el.hasAttribute("data-hare-tip")) return;
        if (!el.hasAttribute("title")) el.setAttribute("title", el.getAttribute("data-hare-tip"));
        el.removeAttribute("data-hare-tip");
        if (el.hasAttribute("data-hare-tip-aria")) {
            el.removeAttribute("aria-label");
            el.removeAttribute("data-hare-tip-aria");
        }
    }

    function ensureHost() {
        if (state.host && state.host.isConnected) return;
        var host = document.createElement("hare-tooltip-glass");
        host.setAttribute("style", HOST_CSS);
        var shadow = host.attachShadow({ mode: "closed" });
        try {
            var sheet = new CSSStyleSheet();
            sheet.replaceSync(CSS);
            shadow.adoptedStyleSheets = [sheet];
        } catch (e) {
            var style = document.createElement("style");
            style.textContent = CSS;
            shadow.appendChild(style);
        }
        var box = document.createElement("div");
        box.className = "tip";
        box.setAttribute("role", "tooltip");
        box.setAttribute("aria-hidden", "true");
        shadow.appendChild(box);
        state.host = host;
        state.box = box;
    }

    function parseColor(value) {
        var match = /rgba?\(([^)]+)\)/.exec(value || "");
        if (!match) return null;
        var parts = match[1].split(/[\s,\/]+/).filter(Boolean).map(parseFloat);
        if (parts.length < 3 || parts.some(isNaN)) return null;
        return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
    }

    function isDarkBehind(el) {
        for (var node = el; node; node = node.parentNode || node.host) {
            if (node.nodeType !== 1) continue;
            var color = parseColor(getComputedStyle(node).backgroundColor);
            if (color && color.a >= 0.5) {
                return (0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b) / 255 < 0.45;
            }
        }
        return !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
    }

    function place(src) {
        var box = state.box;
        var rect = src.getBoundingClientRect();
        var vw = document.documentElement.clientWidth || window.innerWidth;
        var vh = window.innerHeight;
        var w = box.offsetWidth;
        var h = box.offsetHeight;

        // Dans la fenêtre principale, les tuiles (vues natives) recouvrent le HTML sous la barre d'outils.
        var limit = vh;
        if (typeof config.safeBottom === "function") {
            var safe = Number(config.safeBottom());
            if (isFinite(safe) && safe > 0 && rect.top < safe) limit = Math.min(vh, safe);
        }

        var zone = src.closest ? src.closest("[data-tooltip-position]") : null;
        var preferred = zone ? zone.getAttribute("data-tooltip-position") : "bottom";
        var order = preferred === "top" ? ["top", "bottom", "right", "left"] : ["bottom", "top", "right", "left"];

        function clampX(x) { return Math.max(MARGIN, Math.min(x, vw - w - MARGIN)); }
        function at(side) {
            if (side === "bottom") return { x: clampX(rect.left + rect.width / 2 - w / 2), y: rect.bottom + GAP, ox: "50%", oy: "0" };
            if (side === "top") return { x: clampX(rect.left + rect.width / 2 - w / 2), y: rect.top - GAP - h, ox: "50%", oy: "100%" };
            if (side === "right") return { x: rect.right + GAP, y: rect.top + rect.height / 2 - h / 2, ox: "0", oy: "50%" };
            return { x: rect.left - GAP - w, y: rect.top + rect.height / 2 - h / 2, ox: "100%", oy: "50%" };
        }
        function fits(p) {
            return p.x >= MARGIN && p.x + w <= vw - MARGIN && p.y >= MARGIN && p.y + h <= limit;
        }

        var chosen = null;
        for (var i = 0; i < order.length; i++) {
            var candidate = at(order[i]);
            if (fits(candidate)) { chosen = candidate; break; }
        }
        if (!chosen) {
            chosen = at(order[0]);
            chosen.x = clampX(chosen.x);
            chosen.y = Math.max(MARGIN, Math.min(chosen.y, limit - h));
        }
        box.style.left = Math.round(chosen.x) + "px";
        box.style.top = Math.round(chosen.y) + "px";
        box.style.transformOrigin = chosen.ox + " " + chosen.oy;
    }

    function show(src) {
        var text = textOf(src);
        if (!text || !src.isConnected) return;
        ensureHost();
        var root = document.documentElement;
        if (root && root.lastElementChild !== state.host) root.appendChild(state.host);
        state.box.textContent = text;
        state.box.className = "tip" + (isDarkBehind(src) ? " dark" : "");
        state.box.style.removeProperty("max-width");
        state.box.setAttribute("aria-hidden", "false");
        place(src);
        state.box.classList.add("show");
        state.visible = true;
        clearInterval(state.watch);
        state.watch = setInterval(function () {
            var s = state.source;
            if (!s || !s.isConnected || !(s.matches(":hover") || s.matches(":focus-visible"))) hide();
        }, 400);
    }

    function hide() {
        clearTimeout(state.timer);
        clearInterval(state.watch);
        if (state.source) disarm(state.source);
        state.source = null;
        if (state.visible && state.box) {
            state.box.classList.remove("show");
            state.box.setAttribute("aria-hidden", "true");
            state.visible = false;
            state.lastHide = Date.now();
        }
    }

    function showOverlay(text, dark, availableWidth) {
        if (typeof text !== "string" || !text.trim()) return;
        ensureHost();
        var root = document.documentElement;
        if (root && state.host.parentNode !== root) root.appendChild(state.host);
        state.box.textContent = text;
        state.box.className = "tip overlay" + (dark === true ? " dark" : "");
        state.box.setAttribute("aria-hidden", "false");
        state.box.style.left = MARGIN + "px";
        state.box.style.top = MARGIN + "px";
        state.box.style.maxWidth = "none";
        var naturalWidth = state.box.offsetWidth;
        var viewportWidth = document.documentElement.clientWidth || window.innerWidth;
        var maxWidth = Number.isFinite(availableWidth) && availableWidth > 0
            ? Math.min(360, availableWidth)
            : Math.min(360, Math.max(12, viewportWidth - 12));
        state.box.style.maxWidth = maxWidth + "px";
        if (naturalWidth > maxWidth) state.box.classList.add("multiline");
        state.box.classList.add("show");
        state.visible = true;
        return { width: state.box.offsetWidth, height: state.box.offsetHeight };
    }

    function setOverlayAlignment(alignment) {
        if (!state.box || !state.box.classList.contains("overlay")) return;
        state.box.style.setProperty("transition", "none", "important");
        state.box.classList.remove("start", "end");
        if (alignment === "start" || alignment === "end") state.box.classList.add(alignment);
        void state.box.offsetWidth;
        state.box.style.removeProperty("transition");
    }

    function activate(src, immediate) {
        if (src === state.source) return;
        var wasVisible = state.visible;
        hide();
        if (!src) return;
        state.source = src;
        arm(src);
        var warm = wasVisible || Date.now() - state.lastHide < WARM_WINDOW;
        if (immediate || warm) {
            show(src);
        } else {
            state.timer = setTimeout(function () { if (state.source === src) show(src); }, SHOW_DELAY);
        }
    }

    function refresh() {
        var source = state.source;
        if (!source || !source.isConnected) return;
        var shouldShow = state.visible || source.matches(":hover") || source.matches(":focus-visible");
        hide();
        if (shouldShow) activate(source, true);
    }

    function once(event) {
        if (handled.has(event)) return false;
        handled.add(event);
        return true;
    }

    function attach(root) {
        if (!root || attached.has(root)) return;
        attached.add(root);
        root.addEventListener("mouseover", function (e) { if (once(e)) activate(findSource(e, root), false); }, true);
        root.addEventListener("mouseout", function (e) { if (once(e) && !e.relatedTarget) hide(); }, true);
        root.addEventListener("focusin", function (e) {
            if (!once(e)) return;
            var src = findSource(e, root);
            if (src && src.matches && src.matches(":focus-visible")) activate(src, true);
        }, true);
        root.addEventListener("focusout", function (e) { if (once(e)) hide(); }, true);
        root.addEventListener("mousedown", function (e) { if (once(e)) hide(); }, true);
        root.addEventListener("keydown", function (e) { if (once(e)) hide(); }, true);
        root.addEventListener("wheel", function (e) { if (once(e)) hide(); }, { capture: true, passive: true });
        root.addEventListener("scroll", function (e) { if (once(e)) hide(); }, { capture: true, passive: true });
    }

    window.addEventListener("blur", hide);
    window.addEventListener("pagehide", hide);

    window.HareTooltipGlass = Object.freeze({
        attach: attach,
        hide: hide,
        refresh: refresh,
        showOverlay: showOverlay,
        setOverlayAlignment: setOverlayAlignment,
        hideOverlay: hide,
        configure: function (options) {
            if (options && "safeBottom" in options) config.safeBottom = options.safeBottom;
        }
    });

    if (location.protocol === "file:") attach(document);
})();

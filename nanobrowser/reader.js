(function () {
    var HOST_ID = "hare-reader-host";
    var dark = window.__hareReaderDark === true;
    var savedPreferences = window.__hareReaderPreferences || {};

    var existing = document.getElementById(HOST_ID);
    if (existing) {
        existing.remove();
        document.documentElement.style.overflow = window.__hareReaderPrevOverflow || "";
        return "closed";
    }

    var SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, IFRAME: 1, CANVAS: 1, SVG: 1, NAV: 1, HEADER: 1, FOOTER: 1, FORM: 1,
        ASIDE: 1, DIALOG: 1, BUTTON: 1, INPUT: 1, SELECT: 1, TEXTAREA: 1, VIDEO: 1, AUDIO: 1, OBJECT: 1, EMBED: 1 };
    var KEEP = { H1: 1, H2: 1, H3: 1, H4: 1, H5: 1, H6: 1, P: 1, UL: 1, OL: 1, LI: 1, BLOCKQUOTE: 1, PRE: 1, CODE: 1,
        EM: 1, I: 1, STRONG: 1, B: 1, BR: 1, A: 1, IMG: 1, FIGURE: 1, FIGCAPTION: 1, TABLE: 1, THEAD: 1, TBODY: 1,
        TR: 1, TH: 1, TD: 1, SUP: 1, SUB: 1, HR: 1 };
    var INLINE = { A: 1, EM: 1, I: 1, STRONG: 1, B: 1, CODE: 1, SUP: 1, SUB: 1, BR: 1 };
    var UNWRAP_INLINE = { SPAN: 1, LABEL: 1, FONT: 1, SMALL: 1, MARK: 1, U: 1, ABBR: 1, TIME: 1 };
    var NOISE = /(^|[\s_-])(ads?|advert|sidebar|comments?|cookie|banner|newsletter|share|social|related|promo)($|[\s_-])/i;

    function safeHttpUrl(value) {
        try {
            var url = new URL(value, location.href);
            return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
        } catch (e) { return ""; }
    }

    function hasOnlyInline(fragment) {
        for (var i = 0; i < fragment.childNodes.length; i++) {
            var n = fragment.childNodes[i];
            if (n.nodeType === 1 && !INLINE[n.tagName]) return false;
        }
        return true;
    }

    function convert(source, out) {
        for (var i = 0; i < source.childNodes.length; i++) {
            var child = source.childNodes[i];
            if (child.nodeType === 3) { out.appendChild(document.createTextNode(child.nodeValue)); continue; }
            if (child.nodeType !== 1) continue;

            var tag = child.tagName.toUpperCase();
            if (SKIP[tag] || child.hidden || child.getAttribute("aria-hidden") === "true") continue;
            if (NOISE.test((child.className && child.className.baseVal === undefined ? child.className : "") + " " + (child.id || ""))) continue;

            if (KEEP[tag]) {
                var el = document.createElement(tag.toLowerCase());
                if (tag === "A") {
                    var href = safeHttpUrl(child.getAttribute("href"));
                    if (href) { el.href = href; el.rel = "noopener noreferrer"; el.target = "_blank"; }
                    convert(child, el);
                } else if (tag === "IMG") {
                    var src = safeHttpUrl(child.currentSrc || child.getAttribute("src") || child.getAttribute("data-src"));
                    if (!src || (child.naturalWidth && child.naturalWidth < 80)) continue;
                    el.src = src;
                    el.alt = child.getAttribute("alt") || "";
                } else if (tag !== "BR" && tag !== "HR") {
                    convert(child, el);
                }
                var empty = !el.textContent.trim() && tag !== "IMG" && tag !== "BR" && tag !== "HR" && !el.querySelector("img");
                if (!empty) out.appendChild(el);
            } else if (UNWRAP_INLINE[tag]) {
                convert(child, out);
            } else {
                var fragment = document.createDocumentFragment();
                convert(child, fragment);
                if (fragment.textContent.trim() && hasOnlyInline(fragment)) {
                    var p = document.createElement("p");
                    p.appendChild(fragment);
                    out.appendChild(p);
                } else {
                    out.appendChild(fragment);
                }
            }
        }
    }

    var candidates = document.querySelectorAll('article, [role="main"], main, .post-content, .entry-content, .article-content');
    var root = document.body;
    var best = 0;
    for (var c = 0; c < candidates.length; c++) {
        var length = (candidates[c].textContent || "").length;
        if (length > best) { best = length; root = candidates[c]; }
    }
    if (best < 200) root = document.body;

    var content = document.createElement("article");
    convert(root, content);

    if (content.textContent.replace(/\s+/g, " ").trim().length < 150) return "empty";

    var title = (document.querySelector("h1") && document.querySelector("h1").textContent.trim()) || document.title || "";
    var theme = dark
        ? { bg: "#1e1e1e", fg: "#d4d4d4", muted: "#9ca3af", link: "#8ab4f8", border: "#3c3c3c", bar: "#252526", code: "#2d2d30" }
        : { bg: "#fbfaf7", fg: "#222222", muted: "#6b7280", link: "#1d4ed8", border: "#e5e7eb", bar: "#f3f1ec", code: "#efece6" };

    var host = document.createElement("div");
    host.id = HOST_ID;
    host.style.position = "fixed";
    host.style.inset = "0";
    host.style.zIndex = "2147483647";
    var shadow = host.attachShadow({ mode: "open" });

    var savedFontSize = Number(savedPreferences.fontSize);
    var savedScrollTop = Number(savedPreferences.scrollTop);
    var fontSize = Number.isFinite(savedFontSize) ? Math.max(13, Math.min(32, savedFontSize)) : 19;
    var sheet = new CSSStyleSheet();
    sheet.replaceSync(
        ":host{all:initial}" +
        ".wrap{position:fixed;inset:0;background:" + theme.bg + ";color:" + theme.fg + ";display:flex;flex-direction:column;font-family:'Segoe UI',system-ui,sans-serif}" +
        ".bar{display:flex;align-items:center;gap:8px;box-sizing:border-box;min-height:40px;padding:8px 56px 8px 76px;background:" + theme.bar + ";border-bottom:1px solid " + theme.border + ";flex:0 0 auto}" +
        ".bar .site{flex:1 1 auto;min-width:0;font-size:12px;color:" + theme.muted + ";overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
        ".bar button{flex:0 0 auto;font:inherit;font-size:13px;min-width:30px;height:26px;border-radius:5px;cursor:pointer;border:1px solid " + theme.border + ";background:" + theme.bg + ";color:" + theme.fg + "}" +
        "@media (max-width:480px){.bar{padding-left:68px;padding-right:48px;gap:4px}.bar button{min-width:26px}}" +
        ".bar button:hover{border-color:" + theme.link + "}" +
        ".page{flex:1;overflow-y:auto;padding:32px 20px 80px}" +
        ".doc{max-width:700px;margin:0 auto;font-family:Georgia,'Times New Roman',serif;line-height:1.75}" +
        ".doc h1.title{font-size:1.9em;line-height:1.25;margin:0 0 .6em;font-family:'Segoe UI',system-ui,sans-serif}" +
        ".doc h1,.doc h2,.doc h3,.doc h4{line-height:1.3;margin:1.4em 0 .5em;font-family:'Segoe UI',system-ui,sans-serif}" +
        ".doc p,.doc li{margin:0 0 1em}" +
        ".doc a{color:" + theme.link + "}" +
        ".doc img{max-width:100%;height:auto;display:block;margin:1.2em auto;border-radius:4px}" +
        ".doc blockquote{margin:1.2em 0;padding:.2em 1em;border-left:3px solid " + theme.border + ";color:" + theme.muted + "}" +
        ".doc pre,.doc code{background:" + theme.code + ";border-radius:4px;font-family:Consolas,monospace;font-size:.85em}" +
        ".doc pre{padding:12px;overflow-x:auto}" +
        ".doc code{padding:1px 4px}.doc pre code{padding:0}" +
        ".doc table{border-collapse:collapse;margin:1em 0;font-size:.85em}" +
        ".doc td,.doc th{border:1px solid " + theme.border + ";padding:4px 8px}" +
        ".doc figcaption{font-size:.8em;color:" + theme.muted + ";text-align:center}"
    );
    shadow.adoptedStyleSheets = [sheet];

    var wrap = document.createElement("div");
    wrap.className = "wrap";

    var bar = document.createElement("div");
    bar.className = "bar";
    var site = document.createElement("span");
    site.className = "site";
    var smaller = document.createElement("button");
    var larger = document.createElement("button");
    var close = document.createElement("button");
    function shouldDisplayHostname(hostname) {
        var host = String(hostname || "").trim().toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
        if (!host || host.indexOf(".") === -1 && host.indexOf(":") === -1) return false;
        if (host === "localhost" || /\.localhost$/.test(host) || /\.(local|internal|lan)$/.test(host)) return false;
        if (host === "129.151.254.175") return false;
        if (host.indexOf(":") !== -1) return false;
        if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false;
        return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host);
    }
    function applyReaderLanguage(strings) {
        strings = strings || window.__hareReaderStrings || {};
        var title = strings.title || "Mode lecture";
        site.textContent = shouldDisplayHostname(location.hostname)
            ? title + " \u00b7 " + location.hostname
            : title;
        site.title = site.textContent;
        smaller.title = strings.smaller || "Texte plus petit";
        larger.title = strings.larger || "Texte plus grand";
        close.title = strings.close || "Quitter le mode lecture";
    }
    applyReaderLanguage();
    document.addEventListener("hare-language-changed", function () { applyReaderLanguage(); });
    smaller.textContent = "A\u2212";
    larger.textContent = "A+";
    close.textContent = "\u2715";
    bar.append(site, smaller, larger, close);

    var page = document.createElement("div");
    page.className = "page";
    var doc = document.createElement("div");
    doc.className = "doc";
    doc.style.fontSize = fontSize + "px";

    if (!content.querySelector("h1") && title) {
        var heading = document.createElement("h1");
        heading.className = "title";
        heading.textContent = title;
        doc.appendChild(heading);
    }
    doc.appendChild(content);
    page.appendChild(doc);
    wrap.append(bar, page);
    shadow.appendChild(wrap);
    page.scrollTop = Number.isFinite(savedScrollTop) ? Math.max(0, savedScrollTop) : 0;

    function saveReaderPreferences() {
        var preferences = {
            fontSize: fontSize,
            scrollTop: page.scrollTop
        };
        window.__hareReaderPreferences = preferences;
        document.dispatchEvent(new CustomEvent("hare-reader-mode-preferences", { detail: preferences }));
    }
    page.addEventListener("scroll", saveReaderPreferences, { passive: true });
    saveReaderPreferences();

    function resize(delta) {
        fontSize = Math.max(13, Math.min(32, fontSize + delta));
        doc.style.fontSize = fontSize + "px";
        saveReaderPreferences();
    }
    smaller.addEventListener("click", function () { resize(-2); });
    larger.addEventListener("click", function () { resize(2); });
    close.addEventListener("click", function () {
        host.remove();
        document.documentElement.style.overflow = window.__hareReaderPrevOverflow || "";
        document.dispatchEvent(new CustomEvent("hare-reader-mode-state", { detail: false }));
    });

    window.__hareReaderPrevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.documentElement.appendChild(host);
    if (Number.isFinite(savedScrollTop) && savedScrollTop > 0) {
        requestAnimationFrame(function () {
            page.scrollTop = savedScrollTop;
            saveReaderPreferences();
        });
    }
    return "opened";
})();

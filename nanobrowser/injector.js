// nanobrowser/injector.js
(function() {
    window.NanobrowserExecutor = {
        clickElement(selector) {
            const el = document.querySelector(selector);
            if (el) {
                el.click();
                return "Success";
            }
            return "Element not found";
        },
        
        getPageContent() {
            // On ne renvoie que du texte brut (parfaitement clonable par Electron)
            return {
                text: document.body.innerText || "",
                url: window.location.href || "",
                title: document.title || ""
            };
        }
    };
})();

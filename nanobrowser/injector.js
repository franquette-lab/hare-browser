// Exécuté explicitement par le processus principal dans la BrowserView du panneau.
(() => {
    const isUsableField = (field) => {
        if (!field || field.disabled || field.readOnly) return false;
        const style = getComputedStyle(field);
        return style.display !== "none" && style.visibility !== "hidden" && field.getClientRects().length > 0;
    };

    const getLoginForm = () => {
        const forms = Array.from(document.forms);
        const formWithPassword = forms.find((form) =>
            Array.from(form.querySelectorAll('input[type="password"]')).some((field) =>
                isUsableField(field) && field.autocomplete.toLowerCase() !== "new-password"
            )
        );
        if (formWithPassword) return formWithPassword;

        const passwordField = Array.from(document.querySelectorAll('input[type="password"]')).find(isUsableField);
        return passwordField && passwordField.autocomplete.toLowerCase() !== "new-password"
            ? passwordField.form || document.body
            : null;
    };

    window.NanobrowserExecutor = {
        clickElement(selector) {
            const element = document.querySelector(selector);
            if (!element) return "Element not found";
            element.click();
            return "Success";
        },

        getPageContent() {
            return {
                text: document.body?.innerText || "",
                url: window.location.href || "",
                title: document.title || ""
            };
        },

        hasLoginForm() {
            return !!getLoginForm();
        },

        autofillCredentials(username, password) {
            const form = getLoginForm();
            if (!form) return "No login form found";

            const passwordField = Array.from(form.querySelectorAll('input[type="password"]')).find(isUsableField);
            if (!passwordField) return "No password field found";

            const usernameCandidates = [
                '[autocomplete~="username"]',
                'input[type="email"]',
                'input[type="text"]',
                'input:not([type])'
            ];
            let usernameField = null;
            for (const selector of usernameCandidates) {
                usernameField = Array.from(form.querySelectorAll(selector)).find(isUsableField);
                if (usernameField) break;
            }

            const setNativeValue = (field, value) => {
                const prototype = field instanceof HTMLTextAreaElement
                    ? HTMLTextAreaElement.prototype
                    : HTMLInputElement.prototype;
                const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
                if (setter) setter.call(field, value);
                else field.value = value;
                field.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
                field.dispatchEvent(new Event("change", { bubbles: true }));
            };

            if (usernameField && username) setNativeValue(usernameField, username);
            setNativeValue(passwordField, password);
            return "Autofill Success";
        }
    };

    let loginFormReported = false;
    const reportLoginForm = () => {
        if (loginFormReported || !getLoginForm()) return;
        loginFormReported = true;
        document.dispatchEvent(new CustomEvent("hare-login-form-available"));
    };
    reportLoginForm();
    const loginFormObserver = new MutationObserver(reportLoginForm);
    loginFormObserver.observe(document.documentElement, { childList: true, subtree: true });
})();

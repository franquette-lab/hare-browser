// ==========================================
// nanobrowser/readability-light.js
// Moteur de lisibilité simplifié (RAG Light)
// ==========================================

function extractMainArticleContent(document) {
    if (!document || !document.body) return "";

    // 1. Cloner le corps du document pour travailler dessus sans casser la page affichée
    const bodyClone = document.body.cloneNode(true);

    // 2. Supprimer radicalement tous les éléments parasites et invisibles
    const selectorsToRemove = [
        'script', 'style', 'noscript', 'iframe', 'canvas', 'svg', 
        'nav', 'header', 'footer', 'form', 'aside', 'dialog',
        '.menu', '.sidebar', '.footer', '.header', '.nav', '.comments', '.advertising', '.ads'
    ];
    
    selectorsToRemove.forEach(selector => {
        bodyClone.querySelectorAll(selector).forEach(el => el.remove());
    });

    // 3. Stratégie de ciblage : Chercher les conteneurs prioritaires d'articles
    const priorityContainers = bodyClone.querySelectorAll('article, [role="main"], main, .post-content, .entry-content, .article-content');
    
    let targetRoot = bodyClone;
    if (priorityContainers.length > 0) {
        // Si on trouve un conteneur d'article explicite, on se focalise dessus
        targetRoot = priorityContainers[0];
    }

    // 4. Extraire uniquement les paragraphes et les titres pour reconstruire un fil textuel propre
    const textNodes = targetRoot.querySelectorAll('h1, h2, h3, h4, h5, h6, p, li');
    let cleanedTextPieces = [];

    textNodes.forEach(node => {
        const text = node.innerText ? node.innerText.trim() : "";
        
        // Filtrer les résidus vides ou trop courts (ex: liens isolés de 2 mots)
        if (text.length > 15) {
            // Ajouter un saut de ligne spécifique pour séparer les paragraphes proprement pour le LLM
            cleanedTextPieces.push(text);
        }
    });

    // 5. Fusionner le texte
    let finalContent = cleanedTextPieces.join("\n\n");

    // Si la recherche ciblée est trop agressive (page sans balises sémantiques), fallback sur le texte brut nettoyé
    if (finalContent.strip(finalContent).length < 200) {
        finalContent = bodyClone.innerText || "";
    }

    return finalContent;
}

// Helper pour nettoyer les espaces multiples
function strip(text) {
    return text.replace(/\s+/g, ' ').trim();
}

module.exports = { extractMainArticleContent };

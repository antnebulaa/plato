// ==========================================
// == SCRIPT XANO LISTING - VERSION ÉPURÉE ==
// ==========================================
document.addEventListener('DOMContentLoaded', function () {
    console.log('[NEW_SCRIPT] DOMContentLoaded');

    // Configuration de base du client Xano (simplifié pour cet exemple)
    // Vous pouvez remplacer ceci par votre initialisation de XanoClient si vous la gardez.
    const XANO_API_BASE_URL = 'https://xwxl-obyg-b3e3.p7.xano.io/api:qom0bt4V';

    const listWrapperElement = document.querySelector('[data-xano-endpoint="property/getall"]');

    if (!listWrapperElement) {
        console.error('[NEW_SCRIPT] Erreur: Conteneur de liste principal ([data-xano-endpoint="property/getall"]) non trouvé.');
        return;
    }

    const endpoint = listWrapperElement.getAttribute('data-xano-endpoint');
    const templateSelector = listWrapperElement.getAttribute('data-xano-list');
    const emptyMessage = listWrapperElement.getAttribute('data-xano-empty-message') || "Aucune donnée à afficher.";
    let itemsContainer = listWrapperElement.querySelector('[data-xano-list-container]');

    if (!itemsContainer) {
        console.warn('[NEW_SCRIPT] Avertissement: Pas de [data-xano-list-container] trouvé. Les items seront ajoutés directement au wrapper principal.');
        itemsContainer = listWrapperElement; // Fallback
    }

    if (!templateSelector) {
        console.error('[NEW_SCRIPT] Erreur: Attribut "data-xano-list" (sélecteur du template) manquant sur le wrapper.');
        itemsContainer.innerHTML = '<p style="color:red;">Erreur de configuration: data-xano-list manquant.</p>';
        return;
    }

    const templateElement = document.querySelector(templateSelector);

    if (!templateElement) {
        console.error(`[NEW_SCRIPT] Erreur: Template "${templateSelector}" introuvable dans le DOM.`);
        itemsContainer.innerHTML = `<p style="color:red;">Erreur de configuration: Template "${templateSelector}" introuvable.</p>`;
        return;
    }

    // --- Fonction pour récupérer les données ---
    async function fetchAnnouncements() {
        console.log(`[NEW_SCRIPT_FETCH] Appel à l'endpoint: ${endpoint}`);
        itemsContainer.innerHTML = '<p>Chargement des annonces...</p>'; // Message de chargement simple

        try {
            const response = await fetch(`${XANO_API_BASE_URL}/${endpoint}`); // Pas d'authentification ici car public
            
            if (!response.ok) {
                // Gérer les erreurs HTTP (4xx, 5xx)
                const errorData = await response.json().catch(() => ({ message: response.statusText }));
                throw new Error(`Erreur HTTP ${response.status}: ${errorData.message || response.statusText}`);
            }

            const responseData = await response.json();
            console.log('[NEW_SCRIPT_FETCH] Réponse brute de Xano:', JSON.stringify(responseData));

            // Logique de détection du tableau d'items (flexible)
            let itemsArray = null;
            if (Array.isArray(responseData)) { itemsArray = responseData; }
            else if (responseData && Array.isArray(responseData.items)) { itemsArray = responseData.items; }
            else if (responseData && responseData.body && Array.isArray(responseData.body.items)) { itemsArray = responseData.body.items; }
            else if (responseData && responseData.body && Array.isArray(responseData.body)) { itemsArray = responseData.body; }
            else if (responseData && typeof responseData === 'object') { // Recherche générique
                for (const key in responseData) { if (Array.isArray(responseData[key])) { itemsArray = responseData[key]; break; } }
            }

            if (itemsArray && Array.isArray(itemsArray)) {
                console.log(`[NEW_SCRIPT_FETCH] ${itemsArray.length} items trouvés.`);
                renderAnnouncements(itemsArray, templateElement, itemsContainer, emptyMessage);
            } else {
                console.warn('[NEW_SCRIPT_FETCH] Tableau d\'items non trouvé ou invalide.', responseData);
                itemsContainer.innerHTML = `<p style="color:orange;">${emptyMessage}</p>`;
            }

        } catch (error) {
            console.error('[NEW_SCRIPT_FETCH] Erreur lors de la récupération des données:', error);
            itemsContainer.innerHTML = `<p style="color:red;">Erreur de chargement: ${error.message}</p>`;
        }
    }

    // --- Fonction pour afficher les données ---
    function renderAnnouncements(items, templateNode, container, noDataMessage) {
        console.log(`[NEW_SCRIPT_RENDER] Rendu de ${items.length} items.`);
        container.innerHTML = ''; // Nettoyer le conteneur avant d'ajouter

        if (items.length === 0) {
            container.innerHTML = `<p style="padding:20px; text-align:center;">${noDataMessage}</p>`;
            return;
        }

        const fragment = document.createDocumentFragment();

        items.forEach(itemData => {
            let_clone;
            if (templateNode.tagName === 'TEMPLATE') {
                clone = templateNode.content.firstElementChild.cloneNode(true);
            } else { // Si le template est un div caché
                clone = templateNode.cloneNode(true);
                clone.style.display = ''; // Rendre visible
            }

            // --- Binding de données simple (pas de chemins imbriqués pour l'instant) ---
            clone.querySelectorAll('[data-xano-bind]').forEach(boundEl => {
                const dataKey = boundEl.getAttribute('data-xano-bind');
                if (itemData && typeof itemData === 'object' && dataKey in itemData) {
                    const value = itemData[dataKey];
                    // Gestion basique pour différents types d'éléments
                    if (boundEl.tagName.toLowerCase() === 'img') {
                        boundEl.src = value;
                    } else if (boundEl.tagName.toLowerCase() === 'a') {
                        boundEl.href = value; // Simple, pour l'instant ne met à jour que href si la clé correspond
                        if (!boundEl.textContent.trim() && typeof value === 'string') { // Met le texte si vide
                           boundEl.textContent = value;
                        }
                    } else {
                        boundEl.textContent = value;
                    }
                } else {
                    // console.warn(`[BIND_WARN] Clé "${dataKey}" non trouvée dans l'item:`, itemData);
                    // Laisser le placeholder du template ou mettre vide :
                    // boundEl.textContent = '';
                }
            });
            fragment.appendChild(clone);
        });
        container.appendChild(fragment);
        console.log('[NEW_SCRIPT_RENDER] Items ajoutés au DOM.');
    }

    // --- Lancer la récupération des données ---
    fetchAnnouncements();
});


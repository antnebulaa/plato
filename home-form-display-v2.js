// ==========================================
// == Script Xano Unifié (Formulaires + Données) ==
// ==========================================
// Date: 2025-03-30

document.addEventListener('DOMContentLoaded', function() {
    // --- Configuration du Client Xano ---
    // Si vous utilisez votre classe XanoClient personnalisée de home-form-display-v2-2.txt
    // assurez-vous que la définition de cette classe est présente avant ce script.
    // Sinon, si vous voulez utiliser le SDK Xano comme dans votre "ancien script fonctionnel",
    // vous initialiserez différemment.
    // Pour cet exemple, je suppose que vous continuez avec votre classe XanoClient personnalisée.
    const xanoClient = new XanoClient({
        apiGroupBaseUrl: 'https://xwxl-obyg-b3e3.p7.xano.io/api:qom0bt4V', // Votre URL de base Xano
    });

    // --- Initialisation pour la liste des annonces property/getall ---
    const listingElement = document.querySelector('[data-xano-endpoint="property/getall"]');
    if (listingElement) {
        console.log("[INIT] Élément pour property/getall trouvé. Appel initial.");
        
        const endpoint = listingElement.getAttribute('data-xano-endpoint');
        const method = (listingElement.getAttribute('data-xano-method') || 'GET').toUpperCase();
        const params = {}; // Pour l'appel initial à property/getall, pas de filtres

        // Récupérer les data-xano-param-* statiques s'il y en a pour property/getall
        for (const attr of listingElement.attributes) {
            if (attr.name.startsWith('data-xano-param-')) {
                params[attr.name.replace('data-xano-param-', '')] = attr.value;
            }
        }
        
        // IMPORTANT: Si property/getall est PUBLIC, on n'a pas besoin de setAuthToken ici pour CET appel.
        // Si d'autres xanoElements sur la page nécessitent une authentification, le code
        // de l'ancien script qui boucle sur xanoElements et setAuthToken pour chacun peut être pertinent.
        // Pour property/getall public, on peut simplifier :
        // const authToken = getCookie('xano_auth_token');
        // if (authToken) {
        //     // xanoClient.setAuthToken(authToken); // Uniquement si property/getall le requiert
        // }

        fetchXanoDataInternal(xanoClient, endpoint, method, params, listingElement);

        // --- Gestion des Filtres (si vous réutilisez les filtres de home-form-display-v2-2.txt) ---
        const applyFiltersButton = document.getElementById('apply-filters-button');
        const filtersForm = document.getElementById('filters-form');

        if (applyFiltersButton && filtersForm) {
            console.log("[INIT] Bouton de filtres et formulaire trouvés.");
            applyFiltersButton.addEventListener('click', function() {
                console.log("[FILTRE] Bouton Appliquer Filtres cliqué.");
                const filterParams = collectFilterValues(filtersForm); // Assurez-vous que collectFilterValues est défini
                console.log("[FILTRE] Paramètres collectés:", filterParams);
                fetchXanoDataInternal(xanoClient, endpoint, method, filterParams, listingElement);
            });
        } else {
            console.warn("[INIT] Bouton de filtres ou formulaire non trouvé. La fonctionnalité de filtre sera inactive.");
        }

    } else {
        console.warn("[INIT] Aucun élément trouvé avec data-xano-endpoint='property/getall'.");
    }

    // --- Gestion des liens de navigation génériques (hors liste) ---
    // Cette partie vient de votre script fonctionnel et peut être conservée.
    // Elle est utile pour les liens qui ne sont pas dans les items de la liste.
    document.addEventListener('xano:data-loaded', function(event) {
        const loadedElementContext = event.detail.element; // L'élément qui a chargé les données (ex: #listing-container)
        // const dataContext = event.detail.data; // Les données brutes chargées par cet élément

        // On ne cible que les liens qui ne sont PAS DANS un item de liste généré
        // car les liens DANS les items sont gérés lors du rendu de la liste.
        document.querySelectorAll('[data-xano-link-to]').forEach(linkElement => {
            if (!linkElement.closest('[data-xano-list-item]')) { // Ne pas toucher aux liens DANS les items de la liste
                const targetPage = linkElement.getAttribute('data-xano-link-to');
                const idField = linkElement.getAttribute('data-xano-link-param-id') || 'id';
                const idParamName = linkElement.getAttribute('data-xano-link-url-param') || 'id';
                let linkTarget = targetPage;

                // Pour ces liens hors liste, l'ID doit venir d'une source différente,
                // par exemple, si 'loadedElementContext' a chargé un objet unique avec un ID.
                // Ou si le lien a un data-xano-data-id statique ou mis par un autre script.
                if (linkElement.hasAttribute('data-xano-data-id')) {
                    const dataId = linkElement.getAttribute('data-xano-data-id');
                    linkTarget = `${targetPage}?${idParamName}=${encodeURIComponent(dataId)}`;
                } else if (event.detail.data && typeof event.detail.data === 'object' && event.detail.data[idField]) {
                    // Si les données chargées par l'élément parent sont un objet unique avec l'ID
                     linkTarget = `${targetPage}?${idParamName}=${encodeURIComponent(event.detail.data[idField])}`;
                }


                if (linkElement.tagName === 'A') {
                    linkElement.href = linkTarget;
                } else {
                    linkElement.setAttribute('data-xano-link-target', linkTarget);
                    linkElement.style.cursor = 'pointer';
                }
            }
        });
    });

    document.addEventListener('click', function(event) {
        const clickedElement = event.target.closest('[data-xano-link-target]');
        if (clickedElement && clickedElement.tagName !== 'A') {
            const linkTarget = clickedElement.getAttribute('data-xano-link-target');
            if (linkTarget) {
                window.location.href = linkTarget;
            }
        }
    });
});

// Renommée pour éviter conflit si vous avez un fetchXanoData pour d'autres éléments génériques.
async function fetchXanoDataInternal(client, endpoint, method, params, targetElement) {
    console.log(`[FETCH_DATA_INTERNAL] Appel API: ${method} ${endpoint}, Params:`, JSON.stringify(params));
    const loadingIndicatorSelector = targetElement.getAttribute('data-xano-loading-selector');
    const loadingIndicator = loadingIndicatorSelector ? document.querySelector(loadingIndicatorSelector) : null;
    if (loadingIndicator) loadingIndicator.style.display = 'block';

    let responseData = null; // Pour stocker la réponse brute pour les événements
    let itemsToRender = []; // Tableau d'items extrait
    let errorMessage = null;

    try {
        // Utilisation de client._request pour être cohérent avec home-form-display-v2-2.txt
        // Assurez-vous que votre classe XanoClient a bien les méthodes get, post, etc.
        // ou une méthode _request générique. Le script fonctionnel utilisait client.get(), etc.
        // Je vais supposer que client.get() existe et est correct.
        if (method === 'GET') {
            responseData = await client.get(endpoint, params);
        } else {
            throw new Error(`Méthode HTTP ${method} non implémentée pour cette fonction simplifiée.`);
        }

        console.log(`[FETCH_DATA_INTERNAL] Réponse BRUTE de XANO:`, JSON.stringify(responseData));
        rawResponseForEvents = responseData; // Conserver pour l'événement

        // --- Logique de Détection Flexible du Tableau d'Items (inspirée de l'ancien script) ---
        if (!responseData || typeof responseData !== 'object') {
            console.error('[DATA_ERROR] Réponse XANO invalide ou non-objet:', responseData);
            errorMessage = "Erreur: Données serveur au format inattendu.";
        } else if (Array.isArray(responseData)) {
            itemsToRender = responseData;
            console.log('[DATA_EXTRACT] Items trouvés: la réponse est directement un tableau.');
        } else { 
            if (Array.isArray(responseData.items)) {
                itemsToRender = responseData.items;
                console.log('[DATA_EXTRACT] Items trouvés dans responseData.items');
            } else if (responseData.body) { 
                if (Array.isArray(responseData.body.items)) {
                    itemsToRender = responseData.body.items;
                    console.log('[DATA_EXTRACT] Items trouvés dans responseData.body.items');
                } else if (Array.isArray(responseData.body)) {
                    itemsToRender = responseData.body;
                    console.log('[DATA_EXTRACT] Items trouvés dans responseData.body (tableau direct)');
                }
            }
            if (itemsToRender.length === 0 && !(Array.isArray(responseData.items) || (responseData.body && (Array.isArray(responseData.body.items) || Array.isArray(responseData.body))))) {
                 let foundDynamically = false;
                 for (const key in responseData) {
                     if (Array.isArray(responseData[key])) {
                         itemsToRender = responseData[key];
                         console.warn(`[DATA_EXTRACT_WARN] Items trouvés dynamiquement dans responseData.${key}`);
                         foundDynamically = true; break;
                     }
                 }
                 if (!foundDynamically && responseData.body && typeof responseData.body === 'object') {
                     for (const key in responseData.body) {
                         if (Array.isArray(responseData.body[key])) {
                             itemsToRender = responseData.body[key];
                             console.warn(`[DATA_EXTRACT_WARN] Items trouvés dynamiquement dans responseData.body.${key}`); break;
                         }
                     }
                 }
            }
             if (itemsToRender.length === 0) {
                 console.warn('[DATA_WARN] Aucun tableau d\'items identifiable après toutes les vérifications. La liste sera vide ou affichera un message "vide". Réponse:', responseData);
            }
        }
        console.log(`[DATA_READY] ${itemsToRender.length} items préparés pour l'affichage.`);

    } catch (error) {
        console.error(`[FETCH_DATA_INTERNAL_FAIL] Erreur:`, error.message, error.stack);
        rawResponseForEvents = { error: { message: error.message, stack: error.stack }};
        errorMessage = `Erreur Xano: ${error.message || 'Impossible de charger les données.'}`;
    } finally {
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        
        renderListItemsInternal(itemsToRender, targetElement, errorMessage);

        // Dispatch events
        if (!errorMessage) {
            targetElement.dispatchEvent(new CustomEvent('xano:data-loaded', {
                detail: { data: rawResponseForEvents, element: targetElement, params: params }, bubbles: true
            }));
        } else {
            targetElement.dispatchEvent(new CustomEvent('xano:data-error', {
                detail: { error: {message: errorMessage}, response: rawResponseForEvents, element: targetElement, params: params }, bubbles: true
            }));
        }
    }
}

// Inspiré de renderData (partie liste) + renderListData de l'ancien script ET de home-form-display-v2-2.txt
function renderListItemsInternal(dataArray, listWrapperElement, errorMessage) {
    console.log('[RENDER_LIST_INTERNAL] Début. Items:', dataArray ? dataArray.length : 'N/A', 'Erreur:', errorMessage);

    const itemsContainer = listWrapperElement.querySelector('[data-xano-list-container]') || listWrapperElement;
    const templateSelector = listWrapperElement.getAttribute('data-xano-list');
    const templateElement = templateSelector ? document.querySelector(templateSelector) : null;

    itemsContainer.innerHTML = ''; // Nettoyage

    if (errorMessage) {
        itemsContainer.innerHTML = `<p style="color:red; padding:20px; text-align:center;">${errorMessage}</p>`;
        return;
    }
    if (!templateElement) {
        itemsContainer.innerHTML = `<p style="color:red; padding:20px; text-align:center;">Erreur de configuration : Template "${templateSelector || 'non spécifié'}" introuvable.</p>`;
        return;
    }
    if (!Array.isArray(dataArray)) { // Sécurité additionnelle
        console.warn("[RENDER_LIST_INTERNAL] dataArray n'est pas un tableau. Affichage message vide.", dataArray);
        dataArray = [];
    }

    if (templateElement.tagName !== 'TEMPLATE') {
        templateElement.style.display = 'none'; // Cacher le modèle div s'il n'est pas une balise <template>
    }

    if (dataArray.length === 0) {
        const emptyMsg = listWrapperElement.getAttribute('data-xano-empty-message') || "Aucune donnée à afficher.";
        itemsContainer.innerHTML = `<div class="xano-empty-message" style="padding:20px; text-align:center;">${emptyMsg}</div>`;
        return;
    }

    const fragment = document.createDocumentFragment();
    dataArray.forEach((item, index) => {
        const clone = (templateElement.tagName === 'TEMPLATE')
            ? templateElement.content.firstElementChild.cloneNode(true)
            : templateElement.cloneNode(true);

        clone.style.display = ''; // Assurer la visibilité
        clone.setAttribute('data-xano-list-item', ''); // Marqueur pour styles ou scripts futurs
        clone.setAttribute('data-xano-item-index', index.toString());

        // Utiliser VOTRE bindDataToElement de home-form-display-v2-2.txt
        // qui gère les chemins imbriqués et le slider.
        // Il faut s'assurer qu'il est appelé pour chaque élément du clone qui a des bindings.
        
        // Si bindDataToElement s'attend à ce qu'on lui passe l'élément qui a l'attribut data-xano-bind :
        clone.querySelectorAll('[data-xano-bind]').forEach(boundEl => {
            bindDataToElement(boundEl, item);
        });
        // Et pour les attributs, si votre bindDataToElement les gère aussi (comme celui de home-form-display-v2-2.txt ligne 251+)
        // On peut l'appeler sur chaque élément. Il ne fera rien s'il ne trouve pas d'attributs de binding.
        // Ou être plus spécifique si bindDataToElement ne scanne pas tous les attributs de lui-même.
        // Le bindDataToElement de home-form-display-v2-2.txt scanne les attributs de l'élément qu'on lui donne.
        // Donc, on l'appelle sur le clone et ses descendants pertinents.
        bindDataToElement(clone, item); // Pour le clone lui-même
        clone.querySelectorAll('*').forEach(child => bindDataToElement(child, item)); // Pour tous les descendants


        // Gestion des liens DANS l'item (adapté de home-form-display-v2-2.txt)
        clone.querySelectorAll('[data-xano-link-to]').forEach(linkEl => {
            const targetPage = linkEl.getAttribute('data-xano-link-to');
            const idField = linkEl.getAttribute('data-xano-link-param-id') || 'id';
            const idParamName = linkEl.getAttribute('data-xano-link-url-param') || 'id';
            const idValue = getNestedValue(item, idField); // IMPORTANT: Utiliser getNestedValue
            if (idValue !== undefined && idValue !== null) {
                const finalLink = `${targetPage}?${idParamName}=${encodeURIComponent(idValue)}`;
                if (linkEl.tagName === 'A') linkEl.href = finalLink;
                else {
                     linkEl.setAttribute('data-xano-link-target', finalLink); // Pour clics sur non-<a>
                     linkEl.style.cursor = 'pointer';
                }
            }
        });
        // Si le clone lui-même est un lien
        if (clone.hasAttribute('data-xano-link-to')) {
            const targetPage = clone.getAttribute('data-xano-link-to');
            const idField = clone.getAttribute('data-xano-link-param-id') || 'id';
            const idParamName = clone.getAttribute('data-xano-link-url-param') || 'id';
            const idValue = getNestedValue(item, idField);
            if (idValue !== undefined && idValue !== null) {
                const finalLink = `${targetPage}?${idParamName}=${encodeURIComponent(idValue)}`;
                if (clone.tagName === 'A') clone.href = finalLink;
                else { clone.setAttribute('data-xano-link-target', finalLink); clone.style.cursor = 'pointer';}
            }
        }
        
        fragment.appendChild(clone);
    });
    itemsContainer.appendChild(fragment);

    // Initialisation Swiper (adapté de home-form-display-v2-2.txt)
    // Cette partie s'attend à ce que bindDataToElement pour _property_photos_slider
    // ait marqué les .swiper avec data-slider-init="true"
    const slidersToInitialize = itemsContainer.querySelectorAll('.swiper[data-slider-init="true"]');
    console.log(`[RENDER_LIST_INTERNAL] Sliders à initialiser: ${slidersToInitialize.length}`);
    slidersToInitialize.forEach((swiperEl, sliderIndex) => {
        console.log(`[SWIPER] Préparation init slider #${sliderIndex}:`, swiperEl);
        setTimeout(() => {
            try {
                const slides = swiperEl.querySelectorAll('.swiper-slide');
                const enableLoop = slides.length > 1;
                console.log(`[SWIPER] Initialisation slider #${sliderIndex}. Slides: ${slides.length}, Loop: ${enableLoop}`);
                const swiperInstance = new Swiper(swiperEl, {
                    loop: enableLoop, spaceBetween: 10, slidesPerView: 1,
                    pagination: { el: swiperEl.querySelector('.swiper-pagination'), clickable: true, dynamicBullets: true, dynamicMainBullets: 5 },
                    navigation: { nextEl: swiperEl.querySelector('.swiper-button-next'), prevEl: swiperEl.querySelector('.swiper-button-prev') },
                    observer: true, observeParents: true, observeSlideChildren: true, updateOnWindowResize: true,
                });
                swiperInstance.update();
                swiperEl.removeAttribute('data-slider-init');
                console.log(`[SWIPER] Slider #${sliderIndex} initialisé.`);
            } catch (e) { console.error(`[SWIPER_ERROR] sur slider #${sliderIndex}:`, e, swiperEl); }
        }, 300);
    });
    console.log('[RENDER_LIST_INTERNAL] Terminé.');
}

// N'oubliez pas d'avoir la fonction getNestedValue que j'ai fournie précédemment si vous l'utilisez:
function getNestedValue(obj, pathString) {
    if (!obj || !pathString) return undefined;
    const path = pathString.split('.');
    let current = obj;
    for (let i = 0; i < path.length; i++) {
        // Gérer le cas où un segment du chemin est un indice de tableau (ex: "images.0.url")
        const segment = path[i];
        const arrayMatch = segment.match(/^(\w+)\[(\d+)]$/); // ex: items[0] -> NON, c'est pour "0" comme clé
                                                          // Ici, on veut juste "0", "1", etc. comme clé
        if (current === null || current === undefined) return undefined;

        if (Array.isArray(current) && !isNaN(parseInt(segment, 10))) { // Si current est un tableau et segment est un nombre
            current = current[parseInt(segment, 10)];
        } else if (typeof current[segment] === 'undefined') {
            return undefined;
        } else {
            current = current[segment];
        }
    }
    return current;
}

// ==========================================
// == Fonctions Logiques (Fetch, Render)   ==
// ==========================================

async function fetchXanoData(client, endpoint, method, params, targetElement, loadingIndicator) {
    try {
        let responseData;
        // Utiliser les méthodes du client Xano
        switch (method) {
            case 'GET':
                responseData = await client.get(endpoint, params);
                break;
            case 'POST': // Peut être utilisé pour fetch avec un body spécifique (rare pour juste afficher)
                responseData = await client.post(endpoint, params); // params serait le body ici
                break;
            case 'PUT':
            case 'PATCH':
                 console.warn(`Utilisation de ${method} avec data-xano-endpoint. Est-ce intentionnel pour récupérer des données ?`);
                 // Si PUT/PATCH doit envoyer un corps, il faudrait le récupérer d'une source.
                 // Ici, on suppose que `params` pourrait être le corps.
                 responseData = await client[method.toLowerCase()](endpoint, params);
                 break;
            case 'DELETE': // Rarement utilisé pour *afficher* des données après
                 responseData = await client.delete(endpoint, params);
                 break;
            default:
                throw new Error(`Méthode HTTP non supportée pour data-xano-endpoint: ${method}`);
        }

        // Cacher l'indicateur de chargement AVANT le rendu
        if (loadingIndicator) loadingIndicator.style.display = 'none';

        renderData(responseData, targetElement); // Utilise le helper

        // Déclencher l'événement de succès après le rendu
        const successEvent = new CustomEvent('xano:data-loaded', {
             detail: { data: responseData, element: targetElement },
             bubbles: true
         });
         targetElement.dispatchEvent(successEvent);

    } catch (error) {
        console.error(`Erreur lors de la récupération des données pour ${endpoint}:`, error);
        if (loadingIndicator) loadingIndicator.style.display = 'none'; // Cacher aussi en cas d'erreur

        // Afficher l'erreur dans l'élément cible
        const errorDisplay = targetElement.querySelector('[data-xano-error]') || targetElement; // Cherche un sous-élément ou utilise l'élément principal
        if (errorDisplay) {
            errorDisplay.textContent = `Erreur: ${error.message || 'Impossible de charger les données.'}`;
            // On pourrait ajouter un style pour l'erreur ici
             errorDisplay.style.color = 'red';
        }

        const errorEvent = new CustomEvent('xano:data-error', {
            detail: { error: error, element: targetElement },
            bubbles: true
        });
        targetElement.dispatchEvent(errorEvent);
    }
}

function renderData(data, element) {
    console.log("renderData APPELÉ. Données reçues:", data, "Élément cible:", element); // LOG 14
    // Si l'élément a un attribut data-xano-list, c'est une liste
    if (element.hasAttribute('data-xano-list')) {
        // Trouver les données de liste (plus robuste)
        let listData = null;

         // ---- DEBUT MODIFICATION ----
        if (data && Array.isArray(data.items)) { // Cible directement data.items
            listData = data.items;
        } else if (Array.isArray(data)) { // Au cas où la réponse serait directement un tableau
            listData = data;
        }
        // ---- FIN MODIFICATION ----
        // L'ancienne logique avec potentialDataSources peut être commentée ou supprimée pour l'instant.

        console.log("renderData: listData déterminé (après modif):", listData); // LOG 15 (garder)
        if (listData && Array.isArray(listData)) {
            renderListData(listData, element);
        
        } else {
            console.warn('Aucun tableau de données trouvé dans la réponse pour la liste:', data);
             renderListData([], element); // Afficher la liste comme vide
            // Optionnellement, afficher une erreur plus explicite
             // element.textContent = "Erreur : Données de liste non valides ou non trouvées.";
        }
    } else {
        // Sinon, c'est un élément unique (ou un conteneur pour des éléments uniques)
        // Les données peuvent être dans data.body ou data directement
         const sourceData = data?.body ? data.body : data;

         if (sourceData && typeof sourceData === 'object'){
              // Lier les données aux enfants directs ou descendants avec data-xano-bind
             const boundElements = element.querySelectorAll('[data-xano-bind]');
             if(boundElements.length > 0){
                boundElements.forEach(boundElement => {
                    // Ne pas lier si l'élément est DANS un template de liste potentiel à l'intérieur de cet élément
                    if (!boundElement.closest('[data-xano-list] [data-xano-bind]')) {
                        bindDataToElement(boundElement, sourceData); // Utilise le helper
                    }
                });
             } else if (element.hasAttribute('data-xano-bind')){
                 // Si l'élément lui-même a data-xano-bind (cas moins courant pour un conteneur)
                 bindDataToElement(element, sourceData);
             }

         } else {
             console.warn("Données pour l'élément unique non trouvées ou non objet:", sourceData);
             // Que faire ici ? Afficher un message ? Laisser l'élément tel quel ?
             // element.textContent = "Données non disponibles.";
         }
    }
}

function renderListData(dataArray, listContainerElement) {
    dataArray = Array.isArray(dataArray) ? dataArray : [];

    const templateSelector = listContainerElement.getAttribute('data-xano-list');
    if (!templateSelector) {
         console.error("L'attribut data-xano-list doit contenir un sélecteur CSS pour le template.", listContainerElement);
         listContainerElement.textContent = "Erreur: Attribut data-xano-list manquant ou vide.";
         return;
    }

    const templateElement = document.querySelector(templateSelector);
    if (!templateElement) {
        console.error(`Élément template "${templateSelector}" introuvable.`);
        listContainerElement.textContent = `Erreur: Template "${templateSelector}" introuvable.`;
        return;
    }

    // Conteneur: soit un enfant spécifique, soit l'élément lui-même
    const container = listContainerElement.querySelector('[data-xano-list-container]') || listContainerElement;

     // Vider le conteneur, en préservant le template s'il est à l'intérieur
     // Et en préservant les éléments qui ne sont PAS des data-xano-list-item générés précédemment
     let currentChild = container.firstChild;
     while (currentChild) { /* ... logique de vidage ... */ 
         const nextChild = currentChild.nextSibling;
         // Ne supprimer que les éléments générés précédemment OU si le conteneur est l'élément principal
         // Et s'assurer de ne pas supprimer le template lui-même
         if (currentChild !== templateElement && currentChild.nodeType === Node.ELEMENT_NODE && currentChild.hasAttribute('data-xano-list-item')) {
             container.removeChild(currentChild);
         } else if (container === listContainerElement && currentChild !== templateElement && currentChild.nodeType === Node.ELEMENT_NODE) {
             // Si container = listContainerElement, on peut vouloir vider plus agressivement
             // Sauf si l'utilisateur a mis d'autres éléments statiques qu'il veut garder ?
             // Pour l'instant, on ne supprime que les items générés.
             // Option : Vider tout sauf le template si container === listContainerElement
              // container.removeChild(currentChild);
         }
         currentChild = nextChild;
     }


    // S'assurer que le template est bien caché (s'il n'est pas déjà dans une balise <template>)
     if (templateElement.tagName !== 'TEMPLATE') {
        templateElement.style.display = 'none';
        templateElement.setAttribute('aria-hidden', 'true'); // Pour l'accessibilité
     }


    // Générer les éléments de la liste
    if (dataArray.length > 0) {
        dataArray.forEach((item, index) => {
            // Cloner depuis le contenu de <template> ou l'élément lui-même
            const clone = templateElement.tagName === 'TEMPLATE'
                ? templateElement.content.cloneNode(true).firstElementChild // Prend le premier élément du fragment cloné
                : templateElement.cloneNode(true);

            if (!clone) {
                console.error("Échec du clonage du template. Vérifiez la structure du template.", templateElement);
                return; // Passer à l'item suivant
            }

            // Rendre visible et marquer l'élément cloné
            clone.style.display = ''; // Enlever le display:none potentiel
            clone.removeAttribute('aria-hidden');
            clone.setAttribute('data-xano-list-item', ''); // Marqueur pour l'item généré
            clone.setAttribute('data-xano-item-index', index.toString()); // Index (utile pour debug ou style)

            // Lier les données aux sous-éléments [data-xano-bind]
            const boundElements = clone.querySelectorAll('[data-xano-bind]');
            boundElements.forEach(boundElement => {
                bindDataToElement(boundElement, item); // Utilise le helper
            });
            // Si le clone lui-même a data-xano-bind (cas d'un template simple comme juste <li>)
            if (clone.hasAttribute('data-xano-bind')){
                 bindDataToElement(clone, item);
            }

            // Gérer les liens dynamiques [data-xano-link-to] dans le clone
            const linkElements = clone.querySelectorAll('[data-xano-link-to]');
            linkElements.forEach(linkElement => {
                const targetPage = linkElement.getAttribute('data-xano-link-to');
                const idField = linkElement.getAttribute('data-xano-link-param-id') || 'id';
                const idParamName = linkElement.getAttribute('data-xano-link-url-param') || 'id';

                let linkTarget = targetPage; // Lien par défaut si pas d'ID
                const idValue = item[idField];

                if (idValue !== undefined && idValue !== null) {
                    linkTarget = `${targetPage}?${idParamName}=${encodeURIComponent(idValue)}`;
                } else {
                     console.warn(`ID field "${idField}" non trouvé dans l'item pour le lien`, item);
                 }

                // Mettre à jour la cible du lien
                if (linkElement.tagName === 'A') {
                    linkElement.href = linkTarget;
                } else {
                    linkElement.setAttribute('data-xano-link-target', linkTarget);
                    linkElement.style.cursor = 'pointer';
                }
            });
             // Si le clone lui-même a data-xano-link-to
             if (clone.hasAttribute('data-xano-link-to')){
                 const targetPage = clone.getAttribute('data-xano-link-to');
                 const idField = clone.getAttribute('data-xano-link-param-id') || 'id';
                 const idParamName = clone.getAttribute('data-xano-link-url-param') || 'id';
                 let linkTarget = targetPage;
                 const idValue = item[idField];
                 if (idValue !== undefined && idValue !== null) {
                     linkTarget = `${targetPage}?${idParamName}=${encodeURIComponent(idValue)}`;
                 }
                 if (clone.tagName === 'A') { clone.href = linkTarget; }
                 else { clone.setAttribute('data-xano-link-target', linkTarget); clone.style.cursor = 'pointer'; }
             }


            // Ajouter le clone au conteneur
            container.appendChild(clone);
        });


        // --- NOUVELLE SECTION : INITIALISATION DES SLIDERS SWIPER ---
        // Après que tous les clones ont été ajoutés au DOM et peuplés
        const slidersToInitialize = container.querySelectorAll('.swiper[data-slider-init="true"]');
        console.log(`renderListData: Trouvé ${slidersToInitialize.length} sliders à initialiser.`); // Log de débogage
        
        slidersToInitialize.forEach((swiperEl, sliderIndex) => {
        console.log(`renderListData: Initialisation du slider #${sliderIndex} pour l'élément:`, swiperEl); // Log de débogage

            // Compter les slides réellement présents dans ce conteneur swiper spécifique
       const slides = swiperEl.querySelectorAll('.swiper-slide');
       const enableLoop = slides.length > 1; // Activer la boucle seulement s'il y a plus d'une image
       console.log(`renderListData: Slider #${sliderIndex} a ${slides.length} slides. Loop activée: ${enableLoop}`); // Log de débogage

            // Donner un ID unique au conteneur du swiper peut être utile si vous avez des styles spécifiques
            // ou si vous voulez y accéder plus tard, mais pas indispensable pour l'init Swiper
            // swiperEl.id = `swiper-${listContainerElement.id}-item-${sliderIndex}`; 
 // --- AJOUT D'UN DÉLAI ---
    // On attend un tout petit peu que le DOM se stabilise (surtout dans une grille)
    setTimeout(() => {
            console.log(`renderListData: Exécution de l'initialisation (avec délai) pour Slider #${sliderIndex}.`);
            try { 
                const slides = swiperEl.querySelectorAll('.swiper-slide');
                const enableLoop = slides.length > 1; 
                console.log(`renderListData: Slider #${sliderIndex} a ${slides.length} slides. Loop activée: ${enableLoop}`);

                const swiperInstance = new Swiper(swiperEl, { 
                    // Options SwiperJS
                    loop: enableLoop, 
                    spaceBetween: 10, 
                    slidesPerView: 1, // Assurez-vous que c'est bien 1 par défaut
                    pagination: {
                        el: swiperEl.querySelector('.swiper-pagination'),
                        clickable: true,
                        dynamicBullets: true, 
                        dynamicMainBullets: 5, 
                    },
                    navigation: {
                        nextEl: swiperEl.querySelector('.swiper-button-next'),
                        prevEl: swiperEl.querySelector('.swiper-button-prev'),
                    },
                    observer: true,         // Surveille les changements du slider lui-même
                    observeParents: true,   // Surveille les changements des parents (important pour Grid/Flex)
                    observeSlideChildren: true, // Surveille changements dans les slides
                    updateOnWindowResize: true, // Se met à jour si la fenêtre change de taille
                });

                // Forcer une mise à jour immédiatement après l'initialisation Swiper
                // Cela peut l'aider à prendre les dimensions correctes une fois initialisé
                swiperInstance.update(); 
                console.log(`renderListData: Slider #${sliderIndex} initialisé et update() appelé.`);
        
        swiperEl.removeAttribute('data-slider-init'); // Important: Enlever l'attribut après initialisation réussie
    } catch (swiperError) {
        console.error(`Erreur lors de l'initialisation de Swiper pour le slider #${sliderIndex}:`, swiperEl, swiperError);
    }
                }, 5000); // Essayez avec 250ms ou 300ms ou même 500ms si nécessaire
    }); // Fin de requestAnimationFrame

// --- FIN SECTION D'INITIALISATION SWIPER AMÉLIORÉE ---
        
    } else {
        // Afficher un message si aucune donnée (amélioration)
        const emptyMessage = listContainerElement.getAttribute('data-xano-empty-message') || "Aucune donnée à afficher.";
        // Vérifier s'il existe déjà un message vide pour ne pas le dupliquer
        if (!container.querySelector('.xano-empty-message')) {
             const messageElement = document.createElement('div'); // Ou 'p', 'li' selon le contexte
             messageElement.className = 'xano-empty-message'; // Classe pour styliser
             messageElement.textContent = emptyMessage;
             container.appendChild(messageElement);
        }
    }
}


function bindDataToElement(element, data) {
    const dataKey = element.getAttribute('data-xano-bind');
    if (!dataKey) return; // Pas de clé de binding

    // --- NOUVELLE LOGIQUE POUR LE SLIDER D'IMAGES ---
    if (dataKey === '_property_photos_slider') {
        const photosArray = data._property_photos; // Accède au tableau _property_photos de l'item actuel
        const swiperContainer = element.querySelector('.swiper'); // Cible le conteneur .swiper
        
        if (!swiperContainer) {
            console.warn("Conteneur .swiper non trouvé pour le slider de l'annonce:", data.id, "Élément:", element);
            return;
        }
        const swiperWrapper = swiperContainer.querySelector('.swiper-wrapper');

        if (photosArray && Array.isArray(photosArray) && swiperWrapper) {
            swiperWrapper.innerHTML = ''; // Vider les slides précédents au cas où

            if (photosArray.length > 0) {
                photosArray.forEach(photoEntry => {
                    // Votre structure de données montre que 'images' est un tableau,
                    // et l'URL est dans le premier élément de ce tableau 'images'.
                    if (photoEntry.images && photoEntry.images.length > 0 && photoEntry.images[0].url) {
                        const imageUrl = photoEntry.images[0].url;
                        const slideElement = document.createElement('div');
                        slideElement.className = 'swiper-slide';
                        
                        const imgElement = document.createElement('img');
                        imgElement.src = imageUrl;
                        // Essayez d'ajouter un alt pertinent
                        imgElement.alt = data.property_title ? `Photo de ${data.property_title}` : "Photo de la propriété"; 
                        // Vous pouvez ajouter des styles à imgElement si nécessaire, ex: imgElement.style.width = '100%';
                        
                        slideElement.appendChild(imgElement);
                        swiperWrapper.appendChild(slideElement);
                    }
                });
                // On ne initialise PAS Swiper ici. On va le marquer pour initialisation.
                swiperContainer.setAttribute('data-slider-init', 'true'); // Marqueur pour l'initialisation
                element.style.display = ''; // S'assurer que le conteneur du slider est visible
            } else {
                // Pas de photos, on cache le conteneur principal du slider pour cette annonce
                element.style.display = 'none'; 
            }
        } else {
            // Si photosArray n'existe pas ou n'est pas un tableau, ou si swiperWrapper est introuvable
            console.warn("Pas de données photos valides ou structure de slider incorrecte pour l'annonce:", data.id, "Élément:", element);
            element.style.display = 'none'; // Cacher le conteneur du slider
        }
        return; // Traitement spécifique pour le slider terminé
    }
    // --- FIN NOUVELLE LOGIQUE POUR LE SLIDER D'IMAGES ---

    // Gestion de clés imbriquées simples (ex: user.name ou _property_lease_of_property.0.loyer)
    let value = data;
    const keys = dataKey.split('.');
    for (const keyPart of keys) { // Renommé 'key' en 'keyPart' pour éviter conflit avec 'key' de la boucle précédente
        if (value && typeof value === 'object' && keyPart in value) {
            value = value[keyPart];
        } else {
            // Clé non trouvée ou donnée intermédiaire non objet
            // console.warn(`Clé "${dataKey}" (partie "${keyPart}") non trouvée ou chemin invalide dans:`, data); // Peut être verbeux
            value = undefined; // Marquer comme non trouvé
            break;
        }
    }

    // Si la valeur finale est null ou undefined, on peut vouloir afficher une valeur par défaut ou rien
     const displayValue = value ?? ''; // Affiche une chaîne vide si null/undefined

    // Appliquer la valeur à l'élément
    switch (element.tagName.toLowerCase()) {
        case 'img':
            // Cette condition est pour s'assurer qu'on ne met pas à jour le src des <img> DANS le slider
            // si l'élément <img> lui-même avait un data-xano-bind (ce qui n'est pas le cas ici, on le crée dynamiquement)
            if (!element.closest('.swiper-slide')) { 
                element.src = displayValue;
            }
            break;
        case 'iframe':
        case 'video':
        case 'audio':
        case 'source': // Pour <video><source src="..."></video>
            element.src = displayValue;
            break;
        case 'input':
             if (element.type === 'checkbox' || element.type === 'radio') {
                 // Comparer la valeur de l'input avec la donnée
                 // Cocher si la valeur de l'input correspond à la donnée (pour radio)
                 // ou si la donnée est "truthy" (pour checkbox simple)
                 // Ceci est une interprétation simple, peut nécessiter ajustement
                 if (element.type === 'checkbox'){
                     element.checked = !!value; // Coché si truthy, décoché si falsy/null/undefined
                 } else { // radio
                     element.checked = (element.value == value); // Comparaison non stricte peut être utile
                 }
             } else if (element.type === 'date' && value) {
                 // Formater pour input[type=date] (YYYY-MM-DD)
                 try {
                     element.value = new Date(value).toISOString().split('T')[0];
                 } catch (e) { element.value = ''; console.warn("Impossible de formater la date", value); }
             } else if (element.type === 'datetime-local' && value) {
                  // Formater pour input[type=datetime-local] (YYYY-MM-DDTHH:mm)
                  try {
                     const d = new Date(value);
                      // Ajuster pour le fuseau horaire local si nécessaire avant formatage
                      // Ceci peut être complexe. Version simple sans ajustement timezone:
                     element.value = d.toISOString().substring(0, 16);
                  } catch (e) { element.value = ''; console.warn("Impossible de formater datetime-local", value); }
             }
             else {
                 element.value = displayValue;
             }
            break;
        case 'textarea':
        case 'select':
            element.value = displayValue;
            break;
        case 'a':
             // Ne met à jour href que si ce n'est pas géré par data-xano-link-to
            if (!element.hasAttribute('data-xano-link-to')) { // Ne pas écraser les liens gérés par data-xano-link-to
                 element.href = displayValue;
            }
             // Mettre à jour le texte du lien si vide ou si dataKey != 'href'
             if (!element.textContent.trim() || dataKey !== 'href') { 
                  element.textContent = displayValue;
              }
            break;
        // Cas pour les éléments qui utilisent innerHTML (à utiliser avec prudence à cause de XSS)
        // case 'div':
        // case 'span':
        //     if (element.hasAttribute('data-xano-bind-html')) { // Attribut spécifique pour HTML
        //         element.innerHTML = value; // Attention XSS ! N'utiliser que si la source est sûre.
        //     } else {
        //         element.textContent = displayValue;
        //     }
        //     break;
        default:
            // Par défaut, mettre à jour textContent (plus sûr que innerHTML)
            element.textContent = displayValue;
    }

    // Gérer les attributs liés (data-xano-bind-attr-*)
    for (const attr of element.attributes) {
        if (attr.name.startsWith('data-xano-bind-attr-')) {
            const attrName = attr.name.replace('data-xano-bind-attr-', '');
            const attrValueKey = attr.value; // La valeur de cet attribut est la clé dans l'objet data

             // Gestion de clés imbriquées pour la valeur de l'attribut
             let attrValue = data;
             const attrKeys = attrValueKey.split('.');
             for (const key of attrKeys) {
                 if (attrValue && typeof attrValue === 'object' && key in attrValue) {
                     attrValue = attrValue[key];
                 } else {
                     attrValue = undefined;
                     break;
                 }
             }

            if (attrValue !== undefined) {
                // Pour les attributs booléens (disabled, checked, selected...),
                // leur présence/absence est importante.
                if (typeof attrValue === 'boolean') {
                     if (attrValue) {
                         element.setAttribute(attrName, ''); // Ajoute l'attribut (ex: disabled)
                     } else {
                         element.removeAttribute(attrName); // Retire l'attribut
                     }
                } else {
                    element.setAttribute(attrName, attrValue);
                }
            } else {
                 // Si la donnée n'est pas trouvée, on peut vouloir retirer l'attribut
                 element.removeAttribute(attrName);
                 console.warn(`Clé "${attrValueKey}" pour l'attribut "${attrName}" non trouvée.`);
            }
        }
    }

     // Stocker l'ID si l'élément est aussi un lien (pour référence future si nécessaire)
     if (element.hasAttribute('data-xano-link-to') && data?.id !== undefined) {
         element.setAttribute('data-xano-data-id', data.id);
     }
}


// ==========================================
// == Fonctions Utilitaires (Helpers)      ==
// ==========================================

// Fonction pour collecter les données du formulaire avec prise en charge des fichiers
// (Identique au script 1)
function collectFormDataWithFiles(form) {
    const formData = new FormData();
    const inputs = form.querySelectorAll('input, select, textarea');

    inputs.forEach((input) => {
        const fieldName = input.getAttribute('data-xano-field-name') || input.name;
        if (!fieldName) return; // Ignorer les champs sans nom ou data-xano-field-name

        if (input.type === 'file') {
            // Utiliser data-xano-bind pour le nom du champ fichier si présent
             const fileFieldName = input.getAttribute('data-xano-bind') || fieldName;
            Array.from(input.files).forEach((file) => {
                formData.append(fileFieldName, file);
            });
        } else if (input.type === 'checkbox') {
             if (input.checked) {
                 // Gérer les groupes de checkboxes avec la même `name`
                 if (formData.has(fieldName)) {
                     // Si existe déjà, convertir en tableau si ce n'est pas déjà fait
                     let existing = formData.getAll(fieldName);
                     formData.delete(fieldName); // Supprimer les anciennes clés
                     existing.forEach(val => formData.append(fieldName, val)); // Remettre les anciennes
                     formData.append(fieldName, input.value); // Ajouter la nouvelle
                 } else {
                     formData.append(fieldName, input.value); // Première checkbox avec ce nom
                 }
             } else if (!form.querySelector(`input[type="checkbox"][name="${input.name}"]:checked`)) {
                  // Si AUCUNE checkbox avec ce nom n'est cochée, on pourrait vouloir envoyer une valeur vide ?
                  // Par défaut, FormData n'envoie rien pour une checkbox décochée. C'est souvent OK.
                  // formData.append(fieldName, ''); // Décommentez si besoin d'envoyer vide.
             }
        } else if (input.type === 'radio') {
            if (input.checked) {
                formData.append(fieldName, input.value);
            }
        }
         else {
            formData.append(fieldName, input.value);
        }
    });

    return formData;
}

// Fonction pour obtenir un paramètre de l'URL
// (Identique aux scripts précédents)
function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

// Fonction pour obtenir un cookie
// (Identique aux scripts précédents)
function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') {
            c = c.substring(1, c.length);
        }
        if (c.indexOf(nameEQ) === 0) {
            return decodeURIComponent(c.substring(nameEQ.length, c.length));
        }
    }
    return null;
}

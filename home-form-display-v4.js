// ==========================================
// == SCRIPT XANO LISTING - VERSION ÉPURÉE V4 ==
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

  // DANS VOTRE SCRIPT home-form-display-v3.txt
// REMPLACEZ VOTRE fetchAnnouncements ACTUELLE PAR CELLE-CI :

async function fetchAnnouncements(params = {}) { // <<<< ACCEPTE params ICI, avec {} comme valeur par défaut
    // Assurez-vous que 'endpoint', 'itemsContainer', 'XANO_API_BASE_URL', 
    // 'templateElement', et 'emptyMessage' sont accessibles ici.
    // Ils sont définis dans la portée de DOMContentLoaded, donc c'est bon car fetchAnnouncements y est aussi définie.

    console.log(`[NEW_SCRIPT_FETCH] Appel à l'endpoint: ${endpoint} avec params:`, JSON.stringify(params));
    
    if (!itemsContainer) { // Juste une sécurité
        console.error("[NEW_SCRIPT_FETCH] ERREUR: itemsContainer n'est pas défini!");
        return;
    }
    itemsContainer.innerHTML = '<p>Chargement des annonces...</p>'; 

    let urlToFetch = `${XANO_API_BASE_URL}/${endpoint}`;
    let paramsForURL = { ...params }; // Copier les params pour ne pas modifier l'original si besoin ailleurs

        // --- MODIFICATION IMPORTANTE POUR LES FILTRES DE TYPE TABLEAU (comme house_type) ---
// Gestion de house_type
if (paramsForURL.house_type && Array.isArray(paramsForURL.house_type)) {
    if (paramsForURL.house_type.length > 0) {
        if (paramsForURL.house_type.length === 1) {
            // Si un seul élément, envoyer comme une chaîne simple
            paramsForURL.house_type = paramsForURL.house_type[0];
            console.log(`[NEW_SCRIPT_FETCH_DEBUG] house_type (valeur unique) transformé en string: "${paramsForURL.house_type}"`);
        } else {
            // Si plusieurs éléments, envoyer comme une chaîne CSV (séparée par des virgules)
            paramsForURL.house_type = paramsForURL.house_type.join(','); // <--- REVENIR A JOIN(',')
            console.log(`[NEW_SCRIPT_FETCH_DEBUG] house_type (valeurs multiples) transformé en CSV string: "${paramsForURL.house_type}"`);
        }
    } else {
        // Si le tableau est vide, supprimer le paramètre
        delete paramsForURL.house_type;
        console.log("[NEW_SCRIPT_FETCH_DEBUG] house_type était un tableau vide, supprimé des paramètres URL.");
    }
}
        // Répétez ce bloc if ci-dessus pour d'autres filtres qui seraient des tableaux et que Xano attend en CSV

    // NOUVEAU : Gestion de city (similaire à house_type)
    if (paramsForURL.city && Array.isArray(paramsForURL.city)) {
        if (paramsForURL.city.length > 0) {
            if (paramsForURL.city.length === 1) {
                paramsForURL.city = paramsForURL.city[0]; // Une seule ville -> chaîne simple
            } else {
                paramsForURL.city = paramsForURL.city.join(','); // Plusieurs villes -> chaîne CSV
            }
            console.log(`[NEW_SCRIPT_FETCH_DEBUG] city transformé en: "${paramsForURL.city}"`);
        } else {
            delete paramsForURL.city; // Tableau de villes vide, on supprime le paramètre
        }
    }
    // Construction de l'URL (s'assurer que paramsForURL est bien utilisé pour cleanParamsForURL)
    if (Object.keys(paramsForURL).length > 0) {
        const cleanParamsForURL = {};
        for (const key in paramsForURL) {
            if (paramsForURL[key] !== null && paramsForURL[key] !== undefined) {
                if (typeof paramsForURL[key] === 'string' && paramsForURL[key].trim() !== '') {
                    cleanParamsForURL[key] = paramsForURL[key];
                } else if (typeof paramsForURL[key] === 'number' || typeof paramsForURL[key] === 'boolean') {
                    cleanParamsForURL[key] = paramsForURL[key];
                }
                // Note: Si un paramètre est un tableau ici (ne devrait plus être le cas pour city/house_type), 
                // URLSearchParams le transformera en CSV par défaut.
            }
        }
        if (Object.keys(cleanParamsForURL).length > 0) {
            urlToFetch += '?' + new URLSearchParams(cleanParamsForURL).toString();
        }
    }
        console.log('[NEW_SCRIPT_FETCH] URL finale pour l\'appel fetch:', urlToFetch); // LOG TRÈS IMPORTANT
 
        try {
        const response = await fetch(urlToFetch);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: response.statusText }));
            updateFilterButtonText(null); // Appel en cas d'erreur HTTP
            throw new Error(`Erreur HTTP ${response.status}: ${errorData.message || response.statusText}`);
        }

        const responseData = await response.json();
        console.log('[FETCH_RESPONSE] Réponse brute de Xano:', JSON.stringify(responseData, null, 2));

        // --- SECTION POUR EXTRAIRE itemsArray ET totalItemsFromServer ---
        let itemsArray = null;
        let totalItemsFromServer = 0;

// 1. LOGIQUE COMBINÉE POUR TROUVER itemsArray :
        if (responseData && responseData.result1 && Array.isArray(responseData.result1.items)) {
            itemsArray = responseData.result1.items;
            console.log('[FETCH_EXTRACT] itemsArray trouvé dans result1.items:', itemsArray.length + " items");
        } else {
            console.warn("[NEW_SCRIPT_FETCH] Structure attendue responseData.result1.items non trouvée. Tentative de fallbacks pour itemsArray...");
            if (Array.isArray(responseData)) {
                itemsArray = responseData;
            } else if (responseData && Array.isArray(responseData.items)) {
                itemsArray = responseData.items;
            } else if (responseData && responseData.body && Array.isArray(responseData.body.items)) {
                itemsArray = responseData.body.items;
            } else if (responseData && responseData.body && Array.isArray(responseData.body)) {
                itemsArray = responseData.body;
            } else if (responseData && typeof responseData === 'object' && responseData !== null) {
                for (const key in responseData) {
                    if (Array.isArray(responseData[key])) {
                        itemsArray = responseData[key];
                        console.log(`[NEW_SCRIPT_FETCH] itemsArray trouvé via fallback dans responseData.${key}`);
                        break;
                    }
                }
            }
        }

        // 2. LOGIQUE POUR TROUVER totalItemsFromServer :
        if (responseData && typeof responseData.totalItemsCount === 'number') {
            totalItemsFromServer = responseData.totalItemsCount;
            console.log('[FETCH_EXTRACT] totalItemsFromServer trouvé dans responseData.totalItemsCount:', totalItemsFromServer);
        } else if (responseData && responseData.result1 && typeof responseData.result1.itemsTotal === 'number') {
            totalItemsFromServer = responseData.result1.itemsTotal;
            console.log('[FETCH_EXTRACT] totalItemsFromServer trouvé via fallback dans responseData.result1.itemsTotal:', totalItemsFromServer);
        } else if (itemsArray && itemsArray.length > 0) {
            totalItemsFromServer = itemsArray.length;
            console.warn("[NEW_SCRIPT_FETCH] Aucun total (totalItemsCount ou result1.itemsTotal) trouvé. Fallback sur la longueur des items de la page:", totalItemsFromServer);
        } else {
             console.warn('[NEW_SCRIPT_FETCH] Aucun total trouvé et pas d\'itemsArray pour fallback. totalItemsFromServer sera 0.');
        }
        // --- FIN DE LA SECTION D'EXTRACTION ---

        // --- LOGIQUE D'AFFICHAGE ET MISE À JOUR DU BOUTON (C'EST CETTE PARTIE) ---
        if (itemsArray && Array.isArray(itemsArray)) {
            console.log(`[FETCH_PROCESS] Affichage de ${itemsArray.length} items. Total global rapporté pour bouton: ${totalItemsFromServer}.`);
            renderAnnouncements(itemsArray, templateElement, itemsContainer, emptyMessage);
            updateFilterButtonText(totalItemsFromServer); // APPEL CRUCIAL
        } else {
            console.warn('[FETCH_PROCESS] itemsArray final est null ou non tableau. Pas de rendu. Total rapporté pour bouton:', totalItemsFromServer);
            if (itemsContainer) itemsContainer.innerHTML = `<p style="color:orange;">${emptyMessage}</p>`;
            updateFilterButtonText(totalItemsFromServer); // Mettre à jour le bouton même si pas d'items (pour afficher "0 trouvés")
        }
        // --- FIN DE LA LOGIQUE D'AFFICHAGE ---

    } catch (error) {
        console.error('[FETCH_ERROR] Erreur lors de la récupération ou du traitement des données:', error);
        if (itemsContainer) itemsContainer.innerHTML = `<p style="color:red;">Erreur: ${error.message}</p>`;
        updateFilterButtonText(null); // Texte d'erreur/par défaut sur le bouton
    }
}

    // --- Fonction pour afficher les données ---
    function renderAnnouncements(items, templateNode, container, noDataMessage) {
    console.log(`[NEW_SCRIPT_RENDER] Rendu de ${items.length} items.`);
    container.innerHTML = ''; // Nettoyer le conteneur avant d'ajouter

    if (items.length === 0) {
        const emptyEl = document.createElement('div');
        emptyEl.className = 'empty-state-message';
        emptyEl.innerHTML = `<p style="padding:20px; text-align:center;">${noDataMessage}</p>`;
        container.appendChild(emptyEl);
        console.log("[NEW_SCRIPT_RENDER] Aucun item à afficher, message d'état vide ajouté.");
        return;
    }

    const fragment = document.createDocumentFragment();
    items.forEach(itemData => { // DÉBUT DE LA BOUCLE items.forEach
        const propertyId = getNestedValue(itemData, 'id'); 

        let clone;
        if (templateNode.tagName !== 'TEMPLATE') {
            clone = templateNode.cloneNode(true);
            clone.style.display = ''; // Rendre visible
            clone.removeAttribute('id'); // Éviter les IDs dupliqués
        } else {
            console.error("Le template est une balise <template>, la logique de clonage doit être ajustée si ce n'est pas un div.");
            return; 
        }

        // --- DÉBUT SECTION FAVORIS ---
        // Assurez-vous que le sélecteur ici est correct pour trouver le bouton dans votre template.
        // Si 'bouton-sauvegarder-annonce' est une CLASSE, il faut un point devant : '.bouton-sauvegarder-annonce'
        const favoriteButton = clone.querySelector('.favorite-btn'); // J'ai ajouté le '.' pour une classe
        
        if (favoriteButton && propertyId !== undefined && propertyId !== null) {
            favoriteButton.dataset.propertyId = propertyId.toString();
        } else {
            if (!favoriteButton) console.warn("[RENDER_FAVORIS] Bouton .favorite-btn non trouvé dans le template pour l'item:", itemData);
            if (propertyId === undefined || propertyId === null) console.warn("[RENDER_FAVORIS] ID de propriété non trouvé pour l'item:", itemData);
        }
        // --- FIN SECTION FAVORIS ---

        // --- DÉBUT DE LA SECTION DE BINDING (RÉINTÉGRÉE) ---
        // Ces fonctions doivent être définies globalement ou accessibles dans cette portée.
        // Elles étaient présentes dans votre fichier original en dehors du DOMContentLoaded.
        if (typeof bindDataToElement === 'function') {
            bindDataToElement(clone, itemData); 
            clone.querySelectorAll('*').forEach(descendantElement => {
                bindDataToElement(descendantElement, itemData);
            });
        } else {
            console.warn("La fonction bindDataToElement n'est pas définie.");
        }
        // --- FIN DE LA SECTION DE BINDING ---


        // --- DÉBUT DE LA SECTION À MODIFIER/AJOUTER ---
       
        

        if (favoriteButton && propertyId !== undefined && propertyId !== null) {
            favoriteButton.dataset.propertyId = propertyId.toString();

            // Récupérer l'URL de la photo de couverture
            let coverPhotoUrl = null;
            if (itemData._property_photos && 
                itemData._property_photos.length > 0 &&
                itemData._property_photos[0].images &&
                itemData._property_photos[0].images.length > 0 &&
                itemData._property_photos[0].images[0].url) {
                
                coverPhotoUrl = itemData._property_photos[0].images[0].url;
            } else {
                console.warn(`[RENDER_ANNONCES] Aucune photo de couverture trouvée pour l'annonce ID: ${propertyId}`);
                // Optionnel: définir une URL de placeholder si aucune photo n'est trouvée
                // coverPhotoUrl = 'URL_DE_VOTRE_PLACEHOLDER_IMAGE'; 
            }

            // Ajouter l'attribut data-cover-photo-url
            if (coverPhotoUrl) {
                favoriteButton.dataset.coverPhotoUrl = coverPhotoUrl;
                console.log(`[RENDER_ANNONCES] Attribut data-cover-photo-url="${coverPhotoUrl}" ajouté au bouton favori pour l'annonce ID: ${propertyId}`);
            } else {
                 console.warn(`[RENDER_ANNONCES] coverPhotoUrl est null ou vide pour l'annonce ID: ${propertyId}, l'attribut data-cover-photo-url ne sera pas ajouté.`);
            }

        } else {
            if (!favoriteButton) console.warn("[RENDER_ANNONCES] Bouton .favorite-btn non trouvé dans le template pour l'item:", itemData);
            if (propertyId === undefined || propertyId === null) console.warn("[RENDER_ANNONCES] ID de propriété non trouvé pour l'item:", itemData);
        }
        // --- FIN DE LA SECTION À MODIFIER/AJOUTER ---
        
            
        // --- CRÉATION DU LIEN VERS LA PAGE DE DÉTAIL (RÉINTÉGRÉE) ---
        if (propertyId !== undefined && propertyId !== null) {
            const anchor = document.createElement('a');
            anchor.href = `annonce?id=${propertyId}`; // Adaptez si besoin
            anchor.style.textDecoration = 'none';
            anchor.style.color = 'inherit';
            anchor.style.display = 'block'; 
            
            anchor.appendChild(clone); // Met le clone (la carte) DANS le lien
            fragment.appendChild(anchor); // Ajoute le lien (avec la carte dedans) au fragment
        } else {
            console.warn("[NEW_SCRIPT_RENDER] Propriété sans ID valide, lien de détail non créé pour:", itemData);
            fragment.appendChild(clone); // Si pas d'ID, ajoute le clone directement (sans lien)
        }
        // --- FIN DE LA CRÉATION DU LIEN ---
    }); // FIN DE LA BOUCLE items.forEach
        
    container.appendChild(fragment); // Ajoute tous les items préparés au conteneur
    console.log("[NOM_DE_VOTRE_FONCTION_RENDER] Items ajoutés au DOM."); 
    
    if (typeof initializePageSwipers === 'function') {
        initializePageSwipers(container);
    }
    
    document.dispatchEvent(new CustomEvent('annoncesChargeesEtRendues', { detail: { container: container } }));
    console.log("[NOM_DE_VOTRE_FONCTION_RENDER] Terminé.");
}
        
  
    // --- Lancer la récupération des données ---
    fetchAnnouncements();

    // --- INITIALISATION DES FILTRES ---
    const filtersFormElement = document.getElementById('filters-form'); // L'ID de votre <form>
    const applyFiltersButtonElement = document.getElementById('apply-filters-button'); // L'ID de votre bouton

    if (filtersFormElement && applyFiltersButtonElement) {
        console.log("[FILTRES_SETUP] Formulaire et bouton de filtre trouvés.");
        applyFiltersButtonElement.addEventListener('click', function(event) {
            event.preventDefault(); // Empêche la soumission standard du formulaire
            console.log("[FILTRES_ACTION] Clic sur 'Appliquer les filtres'.");

            const collectedParams = collectFilterValues(filtersFormElement);
            console.log("[FILTRES_ACTION] Paramètres de filtre pour l'API:", JSON.stringify(collectedParams));

            // On réutilise la fonction fetchAnnouncements avec les paramètres collectés
            // La variable 'endpoint' est déjà définie dans la portée de DOMContentLoaded
            fetchAnnouncements(collectedParams); 
        });
    } else {
        if (!filtersFormElement) console.warn("[FILTRES_SETUP] AVERTISSEMENT: Formulaire avec ID 'filters-form' non trouvé.");
        if (!applyFiltersButtonElement) console.warn("[FILTRES_SETUP] AVERTISSEMENT: Bouton avec ID 'apply-filters-button' non trouvé.");
    }
    // --- FIN DE L'INITIALISATION DES FILTRES ---

    // --- NOUVEAU : INITIALISATION DES SLIDERS DE FOURCHETTE ---
    console.log("[SLIDERS_SETUP] Initialisation des sliders de fourchette.");

    const loyerSliderWrapper = document.getElementById('slider-loyer-wrapper'); // L'ID du div que vous avez mis dans le HTML
    if (loyerSliderWrapper) {
        console.log("[SLIDERS_SETUP] Conteneur pour slider de loyer trouvé. Création du slider.");
        createRangeSlider({
            containerElement: loyerSliderWrapper,
            min: 0,
            max: 10000,
            step: 100,
            initialMin: 0, 
            initialMax: 10000,
            minFilterKey: 'min_loyer', // Sera utilisé par collectFilterValues
            maxFilterKey: 'max_loyer', // Sera utilisé par collectFilterValues
            unit: ' €'
        });
    } else {
        console.warn("[SLIDERS_SETUP] AVERTISSEMENT: Conteneur avec ID 'slider-loyer-wrapper' non trouvé.");
    }

    // Exemple pour un futur slider de surface
    const surfaceSliderWrapper = document.getElementById('slider-surface-wrapper');
    if (surfaceSliderWrapper) {
        console.log("[SLIDERS_SETUP] Conteneur pour slider de surface trouvé. Création du slider.");
        createRangeSlider({
            containerElement: surfaceSliderWrapper,
            min: 0,
            max: 500,
            step: 5,
            initialMin: 0,
            initialMax: 500,
            minFilterKey: 'min_surface',
            maxFilterKey: 'max_surface',
            unit: ' m²'
        });
    } else {
        console.warn("[SLIDERS_SETUP] AVERTISSEMENT: Conteneur avec ID 'slider-surface-wrapper' non trouvé.");
    }
    // --- FIN DE L'INITIALISATION DES SLIDERS DE FOURCHETTE ---
});



function getNestedValue(obj, pathString) {
    if (!obj || !pathString || typeof pathString !== 'string') return undefined;
    const path = pathString.split('.');
    let current = obj;
    for (let i = 0; i < path.length; i++) {
        const segment = path[i];
        if (current === null || current === undefined) return undefined;

        // Gérer les indices de tableau (ex: "0", "1")
        if (Array.isArray(current) && !isNaN(parseInt(segment, 10))) {
            current = current[parseInt(segment, 10)];
        } else if (typeof current !== 'object' || typeof current[segment] === 'undefined') {
            return undefined; // Chemin invalide ou propriété non trouvée
        } else {
            current = current[segment];
        }
    }
    return current;
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



function collectFilterValues(formElement) {
    const params = {};
    if (!formElement) {
        console.error("collectFilterValues: formElement est null !");
        return params;
    }
    console.log("[FILTRES_COLLECT] Appel pour le formulaire:", formElement);

    const filterElements = formElement.querySelectorAll('input[data-filter-key], select[data-filter-key], textarea[data-filter-key]');
    // On exclut #user-input car il ne contient plus la valeur de filtre finale pour la ville
    console.log(`[FILTRES_COLLECT] Trouvé ${filterElements.length} éléments de filtre.`);

    filterElements.forEach(el => {
        const key = el.getAttribute('data-filter-key');
        if (!key) return;

        let valueToXano = null; 
        if (el.type === 'checkbox') {
            // ... votre code pour les checkboxes ...
            // (qui construit params[key] comme un tableau)
            // Assurez-vous qu'il y a un return ici pour ne pas tomber dans la logique non-checkbox
            if (el.checked) {
                const dataApiValue = el.getAttribute('data-value-api');
                if (dataApiValue !== null && dataApiValue.trim() !== "") {
                    valueToXano = dataApiValue.trim();
                    if (!params[key]) params[key] = [];
                    if (!Array.isArray(params[key])) params[key] = [params[key]]; // Correction si existant et non tableau
                    params[key].push(valueToXano);
                } else { /* warning et skip */ return; }
            }
            return; // Important pour les checkboxes
        } else if (el.type === 'radio') {
            // ... (logique pour les radios, si vous en avez) ...
            if (el.checked) valueToXano = el.value;
            else return;
        } else if (el.tagName === 'SELECT') {
            // ... (logique pour les selects) ...
            if (el.value !== '' && el.value !== null && el.value !== undefined) valueToXano = el.value;
            else return;
        } else { // Inputs (text, number, date, etc.)
            const trimmedValue = el.value.trim();
            if (trimmedValue !== '') valueToXano = trimmedValue;
            else return; 
        }

         if (valueToXano !== null) { // Ne devrait plus s'appliquer aux checkboxes ici
            params[key] = valueToXano;
            console.log(`[FILTRES_COLLECT] Ajout filtre (non-checkbox/city): {"${key}": "${valueToXano}"}`);
        }
    });

   // Ajout des villes sélectionnées (si `selectedCities` est accessible)
    if (typeof selectedCities !== 'undefined' && selectedCities.length > 0) {
        // On envoie une copie du tableau pour éviter les modifications par référence
        params['city'] = [...selectedCities];
        console.log(`[FILTRES_COLLECT] Villes sélectionnées ajoutées:`, JSON.stringify(params['city']));
    } else {
        console.log("[FILTRES_COLLECT] Aucune ville sélectionnée via les tags.");
    }

    console.log("[FILTRES_COLLECT] Paramètres collectés finaux (avant envoi API):", JSON.stringify(params));
    return params;
}


// AJOUTEZ CETTE FONCTION À VOTRE SCRIPT (celui dans le footer)

function initializePageSwipers(parentElement) {
    // parentElement est le conteneur général où les annonces (et donc les sliders) ont été ajoutées.
    // Par exemple, ce que vous avez nommé 'itemsContainer' dans votre fonction de rendu.
    const slidersToInitialize = parentElement.querySelectorAll('.swiper[data-slider-init="true"]');
    console.log(`[SWIPER_INIT_FUNC] Trouvé ${slidersToInitialize.length} sliders à initialiser dans:`, parentElement);

    slidersToInitialize.forEach((swiperEl, sliderIndex) => {
        console.log(`[SWIPER_INIT_FUNC] Préparation pour initialiser slider #${sliderIndex}:`, swiperEl);
        
        // Utiliser requestAnimationFrame pour s'assurer que le DOM est stable
        // et que les dimensions sont calculées avant d'initialiser Swiper.
        requestAnimationFrame(() => { 
            try {
                const slides = swiperEl.querySelectorAll('.swiper-slide');
                const enableLoop = slides.length > 1;
                console.log(`[SWIPER_INIT_FUNC] Initialisation Swiper sur slider #${sliderIndex}. Nombre de slides: ${slides.length}, Loop activée: ${enableLoop}`);
                
                // Assurez-vous que la variable 'Swiper' (avec un 'S' majuscule) 
                // est disponible globalement (chargée via votre <script src="URL_VERS_SWIPER_BUNDLE.MIN.JS">)
                const swiperInstance = new Swiper(swiperEl, { // 'S' majuscule ici
                    loop: enableLoop,
                    spaceBetween: 10,
                    slidesPerView: 1,
                    pagination: {
                        el: swiperEl.querySelector('.swiper-pagination'), // Doit exister dans votre template de slider
                        clickable: true,
                        dynamicBullets: true,
                        dynamicMainBullets: 5, 
                    },
                    navigation: {
                        nextEl: swiperEl.querySelector('.swiper-button-next'), // Doit exister
                        prevEl: swiperEl.querySelector('.swiper-button-prev'), // Doit exister
                    },
                    observer: true,        
                    observeParents: true,   
                    observeSlideChildren: true, 
                    updateOnWindowResize: true,
                });
                swiperInstance.update(); // Utile pour forcer la mise à jour des dimensions
                
                swiperEl.removeAttribute('data-slider-init'); // TRÈS IMPORTANT : pour éviter la ré-initialisation
                console.log(`[SWIPER_INIT_FUNC] Slider #${sliderIndex} initialisé et attribut 'data-slider-init' retiré.`);

            } catch (swiperError) {
                console.error(`[SWIPER_INIT_FUNC] ERREUR lors de l'initialisation Swiper pour slider #${sliderIndex}:`, swiperError, swiperEl);
            }
        }); // Fin de requestAnimationFrame
    });
}

// DANS home-form-display-v3.txt (ou votre fichier principal de script)

function updateFilterButtonText(count) {
    console.log('[UPDATE_BUTTON_LOG] Appel de updateFilterButtonText avec count:', count);
    const applyFiltersButtonElement = document.getElementById('apply-filters-button');

    if (applyFiltersButtonElement) {
        console.log('[UPDATE_BUTTON_LOG] Bouton trouvé:', applyFiltersButtonElement);
        if (count === null || count === undefined) {
            applyFiltersButtonElement.textContent = "Appliquer les filtres";
        } else if (count === 0) {
            applyFiltersButtonElement.textContent = "0 logements trouvés";
        } else if (count === 1) {
            applyFiltersButtonElement.textContent = "Afficher 1 logement";
        } else {
            applyFiltersButtonElement.textContent = `Afficher ${count} logements`;
        }
        console.log('[UPDATE_BUTTON_LOG] Texte du bouton mis à jour à:', applyFiltersButtonElement.textContent);
    } else {
        console.warn("[UPDATE_BUTTON_LOG] Bouton avec ID 'apply-filters-button' non trouvé.");
    }
}

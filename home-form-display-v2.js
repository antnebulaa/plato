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

    try {
        let urlToFetch = `${XANO_API_BASE_URL}/${endpoint}`;
        let paramsForURL = { ...params }; // Copier les params pour ne pas modifier l'original si besoin ailleurs

        // --- MODIFICATION IMPORTANTE POUR LES FILTRES DE TYPE TABLEAU (comme house_type) ---
        if (paramsForURL.house_type && Array.isArray(paramsForURL.house_type)) {
    if (paramsForURL.house_type.length > 0) {
        // Transforme ["maison", "appartement"] en "[\"maison\",\"appartement\"]"
        paramsForURL.house_type = JSON.stringify(paramsForURL.house_type);
        console.log(`[NEW_SCRIPT_FETCH_DEBUG] house_type transformé en JSON string: "${paramsForURL.house_type}"`);
    } else {
        // Si le tableau est vide, on ne veut peut-être pas envoyer le paramètre house_type du tout
        delete paramsForURL.house_type;
        console.log("[NEW_SCRIPT_FETCH_DEBUG] house_type était un tableau vide, supprimé des paramètres URL.");
    }
}
        // Répétez ce bloc if pour d'autres filtres qui seraient des tableaux et que Xano attend en CSV

        if (Object.keys(paramsForURL).length > 0) {
            const cleanParamsForURL = {};
            for (const key in paramsForURL) {
                if (paramsForURL[key] !== null && paramsForURL[key] !== undefined &&
                    ( (Array.isArray(paramsForURL[key])) /* ne devrait plus arriver pour house_type ici */ || 
                      (typeof paramsForURL[key] === 'string' && paramsForURL[key].trim() !== '') || 
                      (typeof paramsForURL[key] === 'number') ||
                      (typeof paramsForURL[key] === 'boolean') 
                    )
                ) {
                    cleanParamsForURL[key] = paramsForURL[key];
                }
            }
            if (Object.keys(cleanParamsForURL).length > 0) {
                urlToFetch += '?' + new URLSearchParams(cleanParamsForURL).toString();
            }
        }
        // --- FIN DE LA MODIFICATION ---


        console.log('[NEW_SCRIPT_FETCH] URL finale pour l\'appel fetch:', urlToFetch); // LOG TRÈS IMPORTANT

        const response = await fetch(urlToFetch); 
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: response.statusText }));
            throw new Error(`Erreur HTTP ${response.status}: ${errorData.message || response.statusText}`);
        }

        const responseData = await response.json();
        console.log('[NEW_SCRIPT_FETCH] Réponse brute de Xano:', JSON.stringify(responseData));

        let itemsArray = null;
        // ... (votre logique de détection flexible de itemsArray reste la même) ...
        if (Array.isArray(responseData)) { itemsArray = responseData; }
        else if (responseData && Array.isArray(responseData.items)) { itemsArray = responseData.items; }
        else if (responseData && responseData.body && Array.isArray(responseData.body.items)) { itemsArray = responseData.body.items; }
        else if (responseData && responseData.body && Array.isArray(responseData.body)) { itemsArray = responseData.body; }
        else if (responseData && typeof responseData === 'object') { 
            for (const key in responseData) { if (Array.isArray(responseData[key])) { itemsArray = responseData[key]; break; } }
        }

        if (itemsArray && Array.isArray(itemsArray)) {
            console.log(`[NEW_SCRIPT_FETCH] ${itemsArray.length} items trouvés.`);
            renderAnnouncements(itemsArray, templateElement, itemsContainer, emptyMessage);
        } else {
            console.warn('[NEW_SCRIPT_FETCH] Tableau d\'items non trouvé ou invalide.', responseData);
            if (itemsContainer) itemsContainer.innerHTML = `<p style="color:orange;">${emptyMessage}</p>`;
        }

    } catch (error) {
        console.error('[NEW_SCRIPT_FETCH] Erreur lors de la récupération des données:', error);
        if (itemsContainer) itemsContainer.innerHTML = `<p style="color:red;">Erreur de chargement: ${error.message}</p>`;
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
            let clone;
            if (templateNode.tagName === 'TEMPLATE') {
                clone = templateNode.content.firstElementChild.cloneNode(true);
            } else { // Si le template est un div caché
                clone = templateNode.cloneNode(true);
                clone.style.display = ''; // Rendre visible
            }

              // --- DÉBUT DE LA SECTION DE BINDING MODIFIÉE ---
    // On va appeler VOTRE fonction bindDataToElement (celle de home-form-display-v2-2.txt)
    // pour le clone entier et pour chacun de ses enfants qui pourraient avoir des bindings.
    // Votre fonction bindDataToElement est assez intelligente pour vérifier les attributs
    // data-xano-bind et data-xano-bind-attr-* sur l'élément qu'on lui passe.

    // 1. Appeler pour le clone lui-même (si l'élément racine de votre template peut avoir des bindings)
    bindDataToElement(clone, itemData); 

    // 2. Appeler pour tous les descendants directs et indirects.
    //    bindDataToElement vérifiera sur chaque élément s'il y a quelque chose à lier.
    clone.querySelectorAll('*').forEach(descendantElement => {
        bindDataToElement(descendantElement, itemData);
    });
    // --- FIN DE LA SECTION DE BINDING MODIFIÉE ---
            fragment.appendChild(clone);
        });
        
         itemsContainer.appendChild(fragment); // Ou container.appendChild(fragment)
    console.log("[NOM_DE_VOTRE_FONCTION_RENDER] Items ajoutés au DOM.");

    // APPEL À L'INITIALISATION DES SLIDERS
    initializePageSwipers(itemsContainer); // On passe le conteneur où les nouveaux items (et sliders) ont été ajoutés

    console.log("[NOM_DE_VOTRE_FONCTION_RENDER] Terminé, initialisation Swiper demandée.");
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


// DANS VOTRE SCRIPT home-form-display-v3.txt (celui dans le footer)
// REMPLACEZ la fonction collectFilterValues existante par celle-ci :


function collectFilterValues(formElement) {
    const params = {};
    if (!formElement) {
        console.error("collectFilterValues: formElement est null !");
        return params;
    }
    console.log("[FILTRES_COLLECT] Appel pour le formulaire:", formElement);

    const filterElements = formElement.querySelectorAll('input[data-filter-key], select[data-filter-key], textarea[data-filter-key]');
    console.log(`[FILTRES_COLLECT] Trouvé ${filterElements.length} éléments de filtre.`);

    filterElements.forEach(el => {
        const key = el.getAttribute('data-filter-key');
        if (!key) return;

        let valueToXano = null; 

        if (el.type === 'checkbox') {
            if (el.checked) {
                // *** LECTURE DE data-value-api ICI ***
                const dataApiValue = el.getAttribute('data-value-api');

                if (dataApiValue !== null && dataApiValue.trim() !== "") { // Vérifier si l'attribut existe ET n'est pas une chaîne vide
                    valueToXano = dataApiValue.trim(); 
                    console.log(`[FILTRES_COLLECT] Checkbox cochée: key="${key}", lu depuis data-value-api="${valueToXano}"`);
                } else {
                    console.warn(`[FILTRES_COLLECT_WARN] Checkbox pour clé "${key}" (ID: ${el.id || 'N/A'}) est cochée, MAIS l'attribut 'data-value-api' est MANQUANT ou vide. Sa valeur HTML 'value' est "${el.value}". Cette checkbox sera IGNORÉE pour éviter d'envoyer une valeur incorrecte comme "on".`);
                    return; // On ignore cette checkbox
                }
                
                if (!params[key]) { 
                    params[key] = [];
                }
                if (!Array.isArray(params[key])) {
                     console.warn(`[FILTRES_COLLECT_WARN] params["${key}"] n'était pas un tableau comme attendu, tentative de correction.`);
                     params[key] = [params[key]]; 
                }
                params[key].push(valueToXano);
                return; 
            } else {
                return; 
            }
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

        if (valueToXano !== null) { 
            params[key] = valueToXano;
            // Correction du log pour afficher correctement clé et valeur
            console.log(`[FILTRES_COLLECT] Ajout filtre (non-checkbox): {"${key}": "${valueToXano}"}`);
        }
    });

    console.log("[FILTRES_COLLECT] Paramètres collectés finaux (avant envoi API):", JSON.stringify(params));
    console.log("[FILTRES_COLLECT_DEBUG] Valeur de params.house_type AVANT return:", JSON.stringify(params.house_type));
// Si vous aviez une ligne comme params.house_type = params.house_type.join(','), commentez-la !
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



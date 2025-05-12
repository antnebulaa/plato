// ==========================================
// == SCRIPT XANO LISTING - VERSION ÉPURÉE ==
// ==========================================
document.addEventListener('DOMContentLoaded', function () {
    alert("SCRIPT CHARGE ET DOMCONTENTLOADED");
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


// À PLACER EN DEHORS DE DOMContentLoaded, avec les autres définitions de fonctions

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

        let value = null; 
        let valueForCheckbox = null;

        if (el.type === 'checkbox') {
            if (el.checked) {
                valueForCheckbox = el.value;
                if (!valueForCheckbox || valueForCheckbox === 'on') {
                     // Si value est 'on' ou vide, Xano attend peut-être un booléen ou une valeur spécifique.
                     // Pour l'instant, on prend la valeur brute. Adaptez si Xano attend 'true' / 'false'
                     // ou si vous voulez ignorer les checkbox avec value="on".
                    console.warn(`Checkbox pour clé "${key}" (ID: <span class="math-inline">\{el\.id \|\| 'N/A'\}\) est cochée avec valeur "</span>{valueForCheckbox}".`);
                }

                if (!params[key]) { // Si c'est la première checkbox pour cette clé
                    params[key] = [];
                }
                if (Array.isArray(params[key])) {
                    params[key].push(valueForCheckbox);
                }
                // Important : on ne veut pas de l'assignation `params[key] = value;` plus bas pour les checkboxes gérées en tableau.
                // Donc on s'arrête ici pour CETTE checkbox.
                return; 
            } else {
                return; // Checkbox non cochée, on ne l'ajoute pas.
            }
        } else if (el.type === 'radio') {
            if (el.checked) {
                value = el.value;
            } else {
                return; 
            }
        } else if (el.tagName === 'SELECT') {
            if (el.value !== '' && el.value !== null && el.value !== undefined) { // Ignorer les sélections "vides"
                value = el.value;
            } else {
                return; 
            }
        } else { // Inputs (text, number, date, etc.)
            const trimmedValue = el.value.trim();
            if (trimmedValue !== '') {
                value = trimmedValue;
            } else {
                return; 
            }
        }

        // Cette assignation ne se fera que pour les types autres que checkbox (qui ont un return dans leur bloc if)
        if (value !== null) { 
            params[key] = value;
            console.log(`[FILTRES_COLLECT] Ajout filtre: {"<span class="math-inline">\{key\}"\: "</span>{value}"}`);
        }
    });
    console.log("[FILTRES_COLLECT] Paramètres collectés finaux:", params);
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

// ASSUREZ-VOUS QUE CETTE FONCTION EST DANS VOTRE SCRIPT ACTUEL
function collectFilterValues(formElement) {
    const params = {};
    if (!formElement) {
        console.error("collectFilterValues: formElement est null !");
        return params;
    }
    console.log("[FILTRES] collectFilterValues appelée pour le formulaire:", formElement);

    const filterElements = formElement.querySelectorAll('input[data-filter-key], select[data-filter-key], textarea[data-filter-key]');
    console.log(`[FILTRES] Trouvé ${filterElements.length} éléments de filtre.`);

    filterElements.forEach(el => {
        const key = el.getAttribute('data-filter-key');
        if (!key) return;

        let value = null;
        let valueForCurrentElement = null; // Renommé pour éviter confusion dans la portée

        if (el.type === 'checkbox') {
            if (el.checked) {
                valueForCurrentElement = el.value;
                if (!valueForCurrentElement || valueForCurrentElement === 'on') { // Si la value est 'on' ou vide, c'est souvent pas ce qu'on veut comme valeur de filtre
                    console.warn(`Checkbox pour clé "${key}" (ID: <span class="math-inline">\{el\.id \|\| 'N/A'\}\) est cochée mais sa valeur est "</span>{valueForCurrentElement}". Si ce n'est pas la valeur attendue, vérifiez l'attribut 'value' de la checkbox.`);
                    // On peut décider de prendre 'true' ou une autre valeur par défaut, ou la valeur réelle si elle est significative
                    // Pour l'instant, on prend la valeur de l'attribut 'value' si elle est définie, sinon on pourrait ignorer ou mettre true
                    if (valueForCurrentElement === 'on' && el.hasAttribute('value')) {
                        // Cas où value="on" est explicitement mis mais on veut le traiter.
                    } else if (!valueForCurrentElement || valueForCurrentElement === 'on') {
                        // Pourrait être ignoré ou transformé en booléen, dépend de ce que Xano attend
                        // Si Xano attend une liste de valeurs pour des checkboxes cochées partageant le même data-filter-key :
                    }
                }

                // Gestion pour que params[key] soit un tableau si plusieurs checkboxes ont le même 'key'
                if (!params[key]) {
                    params[key] = [];
                }
                if (Array.isArray(params[key])) {
                    params[key].push(valueForCurrentElement); // Ajoute la valeur à la liste
                } else { // Ne devrait pas arriver si on initialise toujours comme tableau
                    console.warn(`[FILTRES] Problème : params["${key}"] devrait être un tableau.`);
                }
                // Puisqu'on a géré l'ajout au tableau, on ne veut pas de l'assignation params[key] = value à la fin
                return; // Passer à l'élément suivant
            } else {
                return; // Checkbox non cochée, ne rien faire pour cette clé
            }
        } else if (el.type === 'radio') {
            if (el.checked) {
                value = el.value;
            } else {
                return; // Radio non sélectionné
            }
        } else if (el.tagName === 'SELECT') {
            if (el.value !== '') { // Ignorer si la valeur est vide (ex: option "Tous")
                value = el.value;
            } else {
                return; // Sélection vide
            }
        } else { // Inputs (text, number, date, etc.)
            const trimmedValue = el.value.trim();
            if (trimmedValue !== '') {
                value = trimmedValue;
            } else {
                return; // Champ vide
            }
        }

        if (value !== null) { // S'applique uniquement si ce n'est pas une checkbox gérée comme tableau
            params[key] = value;
            console.log(`[FILTRES] Ajout filtre: {"<span class="math-inline">\{key\}"\: "</span>{value}"}`);
        }
    });

    // Pour les clés de checkboxes qui sont des tableaux, joindre en chaîne si Xano l'attend comme ça
    // Ou laisser comme tableau si Xano peut le gérer.
    // Exemple si Xano attend une chaîne CSV pour une clé 'amenities':
    // if (params.amenities && Array.isArray(params.amenities)) {
    //     params.amenities = params.amenities.join(',');
    // }

    console.log("[FILTRES] Paramètres collectés finaux:", params);
    return params;
}

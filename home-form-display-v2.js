// ==========================================
// == Script Xano Unifié (Formulaires + Données) ==
// ==========================================
// Date: 2025-03-30

// ==========================================
// == Script Xano Unifié Compatible Multi-Navigateurs ==
// ==========================================
// Version optimisée pour Safari/Chrome/Firefox - 11/05/2025

// Détection de Safari - à placer au niveau global, avant l'event listener
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
console.log("Navigation sur Safari:", isSafari);

document.addEventListener('DOMContentLoaded', function() {
    // Vérification de l'état du document pour gérer le problème Safari
    if (document.readyState !== 'loading') {
        console.log("[READY] Document déjà chargé, exécution immédiate");
        initializeXanoClient();
    } else {
        console.log("[WAITING] Document en cours de chargement, attente...");
        // Safari peut avoir un comportement différent avec DOMContentLoaded
        // Nous utilisons cette approche pour plus de fiabilité
        if (isSafari) {
            // Forcer un court délai pour Safari
            setTimeout(initializeXanoClient, 20);
        } else {
            // Comportement normal pour les autres navigateurs
            initializeXanoClient();
        }
    }
});

// Fonction d'initialisation séparée pour éviter les problèmes de timing
function initializeXanoClient() {
    console.log("[INIT] Initialisation du client Xano");
    // --- Configuration du Client Xano ---
    const xanoClient = new XanoClient({
        apiGroupBaseUrl: 'https://xwxl-obyg-b3e3.p7.xano.io/api:qom0bt4V'
    });

    // --- Initialisation pour toutes les listes de données ---
    const listingElements = document.querySelectorAll('[data-xano-endpoint]');
    listingElements.forEach(listingElement => {
        console.log("[INIT] Élément avec data-xano-endpoint trouvé:", listingElement);
        
        const endpoint = listingElement.getAttribute('data-xano-endpoint');
        const method = (listingElement.getAttribute('data-xano-method') || 'GET').toUpperCase();
        const params = {}; 

        // Récupérer les data-xano-param-* statiques
        for (const attr of listingElement.attributes) {
            if (attr.name.startsWith('data-xano-param-')) {
                params[attr.name.replace('data-xano-param-', '')] = attr.value;
            }
        }
        
        // Ajouter les paramètres d'URL si nécessaire
        if (listingElement.hasAttribute('data-xano-use-url-param')) {
            const urlParamName = listingElement.getAttribute('data-xano-use-url-param');
            const urlParamValue = getQueryParam(urlParamName);
            
            if (urlParamValue) {
                const apiParamName = listingElement.getAttribute('data-xano-url-param-to-api') || urlParamName;
                params[apiParamName] = urlParamValue;
            }
        }

        // Authentification
        const authToken = getCookie('xano_auth_token');
        if (authToken) {
            xanoClient.setAuthToken(authToken);
        }

        // Approche conditionnelle pour Safari vs autres navigateurs
        if (isSafari) {
            console.log("[SAFARI] Utilisation de XMLHttpRequest pour", endpoint);
            fetchDataWithXHR(endpoint, method, params, listingElement);
        } else {
            console.log("[STANDARD] Utilisation de fetch/client Xano pour", endpoint);
            fetchXanoData(xanoClient, endpoint, method, params, listingElement);
        }
    });

    // --- Gestion des liens de navigation ---
    document.addEventListener('xano:data-loaded', function(event) {
        const loadedElementContext = event.detail.element;
        
        // On ne cible que les liens qui ne sont PAS DANS un item de liste généré
        document.querySelectorAll('[data-xano-link-to]').forEach(linkElement => {
            if (!linkElement.closest('[data-xano-list-item]')) {
                const targetPage = linkElement.getAttribute('data-xano-link-to');
                const idField = linkElement.getAttribute('data-xano-link-param-id') || 'id';
                const idParamName = linkElement.getAttribute('data-xano-link-url-param') || 'id';
                let linkTarget = targetPage;

                if (linkElement.hasAttribute('data-xano-data-id')) {
                    const dataId = linkElement.getAttribute('data-xano-data-id');
                    linkTarget = `${targetPage}?${idParamName}=${encodeURIComponent(dataId)}`;
                } else if (event.detail.data && typeof event.detail.data === 'object' && event.detail.data[idField]) {
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

    // Gestion des clics sur éléments non-liens
    document.addEventListener('click', function(event) {
        const clickedElement = event.target.closest('[data-xano-link-target]');
        if (clickedElement && clickedElement.tagName !== 'A') {
            const linkTarget = clickedElement.getAttribute('data-xano-link-target');
            if (linkTarget) {
                window.location.href = linkTarget;
            }
        }
    });
}

// Fonction pour Safari utilisant XMLHttpRequest
function fetchDataWithXHR(endpoint, method, params, element) {
    console.log("[SAFARI] Appel XMLHttpRequest pour", endpoint, params);
    
    const loadingIndicatorSelector = element.getAttribute('data-xano-loading-selector');
    const loadingIndicator = loadingIndicatorSelector ? document.querySelector(loadingIndicatorSelector) : null;
    
    if (loadingIndicator) {
        loadingIndicator.style.display = 'block';
    }
    
    const xhr = new XMLHttpRequest();
    const baseUrl = 'https://xwxl-obyg-b3e3.p7.xano.io/api:qom0bt4V';
    let url = `${baseUrl}/${endpoint}`;
    
    // Ajouter les paramètres à l'URL pour les requêtes GET
    if (method === 'GET' && Object.keys(params).length > 0) {
        url += '?' + new URLSearchParams(params).toString();
    }
    
    xhr.open(method, url, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    
    // Ajouter l'authentification si disponible
    const authToken = getCookie('xano_auth_token');
    if (authToken) {
        xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);
    }
    
    xhr.onload = function() {
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
        
        if (xhr.status >= 200 && xhr.status < 300) {
            try {
                const response = JSON.parse(xhr.responseText);
                console.log("[SAFARI] Données reçues:", response);
                
                // Forcer un délai très court pour permettre au DOM de se stabiliser
                setTimeout(() => {
                    renderData(response, element);
                    
                    // Déclencher l'événement manuellement
                    const event = new CustomEvent('xano:data-loaded', {
                        detail: { data: response, element: element, params: params },
                        bubbles: true
                    });
                    element.dispatchEvent(event);
                }, 50);
            } catch (e) {
                console.error("[SAFARI] Erreur de parsing JSON:", e);
                element.innerHTML = `<div class="xano-error">Erreur de format: ${e.message}</div>`;
            }
        } else {
            console.error('[SAFARI] Erreur lors de la requête XHR:', xhr.status, xhr.statusText);
            element.innerHTML = `<div class="xano-error">Erreur ${xhr.status}: ${xhr.statusText}</div>`;
        }
    };
    
    xhr.onerror = function() {
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
        
        console.error('[SAFARI] Erreur réseau lors de la requête XHR');
        element.innerHTML = `<div class="xano-error">Erreur réseau</div>`;
    };
    
    // Envoyer les données pour les méthodes autres que GET
    if (method !== 'GET' && Object.keys(params).length > 0) {
        xhr.send(JSON.stringify(params));
    } else {
        xhr.send();
    }
}




// Fonction principale pour récupérer les données Xano
async function fetchXanoData(client, endpoint, method, params, targetElement) {
    console.log(`[FETCH_DATA] Appel API: ${method} ${endpoint}, Params:`, params);
    
    const loadingIndicatorSelector = targetElement.getAttribute('data-xano-loading-selector');
    const loadingIndicator = loadingIndicatorSelector ? document.querySelector(loadingIndicatorSelector) : null;
    
    if (loadingIndicator) {
        loadingIndicator.style.display = 'block';
    }

    // Solution de contournement pour Safari
    if (isSafari) {
        return new Promise((resolve, reject) => {
            // Utiliser XMLHttpRequest au lieu de fetch pour Safari
            const xhr = new XMLHttpRequest();
            const url = `${client.baseUrl}${endpoint}${method === 'GET' ? '?' + new URLSearchParams(params).toString() : ''}`;
            
            xhr.open(method, url, true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            
            // Ajouter le token d'authentification si présent
            const authToken = getCookie('xano_auth_token');
            if (authToken) {
                xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);
            }
            
            xhr.onload = function() {
                if (loadingIndicator) {
                    loadingIndicator.style.display = 'none';
                }
                
                if (xhr.status >= 200 && xhr.status < 300) {
                    const response = JSON.parse(xhr.responseText);
                    renderData(response, targetElement);
                    
                    // Déclencher l'événement de données chargées
                    const event = new CustomEvent('xano:data-loaded', {
                        detail: { data: response, element: targetElement, params: params },
                        bubbles: true
                    });
                    targetElement.dispatchEvent(event);
                    
                    resolve(response);
                } else {
                    const error = new Error(`Erreur HTTP ${xhr.status}: ${xhr.statusText}`);
                    console.error(`[FETCH_DATA] Erreur:`, error);
                    
                    targetElement.innerHTML = `<div class="xano-error">Erreur: ${error.message}</div>`;
                    
                    // Déclencher l'événement d'erreur
                    const errorEvent = new CustomEvent('xano:data-error', {
                        detail: { error: error, element: targetElement, params: params },
                        bubbles: true
                    });
                    targetElement.dispatchEvent(errorEvent);
                    
                    reject(error);
                }
            };
            
            xhr.onerror = function() {
                if (loadingIndicator) {
                    loadingIndicator.style.display = 'none';
                }
                
                const error = new Error('Erreur réseau');
                console.error(`[FETCH_DATA] Erreur:`, error);
                
                targetElement.innerHTML = `<div class="xano-error">Erreur réseau</div>`;
                
                // Déclencher l'événement d'erreur
                const errorEvent = new CustomEvent('xano:data-error', {
                    detail: { error: error, element: targetElement, params: params },
                    bubbles: true
                });
                targetElement.dispatchEvent(errorEvent);
                
                reject(error);
            };
            
            if (method === 'GET') {
                xhr.send();
            } else {
                xhr.send(JSON.stringify(params));
            }
        });
    }

    // Code original pour les autres navigateurs
    try {
        let response;
        
        switch(method) {
            case 'GET':
                response = await client.get(endpoint, params);
                break;
            case 'POST':
                response = await client.post(endpoint, params);
                break;
            default:
                throw new Error(`Méthode HTTP non supportée: ${method}`);
        }

        console.log(`[FETCH_DATA] Réponse reçue:`, response);
        
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }

        renderData(response, targetElement);

        const event = new CustomEvent('xano:data-loaded', {
            detail: { data: response, element: targetElement, params: params },
            bubbles: true
        });
        targetElement.dispatchEvent(event);

        return response;
    } catch (error) {
        console.error(`[FETCH_DATA] Erreur:`, error);
        
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }

        targetElement.innerHTML = `<div class="xano-error">Erreur: ${error.message || "Impossible de charger les données"}</div>`;

        const errorEvent = new CustomEvent('xano:data-error', {
            detail: { error: error, element: targetElement, params: params },
            bubbles: true
        });
        targetElement.dispatchEvent(errorEvent);

        throw error;
    }
}

// Fonction pour afficher les données récupérées
function renderData(data, element) {
    console.log("[RENDER_DATA] Début du rendu");
    
    // Déterminer si c'est une liste ou un élément unique
    if (element.hasAttribute('data-xano-list')) {
        // C'est une liste
        let listData = extractListData(data);
        
        if (listData) {
            renderListData(listData, element);
        } else {
            console.warn('[RENDER_DATA] Aucune donnée de liste valide trouvée:', data);
            element.innerHTML = `<div class="xano-error">Aucune donnée valide trouvée</div>`;
        }
    } else {
        // C'est un élément unique
        const sourceData = data?.body ? data.body : data;
        
        if (sourceData && typeof sourceData === 'object') {
            // Lier les données aux éléments avec data-xano-bind
            const boundElements = element.querySelectorAll('[data-xano-bind]');
            
            boundElements.forEach(boundElement => {
                bindDataToElement(boundElement, sourceData);
            });
        }
    }
}

// Fonction pour extraire les données de liste de la réponse
function extractListData(data) {
    // Stratégie flexible pour trouver le tableau dans la réponse
    if (Array.isArray(data)) {
        return data;
    } else if (data && typeof data === 'object') {
        // Vérifier les structures courantes
        if (Array.isArray(data.items)) {
            return data.items;
        } else if (data.body) {
            if (Array.isArray(data.body)) {
                return data.body;
            } else if (data.body.items && Array.isArray(data.body.items)) {
                return data.body.items;
            }
        }
        
        // Chercher récursivement un tableau dans l'objet
        for (const key in data) {
            if (Array.isArray(data[key])) {
                return data[key];
            }
        }
        
        if (data.body && typeof data.body === 'object') {
            for (const key in data.body) {
                if (Array.isArray(data.body[key])) {
                    return data.body[key];
                }
            }
        }
    }
    
    return null;
}

// Fonction pour rendre une liste de données
function renderListData(dataArray, element) {  // ← le paramètre s'appelle 'element'
    console.log(`[RENDER_LIST] Rendu de ${dataArray.length} éléments`);
    
    // Vérifier que dataArray est un tableau
    if (!Array.isArray(dataArray)) {
        console.warn('[RENDER_LIST] dataArray n\'est pas un tableau');
        dataArray = [];
    }
    
    // Obtenir le sélecteur et l'élément du template
    const templateSelector = element.getAttribute('data-xano-list');  // ← Doit utiliser 'element' et non 'listContainerElement'
    if (!templateSelector) {
        console.error('[RENDER_LIST] Attribut data-xano-list manquant');
        return;
    }
    
    const templateElement = document.querySelector(templateSelector);
    if (!templateElement) {
        console.error(`[RENDER_LIST] Template ${templateSelector} introuvable`);
        return;
    }
    
    // Trouver le conteneur où injecter les éléments
    const container = element.querySelector('[data-xano-list-container]') || element;  // ← Utiliser 'element'
    
    // Vider le conteneur, sauf le template si c'est un enfant direct
    container.innerHTML = '';
    
    // Cacher le template s'il n'est pas déjà dans une balise <template>
    if (templateElement.tagName !== 'TEMPLATE') {
        templateElement.style.display = 'none';
    }
    
    // Si aucune donnée, afficher un message
    if (dataArray.length === 0) {
        const emptyMessage = element.getAttribute('data-xano-empty-message') || "Aucune donnée à afficher";  // ← Utiliser 'element'
        container.innerHTML = `<div class="xano-empty-message">${emptyMessage}</div>`;
        return;
    }
    
    // Créer et remplir les éléments de liste
    dataArray.forEach((item, index) => {
        // Cloner le template
        const clone = templateElement.tagName === 'TEMPLATE' 
            ? templateElement.content.firstElementChild.cloneNode(true)
            : templateElement.cloneNode(true);
        
        // Configurer le clone
        clone.style.display = '';
        clone.setAttribute('data-xano-list-item', '');
        clone.setAttribute('data-xano-item-index', index.toString());
        
        // Lier les données aux éléments dans le clone
        const boundElements = clone.querySelectorAll('[data-xano-bind]');
        boundElements.forEach(boundElement => {
            bindDataToElement(boundElement, item);
        });
        
        // Si le clone lui-même a data-xano-bind
        if (clone.hasAttribute('data-xano-bind')) {
            bindDataToElement(clone, item);
        }
        
        // Gérer les liens dans le clone
        handleLinksInClone(clone, item);
        
        // Ajouter au DOM
        container.appendChild(clone);
    });
    
    // Initialiser les sliders Swiper en utilisant requestAnimationFrame
    initializeSwipers(container);
    // Initialisation conditionnelle de Swiper
    const slidersToInitialize = container.querySelectorAll('.swiper[data-slider-init="true"]');
    
    if (isSafari) {
        // Code spécifique à Safari pour Swiper
        slidersToInitialize.forEach(slider => {
            // Forcer un rafraîchissement du DOM
            slider.style.display = 'none';
            void slider.offsetHeight;
            slider.style.display = '';
            
            // Initialisation avec délai court
            setTimeout(() => {
                initializeSingleSwiper(slider);
            }, 100);
        });
    } else {
        // Code original pour autres navigateurs
        slidersToInitialize.forEach(slider => {
            requestAnimationFrame(() => {
                initializeSingleSwiper(slider);
            });
        });
    }
}


// Fonction pour gérer les liens dans un clone
function handleLinksInClone(clone, item) {
    // Gérer les liens avec data-xano-link-to
    const linkElements = clone.querySelectorAll('[data-xano-link-to]');
    linkElements.forEach(linkElement => {
        const targetPage = linkElement.getAttribute('data-xano-link-to');
        const idField = linkElement.getAttribute('data-xano-link-param-id') || 'id';
        const idParamName = linkElement.getAttribute('data-xano-link-url-param') || 'id';
        
        let linkTarget = targetPage;
        const idValue = getNestedValue(item, idField);
        
        if (idValue !== undefined && idValue !== null) {
            linkTarget = `${targetPage}?${idParamName}=${encodeURIComponent(idValue)}`;
        }
        
        if (linkElement.tagName === 'A') {
            linkElement.href = linkTarget;
        } else {
            linkElement.setAttribute('data-xano-link-target', linkTarget);
            linkElement.style.cursor = 'pointer';
        }
    });
    
    // Si le clone lui-même est un lien
    if (clone.hasAttribute('data-xano-link-to')) {
        const targetPage = clone.getAttribute('data-xano-link-to');
        const idField = clone.getAttribute('data-xano-link-param-id') || 'id';
        const idParamName = clone.getAttribute('data-xano-link-url-param') || 'id';
        
        let linkTarget = targetPage;
        const idValue = getNestedValue(item, idField);
        
        if (idValue !== undefined && idValue !== null) {
            linkTarget = `${targetPage}?${idParamName}=${encodeURIComponent(idValue)}`;
        }
        
        if (clone.tagName === 'A') {
            clone.href = linkTarget;
        } else {
            clone.setAttribute('data-xano-link-target', linkTarget);
            clone.style.cursor = 'pointer';
        }
    }
}

// Initialisation des Swiper avec détection de disponibilité du DOM
function initializeSwipers(container) {
    if (typeof Swiper === 'undefined') {
        console.error("[SWIPER] La bibliothèque Swiper n'est pas chargée");
        return;
    }
    
    const slidersToInitialize = container.querySelectorAll('.swiper[data-slider-init="true"]');
    
    if (slidersToInitialize.length === 0) return;

    // Utilisez MutationObserver pour Safari
    if (isSafari) {
        // Forcer un rafraîchissement du DOM dans Safari
        container.style.display = 'none';
        // Forcer le navigateur à recalculer la mise en page
        void container.offsetHeight;
        container.style.display = '';
        
        // Attendre que le DOM soit stable
        const observer = new MutationObserver((mutations, obs) => {
            slidersToInitialize.forEach(slider => {
                if (slider.querySelectorAll('.swiper-slide').length > 0) {
                    initializeSingleSwiper(slider);
                    slider.setAttribute('data-safari-initialized', 'true');
                }
            });
            
            // Vérifier si tous les sliders sont initialisés
            const allInitialized = Array.from(slidersToInitialize).every(
                slider => slider.hasAttribute('data-safari-initialized')
            );
            
            if (allInitialized) {
                obs.disconnect();
            }
        });
        
        observer.observe(container, { 
            childList: true, 
            subtree: true,
            attributes: true
        });
    } else {
        // Pour les autres navigateurs, utiliser l'approche originale
        slidersToInitialize.forEach(slider => {
            requestAnimationFrame(() => {
                initializeSingleSwiper(slider);
            });
        });
    }
}


// Initialiser un seul slider Swiper
function initializeSingleSwiper(swiperEl) {
    try {
        console.log(`[SWIPER] Initialisation du slider:`, swiperEl);
        
        // Compter les slides
        const slides = swiperEl.querySelectorAll('.swiper-slide');
        const enableLoop = slides.length > 1;
        
        // Créer l'instance Swiper
        const swiperInstance = new Swiper(swiperEl, {
            loop: enableLoop,
            spaceBetween: 10,
            slidesPerView: 1,
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
            observer: true,
            observeParents: true,
            observeSlideChildren: true,
            updateOnWindowResize: true,
        });
        
        // Forcer une mise à jour pour s'assurer que le slider est bien initialisé
        swiperInstance.update();
        
        // Marquer comme initialisé
        swiperEl.removeAttribute('data-slider-init');
        swiperEl.removeAttribute('data-slider-ready');
        swiperEl.setAttribute('data-slider-initialized', 'true');
        
        console.log(`[SWIPER] Slider initialisé avec succès`);
    } catch (error) {
        console.error(`[SWIPER] Erreur lors de l'initialisation:`, error);
        swiperEl.setAttribute('data-slider-error', error.message);
    }
}

// Fonction pour lier des données à un élément
function bindDataToElement(element, data) {
    const dataKey = element.getAttribute('data-xano-bind');
    if (!dataKey) return;
    
    // Gestion spéciale pour le slider de photos
    if (dataKey === '_property_photos_slider') {
        bindPropertyPhotosSlider(element, data);
        return;
    }
    
    // Obtenir la valeur depuis les données
    const value = getNestedValue(data, dataKey);
    const displayValue = value !== undefined && value !== null ? value : '';
    
    // Appliquer la valeur selon le type d'élément
    switch (element.tagName.toLowerCase()) {
        case 'img':
            if (!element.closest('.swiper-slide')) {
                element.src = displayValue;
            }
            break;
        case 'input':
            if (element.type === 'checkbox' || element.type === 'radio') {
                element.checked = element.type === 'checkbox' ? !!value : element.value == value;
            } else {
                element.value = displayValue;
            }
            break;
        case 'textarea':
        case 'select':
            element.value = displayValue;
            break;
        case 'a':
            if (!element.hasAttribute('data-xano-link-to')) {
                element.href = displayValue;
            }
            if (!element.textContent.trim() || dataKey !== 'href') {
                element.textContent = displayValue;
            }
            break;
        default:
            element.textContent = displayValue;
    }
    
    // Gérer les attributs liés (data-xano-bind-attr-*)
    for (const attr of element.attributes) {
        if (attr.name.startsWith('data-xano-bind-attr-')) {
            const attrName = attr.name.replace('data-xano-bind-attr-', '');
            const attrValueKey = attr.value;
            const attrValue = getNestedValue(data, attrValueKey);
            
            if (attrValue !== undefined) {
                element.setAttribute(attrName, attrValue);
            }
        }
    }
}

// Fonction spécifique pour lier des photos à un slider
function bindPropertyPhotosSlider(element, data) {
    const photosArray = data._property_photos;
    const swiperContainer = element.querySelector('.swiper');
    
    if (!swiperContainer) {
        console.warn("[PHOTOS_SLIDER] Conteneur .swiper non trouvé");
        return;
    }
    
    const swiperWrapper = swiperContainer.querySelector('.swiper-wrapper');
    if (!swiperWrapper) {
        console.warn("[PHOTOS_SLIDER] .swiper-wrapper non trouvé");
        return;
    }
    
    // Vérifier si nous avons des photos
    if (!photosArray || !Array.isArray(photosArray) || photosArray.length === 0) {
        element.style.display = 'none';
        return;
    }
    
    // Vider le wrapper
    swiperWrapper.innerHTML = '';
    
    // Ajouter chaque photo comme slide
    photosArray.forEach(photoEntry => {
        if (photoEntry.images && photoEntry.images.length > 0 && photoEntry.images[0].url) {
            const imageUrl = photoEntry.images[0].url;
            
            const slideElement = document.createElement('div');
            slideElement.className = 'swiper-slide';
            
            const imgElement = document.createElement('img');
            imgElement.src = imageUrl;
            imgElement.alt = data.property_title ? `Photo de ${data.property_title}` : "Photo de la propriété";
            
            slideElement.appendChild(imgElement);
            swiperWrapper.appendChild(slideElement);
        }
    });
    
    // Marquer pour initialisation
    swiperContainer.setAttribute('data-slider-init', 'true');
    element.style.display = '';
}

// Fonction pour obtenir une valeur imbriquée dans un objet
function getNestedValue(obj, pathString) {
    if (!obj || !pathString) return undefined;
    
    const path = pathString.split('.');
    let current = obj;
    
    for (let i = 0; i < path.length; i++) {
        const segment = path[i];
        
        if (current === null || current === undefined) return undefined;
        
        if (Array.isArray(current) && !isNaN(parseInt(segment, 10))) {
            current = current[parseInt(segment, 10)];
        } else if (typeof current[segment] === 'undefined') {
            return undefined;
        } else {
            current = current[segment];
        }
    }
    
    return current;
}

// Fonction pour obtenir un paramètre de l'URL
function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

// Fonction pour obtenir un cookie
function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) {
            return decodeURIComponent(c.substring(nameEQ.length, c.length));
        }
    }
    
    return null;
}


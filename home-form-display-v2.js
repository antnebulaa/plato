// ==========================================
// == Script Xano Unifié (Formulaires + Données) ==
// ==========================================
// Date: 2025-03-30

// ==========================================
// == Script Xano Unifié Compatible Multi-Navigateurs ==
// ==========================================
// Version optimisée pour Safari/Chrome/Firefox - 11/05/2025

// Détection simple de Safari 
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
console.log("Navigation sur Safari:", isSafari);

document.addEventListener('DOMContentLoaded', function() {
    console.log("[INIT] Chargement du document");
    
    const xanoClient = new XanoClient({
        apiGroupBaseUrl: 'https://xwxl-obyg-b3e3.p7.xano.io/api:qom0bt4V',
    });

    // Gestion uniforme pour tous les navigateurs
    const xanoElements = document.querySelectorAll('[data-xano-endpoint]');
    xanoElements.forEach(element => {
        console.log("[INIT] Traitement élément:", element);
        
        const endpoint = element.getAttribute('data-xano-endpoint');
        const method = (element.getAttribute('data-xano-method') || 'GET').toUpperCase();
        const params = {};
        
        // Paramètres statiques
        for (const attr of element.attributes) {
            if (attr.name.startsWith('data-xano-param-')) {
                params[attr.name.replace('data-xano-param-', '')] = attr.value;
            }
        }
        
        // Paramètres d'URL
        if (element.hasAttribute('data-xano-use-url-param')) {
            const urlParamName = element.getAttribute('data-xano-use-url-param');
            const urlParamValue = getQueryParam(urlParamName);
            
            if (urlParamValue) {
                const apiParamName = element.getAttribute('data-xano-url-param-to-api') || urlParamName;
                params[apiParamName] = urlParamValue;
            }
        }

        // Authentification
        const authToken = getCookie('xano_auth_token');
        if (authToken) {
            xanoClient.setAuthToken(authToken);
        }

        // Approche unifiée pour tous les navigateurs
        fetchUnifiedData(xanoClient, endpoint, method, params, element);
    });
    
    // Gestion des liens
    document.addEventListener('xano:data-loaded', function(event) {
        const element = event.detail.element;
        const data = event.detail.data;
        
        document.querySelectorAll('[data-xano-link-to]').forEach(linkElement => {
            if (!linkElement.closest('[data-xano-list-item]')) {
                const targetPage = linkElement.getAttribute('data-xano-link-to');
                const idField = linkElement.getAttribute('data-xano-link-param-id') || 'id';
                const idParamName = linkElement.getAttribute('data-xano-link-url-param') || 'id';
                
                let linkTarget = targetPage;
                
                if (linkElement.hasAttribute('data-xano-data-id')) {
                    const dataId = linkElement.getAttribute('data-xano-data-id');
                    linkTarget = `${targetPage}?${idParamName}=${encodeURIComponent(dataId)}`;
                } else if (data && typeof data === 'object' && data[idField]) {
                    linkTarget = `${targetPage}?${idParamName}=${encodeURIComponent(data[idField])}`;
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
    
    // Gestion des clics
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

// Fonction unifiée pour récupérer les données
async function fetchUnifiedData(client, endpoint, method, params, element) {
    console.log(`[FETCH] Début pour ${endpoint}`, params);
    
    const loadingIndicatorSelector = element.getAttribute('data-xano-loading-selector');
    const loadingIndicator = loadingIndicatorSelector ? document.querySelector(loadingIndicatorSelector) : null;
    
    if (loadingIndicator) {
        loadingIndicator.style.display = 'block';
    }
    
    try {
        console.log(`[FETCH] Méthode ${method} pour ${endpoint}`);
        let response;
        // Utiliser les méthodes standard du client pour tous les navigateurs
        if (method === 'GET') {
            response = await client.get(endpoint, params);
        } else if (method === 'POST') {
            response = await client.post(endpoint, params);
        } else if (method === 'PUT') {
            response = await client.put(endpoint, params);
        } else if (method === 'PATCH') {
            response = await client.patch(endpoint, params);
        } else if (method === 'DELETE') {
            response = await client.delete(endpoint, params);
        } else {
            throw new Error(`Méthode HTTP non supportée: ${method}`);
        }

        console.log(`[FETCH] Réponse reçue pour ${endpoint}:`, response);
        
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
        
        // Approche simplifiée et plus robuste pour le rendu
        renderUnified(response, element);
        
        // Déclencher l'événement de succès
        element.dispatchEvent(new CustomEvent('xano:data-loaded', {
            detail: { data: response, element: element, params: params },
            bubbles: true
        }));
        
    } catch (error) {
        console.error(`[FETCH] Erreur pour ${endpoint}:`, error);
        
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
        
        element.innerHTML = `<div class="xano-error">Erreur: ${error.message || "Impossible de charger les données"}</div>`;
        
        element.dispatchEvent(new CustomEvent('xano:data-error', {
            detail: { error: error, element: element, params: params },
            bubbles: true
        }));
    }
}

// Fonction de rendu simplifiée
function renderUnified(data, element) {
    console.log("[RENDER] Début du rendu");
    
    if (element.hasAttribute('data-xano-list')) {
        // C'est une liste
        let listData = null;
        
        // Approche robuste pour extraire les données
        if (Array.isArray(data)) {
            listData = data;
        } else if (data && Array.isArray(data.body)) {
            listData = data.body;
        } else if (data && data.body && Array.isArray(data.body.items)) {
            listData = data.body.items;
        } else if (data && Array.isArray(data.items)) {
            listData = data.items;
        } else if (data && typeof data === 'object') {
            // Chercher un tableau dans l'objet
            for (const key in data) {
                if (Array.isArray(data[key])) {
                    listData = data[key];
                    break;
                }
            }
            
            if (!listData && data.body && typeof data.body === 'object') {
                for (const key in data.body) {
                    if (Array.isArray(data.body[key])) {
                        listData = data.body[key];
                        break;
                    }
                }
            }
        }
        
        if (listData) {
            renderListUnified(listData, element);
        } else {
            console.warn('[RENDER] Aucune donnée valide trouvée pour la liste');
            element.innerHTML = `<div class="xano-error">Aucune donnée valide trouvée</div>`;
        }
    } else {
        // C'est un élément unique
        const sourceData = data?.body || data;
        
        if (sourceData && typeof sourceData === 'object') {
            const boundElements = element.querySelectorAll('[data-xano-bind]');
            boundElements.forEach(boundElement => {
                bindElementData(boundElement, sourceData);
            });
        }
    }
}

// Fonction pour rendre une liste de données
function renderListUnified(dataArray, element) {
    console.log(`[RENDER_LIST] Rendu de ${dataArray.length} éléments`);
    
    // S'assurer que dataArray est un tableau
    dataArray = Array.isArray(dataArray) ? dataArray : [];
    
    // Récupérer le sélecteur du template
    const templateSelector = element.getAttribute('data-xano-list');
    const templateElement = document.querySelector(templateSelector);
    
    if (!templateElement) {
        console.error(`[RENDER_LIST] Template ${templateSelector} introuvable`);
        element.innerHTML = `<div class="xano-error">Template ${templateSelector} introuvable</div>`;
        return;
    }
    
    // Vider le contenu actuel
    const container = element.querySelector('[data-xano-list-container]') || element;
    container.innerHTML = '';
    
    // Cacher le template
    if (templateElement.tagName !== 'TEMPLATE') {
        templateElement.style.display = 'none';
    }
    
    // Si aucune donnée, afficher un message
    if (dataArray.length === 0) {
        const emptyMessage = element.getAttribute('data-xano-empty-message') || "Aucune donnée à afficher";
        container.innerHTML = `<div class="xano-empty-message">${emptyMessage}</div>`;
        return;
    }
    
    // Créer un fragment pour améliorer les performances
    const fragment = document.createDocumentFragment();
    
    // Pour chaque élément de données
    dataArray.forEach((item, index) => {
        // Cloner le template
        const clone = templateElement.tagName === 'TEMPLATE' 
            ? templateElement.content.firstElementChild.cloneNode(true)
            : templateElement.cloneNode(true);
        
        clone.style.display = '';
        clone.setAttribute('data-xano-list-item', '');
        clone.setAttribute('data-xano-item-index', index.toString());
        
        // Lier les données
        const boundElements = clone.querySelectorAll('[data-xano-bind]');
        boundElements.forEach(boundElement => {
            bindElementData(boundElement, item);
        });
        
        // Si le clone lui-même a data-xano-bind
        if (clone.hasAttribute('data-xano-bind')) {
            bindElementData(clone, item);
        }
        
        // Gérer les liens
        const linkElements = clone.querySelectorAll('[data-xano-link-to]');
        linkElements.forEach(linkElement => {
            const targetPage = linkElement.getAttribute('data-xano-link-to');
            const idField = linkElement.getAttribute('data-xano-link-param-id') || 'id';
            const idParamName = linkElement.getAttribute('data-xano-link-url-param') || 'id';
            
            let linkTarget = targetPage;
            if (item[idField]) {
                linkTarget = `${targetPage}?${idParamName}=${encodeURIComponent(item[idField])}`;
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
            if (item[idField]) {
                linkTarget = `${targetPage}?${idParamName}=${encodeURIComponent(item[idField])}`;
            }
            
            if (clone.tagName === 'A') {
                clone.href = linkTarget;
            } else {
                clone.setAttribute('data-xano-link-target', linkTarget);
                clone.style.cursor = 'pointer';
            }
        }
        
        fragment.appendChild(clone);
    });
    
    container.appendChild(fragment);
    
    // Initialiser Swiper si nécessaire
    if (typeof Swiper !== 'undefined') {
        setTimeout(() => {
            initializeSwiperSliders(container);
        }, isSafari ? 200 : 50); // Délai légèrement plus long pour Safari
    }
}

// Initialisation simplifiée des sliders Swiper
function initializeSwiperSliders(container) {
    console.log('[SWIPER] Recherche de sliders dans', container);
    
    const sliders = container.querySelectorAll('.swiper');
    console.log(`[SWIPER] ${sliders.length} sliders trouvés`);
    
    sliders.forEach((slider, index) => {
        try {
            console.log(`[SWIPER] Initialisation du slider #${index}`);
            
            // Vérifier que le slider n'est pas déjà initialisé
            if (slider.classList.contains('swiper-initialized')) {
                console.log(`[SWIPER] Slider #${index} déjà initialisé`);
                return;
            }
            
            const slides = slider.querySelectorAll('.swiper-slide');
            console.log(`[SWIPER] Slider #${index} contient ${slides.length} slides`);
            
            if (slides.length === 0) {
                console.log(`[SWIPER] Pas de slides dans le slider #${index}, initialisation ignorée`);
                return;
            }
            
            const swiperOptions = {
                loop: slides.length > 1,
                spaceBetween: 10,
                slidesPerView: 1,
                pagination: {
                    el: slider.querySelector('.swiper-pagination'),
                    clickable: true
                },
                navigation: {
                    nextEl: slider.querySelector('.swiper-button-next'),
                    prevEl: slider.querySelector('.swiper-button-prev')
                },
                observer: true,
                observeParents: true
            };
            
            const swiperInstance = new Swiper(slider, swiperOptions);
            console.log(`[SWIPER] Slider #${index} initialisé avec succès`);
            
        } catch (error) {
            console.error(`[SWIPER] Erreur lors de l'initialisation du slider #${index}:`, error);
        }
    });
}

// Fonction simplifiée pour lier les données
function bindElementData(element, data) {
    const dataKey = element.getAttribute('data-xano-bind');
    if (!dataKey) return;
    
    // Vérifier si c'est un slider de photos
    if (dataKey === '_property_photos_slider') {
        bindPhotoSlider(element, data);
        return;
    }
    
    // Accéder à la valeur (prise en charge des chemins imbriqués)
    let value = data;
    const keys = dataKey.split('.');
    
    for (const key of keys) {
        if (value && typeof value === 'object' && key in value) {
            value = value[key];
        } else {
            value = undefined;
            break;
        }
    }
    
    if (value === undefined || value === null) {
        console.log(`[BIND] Clé "${dataKey}" non trouvée dans`, data);
        value = '';
    }
    
    // Appliquer la valeur selon le type d'élément
    switch (element.tagName.toLowerCase()) {
        case 'img':
            element.src = value;
            break;
        case 'input':
            if (element.type === 'checkbox' || element.type === 'radio') {
                element.checked = element.type === 'checkbox' ? !!value : element.value == value;
            } else {
                element.value = value;
            }
            break;
        case 'textarea':
        case 'select':
            element.value = value;
            break;
        case 'a':
            if (!element.hasAttribute('data-xano-link-to')) {
                element.href = value;
            }
            if (!element.textContent || dataKey !== 'href') {
                element.textContent = value;
            }
            break;
        default:
            element.textContent = value;
    }
    
    // Gérer les attributs liés
    for (const attr of element.attributes) {
        if (attr.name.startsWith('data-xano-bind-attr-')) {
            const attrName = attr.name.replace('data-xano-bind-attr-', '');
            const attrValueKey = attr.value;
            
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
                element.setAttribute(attrName, attrValue);
            }
        }
    }
    
    // Stocker l'ID pour référence
    if (element.hasAttribute('data-xano-link-to') && data.id) {
        element.setAttribute('data-xano-data-id', data.id);
    }
}

// Fonction pour lier un slider de photos
function bindPhotoSlider(element, data) {
    console.log('[SLIDER] Préparation du slider de photos pour', data.id || 'élément sans ID');
    
    const photosArray = data._property_photos;
    if (!photosArray || !Array.isArray(photosArray) || photosArray.length === 0) {
        console.log('[SLIDER] Pas de photos, masquage du slider');
        element.style.display = 'none';
        return;
    }
    
    const swiperContainer = element.querySelector('.swiper');
    if (!swiperContainer) {
        console.error('[SLIDER] Conteneur .swiper non trouvé');
        return;
    }
    
    const swiperWrapper = swiperContainer.querySelector('.swiper-wrapper');
    if (!swiperWrapper) {
        console.error('[SLIDER] .swiper-wrapper non trouvé');
        return;
    }
    
    // Vider le wrapper
    swiperWrapper.innerHTML = '';
    
    // Ajouter chaque photo comme slide
    photosArray.forEach((photo, index) => {
        if (photo.images && photo.images.length > 0 && photo.images[0].url) {
            const imageUrl = photo.images[0].url;
            
            const slideElement = document.createElement('div');
            slideElement.className = 'swiper-slide';
            
            const imgElement = document.createElement('img');
            imgElement.src = imageUrl;
            imgElement.alt = `Photo ${index+1}`;
            
            slideElement.appendChild(imgElement);
            swiperWrapper.appendChild(slideElement);
            
            console.log(`[SLIDER] Slide ${index+1} ajoutée avec image: ${imageUrl}`);
        }
    });
    
    // S'assurer que le slider est visible
    element.style.display = '';
    console.log('[SLIDER] Préparation terminée, attendant initialisation');
}

// Fonctions utilitaires
function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

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


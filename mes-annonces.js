document.addEventListener('DOMContentLoaded', function() {
    const xanoClient = new XanoClient({
        apiGroupBaseUrl: 'https://xwxl-obyg-b3e3.p7.xano.io/api:qom0bt4V', // Assurez-vous que c'est le bon endpoint pour vos annonces
    });

    // Gérer les chargements de données API
    const xanoElements = document.querySelectorAll('[data-xano-endpoint]');
    xanoElements.forEach(element => {
        const endpoint = element.getAttribute('data-xano-endpoint');
        const method = (element.getAttribute('data-xano-method') || 'GET').toUpperCase();
        const params = {};
        
        for (const attr of element.attributes) {
            if (attr.name.startsWith('data-xano-param-')) {
                params[attr.name.replace('data-xano-param-', '')] = attr.value;
            }
        }
        
        if (element.hasAttribute('data-xano-use-url-param')) {
            const urlParamName = element.getAttribute('data-xano-use-url-param');
            const urlParamValue = getQueryParam(urlParamName);
            
            if (urlParamValue) {
                const apiParamName = element.getAttribute('data-xano-url-param-to-api') || urlParamName;
                params[apiParamName] = urlParamValue;
            }
        }

        const authToken = getCookie('xano_auth_token');
        if (authToken) {
            xanoClient.setAuthToken(authToken);
        }

        fetchXanoData(xanoClient, endpoint, method, params, element);
    });
    
    document.addEventListener('xano:data-loaded', function(event) {
        const element = event.detail.element;
        // const data = event.detail.data; // data n'est pas utilisé directement ici
        
        const linkElements = document.querySelectorAll('[data-xano-link-to]');
        linkElements.forEach(linkElement => {
            const targetPage = linkElement.getAttribute('data-xano-link-to');
            // const idField = linkElement.getAttribute('data-xano-link-param-id') || 'id'; // Géré dans renderListData
            // const idParamName = linkElement.getAttribute('data-xano-link-url-param') || 'id'; // Géré dans renderListData
            
            if (!linkElement.closest('[data-xano-list-item]')) {
                let linkTarget = targetPage;
                
                if (linkElement.hasAttribute('data-xano-data-id')) {
                    const dataId = linkElement.getAttribute('data-xano-data-id');
                    const idParamName = linkElement.getAttribute('data-xano-link-url-param') || 'id';
                    linkTarget = `${targetPage}?${idParamName}=${dataId}`;
                }
                
                if (linkElement.tagName === 'A') {
                    linkElement.href = linkTarget;
                } else {
                    linkElement.setAttribute('data-xano-link-target', linkTarget);
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

async function fetchXanoData(client, endpoint, method, params, targetElement) {
    try {
        let response;
        if (method === 'GET') {
            response = await client.get(endpoint, params);
        } else if (method === 'POST') {
            response = await client.post(endpoint, params);
        } else if (method === 'PUT'){
            response = await client.put(endpoint, params);
        } else if (method === 'PATCH'){
            response = await client.patch(endpoint, params);
        } else if (method === 'DELETE'){
            response = await client.delete(endpoint, params);
        } else {
            throw new Error(`Méthode HTTP non supportée: ${method}`);
        }

        renderData(response, targetElement);

    } catch (error) {
        console.error('Erreur Xano:', error);
        targetElement.textContent = "Erreur lors du chargement."; // Ou un message plus discret
        const errorEvent = new CustomEvent('xano:data-error', {
            detail:{error: error, element: targetElement},
            bubbles: true
        });
        targetElement.dispatchEvent(errorEvent);
    }
}

function renderData(data, element) {
    if (element.hasAttribute('data-xano-list')) {
        let listData = null;
        
        // Essayer de trouver le tableau de données dans la réponse Xano
        if (Array.isArray(data)) {
            listData = data;
        } else if (data && Array.isArray(data.items)) { // Structure commune de Xano pour les listes paginées
            listData = data.items;
        } else if (data && typeof data === 'object') { 
            // Recherche générique d'un tableau comme propriété de l'objet de réponse
            for (const key in data) {
                if (Array.isArray(data[key])) {
                    listData = data[key];
                    break;
                }
            }
        }
        
        if (listData) {
            renderListData(listData, element);
        } else {
            console.warn('Données non valides ou chemin incorrect pour la liste. Réponse Xano:', data);
            const container = element.querySelector('[data-xano-list-container]') || element;
            container.textContent = "Erreur : Données de liste non trouvées ou non valides.";
             // Dispatcher l'événement même en cas d'erreur de structure de données pour que les liens statiques se mettent à jour
            const event = new CustomEvent('xano:data-loaded', {
                detail: { data: data, element: element, error: "Data structure for list not found" },
                bubbles: true
            });
            element.dispatchEvent(event);
            return; // Arrêter ici si pas de listData
        }
    } else {
        // C'est un élément unique (pas une liste)
        const boundElements = element.querySelectorAll('[data-xano-bind]');
        boundElements.forEach(boundElement => {
            // Si la réponse Xano est enveloppée (ex: { "annonce_details": {...} }),
            // il faut essayer de trouver l'objet principal.
            // Pour un seul item, on s'attend souvent à ce que 'data' soit l'objet directement
            // ou data.results, data.details etc. Adaptez au besoin.
            // Ici, on suppose que 'data' est l'objet ou contient l'objet directement.
            let itemData = data;
            if(data && !Array.isArray(data) && Object.keys(data).length === 1 && typeof Object.values(data)[0] === 'object'){
                 // Si la donnée est un objet avec une seule clé dont la valeur est un objet (cas typique Xano)
                itemData = Object.values(data)[0];
            }
            bindDataToElement(boundElement, itemData);
        });
    }

    const event = new CustomEvent('xano:data-loaded', {
        detail: { data: data, element: element },
        bubbles: true
    });
    element.dispatchEvent(event);
}

function renderListData(dataArray, element) {
    dataArray = Array.isArray(dataArray) ? dataArray : [];
    
    const templateSelector = element.getAttribute('data-xano-list');
    const templateElement = document.querySelector(templateSelector);

    if (!templateElement) {
        console.error(`Élément modèle "${templateSelector}" introuvable.`);
        element.textContent = `Erreur : Élément modèle "${templateSelector}" introuvable.`;
        return;
    }

    const container = element.querySelector('[data-xano-list-container]') || element;
    
    // Vider le conteneur avant d'ajouter de nouveaux éléments
    // en s'assurant de ne pas supprimer le template lui-même s'il est enfant direct
    let child = container.firstChild;
    while(child) {
        if (child !== templateElement) {
            const nextChild = child.nextSibling;
            container.removeChild(child);
            child = nextChild;
        } else {
            child = child.nextSibling;
        }
    }
    
    templateElement.style.display = 'none'; // Assurez-vous qu'il est caché

    dataArray.forEach((item, index) => {
        const clone = templateElement.cloneNode(true);
        clone.style.display = ''; // Ou le style d'affichage par défaut de vos items
        clone.setAttribute('data-xano-list-item', '');
        clone.setAttribute('data-xano-item-index', index);
        
        const boundElements = clone.querySelectorAll('[data-xano-bind]');
        boundElements.forEach(boundElement => {
            bindDataToElement(boundElement, item); // 'item' est l'objet annonce individuel
        });
        
        const linkElements = clone.querySelectorAll('[data-xano-link-to]');
        linkElements.forEach(linkElement => {
            const targetPage = linkElement.getAttribute('data-xano-link-to');
            const idField = linkElement.getAttribute('data-xano-link-param-id') || 'id'; // 'id' de l'annonce
            const idParamName = linkElement.getAttribute('data-xano-link-url-param') || 'id'; // nom du paramètre dans l'URL
            
            let linkTarget = targetPage;
            const itemId = getNestedValue(item, idField); // Utilise getNestedValue au cas où l'ID serait niché

            if (itemId !== undefined) {
                linkTarget = `${targetPage}?${idParamName}=${itemId}`;
            }
            
            if (linkElement.tagName === 'A') {
                linkElement.href = linkTarget;
            } else {
                linkElement.setAttribute('data-xano-link-target', linkTarget);
                linkElement.style.cursor = 'pointer';
            }
        });
        
        container.appendChild(clone);
    });

    if (dataArray.length === 0) {
        let messageElement;
        const customMessage = element.getAttribute('data-xano-empty-message');
        if (customMessage) {
            messageElement = document.createElement('div');
            messageElement.className = 'xano-empty-message'; // Vous pouvez styler cette classe
            messageElement.textContent = customMessage;
        } else {
            messageElement = document.createElement('div');
            messageElement.className = 'xano-empty-message';
            messageElement.textContent = "Aucune annonce à afficher.";
        }
        container.appendChild(messageElement);
    }
}


// NOUVEAU: Fonction copiée de detail-annonce.js (ou d'un fichier utilitaire commun)
function getNestedValue(obj, pathString) {
    if (!obj || !pathString || typeof pathString !== 'string') return undefined;
    const path = pathString.split('.');
    let current = obj;
    for (let i = 0; i < path.length; i++) {
        const segment = path[i];
        if (current === null || current === undefined) return undefined;

        if (Array.isArray(current) && !isNaN(parseInt(segment, 10))) {
            current = current[parseInt(segment, 10)];
        } else if (typeof current !== 'object' || typeof current[segment] === 'undefined') {
            return undefined; 
        } else {
            current = current[segment];
        }
    }
    return current;
}

// MODIFIÉ: Fonction bindDataToElement pour utiliser getNestedValue et gérer les images de couverture
function bindDataToElement(element, data) {
    const dataKey = element.getAttribute('data-xano-bind');
    if (!dataKey) return;

    const value = getNestedValue(data, dataKey);

    let displayValue;
    if (typeof value === 'boolean') {
        displayValue = String(value);
    } else {
        displayValue = (value === null || value === undefined) ? '' : value;
    }

    switch (element.tagName.toLowerCase()) {
        case 'img':
            console.log(`[DEBUG IMAGE] Binding pour dataKey: ${dataKey}`, element);
            const propertyTitleForAlt = getNestedValue(data, 'property_title') || 'Image de l\'annonce';
            console.log(`[DEBUG IMAGE] propertyTitleForAlt: ${propertyTitleForAlt}`);

            // Styles par défaut pour une image réelle, basés sur votre template HTML
            // Si votre template a des styles inline, ils seront utilisés. Sinon, ces valeurs seront les styles par défaut.
            const imageRealStyles = {
                width: element.style.width || '100px',
                height: element.style.height || 'auto',
                objectFit: element.style.objectFit || 'cover',
                backgroundColor: element.style.backgroundColor || '#f0f0f0', // Fond de votre template
                borderRadius: element.style.borderRadius || ''
            };
            console.log('[DEBUG IMAGE] imageRealStyles capturés:', imageRealStyles);


            let imageUrl = null;

            if (dataKey === '_property_photos') { // Note: j'ai enlevé la ré-déclaration de dataKeyForImg
                console.log('[DEBUG IMAGE] Traitement pour _property_photos. Valeur reçue (value):', value);
                if (Array.isArray(value) && value.length > 0) {
                    let coverPhotoObject = value.find(photo => getNestedValue(photo, 'is_cover') === true);
                    console.log('[DEBUG IMAGE] coverPhotoObject (après recherche is_cover):', coverPhotoObject);

                    if (!coverPhotoObject) {
                        coverPhotoObject = value[0]; // Fallback
                        console.log('[DEBUG IMAGE] coverPhotoObject (fallback sur le premier):', coverPhotoObject);
                    }

                    if (coverPhotoObject) {
                        const imagesArray = getNestedValue(coverPhotoObject, 'images');
                        console.log('[DEBUG IMAGE] imagesArray dans coverPhotoObject:', imagesArray);
                        if (Array.isArray(imagesArray) && imagesArray.length > 0 && getNestedValue(imagesArray[0], 'url')) {
                            imageUrl = getNestedValue(imagesArray[0], 'url');
                        }
                        if (!imageUrl && getNestedValue(coverPhotoObject, 'url_photo')) {
                            imageUrl = getNestedValue(coverPhotoObject, 'url_photo');
                            console.log('[DEBUG IMAGE] imageUrl trouvé via url_photo:', imageUrl);
                        } else if (imageUrl) {
                            console.log('[DEBUG IMAGE] imageUrl trouvé via images[0].url:', imageUrl);
                        }
                    } else {
                        console.log('[DEBUG IMAGE] Aucun coverPhotoObject trouvé (tableau _property_photos peut-être vide après filtrage initial).');
                    }
                } else {
                     console.log('[DEBUG IMAGE] _property_photos n\'est pas un tableau ou est vide.');
                }
            } else {
                console.log(`[DEBUG IMAGE] Traitement pour une image simple (dataKey: ${dataKey}). Valeur reçue (value):`, value);
                if (typeof value === 'object' && value && value.url) {
                    imageUrl = value.url;
                } else if (typeof value === 'string' && (value.startsWith('http') || value.startsWith('/') || value.startsWith('data:'))) {
                    imageUrl = value;
                }
                console.log('[DEBUG IMAGE] imageUrl pour image simple:', imageUrl);
            }

            console.log(`[DEBUG IMAGE] imageUrl final déterminé: ${imageUrl}`);

            if (imageUrl) {
                console.log('[DEBUG IMAGE] Application de l\'image réelle.');
                element.src = imageUrl;
                element.alt = propertyTitleForAlt;
                element.style.width = imageRealStyles.width;
                element.style.height = imageRealStyles.height;
                element.style.objectFit = imageRealStyles.objectFit;
                element.style.backgroundColor = imageRealStyles.backgroundColor;
                element.style.borderRadius = imageRealStyles.borderRadius;
            } else {
                console.log('[DEBUG IMAGE] Application du placeholder.');
                element.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"; // Pixel transparent
                element.alt = propertyTitleForAlt;
                element.style.width = '5rem';
                element.style.height = '5rem';
                element.style.objectFit = 'cover';
                element.style.backgroundColor = '#F7F7F7';
                element.style.borderRadius = '1rem';
            }
            break;

        // ... (autres cases: input, textarea, etc. restent inchangées) ...
        case 'input':
            if (element.type === 'checkbox' || element.type === 'radio') {
                if (element.type === 'checkbox'){
                     element.checked = !!value;
                 } else { // radio
                     element.checked = (element.value == value);
                 }
            } else if (element.type === 'date' && value) {
                 try {
                     element.value = new Date(value).toISOString().split('T')[0];
                 } catch (e) { element.value = ''; console.warn("Impossible de formater la date", value); }
            } else if (element.type === 'datetime-local' && value) {
                  try {
                     const d = new Date(value);
                     element.value = d.toISOString().substring(0, 16);
                  } catch (e) { element.value = ''; console.warn("Impossible de formater datetime-local", value); }
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
             if (!element.textContent.trim() || (dataKey !== 'href' && dataKey !== element.getAttribute('href'))) {
                  element.textContent = displayValue;
              }
            break;
        default:
            if (element.hasAttribute('data-xano-bind-html') && typeof value === 'string') {
                element.innerHTML = value;
            } else {
                element.textContent = displayValue;
            }
    }


    for (const attr of element.attributes) {
        if (attr.name.startsWith('data-xano-bind-attr-')) {
            const attrName = attr.name.replace('data-xano-bind-attr-', '');
            const attrValueKey = attr.value;
            const attrValue = getNestedValue(data, attrValueKey);

            if (attrValue !== undefined) {
                if (typeof attrValue === 'boolean') {
                     if (attrValue) {
                         element.setAttribute(attrName, '');
                     } else {
                         element.removeAttribute(attrName);
                     }
                } else {
                    element.setAttribute(attrName, attrValue);
                }
            } else {
                 element.removeAttribute(attrName);
            }
        }
    }

     const itemId = getNestedValue(data, 'id');
     if (element.hasAttribute('data-xano-link-to') && itemId !== undefined) {
         element.setAttribute('data-xano-data-id', itemId);
     }
}

function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

// La fonction getCookie est déjà définie dans auth-xano.js si vous le chargez.
// Si auth-xano.js n'est pas sur CETTE page, vous devez la définir ici.
// Je la laisse commentée pour éviter les doublons si auth-xano.js est présent.
/*
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
*/

// Si XanoClient est chargé par un autre script (comme auth-xano.js), vous n'avez pas besoin de redéfinir la classe ici.
// Sinon, vous devrez inclure la définition de la classe XanoClient.
// Pour l'instant, on suppose qu'elle est disponible globalement.


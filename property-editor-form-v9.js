// ==========================================
// == Script Xano Unifié (Formulaires + Données) ==
// ==========================================
// Date: 2025-04-28 // Version 9 (Utilisation IDs)

let xanoClient; // Déclarez xanoClient ici
let currentSortableInstance = null;

// Variables pour la sélection multiple de photos
let modeSelectionActif = false; // false = pas en mode sélection, true = en mode sélection
let photosSelectionneesIds = []; // MODIFIÉ: Contiendra les IDs numériques des photos
let currentSelectedRoomId = null;

function setupRoomTypeSelection() {
    // Cible le conteneur de ta Collection List (ajuste le sélecteur si besoin)
    const roomTypesListWrapper = document.querySelector(
        '[data-element="room-types-list-wrapper"]'); // Exemple d'attribut

    // Cible l'input caché dans le formulaire d'ajout de pièce (ajuste le sélecteur)
    // Il faut cibler l'input qui doit recevoir la valeur pour Xano (base_room_name)
    const addRoomForm = document.querySelector(
        '[data-xano-form="property_photos_rooms"]'); // Trouve le bon formulaire
    const hiddenRoomNameInput = addRoomForm ? addRoomForm.querySelector(
        '[data-xano-field-name="room_name"]') : null; // Trouve l'input caché

    if (!roomTypesListWrapper) {
        console.warn("setupRoomTypeSelection: Wrapper de la liste des types de pièce non trouvé.");
        return;
    }
    if (!addRoomForm) {
        console.warn("setupRoomTypeSelection: Formulaire d'ajout de pièce non trouvé.");
        return;
    }
    if (!hiddenRoomNameInput) {
        console.error(
            "setupRoomTypeSelection: Input caché [data-xano-field-name='room_name'] non trouvé dans le formulaire d'ajout !"
        );
        return;
    }

    console.log(
        "setupRoomTypeSelection: Initialisation de l'écouteur de clic pour la sélection du type de pièce."
    );

    roomTypesListWrapper.addEventListener('click', function(event) {
        // Trouve le bouton cliqué (ou son parent) qui a l'attribut data-action="select-room-type"
        const clickedButton = event.target.closest('[data-action="select-room-type"]');

        if (clickedButton) {
            // Récupère le nom de la pièce depuis l'attribut data-room-type-name
            const roomTypeName = clickedButton.getAttribute('data-room-type-name');

            if (roomTypeName) {
                console.log(`setupRoomTypeSelection: Type de pièce sélectionné: ${roomTypeName}`);

                // Met à jour la valeur de l'input caché dans le formulaire d'ajout
                hiddenRoomNameInput.value = roomTypeName;

                // Déclenche manuellement l'événement 'input' sur cet input pour que
                // l'autre script (qui surveille 'base_room_name') soit notifié du changement.
                const inputEvent = new Event('input', {
                    bubbles: true,
                    cancelable: true
                });
                hiddenRoomNameInput.dispatchEvent(inputEvent);

                // Optionnel : Gérer le feedback visuel (classe 'is-selected')
                // Enlève la classe de tous les boutons de type
                roomTypesListWrapper.querySelectorAll('[data-action="select-room-type"]').forEach(
                    btn => {
                        btn.classList.remove('is-selected'); // Nom de classe à définir dans Webflow
                    });
                // Ajoute la classe au bouton cliqué
                clickedButton.classList.add('is-selected');

                // Optionnel : Faire autre chose, comme afficher le formulaire s'il était caché
                // addRoomForm.style.display = 'block';

            } else {
                console.warn(
                    "setupRoomTypeSelection: Attribut data-room-type-name manquant ou vide sur le bouton cliqué.",
                    clickedButton);
            }
        }
    });
}

// Modifie ton écouteur DOMContentLoaded pour appeler la nouvelle fonction
document.addEventListener('DOMContentLoaded', function() {
    // --- Configuration ---
    try { // Ajout d'un try/catch global pour l'init
        // Assignez la variable déclarée plus haut
        xanoClient = new XanoClient({ // Pas de 'const' ici
            apiGroupBaseUrl: 'https://xwxl-obyg-b3e3.p7.xano.io/api:qom0bt4V', // Remplacez par votre URL
        });
        console.log("1. Instance xanoClient créée.");

        // --- Initialisation ---
        const authToken = getCookie('xano_auth_token'); // Assurez-vous que ce cookie existe et est valide
        if (authToken) {
            xanoClient.setAuthToken(authToken);
            console.log("2. Auth Token appliqué à xanoClient.");
        } else {
            console.log("2. Pas d'Auth Token trouvé.");
        }

        initXanoForms(xanoClient); // Initialise tes formulaires existants
        console.log("3. initXanoForms appelé.");
        initXanoDataEndpoints(xanoClient); // Charge les données éventuelles
        console.log("4. initXanoDataEndpoints appelé.");

        // --- NOUVEAU : Active la sélection des types de pièces ---
        setupRoomTypeSelection();
        console.log("5. setupRoomTypeSelection appelé.");
        // ------------------------------------------------------

        initXanoLinkHandlers();
        console.log("6. initXanoLinkHandlers appelé.");


        // --- Vérification avant appel critique ---
        console.log("7. PRÊT à appeler setupCreatedRoomSelection.");
        console.log("   Vérification de xanoClient juste avant l'appel:", xanoClient); // Est-ce un objet valide ?

        if (typeof setupCreatedRoomSelection !== 'function') {
            console.error("ERREUR CRITIQUE: setupCreatedRoomSelection n'est pas une fonction !");
            return;
        }
        if (!xanoClient) {
            console.error("ERREUR CRITIQUE: xanoClient est undefined/null avant l'appel !");
            return;
        }


        // --- NOUVEAU : Active la sélection des pièces créées ---
        setupCreatedRoomSelection(xanoClient);
        // -------------------------------------------------------

        console.log("8. Appel à setupCreatedRoomSelection TERMINÉ (ne signifie pas qu'elle a réussi).");
        // --- Fin Vérification ---

        // --- NOUVEAU : Initialise la logique de sélection/suppression de photos ---
        setupPhotoSelectionMode();
        console.log("9. setupPhotoSelectionMode appelé.");
        // ----------------------------------------------------------------------


        console.log("10. Initialisation UNIFIÉE terminée (fin du bloc try DOMContentLoaded).");

    } catch (initError) {
        console.error("ERREUR GLOBALE DANS DOMContentLoaded:", initError);
        // Une erreur ici pourrait empêcher setupCreatedRoomSelection d'être appelée
    }
});

// ==========================================
// == Classe XanoClient Améliorée          ==
// ==========================================
class XanoClient {
    constructor(config) {
        this.apiGroupBaseUrl = config.apiGroupBaseUrl;
        this.authToken = null;
    }

    setAuthToken(token) {
        this.authToken = token;
    }

    async _request(method, endpoint, paramsOrBody = null, isFormData = false) {
        const url = `${this.apiGroupBaseUrl}/${endpoint}`;
        const options = {
            method: method,
            headers: {},
        };

        if (this.authToken) {
            options.headers['Authorization'] = `Bearer ${this.authToken}`;
        }

        let finalUrl = url;

        if (method === 'GET' && paramsOrBody) {
            const queryParams = new URLSearchParams(paramsOrBody).toString();
            if (queryParams) {
                finalUrl = `${url}?${queryParams}`;
            }
        } else if (['POST', 'PUT', 'PATCH'].includes(method) && paramsOrBody) {
            if (isFormData) {
                options.body = paramsOrBody;
            } else {
                options.headers['Content-Type'] = 'application/json';
                options.body = JSON.stringify(paramsOrBody);
            }
        }

        try {
            const response = await fetch(finalUrl, options);

            if (response.status === 204 || response.headers.get('content-length') === '0') {
                if (!response.ok) {
                    throw new Error(`Erreur HTTP ${response.status}`);
                }
                return null;
            }

            const responseData = await response.json();

            if (!response.ok) {
                const message = responseData.message || `Erreur HTTP ${response.status}`;
                throw new Error(message);
            }
            return responseData;

        } catch (error) {
            console.error(`Erreur lors de l'appel ${method} ${endpoint}:`, error);
            throw error;
        }
    }

    async get(endpoint, params = null) {
        return this._request('GET', endpoint, params);
    }

    async post(endpoint, body = null, isFormData = false) {
        return this._request('POST', endpoint, body, isFormData);
    }

    async put(endpoint, body = null, isFormData = false) {
        return this._request('PUT', endpoint, body, isFormData);
    }

    async patch(endpoint, body = null, isFormData = false) {
        return this._request('PATCH', endpoint, body, isFormData);
    }

    async delete(endpoint, params = null) {
        // MODIFIÉ: Pour DELETE, on s'attend souvent à un ID dans l'URL, mais on peut aussi envoyer un body JSON
        // Si params est fourni et n'est pas nul, on l'envoie comme body JSON.
        // Si l'ID doit être dans l'URL, il faut construire finalEndpoint différemment.
        // Ici, on suppose que l'endpoint gère soit un ID dans l'URL (construit avant l'appel),
        // soit un corps JSON (par exemple pour batch delete).
        return this._request('DELETE', endpoint, params, false); // false: Assume JSON body if params exist
    }
}

// ==========================================
// == Initialisation des Formulaires       ==
// ==========================================
function initXanoForms(xanoClient) {
    const xanoForms = document.querySelectorAll('[data-xano-form]');
    xanoForms.forEach((form) => {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();

            const endpoint = form.getAttribute('data-xano-form');
            const method = (form.getAttribute('data-xano-form-method') || 'POST').toUpperCase();

            const loadingElement = form.querySelector('[data-xano-form-loading]') || document
                .querySelector(form.getAttribute(
                    'data-xano-form-loading-selector'));
            const errorElement = form.querySelector('[data-xano-form-error]') || document
                .querySelector(form.getAttribute('data-xano-form-error-selector'));
            const submitButton = form.querySelector(
                'button[type="submit"], input[type="submit"]');

            if (errorElement) errorElement.style.display = 'none';
            if (loadingElement) loadingElement.style.display = 'block';
            if (submitButton) submitButton.disabled = true;

            try {
                let finalEndpoint = endpoint;
                let requestBody = null;
                let isFormData = false; // Par défaut, non FormData

                // Gérer l'ID dans l'URL pour PUT/PATCH/DELETE
                if (form.hasAttribute('data-xano-form-id-param')) {
                    const idParamName = form.getAttribute('data-xano-form-id-param');
                    const idValue = getQueryParam(idParamName);
                    if (idValue && ['PUT', 'PATCH', 'DELETE'].includes(method)) {
                        finalEndpoint = `${endpoint}/${idValue}`;
                    } else if (idValue && method === 'POST') {
                        // Si l'ID doit être dans l'URL pour POST (rare mais possible)
                         finalEndpoint = `${endpoint}/${idValue}`;
                         console.warn("ID ajouté à l'URL pour POST via data-xano-form-id-param.");
                    }
                }

                // Vérifier si le formulaire contient des fichiers
                const hasFiles = form.querySelector('input[type="file"]');
                if (hasFiles && ['POST', 'PUT', 'PATCH'].includes(method)) {
                    requestBody = collectFormDataWithFiles(form);
                    isFormData = true; // Marquer comme FormData
                } else if (['POST', 'PUT', 'PATCH'].includes(method)) {
                    // Collecter comme objet simple si pas de fichiers
                    requestBody = collectSimpleFormData(form);
                    isFormData = false;
                }
                // Pour DELETE, requestBody reste null par défaut (l'ID est dans l'URL)

                let responseData;
                switch (method) {
                    case 'POST':
                        responseData = await xanoClient.post(finalEndpoint, requestBody, isFormData);
                        break;
                    case 'PUT':
                        responseData = await xanoClient.put(finalEndpoint, requestBody, isFormData);
                        break;
                    case 'PATCH':
                        responseData = await xanoClient.patch(finalEndpoint, requestBody, isFormData);
                        break;
                    case 'DELETE':
                        // L'ID est dans finalEndpoint, pas de body nécessaire ici
                        responseData = await xanoClient.delete(finalEndpoint);
                        break;
                    default:
                        throw new Error(`Méthode de formulaire non supportée: ${method}`);
                }

                const successEvent = new CustomEvent('xano:form-success', {
                    detail: {
                        response: responseData,
                        form: form
                    },
                    bubbles: true,
                });
                form.dispatchEvent(successEvent);

                if (form.hasAttribute('data-xano-form-redirect')) {
                    const redirectUrl = form.getAttribute('data-xano-form-redirect');
                    window.location.href = redirectUrl;
                } else {
                     // Si c'est le formulaire d'upload de photos, rafraîchir la liste après succès
                     if (form.getAttribute('data-xano-form') === 'upload_multiple_photos') {
                         console.log("Upload réussi, rafraîchissement des photos...");
                         await refreshCurrentRoomPhotos(xanoClient); // NOUVELLE fonction helper
                     } else {
                         // form.reset(); // Optionnel pour autres formulaires
                     }
                }

            } catch (error) {
                console.error('Erreur lors de la soumission du formulaire:', error);
                if (errorElement) {
                    errorElement.textContent = error.message || "Une erreur inconnue est survenue.";
                    errorElement.style.display = 'block';
                }
                const errorEvent = new CustomEvent('xano:form-error', {
                    detail: {
                        error: error,
                        form: form
                    },
                    bubbles: true,
                });
                form.dispatchEvent(errorEvent);
            } finally {
                if (loadingElement) loadingElement.style.display = 'none';
                if (submitButton) submitButton.disabled = false;
            }
        });
    });
}


// ==========================================
// == Init Récupération/Affichage Données  ==
// ==========================================
function initXanoDataEndpoints(xanoClient) {
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
            if (urlParamValue !== null) {
                const apiParamName = element.getAttribute('data-xano-url-param-to-api') || urlParamName;
                params[apiParamName] = urlParamValue;
            }
        }

        const loadingIndicator = element.querySelector('[data-xano-loading]') || document
            .querySelector(element.getAttribute('data-xano-loading-selector'));
        if (loadingIndicator) loadingIndicator.style.display = 'block';

        fetchXanoData(xanoClient, endpoint, method, params, element, loadingIndicator);
    });
}

// ==========================================
// == Init Gestionnaires de Liens          ==
// ==========================================
function initXanoLinkHandlers() {
    document.addEventListener('xano:data-loaded', function(event) {
        const loadedElement = event.detail.element;
        const data = event.detail.data;
        const potentialLinks = loadedElement.querySelectorAll('[data-xano-link-to]');

        potentialLinks.forEach(linkElement => {
            if (!linkElement.closest('[data-xano-list-item]')) {
                const targetPage = linkElement.getAttribute('data-xano-link-to');
                const idField = linkElement.getAttribute('data-xano-link-param-id') || 'id';
                const idParamName = linkElement.getAttribute('data-xano-link-url-param') || 'id';
                const sourceData = data ? .body ? data.body : data;
                let linkTarget = targetPage;

                if (sourceData && typeof sourceData === 'object' && sourceData[idField]) {
                    linkTarget =
                        `${targetPage}?${idParamName}=${encodeURIComponent(sourceData[idField])}`;
                } else if (linkElement.hasAttribute('data-xano-data-id')) {
                    linkTarget =
                        `${targetPage}?${idParamName}=${encodeURIComponent(linkElement.getAttribute('data-xano-data-id'))}`;
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
}

// ==========================================
// == Fonctions Logiques (Fetch, Render)   ==
// ==========================================

async function fetchXanoData(client, endpoint, method, params, targetElement, loadingIndicator) {
    try {
        let responseData;
        switch (method) {
            case 'GET':
                responseData = await client.get(endpoint, params);
                break;
            case 'POST':
                responseData = await client.post(endpoint, params);
                break;
            // Ajouter PUT, PATCH, DELETE si nécessaire pour récupérer des données via ces méthodes
            default:
                throw new Error(`Méthode HTTP non supportée pour data-xano-endpoint: ${method}`);
        }

        if (loadingIndicator) loadingIndicator.style.display = 'none';

        renderData(responseData, targetElement);

        const successEvent = new CustomEvent('xano:data-loaded', {
            detail: {
                data: responseData,
                element: targetElement
            },
            bubbles: true
        });
        targetElement.dispatchEvent(successEvent);

    } catch (error) {
        console.error(`Erreur lors de la récupération des données pour ${endpoint}:`, error);
        if (loadingIndicator) loadingIndicator.style.display = 'none';

        const errorDisplay = targetElement.querySelector('[data-xano-error]') || targetElement;
        if (errorDisplay) {
            errorDisplay.textContent =
                `Erreur: ${error.message || 'Impossible de charger les données.'}`;
            errorDisplay.style.color = 'red';
        }

        const errorEvent = new CustomEvent('xano:data-error', {
            detail: {
                error: error,
                element: targetElement
            },
            bubbles: true
        });
        targetElement.dispatchEvent(errorEvent);
    }
}

function renderData(data, element) {
    // --- Vérification SPÉCIFIQUE pour la liste de PHOTOS ---
    if (element.id === 'room-photos-display' && element.hasAttribute('data-xano-list')) {
        console.log("renderData: Appel de renderPhotoItems pour #room-photos-display");

        let listData = null;
        if (Array.isArray(data)) {
            listData = data; // Xano devrait renvoyer directement le tableau des enregistrements property_photos
        } else {
            console.warn("renderData: Données reçues pour photos ne sont pas un tableau:", data);
            listData = [];
        }
        renderPhotoItems(listData, element); // <<< APPEL renderPhotoItems ICI

    }
    // --- Logique pour TOUTES les AUTRES listes (ex: liste des rooms) ---
    else if (element.hasAttribute('data-xano-list')) {
        console.log("renderData: Appel de renderListData (générique) pour:", element);

        let listData = null;
        // Essayer de trouver le tableau dans la réponse
         if (Array.isArray(data)) { listData = data; }
         else if (data && Array.isArray(data.items)) { listData = data.items; } // Structure commune Xano
         else if (data && Array.isArray(data.body)) { listData = data.body; } // Autre structure possible
         else if (data && typeof data === 'object') { // Chercher un tableau dans l'objet
             for (const key in data) { if (Array.isArray(data[key])) { listData = data[key]; break; } }
         }

        if (!listData) {
            console.warn("renderData: Aucune donnée de liste trouvée pour", element, "dans", data);
            listData = [];
        }
        renderListData(listData, element); // <<< APPEL renderListData ICI

    }
    // --- Logique pour les éléments uniques (non-listes) ---
    else {
        console.log("renderData: Affichage d'un élément unique pour:", element);
        const sourceData = data ? .body ? data.body : data; // Adapter si la donnée unique est imbriquée
        if (sourceData && typeof sourceData === 'object') {
            const boundElements = element.querySelectorAll('[data-xano-bind]');
            if (boundElements.length > 0) {
                boundElements.forEach(boundElement => {
                    if (!boundElement.closest('[data-xano-list-item]')) {
                        bindDataToElement(boundElement, sourceData);
                    }
                });
            } else if (element.hasAttribute('data-xano-bind')) {
                bindDataToElement(element, sourceData);
            }
        } else {
            console.warn("renderData: Données pour élément unique non trouvées ou non objet:", sourceData);
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

    const container = listContainerElement.querySelector('[data-xano-list-container]') || listContainerElement;

    // Vider le conteneur (en préservant le template)
    let currentChild = container.firstChild;
    while (currentChild) {
        const nextChild = currentChild.nextSibling;
        if (currentChild !== templateElement && currentChild.nodeType === Node.ELEMENT_NODE && currentChild.hasAttribute('data-xano-list-item')) {
            container.removeChild(currentChild);
        }
        currentChild = nextChild;
    }
     // Supprimer aussi l'ancien message vide s'il existe
     const existingEmptyMessage = container.querySelector('.xano-empty-message');
     if (existingEmptyMessage) container.removeChild(existingEmptyMessage);


    if (templateElement.tagName !== 'TEMPLATE') {
        templateElement.style.display = 'none';
        templateElement.setAttribute('aria-hidden', 'true');
    }

    if (dataArray.length > 0) {
        dataArray.forEach((item, index) => { // item est une ROOM (property_photos_rooms) ici
            const clone = templateElement.tagName === 'TEMPLATE' ?
                templateElement.content.cloneNode(true).firstElementChild :
                templateElement.cloneNode(true);

            if (!clone) {
                console.error("Échec du clonage du template.", templateElement);
                return;
            }

            clone.style.display = '';
            clone.removeAttribute('aria-hidden');
            clone.setAttribute('data-xano-list-item', '');
            clone.setAttribute('data-xano-item-index', index.toString());

            // Lier les données aux sous-éléments [data-xano-bind]
            const boundElements = clone.querySelectorAll('[data-xano-bind]');
            boundElements.forEach(boundElement => {
                bindDataToElement(boundElement, item);
            });
            if (clone.hasAttribute('data-xano-bind')) {
                bindDataToElement(clone, item);
            }

            // Gérer les liens dynamiques [data-xano-link-to]
            const linkElements = clone.querySelectorAll('[data-xano-link-to]');
            linkElements.forEach(linkElement => {
                const targetPage = linkElement.getAttribute('data-xano-link-to');
                const idField = linkElement.getAttribute('data-xano-link-param-id') || 'id';
                const idParamName = linkElement.getAttribute('data-xano-link-url-param') || 'id';
                let linkTarget = targetPage;
                const idValue = item[idField];

                if (idValue !== undefined && idValue !== null) {
                    linkTarget = `${targetPage}?${idParamName}=${encodeURIComponent(idValue)}`;
                } else {
                    console.warn(`ID field "${idField}" non trouvé dans l'item pour le lien`, item);
                }

                if (linkElement.tagName === 'A') {
                    linkElement.href = linkTarget;
                } else {
                    linkElement.setAttribute('data-xano-link-target', linkTarget);
                    linkElement.style.cursor = 'pointer';
                }
            });
             // Gérer si le clone lui-même est un lien
             if (clone.hasAttribute('data-xano-link-to')) {
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


            // --- Logique spécifique pour la liste des ROOMS (property_photos_rooms) ---
            const clickableElement = clone.querySelector('[data-action="select-created-room"]') || clone;
            if (item.id !== undefined) {
                clickableElement.setAttribute('data-room-id', item.id); // ID de la room
                // Utiliser 'item.room_name' ou le nom de champ correct pour le nom de la pièce
                const roomNameField = 'room_name'; // Ajustez si le nom du champ est différent
                if (item[roomNameField]) {
                    clickableElement.setAttribute('data-room-name', item[roomNameField]);
                } else {
                    console.warn(`renderListData: Propriété '${roomNameField}' manquante pour l'item room:`, item);
                }
                if (!clickableElement.hasAttribute('data-action')) {
                  clickableElement.setAttribute('data-action', 'select-created-room');
                }
            } else {
                console.warn("renderListData: ID manquant pour l'item room:", item);
            }
            // --- Fin Logique ROOMS ---

            container.appendChild(clone);
        });
    } else {
        // Afficher message si vide
        const emptyMessage = listContainerElement.getAttribute('data-xano-empty-message') || "Aucune donnée à afficher.";
        if (!container.querySelector('.xano-empty-message')) {
            const messageElement = document.createElement('div');
            messageElement.className = 'xano-empty-message';
            messageElement.textContent = emptyMessage;
            container.appendChild(messageElement);
        }
    }
}


function renderPhotoItems(dataArray, listContainerElement) {
    dataArray = Array.isArray(dataArray) ? dataArray : []; // dataArray contient les enregistrements property_photos

    const emptyStatePlaceholder = document.getElementById('photo-empty-state-placeholder');

    const templateSelector = listContainerElement.getAttribute('data-xano-list');
    if (!templateSelector) { console.error("renderPhotoItems: data-xano-list manquant.", listContainerElement); return; }
    const templateElement = document.querySelector(templateSelector);
    if (!templateElement) { console.error(`renderPhotoItems: Template "${templateSelector}" introuvable.`); return; }

    const container = listContainerElement.querySelector('[data-xano-list-container]') || listContainerElement;

    // --- Vider le conteneur ---
    const existingEmptyMessage = container.querySelector('.xano-empty-message');
    if (existingEmptyMessage) container.removeChild(existingEmptyMessage);
    let currentChild = container.firstChild;
    while (currentChild) {
        const nextChild = currentChild.nextSibling;
        if (currentChild.nodeType === Node.ELEMENT_NODE && currentChild.hasAttribute('data-xano-list-item')) {
            container.removeChild(currentChild);
        }
        currentChild = nextChild;
    }
    // --- Fin Vidage ---

    if (templateElement.tagName !== 'TEMPLATE' && templateElement.style.display !== 'none') {
        templateElement.style.display = 'none';
        templateElement.setAttribute('aria-hidden', 'true');
    }

    // --- Afficher les photos OU le placeholder ---
    if (dataArray.length > 0) {
        // *** CAS 1 : Il y a des photos ***
        if (emptyStatePlaceholder) {
            emptyStatePlaceholder.style.display = 'none';
        } else {
            console.warn("renderPhotoItems: Placeholder '#photo-empty-state-placeholder' non trouvé.");
        }

        dataArray.forEach((item, index) => { // item est un enregistrement property_photos
            const clone = templateElement.tagName === 'TEMPLATE' ? templateElement.content.cloneNode(true).firstElementChild : templateElement.cloneNode(true);
            if (!clone) return;

            clone.style.display = '';
            clone.removeAttribute('aria-hidden');
            clone.setAttribute('data-xano-list-item', '');
            clone.setAttribute('data-xano-item-index', index.toString());

            // --- MODIFIÉ: Utiliser l'ID de la photo ---
            if (item.id) {
                clone.setAttribute('data-photo-id', item.id); // <<< Utiliser l'ID numérique
            } else {
                console.error("renderPhotoItems: ID de la photo MANQUANT ! La réorganisation/suppression échouera.", item);
            }
            // --- FIN MODIFICATION ---

            // --- NOUVEAU: Ajouter un attribut pour le chemin (utile pour la miniature modale) ---
             // Adaptez 'image_metadata.path' au nom exact du champ dans votre réponse Xano
             const imagePath = item.image_metadata?.path;
             if (imagePath) {
                 clone.setAttribute('data-photo-path', imagePath); // On garde le path pour la modale
             } else {
                 console.warn("renderPhotoItems: Chemin de l'image (image_metadata.path) manquant pour l'item:", item);
             }
            // --- FIN NOUVEAU ---


            // *** Début Modifications Fade-in ***
            const imgElement = clone.querySelector('.photo-item-image'); // Gardez votre sélecteur d'image

            // Lier les données Xano (mettra à jour src via bindDataToElement)
            const boundElements = clone.querySelectorAll('[data-xano-bind]');
            boundElements.forEach(boundElement => { bindDataToElement(boundElement, item); });
            if (clone.hasAttribute('data-xano-bind')) { bindDataToElement(clone, item); }

            if (imgElement) {
                imgElement.classList.add('photo-item-loading'); // Votre classe CSS pour l'état initial
            } else {
                console.warn("renderPhotoItems: Image element (.photo-item-image) not found in clone for fade-in.");
            }
            // *** Fin Modifications Fade-in (Part 1) ***

            container.appendChild(clone);

            // *** Début Modifications Fade-in (Part 2) ***
            if (imgElement) {
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        imgElement.classList.remove('photo-item-loading');
                    });
                });
            }
            // *** Fin Modifications Fade-in (Part 2) ***
        }); // Fin forEach

    } else {
        // *** CAS 2 : Il n'y a PAS de photos ***
        if (emptyStatePlaceholder) {
            emptyStatePlaceholder.style.display = 'flex'; // Ou 'block', etc.
        } else {
            console.warn("renderPhotoItems: Placeholder '#photo-empty-state-placeholder' non trouvé. Affichage message texte.");
            const emptyMessageText = listContainerElement.getAttribute('data-xano-empty-message') || "Aucune photo pour le moment.";
            if (!container.querySelector('.xano-empty-message')) {
                const messageElement = document.createElement('div');
                messageElement.className = 'xano-empty-message';
                messageElement.textContent = emptyMessageText;
                container.appendChild(messageElement);
            }
        }
    }
} // --- FIN de renderPhotoItems ---


function bindDataToElement(element, data) {
    const dataKey = element.getAttribute('data-xano-bind');
    if (!dataKey) return;

    // Gestion des clés imbriquées (ex: image_metadata.path)
    let value = data;
    const keys = dataKey.split('.');
    try {
        for (const key of keys) {
            if (value && typeof value === 'object' && key in value) {
                value = value[key];
            } else {
                value = undefined; // Clé non trouvée
                break;
            }
        }
    } catch (e) {
        console.warn(`Erreur accès clé "${dataKey}" dans:`, data, e);
        value = undefined;
    }


    // Si la valeur finale est null ou undefined, afficher une chaîne vide
    const displayValue = (value === null || value === undefined) ? '' : value;

    // Appliquer la valeur à l'élément
    switch (element.tagName.toLowerCase()) {
        case 'img':
             // MODIFIÉ: Gérer le cas où displayValue est un objet (si dataKey est juste 'image_metadata')
             if (typeof displayValue === 'object' && displayValue !== null && displayValue.path) {
                 element.src = displayValue.path; // Accéder au chemin dans l'objet
             } else if (typeof displayValue === 'string') {
                 element.src = displayValue; // Si la clé pointe directement vers le chemin
             } else {
                 element.src = ''; // Chemin vide si non trouvé ou format incorrect
                 console.warn(`bindDataToElement: Valeur inattendue pour src d'image (clé: ${dataKey}):`, displayValue);
             }
             break;
        case 'iframe':
        case 'video':
        case 'audio':
        case 'source':
            element.src = displayValue;
            break;
        case 'input':
            // ... (gestion des inputs comme avant)
             if (element.type === 'checkbox' || element.type === 'radio') {
                 if (element.type === 'checkbox') {
                     element.checked = !!value;
                 } else {
                     element.checked = (element.value == value);
                 }
             } else if (element.type === 'date' && value) {
                 try { element.value = new Date(value).toISOString().split('T')[0]; }
                 catch (e) { element.value = ''; console.warn("Impossible de formater la date", value); }
             } else if (element.type === 'datetime-local' && value) {
                 try { element.value = new Date(value).toISOString().substring(0, 16); }
                 catch (e) { element.value = ''; console.warn("Impossible de formater datetime-local", value); }
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

            let attrValue = data;
            const attrKeys = attrValueKey.split('.');
            try {
                for (const key of attrKeys) {
                    if (attrValue && typeof attrValue === 'object' && key in attrValue) {
                        attrValue = attrValue[key];
                    } else {
                        attrValue = undefined;
                        break;
                    }
                }
            } catch (e) { attrValue = undefined; }


            if (attrValue !== undefined) {
                if (typeof attrValue === 'boolean') {
                    if (attrValue) { element.setAttribute(attrName, ''); }
                    else { element.removeAttribute(attrName); }
                } else {
                    element.setAttribute(attrName, attrValue);
                }
            } else {
                element.removeAttribute(attrName);
                // console.warn(`Clé "${attrValueKey}" pour l'attribut "${attrName}" non trouvée.`);
            }
        }
    }

    // Stocker l'ID si l'élément est aussi un lien
    if (element.hasAttribute('data-xano-link-to') && data ? .id !== undefined) {
        element.setAttribute('data-xano-data-id', data.id);
    }
}


// ============================================================
// == Fonctions pour Sélection Pièces (Types CMS & Créées) ==
// ============================================================
function setupCreatedRoomSelection(client) {
    console.log("--- Entrée dans setupCreatedRoomSelection ---");
    if (!client) { console.error("ERREUR DANS setupCreatedRoomSelection: Le 'client' reçu est null ou undefined !"); return; }

    const photoUploadForm = document.querySelector('[data-xano-form="upload_multiple_photos"]');
    const photoDisplayContainer = document.getElementById('room-photos-display'); // Conteneur des photos
    const listContainer = document.querySelector('[data-xano-list-container="true"]'); // Conteneur des rooms

    // --- Vérifications ---
    if (!listContainer) { console.error("ERREUR SETUP: Conteneur des rooms ([data-xano-list-container='true']) INTROUVABLE !"); return; }
    if (listContainer.id === 'room-photos-display') { console.error("ERREUR SETUP: Le sélecteur de rooms a trouvé #room-photos-display !"); return; }
    if (!photoUploadForm) { console.error("ERREUR SETUP: photoUploadForm introuvable."); return; }
    const roomDbIdInput = photoUploadForm.querySelector('[data-xano-field-name="property_photos_rooms_id"]'); // Input qui reçoit l'ID de la room pour l'upload
    if (!roomDbIdInput) { console.error("ERREUR SETUP: Input [data-xano-field-name='property_photos_rooms_id'] introuvable."); return; }
    if (!photoDisplayContainer) { console.error("ERREUR SETUP: photoDisplayContainer (#room-photos-display) introuvable."); return; }
    const photoLoadingIndicator = photoDisplayContainer.querySelector('[data-xano-loading]'); // Indicateur chargement photos
    console.log("Toutes les vérifications setupCreatedRoomSelection OK.");
    // --- Fin Vérifications ---


    listContainer.addEventListener('click', async function handleRoomClickFinal(event) {
        console.log("--- CLIC ROOM DÉTECTÉ ---");
        const selectedElement = event.target.closest('[data-action="select-created-room"][data-room-id]');
        if (selectedElement) {

            const roomDbId = selectedElement.getAttribute('data-room-id'); // ID de la room cliquée
            const roomName = selectedElement.getAttribute('data-room-name') || `Pièce ID: ${roomDbId}`;
            currentSelectedRoomId = roomDbId; // Mettre à jour l'ID global de la room sélectionnée

            console.log(`Room sélectionnée - ID: ${roomDbId}, Name: ${roomName}`);

            // Mettre à jour l'affichage du nom de la pièce
            const roomNameDisplayElement = document.getElementById('current-room-name-display');
            if (roomNameDisplayElement) { roomNameDisplayElement.textContent = roomName; }
            else { console.warn("Élément #current-room-name-display non trouvé."); }

            // Mettre à jour l'input caché du formulaire d'upload
            try {
                roomDbIdInput.value = roomDbId;
                console.log(`Input upload mis à jour (property_photos_rooms_id = ${roomDbIdInput.value})`);
            } catch (e) { console.error("Erreur maj input upload:", e); }

            // Détruire l'ancienne instance SortableJS si elle existe
            if (currentSortableInstance) {
                console.log("Destruction de l'instance SortableJS précédente.");
                currentSortableInstance.destroy();
                currentSortableInstance = null;
            }

            // Afficher la section des photos (si elle était cachée)
            const photoSectionContainer = document.getElementById('room-photos-display'); // C'est le même que photoDisplayContainer
             if (photoSectionContainer) {
                 // Utiliser le style approprié (grid, flex, block...)
                 photoSectionContainer.style.display = 'grid'; // Adapter si besoin
                 console.log("Conteneur photos rendu visible (via style.display).");
             } else {
                 console.error("Conteneur #room-photos-display non trouvé ! Impossible de l'afficher.");
             }

            // Gérer le feedback visuel de la sélection de room
            listContainer.querySelectorAll('[data-action="select-created-room"][data-room-id]').forEach(el => el.classList.remove('is-selected'));
            selectedElement.classList.add('is-selected');
            console.log("Feedback visuel room appliqué.");

            // Charger les photos pour cette room
            await refreshCurrentRoomPhotos(client); // Utilise la fonction helper

        } else { console.log("Clic ignoré (pas sur un élément de room valide)."); }
    });
    console.log("Écouteur de clic attaché au conteneur des rooms.");
    console.log("Fin de l'exécution normale de setupCreatedRoomSelection.");
}


// ==========================================
// == Logique Sélection/Suppression Photos ==
// ==========================================
function setupPhotoSelectionMode() {
    console.log("SETUP: Initialisation du mode sélection photo.");
    const boutonModeSelection = document.getElementById('bouton-mode-selection');
    const conteneurPhotos = document.getElementById('room-photos-display'); // Le conteneur global des photos
    const photoListContainer = document.getElementById('photo-list-container'); // Le conteneur où les photos sont rendues (pour SortableJS et sélection)
    const boutonSupprimerSelection = document.getElementById('bouton-supprimer-selection');

    if (!boutonModeSelection || !conteneurPhotos || !photoListContainer || !boutonSupprimerSelection) {
        console.error("SETUP ERROR: IDs manquants: bouton-mode-selection, room-photos-display, photo-list-container, bouton-supprimer-selection");
        return;
    }

    // --- Helper: Visibilité Bouton Supprimer ---
    function updateDeleteButtonVisibility() {
        if (!boutonSupprimerSelection) return;
        // MODIFIÉ: Vérifie photosSelectionneesIds (qui contient des IDs numériques)
        if (modeSelectionActif && photosSelectionneesIds.length > 0) {
            boutonSupprimerSelection.classList.remove('button-is-hidden');
            boutonSupprimerSelection.classList.add('button-is-visible');
        } else {
            boutonSupprimerSelection.classList.remove('button-is-visible');
            boutonSupprimerSelection.classList.add('button-is-hidden');
        }
    }

    // --- Fonction Principale: Exécuter Suppression ---
    async function executeDelete() {
        // MODIFIÉ: Utilise photosSelectionneesIds (IDs numériques)
        if (photosSelectionneesIds.length === 0 || currentSelectedRoomId === null) {
             console.error("executeDelete: Aucune photo sélectionnée ou room ID inconnu.");
             return;
        }
        console.log(`Exécution suppression confirmée pour ${photosSelectionneesIds.length} photo(s) [IDs: ${photosSelectionneesIds.join(', ')}] dans la room ${currentSelectedRoomId}.`);

        const modalConfirmBtn = document.getElementById('modal-confirm-delete-button');
        if (modalConfirmBtn) modalConfirmBtn.disabled = true;

        let scrollPos = window.scrollY || document.documentElement.scrollTop;

        // MODIFIÉ: Préparer le payload pour l'API Xano avec les IDs
        const payload = {
            // Assurez-vous que Xano attend bien 'photo_ids' (ou un nom similaire)
            // et que ce sont des nombres entiers.
            photo_ids: photosSelectionneesIds,
            // Optionnel mais recommandé: envoyer aussi room_id pour vérification côté serveur
            room_id: parseInt(currentSelectedRoomId, 10)
        };
        // Vérifiez le nom et la méthode de votre endpoint Xano pour la suppression par IDs
        const deleteEndpoint = 'property_photos/batch_delete_by_ids'; // EXEMPLE de nom d'endpoint
        const deleteMethod = 'DELETE'; // Ou 'POST' si vous préférez

        try {
            // Appel API via le client Xano
            // Note: La méthode delete de XanoClient envoie 'payload' comme body JSON si non null
            const response = await xanoClient.delete(deleteEndpoint, payload);
            console.log('Réponse API suppression:', response); // Peut être null si succès avec 204 No Content

            // Suppression réussie (supposant que l'API renvoie une erreur en cas d'échec)
            console.log('Photos supprimées avec succès (API call OK)!');

            // Rafraîchir la liste des photos
            await refreshCurrentRoomPhotos(xanoClient); // Utilise la fonction helper

            // Restaurer scroll après rendu (avec délai)
            setTimeout(() => {
                console.log("Tentative restauration scroll vers:", scrollPos);
                window.scrollTo({ top: scrollPos, behavior: 'auto' });
            }, 100); // Petit délai pour laisser le temps au rendu

            // Réinitialiser l'état de sélection
            photosSelectionneesIds = [];
            modeSelectionActif = false;
            if (boutonModeSelection) boutonModeSelection.textContent = "Sélectionner les photos";
            if (conteneurPhotos) conteneurPhotos.classList.remove('selection-active');
            updateDeleteButtonVisibility(); // Cache le bouton Supprimer

        } catch (error) {
            console.error("Erreur lors du processus de suppression API:", error);
            alert("Erreur lors de la suppression des photos: " + error.message);
        } finally {
            closeDeleteModal();
            if (modalConfirmBtn) modalConfirmBtn.disabled = false;
        }
    } // --- FIN de executeDelete ---


    // --- NOUVELLE Fonction pour gérer la fin du drag & drop (utilise photo ID) ---
    async function handleSortEnd(event) {
        const photoListContainerElement = event.target;
        const items = Array.from(photoListContainerElement.children);

        // MODIFIÉ: Extrait les data-photo-id (IDs numériques)
        const orderedPhotoIds = items
            .map(el => el.getAttribute('data-photo-id'))
            .filter(id => id) // Filtre null/undefined
            .map(id => parseInt(id, 10)) // Convertit en nombres
            .filter(id => !isNaN(id)); // Filtre les NaN si la conversion échoue

        if (orderedPhotoIds.length === 0 || currentSelectedRoomId === null) {
            console.log("SortableJS onEnd: Aucun ID de photo valide détecté ou room ID inconnu.");
            if (modeSelectionActif && boutonSupprimerSelection) boutonSupprimerSelection.disabled = false;
            return;
        }

        console.log("SortableJS onEnd: Nouvel ordre d'IDs:", orderedPhotoIds);

        // Optionnel: Feedback visuel pendant sauvegarde
        // if (boutonSupprimerSelection && modeSelectionActif) boutonSupprimerSelection.textContent = "Sauvegarde...";

        try {
            // Endpoint Xano pour la réorganisation par IDs
            const reorderEndpoint = `property_photos/batch_reorder`; // Assurez-vous que cet endpoint existe
            const payload = {
                ordered_photo_ids: orderedPhotoIds,
                room_id: parseInt(currentSelectedRoomId, 10) // Envoyer l'ID de la room est essentiel
            };

            console.log("SortableJS onEnd: Appel API batch_reorder - Payload:", payload);
            await xanoClient.post(reorderEndpoint, payload); // Utiliser POST ou PATCH selon votre API
            console.log("SortableJS onEnd: Nouvel ordre sauvegardé avec succès via API.");

        } catch (error) {
            console.error("Erreur lors de la sauvegarde du nouvel ordre des photos:", error);
            alert("Erreur lors de la sauvegarde du nouvel ordre des photos.");
            // Recharger les photos pour réafficher l'ordre correct d'avant l'erreur
            console.log("Tentative de rechargement des photos après échec sauvegarde ordre...");
            await refreshCurrentRoomPhotos(xanoClient); // Utilise la fonction helper

        } finally {
            // Réactiver le bouton Supprimer si on est en mode sélection
            if (modeSelectionActif && boutonSupprimerSelection) {
                boutonSupprimerSelection.disabled = false;
                // boutonSupprimerSelection.textContent = "Supprimer la sélection";
                console.log("Bouton Supprimer réactivé (drag end).");
            }
        }
    } // --- FIN de handleSortEnd ---


    // --- Écouteur sur le bouton Gérer/Annuler ---
    boutonModeSelection.addEventListener('click', function() {
        modeSelectionActif = !modeSelectionActif;
        console.log("Mode sélection photos :", modeSelectionActif);
        if (modeSelectionActif) {
            boutonModeSelection.textContent = "Annuler";
            conteneurPhotos.classList.add('selection-active');
            updateDeleteButtonVisibility();
        } else {
            // Sortir du mode sélection
            boutonModeSelection.textContent = "Sélectionner les photos";
            conteneurPhotos.classList.remove('selection-active');
            photosSelectionneesIds = []; // Vider le tableau des IDs
            // Retirer la classe visuelle des photos
            if (photoListContainer) {
                photoListContainer.querySelectorAll('.is-photo-selected').forEach(photoEl => {
                    photoEl.classList.remove('is-photo-selected');
                });
            }
            updateDeleteButtonVisibility(); // Cache le bouton Supprimer
        }
    });
    console.log("SETUP: Écouteur ajouté au bouton mode sélection.");


    // --- Écouteur sur le Conteneur des Photos (pour sélection individuelle) ---
    // Utilise photoListContainer car c'est là que les items sont ajoutés/cliqués
    photoListContainer.addEventListener('click', function(event) {
        if (!modeSelectionActif) return;
        // MODIFIÉ: Cherche l'élément parent avec data-photo-id
        const clickedPhotoElement = event.target.closest('[data-photo-id]');
        if (!clickedPhotoElement) return;

        // MODIFIÉ: Récupère l'ID numérique
        const photoIdString = clickedPhotoElement.getAttribute('data-photo-id');
        const photoId = parseInt(photoIdString, 10);

        if (isNaN(photoId)) {
             console.warn("Clic sur photo mais ID invalide:", photoIdString);
             return;
        }

        // Gérer la classe visuelle
        clickedPhotoElement.classList.toggle('is-photo-selected');
        const isNowSelected = clickedPhotoElement.classList.contains('is-photo-selected');
        console.log(`Photo [ID: ${photoId}] sélectionnée: ${isNowSelected}`);

        // MODIFIÉ: Mettre à jour le tableau des IDs numériques sélectionnés
        const indexInSelection = photosSelectionneesIds.indexOf(photoId);
        if (isNowSelected && indexInSelection === -1) {
            photosSelectionneesIds.push(photoId);
            console.log(`   -> Photo ID ajoutée au tableau: ${photoId}`);
        } else if (!isNowSelected && indexInSelection > -1) {
            photosSelectionneesIds.splice(indexInSelection, 1);
            console.log(`   -> Photo ID retirée du tableau: ${photoId}`);
        }
        console.log("Photos sélectionnées (IDs):", photosSelectionneesIds);
        updateDeleteButtonVisibility();
    });
    console.log("SETUP: Écouteur ajouté au conteneur de la liste des photos (#photo-list-container).");


    // --- Écouteur sur le bouton "Supprimer la sélection" (Ouvre la modale) ---
    if (boutonSupprimerSelection) {
        boutonSupprimerSelection.addEventListener('click', function() {
            if (photosSelectionneesIds.length === 0 || currentSelectedRoomId === null) {
                console.warn("Clic sur Supprimer, mais rien à supprimer ou room inconnue.");
                return;
            }

            const modalElement = document.querySelector('[fs-modal-element="delete-confirm"]'); // Votre sélecteur de modale
            const thumbnailElement = modalElement ? .querySelector('[data-modal-element="photo-thumbnail"]');
            const badgeElement = modalElement ? .querySelector('[data-modal-element="photo-badge"]');
            const textElement = modalElement ? .querySelector('[data-modal-element="confirm-text"]');

            if (!modalElement || !thumbnailElement || !badgeElement || !textElement) {
                console.error("Éléments de la modale de confirmation introuvables ! Vérifiez les attributs.");
                // Fallback alerte standard
                 const fallbackConfirm = window.confirm(`MODALE INTROUVABLE - Voulez-vous supprimer ${photosSelectionneesIds.length} photo(s) ?`);
                 if (fallbackConfirm) { executeDelete(); }
                return;
            }

            const count = photosSelectionneesIds.length;
            // MODIFIÉ: Trouver la première photo par ID
            const firstPhotoId = photosSelectionneesIds[0];
            const firstPhotoDOMElement = photoListContainer.querySelector(`[data-photo-id="${firstPhotoId}"]`);
            // NOUVEAU: Utiliser data-photo-path pour l'URL de la miniature
            const firstPhotoPath = firstPhotoDOMElement ? firstPhotoDOMElement.getAttribute('data-photo-path') : null;

            let firstPhotoUrl = '';
             if (firstPhotoPath) {
                 // Construire l'URL complète si nécessaire (si Xano ne la renvoie pas complète)
                 // Exemple: firstPhotoUrl = xanoClient.apiGroupBaseUrl.replace('/api:group', '') + firstPhotoPath;
                 // Ou si le path est déjà une URL complète:
                 firstPhotoUrl = firstPhotoPath;
             } else {
                 console.warn("Impossible de trouver le chemin (data-photo-path) pour la première photo sélectionnée ID:", firstPhotoId);
                 // Mettre une image placeholder si besoin
                 // firstPhotoUrl = 'URL_PLACEHOLDER.jpg';
             }

            thumbnailElement.src = firstPhotoUrl;
            thumbnailElement.alt = `Aperçu (${count} photo(s) sélectionnée(s))`;

            if (count > 1) {
                badgeElement.textContent = `+${count - 1}`;
                badgeElement.style.display = 'flex'; // Ou 'block', etc.
            } else {
                badgeElement.style.display = 'none';
            }

            textElement.textContent = `Voulez-vous supprimer ${count} photo${count > 1 ? 's' : ''} ? Cette action est irréversible.`;

            openDeleteModal(); // Ouvre la modale via trigger caché

        });
        console.log("SETUP: Écouteur MODIFIÉ ajouté au bouton supprimer sélection.");
    }


    // --- Écouteurs pour CONFIRMER/ANNULER de la modale ---
    const modalConfirmBtn = document.getElementById('modal-confirm-delete-button');
    const modalCancelBtn = document.getElementById('modal-cancel-delete-button'); // Ou autre bouton/lien de fermeture

    if (modalConfirmBtn && !modalConfirmBtn.listenerAdded) {
        modalConfirmBtn.addEventListener('click', executeDelete);
        modalConfirmBtn.listenerAdded = true;
    } else if (!modalConfirmBtn) {
        console.warn("Bouton #modal-confirm-delete-button introuvable.");
    }

    // Si Annuler n'utilise pas fs-modal-element="close"
    if (modalCancelBtn && !modalCancelBtn.listenerAdded) {
        modalCancelBtn.addEventListener('click', closeDeleteModal);
        modalCancelBtn.listenerAdded = true;
    }

    // --- Helpers Ouverture/Fermeture Modale (via trigger caché) ---
    function openDeleteModal() {
        const hiddenTrigger = document.getElementById('hidden-delete-modal-trigger'); // ID de votre bouton caché
        if (hiddenTrigger) {
            hiddenTrigger.click();
        } else {
            console.error("Trigger modal caché #hidden-delete-modal-trigger introuvable !");
            alert("Erreur: Impossible d'afficher la confirmation (trigger manquant).");
        }
    }

    function closeDeleteModal() {
        // Cherche un élément pour fermer la modale (ajuster sélecteur si besoin)
        const closeElement = document.querySelector('[fs-modal-element="close"]');
        if (closeElement) {
             try { closeElement.click(); }
             catch(e) { console.error("Erreur simulation clic fermeture:", e); }
        } else {
            console.warn("Aucun élément [fs-modal-element='close'] trouvé pour fermeture programmatique.");
            // Alternative: manipuler directement les classes/styles de la modale si vous n'utilisez pas de librairie
            // const modalElement = document.querySelector('[fs-modal-element="delete-confirm"]');
            // if (modalElement) modalElement.style.display = 'none'; // Exemple simple
        }
    }

    // Appel initial
    updateDeleteButtonVisibility();

} // --- FIN de setupPhotoSelectionMode ---


// ==========================================
// == Fonctions Utilitaires (Helpers)      ==
// ==========================================

// NOUVEAU: Helper pour rafraîchir les photos de la room actuelle
async function refreshCurrentRoomPhotos(client) {
     if (!currentSelectedRoomId || !client) {
         console.warn("refreshCurrentRoomPhotos: Room ID ou client Xano manquant.");
         return;
     }
     const photoDisplayContainer = document.getElementById('room-photos-display');
     if (!photoDisplayContainer) {
         console.error("refreshCurrentRoomPhotos: Conteneur #room-photos-display introuvable.");
         return;
     }
     const photoLoadingIndicator = photoDisplayContainer.querySelector('[data-xano-loading]');
     const errorElement = photoDisplayContainer.querySelector('[data-xano-error]');

     console.log(`Rafraîchissement des photos pour la room ${currentSelectedRoomId}...`);
     if (photoLoadingIndicator) photoLoadingIndicator.style.display = 'block';
     if (errorElement) errorElement.style.display = 'none';

     // Détruire l'instance SortableJS avant de recharger pour éviter les conflits
     if (currentSortableInstance) {
         console.log("Destruction SortableJS avant rafraîchissement.");
         currentSortableInstance.destroy();
         currentSortableInstance = null;
     }


     const photoEndpoint = `property_photos/photos/${currentSelectedRoomId}`; // Endpoint pour GET les photos
     const params = null; // Pas de params pour GET ici

     try {
         // Récupérer et afficher les nouvelles données
         await fetchXanoData(client, photoEndpoint, 'GET', params, photoDisplayContainer, photoLoadingIndicator);
         console.log(`Rafraîchissement photos terminé pour room ${currentSelectedRoomId}.`);

         // Ré-initialiser SortableJS APRÈS le rendu des nouvelles photos
         const photoList = document.getElementById('photo-list-container');
         if (photoList && photoList.children.length > 0) { // Seulement si y'a des photos
             console.log("Ré-initialisation de SortableJS sur #photo-list-container");
             currentSortableInstance = new Sortable(photoList, {
                 animation: 150,
                 ghostClass: 'sortable-ghost',
                 // forceFallback: true, // Si besoin
                 onStart: function(evt) {
                     const boutonSupprimerSelection = document.getElementById('bouton-supprimer-selection');
                     if (modeSelectionActif && boutonSupprimerSelection) {
                          boutonSupprimerSelection.disabled = true;
                     }
                 },
                 onEnd: function(evt) {
                     console.log("SortableJS onEnd (après rafraîchissement) triggered.");
                     handleSortEnd(evt); // Appelle la fonction de sauvegarde
                 }
             });
             console.log("SortableJS ré-initialisé:", currentSortableInstance);
         } else {
              console.log("Pas de photos à trier après rafraîchissement, ou conteneur introuvable.");
         }

     } catch (error) {
         console.error(`Erreur lors du rafraîchissement des photos pour room ${currentSelectedRoomId}:`, error);
         if (errorElement) {
             errorElement.textContent = "Erreur lors du rafraîchissement des photos.";
             errorElement.style.display = 'block';
         }
     } finally {
         if (photoLoadingIndicator) photoLoadingIndicator.style.display = 'none';
     }
}


// Helper pour collecter les données simples (non-FormData)
function collectSimpleFormData(form) {
    const data = {};
    const inputs = form.querySelectorAll('input:not([type=file]), select, textarea');
    inputs.forEach(input => {
        const fieldName = input.getAttribute('data-xano-field-name') || input.name;
        if (!fieldName) return;

        if (input.type === 'checkbox') {
            if (input.checked) {
                // Gérer les groupes de checkboxes
                if (data[fieldName]) {
                    if (!Array.isArray(data[fieldName])) { data[fieldName] = [data[fieldName]]; }
                    data[fieldName].push(input.value);
                } else {
                    data[fieldName] = input.value; // Ou [input.value] si vous voulez toujours un tableau
                }
            } // else: Ne rien envoyer si décoché (ou envoyer false/null si besoin)
        } else if (input.type === 'radio') {
            if (input.checked) {
                data[fieldName] = input.value;
            }
        } else {
            data[fieldName] = input.value;
        }
    });
    return data;
}


// Helper pour collecter FormData AVEC fichiers
function collectFormDataWithFiles(form) {
    const formData = new FormData();
    const inputs = form.querySelectorAll('input, select, textarea');

    inputs.forEach((input) => {
        const fieldName = input.getAttribute('data-xano-field-name') || input.name;
        if (!fieldName) return;

        if (input.type === 'file') {
            // Utiliser data-xano-bind ou fieldName pour le nom du champ fichier
            const fileFieldName = input.getAttribute('data-xano-bind') || fieldName;
            Array.from(input.files).forEach((file) => {
                formData.append(fileFieldName, file); // Xano gère les fichiers multiples avec le même nom
            });
        } else if (input.type === 'checkbox') {
            if (input.checked) {
                formData.append(fieldName, input.value); // Peut ajouter plusieurs fois si même nom
            }
        } else if (input.type === 'radio') {
            if (input.checked) {
                formData.append(fieldName, input.value);
            }
        } else {
            formData.append(fieldName, input.value);
        }
    });

     // Ajouter l'ID de la room sélectionnée au FormData si le champ existe dans le formulaire d'upload
     const roomIdInput = form.querySelector('[data-xano-field-name="property_photos_rooms_id"]');
     if (roomIdInput && roomIdInput.value) {
          // S'assurer que le nom correspond à ce que Xano attend pour l'ID de la room
          formData.append('property_photos_rooms_id', roomIdInput.value);
     } else if (form.getAttribute('data-xano-form') === 'upload_multiple_photos') {
          console.warn("Champ property_photos_rooms_id non trouvé ou vide dans le formulaire d'upload.");
          // Peut-être récupérer currentSelectedRoomId global ici ? Moins propre.
          // if (currentSelectedRoomId) {
          //     formData.append('property_photos_rooms_id', currentSelectedRoomId);
          // }
     }


    return formData;
}

// Helper pour obtenir un paramètre de l'URL
function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

// Helper pour obtenir un cookie
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

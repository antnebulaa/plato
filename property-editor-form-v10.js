// ==========================================
// == Script Xano Unifié (Formulaires + Données) ==
// ==========================================
// Date: 2025-04-28 // Version 10 (Formulaires corrigés + Photo IDs)

let xanoClient;
let currentSortableInstance = null;
let modeSelectionActif = false;
let photosSelectionneesIds = []; // Contiendra les IDs numériques des photos
let currentSelectedRoomId = null;

// --- Fonctions Setup (Room Type, Created Room, Photo Mode) ---
// NOTE: Ces fonctions sont identiques à la v9

function setupRoomTypeSelection() {
    const roomTypesListWrapper = document.querySelector('[data-element="room-types-list-wrapper"]');
    const addRoomForm = document.querySelector('[data-xano-form="property_photos_rooms"]');
    const hiddenRoomNameInput = addRoomForm ? addRoomForm.querySelector('[data-xano-field-name="room_name"]') : null;

    if (!roomTypesListWrapper || !addRoomForm || !hiddenRoomNameInput) {
        console.warn("setupRoomTypeSelection: Éléments manquants.");
        return;
    }
    console.log("setupRoomTypeSelection: Initialisation.");

    roomTypesListWrapper.addEventListener('click', function(event) {
        const clickedButton = event.target.closest('[data-action="select-room-type"]');
        if (clickedButton) {
            const roomTypeName = clickedButton.getAttribute('data-room-type-name');
            if (roomTypeName) {
                console.log(`setupRoomTypeSelection: Type sélectionné: ${roomTypeName}`);
                hiddenRoomNameInput.value = roomTypeName;
                const inputEvent = new Event('input', { bubbles: true, cancelable: true });
                hiddenRoomNameInput.dispatchEvent(inputEvent);
                roomTypesListWrapper.querySelectorAll('[data-action="select-room-type"]').forEach(btn => btn.classList.remove('is-selected'));
                clickedButton.classList.add('is-selected');
            } else {
                console.warn("setupRoomTypeSelection: Attribut data-room-type-name manquant.");
            }
        }
    });
}

function setupCreatedRoomSelection(client) {
    console.log("--- Entrée dans setupCreatedRoomSelection ---");
    if (!client) { console.error("ERREUR DANS setupCreatedRoomSelection: Le 'client' reçu est null ou undefined !"); return; }

    const photoUploadForm = document.querySelector('[data-xano-form="upload_multiple_photos"]');
    const photoDisplayContainer = document.getElementById('room-photos-display');
    const listContainer = document.querySelector('[data-xano-list-container="true"]'); // Conteneur des rooms

    if (!listContainer || listContainer.id === 'room-photos-display' || !photoUploadForm || !photoDisplayContainer) {
         console.error("ERREUR SETUP setupCreatedRoomSelection: Un ou plusieurs conteneurs/formulaires essentiels introuvables.");
         return;
    }
     const roomDbIdInput = photoUploadForm.querySelector('[data-xano-field-name="property_photos_rooms_id"]');
     if (!roomDbIdInput) { console.error("ERREUR SETUP: Input [data-xano-field-name='property_photos_rooms_id'] introuvable."); return; }
     const photoLoadingIndicator = photoDisplayContainer.querySelector('[data-xano-loading]');
     console.log("Toutes les vérifications setupCreatedRoomSelection OK.");


    listContainer.addEventListener('click', async function handleRoomClickFinal(event) {
        console.log("--- CLIC ROOM DÉTECTÉ ---");
        const selectedElement = event.target.closest('[data-action="select-created-room"][data-room-id]');
        if (selectedElement) {
            const roomDbId = selectedElement.getAttribute('data-room-id');
            const roomName = selectedElement.getAttribute('data-room-name') || `Pièce ID: ${roomDbId}`;
            currentSelectedRoomId = roomDbId;
            console.log(`Room sélectionnée - ID: ${roomDbId}, Name: ${roomName}`);

            const roomNameDisplayElement = document.getElementById('current-room-name-display');
            if (roomNameDisplayElement) roomNameDisplayElement.textContent = roomName;

            try {
                roomDbIdInput.value = roomDbId;
                console.log(`Input upload mis à jour (property_photos_rooms_id = ${roomDbIdInput.value})`);
            } catch (e) { console.error("Erreur maj input upload:", e); }

            if (currentSortableInstance) {
                console.log("Destruction SortableJS précédente.");
                currentSortableInstance.destroy();
                currentSortableInstance = null;
            }

            const photoSectionContainer = document.getElementById('room-photos-display');
             if (photoSectionContainer) {
                 photoSectionContainer.style.display = 'grid'; // Adapter si besoin
                 console.log("Conteneur photos rendu visible.");
             } else {
                  console.error("Conteneur #room-photos-display non trouvé !");
             }

            listContainer.querySelectorAll('[data-action="select-created-room"][data-room-id]').forEach(el => el.classList.remove('is-selected'));
            selectedElement.classList.add('is-selected');
            console.log("Feedback visuel room appliqué.");

            await refreshCurrentRoomPhotos(client);
        } else { console.log("Clic ignoré (pas sur un élément room valide)."); }
    });
    console.log("Écouteur clic attaché au conteneur des rooms.");
    console.log("Fin setupCreatedRoomSelection.");
}

function setupPhotoSelectionMode() {
    console.log("SETUP: Initialisation mode sélection photo.");
    const boutonModeSelection = document.getElementById('bouton-mode-selection');
    const conteneurPhotos = document.getElementById('room-photos-display');
    const photoListContainer = document.getElementById('photo-list-container');
    const boutonSupprimerSelection = document.getElementById('bouton-supprimer-selection');

    if (!boutonModeSelection || !conteneurPhotos || !photoListContainer || !boutonSupprimerSelection) {
        console.error("SETUP ERROR: IDs manquants: bouton-mode-selection, room-photos-display, photo-list-container, bouton-supprimer-selection");
        return;
    }

    function updateDeleteButtonVisibility() {
        if (!boutonSupprimerSelection) return;
        if (modeSelectionActif && photosSelectionneesIds.length > 0) {
            boutonSupprimerSelection.classList.remove('button-is-hidden');
            boutonSupprimerSelection.classList.add('button-is-visible');
        } else {
            boutonSupprimerSelection.classList.remove('button-is-visible');
            boutonSupprimerSelection.classList.add('button-is-hidden');
        }
    }

    async function executeDelete() {
        if (photosSelectionneesIds.length === 0 || currentSelectedRoomId === null) {
             console.error("executeDelete: Aucune photo sélectionnée ou room ID inconnu.");
             return;
        }
        console.log(`Exécution suppression pour ${photosSelectionneesIds.length} photo(s) [IDs: ${photosSelectionneesIds.join(', ')}] dans room ${currentSelectedRoomId}.`);

        const modalConfirmBtn = document.getElementById('modal-confirm-delete-button');
        if (modalConfirmBtn) modalConfirmBtn.disabled = true;
        let scrollPos = window.scrollY || document.documentElement.scrollTop;

        const payload = {
            photo_ids: photosSelectionneesIds,
            room_id: parseInt(currentSelectedRoomId, 10)
        };
        // !! Adaptez le nom de l'endpoint et la méthode si nécessaire !!
        const deleteEndpoint = 'property_photos/batch_delete_by_ids';
        const deleteMethod = 'DELETE'; // Ou 'POST'

        try {
            // Utilise la méthode delete de XanoClient qui peut envoyer un body
            const response = await xanoClient.delete(deleteEndpoint, payload);
            console.log('Réponse API suppression:', response);
            console.log('Photos supprimées avec succès (API call OK)!');

            await refreshCurrentRoomPhotos(xanoClient);

            setTimeout(() => {
                console.log("Tentative restauration scroll vers:", scrollPos);
                window.scrollTo({ top: scrollPos, behavior: 'auto' });
            }, 100);

            photosSelectionneesIds = [];
            modeSelectionActif = false;
            if (boutonModeSelection) boutonModeSelection.textContent = "Sélectionner les photos";
            if (conteneurPhotos) conteneurPhotos.classList.remove('selection-active');
            updateDeleteButtonVisibility();

        } catch (error) {
            console.error("Erreur processus suppression API:", error);
            alert("Erreur suppression photos: " + error.message);
        } finally {
            closeDeleteModal();
            if (modalConfirmBtn) modalConfirmBtn.disabled = false;
        }
    }

    async function handleSortEnd(event) {
        const photoListContainerElement = event.target;
        const items = Array.from(photoListContainerElement.children);
        const orderedPhotoIds = items
            .map(el => el.getAttribute('data-photo-id'))
            .filter(id => id)
            .map(id => parseInt(id, 10))
            .filter(id => !isNaN(id));

        if (orderedPhotoIds.length === 0 || currentSelectedRoomId === null) {
            console.log("SortableJS onEnd: Aucun ID photo valide ou room ID inconnu.");
            if (modeSelectionActif && boutonSupprimerSelection) boutonSupprimerSelection.disabled = false;
            return;
        }
        console.log("SortableJS onEnd: Nouvel ordre IDs:", orderedPhotoIds);

        try {
            // !! Adaptez le nom de l'endpoint si nécessaire !!
            const reorderEndpoint = `property_photos/batch_reorder`;
            const payload = {
                ordered_photo_ids: orderedPhotoIds,
                room_id: parseInt(currentSelectedRoomId, 10)
            };
            console.log("SortableJS onEnd: Appel API batch_reorder - Payload:", payload);
            await xanoClient.post(reorderEndpoint, payload); // Ou .patch
            console.log("SortableJS onEnd: Nouvel ordre sauvegardé.");

        } catch (error) {
            console.error("Erreur sauvegarde nouvel ordre photos:", error);
            alert("Erreur sauvegarde ordre photos.");
            console.log("Rechargement photos après échec sauvegarde ordre...");
            await refreshCurrentRoomPhotos(xanoClient);
        } finally {
            if (modeSelectionActif && boutonSupprimerSelection) {
                boutonSupprimerSelection.disabled = false;
                console.log("Bouton Supprimer réactivé (drag end).");
            }
        }
    }

    boutonModeSelection.addEventListener('click', function() {
        modeSelectionActif = !modeSelectionActif;
        console.log("Mode sélection photos :", modeSelectionActif);
        if (modeSelectionActif) {
            boutonModeSelection.textContent = "Annuler";
            conteneurPhotos.classList.add('selection-active');
        } else {
            boutonModeSelection.textContent = "Sélectionner les photos";
            conteneurPhotos.classList.remove('selection-active');
            photosSelectionneesIds = [];
            if (photoListContainer) {
                photoListContainer.querySelectorAll('.is-photo-selected').forEach(photoEl => {
                    photoEl.classList.remove('is-photo-selected');
                });
            }
        }
        updateDeleteButtonVisibility();
    });
    console.log("SETUP: Écouteur bouton mode sélection OK.");

    photoListContainer.addEventListener('click', function(event) {
        if (!modeSelectionActif) return;
        const clickedPhotoElement = event.target.closest('[data-photo-id]');
        if (!clickedPhotoElement) return;
        const photoIdString = clickedPhotoElement.getAttribute('data-photo-id');
        const photoId = parseInt(photoIdString, 10);
        if (isNaN(photoId)) return;

        clickedPhotoElement.classList.toggle('is-photo-selected');
        const isNowSelected = clickedPhotoElement.classList.contains('is-photo-selected');
        console.log(`Photo [ID: ${photoId}] sélectionnée: ${isNowSelected}`);

        const indexInSelection = photosSelectionneesIds.indexOf(photoId);
        if (isNowSelected && indexInSelection === -1) {
            photosSelectionneesIds.push(photoId);
        } else if (!isNowSelected && indexInSelection > -1) {
            photosSelectionneesIds.splice(indexInSelection, 1);
        }
        console.log("Photos sélectionnées (IDs):", photosSelectionneesIds);
        updateDeleteButtonVisibility();
    });
    console.log("SETUP: Écouteur sélection photo sur #photo-list-container OK.");

    if (boutonSupprimerSelection) {
        boutonSupprimerSelection.addEventListener('click', function() {
            if (photosSelectionneesIds.length === 0 || currentSelectedRoomId === null) return;

            const modalElement = document.querySelector('[fs-modal-element="delete-confirm"]');
            const thumbnailElement = modalElement?.querySelector('[data-modal-element="photo-thumbnail"]');
            const badgeElement = modalElement?.querySelector('[data-modal-element="photo-badge"]');
            const textElement = modalElement?.querySelector('[data-modal-element="confirm-text"]');

            if (!modalElement || !thumbnailElement || !badgeElement || !textElement) {
                console.error("Éléments modale confirmation introuvables !");
                 const fallbackConfirm = window.confirm(`MODALE INTROUVABLE - Supprimer ${photosSelectionneesIds.length} photo(s) ?`);
                 if (fallbackConfirm) { executeDelete(); }
                return;
            }

            const count = photosSelectionneesIds.length;
            const firstPhotoId = photosSelectionneesIds[0];
            const firstPhotoDOMElement = photoListContainer.querySelector(`[data-photo-id="${firstPhotoId}"]`);
            const firstPhotoPath = firstPhotoDOMElement ? firstPhotoDOMElement.getAttribute('data-photo-path') : null;
            let firstPhotoUrl = firstPhotoPath || ''; // Utilise le path directement ou une chaîne vide

            thumbnailElement.src = firstPhotoUrl;
            thumbnailElement.alt = `Aperçu (${count} photo(s))`;

            if (count > 1) {
                badgeElement.textContent = `+${count - 1}`;
                badgeElement.style.display = 'flex';
            } else {
                badgeElement.style.display = 'none';
            }
            textElement.textContent = `Supprimer ${count} photo${count > 1 ? 's' : ''} ? Action irréversible.`;
            openDeleteModal();
        });
        console.log("SETUP: Écouteur bouton supprimer sélection OK.");
    }

    const modalConfirmBtn = document.getElementById('modal-confirm-delete-button');
    const modalCancelBtn = document.getElementById('modal-cancel-delete-button');

    if (modalConfirmBtn && !modalConfirmBtn.listenerAdded) {
        modalConfirmBtn.addEventListener('click', executeDelete);
        modalConfirmBtn.listenerAdded = true;
    } else if (!modalConfirmBtn) { console.warn("Bouton #modal-confirm-delete-button introuvable."); }

    if (modalCancelBtn && !modalCancelBtn.listenerAdded) {
        modalCancelBtn.addEventListener('click', closeDeleteModal);
        modalCancelBtn.listenerAdded = true;
    }

    function openDeleteModal() {
        const hiddenTrigger = document.getElementById('hidden-delete-modal-trigger');
        if (hiddenTrigger) { hiddenTrigger.click(); }
        else { console.error("Trigger modal caché #hidden-delete-modal-trigger introuvable !"); }
    }

    function closeDeleteModal() {
        const closeElement = document.querySelector('[fs-modal-element="close"]');
        if (closeElement) { try { closeElement.click(); } catch(e) { console.error("Erreur simulation clic fermeture:", e); } }
        else { console.warn("Aucun élément [fs-modal-element='close'] trouvé."); }
    }

    updateDeleteButtonVisibility();
}


// --- Initialisation DOMContentLoaded ---
document.addEventListener('DOMContentLoaded', function() {
    try {
        xanoClient = new XanoClient({
             // !! Remplacez par votre URL de base API Xano !!
            apiGroupBaseUrl: 'https://xwxl-obyg-b3e3.p7.xano.io/api:qom0bt4V',
        });
        console.log("1. Instance xanoClient créée.");

        const authToken = getCookie('xano_auth_token');
        if (authToken) {
            xanoClient.setAuthToken(authToken);
            console.log("2. Auth Token appliqué.");
        } else {
            console.log("2. Pas d'Auth Token trouvé.");
        }

        // !! Appel initXanoForms CORRIGÉ !!
        initXanoForms(xanoClient);
        console.log("3. initXanoForms appelé.");

        initXanoDataEndpoints(xanoClient);
        console.log("4. initXanoDataEndpoints appelé.");
        setupRoomTypeSelection();
        console.log("5. setupRoomTypeSelection appelé.");
        initXanoLinkHandlers();
        console.log("6. initXanoLinkHandlers appelé.");

        if (typeof setupCreatedRoomSelection === 'function' && xanoClient) {
             console.log("7. Appel setupCreatedRoomSelection...");
             setupCreatedRoomSelection(xanoClient);
             console.log("8. setupCreatedRoomSelection terminé.");
        } else {
             console.error("ERREUR CRITIQUE: setupCreatedRoomSelection ou xanoClient non défini !");
        }

        setupPhotoSelectionMode();
        console.log("9. setupPhotoSelectionMode appelé.");

        console.log("10. Initialisation DOMContentLoaded terminée.");

    } catch (initError) {
        console.error("ERREUR GLOBALE DANS DOMContentLoaded:", initError);
    }
});

// ==========================================
// == Classe XanoClient (Identique v9)     ==
// ==========================================
class XanoClient {
    constructor(config) {
        this.apiGroupBaseUrl = config.apiGroupBaseUrl;
        this.authToken = null;
    }
    setAuthToken(token) { this.authToken = token; }
    async _request(method, endpoint, paramsOrBody = null, isFormData = false) {
        const url = `${this.apiGroupBaseUrl}/${endpoint}`;
        const options = { method: method, headers: {} };
        if (this.authToken) { options.headers['Authorization'] = `Bearer ${this.authToken}`; }
        let finalUrl = url;
        if (method === 'GET' && paramsOrBody) {
            const queryParams = new URLSearchParams(paramsOrBody).toString();
            if (queryParams) finalUrl = `${url}?${queryParams}`;
        } else if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && paramsOrBody) { // DELETE peut avoir un body
            if (isFormData) {
                options.body = paramsOrBody; // Pas de Content-Type pour FormData
            } else {
                options.headers['Content-Type'] = 'application/json';
                options.body = JSON.stringify(paramsOrBody);
            }
        }
        try {
            const response = await fetch(finalUrl, options);
            if (response.status === 204 || response.headers.get('content-length') === '0') {
                if (!response.ok) throw new Error(`Erreur HTTP ${response.status}`);
                return null; // Succès sans contenu
            }
            const responseData = await response.json();
            if (!response.ok) throw new Error(responseData.message || `Erreur HTTP ${response.status}`);
            return responseData;
        } catch (error) {
            console.error(`Erreur appel ${method} ${endpoint}:`, error);
            throw error;
        }
    }
    get(endpoint, params = null) { return this._request('GET', endpoint, params); }
    post(endpoint, body = null, isFormData = false) { return this._request('POST', endpoint, body, isFormData); }
    put(endpoint, body = null, isFormData = false) { return this._request('PUT', endpoint, body, isFormData); }
    patch(endpoint, body = null, isFormData = false) { return this._request('PATCH', endpoint, body, isFormData); }
    delete(endpoint, body = null) { return this._request('DELETE', endpoint, body, false); } // Assume body is JSON for DELETE
}

// ==========================================
// == Initialisation des Formulaires CORRIGÉE ==
// ==========================================
function initXanoForms(xanoClient) {
    const xanoForms = document.querySelectorAll('[data-xano-form]');
    xanoForms.forEach((form) => {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            console.log(`Soumission formulaire détectée: ${form.getAttribute('data-xano-form')}`); // Log début soumission

            const endpoint = form.getAttribute('data-xano-form');
            const method = (form.getAttribute('data-xano-form-method') || 'POST').toUpperCase();

            const loadingElement = form.querySelector('[data-xano-form-loading]') || document.querySelector(form.getAttribute('data-xano-form-loading-selector'));
            const errorElement = form.querySelector('[data-xano-form-error]') || document.querySelector(form.getAttribute('data-xano-form-error-selector'));
            const submitButton = form.querySelector('button[type="submit"], input[type="submit"]');

            if (errorElement) errorElement.style.display = 'none';
            if (loadingElement) loadingElement.style.display = 'block';
            if (submitButton) submitButton.disabled = true;

            try {
                let finalEndpoint = endpoint;
                // Gérer l'ID dans l'URL pour PUT/PATCH/DELETE
                if (form.hasAttribute('data-xano-form-id-param')) {
                    const idParamName = form.getAttribute('data-xano-form-id-param');
                    const idValue = getQueryParam(idParamName);
                    if (idValue && ['PUT', 'PATCH', 'DELETE'].includes(method)) {
                        finalEndpoint = `${endpoint}/${idValue}`;
                        console.log(`ID ${idValue} ajouté à l'endpoint: ${finalEndpoint}`);
                    } else if (idValue && method === 'POST') {
                        // Rare, mais si besoin d'ID dans URL pour POST
                         finalEndpoint = `${endpoint}/${idValue}`;
                         console.warn(`ID ${idValue} ajouté à l'URL pour POST: ${finalEndpoint}`);
                    } else if (['PUT', 'PATCH', 'DELETE'].includes(method) && !idValue) {
                         console.error(`Méthode ${method} nécessite un ID via data-xano-form-id-param, mais paramètre "${idParamName}" manquant dans l'URL.`);
                         throw new Error(`ID requis pour ${method} manquant.`);
                    }
                }

                // --- REVERSION À LA LOGIQUE v8 ---
                // Toujours utiliser FormData, géré par collectFormDataWithFiles.
                // Xano peut généralement gérer FormData même sans fichiers.
                console.log("Collecte des données du formulaire via collectFormDataWithFiles...");
                const formData = collectFormDataWithFiles(form);
                const isFormData = true; // Toujours vrai maintenant
                console.log("Données FormData collectées.");
                // Afficher les données pour débogage (optionnel)
                // for (let [key, value] of formData.entries()) { console.log(` FormData: ${key} =`, value); }


                let responseData;
                console.log(`Appel API ${method} vers ${finalEndpoint}...`);
                switch (method) {
                    case 'POST':
                        responseData = await xanoClient.post(finalEndpoint, formData, isFormData);
                        break;
                    case 'PUT':
                        responseData = await xanoClient.put(finalEndpoint, formData, isFormData);
                        break;
                    case 'PATCH':
                        responseData = await xanoClient.patch(finalEndpoint, formData, isFormData);
                        break;
                    case 'DELETE':
                        // DELETE utilise l'ID dans l'URL (finalEndpoint), pas de body ici
                        responseData = await xanoClient.delete(finalEndpoint);
                        break;
                    default:
                        throw new Error(`Méthode de formulaire non supportée: ${method}`);
                }
                console.log("Réponse API reçue:", responseData);

                // --- FIN REVERSION ---

                const successEvent = new CustomEvent('xano:form-success', {
                    detail: { response: responseData, form: form },
                    bubbles: true,
                });
                form.dispatchEvent(successEvent);
                console.log("Événement xano:form-success déclenché.");

                if (form.hasAttribute('data-xano-form-redirect')) {
                    const redirectUrl = form.getAttribute('data-xano-form-redirect');
                    console.log(`Redirection vers: ${redirectUrl}`);
                    window.location.href = redirectUrl;
                } else {
                     // Rafraîchir photos après upload réussi
                     if (form.getAttribute('data-xano-form') === 'upload_multiple_photos' && currentSelectedRoomId) {
                         console.log("Upload photos réussi, rafraîchissement...");
                         await refreshCurrentRoomPhotos(xanoClient);
                     } else if (form.getAttribute('data-xano-form') === 'property_photos_rooms') {
                         // Optionnel: Rafraîchir la liste des rooms après ajout ?
                         console.log("Formulaire ajout room soumis.");
                         // Recharger la liste des rooms ici si nécessaire
                         // Exemple: fetchXanoData(xanoClient, 'endpoint_liste_rooms', 'GET', null, document.getElementById('conteneur_liste_rooms'), null);
                         form.reset(); // Vider le formulaire d'ajout de room
                     }
                     else {
                         console.log("Soumission formulaire réussie (pas de redirection).");
                         // form.reset(); // Optionnel: vider autres formulaires
                     }
                }

            } catch (error) {
                console.error(`Erreur soumission formulaire ${endpoint}:`, error);
                if (errorElement) {
                    errorElement.textContent = error.message || "Une erreur inconnue est survenue.";
                    errorElement.style.display = 'block';
                }
                const errorEvent = new CustomEvent('xano:form-error', {
                    detail: { error: error, form: form },
                    bubbles: true,
                });
                form.dispatchEvent(errorEvent);
            } finally {
                if (loadingElement) loadingElement.style.display = 'none';
                if (submitButton) submitButton.disabled = false;
                console.log(`Fin traitement soumission formulaire ${endpoint}.`);
            }
        });
    });
     console.log(`initXanoForms: ${xanoForms.length} formulaires initialisés.`);
}


// ==========================================
// == Init Récupération/Affichage Données  ==
// == (Identique v9)                       ==
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
        const loadingIndicator = element.querySelector('[data-xano-loading]') || document.querySelector(element.getAttribute('data-xano-loading-selector'));
        if (loadingIndicator) loadingIndicator.style.display = 'block';
        fetchXanoData(xanoClient, endpoint, method, params, element, loadingIndicator);
    });
     console.log(`initXanoDataEndpoints: ${xanoElements.length} éléments data trouvés.`);
}

// ==========================================
// == Init Gestionnaires de Liens          ==
// == (Identique v9)                       ==
// ==========================================
function initXanoLinkHandlers() {
    document.addEventListener('xano:data-loaded', function(event) {
        const loadedElement = event.detail.element;
        const data = event.detail.data;
        const potentialLinks = loadedElement.querySelectorAll('[data-xano-link-to]');
        potentialLinks.forEach(linkElement => {
            if (!linkElement.closest('[data-xano-list-item]')) { // Ne traite pas les liens DANS les listes ici
                const targetPage = linkElement.getAttribute('data-xano-link-to');
                const idField = linkElement.getAttribute('data-xano-link-param-id') || 'id';
                const idParamName = linkElement.getAttribute('data-xano-link-url-param') || 'id';
                const sourceData = data?.body ? data.body : data; // Adapter si besoin
                let linkTarget = targetPage;
                if (sourceData && typeof sourceData === 'object' && sourceData[idField]) {
                    linkTarget = `${targetPage}?${idParamName}=${encodeURIComponent(sourceData[idField])}`;
                } else if (linkElement.hasAttribute('data-xano-data-id')) {
                    linkTarget = `${targetPage}?${idParamName}=${encodeURIComponent(linkElement.getAttribute('data-xano-data-id'))}`;
                }
                if (linkElement.tagName === 'A') { linkElement.href = linkTarget; }
                else { linkElement.setAttribute('data-xano-link-target', linkTarget); linkElement.style.cursor = 'pointer'; }
            }
        });
    });
    document.addEventListener('click', function(event) {
        const clickedElement = event.target.closest('[data-xano-link-target]');
        if (clickedElement && clickedElement.tagName !== 'A') {
            const linkTarget = clickedElement.getAttribute('data-xano-link-target');
            if (linkTarget) { window.location.href = linkTarget; }
        }
    });
     console.log("initXanoLinkHandlers: Gestionnaires de liens initialisés.");
}


// ==========================================
// == Fonctions Logiques (Fetch, Render)   ==
// == (Identiques v9)                      ==
// ==========================================
async function fetchXanoData(client, endpoint, method, params, targetElement, loadingIndicator) {
    console.log(`fetchXanoData: Appel ${method} ${endpoint} pour élément`, targetElement);
    try {
        let responseData;
        switch (method) {
            case 'GET': responseData = await client.get(endpoint, params); break;
            case 'POST': responseData = await client.post(endpoint, params); break; // params = body ici
            // Ajouter PUT/PATCH/DELETE si fetch via ces méthodes est nécessaire
            default: throw new Error(`Méthode HTTP non supportée pour fetch: ${method}`);
        }
        console.log(`fetchXanoData: Réponse reçue pour ${endpoint}`, responseData);
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        renderData(responseData, targetElement);
        const successEvent = new CustomEvent('xano:data-loaded', { detail: { data: responseData, element: targetElement }, bubbles: true });
        targetElement.dispatchEvent(successEvent);
    } catch (error) {
        console.error(`Erreur fetchXanoData pour ${endpoint}:`, error);
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        const errorDisplay = targetElement.querySelector('[data-xano-error]') || targetElement;
        if (errorDisplay) { errorDisplay.textContent = `Erreur: ${error.message || 'Impossible de charger.'}`; errorDisplay.style.color = 'red'; }
        const errorEvent = new CustomEvent('xano:data-error', { detail: { error: error, element: targetElement }, bubbles: true });
        targetElement.dispatchEvent(errorEvent);
    }
}

function renderData(data, element) {
    if (element.id === 'room-photos-display' && element.hasAttribute('data-xano-list')) {
        console.log("renderData: Appel renderPhotoItems pour #room-photos-display");
        let listData = Array.isArray(data) ? data : [];
        if (!Array.isArray(data)) console.warn("renderData: Données photos non tableau:", data);
        renderPhotoItems(listData, element);
    } else if (element.hasAttribute('data-xano-list')) {
        console.log("renderData: Appel renderListData (générique) pour:", element);
        let listData = null;
        if (Array.isArray(data)) { listData = data; }
        else if (data && Array.isArray(data.items)) { listData = data.items; }
        else if (data && Array.isArray(data.body)) { listData = data.body; }
        else if (data && typeof data === 'object') { for (const key in data) { if (Array.isArray(data[key])) { listData = data[key]; break; } } }
        if (!listData) { console.warn("renderData: Aucune liste trouvée pour", element, "dans", data); listData = []; }
        renderListData(listData, element);
    } else {
        console.log("renderData: Affichage élément unique pour:", element);
        const sourceData = data?.body ? data.body : data;
        if (sourceData && typeof sourceData === 'object') {
            const boundElements = element.querySelectorAll('[data-xano-bind]');
            if (boundElements.length > 0) {
                boundElements.forEach(boundElement => { if (!boundElement.closest('[data-xano-list-item]')) bindDataToElement(boundElement, sourceData); });
            } else if (element.hasAttribute('data-xano-bind')) { bindDataToElement(element, sourceData); }
        } else { console.warn("renderData: Données élément unique non objet:", sourceData); }
    }
}

function renderListData(dataArray, listContainerElement) {
    dataArray = Array.isArray(dataArray) ? dataArray : [];
    const templateSelector = listContainerElement.getAttribute('data-xano-list');
    if (!templateSelector) { console.error("data-xano-list manquant.", listContainerElement); return; }
    const templateElement = document.querySelector(templateSelector);
    if (!templateElement) { console.error(`Template "${templateSelector}" introuvable.`); return; }
    const container = listContainerElement.querySelector('[data-xano-list-container]') || listContainerElement;

    // Vider conteneur
    let currentChild = container.firstChild;
    while (currentChild) {
        const nextChild = currentChild.nextSibling;
        if (currentChild !== templateElement && currentChild.nodeType === Node.ELEMENT_NODE && currentChild.hasAttribute('data-xano-list-item')) {
            container.removeChild(currentChild);
        }
        currentChild = nextChild;
    }
    const existingEmptyMessage = container.querySelector('.xano-empty-message');
    if (existingEmptyMessage) container.removeChild(existingEmptyMessage);

    if (templateElement.tagName !== 'TEMPLATE') { templateElement.style.display = 'none'; templateElement.setAttribute('aria-hidden', 'true'); }

    if (dataArray.length > 0) {
        dataArray.forEach((item, index) => {
            const clone = templateElement.tagName === 'TEMPLATE' ? templateElement.content.cloneNode(true).firstElementChild : templateElement.cloneNode(true);
            if (!clone) { console.error("Échec clonage template."); return; }
            clone.style.display = ''; clone.removeAttribute('aria-hidden');
            clone.setAttribute('data-xano-list-item', ''); clone.setAttribute('data-xano-item-index', index.toString());

            // Bind data
            const boundElements = clone.querySelectorAll('[data-xano-bind]');
            boundElements.forEach(boundElement => bindDataToElement(boundElement, item));
            if (clone.hasAttribute('data-xano-bind')) bindDataToElement(clone, item);

            // Links
            const linkElements = clone.querySelectorAll('[data-xano-link-to]');
            linkElements.forEach(linkElement => {
                const targetPage = linkElement.getAttribute('data-xano-link-to');
                const idField = linkElement.getAttribute('data-xano-link-param-id') || 'id';
                const idParamName = linkElement.getAttribute('data-xano-link-url-param') || 'id';
                let linkTarget = targetPage; const idValue = item[idField];
                if (idValue !== undefined && idValue !== null) linkTarget = `${targetPage}?${idParamName}=${encodeURIComponent(idValue)}`;
                else console.warn(`ID field "${idField}" non trouvé pour lien`, item);
                if (linkElement.tagName === 'A') { linkElement.href = linkTarget; }
                else { linkElement.setAttribute('data-xano-link-target', linkTarget); linkElement.style.cursor = 'pointer'; }
            });
             if (clone.hasAttribute('data-xano-link-to')) {
                 const targetPage = clone.getAttribute('data-xano-link-to'); const idField = clone.getAttribute('data-xano-link-param-id') || 'id';
                 const idParamName = clone.getAttribute('data-xano-link-url-param') || 'id'; let linkTarget = targetPage; const idValue = item[idField];
                 if (idValue !== undefined && idValue !== null) linkTarget = `${targetPage}?${idParamName}=${encodeURIComponent(idValue)}`;
                 if (clone.tagName === 'A') { clone.href = linkTarget; } else { clone.setAttribute('data-xano-link-target', linkTarget); clone.style.cursor = 'pointer'; }
             }

            // Spécifique Rooms
            const clickableElement = clone.querySelector('[data-action="select-created-room"]') || clone;
            if (item.id !== undefined) {
                clickableElement.setAttribute('data-room-id', item.id);
                const roomNameField = 'room_name'; // Ajustez si besoin
                if (item[roomNameField]) clickableElement.setAttribute('data-room-name', item[roomNameField]);
                else console.warn(`renderListData: Champ '${roomNameField}' manquant pour room:`, item);
                if (!clickableElement.hasAttribute('data-action')) clickableElement.setAttribute('data-action', 'select-created-room');
            } else console.warn("renderListData: ID manquant pour room:", item);

            container.appendChild(clone);
        });
    } else {
        const emptyMessage = listContainerElement.getAttribute('data-xano-empty-message') || "Aucune donnée.";
        if (!container.querySelector('.xano-empty-message')) {
            const messageElement = document.createElement('div'); messageElement.className = 'xano-empty-message';
            messageElement.textContent = emptyMessage; container.appendChild(messageElement);
        }
    }
}

function renderPhotoItems(dataArray, listContainerElement) {
    dataArray = Array.isArray(dataArray) ? dataArray : [];
    const emptyStatePlaceholder = document.getElementById('photo-empty-state-placeholder');
    const templateSelector = listContainerElement.getAttribute('data-xano-list');
    if (!templateSelector) { console.error("renderPhotoItems: data-xano-list manquant.", listContainerElement); return; }
    const templateElement = document.querySelector(templateSelector);
    if (!templateElement) { console.error(`renderPhotoItems: Template "${templateSelector}" introuvable.`); return; }
    const container = listContainerElement.querySelector('[data-xano-list-container]') || listContainerElement;

    // Vider conteneur
    const existingEmptyMessage = container.querySelector('.xano-empty-message');
    if (existingEmptyMessage) container.removeChild(existingEmptyMessage);
    let currentChild = container.firstChild;
    while (currentChild) {
        const nextChild = currentChild.nextSibling;
        if (currentChild.nodeType === Node.ELEMENT_NODE && currentChild.hasAttribute('data-xano-list-item')) container.removeChild(currentChild);
        currentChild = nextChild;
    }

    if (templateElement.tagName !== 'TEMPLATE' && templateElement.style.display !== 'none') { templateElement.style.display = 'none'; templateElement.setAttribute('aria-hidden', 'true'); }

    if (dataArray.length > 0) {
        if (emptyStatePlaceholder) emptyStatePlaceholder.style.display = 'none';
        else console.warn("renderPhotoItems: Placeholder #photo-empty-state-placeholder non trouvé.");

        dataArray.forEach((item, index) => { // item = enregistrement property_photos
            const clone = templateElement.tagName === 'TEMPLATE' ? templateElement.content.cloneNode(true).firstElementChild : templateElement.cloneNode(true);
            if (!clone) return;
            clone.style.display = ''; clone.removeAttribute('aria-hidden');
            clone.setAttribute('data-xano-list-item', ''); clone.setAttribute('data-xano-item-index', index.toString());

            // ID et Path
            if (item.id) clone.setAttribute('data-photo-id', item.id);
            else console.error("renderPhotoItems: ID photo MANQUANT!", item);
             // !! Adaptez 'image_metadata.path' au nom exact du champ/chemin dans votre réponse Xano !!
             const imagePath = item.image_metadata?.path; // Exemple
             if (imagePath) clone.setAttribute('data-photo-path', imagePath);
             else console.warn("renderPhotoItems: Path image (image_metadata.path) manquant:", item);

            // Fade-in
            const imgElement = clone.querySelector('.photo-item-image'); // Votre sélecteur
            const boundElements = clone.querySelectorAll('[data-xano-bind]');
            boundElements.forEach(boundElement => bindDataToElement(boundElement, item));
            if (clone.hasAttribute('data-xano-bind')) bindDataToElement(clone, item);
            if (imgElement) imgElement.classList.add('photo-item-loading'); // Votre classe
            else console.warn("renderPhotoItems: Image (.photo-item-image) non trouvée pour fade-in.");

            container.appendChild(clone);

            if (imgElement) {
                requestAnimationFrame(() => { requestAnimationFrame(() => { imgElement.classList.remove('photo-item-loading'); }); });
            }
        });
    } else {
        if (emptyStatePlaceholder) emptyStatePlaceholder.style.display = 'flex'; // Ou 'block'
        else {
            console.warn("renderPhotoItems: Placeholder #photo-empty-state-placeholder non trouvé.");
            const emptyMessageText = listContainerElement.getAttribute('data-xano-empty-message') || "Aucune photo.";
            if (!container.querySelector('.xano-empty-message')) {
                const messageElement = document.createElement('div'); messageElement.className = 'xano-empty-message';
                messageElement.textContent = emptyMessageText; container.appendChild(messageElement);
            }
        }
    }
}

function bindDataToElement(element, data) {
    const dataKey = element.getAttribute('data-xano-bind');
    if (!dataKey) return;
    let value = data; const keys = dataKey.split('.');
    try { for (const key of keys) { if (value && typeof value === 'object' && key in value) value = value[key]; else { value = undefined; break; } } }
    catch (e) { console.warn(`Erreur accès clé "${dataKey}"`, data, e); value = undefined; }
    const displayValue = (value === null || value === undefined) ? '' : value;

    switch (element.tagName.toLowerCase()) {
        case 'img':
             // !! Adaptez 'path' si le chemin est directement sous la clé ou dans un sous-objet !!
             if (typeof displayValue === 'object' && displayValue !== null && displayValue.path) element.src = displayValue.path;
             else if (typeof displayValue === 'string') element.src = displayValue;
             else { element.src = ''; console.warn(`bindData: Valeur image inattendue (clé: ${dataKey}):`, displayValue); }
             break;
        case 'iframe': case 'video': case 'audio': case 'source': element.src = displayValue; break;
        case 'input':
            if (element.type === 'checkbox') element.checked = !!value;
            else if (element.type === 'radio') element.checked = (element.value == value);
            else if (element.type === 'date' && value) try { element.value = new Date(value).toISOString().split('T')[0]; } catch (e) { element.value = ''; }
            else if (element.type === 'datetime-local' && value) try { element.value = new Date(value).toISOString().substring(0, 16); } catch (e) { element.value = ''; }
            else element.value = displayValue;
            break;
        case 'textarea': case 'select': element.value = displayValue; break;
        case 'a':
            if (!element.hasAttribute('data-xano-link-to')) element.href = displayValue;
            if (!element.textContent.trim() || dataKey !== 'href') element.textContent = displayValue;
            break;
        default: element.textContent = displayValue;
    }

    // Attributs liés
    for (const attr of element.attributes) {
        if (attr.name.startsWith('data-xano-bind-attr-')) {
            const attrName = attr.name.replace('data-xano-bind-attr-', ''); const attrValueKey = attr.value;
            let attrValue = data; const attrKeys = attrValueKey.split('.');
            try { for (const key of attrKeys) { if (attrValue && typeof attrValue === 'object' && key in attrValue) attrValue = attrValue[key]; else { attrValue = undefined; break; } } } catch (e) { attrValue = undefined; }
            if (attrValue !== undefined) { if (typeof attrValue === 'boolean') { if (attrValue) element.setAttribute(attrName, ''); else element.removeAttribute(attrName); } else element.setAttribute(attrName, attrValue); }
            else element.removeAttribute(attrName);
        }
    }
    if (element.hasAttribute('data-xano-link-to') && data?.id !== undefined) element.setAttribute('data-xano-data-id', data.id);
}


// ==========================================
// == Fonctions Utilitaires (Helpers)      ==
// == (Identiques v9)                      ==
// ==========================================

async function refreshCurrentRoomPhotos(client) {
     if (!currentSelectedRoomId || !client) { console.warn("refreshCurrentRoomPhotos: Room ID ou client manquant."); return; }
     const photoDisplayContainer = document.getElementById('room-photos-display');
     if (!photoDisplayContainer) { console.error("refreshCurrentRoomPhotos: #room-photos-display introuvable."); return; }
     const photoLoadingIndicator = photoDisplayContainer.querySelector('[data-xano-loading]');
     const errorElement = photoDisplayContainer.querySelector('[data-xano-error]');

     console.log(`Rafraîchissement photos pour room ${currentSelectedRoomId}...`);
     if (photoLoadingIndicator) photoLoadingIndicator.style.display = 'block';
     if (errorElement) errorElement.style.display = 'none';

     if (currentSortableInstance) { console.log("Destruction SortableJS avant refresh."); currentSortableInstance.destroy(); currentSortableInstance = null; }

     // !! Adaptez l'endpoint si nécessaire !!
     const photoEndpoint = `property_photos/photos/${currentSelectedRoomId}`;
     try {
         await fetchXanoData(client, photoEndpoint, 'GET', null, photoDisplayContainer, photoLoadingIndicator);
         console.log(`Rafraîchissement photos terminé pour room ${currentSelectedRoomId}.`);

         // Ré-init SortableJS
         const photoList = document.getElementById('photo-list-container');
         if (photoList && photoList.children.length > 0) {
             console.log("Ré-initialisation SortableJS sur #photo-list-container");
             currentSortableInstance = new Sortable(photoList, {
                 animation: 150, ghostClass: 'sortable-ghost',
                 onStart: function(evt) {
                     const boutonSupprimerSelection = document.getElementById('bouton-supprimer-selection');
                     if (modeSelectionActif && boutonSupprimerSelection) boutonSupprimerSelection.disabled = true;
                 },
                 onEnd: function(evt) { handleSortEnd(evt); } // Appelle la fonction de sauvegarde
             });
             console.log("SortableJS ré-initialisé:", currentSortableInstance);
         } else console.log("Pas de photos à trier après refresh.");

     } catch (error) {
         console.error(`Erreur refresh photos room ${currentSelectedRoomId}:`, error);
         if (errorElement) { errorElement.textContent = "Erreur refresh photos."; errorElement.style.display = 'block'; }
     } finally {
         if (photoLoadingIndicator) photoLoadingIndicator.style.display = 'none';
     }
}

// Helper pour collecter FormData AVEC fichiers (Utilisé par initXanoForms corrigé)
function collectFormDataWithFiles(form) {
    const formData = new FormData();
    const inputs = form.querySelectorAll('input, select, textarea');
    inputs.forEach((input) => {
        const fieldName = input.getAttribute('data-xano-field-name') || input.name;
        if (!fieldName) return; // Ignore inputs sans nom ou data-xano-field-name

        if (input.type === 'file') {
            const fileFieldName = input.getAttribute('data-xano-bind') || fieldName; // Utilise data-xano-bind si présent
            Array.from(input.files).forEach((file) => {
                formData.append(fileFieldName, file); // Append chaque fichier
            });
        } else if (input.type === 'checkbox') {
            if (input.checked) {
                // Gère les groupes avec le même nom en ajoutant plusieurs fois
                formData.append(fieldName, input.value);
            } // Si décoché, FormData n'envoie rien par défaut, ce qui est OK
        } else if (input.type === 'radio') {
            if (input.checked) {
                formData.append(fieldName, input.value);
            }
        } else {
            // Pour tous les autres types (text, hidden, select, textarea...)
            formData.append(fieldName, input.value);
        }
    });

     // Ajouter l'ID de la room si c'est le formulaire d'upload et si l'input existe
     if (form.getAttribute('data-xano-form') === 'upload_multiple_photos') {
          const roomIdInput = form.querySelector('[data-xano-field-name="property_photos_rooms_id"]');
          if (roomIdInput && roomIdInput.value) {
               // !! Assurez-vous que 'property_photos_rooms_id' est le nom attendu par Xano !!
               formData.append('property_photos_rooms_id', roomIdInput.value);
               console.log(`Ajout property_photos_rooms_id=${roomIdInput.value} au FormData`);
          } else {
               console.warn("Champ property_photos_rooms_id non trouvé ou vide dans le formulaire d'upload.");
               // Alternative: utiliser currentSelectedRoomId global (moins propre)
               // if (currentSelectedRoomId) formData.append('property_photos_rooms_id', currentSelectedRoomId);
          }
     }
    return formData;
}

function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

function getCookie(name) {
    const nameEQ = name + "="; const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) { let c = ca[i]; while (c.charAt(0) === ' ') c = c.substring(1, c.length); if (c.indexOf(nameEQ) === 0) return decodeURIComponent(c.substring(nameEQ.length, c.length)); }
    return null;
}

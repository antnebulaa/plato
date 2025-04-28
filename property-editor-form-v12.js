// ==========================================
// == Script Xano Unifié (Formulaires + Données) ==
// ==========================================
// Date: 2025-04-29 // Version 12 (Accès Array Corrigé + Formulaires OK + Photo IDs)
// PRÉREQUIS: Endpoint Xano GET /property_photos/photos/{room_id} retourne
//            liste enregistrements 'property_photos', triés par 'display_order' ASC.
//            Chaque enregistrement contient 'id', 'display_order', et un champ
//            (ex: 'images') qui est un TABLEAU contenant l'objet métadonnées.

let xanoClient;
let currentSortableInstance = null;
let modeSelectionActif = false;
let photosSelectionneesIds = [];
let currentSelectedRoomId = null;

// --- Fonctions Setup (Identiques v11) ---
function setupRoomTypeSelection() {
    const roomTypesListWrapper = document.querySelector('[data-element="room-types-list-wrapper"]');
    const addRoomForm = document.querySelector('[data-xano-form="property_photos_rooms"]');
    const hiddenRoomNameInput = addRoomForm ? addRoomForm.querySelector('[data-xano-field-name="room_name"]') : null;
    if (!roomTypesListWrapper || !addRoomForm || !hiddenRoomNameInput) { console.warn("setupRoomTypeSelection: Éléments manquants."); return; }
    console.log("setupRoomTypeSelection: Initialisation.");
    roomTypesListWrapper.addEventListener('click', function(event) { /* ... (code v11) ... */ });
}
function setupCreatedRoomSelection(client) {
    console.log("--- Entrée dans setupCreatedRoomSelection ---");
    if (!client) { console.error("ERREUR DANS setupCreatedRoomSelection: Le 'client' reçu est null ou undefined !"); return; }
    const photoUploadForm = document.querySelector('[data-xano-form="upload_multiple_photos"]');
    const photoDisplayContainer = document.getElementById('room-photos-display');
    const listContainer = document.querySelector('[data-xano-list-container="true"]');
    if (!listContainer || listContainer.id === 'room-photos-display' || !photoUploadForm || !photoDisplayContainer) { console.error("ERREUR SETUP setupCreatedRoomSelection: Éléments essentiels introuvables."); return; }
    const roomDbIdInput = photoUploadForm.querySelector('[data-xano-field-name="property_photos_rooms_id"]');
    if (!roomDbIdInput) { console.error("ERREUR SETUP: Input [data-xano-field-name='property_photos_rooms_id'] introuvable."); return; }
    console.log("Toutes les vérifications setupCreatedRoomSelection OK.");
    listContainer.addEventListener('click', async function handleRoomClickFinal(event) { /* ... (code v11) ... */ });
    console.log("Écouteur clic attaché au conteneur des rooms.");
    console.log("Fin setupCreatedRoomSelection.");
}
function setupPhotoSelectionMode() {
    console.log("SETUP: Initialisation mode sélection photo.");
    const boutonModeSelection = document.getElementById('bouton-mode-selection');
    const conteneurPhotos = document.getElementById('room-photos-display');
    const photoListContainer = document.getElementById('photo-list-container');
    const boutonSupprimerSelection = document.getElementById('bouton-supprimer-selection');
    if (!boutonModeSelection || !conteneurPhotos || !photoListContainer || !boutonSupprimerSelection) { console.error("SETUP ERROR: IDs manquants..."); return; }
    function updateDeleteButtonVisibility() { /* ... (code v11) ... */ }
    async function executeDelete() { /* ... (code v11, utilise les IDs) ... */ }
    async function handleSortEnd(event) { /* ... (code v11, utilise les IDs) ... */ }
    boutonModeSelection.addEventListener('click', function() { /* ... (code v11) ... */ });
    photoListContainer.addEventListener('click', function(event) { /* ... (code v11, utilise les IDs) ... */ });
    if (boutonSupprimerSelection) { boutonSupprimerSelection.addEventListener('click', function() { /* ... (code v11, utilise data-photo-path pour miniature) ... */ }); }
    const modalConfirmBtn = document.getElementById('modal-confirm-delete-button');
    const modalCancelBtn = document.getElementById('modal-cancel-delete-button');
    if (modalConfirmBtn && !modalConfirmBtn.listenerAdded) { modalConfirmBtn.addEventListener('click', executeDelete); modalConfirmBtn.listenerAdded = true; } else if (!modalConfirmBtn) { console.warn("Bouton #modal-confirm-delete-button introuvable."); }
    if (modalCancelBtn && !modalCancelBtn.listenerAdded) { modalCancelBtn.addEventListener('click', closeDeleteModal); modalCancelBtn.listenerAdded = true; }
    function openDeleteModal() { /* ... (code v11) ... */ }
    function closeDeleteModal() { /* ... (code v11) ... */ }
    updateDeleteButtonVisibility();
}

// --- Initialisation DOMContentLoaded (Identique v11) ---
document.addEventListener('DOMContentLoaded', function() {
    try {
        xanoClient = new XanoClient({ apiGroupBaseUrl: 'https://xwxl-obyg-b3e3.p7.xano.io/api:qom0bt4V' }); // Adaptez URL
        console.log("1. Instance xanoClient créée.");
        const authToken = getCookie('xano_auth_token');
        if (authToken) { xanoClient.setAuthToken(authToken); console.log("2. Auth Token appliqué."); }
        else { console.log("2. Pas d'Auth Token trouvé."); }
        initXanoForms(xanoClient); console.log("3. initXanoForms appelé.");
        initXanoDataEndpoints(xanoClient); console.log("4. initXanoDataEndpoints appelé.");
        setupRoomTypeSelection(); console.log("5. setupRoomTypeSelection appelé.");
        initXanoLinkHandlers(); console.log("6. initXanoLinkHandlers appelé.");
        if (typeof setupCreatedRoomSelection === 'function' && xanoClient) { console.log("7. Appel setupCreatedRoomSelection..."); setupCreatedRoomSelection(xanoClient); console.log("8. setupCreatedRoomSelection terminé."); }
        else { console.error("ERREUR CRITIQUE: setupCreatedRoomSelection ou xanoClient non défini !"); }
        setupPhotoSelectionMode(); console.log("9. setupPhotoSelectionMode appelé.");
        console.log("10. Initialisation DOMContentLoaded terminée.");
    } catch (initError) { console.error("ERREUR GLOBALE DANS DOMContentLoaded:", initError); }
});

// --- Classe XanoClient (Identique v11) ---
class XanoClient {
    constructor(config) { this.apiGroupBaseUrl = config.apiGroupBaseUrl; this.authToken = null; }
    setAuthToken(token) { this.authToken = token; }
    async _request(method, endpoint, paramsOrBody = null, isFormData = false) { /* ... (code v11) ... */ }
    get(endpoint, params = null) { return this._request('GET', endpoint, params); }
    post(endpoint, body = null, isFormData = false) { return this._request('POST', endpoint, body, isFormData); }
    put(endpoint, body = null, isFormData = false) { return this._request('PUT', endpoint, body, isFormData); }
    patch(endpoint, body = null, isFormData = false) { return this._request('PATCH', endpoint, body, isFormData); }
    delete(endpoint, body = null) { return this._request('DELETE', endpoint, body, false); }
}

// --- Initialisation des Formulaires (Identique v11) ---
function initXanoForms(xanoClient) {
    const xanoForms = document.querySelectorAll('[data-xano-form]');
    xanoForms.forEach((form) => { form.addEventListener('submit', async function(e) { /* ... (code v11) ... */ }); });
    console.log(`initXanoForms: ${xanoForms.length} formulaires initialisés.`);
}

// --- Init Récupération/Affichage Données (Identique v11) ---
function initXanoDataEndpoints(xanoClient) {
    const xanoElements = document.querySelectorAll('[data-xano-endpoint]');
    xanoElements.forEach(element => { /* ... (code v11) ... */ });
    console.log(`initXanoDataEndpoints: ${xanoElements.length} éléments data trouvés.`);
}

// --- Init Gestionnaires de Liens (Identique v11) ---
function initXanoLinkHandlers() { /* ... (code v11) ... */ console.log("initXanoLinkHandlers: Gestionnaires liens initialisés."); }

// --- Fonctions Logiques (Fetch, Render) ---
async function fetchXanoData(client, endpoint, method, params, targetElement, loadingIndicator) { /* ... (code v11) ... */ }
function renderData(data, element) { /* ... (code v11) ... */ }
function renderListData(dataArray, listContainerElement) { /* ... (code v11) ... */ }

// --- MODIFIÉ pour v12 ---
function renderPhotoItems(dataArray, listContainerElement) {
    // dataArray = liste des enregistrements complets de property_photos
    dataArray = Array.isArray(dataArray) ? dataArray : [];
    console.log(`renderPhotoItems: Rendu de ${dataArray.length} photos.`);

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
    while (currentChild) { const nextChild = currentChild.nextSibling; if (currentChild.nodeType === Node.ELEMENT_NODE && currentChild.hasAttribute('data-xano-list-item')) container.removeChild(currentChild); currentChild = nextChild; }
    if (templateElement.tagName !== 'TEMPLATE' && templateElement.style.display !== 'none') { templateElement.style.display = 'none'; templateElement.setAttribute('aria-hidden', 'true'); }

    if (dataArray.length > 0) {
        if (emptyStatePlaceholder) emptyStatePlaceholder.style.display = 'none';
        else console.warn("renderPhotoItems: Placeholder #photo-empty-state-placeholder non trouvé.");

        dataArray.forEach((item, index) => { // item = enregistrement property_photos
            const clone = templateElement.tagName === 'TEMPLATE' ? templateElement.content.cloneNode(true).firstElementChild : templateElement.cloneNode(true);
            if (!clone) return;
            clone.style.display = ''; clone.removeAttribute('aria-hidden');
            clone.setAttribute('data-xano-list-item', ''); clone.setAttribute('data-xano-item-index', index.toString());

            // --- ID ---
            if (item && item.id) {
                clone.setAttribute('data-photo-id', item.id);
            } else {
                console.error("renderPhotoItems: ID photo MANQUANT dans l'enregistrement:", item);
                clone.classList.add('photo-item-error-no-id');
            }

            // --- Accès Corrigé au Chemin/URL ---
            // !! Adaptez 'images' au nom exact de votre champ contenant le tableau de métadonnées !!
            const metadataField = 'images'; // <--- VÉRIFIEZ CE NOM
            const metadataArray = item ? item[metadataField] : null;

            // Prend le premier élément du tableau de métadonnées (s'il existe)
            const imageMetadata = (Array.isArray(metadataArray) && metadataArray.length > 0) ? metadataArray[0] : null;

            let imagePathOrUrl = null;
            if (imageMetadata) {
                 // Privilégie l'URL si elle existe, sinon le path
                 imagePathOrUrl = imageMetadata.url || imageMetadata.path;
                 if (imagePathOrUrl) {
                     clone.setAttribute('data-photo-path', imagePathOrUrl); // Stocke pour la modale
                 } else {
                      console.warn(`renderPhotoItems: Ni 'url' ni 'path' trouvés dans imageMetadata pour ID ${item?.id}:`, imageMetadata);
                      clone.setAttribute('data-photo-path', '');
                 }
            } else {
                 console.warn(`renderPhotoItems: Champ '${metadataField}' n'est pas un tableau valide ou est vide pour ID ${item?.id}:`, item);
                 clone.setAttribute('data-photo-path', '');
            }
            // --- Fin Accès Corrigé ---

            // --- Lier les données (pour la src de l'image via data-xano-bind) ---
            // bindDataToElement s'occupera de trouver le chemin/url à partir de l'item complet
            const boundElements = clone.querySelectorAll('[data-xano-bind]');
            boundElements.forEach(boundElement => bindDataToElement(boundElement, item));
            if (clone.hasAttribute('data-xano-bind')) bindDataToElement(clone, item);

            // --- Fade-in ---
            const imgElement = clone.querySelector('.photo-item-image'); // Votre sélecteur
            if (imgElement) {
                 imgElement.classList.add('photo-item-loading');
            } else {
                 console.warn("renderPhotoItems: Image (.photo-item-image) non trouvée pour fade-in.");
            }

            container.appendChild(clone);

            if (imgElement) {
                requestAnimationFrame(() => { requestAnimationFrame(() => { imgElement.classList.remove('photo-item-loading'); }); });
            }
        });
    } else { // Aucune photo
        if (emptyStatePlaceholder) emptyStatePlaceholder.style.display = 'flex';
        else { /* ... (code v11 message vide) ... */ }
    }
}

// --- MODIFIÉ pour v12 ---
function bindDataToElement(element, data) {
    // data = enregistrement complet de property_photos
    const dataKey = element.getAttribute('data-xano-bind');
    if (!dataKey) return;

    let value = data;
    const keys = dataKey.split('.');
    try { for (const key of keys) { if (value && typeof value === 'object' && key in value) value = value[key]; else { value = undefined; break; } } }
    catch (e) { console.warn(`Erreur accès clé "${dataKey}"`, data, e); value = undefined; }
    const displayValue = (value === null || value === undefined) ? '' : value;

    switch (element.tagName.toLowerCase()) {
        case 'img':
            // --- Logique Image Corrigée pour Accéder au Tableau ---
            let imageUrl = '';
            // !! Adaptez 'images' au nom exact de votre champ contenant le tableau de métadonnées !!
            const metadataField = 'images'; // <--- VÉRIFIEZ CE NOM
            const metadataArray = data ? data[metadataField] : null;
            const imageMetadata = (Array.isArray(metadataArray) && metadataArray.length > 0) ? metadataArray[0] : null;

            if (imageMetadata) {
                 // Si la clé de binding est 'url' ou 'path' (ou autre clé DANS l'objet metadata)
                 if (keys.length > 1 && keys[0] === metadataField) { // ex: data-xano-bind="images.url"
                     imageUrl = displayValue; // displayValue contient déjà images[0].url
                 }
                 // Si la clé de binding est le champ metadata lui-même (ex: data-xano-bind="images")
                 // ou une clé non liée comme "url" (vu dans vos logs)
                 else {
                     imageUrl = imageMetadata.url || imageMetadata.path; // On cherche url ou path dans le premier objet metadata
                 }
            }
            // Fallback si la clé pointe directement vers un path/url au niveau racine (peu probable)
            else if (typeof displayValue === 'string' && (displayValue.startsWith('/vault/') || displayValue.startsWith('http'))) {
                 imageUrl = displayValue;
            }

            if (!imageUrl) {
                 console.warn(`bindData: Impossible de déterminer l'URL de l'image (clé: ${dataKey}):`, 'metadata:', imageMetadata, 'data:', data);
            }
            element.src = imageUrl || ''; // Définit la source, ou vide si non trouvée
            break;

        // ... autres cas (iframe, input, textarea, etc. identiques à v11) ...
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

    // Attributs liés (identique v11)
    for (const attr of element.attributes) { /* ... (code v11) ... */ }
    if (element.hasAttribute('data-xano-link-to') && data?.id !== undefined) element.setAttribute('data-xano-data-id', data.id);
}


// --- Fonctions Utilitaires (Helpers - Identiques v11) ---
async function refreshCurrentRoomPhotos(client) { /* ... (code v11) ... */ }
function collectFormDataWithFiles(form) { /* ... (code v11) ... */ }
function getQueryParam(param) { /* ... (code v11) ... */ }
function getCookie(name) { /* ... (code v11) ... */ }


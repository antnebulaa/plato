// ==========================================
// == Script Xano Unifié (Formulaires + Données) ==
// ==========================================
// Date: 2025-04-29 // Version 8.3 (v8 + IDs Photos - Modifications Minimales)
// NOTE: Basé sur v8 original. Adapté pour IDs photos et nouveaux endpoints.
// PRÉREQUIS EXTERNES:
// 1. CORRIGER LES ERREURS JS EXTERNES SUR LA PAGE (SyntaxError, ReferenceError) !
// 2. Endpoint Xano GET /property_photos/photos/{room_id} retourne liste enregistrements complets, triés.
// 3. Endpoints Xano batch_delete_by_ids et batch_reorder existent et fonctionnent avec les IDs.

let xanoClient;
let currentSortableInstance = null;
let modeSelectionActif = false;
// MODIFIÉ v8 -> v8.3: Contiendra les IDs numériques des photos, pas les paths.
let photosSelectionneesIds = [];
let currentSelectedRoomId = null;

// --- Fonctions Setup (Identiques v8) ---
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

      } else {
        console.warn(
          "setupRoomTypeSelection: Attribut data-room-type-name manquant ou vide sur le bouton cliqué.",
          clickedButton);
      }
    }
  });
}

function setupCreatedRoomSelection(client) {
    console.log("--- Entrée dans setupCreatedRoomSelection (v8.9) ---");
    if (!client) { console.error("ERREUR: Client Xano manquant !"); return; }
    const photoUploadForm = document.querySelector('[data-xano-form="upload_multiple_photos"]');
    const photoDisplayContainer = document.querySelector('#room-photos-display');
    const listContainer = document.querySelector('[data-xano-list-container="true"]'); // Sélecteur v8
    if (!listContainer || listContainer.id === 'room-photos-display') { console.error("ERREUR SETUP: Conteneur rooms introuvable ou incorrect."); return; }
    if (!photoUploadForm) { console.error("ERREUR SETUP: photoUploadForm introuvable."); return; }
    const roomDbIdInput = photoUploadForm.querySelector('[data-xano-field-name="property_photos_rooms_id"]');
    if (!roomDbIdInput) { console.error("ERREUR SETUP: roomDbIdInput introuvable."); return; }
    if (!photoDisplayContainer) { console.error("ERREUR SETUP: photoDisplayContainer introuvable."); return; }
    const photoLoadingIndicator = photoDisplayContainer.querySelector('[data-xano-loading]');
    console.log("setupCreatedRoomSelection: Vérifications OK.");

    listContainer.addEventListener('click', async function handleRoomClickFinal(event) {
        console.log("--- CLIC ROOM DÉTECTÉ (v8.9) ---");
        const selectedElement = event.target.closest('[data-action="select-created-room"][data-room-id]');
        if (selectedElement) {
            const roomDbId = selectedElement.getAttribute('data-room-id');
            const roomName = selectedElement.getAttribute('data-room-name') || `Pièce ID: ${roomDbId}`;
            currentSelectedRoomId = roomDbId; // Mise à jour ID global
            console.log(`Room sélectionnée - ID: ${roomDbId}, Name: ${roomName}`);
            const roomNameDisplayElement = document.getElementById('current-room-name-display');
            if (roomNameDisplayElement) roomNameDisplayElement.textContent = roomName;
            else console.warn("Élément #current-room-name-display non trouvé.");
            try { roomDbIdInput.value = roomDbId; console.log(`Input upload mis à jour (valeur=${roomDbIdInput.value})`); }
            catch (e) { console.error("Erreur maj input:", e); }

            // Destruction SortableJS (gardé pour éviter conflits)
            if (currentSortableInstance) { console.log("Destruction SortableJS précédente."); currentSortableInstance.destroy(); currentSortableInstance = null; }

            // Affichage section photos (logique v8)
            const photoSectionContainer = document.getElementById('room-photos-display');
            if (photoSectionContainer) { photoSectionContainer.style.display = 'grid'; console.log("Conteneur photos rendu visible (style.display = 'grid')."); }
            else { console.error("Conteneur #room-photos-display non trouvé !"); }

            // Feedback visuel (logique v8)
            listContainer.querySelectorAll('[data-action="select-created-room"][data-room-id]').forEach(el => el.classList.remove('is-selected'));
            selectedElement.classList.add('is-selected');
            console.log("Feedback visuel appliqué.");

            // Fetch photos
            console.log("Préparation fetch photos...");
            if (client) {
                 await refreshCurrentRoomPhotos(client); // Utilise helper pour fetch et init sortable
            } else { console.warn("Client Xano manquant pour fetch photos."); }
        } else { console.log("Clic ignoré (pas sur un élément room valide)."); }
    });
    console.log("setupCreatedRoomSelection: Écouteur attaché.");
}

// --- Initialisation DOMContentLoaded (Identique v8) ---
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
    console.log("7. PRÊT à appeler setupCreatedRoomSelection.");
    console.log("   Vérification de xanoClient:", xanoClient);
    if (typeof setupCreatedRoomSelection !== 'function') { console.error("ERREUR CRITIQUE: setupCreatedRoomSelection n'est pas une fonction !"); return; }
    if (!xanoClient) { console.error("ERREUR CRITIQUE: xanoClient est undefined/null !"); return; }
    setupCreatedRoomSelection(xanoClient); console.log("8. Appel setupCreatedRoomSelection TERMINÉ.");
    setupPhotoSelectionMode(); console.log("9. setupPhotoSelectionMode appelé."); // Initialise sélection/suppression photo
    console.log("10. Initialisation UNIFIÉE terminée.");
  } catch (initError) { console.error("ERREUR GLOBALE DANS DOMContentLoaded:", initError); }
});

// --- Classe XanoClient (Modifiée v8.3 pour DELETE avec body) ---
class XanoClient {
    constructor(config) { this.apiGroupBaseUrl = config.apiGroupBaseUrl; this.authToken = null; }
    setAuthToken(token) { this.authToken = token; }
    async _request(method, endpoint, paramsOrBody = null, isFormData = false) {
        const url = `${this.apiGroupBaseUrl}/${endpoint}`;
        const options = { method: method, headers: {} };
        if (this.authToken) { options.headers['Authorization'] = `Bearer ${this.authToken}`; }
        let finalUrl = url;
        if (method === 'GET' && paramsOrBody) { const queryParams = new URLSearchParams(paramsOrBody).toString(); if (queryParams) finalUrl = `${url}?${queryParams}`; }
        // MODIFIÉ v8.3: DELETE peut avoir un body JSON pour envoyer les IDs
        else if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && paramsOrBody) {
            if (isFormData) { options.body = paramsOrBody; }
            else { options.headers['Content-Type'] = 'application/json'; options.body = JSON.stringify(paramsOrBody); }
        }
        try {
            const response = await fetch(finalUrl, options);
            if (response.status === 204 || response.headers.get('content-length') === '0') { if (!response.ok) throw new Error(`Erreur HTTP ${response.status}`); return null; }
            const responseData = await response.json();
            if (!response.ok) throw new Error(responseData.message || `Erreur HTTP ${response.status}`);
            return responseData;
        } catch (error) { console.error(`Erreur appel ${method} ${endpoint}:`, error); throw error; }
    }
    get(endpoint, params = null) { return this._request('GET', endpoint, params); }
    post(endpoint, body = null, isFormData = false) { return this._request('POST', endpoint, body, isFormData); }
    put(endpoint, body = null, isFormData = false) { return this._request('PUT', endpoint, body, isFormData); }
    patch(endpoint, body = null, isFormData = false) { return this._request('PATCH', endpoint, body, isFormData); }
    // MODIFIÉ v8 -> v8.3: La méthode delete peut maintenant envoyer un body JSON
    delete(endpoint, body = null) { return this._request('DELETE', endpoint, body, false); } // false = assume JSON body
}

// --- Initialisation des Formulaires (Identique v8) ---
function initXanoForms(xanoClient) {
    const xanoForms = document.querySelectorAll('[data-xano-form]');
    xanoForms.forEach((form) => {
      form.addEventListener('submit', async function (e) {
        e.preventDefault();
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
          if (form.hasAttribute('data-xano-form-id-param')) {
            const idParamName = form.getAttribute('data-xano-form-id-param'); const idValue = getQueryParam(idParamName);
            if (idValue && ['PUT', 'PATCH', 'DELETE'].includes(method)) { finalEndpoint = `${endpoint}/${idValue}`; }
            else if (idValue && method === 'POST') { console.warn("ID param utilisé avec POST."); finalEndpoint = `${endpoint}/${idValue}`; }
          }
          // Utilise TOUJOURS FormData comme dans la v8 originale
          const formData = collectFormDataWithFiles(form);
          let responseData;
          switch (method) {
          case 'POST': responseData = await xanoClient.post(finalEndpoint, formData, true); break;
          case 'PUT': responseData = await xanoClient.put(finalEndpoint, formData, true); break;
          case 'PATCH': responseData = await xanoClient.patch(finalEndpoint, formData, true); break;
          case 'DELETE': responseData = await xanoClient.delete(finalEndpoint); break; // Pas de body pour DELETE ici (ID dans URL)
          default: throw new Error(`Méthode formulaire non supportée: ${method}`);
          }
          const successEvent = new CustomEvent('xano:form-success', { detail: { response: responseData, form: form }, bubbles: true });
          form.dispatchEvent(successEvent);
          if (form.hasAttribute('data-xano-form-redirect')) { window.location.href = form.getAttribute('data-xano-form-redirect'); }
          else {
             // INFO v8.3: Rafraîchissement après upload si nécessaire
             if (form.getAttribute('data-xano-form') === 'upload_multiple_photos' && currentSelectedRoomId) {
                 console.log("Upload photos réussi, rafraîchissement...");
                 await refreshCurrentRoomPhotos(xanoClient); // Utilise helper pour rafraîchir
             } else {
                // form.reset(); // Optionnel
             }
          }
        } catch (error) {
          console.error('Erreur soumission formulaire:', error);
          if (errorElement) { errorElement.textContent = error.message || "Erreur inconnue."; errorElement.style.display = 'block'; }
          const errorEvent = new CustomEvent('xano:form-error', { detail: { error: error, form: form }, bubbles: true });
          form.dispatchEvent(errorEvent);
        } finally {
          if (loadingElement) loadingElement.style.display = 'none';
          if (submitButton) submitButton.disabled = false;
        }
      });
    });
  }

// --- Init Récupération/Affichage Données (Identique v8) ---
function initXanoDataEndpoints(xanoClient) {
    const xanoElements = document.querySelectorAll('[data-xano-endpoint]');
    xanoElements.forEach(element => {
      const endpoint = element.getAttribute('data-xano-endpoint');
      const method = (element.getAttribute('data-xano-method') || 'GET').toUpperCase();
      const params = {};
      for (const attr of element.attributes) { if (attr.name.startsWith('data-xano-param-')) params[attr.name.replace('data-xano-param-', '')] = attr.value; }
      if (element.hasAttribute('data-xano-use-url-param')) {
        const urlParamName = element.getAttribute('data-xano-use-url-param'); const urlParamValue = getQueryParam(urlParamName);
        if (urlParamValue !== null) { const apiParamName = element.getAttribute('data-xano-url-param-to-api') || urlParamName; params[apiParamName] = urlParamValue; }
      }
      const loadingIndicator = element.querySelector('[data-xano-loading]') || document.querySelector(element.getAttribute('data-xano-loading-selector'));
      if (loadingIndicator) loadingIndicator.style.display = 'block';
      fetchXanoData(xanoClient, endpoint, method, params, element, loadingIndicator);
    });
  }

// --- Init Gestionnaires de Liens (Identique v8) ---
function initXanoLinkHandlers() {
    document.addEventListener('xano:data-loaded', function (event) {
      const loadedElement = event.detail.element; const data = event.detail.data;
      const potentialLinks = loadedElement.querySelectorAll('[data-xano-link-to]');
      potentialLinks.forEach(linkElement => {
        if (!linkElement.closest('[data-xano-list-item]')) {
          const targetPage = linkElement.getAttribute('data-xano-link-to'); const idField = linkElement.getAttribute('data-xano-link-param-id') || 'id';
          const idParamName = linkElement.getAttribute('data-xano-link-url-param') || 'id'; const sourceData = data?.body ? data.body : data;
          let linkTarget = targetPage;
          if (sourceData && typeof sourceData === 'object' && sourceData[idField]) linkTarget = `${targetPage}?${idParamName}=${encodeURIComponent(sourceData[idField])}`;
          else if (linkElement.hasAttribute('data-xano-data-id')) linkTarget = `${targetPage}?${idParamName}=${encodeURIComponent(linkElement.getAttribute('data-xano-data-id'))}`;
          if (linkElement.tagName === 'A') linkElement.href = linkTarget;
          else { linkElement.setAttribute('data-xano-link-target', linkTarget); linkElement.style.cursor = 'pointer'; }
        }
      });
    });
    document.addEventListener('click', function (event) {
      const clickedElement = event.target.closest('[data-xano-link-target]');
      if (clickedElement && clickedElement.tagName !== 'A') { const linkTarget = clickedElement.getAttribute('data-xano-link-target'); if (linkTarget) window.location.href = linkTarget; }
    });
  }

// --- Fonctions Logiques (Fetch, Render) ---
async function fetchXanoData(client, endpoint, method, params, targetElement, loadingIndicator) {
    try {
      let responseData;
      switch (method) {
      case 'GET': responseData = await client.get(endpoint, params); break;
      case 'POST': responseData = await client.post(endpoint, params); break;
      // ... (autres cas de la v8 si présents) ...
      default: throw new Error(`Méthode HTTP non supportée pour data-xano-endpoint: ${method}`);
      }
      if (loadingIndicator) loadingIndicator.style.display = 'none';
      renderData(responseData, targetElement); // Appel rendu
      const successEvent = new CustomEvent('xano:data-loaded', { detail: { data: responseData, element: targetElement }, bubbles: true });
      targetElement.dispatchEvent(successEvent);
    } catch (error) {
      console.error(`Erreur fetch ${endpoint}:`, error);
      if (loadingIndicator) loadingIndicator.style.display = 'none';
      const errorDisplay = targetElement.querySelector('[data-xano-error]') || targetElement;
      if (errorDisplay) { errorDisplay.textContent = `Erreur: ${error.message || 'Impossible de charger.'}`; errorDisplay.style.color = 'red'; }
      const errorEvent = new CustomEvent('xano:data-error', { detail: { error: error, element: targetElement }, bubbles: true });
      targetElement.dispatchEvent(errorEvent);
    }
  }

// MODIFIÉ v8 -> v8.3: renderData distingue maintenant le rendu des photos
function renderData(data, element) {
    if (element.id === 'room-photos-display' && element.hasAttribute('data-xano-list')) {
        console.log("renderData: Appel renderPhotoItems pour #room-photos-display (v8.3)");
        // INFO v8.3: Attend une liste d'enregistrements complets de property_photos
        let listData = Array.isArray(data) ? data : [];
        if (!Array.isArray(data)) console.warn("renderData: Données photos non tableau:", data);
        renderPhotoItems(listData, element); // Appel rendu photos
    } else if (element.hasAttribute('data-xano-list')) {
        console.log("renderData: Appel renderListData (générique) pour:", element);
        // Logique v8 pour extraire la liste (rooms, etc.)
        let listData = null;
        const potentialDataSources = [ data, data?.body, data?.items, data?.body?.items ];
        for (const source of potentialDataSources) { if (Array.isArray(source)) { listData = source; break; } if (source && typeof source === 'object') { for (const key in source) { if (Array.isArray(source[key])) { listData = source[key]; break; } } } if (listData) break; }
        if (!listData) { console.warn("renderData: Aucune liste trouvée pour", element, "dans", data); listData = []; }
        renderListData(listData, element); // Appel rendu liste générique
    } else {
        console.log("renderData: Affichage élément unique pour:", element);
        // Logique v8 pour éléments uniques
        const sourceData = data?.body ? data.body : data;
         if (sourceData && typeof sourceData === 'object') {
             const boundElements = element.querySelectorAll('[data-xano-bind]');
             if (boundElements.length > 0) { boundElements.forEach(be => { if (!be.closest('[data-xano-list-item]')) bindDataToElement(be, sourceData); }); }
             else if (element.hasAttribute('data-xano-bind')) bindDataToElement(element, sourceData);
         } else console.warn("renderData: Données élément unique non objet:", sourceData);
    }
}

// renderListData (Identique v8.1)
function renderListData(dataArray, listContainerElement) {
    dataArray = Array.isArray(dataArray) ? dataArray : [];
    const templateSelector = listContainerElement.getAttribute('data-xano-list');
    if (!templateSelector) { console.error("data-xano-list manquant.", listContainerElement); return; }
    const templateElement = document.querySelector(templateSelector);
    if (!templateElement) { console.error(`Template "${templateSelector}" introuvable.`); return; }
    const container = listContainerElement.querySelector('[data-xano-list-container]') || listContainerElement;
    // Vider conteneur (logique v8)
    let currentChild = container.firstChild;
    while (currentChild) { const nextChild = currentChild.nextSibling; if (currentChild !== templateElement && currentChild.nodeType === Node.ELEMENT_NODE && currentChild.hasAttribute('data-xano-list-item')) container.removeChild(currentChild); currentChild = nextChild; }
    const existingEmptyMessage = container.querySelector('.xano-empty-message'); if (existingEmptyMessage) container.removeChild(existingEmptyMessage);
    if (templateElement.tagName !== 'TEMPLATE') { templateElement.style.display = 'none'; templateElement.setAttribute('aria-hidden', 'true'); }
    if (dataArray.length > 0) {
        dataArray.forEach((item, index) => {
            const clone = templateElement.tagName === 'TEMPLATE' ? templateElement.content.cloneNode(true).firstElementChild : templateElement.cloneNode(true);
            if (!clone) { console.error("Échec clonage template."); return; }
            clone.style.display = ''; clone.removeAttribute('aria-hidden'); clone.setAttribute('data-xano-list-item', ''); clone.setAttribute('data-xano-item-index', index.toString());
            const boundElements = clone.querySelectorAll('[data-xano-bind]'); boundElements.forEach(be => bindDataToElement(be, item)); if (clone.hasAttribute('data-xano-bind')) bindDataToElement(clone, item);
            const linkElements = clone.querySelectorAll('[data-xano-link-to]');
            linkElements.forEach(le => {
                const targetPage = le.getAttribute('data-xano-link-to'); const idField = le.getAttribute('data-xano-link-param-id') || 'id';
                const idParamName = le.getAttribute('data-xano-link-url-param') || 'id'; let linkTarget = targetPage; const idValue = item[idField];
                if (idValue !== undefined && idValue !== null) linkTarget = `${targetPage}?${idParamName}=${encodeURIComponent(idValue)}`;
                else console.warn(`ID field "${idField}" non trouvé pour lien`, item);
                if (le.tagName === 'A') le.href = linkTarget; else { le.setAttribute('data-xano-link-target', linkTarget); le.style.cursor = 'pointer'; }
            });
            if (clone.hasAttribute('data-xano-link-to')) {
                const targetPage = clone.getAttribute('data-xano-link-to'); const idField = clone.getAttribute('data-xano-link-param-id') || 'id';
                const idParamName = clone.getAttribute('data-xano-link-url-param') || 'id'; let linkTarget = targetPage; const idValue = item[idField];
                if (idValue !== undefined && idValue !== null) linkTarget = `${targetPage}?${idParamName}=${encodeURIComponent(idValue)}`;
                if (clone.tagName === 'A') clone.href = linkTarget; else { clone.setAttribute('data-xano-link-target', linkTarget); clone.style.cursor = 'pointer'; }
            }
            // Spécifique Rooms (vérifie item.room_name)
            const clickableElement = clone.querySelector('[data-action="select-created-room"]') || clone;
            if (item.id !== undefined) { clickableElement.setAttribute('data-room-id', item.id); const rnf = 'room_name'; if (item[rnf]) clickableElement.setAttribute('data-room-name', item[rnf]); else console.warn(`renderListData: Champ '${rnf}' manquant room:`, item); if (!clickableElement.hasAttribute('data-action')) clickableElement.setAttribute('data-action', 'select-created-room'); }
            else console.warn("renderListData: ID manquant room:", item);
            container.appendChild(clone);
        });
    } else { const em = listContainerElement.getAttribute('data-xano-empty-message') || "Aucune donnée."; if (!container.querySelector('.xano-empty-message')) { const me = document.createElement('div'); me.className = 'xano-empty-message'; me.textContent = em; container.appendChild(me); } }
}

// MODIFIÉ v8 -> v8.3: renderPhotoItems utilise les IDs et la nouvelle structure de données
function renderPhotoItems(dataArray, listContainerElement) {
    // dataArray = liste des enregistrements complets de property_photos
    dataArray = Array.isArray(dataArray) ? dataArray : [];
    console.log(`renderPhotoItems: Rendu de ${dataArray.length} photos (v8.3).`);

    const emptyStatePlaceholder = document.getElementById('photo-empty-state-placeholder');
    const templateSelector = listContainerElement.getAttribute('data-xano-list');
    if (!templateSelector) { console.error("renderPhotoItems: data-xano-list manquant.", listContainerElement); return; }
    const templateElement = document.querySelector(templateSelector);
    if (!templateElement) { console.error(`renderPhotoItems: Template "${templateSelector}" introuvable.`); return; }
    const container = listContainerElement.querySelector('[data-xano-list-container]') || listContainerElement;

    // Vider conteneur (logique v8)
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

            // --- ID (Essentiel pour v8.3) ---
            if (item && item.id) {
                clone.setAttribute('data-photo-id', item.id); // Utilise l'ID de l'enregistrement
            } else {
                console.error("renderPhotoItems: ID photo MANQUANT dans l'enregistrement:", item);
                clone.classList.add('photo-item-error-no-id');
            }

            // --- Path (Utile pour la modale et fallback src) ---
            // !! Adaptez 'images' au nom exact de votre champ tableau !!
            const metadataField = 'images'; // <--- VÉRIFIEZ CE NOM
            const metadataArray = item ? item[metadataField] : null;
            const imageMetadata = (Array.isArray(metadataArray) && metadataArray.length > 0) ? metadataArray[0] : null;
            let imagePathOrUrl = null;
            if (imageMetadata) { imagePathOrUrl = imageMetadata.url || imageMetadata.path; }
            if (imagePathOrUrl) { clone.setAttribute('data-photo-path', imagePathOrUrl); }
            else { console.warn(`renderPhotoItems: Path/URL introuvable pour ID ${item?.id}:`, item); clone.setAttribute('data-photo-path', ''); }

            // --- Lier les données (pour la src de l'image via data-xano-bind) ---
            const boundElements = clone.querySelectorAll('[data-xano-bind]');
            boundElements.forEach(boundElement => bindDataToElement(boundElement, item));
            if (clone.hasAttribute('data-xano-bind')) bindDataToElement(clone, item);

            // --- Fade-in (Logique v8) ---
            const imgElement = clone.querySelector('.photo-item-image');
            if (imgElement) { imgElement.classList.add('photo-item-loading'); }
            else { console.warn("renderPhotoItems: Image (.photo-item-image) non trouvée pour fade-in."); }

            container.appendChild(clone);

            if (imgElement) { requestAnimationFrame(() => { requestAnimationFrame(() => { imgElement.classList.remove('photo-item-loading'); }); }); }
        });
    } else { // Aucune photo
        if (emptyStatePlaceholder) emptyStatePlaceholder.style.display = 'flex'; // Ou 'block'
        else {
             const emptyMessageText = listContainerElement.getAttribute('data-xano-empty-message') || "Aucune photo pour le moment.";
             if (!container.querySelector('.xano-empty-message')) {
                 const messageElement = document.createElement('div');
                 messageElement.className = 'xano-empty-message';
                 messageElement.textContent = emptyMessageText;
                 container.appendChild(messageElement);
             }
        }
    }
}

// MODIFIÉ v8 -> v8.3: bindDataToElement gère l'accès au tableau metadata
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
            let imageUrl = '';
            // !! Adaptez 'images' au nom exact de votre champ tableau !!
            const metadataField = 'images'; // <--- VÉRIFIEZ CE NOM
            const metadataArray = data ? data[metadataField] : null;
            // Prend le premier élément du tableau (index 0)
            const imageMetadata = (Array.isArray(metadataArray) && metadataArray.length > 0) ? metadataArray[0] : null;

            if (imageMetadata) {
                 // Si clé = "images.url", "images.path", etc.
                 if (keys.length > 1 && keys[0] === metadataField) { imageUrl = displayValue; }
                 // Si clé = "images" ou autre clé non spécifique (ex: "url")
                 else { imageUrl = imageMetadata.url || imageMetadata.path; }
            }
            else if (typeof displayValue === 'string' && (displayValue.startsWith('/vault/') || displayValue.startsWith('http'))) { imageUrl = displayValue; } // Fallback

            if (!imageUrl) console.warn(`bindData: URL image introuvable (clé: ${dataKey}):`, data);
            element.src = imageUrl || ''; // Définit src, ou vide si non trouvée
            break;
        // ... autres cas (input, textarea, etc. identiques à v8) ...
        case 'iframe': case 'video': case 'audio': case 'source': element.src = displayValue; break;
        case 'input':
            if (element.type === 'checkbox') element.checked = !!value;
            else if (element.type === 'radio') element.checked = (element.value == value); // Comparaison non stricte
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
    // Attributs liés (identique v8)
    for (const attr of element.attributes) {
        if (attr.name.startsWith('data-xano-bind-attr-')) {
            const attrName = attr.name.replace('data-xano-bind-attr-', ''); const attrValueKey = attr.value;
            let attrValue = data; const attrKeys = attrValueKey.split('.');
            try { for (const key of attrKeys) { if (attrValue && typeof attrValue === 'object' && key in attrValue) attrValue = attrValue[key]; else { attrValue = undefined; break; } } } catch (e) { attrValue = undefined; }
            if (attrValue !== undefined) { if (typeof attrValue === 'boolean') { if (attrValue) element.setAttribute(attrName, ''); else element.removeAttribute(attrName); } else element.setAttribute(attrName, attrValue); }
            else { element.removeAttribute(attrName); /* console.warn(`Clé "${attrValueKey}" pour attribut "${attrName}" non trouvée.`); */ }
        }
    }
    if (element.hasAttribute('data-xano-link-to') && data?.id !== undefined) element.setAttribute('data-xano-data-id', data.id);
}

// --- Sélection/Suppression Photos (MODIFIÉ v8.3 -> v8.9 : Écouteur Clic Corrigé) ---
function setupPhotoSelectionMode() {
    console.log("SETUP: Initialisation du bouton mode sélection photo (v8 logic).");
    // Récupération des éléments DOM essentiels
    const boutonModeSelection = document.getElementById('bouton-mode-selection');
    const conteneurPhotos = document.getElementById('room-photos-display'); // <<< Cible V8
    const photoListContainer = document.getElementById('photo-list-container'); // Utilisé pour trouver les éléments sélectionnés
    const boutonSupprimerSelection = document.getElementById('bouton-supprimer-selection');

    // Vérification initiale
    if (!boutonModeSelection || !conteneurPhotos || !photoListContainer || !boutonSupprimerSelection) {
        console.error("SETUP ERROR (v8 logic): Un ou plusieurs éléments HTML manquants. IDs requis: bouton-mode-selection, room-photos-display, photo-list-container, bouton-supprimer-selection");
        return;
    }

    // --- Fonction HELPER pour gérer la visibilité du bouton Supprimer ---
    function updateDeleteButtonVisibility() {
        if (!boutonSupprimerSelection) return;
        // 'photosSelectionneesIds' contient des PATHS dans cette version
        if (modeSelectionActif && photosSelectionneesIds.length > 0) {
            boutonSupprimerSelection.classList.remove('button-is-hidden');
            boutonSupprimerSelection.classList.add('button-is-visible');
        } else {
            boutonSupprimerSelection.classList.remove('button-is-visible');
            boutonSupprimerSelection.classList.add('button-is-hidden');
        }
    }

    // --- Fonction Principale pour Exécuter la Suppression (VERSION V8 - utilise les paths) ---
async function executeDelete() {
    // photosSelectionneesIds contient des PATHS ici
    console.log(`Exécution suppression confirmée pour ${photosSelectionneesIds.length} photo(s) dans la room ${currentSelectedRoomId}. Paths:`, photosSelectionneesIds);
    const modalConfirmBtn = document.getElementById('modal-confirm-delete-button');
    if (modalConfirmBtn) {
         modalConfirmBtn.disabled = true;
    }

    let scrollPos = window.scrollY || document.documentElement.scrollTop;
    console.log("Scroll position before delete/refresh:", scrollPos);

    // Préparer le payload pour l'API Xano V8 (attend les paths)
    const payload = {
        room_id: parseInt(currentSelectedRoomId, 10),
        photo_paths: photosSelectionneesIds // <<< Envoie les paths
    };
    // Endpoint V8 (vérifiez le nom exact utilisé par votre V8)
    const deleteEndpoint = 'property_photos/batch_delete_by_ids'; // <<< Endpoint V8 qui prend les paths
    const deleteMethod = 'POST'; // <<< Méthode V8 (souvent POST pour un batch)
    // OU 'DELETE' si votre API v8 utilisait DELETE avec un body (moins courant mais possible)

    try {
        // Appel API via le client Xano
        // Note: Dans V8, xanoClient._request n'était peut-être pas utilisé directement
        // ou la vérification de succès était différente. Adaptez si besoin.
        // Utilisation de la méthode _request pour être cohérent avec les versions récentes
        // Si votre V8 utilisait xanoClient.post ou .delete directement:
        // const response = await xanoClient.post(deleteEndpoint, payload); // Ou .delete

        const response = await xanoClient._request(deleteMethod, deleteEndpoint, payload, false); // false = not FormData
        console.log('>>> RAW Response from _request (V8 logic):', response);

        // --- Logique de Vérification du Succès V8 (Simplifiée/Adaptée) ---
        // V8 n'avait peut-être pas de check 'success'. Une réponse non-erreur suffisait.
        let success = true; // Supposons succès sauf si erreur levée
        // Alternative: vérifier si response est null/undefined (pour 204) ou un objet attendu
        if (response && typeof response === 'object' && response.success === false) {
             success = false; // Si l'API renvoie explicitement success: false
             console.warn("API a indiqué un échec (V8 logic check). Response:", response);
        }
        // --- Fin Vérification Succès ---

        if (success) {
            console.log('Photos supprimées avec succès (API call V8 logic OK)!');

            // Rafraîchissement (identique à v8.3)
            console.log(`Rafraîchissement des photos pour la room ${currentSelectedRoomId}...`);
            const conteneurPhotos = document.getElementById('room-photos-display'); // Assure-toi que c'est la bonne variable
            const photoLoadingIndicator = conteneurPhotos ? conteneurPhotos.querySelector('[data-xano-loading]') : null;
            const fetchEndpoint = `property_photos/photos/${currentSelectedRoomId}`;

            if (conteneurPhotos && xanoClient) {
                if (photoLoadingIndicator) photoLoadingIndicator.style.display = 'block';
                try {
                    // fetchXanoData est une fonction commune, ok de la garder
                    await fetchXanoData(xanoClient, fetchEndpoint, 'GET', null, conteneurPhotos, photoLoadingIndicator);
                    console.log("Rafraîchissement terminé.");
                    // Restaurer scroll
                    setTimeout(() => {
                      console.log("Attempting to restore scroll position to:", scrollPos);
                      window.scrollTo({ top: scrollPos, behavior: 'auto' });
                    }, 100); // Léger délai peut aider
                } catch (fetchError) {
                    console.error("Erreur lors du rafraîchissement post-suppression:", fetchError);
                    alert("Photos supprimées, mais erreur lors de la mise à jour de l'affichage.");
                } finally {
                    if (photoLoadingIndicator) photoLoadingIndicator.style.display = 'none';
                }
            } else {
                console.warn("Impossible de rafraîchir: conteneurPhotos ou xanoClient manquant.");
                alert("Photos supprimées, mais rafraîchissement auto échoué.");
            }

            // Réinitialiser l'état (identique v8.3)
            photosSelectionneesIds = []; // Vider tableau des paths
            modeSelectionActif = false;
            if (boutonModeSelection) boutonModeSelection.textContent = "Sélectionner les photos";
            // 'conteneurPhotosParent' n'existe pas ici, utiliser 'conteneurPhotos' (la variable de cette fonction)
            if (conteneurPhotos) conteneurPhotos.classList.remove('selection-active');
            updateDeleteButtonVisibility();

        } else {
            // Échec API v8
            console.error(`La suppression V8 a échoué. Raw response:`, response);
            let errorMessage = "La suppression des photos a échoué.";
            if (response && response.message) { errorMessage += ` Message: ${response.message}`; }
            alert(errorMessage);
        }

    } catch (error) { // Erreur réseau ou autre
        console.error("Erreur lors du processus de suppression V8:", error);
        alert("Erreur réseau/technique lors de la suppression: " + error.message);
    } finally {
        closeDeleteModal(); // Fonction helper V8
        if (modalConfirmBtn) {
             modalConfirmBtn.disabled = false;
        }
    }
} // --- FIN de executeDelete (VERSION V8) ---

    // MODIFIÉ v8 -> v8.3: Utilise les IDs et le nouvel endpoint reorder
    async function handleSortEnd(event) {
        console.log("DEBUG: handleSortEnd START (v8.3)");
        const photoListContainerElement = event.target;
        const items = Array.from(photoListContainerElement.children);
        const orderedPhotoIds = items.map(el => el.getAttribute('data-photo-id')).filter(id => id).map(id => parseInt(id, 10)).filter(id => !isNaN(id));
        if (orderedPhotoIds.length === 0 || currentSelectedRoomId === null) { console.log("DEBUG: handleSortEnd: Aucun ID photo valide ou room ID inconnu."); if (modeSelectionActif && boutonSupprimerSelection) boutonSupprimerSelection.disabled = false; return; }
        console.log("DEBUG: handleSortEnd: Nouvel ordre IDs:", orderedPhotoIds);
        const reorderEndpoint = `property_photos/batch_reorder`; // !! VÉRIFIEZ NOM ENDPOINT !!
        const payload = { ordered_photo_ids: orderedPhotoIds, room_id: parseInt(currentSelectedRoomId, 10) };
        console.log("DEBUG: handleSortEnd: Préparation appel API batch_reorder - Payload:", payload);
        try {
            console.log("DEBUG: handleSortEnd: Tentative appel xanoClient.post...");
            await xanoClient.post(reorderEndpoint, payload); // !! VÉRIFIEZ MÉTHODE (POST ou PATCH) !!
            console.log("DEBUG: handleSortEnd: Appel API batch_reorder RÉUSSI.");
        } catch (error) { console.error("DEBUG: handleSortEnd: ERREUR lors appel API batch_reorder:", error); alert("Erreur sauvegarde ordre photos."); await refreshCurrentRoomPhotos(xanoClient); }
        finally { if (modeSelectionActif && boutonSupprimerSelection) { boutonSupprimerSelection.disabled = false; console.log("DEBUG: handleSortEnd: Bouton Supprimer réactivé."); } console.log("DEBUG: handleSortEnd END"); }
    }

  // --- Écouteur sur le bouton Gérer/Annuler (Logique V8 - Pas de gestion SortableJS ici) ---
    boutonModeSelection.addEventListener('click', function() {
        modeSelectionActif = !modeSelectionActif;
        console.log("Mode sélection photos :", modeSelectionActif);
        if (modeSelectionActif) {
            boutonModeSelection.textContent = "Annuler";
            conteneurPhotos.classList.add('selection-active'); // <<< Classe sur #room-photos-display
            updateDeleteButtonVisibility(); // Cache si 0 sélection
        } else {
            // Sortir du mode sélection
            boutonModeSelection.textContent = "Sélectionner les photos";
            conteneurPhotos.classList.remove('selection-active');
            console.log("Annulation sélection : Désélection de toutes les photos.");
            photosSelectionneesIds = []; // Vider le tableau (des paths)
            // Retirer la classe visuelle des éléments ciblés par [data-photo-path]
            if (photoListContainer) {
                 // On cible les éléments qui ont la classe ET l'attribut path dans v8
                photoListContainer.querySelectorAll('[data-photo-path].is-photo-selected').forEach(photoEl => {
                    photoEl.classList.remove('is-photo-selected');
                });
            }
            updateDeleteButtonVisibility(); // Doit cacher le bouton
        }
    });
    console.log("SETUP (v8 logic): Écouteur ajouté au bouton mode sélection.");

    // --- Écouteur sur le Conteneur des Photos (pour sélection individuelle - LOGIQUE V8) ---
    conteneurPhotos.addEventListener('click', function(event) { // <<< Écouteur sur #room-photos-display
        if (!modeSelectionActif) return; // Ne rien faire si pas en mode sélection

        // Cible l'élément le plus proche ayant data-photo-path
        const clickedPhotoElement = event.target.closest('[data-photo-path]');
        if (!clickedPhotoElement) return; // Clic en dehors d'un élément photo

        const photoPath = clickedPhotoElement.getAttribute('data-photo-path');
        if (!photoPath) return; // Sécurité

        // Gérer la classe visuelle SUR L'ÉLÉMENT AVEC data-photo-path
        clickedPhotoElement.classList.toggle('is-photo-selected');

        const isNowSelected = clickedPhotoElement.classList.contains('is-photo-selected');
        console.log(`Photo [path: ${photoPath}] sélectionnée: ${isNowSelected}`);

        // Mettre à jour le tableau des IDs sélectionnés (qui contient des PATHS ici)
        const indexInSelection = photosSelectionneesIds.indexOf(photoPath);
        if (isNowSelected && indexInSelection === -1) {
            photosSelectionneesIds.push(photoPath); // Ajoute le path
            console.log(`   -> Photo ajoutée au tableau: ${photoPath}`);
        } else if (!isNowSelected && indexInSelection > -1) {
            photosSelectionneesIds.splice(indexInSelection, 1); // Retire le path
            console.log(`   -> Photo retirée du tableau: ${photoPath}`);
        }
        console.log("Photos sélectionnées (paths):", photosSelectionneesIds);

        // Mettre à jour la visibilité du bouton Supprimer
        updateDeleteButtonVisibility();
    });
    console.log("SETUP (v8 logic): Écouteur ajouté au conteneur de photos (#room-photos-display).");

    // --- Le reste de la logique V8 pour la MODALE (Ouverture, Confirmation, Annulation) ---
    // Note: Cette partie est identique à celle de la v8.1/v8.3 dans les versions précédentes
    // que nous avions déjà, elle utilise les HELPER open/closeModal etc.
    // Assurez-vous que les fonctions openDeleteModal et closeDeleteModal sont celles
    // qui simulent le clic sur les triggers/close elements.

    
    if (boutonSupprimerSelection) {
        boutonSupprimerSelection.addEventListener('click', function() {
            if (photosSelectionneesIds.length === 0) return;
            if (currentSelectedRoomId === null) { alert("Erreur : Room ID inconnu."); return; }

            const modalElement = document.querySelector('[fs-modal-element="delete-confirm"]');
            const thumbnailElement = modalElement?.querySelector('[data-modal-element="photo-thumbnail"]');
            const badgeElement = modalElement?.querySelector('[data-modal-element="photo-badge"]');
            const textElement = modalElement?.querySelector('[data-modal-element="confirm-text"]');

            if (!modalElement || !thumbnailElement || !badgeElement || !textElement) {
                console.error("Éléments de la modale de confirmation introuvables !");
                const fb = window.confirm(`MODALE INTROUVABLE - Supprimer ${photosSelectionneesIds.length} photo(s) ?`);
                if (fb && typeof executeDelete === 'function') executeDelete(); // Assure que executeDelete existe
                return;
            }

            const count = photosSelectionneesIds.length;
            const firstPhotoPath = photosSelectionneesIds[0];
            let firstPhotoUrl = '';
             // Trouver l'URL de la miniature depuis le DOM (logique V8)
            const firstPhotoDOMElement = conteneurPhotos.querySelector(`[data-photo-path="${firstPhotoPath}"]`);
            const imgInside = firstPhotoDOMElement?.querySelector('img.photo-item-image');
            if (imgInside && imgInside.src) { firstPhotoUrl = imgInside.src; }
            else { console.warn("Impossible de trouver l'URL src pour la première photo:", firstPhotoPath); }

            thumbnailElement.src = firstPhotoUrl;
            thumbnailElement.alt = `Aperçu (${count} photo(s))`;
            if (count > 1) { badgeElement.textContent = `+${count - 1}`; badgeElement.style.display = 'flex'; }
            else { badgeElement.style.display = 'none'; }
            textElement.textContent = `Supprimer ${count} photo${count > 1 ? 's' : ''} ? Action irréversible.`;

            openDeleteModal(); // Appel Helper V8
        });
        console.log("SETUP (v8 logic): Écouteur ajouté au bouton supprimer sélection.");
    }

    const modalConfirmBtn = document.getElementById('modal-confirm-delete-button');
    const modalCancelBtn = document.getElementById('modal-cancel-delete-button'); // Non utilisé dans v8 si fs-modal-element=close existe

    if (modalConfirmBtn) {
        if (!modalConfirmBtn.listenerAdded) {
             // Assurez-vous que la fonction executeDelete (celle de v8!) est bien définie globalement ou passée en paramètre
             if (typeof executeDelete === 'function') {
                 modalConfirmBtn.addEventListener('click', executeDelete);
                 modalConfirmBtn.listenerAdded = true;
             } else {
                 console.error("ERREUR SETUP (v8 logic): La fonction executeDelete n'est pas définie au moment d'attacher l'écouteur au bouton de confirmation modal.")
             }
         }
    } else {
        console.warn("Bouton confirmation modale (#modal-confirm-delete-button) introuvable.");
    }

    // Fonctions Helper V8 pour la modale (simulation clic)
    function openDeleteModal() {
         console.log("Attempting to open modal via hidden trigger (v8 logic)...");
         const hiddenTrigger = document.getElementById('hidden-delete-modal-trigger');
         if (hiddenTrigger) { hiddenTrigger.click(); }
         else { console.error("Trigger modal caché #hidden-delete-modal-trigger introuvable !"); }
    }

    function closeDeleteModal() {
         console.log("Attempting to close modal via [fs-modal-element='close'] (v8 logic)...");
         const closeElement = document.querySelector('[fs-modal-element="close"]');
         if (closeElement) { try { closeElement.click(); } catch(e) { console.error("Erreur clic fermeture:", e); } }
         else { console.warn("Élément fermeture modal [fs-modal-element='close'] introuvable."); }
    }

    // Appel initial pour cacher le bouton Supprimer
    updateDeleteButtonVisibility();

} // --- FIN de setupPhotoSelectionMode (VERSION v8) ---

// --- Fonctions Utilitaires (Helpers) ---

// INFO v8.3: Helper pour rafraîchir (ajouté pour cohérence)
async function refreshCurrentRoomPhotos(client) {
     if (!currentSelectedRoomId || !client) { console.warn("refreshCurrentRoomPhotos: Room ID ou client manquant."); return; }
     const photoDisplayContainer = document.getElementById('room-photos-display');
     if (!photoDisplayContainer) { console.error("refreshCurrentRoomPhotos: #room-photos-display introuvable."); return; }
     const photoLoadingIndicator = photoDisplayContainer.querySelector('[data-xano-loading]');
     const errorElement = photoDisplayContainer.querySelector('[data-xano-error]');
     console.log(`refreshCurrentRoomPhotos: Rafraîchissement photos pour room ${currentSelectedRoomId}...`);
     if (photoLoadingIndicator) photoLoadingIndicator.style.display = 'block'; if (errorElement) errorElement.style.display = 'none';
     if (currentSortableInstance) { console.log("refreshCurrentRoomPhotos: Destruction SortableJS précédente."); currentSortableInstance.destroy(); currentSortableInstance = null; }
     const photoEndpoint = `property_photos/photos/${currentSelectedRoomId}`;
     try {
         console.log("refreshCurrentRoomPhotos: Appel fetchXanoData...");
         await fetchXanoData(client, photoEndpoint, 'GET', null, photoDisplayContainer, photoLoadingIndicator);
         console.log(`refreshCurrentRoomPhotos: Rafraîchissement photos terminé.`);
         const photoList = document.getElementById('photo-list-container');
         if (photoList && photoList.children.length > 0) {
             console.log("refreshCurrentRoomPhotos: Tentative ré-initialisation SortableJS...");
             if (typeof Sortable !== 'undefined') {
                 currentSortableInstance = new Sortable(photoList, {
                     animation: 150, ghostClass: 'sortable-ghost',
                     onStart: function(evt) { console.log("DEBUG: SortableJS onStart"); const btn = document.getElementById('bouton-supprimer-selection'); if (modeSelectionActif && btn) btn.disabled = true; },
                     onEnd: function(evt) { console.log("DEBUG: SortableJS onEnd"); handleSortEnd(evt); } // Appelle la fonction modifiée
                 });
                 console.log("refreshCurrentRoomPhotos: SortableJS ré-initialisé:", currentSortableInstance);
             } else { console.error("refreshCurrentRoomPhotos: SortableJS n'est pas défini !"); }
         } else console.log("refreshCurrentRoomPhotos: Pas de photos à trier.");
     } catch (error) { console.error(`refreshCurrentRoomPhotos: Erreur refresh:`, error); if (errorElement) { errorElement.textContent = "Erreur refresh photos."; errorElement.style.display = 'block'; } }
     finally { if (photoLoadingIndicator) photoLoadingIndicator.style.display = 'none'; }
}

// collectFormDataWithFiles (Identique v8)
function collectFormDataWithFiles(form) {
    const formData = new FormData(); const inputs = form.querySelectorAll('input, select, textarea');
    inputs.forEach((input) => {
        const fieldName = input.getAttribute('data-xano-field-name') || input.name; if (!fieldName) return;
        if (input.type === 'file') { const fileFieldName = input.getAttribute('data-xano-bind') || fieldName; Array.from(input.files).forEach((file) => formData.append(fileFieldName, file)); }
        else if (input.type === 'checkbox') { if (input.checked) { if (formData.has(fieldName)) { let existing = formData.getAll(fieldName); formData.delete(fieldName); existing.forEach(val => formData.append(fieldName, val)); formData.append(fieldName, input.value); } else formData.append(fieldName, input.value); } }
        else if (input.type === 'radio') { if (input.checked) formData.append(fieldName, input.value); }
        else { formData.append(fieldName, input.value); }
    });
     // Ajout ID room pour upload (ajouté pour cohérence)
     if (form.getAttribute('data-xano-form') === 'upload_multiple_photos') {
          const roomIdInput = form.querySelector('[data-xano-field-name="property_photos_rooms_id"]');
          if (roomIdInput && roomIdInput.value) { formData.append('property_photos_rooms_id', roomIdInput.value); }
          else console.warn("Champ property_photos_rooms_id non trouvé/vide dans form upload.");
     }
    return formData;
  }

// getQueryParam (Identique v8)
function getQueryParam(param) { const urlParams = new URLSearchParams(window.location.search); return urlParams.get(param); }

// getCookie (Identique v8)
function getCookie(name) { const nameEQ = name + "="; const ca = document.cookie.split(';'); for (let i = 0; i < ca.length; i++) { let c = ca[i]; while (c.charAt(0) === ' ') c = c.substring(1, c.length); if (c.indexOf(nameEQ) === 0) return decodeURIComponent(c.substring(nameEQ.length, c.length)); } return null; }

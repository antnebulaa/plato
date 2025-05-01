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
            if (photoSectionContainer) { photoSectionContainer.style.display = 'block'; console.log("Conteneur photos rendu visible (style.display = 'block')."); }
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
// Dans fetchXanoData
async function fetchXanoData(client, endpoint, method, params, targetElement, loadingIndicator) {
    try {
      let responseData;
      console.log(`WorkspaceXanoData: Début fetch pour ${endpoint} sur element:`, targetElement ? targetElement.id || targetElement.tagName : 'ELEMENT INTROUVABLE'); // Log 1
      switch (method) {
          case 'GET': responseData = await client.get(endpoint, params); break;
          case 'POST': responseData = await client.post(endpoint, params); break;
          default: throw new Error(`Méthode HTTP non supportée: ${method}`);
      }
      console.log(`WorkspaceXanoData: Réponse reçue pour ${endpoint}:`, responseData); // Log 2: Voir la réponse brute

      if (loadingIndicator) loadingIndicator.style.display = 'none';

      console.log(`WorkspaceXanoData: Prêt à appeler renderData pour ${targetElement ? targetElement.id : 'ELEMENT INCONNU'}.`); // Log 3
      renderData(responseData, targetElement);
      console.log(`WorkspaceXanoData: Appel renderData terminé pour ${targetElement ? targetElement.id : 'ELEMENT INCONNU'}.`); // Log 4

      const successEvent = new CustomEvent('xano:data-loaded', { detail: { data: responseData, element: targetElement }, bubbles: true });
      targetElement.dispatchEvent(successEvent);

    } catch (error) {
      // Attention: Si une erreur se produit ICI (avant renderData), renderData ne sera jamais appelé.
      console.error(`Erreur fetch ${endpoint} (AVANT potentiel appel renderData):`, error);
      if (loadingIndicator) loadingIndicator.style.display = 'none';
      const errorDisplay = targetElement ? targetElement.querySelector('[data-xano-error]') : null;
      if (errorDisplay) { errorDisplay.textContent = `Erreur: ${error.message || 'Impossible de charger.'}`; errorDisplay.style.color = 'red'; errorDisplay.style.display = 'block'; }
      const errorEvent = new CustomEvent('xano:data-error', { detail: { error: error, element: targetElement }, bubbles: true });
      if (targetElement) targetElement.dispatchEvent(errorEvent);
    }
}

// Dans renderData (gardez votre version actuelle de renderPhotoItems pour l'instant)
function renderData(data, element) {
    console.log(`--- renderData (TEST SIMPLIFIÉ) pour element:`, element);

    // Se concentre UNIQUEMENT sur le rendu de la liste des rooms
    if (element && element.classList.contains('display-room-container') && element.getAttribute('data-xano-endpoint') === 'property_photos_rooms/get_one') {
         console.log("renderData (TEST SIMPLIFIÉ): Appel renderListData pour .display-room-container");

         // Extraction simplifiée des données des rooms (vérifiez la structure réelle de 'data')
         let listData = null;
         if (Array.isArray(data)) { listData = data; }
         else if (data && Array.isArray(data.items)) { listData = data.items; } // Ajustez si nécessaire (ex: data.body.items)
         else { console.warn("renderData (TEST SIMPLIFIÉ): Structure de données des rooms non reconnue:", data); listData = []; }

         if (typeof renderListData === 'function') {
             renderListData(listData, element); // Appel de la fonction originale qui affiche les rooms
         } else {
              console.error("renderData (TEST SIMPLIFIÉ): La fonction renderListData n'existe pas!");
         }
    } else if (element && element.id === 'room-photos-display') {
         console.log("renderData (TEST SIMPLIFIÉ): Ignoré - Affichage photos non traité dans ce test.");
         // N'appelle PAS renderPhotoItems pour ce test
    } else {
         console.log(`renderData (TEST SIMPLIFIÉ): Élément non traité:`, element);
         // Ne fait rien pour les autres cas pour l'instant
    }
    console.log(`--- renderData (TEST SIMPLIFIÉ): Sortie`);
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
          

            // --- NOUVEAU CODE POUR L'IMAGE DE FOND (adapté à la structure Xano simplifiée via checkboxes) ---
            // Trouvez la div spécifique dans le clone qui représente la room
            // Ajustez le sélecteur si nécessaire. S'il n'y a qu'une seule div avec ces attributs par item, ceci devrait fonctionner.
           
            console.log('Traitement de la room :', item); // Voir les données de la room
            const roomDiv = clone.querySelector(`[data-action="select-created-room"][data-room-id]`);
            // console.log('Div cible (roomDiv) trouvée :', roomDiv); // Gardez les logs si besoin

            // Utilisez le nom exact que vous avez mis dans "Return As" (ex: photo_list)
            const photoInfoArray = item.photo_list; // <--- VÉRIFIEZ QUE C'EST BIEN 'photo_list'
            // console.log('Tableau simplifié de photos trouvé :', photoInfoArray);

            if (roomDiv && photoInfoArray && Array.isArray(photoInfoArray)) {

                // Trouver l'objet photo avec photo_order === 1
                const targetPhotoInfo = photoInfoArray.find(photo => photo.photo_order === 1);
                // console.log('Info photo avec order=1 trouvée :', targetPhotoInfo);

                let photoUrl = null; // Initialiser photoUrl

                // Vérifier si l'objet a été trouvé ET accéder à l'URL via images[0].url
                // Utilisation de l'optional chaining (?.)
                if (targetPhotoInfo?.images?.[0]?.url) { // <--- AJUSTEMENT ICI: AJOUT DE [0]
                    // Extraire l'URL depuis la structure tableau->objet
                    photoUrl = targetPhotoInfo.images[0].url; // <--- AJUSTEMENT ICI: AJOUT DE [0]
                    // console.log('URL trouvée (order=1) :', photoUrl);
                } else {
                    // console.warn(`Info photo avec order=1 non trouvée, ou structure 'images[0].url' invalide pour room ID ${item.id}.`);
                    // Fallback éventuel : Chercher la première photo du tableau qui a une URL valide
                    const fallbackPhotoInfo = photoInfoArray.find(photo => photo?.images?.[0]?.url); // <--- AJUSTEMENT ICI AUSSI
                    if (fallbackPhotoInfo) {
                         photoUrl = fallbackPhotoInfo.images[0].url; // <--- AJUSTEMENT ICI AUSSI
                         // console.log('Utilisation de la première photo valide comme fallback :', photoUrl);
                    } else {
                        // console.warn(`Aucune photo valide trouvée pour room ID ${item.id}.`);
                    }
                }

                // Appliquer le style seulement si on a une URL valide
                if (photoUrl) {
                     // console.log(`Application de l'image de fond (${photoUrl}) sur :`, roomDiv);
                     roomDiv.style.backgroundImage = `url('${photoUrl}')`;
                     // Styles CSS importants
                     roomDiv.style.backgroundSize = 'cover';
                     roomDiv.style.backgroundPosition = 'center';
                     roomDiv.style.backgroundRepeat = 'no-repeat';
                     roomDiv.style.minHeight = '200px'; // Assurez-vous que la div a une hauteur !
                } else {
                    // console.log('Aucune URL de photo à appliquer pour room ID:', item.id);
                }

            } else if (roomDiv) {
                 // console.warn(`Tableau '${/* METTRE LE NOM ICI AUSSI */ "photo_list"}' non trouvé ou invalide pour room ID:`, item.id);
            } else {
                 // console.error("La div cible [data-action='select-created-room'] n'a pas été trouvée dans le clone !");
            }
            // --- FIN DU NOUVEAU CODE ---
          
          
            container.appendChild(clone);
        });
    } else { const em = listContainerElement.getAttribute('data-xano-empty-message') || "Aucune donnée."; if (!container.querySelector('.xano-empty-message')) { const me = document.createElement('div'); me.className = 'xano-empty-message'; me.textContent = em; container.appendChild(me); } }
}

// Dans la fonction renderPhotoItems(dataArray, listContainerElement)

function renderPhotoItems(dataArray, listContainerElement) { // listContainerElement est #room-photos-display
    dataArray = Array.isArray(dataArray) ? dataArray : [];
    console.log(`renderPhotoItems: Rendu de ${dataArray.length} photos (v Structure Confirmée).`);

    // 1. Récupérer les sélecteurs depuis l'élément parent (#room-photos-display)
    const templateSelector = listContainerElement.getAttribute('data-xano-list'); // Doit être ".photo-item-template"
    const photoListContainerSelector = listContainerElement.getAttribute('data-xano-list-container'); // Doit être "#photo-list-container"

    // 2. Trouver les conteneurs réels en utilisant les sélecteurs
    //    Utilisation de document.querySelector car photoListContainerSelector est un ID (#...)
    const photoListContainer = photoListContainerSelector ? document.querySelector(photoListContainerSelector) : null;
    const emptyStatePlaceholder = document.getElementById('photo-empty-state-placeholder'); // Recherche par ID direct

    // --- Vérifications essentielles ---
    if (!photoListContainer) {
        console.error(`renderPhotoItems: ERREUR CRITIQUE - Conteneur photo introuvable via sélecteur: "${photoListContainerSelector}". Vérifiez l'attribut 'data-xano-list-container' sur #${listContainerElement.id} et l'ID de la cible.`);
        return; // Arrêter si le conteneur principal manque
    }
    if (!emptyStatePlaceholder) {
         // Pas bloquant, mais le signale si l'état vide ne peut pas être affiché.
         console.warn("renderPhotoItems: Placeholder état vide #photo-empty-state-placeholder introuvable.");
    }
    if (!templateSelector) {
        console.error("renderPhotoItems: ERREUR CRITIQUE - Attribut 'data-xano-list' manquant sur", listContainerElement.id);
        return;
    }

    // 3. Trouver le template *à l'intérieur* du conteneur photo trouvé (#photo-list-container)
    const templateElement = photoListContainer.querySelector(templateSelector);
    if (!templateElement) {
        console.error(`renderPhotoItems: ERREUR CRITIQUE - Template "${templateSelector}" introuvable DANS "${photoListContainerSelector}". Vérifiez la structure HTML et le sélecteur dans 'data-xano-list'.`);
        // On pourrait afficher un message d'erreur dans l'UI ici
        const errorDisplay = listContainerElement.querySelector('[data-xano-error]');
        if (errorDisplay) {
             errorDisplay.textContent = `Erreur: Template photo '${templateSelector}' non trouvé.`;
             errorDisplay.style.display = 'block';
        }
        return; // Arrêter si le template manque
    }
    // S'assurer que le template (qui est une div ici) est bien caché
    if (templateElement.style.display !== 'none') {
        templateElement.style.display = 'none';
        templateElement.setAttribute('aria-hidden', 'true');
    }

    // --- 4. Nettoyer les anciens éléments ajoutés dynamiquement ---
    //    Sélectionne uniquement les éléments marqués comme items de liste générés
    const itemsToRemove = photoListContainer.querySelectorAll('[data-xano-list-item]');
    itemsToRemove.forEach(item => photoListContainer.removeChild(item));
    //    Nettoie aussi un éventuel message d'erreur précédent dans le conteneur
    const existingEmptyMessage = photoListContainer.querySelector('.xano-empty-message');
    if (existingEmptyMessage) photoListContainer.removeChild(existingEmptyMessage);


    // --- 5. Affichage conditionnel ---
    if (dataArray.length > 0) {
        // CAS: Il y a des photos à afficher
        if (emptyStatePlaceholder) emptyStatePlaceholder.style.display = 'none'; // CACHER l'état vide
        photoListContainer.style.display = 'grid'; // MONTRER le conteneur de la liste (style="display: grid;" vu dans le screenshot)

        // Boucle pour cloner, remplir et ajouter chaque photo
        dataArray.forEach((item, index) => {
            const clone = templateElement.cloneNode(true); // Cloner la div template

            // Rendre le clone visible et le préparer
            clone.style.display = ''; // Enlève le display:none hérité
            clone.classList.remove('photo-item-template'); // Important pour ne pas le resélectionner comme template
            clone.setAttribute('data-xano-list-item', ''); // Marqueur pour le nettoyage futur
            clone.removeAttribute('aria-hidden');
            // clone.setAttribute('data-xano-item-index', index.toString()); // Si besoin de l'index

            // --- Logique pour remplir le clone (liaison des données) ---
            // A. Définir l'ID de la photo sur le clone (pour la sélection/suppression)
            if (item && item.id) {
                clone.setAttribute('data-photo-id', item.id);
            } else {
                console.error("renderPhotoItems: ID photo MANQUANT dans les données:", item);
                clone.classList.add('photo-item-error-no-id'); // Style d'erreur visuel ?
            }

            // B. Trouver l'URL de l'image (adaptez si la structure des données change)
            const metadataField = 'images'; // Nom du champ contenant les métadonnées de l'image
            const metadataArray = item ? item[metadataField] : null;
            const imageMetadata = (Array.isArray(metadataArray) && metadataArray.length > 0) ? metadataArray[0] : null;
            let imagePathOrUrl = imageMetadata ? (imageMetadata.url || imageMetadata.path) : null; // Prend l'URL ou le chemin

            // C. Définir l'attribut 'data-photo-path' (utilisé ailleurs ?)
            clone.setAttribute('data-photo-path', imagePathOrUrl || '');

            // D. Trouver la balise <img> à l'intérieur du clone
            const imgElement = clone.querySelector('img');
            if (imgElement) {
                // Utiliser bindDataToElement pour définir la source et autres attributs si elle fonctionne correctement
                 if (typeof bindDataToElement === 'function') {
                    bindDataToElement(imgElement, item); // Laisser bindDataToElement gérer la src
                 } else {
                     // Fallback: définir la source manuellement si bindDataToElement pose problème
                     imgElement.src = imagePathOrUrl || '';
                     console.warn("renderPhotoItems: bindDataToElement non trouvée ou désactivée, src définie manuellement.");
                 }

                // Effet de fondu (optionnel)
                imgElement.classList.add('photo-item-loading'); // Ajouter classe CSS pour l'opacité initiale
                requestAnimationFrame(() => { // Attendre le prochain frame
                    requestAnimationFrame(() => { // Attendre un autre frame (plus sûr)
                        imgElement.classList.remove('photo-item-loading'); // Retirer la classe pour transition CSS
                    });
                });
            } else {
                console.warn("renderPhotoItems: Balise <img> introuvable dans le template cloné.");
            }
            // --- Fin liaison données ---

            // Ajouter le clone rempli au conteneur
            photoListContainer.appendChild(clone);
        });

    } else {
        // CAS: Aucune photo (dataArray est vide)
        photoListContainer.style.display = 'none'; // CACHER le conteneur de la liste
        if (emptyStatePlaceholder) {
            emptyStatePlaceholder.style.display = 'flex'; // MONTRER l'état vide (ou 'block')
        } else {
            // Que faire si le placeholder manque ? Afficher un message texte simple ?
            console.warn("Placeholder état vide introuvable (#photo-empty-state-placeholder).");
            // On pourrait ajouter un message dans photoListContainer (mais il est caché)
            const emptyMessageText = listContainerElement.getAttribute('data-xano-empty-message') || "Aucune photo à afficher.";
            if (!photoListContainer.querySelector('.xano-empty-message')) {
                const messageElement = document.createElement('div');
                messageElement.className = 'xano-empty-message';
                messageElement.textContent = emptyMessageText;
                photoListContainer.appendChild(messageElement); // Ajouté au conteneur caché
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
// MODIFIÉ v8.3: Utilise les IDs et le nouvel endpoint delete (CORRIGÉ pour clé payload + check succès)
async function executeDelete() {
    // photosSelectionneesIds contient maintenant des IDs numériques (correct grâce à la modif précédente)
    if (photosSelectionneesIds.length === 0 || currentSelectedRoomId === null) {
         console.error("executeDelete: Aucune photo sélectionnée ou room ID inconnu.");
         return;
    }
    // Log qui montre bien les IDs
    console.log(`Exécution suppression pour ${photosSelectionneesIds.length} photo(s) [IDs: ${photosSelectionneesIds.join(', ')}] dans room ${currentSelectedRoomId}.`);
    const modalConfirmBtn = document.getElementById('modal-confirm-delete-button');
    if (modalConfirmBtn) modalConfirmBtn.disabled = true;
    let scrollPos = window.scrollY || document.documentElement.scrollTop;

    // *** CORRECTION CLÉ : Utiliser 'photo_ids' comme nom de clé dans le payload ***
    const payload = {
         photo_ids: photosSelectionneesIds, // <<< CORRIGÉ: Utilise 'photo_ids'
         room_id: parseInt(currentSelectedRoomId, 10)
    };
    // **************************************************************************

    const deleteEndpoint = 'property_photos/batch_delete_by_ids'; // Endpoint correct
    // Vérifiez la méthode HTTP attendue par VOTRE endpoint /batch_delete_by_ids
    // Si c'est DELETE (comme dans les versions précédentes du script v8.3):
    const deleteMethod = 'POST';

    console.log("Appel API - Endpoint:", deleteEndpoint, "Méthode:", deleteMethod, "Payload:", payload); // Log pour vérifier l'envoi

    try {
         let response;
         // Adapter l'appel en fonction de la méthode HTTP de votre endpoint
         if (deleteMethod === 'DELETE') {
              // Utilise la méthode delete du client qui peut envoyer un body JSON (version v8.3 du client)
              response = await xanoClient.delete(deleteEndpoint, payload);
         } else if (deleteMethod === 'POST') {
              // Utilise la méthode post du client
              response = await xanoClient.post(deleteEndpoint, payload, false); // false = not FormData
         } else {
              throw new Error(`Méthode ${deleteMethod} non gérée pour la suppression.`);
         }

        console.log(">>> RAW Response from API:", response); // Log de la réponse brute

        // --- Logique de Vérification du Succès AMÉLIORÉE ---
        let success = false;
        let deletedCount = 0; // Initialise à 0

        if (response && typeof response === 'object') {
             // Si l'API renvoie bien un objet avec success et deleted_count
             if (response.success === true) {
                  success = true;
                  deletedCount = parseInt(response.deleted_count, 10) || 0; // Récupère le compte
             }
             // Si l'API renvoie { deleted_count: X } sans 'success', on peut le considérer comme succès si > 0
             // else if (response.deleted_count !== undefined && parseInt(response.deleted_count, 10) > 0) {
             //      success = true;
             //      deletedCount = parseInt(response.deleted_count, 10);
             // }
        } else if (deleteMethod === 'DELETE' && response === null) {
             // Cas d'un DELETE réussi avec 204 No Content
             success = true;
             deletedCount = photosSelectionneesIds.length; // On suppose qu'elles ont toutes été supprimées
             console.warn("Suppression DELETE a réussi (204 No Content), deleted_count supposé.");
        }
        // --- Fin Vérification Succès ---

        // On vérifie maintenant si success ET si deletedCount > 0
        if (success && deletedCount > 0) {
             console.log(`${deletedCount} photo(s) supprimée(s) avec succès (API OK)!`);

             // Rafraîchissement seulement si la suppression a réussi ET a supprimé qqc
             await refreshCurrentRoomPhotos(xanoClient); // Assurez-vous que refreshCurrentRoomPhotos est bien définie et accessible
             setTimeout(() => { window.scrollTo({ top: scrollPos, behavior: 'auto' }); }, 100);

             // Réinitialiser l'état
             photosSelectionneesIds = [];
             modeSelectionActif = false;
             if (boutonModeSelection) boutonModeSelection.textContent = "Sélectionner les photos";
             // Récupérer le conteneur principal pour enlever la classe active
             const photoDisplayContainer = document.getElementById('room-photos-display');
             if (photoDisplayContainer) photoDisplayContainer.classList.remove('selection-active');

             // Mettre à jour bouton supprimer (updateDeleteButtonVisibility doit être accessible)
             if(typeof updateDeleteButtonVisibility === 'function') updateDeleteButtonVisibility();

        } else {
             // La suppression a échoué OU n'a rien supprimé (deleted_count: 0)
             console.error(`La suppression a échoué ou n'a supprimé aucune photo (deleted_count: ${deletedCount}). Response:`, response);
             alert(`Erreur: La suppression a échoué ou aucune photo correspondante n'a été trouvée (Count: ${deletedCount}). Vérifiez la console.`);
        }

    } catch (error) { // Erreur réseau/JS pendant l'appel
        console.error("Erreur processus suppression API:", error);
        alert("Erreur technique lors de la suppression: " + error.message);
    } finally {
         // Assurer la fermeture de la modale et la réactivation du bouton
         if (typeof closeDeleteModal === 'function') { // Vérifie que la fonction existe
             closeDeleteModal();
         } else { console.warn("La fonction closeDeleteModal n'est pas définie."); }
         if (modalConfirmBtn) modalConfirmBtn.disabled = false;
    }
} // --- FIN de executeDelete (VERSION V8) ---

    // MODIFIÉ v8 -> v8.3: Utilise les IDs et le nouvel endpoint reorder
    

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
    // --- Écouteur sur le Conteneur des Photos (MODIFIÉ pour stocker les IDs - Logique V8 adaptée) ---
conteneurPhotos.addEventListener('click', function(event) { // <<< Écouteur sur #room-photos-display (comme V8)
    // 1. Vérifier si le mode sélection est actif (inchangé)
    if (!modeSelectionActif) return;

    // 2. Trouver l'élément cliqué (logique V8 mais on s'assure qu'il a aussi l'ID)
    //    On cible l'élément qui a à la fois data-photo-path (pour être sûr que c'est la même cible que V8)
    //    ET data-photo-id (pour pouvoir récupérer l'ID).
    const clickedPhotoElement = event.target.closest('[data-photo-path][data-photo-id]');
    if (!clickedPhotoElement) {
         console.log("Clic ignoré ou élément photo sans ID/path trouvé.");
         return; // Clic en dehors ou élément mal configuré
    }

    // *** 3. MODIFICATION CLÉ : Récupérer l'ID numérique ***
    const photoIdString = clickedPhotoElement.getAttribute('data-photo-id'); // Récupère l'attribut ID
    const photoId = parseInt(photoIdString, 10); // Convertit en nombre entier

    // Vérifier si la conversion en nombre a réussi
    if (isNaN(photoId)) {
         console.warn("ID photo invalide (pas un nombre) ou manquant sur l'élément cliqué:", clickedPhotoElement);
         return; // Ne pas continuer si l'ID n'est pas un nombre valide
    }

    // 4. Gérer la classe visuelle SUR L'ÉLÉMENT CLIQUE (comme en V8)
    clickedPhotoElement.classList.toggle('is-photo-selected');
    const isNowSelected = clickedPhotoElement.classList.contains('is-photo-selected');
    // Log avec l'ID maintenant pour confirmation
    console.log(`Photo [ID: ${photoId}] sélectionnée: ${isNowSelected}`);

    // *** 5. MODIFICATION CLÉ : Mettre à jour le tableau photosSelectionneesIds avec les IDs ***
    const indexInSelection = photosSelectionneesIds.indexOf(photoId); // Cherche l'ID numérique
    if (isNowSelected && indexInSelection === -1) {
        photosSelectionneesIds.push(photoId); // Ajoute l'ID numérique
        console.log(`   -> ID ajouté au tableau: ${photoId}`);
    } else if (!isNowSelected && indexInSelection > -1) {
        photosSelectionneesIds.splice(indexInSelection, 1); // Retire l'ID numérique
        console.log(`   -> ID retiré du tableau: ${photoId}`);
    }
    // Afficher le tableau contenant maintenant des IDs
    console.log("Photos sélectionnées (IDs):", photosSelectionneesIds);

    // 6. Mettre à jour la visibilité du bouton Supprimer (inchangé)
    updateDeleteButtonVisibility();
});

console.log("SETUP (v8 adapted logic): Écouteur ajouté au conteneur photos pour sélection par ID."); // Log mis à jour

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
    // 'photosSelectionneesIds' contient maintenant des IDs, ex: [60]
    const firstPhotoId = photosSelectionneesIds[0]; // Contient l'ID numérique (ex: 60)
    let firstPhotoUrl = ''; // Initialise l'URL

    // Étape 1 : Trouver l'élément photo dans la liste en utilisant l'ID numérique
    const firstPhotoDOMElement = conteneurPhotos.querySelector(`[data-photo-id="${firstPhotoId}"]`); // Cherche l'élément via [data-photo-id="60"]

    // Étape 2 : Une fois l'élément trouvé, récupérer l'URL depuis son attribut data-photo-path
    if (firstPhotoDOMElement) {
        // On lit l'attribut data-photo-path de l'élément qu'on a trouvé grâce à l'ID
        firstPhotoUrl = firstPhotoDOMElement.getAttribute('data-photo-path'); // Récupère l'URL stockée dans data-photo-path
        if (!firstPhotoUrl) {
             // Si l'attribut data-photo-path est manquant ou vide sur cet élément
             console.warn("Attribut data-photo-path vide ou manquant sur l'élément trouvé pour l'ID:", firstPhotoId);
             firstPhotoUrl = ''; // Assurer une chaîne vide pour éviter les erreurs
        }
    } else {
         // Si on n'a même pas trouvé l'élément avec le bon data-photo-id
         console.warn("Impossible de trouver l'élément DOM dans la liste pour l'ID photo:", firstPhotoId);
         firstPhotoUrl = ''; // Assurer une chaîne vide
    }

    // Étape 3 : Mettre à jour l'image DANS LA MODALE avec l'URL trouvée (ou une chaîne vide)
    console.log("Mise à jour src de thumbnailElement avec:", firstPhotoUrl || "URL vide"); // Pour déboguer ce qui est appliqué
    thumbnailElement.src = firstPhotoUrl;
    thumbnailElement.alt = `Aperçu (${count} photo(s))`;

    // ... (Mise à jour badgeElement, textElement - reste inchangé) ...
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
  
  const photoEndpoint = `property_photos/photos/${currentSelectedRoomId}`;
     try {
         console.log("refreshCurrentRoomPhotos: Appel fetchXanoData...");
         await fetchXanoData(client, photoEndpoint, 'GET', null, photoDisplayContainer, photoLoadingIndicator);
         console.log(`refreshCurrentRoomPhotos: Rafraîchissement photos terminé.`);
         const photoList = document.getElementById('photo-list-container');
        
       if (photoList && photoList.children.length > 0) {
             console.log("refreshCurrentRoomPhotos: Tentative ré-initialisation SortableJS...");
             if (typeof Sortable !== 'undefined') {
               
                 currentSortableInstance = new Sortable(photoList, { // Début des options
               // === OPTION À GARDER ===
               animation: 150,

               // === OPTIONS À METTRE EN COMMENTAIRE (AJOUTEZ // DEVANT) ===
                ghostClass: 'sortable-ghost', 

               // onStart: function(evt) { // Ligne commentée
               //     console.log("DEBUG: SortableJS onStart"); // Ligne commentée
               //     const btn = document.getElementById('bouton-supprimer-selection'); // Ligne commentée
               //     if (modeSelectionActif && btn) btn.disabled = true; // Ligne commentée
               // }, // Ligne commentée

                onEnd: function(evt) { 
                   console.log("DEBUG: SortableJS onEnd"); 
                   handleSortEnd(evt);
               } 
               // ============================================================

           }); // Fin des options
               
                 console.log("refreshCurrentRoomPhotos: SortableJS ré-initialisé (TEST MINIMAL):", currentSortableInstance); // GARDER CE LOG
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

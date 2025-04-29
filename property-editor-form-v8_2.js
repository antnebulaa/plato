// ==========================================
// == Script Xano Unifié (Formulaires + Données) ==
// ==========================================
// Date: 2025-04-29 // Version 8.2 (v8 Modifié + Debug Logs Sélection/Drag)
// NOTE: Ajout de console.log pour déboguer la sélection et le drag/drop.

let xanoClient;
let currentSortableInstance = null;
let modeSelectionActif = false;
let photosSelectionneesIds = []; // Contiendra les IDs numériques
let currentSelectedRoomId = null;

// --- Fonctions Setup (Identiques v8.1) ---
function setupRoomTypeSelection() { /* ... (code v8.1) ... */ }
function setupCreatedRoomSelection(client) { /* ... (code v8.1) ... */ }

// --- Initialisation DOMContentLoaded (Identique v8.1) ---
document.addEventListener('DOMContentLoaded', function() { /* ... (code v8.1) ... */ });

// --- Classe XanoClient (Identique v8.1) ---
class XanoClient { /* ... (code v8.1) ... */ }

// --- Initialisation des Formulaires (Identique v8.1) ---
function initXanoForms(xanoClient) { /* ... (code v8.1) ... */ }

// --- Init Récupération/Affichage Données (Identique v8.1) ---
function initXanoDataEndpoints(xanoClient) { /* ... (code v8.1) ... */ }

// --- Init Gestionnaires de Liens (Identique v8.1) ---
function initXanoLinkHandlers() { /* ... (code v8.1) ... */ }

// --- Fonctions Logiques (Fetch, Render) ---
async function fetchXanoData(client, endpoint, method, params, targetElement, loadingIndicator) { /* ... (code v8.1) ... */ }
function renderData(data, element) { /* ... (code v8.1) ... */ }
function renderListData(dataArray, listContainerElement) { /* ... (code v8.1) ... */ }
function renderPhotoItems(dataArray, listContainerElement) { /* ... (code v8.1) ... */ }
function bindDataToElement(element, data) { /* ... (code v8.1) ... */ }

// ==========================================
// == Sélection/Suppression Photos (MODIFIÉ v8.1 -> v8.2 : Ajout Logs) ==
// ==========================================
function setupPhotoSelectionMode() {
    console.log("SETUP: Initialisation mode sélection photo (v8.2).");
    const boutonModeSelection = document.getElementById('bouton-mode-selection');
    const conteneurPhotos = document.getElementById('room-photos-display');
    const photoListContainer = document.getElementById('photo-list-container');
    const boutonSupprimerSelection = document.getElementById('bouton-supprimer-selection');
    if (!boutonModeSelection || !conteneurPhotos || !photoListContainer || !boutonSupprimerSelection) { console.error("SETUP ERROR: Éléments HTML manquants pour sélection photo."); return; }

    function updateDeleteButtonVisibility() { /* ... (identique v8.1) ... */ }
    async function executeDelete() { /* ... (identique v8.1) ... */ }

    // MODIFIÉ v8.1 -> v8.2: Ajout Logs
    async function handleSortEnd(event) {
        console.log("DEBUG: handleSortEnd START"); // Log début
        const photoListContainerElement = event.target;
        const items = Array.from(photoListContainerElement.children);
        const orderedPhotoIds = items
            .map(el => el.getAttribute('data-photo-id'))
            .filter(id => id)
            .map(id => parseInt(id, 10))
            .filter(id => !isNaN(id));

        if (orderedPhotoIds.length === 0 || currentSelectedRoomId === null) { console.log("DEBUG: handleSortEnd: Aucun ID photo valide ou room ID inconnu."); if (modeSelectionActif && boutonSupprimerSelection) boutonSupprimerSelection.disabled = false; return; }
        console.log("DEBUG: handleSortEnd: Nouvel ordre IDs:", orderedPhotoIds);

        const reorderEndpoint = `property_photos/batch_reorder`;
        const payload = {
            ordered_photo_ids: orderedPhotoIds,
            room_id: parseInt(currentSelectedRoomId, 10)
        };
        console.log("DEBUG: handleSortEnd: Préparation appel API batch_reorder - Payload:", payload);

        try {
            console.log("DEBUG: handleSortEnd: Tentative appel xanoClient.post...");
            await xanoClient.post(reorderEndpoint, payload);
            console.log("DEBUG: handleSortEnd: Appel API batch_reorder RÉUSSI.");
        } catch (error) {
            console.error("DEBUG: handleSortEnd: ERREUR lors appel API batch_reorder:", error);
            alert("Erreur sauvegarde ordre photos.");
            console.log("DEBUG: handleSortEnd: Tentative rechargement photos après erreur...");
            await refreshCurrentRoomPhotos(xanoClient);
        } finally {
            if (modeSelectionActif && boutonSupprimerSelection) { boutonSupprimerSelection.disabled = false; console.log("DEBUG: handleSortEnd: Bouton Supprimer réactivé."); }
            console.log("DEBUG: handleSortEnd END"); // Log fin
        }
    }

    // --- Écouteur bouton Gérer/Annuler (Identique v8.1) ---
    boutonModeSelection.addEventListener('click', function() { /* ... (code v8.1) ... */ });

    // --- Écouteur sélection individuelle (MODIFIÉ v8.1 -> v8.2: Ajout Logs) ---
    photoListContainer.addEventListener('click', function(event) {
        console.log("DEBUG: Clic détecté sur photoListContainer."); // Log clic conteneur
        if (!modeSelectionActif) {
             console.log("DEBUG: Clic ignoré (mode sélection inactif).");
             return;
        }
        // Cible l'élément avec data-photo-id
        const clickedPhotoElement = event.target.closest('[data-photo-id]');
        if (!clickedPhotoElement) {
             console.log("DEBUG: Clic ignoré (cible sans data-photo-id). Cible réelle:", event.target);
             return;
        }
        console.log("DEBUG: Élément photo cliqué trouvé:", clickedPhotoElement);

        // Récupère l'ID numérique
        const photoIdString = clickedPhotoElement.getAttribute('data-photo-id');
        const photoId = parseInt(photoIdString, 10);
        if (isNaN(photoId)) { console.warn("DEBUG: Clic photo mais ID invalide:", photoIdString); return; }
        console.log(`DEBUG: ID photo extrait: ${photoId}`);

        // Toggle classe et màj tableau
        clickedPhotoElement.classList.toggle('is-photo-selected');
        const isNowSelected = clickedPhotoElement.classList.contains('is-photo-selected');
        console.log(`DEBUG: Photo [ID: ${photoId}] sélectionnée: ${isNowSelected}`);
        const indexInSelection = photosSelectionneesIds.indexOf(photoId);
        if (isNowSelected && indexInSelection === -1) {
             photosSelectionneesIds.push(photoId);
             console.log("DEBUG: ID ajouté à photosSelectionneesIds.");
        } else if (!isNowSelected && indexInSelection > -1) {
             photosSelectionneesIds.splice(indexInSelection, 1);
             console.log("DEBUG: ID retiré de photosSelectionneesIds.");
        }
        console.log("DEBUG: photosSelectionneesIds actuel:", photosSelectionneesIds);
        updateDeleteButtonVisibility();
    });
    console.log("SETUP: Écouteur sélection photo (par ID) OK (v8.2).");

    // --- Écouteur bouton Supprimer (Ouvre modale - Identique v8.1) ---
    if (boutonSupprimerSelection) { boutonSupprimerSelection.addEventListener('click', function() { /* ... (code v8.1) ... */ }); }

    // --- Écouteurs modale (Identique v8.1) ---
    const modalConfirmBtn = document.getElementById('modal-confirm-delete-button');
    const modalCancelBtn = document.getElementById('modal-cancel-delete-button');
    if (modalConfirmBtn && !modalConfirmBtn.listenerAdded) { modalConfirmBtn.addEventListener('click', executeDelete); modalConfirmBtn.listenerAdded = true; }
    if (modalCancelBtn && !modalCancelBtn.listenerAdded) { modalCancelBtn.addEventListener('click', closeDeleteModal); modalCancelBtn.listenerAdded = true; }
    function openDeleteModal() { /* ... (code v8.1) ... */ }
    function closeDeleteModal() { /* ... (code v8.1) ... */ }
    updateDeleteButtonVisibility();
}

// ==========================================
// == Fonctions Utilitaires (Helpers)      ==
// ==========================================

// MODIFIÉ v8.1 -> v8.2: Ajout Logs dans refresh et init SortableJS
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
         console.log(`refreshCurrentRoomPhotos: Rafraîchissement photos terminé pour room ${currentSelectedRoomId}.`);

         // Ré-init SortableJS
         const photoList = document.getElementById('photo-list-container');
         if (photoList && photoList.children.length > 0) {
             console.log("refreshCurrentRoomPhotos: Tentative ré-initialisation SortableJS...");
             if (typeof Sortable !== 'undefined') {
                 currentSortableInstance = new Sortable(photoList, {
                     animation: 150, ghostClass: 'sortable-ghost',
                     onStart: function(evt) {
                         console.log("DEBUG: SortableJS onStart"); // Log début drag
                         const btn = document.getElementById('bouton-supprimer-selection');
                         if (modeSelectionActif && btn) btn.disabled = true;
                     },
                     onEnd: function(evt) {
                         console.log("DEBUG: SortableJS onEnd"); // Log fin drag
                         handleSortEnd(evt); // Appelle la fonction modifiée avec logs
                     }
                 });
                 console.log("refreshCurrentRoomPhotos: SortableJS ré-initialisé:", currentSortableInstance);
             } else {
                 console.error("refreshCurrentRoomPhotos: SortableJS n'est pas défini ! Librairie manquante ?");
             }
         } else console.log("refreshCurrentRoomPhotos: Pas de photos à trier après refresh.");
     } catch (error) {
         console.error(`refreshCurrentRoomPhotos: Erreur refresh photos room ${currentSelectedRoomId}:`, error);
         if (errorElement) { errorElement.textContent = "Erreur refresh photos."; errorElement.style.display = 'block'; }
     } finally { if (photoLoadingIndicator) photoLoadingIndicator.style.display = 'none'; }
}

// --- Autres Helpers (Identiques v8.1) ---
function collectFormDataWithFiles(form) { /* ... (code v8.1) ... */ }
function getQueryParam(param) { /* ... (code v8.1) ... */ }
function getCookie(name) { /* ... (code v8.1) ... */ }


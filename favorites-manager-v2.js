// favorites-manager.js (Retour à la base fonctionnelle + fix fermeture modale)
document.addEventListener('DOMContentLoaded', function () {
    console.log('[FAVORITES_ALBUM_MANAGER] DOMContentLoaded.');

    if (typeof XanoClient === 'undefined') { console.error("XanoClient non défini."); return; }
    if (typeof getCookie !== 'function') { console.error("getCookie non défini."); return; }

    const FAVORITES_API_BASE_URL = 'https://xwxl-obyg-b3e3.p7.xano.io/api:7u3_oKu9';
    const favoritesXanoClient = new XanoClient({ apiGroupBaseUrl: FAVORITES_API_BASE_URL });
    let authToken = getCookie('xano_auth_token');

    function updateAuthToken() {
        authToken = getCookie('xano_auth_token');
        favoritesXanoClient.setAuthToken(authToken || null);
    }
    updateAuthToken();

    let currentPropertyIdToSave = null;
    let currentPropertyPhotoUrlToDisplay = null;
    let userAlbums = [];
    let userFavoriteItems = new Map();

    const MODAL_ID = 'modale-favorites';
    const MODAL_VIEW_ALBUM_LIST_ID = 'modal-view-album-list';
    const MODAL_VIEW_CREATE_ALBUM_ID = 'modal-view-create-album';
    const AD_COVER_PHOTO_PREVIEW_ID = 'ad-cover-photo-preview';
    const MODAL_LISTE_ALBUMS_CONTENEUR_ID = 'modal-liste-albums-conteneur';
    const TEMPLATE_ITEM_ALBUM_MODAL_ID = 'template-item-album-modal';
    const BTN_OUVRIR_FORM_NOUVEL_ALBUM_ID = 'btn-ouvrir-form-nouvel-album';
    const BTN_RETOUR_LISTE_ALBUMS_ID = 'btn-retour-liste-albums';
    const FORM_NOUVEL_ALBUM_ID = 'form-nouvel-album';
    const INPUT_NOM_NOUVEL_ALBUM_ID = 'input-nom-nouvel-album';
    const INPUT_DESC_NOUVEL_ALBUM_ID = 'input-desc-nouvel-album';
    const BTN_SUBMIT_NOUVEL_ALBUM_ID = 'btn-submit-nouvel-album';
    const MESSAGE_MODAL_ALBUMS_ID = 'message-modal-albums';
    const HIDDEN_FINSWEET_MODAL_TRIGGER_ID = 'hidden-finsweet-album-trigger';
    const DEFAULT_ALBUM_NAME = "Mes Favoris"; // Assurez-vous qu'elle est définie si utilisée

    // ---> VÉRIFIEZ CE SÉLECTEUR <---
    const FINSWEET_MODAL_CLOSE_ATTRIBUTE_SELECTOR = '[fs-modal-element="close-4"]';

    const modalElement = document.getElementById(MODAL_ID);
    const modalViewAlbumList = document.getElementById(MODAL_VIEW_ALBUM_LIST_ID);
    const modalViewCreateAlbum = document.getElementById(MODAL_VIEW_CREATE_ALBUM_ID);
    const adCoverPhotoPreviewElement = document.getElementById(AD_COVER_PHOTO_PREVIEW_ID);
    const modalListeAlbumsConteneur = document.getElementById(MODAL_LISTE_ALBUMS_CONTENEUR_ID);
    const templateItemAlbumModal = document.getElementById(TEMPLATE_ITEM_ALBUM_MODAL_ID);
    const btnOuvrirFormNouvelAlbum = document.getElementById(BTN_OUVRIR_FORM_NOUVEL_ALBUM_ID);
    const btnRetourListeAlbums = document.getElementById(BTN_RETOUR_LISTE_ALBUMS_ID);
    const formNouvelAlbum = document.getElementById(FORM_NOUVEL_ALBUM_ID);
    const inputNomNouvelAlbum = document.getElementById(INPUT_NOM_NOUVEL_ALBUM_ID);
    const inputDescNouvelAlbum = document.getElementById(INPUT_DESC_NOUVEL_ALBUM_ID);
    const btnSubmitNouvelAlbum = document.getElementById(BTN_SUBMIT_NOUVEL_ALBUM_ID);
    const messageModalAlbums = document.getElementById(MESSAGE_MODAL_ALBUMS_ID);

    // Votre bloc de vérification d'éléments (inchangé par rapport à votre version)
    // ... (je l'omets ici pour la brièveté, mais il est dans votre script)

    function tryCloseModal(contextMessage = "") {
        if (!modalElement) {
            console.warn(`[FAVORITES_ALBUM_MANAGER] ${contextMessage}: Référence à modalElement est null.`);
            return;
        }
        const closeButton = modalElement.querySelector(FINSWEET_MODAL_CLOSE_ATTRIBUTE_SELECTOR);
        console.log(`[FAVORITES_ALBUM_MANAGER] ${contextMessage}: Tentative de fermeture. Bouton (sélecteur: ${FINSWEET_MODAL_CLOSE_ATTRIBUTE_SELECTOR}) trouvé:`, closeButton);
        if (closeButton) {
            closeButton.click();
            console.log(`[FAVORITES_ALBUM_MANAGER] ${contextMessage}: Clic sur le bouton de fermeture programmé.`);
        } else {
            console.warn(`[FAVORITES_ALBUM_MANAGER] ${contextMessage}: Bouton de fermeture Finsweet avec sélecteur "${FINSWEET_MODAL_CLOSE_ATTRIBUTE_SELECTOR}" introuvable.`);
        }
    }

    async function fetchAndStoreUserFavoriteItems() {
        updateAuthToken();
        if (!authToken) {
            userFavoriteItems.clear();
            updateAllHeartButtonsUI();
            return;
        }
        try {
            const favoriteEntries = await favoritesXanoClient.get('favorites_list');
            userFavoriteItems.clear();
            if (favoriteEntries && Array.isArray(favoriteEntries)) {
                favoriteEntries.forEach(entry => {
                    userFavoriteItems.set(entry.property_id.toString(), { // Utilisation de .toString() comme dans votre version
                        favoritesListId: entry.id,
                        albumId: entry.favorites_album_id,
                        albumName: entry.name_Album || 'Album inconnu' // Retour à entry.name_Album
                    });
                });
            }
        } catch (error) {
            console.error('[FAVORITES_ALBUM_MANAGER] Erreur lors de la récupération des items favoris:', error);
            userFavoriteItems.clear();
        }
        updateAllHeartButtonsUI();
    }

    function updateAllHeartButtonsUI() {
        document.querySelectorAll('.favorite-btn').forEach(button => {
            const propertyId = button.dataset.propertyId;
            const favoriteTextElement = button.querySelector('.favorite-text');
            if (propertyId && userFavoriteItems.has(propertyId.toString())) { // Assurer la comparaison avec une chaîne
                const favoriteInfo = userFavoriteItems.get(propertyId.toString());
                button.classList.add('is-favorited');
                if (favoriteTextElement) favoriteTextElement.textContent = 'Retirer';
                button.dataset.favoritesListId = favoriteInfo.favoritesListId;
                button.dataset.albumId = favoriteInfo.albumId;
                button.dataset.albumName = favoriteInfo.albumName;
            } else if (propertyId) {
                button.classList.remove('is-favorited');
                if (favoriteTextElement) favoriteTextElement.textContent = 'Enregistrer';
                delete button.dataset.favoritesListId;
                delete button.dataset.albumId;
                delete button.dataset.albumName;
            }
        });
    }

    function initPropertyHeartButtons() { // Retour à votre logique cloneNode
        console.log('[FAVORITES_ALBUM_MANAGER] Début de initPropertyHeartButtons.');
        const buttons = document.querySelectorAll('.favorite-btn');
        console.log(`[FAVORITES_ALBUM_MANAGER] ${buttons.length} bouton(s) '.favorite-btn' trouvés.`);

        buttons.forEach((button, index) => {
            const propertyIdFromData = button.dataset.propertyId;
            const coverPhotoUrlFromData = button.dataset.coverPhotoUrl;
            // console.log(`[FAVORITES_ALBUM_MANAGER] Traitement du bouton #${index}. data-property-id: "${propertyIdFromData}", data-cover-photo-url: "${coverPhotoUrlFromData}". Bouton:`, button); // Votre log original

            const newButton = button.cloneNode(true); // Votre logique de clonage
            if (button.parentNode) {
                button.parentNode.replaceChild(newButton, button);
            } else {
                console.warn(`[FAVORITES_ALBUM_MANAGER] Bouton #${index} n'a pas de parent.`);
            }
            const targetButton = newButton.parentNode ? newButton : button;

            targetButton.addEventListener('click', async function (event) {
                // ... (le reste de votre logique addEventListener, qui semblait correcte)
                console.log('[FAVORITES_ALBUM_MANAGER] Clic détecté. Event Target:', event.target, 'Event CurrentTarget (this):', this);
                event.preventDefault();
                event.stopPropagation();
                console.log('[FAVORITES_ALBUM_MANAGER] event.preventDefault() et event.stopPropagation() appelés.');
                
                const clickedPropertyId = this.dataset.propertyId;
                const coverPhotoUrlOnClick = this.dataset.coverPhotoUrl || null; 
                console.log('[FAVORITES_ALBUM_MANAGER] ID Propriété extrait:', clickedPropertyId, 'URL Photo au clic:', coverPhotoUrlOnClick, 'Bouton:', this);

                if (!clickedPropertyId || clickedPropertyId.trim() === "" || clickedPropertyId === "[REMPLACER_PAR_ID_ANNONCE]") {
                    console.error("ID d'annonce manquant, vide, ou placeholder. Action annulée.", this);
                    alert("Erreur: ID d'annonce manquant.");
                    return;
                }

                updateAuthToken();
                if (!authToken) {
                    alert("Veuillez vous connecter.");
                    return;
                }
                
                if (this.classList.contains('is-favorited')) {
                    const favoritesListId = this.dataset.favoritesListId;
                    const albumName = this.dataset.albumName || 'cet album';
                    if (favoritesListId) {
                        await removePropertyFromAlbum(favoritesListId, clickedPropertyId, albumName);
                    } else {
                        await fetchAndStoreUserFavoriteItems(); // Resynchroniser si l'état est incohérent
                    }
                } else {
                    currentPropertyIdToSave = clickedPropertyId;
                    currentPropertyPhotoUrlToDisplay = coverPhotoUrlOnClick; 
                    await populateModalWithAlbums();
                    showModalView(MODAL_VIEW_ALBUM_LIST_ID);
                    const hiddenTrigger = document.getElementById(HIDDEN_FINSWEET_MODAL_TRIGGER_ID);
                    if (hiddenTrigger) {
                        hiddenTrigger.click();
                    } else {
                        console.error(`Trigger caché introuvable.`);
                        if (modalElement) modalElement.style.display = 'block';
                    }
                }
            });
            // console.log(`[FAVORITES_ALBUM_MANAGER] Écouteur attaché au bouton #${index}.`); // Votre log original
        });
        updateAllHeartButtonsUI(); // Essentiel pour l'état initial
        console.log('[FAVORITES_ALBUM_MANAGER] Fin de initPropertyHeartButtons.');
    }

    // ... (Les fonctions showModalView, populateModalWithAlbums, renderAlbumListInModal restent comme dans votre version qui affichait bien les photos, avec le pixel transparent pour le placeholder)
    // ... (renderAlbumListInModal doit utiliser album.representative_photo_url et le pixel transparent)

    function showModalView(viewIdToShow) {
        if (modalViewAlbumList && modalViewCreateAlbum) {
            if (viewIdToShow === MODAL_VIEW_ALBUM_LIST_ID) {
                modalViewAlbumList.style.display = 'block';
                modalViewCreateAlbum.style.display = 'none';
            } else if (viewIdToShow === MODAL_VIEW_CREATE_ALBUM_ID) {
                modalViewAlbumList.style.display = 'none';
                modalViewCreateAlbum.style.display = 'block';
                if (adCoverPhotoPreviewElement) {
                    if (currentPropertyPhotoUrlToDisplay && currentPropertyPhotoUrlToDisplay !== "URL_DE_LA_PHOTO_DE_COUVERTURE" && !String(currentPropertyPhotoUrlToDisplay).includes("undefined") && String(currentPropertyPhotoUrlToDisplay).startsWith("http")) {
                        adCoverPhotoPreviewElement.src = currentPropertyPhotoUrlToDisplay;
                        adCoverPhotoPreviewElement.style.display = 'block'; 
                    } else {
                        adCoverPhotoPreviewElement.style.display = 'none';
                    }
                }
                if(inputNomNouvelAlbum) {
                    inputNomNouvelAlbum.value = ''; // Vider le champ
                    inputNomNouvelAlbum.focus();
                }
                if(inputDescNouvelAlbum) inputDescNouvelAlbum.value = '';
                if(btnSubmitNouvelAlbum && inputNomNouvelAlbum) btnSubmitNouvelAlbum.disabled = !inputNomNouvelAlbum.value.trim();
            }
        } else {
             console.error("[FAVORITES_ALBUM_MANAGER] `modalViewAlbumList` ou `modalViewCreateAlbum` est null.");
        }
    }

    async function populateModalWithAlbums() {
        if (!modalElement || !modalListeAlbumsConteneur || !messageModalAlbums) { return; }
        messageModalAlbums.textContent = 'Chargement...';
        messageModalAlbums.style.display = 'block';
        modalListeAlbumsConteneur.innerHTML = '';
        if (modalViewCreateAlbum) modalViewCreateAlbum.style.display = 'none';
        if (modalViewAlbumList) modalViewAlbumList.style.display = 'block';
        updateAuthToken();
        if (!authToken) {
            messageModalAlbums.textContent = "Veuillez vous connecter.";
            if(btnOuvrirFormNouvelAlbum) btnOuvrirFormNouvelAlbum.style.display = 'none';
            return;
        }
        if(btnOuvrirFormNouvelAlbum) btnOuvrirFormNouvelAlbum.style.display = '';
        try {
            const albumsResponse = await favoritesXanoClient.get('favorites_album');
            userAlbums = (Array.isArray(albumsResponse)) ? albumsResponse : (albumsResponse && Array.isArray(albumsResponse.items)) ? albumsResponse.items : [];
            console.log('[FAVORITES_ALBUM_MANAGER] Données des albums reçues pour la modale:', JSON.stringify(userAlbums, null, 2));
            renderAlbumListInModal(userAlbums);
        } catch (error) {
            messageModalAlbums.textContent = "Erreur chargement albums.";
            console.error("[FAVORITES_ALBUM_MANAGER] Erreur populateModalWithAlbums:", error);
        }
    }

    function renderAlbumListInModal(albums) {
        if (!modalListeAlbumsConteneur || !templateItemAlbumModal) {
             if (messageModalAlbums) messageModalAlbums.textContent = "Erreur d'affichage des albums (template/conteneur manquant).";
             return;
        }
        modalListeAlbumsConteneur.innerHTML = '';

        if (albums.length === 0) {
            if (messageModalAlbums) {
                messageModalAlbums.textContent = "Vous n'avez aucun album. Créez-en un !";
                messageModalAlbums.style.display = 'block';
            }
        } else {
            if (messageModalAlbums) messageModalAlbums.style.display = 'none';
            albums.forEach(album => {
                const clone = templateItemAlbumModal.cloneNode(true);
                clone.removeAttribute('id');
                clone.style.display = 'flex'; 

                const nameElement = clone.querySelector('[data-album-name]');
                if (nameElement) nameElement.textContent = album.name_Album || 'Album sans nom';
                
                const coverImgElement = clone.querySelector('[data-album-cover-img="true"]');
                if (coverImgElement) {
                    if (album.representative_photo_url && typeof album.representative_photo_url === 'string' && album.representative_photo_url.startsWith("http")) {
                        coverImgElement.src = album.representative_photo_url;
                        coverImgElement.alt = `Couverture de l'album ${album.name_Album || ''}`;
                        coverImgElement.style.backgroundColor = 'transparent';
                        coverImgElement.style.display = ''; 
                    } else {
                        coverImgElement.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'; 
                        coverImgElement.alt = `L'album ${album.name_Album || 'sans nom'} n'a pas de photo de couverture`; 
                        coverImgElement.style.backgroundColor = '#E0E0E0'; // Gris clair, ou votre couleur
                    }
                } else {
                    console.warn(`[RENDER_ALBUM_LIST] Élément img [data-album-cover-img="true"] non trouvé dans le template pour l'album ID: ${album.id}`);
                }

                clone.dataset.albumId = album.id;
                clone.dataset.albumName = album.name_Album; 
                clone.addEventListener('click', async function () {
                    await savePropertyToAlbum(currentPropertyIdToSave, this.dataset.albumId, this.dataset.albumName);
                });
                modalListeAlbumsConteneur.appendChild(clone);
            });
        }
        if (btnOuvrirFormNouvelAlbum) btnOuvrirFormNouvelAlbum.style.display = '';
    }


    async function savePropertyToAlbum(propertyId, albumId, albumName) {
        if (!propertyId || !albumId) {
            console.warn("[FAVORITES_ALBUM_MANAGER] ID de propriété ou d'album manquant.", {propertyId, albumId});
            return;
        }
        // console.log(`[savePropertyToAlbum] Tentative de sauvegarde: P_ID=${propertyId}, A_ID=${albumId}, A_Name=${albumName}`); // Votre log original

        const payload = {
            favorites_album_id: parseInt(albumId),
            property_id: parseInt(propertyId)
            // user_id est géré par Xano via le token
        };

        if (currentPropertyPhotoUrlToDisplay && typeof currentPropertyPhotoUrlToDisplay === 'string' && currentPropertyPhotoUrlToDisplay.startsWith("http")) {
            payload.property_photo_url_for_cover = currentPropertyPhotoUrlToDisplay;
            // console.log('[FAVORITES_ALBUM_MANAGER] Envoi de property_photo_url_for_cover:', currentPropertyPhotoUrlToDisplay); // Votre log
        }

        try {
            const newFavoriteEntry = await favoritesXanoClient.post('favorites_list', payload); 

            if (newFavoriteEntry && newFavoriteEntry.id) {
                userFavoriteItems.set(String(newFavoriteEntry.property_id), { // S'assurer que property_id est une chaîne
                    favoritesListId: newFavoriteEntry.id,
                    albumId: newFavoriteEntry.favorites_album_id,
                    albumName: albumName || 'Album inconnu'
                });
                updateAllHeartButtonsUI();
                triggerSaveAnimation(`Enregistré dans ${albumName || DEFAULT_ALBUM_NAME}`); // Utilisation de DEFAULT_ALBUM_NAME
                currentPropertyIdToSave = null;
                currentPropertyPhotoUrlToDisplay = null; 
                
                // ---> MODIFICATION : Appel à tryCloseModal <---
                tryCloseModal("savePropertyToAlbum");

            } else { throw new Error("Réponse serveur invalide lors de l'ajout aux favoris."); }
        } catch (error) { 
            console.error("[FAVORITES_ALBUM_MANAGER] Erreur dans savePropertyToAlbum:", error); // Log original
            alert(`Erreur sauvegarde: ${error.message}`); 
        }
    }

    async function removePropertyFromAlbum(favoritesListId, propertyId, albumName) {
        // (Votre code removePropertyFromAlbum - inchangé)
        console.log(`[removePropertyFromAlbum] Tentative de suppression: FavList_ID=${favoritesListId}, P_ID=${propertyId}`);
        try {
            await favoritesXanoClient.delete(`favorites_list/${favoritesListId}`);
            userFavoriteItems.delete(propertyId.toString());
            updateAllHeartButtonsUI();
            triggerSaveAnimation(`Supprimé de ${albumName}`);
        } catch (error) {
            console.error("Erreur dans removePropertyFromAlbum:", error);
            alert(`Erreur suppression: ${error.message}`);
            await fetchAndStoreUserFavoriteItems();
        }
    }

    async function createAlbum(nomAlbum, descAlbum, /* suppressReloadAndSwitch = false -- retiré, non utilisé */) {
        // (Votre code createAlbum - inchangé)
        updateAuthToken();
        if (!authToken) { alert("Veuillez vous connecter."); return null; }
        try {
            const newAlbum = await favoritesXanoClient.post('favorites_album', {
                name_Album: nomAlbum, description_album: descAlbum
            });
            if (newAlbum && newAlbum.id) {
                // La logique de rechargement/changement de vue est gérée par l'appelant si besoin
                return newAlbum; 
            } else { throw new Error("Réponse serveur invalide (création album)."); }
        } catch (error) {
            console.error("Erreur dans createAlbum:", error);
            alert(`Erreur création album: ${error.message}`);
            return null;
        }
    }

    if (formNouvelAlbum && btnSubmitNouvelAlbum && inputNomNouvelAlbum) {
        inputNomNouvelAlbum.addEventListener('input', function() {
            if (btnSubmitNouvelAlbum) btnSubmitNouvelAlbum.disabled = !this.value.trim();
        });
        formNouvelAlbum.addEventListener('submit', async function(event) {
            event.preventDefault(); 
            // console.log('[FAVORITES_ALBUM_MANAGER] Soumission du formulaire de création interceptée.'); // Votre log
            const nomAlbum = inputNomNouvelAlbum.value.trim();
            const descAlbum = inputDescNouvelAlbum ? inputDescNouvelAlbum.value.trim() : "";
            if (!nomAlbum) { alert("Nom d'album requis."); return; }
            
            if (btnSubmitNouvelAlbum) btnSubmitNouvelAlbum.disabled = true;

            try {
                // Le 'true' pour suppressReloadAndSwitch est implicite car createAlbum ne le gère plus
                const createdAlbum = await createAlbum(nomAlbum, descAlbum); 
                if (createdAlbum && createdAlbum.id) {
                    if (currentPropertyIdToSave) {
                        // console.log(`[FAVORITES_ALBUM_MANAGER] Album "${createdAlbum.name_Album}" créé. Ajout de l'annonce ID ${currentPropertyIdToSave}.`); // Votre log
                        await savePropertyToAlbum(currentPropertyIdToSave, createdAlbum.id, createdAlbum.name_Album);
                        // savePropertyToAlbum appellera tryCloseModal
                    } else {
                        // console.log(`[FAVORITES_ALBUM_MANAGER] Album "${createdAlbum.name_Album}" créé. Aucune annonce en attente.`); // Votre log
                        await populateModalWithAlbums(); 
                        showModalView(MODAL_VIEW_ALBUM_LIST_ID);
                        triggerSaveAnimation(`Album ${createdAlbum.name_Album} créé`); 
                        // ---> MODIFICATION : Appel à tryCloseModal <---
                        tryCloseModal("formNouvelAlbum sans item");
                    }
                    inputNomNouvelAlbum.value = ''; 
                    if (inputDescNouvelAlbum) inputDescNouvelAlbum.value = '';
                } else {
                     console.warn('[FAVORITES_ALBUM_MANAGER] La création d\'album a échoué (pas d\'album retourné par createAlbum).');
                }
            } catch(error) {
                 console.error('[FAVORITES_ALBUM_MANAGER] Erreur dans le gestionnaire de soumission du formulaire:', error);
            } finally {
                if (inputNomNouvelAlbum && btnSubmitNouvelAlbum) btnSubmitNouvelAlbum.disabled = !inputNomNouvelAlbum.value.trim();
                
                const parentFormElement = formNouvelAlbum.parentElement; // document.getElementById(FORM_NOUVEL_ALBUM_ID);
                if (parentFormElement){ // && parentFormElement.parentElement) {
                    const wfDone = parentFormElement.querySelector('.w-form-done');
                    const wfFail = parentFormElement.querySelector('.w-form-fail');
                    
                    setTimeout(() => {
                        if (wfDone) { wfDone.style.display = 'none'; /* console.log("Message .w-form-done masqué."); */ }
                        if (wfFail) { wfFail.style.display = 'none'; /* console.log("Message .w-form-fail masqué."); */ }
                    }, 150); 
                }
            }
        });
    } else {
        console.warn("[FAVORITES_ALBUM_MANAGER] Le formulaire de création d'album ou ses composants sont introuvables.");
        // if (!formNouvelAlbum) console.warn(" > formNouvelAlbum est null."); // Votre log
    }

    if (btnOuvrirFormNouvelAlbum) {
        btnOuvrirFormNouvelAlbum.addEventListener('click', () => {
            showModalView(MODAL_VIEW_CREATE_ALBUM_ID);
        });
    }

    if (btnRetourListeAlbums) {
        btnRetourListeAlbums.addEventListener('click', () => { 
            showModalView(MODAL_VIEW_ALBUM_LIST_ID);
        });
    }

    function triggerSaveAnimation(message) {
        // (Votre code triggerSaveAnimation - inchangé)
        console.log("[triggerSaveAnimation] Déclenchée avec message:", message);
        let animationElement = document.getElementById('save-confirmation-animation');

        if (!animationElement) {
            animationElement = document.createElement('div');
            animationElement.id = 'save-confirmation-animation';
            document.body.appendChild(animationElement);
        }
        Object.assign(animationElement.style, {
            position: 'fixed', top: '20px', left: '1rem', right: '1rem', width: 'auto',
            padding: '16px 20px', backgroundColor: 'rgba(18, 18, 18, 1)', color: 'white',
            borderRadius: '1rem', zIndex: '10001', fontSize: '1rem', textAlign: 'center',
            boxShadow: '0 4px 15px rgba(0,0,0,0.2)', opacity: '0', transform: 'translateY(-200%)',
            transition: 'opacity 0.3s ease-in-out, transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
        });
        animationElement.textContent = message;
        void animationElement.offsetWidth; 
        setTimeout(() => {
            animationElement.style.opacity = '1';
            animationElement.style.transform = 'translateY(0)';
        }, 50);
        setTimeout(() => {
            animationElement.style.opacity = '0';
            animationElement.style.transform = 'translateY(-200%)';
        }, 2500);
    }

    // Initialisation
    (async () => {
        await fetchAndStoreUserFavoriteItems();
        initPropertyHeartButtons(); 
    })();

    document.addEventListener('annoncesChargeesEtRendues', async function() {
        console.log('[FAVORITES_ALBUM_MANAGER] Événement "annoncesChargeesEtRendues" reçu.');
        setTimeout(() => {
            console.log('[FAVORITES_ALBUM_MANAGER] Exécution différée de initPropertyHeartButtons après annoncesChargeesEtRendues.');
            initPropertyHeartButtons(); // Le clonage dans initPropertyHeartButtons devrait gérer les nouveaux éléments
        }, 100);
    });

    document.addEventListener('authStateChanged', async function(event) { //
        updateAuthToken(); 
        await fetchAndStoreUserFavoriteItems(); 
        // Le reste de votre logique authStateChanged
        if (!authToken && modalElement && (modalElement.style.display !== 'none' && modalElement.style.display !== '')) {
            tryCloseModal("authStateChanged déconnexion");
            alert("Vous avez été déconnecté.");
        } else if (authToken && modalElement && (modalElement.style.display !== 'none' && modalElement.style.display !== '')) {
            await populateModalWithAlbums();
        }
    });
    
    console.log("[FAVORITES_ALBUM_MANAGER] Script initialisé.");
});

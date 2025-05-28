// favorites-manager.js (avec améliorations UX et debug timing)
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
    const DEFAULT_ALBUM_NAME = "Mes Favoris";
    const HIDDEN_FINSWEET_MODAL_TRIGGER_ID = 'hidden-finsweet-album-trigger';

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

    // Vérification initiale détaillée
    let allElementsFoundCheck = true;
    const elementsToVerify = [
        { name: 'modalElement', el: modalElement, id: MODAL_ID },
        { name: 'modalViewAlbumList', el: modalViewAlbumList, id: MODAL_VIEW_ALBUM_LIST_ID },
        { name: 'modalViewCreateAlbum', el: modalViewCreateAlbum, id: MODAL_VIEW_CREATE_ALBUM_ID },
        { name: 'modalListeAlbumsConteneur', el: modalListeAlbumsConteneur, id: MODAL_LISTE_ALBUMS_CONTENEUR_ID },
        { name: 'btnOuvrirFormNouvelAlbum', el: btnOuvrirFormNouvelAlbum, id: BTN_OUVRIR_FORM_NOUVEL_ALBUM_ID },
        { name: 'formNouvelAlbum', el: formNouvelAlbum, id: FORM_NOUVEL_ALBUM_ID }, // Crucial
        { name: 'inputNomNouvelAlbum', el: inputNomNouvelAlbum, id: INPUT_NOM_NOUVEL_ALBUM_ID },
        { name: 'btnSubmitNouvelAlbum', el: btnSubmitNouvelAlbum, id: BTN_SUBMIT_NOUVEL_ALBUM_ID },
        { name: 'messageModalAlbums', el: messageModalAlbums, id: MESSAGE_MODAL_ALBUMS_ID },
        { name: 'btnRetourListeAlbums', el: btnRetourListeAlbums, id: BTN_RETOUR_LISTE_ALBUMS_ID }
    ];
    if (!adCoverPhotoPreviewElement) {
        console.warn(`[FAVORITES_ALBUM_MANAGER] L'élément pour l'aperçu photo (ID: "${AD_COVER_PHOTO_PREVIEW_ID}") est introuvable. L'aperçu ne s'affichera pas.`);
    }
    for (const item of elementsToVerify) {
        if (!item.el) {
            console.error(`[FAVORITES_ALBUM_MANAGER] ÉLÉMENT INTROUVABLE: ${item.name} (ID attendu: "${item.id}"). Vérifiez votre HTML.`);
            allElementsFoundCheck = false;
        }
    }
    if (!templateItemAlbumModal) {
        console.warn(`[FAVORITES_ALBUM_MANAGER] Template pour les items d'album (ID: "${TEMPLATE_ITEM_ALBUM_MODAL_ID}") introuvable.`);
    }
    if (!allElementsFoundCheck) {
        console.error("[FAVORITES_ALBUM_MANAGER] Au moins un élément clé est manquant. Le script risque de ne pas fonctionner correctement.");
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
                    userFavoriteItems.set(entry.property_id.toString(), {
                        favoritesListId: entry.id,
                        albumId: entry.favorites_album_id,
                        albumName: entry.name_Album || 'Album inconnu'
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
            if (propertyId && userFavoriteItems.has(propertyId)) {
                const favoriteInfo = userFavoriteItems.get(propertyId);
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

    function initPropertyHeartButtons() {
        console.log('[FAVORITES_ALBUM_MANAGER] Début de initPropertyHeartButtons.');
        const buttons = document.querySelectorAll('.favorite-btn');
        console.log(`[FAVORITES_ALBUM_MANAGER] ${buttons.length} bouton(s) '.favorite-btn' trouvés.`);

        buttons.forEach((button, index) => {
            const propertyIdFromData = button.dataset.propertyId;
            const coverPhotoUrlFromData = button.dataset.coverPhotoUrl; 
            console.log(`[FAVORITES_ALBUM_MANAGER] Traitement du bouton #${index}. data-property-id: "${propertyIdFromData}", data-cover-photo-url: "${coverPhotoUrlFromData}". Bouton:`, button);

            const newButton = button.cloneNode(true);
            if (button.parentNode) {
                button.parentNode.replaceChild(newButton, button);
            } else {
                console.warn(`[FAVORITES_ALBUM_MANAGER] Bouton #${index} n'a pas de parent.`);
            }
            const targetButton = newButton.parentNode ? newButton : button;

            targetButton.addEventListener('click', async function (event) {
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
                        await fetchAndStoreUserFavoriteItems();
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
            console.log(`[FAVORITES_ALBUM_MANAGER] Écouteur attaché au bouton #${index}.`);
        });
        updateAllHeartButtonsUI();
        console.log('[FAVORITES_ALBUM_MANAGER] Fin de initPropertyHeartButtons.');
    }

    function showModalView(viewIdToShow) {
        if (modalViewAlbumList && modalViewCreateAlbum) {
            if (viewIdToShow === MODAL_VIEW_ALBUM_LIST_ID) {
                modalViewAlbumList.style.display = 'block';
                modalViewCreateAlbum.style.display = 'none';
            } else if (viewIdToShow === MODAL_VIEW_CREATE_ALBUM_ID) {
                modalViewAlbumList.style.display = 'none';
                modalViewCreateAlbum.style.display = 'block';
                if (adCoverPhotoPreviewElement) {
                    console.log("[FAVORITES_ALBUM_MANAGER] Tentative d'affichage de l'aperçu photo. URL à utiliser:", currentPropertyPhotoUrlToDisplay);
                    if (currentPropertyPhotoUrlToDisplay && currentPropertyPhotoUrlToDisplay !== "URL_DE_LA_PHOTO_DE_COUVERTURE" && !currentPropertyPhotoUrlToDisplay.includes("undefined") && currentPropertyPhotoUrlToDisplay.startsWith("http")) {
                        adCoverPhotoPreviewElement.src = currentPropertyPhotoUrlToDisplay;
                        adCoverPhotoPreviewElement.style.display = 'block'; 
                         console.log("[FAVORITES_ALBUM_MANAGER] Aperçu photo affiché avec src:", currentPropertyPhotoUrlToDisplay);
                    } else {
                        adCoverPhotoPreviewElement.style.display = 'none';
                        console.warn("[FAVORITES_ALBUM_MANAGER] Aperçu photo non affiché. currentPropertyPhotoUrlToDisplay:", currentPropertyPhotoUrlToDisplay);
                    }
                } else {
                     console.warn("Élément adCoverPhotoPreviewElement introuvable pour afficher l'aperçu.");
                }
                if(inputNomNouvelAlbum) inputNomNouvelAlbum.focus();
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
            renderAlbumListInModal(userAlbums);
        } catch (error) {
            messageModalAlbums.textContent = "Erreur chargement albums.";
        }
    }

    // MODIFIÉ pour afficher la photo de couverture de l'album
    // Dans favorites-manager-v2.js

function renderAlbumListInModal(albums) {
    if (!modalListeAlbumsConteneur || !templateItemAlbumModal) {
         if (messageModalAlbums) messageModalAlbums.textContent = "Erreur d'affichage des albums (template/conteneur manquant).";
         console.error("Conteneur de liste d'albums ou template d'item manquant.");
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
            clone.style.display = 'flex'; // Ou le style d'affichage de vos items

            const nameElement = clone.querySelector('[data-album-name]');
            if (nameElement) nameElement.textContent = album.name_Album || 'Album sans nom';
            
            const coverImgElement = clone.querySelector('[data-album-cover-img="true"]');
            if (coverImgElement) {
                // 'representative_photo_url' est le champ que Xano doit fournir pour la couverture de l'album
                if (album.representative_photo_url && typeof album.representative_photo_url === 'string' && album.representative_photo_url.startsWith("http")) {
                    coverImgElement.src = album.representative_photo_url;
                    coverImgElement.alt = `Couverture de l'album ${album.name_Album || ''}`;
                    coverImgElement.style.backgroundColor = 'transparent'; // Réinitialiser le fond si une image est chargée
                    coverImgElement.style.display = ''; // Assurez-vous qu'il est visible si précédemment caché
                } else {
                    // Pas de photo de couverture : afficher un placeholder visuel (carré gris).
                    coverImgElement.src = ''; // TRÈS IMPORTANT : pour éviter l'icône d'image cassée.
                    
                    // L'attribut 'alt' est pour l'accessibilité (lecteurs d'écran).
                    // Il n'est généralement pas affiché visuellement si l'image ne se charge pas à la place de l'image.
                    // Un 'alt' descriptif est une bonne pratique. S'il doit être vide, utilisez alt="".
                    coverImgElement.alt = `Placeholder pour l'album ${album.name_Album || 'sans nom'}`;
                    
                    coverImgElement.style.backgroundColor = '#CCCCCC'; // Votre couleur grise pour le placeholder.
                    
                    // Assurez-vous que votre CSS pour [data-album-cover-img="true"] définit bien
                    // une largeur et une hauteur (width, height) pour que le carré gris soit visible.
                    // Si ce n'est pas le cas, vous pourriez les définir ici, par exemple :
                    // coverImgElement.style.width = '50px'; // Remplacez par la taille désirée
                    // coverImgElement.style.height = '50px'; // Remplacez par la taille désirée
                    // coverImgElement.style.display = 'block'; // Ou 'inline-block', selon votre mise en page.

                    console.warn(`[RENDER_ALBUM_LIST] Pas de representative_photo_url pour l'album ID: ${album.id} (${album.name_Album}). Affichage du placeholder gris.`);
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
        console.warn("[savePropertyToAlbum] ID de propriété ou d'album manquant.", {propertyId, albumId});
        return;
    }
    console.log(`[savePropertyToAlbum] Tentative de sauvegarde: P_ID=<span class="math-inline">\{propertyId\}, A\_ID\=</span>{albumId}, A_Name=${albumName}`);

    const payload = {
        favorites_album_id: parseInt(albumId),
        property_id: parseInt(propertyId)
    };

    // NOUVEAU : Envoyer l'URL de la photo de la propriété actuelle
    // Xano décidera si cette URL doit être utilisée comme couverture de l'album.
    if (currentPropertyPhotoUrlToDisplay && typeof currentPropertyPhotoUrlToDisplay === 'string' && currentPropertyPhotoUrlToDisplay.startsWith("http")) {
        payload.property_photo_url_for_cover = currentPropertyPhotoUrlToDisplay; // Nom de champ à définir côté Xano
        console.log('[FAVORITES_ALBUM_MANAGER] Envoi de property_photo_url_for_cover:', currentPropertyPhotoUrlToDisplay);
    }

    try {
        // Assurez-vous que le nom de l'endpoint est correct, ici 'favorites_list'
        const newFavoriteEntry = await favoritesXanoClient.post('favorites_list', payload); 

        if (newFavoriteEntry && newFavoriteEntry.id) {
            userFavoriteItems.set(newFavoriteEntry.property_id.toString(), {
                favoritesListId: newFavoriteEntry.id,
                albumId: newFavoriteEntry.favorites_album_id,
                albumName: albumName || 'cet album'
                // Note : La `representative_photo_url` de l'album sera mise à jour côté Xano.
                // Il faudra peut-être rafraîchir `userAlbums` ou faire un nouveau `populateModalWithAlbums`
                // si la modale reste ouverte et que l'on veut voir la nouvelle cover immédiatement.
                // Actuellement, la modale se ferme, donc au prochain affichage, elle sera à jour.
            });
            updateAllHeartButtonsUI();
            triggerSaveAnimation(`Enregistré dans ${albumName || DEFAULT_ALBUM_NAME}`);
            currentPropertyIdToSave = null;
            currentPropertyPhotoUrlToDisplay = null; // Réinitialiser après utilisation
            const closeButton = modalElement ? modalElement.querySelector('[fs-modal-element="close-4"]') : null;
            if (closeButton) closeButton.click();
            else console.warn("Bouton fermeture Finsweet introuvable.");
        } else { throw new Error("Réponse serveur invalide lors de l'ajout aux favoris."); }
    } catch (error) { 
        console.error("Erreur dans savePropertyToAlbum:", error);
        alert(`Erreur sauvegarde: ${error.message}`); 
    }
}

    async function removePropertyFromAlbum(favoritesListId, propertyId, albumName) {
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

    async function createAlbum(nomAlbum, descAlbum, suppressReloadAndSwitch = false) {
        updateAuthToken();
        if (!authToken) { alert("Veuillez vous connecter."); return null; }
        try {
            const newAlbum = await favoritesXanoClient.post('favorites_album', {
                name_Album: nomAlbum, description_album: descAlbum
            });
            if (newAlbum && newAlbum.id) {
                if (!suppressReloadAndSwitch) {
                    await populateModalWithAlbums(); 
                    showModalView(MODAL_VIEW_ALBUM_LIST_ID); 
                }
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
            console.log('[FAVORITES_ALBUM_MANAGER] Soumission du formulaire de création interceptée.');
            const nomAlbum = inputNomNouvelAlbum.value.trim();
            const descAlbum = inputDescNouvelAlbum ? inputDescNouvelAlbum.value.trim() : "";
            if (!nomAlbum) { alert("Nom d'album requis."); return; }
            if (btnSubmitNouvelAlbum) btnSubmitNouvelAlbum.disabled = true;
            try {
                const createdAlbum = await createAlbum(nomAlbum, descAlbum, true); 
                if (createdAlbum && createdAlbum.id) {
                    if (currentPropertyIdToSave) {
                        console.log(`[FAVORITES_ALBUM_MANAGER] Album "${createdAlbum.name_Album}" créé. Ajout de l'annonce ID ${currentPropertyIdToSave}.`);
                        await savePropertyToAlbum(currentPropertyIdToSave, createdAlbum.id, createdAlbum.name_Album);
                    } else {
                        console.log(`[FAVORITES_ALBUM_MANAGER] Album "${createdAlbum.name_Album}" créé. Aucune annonce en attente.`);
                        await populateModalWithAlbums(); 
                        showModalView(MODAL_VIEW_ALBUM_LIST_ID);
                        triggerSaveAnimation(`Album ${createdAlbum.name_Album} créé`); 
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
                
                const parentFormElement = document.getElementById(FORM_NOUVEL_ALBUM_ID);
                if (parentFormElement && parentFormElement.parentElement) {
                    const wfDone = parentFormElement.parentElement.querySelector('.w-form-done');
                    const wfFail = parentFormElement.parentElement.querySelector('.w-form-fail');
                    
                    setTimeout(() => {
                        if (wfDone) { wfDone.style.display = 'none'; console.log("Message .w-form-done masqué."); }
                        if (wfFail) { wfFail.style.display = 'none'; console.log("Message .w-form-fail masqué."); }
                    }, 150); 
                }
            }
        });
    } else {
        console.warn("[FAVORITES_ALBUM_MANAGER] Le formulaire de création d'album ou ses composants sont introuvables.");
        if (!formNouvelAlbum) console.warn(" > formNouvelAlbum est null.");
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
    console.log("[triggerSaveAnimation] Déclenchée avec message:", message);
    let animationElement = document.getElementById('save-confirmation-animation');

    if (!animationElement) {
        animationElement = document.createElement('div');
        animationElement.id = 'save-confirmation-animation';
        document.body.appendChild(animationElement);
        console.log("[triggerSaveAnimation] Élément d'animation créé et ajouté au body.");
    }

    // Styles pour la nouvelle animation (bannière en haut)
    Object.assign(animationElement.style, {
        position: 'fixed',
        top: '20px', // Distance du haut de la page
        left: '1rem',
        right: '1rem',
        width: 'auto', // S'ajuste grâce à left/right
        padding: '16px 20px', // Padding ajusté
        backgroundColor: 'rgba(18, 18, 18, 1)', // Fond semi-transparent
        color: 'white',
        borderRadius: '1rem',
        zIndex: '10001', // Au-dessus des autres éléments
        fontSize: '1rem',
        textAlign: 'center',
        boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
        opacity: '0', // État initial: invisible
        transform: 'translateY(-200%)', // État initial: caché au-dessus de la fenêtre
        // Transition douce pour l'opacité et la transformation (slide)
        transition: 'opacity 0.3s ease-in-out, transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)' // easeInSine pour transform
    });

    animationElement.textContent = message;
    
    // Force le reflow pour s'assurer que l'état initial est appliqué avant la transition
    void animationElement.offsetWidth; 

    // Apparition (slide down)
    setTimeout(() => {
        animationElement.style.opacity = '1';
        animationElement.style.transform = 'translateY(0)'; // Glisse à sa position finale (top: 20px)
        console.log("[triggerSaveAnimation] Animation d'apparition (slide-down).");
    }, 50); // Léger délai pour que la transition CSS s'applique

    // Disparition (slide up) après un délai
    setTimeout(() => {
        animationElement.style.opacity = '0';
        animationElement.style.transform = 'translateY(-200%)'; // Glisse vers le haut pour disparaître
        console.log("[triggerSaveAnimation] Animation de disparition (slide-up).");
    }, 2500); // L'animation reste visible pendant environ 2.45 secondes (2500 - 50)
}

    (async () => {
        await fetchAndStoreUserFavoriteItems();
        initPropertyHeartButtons(); 
    })();

    document.addEventListener('annoncesChargeesEtRendues', async function() {
        console.log('[FAVORITES_ALBUM_MANAGER] Événement "annoncesChargeesEtRendues" reçu.');
        setTimeout(() => {
            console.log('[FAVORITES_ALBUM_MANAGER] Exécution différée de initPropertyHeartButtons après annoncesChargeesEtRendues.');
            initPropertyHeartButtons();
        }, 100);
    });

    document.addEventListener('authStateChanged', async function() {
        updateAuthToken(); 
        await fetchAndStoreUserFavoriteItems(); 
        if (!authToken && modalElement && (modalElement.style.display !== 'none' && modalElement.style.display !== '')) {
            const closeButton = modalElement.querySelector('[fs-modal-element="close-4"]');
            if (closeButton) closeButton.click();
            alert("Vous avez été déconnecté.");
        } else if (authToken && modalElement && (modalElement.style.display !== 'none' && modalElement.style.display !== '')) {
            await populateModalWithAlbums();
        }
    });
    
    console.log("[FAVORITES_ALBUM_MANAGER] Script initialisé.");
});

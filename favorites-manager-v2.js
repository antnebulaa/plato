// favorites-manager.js (version basée sur votre dernier script fonctionnel, avec focus sur la fermeture de la modale)
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
    // const DEFAULT_ALBUM_NAME = "Mes Favoris"; // Déjà présent dans votre code source
    const HIDDEN_FINSWEET_MODAL_TRIGGER_ID = 'hidden-finsweet-album-trigger';

    // ---> MODIFICATION : Définir le sélecteur pour le bouton de fermeture de la modale Finsweet <---
    // Adaptez "[fs-modal-element="close-4"]" si votre modale utilise un autre identifiant/numéro.
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

    // (Votre bloc de vérification initiale des éléments DOM était ici - je le garde tel quel)
    let allElementsFoundCheck = true;
    const elementsToVerify = [
        { name: 'modalElement', el: modalElement, id: MODAL_ID },
        { name: 'modalViewAlbumList', el: modalViewAlbumList, id: MODAL_VIEW_ALBUM_LIST_ID },
        { name: 'modalViewCreateAlbum', el: modalViewCreateAlbum, id: MODAL_VIEW_CREATE_ALBUM_ID },
        { name: 'modalListeAlbumsConteneur', el: modalListeAlbumsConteneur, id: MODAL_LISTE_ALBUMS_CONTENEUR_ID },
        { name: 'btnOuvrirFormNouvelAlbum', el: btnOuvrirFormNouvelAlbum, id: BTN_OUVRIR_FORM_NOUVEL_ALBUM_ID },
        { name: 'formNouvelAlbum', el: formNouvelAlbum, id: FORM_NOUVEL_ALBUM_ID },
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
        // return; // Peut-être décommenter si vous voulez stopper ici en cas de problème critique
    }

    // ---> MODIFICATION : Fonction utilitaire pour tenter de fermer la modale <---
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
                    userFavoriteItems.set(String(entry.property_id), { // S'assurer que property_id est une chaîne
                        favoritesListId: entry.id,
                        albumId: entry.favorites_album_id,
                        // Essayer de récupérer le nom de l'album, par ex. si Xano fait un join (addon)
                        albumName: entry._favorites_album?.name_Album || entry.name_Album || 'Album inconnu'
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
            if (propertyId && userFavoriteItems.has(String(propertyId))) {
                const favoriteInfo = userFavoriteItems.get(String(propertyId));
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
            // Cloner et remplacer pour potentiellement nettoyer les anciens écouteurs,
            // bien que la méthode dataset.listenerAttached soit plus ciblée.
            // Si vous n'avez pas de problèmes d'écouteurs multiples, cette partie cloneNode peut être superflue.
            const propertyIdFromData = button.dataset.propertyId; // Garder les data-* originaux
            const coverPhotoUrlFromData = button.dataset.coverPhotoUrl;

            // Pour éviter d'attacher plusieurs fois l'écouteur
            if (button.dataset.listenerAttached === 'true' && !button.classList.contains('js-needs-rebind')) { //
                return;
            }
            button.dataset.listenerAttached = 'true';
            button.classList.remove('js-needs-rebind');


            // Votre logique de clonage de bouton était ici, je la remets si elle était importante pour votre cas.
             Sinon, on peut l'enlever si dataset.listenerAttached suffit.
             const newButton = button.cloneNode(true);
             if (button.parentNode) {
                 button.parentNode.replaceChild(newButton, button);
             } else {
                 console.warn(`[FAVORITES_ALBUM_MANAGER] Bouton #${index} n'a pas de parent.`);
             }
             const targetButton = newButton.parentNode ? newButton : button; // Utiliser le bouton (nouveau ou original)

            // Utiliser 'button' directement si le clonage n'est pas strictement nécessaire
            const targetButton = button;

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
                        if (modalElement) modalElement.style.display = 'block'; // Fallback
                    }
                }
            });
            // console.log(`[FAVORITES_ALBUM_MANAGER] Écouteur attaché au bouton #${index}.`); // Moins de logs ici
        });
        updateAllHeartButtonsUI();
        console.log('[FAVORITES_ALBUM_MANAGER] Fin de initPropertyHeartButtons.');
    }

    function showModalView(viewIdToShow) {
        // (Votre code showModalView - inchangé car il semblait fonctionner)
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
                    inputNomNouvelAlbum.value = ''; // Vider pour nouvelle saisie
                    inputNomNouvelAlbum.focus();
                }
                if(inputDescNouvelAlbum) inputDescNouvelAlbum.value = ''; // Vider pour nouvelle saisie
                if(btnSubmitNouvelAlbum && inputNomNouvelAlbum) btnSubmitNouvelAlbum.disabled = !inputNomNouvelAlbum.value.trim();
            }
        } else {
             console.error("[FAVORITES_ALBUM_MANAGER] `modalViewAlbumList` ou `modalViewCreateAlbum` est null.");
        }
    }

    async function populateModalWithAlbums() {
        // (Votre code populateModalWithAlbums - avec le log JSON.stringify que nous avions ajouté)
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
            console.log('[FAVORITES_ALBUM_MANAGER] Données des albums reçues pour la modale:', JSON.stringify(userAlbums, null, 2)); // Garder ce log
            renderAlbumListInModal(userAlbums);
        } catch (error) {
            messageModalAlbums.textContent = "Erreur chargement albums.";
            console.error("[FAVORITES_ALBUM_MANAGER] Erreur populateModalWithAlbums:", error);
        }
    }

    function renderAlbumListInModal(albums) {
        // (Votre code renderAlbumListInModal avec le fix du pixel transparent - inchangé)
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
                        coverImgElement.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'; // Pixel transparent
                        coverImgElement.alt = `L'album ${album.name_Album || 'sans nom'} n'a pas de photo de couverture`;
                        coverImgElement.style.backgroundColor = '#E0E0E0'; // Gris clair
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
        // (Votre code savePropertyToAlbum - avec l'appel à tryCloseModal et la gestion user_id par Xano)
        if (!propertyId || !albumId) {
            console.warn("[FAVORITES_ALBUM_MANAGER] ID de propriété ou d'album manquant.", {propertyId, albumId});
            return;
        }
        // console.log(`[savePropertyToAlbum] Tentative de sauvegarde: P_ID=${propertyId}, A_ID=${albumId}, A_Name=${albumName}`); // Votre log original

        const payload = {
            favorites_album_id: parseInt(albumId),
            property_id: parseInt(propertyId)
            // user_id est maintenant géré par Xano via le token d'authentification
        };

        if (currentPropertyPhotoUrlToDisplay && typeof currentPropertyPhotoUrlToDisplay === 'string' && currentPropertyPhotoUrlToDisplay.startsWith("http")) {
            payload.property_photo_url_for_cover = currentPropertyPhotoUrlToDisplay;
            // console.log('[FAVORITES_ALBUM_MANAGER] Envoi de property_photo_url_for_cover:', currentPropertyPhotoUrlToDisplay); // Votre log original
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
                triggerSaveAnimation(`Enregistré dans ${albumName || "cet album"}`); // Message cohérent
                currentPropertyIdToSave = null;
                currentPropertyPhotoUrlToDisplay = null;
                
                // ---> MODIFICATION : Utiliser la fonction tryCloseModal <---
                tryCloseModal("savePropertyToAlbum");

            } else { throw new Error("Réponse serveur invalide lors de l'ajout aux favoris."); }
        } catch (error) { 
            console.error("[FAVORITES_ALBUM_MANAGER] Erreur dans savePropertyToAlbum:", error);
            alert(`Erreur sauvegarde: ${error.message}`); 
        }
    }

    async function removePropertyFromAlbum(favoritesListId, propertyId, albumName) {
        // (Votre code removePropertyFromAlbum - inchangé)
        console.log(`[removePropertyFromAlbum] Tentative de suppression: FavList_ID=${favoritesListId}, P_ID=${propertyId}`);
        try {
            await favoritesXanoClient.delete(`favorites_list/${favoritesListId}`);
            userFavoriteItems.delete(String(propertyId)); // S'assurer que property_id est une chaîne
            updateAllHeartButtonsUI();
            triggerSaveAnimation(`Supprimé de ${albumName}`);
        } catch (error) {
            console.error("Erreur dans removePropertyFromAlbum:", error);
            alert(`Erreur suppression: ${error.message}`);
            await fetchAndStoreUserFavoriteItems();
        }
    }

    async function createAlbum(nomAlbum, descAlbum) {
        // (Votre code createAlbum - inchangé, car la cover est gérée par savePropertyToAlbum)
        updateAuthToken();
        if (!authToken) { alert("Veuillez vous connecter."); return null; }
        try {
            const newAlbum = await favoritesXanoClient.post('favorites_album', {
                name_Album: nomAlbum, description_album: descAlbum
            });
            if (newAlbum && newAlbum.id) {
                return newAlbum; 
            } else { throw new Error("Réponse serveur invalide (création album)."); }
        } catch (error) {
            console.error("Erreur dans createAlbum:", error);
            alert(`Erreur création album: ${error.message}`);
            return null;
        }
    }

    if (formNouvelAlbum && btnSubmitNouvelAlbum && inputNomNouvelAlbum) {
        // (Votre code pour le formNouvelAlbum submit - avec l'appel à tryCloseModal)
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
                        // ---> MODIFICATION : Utiliser la fonction tryCloseModal <---
                        tryCloseModal("formNouvelAlbum sans item en attente");
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
                if (parentFormElement) { // && parentFormElement.parentElement) { // Correction ici si parentFormElement est déjà le form
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
    }

    if (btnOuvrirFormNouvelAlbum) {
        // (Votre code btnOuvrirFormNouvelAlbum - inchangé)
        btnOuvrirFormNouvelAlbum.addEventListener('click', () => {
            showModalView(MODAL_VIEW_CREATE_ALBUM_ID);
        });
    }

    if (btnRetourListeAlbums) {
        // (Votre code btnRetourListeAlbums - inchangé)
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
        // (Votre code d'initialisation - inchangé)
        await fetchAndStoreUserFavoriteItems();
        initPropertyHeartButtons(); 
    })();

    // Écouteurs d'événements
    document.addEventListener('annoncesChargeesEtRendues', async function() {
        // (Votre code pour annoncesChargeesEtRendues - inchangé)
        console.log('[FAVORITES_ALBUM_MANAGER] Événement "annoncesChargeesEtRendues" reçu.');
        setTimeout(() => {
            console.log('[FAVORITES_ALBUM_MANAGER] Exécution différée de initPropertyHeartButtons après annoncesChargeesEtRendues.');
            // Marquer les boutons pour un re-binding potentiel si nécessaire
            document.querySelectorAll('.favorite-btn').forEach(btn => btn.classList.add('js-needs-rebind'));
            initPropertyHeartButtons();
        }, 100); // Délai pour s'assurer que le DOM est prêt
    });

    document.addEventListener('authStateChanged', async function(event) {
        // (Votre code pour authStateChanged - inchangé)
        updateAuthToken(); 
        await fetchAndStoreUserFavoriteItems(); 
        
        const isLoggedIn = authToken; // Simplifié, ou utilisez event.detail si fourni par authStateChanged

        if (!isLoggedIn && modalElement && (modalElement.style.display !== 'none' && modalElement.style.display !== '')) {
            tryCloseModal("authStateChanged déconnexion");
            alert("Vous avez été déconnecté.");
        } else if (isLoggedIn && modalElement && (modalElement.style.display !== 'none' && modalElement.style.display !== '')) {
            await populateModalWithAlbums();
        }
    });
    
    console.log("[FAVORITES_ALBUM_MANAGER] Script initialisé.");
});

// favorites-manager.js (avec améliorations UX)
document.addEventListener('DOMContentLoaded', function () {
    console.log('[FAVORITES_ALBUM_MANAGER] DOMContentLoaded.');

    if (typeof XanoClient === 'undefined') { /* ... */ return; }
    if (typeof getCookie !== 'function') { /* ... */ return; }

    const FAVORITES_API_BASE_URL = 'https://xwxl-obyg-b3e3.p7.xano.io/api:7u3_oKu9';
    const favoritesXanoClient = new XanoClient({ apiGroupBaseUrl: FAVORITES_API_BASE_URL });
    let authToken = getCookie('xano_auth_token');

    function updateAuthToken() {
        authToken = getCookie('xano_auth_token');
        favoritesXanoClient.setAuthToken(authToken || null);
    }
    updateAuthToken();

    let currentPropertyIdToSave = null;
    let currentPropertyPhotoUrlToDisplay = null; // NOUVEAU: pour la photo de l'annonce
    let userAlbums = [];
    let userFavoriteItems = new Map();

    const MODAL_ID = 'modale-favorites';
    const MODAL_VIEW_ALBUM_LIST_ID = 'modal-view-album-list';
    const MODAL_VIEW_CREATE_ALBUM_ID = 'modal-view-create-album';
    const AD_COVER_PHOTO_PREVIEW_ID = 'ad-cover-photo-preview'; // NOUVEAU: ID pour l'img preview
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
    const adCoverPhotoPreviewElement = document.getElementById(AD_COVER_PHOTO_PREVIEW_ID); // NOUVEAU
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
        // adCoverPhotoPreviewElement est optionnel pour le fonctionnement de base, mais vérifié s'il est critique pour le nouveau design
        // { name: 'adCoverPhotoPreviewElement', el: adCoverPhotoPreviewElement, id: AD_COVER_PHOTO_PREVIEW_ID }, 
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
    if (!templateItemAlbumModal) { /* ... */ }
    if (!allElementsFoundCheck) { /* ... */ }

    async function fetchAndStoreUserFavoriteItems() { /* ... (inchangé) ... */ 
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

    function updateAllHeartButtonsUI() { /* ... (inchangé) ... */ 
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
        console.log('[FAVORITES_ALBUM_MANAGER] Initialisation des boutons favoris...');
        const buttons = document.querySelectorAll('.favorite-btn');
        buttons.forEach((button, index) => {
            console.log(`[FAVORITES_ALBUM_MANAGER] Bouton #${index}:`, button, `data-property-id: "${button.dataset.propertyId}"`, `data-cover-photo-url: "${button.dataset.coverPhotoUrl}"`);
            const newButton = button.cloneNode(true);
            if (button.parentNode) button.parentNode.replaceChild(newButton, button);
            const targetButton = newButton.parentNode ? newButton : button;
            
            targetButton.addEventListener('click', async function (event) {
                event.preventDefault(); 
                event.stopPropagation();
                
                const clickedPropertyId = this.dataset.propertyId;
                // NOUVEAU : Récupérer l'URL de la photo de couverture depuis le bouton
                const coverPhotoUrl = this.dataset.coverPhotoUrl || null; 

                console.log('[FAVORITES_ALBUM_MANAGER] Clic sur .favorite-btn. ID Propriété:', clickedPropertyId, 'URL Photo:', coverPhotoUrl);

                if (!clickedPropertyId || clickedPropertyId.trim() === "" || clickedPropertyId === "[REMPLACER_PAR_ID_ANNONCE]") {
                    console.error("ID d'annonce manquant, vide, ou placeholder sur le bouton cliqué.", this);
                    alert("Une erreur est survenue : l'identifiant de l'annonce est manquant.");
                    return;
                }
                updateAuthToken();
                if (!authToken) { /* ... alert ... */ return; }
                
                if (this.classList.contains('is-favorited')) {
                    const favoritesListId = this.dataset.favoritesListId;
                    const albumName = this.dataset.albumName || 'cet album';
                    if (favoritesListId) {
                        await removePropertyFromAlbum(favoritesListId, clickedPropertyId, albumName);
                    } else { await fetchAndStoreUserFavoriteItems(); }
                } else {
                    currentPropertyIdToSave = clickedPropertyId;
                    currentPropertyPhotoUrlToDisplay = coverPhotoUrl; // NOUVEAU: stocker pour la vue création
                    await populateModalWithAlbums();
                    showModalView(MODAL_VIEW_ALBUM_LIST_ID);
                    const hiddenTrigger = document.getElementById(HIDDEN_FINSWEET_MODAL_TRIGGER_ID);
                    if (hiddenTrigger) hiddenTrigger.click();
                    else { console.error(`Trigger caché introuvable.`); if (modalElement) modalElement.style.display = 'block'; }
                }
            });
        });
        updateAllHeartButtonsUI();
    }

    function showModalView(viewIdToShow) {
        if (modalViewAlbumList && modalViewCreateAlbum) {
            if (viewIdToShow === MODAL_VIEW_ALBUM_LIST_ID) {
                modalViewAlbumList.style.display = 'block';
                modalViewCreateAlbum.style.display = 'none';
            } else if (viewIdToShow === MODAL_VIEW_CREATE_ALBUM_ID) {
                modalViewAlbumList.style.display = 'none';
                modalViewCreateAlbum.style.display = 'block';

                // NOUVEAU: Afficher l'aperçu de la photo de l'annonce
                if (adCoverPhotoPreviewElement) {
                    if (currentPropertyPhotoUrlToDisplay) {
                        adCoverPhotoPreviewElement.src = currentPropertyPhotoUrlToDisplay;
                        adCoverPhotoPreviewElement.style.display = 'block'; // Ou 'inline-block', etc.
                    } else {
                        adCoverPhotoPreviewElement.style.display = 'none';
                    }
                } else {
                    console.warn("Élément d'aperçu photo non trouvé pour la vue de création d'album.");
                }

                if(inputNomNouvelAlbum) inputNomNouvelAlbum.focus();
                if(btnSubmitNouvelAlbum && inputNomNouvelAlbum) btnSubmitNouvelAlbum.disabled = !inputNomNouvelAlbum.value.trim();
            }
        } else { /* ... erreur ... */ }
    }

    async function populateModalWithAlbums() { /* ... (inchangé pour l'essentiel) ... */ 
        if (!modalElement || !modalListeAlbumsConteneur || !messageModalAlbums) {
            console.error("Éléments de la modale pour albums manquants.");
            return;
        }
        messageModalAlbums.textContent = 'Chargement de vos albums...';
        messageModalAlbums.style.display = 'block';
        modalListeAlbumsConteneur.innerHTML = '';
        if (modalViewCreateAlbum) modalViewCreateAlbum.style.display = 'none';
        if (modalViewAlbumList) modalViewAlbumList.style.display = 'block';

        updateAuthToken();
        if (!authToken) {
            messageModalAlbums.textContent = "Veuillez vous connecter pour voir vos albums.";
            if(btnOuvrirFormNouvelAlbum) btnOuvrirFormNouvelAlbum.style.display = 'none';
            return;
        }
        if(btnOuvrirFormNouvelAlbum) btnOuvrirFormNouvelAlbum.style.display = '';

        try {
            const albumsResponse = await favoritesXanoClient.get('favorites_album');
            userAlbums = (Array.isArray(albumsResponse)) ? albumsResponse : (albumsResponse && Array.isArray(albumsResponse.items)) ? albumsResponse.items : [];
            if (userAlbums.length === 0 && currentPropertyIdToSave) {
                const defaultAlbum = await createAlbum(DEFAULT_ALBUM_NAME, "Mon premier album de favoris.", true); // suppressReload = true
                if (defaultAlbum && defaultAlbum.id) {
                    userAlbums.push(defaultAlbum); // Ajoute localement pour affichage immédiat si on ne ferme pas la modale
                    // L'annonce sera sauvegardée dans cet album par la logique du formulaire de création si on y va,
                    // ou si on clique directement sur cet album s'il est le seul.
                    // Pour le flux "créer puis sauvegarder", la sauvegarde se fera après la création manuelle
                    // Donc, on ne sauvegarde pas automatiquement ici, on laisse l'utilisateur créer l'album.
                    // La sauvegarde se fera si l'utilisateur clique sur "créer un album" puis soumet le formulaire,
                    // ou s'il clique sur un album existant.
                    // Modification: La logique de création d'album par défaut puis sauvegarde directe si aucun album n'existe
                    // est retirée ici, pour favoriser le flux "clic coeur -> voir albums/créer -> action"
                    // Le scénario de création auto est géré dans le submit du form si `currentPropertyIdToSave` est défini.
                    // On rendra simplement la liste (qui sera vide ou avec le "Mes Favoris" si on veut le créer ici)
                    // et on laisse l'utilisateur choisir de créer un album.
                    // La création de "Mes Favoris" sera implicite si aucun album n'est là et que l'user en crée un.
                    // Pour l'instant, on ne crée pas d'album par défaut ici, on laisse l'utilisateur le faire.
                    // La demande était: "Je clique sur ajouter aux favoris, l'album n'existe pas, je le créé, et l'annonce est directement ajouté dedans!"
                    // Cela sera géré dans le submit du formulaire de création.
                } else {
                    // messageModalAlbums.textContent = "Impossible de préparer l'album par défaut."; // Commenté, car on ne crée plus ici.
                }
            }
            renderAlbumListInModal(userAlbums);
        } catch (error) {
            console.error("Erreur lors du chargement des albums:", error);
            messageModalAlbums.textContent = "Erreur lors du chargement de vos albums.";
        }
    }

    function renderAlbumListInModal(albums) { /* ... (inchangé) ... */ 
        if (!modalListeAlbumsConteneur || !templateItemAlbumModal) {
             if (messageModalAlbums) messageModalAlbums.textContent = "Erreur d'affichage des albums.";
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
                clone.dataset.albumId = album.id;
                clone.dataset.albumName = album.name_Album; 
                clone.addEventListener('click', async function () {
                    const albumId = this.dataset.albumId;
                    const albumName = this.dataset.albumName;
                    if (!currentPropertyIdToSave) {
                        alert("Erreur : Aucune annonce sélectionnée.");
                        return;
                    }
                    await savePropertyToAlbum(currentPropertyIdToSave, albumId, albumName);
                });
                modalListeAlbumsConteneur.appendChild(clone);
            });
        }
        if (btnOuvrirFormNouvelAlbum) {
            btnOuvrirFormNouvelAlbum.style.display = '';
        }
    }

    async function savePropertyToAlbum(propertyId, albumId, albumName) { /* ... (inchangé) ... */ 
        if (!propertyId || !albumId) return;
        try {
            const newFavoriteEntry = await favoritesXanoClient.post('favorites_list', {
                favorites_album_id: parseInt(albumId),
                property_id: parseInt(propertyId)
            });
            if (newFavoriteEntry && newFavoriteEntry.id) {
                userFavoriteItems.set(newFavoriteEntry.property_id.toString(), {
                    favoritesListId: newFavoriteEntry.id,
                    albumId: newFavoriteEntry.favorites_album_id,
                    albumName: albumName || (userAlbums.find(a => a.id === newFavoriteEntry.favorites_album_id)?.name_Album) || 'cet album'
                });
                updateAllHeartButtonsUI();
                triggerSaveAnimation(`Enregistré dans "${albumName || DEFAULT_ALBUM_NAME}" ! ✅`);
                currentPropertyIdToSave = null; // Réinitialiser après sauvegarde
                currentPropertyPhotoUrlToDisplay = null; // Réinitialiser
                const closeButton = modalElement ? modalElement.querySelector('[fs-modal-element="close"]') : null;
                if (closeButton) {
                     closeButton.click(); 
                } else {
                    console.warn("Bouton de fermeture Finsweet introuvable après sauvegarde.");
                }
            } else { throw new Error("Réponse serveur invalide pour sauvegarde."); }
        } catch (error) {
            console.error("Erreur sauvegarde annonce:", error);
            alert(`Erreur : ${error.message || "Impossible d'ajouter à l'album."}`);
        }
    }

    async function removePropertyFromAlbum(favoritesListId, propertyId, albumName) { /* ... (inchangé) ... */ 
        try {
            await favoritesXanoClient.delete(`favorites_list/${favoritesListId}`);
            userFavoriteItems.delete(propertyId.toString());
            updateAllHeartButtonsUI();
            triggerSaveAnimation(`Supprimé de "${albumName}" 👋`);
        } catch (error) {
            console.error("Erreur suppression annonce:", error);
            alert(`Erreur : ${error.message || "Impossible de supprimer de l'album."}`);
            await fetchAndStoreUserFavoriteItems();
        }
    }

    // MODIFIÉ pour permettre de ne pas recharger/switcher de vue si suppressReloadAndSwitch est true
    async function createAlbum(nomAlbum, descAlbum, suppressReloadAndSwitch = false) {
        updateAuthToken();
        if (!authToken) { /* ... alert ... */ return null; }
        try {
            const newAlbum = await favoritesXanoClient.post('favorites_album', {
                name_Album: nomAlbum, description_album: descAlbum
            });
            if (newAlbum && newAlbum.id) {
                console.log("[FAVORITES_ALBUM_MANAGER] Album créé via Xano:", newAlbum);
                if (!suppressReloadAndSwitch) {
                    await populateModalWithAlbums(); 
                    showModalView(MODAL_VIEW_ALBUM_LIST_ID); 
                }
                return newAlbum; 
            } else { throw new Error("Réponse serveur invalide pour création album."); }
        } catch (error) {
            console.error("Erreur création album:", error);
            alert(`Erreur : ${error.message || "Impossible de créer l'album."}`);
            return null;
        }
    }

    // GESTION DE LA SOUMISSION DU FORMULAIRE DE CRÉATION D'ALBUM - MODIFIÉ
    if (formNouvelAlbum && btnSubmitNouvelAlbum && inputNomNouvelAlbum) {
        console.log('[FAVORITES_ALBUM_MANAGER] Écouteur SUBMIT attaché au formulaire de création.');
        inputNomNouvelAlbum.addEventListener('input', function() {
            if (btnSubmitNouvelAlbum) btnSubmitNouvelAlbum.disabled = !this.value.trim();
        });

        formNouvelAlbum.addEventListener('submit', async function(event) {
            event.preventDefault(); 
            console.log('[FAVORITES_ALBUM_MANAGER] Soumission du formulaire de création interceptée.');

            const nomAlbum = inputNomNouvelAlbum.value.trim();
            const descAlbum = inputDescNouvelAlbum ? inputDescNouvelAlbum.value.trim() : "";

            if (!nomAlbum) { alert("Le nom de l'album ne peut pas être vide."); return; }
            if (btnSubmitNouvelAlbum) btnSubmitNouvelAlbum.disabled = true;

            try {
                // Créer l'album sans recharger la liste des albums ni changer de vue immédiatement
                const createdAlbum = await createAlbum(nomAlbum, descAlbum, true); // suppressReloadAndSwitch = true

                if (createdAlbum && createdAlbum.id) {
                    // Si une annonce était en attente de sauvegarde, la sauvegarder dans le nouvel album
                    if (currentPropertyIdToSave) {
                        console.log(`[FAVORITES_ALBUM_MANAGER] Album "${createdAlbum.name_Album}" créé. Ajout de l'annonce ID ${currentPropertyIdToSave}.`);
                        await savePropertyToAlbum(currentPropertyIdToSave, createdAlbum.id, createdAlbum.name_Album);
                        // savePropertyToAlbum s'occupe de fermer la modale et de l'animation
                    } else {
                        // Pas d'annonce à sauvegarder, juste rafraîchir la liste et montrer un message pour l'album créé
                        console.log(`[FAVORITES_ALBUM_MANAGER] Album "${createdAlbum.name_Album}" créé. Aucune annonce en attente.`);
                        await populateModalWithAlbums(); 
                        showModalView(MODAL_VIEW_ALBUM_LIST_ID);
                        triggerSaveAnimation(`Album "${createdAlbum.name_Album}" créé !`); 
                    }
                    inputNomNouvelAlbum.value = ''; 
                    if (inputDescNouvelAlbum) inputDescNouvelAlbum.value = '';
                } else {
                    console.warn('[FAVORITES_ALBUM_MANAGER] La création d\'album a échoué (pas d\'album retourné).');
                    // L'alerte d'erreur est déjà dans createAlbum
                }
            } catch (error) {
                console.error('[FAVORITES_ALBUM_MANAGER] Erreur lors de la soumission du formulaire de création:', error);
            } finally {
                // Réactiver le bouton seulement si la modale n'est pas censée se fermer ou si erreur
                // Si savePropertyToAlbum est appelé, la modale se ferme, donc l'état du bouton importe moins.
                if (inputNomNouvelAlbum && btnSubmitNouvelAlbum) {
                     btnSubmitNouvelAlbum.disabled = !inputNomNouvelAlbum.value.trim();
                }
                // Tentative de masquage des messages Webflow avec un léger délai
                setTimeout(() => {
                    const parentFormElement = document.getElementById(FORM_NOUVEL_ALBUM_ID);
                    if (parentFormElement && parentFormElement.parentElement) {
                        const wfDone = parentFormElement.parentElement.querySelector('.w-form-done');
                        const wfFail = parentFormElement.parentElement.querySelector('.w-form-fail');
                        if (wfDone) wfDone.style.display = 'none';
                        if (wfFail) wfFail.style.display = 'none';
                        console.log('[FAVORITES_ALBUM_MANAGER] Tentative de masquage des messages Webflow .w-form-done/.w-form-fail.');
                    }
                }, 50); // Délai pour laisser Webflow afficher son message puis le masquer
            }
        });
    } else { /* ... warnings si form manquant ... */ }

    if (btnOuvrirFormNouvelAlbum) { /* ... (inchangé, utilise button type="button") ... */ 
        btnOuvrirFormNouvelAlbum.addEventListener('click', () => {
            console.log('[FAVORITES_ALBUM_MANAGER] Clic sur btn-ouvrir-form-nouvel-album.');
            showModalView(MODAL_VIEW_CREATE_ALBUM_ID);
        });
    }

    if (btnRetourListeAlbums) { /* ... (inchangé) ... */ 
        btnRetourListeAlbums.addEventListener('click', () => { 
            console.log('[FAVORITES_ALBUM_MANAGER] Clic sur btn-retour-liste-albums.');
            showModalView(MODAL_VIEW_ALBUM_LIST_ID);
        });
    }

    function triggerSaveAnimation(message) { /* ... (inchangé) ... */ }

    (async () => { /* ... (initialisation, inchangée) ... */ })();
    document.addEventListener('annoncesChargeesEtRendues', async function() { /* ... (inchangé) ... */ });
    document.addEventListener('authStateChanged', async function() { /* ... (inchangé) ... */ });
    
    console.log("[FAVORITES_ALBUM_MANAGER] Script initialisé.");
});

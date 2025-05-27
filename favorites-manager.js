// favorites-manager.js (entièrement revu pour la logique d'albums et les nouvelles fonctionnalités)
document.addEventListener('DOMContentLoaded', function () {
    console.log('[FAVORITES_ALBUM_MANAGER] DOMContentLoaded.');

    if (typeof XanoClient === 'undefined') {
        console.error("[FAVORITES_ALBUM_MANAGER] ERREUR CRITIQUE: XanoClient non défini.");
        return;
    }
    if (typeof getCookie !== 'function') {
        console.error("[FAVORITES_ALBUM_MANAGER] ERREUR CRITIQUE: getCookie non défini.");
        return;
    }

    const FAVORITES_API_BASE_URL = 'https://xwxl-obyg-b3e3.p7.xano.io/api:7u3_oKu9';
    const favoritesXanoClient = new XanoClient({ apiGroupBaseUrl: FAVORITES_API_BASE_URL });
    let authToken = getCookie('xano_auth_token');

    function updateAuthToken() {
        authToken = getCookie('xano_auth_token');
        favoritesXanoClient.setAuthToken(authToken || null);
    }
    updateAuthToken();

    let currentPropertyIdToSave = null;
    let userAlbums = [];
    let userFavoriteItems = new Map();

    const MODAL_ID = 'modale-favorites';
    const MODAL_VIEW_ALBUM_LIST_ID = 'modal-view-album-list';
    const MODAL_VIEW_CREATE_ALBUM_ID = 'modal-view-create-album';
    const MODAL_LISTE_ALBUMS_CONTENEUR_ID = 'modal-liste-albums-conteneur';
    const TEMPLATE_ITEM_ALBUM_MODAL_ID = 'template-item-album-modal';
    const BTN_OUVRIR_FORM_NOUVEL_ALBUM_ID = 'btn-ouvrir-form-nouvel-album';
    const BTN_RETOUR_LISTE_ALBUMS_ID = 'btn-retour-liste-albums';
    const FORM_NOUVEL_ALBUM_ID = 'form-nouvel-album'; // ID crucial pour votre <form>
    const INPUT_NOM_NOUVEL_ALBUM_ID = 'input-nom-nouvel-album';
    const INPUT_DESC_NOUVEL_ALBUM_ID = 'input-desc-nouvel-album';
    const BTN_SUBMIT_NOUVEL_ALBUM_ID = 'btn-submit-nouvel-album';
    const MESSAGE_MODAL_ALBUMS_ID = 'message-modal-albums';
    const DEFAULT_ALBUM_NAME = "Mes Favoris";
    const HIDDEN_FINSWEET_MODAL_TRIGGER_ID = 'hidden-finsweet-album-trigger';

    const modalElement = document.getElementById(MODAL_ID);
    const modalViewAlbumList = document.getElementById(MODAL_VIEW_ALBUM_LIST_ID);
    const modalViewCreateAlbum = document.getElementById(MODAL_VIEW_CREATE_ALBUM_ID);
    const modalListeAlbumsConteneur = document.getElementById(MODAL_LISTE_ALBUMS_CONTENEUR_ID);
    const templateItemAlbumModal = document.getElementById(TEMPLATE_ITEM_ALBUM_MODAL_ID);
    const btnOuvrirFormNouvelAlbum = document.getElementById(BTN_OUVRIR_FORM_NOUVEL_ALBUM_ID);
    const btnRetourListeAlbums = document.getElementById(BTN_RETOUR_LISTE_ALBUMS_ID);
    const formNouvelAlbum = document.getElementById(FORM_NOUVEL_ALBUM_ID);
    const inputNomNouvelAlbum = document.getElementById(INPUT_NOM_NOUVEL_ALBUM_ID);
    const inputDescNouvelAlbum = document.getElementById(INPUT_DESC_NOUVEL_ALBUM_ID);
    const btnSubmitNouvelAlbum = document.getElementById(BTN_SUBMIT_NOUVEL_ALBUM_ID);
    const messageModalAlbums = document.getElementById(MESSAGE_MODAL_ALBUMS_ID);

    // Vérification initiale détaillée corrigée
    let allElementsFoundCheck = true;
    const elementsToVerify = [
        { name: 'modalElement', el: modalElement, id: MODAL_ID },
        { name: 'modalViewAlbumList', el: modalViewAlbumList, id: MODAL_VIEW_ALBUM_LIST_ID },
        { name: 'modalViewCreateAlbum', el: modalViewCreateAlbum, id: MODAL_VIEW_CREATE_ALBUM_ID },
        { name: 'modalListeAlbumsConteneur', el: modalListeAlbumsConteneur, id: MODAL_LISTE_ALBUMS_CONTENEUR_ID },
        { name: 'btnOuvrirFormNouvelAlbum', el: btnOuvrirFormNouvelAlbum, id: BTN_OUVRIR_FORM_NOUVEL_ALBUM_ID },
        { name: 'formNouvelAlbum', el: formNouvelAlbum, id: FORM_NOUVEL_ALBUM_ID },
        { name: 'inputNomNouvelAlbum', el: inputNomNouvelAlbum, id: INPUT_NOM_NOUVEL_ALBUM_ID },
        // inputDescNouvelAlbum est optionnel, on ne le vérifie pas de manière bloquante ici
        { name: 'btnSubmitNouvelAlbum', el: btnSubmitNouvelAlbum, id: BTN_SUBMIT_NOUVEL_ALBUM_ID },
        { name: 'messageModalAlbums', el: messageModalAlbums, id: MESSAGE_MODAL_ALBUMS_ID },
        { name: 'btnRetourListeAlbums', el: btnRetourListeAlbums, id: BTN_RETOUR_LISTE_ALBUMS_ID }
    ];

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
        console.error("[FAVORITES_ALBUM_MANAGER] Au moins un élément clé est manquant lors de l'initialisation. Le script risque de ne pas fonctionner correctement. Veuillez vérifier les erreurs ci-dessus.");
        // return; // Décommenter pour arrêter le script si des éléments critiques sont manquants.
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
        const buttons = document.querySelectorAll('.favorite-btn');
        buttons.forEach(button => {
            const newButton = button.cloneNode(true);
            if (button.parentNode) {
                button.parentNode.replaceChild(newButton, button);
            }
            const targetButton = newButton.parentNode ? newButton : button;
            targetButton.addEventListener('click', async function (event) {
                event.preventDefault(); 
                event.stopPropagation();
                updateAuthToken();
                if (!authToken) {
                    alert("Veuillez vous connecter pour gérer vos favoris.");
                    return;
                }
                const clickedPropertyId = this.dataset.propertyId;
                if (!clickedPropertyId || clickedPropertyId === "[REMPLACER_PAR_ID_ANNONCE]") {
                    console.error("ID d'annonce manquant ou invalide sur le bouton.");
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
                    await populateModalWithAlbums();
                    showModalView(MODAL_VIEW_ALBUM_LIST_ID);
                    const hiddenTrigger = document.getElementById(HIDDEN_FINSWEET_MODAL_TRIGGER_ID);
                    if (hiddenTrigger) {
                        hiddenTrigger.click();
                    } else {
                        console.error(`[FAVORITES_ALBUM_MANAGER] Trigger de modale caché (ID: ${HIDDEN_FINSWEET_MODAL_TRIGGER_ID}) introuvable.`);
                        if (modalElement) modalElement.style.display = 'block'; 
                        else alert("Erreur : Impossible d'ouvrir la fenêtre de sauvegarde (trigger et modale manquants).");
                    }
                }
            });
        });
        updateAllHeartButtonsUI();
    }

    function showModalView(viewIdToShow) {
        console.log('[showModalView] Appelée avec viewIdToShow:', viewIdToShow);
        console.log('[showModalView] modalViewAlbumList:', modalViewAlbumList);
        console.log('[showModalView] modalViewCreateAlbum:', modalViewCreateAlbum);

        if (modalViewAlbumList && modalViewCreateAlbum) {
            if (viewIdToShow === MODAL_VIEW_ALBUM_LIST_ID) {
                modalViewAlbumList.style.display = 'block';
                modalViewCreateAlbum.style.display = 'none';
                console.log('[showModalView] Affichage de la liste des albums.');
            } else if (viewIdToShow === MODAL_VIEW_CREATE_ALBUM_ID) {
                modalViewAlbumList.style.display = 'none';
                modalViewCreateAlbum.style.display = 'block';
                console.log('[showModalView] Affichage du formulaire de création d\'album.');
                if(inputNomNouvelAlbum) inputNomNouvelAlbum.focus();
                if(btnSubmitNouvelAlbum && inputNomNouvelAlbum) btnSubmitNouvelAlbum.disabled = !inputNomNouvelAlbum.value.trim();
            }
        } else {
            console.error("[FAVORITES_ALBUM_MANAGER] ERREUR DANS SHOWMODALVIEW: `modalViewAlbumList` ou `modalViewCreateAlbum` est null. La navigation interne de la modale échouera. Vérifiez les IDs HTML et leur présence au chargement du DOM.");
        }
    }

    async function populateModalWithAlbums() {
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
                const defaultAlbum = await createAlbum(DEFAULT_ALBUM_NAME, "Mon premier album de favoris.", true);
                if (defaultAlbum && defaultAlbum.id) {
                    userAlbums.push(defaultAlbum);
                    await savePropertyToAlbum(currentPropertyIdToSave, defaultAlbum.id, defaultAlbum.name_Album);
                    return; 
                } else {
                    messageModalAlbums.textContent = "Impossible de créer l'album par défaut.";
                }
            }
            renderAlbumListInModal(userAlbums);
        } catch (error) {
            console.error("Erreur lors du chargement des albums:", error);
            messageModalAlbums.textContent = "Erreur lors du chargement de vos albums.";
        }
    }

    function renderAlbumListInModal(albums) {
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

    async function savePropertyToAlbum(propertyId, albumId, albumName) {
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

    async function removePropertyFromAlbum(favoritesListId, propertyId, albumName) {
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

    async function createAlbum(nomAlbum, descAlbum, suppressReload = false) {
        updateAuthToken();
        if (!authToken) {
            alert("Veuillez vous connecter pour créer un album.");
            return null;
        }
        try {
            console.log(`[FAVORITES_ALBUM_MANAGER] Appel Xano pour créer album: ${nomAlbum}`);
            const newAlbum = await favoritesXanoClient.post('favorites_album', {
                name_Album: nomAlbum,
                description_album: descAlbum
            });
            console.log('[FAVORITES_ALBUM_MANAGER] Réponse Xano création album:', newAlbum);

            if (newAlbum && newAlbum.id) {
                if (!suppressReload) {
                    await populateModalWithAlbums(); 
                    showModalView(MODAL_VIEW_ALBUM_LIST_ID); 
                }
                return newAlbum; 
            } else { 
                console.error("Réponse serveur invalide pour création album ou ID manquant:", newAlbum);
                throw new Error("La réponse du serveur pour la création d'album est invalide ou ID manquant."); 
            }
        } catch (error) {
            console.error("Erreur création album Xano:", error);
            alert(`Erreur : ${error.message || "Impossible de créer l'album."}`);
            return null;
        }
    }

    if (formNouvelAlbum && btnSubmitNouvelAlbum && inputNomNouvelAlbum) {
        console.log('[FAVORITES_ALBUM_MANAGER] Écouteur d\'événement SUBMIT attaché au formulaire de création d\'album.');
        inputNomNouvelAlbum.addEventListener('input', function() {
            if (btnSubmitNouvelAlbum) btnSubmitNouvelAlbum.disabled = !this.value.trim();
        });

        formNouvelAlbum.addEventListener('submit', async function(event) {
            event.preventDefault(); 
            console.log('[FAVORITES_ALBUM_MANAGER] Soumission du formulaire de création d\'album interceptée.');

            const nomAlbum = inputNomNouvelAlbum.value.trim();
            const descAlbum = inputDescNouvelAlbum ? inputDescNouvelAlbum.value.trim() : "";

            if (!nomAlbum) {
                alert("Le nom de l'album ne peut pas être vide.");
                return;
            }
            if (btnSubmitNouvelAlbum) btnSubmitNouvelAlbum.disabled = true;

            try {
                const createdAlbum = await createAlbum(nomAlbum, descAlbum);
                if (createdAlbum) {
                    console.log('[FAVORITES_ALBUM_MANAGER] Album créé avec succès via JS:', createdAlbum);
                    inputNomNouvelAlbum.value = ''; 
                    if (inputDescNouvelAlbum) inputDescNouvelAlbum.value = '';
                } else {
                    console.warn('[FAVORITES_ALBUM_MANAGER] La création d\'album a échoué ou n\'a pas retourné d\'album.');
                }
            } catch (error) {
                console.error('[FAVORITES_ALBUM_MANAGER] Erreur inattendue lors de la soumission du formulaire de création:', error);
                alert("Une erreur inattendue est survenue lors de la création de l'album.");
            } finally {
                if (btnSubmitNouvelAlbum && inputNomNouvelAlbum) btnSubmitNouvelAlbum.disabled = !inputNomNouvelAlbum.value.trim(); 
                
                const wfFormDone = formNouvelAlbum.parentElement ? formNouvelAlbum.parentElement.querySelector('.w-form-done') : null;
                const wfFormFail = formNouvelAlbum.parentElement ? formNouvelAlbum.parentElement.querySelector('.w-form-fail') : null;
                if (wfFormDone) wfFormDone.style.display = 'none';
                if (wfFormFail) wfFormFail.style.display = 'none';
            }
        });
    } else {
        console.warn("[FAVORITES_ALBUM_MANAGER] Le formulaire de création d'album (formNouvelAlbum) ou ses composants (btnSubmitNouvelAlbum, inputNomNouvelAlbum) sont introuvables. La création d'album via JS ne fonctionnera pas.");
        if (!formNouvelAlbum) console.warn(" > formNouvelAlbum est null. VÉRIFIEZ L'ID DE VOTRE BALISE <form> ! Il doit être 'form-nouvel-album'.");
        if (!btnSubmitNouvelAlbum) console.warn(" > btnSubmitNouvelAlbum est null");
        if (!inputNomNouvelAlbum) console.warn(" > inputNomNouvelAlbum est null");
    }

    if (btnOuvrirFormNouvelAlbum) {
        btnOuvrirFormNouvelAlbum.addEventListener('click', () => {
            console.log('[FAVORITES_ALBUM_MANAGER] Clic sur btn-ouvrir-form-nouvel-album.');
            showModalView(MODAL_VIEW_CREATE_ALBUM_ID);
        });
    } else {
        console.warn("[FAVORITES_ALBUM_MANAGER] Bouton 'btn-ouvrir-form-nouvel-album' introuvable.");
    }

    if (btnRetourListeAlbums) {
        btnRetourListeAlbums.addEventListener('click', () => { 
            console.log('[FAVORITES_ALBUM_MANAGER] Clic sur btn-retour-liste-albums.');
            showModalView(MODAL_VIEW_ALBUM_LIST_ID);
        });
    } else {
        console.warn("[FAVORITES_ALBUM_MANAGER] Bouton 'btn-retour-liste-albums' introuvable.");
    }

    function triggerSaveAnimation(message) {
        let animationElement = document.getElementById('save-confirmation-animation');
        if (!animationElement) {
            animationElement = document.createElement('div');
            animationElement.id = 'save-confirmation-animation';
            Object.assign(animationElement.style, {
                position: 'fixed', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%) scale(0.9)',
                padding: '20px 40px', backgroundColor: 'rgba(40, 40, 40, 0.85)', 
                color: 'white', borderRadius: '12px', zIndex: '10001', 
                fontSize: '18px', opacity: '0',
                transition: 'opacity 0.3s ease-out, transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)', 
                boxShadow: '0 8px 20px rgba(0,0,0,0.2)', textAlign: 'center'
            });
            document.body.appendChild(animationElement);
        }
        animationElement.textContent = message;
        setTimeout(() => { 
            animationElement.style.opacity = '1';
            animationElement.style.transform = 'translate(-50%, -50%) scale(1)';
        }, 50);
        setTimeout(() => { 
            animationElement.style.opacity = '0';
            animationElement.style.transform = 'translate(-50%, -50%) scale(0.9)';
        }, 2300); 
         setTimeout(() => { 
            if(animationElement) animationElement.style.transform = 'translate(-50%, -50%) scale(0.9)';
        }, 2650);
    }

    (async () => {
        await fetchAndStoreUserFavoriteItems();
        initPropertyHeartButtons();
    })();

    document.addEventListener('annoncesChargeesEtRendues', async function() {
        console.log('[FAVORITES_ALBUM_MANAGER] Nouvelles annonces chargées.');
        initPropertyHeartButtons();
    });

    document.addEventListener('authStateChanged', async function() {
        console.log('[FAVORITES_ALBUM_MANAGER] État d\'authentification changé.');
        updateAuthToken(); 
        await fetchAndStoreUserFavoriteItems(); 
        if (!authToken && modalElement && (modalElement.style.display !== 'none' && modalElement.style.display !== '')) {
            const closeButton = modalElement.querySelector('[fs-modal-element="close"]');
            if (closeButton) closeButton.click();
            alert("Vous avez été déconnecté.");
        } else if (authToken && modalElement && (modalElement.style.display !== 'none' && modalElement.style.display !== '')) {
            await populateModalWithAlbums();
        }
    });
    console.log("[FAVORITES_ALBUM_MANAGER] Script initialisé.");
});

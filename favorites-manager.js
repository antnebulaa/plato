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
    let userFavoriteItems = new Map(); // property_id => { favoritesListId, albumId, albumName }

    // IDs des éléments HTML (adaptez si nécessaire)
    const MODAL_ID = 'modale-favorites';
    const MODAL_VIEW_ALBUM_LIST_ID = 'modal-view-album-list'; // Vue affichant la liste des albums
    const MODAL_VIEW_CREATE_ALBUM_ID = 'modal-view-create-album'; // Vue affichant le formulaire de création
    const MODAL_LISTE_ALBUMS_CONTENEUR_ID = 'modal-liste-albums-conteneur';
    const TEMPLATE_ITEM_ALBUM_MODAL_ID = 'template-item-album-modal';
    const BTN_OUVRIR_FORM_NOUVEL_ALBUM_ID = 'btn-ouvrir-form-nouvel-album';
    const BTN_RETOUR_LISTE_ALBUMS_ID = 'btn-retour-liste-albums'; // Nouveau bouton "Retour"
    const FORM_NOUVEL_ALBUM_ID = 'form-nouvel-album';
    const INPUT_NOM_NOUVEL_ALBUM_ID = 'input-nom-nouvel-album';
    const INPUT_DESC_NOUVEL_ALBUM_ID = 'input-desc-nouvel-album';
    const BTN_SUBMIT_NOUVEL_ALBUM_ID = 'btn-submit-nouvel-album';
    const MESSAGE_MODAL_ALBUMS_ID = 'message-modal-albums';
    const DEFAULT_ALBUM_NAME = "Mes Favoris";
    // ID de votre bouton caché qui ouvre la modale via Finsweet (fs-modal-element="open-X")
    const HIDDEN_FINSWEET_MODAL_TRIGGER_ID = 'hidden-finsweet-album-trigger'; // Adaptez cet ID !

    // Récupération des éléments du DOM
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

    // Vérifications initiales des éléments
    // Ces éléments DOIVENT exister dans votre HTML pour que la modale fonctionne.
    if (!modalElement || !modalViewAlbumList || !modalViewCreateAlbum || !modalListeAlbumsConteneur || !btnOuvrirFormNouvelAlbum || !formNouvelAlbum || !inputNomNouvelAlbum || !btnSubmitNouvelAlbum || !messageModalAlbums || !btnRetourListeAlbums) {
        console.warn('[FAVORITES_ALBUM_MANAGER] Un ou plusieurs éléments clés de la modale sont introuvables. Vérifiez les IDs. La modale risque de ne pas fonctionner correctement. Assurez-vous que votre HTML contient bien les divs "modal-view-album-list", "modal-view-create-album" et le bouton "btn-retour-liste-albums" à l\'intérieur de votre "modale-favorites".');
    }
    if (!templateItemAlbumModal) {
        console.warn('[FAVORITES_ALBUM_MANAGER] Template pour les items d\'album (ID: "' + TEMPLATE_ITEM_ALBUM_MODAL_ID + '") introuvable. Le rendu des albums échouera.');
    }


    // --- RÉCUPÉRATION DES ITEMS FAVORIS DE L'UTILISATEUR ---
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
            console.log('[FAVORITES_ALBUM_MANAGER] Items favoris stockés:', userFavoriteItems);
        } catch (error) {
            console.error('[FAVORITES_ALBUM_MANAGER] Erreur lors de la récupération des items favoris:', error);
            userFavoriteItems.clear();
        }
        updateAllHeartButtonsUI();
    }

    // --- MISE À JOUR DE L'UI DES BOUTONS COEUR ---
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

    // --- GESTION DU CLIC SUR L'ICÔNE "COEUR" ---
    function initPropertyHeartButtons() {
        const buttons = document.querySelectorAll('.favorite-btn');
        buttons.forEach(button => {
            const newButton = button.cloneNode(true);
            if (button.parentNode) {
                button.parentNode.replaceChild(newButton, button);
            } else {
                console.warn("[FAVORITES_ALBUM_MANAGER] Le bouton favori n'a pas de parent, impossible de le remplacer pour attacher l'écouteur d'événement proprement.", button);
                // Fallback: attacher directement, mais risque d'écouteurs multiples si initPropertyHeartButtons est appelé plusieurs fois sans nettoyage.
                // Pour l'instant, on logue et on continue avec le bouton original s'il n'a pas de parent.
                // Idéalement, tous les boutons devraient être dans le DOM avec un parent.
            }
            
            // Utiliser newButton s'il a été correctement inséré, sinon button (avec le risque mentionné)
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
                        console.error("favoritesListId manquant pour la suppression.");
                        await fetchAndStoreUserFavoriteItems();
                    }
                } else {
                    currentPropertyIdToSave = clickedPropertyId;
                    await populateModalWithAlbums(); // Prépare le contenu
                    showModalView(MODAL_VIEW_ALBUM_LIST_ID); // Définit la vue interne par défaut

                    // Déclenche l'ouverture de la modale via le bouton Finsweet caché
                    const hiddenTrigger = document.getElementById(HIDDEN_FINSWEET_MODAL_TRIGGER_ID);
                    if (hiddenTrigger) {
                        console.log(`[FAVORITES_ALBUM_MANAGER] Clic sur le trigger caché Finsweet (ID: ${HIDDEN_FINSWEET_MODAL_TRIGGER_ID}) pour ouvrir la modale.`);
                        hiddenTrigger.click();
                    } else {
                        console.error(`[FAVORITES_ALBUM_MANAGER] Trigger de modale caché (ID: ${HIDDEN_FINSWEET_MODAL_TRIGGER_ID}) introuvable. La modale ne s'ouvrira pas automatiquement.`);
                        // Optionnel: Tenter d'ouvrir la modale manuellement si le trigger est introuvable (moins idéal si Finsweet est utilisé)
                        // if (modalElement) modalElement.style.display = 'block'; // Ou une autre méthode pour la rendre visible
                        alert("Erreur : Impossible d'ouvrir la fenêtre de sauvegarde (trigger manquant).");
                    }
                }
            });
        });
        updateAllHeartButtonsUI();
    }

    // --- GESTION DES VUES DE LA MODALE (LISTE VS CRÉATION) ---
    function showModalView(viewIdToShow) {
        if (modalViewAlbumList && modalViewCreateAlbum) {
            if (viewIdToShow === MODAL_VIEW_ALBUM_LIST_ID) {
                modalViewAlbumList.style.display = 'block';
                modalViewCreateAlbum.style.display = 'none';
            } else if (viewIdToShow === MODAL_VIEW_CREATE_ALBUM_ID) {
                modalViewAlbumList.style.display = 'none';
                modalViewCreateAlbum.style.display = 'block';
                if(inputNomNouvelAlbum) inputNomNouvelAlbum.focus();
                if(btnSubmitNouvelAlbum && inputNomNouvelAlbum) btnSubmitNouvelAlbum.disabled = !inputNomNouvelAlbum.value.trim();
            }
        } else {
            console.error("[FAVORITES_ALBUM_MANAGER] Les conteneurs de vues de la modale (modal-view-album-list ou modal-view-create-album) ne sont pas tous définis/trouvés dans le DOM. La navigation interne de la modale échouera.");
        }
    }

    // --- CHARGEMENT ET AFFICHAGE DES ALBUMS DANS LA MODALE ---
    async function populateModalWithAlbums() {
        if (!modalElement || !modalListeAlbumsConteneur || !messageModalAlbums) {
            console.error("Éléments de la modale pour albums manquants (conteneur principal, liste ou message).");
            return;
        }
        
        messageModalAlbums.textContent = 'Chargement de vos albums...';
        messageModalAlbums.style.display = 'block';
        modalListeAlbumsConteneur.innerHTML = '';
        // S'assurer que le formulaire de création est caché quand on charge la liste des albums
        if (modalViewCreateAlbum) modalViewCreateAlbum.style.display = 'none';
        if (modalViewAlbumList) modalViewAlbumList.style.display = 'block'; // S'assurer que la vue liste est visible

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
                console.log("Aucun album existant. Création de l'album par défaut et sauvegarde.");
                const defaultAlbum = await createAlbum(DEFAULT_ALBUM_NAME, "Mon premier album de favoris.", true);
                if (defaultAlbum && defaultAlbum.id) {
                    userAlbums.push(defaultAlbum);
                    await savePropertyToAlbum(currentPropertyIdToSave, defaultAlbum.id, defaultAlbum.name_Album);
                    return; 
                } else {
                    messageModalAlbums.textContent = "Impossible de créer l'album par défaut. Veuillez en créer un manuellement.";
                }
            }
            renderAlbumListInModal(userAlbums);
        } catch (error) {
            console.error("Erreur lors du chargement des albums:", error);
            messageModalAlbums.textContent = "Erreur lors du chargement de vos albums.";
        }
    }

    function renderAlbumListInModal(albums) {
        if (!modalListeAlbumsConteneur) {
             console.error("Conteneur de liste d'albums introuvable pour le rendu.");
             if (messageModalAlbums) messageModalAlbums.textContent = "Erreur d'affichage (conteneur liste).";
             return;
        }
        if (!templateItemAlbumModal) {
            console.error("Template pour item d'album introuvable pour le rendu.");
            if (messageModalAlbums) messageModalAlbums.textContent = "Erreur d'affichage (template item).";
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
                        alert("Erreur : Aucune annonce sélectionnée pour la sauvegarde.");
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

    // --- SAUVEGARDE D'UNE ANNONCE DANS UN ALBUM ---
    async function savePropertyToAlbum(propertyId, albumId, albumName) {
        if (!propertyId || !albumId) {
            console.error("ID de propriété ou d'album manquant pour la sauvegarde.");
            return;
        }
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
                    console.warn("Aucun bouton de fermeture Finsweet [fs-modal-element=\"close\"] trouvé dans la modale pour la fermer après sauvegarde.");
                }
            } else {
                throw new Error("La réponse du serveur pour la sauvegarde est invalide.");
            }
        } catch (error) {
            console.error("Erreur lors de la sauvegarde de l'annonce:", error);
            alert(`Erreur : ${error.message || "Impossible d'ajouter l'annonce à l'album."}`);
        }
    }

    // --- SUPPRESSION D'UNE ANNONCE D'UN ALBUM ---
    async function removePropertyFromAlbum(favoritesListId, propertyId, albumName) {
        try {
            await favoritesXanoClient.delete(`favorites_list/${favoritesListId}`);
            userFavoriteItems.delete(propertyId.toString());
            updateAllHeartButtonsUI();
            triggerSaveAnimation(`Supprimé de "${albumName}" 👋`);
        } catch (error) {
            console.error("Erreur lors de la suppression de l'annonce de l'album:", error);
            alert(`Erreur : ${error.message || "Impossible de supprimer l'annonce de l'album."}`);
            await fetchAndStoreUserFavoriteItems();
        }
    }

    // --- CRÉATION D'UN NOUVEL ALBUM ---
    async function createAlbum(nomAlbum, descAlbum, suppressReload = false) {
        updateAuthToken();
        if (!authToken) {
            alert("Veuillez vous connecter pour créer un album.");
            return null;
        }
        try {
            const newAlbum = await favoritesXanoClient.post('favorites_album', {
                name_Album: nomAlbum,
                description_album: descAlbum
            });

            if (newAlbum && newAlbum.id) {
                console.log("Nouvel album créé:", newAlbum);
                if (!suppressReload) {
                    await populateModalWithAlbums(); 
                    showModalView(MODAL_VIEW_ALBUM_LIST_ID); 
                }
                return newAlbum; 
            } else {
                throw new Error("La réponse du serveur pour la création d'album est invalide.");
            }
        } catch (error) {
            console.error("Erreur lors de la création de l'album:", error);
            alert(`Erreur : ${error.message || "Impossible de créer l'album."}`);
            return null;
        }
    }


    if (formNouvelAlbum && btnSubmitNouvelAlbum && inputNomNouvelAlbum) {
        inputNomNouvelAlbum.addEventListener('input', function() {
            btnSubmitNouvelAlbum.disabled = !this.value.trim();
        });

        formNouvelAlbum.addEventListener('submit', async function(event) {
            event.preventDefault();
            const nomAlbum = inputNomNouvelAlbum.value.trim();
            const descAlbum = inputDescNouvelAlbum ? inputDescNouvelAlbum.value.trim() : "";

            if (!nomAlbum) {
                alert("Le nom de l'album ne peut pas être vide.");
                return;
            }
            btnSubmitNouvelAlbum.disabled = true;
            const createdAlbum = await createAlbum(nomAlbum, descAlbum);
            if (createdAlbum) {
                inputNomNouvelAlbum.value = '';
                if (inputDescNouvelAlbum) inputDescNouvelAlbum.value = '';
                // Le bouton sera réactivé par showModalView ou l'input listener si on reste.
            } else {
                btnSubmitNouvelAlbum.disabled = !inputNomNouvelAlbum.value.trim(); // Réactiver si erreur et nom présent
            }
        });
    }

    // Écouteur pour le bouton "Créer un nouvel album"
    if (btnOuvrirFormNouvelAlbum) {
        btnOuvrirFormNouvelAlbum.addEventListener('click', (event) => {
            event.preventDefault();
            console.log('[FAVORITES_ALBUM_MANAGER] Clic sur btn-ouvrir-form-nouvel-album. Planification du changement de vue.');
            
            // Différer légèrement le changement de vue
            setTimeout(() => {
                console.log('[FAVORITES_ALBUM_MANAGER] Exécution différée de showModalView pour la vue de création.');
                showModalView(MODAL_VIEW_CREATE_ALBUM_ID);
            }, 50); // Un petit délai, par exemple 50 millisecondes
        });
    }
    if (btnRetourListeAlbums) {
        btnRetourListeAlbums.addEventListener('click', () => {
            showModalView(MODAL_VIEW_ALBUM_LIST_ID);
        });
    }

    // --- ANIMATION DE CONFIRMATION ---
    function triggerSaveAnimation(message) {
        let animationElement = document.getElementById('save-confirmation-animation');
        if (!animationElement) {
            animationElement = document.createElement('div');
            animationElement.id = 'save-confirmation-animation';
            Object.assign(animationElement.style, {
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%) scale(0.9)',
                padding: '20px 40px',
                backgroundColor: 'rgba(40, 40, 40, 0.85)', 
                color: 'white',
                borderRadius: '12px', 
                zIndex: '10001', 
                fontSize: '18px',
                opacity: '0',
                transition: 'opacity 0.3s ease-out, transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)', 
                boxShadow: '0 8px 20px rgba(0,0,0,0.2)',
                textAlign: 'center'
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

    // --- INITIALISATION ET ÉCOUTEURS D'ÉVÉNEMENTS GLOBAUX ---
    (async () => {
        await fetchAndStoreUserFavoriteItems();
        initPropertyHeartButtons();
    })();

    document.addEventListener('annoncesChargeesEtRendues', async function() {
        console.log('[FAVORITES_ALBUM_MANAGER] Nouvelles annonces chargées, réinitialisation des boutons favoris.');
        initPropertyHeartButtons();
    });

    document.addEventListener('authStateChanged', async function() {
        console.log('[FAVORITES_ALBUM_MANAGER] État d\'authentification changé.');
        updateAuthToken(); 
        await fetchAndStoreUserFavoriteItems(); 
        
        if (!authToken && modalElement && (modalElement.style.display !== 'none' && modalElement.style.display !== '')) {
            const closeButton = modalElement.querySelector('[fs-modal-element="close"]');
            if (closeButton) {
                 closeButton.click();
            }
            alert("Vous avez été déconnecté. Veuillez vous reconnecter pour gérer vos favoris.");
        } else if (authToken && modalElement && (modalElement.style.display !== 'none' && modalElement.style.display !== '')) {
            await populateModalWithAlbums();
        }
    });

    console.log("[FAVORITES_ALBUM_MANAGER] Script initialisé.");
});

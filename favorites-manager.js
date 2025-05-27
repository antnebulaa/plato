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
    if (!modalElement || !modalViewAlbumList || !modalViewCreateAlbum || !modalListeAlbumsConteneur || !btnOuvrirFormNouvelAlbum || !formNouvelAlbum || !inputNomNouvelAlbum || !btnSubmitNouvelAlbum || !messageModalAlbums || !btnRetourListeAlbums) {
        console.warn('[FAVORITES_ALBUM_MANAGER] Un ou plusieurs éléments clés de la modale sont introuvables. Vérifiez les IDs.');
    }
    if (!templateItemAlbumModal) {
        console.warn('[FAVORITES_ALBUM_MANAGER] Template pour les items d\'album introuvable. Le rendu des albums échouera.');
    }


    // --- RÉCUPÉRATION DES ITEMS FAVORIS DE L'UTILISATEUR ---
    async function fetchAndStoreUserFavoriteItems() {
        updateAuthToken();
        if (!authToken) {
            userFavoriteItems.clear();
            updateAllHeartButtonsUI(); // Mettre à jour l'UI même si déconnecté
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
        updateAllHeartButtonsUI(); // Toujours mettre à jour l'UI après le fetch
    }

    // --- MISE À JOUR DE L'UI DES BOUTONS COEUR ---
    function updateAllHeartButtonsUI() {
        document.querySelectorAll('.favorite-btn').forEach(button => {
            const propertyId = button.dataset.propertyId;
            const favoriteTextElement = button.querySelector('.favorite-text'); // Assurez-vous que cet élément existe

            if (propertyId && userFavoriteItems.has(propertyId)) {
                const favoriteInfo = userFavoriteItems.get(propertyId);
                button.classList.add('is-favorited');
                if (favoriteTextElement) favoriteTextElement.textContent = 'Sauvegardé';
                button.dataset.favoritesListId = favoriteInfo.favoritesListId;
                button.dataset.albumId = favoriteInfo.albumId;
                button.dataset.albumName = favoriteInfo.albumName;
            } else if (propertyId) {
                button.classList.remove('is-favorited');
                if (favoriteTextElement) favoriteTextElement.textContent = 'Ajouter aux favoris';
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
            // Pour éviter les écouteurs multiples, on clone et remplace le bouton
            const newButton = button.cloneNode(true);
            button.parentNode.replaceChild(newButton, button);

            newButton.addEventListener('click', async function (event) {
                event.preventDefault();
                event.stopPropagation();
                updateAuthToken();
                if (!authToken) {
                    // Gérer le cas où l'utilisateur n'est pas connecté
                    // Par exemple, ouvrir une modale de connexion/inscription
                    alert("Veuillez vous connecter pour gérer vos favoris.");
                    // Vous pourriez vouloir rediriger vers une page de connexion ou ouvrir une modale de connexion.
                    // Exemple: document.getElementById('open-login-modal-button').click();
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
                        await fetchAndStoreUserFavoriteItems(); // Tentative de resynchronisation
                    }
                } else {
                    currentPropertyIdToSave = clickedPropertyId;
                    await populateModalWithAlbums();
                    showModalView(MODAL_VIEW_ALBUM_LIST_ID); // Afficher la vue liste par défaut
                    // La modale est ouverte par Finsweet via un attribut sur le bouton coeur
                    // ou un trigger caché si nécessaire.
                    // Exemple: document.getElementById('hidden-finsweet-album-trigger').click();
                }
            });
        });
        updateAllHeartButtonsUI(); // Mettre à jour l'état initial
    }

    // --- GESTION DES VUES DE LA MODALE (LISTE VS CRÉATION) ---
    function showModalView(viewIdToShow) {
        if (modalViewAlbumList && modalViewCreateAlbum) {
            if (viewIdToShow === MODAL_VIEW_ALBUM_LIST_ID) {
                modalViewAlbumList.style.display = 'block'; // Ou 'flex' etc. selon votre layout
                modalViewCreateAlbum.style.display = 'none';
                // Animation: modalViewAlbumList.classList.remove('slide-out-left'); modalViewAlbumList.classList.add('slide-in-right');
                // Animation: modalViewCreateAlbum.classList.add('slide-out-right'); // ou une classe pour le cacher
            } else if (viewIdToShow === MODAL_VIEW_CREATE_ALBUM_ID) {
                modalViewAlbumList.style.display = 'none';
                modalViewCreateAlbum.style.display = 'block'; // Ou 'flex' etc.
                // Animation: modalViewCreateAlbum.classList.remove('slide-out-right'); modalViewCreateAlbum.classList.add('slide-in-left');
                // Animation: modalViewAlbumList.classList.add('slide-out-left');
                if(inputNomNouvelAlbum) inputNomNouvelAlbum.focus(); // Focus sur le champ nom
                if(btnSubmitNouvelAlbum) btnSubmitNouvelAlbum.disabled = !inputNomNouvelAlbum.value.trim(); // Maj état bouton
            }
        } else {
            console.error("Les conteneurs de vues de la modale ne sont pas tous définis.");
        }
    }

    // --- CHARGEMENT ET AFFICHAGE DES ALBUMS DANS LA MODALE ---
    async function populateModalWithAlbums() {
        if (!modalElement || !modalListeAlbumsConteneur || !messageModalAlbums) {
            console.error("Éléments de la modale pour albums manquants.");
            return;
        }
        
        messageModalAlbums.textContent = 'Chargement de vos albums...';
        messageModalAlbums.style.display = 'block';
        modalListeAlbumsConteneur.innerHTML = '';
        if(formNouvelAlbum) formNouvelAlbum.style.display = 'none'; // Assurer que le form est caché initialement

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
                // Si aucun album n'existe et qu'on veut sauvegarder une annonce,
                // on propose de créer l'album par défaut "Mes Favoris" et on y ajoute l'annonce.
                console.log("Aucun album existant. Création de l'album par défaut et sauvegarde.");
                const defaultAlbum = await createAlbum(DEFAULT_ALBUM_NAME, "Mon premier album de favoris.", true); // Le 'true' indique de ne pas re-afficher la liste
                if (defaultAlbum && defaultAlbum.id) {
                    userAlbums.push(defaultAlbum); // Ajoute à la liste locale
                    await savePropertyToAlbum(currentPropertyIdToSave, defaultAlbum.id, defaultAlbum.name_Album);
                    // La modale devrait se fermer ici (géré par Finsweet après le clic sur l'album)
                    // ou si on veut la garder ouverte, il faudrait un autre mécanisme.
                    // Pour l'instant, on suppose que la sauvegarde via savePropertyToAlbum déclenche la fermeture.
                    // Si la modale reste ouverte, on rafraîchit la liste :
                    // renderAlbumListInModal(userAlbums);
                    return; // Sortir car l'action est complétée
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
        if (!modalListeAlbumsConteneur || !templateItemAlbumModal) {
            if (messageModalAlbums) messageModalAlbums.textContent = "Erreur d'affichage des albums (template manquant).";
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
                clone.style.display = 'flex'; // Ou 'block', selon votre CSS pour les items

                const nameElement = clone.querySelector('[data-album-name]');
                if (nameElement) nameElement.textContent = album.name_Album || 'Album sans nom';
                clone.dataset.albumId = album.id;
                clone.dataset.albumName = album.name_Album; // Stocker le nom pour l'animation

                clone.addEventListener('click', async function () {
                    const albumId = this.dataset.albumId;
                    const albumName = this.dataset.albumName;
                    if (!currentPropertyIdToSave) {
                        alert("Erreur : Aucune annonce sélectionnée pour la sauvegarde.");
                        return;
                    }
                    await savePropertyToAlbum(currentPropertyIdToSave, albumId, albumName);
                    // La fermeture de la modale est gérée par l'attribut Finsweet sur le bouton "Enregistrer"
                    // qui devrait être simulé ou présent sur ces items d'album.
                    // Si ce n'est pas le cas, il faut un `modalElement.style.display = 'none';` ou équivalent.
                    // Pour l'instant, on suppose que Finsweet gère la fermeture.
                });
                modalListeAlbumsConteneur.appendChild(clone);
            });
        }
         // S'assurer que le bouton "Créer un nouvel album" est visible
        if (btnOuvrirFormNouvelAlbum) {
            btnOuvrirFormNouvelAlbum.style.display = ''; // ou 'block', 'flex' etc.
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
                
                // Si la modale doit se fermer automatiquement après un clic sur l'album ET une sauvegarde réussie:
                // (Ceci suppose que l'attribut Finsweet n'est PAS sur les items d'album directement,
                // mais que vous voulez une fermeture programmatique après l'action JS)
                const closeButton = modalElement.querySelector('[fs-modal-element="close"]');
                if (closeButton) {
                     closeButton.click(); // Simule un clic sur le bouton de fermeture Finsweet
                } else if (modalElement) {
                    // Fallback si pas de bouton Finsweet trouvé, mais ce n'est pas l'idéal si Finsweet est utilisé
                    // modalElement.style.display = 'none'; 
                    console.warn("Aucun bouton de fermeture Finsweet trouvé pour fermer la modale après sauvegarde.");
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
            await fetchAndStoreUserFavoriteItems(); // Resynchroniser en cas d'erreur
        }
    }

    // --- CRÉATION D'UN NOUVEL ALBUM ---
    async function createAlbum(nomAlbum, descAlbum, suppressReload = false) { // Ajout de suppressReload
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
                if (!suppressReload) { // Ne pas recharger si c'est la création de l'album par défaut
                    await populateModalWithAlbums(); // Recharge la liste des albums
                    showModalView(MODAL_VIEW_ALBUM_LIST_ID); // Retourne à la vue liste
                }
                return newAlbum; // Retourne l'album créé
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
        // Activer/désactiver le bouton de soumission en fonction du nom de l'album
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
            }
            // Le bouton est réactivé par l'input listener ou si on reste sur la vue
            // Si on change de vue, son état sera géré par showModalView
            // btnSubmitNouvelAlbum.disabled = false; // Déjà géré par le retour à la liste ou le focus
        });
    }

    // Écouteur pour le bouton "Créer un nouvel album"
    if (btnOuvrirFormNouvelAlbum) {
        btnOuvrirFormNouvelAlbum.addEventListener('click', () => {
            showModalView(MODAL_VIEW_CREATE_ALBUM_ID);
        });
    }

    // Écouteur pour le bouton "Retour à la liste des albums"
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
            // Styles (vous pouvez les affiner avec CSS)
            Object.assign(animationElement.style, {
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%) scale(0.9)',
                padding: '20px 40px',
                backgroundColor: 'rgba(40, 40, 40, 0.85)', // Un peu plus foncé
                color: 'white',
                borderRadius: '12px', // Plus arrondi
                zIndex: '10001', // Au-dessus de la modale si besoin
                fontSize: '18px',
                opacity: '0',
                transition: 'opacity 0.3s ease-out, transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)', // Transition plus "pop"
                boxShadow: '0 8px 20px rgba(0,0,0,0.2)',
                textAlign: 'center'
            });
            document.body.appendChild(animationElement);
        }
        animationElement.textContent = message;

        setTimeout(() => { // Apparition
            animationElement.style.opacity = '1';
            animationElement.style.transform = 'translate(-50%, -50%) scale(1)';
        }, 50);

        setTimeout(() => { // Disparition
            animationElement.style.opacity = '0';
            animationElement.style.transform = 'translate(-50%, -50%) scale(0.9)';
        }, 2300); // Durée d'affichage un peu plus longue
         setTimeout(() => { // Nettoyage du scale pour la prochaine animation
            if(animationElement) animationElement.style.transform = 'translate(-50%, -50%) scale(0.9)';
        }, 2650);
    }

    // --- INITIALISATION ET ÉCOUTEURS D'ÉVÉNEMENTS GLOBAUX ---
    (async () => {
        await fetchAndStoreUserFavoriteItems();
        initPropertyHeartButtons();
    })();

    document.addEventListener('annoncesChargeesEtRendues', async function() {
        console.log('[FAVORITES_ALBUM_MANAGER] Nouvelles annonces chargées.');
        // Pas besoin de re-fetch tous les favoris, userFavoriteItems devrait être à jour.
        initPropertyHeartButtons(); // Ré-attache les listeners et met à jour les nouveaux boutons
        // updateAllHeartButtonsUI(); // initPropertyHeartButtons le fait déjà à la fin
    });

    document.addEventListener('authStateChanged', async function() {
        console.log('[FAVORITES_ALBUM_MANAGER] État d\'authentification changé.');
        updateAuthToken(); // Important de mettre à jour le token dans le client Xano
        await fetchAndStoreUserFavoriteItems(); // Re-fetch les favoris et met à jour l'UI
        // initPropertyHeartButtons(); // Déjà appelé par fetchAndStoreUserFavoriteItems via updateAllHeartButtonsUI
        
        // Si la modale est ouverte et que l'utilisateur se déconnecte, il faut la gérer.
        if (!authToken && modalElement && modalElement.style.display !== 'none' && modalElement.style.display !== '') {
            // Fermer la modale ou afficher un message de connexion à l'intérieur
            const closeButton = modalElement.querySelector('[fs-modal-element="close"]');
            if (closeButton) {
                 closeButton.click();
            }
            alert("Vous avez été déconnecté. Veuillez vous reconnecter pour gérer vos favoris.");
        } else if (authToken && modalElement && modalElement.style.display !== 'none' && modalElement.style.display !== '') {
            // Si l'utilisateur se reconnecte pendant que la modale est ouverte (improbable mais possible)
            // On pourrait vouloir rafraîchir son contenu.
            await populateModalWithAlbums();
        }
    });

    console.log("[FAVORITES_ALBUM_MANAGER] Script initialisé.");
});

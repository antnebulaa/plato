// favorites-manager.js
document.addEventListener('DOMContentLoaded', function () {
    console.log('[FAVORITES_ALBUM_MANAGER] DOMContentLoaded.');

    // Vérification de la disponibilité des dépendances
    if (typeof XanoClient === 'undefined') {
        console.error("[FAVORITES_ALBUM_MANAGER] XanoClient non défini. Assurez-vous que xano-client-utils.js est chargé avant ce script.");
        return;
    }
    if (typeof getCookie !== 'function') { // Assumant que getCookie vient aussi de xano-client-utils.js ou est global
        console.error("[FAVORITES_ALBUM_MANAGER] getCookie non défini.");
        return;
    }

    const FAVORITES_API_BASE_URL = 'https://xwxl-obyg-b3e3.p7.xano.io/api:7u3_oKu9';
    const favoritesXanoClient = new XanoClient({ apiGroupBaseUrl: FAVORITES_API_BASE_URL });
    let authToken = getCookie('xano_auth_token');

    function updateAuthToken() {
        authToken = getCookie('xano_auth_token');
        favoritesXanoClient.setAuthToken(authToken || null);
    }
    updateAuthToken(); // Appel initial

    // État du script
    let currentPropertyIdToSave = null;
    let currentPropertyPhotoUrlToDisplay = null;
    let userAlbums = []; // Stocke les albums de l'utilisateur
    let userFavoriteItems = new Map(); // Stocke les items favoris pour une mise à jour rapide de l'UI

    // IDs des éléments DOM (constantes pour éviter les erreurs de frappe)
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
    const INPUT_DESC_NOUVEL_ALBUM_ID = 'input-desc-nouvel-album'; // Optionnel, peut être null
    const BTN_SUBMIT_NOUVEL_ALBUM_ID = 'btn-submit-nouvel-album';
    const MESSAGE_MODAL_ALBUMS_ID = 'message-modal-albums';
    const HIDDEN_FINSWEET_MODAL_TRIGGER_ID = 'hidden-finsweet-album-trigger'; // Pour ouvrir la modale
    // IMPORTANT : Déterminez le bon sélecteur pour le bouton de fermeture de VOTRE modale Finsweet
    // Si votre trigger d'ouverture (HIDDEN_FINSWEET_MODAL_TRIGGER_ID) a fs-modal-element="open-X",
    // alors le bouton de fermeture doit avoir fs-modal-element="close-X".
    // Si c'est "open-4", alors "close-4" est correct. Adaptez si besoin.
    const FINSWEET_MODAL_CLOSE_ATTRIBUTE_SELECTOR = '[fs-modal-element="close-4"]'; // À VÉRIFIER/ADAPTER

    // Récupération des éléments DOM
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

    // Vérification initiale des éléments DOM
    function checkElements() {
        let allFound = true;
        const elements = [
            { name: 'modalElement', el: modalElement, id: MODAL_ID, critical: true },
            { name: 'modalViewAlbumList', el: modalViewAlbumList, id: MODAL_VIEW_ALBUM_LIST_ID, critical: true },
            { name: 'modalViewCreateAlbum', el: modalViewCreateAlbum, id: MODAL_VIEW_CREATE_ALBUM_ID, critical: true },
            { name: 'modalListeAlbumsConteneur', el: modalListeAlbumsConteneur, id: MODAL_LISTE_ALBUMS_CONTENEUR_ID, critical: true },
            { name: 'templateItemAlbumModal', el: templateItemAlbumModal, id: TEMPLATE_ITEM_ALBUM_MODAL_ID, critical: true },
            { name: 'btnOuvrirFormNouvelAlbum', el: btnOuvrirFormNouvelAlbum, id: BTN_OUVRIR_FORM_NOUVEL_ALBUM_ID, critical: true },
            { name: 'formNouvelAlbum', el: formNouvelAlbum, id: FORM_NOUVEL_ALBUM_ID, critical: true },
            { name: 'inputNomNouvelAlbum', el: inputNomNouvelAlbum, id: INPUT_NOM_NOUVEL_ALBUM_ID, critical: true },
            { name: 'btnSubmitNouvelAlbum', el: btnSubmitNouvelAlbum, id: BTN_SUBMIT_NOUVEL_ALBUM_ID, critical: true },
            { name: 'messageModalAlbums', el: messageModalAlbums, id: MESSAGE_MODAL_ALBUMS_ID, critical: true },
            { name: 'btnRetourListeAlbums', el: btnRetourListeAlbums, id: BTN_RETOUR_LISTE_ALBUMS_ID, critical: false }, // Peut-être optionnel
            { name: 'adCoverPhotoPreviewElement', el: adCoverPhotoPreviewElement, id: AD_COVER_PHOTO_PREVIEW_ID, critical: false } // Optionnel pour l'UI
        ];

        elements.forEach(item => {
            if (!item.el) {
                if (item.critical) {
                    console.error(`[FAVORITES_ALBUM_MANAGER] ÉLÉMENT CRITIQUE INTROUVABLE: ${item.name} (ID attendu: "${item.id}"). Le script risque de ne pas fonctionner.`);
                    allFound = false;
                } else {
                    console.warn(`[FAVORITES_ALBUM_MANAGER] Élément optionnel introuvable: ${item.name} (ID: "${item.id}").`);
                }
            }
        });
        return allFound;
    }

    if (!checkElements()) {
        return; // Arrêter l'exécution si un élément critique manque
    }

    // Fonctions Utilitaires
    function tryCloseModal() {
        if (!modalElement) {
            console.warn("[FAVORITES_ALBUM_MANAGER] Référence à modalElement est null, ne peut pas tenter de fermer.");
            return;
        }
        const closeButton = modalElement.querySelector(FINSWEET_MODAL_CLOSE_ATTRIBUTE_SELECTOR);
        console.log('[FAVORITES_ALBUM_MANAGER] Tentative de fermeture de la modale. Bouton trouvé:', closeButton, 'avec sélecteur:', FINSWEET_MODAL_CLOSE_ATTRIBUTE_SELECTOR);
        if (closeButton) {
            closeButton.click();
            console.log('[FAVORITES_ALBUM_MANAGER] Clic sur le bouton de fermeture programmé.');
        } else {
            console.warn(`[FAVORITES_ALBUM_MANAGER] Bouton de fermeture Finsweet avec sélecteur "${FINSWEET_MODAL_CLOSE_ATTRIBUTE_SELECTOR}" introuvable dans la modale.`);
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
                    // S'assurer que property_id est une chaîne pour la clé de la Map
                    userFavoriteItems.set(String(entry.property_id), {
                        favoritesListId: entry.id,
                        albumId: entry.favorites_album_id,
                        albumName: entry._favorites_album?.name_Album || 'Album inconnu' // Utiliser l'addon si disponible
                    });
                });
            }
        } catch (error) {
            console.error('[FAVORITES_ALBUM_MANAGER] Erreur lors de la récupération des items favoris:', error);
            userFavoriteItems.clear(); // En cas d'erreur, vider pour éviter un état incohérent
        }
        updateAllHeartButtonsUI();
    }

    function updateAllHeartButtonsUI() {
        document.querySelectorAll('.favorite-btn').forEach(button => {
            const propertyId = button.dataset.propertyId;
            const favoriteTextElement = button.querySelector('.favorite-text'); // Élément optionnel pour le texte

            if (propertyId && userFavoriteItems.has(propertyId)) {
                const favoriteInfo = userFavoriteItems.get(propertyId);
                button.classList.add('is-favorited');
                if (favoriteTextElement) favoriteTextElement.textContent = 'Retirer'; // Adapter le texte si besoin
                button.dataset.favoritesListId = favoriteInfo.favoritesListId;
                button.dataset.albumId = favoriteInfo.albumId;
                button.dataset.albumName = favoriteInfo.albumName; // Stocke le nom de l'album
            } else if (propertyId) {
                button.classList.remove('is-favorited');
                if (favoriteTextElement) favoriteTextElement.textContent = 'Enregistrer'; // Adapter le texte
                delete button.dataset.favoritesListId;
                delete button.dataset.albumId;
                delete button.dataset.albumName;
            }
        });
    }

    function initPropertyHeartButtons() {
        console.log('[FAVORITES_ALBUM_MANAGER] Initialisation des boutons favoris.');
        const buttons = document.querySelectorAll('.favorite-btn');

        buttons.forEach(button => {
            // Pour éviter les écouteurs multiples si cette fonction est appelée plusieurs fois
            if (button.dataset.listenerAttached === 'true') return;
            button.dataset.listenerAttached = 'true';

            button.addEventListener('click', async function (event) {
                event.preventDefault();
                event.stopPropagation();

                const clickedPropertyId = this.dataset.propertyId;
                const coverPhotoUrlOnClick = this.dataset.coverPhotoUrl || null;

                if (!clickedPropertyId || clickedPropertyId === "[REMPLACER_PAR_ID_ANNONCE]") {
                    console.error("ID d'annonce manquant ou placeholder. Action annulée.", this);
                    alert("Erreur: ID d'annonce invalide.");
                    return;
                }

                updateAuthToken();
                if (!authToken) {
                    alert("Veuillez vous connecter pour gérer vos favoris.");
                    // Optionnel : rediriger vers la page de connexion
                    // window.location.href = '/connexion';
                    return;
                }

                if (this.classList.contains('is-favorited')) {
                    const favoritesListId = this.dataset.favoritesListId;
                    const albumName = this.dataset.albumName || 'cet album';
                    if (favoritesListId) {
                        await removePropertyFromAlbum(favoritesListId, clickedPropertyId, albumName);
                    } else {
                        // Cas où l'UI est 'is-favorited' mais l'ID manque (devrait être rare)
                        console.warn("Tentative de retrait d'un favori sans favoritesListId.", this);
                        await fetchAndStoreUserFavoriteItems(); // Tenter de resynchroniser
                    }
                } else {
                    currentPropertyIdToSave = clickedPropertyId;
                    currentPropertyPhotoUrlToDisplay = coverPhotoUrlOnClick;
                    await populateModalWithAlbums(); // Charge les albums dans la modale
                    showModalView(MODAL_VIEW_ALBUM_LIST_ID); // Affiche la vue de la liste des albums

                    const hiddenTrigger = document.getElementById(HIDDEN_FINSWEET_MODAL_TRIGGER_ID);
                    if (hiddenTrigger) {
                        hiddenTrigger.click(); // Ouvre la modale via le trigger Finsweet
                    } else {
                        console.error(`[FAVORITES_ALBUM_MANAGER] Trigger caché Finsweet (ID: "${HIDDEN_FINSWEET_MODAL_TRIGGER_ID}") introuvable.`);
                        // Fallback si le trigger est manquant, mais cela indique un problème de configuration
                        if(modalElement) modalElement.style.display = 'block';
                    }
                }
            });
        });
        updateAllHeartButtonsUI(); // Mettre à jour l'UI initiale des boutons
    }

    function showModalView(viewIdToShow) {
        if (!modalViewAlbumList || !modalViewCreateAlbum) return;

        modalViewAlbumList.style.display = (viewIdToShow === MODAL_VIEW_ALBUM_LIST_ID) ? 'block' : 'none';
        modalViewCreateAlbum.style.display = (viewIdToShow === MODAL_VIEW_CREATE_ALBUM_ID) ? 'block' : 'none';

        if (viewIdToShow === MODAL_VIEW_CREATE_ALBUM_ID) {
            if (adCoverPhotoPreviewElement) {
                if (currentPropertyPhotoUrlToDisplay && currentPropertyPhotoUrlToDisplay.startsWith("http")) {
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
            if(inputDescNouvelAlbum) inputDescNouvelAlbum.value = ''; // Vider le champ
            if(btnSubmitNouvelAlbum && inputNomNouvelAlbum) btnSubmitNouvelAlbum.disabled = true; // Désactiver jusqu'à saisie
        }
    }

    async function populateModalWithAlbums() {
        if (!modalListeAlbumsConteneur || !messageModalAlbums) return;

        messageModalAlbums.textContent = 'Chargement de vos albums...';
        messageModalAlbums.style.display = 'block';
        modalListeAlbumsConteneur.innerHTML = ''; // Vider la liste précédente

        updateAuthToken();
        if (!authToken) {
            messageModalAlbums.textContent = "Veuillez vous connecter pour voir vos albums.";
            if(btnOuvrirFormNouvelAlbum) btnOuvrirFormNouvelAlbum.style.display = 'none';
            return;
        }
        if(btnOuvrirFormNouvelAlbum) btnOuvrirFormNouvelAlbum.style.display = ''; // Afficher le bouton "Créer"

        try {
            // S'assurer que cet endpoint Xano retourne bien `representative_photo_url` pour chaque album
            const albumsResponse = await favoritesXanoClient.get('favorites_album');
            // Gérer différentes structures de réponse possibles de Xano
            userAlbums = (Array.isArray(albumsResponse)) ? albumsResponse : 
                         (albumsResponse && Array.isArray(albumsResponse.items)) ? albumsResponse.items : [];
            
            console.log('[FAVORITES_ALBUM_MANAGER] Données des albums reçues pour la modale:', JSON.stringify(userAlbums, null, 2));
            renderAlbumListInModal(userAlbums);

        } catch (error) {
            console.error("Erreur lors du chargement des albums:", error);
            messageModalAlbums.textContent = "Erreur lors du chargement de vos albums.";
        }
    }

    function renderAlbumListInModal(albums) {
        if (!modalListeAlbumsConteneur || !templateItemAlbumModal) return;
        modalListeAlbumsConteneur.innerHTML = '';

        if (albums.length === 0) {
            if (messageModalAlbums) {
                messageModalAlbums.textContent = "Vous n'avez aucun album. Cliquez sur 'Créer une collection' pour en ajouter un !";
                messageModalAlbums.style.display = 'block';
            }
        } else {
            if (messageModalAlbums) messageModalAlbums.style.display = 'none';

            albums.forEach(album => {
                const clone = templateItemAlbumModal.cloneNode(true);
                clone.removeAttribute('id'); // Éviter les ID dupliqués
                clone.style.display = ''; // Rendre visible (si le template est display:none)

                const nameElement = clone.querySelector('[data-album-name]');
                if (nameElement) nameElement.textContent = album.name_Album || 'Album sans nom';

                const coverImgElement = clone.querySelector('[data-album-cover-img="true"]');
                if (coverImgElement) {
                    if (album.representative_photo_url && String(album.representative_photo_url).startsWith("http")) {
                        coverImgElement.src = album.representative_photo_url;
                        coverImgElement.alt = `Couverture de l'album ${album.name_Album || ''}`;
                        coverImgElement.style.backgroundColor = 'transparent';
                    } else {
                        coverImgElement.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'; // Pixel transparent
                        coverImgElement.alt = `L'album ${album.name_Album || 'sans nom'} n'a pas de photo de couverture`;
                        coverImgElement.style.backgroundColor = '#E0E0E0'; // Couleur du placeholder (gris clair)
                    }
                }

                clone.dataset.albumId = album.id;
                clone.dataset.albumName = album.name_Album;
                clone.addEventListener('click', async function () {
                    await savePropertyToAlbum(currentPropertyIdToSave, this.dataset.albumId, this.dataset.albumName);
                });
                modalListeAlbumsConteneur.appendChild(clone);
            });
        }
    }

    async function savePropertyToAlbum(propertyId, albumId, albumName) {
        if (!propertyId || !albumId) {
            console.warn("[FAVORITES_ALBUM_MANAGER] ID de propriété ou d'album manquant.", { propertyId, albumId });
            alert("Une erreur est survenue (ID manquant).");
            return;
        }

        const payload = {
            favorites_album_id: parseInt(albumId),
            property_id: parseInt(propertyId)
            // user_id sera géré par Xano via le token d'authentification
        };

        if (currentPropertyPhotoUrlToDisplay && String(currentPropertyPhotoUrlToDisplay).startsWith("http")) {
            payload.property_photo_url_for_cover = currentPropertyPhotoUrlToDisplay;
        }

        try {
            const newFavoriteEntry = await favoritesXanoClient.post('favorites_list', payload);
            if (newFavoriteEntry && newFavoriteEntry.id) {
                userFavoriteItems.set(String(newFavoriteEntry.property_id), {
                    favoritesListId: newFavoriteEntry.id,
                    albumId: newFavoriteEntry.favorites_album_id,
                    albumName: albumName || 'Album inconnu' // Utiliser le nom passé en argument
                });
                updateAllHeartButtonsUI();
                triggerSaveAnimation(`Enregistré dans ${albumName || 'cet album'}`);
                currentPropertyIdToSave = null;
                currentPropertyPhotoUrlToDisplay = null;
                tryCloseModal(); // Tentative de fermeture de la modale
            } else {
                throw new Error("Réponse serveur invalide après l'ajout à l'album.");
            }
        } catch (error) {
            console.error("[FAVORITES_ALBUM_MANAGER] Erreur dans savePropertyToAlbum:", error);
            alert(`Erreur lors de la sauvegarde : ${error.message}`);
        }
    }

    async function removePropertyFromAlbum(favoritesListId, propertyId, albumName) {
        if (!favoritesListId || !propertyId) {
            alert("Erreur lors de la suppression (ID manquant).");
            return;
        }
        try {
            await favoritesXanoClient.delete(`favorites_list/${favoritesListId}`);
            userFavoriteItems.delete(String(propertyId));
            updateAllHeartButtonsUI();
            triggerSaveAnimation(`Supprimé de ${albumName || 'cet album'}`);
        } catch (error) {
            console.error("[FAVORITES_ALBUM_MANAGER] Erreur dans removePropertyFromAlbum:", error);
            alert(`Erreur lors de la suppression : ${error.message}`);
            await fetchAndStoreUserFavoriteItems(); // Resynchroniser en cas d'échec partiel
        }
    }

    async function createAlbum(nomAlbum, descAlbum) { // Supprimé suppressReloadAndSwitch et initialCoverUrl car géré par le flux
        updateAuthToken();
        if (!authToken) {
            alert("Veuillez vous connecter pour créer un album.");
            return null;
        }
        try {
            // L'endpoint POST /favorites_album ne prend que nom et description.
            // La photo de couverture sera définie par l'ajout du premier item (via POST /favorites_list).
            const newAlbum = await favoritesXanoClient.post('favorites_album', {
                name_Album: nomAlbum,
                description_album: descAlbum
            });

            if (newAlbum && newAlbum.id) {
                return newAlbum;
            } else {
                throw new Error("Réponse serveur invalide lors de la création de l'album.");
            }
        } catch (error) {
            console.error("[FAVORITES_ALBUM_MANAGER] Erreur dans createAlbum:", error);
            alert(`Erreur lors de la création de l'album : ${error.message}`);
            return null;
        }
    }

    // Gestionnaire pour le formulaire de création d'album
    if (formNouvelAlbum && btnSubmitNouvelAlbum && inputNomNouvelAlbum) {
        inputNomNouvelAlbum.addEventListener('input', function() {
            btnSubmitNouvelAlbum.disabled = !this.value.trim();
        });

        formNouvelAlbum.addEventListener('submit', async function(event) {
            event.preventDefault();
            const nomAlbum = inputNomNouvelAlbum.value.trim();
            const descAlbum = inputDescNouvelAlbum ? inputDescNouvelAlbum.value.trim() : "";

            if (!nomAlbum) {
                alert("Le nom de l'album est requis.");
                return;
            }

            btnSubmitNouvelAlbum.disabled = true; // Désactiver pendant le traitement

            try {
                const createdAlbum = await createAlbum(nomAlbum, descAlbum);
                if (createdAlbum && createdAlbum.id) {
                    if (currentPropertyIdToSave) {
                        // Si une annonce attendait d'être sauvegardée, on l'ajoute au nouvel album
                        // savePropertyToAlbum s'occupera de fermer la modale
                        await savePropertyToAlbum(currentPropertyIdToSave, createdAlbum.id, createdAlbum.name_Album);
                    } else {
                        // Album créé "seul", sans annonce en attente
                        await populateModalWithAlbums(); // Recharger la liste
                        showModalView(MODAL_VIEW_ALBUM_LIST_ID); // Revenir à la liste
                        triggerSaveAnimation(`Album "${createdAlbum.name_Album}" créé`);
                        tryCloseModal(); // Fermer la modale
                    }
                    // Réinitialiser les champs du formulaire de création
                    inputNomNouvelAlbum.value = '';
                    if(inputDescNouvelAlbum) inputDescNouvelAlbum.value = '';
                }
            } catch (error) {
                // L'erreur est déjà gérée et alertée dans createAlbum ou savePropertyToAlbum
                console.error('[FAVORITES_ALBUM_MANAGER] Erreur lors de la soumission du formulaire de création d\'album:', error);
            } finally {
                // Réactiver le bouton seulement si le nom est vide (ou le laisser désactivé si le nom est rempli,
                // car la modale devrait être fermée ou la vue changée)
                if(inputNomNouvelAlbum) btnSubmitNouvelAlbum.disabled = !inputNomNouvelAlbum.value.trim();

                // Cacher les messages de succès/échec Webflow natifs s'ils existent
                const parentForm = formNouvelAlbum.parentElement;
                if (parentForm) {
                    const wfDone = parentForm.querySelector('.w-form-done');
                    const wfFail = parentForm.querySelector('.w-form-fail');
                    if (wfDone) wfDone.style.display = 'none';
                    if (wfFail) wfFail.style.display = 'none';
                }
            }
        });
    }

    // Navigation dans la modale
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
        let animationElement = document.getElementById('save-confirmation-animation');
        if (!animationElement) {
            animationElement = document.createElement('div');
            animationElement.id = 'save-confirmation-animation';
            // Styles basiques, à affiner en CSS pour une meilleure apparence et positionnement
            Object.assign(animationElement.style, {
                position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)',
                padding: '10px 20px', backgroundColor: 'rgba(0,0,0,0.8)', color: 'white',
                borderRadius: '5px', zIndex: '10001', opacity: '0', transition: 'opacity 0.5s ease-in-out'
            });
            document.body.appendChild(animationElement);
        }

        animationElement.textContent = message;
        animationElement.style.opacity = '1';
        setTimeout(() => {
            animationElement.style.opacity = '0';
        }, 2500); // L'animation reste visible pendant 2.5 secondes
    }

    // Initialisation au chargement de la page
    (async () => {
        await fetchAndStoreUserFavoriteItems(); // Récupérer les favoris existants
        initPropertyHeartButtons(); // Attacher les écouteurs aux boutons coeur
    })();

    // Écouteur pour les événements personnalisés (si les annonces sont chargées dynamiquement)
    document.addEventListener('annoncesChargeesEtRendues', async function() {
        console.log('[FAVORITES_ALBUM_MANAGER] Événement "annoncesChargeesEtRendues" reçu. Réinitialisation des boutons favoris.');
        // Délai pour s'assurer que le DOM est pleinement à jour
        setTimeout(initPropertyHeartButtons, 100);
    });

    // Gérer les changements d'état d'authentification
    document.addEventListener('authStateChanged', async function(event) {
        console.log('[FAVORITES_ALBUM_MANAGER] Événement "authStateChanged" reçu.');
        updateAuthToken();
        await fetchAndStoreUserFavoriteItems(); // Mettre à jour les favoris

        const isLoggedIn = event.detail ? event.detail.isLoggedIn : !!authToken;

        if (!isLoggedIn && modalElement && modalElement.style.display !== 'none' && modalElement.style.display !== '') {
            // Si l'utilisateur se déconnecte pendant que la modale est ouverte
            tryCloseModal();
            alert("Vous avez été déconnecté. La fenêtre des favoris va se fermer.");
        } else if (isLoggedIn && modalElement && modalElement.style.display !== 'none' && modalElement.style.display !== '') {
            // Si l'état change (par exemple, re-connexion) et que la modale est ouverte, rafraîchir la liste
            await populateModalWithAlbums();
        }
    });
    
    console.log("[FAVORITES_ALBUM_MANAGER] Script initialisé et écouteurs attachés.");
});

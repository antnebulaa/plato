// favorites-manager.js (entièrement revu pour la logique d'albums)
document.addEventListener('DOMContentLoaded', function () {
    console.log('[FAVORITES_ALBUM_MANAGER] DOMContentLoaded.');

    // Vérifications XanoClient et getCookie (essentielles)
    if (typeof XanoClient === 'undefined') {
        console.error("[FAVORITES_ALBUM_MANAGER] ERREUR CRITIQUE: XanoClient non défini.");
        return;
    }
    if (typeof getCookie !== 'function') {
        console.error("[FAVORITES_ALBUM_MANAGER] ERREUR CRITIQUE: getCookie non défini.");
        return;
    }

    const FAVORITES_API_BASE_URL = 'https://xwxl-obyg-b3e3.p7.xano.io/api:7u3_oKu9'; // URL de votre groupe d'API favoris
    const favoritesXanoClient = new XanoClient({ apiGroupBaseUrl: FAVORITES_API_BASE_URL });
    let authToken = getCookie('xano_auth_token');

    function updateAuthToken() {
        authToken = getCookie('xano_auth_token');
        if (authToken) {
            favoritesXanoClient.setAuthToken(authToken);
        } else {
            favoritesXanoClient.setAuthToken(null);
        }
    }
    updateAuthToken(); // Appel initial

    let currentPropertyIdToSave = null; // Stocke l'ID de l'annonce en cours de sauvegarde
    let userAlbums = []; // Pour stocker les albums de l'utilisateur [{id, name_Album, ...}, ...]
    let userFavoriteItems = new Map(); // Stocke les items favoris : property_id => { favorites_list_id, album_id, album_name }

    // IDs des éléments de votre modale (à adapter)
    const MODAL_ID = 'modale-favorites'; // L'ID de votre modale principale
    const MODAL_LISTE_ALBUMS_CONTENEUR_ID = 'modal-liste-albums-conteneur'; // Où la liste des albums sera injectée
    const TEMPLATE_ITEM_ALBUM_MODAL_ID = 'template-item-album-modal'; // Le template d'un item album
    const BTN_OUVRIR_FORM_NOUVEL_ALBUM_ID = 'btn-ouvrir-form-nouvel-album'; // Bouton pour afficher le form
    const FORM_NOUVEL_ALBUM_ID = 'form-nouvel-album'; // Le formulaire de création
    const INPUT_NOM_NOUVEL_ALBUM_ID = 'input-nom-nouvel-album';
    const INPUT_DESC_NOUVEL_ALBUM_ID = 'input-desc-nouvel-album'; // Optionnel
    const BTN_SUBMIT_NOUVEL_ALBUM_ID = 'btn-submit-nouvel-album';
    const MESSAGE_MODAL_ALBUMS_ID = 'message-modal-albums'; // Pour "Chargement", "Aucun album"

    const modalElement = document.getElementById(MODAL_ID);
    const modalListeAlbumsConteneur = document.getElementById(MODAL_LISTE_ALBUMS_CONTENEUR_ID);
    const templateItemAlbumModal = document.getElementById(TEMPLATE_ITEM_ALBUM_MODAL_ID);
    const btnOuvrirFormNouvelAlbum = document.getElementById(BTN_OUVRIR_FORM_NOUVEL_ALBUM_ID);
    const formNouvelAlbum = document.getElementById(FORM_NOUVEL_ALBUM_ID);
    const inputNomNouvelAlbum = document.getElementById(INPUT_NOM_NOUVEL_ALBUM_ID);
    const inputDescNouvelAlbum = document.getElementById(INPUT_DESC_NOUVEL_ALBUM_ID);
    const btnSubmitNouvelAlbum = document.getElementById(BTN_SUBMIT_NOUVEL_ALBUM_ID);
    const messageModalAlbums = document.getElementById(MESSAGE_MODAL_ALBUMS_ID);

    // Vérification que les éléments de la modale existent (sauf le template qui est optionnel au début)
    if (!modalElement || !modalListeAlbumsConteneur || !btnOuvrirFormNouvelAlbum || !formNouvelAlbum || !inputNomNouvelAlbum || !btnSubmitNouvelAlbum || !messageModalAlbums) {
        console.warn('[FAVORITES_ALBUM_MANAGER] Un ou plusieurs éléments de la modale sont introuvables. Vérifiez les IDs.');
        // Ne pas bloquer tout le script, car les boutons "coeur" sur les annonces doivent toujours fonctionner pour ouvrir la modale.
    }


    // --- NOUVEAU : RÉCUPÉRER LES ITEMS FAVORIS DE L'UTILISATEUR AU CHARGEMENT ---
    async function fetchAndStoreUserFavoriteItems() {
        updateAuthToken();
        if (!authToken) {
            console.log('[FAVORITES_ALBUM_MANAGER] Non connecté, impossible de récupérer les favoris.');
            userFavoriteItems.clear();
            return;
        }
        try {
            console.log('[FAVORITES_ALBUM_MANAGER] Récupération de tous les items favoris de l\'utilisateur...');
            // Assurez-vous que cet endpoint Xano retourne bien id (de favorites_list), property_id, favorites_album_id, name_Album
            const favoriteEntries = await favoritesXanoClient.get('favorites_list'); // Adaptez le nom de l'endpoint

            userFavoriteItems.clear();
            if (favoriteEntries && Array.isArray(favoriteEntries)) {
                favoriteEntries.forEach(entry => {
                    userFavoriteItems.set(entry.property_id.toString(), { // Clé = property_id en string
                        favoritesListId: entry.id, // ID de l'enregistrement dans la table favorites_list
                        albumId: entry.favorites_album_id,
                        albumName: entry.name_Album || 'Album inconnu' // Nom de l'album
                    });
                });
            }
            console.log('[FAVORITES_ALBUM_MANAGER] Items favoris stockés:', userFavoriteItems);
        } catch (error) {
            console.error('[FAVORITES_ALBUM_MANAGER] Erreur lors de la récupération des items favoris:', error);
            userFavoriteItems.clear();
        }
    }

    // --- MISE À JOUR DE L'UI DES BOUTONS COEUR ---
    function updateAllHeartButtonsUI() {
        document.querySelectorAll('.favorite-btn').forEach(button => {
            const propertyId = button.dataset.propertyId;
            if (propertyId && userFavoriteItems.has(propertyId)) {
                const favoriteInfo = userFavoriteItems.get(propertyId);
                button.classList.add('is-favorited'); // Classe pour le style "coeur plein"
                button.querySelector('.favorite-text').textContent = 'Sauvegardé'; // Ou un texte plus court
                button.dataset.favoritesListId = favoriteInfo.favoritesListId; // Stocker pour la suppression
                button.dataset.albumId = favoriteInfo.albumId;
                button.dataset.albumName = favoriteInfo.albumName;
            } else if (propertyId) {
                button.classList.remove('is-favorited');
                button.querySelector('.favorite-text').textContent = 'Ajouter aux favoris';
                delete button.dataset.favoritesListId;
                delete button.dataset.albumId;
                delete button.dataset.albumName;
            }
        });
    }

// --- GESTION DU CLIC SUR L'ICÔNE "COEUR" (MODIFIÉE) ---
    function initPropertyHeartButtons() {
        console.log('[FAVORITES_ALBUM_MANAGER] APPEL DE initPropertyHeartButtons');
        const buttons = document.querySelectorAll('.favorite-btn');
        console.log(`[FAVORITES_ALBUM_MANAGER] Trouvé ${buttons.length} bouton(s) avec la classe .favorite-btn`);
        // ... (vérification buttons.length === 0) ...

        buttons.forEach(button => {
            // ... (console.log d'attachement) ...
            button.addEventListener('click', async function (event) {
                event.preventDefault();
                event.stopPropagation();
                console.log(`[FAVORITES_ALBUM_MANAGER] CLIC DÉTECTÉ sur .favorite-btn (property_id: ${this.dataset.propertyId})`);

                updateAuthToken();
                if (!authToken) {
                    alert("Veuillez vous connecter.");
                    return;
                }

                const clickedPropertyId = this.dataset.propertyId;
                if (!clickedPropertyId || clickedPropertyId === "[REMPLACER_PAR_ID_ANNONCE]") {
                    // ... (erreur ID manquant) ...
                    return;
                }

                if (this.classList.contains('is-favorited')) {
                    // --- DÉJÀ EN FAVORI : On supprime ---
                    const favoritesListId = this.dataset.favoritesListId;
                    const albumName = this.dataset.albumName || 'cet album';
                    if (favoritesListId) {
                        await removePropertyFromAlbum(favoritesListId, clickedPropertyId, albumName, this);
                    } else {
                        console.error("Tentative de suppression mais favoritesListId manquant sur le bouton.", this);
                        alert("Erreur : Impossible de déterminer quel favori supprimer.");
                        // Peut-être forcer un re-fetch des favoris pour corriger l'état du bouton
                        await fetchAndStoreUserFavoriteItems();
                        updateAllHeartButtonsUI();
                    }
                } else {
                    // --- PAS ENCORE EN FAVORI : On ouvre la modale pour sauvegarder ---
                    currentPropertyIdToSave = clickedPropertyId;
                    console.log(`[FAVORITES_ALBUM_MANAGER] Sauvegarde demandée pour property_id: ${currentPropertyIdToSave}`);
                    await populateModalWithAlbums(); 
                    const hiddenTrigger = document.getElementById('hidden-finsweet-album-trigger');
                    if (hiddenTrigger) {
                        hiddenTrigger.click();
                    } else { /* ... erreur trigger caché ... */ }
                }
            });
        });
        // Mettre à jour l'UI initiale des boutons après avoir attaché les écouteurs
        updateAllHeartButtonsUI();
    }

// La fonction populateModalWithAlbums reste la même que dans ma réponse précédente.
// Elle s'occupe de mettre à jour le contenu de la modale identifiée par MODAL_ID.
async function populateModalWithAlbums() {
    console.log("[FAVORITES_ALBUM_MANAGER] Entrée dans populateModalWithAlbums.");

    // Vérification des éléments essentiels de la modale
    if (!modalElement) { // modalElement est défini en haut du script via getElementById(MODAL_ID)
        console.error("[FAVORITES_ALBUM_MANAGER] ERREUR CRITIQUE: L'élément principal de la modale (MODAL_ID: '" + MODAL_ID + "') est introuvable ! Le contenu ne peut pas être chargé.");
        // alert("Erreur de configuration : la modale principale des favoris est introuvable."); // Vous pouvez décommenter l'alerte si besoin
        return; // Arrêt si la modale principale n'est pas trouvée
    }
    if (!modalListeAlbumsConteneur) {
        console.error("[FAVORITES_ALBUM_MANAGER] ERREUR CRITIQUE: Le conteneur de liste d'albums (MODAL_LISTE_ALBUMS_CONTENEUR_ID: '" + MODAL_LISTE_ALBUMS_CONTENEUR_ID + "') est introuvable dans la modale !");
        if (messageModalAlbums) messageModalAlbums.textContent = "Erreur de configuration interne de la modale."; else console.error("[FAVORITES_ALBUM_MANAGER] messageModalAlbums est aussi introuvable.");
        return; // Arrêt si le conteneur de liste n'est pas trouvé
    }
    if (!messageModalAlbums) {
        console.warn("[FAVORITES_ALBUM_MANAGER] AVERTISSEMENT: L'élément pour les messages (MESSAGE_MODAL_ALBUMS_ID: '" + MESSAGE_MODAL_ALBUMS_ID + "') est introuvable.");
        // Ce n'est pas bloquant, mais les messages de chargement/erreur ne s'afficheront pas.
    }

    // Afficher le message de chargement
    if (messageModalAlbums) {
        messageModalAlbums.textContent = 'Chargement de vos albums...';
        messageModalAlbums.style.display = 'block';
    }
    modalListeAlbumsConteneur.innerHTML = ''; // Vider la liste au cas où
    if(formNouvelAlbum) formNouvelAlbum.style.display = 'none'; // Cacher le formulaire de création

    // Vérification du token d'authentification
    updateAuthToken(); // S'assurer que authToken est à jour
    console.log("[FAVORITES_ALBUM_MANAGER] populateModalWithAlbums: Valeur de authToken après updateAuthToken():", authToken ? "Token Présent" : "Token ABSENT ou NULL");

    if (!authToken) {
        console.warn("[FAVORITES_ALBUM_MANAGER] populateModalWithAlbums: authToken est ABSENT. Arrêt de la récupération des albums. L'utilisateur doit être connecté.");
        if (messageModalAlbums) messageModalAlbums.textContent = "Veuillez vous connecter pour voir vos albums.";
        if(btnOuvrirFormNouvelAlbum) btnOuvrirFormNouvelAlbum.style.display = 'none'; // Cacher le bouton de création si non connecté
        return; // Arrêt si pas de token
    } else {
        // Si connecté, le bouton de création d'album devrait être géré par la logique d'affichage ()
        if(btnOuvrirFormNouvelAlbum) btnOuvrirFormNouvelAlbum.style.display = ''; // Ou le style par défaut
    }

    // Si on arrive ici, les éléments de la modale sont trouvés ET authToken est présent.
    try {
        console.log("[FAVORITES_ALBUM_MANAGER] Tentative de récupération des albums depuis Xano (GET /favorites_album)...");
        const albumsResponse = await favoritesXanoClient.get('favorites_album'); 
        console.log("[FAVORITES_ALBUM_MANAGER] Réponse BRUTE de Xano pour GET /favorites_album:", JSON.stringify(albumsResponse)); // Log de la réponse brute

        userAlbums = (Array.isArray(albumsResponse)) ? albumsResponse : (albumsResponse && Array.isArray(albumsResponse.items)) ? albumsResponse.items : [];
        console.log(`[FAVORITES_ALBUM_MANAGER] ${userAlbums.length} albums traités après parsing de la réponse.`);
        
        renderAlbumListInModal(userAlbums); // Appel pour afficher les albums

    } catch (error) {
        console.error("[FAVORITES_ALBUM_MANAGER] ERREUR lors de l'appel à Xano pour GET /favorites_album:", error);
        if (messageModalAlbums) {
            messageModalAlbums.textContent = "Erreur lors du chargement de vos albums.";
            if (error.message && (error.message.toLowerCase().includes('unauthorized') || error.message.includes('401'))) {
                messageModalAlbums.textContent = "Votre session a peut-être expiré ou une authentification est requise. Veuillez vous reconnecter.";
            }
        }
    }
}



    // --- 3. AFFICHAGE DE LA LISTE DES ALBUMS DANS LA MODALE ---
    // Dans favorites-manager.js
function renderAlbumListInModal(albums) {
    if (!modalListeAlbumsConteneur) { // Simplification du garde-fou initial
        console.error("MODAL_LISTE_ALBUMS_CONTENEUR_ID non trouvé.");
        return;
    }
    // messageModalAlbums est utilisé plus loin, sa vérification peut rester là.
    
    modalListeAlbumsConteneur.innerHTML = ''; // Vider

    if (!templateItemAlbumModal) {
        if (messageModalAlbums) messageModalAlbums.textContent = "Erreur : Template pour item d'album non trouvé.";
        console.error("TEMPLATE_ITEM_ALBUM_MODAL_ID non trouvé dans le DOM.");
        return;
    }

    if (albums.length === 0) {
        if (messageModalAlbums) {
            messageModalAlbums.textContent = "Vous n'avez aucun album. Créez-en un !";
            messageModalAlbums.style.display = 'block';
        }
         // Afficher le bouton de création d'album même s'il n'y a pas d'albums
        if(btnOuvrirFormNouvelAlbum) btnOuvrirFormNouvelAlbum.style.display = ''; // Ou 'block', etc.
    } else {
        if (messageModalAlbums) messageModalAlbums.style.display = 'none'; // Cacher le message s'il y a des albums
        if(btnOuvrirFormNouvelAlbum) btnOuvrirFormNouvelAlbum.style.display = ''; // S'assurer qu'il est visible

        albums.forEach(album => {
            const clone = templateItemAlbumModal.cloneNode(true);
            clone.removeAttribute('id'); // Important

            // === MODIFICATION IMPORTANTE ICI ===
            // Si votre template est caché avec display:none, rendez le clone visible.
            // Choisissez le type de display qui convient à vos items d'album.
            // 'block' est un bon point de départ pour des items en liste.
            clone.style.display = 'flex'; 
            // Si vous utilisez Flexbox pour la liste, ce pourrait être 'flex'.
            // Si le template était caché par une classe spécifique (ex: 'is-hidden'),
            // vous feriez : clone.classList.remove('is-hidden'); ET vous assureriez son display.
            // === FIN DE LA MODIFICATION IMPORTANTE ===

            const nameElement = clone.querySelector('[data-album-name]');
            if (nameElement) {
                nameElement.textContent = album.name_Album || 'Album sans nom';
            }
            clone.dataset.albumId = album.id;

            clone.addEventListener('click', async function () {
                const albumId = this.dataset.albumId;
                // On ne ferme plus la modale ici, on la laisse ouverte pour que l'utilisateur puisse
                // voir l'action et éventuellement interagir avec le bouton "enregistré" ou
                // la fermer lui-même. La fermeture est gérée par Finsweet ou une action utilisateur.
                 console.log(`[FAVORITES_ALBUM_MANAGER] CLIC SUR ALBUM DANS MODALE - Album ID: ${albumId}, Property ID à sauvegarder: ${currentPropertyIdToSave}`);

    if (!currentPropertyIdToSave) {
        console.error("[FAVORITES_ALBUM_MANAGER] ERREUR: currentPropertyIdToSave est null au moment de cliquer sur un album !");
        alert("Erreur : Aucune annonce n'a été sélectionnée pour la sauvegarde.");
        return;
    }
                await (currentPropertyIdToSave, albumId); 
                // Après sauvegarde, on pourrait vouloir rafraîchir l'état du bouton coeur sur la page principale,
                // ou afficher un état "enregistré" dans la modale pour cet album.
            });
            modalListeAlbumsConteneur.appendChild(clone);
        });
    }
}

// REMPLACEZ VOTRE FONCTION savePropertyToAlbum (lignes 243 à 280) PAR CELLE-CI :
async function savePropertyToAlbum(propertyId, albumId) {
    if (!propertyId || !albumId) {
        console.error("[FAVORITES_ALBUM_MANAGER] savePropertyToAlbum (LOG S1): ID de propriété ou d'album MANQUANT. propertyId:", propertyId, "albumId:", albumId);
        return; 
    }
    console.log(`[FAVORITES_ALBUM_MANAGER] savePropertyToAlbum (LOG S2): Tentative d'ajout de property_id ${propertyId} à album_id ${albumId}`);

    try {
        // --- UN SEUL APPEL XANO POUR AJOUTER À favorites_list ---
        // Xano DOIT retourner l'objet de l'entrée créée avec au moins id, property_id, et favorites_album_id.
        // Idéalement, aussi name_Album si vous l'avez configuré dans Xano pour cet endpoint POST.
        const newFavoriteEntry = await favoritesXanoClient.post('favorites_list', {
            favorites_album_id: parseInt(albumId),
            property_id: parseInt(propertyId)
        });
        // ----------------------------------------------------

        console.log("[FAVORITES_ALBUM_MANAGER] savePropertyToAlbum (LOG S3): Réponse de Xano après POST à /favorites_list:", JSON.stringify(newFavoriteEntry));

        // Vérification cruciale de la réponse de Xano :
        if (newFavoriteEntry && newFavoriteEntry.id && newFavoriteEntry.property_id && typeof newFavoriteEntry.favorites_album_id !== 'undefined') {
            console.log("[FAVORITES_ALBUM_MANAGER] savePropertyToAlbum (LOG S4): Annonce ajoutée, réponse Xano VALIDE:", newFavoriteEntry);
            
            // Essayer de trouver le nom de l'album à partir de userAlbums (liste déjà chargée pour la modale)
            // ou utiliser celui retourné par Xano si disponible dans newFavoriteEntry.
            const albumData = userAlbums.find(a => a.id === newFavoriteEntry.favorites_album_id);
            const albumNameForResult = (newFavoriteEntry.name_Album || (albumData ? albumData.name_Album : 'cet album'));

            // Mettre à jour notre 'store' local userFavoriteItems
            userFavoriteItems.set(newFavoriteEntry.property_id.toString(), {
                favoritesListId: newFavoriteEntry.id,
                albumId: newFavoriteEntry.favorites_album_id,
                albumName: albumNameForResult
            });
            console.log("[FAVORITES_ALBUM_MANAGER] savePropertyToAlbum (LOG S5): userFavoriteItems mis à jour:", userFavoriteItems);
            
            updateAllHeartButtonsUI(); // Mettre à jour l'UI de tous les boutons coeur sur la page
            triggerSaveAnimation("Enregistré ! ✅"); // Animation de confirmation

            // La fermeture de la modale est gérée par Finsweet ou une action utilisateur (bouton fermer).
            // On ne la ferme PAS activement ici avec modalElement.style.display = 'none';

        } else {
            console.error("[FAVORITES_ALBUM_MANAGER] savePropertyToAlbum (LOG S6): Réponse INVALIDE de Xano après POST à /favorites_list. L'enregistrement a peut-être échoué côté serveur ou la réponse n'a pas le format attendu (besoin de: id, property_id, favorites_album_id). Réponse reçue:", newFavoriteEntry);
            alert("Un problème est survenu lors de la sauvegarde. Le serveur n'a pas confirmé l'enregistrement correctement.");
        }
    } catch (error) {
        console.error("[FAVORITES_ALBUM_MANAGER] savePropertyToAlbum (LOG S7): ERREUR lors de l'appel POST à /favorites_list:", error.message, error);
        alert(`Erreur lors de la sauvegarde : ${error.message || "Impossible d'ajouter l'annonce à l'album."}`);
        // Optionnel: resynchroniser si l'opération échoue de manière inattendue
        // await fetchAndStoreUserFavoriteItems();
        // updateAllHeartButtonsUI();
    }
}
    
    // --- NOUVEAU : SUPPRIMER L'ANNONCE D'UN ALBUM ---
    async function removePropertyFromAlbum(favoritesListId, propertyId, albumName, buttonElement) {
        console.log(`[FAVORITES_ALBUM_MANAGER] Suppression de l'item favori (favorites_list_id: ${favoritesListId}) pour property_id ${propertyId}`);
        try {
            // DELETE à /favorites_list/{favorites_list_id}
            await favoritesXanoClient.delete(`favorites_list/${favoritesListId}`);
            
            console.log("[FAVORITES_ALBUM_MANAGER] Annonce supprimée de l'album avec succès via Xano.");
            userFavoriteItems.delete(propertyId.toString()); // Mettre à jour le store local
            updateAllHeartButtonsUI(); // Mettre à jour l'UI du bouton (et des autres potentiellement)

            triggerSaveAnimation(`Supprimé de ${albumName} 👋`); // Animation de confirmation de suppression

        } catch (error) {
            console.error("[FAVORITES_ALBUM_MANAGER] Erreur lors de la suppression de l'annonce de l'album:", error);
            alert(`Erreur : ${error.message || "Impossible de supprimer l'annonce de l'album."}`);
            // Si erreur, on pourrait vouloir re-synchroniser l'état pour être sûr
            await fetchAndStoreUserFavoriteItems();
            updateAllHeartButtonsUI();
        }
    }
    

    // --- GESTION DE LA CRÉATION D'UN NOUVEL ALBUM (MODIFIÉE pour mettre à jour userAlbums) ---
    if (formNouvelAlbum && btnSubmitNouvelAlbum && inputNomNouvelAlbum) {
        formNouvelAlbum.addEventListener('submit', async function(event) {
            // ... (preventDefault, nomAlbum, descAlbum, vérification nomAlbum comme avant) ...
            try {
                // La réponse de POST /favorites_album devrait retourner le nouvel album créé
                const newAlbum = await favoritesXanoClient.post('favorites_album', {
                    name_Album: nomAlbum,
                    description_album: descAlbum
                });

                if (newAlbum && newAlbum.id) {
                    console.log("[FAVORITES_ALBUM_MANAGER] Nouvel album créé avec succès:", newAlbum);
                    // Pas besoin de refaire un fetch complet des albums si Xano retourne le nouvel album
                    // On pourrait l'ajouter directement à userAlbums et re-render la liste dans la modale.
                    // Cependant, pour garder la robustesse et la simplicité, un re-fetch est plus sûr.
                } else {
                     console.warn("[FAVORITES_ALBUM_MANAGER] La création d'album n'a pas retourné le nouvel album.", newAlbum);
                }
                // ... (vider les champs, cacher le formulaire) ...
    // Recharger la liste des albums dans la modale pour afficher le nouveau
    // await openAndPopulateSelectAlbumModal(); // << ANCIENNE LIGNE À CHANGER
    await populateModalWithAlbums(); // << NOUVELLE LIGNE CORRECTE
} catch (error) {
                console.error("[FAVORITES_ALBUM_MANAGER] Erreur lors de la création de l'album:", error);
                alert(`Erreur : ${error.message || "Impossible de créer l'album."}`);
            } finally {
                btnSubmitNouvelAlbum.disabled = false;
            }
        });
    }


    // --- 6. ANIMATION DE CONFIRMATION (Exemple simple) ---
     function triggerSaveAnimation(message) {
        let animationElement = document.getElementById('save-confirmation-animation');
        if (!animationElement) {
            animationElement = document.createElement('div');
            animationElement.id = 'save-confirmation-animation';
            animationElement.textContent = 'Enregistré ! ✅';
            Object.assign(animationElement.style, {
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                padding: '20px 40px',
                backgroundColor: 'rgba(0,0,0,0.7)',
                color: 'white',
                borderRadius: '8px',
                zIndex: '10000',
                fontSize: '20px',
                opacity: '0',
                transition: 'opacity 0.5s ease-in-out, transform 0.3s ease-out'
            });
            document.body.appendChild(animationElement);
        }

        // Animation d'apparition
        setTimeout(() => {
            animationElement.style.opacity = '1';
            animationElement.style.transform = 'translate(-50%, -50%) scale(1.1)';
        }, 50); // Léger délai pour que la transition CSS s'applique

        // Animation de disparition
        setTimeout(() => {
            animationElement.style.opacity = '0';
            animationElement.style.transform = 'translate(-50%, -50%) scale(0.9)';
        }, 2000); // Disparaît après 2 secondes
         setTimeout(() => { // S'assurer que la transition est terminée avant de remettre le scale
            if(animationElement) animationElement.style.transform = 'translate(-50%, -50%) scale(1)';
        }, 2550);
    }

  // --- INITIALISATION ---
    // On doit d'abord récupérer les favoris EXISTANTS AVANT d'initialiser les boutons coeur
    // pour que leur état initial (coeur plein/vide) soit correct.
    (async () => {
        await fetchAndStoreUserFavoriteItems(); // Récupérer les favoris
        initPropertyHeartButtons(); // Puis initialiser les boutons avec le bon état
    })();


    // ... (écouteurs pour 'authStateChanged' et 'annoncesChargeesEtRendues' comme avant) ...
    // Dans l'écouteur 'annoncesChargeesEtRendues', s'assurer d'appeler updateAllHeartButtonsUI()
    // après initPropertyHeartButtons() si les items favoris sont déjà chargés.
    document.addEventListener('annoncesChargeesEtRendues', async function() { // async ici
        console.log('[FAVORITES_ALBUM_MANAGER] Nouvelles annonces chargées, réinitialisation et MàJ UI des boutons coeur.');
        // Pas besoin de refaire un fetch complet des favoris ici, sauf si on suspecte des changements externes.
        // userFavoriteItems devrait être à jour.
        initPropertyHeartButtons(); // Ré-attache les listeners et met à jour les nouveaux boutons individuellement si besoin
        updateAllHeartButtonsUI(); // Assure que tous les boutons (anciens et nouveaux) reflètent l'état actuel de userFavoriteItems
    });

     document.addEventListener('authStateChanged', async function() { // async ici
        console.log('[FAVORITES_ALBUM_MANAGER] État d\'authentification changé.');
        updateAuthToken();
        await fetchAndStoreUserFavoriteItems(); // Re-fetch les favoris
        updateAllHeartButtonsUI(); // Mettre à jour l'UI de tous les boutons coeur
        // Gérer l'état de la modale si elle est ouverte et que l'utilisateur se déconnecte, etc.
    });

    // ... (populateModalWithAlbums, renderAlbumListInModal comme dans la version précédente)
    // Assurez-vous que la définition de populateModalWithAlbums et renderAlbumListInModal
    // est bien celle qui utilise le template Webflow et gère les messages "Chargement...", etc.
});

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

// --- 1. GESTION DU CLIC SUR L'ICÔNE "COEUR" D'UNE ANNONCE ---

// Dans favorites-manager.js
function initPropertyHeartButtons() {
    console.log('[FAVORITES_ALBUM_MANAGER] APPEL DE initPropertyHeartButtons');
    const buttons = document.querySelectorAll('.favorite-btn'); // Cible toujours .favorite-btn
    console.log(`[FAVORITES_ALBUM_MANAGER] Trouvé ${buttons.length} bouton(s) avec la classe .favorite-btn`);

    if (buttons.length === 0) {
        console.warn("[FAVORITES_ALBUM_MANAGER] AUCUN bouton .favorite-btn trouvé.");
        return;
    }

    buttons.forEach(button => {
        const propertyIdFromButton = button.dataset.propertyId;
        console.log(`[FAVORITES_ALBUM_MANAGER] Attachement de l'écouteur au bouton pour property_id: ${propertyIdFromButton}`, button);

        // Utiliser la phase de bubbling par défaut (false implicite ou explicite)
        // car nous ne voulons plus être "ultra-agressifs" si ce n'est plus nécessaire
        // après avoir découplé le trigger Finsweet.
        button.addEventListener('click', async function (event) { // Rendre la fonction async ici
            console.log(`[FAVORITES_ALBUM_MANAGER] CLIC DÉTECTÉ sur .favorite-btn (property_id: ${this.dataset.propertyId})`);
            
            event.preventDefault(); // Essentiel pour arrêter la navigation du lien parent
            event.stopPropagation();  // Essentiel pour arrêter la propagation au lien parent

            console.log('[FAVORITES_ALBUM_MANAGER] Propagation et action par défaut stoppées.');

            updateAuthToken();
            if (!authToken) {
                alert("Veuillez vous connecter pour sauvegarder une annonce.");
                return;
            }

            currentPropertyIdToSave = this.dataset.propertyId;
            if (!currentPropertyIdToSave || currentPropertyIdToSave === "[REMPLACER_PAR_ID_ANNONCE]") {
                console.error("ID de propriété manquant ou non remplacé sur le bouton (data-property-id). Bouton:", this);
                alert("Erreur : ID de propriété de l'annonce non trouvé sur ce bouton.");
                return;
            }
            console.log(`[FAVORITES_ALBUM_MANAGER] Sauvegarde demandée pour property_id: ${currentPropertyIdToSave}`);
            
            // 1. Peupler la modale (cela prépare le contenu)
            await populateModalWithAlbums(); 
            
            // 2. Puis déclencher le clic sur le bouton Finsweet caché pour ouvrir la modale
            const hiddenTrigger = document.getElementById('hidden-finsweet-album-trigger');
            if (hiddenTrigger) {
                console.log('[FAVORITES_ALBUM_MANAGER] Déclenchement du bouton Finsweet caché.');
                hiddenTrigger.click(); // Ceci va demander à Finsweet d'ouvrir la modale
            } else {
                console.error("Bouton déclencheur Finsweet caché (hidden-finsweet-album-trigger) non trouvé !");
                alert("Erreur : Impossible d'ouvrir la modale des favoris.");
            }
        } /*, false*/ ); // 'false' ou rien pour la phase de bubbling (par défaut)
    });
}

// La fonction populateModalWithAlbums reste la même que dans ma réponse précédente.
// Elle s'occupe de mettre à jour le contenu de la modale identifiée par MODAL_ID.
async function populateModalWithAlbums() {
    if (!modalElement || !messageModalAlbums || !modalListeAlbumsConteneur) {
        console.error("Éléments essentiels de la modale des albums non trouvés...");
        alert("Erreur : Configuration de la modale des favoris incomplète.");
        return;
    }
    messageModalAlbums.textContent = 'Chargement de vos albums...';
    // ... (reste de la fonction populateModalWithAlbums comme précédemment) ...
    // Elle se termine par renderAlbumListInModal(userAlbums); ou un message d'erreur.
}

// La fonction savePropertyToAlbum doit aussi être modifiée pour ne plus cacher modalElement,
// car Finsweet s'en charge.
async function savePropertyToAlbum(propertyId, albumId) {
    // ... (début de la fonction identique : vérifications, appel Xano)
    try {
        await favoritesXanoClient.post('favorites_list', { /* ... */ });
        console.log("[FAVORITES_ALBUM_MANAGER] Annonce ajoutée à l'album avec succès !");

        // Fermer la modale VIA FINSWEET si possible, ou laisser l'utilisateur le faire.
        // Si vous avez un bouton de fermeture DANS la modale avec un attribut Finsweet "close",
        // c'est mieux. Sinon, pour l'instant, on ne force pas la fermeture ici.
        // if (modalElement) modalElement.style.display = 'none'; // ON NE FAIT PLUS CA

        // Si Finsweet a une API JS pour fermer :
        // FinsweetModal.close('votre-id-de-modale'); // Exemple conceptuel
        // Ou si votre bouton "Enregistrer" dans la modale a un custom property qui ferme la modale,
        // cette fonction n'a rien de plus à faire pour la fermeture.

        triggerSaveAnimation();

    } catch (error) {
        console.error("[FAVORITES_ALBUM_MANAGER] Erreur lors de la récupération des albums pour la modale:", error);
        messageModalAlbums.textContent = "Erreur lors du chargement de vos albums.";
         if (error.message.toLowerCase().includes('unauthorized') || error.message.includes('401')) {
            messageModalAlbums.textContent = "Votre session a peut-être expiré. Veuillez vous reconnecter.";
        }
    }
}

    // --- 3. AFFICHAGE DE LA LISTE DES ALBUMS DANS LA MODALE ---
    function renderAlbumListInModal(albums) {
        if (!modalListeAlbumsConteneur || !messageModalAlbums) return;
        modalListeAlbumsConteneur.innerHTML = ''; // Vider

        if (!templateItemAlbumModal) {
             messageModalAlbums.textContent = "Erreur : Template pour item d'album non trouvé.";
             console.error("TEMPLATE_ITEM_ALBUM_MODAL_ID non trouvé dans le DOM.");
             return;
        }

        if (albums.length === 0) {
            messageModalAlbums.textContent = "Vous n'avez aucun album. Créez-en un !";
            messageModalAlbums.style.display = 'block';
        } else {
            messageModalAlbums.style.display = 'none'; // Cacher le message s'il y a des albums
            albums.forEach(album => {
                const clone = templateItemAlbumModal.cloneNode(true);
                clone.removeAttribute('id');
                clone.style.display = ''; // Rendre visible

                // Remplir le nom de l'album (adaptez le sélecteur si besoin)
                const nameElement = clone.querySelector('[data-album-name]');
                if (nameElement) {
                    nameElement.textContent = album.name_Album || 'Album sans nom';
                }
                // Stocker l'ID de l'album sur l'élément pour le récupérer au clic
                clone.dataset.albumId = album.id;

                clone.addEventListener('click', async function () {
                    const albumId = this.dataset.albumId;
                    await savePropertyToAlbum(currentPropertyIdToSave, albumId);
                });
                modalListeAlbumsConteneur.appendChild(clone);
            });
        }
    }

    // --- 4. SAUVEGARDER L'ANNONCE DANS UN ALBUM SPÉCIFIQUE ---
    async function savePropertyToAlbum(propertyId, albumId) {
        if (!propertyId || !albumId) {
            console.error("ID de propriété ou d'album manquant pour la sauvegarde.");
            return;
        }
        console.log(`[FAVORITES_ALBUM_MANAGER] Ajout de property_id ${propertyId} à album_id ${albumId}`);
        try {
            // POST à /favorites_list avec favorites_album_id et property_id
            await favoritesXanoClient.post('favorites_list', {
                favorites_album_id: parseInt(albumId), // Assurez-vous que les types correspondent à Xano
                property_id: parseInt(propertyId)
            });
            console.log("[FAVORITES_ALBUM_MANAGER] Annonce ajoutée à l'album avec succès !");

            // Fermer la modale (votre logique)
            if (modalElement) modalElement.style.display = 'none';
            // Déclencher l'animation de confirmation
            triggerSaveAnimation();

        } catch (error) {
            console.error("[FAVORITES_ALBUM_MANAGER] Erreur lors de l'ajout de l'annonce à l'album:", error);
            alert(`Erreur : ${error.message || "Impossible d'ajouter l'annonce à l'album."}`);
        }
    }

    // --- 5. GESTION DE LA CRÉATION D'UN NOUVEL ALBUM ---
    if (btnOuvrirFormNouvelAlbum && formNouvelAlbum) {
        btnOuvrirFormNouvelAlbum.addEventListener('click', () => {
            formNouvelAlbum.style.display = 'block'; // Afficher le formulaire
            if (inputNomNouvelAlbum) inputNomNouvelAlbum.focus();
        });
    }

    if (formNouvelAlbum && btnSubmitNouvelAlbum && inputNomNouvelAlbum) {
        // Utilisation de l'événement 'submit' sur le formulaire est préférable
        // pour gérer la soumission par la touche Entrée aussi.
        formNouvelAlbum.addEventListener('submit', async function(event) {
            event.preventDefault(); // Empêcher la soumission native du formulaire
            const nomAlbum = inputNomNouvelAlbum.value.trim();
            const descAlbum = inputDescNouvelAlbum ? inputDescNouvelAlbum.value.trim() : ""; // Champ description optionnel

            if (!nomAlbum) {
                alert("Veuillez entrer un nom pour le nouvel album.");
                return;
            }
            console.log(`[FAVORITES_ALBUM_MANAGER] Création d'un nouvel album: ${nomAlbum}`);
            btnSubmitNouvelAlbum.disabled = true;
            try {
                // POST à /favorites_album avec name_Album et description_album
                await favoritesXanoClient.post('favorites_album', {
                    name_Album: nomAlbum,
                    description_album: descAlbum
                });
                console.log("[FAVORITES_ALBUM_MANAGER] Nouvel album créé avec succès !");
                if (inputNomNouvelAlbum) inputNomNouvelAlbum.value = ''; // Vider les champs
                if (inputDescNouvelAlbum) inputDescNouvelAlbum.value = '';
                formNouvelAlbum.style.display = 'none'; // Cacher le formulaire
                // Recharger la liste des albums dans la modale pour afficher le nouveau
                await openAndPopulateSelectAlbumModal();
            } catch (error) {
                console.error("[FAVORITES_ALBUM_MANAGER] Erreur lors de la création de l'album:", error);
                alert(`Erreur : ${error.message || "Impossible de créer l'album."}`);
            } finally {
                btnSubmitNouvelAlbum.disabled = false;
            }
        });
    }


    // --- 6. ANIMATION DE CONFIRMATION (Exemple simple) ---
    function triggerSaveAnimation() {
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
    initPropertyHeartButtons(); // Attacher les écouteurs aux coeurs des annonces

    // Écouter les changements d'état d'authentification pour mettre à jour le token
    document.addEventListener('authStateChanged', function() {
        console.log('[FAVORITES_ALBUM_MANAGER] État d\'authentification changé.');
        updateAuthToken();
        // Si l'utilisateur se déconnecte alors que la modale est ouverte, il faudrait la gérer.
        // Pour l'instant, le token sera juste mis à jour.
    });

    // Au cas où des annonces sont chargées dynamiquement après le DOMContentLoaded
    document.addEventListener('annoncesChargeesEtRendues', function() {
        console.log('[FAVORITES_ALBUM_MANAGER] Nouvelles annonces chargées, réinitialisation des boutons coeur.');
        initPropertyHeartButtons();
    });

});

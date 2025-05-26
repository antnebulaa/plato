// favorites-manager.js (version étendue)
document.addEventListener('DOMContentLoaded', function () {
    console.log('[FAVORITES_MANAGER] DOMContentLoaded - Initialisation du système de favoris.');

    if (typeof XanoClient === 'undefined') { /* ... erreur ... */ return; }
    if (typeof getCookie !== 'function') { /* ... erreur ... */ return; }

    const FAVORITES_API_BASE_URL = 'https://xwxl-obyg-b3e3.p7.xano.io/api:7u3_oKu9';
    const favoritesXanoClient = new XanoClient({ apiGroupBaseUrl: FAVORITES_API_BASE_URL });
    let authToken = getCookie('xano_auth_token'); // Déclarer avec let pour la réaffectation potentielle

    function updateAuthToken() { // Fonction pour mettre à jour le token si nécessaire (ex: après connexion/déconnexion)
        authToken = getCookie('xano_auth_token');
        if (authToken) {
            favoritesXanoClient.setAuthToken(authToken);
        } else {
            favoritesXanoClient.setAuthToken(null); // Important de le vider
        }
    }
    updateAuthToken(); // Appel initial

    let userFavoritePropertyIds = new Set(); // Pour les boutons "coeur"
    let userFavoritesDetails = []; // Pour la modale

    async function fetchUserFavorites(fetchDetails = false) {
        updateAuthToken(); // S'assurer que le token est à jour
        if (!authToken) {
            userFavoritePropertyIds = new Set();
            userFavoritesDetails = [];
            updateFavoriteButtonsUI(); // Mettre à jour les boutons "coeur" même si déconnecté
            return; // Ne pas essayer de fetch si pas de token
        }

        console.log('[FAVORITES_MANAGER] Récupération des favoris de l\'utilisateur...');
        try {
            // Cet endpoint devrait retourner les détails si fetchDetails = true
            // ou au moins les property_id.
            // Idéalement, Xano retourne: [{ property_id: "1", title: "Super appart", image_url: "..."}]
            const favoritesData = await favoritesXanoClient.get('favorites_album');

            if (favoritesData && Array.isArray(favoritesData)) {
                userFavoritesDetails = favoritesData; // Stocker tous les détails
                userFavoritePropertyIds = new Set(favoritesData.map(fav => fav.property_id)); // Mettre à jour l'ensemble des IDs
            } else if (favoritesData && favoritesData.items && Array.isArray(favoritesData.items)) {
                // Si Xano enveloppe dans un objet { items: [...] }
                userFavoritesDetails = favoritesData.items;
                userFavoritePropertyIds = new Set(favoritesData.items.map(fav => fav.property_id));
            } else {
                console.warn('[FAVORITES_MANAGER] Réponse inattendue de /favorites_album:', favoritesData);
                userFavoritePropertyIds = new Set();
                userFavoritesDetails = [];
            }
            console.log('[FAVORITES_MANAGER] Favoris (IDs) récupérés:', userFavoritePropertyIds);
            console.log('[FAVORITES_MANAGER] Favoris (Détails) récupérés:', userFavoritesDetails.length + " éléments.");
            updateFavoriteButtonsUI();

        } catch (error) {
            console.error('[FAVORITES_MANAGER] Erreur lors de la récupération des favoris:', error);
            userFavoritePropertyIds = new Set();
            userFavoritesDetails = [];
            updateFavoriteButtonsUI();
        }
    }

    function updateFavoriteButtonsUI() { /* ... comme avant ... */ }
    async function toggleFavorite(propertyId, buttonElement) { /* ... comme avant ... */
        // Assurez-vous d'appeler fetchUserFavorites(true) à la fin en cas de succès
        // pour que userFavoritesDetails soit à jour si la modale est ouverte ensuite.
        // try { ... if (isFavorited) { ... } else { ... }
        //    await fetchUserFavorites(true); // Re-fetch tous les détails
        //    updateFavoriteButtonsUI(); // Ceci est déjà appelé si fetchUserFavorites l'appelle
        // } catch { ... } finally { ... }
        // OU plus simple : mettre à jour localement userFavoritesDetails si vous avez l'info de l'item
        // OU laisser la modale re-fetcher quand elle s'ouvre.
        // Pour toggleFavorite, il suffit de mettre à jour userFavoritePropertyIds et l'UI des boutons.
        // La modale se chargera de son propre fetch.
        try {
            // ... (logique d'ajout/suppression avec POST/DELETE) ...
            if (isFavorited) { // Si on vient de le supprimer
                await favoritesXanoClient.delete(`favorites_album_by_property/${propertyId}`);
                userFavoritePropertyIds.delete(propertyId);
                // Optionnel: mettre à jour userFavoritesDetails si on veut éviter un re-fetch complet pour la modale
                userFavoritesDetails = userFavoritesDetails.filter(fav => fav.property_id !== propertyId);
            } else { // Si on vient de l'ajouter
                // IMPORTANT: La réponse du POST devrait idéalement contenir les détails de l'item favori
                // pour pouvoir l'ajouter à userFavoritesDetails sans re-fetch.
                // Sinon, on devra marquer userFavoritesDetails comme "stale" et forcer un re-fetch.
                const addedFavoriteDetails = await favoritesXanoClient.post('favorites_album', { property_id: propertyId });
                userFavoritePropertyIds.add(propertyId);
                if(addedFavoriteDetails && addedFavoriteDetails.property_id) { // Si Xano retourne les détails de l'item ajouté (idéal)
                    userFavoritesDetails.push(addedFavoriteDetails); // Assurez vous que le format correspond
                } else {
                    // Si Xano ne retourne pas les détails, il faudra rafraîchir userFavoritesDetails
                    // la prochaine fois que la modale s'ouvre, ou faire un fetchUserFavorites(true) ici.
                    // Pour l'instant, on ne fait que mettre à jour les IDs.
                }
            }
            updateFavoriteButtonsUI();
        } catch (error) {
             console.error('[FAVORITES_MANAGER] Erreur lors de la modification du favori:', error);
             alert(`Erreur lors de la mise à jour des favoris: ${error.message}`);
             // Annuler le changement d'état local si l'API échoue
             // (cette partie de la logique doit être robuste)
             updateFavoriteButtonsUI(); // S'assurer que l'UI reflète l'état réel
        } finally {
            buttonElement.disabled = false;
        }
    }

    function initFavoriteButtons() { /* ... comme avant ... */ }

    // --- NOUVEAU: Gestion de la Modale des Favoris ---
    // Supposons que votre modale a un conteneur avec l'ID 'favorites-modal-list'
    // et que vous avez un bouton pour ouvrir la modale avec l'ID 'open-favorites-modal-button'

    const openModalButton = document.getElementById('open-favorites-modal-button'); // Adaptez cet ID
    const favoritesModalListContainer = document.getElementById('favorites-modal-list'); // Adaptez cet ID

    if (openModalButton && favoritesModalListContainer) {
        openModalButton.addEventListener('click', async () => {
            console.log('[FAVORITES_MANAGER] Ouverture de la modale des favoris demandée.');
            updateAuthToken(); // S'assurer que le token est à jour avant de fetch
            if (!authToken) {
                alert("Veuillez vous connecter pour voir vos favoris.");
                // Peut-être fermer la modale ou afficher un message de connexion dans la modale
                favoritesModalListContainer.innerHTML = '<p>Veuillez vous connecter pour voir vos favoris.</p>';
                // Logique pour afficher votre modale ici... puis return.
                // exemple: document.getElementById('votre-modale-id').style.display = 'block';
                return;
            }

            // Afficher un indicateur de chargement dans la modale
            favoritesModalListContainer.innerHTML = '<p>Chargement de vos favoris...</p>';
            // Logique pour afficher votre modale ici (si ce n'est pas déjà fait par votre système)
            // exemple: document.getElementById('votre-modale-id').style.display = 'block';

            await fetchUserFavorites(true); // S'assurer que userFavoritesDetails est à jour

            renderFavoritesInModal();
        });
    }

    function renderFavoritesInModal() {
    if (!favoritesModalListContainer) {
        console.error("Conteneur de la liste des favoris dans la modale non trouvé !");
        return;
    }
    updateAuthToken();
    if (!authToken) {
        favoritesModalListContainer.innerHTML = '<p>Veuillez vous connecter pour voir vos favoris.</p>';
        return;
    }

    favoritesModalListContainer.innerHTML = ''; // Vider le contenu précédent

    const templateFavoriModal = document.getElementById('template-album-favori-modal'); // L'ID de VOTRE template HTML

    if (!templateFavoriModal) {
        favoritesModalListContainer.innerHTML = '<p style="color:red;">Erreur de configuration : Template pour les favoris introuvable.</p>';
        console.error("Template 'template-album-favori-modal' non trouvé !");
        return;
    }

    if (userFavoritesDetails.length === 0) {
        favoritesModalListContainer.innerHTML = '<p>Vous n\'avez pas encore d\'annonces en favoris.</p>';
        return;
    }

    userFavoritesDetails.forEach(favDetail => {
        const clone = templateFavoriModal.cloneNode(true);
        clone.removeAttribute('id'); // Enlever l'ID du clone pour éviter les doublons
        clone.style.display = ''; // Rendre le clone visible (ou retirez la classe qui le cache)

        // Peupler le clone avec les données
        // Image
        const imgElement = clone.querySelector('[data-fav-bind="image"]');
        if (imgElement && favDetail.property_main_image_url) {
            imgElement.src = favDetail.property_main_image_url;
            imgElement.alt = favDetail.property_title || 'Image de l\'annonce favorite';
        } else if (imgElement) {
            imgElement.style.display = 'none'; // Cacher si pas d'image
        }

        // Titre
        const titleElement = clone.querySelector('[data-fav-bind="title"]');
        if (titleElement) {
            titleElement.textContent = favDetail.property_title || 'Titre non disponible';
        }

        // Prix (exemple)
        const priceElement = clone.querySelector('[data-fav-bind="price"]');
        if (priceElement) {
            if (favDetail.property_price) {
                priceElement.textContent = `${favDetail.property_price} €`;
                priceElement.style.display = '';
            } else {
                priceElement.style.display = 'none'; // Cacher si pas de prix
            }
        }
        
        // Lien (si le clone entier doit être un lien)
        // Si vous voulez que toute la "carte" du favori soit cliquable :
        const propertyLink = `annonce?id=${favDetail.property_id}`;
        const linkWrapper = clone.querySelector('[data-fav-bind="link-wrapper"]'); // Ex: une div à l'intérieur de votre template
        if (linkWrapper) { // Si vous avez un wrapper spécifique pour le lien
            const anchor = document.createElement('a');
            anchor.href = propertyLink;
            // Transférez le contenu du linkWrapper dans l'ancre
            while(linkWrapper.firstChild) {
                anchor.appendChild(linkWrapper.firstChild);
            }
            linkWrapper.appendChild(anchor);
            // Appliquez des styles à l'ancre pour qu'elle se comporte comme un bloc
            anchor.style.display = 'block';
            anchor.style.textDecoration = 'none';
            anchor.style.color = 'inherit';

        } else if (clone.tagName === 'A') { // Si le clone lui-même (le template) est une balise <a>
            clone.href = propertyLink;
        }
        // Sinon, vous pouvez avoir un simple bouton/lien "Voir l'annonce" avec data-fav-bind="details-link"

        // Bouton "Retirer des favoris" DANS LA MODALE
        const removeBtnModal = clone.querySelector('.bouton-retirer-favori-modal'); // Utilisez la classe que vous avez définie
        if (removeBtnModal && favDetail.property_id) {
            removeBtnModal.dataset.propertyId = favDetail.property_id; // Important pour savoir quoi retirer
            removeBtnModal.addEventListener('click', async function(event) {
                event.stopPropagation(); // Empêche le clic de se propager si le bouton est dans un lien
                const propertyIdToRemove = this.dataset.propertyId;
                this.disabled = true;
                try {
                    await favoritesXanoClient.delete(`favorites_album_by_property/${propertyIdToRemove}`);
                    userFavoritePropertyIds.delete(propertyIdToRemove);
                    userFavoritesDetails = userFavoritesDetails.filter(fav => fav.property_id !== propertyIdToRemove);
                    
                    renderFavoritesInModal(); // Re-render la liste dans la modale
                    updateFavoriteButtonsUI(); // Mettre à jour les coeurs sur la page principale
                } catch (error) {
                    console.error("Erreur suppression depuis modale:", error);
                    alert("Erreur lors de la suppression du favori.");
                    this.disabled = false;
                }
            });
        }
        favoritesModalListContainer.appendChild(clone);
    });
}


    // --- Initialisation ---
    fetchUserFavorites(true).then(() => { // true pour charger les détails dès le début si l'utilisateur est connecté
        initFavoriteButtons();
    });

    // Gestion du re-fetch et de la réinitialisation si l'état d'authentification change
    // Écoutez un événement personnalisé que auth-xano.js pourrait déclencher après connexion/déconnexion
    document.addEventListener('authStateChanged', function() {
        console.log('[FAVORITES_MANAGER] État d\'authentification changé. Re-vérification des favoris.');
        updateAuthToken(); // Mettre à jour le token
        fetchUserFavorites(true).then(() => {
            initFavoriteButtons();
            // Si la modale est visible et doit être mise à jour :
            // if (document.getElementById('votre-modale-id').style.display === 'block' && favoritesModalListContainer) {
            //     renderFavoritesInModal();
            // }
        });
    });

    document.addEventListener('annoncesChargeesEtRendues', function(event) { /* ... comme avant ... */ });
});

// favorites-manager.js
document.addEventListener('DOMContentLoaded', function () {
    console.log('[FAVORITES_MANAGER] DOMContentLoaded - Initialisation du système de favoris.');

    // Vérifier si XanoClient et les fonctions cookie sont définis
    if (typeof XanoClient === 'undefined') {
        console.error("[FAVORITES_MANAGER] ERREUR CRITIQUE: La classe XanoClient n'est pas définie. Assurez-vous que xano-client-utils.js est chargé AVANT favorites-manager.js.");
        return;
    }
    if (typeof getCookie !== 'function') {
        console.error("[FAVORITES_MANAGER] ERREUR CRITIQUE: La fonction getCookie n'est pas définie.");
        return;
    }

    const FAVORITES_API_BASE_URL = 'https://xwxl-obyg-b3e3.p7.xano.io/api:7u3_oKu9';
    const favoritesXanoClient = new XanoClient({ apiGroupBaseUrl: FAVORITES_API_BASE_URL });

    const authToken = getCookie('xano_auth_token');
    if (authToken) {
        favoritesXanoClient.setAuthToken(authToken);
    } else {
        console.warn('[FAVORITES_MANAGER] Aucun token d\'authentification trouvé. Les fonctionnalités de favoris nécessitent un utilisateur connecté.');
        // Vous pourriez désactiver les boutons de favoris ici si l'utilisateur n'est pas connecté
        // document.querySelectorAll('.favorite-btn').forEach(btn => btn.disabled = true);
        // return; // Ou retourner si vous ne voulez rien faire sans token
    }

    let userFavoritePropertyIds = new Set();

    async function fetchUserFavorites() {
        if (!authToken) return; // Ne rien faire si pas de token

        console.log('[FAVORITES_MANAGER] Récupération des favoris de l\'utilisateur...');
        try {
            const favorites = await favoritesXanoClient.get('favorites_album'); // Ajustez l'endpoint si nécessaire
            if (favorites && Array.isArray(favorites)) {
                userFavoritePropertyIds = new Set(favorites.map(fav => fav.property_id));
                console.log('[FAVORITES_MANAGER] Favoris récupérés:', userFavoritePropertyIds);
                updateFavoriteButtonsUI();
            } else {
                 // Si la réponse est un objet avec une clé contenant le tableau (ex: { "items": [...] })
                if (favorites && favorites.items && Array.isArray(favorites.items)) {
                    userFavoritePropertyIds = new Set(favorites.items.map(fav => fav.property_id));
                    console.log('[FAVORITES_MANAGER] Favoris récupérés (via favorites.items):', userFavoritePropertyIds);
                    updateFavoriteButtonsUI();
                } else {
                    console.warn('[FAVORITES_MANAGER] Réponse inattendue de /favorites_album:', favorites);
                    userFavoritePropertyIds = new Set(); // Réinitialiser en cas de réponse invalide
                }
            }
        } catch (error) {
            console.error('[FAVORITES_MANAGER] Erreur lors de la récupération des favoris:', error);
            // Gérer l'erreur, peut-être informer l'utilisateur
        }
    }

    function updateFavoriteButtonsUI() {
        document.querySelectorAll('.favorite-btn').forEach(button => {
            const propertyId = button.dataset.propertyId;
            if (propertyId) {
                if (userFavoritePropertyIds.has(propertyId)) {
                    button.classList.add('favorited');
                    button.setAttribute('aria-pressed', 'true');
                    button.querySelector('.favorite-text').textContent = 'Retirer des favoris';
                } else {
                    button.classList.remove('favorited');
                    button.setAttribute('aria-pressed', 'false');
                    button.querySelector('.favorite-text').textContent = 'Ajouter aux favoris';
                }
            }
        });
    }

    async function toggleFavorite(propertyId, buttonElement) {
        if (!authToken) {
            console.warn('[FAVORITES_MANAGER] Utilisateur non connecté. Impossible de gérer les favoris.');
            // Rediriger vers la page de connexion ou afficher un message
            // window.location.href = '/signin'; // Exemple
            alert("Veuillez vous connecter pour ajouter des favoris.");
            return;
        }

        buttonElement.disabled = true; // Désactiver pendant l'opération
        const isFavorited = userFavoritePropertyIds.has(propertyId);

        try {
            if (isFavorited) {
                // Retirer des favoris
                console.log(`[FAVORITES_MANAGER] Tentative de suppression du favori pour property_id: ${propertyId}`);
                // Adaptez l'endpoint si vous utilisez un ID d'enregistrement favori spécifique
                // await favoritesXanoClient.delete(`favorites_album/${favoriteRecordId}`);
                await favoritesXanoClient.delete(`favorites_album_by_property/${propertyId}`); // Endpoint basé sur property_id
                userFavoritePropertyIds.delete(propertyId);
                console.log(`[FAVORITES_MANAGER] Favori retiré pour property_id: ${propertyId}`);
            } else {
                // Ajouter aux favoris
                console.log(`[FAVORITES_MANAGER] Tentative d'ajout du favori pour property_id: ${propertyId}`);
                await favoritesXanoClient.post('favorites_album', { property_id: propertyId });
                userFavoritePropertyIds.add(propertyId);
                console.log(`[FAVORITES_MANAGER] Favori ajouté pour property_id: ${propertyId}`);
            }
            updateFavoriteButtonsUI(); // Mettre à jour tous les boutons (ou juste celui-ci)
        } catch (error) {
            console.error('[FAVORITES_MANAGER] Erreur lors de la modification du favori:', error);
            alert(`Erreur lors de la mise à jour des favoris: ${error.message}`);
            // Annuler le changement d'état local si l'API échoue (optionnel, mais recommandé)
            if (isFavorited) userFavoritePropertyIds.add(propertyId);
            else userFavoritePropertyIds.delete(propertyId);
            updateFavoriteButtonsUI();
        } finally {
            buttonElement.disabled = false; // Réactiver le bouton
        }
    }

    function initFavoriteButtons() {
        const favoriteButtons = document.querySelectorAll('.favorite-btn');
        console.log(`[FAVORITES_MANAGER] ${favoriteButtons.length} boutons de favoris trouvés.`);

        favoriteButtons.forEach(button => {
            const propertyId = button.dataset.propertyId;
            if (propertyId) {
                button.addEventListener('click', function () {
                    toggleFavorite(propertyId, this);
                });
            } else {
                console.warn('[FAVORITES_MANAGER] Bouton de favori trouvé sans data-property-id:', button);
            }
        });
        // Mettre à jour l'UI après avoir attaché les listeners, au cas où fetchUserFavorites n'aurait pas encore terminé
        // ou si les boutons sont ajoutés dynamiquement après le chargement initial.
        updateFavoriteButtonsUI();
    }

    // --- Initialisation ---
    // 1. Récupérer les favoris existants de l'utilisateur (si connecté)
    fetchUserFavorites().then(() => {
        // 2. Initialiser les boutons une fois les favoris récupérés (ou si pas de token)
        initFavoriteButtons();
    });


    // Si vous chargez des annonces dynamiquement (ex: via AJAX ou après des filtres),
    // vous devrez ré-appeler initFavoriteButtons() ou une fonction similaire
    // pour les nouveaux boutons ajoutés au DOM.
    // Par exemple, vous pourriez exposer une fonction globalement :
    // window.reinitializeFavoriteButtons = initFavoriteButtons;
    // Ou, si votre script de chargement d'annonces peut émettre un événement :
    // document.addEventListener('annoncesChargees', function() {
    //     console.log('[FAVORITES_MANAGER] Événement annoncesChargees reçu, réinitialisation des boutons de favoris.');
    //     fetchUserFavorites().then(initFavoriteButtons); // Re-vérifier les favoris et mettre à jour tous les boutons
    // });
});

document.addEventListener('annoncesChargeesEtRendues', function(event) {
    console.log('[FAVORITES_MANAGER] Événement annoncesChargeesEtRendues reçu. Réinitialisation des boutons de favoris.');
    // On suppose que fetchUserFavorites a déjà été appelé une fois au chargement de la page.
    // On a juste besoin de mettre à jour les boutons et d'attacher les écouteurs aux nouveaux.
    // initFavoriteButtons() fait déjà les deux.
    initFavoriteButtons();
});

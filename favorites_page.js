// Placeholder for XanoClient - In a real scenario, this comes from xano-client-utils.js
        document.addEventListener('DOMContentLoaded', function () {
            const FAVORITES_API_BASE_URL = 'https://xwxl-obyg-b3e3.p7.xano.io/api:7u3_oKu9'; // Your Xano API for favorites
            const favoritesXanoClient = new XanoClient({ apiGroupBaseUrl: FAVORITES_API_BASE_URL });
            let authToken = getCookie('xano_auth_token'); // Assuming 'xano_auth_token' is your cookie name
            let currentUserId = null; // Will be fetched or assumed if your API endpoints are user-specific via token

            // DOM Elements
            const albumListView = document.getElementById('album-list-view');
            const albumDetailView = document.getElementById('album-detail-view');
            const albumsGrid = document.getElementById('albums-grid');
            const albumPropertiesGrid = document.getElementById('album-properties-grid');
            const backToAlbumsBtn = document.getElementById('back-to-albums-btn');
            const albumDetailTitle = document.getElementById('album-detail-title');
            const deleteAlbumBtnDetail = document.getElementById('delete-album-btn-detail');
            
            const loadingAlbumsMsg = document.getElementById('loading-albums-message');
            const noAlbumsMsg = document.getElementById('no-albums-message');
            const loadingPropertiesMsg = document.getElementById('loading-properties-message');
            const noPropertiesMsg = document.getElementById('no-properties-message');

            const albumCardTemplate = document.getElementById('album-card-template');
            const propertyCardTemplate = document.getElementById('property-card-template');

            const confirmationModal = document.getElementById('confirmation-modal');
            const confirmationMessage = document.getElementById('confirmation-message');
            const confirmYesBtn = document.getElementById('confirm-yes-btn');
            const confirmNoBtn = document.getElementById('confirm-no-btn');
            let confirmAction = null;


            function showView(viewId) {
                albumListView.style.display = viewId === 'album-list-view' ? 'block' : 'none';
                albumDetailView.style.display = viewId === 'album-detail-view' ? 'block' : 'none';
            }

            function formatTimeAgo(dateString) {
                if (!dateString) return 'Date inconnue';
                const date = new Date(dateString);
                const now = new Date();
                const seconds = Math.round((now - date) / 1000);
                const minutes = Math.round(seconds / 60);
                const hours = Math.round(minutes / 60);
                const days = Math.round(hours / 24);
                const weeks = Math.round(days / 7);
                const months = Math.round(days / 30.44); // Average days in month
                const years = Math.round(days / 365.25); // Account for leap years

                if (seconds < 60) return `Il y a ${seconds} sec`;
                if (minutes < 60) return `Il y a ${minutes} min`;
                if (hours < 24) return `Il y a ${hours} h`;
                if (days < 7) return `Il y a ${days} j`;
                if (weeks < 5) return `Il y a ${weeks} sem`;
                if (months < 12) return `Il y a ${months} mois`;
                return `Il y a ${years} an(s)`;
            }
            
            function openConfirmationModal(message, action) {
                confirmationMessage.textContent = message;
                confirmAction = action;
                confirmationModal.style.display = 'flex';
            }

            function closeConfirmationModal() {
                confirmationModal.style.display = 'none';
                confirmAction = null;
            }

            confirmYesBtn.addEventListener('click', () => {
                if (confirmAction) {
                    confirmAction();
                }
                closeConfirmationModal();
            });

            confirmNoBtn.addEventListener('click', closeConfirmationModal);


            async function fetchUserDetails() {
                // This is a placeholder. In a real app, you'd get user_id from your /auth/me endpoint
                // or your Xano token might implicitly scope API calls to the current user.
                // For now, we'll assume endpoints are user-scoped by the auth token.
                // If your API requires user_id as a param, you'd fetch it here.
                try {
                    // Example: const user = await authXanoClient.get('auth/me'); currentUserId = user.id;
                    // For now, many Xano setups scope by token, so user_id might not be needed in GET params.
                    return true; 
                } catch (error) {
                    console.error("Erreur de récupération des détails utilisateur:", error);
                    return false;
                }
            }

            async function loadUserAlbums() {
                if (!authToken) {
                    albumsGrid.innerHTML = '<p class="text-red-500 text-center col-span-full">Veuillez vous connecter pour voir vos favoris.</p>';
                    loadingAlbumsMsg.style.display = 'none';
                    noAlbumsMsg.style.display = 'none';
                    return;
                }
                favoritesXanoClient.setAuthToken(authToken);
                loadingAlbumsMsg.style.display = 'block';
                noAlbumsMsg.style.display = 'none';
                albumsGrid.innerHTML = '';

                try {
                    // 1. Fetch all albums for the user
                    const albums = await favoritesXanoClient.get('favorites_album'); // Assumes this returns albums for the authenticated user
                    
                    // 2. Fetch all favorite list items for the user to count items per album and get last activity
                    const favoriteItems = await favoritesXanoClient.get('favorites_list'); // Assumes this returns all items for the user

                    const albumsWithDetails = albums.map(album => {
                        const itemsInAlbum = favoriteItems.filter(item => item.favorites_album_id === album.id);
                        let lastActivityTimestamp = album.created_at; // Fallback to album creation

                        if (itemsInAlbum.length > 0) {
                            const maxItemTimestamp = itemsInAlbum.reduce((max, item) => {
                                const itemDate = new Date(item.created_at).getTime();
                                return itemDate > max ? itemDate : max;
                            }, 0);
                            if (new Date(maxItemTimestamp).getTime() > new Date(lastActivityTimestamp).getTime()) {
                                lastActivityTimestamp = new Date(maxItemTimestamp).toISOString();
                            }
                        }
                        
                        return {
                            ...album,
                            itemCount: itemsInAlbum.length,
                            lastActivity: lastActivityTimestamp
                        };
                    });

                    // Sort albums by last activity, most recent first
                    albumsWithDetails.sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime());
                    
                    renderAlbumList(albumsWithDetails);

                } catch (error) {
                    console.error("Erreur de chargement des albums:", error);
                    albumsGrid.innerHTML = `<p class="text-red-500 text-center col-span-full">Erreur de chargement des albums: ${error.message}</p>`;
                    loadingAlbumsMsg.style.display = 'none';
                }
            }

            function renderAlbumList(albums) {
                albumsGrid.innerHTML = ''; // Clear previous
                loadingAlbumsMsg.style.display = 'none';

                if (albums.length === 0) {
                    noAlbumsMsg.style.display = 'block';
                    return;
                }
                noAlbumsMsg.style.display = 'none';

                albums.forEach(album => {
                    const card = albumCardTemplate.content.cloneNode(true).firstElementChild;
                    card.querySelector('.album-name').textContent = album.name_Album || 'Album sans nom';
                    card.querySelector('.album-item-count').textContent = `${album.itemCount} annonce(s)`;
                    card.querySelector('.album-last-updated').textContent = `Dernière activité: ${formatTimeAgo(album.lastActivity)}`;
                    
                    const coverImg = card.querySelector('.album-cover-photo');
                    if (album.representative_photo_url && album.representative_photo_url.startsWith('http')) {
                        coverImg.src = album.representative_photo_url;
                        coverImg.alt = `Couverture de ${album.name_Album}`;
                    } else {
                        coverImg.src = `https://placehold.co/600x400/E2E8F0/A0AEC0?text=${encodeURIComponent(album.name_Album || 'Album')}`;
                        coverImg.alt = `Placeholder pour ${album.name_Album}`;
                    }


                    card.querySelector('.view-album-btn').addEventListener('click', () => {
                        handleViewAlbum(album.id, album.name_Album);
                    });
                    card.querySelector('.delete-album-btn').addEventListener('click', () => {
                        openConfirmationModal(`Êtes-vous sûr de vouloir supprimer l'album "${album.name_Album}" ? Cette action est irréversible.`, () => {
                            handleDeleteAlbum(album.id);
                        });
                    });
                    albumsGrid.appendChild(card);
                });
            }

            async function handleViewAlbum(albumId, albumName) {
                albumDetailTitle.textContent = albumName || 'Détails de l\'album';
                deleteAlbumBtnDetail.dataset.albumId = albumId; // For deletion from detail view
                deleteAlbumBtnDetail.dataset.albumName = albumName; 
                showView('album-detail-view');
                await loadPropertiesForAlbum(albumId);
            }

            async function handleDeleteAlbum(albumId) {
                try {
                    await favoritesXanoClient.delete(`favorites_album/${albumId}`);
                    // alert("Album supprimé avec succès !");
                    loadUserAlbums(); // Refresh album list
                    // If deleting from detail view, navigate back
                    if (albumDetailView.style.display === 'block') {
                        showView('album-list-view');
                    }
                } catch (error) {
                    console.error("Erreur de suppression d'album:", error);
                    alert(`Erreur: ${error.message}`);
                }
            }
            
            deleteAlbumBtnDetail.addEventListener('click', function() {
                const albumId = this.dataset.albumId;
                const albumName = this.dataset.albumName;
                 openConfirmationModal(`Êtes-vous sûr de vouloir supprimer l'album "${albumName}" ? Toutes les annonces favorites dans cet album seront dissociées. Cette action est irréversible.`, () => {
                    handleDeleteAlbum(albumId);
                });
            });


            async function loadPropertiesForAlbum(albumId) {
                albumPropertiesGrid.innerHTML = '';
                loadingPropertiesMsg.style.display = 'block';
                noPropertiesMsg.style.display = 'none';

                try {
                    // This endpoint should ideally return favorite_list entries JOINED with property details.
                    // For now, we assume 'favorites_list' might contain some basic property info or we use placeholders.
                    // A more robust solution would be:
                    // 1. GET favorites_list?favorites_album_id={albumId} -> returns [{property_id, id (favorites_list_id), ...}]
                    // 2. For each property_id, GET /properties/{property_id} -> returns property details
                    // Or, a single Xano endpoint: GET /album_properties_details?album_id={albumId}
                    
                    const items = await favoritesXanoClient.get('favorites_list', { favorites_album_id: albumId });
                    
                    // If items only contain property_id, you'd need to fetch details for each.
                    // For this example, we'll assume 'items' contains enough info or we use placeholders.
                    // We need `property_id` and `id` (which is `favorites_list_id`).
                    // We also need property details like title, image, etc. These are missing from favorites_list schema.
                    // I will create placeholder property details.

                    const propertiesToRender = [];
                    for (const item of items) {
                        // propertiesToRender.push(propertyDetails); // Ligne à supprimer ou commenter

// Directement utiliser les données de l'item retourné par Xano
const propertyData = item._property; // Contient rent_type, loyer_cc, Statut, et probablement d'autres détails
const photosData = item._property_photos; // Un tableau de photos

// Déterminer le nom/titre de l'annonce
// Vous devrez remplacer 'nom_du_champ_titre_dans_property' par le vrai nom du champ
// qui contient le titre ou le nom de votre annonce dans l'objet _property.
// Exemples: propertyData.titre, propertyData.name, propertyData.nom_annonce etc.
const propertyName = propertyData.nom_du_champ_titre_dans_property || `Annonce ID ${item.property_id}`;

// Déterminer la description (si vous en avez une à afficher)
// Remplacez 'nom_du_champ_description_dans_property'
const propertyDescription = propertyData.nom_du_champ_description_dans_property || `Loyer CC : ${propertyData.loyer_cc} € - Statut : ${propertyData.Statut}`;


// Déterminer l'URL de l'image de couverture
let coverImageUrl = `https://placehold.co/600x400/CBD5E0/718096?text=${encodeURIComponent(propertyName)}`; // Placeholder par défaut
if (photosData && photosData.length > 0) {
    const coverPhoto = photosData.find(p => p.is_cover === true);
    if (coverPhoto && coverPhoto.images && coverPhoto.images.length > 0 && coverPhoto.images[0].url) {
        coverImageUrl = coverPhoto.images[0].url;
    } else if (photosData[0].images && photosData[0].images.length > 0 && photosData[0].images[0].url) {
        // Sinon, prendre la première photo de la liste si pas de "is_cover"
        coverImageUrl = photosData[0].images[0].url;
    }
}

const actualPropertyDetails = {
    id: item.property_id, // L'ID de la propriété elle-même
    name: propertyName,
    description: propertyDescription,
    image_url: coverImageUrl,
    favorites_list_id: item.id // L'ID de l'entrée dans la table favorites_list (pour la suppression)
};
propertiesToRender.push(actualPropertyDetails);
                    }
                    renderPropertiesInAlbum(propertiesToRender, albumId);

                } catch (error) {
                    console.error("Erreur de chargement des annonces de l'album:", error);
                    albumPropertiesGrid.innerHTML = `<p class="text-red-500 text-center col-span-full">Erreur: ${error.message}</p>`;
                    loadingPropertiesMsg.style.display = 'none';
                }
            }

            function renderPropertiesInAlbum(properties, albumId) {
                albumPropertiesGrid.innerHTML = ''; // Clear previous
                loadingPropertiesMsg.style.display = 'none';

                if (properties.length === 0) {
                    noPropertiesMsg.style.display = 'block';
                    return;
                }
                noPropertiesMsg.style.display = 'none';

                properties.forEach(prop => {
                    const card = propertyCardTemplate.content.cloneNode(true).firstElementChild;
                    card.querySelector('.property-title').textContent = prop.name || `Annonce ${prop.id}`;
                    card.querySelector('.property-details').textContent = prop.description || 'Pas de description.';
                    
                    const propImg = card.querySelector('.property-image');
                    if (prop.image_url && prop.image_url.startsWith('http')) {
                        propImg.src = prop.image_url;
                        propImg.alt = `Image de ${prop.name}`;
                    } else {
                        propImg.src = `https://placehold.co/600x400/CBD5E0/718096?text=${encodeURIComponent(prop.name || 'Annonce')}`;
                        propImg.alt = `Placeholder pour ${prop.name}`;
                    }


                    const favButton = card.querySelector('.favorite-btn-album-item');
                    favButton.dataset.propertyId = prop.id; // This is property_id
                    favButton.dataset.albumId = albumId;
                    favButton.dataset.favoritesListId = prop.favorites_list_id; // This is the ID from favorites_list table
                    
                    // Initial state: is favorited because it's in the album
                    favButton.textContent = 'Retirer des favoris';
                    favButton.classList.add('is-favorited');
                    favButton.classList.remove('bg-green-500', 'hover:bg-green-600');
                    favButton.classList.add('bg-red-500', 'hover:bg-red-600');


                    favButton.addEventListener('click', function() {
                        handleToggleFavoriteInAlbum(this);
                    });

                    albumPropertiesGrid.appendChild(card);
                });
            }

            async function handleToggleFavoriteInAlbum(buttonElement) {
                const propertyId = buttonElement.dataset.propertyId;
                const albumId = buttonElement.dataset.albumId;
                let favoritesListId = buttonElement.dataset.favoritesListId;

                buttonElement.disabled = true; // Prevent double clicks

                if (buttonElement.classList.contains('is-favorited')) {
                    // --- Action: Retirer des favoris ---
                    try {
                        await favoritesXanoClient.delete(`favorites_list/${favoritesListId}`);
                        // Item is deleted from backend.
                        // UI: Change button to "Ajouter aux favoris", but keep card visible.
                        buttonElement.textContent = 'Ajouter aux favoris';
                        buttonElement.classList.remove('is-favorited', 'bg-red-500', 'hover:bg-red-600');
                        buttonElement.classList.add('bg-green-500', 'hover:bg-green-600');
                        delete buttonElement.dataset.favoritesListId; // Remove the ID as it's no longer valid
                        // The card itself remains in the DOM as per user request
                    } catch (error) {
                        console.error("Erreur de suppression de l'annonce des favoris:", error);
                        alert(`Erreur: ${error.message}`);
                    }
                } else {
                    // --- Action: Ajouter aux favoris (car il a été retiré précédemment) ---
                    try {
                        const payload = {
                            favorites_album_id: parseInt(albumId),
                            property_id: parseInt(propertyId)
                            // user_id might be handled by Xano based on auth token
                        };
                        const newFavoriteEntry = await favoritesXanoClient.post('favorites_list', payload);
                        
                        // Item is re-added to backend.
                        // UI: Change button back to "Retirer des favoris".
                        buttonElement.textContent = 'Retirer des favoris';
                        buttonElement.classList.add('is-favorited');
                        buttonElement.classList.remove('bg-green-500', 'hover:bg-green-600');
                        buttonElement.classList.add('bg-red-500', 'hover:bg-red-600');
                        buttonElement.dataset.favoritesListId = newFavoriteEntry.id; // Store the new ID
                    } catch (error) {
                        console.error("Erreur d'ajout de l'annonce aux favoris:", error);
                        alert(`Erreur: ${error.message}`);
                    }
                }
                buttonElement.disabled = false;
            }


            // Event Listeners
            backToAlbumsBtn.addEventListener('click', () => {
                showView('album-list-view');
                loadUserAlbums(); // Refresh album list in case counts/activity changed
            });

            // Initial load
            async function initializeFavoritesPage() {
                authToken = getCookie('xano_auth_token');
                if (!authToken) {
                    console.warn("Utilisateur non authentifié. Affichage des favoris désactivé.");
                    albumListView.innerHTML = '<p class="text-center text-red-500 font-semibold">Veuillez vous connecter pour accéder à vos favoris.</p>';
                    // Optionally, redirect to login page: window.location.href = '/login';
                    return;
                }
                favoritesXanoClient.setAuthToken(authToken);

                const userDetailsFetched = await fetchUserDetails();
                if (userDetailsFetched) {
                    showView('album-list-view');
                    await loadUserAlbums();
                } else {
                     albumListView.innerHTML = '<p class="text-center text-red-500 font-semibold">Impossible de vérifier l\'utilisateur. Veuillez réessayer.</p>';
                }
                 // Listen for auth changes (e.g., logout from another tab/script)
                document.addEventListener('authStateChanged', async (event) => {
                    console.log("Favorites Page: authStateChanged event detected", event.detail);
                    authToken = getCookie('xano_auth_token');
                    if (!authToken) {
                        showView('album-list-view'); // Go to album list
                        albumsGrid.innerHTML = '<p class="text-red-500 text-center col-span-full">Vous avez été déconnecté. Veuillez vous reconnecter pour voir vos favoris.</p>';
                        loadingAlbumsMsg.style.display = 'none';
                        noAlbumsMsg.style.display = 'none';
                        albumDetailView.style.display = 'none'; // Hide detail view too
                    } else {
                        favoritesXanoClient.setAuthToken(authToken);
                        // If user logs in while on the page, re-init
                        await initializeFavoritesPage(); 
                    }
                });
            }

            initializeFavoritesPage();
        });

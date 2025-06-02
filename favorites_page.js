// Assurez-vous que vos fichiers xano-client-utils.js et auth-xano.js sont chargés avant ce script.
    // Les définitions de XanoClient et getCookie ont été retirées d'ici pour éviter les erreurs de re-déclaration.

    document.addEventListener('DOMContentLoaded', function () {
        const FAVORITES_API_BASE_URL = 'https://xwxl-obyg-b3e3.p7.xano.io/api:7u3_oKu9';
        const favoritesXanoClient = new XanoClient({ apiGroupBaseUrl: FAVORITES_API_BASE_URL });
        let authToken = getCookie('xano_auth_token');

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
            const months = Math.round(days / 30.44);
            const years = Math.round(days / 365.25);

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

        async function loadUserAlbums() {
            if (!authToken) {
                albumsGrid.innerHTML = '<p class="text-red-500 text-center col-span-full">Veuillez vous connecter pour voir vos favoris.</p>';
                loadingAlbumsMsg.style.display = 'none';
                return;
            }
            favoritesXanoClient.setAuthToken(authToken);
            loadingAlbumsMsg.style.display = 'block';
            noAlbumsMsg.style.display = 'none';
            albumsGrid.innerHTML = '';

            try {
                const albums = await favoritesXanoClient.get('favorites_album');
                const favoriteItems = await favoritesXanoClient.get('favorites_list');

                const albumsWithDetails = albums.map(album => {
                    const itemsInAlbum = favoriteItems.filter(item => item.favorites_album_id === album.id);
                    let lastActivityTimestamp = album.created_at;

                    if (itemsInAlbum.length > 0) {
                        const maxItemTimestamp = itemsInAlbum.reduce((max, item) => {
                            const itemDate = new Date(item.created_at).getTime();
                            return itemDate > max ? itemDate : max;
                        }, 0);
                        if (new Date(maxItemTimestamp).getTime() > new Date(lastActivityTimestamp).getTime()) {
                            lastActivityTimestamp = new Date(maxItemTimestamp).toISOString();
                        }
                    }
                    
                    return { ...album, itemCount: itemsInAlbum.length, lastActivity: lastActivityTimestamp };
                });

                albumsWithDetails.sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime());
                renderAlbumList(albumsWithDetails);

            } catch (error) {
                console.error("Erreur de chargement des albums:", error);
                albumsGrid.innerHTML = `<p class="text-red-500 text-center col-span-full">Erreur de chargement des albums: ${error.message}</p>`;
                loadingAlbumsMsg.style.display = 'none';
            }
        }

        function renderAlbumList(albums) {
            albumsGrid.innerHTML = '';
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
            deleteAlbumBtnDetail.dataset.albumId = albumId;
            deleteAlbumBtnDetail.dataset.albumName = albumName; 
            showView('album-detail-view');
            await loadPropertiesForAlbum(albumId);
        }

        async function handleDeleteAlbum(albumId) {
            try {
                await favoritesXanoClient.delete(`favorites_album/${albumId}`);
                loadUserAlbums();
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
                const items = await favoritesXanoClient.get('favorites_list', { favorites_album_id: albumId });
                
                const propertiesToRender = [];
                for (const item of items) {
                    const propertyData = item._property; 
                    const photosData = item._property_photos;

                    // ----- À ADAPTER PAR VOS SOINS -----
                    // Remplacez 'VOTRE_CHAMP_TITRE_ICI' par le vrai nom du champ titre dans votre table `property`
                    const propertyName = propertyData.VOTRE_CHAMP_TITRE_ICI || `Annonce ID ${item.property_id}`;
                    // ------------------------------------
                    
                    // La description n'est plus extraite ici

                    let coverImageUrl = `https://placehold.co/600x400/CBD5E0/718096?text=${encodeURIComponent(propertyName)}`;
                    if (photosData && photosData.length > 0) {
                        const coverPhoto = photosData.find(p => p.is_cover === true);
                        if (coverPhoto && coverPhoto.images && coverPhoto.images.length > 0 && coverPhoto.images[0].url) {
                            coverImageUrl = coverPhoto.images[0].url;
                        } else if (photosData[0].images && photosData[0].images.length > 0 && photosData[0].images[0].url) {
                            coverImageUrl = photosData[0].images[0].url;
                        }
                    }

                    const actualPropertyDetails = {
                        id: item.property_id,
                        name: propertyName,
                        // description: enlevée
                        image_url: coverImageUrl,
                        favorites_list_id: item.id
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
            albumPropertiesGrid.innerHTML = '';
            loadingPropertiesMsg.style.display = 'none';

            if (properties.length === 0) {
                noPropertiesMsg.style.display = 'block';
                return;
            }
            noPropertiesMsg.style.display = 'none';

            properties.forEach(prop => {
                const card = propertyCardTemplate.content.cloneNode(true).firstElementChild;
                card.querySelector('.property-title').textContent = prop.name;
                // La ligne pour la description est enlevée d'ici aussi
                card.querySelector('.property-image').src = prop.image_url;

                const favButton = card.querySelector('.favorite-btn-album-item');
                favButton.dataset.propertyId = prop.id;
                favButton.dataset.albumId = albumId;
                favButton.dataset.favoritesListId = prop.favorites_list_id;
                
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

            buttonElement.disabled = true;

            if (buttonElement.classList.contains('is-favorited')) {
                try {
                    await favoritesXanoClient.delete(`favorites_list/${favoritesListId}`);
                    buttonElement.textContent = 'Ajouter aux favoris';
                    buttonElement.classList.remove('is-favorited', 'bg-red-500', 'hover:bg-red-600');
                    buttonElement.classList.add('bg-green-500', 'hover:bg-green-600');
                    delete buttonElement.dataset.favoritesListId;
                } catch (error) {
                    console.error("Erreur de suppression de l'annonce des favoris:", error);
                    alert(`Erreur: ${error.message}`);
                }
            } else {
                try {
                    const payload = {
                        favorites_album_id: parseInt(albumId),
                        property_id: parseInt(propertyId)
                    };
                    const newFavoriteEntry = await favoritesXanoClient.post('favorites_list', payload);
                    
                    buttonElement.textContent = 'Retirer des favoris';
                    buttonElement.classList.add('is-favorited');
                    buttonElement.classList.remove('bg-green-500', 'hover:bg-green-600');
                    buttonElement.classList.add('bg-red-500', 'hover:bg-red-600');
                    buttonElement.dataset.favoritesListId = newFavoriteEntry.id;
                } catch (error) {
                    console.error("Erreur d'ajout de l'annonce aux favoris:", error);
                    alert(`Erreur: ${error.message}`);
                }
            }
            buttonElement.disabled = false;
        }

        backToAlbumsBtn.addEventListener('click', () => {
            showView('album-list-view');
            loadUserAlbums();
        });

        async function initializeFavoritesPage() {
            authToken = getCookie('xano_auth_token');
            if (!authToken) {
                console.warn("Utilisateur non authentifié.");
                albumListView.innerHTML = '<p class="text-center text-red-500 font-semibold">Veuillez vous connecter pour accéder à vos favoris.</p>';
                return;
            }
            favoritesXanoClient.setAuthToken(authToken);

            showView('album-list-view');
            await loadUserAlbums();
             
            document.addEventListener('authStateChanged', async (event) => {
                authToken = getCookie('xano_auth_token');
                if (!authToken) {
                    showView('album-list-view');
                    albumsGrid.innerHTML = '<p class="text-red-500 text-center col-span-full">Vous avez été déconnecté. Veuillez vous reconnecter pour voir vos favoris.</p>';
                    loadingAlbumsMsg.style.display = 'none';
                    noAlbumsMsg.style.display = 'none';
                    albumDetailView.style.display = 'none';
                } else {
                    favoritesXanoClient.setAuthToken(authToken);
                    await initializeFavoritesPage(); 
                }
            });
        }

        initializeFavoritesPage();
    });

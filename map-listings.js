// map-listings.js

document.addEventListener('DOMContentLoaded', function() {
    console.log('[MAP_SCRIPT] Initialisation du module de carte.');

    // --- Configuration ---
    const MAPTILER_API_KEY = 'UsgTlLJiePXeSnyh57aL'; // !! REMPLACEZ PAR VOTRE VRAIE CLÉ (MapTiler, Stadia, etc.)
    const MAP_CONTAINER_ID = 'map-section';
    const LIST_CONTAINER_ID = 'annonces-wrapper';
    const MOBILE_TOGGLE_BUTTON_ID = 'mobile-map-toggle';
    const MODAL_ID = 'annonce-modal';

    // --- Références DOM ---
    const mapContainer = document.getElementById(MAP_CONTAINER_ID);
    const listContainer = document.getElementById(LIST_CONTAINER_ID);
    const mobileToggleButton = document.getElementById(MOBILE_TOGGLE_BUTTON_ID);
    const modalElement = document.getElementById(MODAL_ID);
    
    if (!mapContainer || !listContainer || !mobileToggleButton || !modalElement) {
        console.error('[MAP_SCRIPT] Un ou plusieurs conteneurs essentiels (carte, liste, bouton mobile, modale) sont manquants.');
        return;
    }

    // --- État global du module ---
    let map = null; // L'instance de la carte MapLibre
    let allAnnouncements = []; // Toutes les annonces chargées
    let allMarkers = []; // Tous les 'pins' sur la carte
    let isMobile = window.innerWidth < 768;


    /**
     * Point d'entrée principal : écoute l'événement de l'autre script.
     */
    // map-listings.js

document.addEventListener('annoncesChargeesEtRendues', (event) => {
    console.log('[MAP_SCRIPT] Événement "annoncesChargeesEtRendues" reçu.');
    const annonces = event.detail.annonces;
    if (!annonces || !Array.isArray(annonces)) {
        console.error('[MAP_SCRIPT] Aucune donnée "annonces" valide reçue dans l\'événement.');
        return;
    }
    allAnnouncements = annonces;

    // Si la carte n'existe pas, on l'initialise. 
    // Si elle existe déjà (ex: après un filtre), on met juste à jour les marqueurs.
    if (!map) {
        initializeMap();
    } else {
        addMarkersToMap();
    }
});

    /**
     * Initialise la carte MapLibre (une seule fois).
     */
    // map-listings.js

function initializeMap() {
    console.log('[MAP_SCRIPT] Initialisation de la carte MapLibre.');
    map = new maplibregl.Map({
        container: MAP_CONTAINER_ID,
        style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_API_KEY}`,
        center: [2.3522, 48.8566], // Centre sur Paris
        zoom: 11
    });

    map.on('load', () => {
        console.log('[MAP_SCRIPT] Carte chargée. Ajout des données initiales.');
        
        // C'EST ICI QU'ON FAIT LE PREMIER APPEL, EN TOUTE SÉCURITÉ
        addMarkersToMap();
        updateVisibleAnnouncementsAndList();

        // Mettre à jour la liste pour tous les mouvements FUTURS de la carte
        map.on('moveend', updateVisibleAnnouncementsAndList);
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');
}

    /**
     * Ajoute les "pins" de prix sur la carte.
     */
    function addMarkersToMap() {
        // Nettoyer les anciens markers avant d'en ajouter de nouveaux
        allMarkers.forEach(marker => marker.remove());
        allMarkers = [];

        console.log(`[MAP_SCRIPT] Ajout de ${allAnnouncements.length} markers.`);

        allAnnouncements.forEach(annonce => {
            const lat = getNestedValue(annonce, 'geo_location.data.lat');
            const lng = getNestedValue(annonce, 'geo_location.data.lng');
            const price = getNestedValue(annonce, '_property_lease_of_property.0.loyer');

            if (lat && lng) {
                const el = document.createElement('div');
                el.className = 'price-marker-maplibre';
                el.innerText = price ? `${price}€` : '?€';

                el.addEventListener('click', () => {
                    showAnnonceModal(annonce);
                });

                const marker = new maplibregl.Marker(el)
                    .setLngLat([lng, lat])
                    .addTo(map);
                
                allMarkers.push(marker);
            }
        });
    }

    /**
     * Met à jour la liste et le bouton mobile en fonction de ce qui est visible sur la carte.
     */
    function updateVisibleAnnouncementsAndList() {
        if (!map || allAnnouncements.length === 0) return;

        const bounds = map.getBounds();
        let visibleCount = 0;
        
        // Cacher tous les items de la liste par défaut
        listContainer.querySelectorAll('[data-property-id]').forEach(item => {
            item.style.display = 'none';
        });

        allAnnouncements.forEach(annonce => {
            const lat = getNestedValue(annonce, 'geo_location.data.lat');
            const lng = getNestedValue(annonce, 'geo_location.data.lng');
            
            if (lat && lng && bounds.contains([lng, lat])) {
                visibleCount++;
                // Afficher l'item correspondant dans la liste
                const listItem = listContainer.querySelector(`[data-property-id="${annonce.id}"]`);
                if (listItem) {
                    listItem.style.display = 'block'; // Ou 'flex', selon votre CSS
                }
            }
        });

        console.log(`[MAP_SCRIPT] ${visibleCount} annonces visibles sur la carte.`);

        // Mettre à jour le bouton mobile
        if (visibleCount === 0) {
            mobileToggleButton.textContent = '0 logements ici';
        } else if (visibleCount === 1) {
            mobileToggleButton.textContent = 'Voir 1 logement';
        } else {
            mobileToggleButton.textContent = `Voir les ${visibleCount} logements`;
        }
    }
    
    /**
     * Gère le basculement entre la vue liste et la vue carte sur mobile.
     */
    function setupMobileToggle() {
        mobileToggleButton.addEventListener('click', () => {
            const isMapActive = document.body.classList.contains('map-is-active');
            
            if (isMapActive) {
                // On est sur la carte, on veut voir la liste
                document.body.classList.remove('map-is-active');
                mobileToggleButton.textContent = 'Afficher la carte';
                // Scroller en haut de la liste pour voir les résultats
                listContainer.scrollTo(0, 0);
            } else {
                // On est sur la liste, on veut voir la carte
                document.body.classList.add('map-is-active');
                // Le texte du bouton sera mis à jour par 'updateVisibleAnnouncementsAndList'
                // Forcer une mise à jour de la carte au cas où la taille du conteneur aurait changé
                if (map) {
                   map.resize();
                }
            }
        });
    }

    /**
     * Affiche l'aperçu de l'annonce dans une modale.
     */
    function showAnnonceModal(annonce) {
        document.getElementById('modal-title').textContent = getNestedValue(annonce, 'property_title') || "Titre non disponible";
        document.getElementById('modal-price').textContent = `${getNestedValue(annonce, '_property_lease_of_property.0.loyer') || '?'} € / mois`;
        document.getElementById('modal-link').href = `annonce?id=${annonce.id}`;
        
        const coverPhoto = getNestedValue(annonce, '_property_photos.0.images.0.url');
        document.getElementById('modal-image').src = coverPhoto || 'https://via.placeholder.com/400x250';

        modalElement.style.display = 'flex';
    }
    
    // Fermeture de la modale
    document.getElementById('modal-close-button').addEventListener('click', () => modalElement.style.display = 'none');
    modalElement.addEventListener('click', (e) => {
        if (e.target === modalElement) {
            modalElement.style.display = 'none';
        }
    });

    /**
     * Petite fonction utilitaire pour récupérer des valeurs dans des objets imbriqués
     * (Vous en avez déjà une dans home-form-display-v4.js, mais c'est bien de l'avoir ici aussi pour être autonome)
     */
    function getNestedValue(obj, path) {
        if (!path) return undefined;
        return path.split('.').reduce((acc, part) => {
            if (acc === undefined || acc === null) return undefined;
            // Gérer les indices de tableau comme '0'
            const index = parseInt(part, 10);
            return isNaN(index) ? acc[part] : acc[index];
        }, obj);
    }

    // --- Lancement ---
    if (isMobile) {
        setupMobileToggle();
    }
});

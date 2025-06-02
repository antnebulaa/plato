// map-listings.js - VERSION FINALE (Performance + Interactions)

document.addEventListener('DOMContentLoaded', function() {
    console.log('[MAP_SCRIPT FINAL] Initialisation du module de carte complet.');

    // --- Configuration ---
    const MAPTILER_API_KEY = 'UsgTlLJiePXeSnyh57aL'; // Votre clé que vous avez fournie
    const MAP_CONTAINER_ID = 'map-section';
    const LIST_CONTAINER_ID = 'annonces-wrapper';
    const MOBILE_TOGGLE_BUTTON_ID = 'mobile-map-toggle';
    const MODAL_ID = 'annonce-modal';
    const SOURCE_ID = 'annonces-source';
    const LAYER_ID_PINS = 'annonces-pins-layer';
    const LAYER_ID_LABELS = 'annonces-labels-layer';

    // --- Références DOM & État ---
    const listContainer = document.getElementById(LIST_CONTAINER_ID);
    const mobileToggleButton = document.getElementById(MOBILE_TOGGLE_BUTTON_ID);
    const modalElement = document.getElementById(MODAL_ID);
    let map = null;
    let allAnnouncements = [];
    let isMobile = window.innerWidth < 768;

    /**
     * Point d'entrée
     */
    document.addEventListener('annoncesChargeesEtRendues', (event) => {
        const annonces = event.detail.annonces;
        if (!annonces || !Array.isArray(annonces)) return;
        
        allAnnouncements = annonces;
        const geojsonData = convertAnnoncesToGeoJSON(allAnnouncements);

        if (!map) {
            initializeMap(geojsonData);
        } else {
            map.getSource(SOURCE_ID).setData(geojsonData);
        }
    });

    /**
     * Convertit les données brutes en GeoJSON
     */
    function convertAnnoncesToGeoJSON(annonces) {
        const features = annonces.map(annonce => {
            const lat = getNestedValue(annonce, 'geo_location.data.lat');
            const lng = getNestedValue(annonce, 'geo_location.data.lng');
            if (!lat || !lng) return null;
            return {
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [lng, lat] },
                properties: {
                    id: annonce.id,
                    price: getNestedValue(annonce, '_property_lease_of_property.0.loyer') || '?',
                    title: getNestedValue(annonce, 'property_title'),
                    coverPhoto: getNestedValue(annonce, '_property_photos.0.images.0.url')
                }
            };
        }).filter(Boolean);
        return { type: 'FeatureCollection', features };
    }

    /**
     * Initialise la carte et toutes ses fonctionnalités
     */
    function initializeMap(initialGeoJSON) {
        map = new maplibregl.Map({
            container: MAP_CONTAINER_ID,
            style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_API_KEY}`,
            center: [2.3522, 48.8566],
            zoom: 11,
            // Améliore les performances en ne chargeant pas les symboles hors de la vue
            renderWorldCopies: false
        });

        map.on('load', () => {
            console.log('[MAP_SCRIPT FINAL] Carte chargée. Ajout des couches et des événements.');

            map.addSource(SOURCE_ID, { type: 'geojson', data: initialGeoJSON });
            map.addLayer({
                id: LAYER_ID_PINS,
                type: 'circle',
                source: SOURCE_ID,
                paint: { 'circle-color': 'white', 'circle-radius': 16, 'circle-stroke-width': 1, 'circle-stroke-color': '#BDBDBD' }
            });
            map.addLayer({
                id: LAYER_ID_LABELS,
                type: 'symbol',
                source: SOURCE_ID,
                layout: { 'text-field': ['concat', ['to-string', ['get', 'price']], '€'], 'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'], 'text-size': 12, 'text-allow-overlap': true },
                paint: { 'text-color': '#000000' }
            });

            // --- GESTION DES ÉVÉNEMENTS ---
            map.on('click', LAYER_ID_PINS, handleMapClick);
            map.on('click', LAYER_ID_LABELS, handleMapClick);
            map.on('mouseenter', LAYER_ID_PINS, () => map.getCanvas().style.cursor = 'pointer');
            map.on('mouseleave', LAYER_ID_PINS, () => map.getCanvas().style.cursor = '');
            
            // *** NOUVEAU : On attache la mise à jour de la liste à la fin d'un mouvement ***
            map.on('moveend', updateVisibleList);

            // *** NOUVEAU : On lance la mise à jour une première fois au chargement ***
            updateVisibleList();
        });

        map.addControl(new maplibregl.NavigationControl(), 'top-right');
    }
    
    /**
     * *** NOUVELLE FONCTION : Met à jour la liste HTML à gauche ***
     */
    // Dans map-listings.js
function updateVisibleList() {
    if (!map.isStyleLoaded() || !listContainer) return;

    const visibleFeatures = map.queryRenderedFeatures({ layers: [LAYER_ID_PINS] });
    const visibleIds = new Set(visibleFeatures.map(feature => feature.properties.id));

    console.log(`[MAP_SCRIPT FINAL] ${visibleIds.size} annonces visibles. Mise à jour de la liste (avec classe).`);

    const allListItems = listContainer.querySelectorAll('[data-property-id]');
    allListItems.forEach(item => {
        const itemId = parseInt(item.dataset.propertyId, 10);

        if (visibleIds.has(itemId)) {
            item.classList.remove('annonce-list-item-hidden');
            // Si vos items ne sont pas 'display: block' par défaut (ex: 'flex' ou 'grid'),
            // Webflow devrait déjà leur appliquer le bon style quand la classe 'hidden' est retirée.
            // Sinon, vous pourriez avoir besoin de remettre explicitement le display :
            // item.style.display = 'block'; // ou 'flex', 'grid', etc.
        } else {
            item.classList.add('annonce-list-item-hidden');
        }
    });

    if (isMobile) {
        mobileToggleButton.textContent = `Voir les ${visibleIds.size} logements`;
    }
}

    /**
     * Gère le clic sur un pin de la carte (devrait maintenant fonctionner)
     */
    function handleMapClick(e) {
        console.log('[MAP_CLICK] Clic détecté sur une couche !', e.features);
        if (e.features && e.features.length > 0) {
            const properties = e.features[0].properties;
            showAnnonceModal(properties);
        }
    }

    /**
     * Affiche l'aperçu de l'annonce dans une modale.
     */
    function showAnnonceModal(properties) {
    console.log('Tentative d\'affichage de la modale pour :', properties);
    const titleEl = document.getElementById('modal-title');
    const priceEl = document.getElementById('modal-price');
    const linkEl = document.getElementById('modal-link');
    const imageEl = document.getElementById('modal-image');

    console.log({ titleEl, priceEl, linkEl, imageEl }); // VOIR CE QUI EST NULL

    if (titleEl) titleEl.textContent = properties.title || "Titre non disponible";
    if (priceEl) priceEl.textContent = `${properties.price} € / mois`;
    if (linkEl) linkEl.href = `annonce?id=${properties.id}`;
    if (imageEl) imageEl.src = properties.coverPhoto || 'https://via.placeholder.com/400x250';

    if (modalElement) modalElement.style.display = 'flex';
}

    // --- Utilitaires et gestion mobile ---
    function getNestedValue(obj, path) {
        if (!path) return undefined;
        return path.split('.').reduce((acc, part) => (acc && acc[part] !== undefined) ? (isNaN(parseInt(part, 10)) ? acc[part] : acc[parseInt(part, 10)]) : undefined, obj);
    }
    
    document.getElementById('modal-close-button').addEventListener('click', () => modalElement.style.display = 'none');
    modalElement.addEventListener('click', (e) => (e.target === modalElement) && (modalElement.style.display = 'none'));

    if (isMobile) {
        mobileToggleButton.addEventListener('click', () => {
            const isMapActive = document.body.classList.contains('map-is-active');
            if (isMapActive) {
                document.body.classList.remove('map-is-active');
                mobileToggleButton.textContent = 'Afficher la carte';
                listContainer.scrollTo(0, 0);
            } else {
                document.body.classList.add('map-is-active');
                if (map) map.resize(); // Important pour que la carte s'affiche correctement
            }
        });
    }
});

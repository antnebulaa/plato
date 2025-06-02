// map-listings.js - VERSION AVEC POPUP STYLE AIRBNB

document.addEventListener('DOMContentLoaded', function() {
    console.log('[MAP_SCRIPT POPUP] Initialisation du module de carte avec popups.');

    const MAPTILER_API_KEY = 'UsgTlLJiePXeSnyh57aL';
    const MAP_CONTAINER_ID = 'map-section';
    const LIST_CONTAINER_ID = 'annonces-wrapper';
    const MOBILE_TOGGLE_BUTTON_ID = 'mobile-map-toggle';
    // const MODAL_ID = 'annonce-modal'; // On n'utilise plus la grosse modale pour les clics carte
    const SOURCE_ID = 'annonces-source';
    const LAYER_ID_PINS = 'annonces-pins-layer';
    const LAYER_ID_LABELS = 'annonces-labels-layer';

    const listContainer = document.getElementById(LIST_CONTAINER_ID);
    const mobileToggleButton = document.getElementById(MOBILE_TOGGLE_BUTTON_ID);
    // const modalElement = document.getElementById(MODAL_ID); // Plus nécessaire pour les clics carte

    let map = null;
    let allAnnouncements = [];
    let isMobile = window.innerWidth < 768;
    let currentPopup = null; // Garde une référence au popup actuel

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

    function initializeMap(initialGeoJSON) {
        map = new maplibregl.Map({
            container: MAP_CONTAINER_ID,
            style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_API_KEY}`,
            center: [2.3522, 48.8566],
            zoom: 11,
            renderWorldCopies: false
        });

        map.on('load', () => {
            console.log('[MAP_SCRIPT POPUP] Carte chargée. Ajout des couches et des événements.');

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

            map.on('click', LAYER_ID_PINS, handleMapClick);
            map.on('click', LAYER_ID_LABELS, handleMapClick);
            map.on('mouseenter', LAYER_ID_PINS, () => map.getCanvas().style.cursor = 'pointer');
            map.on('mouseleave', LAYER_ID_PINS, () => map.getCanvas().style.cursor = '');
            
            map.on('moveend', updateVisibleList);
            updateVisibleList();
        });

        map.addControl(new maplibregl.NavigationControl(), 'top-right');
    }
    
    function updateVisibleList() {
        if (!map.isStyleLoaded() || !listContainer) return;
        const visibleFeatures = map.queryRenderedFeatures({ layers: [LAYER_ID_PINS] });
        const visibleIds = new Set(visibleFeatures.map(feature => feature.properties.id));
        
        console.log(`[MAP_SCRIPT POPUP] ${visibleIds.size} annonces visibles. Mise à jour de la liste.`);

        const allListItems = listContainer.querySelectorAll('[data-property-id]');
        allListItems.forEach(item => {
            const itemId = parseInt(item.dataset.propertyId, 10);
            if (visibleIds.has(itemId)) {
                item.classList.remove('annonce-list-item-hidden');
            } else {
                item.classList.add('annonce-list-item-hidden');
            }
        });
        
        if (isMobile && mobileToggleButton) {
            mobileToggleButton.textContent = `Voir les ${visibleIds.size} logements`;
        }
    }

    // Nouvelle fonction pour créer le HTML du popup
    function createPopupHTML(properties) {
        const placeholderImage = 'https://i.imgur.com/KpaGW6j.png';
        const coverPhoto = properties.coverPhoto || placeholderImage;
        const title = properties.title || "Titre non disponible";
        const priceText = `${properties.price || '?'} € / mois`;
        const detailLink = `annonce?id=${properties.id}`;

        return `
            <div class="map-custom-popup">
                <img src="${coverPhoto}" alt="${title}" class="popup-image">
                <div class="popup-info">
                    <h4 class="popup-title">${title}</h4>
                    <p class="popup-price">${priceText}</p>
                    <a href="${detailLink}" class="popup-link" target="_blank">Voir détails</a>
                </div>
            </div>
        `;
    }
    
    // Modifiée pour utiliser maplibregl.Popup
    function handleMapClick(e) {
        if (e.features && e.features.length > 0) {
            const feature = e.features[0];
            const coordinates = feature.geometry.coordinates.slice();
            const properties = feature.properties;

            if (currentPopup) {
                currentPopup.remove();
            }

            while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
                coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
            }

            const popupHTML = createPopupHTML(properties);

            currentPopup = new maplibregl.Popup({ 
                    offset: 15, // Décalage par rapport au centre du cercle
                    closeButton: false, // On n'affiche pas le bouton X par défaut
                    className: 'airbnb-style-popup' // Pour styler le conteneur global du popup
                })
                .setLngLat(coordinates)
                .setHTML(popupHTML)
                .addTo(map);
        }
    }

    function getNestedValue(obj, path) {
        if (!path) return undefined;
        return path.split('.').reduce((acc, part) => (acc && acc[part] !== undefined) ? (isNaN(parseInt(part, 10)) ? acc[part] : acc[parseInt(part, 10)]) : undefined, obj);
    }
    
    // Logique pour la grosse modale (si elle est toujours utilisée ailleurs)
    // const modalCloseButton = document.getElementById('modal-close-button');
    // if (modalCloseButton) modalCloseButton.addEventListener('click', () => modalElement.style.display = 'none');
    // if (modalElement) modalElement.addEventListener('click', (e) => (e.target === modalElement) && (modalElement.style.display = 'none'));

    if (isMobile && mobileToggleButton) {
        mobileToggleButton.addEventListener('click', () => {
            const isMapActive = document.body.classList.contains('map-is-active');
            if (isMapActive) {
                document.body.classList.remove('map-is-active');
                mobileToggleButton.textContent = 'Afficher la carte';
                if (listContainer) listContainer.scrollTo(0, 0);
            } else {
                document.body.classList.add('map-is-active');
                if (map) map.resize();
            }
        });
    }
});

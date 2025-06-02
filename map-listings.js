// map-listings.js - VERSION AVEC POPUP AMÉLIORÉ ET PIN SÉLECTIONNÉ

document.addEventListener('DOMContentLoaded', function() {
    console.log('[MAP_SCRIPT V3] Initialisation avec pin sélectionné.');

    const MAPTILER_API_KEY = 'UsgTlLJiePXeSnyh57aL';
    const MAP_CONTAINER_ID = 'map-section';
    const LIST_CONTAINER_ID = 'annonces-wrapper';
    const MOBILE_TOGGLE_BUTTON_ID = 'mobile-map-toggle';
    const SOURCE_ID = 'annonces-source';
    const LAYER_ID_PINS = 'annonces-pins-layer';
    const LAYER_ID_LABELS = 'annonces-labels-layer';

    const listContainer = document.getElementById(LIST_CONTAINER_ID);
    const mobileToggleButton = document.getElementById(MOBILE_TOGGLE_BUTTON_ID);

    let map = null;
    let allAnnouncements = [];
    let isMobile = window.innerWidth < 768;
    let currentPopup = null;
    let selectedFeatureId = null; // Pour garder l'ID du pin actuellement sélectionné

    document.addEventListener('annoncesChargeesEtRendues', (event) => {
        const annonces = event.detail.annonces;
        if (!annonces || !Array.isArray(annonces)) return;
        
        allAnnouncements = annonces;
        const geojsonData = convertAnnoncesToGeoJSON(allAnnouncements);

        if (!map) {
            initializeMap(geojsonData);
        } else {
            // Si la carte existe déjà, on met juste à jour la source et on efface la sélection
            if (selectedFeatureId !== null) {
                map.setFeatureState({ source: SOURCE_ID, id: selectedFeatureId }, { selected: false });
                selectedFeatureId = null;
            }
            map.getSource(SOURCE_ID).setData(geojsonData);
        }
    });

  
// map-listings.js
// map-listings.js
function convertAnnoncesToGeoJSON(annonces) {
    const features = annonces.map(annonce => {
        const lat = getNestedValue(annonce, 'geo_location.data.lat');
        const lng = getNestedValue(annonce, 'geo_location.data.lng');

        if (annonce.id === undefined || annonce.id === null || lat === undefined || lng === undefined) {
            console.warn('[GEOJSON_CONVERT] Annonce sans ID ou coordonnées valides, ignorée:', annonce);
            return null;
        }

        let featureId = parseInt(annonce.id, 10); // Assurons-nous que c'est un nombre
        if (isNaN(featureId)) {
            console.warn('[GEOJSON_CONVERT] ID d\'annonce non numérique, ignorée:', annonce);
            return null;
        }

        return {
            type: 'Feature',
            id: featureId, // ID numérique à la racine
            geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
            properties: {
                // On peut garder l'id original ici aussi sous forme de string pour la liste
                id_str: String(annonce.id), 
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
            console.log('[MAP_SCRIPT V3] Carte chargée. Ajout des couches et des événements.');

            map.addSource(SOURCE_ID, { 
                type: 'geojson', 
                data: initialGeoJSON,
                promoteId: 'id' // Indique à MapLibre d'utiliser la propriété 'id' de nos features comme ID de source
            });
            
            // Couche des CERCLES (fond des pins)
            map.addLayer({
                id: LAYER_ID_PINS,
                type: 'circle',
                source: SOURCE_ID,
                paint: {
                    'circle-color': [
        'case',
        ['boolean', ['feature-state', 'selected'], false],
        '#007bff', // Bleu si sélectionné
        '#FFFFFF'  // Blanc par défaut
    ],
    'circle-stroke-color': [
        'case',
        ['boolean', ['feature-state', 'selected'], false],
        '#0056b3', // Bordure bleu foncé si sélectionné
        '#CCCCCC'  // Bordure grise par défaut
    ],
                    'circle-radius': 18, // Légèrement plus grand
                    'circle-stroke-width': [
                        'case',
                        ['boolean', ['feature-state', 'selected'], false],
                        2,       // Épaisseur de la bordure si sélectionné
                        1.5      // Épaisseur par défaut
                    ],
                    'circle-stroke-color': [
                        'case',
                        ['boolean', ['feature-state', 'selected'], false],
                        '#FFFFFF', // Couleur de bordure si sélectionné (blanc)
                        '#007bff'  // Couleur de bordure par défaut (bleu)
                    ]
                }
            });

            // Couche des LABELS (prix)
            map.addLayer({
                id: LAYER_ID_LABELS,
                type: 'symbol',
                source: SOURCE_ID,
                layout: {
                    'text-field': ['concat', ['to-string', ['get', 'price']], '€'],
                    'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
                    'text-size': 11, // Légèrement plus petit pour tenir dans le cercle
                    'text-allow-overlap': true
                },
                paint: {
                    'text-color': [
        'case',
        ['boolean', ['feature-state', 'selected'], false],
        '#FFFFFF', // Texte blanc si sélectionné (sur fond bleu)
        '#333333'  // Texte gris foncé par défaut (sur fond blanc)
    ]
                }
            });

            map.on('click', LAYER_ID_PINS, handleMapClick);
            map.on('click', LAYER_ID_LABELS, handleMapClick); // On peut aussi cliquer sur le label
            map.on('mouseenter', LAYER_ID_PINS, () => map.getCanvas().style.cursor = 'pointer');
            map.on('mouseleave', LAYER_ID_PINS, () => map.getCanvas().style.cursor = '');
            
            map.on('moveend', updateVisibleList);
            updateVisibleList();
        });

        map.addControl(new maplibregl.NavigationControl(), 'top-right');
    }
    
    // map-listings.js

// map-listings.js
// map-listings.js
function updateVisibleList() {
    if (!map.isStyleLoaded() || !listContainer) {
        // console.log('[UPDATE_LIST] Carte non prête ou listContainer non trouvé.'); // Déjà présent
        return;
    }
    const visibleFeatures = map.queryRenderedFeatures({ layers: [LAYER_ID_PINS] });

    // On utilise l'ID des propriétés qui est une chaîne pour la comparaison avec data-attributes
    const visiblePropertyIds = new Set(visibleFeatures.map(feature => feature.properties.id_str)); 

    console.log(`[UPDATE_LIST] Annonces visibles sur la carte (IDs de propriété):`, Array.from(visiblePropertyIds));

    const allListItems = listContainer.querySelectorAll('[data-property-id]');
    // ... (le reste de la fonction reste pareil, car item.dataset.propertyId est déjà une chaîne)
    // La comparaison sera visiblePropertyIds.has(itemIdString)
}
    if (allListItems.length === 0) {
        console.warn('[UPDATE_LIST] Aucun item trouvé dans la liste HTML avec [data-property-id].');
    }

    allListItems.forEach(item => {
        // item.dataset.propertyId est DÉJÀ une chaîne.
        const itemIdString = item.dataset.propertyId; 

        if (!itemIdString) { // Si un item n'a pas de data-property-id
            console.warn('[UPDATE_LIST] Item de liste sans data-property-id:', item);
            item.classList.add('annonce-list-item-hidden'); // Le cacher par précaution
            return;
        }

        const isVisibleOnMap = visibleIds.has(itemIdString);

        console.log(`[UPDATE_LIST] Traitement item HTML ID: "${itemIdString}", visible sur carte: ${isVisibleOnMap}`); 

        if (isVisibleOnMap) {
            item.classList.remove('annonce-list-item-hidden');
        } else {
            item.classList.add('annonce-list-item-hidden');
        }
    });

    if (isMobile && mobileToggleButton) {
        mobileToggleButton.textContent = `Voir les ${visibleIds.size} logements`;
    }
}

    function createPopupHTML(properties) {
        const placeholderImage = 'https://i.imgur.com/KpaGW6j.png';
        // On utilise original_id car 'id' est maintenant l'ID du feature MapLibre
        const coverPhoto = properties.coverPhoto || placeholderImage;
        const title = properties.title || "Titre non disponible";
        const priceText = `${properties.price || '?'} € / mois`;
        const detailLink = `annonce?id=${properties.id_str}`;

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
    
    function handleMapClick(e) {
        if (e.features && e.features.length > 0) {
            const feature = e.features[0];
            const coordinates = feature.geometry.coordinates.slice();
            const properties = feature.properties;
            const clickedFeatureId = feature.id; // L'ID du feature, promu depuis annonce.id

            console.log('[HANDLE_MAP_CLICK] Clic sur feature ID:', clickedFeatureId, 'Propriétés:', properties); // LOG 1

            // Retirer l'état 'selected' de l'ancien pin
            if (selectedFeatureId !== null) {
                console.log('[HANDLE_MAP_CLICK] Effacement état "selected" pour ID:', selectedFeatureId); // LOG 2
                map.setFeatureState({ source: SOURCE_ID, id: selectedFeatureId }, { selected: false });
            }

            // Mettre l'état 'selected' sur le nouveau pin
            console.log('[HANDLE_MAP_CLICK] Application état "selected" pour ID:', clickedFeatureId); // LOG 3
            map.setFeatureState({ source: SOURCE_ID, id: clickedFeatureId }, { selected: true });
            selectedFeatureId = clickedFeatureId; // Mettre à jour l'ID sélectionné

            if (currentPopup) {
                currentPopup.remove();
            }

            while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
                coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
            }

            const popupHTML = createPopupHTML(properties);

            currentPopup = new maplibregl.Popup({ 
                    offset: 10, // Ajusté car plus de flèche
                    closeButton: true, 
                    className: 'airbnb-style-popup'
                })
                .setLngLat(coordinates)
                .setHTML(popupHTML)
                .addTo(map);

            // Quand le popup est fermé, désélectionner le pin
            currentPopup.on('close', () => {
                if (selectedFeatureId !== null) {
                    console.log('[POPUP_CLOSE] Effacement état "selected" à la fermeture du popup pour ID:', selectedFeatureId); // LOG 4
                    map.setFeatureState({ source: SOURCE_ID, id: selectedFeatureId }, { selected: false });
                    selectedFeatureId = null;
                }
                currentPopup = null;
            });
        }
    }

    function getNestedValue(obj, path) {
        if (!path) return undefined;
        return path.split('.').reduce((acc, part) => (acc && acc[part] !== undefined) ? (isNaN(parseInt(part, 10)) ? acc[part] : acc[parseInt(part, 10)]) : undefined, obj);
    }
    
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

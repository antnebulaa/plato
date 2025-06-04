// map-listings.js - VERSION FINALE v10 - Une seule couche 3D et feature-state
document.addEventListener('DOMContentLoaded', function() {
    console.log('[MAP_SCRIPT V10] Approche avec une seule couche 3D et feature-state.');

    const MAPTILER_API_KEY = 'UsgTlLJiePXeSnyh57aL';
    const MAP_CONTAINER_ID = 'map-section';
    const LIST_CONTAINER_ID = 'annonces-wrapper';
    const MOBILE_TOGGLE_BUTTON_ID = 'mobile-map-toggle';
    const SOURCE_ID_ANNONCES = 'annonces-source'; // Source pour nos pins d'annonces
    const LAYER_ID_PINS = 'annonces-pins-layer';
    const LAYER_ID_LABELS = 'annonces-labels-layer';

    // Noms pour la source et la couche des bâtiments 3D (issus de vos logs console)
    const SOURCE_NAME_BUILDINGS = 'maptiler_planet'; 
    const SOURCE_LAYER_NAME_BUILDINGS = 'building';
    const LAYER_ID_BUILDINGS_3D = 'buildings-3d-layer'; // ID pour notre unique couche de bâtiments 3D

    const listContainer = document.getElementById(LIST_CONTAINER_ID);
    const mobileToggleButton = document.getElementById(MOBILE_TOGGLE_BUTTON_ID);

    let map = null;
    let allAnnouncements = [];
    let isMobile = window.innerWidth < 768;
    let currentPopup = null;
    let selectedPinId = null; // Pour le pin sélectionné (celui des annonces)
    let currentHighlightedBuildingIds = new Set(); // Pour suivre les bâtiments actuellement en rose

    document.addEventListener('annoncesChargeesEtRendues', (event) => {
        const annonces = event.detail.annonces;
        if (!annonces || !Array.isArray(annonces)) return;
        
        allAnnouncements = annonces;
        const geojsonData = convertAnnoncesToGeoJSON(allAnnouncements);

        if (!map) {
            initializeMap(geojsonData);
        } else {
            map.getSource(SOURCE_ID_ANNONCES).setData(geojsonData);
            // La mise à jour des bâtiments se fera après que la carte soit stable
            if (map.isStyleLoaded()) {
                 mettreAJourBatimentsSelectionnes(allAnnouncements);
            }
            if (geojsonData.features.length > 0) {
                 const bounds = getBounds(geojsonData);
                 map.fitBounds(bounds, { padding: 80, maxZoom: 16 });
            } else { 
                map.flyTo({ center: [2.3522, 48.8566], zoom: 11 }); 
            }
        }
    });

    function convertAnnoncesToGeoJSON(annonces) {
        const features = annonces.map(annonce => {
            const lat = getNestedValue(annonce, 'geo_location.data.lat');
            const lng = getNestedValue(annonce, 'geo_location.data.lng');
            if (annonce.id === undefined || annonce.id === null || lat === undefined || lng === undefined) return null;
            let featureId = parseInt(annonce.id, 10);
            if (isNaN(featureId)) return null;
            return { type: 'Feature', id: featureId, geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] }, properties: { id: featureId, id_str: String(annonce.id), price: getNestedValue(annonce, '_property_lease_of_property.0.loyer') || '?', title: getNestedValue(annonce, 'property_title'), coverPhoto: getNestedValue(annonce, '_property_photos.0.images.0.url') } };
        }).filter(Boolean);
        return { type: 'FeatureCollection', features };
    }

    async function mettreAJourBatimentsSelectionnes(annonces) {
        if (!map.isStyleLoaded()) {
            console.warn("[BÂTIMENTS DEBUG] Style non chargé, impossible de mettre à jour les bâtiments.");
            return;
        }

        // 1. Réinitialiser l'état des bâtiments précédemment mis en évidence
        currentHighlightedBuildingIds.forEach(buildingId => {
            map.setFeatureState({ source: SOURCE_NAME_BUILDINGS, sourceLayer: SOURCE_LAYER_NAME_BUILDINGS, id: buildingId }, { highlighted: false });
        });
        currentHighlightedBuildingIds.clear();

        if (!annonces || annonces.length === 0) {
            console.log("[BÂTIMENTS DEBUG] Aucune annonce, pas de bâtiments à mettre en évidence.");
            return;
        }
        
        await map.once('idle'); // Attendre que la carte soit stable
        
        const newBuildingIdsToHighlight = new Set();

        for (const annonce of annonces) {
            const lat = getNestedValue(annonce, 'geo_location.data.lat');
            const lng = getNestedValue(annonce, 'geo_location.data.lng');
            if (lat && lng) {
                const point = map.project([lng, lat]);
                const queryBox = [ [point.x - 10, point.y - 10], [point.x + 10, point.y + 10] ];
                // On interroge notre unique couche de bâtiments 3D
                const features = map.queryRenderedFeatures(queryBox, { layers: [LAYER_ID_BUILDINGS_3D] });
                if (features.length > 0 && features[0].id !== undefined) { // S'assurer que le feature a un ID
                    newBuildingIdsToHighlight.add(features[0].id);
                }
            }
        }

        // 2. Mettre en évidence les nouveaux bâtiments
        newBuildingIdsToHighlight.forEach(buildingId => {
            map.setFeatureState({ source: SOURCE_NAME_BUILDINGS, sourceLayer: SOURCE_LAYER_NAME_BUILDINGS, id: buildingId }, { highlighted: true });
        });
        currentHighlightedBuildingIds = newBuildingIdsToHighlight; // Mettre à jour la liste des bâtiments en rose

        console.log(`[BÂTIMENTS DEBUG] IDs mis en évidence : ${Array.from(currentHighlightedBuildingIds).join(', ')} (Total: ${currentHighlightedBuildingIds.size})`);
    }

    function getBounds(geojson) {
        const bounds = new maplibregl.LngLatBounds();
        geojson.features.forEach(feature => {
            bounds.extend(feature.geometry.coordinates);
        });
        return bounds;
    }

    function initializeMap(initialGeoJSON) {
        map = new maplibregl.Map({
            container: MAP_CONTAINER_ID,
            style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_API_KEY}`,
            pitch: 50,
            bearing: -15,
            renderWorldCopies: false
        });
        
        window.map = map; // Pour le débogage console

        if (initialGeoJSON.features.length > 0) {
            const bounds = getBounds(initialGeoJSON);
            map.fitBounds(bounds, { padding: 80, duration: 0, maxZoom: 16 });
        } else {
            map.setCenter([2.3522, 48.8566]);
            map.setZoom(11);
        }

        map.on('load', () => {
            console.log('[MAP_SCRIPT V10] Carte chargée. Ajout des couches.');
            map.addSource(SOURCE_ID_ANNONCES, { type: 'geojson', data: initialGeoJSON, promoteId: 'id' });

            const heightExpression = ['coalesce', ['get', 'height'], 20]; 
            const minHeightExpression = ['coalesce', ['get', 'min_height'], 0];

            // ============================ UNE SEULE COUCHE 3D POUR LES BÂTIMENTS ============================
            map.addLayer({
                'id': LAYER_ID_BUILDINGS_3D, // Utilisation de la constante définie
                'type': 'fill-extrusion',
                'source': SOURCE_NAME_BUILDINGS,
                'source-layer': SOURCE_LAYER_NAME_BUILDINGS,
                // Pas de filtre ici, on dessine tous les bâtiments de la source
                'paint': { 
                    // Coloration conditionnelle basée sur le feature-state 'highlighted'
                    'fill-extrusion-color': [
                        'case',
                        ['boolean', ['feature-state', 'highlighted'], false], // Si 'highlighted' est true
                        '#FF1493', // Couleur rose
                        '#dfdfdf'  // Couleur grise par défaut
                    ],
                    'fill-extrusion-height': heightExpression, 
                    'fill-extrusion-base': minHeightExpression, 
                    'fill-extrusion-opacity': 0.85 // Opacité unique pour éviter les conflits
                }
            }, LAYER_ID_PINS); // Insérer AVANT la couche des pins pour qu'ils soient au-dessus
            // ========================================================================================
            
            map.addLayer({
                id: LAYER_ID_PINS, type: 'circle', source: SOURCE_ID_ANNONCES,
                paint: { 'circle-radius': 22, 'circle-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#007bff', '#FFFFFF'], 'circle-stroke-width': ['case', ['boolean', ['feature-state', 'selected'], false], 1, 1.5], 'circle-stroke-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#FFFFFF', '#eeeeee'] }
            });
            map.addLayer({
                id: LAYER_ID_LABELS, type: 'symbol', source: SOURCE_ID_ANNONCES,
                layout: { 'text-field': ['concat', ['to-string', ['get', 'price']], '€'], 'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'], 'text-size': 14, 'text-allow-overlap': false },
                paint: { 'text-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#FFFFFF', '#333333'] }
            });
            
            map.on('click', LAYER_ID_PINS, handleMapClick);
            map.on('mouseenter', LAYER_ID_PINS, () => map.getCanvas().style.cursor = 'pointer');
            map.on('mouseleave', LAYER_ID_PINS, () => map.getCanvas().style.cursor = '');
            map.on('moveend', updateVisibleList);

            updateVisibleList();
            mettreAJourBatimentsSelectionnes(allAnnouncements); 
        });

        map.addControl(new maplibregl.NavigationControl(), 'top-right');
    }
    
    function updateVisibleList() {
        if (!map || !map.isStyleLoaded() || !listContainer) return;
        const visibleFeatures = map.queryRenderedFeatures({ layers: [LAYER_ID_PINS] });
        const visiblePropertyIds = new Set(visibleFeatures.map(feature => String(feature.properties.id)));
        const allListItems = listContainer.querySelectorAll('[data-property-id]');
        allListItems.forEach(itemDiv => {
            const itemIdString = itemDiv.dataset.propertyId;
            const anchorTag = itemDiv.parentElement;
            if (!anchorTag || anchorTag.tagName !== 'A') { itemDiv.style.display = visiblePropertyIds.has(itemIdString) ? '' : 'none'; return; }
            if (visiblePropertyIds.has(itemIdString)) { anchorTag.classList.remove('annonce-list-item-hidden'); } 
            else { anchorTag.classList.add('annonce-list-item-hidden'); }
        });
        if (isMobile && mobileToggleButton) { mobileToggleButton.textContent = `Voir les ${visiblePropertyIds.size} logements`; }
    }

    function createPopupHTML(properties) {
        const placeholderImage = 'https://via.placeholder.com/280x150/cccccc/969696?text=Image';
        const coverPhoto = properties.coverPhoto || placeholderImage;
        const title = properties.title || "Titre non disponible";
        const priceText = `${properties.price || '?'} € / mois`;
        const detailLink = `annonce?id=${properties.id_str}`;
        return `<div class="map-custom-popup"><img src="${coverPhoto}" alt="${title}" class="popup-image" onerror="this.src='${placeholderImage}'"><div class="popup-info"><h4 class="popup-title">${title}</h4><p class="popup-price">${priceText}</p><a href="${detailLink}" class="popup-link" target="_blank">Voir détails</a></div></div>`;
    }
    
    function handleMapClick(e) {
        if (e.features && e.features.length > 0) {
            const feature = e.features[0];
            const coordinates = feature.geometry.coordinates.slice();
            const properties = feature.properties;
            const clickedPinId = feature.id; // C'est l'ID du pin (annonce)
            if (selectedPinId !== null && selectedPinId !== clickedPinId) {
                map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: selectedPinId }, { selected: false });
            }
            map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: clickedPinId }, { selected: true });
            selectedPinId = clickedPinId;
            if (currentPopup) currentPopup.remove();
            const popupHTML = createPopupHTML(properties);
            currentPopup = new maplibregl.Popup({ offset: 10, closeButton: true, className: 'airbnb-style-popup' }).setLngLat(coordinates).setHTML(popupHTML).addTo(map);
            currentPopup.on('close', () => {
                if (selectedPinId === clickedPinId) {
                    map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: selectedPinId }, { selected: false });
                    selectedPinId = null;
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
            document.body.classList.toggle('map-is-active');
            if (document.body.classList.contains('map-is-active')) {
                if (map) map.resize();
                mobileToggleButton.textContent = `Voir la liste`;
            } else {
                if (listContainer) listContainer.scrollTo(0, 0);
                mobileToggleButton.textContent = `Afficher la carte`;
            }
        });
    }
});

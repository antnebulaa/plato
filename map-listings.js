// map-listings.js - VERSION FINALE v10 - Une seule couche 3D et feature-state
document.addEventListener('DOMContentLoaded', function() {
    console.log('[MAP_SCRIPT V10] Approche avec une seule couche 3D et feature-state.');

    const MAPTILER_API_KEY = 'UsgTlLJiePXeSnyh57aL';
    const MAP_CONTAINER_ID = 'map-section';
    const LIST_CONTAINER_ID = 'annonces-wrapper';
    const MOBILE_TOGGLE_BUTTON_ID = 'mobile-map-toggle';
    const SOURCE_ID_ANNONCES = 'annonces-source';
    const LAYER_ID_PINS = 'annonces-pins-layer';
    const LAYER_ID_LABELS = 'annonces-labels-layer';

    const SOURCE_NAME_BUILDINGS = 'maptiler_planet';
    const SOURCE_LAYER_NAME_BUILDINGS = 'building';
    const LAYER_ID_BUILDINGS_3D = 'buildings-3d-layer';

    const listContainer = document.getElementById(LIST_CONTAINER_ID);
    const mobileToggleButton = document.getElementById(MOBILE_TOGGLE_BUTTON_ID);

    let map = null;
    let allAnnouncements = [];
    let isMobile = window.innerWidth < 768;
    let currentPopup = null; // For desktop maplibre popup
    let selectedPinId = null;
    let currentHighlightedBuildingIds = new Set();

    // --- NEW: Mobile Bottom Sheet Elements ---
    const mobileBottomSheet = document.getElementById('mobile-bottom-sheet');
    const mobileBottomSheetContent = document.getElementById('mobile-bottom-sheet-content');
    const bottomSheetCloseButton = document.getElementById('bottom-sheet-close-button');
    // --- END NEW ---

    // Listen for window resize to update isMobile
    window.addEventListener('resize', () => {
        isMobile = window.innerWidth < 768;
        // If resizing from desktop to mobile with a popup open, close the map popup
        if (isMobile && currentPopup) {
            currentPopup.remove();
            currentPopup = null;
        }
        // If resizing from mobile to desktop with bottom sheet open, close bottom sheet
        if (!isMobile && mobileBottomSheet && mobileBottomSheet.classList.contains('visible')) {
            closeMobileBottomSheet();
        }
    });


    if (bottomSheetCloseButton) {
        bottomSheetCloseButton.addEventListener('click', closeMobileBottomSheet);
    }

    document.addEventListener('annoncesChargeesEtRendues', (event) => {
        const annonces = event.detail.annonces;
        if (!annonces || !Array.isArray(annonces)) return;
        
        allAnnouncements = annonces;
        const geojsonData = convertAnnoncesToGeoJSON(allAnnouncements);

        if (!map) {
            initializeMap(geojsonData);
        } else {
            map.getSource(SOURCE_ID_ANNONCES).setData(geojsonData);
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
        currentHighlightedBuildingIds.forEach(buildingId => {
            map.setFeatureState({ source: SOURCE_NAME_BUILDINGS, sourceLayer: SOURCE_LAYER_NAME_BUILDINGS, id: buildingId }, { highlighted: false });
        });
        currentHighlightedBuildingIds.clear();
        if (!annonces || annonces.length === 0) {
            console.log("[BÂTIMENTS DEBUG] Aucune annonce, pas de bâtiments à mettre en évidence.");
            return;
        }
        await map.once('idle');
        const newBuildingIdsToHighlight = new Set();
        for (const annonce of annonces) {
            const lat = getNestedValue(annonce, 'geo_location.data.lat');
            const lng = getNestedValue(annonce, 'geo_location.data.lng');
            if (lat && lng) {
                const point = map.project([lng, lat]);
                const queryBox = [ [point.x - 10, point.y - 10], [point.x + 10, point.y + 10] ];
                const features = map.queryRenderedFeatures(queryBox, { layers: [LAYER_ID_BUILDINGS_3D] });
                if (features.length > 0 && features[0].id !== undefined) {
                    newBuildingIdsToHighlight.add(features[0].id);
                }
            }
        }
        newBuildingIdsToHighlight.forEach(buildingId => {
            map.setFeatureState({ source: SOURCE_NAME_BUILDINGS, sourceLayer: SOURCE_LAYER_NAME_BUILDINGS, id: buildingId }, { highlighted: true });
        });
        currentHighlightedBuildingIds = newBuildingIdsToHighlight;
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
            navigationControl: false,
            renderWorldCopies: false
        });
        window.map = map;
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
            map.addLayer({
                'id': LAYER_ID_BUILDINGS_3D,
                'type': 'fill-extrusion',
                'source': SOURCE_NAME_BUILDINGS,
                'source-layer': SOURCE_LAYER_NAME_BUILDINGS,
                'paint': { 
                    'fill-extrusion-color': ['case', ['boolean', ['feature-state', 'highlighted'], false], '#FF1493', '#dfdfdf'],
                    'fill-extrusion-height': heightExpression, 
                    'fill-extrusion-base': minHeightExpression, 
                    'fill-extrusion-opacity': 0.85
                }
            }, LAYER_ID_PINS);
            map.addLayer({
                id: LAYER_ID_PINS, type: 'circle', source: SOURCE_ID_ANNONCES,
                paint: { 'circle-radius': 26, 'circle-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#007bff', '#FFFFFF'], 'circle-stroke-width': ['case', ['boolean', ['feature-state', 'selected'], false], 1, 1.5], 'circle-stroke-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#FFFFFF', '#eeeeee'] }
            });
            map.addLayer({
                id: LAYER_ID_LABELS, type: 'symbol', source: SOURCE_ID_ANNONCES,
                layout: { 'text-field': ['concat', ['to-string', ['get', 'price']], '€'],'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'], 'text-size': 14, 'text-allow-overlap': false },
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

    function createPopupHTML(properties) { // This function is now used by both desktop popup and mobile sheet
        const placeholderImage = 'https://via.placeholder.com/280x150/cccccc/969696?text=Image';
        const coverPhoto = properties.coverPhoto || placeholderImage;
        const title = properties.title || "Titre non disponible";
        const priceText = `${properties.price || '?'} € / mois`;
        const detailLink = `annonce?id=${properties.id_str}`;
        // The outer div class "map-custom-popup" will be used for styling consistency
        return `<div class="map-custom-popup"><img src="${coverPhoto}" alt="${title}" class="popup-image" onerror="this.src='${placeholderImage}'"><div class="popup-info"><h4 class="popup-title">${title}</h4><p class="popup-price">${priceText}</p><a href="${detailLink}" class="popup-link" target="_blank">Voir détails</a></div></div>`;
    }

    // --- NEW: Function to open mobile bottom sheet ---
    function openMobileBottomSheet(properties) {
        if (!mobileBottomSheet || !mobileBottomSheetContent) return;
        const contentHTML = createPopupHTML(properties);
        mobileBottomSheetContent.innerHTML = contentHTML;
        mobileBottomSheet.classList.add('visible');
    }
    // --- END NEW ---

    // --- NEW: Function to close mobile bottom sheet ---
    function closeMobileBottomSheet() {
        if (!mobileBottomSheet) return;
        mobileBottomSheet.classList.remove('visible');
        // Clear content after transition (optional, but good for cleanup)
        setTimeout(() => {
            if (mobileBottomSheetContent) mobileBottomSheetContent.innerHTML = '';
        }, 300); // Match CSS transition time

        // Deselect the pin on the map
        if (map && selectedPinId !== null) {
            map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: selectedPinId }, { selected: false });
            selectedPinId = null; // Clear selection as the sheet is closed
        }
    }
    // --- END NEW ---
    
    function handleMapClick(e) {
        if (e.features && e.features.length > 0) {
            const feature = e.features[0];
            const coordinates = feature.geometry.coordinates.slice(); // Important for maplibre popup
            const properties = feature.properties;
            const clickedPinId = feature.id;

            // If a different pin was already selected (either in popup or sheet), deselect it first
            if (selectedPinId !== null && selectedPinId !== clickedPinId) {
                map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: selectedPinId }, { selected: false });
            }
            // Select the new pin
            map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: clickedPinId }, { selected: true });
            selectedPinId = clickedPinId; // Update the globally tracked selectedPinId

            if (isMobile) {
                // On mobile, ensure any maplibre popup is gone and open the bottom sheet
                if (currentPopup) {
                    currentPopup.remove();
                    currentPopup = null;
                }
                openMobileBottomSheet(properties);
            } else {
                // On desktop, ensure mobile bottom sheet is hidden and use maplibre popup
                if (mobileBottomSheet && mobileBottomSheet.classList.contains('visible')) {
                    closeMobileBottomSheet(); // This will also deselect pin if logic is there, ensure it doesn't conflict
                }
                if (currentPopup) currentPopup.remove(); // Remove previous maplibre popup

                const popupHTML = createPopupHTML(properties);
                currentPopup = new maplibregl.Popup({ offset: 10, closeButton: true, className: 'airbnb-style-popup' })
                    .setLngLat(coordinates)
                    .setHTML(popupHTML)
                    .addTo(map);

                currentPopup.on('close', () => {
                    // This event fires when the maplibre popup's own close button is clicked
                    if (selectedPinId === clickedPinId) { // Check if the closed popup corresponds to the current selection
                        map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: selectedPinId }, { selected: false });
                        selectedPinId = null; // Clear selection
                    }
                    currentPopup = null;
                });
            }
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

// map-listings.js - VERSION 11.6 - Standard MapLibre Popup for mobile, robust ID
document.addEventListener('DOMContentLoaded', function() {
    console.log('[MAP_SCRIPT V11.6] Initialisation. Standard MapLibre Popup for mobile.');

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
    let currentMapLibrePopup = null; // Un seul popup MapLibre géré
    let selectedPinIdForState = null; 
    let currentHighlightedBuildingIds = new Set();

    document.addEventListener('annoncesChargeesEtRendues', (event) => {
        console.log('[MAP_SCRIPT V11.6] Événement "annoncesChargeesEtRendues".');
        const annonces = event.detail.annonces;
        allAnnouncements = (annonces && Array.isArray(annonces)) ? annonces : [];
        console.log(`[MAP_SCRIPT V11.6] Nb annonces après event: ${allAnnouncements.length}`);
        const geojsonData = convertAnnoncesToGeoJSON(allAnnouncements);

        if (!map) {
            initializeMap(geojsonData);
        } else {
            if (map.getSource(SOURCE_ID_ANNONCES)) {
                map.getSource(SOURCE_ID_ANNONCES).setData(geojsonData);
            } else {
                map.once('styledata', () => { 
                    if (map.getSource(SOURCE_ID_ANNONCES)) {
                         map.getSource(SOURCE_ID_ANNONCES).setData(geojsonData);
                    } else {
                        map.addSource(SOURCE_ID_ANNONCES, { type: 'geojson', data: geojsonData, promoteId: 'id' });
                    }
                });
            }
            const updateLogic = () => {
                mettreAJourBatimentsSelectionnes(allAnnouncements); 
                if (geojsonData.features.length > 0) {
                    const bounds = getBounds(geojsonData);
                    if (bounds.getSouthWest() && bounds.getNorthEast()){
                         map.fitBounds(bounds, { padding: isMobile ? 60 : 80, maxZoom: 16, duration:0 }); // Increased mobile padding slightly
                    }
                } else { 
                    map.flyTo({ center: [2.3522, 48.8566], zoom: 11, duration:0 }); 
                }
                updateVisibleList();
            };
            if (map.isStyleLoaded()) updateLogic();
            else map.once('load', updateLogic); 
        }
    });

    function convertAnnoncesToGeoJSON(annonces) {
        const features = annonces.map(annonce => {
            const lat = getNestedValue(annonce, 'geo_location.data.lat');
            const lng = getNestedValue(annonce, 'geo_location.data.lng');
            if (annonce.id === undefined || annonce.id === null || lat === undefined || lng === undefined) return null;
            let featureId = parseInt(annonce.id, 10); 
            if (isNaN(featureId)) {
                console.warn(`[MAP_SCRIPT V11.6] Annonce ID "${annonce.id}" non numérique, ignorée pour feature 'id'.`);
                return null; 
            }
            return {
                type: 'Feature', id: featureId, 
                geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
                properties: {
                    id_str: String(annonce.id), 
                    price: getNestedValue(annonce, '_property_lease_of_property.0.loyer') || '?',
                    title: getNestedValue(annonce, 'property_title'),
                    coverPhoto: getNestedValue(annonce, '_property_photos.0.images.0.url')
                }
            };
        }).filter(feature => feature !== null);
        console.log(`[MAP_SCRIPT V11.6] ${features.length} features GeoJSON valides créés.`);
        return { type: 'FeatureCollection', features };
    }
    
    async function mettreAJourBatimentsSelectionnes(annonces) {
        if (!map || !map.isStyleLoaded() || !map.getSource(SOURCE_NAME_BUILDINGS) || !map.getLayer(LAYER_ID_BUILDINGS_3D)) return;
        currentHighlightedBuildingIds.forEach(buildingId => {
             try {
                if (map.getFeatureState({ source: SOURCE_NAME_BUILDINGS, sourceLayer: SOURCE_LAYER_NAME_BUILDINGS, id: buildingId })?.highlighted) {
                    map.setFeatureState({ source: SOURCE_NAME_BUILDINGS, sourceLayer: SOURCE_LAYER_NAME_BUILDINGS, id: buildingId }, { highlighted: false });
                }
             } catch(e){ /* ignore */ }
        });
        currentHighlightedBuildingIds.clear();
        if (!annonces || annonces.length === 0) return;
        try { await map.once('idle'); } catch(e) { /* ignore */ }
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
            try {
                map.setFeatureState({ source: SOURCE_NAME_BUILDINGS, sourceLayer: SOURCE_LAYER_NAME_BUILDINGS, id: buildingId }, { highlighted: true });
            } catch(e){ /* ignore */ }
        });
        currentHighlightedBuildingIds = newBuildingIdsToHighlight;
    }

    function getBounds(geojson) {
        const bounds = new maplibregl.LngLatBounds();
        if (geojson && geojson.features) {
            geojson.features.forEach(feature => {
                if(feature && feature.geometry && feature.geometry.coordinates && 
                   typeof feature.geometry.coordinates[0] === 'number' && 
                   typeof feature.geometry.coordinates[1] === 'number') {
                    try { bounds.extend(feature.geometry.coordinates); } catch (e) { /* ignore */ }
                }
            });
        }
        return bounds;
    }

    function initializeMap(initialGeoJSON) {
        console.log('[MAP_SCRIPT V11.6] Initialisation MapLibre.');
        map = new maplibregl.Map({
            container: MAP_CONTAINER_ID, style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_API_KEY}`,
            pitch: isMobile ? 0 : 50, bearing: isMobile ? 0 : -15, center: [2.3522, 48.8566], zoom: 11,
            navigationControl: false, renderWorldCopies: false, interactive: true,
        });
        window.map = map; 
        if (initialGeoJSON && initialGeoJSON.features && initialGeoJSON.features.length > 0) {
            const bounds = getBounds(initialGeoJSON);
            if (bounds.getSouthWest() && bounds.getNorthEast()) { 
                 map.fitBounds(bounds, { padding: isMobile ? 60 : 80, duration: 0, maxZoom: 16 });
            }
        }
        map.on('load', () => {
            console.log('[MAP_SCRIPT V11.6] Événement "load" carte MapLibre.');
            map.addSource(SOURCE_ID_ANNONCES, { type: 'geojson', data: initialGeoJSON, promoteId: 'id' });
            console.log(`[MAP_SCRIPT V11.6] Source "${SOURCE_ID_ANNONCES}" ajoutée.`);
            const heightExpression = ['coalesce', ['get', 'height'], 20]; 
            const minHeightExpression = ['coalesce', ['get', 'min_height'], 0];
            if (map.getSource(SOURCE_NAME_BUILDINGS)) {
                 map.addLayer({
                    'id': LAYER_ID_BUILDINGS_3D, 'type': 'fill-extrusion', 'source': SOURCE_NAME_BUILDINGS,
                    'source-layer': SOURCE_LAYER_NAME_BUILDINGS, 
                    'paint': { 
                        'fill-extrusion-color': ['case', ['boolean', ['feature-state', 'highlighted'], false], '#FF1493', '#dfdfdf'],
                        'fill-extrusion-height': heightExpression, 'fill-extrusion-base': minHeightExpression, 'fill-extrusion-opacity': 0.85
                    }
                }); 
                 console.log(`[MAP_SCRIPT V11.6] Couche "${LAYER_ID_BUILDINGS_3D}" ajoutée.`);
            } else { console.warn(`[MAP_SCRIPT V11.6] Source bâtiments "${SOURCE_NAME_BUILDINGS}" non trouvée.`); }
            map.addLayer({
                id: LAYER_ID_PINS, type: 'circle', source: SOURCE_ID_ANNONCES,
                paint: { 
                    'circle-radius': 26, 'circle-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#007bff', '#FFFFFF'],
                    'circle-stroke-width': ['case', ['boolean', ['feature-state', 'selected'], false], 2, 1.5],
                    'circle-stroke-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#FFFFFF', '#007bff']
                }
            });
            console.log(`[MAP_SCRIPT V11.6] Couche "${LAYER_ID_PINS}" ajoutée.`);
            map.addLayer({
                id: LAYER_ID_LABELS, type: 'symbol', source: SOURCE_ID_ANNONCES,
                layout: { 
                    'text-field': ['concat', ['to-string', ['get', 'price']], '€'],
                    'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'], 
                    'text-size': 14, 'text-allow-overlap': false, 'text-ignore-placement': false
                },
                paint: { 'text-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#FFFFFF', '#333333'] }
            });
            console.log(`[MAP_SCRIPT V11.6] Couche "${LAYER_ID_LABELS}" ajoutée.`);
            map.on('click', LAYER_ID_PINS, handleMapClick);
            map.on('mouseenter', LAYER_ID_PINS, () => map.getCanvas().style.cursor = 'pointer');
            map.on('mouseleave', LAYER_ID_PINS, () => map.getCanvas().style.cursor = '');
            map.on('moveend', updateVisibleList); map.on('idle', updateVisibleList); 
            updateVisibleList(); updateMobileButtonAndViewState(); 
            if (map.isStyleLoaded() && map.getSource(SOURCE_NAME_BUILDINGS) && map.getLayer(LAYER_ID_BUILDINGS_3D)) {
                mettreAJourBatimentsSelectionnes(allAnnouncements);
            }
        });
        map.on('error', (e) => { console.error('[MAP_SCRIPT V11.6] Erreur MapLibre:', e.error ? e.error.message : e); });
        map.addControl(new maplibregl.NavigationControl(), 'top-right');
    }

    function updateMobileButtonAndViewState() {
        if (!mobileToggleButton) return;
        if (isMobile) {
            mobileToggleButton.style.display = ''; 
            if (document.body.classList.contains('map-is-active')) {
                if (map && map.isStyleLoaded() && map.getSource(SOURCE_ID_ANNONCES)) {
                    const visibleFeatures = map.queryRenderedFeatures({ layers: [LAYER_ID_PINS] });
                    const count = visibleFeatures.length;
                    mobileToggleButton.textContent = `Voir les ${count} logement${count !== 1 ? 's' : ''}`;
                } else { mobileToggleButton.textContent = `Voir les logements`; }
            } else { mobileToggleButton.textContent = 'Afficher la carte'; }
        } else { mobileToggleButton.style.display = 'none';  }
    }

    function updateVisibleList() {
        if (!map || !map.isStyleLoaded() || !listContainer || !map.getSource(SOURCE_ID_ANNONCES)) return;
        const visibleFeatures = map.queryRenderedFeatures({ layers: [LAYER_ID_PINS] });
        const visiblePropertyIds = new Set(visibleFeatures.map(feature => String(feature.properties.id_str || feature.id)));
        const allListItems = listContainer.querySelectorAll('[data-property-id]'); 
        allListItems.forEach(itemDiv => {
            const itemIdString = itemDiv.dataset.propertyId;
            const anchorTag = itemDiv.parentElement.tagName === 'A' ? itemDiv.parentElement : itemDiv; 
            if (visiblePropertyIds.has(itemIdString)) anchorTag.classList.remove('annonce-list-item-hidden');
            else anchorTag.classList.add('annonce-list-item-hidden');
        });
        updateMobileButtonAndViewState();
    }

    function createPopupHTML(properties) {
        const placeholderImage = 'https://placehold.co/280x150/EFEFEF/AAAAAA?text=Image';
        const coverPhoto = properties.coverPhoto || placeholderImage;
        const title = properties.title || "Titre non disponible";
        const priceText = `${properties.price || '?'} € / mois`;
        const detailLink = `annonce?id=${properties.id_str}`; 
        return `<div class="map-custom-popup"><img src="${coverPhoto}" alt="${title}" class="popup-image" onerror="this.onerror=null;this.src='${placeholderImage}';"><div class="popup-info"><h4 class="popup-title">${title}</h4><p class="popup-price">${priceText}</p><a href="${detailLink}" class="popup-link" target="_blank">Voir détails</a></div></div>`;
    }

    function handleMapClick(e) {
        console.log('[MAP_SCRIPT V11.6] Entrée handleMapClick. Event features:', e.features);
        if (!e.features || e.features.length === 0) {
            console.log('[MAP_SCRIPT V11.6] Aucun feature cliqué.');
            return;
        }
        const feature = e.features[0];
        const properties = feature.properties; 
        const coordinates = feature.geometry.coordinates.slice();
        let idPourFeatureState;

        console.log('[MAP_SCRIPT V11.6] Feature brut du clic:', feature);

        if (typeof feature.id === 'number') {
            idPourFeatureState = feature.id;
        } else if (properties && properties.id_str !== undefined) {
            const parsedId = parseInt(properties.id_str, 10);
            if (!isNaN(parsedId)) idPourFeatureState = parsedId;
            else console.error(`[MAP_SCRIPT V11.6] ERREUR: Impossible de parser properties.id_str ("${properties.id_str}") en nombre.`);
        } else {
            console.error(`[MAP_SCRIPT V11.6] ERREUR: feature.id ET properties.id_str non utilisables pour ID.`);
        }
        console.log(`[MAP_SCRIPT V11.6] ID pour setFeatureState: ${idPourFeatureState} (type: ${typeof idPourFeatureState})`);

        if (typeof idPourFeatureState === 'number') {
            if (selectedPinIdForState !== null && selectedPinIdForState !== idPourFeatureState) {
                try {
                  if (map.getLayer(LAYER_ID_PINS) && map.getSource(SOURCE_ID_ANNONCES)) { 
                    map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: selectedPinIdForState }, { selected: false });
                  }
                } catch (error) { console.warn("[MAP_SCRIPT V11.6] Erreur désélection ancien pin:", error.message); }
            }
            try {
                if (map.getLayer(LAYER_ID_PINS) && map.getSource(SOURCE_ID_ANNONCES)) {
                     map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: idPourFeatureState }, { selected: true });
                     console.log(`[MAP_SCRIPT V11.6] setFeatureState (select) OK pour ID: ${idPourFeatureState}`);
                }
            } catch (error) { console.error("[MAP_SCRIPT V11.6] Erreur setFeatureState (select):", error.message); }
            selectedPinIdForState = idPourFeatureState;
        } else {
            console.warn("[MAP_SCRIPT V11.6] Aucun ID numérique valide pour setFeatureState.");
            if(selectedPinIdForState !== null) {
                 try { 
                    if (map.getLayer(LAYER_ID_PINS) && map.getSource(SOURCE_ID_ANNONCES)) {
                        map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: selectedPinIdForState }, { selected: false }); 
                    }
                 } catch(e) {/*ignore*/}
                 selectedPinIdForState = null;
            }
        }

        // Utilisation de maplibregl.Popup pour tous les appareils
        if (currentMapLibrePopup) {
            currentMapLibrePopup.remove();
            currentMapLibrePopup = null;
        }

        const popupHTML = createPopupHTML(properties);
        currentMapLibrePopup = new maplibregl.Popup({ 
            offset: isMobile ? 15 : 25, // Offset légèrement différent pour mobile si besoin
            closeButton: true, 
            className: 'airbnb-style-popup' // Assurez-vous que ce style est bien défini dans votre CSS
        })
        .setLngLat(coordinates)
        .setHTML(popupHTML)
        .addTo(map);
        console.log('[MAP_SCRIPT V11.6] Popup MapLibre ajouté/mis à jour.');

        currentMapLibrePopup.on('close', () => {
            console.log('[MAP_SCRIPT V11.6] Popup MapLibre fermé.');
            if (typeof idPourFeatureState === 'number' && selectedPinIdForState === idPourFeatureState) { 
                try {
                    if (map.getLayer(LAYER_ID_PINS) && map.getSource(SOURCE_ID_ANNONCES)) {
                         map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: selectedPinIdForState }, { selected: false });
                    }
                } catch (error) { /* ignore */ }
                selectedPinIdForState = null;
            }
            currentMapLibrePopup = null;
        });

        // Centrer la carte sur le pin cliqué, surtout utile sur mobile
        // Le padding [top, right, bottom, left] peut aider à ne pas cacher le popup par les contrôles de la carte
        const flyToPadding = isMobile ? {bottom: 150, top:50, left:30, right:30} : {bottom: 50, top:50, left:50, right:50}; 
        map.flyTo({ 
            center: coordinates, 
            zoom: Math.max(map.getZoom(), 15), 
            essential: true,
            padding: flyToPadding 
        });

        if (isMobile) {
            scrollListItemIntoView(properties.id_str); 
        }
    }

    function getNestedValue(obj, path) {
        if (!obj || !path) return undefined;
        return path.split('.').reduce((acc, part) => {
            if (acc === undefined || acc === null) return undefined;
            const partAsInt = parseInt(part, 10);
            if (Array.isArray(acc) && !isNaN(partAsInt) && partAsInt >= 0 && partAsInt < acc.length) { return acc[partAsInt]; }
            return acc[part];
        }, obj);
    }
    
    if (mobileToggleButton) {
        mobileToggleButton.addEventListener('click', () => {
            if (!isMobile) return; document.body.classList.toggle('map-is-active');
            console.log(`[MAP_SCRIPT V11.6] Bascule mobile. map-is-active: ${document.body.classList.contains('map-is-active')}`);
            if (document.body.classList.contains('map-is-active')) { if (map) map.resize(); } 
            else { if (listContainer) listContainer.scrollTo(0, 0); }
            updateMobileButtonAndViewState(); 
        });
    } else { console.warn(`[MAP_SCRIPT V11.6] Bouton bascule mobile (ID: ${MOBILE_TOGGLE_BUTTON_ID}) non trouvé.`); }
    
    window.addEventListener('resize', () => {
        const previouslyMobile = isMobile; isMobile = window.innerWidth < 768;
        if (previouslyMobile !== isMobile) {
            console.log(`[MAP_SCRIPT V11.6] Changement mode: ${previouslyMobile ? 'Mobile -> Desktop' : 'Desktop -> Mobile'}`);
            if (currentMapLibrePopup) { // Si un popup est ouvert, le fermer lors du changement de mode
                currentMapLibrePopup.remove();
                currentMapLibrePopup = null;
                 if (selectedPinIdForState !== null) { // Et désélectionner le pin
                    try {
                        map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: selectedPinIdForState }, { selected: false });
                    } catch(e) {/* ignore */}
                    selectedPinIdForState = null;
                }
            }
            if (map) { map.setPitch(isMobile ? 0 : 50); map.setBearing(isMobile ? 0 : -15); }
        }
        updateMobileButtonAndViewState(); 
    });

    function scrollListItemIntoView(propertyIdStr) {
        if (!listContainer || !propertyIdStr) return;
        if (isMobile && document.body.classList.contains('map-is-active')) return; 
        const itemInList = listContainer.querySelector(`[data-property-id="${propertyIdStr}"]`);
        if (itemInList) {
            const scrollTarget = itemInList.closest('a, div[data-property-id]'); 
            if (scrollTarget) scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    console.log('[MAP_SCRIPT V11.6] Appel initial updateMobileButtonAndViewState.');
    updateMobileButtonAndViewState();
});

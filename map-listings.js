document.addEventListener('DOMContentLoaded', function() {
            setTimeout(function() {
                console.log('[MAP_SCRIPT V11.2] Anti-Conflit 3D et Opacité.');

                const MAPTILER_API_KEY = 'UsgTlLJiePXeSnyh57aL';
                
                if (typeof maptilersdk === 'undefined') {
                    console.error('MapTiler SDK (maptilersdk) is not defined.');
                    const mapSection = document.getElementById('map-section');
                    if (mapSection) {
                        mapSection.innerHTML = '<p style="color: red; text-align: center; padding: 20px;">Erreur: Le SDK de la carte n\'a pas pu être chargé.</p>';
                    }
                    return; 
                }
                maptilersdk.config.apiKey = MAPTILER_API_KEY;

                const MAP_CONTAINER_ID = 'map-section';
                const SOURCE_ID_ANNONCES = 'annonces-source'; 
                const LAYER_ID_PINS = 'annonces-pins-layer';
                const LAYER_ID_LABELS = 'annonces-labels-layer';
                
                const SOURCE_NAME_BUILDINGS = 'maptiler_planet'; 
                const SOURCE_LAYER_NAME_BUILDINGS = 'building';
                const LAYER_ID_BUILDINGS_3D = 'custom-buildings-3d-layer'; // Nouveau nom pour éviter confusion
                const DEFAULT_MAPTILER_3D_BUILDING_LAYER = 'building-3d'; // Nom usuel de la couche 3D de MapTiler

                const directionsModal = document.getElementById('directions-modal');
                const directionsOutput = document.getElementById('directions-output');
                const closeDirectionsModalBtn = document.getElementById('close-directions-modal');
                const bicycleOptionsDiv = document.getElementById('bicycle-options');

                let map = null;
                let allAnnouncements = []; 
                let currentPopup = null;
                let selectedPinId = null; 
                let destinationB = null; 
                let destinationBMarker = null;
                let currentRouteLayers = []; 
                let currentRouteSourceId = 'directions-route-source';
                let longPressTimer = null;
                let originCoords = null; 
                let clickedBuildingId = null;
                let initialAnnouncementsLoaded = false;

                document.addEventListener('annoncesChargeesEtRendues', (event) => {
                    const annonces = event.detail.annonces;
                    if (!annonces || !Array.isArray(annonces)) return;
                    
                    allAnnouncements = annonces;
                    const geojsonData = convertAnnoncesToGeoJSON(allAnnouncements);

                    if (!map) {
                        initialAnnouncementsLoaded = true;
                        initializeMap(geojsonData); 
                    } else {
                        if (map.getSource(SOURCE_ID_ANNONCES)) {
                            map.getSource(SOURCE_ID_ANNONCES).setData(geojsonData);
                        } else {
                             map.once('style.load', () => { // S'assurer que le style est chargé avant d'agir sur la source
                                if (!map.getSource(SOURCE_ID_ANNONCES)) {
                                    map.addSource(SOURCE_ID_ANNONCES, { type: 'geojson', data: geojsonData, promoteId: 'id' });
                                } else {
                                    map.getSource(SOURCE_ID_ANNONCES).setData(geojsonData);
                                }
                             });
                        }
                        
                        if (map.isStyleLoaded()) {
                            map.once('idle', () => { mettreAJourBatimentsSelectionnes(allAnnouncements); });
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
                        return { type: 'Feature', id: featureId, geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] }, properties: { id: featureId, id_str: String(annonce.id), price: getNestedValue(annonce, '_property_lease_of_property.0.loyer') || '?', title: getNestedValue(annonce, 'property_title'), coverPhoto: getNestedValue(annonce, '_property_photos.0.images.0.url'), coordinates: [parseFloat(lng), parseFloat(lat)] } };
                    }).filter(Boolean);
                    return { type: 'FeatureCollection', features };
                }

                function handleBuildingClick(e) {
                    if (e.features.length > 0) {
                        const newClickedBuildingId = e.features[0].id;
                        console.log(`[BÂTIMENT CLIC] ID: ${newClickedBuildingId}, Feature:`, e.features[0]);

                        if (clickedBuildingId !== null && clickedBuildingId !== newClickedBuildingId) {
                            map.setFeatureState(
                                { source: SOURCE_NAME_BUILDINGS, sourceLayer: SOURCE_LAYER_NAME_BUILDINGS, id: clickedBuildingId },
                                { highlighted: false }
                            );
                            console.log(`[BÂTIMENT CLIC] Ancien ${clickedBuildingId} réinitialisé.`);
                        }

                        map.setFeatureState(
                            { source: SOURCE_NAME_BUILDINGS, sourceLayer: SOURCE_LAYER_NAME_BUILDINGS, id: newClickedBuildingId },
                            { highlighted: true }
                        );
                        const newState = map.getFeatureState({ source: SOURCE_NAME_BUILDINGS, sourceLayer: SOURCE_LAYER_NAME_BUILDINGS, id: newClickedBuildingId });
                        console.log(`[BÂTIMENT CLIC] Nouveau ${newClickedBuildingId} en surbrillance. État:`, JSON.stringify(newState));
                        
                        clickedBuildingId = newClickedBuildingId;
                        map.triggerRepaint();
                    }
                }

                async function mettreAJourBatimentsSelectionnes(annoncesAffichees) {
                    if (!map.isStyleLoaded() || !map.getSource(SOURCE_NAME_BUILDINGS) || !map.getLayer(LAYER_ID_BUILDINGS_3D)) {
                        console.warn("[BÂTIMENTS MAJ] Carte, source des bâtiments ou couche 3D non prête.");
                        return;
                    }
                    console.log("[BÂTIMENTS MAJ] Début mise à jour.");

                    if (window.lastHighlightedBuildingIds && window.lastHighlightedBuildingIds.size > 0) {
                        window.lastHighlightedBuildingIds.forEach(id => {
                            map.setFeatureState({ source: SOURCE_NAME_BUILDINGS, sourceLayer: SOURCE_LAYER_NAME_BUILDINGS, id: id }, { highlighted: false });
                        });
                    }
                    window.lastHighlightedBuildingIds = new Set();

                    if (!annoncesAffichees || annoncesAffichees.length === 0) {
                        console.log("[BÂTIMENTS MAJ] Aucune annonce, bâtiments en gris.");
                        map.triggerRepaint();
                        return;
                    }
                    
                    await map.once('idle'); 
                    
                    let featuresFoundCount = 0;
                    for (const annonce of annoncesAffichees) {
                        const lat = getNestedValue(annonce, 'geo_location.data.lat');
                        const lng = getNestedValue(annonce, 'geo_location.data.lng');
                        if (lat && lng) {
                            const point = map.project([lng, lat]);
                            const queryBox = [ [point.x - 10, point.y - 10], [point.x + 10, point.y + 10] ];
                            const features = map.queryRenderedFeatures(queryBox, { layers: [LAYER_ID_BUILDINGS_3D] });
                            if (features.length > 0 && features[0].id !== undefined) { 
                                const buildingId = features[0].id;
                                map.setFeatureState({ source: SOURCE_NAME_BUILDINGS, sourceLayer: SOURCE_LAYER_NAME_BUILDINGS, id: buildingId }, { highlighted: true });
                                window.lastHighlightedBuildingIds.add(buildingId);
                                featuresFoundCount++;
                            }
                        }
                    }
                    console.log(`[BÂTIMENTS MAJ] ${featuresFoundCount} bâtiments mis en surbrillance.`);
                    map.triggerRepaint();
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
                    
                    window.map = map; 

                    if (initialGeoJSON && initialGeoJSON.features.length > 0) {
                        const bounds = getBounds(initialGeoJSON);
                        map.fitBounds(bounds, { padding: 80, duration: 0, maxZoom: 16 });
                    } else {
                        map.setCenter([2.3522, 48.8566]); 
                        map.setZoom(11);
                    }

                    map.on('load', () => {
                        console.log('[MAP_SCRIPT V11.2] Carte chargée. Configuration des couches.');
                        
                        // S'assurer que la source des annonces est ajoutée
                        if (!map.getSource(SOURCE_ID_ANNONCES)) {
                            map.addSource(SOURCE_ID_ANNONCES, { type: 'geojson', data: initialGeoJSON, promoteId: 'id' });
                        } else {
                            map.getSource(SOURCE_ID_ANNONCES).setData(initialGeoJSON);
                        }

                        const heightExpression = ['coalesce', ['get', 'height'], 20]; 
                        const minHeightExpression = ['coalesce', ['get', 'min_height'], 0];

                        // --- GESTION DES CONFLITS DE COUCHES 3D ---
                        // 1. Masquer la couche 3D par défaut de MapTiler si elle existe
                        if (map.getLayer(DEFAULT_MAPTILER_3D_BUILDING_LAYER)) {
                            map.setLayoutProperty(DEFAULT_MAPTILER_3D_BUILDING_LAYER, 'visibility', 'none');
                            console.log(`[MAP INIT] Couche 3D par défaut '${DEFAULT_MAPTILER_3D_BUILDING_LAYER}' masquée.`);
                        }

                        // Trouver la première couche de symboles pour insérer notre couche 3D avant
                        const layers = map.getStyle().layers;
                        let firstSymbolId;
                        for (let i = 0; i < layers.length; i++) {
                            if (layers[i].type === 'symbol') {
                                firstSymbolId = layers[i].id;
                                break;
                            }
                        }
                        console.log(`[MAP INIT] Première couche de symboles trouvée pour l'insertion: ${firstSymbolId}`);

                        // 2. Ajouter NOTRE couche 3D personnalisée
                        if (!map.getLayer(LAYER_ID_BUILDINGS_3D)) {
                            map.addLayer({
                                'id': LAYER_ID_BUILDINGS_3D, 
                                'type': 'fill-extrusion',
                                'source': SOURCE_NAME_BUILDINGS,
                                'source-layer': SOURCE_LAYER_NAME_BUILDINGS,
                                'paint': { 
                                    'fill-extrusion-color': [
                                        'case',
                                        ['boolean', ['feature-state', 'highlighted'], false], 
                                        '#FF1493', 
                                        '#dfdfdf'  
                                    ],
                                    'fill-extrusion-height': heightExpression, 
                                    'fill-extrusion-base': minHeightExpression, 
                                    'fill-extrusion-opacity': 1 // Opacité à 1 pour réduire les artefacts
                                }
                            }, firstSymbolId); // Insérer avant les labels/symboles
                            console.log(`[MAP INIT] Couche 3D personnalisée '${LAYER_ID_BUILDINGS_3D}' ajoutée.`);
                        }
                        // --- FIN GESTION CONFLITS ---
                        
                        // Ajouter les couches pour les pins et labels (après la couche 3D)
                        if (!map.getLayer(LAYER_ID_PINS)){
                            map.addLayer({
                                id: LAYER_ID_PINS, type: 'circle', source: SOURCE_ID_ANNONCES,
                                paint: { 'circle-radius': 8, 'circle-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#007bff', '#3B82F6'], 'circle-stroke-width': 2, 'circle-stroke-color': '#FFFFFF' }
                            });
                        }
                        if (!map.getLayer(LAYER_ID_LABELS)){
                            map.addLayer({
                                id: LAYER_ID_LABELS, type: 'symbol', source: SOURCE_ID_ANNONCES,
                                layout: { 'text-field': ['concat', ['to-string', ['get', 'price']], '€'], 'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'], 'text-size': 10, 'text-offset': [0, -1.8], 'text-allow-overlap': false },
                                paint: { 'text-color': '#000000', 'text-halo-color': '#FFFFFF', 'text-halo-width': 1 }
                            });
                        }
                        
                        map.on('click', LAYER_ID_PINS, handlePinClick);
                        map.on('click', LAYER_ID_BUILDINGS_3D, handleBuildingClick); 

                        map.on('mouseenter', LAYER_ID_PINS, () => map.getCanvas().style.cursor = 'pointer');
                        map.on('mouseleave', LAYER_ID_PINS, () => map.getCanvas().style.cursor = '');
                        map.on('mouseenter', LAYER_ID_BUILDINGS_3D, () => map.getCanvas().style.cursor = 'pointer');
                        map.on('mouseleave', LAYER_ID_BUILDINGS_3D, () => map.getCanvas().style.cursor = '');

                        map.on('moveend', updateVisibleList);
                        
                        // S'assurer que les données et le style sont prêts avant la première mise à jour des bâtiments
                        if (initialAnnouncementsLoaded) {
                             map.once('idle', () => { mettreAJourBatimentsSelectionnes(allAnnouncements); });
                        }
                        updateVisibleList();
                    });

                    map.addControl(new maplibregl.NavigationControl(), 'top-right');
                }
                
                // ... (reste des fonctions: handleLongPress, handlePinClick, openDirectionsModal, etc.)
                // J'omets le reste pour la concision, mais il est identique à la v12.2
                function handleLongPress(e) { /* ... */ }
                function handlePinClick(e) { /* ... */ }
                function openDirectionsModal(startCoords) { /* ... */ }
                closeDirectionsModalBtn.addEventListener('click', () => { /* ... */ });
                directionsModal.querySelectorAll('.tab-button').forEach(button => { /* ... */ });
                bicycleOptionsDiv.querySelectorAll('button').forEach(button => { /* ... */ });
                function toggleBicycleOptions(show) { /* ... */ }
                async function fetchAndDisplayRoute(start, end, mode, bikeType = 'personal') { /* ... (avec la correction pour RoutingProfiles) */
                    console.log(`Fetching route from ${start} to ${end}, mode: ${mode}, bikeType: ${bikeType}`);
                    clearRoute();
                    directionsOutput.innerHTML = `<p>Calcul de l'itinéraire ${mode}...</p>`;
                    resetTravelTimes();

                    if (typeof maptilersdk.routing === 'undefined' || typeof maptilersdk.routing.RoutingProfiles === 'undefined') {
                        console.error("MapTiler SDK routing or RoutingProfiles is not available.", maptilersdk.routing);
                        directionsOutput.innerHTML = "<p>Erreur: Le service d'itinéraire (RoutingProfiles) n'est pas prêt.</p>";
                        document.getElementById(`time-${mode}`).textContent = "Erreur";
                        return;
                    }

                    try {
                        let profile = maptilersdk.routing.RoutingProfiles.DRIVING; 
                        if (mode === 'walk') profile = maptilersdk.routing.RoutingProfiles.WALKING; 
                        else if (mode === 'bicycle') profile = maptilersdk.routing.RoutingProfiles.BICYCLING; 
                        
                        if (mode === 'transit') {
                            directionsOutput.innerHTML = "<p>Mode transport en commun indicatif (trajet à pied).</p>";
                            profile = maptilersdk.routing.RoutingProfiles.WALKING; 
                        }

                        const results = await maptilersdk.routing.search({
                            profile: profile,
                            waypoints: [ maptilersdk.LngLat.convert(start), maptilersdk.LngLat.convert(end) ],
                            alternatives: false, steps: true, overview: maptilersdk.OverviewOutput.FULL
                        });

                        if (results.routes && results.routes.length > 0) {
                            const route = results.routes[0];
                            displayRouteOnMap(route.geometry, mode);
                            displayTravelTime(route.duration, mode);
                            
                            let instructionsHtml = "<h4>Instructions:</h4><ol class='list-decimal list-inside text-sm'>";
                            route.legs[0].steps.forEach(step => {
                                instructionsHtml += `<li>${step.maneuver.instruction} (${Math.round(step.distance)}m)</li>`;
                            });
                            instructionsHtml += "</ol>";
                            directionsOutput.innerHTML = instructionsHtml;
                        } else {
                            directionsOutput.innerHTML = "<p>Aucun itinéraire trouvé.</p>";
                            document.getElementById(`time-${mode}`).textContent = "Erreur";
                        }
                    } catch (error) {
                        console.error("Erreur calcul itinéraire:", error);
                        directionsOutput.innerHTML = `<p>Erreur calcul itinéraire: ${error.message}</p>`;
                        document.getElementById(`time-${mode}`).textContent = "Erreur";
                    }
                }
                function displayTravelTime(durationSeconds, mode) { /* ... */ }
                function resetTravelTimes() { /* ... */ }
                function displayRouteOnMap(geometry, mode) { /* ... */ }
                function clearRoute() { /* ... */ }
                function createPopupHTML(properties) { /* ... */ }
                function getNestedValue(obj, path) { /* ... */ }
                const mobileMapToggleButton = document.getElementById('mobile-map-toggle'); 
                if (mobileMapToggleButton) { /* ... */ }
                if (typeof allAnnouncements !== 'undefined' && allAnnouncements.length > 0 && !map) { /* ... */ }
                 else if (typeof allAnnouncements === 'undefined' || allAnnouncements.length === 0) { /* ... */ }

            }, 0); 
        });

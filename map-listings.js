// map-listings.js - VERSION 17 - Suppression plugin RTL + Focus API Key
document.addEventListener('DOMContentLoaded', function() {
    console.log('[MAP_SCRIPT V17] Suppression du plugin RTL et focus sur la vérification de la clé API MapTiler pour les itinéraires.');

    // --- CONSTANTES GLOBALES ---
    const MAPTILER_API_KEY = 'UsgTlLJiePXeSnyh57aL'; // Votre clé API MapTiler
    const DIRECTIONS_API_BASE = 'https://api.maptiler.com/routes';
    const MAP_CONTAINER_ID = 'map-section';
    const LIST_CONTAINER_ID = 'annonces-wrapper';
    const MOBILE_TOGGLE_BUTTON_ID = 'mobile-map-toggle';
    const DIRECTIONS_MODAL_ID = 'directions-modal';
    const SOURCE_ID_ANNONCES = 'annonces-source';
    const LAYER_ID_PINS = 'annonces-pins-layer';
    const LAYER_ID_LABELS = 'annonces-labels-layer';
    const SOURCE_NAME_BUILDINGS = 'maptiler_planet';
    const SOURCE_LAYER_NAME_BUILDINGS = 'building';
    const LAYER_ID_BUILDINGS_3D = 'buildings-3d-layer';
    const SOURCE_ID_ROUTE = 'route-source';
    const LAYER_ID_ROUTE = 'route-layer';

    // --- VARIABLES D'ÉTAT GLOBAL (let) ---
    let map = null;
    let allAnnouncements = [];
    let isMobile = window.innerWidth < 768;
    let currentPopup = null;
    let selectedPinId = null;
    let currentHighlightedBuildingIds = new Set();
    let originCoordinates = null;
    let destinationCoordinates = null;
    let destinationMarker = null;
    let longPressTimer = null;
    let routeGeometries = {};
    let currentRouteMode = 'driving';
    let currentBikeType = 'personal';

    // --- ÉLÉMENTS DU DOM ---
    const listContainer = document.getElementById(LIST_CONTAINER_ID);
    const directionsModal = document.getElementById(DIRECTIONS_MODAL_ID);
    const mobileToggleButton = document.getElementById(MOBILE_TOGGLE_BUTTON_ID);

    // ========================================================================
    // INITIALISATION
    // ========================================================================

    document.addEventListener('annoncesChargeesEtRendues', (event) => {
        allAnnouncements = event.detail.annonces || [];
        const geojsonData = convertAnnoncesToGeoJSON(allAnnouncements);
        if (!map) {
            initializeMap(geojsonData);
        } else {
            const source = map.getSource(SOURCE_ID_ANNONCES);
            if (source) source.setData(geojsonData);
            if (geojsonData.features.length > 0 && map.isStyleLoaded()) {
                try {
                    map.fitBounds(getBounds(geojsonData), { padding: 80, maxZoom: 16 });
                } catch (e) {
                    console.warn("Erreur lors de fitBounds (données peut-être invalides):", e);
                }
            }
            if (map.isStyleLoaded()) mettreAJourBatimentsSelectionnes(allAnnouncements);
        }
    });

    function initializeMap(initialGeoJSON) {
        if (!document.getElementById(MAP_CONTAINER_ID)) {
            console.error(`[MAP_SCRIPT V17] Conteneur de carte #${MAP_CONTAINER_ID} introuvable.`);
            return;
        }
        // maplibregl.setRTLTextPlugin('https://api.maptiler.com/mapbox-gl-js/plugins/mapbox-gl-rtl-text/v0.2.3/mapbox-gl-rtl-text.js'); // LIGNE SUPPRIMÉE
        map = new maplibregl.Map({
            container: MAP_CONTAINER_ID,
            style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_API_KEY}`,
            pitch: 50,
            bearing: -15,
            renderWorldCopies: false,
            center: initialGeoJSON && initialGeoJSON.features.length > 0 ? initialGeoJSON.features[0].geometry.coordinates : [2.3522, 48.8566],
            zoom: initialGeoJSON && initialGeoJSON.features.length > 0 ? 12 : 5
        });
        
        window.map = map;

        map.on('load', () => {
            console.log('[MAP_SCRIPT V17] Carte chargée.');
            map.addSource(SOURCE_ID_ANNONCES, { type: 'geojson', data: initialGeoJSON, promoteId: 'id' });
            addMapLayers();
            setupEventListeners();
            initializeDirectionsLogic();
            if (initialGeoJSON && initialGeoJSON.features.length > 0) {
                 try {
                    map.fitBounds(getBounds(initialGeoJSON), { padding: 80, maxZoom: 16, duration: 0 });
                } catch (e) {
                    console.warn("Erreur lors de fitBounds (données peut-être invalides):", e);
                }
            }
            updateVisibleList();
            mettreAJourBatimentsSelectionnes(allAnnouncements); 
        });
        map.addControl(new maplibregl.NavigationControl(), 'top-right');
    }

    // ========================================================================
    // GESTION DES COUCHES DE LA CARTE (inchangé par rapport à V16)
    // ========================================================================
    function addMapLayers() { /* ... Contenu identique à V16 ... */ 
        map.addLayer({ 'id': LAYER_ID_BUILDINGS_3D, 'type': 'fill-extrusion', 'source': SOURCE_NAME_BUILDINGS, 'source-layer': SOURCE_LAYER_NAME_BUILDINGS, 'paint': { 'fill-extrusion-color': ['case', ['boolean', ['feature-state', 'highlighted'], false], '#FF1493', '#dfdfdf'], 'fill-extrusion-height': ['coalesce', ['get', 'height'], 20], 'fill-extrusion-base': ['coalesce', ['get', 'min_height'], 0], 'fill-extrusion-opacity': 0.85 }});
        map.addLayer({ id: LAYER_ID_PINS, type: 'circle', source: SOURCE_ID_ANNONCES, paint: { 'circle-radius': 10, 'circle-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#007bff', '#FF385C'], 'circle-stroke-width': 2, 'circle-stroke-color': 'white' } });
        map.addLayer({ id: LAYER_ID_LABELS, type: 'symbol', source: SOURCE_ID_ANNONCES, layout: { 'text-field': ['concat', ['to-string', ['get', 'price']], '€'], 'text-font': ['Noto Sans Regular'], 'text-size': 12, 'text-offset': [0, -1.8], 'text-anchor': 'bottom' }, paint: { 'text-color': '#222222', 'text-halo-color': 'white', 'text-halo-width': 1 } });
    }
    async function mettreAJourBatimentsSelectionnes(annonces) { /* ... Contenu identique à V16 ... */
        if (!map.isStyleLoaded() || !annonces) return;
        currentHighlightedBuildingIds.forEach(id => map.setFeatureState({ source: SOURCE_NAME_BUILDINGS, sourceLayer: SOURCE_LAYER_NAME_BUILDINGS, id }, { highlighted: false }));
        currentHighlightedBuildingIds.clear();
        if (annonces.length === 0) return;
        try {
            await map.once('idle');
            const newBuildingIds = new Set();
            for (const annonce of annonces) {
                if (annonce.latitude && annonce.longitude) {
                    const point = map.project([parseFloat(annonce.longitude), parseFloat(annonce.latitude)]);
                    const features = map.queryRenderedFeatures([ [point.x - 5, point.y - 5], [point.x + 5, point.y + 5] ], { layers: [LAYER_ID_BUILDINGS_3D] });
                    if (features.length > 0 && features[0].id !== undefined) newBuildingIds.add(features[0].id);
                }
            }
            newBuildingIds.forEach(id => map.setFeatureState({ source: SOURCE_NAME_BUILDINGS, sourceLayer: SOURCE_LAYER_NAME_BUILDINGS, id }, { highlighted: true }));
            currentHighlightedBuildingIds = newBuildingIds;
        } catch (error) {
            console.warn("Erreur pendant la mise à jour des bâtiments (map idle):", error);
        }
    }
    
    // ========================================================================
    // GESTIONNAIRES D'ÉVÉNEMENTS (inchangé par rapport à V16)
    // ========================================================================
    function setupEventListeners() { /* ... Contenu identique à V16 ... */
        map.on('click', LAYER_ID_PINS, handlePinClick);
        map.on('mouseenter', LAYER_ID_PINS, () => map.getCanvas().style.cursor = 'pointer');
        map.on('mouseleave', LAYER_ID_PINS, () => map.getCanvas().style.cursor = '');
        map.on('moveend', updateVisibleList);
        if (listContainer) listContainer.addEventListener('click', handleListItemClick);
        if (isMobile && mobileToggleButton) {
            mobileToggleButton.addEventListener('click', () => {
                document.body.classList.toggle('map-is-active');
                const isActive = document.body.classList.contains('map-is-active');
                if (isActive && map) map.resize();
                const visibleCount = map.queryRenderedFeatures({layers: [LAYER_ID_PINS]}).length;
                mobileToggleButton.textContent = isActive ? `Voir la liste` : `Voir les ${visibleCount} logements`;
            });
        }
    }
    function handlePinClick(e) { if (e.features.length > 0) selectPin(e.features[0].id, e.features[0].geometry.coordinates); }
    function handleListItemClick(e) { /* ... Contenu identique à V16 ... */
        const link = e.target.closest('a[data-lng][data-lat]');
        if (link && map) {
            e.preventDefault();
            const { lng, lat, propertyIdLink } = link.dataset;
            const coordinates = [parseFloat(lng), parseFloat(lat)];
            map.flyTo({ center: coordinates, zoom: 16 });
            map.once('moveend', () => selectPin(parseInt(propertyIdLink, 10), coordinates));
        }
    }
    
    // ========================================================================
    // LOGIQUE DES ITINÉRAIRES (inchangée par rapport à V16)
    // ========================================================================
    function initializeDirectionsLogic() { /* ... Contenu identique à V16 ... */
        setupLongPressListener();
        if(directionsModal) {
            map.getContainer().addEventListener('click', e => {
                if (e.target.matches('.popup-directions-btn')) {
                    openDirectionsModal();
                    if(currentPopup) currentPopup.remove();
                }
            });
            const closeBtn = directionsModal.querySelector('#close-directions-modal');
            if(closeBtn) closeBtn.addEventListener('click', closeDirectionsModal);
            
            directionsModal.querySelectorAll('.tab-button').forEach(b => b.addEventListener('click', () => handleTabClick(b.dataset.mode)));
            directionsModal.querySelectorAll('.bike-option-btn').forEach(b => b.addEventListener('click', () => handleBikeOptionClick(b.dataset.bikeType)));
        } else {
            console.warn("Modale d'itinéraire non trouvée.");
        }
    }
    function setupLongPressListener() { /* ... Contenu identique à V16 ... */
        const handleInteraction = (e, isTouchEvent = false) => {
            const lngLat = isTouchEvent ? map.unproject([e.point.x, e.point.y]) : e.lngLat;
            longPressTimer = setTimeout(() => {
                longPressTimer = null;
                destinationCoordinates = [lngLat.lng, lngLat.lat];
                console.log("[MAP_SCRIPT V17] Destination (appui long) définie:", destinationCoordinates);
                if (destinationMarker) destinationMarker.setLngLat(destinationCoordinates);
                else {
                    const el = document.createElement('div'); el.className = 'destination-marker';
                    destinationMarker = new maplibregl.Marker({element: el, draggable: true}).setLngLat(destinationCoordinates).addTo(map);
                    destinationMarker.on('dragend', () => {
                        destinationCoordinates = destinationMarker.getLngLat().toArray();
                        if(directionsModal && directionsModal.classList.contains('active')) fetchAllRouteTimesAndUpdateUI();
                    });
                }
                if (originCoordinates) openDirectionsModal();
                 else alert("Veuillez d'abord sélectionner une annonce (point de départ) avant de définir une destination.");
            }, 700);
        };
        const cancelLongPress = () => { if (longPressTimer) clearTimeout(longPressTimer); };
        map.on('mousedown', (e) => handleInteraction(e)); map.on('mouseup', cancelLongPress); map.on('mousemove', cancelLongPress);
        map.on('touchstart', (e) => handleInteraction(e.originalEvent, true)); map.on('touchend', cancelLongPress); map.on('touchmove', cancelLongPress);
    }
    function openDirectionsModal() { /* ... Contenu identique à V16 ... */
        if (!originCoordinates) { alert("Veuillez sélectionner une annonce (point de départ)."); return; }
        if (!destinationCoordinates) { alert("Définissez une destination par un appui long sur la carte."); return; }
        if (directionsModal) {
            directionsModal.classList.add('active');
            fetchAllRouteTimesAndUpdateUI();
        }
    }
    function closeDirectionsModal() { /* ... Contenu identique à V16 ... */
        if (directionsModal) directionsModal.classList.remove('active'); 
        clearRouteLayers(); 
    }
    async function fetchAllRouteTimesAndUpdateUI() { /* ... Contenu identique à V16 ... */
        if (!originCoordinates || !destinationCoordinates) {
            console.warn("[ROUTING] Coordonnées de départ ou d'arrivée manquantes.");
            if(directionsModal) directionsModal.querySelector('.directions-instructions').textContent = "Veuillez sélectionner un point de départ et une destination.";
            return;
        }
        if(!directionsModal) return;
        directionsModal.querySelector('.directions-instructions').textContent = "Calcul des temps...";
        const modes = ['driving', 'pedestrian', 'cycling'];
        const timeElements = {
            driving: directionsModal.querySelector('#time-drive'),
            pedestrian: directionsModal.querySelector('#time-walk'),
            cycling: directionsModal.querySelector('#time-bicycle'),
        };
        modes.forEach(mode => { if(timeElements[mode]) timeElements[mode].textContent = '...'; });
        routeGeometries = {};
        const promises = modes.map(mode => getRouteData(mode, originCoordinates, destinationCoordinates));
        const results = await Promise.allSettled(promises);
        let firstValidModeData = null;
        results.forEach((result, index) => {
            const mode = modes[index];
            if (result.status === 'fulfilled' && result.value) {
                const { duration, geometry } = result.value;
                routeGeometries[mode] = geometry;
                const uiMode = mode === 'driving' ? 'drive' : (mode === 'pedestrian' ? 'walk' : 'bicycle');
                if (timeElements[uiMode]) timeElements[uiMode].textContent = formatDuration(duration);
                if (!firstValidModeData) firstValidModeData = { mode: uiMode, geometry: geometry };
            } else {
                const uiMode = mode === 'driving' ? 'drive' : (mode === 'pedestrian' ? 'walk' : 'bicycle');
                if (timeElements[uiMode]) timeElements[uiMode].textContent = 'N/A';
                console.error(`Échec itinéraire pour ${mode}:`, result.reason);
            }
        });
        if (firstValidModeData) {
            handleTabClick(firstValidModeData.mode, firstValidModeData.geometry);
        } else {
             if(directionsModal) directionsModal.querySelector('.directions-instructions').textContent = "Aucun itinéraire trouvé. Vérifiez votre clé API MapTiler et les services activés.";
        }
    }
    async function handleTabClick(uiMode, preloadedGeometry = null) { /* ... Contenu identique à V16 ... */
        if(!directionsModal) return;
        currentRouteMode = uiMode === 'drive' ? 'driving' : (uiMode === 'walk' ? 'pedestrian' : 'cycling');
        directionsModal.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
        const activeTabButton = directionsModal.querySelector(`.tab-button[data-mode="${uiMode}"]`);
        if (activeTabButton) activeTabButton.classList.add('active');
        const bicycleOptionsDiv = directionsModal.querySelector('#bicycle-options');
        if (bicycleOptionsDiv) bicycleOptionsDiv.style.display = uiMode === 'bicycle' ? 'block' : 'none';
        clearRouteLayers(); 
        if (preloadedGeometry) {
            drawRoute(currentRouteMode, preloadedGeometry);
        } else if (routeGeometries[currentRouteMode]) {
            drawRoute(currentRouteMode, routeGeometries[currentRouteMode]);
        } else {
            try {
                const data = await getRouteData(currentRouteMode, originCoordinates, destinationCoordinates);
                if (data && data.geometry) {
                    routeGeometries[currentRouteMode] = data.geometry;
                    drawRoute(currentRouteMode, data.geometry);
                } else {
                     if(directionsModal) directionsModal.querySelector('.directions-instructions').textContent = `Itinéraire en ${uiMode} indisponible.`;
                }
            } catch (error) {
                 if(directionsModal) directionsModal.querySelector('.directions-instructions').textContent = `Erreur itinéraire ${uiMode}.`;
            }
        }
    }
    function handleBikeOptionClick(bikeType) { /* ... Contenu identique à V16 ... */
        currentBikeType = bikeType;
        if(directionsModal) {
            directionsModal.querySelectorAll('.bike-option-btn').forEach(btn => btn.classList.remove('active'));
            const activeBikeButton = directionsModal.querySelector(`.bike-option-btn[data-bike-type="${bikeType}"]`);
            if (activeBikeButton) activeBikeButton.classList.add('active');
        }
        handleTabClick('bicycle');
    }
    async function getRouteData(profile, startCoords, endCoords) { /* ... Contenu identique à V16 ... */
        if (!startCoords || !endCoords) {
            console.error("Coordonnées de départ ou d'arrivée manquantes pour getRouteData.");
            return Promise.reject("Missing coordinates");
        }
        let url = `${DIRECTIONS_API_BASE}/${profile}/${startCoords.join(',')};${endCoords.join(',')}?key=${MAPTILER_API_KEY}&geometries=geojson&steps=true&language=fr`;
        if(profile === 'cycling' && currentBikeType === 'shared') url += '&bicycle_type=hybrid';
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`API Error ${res.status}: ${await res.text()}`); // Inclut le texte de l'erreur API
            const data = await res.json();
            if (data.routes && data.routes.length > 0) return { duration: data.routes[0].duration, geometry: data.routes[0].geometry };
            else throw new Error("Aucun itinéraire trouvé dans la réponse.");
        } catch (error) { console.error(`Erreur API routage (${profile}):`, error); throw error; }
    }
    function clearRouteLayers() { /* ... Contenu identique à V16 ... */
        if (!map) return;
        if (map.getLayer(LAYER_ID_ROUTE)) map.removeLayer(LAYER_ID_ROUTE);
        if (map.getSource(SOURCE_ID_ROUTE)) map.removeSource(SOURCE_ID_ROUTE);
    }
    function drawRoute(modeUsed, geometry) { /* ... Contenu identique à V16 ... */
        if (!map || !geometry) return;
        clearRouteLayers();
        map.addSource(SOURCE_ID_ROUTE, { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: geometry } });
        map.addLayer({
            id: LAYER_ID_ROUTE, type: 'line', source: SOURCE_ID_ROUTE,
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': '#007cff', 'line-width': 5, 'line-opacity': 0.8 }
        });
    }

    // ========================================================================
    // FONCTIONS UTILITAIRES ET DE SYNCHRONISATION (inchangées par rapport à V16)
    // ========================================================================
    function selectPin(pinId, coordinates) { /* ... Contenu identique à V16 ... */
        if (selectedPinId !== null) map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: selectedPinId }, { selected: false });
        map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: pinId }, { selected: true });
        selectedPinId = pinId;
        originCoordinates = coordinates;
        if (currentPopup) currentPopup.remove();
        const features = map.querySourceFeatures(SOURCE_ID_ANNONCES, { filter: ['==', 'id', pinId] });
        if (features.length > 0) {
            currentPopup = new maplibregl.Popup({ offset: 25, className: 'airbnb-style-popup' })
                .setLngLat(coordinates).setHTML(createPopupHTML(features[0].properties, coordinates)).addTo(map)
                .on('close', () => {
                    map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: pinId }, { selected: false });
                    selectedPinId = null; currentPopup = null; originCoordinates = null; closeDirectionsModal();
                });
        }
        if (destinationCoordinates) {
            openDirectionsModal();
        }
    }
    function updateVisibleList() { /* ... Contenu identique à V16 ... */
        if (!map || !map.isStyleLoaded() || !listContainer) return;
        const visibleIds = new Set(map.queryRenderedFeatures({ layers: [LAYER_ID_PINS] }).map(f => String(f.properties.id)));
        listContainer.querySelectorAll('a[data-property-id-link]').forEach(link => {
            link.classList.toggle('annonce-list-item-hidden', !visibleIds.has(link.dataset.propertyIdLink));
        });
    }
    function createPopupHTML(properties, coords) { /* ... Contenu identique à V16 ... */
        const detailLink = `annonce?id=${properties.id_str}`;
        const directionsButton = `<button class="popup-directions-btn">Itinéraire</button>`; // data-lng/lat enlevés car originCoordinates est mis à jour dans selectPin
        return `<div class="map-custom-popup">
                    <img src="${properties.coverPhoto || ''}" alt="${properties.title}" class="popup-image" onerror="this.style.display='none'">
                    <div class="popup-info">
                        <h4 class="popup-title">${properties.title || 'Titre non disponible'}</h4>
                        <p class="popup-price">${properties.price}€ / mois</p>
                        <div class="popup-actions">
                            <a href="${detailLink}" class="popup-link" target="_blank">Détails</a>
                            ${directionsButton}
                        </div>
                    </div>
                </div>`;
    }
    function formatDuration(seconds) { /* ... Contenu identique à V16 ... */
        if (seconds === null || seconds === undefined || isNaN(seconds)) return "--:--";
        if (seconds < 60) return "< 1 min";
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.round((seconds % 3600) / 60);
        return hours > 0 ? `${hours}h ${minutes.toString().padStart(2, '0')}min` : `${minutes} min`;
    }
    function convertAnnoncesToGeoJSON(annonces) { /* ... Contenu identique à V16 ... */
        return { type: 'FeatureCollection', features: annonces.map(annonce => {
            if (!annonce.id || annonce.latitude == null || annonce.longitude == null ) return null;
            const loyer = getNestedValue(annonce, '_property_lease_of_property.0.loyer') || getNestedValue(annonce, '_property_lease_of_property.0.loyer_cc');
            return {
                type: 'Feature', id: parseInt(annonce.id, 10),
                geometry: { type: 'Point', coordinates: [parseFloat(annonce.longitude), parseFloat(annonce.latitude)] },
                properties: { id: parseInt(annonce.id, 10), id_str: String(annonce.id), price: loyer != null ? loyer : '?', title: getNestedValue(annonce, 'property_title'), coverPhoto: getNestedValue(annonce, '_property_photos.0.images.0.url') }
            };
        }).filter(Boolean)};
    }
    function getBounds(geojson) { /* ... Contenu identique à V16 ... */
        const bounds = new maplibregl.LngLatBounds();
        if (geojson && geojson.features) {
            geojson.features.forEach(feature => {
                if (feature && feature.geometry && feature.geometry.coordinates) {
                    try { bounds.extend(feature.geometry.coordinates); } catch (e) { console.warn("Coordonnée invalide pour bounds.extend:", feature.geometry.coordinates, e); }
                }
            });
        }
        return bounds;
    }
    function getNestedValue(obj, path) { /* ... Contenu identique à V16 ... */
        if (!path || obj == null) return undefined;
        return path.split('.').reduce((acc, part) => {
            if (acc === undefined || acc === null) return undefined;
            const i = !isNaN(parseInt(part, 10)) ? parseInt(part, 10) : -1;
            return i !== -1 && Array.isArray(acc) ? acc[i] : acc[part];
        }, obj);
    }

    // Lancement initial
    if (document.getElementById(MAP_CONTAINER_ID)) {
        console.log("[MAP_SCRIPT V17] En attente de 'annoncesChargeesEtRendues' pour initialiser la carte.");
    } else {
        console.warn("[MAP_SCRIPT V17] Conteneur de carte non trouvé. Le script ne s'initialisera pas.");
    }
});

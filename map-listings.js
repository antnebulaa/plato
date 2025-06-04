// map-listings.js - VERSION 14 - Correctifs Prix, Itinéraire et Bouton Mobile
document.addEventListener('DOMContentLoaded', function() {
    console.log('[MAP_SCRIPT V14] Initialisation avec correctifs pour prix, API itinéraire et bouton mobile.');

    // --- CONSTANTES ---
    const MAPTILER_API_KEY = 'UsgTlLJiePXeSnyh57aL';
    const DIRECTIONS_API_BASE = 'https://api.maptiler.com/routes';
    const MAP_CONTAINER_ID = 'map-section';
    const LIST_CONTAINER_ID = 'annonces-wrapper';
    const DIRECTIONS_MODAL_ID = 'directions-modal';
    const MOBILE_TOGGLE_BUTTON_ID = 'mobile-map-toggle'; // ID du bouton mobile

    const SOURCE_ID_ANNONCES = 'annonces-source';
    const LAYER_ID_PINS = 'annonces-pins-layer';
    const LAYER_ID_LABELS = 'annonces-labels-layer';
    
    const SOURCE_NAME_BUILDINGS = 'maptiler_planet'; 
    const SOURCE_LAYER_NAME_BUILDINGS = 'building';
    const LAYER_ID_BUILDINGS_3D = 'buildings-3d-layer';

    // --- ÉLÉMENTS DU DOM ---
    const listContainer = document.getElementById(LIST_CONTAINER_ID);
    const directionsModal = document.getElementById(DIRECTIONS_MODAL_ID);
    const mobileToggleButton = document.getElementById(MOBILE_TOGGLE_BUTTON_ID); // Récupération du bouton

    // --- ÉTAT GLOBAL ---
    let map = null;
    let allAnnouncements = [];
    let currentPopup = null;
    let selectedPinId = null;
    let currentHighlightedBuildingIds = new Set();
    let isMobile = window.innerWidth < 768;

    // --- ÉTAT SPÉCIFIQUE AUX ITINÉRAIRES ---
    let originA = null;
    let destinationB = null;
    let destinationMarker = null;
    let longPressTimer = null;
    let currentRouteMode = 'drive';
    let currentBikeType = 'personal';

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
            if (geojsonData.features.length > 0) map.fitBounds(getBounds(geojsonData), { padding: 80, maxZoom: 16 });
            if (map.isStyleLoaded()) mettreAJourBatimentsSelectionnes(allAnnouncements);
        }
    });

    function initializeMap(initialGeoJSON) {
        map = new maplibregl.Map({ container: MAP_CONTAINER_ID, style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_API_KEY}`, pitch: 50, bearing: -15, renderWorldCopies: false });
        window.map = map;
        map.on('load', () => {
            console.log('[MAP_SCRIPT V14] Carte chargée.');
            map.addSource(SOURCE_ID_ANNONCES, { type: 'geojson', data: initialGeoJSON, promoteId: 'id' });
            addMapLayers();
            setupEventListeners();
            initializeDirectionsLogic();
            if (initialGeoJSON.features.length > 0) map.fitBounds(getBounds(initialGeoJSON), { padding: 80, maxZoom: 16, duration: 0 });
            updateVisibleList();
            mettreAJourBatimentsSelectionnes(allAnnouncements); 
        });
        map.addControl(new maplibregl.NavigationControl(), 'top-right');
    }

    // ========================================================================
    // GESTION DES COUCHES
    // ========================================================================


   function addMapLayers() {
        map.addLayer({ 'id': LAYER_ID_BUILDINGS_3D, 'type': 'fill-extrusion', 'source': SOURCE_NAME_BUILDINGS, 'source-layer': SOURCE_LAYER_NAME_BUILDINGS, 'paint': { 'fill-extrusion-color': ['case', ['boolean', ['feature-state', 'highlighted'], false], '#FF1493', '#dfdfdf'], 'fill-extrusion-height': ['coalesce', ['get', 'height'], 20], 'fill-extrusion-base': ['coalesce', ['get', 'min_height'], 0], 'fill-extrusion-opacity': 0.85 } });
        map.addLayer({ id: LAYER_ID_PINS, type: 'circle', source: SOURCE_ID_ANNONCES, paint: { 'circle-radius': 18, 'circle-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#007bff', '#FFFFFF'], 'circle-stroke-width': 2, 'circle-stroke-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#FFFFFF', '#007bff'] } });
        map.addLayer({ id: LAYER_ID_LABELS, type: 'symbol', source: SOURCE_ID_ANNONCES, layout: { 'text-field': ['concat', ['to-string', ['get', 'price']], '€'], 'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'], 'text-size': 11, 'text-allow-overlap': true }, paint: { 'text-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#FFFFFF', '#333333'] } });
    }

    async function mettreAJourBatimentsSelectionnes(annonces) {
        if (!map.isStyleLoaded()) return;
        currentHighlightedBuildingIds.forEach(id => map.setFeatureState({ source: SOURCE_NAME_BUILDINGS, sourceLayer: SOURCE_LAYER_NAME_BUILDINGS, id }, { highlighted: false }));
        currentHighlightedBuildingIds.clear();
        if (!annonces || annonces.length === 0) return;
        await map.once('idle');
        const newBuildingIds = new Set();
        for (const annonce of annonces) {
            if (annonce.latitude && annonce.longitude) {
                const point = map.project([annonce.longitude, annonce.latitude]);
                const features = map.queryRenderedFeatures([ [point.x - 5, point.y - 5], [point.x + 5, point.y + 5] ], { layers: [LAYER_ID_BUILDINGS_3D] });
                if (features.length > 0 && features[0].id) newBuildingIds.add(features[0].id);
            }
        }
        newBuildingIds.forEach(id => map.setFeatureState({ source: SOURCE_NAME_BUILDINGS, sourceLayer: SOURCE_LAYER_NAME_BUILDINGS, id }, { highlighted: true }));
        currentHighlightedBuildingIds = newBuildingIds;
    }

    // ========================================================================
    // GESTIONNAIRES D'ÉVÉNEMENTS
    // ========================================================================

    function setupEventListeners() {
        map.on('click', LAYER_ID_PINS, handlePinClick);
        map.on('mouseenter', LAYER_ID_PINS, () => map.getCanvas().style.cursor = 'pointer');
        map.on('mouseleave', LAYER_ID_PINS, () => map.getCanvas().style.cursor = '');
        map.on('moveend', updateVisibleList);
        if (listContainer) listContainer.addEventListener('click', handleListItemClick);
        // CORRECTION : Ré-ajout de l'écouteur pour le bouton mobile
        if (isMobile && mobileToggleButton) {
            mobileToggleButton.addEventListener('click', () => {
                document.body.classList.toggle('map-is-active');
                const isActive = document.body.classList.contains('map-is-active');
                if (isActive && map) map.resize();
                mobileToggleButton.textContent = isActive ? `Voir la liste` : `Voir les ${map.queryRenderedFeatures({layers: [LAYER_ID_PINS]}).length} logements`;
            });
        }
    }
    
    function handlePinClick(e) { if (e.features.length > 0) selectPin(e.features[0].id, e.features[0].geometry.coordinates); }
    function handleListItemClick(e) {
        const link = e.target.closest('a[data-lng][data-lat]');
        if (link) {
            e.preventDefault();
            const { lng, lat, propertyIdLink } = link.dataset;
            const coordinates = [parseFloat(lng), parseFloat(lat)];
            map.flyTo({ center: coordinates, zoom: 16 });
            map.once('moveend', () => selectPin(parseInt(propertyIdLink, 10), coordinates));
        }
    }
    
    // ========================================================================
    // LOGIQUE DES ITINÉRAIRES
    // ========================================================================

    function initializeDirectionsLogic() {
        setupLongPressListener();
        map.getContainer().addEventListener('click', e => {
            if (e.target.matches('.popup-directions-btn')) {
                openDirectionsModal();
                if(currentPopup) currentPopup.remove();
            }
        });
        document.querySelector('#close-directions-modal').addEventListener('click', closeDirectionsModal);
        document.querySelectorAll('#directions-modal .tab-button').forEach(b => b.addEventListener('click', () => handleTabClick(b.dataset.mode)));
        document.querySelectorAll('#directions-modal .bike-option-btn').forEach(b => b.addEventListener('click', () => handleBikeOptionClick(b.dataset.bikeType)));
    }

    function setupLongPressListener() {
        const handleDown = (e) => { longPressTimer = setTimeout(() => {
            longPressTimer = null;
            destinationB = [e.lngLat.lng, e.lngLat.lat];
            if (destinationMarker) destinationMarker.setLngLat(destinationB);
            else {
                const el = document.createElement('div'); el.className = 'destination-marker';
                destinationMarker = new maplibregl.Marker({element: el, draggable: true}).setLngLat(destinationB).addTo(map);
                destinationMarker.on('dragend', () => {
                    destinationB = destinationMarker.getLngLat().toArray();
                    if(directionsModal.classList.contains('active')) fetchAllRouteTimesAndUpdateUI();
                });
            }
            if (originA) openDirectionsModal();
        }, 700);};
        const handleUp = () => { if (longPressTimer) clearTimeout(longPressTimer); };
        map.on('mousedown', handleDown); map.on('mouseup', handleUp); map.on('mousemove', handleUp);
        map.on('touchstart', handleDown); map.on('touchend', handleUp); map.on('touchmove', handleUp);
    }
    
    function openDirectionsModal() {
        if (!originA) { alert("Veuillez sélectionner une annonce pour le point de départ."); return; }
        if (!destinationB) { alert("Définissez une destination en faisant un clic long sur la carte."); return; }
        directionsModal.classList.add('active');
        fetchAllRouteTimesAndUpdateUI();
    }
    
    function closeDirectionsModal() { directionsModal.classList.remove('active'); clearRouteLayers(); }

    async function fetchAllRouteTimesAndUpdateUI() {
        if (!originA || !destinationB) return;
        document.querySelectorAll('.tab-button span').forEach(s => s.textContent = '...');
        const modes = ['drive', 'transit', 'walk', 'bicycle'];
        const results = await Promise.allSettled(modes.map(mode => getRouteData(mode, originA, destinationB)));
        results.forEach((result, i) => {
            const mode = modes[i];
            const duration = result.status === 'fulfilled' ? result.value?.routes[0]?.duration : null;
            document.getElementById(`time-${mode}`).textContent = formatDuration(duration);
        });
        handleTabClick(currentRouteMode);
    }
    
    async function handleTabClick(mode) {
        currentRouteMode = mode;
        document.querySelectorAll('.tab-button').forEach(btn => btn.classList.toggle('active', btn.dataset.mode === mode));
        document.getElementById('bicycle-options').style.display = mode === 'bicycle' ? 'block' : 'none';
        
        const data = await getRouteData(mode, originA, destinationB);
        if (data && data.routes?.length > 0) {
            const route = data.routes[0];
            const geojson = mode === 'transit' 
                ? { type: 'FeatureCollection', features: route.legs.map((leg, i) => ({ type: 'Feature', id:i, properties: { mode: leg.mode, color: leg.line_color }, geometry: leg.geometry })) }
                : { type: 'FeatureCollection', features: [{ type: 'Feature', id:0, properties: {}, geometry: route.geometry }] };
            drawRoute(mode, geojson);
        } else {
            clearRouteLayers();
        }
    }
    
    function handleBikeOptionClick(bikeType) {
        currentBikeType = bikeType;
        document.querySelectorAll('.bike-option-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.bikeType === bikeType));
        handleTabClick('bicycle');
    }

    async function getRouteData(mode, start, end) {
        if (!start || !end) {
            console.error("Point de départ ou d'arrivée manquant pour le calcul d'itinéraire.");
            return null;
        }
        // CORRECTION : Utilisation de 'drive' au lieu de 'driving'.
        const profile = mode === 'drive' ? 'drive' : mode; 
        let url = `${DIRECTIONS_API_BASE}/${profile}/${start.join(',')};${end.join(',')}?key=${MAPTILER_API_KEY}&geometries=geojson&steps=true&language=fr`;
        if(mode === 'bicycle' && currentBikeType === 'shared') url += '&bicycle_type=hybrid';
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`API Error ${res.status}`);
            return await res.json();
        } catch (error) {
            console.error(`Erreur de routage pour le mode ${mode}:`, error);
            return null;
        }
    }
    
    // ========================================================================
    // FONCTIONS UTILITAIRES ET DE SYNCHRONISATION
    // ========================================================================

    function selectPin(pinId, coordinates) {
        if (selectedPinId) map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: selectedPinId }, { selected: false });
        map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: pinId }, { selected: true });
        selectedPinId = pinId;
        originA = coordinates; // Met à jour le point de départ pour l'itinéraire
        if (currentPopup) currentPopup.remove();
        const features = map.querySourceFeatures(SOURCE_ID_ANNONCES, { filter: ['==', 'id', pinId] });
        if (features.length > 0) {
            currentPopup = new maplibregl.Popup({ offset: 25, className: 'airbnb-style-popup' })
                .setLngLat(coordinates).setHTML(createPopupHTML(features[0].properties, coordinates)).addTo(map)
                .on('close', () => {
                    map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: pinId }, { selected: false });
                    selectedPinId = null; currentPopup = null; originA = null;
                });
        }
    }

    function updateVisibleList() {
        if (!map || !map.isStyleLoaded() || !listContainer) return;
        const visibleIds = new Set(map.queryRenderedFeatures({ layers: [LAYER_ID_PINS] }).map(f => String(f.properties.id)));
        listContainer.querySelectorAll('a[data-property-id-link]').forEach(link => {
            link.classList.toggle('annonce-list-item-hidden', !visibleIds.has(link.dataset.propertyIdLink));
        });
    }

    function createPopupHTML(properties, coordinates) {
        const detailLink = `annonce?id=${properties.id_str}`;
        const directionsButton = `<button class="popup-directions-btn" data-lng="${coordinates[0]}" data-lat="${coordinates[1]}">Itinéraire</button>`;
        return `<div class="map-custom-popup">
                    <img src="${properties.coverPhoto || ''}" alt="${properties.title}" class="popup-image">
                    <div class="popup-info">
                        <h4 class="popup-title">${properties.title}</h4>
                        <p class="popup-price">${properties.price} € / mois</p>
                        <div class="popup-actions"><a href="${detailLink}" class="popup-link" target="_blank">Détails</a>${directionsButton}</div>
                    </div>
                </div>`;
    }
    
    function formatDuration(seconds) {
        if (seconds === null || seconds === undefined) return "--:--";
        if (seconds < 60) return "< 1 min";
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.round((seconds % 3600) / 60);
        return hours > 0 ? `${hours}h ${minutes.toString().padStart(2, '0')}m` : `${minutes} min`;
    }
    
    function getBounds(geojson) {
        const bounds = new maplibregl.LngLatBounds();
        geojson.features.forEach(feature => bounds.extend(feature.geometry.coordinates));
        return bounds;
    }
    function getNestedValue(obj, path) {
        if (!path) return undefined;
        return path.split('.').reduce((acc, part) => {
            if (acc === undefined || acc === null) return undefined;
            const i = !isNaN(parseInt(part, 10)) ? parseInt(part, 10) : -1;
            return i !== -1 && Array.isArray(acc) ? acc[i] : acc[part];
        }, obj);
    }
    /**
     * CORRECTION : Le chemin vers le loyer est mis à jour pour être plus robuste.
     * Note: Assurez-vous que votre API Xano renvoie bien `_property_lease_of_property` avec les annonces.
     */
    function convertAnnoncesToGeoJSON(annonces) {
        return { type: 'FeatureCollection', features: annonces.map(annonce => {
            if (!annonce.id || !annonce.latitude || !annonce.longitude) return null;
            
            const loyer = getNestedValue(annonce, '_property_lease_of_property.0.loyer') 
                       || getNestedValue(annonce, '_property_lease_of_property.0.loyer_cc');

            return {
                type: 'Feature', id: parseInt(annonce.id, 10),
                geometry: { type: 'Point', coordinates: [parseFloat(annonce.longitude), parseFloat(annonce.latitude)] },
                properties: { 
                    id: parseInt(annonce.id, 10), 
                    id_str: String(annonce.id), 
                    price: loyer || '?', // Affiche '?' si le loyer n'est pas trouvé
                    title: getNestedValue(annonce, 'property_title'), 
                    coverPhoto: getNestedValue(annonce, '_property_photos.0.images.0.url') 
                }
            };
        }).filter(Boolean)};
    }
});

// map-listings.js - VERSION 11 - Intégration des itinéraires
document.addEventListener('DOMContentLoaded', function() {
    console.log('[MAP_SCRIPT V11] Initialisation avec le mode itinéraire.');

    // --- CONSTANTES ---
    const MAPTILER_API_KEY = 'UsgTlLJiePXeSnyh57aL';
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

    // --- ÉLÉMENTS DU DOM ---
    const listContainer = document.getElementById(LIST_CONTAINER_ID);
    const mobileToggleButton = document.getElementById(MOBILE_TOGGLE_BUTTON_ID);
    const directionsModal = document.getElementById(DIRECTIONS_MODAL_ID);

    // --- ÉTAT GLOBAL ---
    let map = null;
    let allAnnouncements = [];
    let isMobile = window.innerWidth < 768;
    let currentPopup = null;
    let selectedPinId = null;

    // --- ÉTAT SPÉCIFIQUE AUX ITINÉRAIRES ---
    let originA = null; // Point de départ [lng, lat] (le logement)
    let destinationB = null; // Point d'arrivée [lng, lat] (clic long)
    let destinationMarker = null;
    let longPressTimer = null;
    let currentRouteMode = null;
    let currentBikeType = 'personal';

    // ========================================================================
    // INITIALISATION PRINCIPALE
    // ========================================================================

    // Se déclenche quand les annonces sont chargées par home-form-display-v4.js
    document.addEventListener('annoncesChargeesEtRendues', (event) => {
        const annonces = event.detail.annonces;
        if (!annonces || !Array.isArray(annonces)) return;
        
        allAnnouncements = annonces;
        const geojsonData = convertAnnoncesToGeoJSON(allAnnouncements);

        if (!map) {
            initializeMap(geojsonData);
        } else {
            // Mise à jour de la carte existante avec les nouvelles données
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

    function initializeMap(initialGeoJSON) {
        map = new maplibregl.Map({
            container: MAP_CONTAINER_ID,
            style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_API_KEY}`,
            pitch: 50,
            bearing: -15,
            renderWorldCopies: false
        });
        
        window.map = map; // Pour débogage

        if (initialGeoJSON.features.length > 0) {
            map.fitBounds(getBounds(initialGeoJSON), { padding: 80, duration: 0, maxZoom: 16 });
        } else {
            map.setCenter([2.3522, 48.8566]);
            map.setZoom(11);
        }

        map.on('load', () => {
            console.log('[MAP_SCRIPT V11] Carte chargée. Ajout des couches.');
            addSourcesAndLayers(initialGeoJSON);
            setupEventListeners();
            updateVisibleList();
            mettreAJourBatimentsSelectionnes(allAnnouncements); 
        });

        map.addControl(new maplibregl.NavigationControl(), 'top-right');
    }

    // ========================================================================
    // GESTION DES SOURCES ET COUCHES DE LA CARTE
    // ========================================================================

    function addSourcesAndLayers(initialGeoJSON) {
        // Source des annonces
        map.addSource(SOURCE_ID_ANNONCES, { type: 'geojson', data: initialGeoJSON, promoteId: 'id' });

        // Couche des bâtiments 3D
        map.addLayer({
            'id': LAYER_ID_BUILDINGS_3D, 'type': 'fill-extrusion', 'source': SOURCE_NAME_BUILDINGS,
            'source-layer': SOURCE_LAYER_NAME_BUILDINGS,
            'paint': {
                'fill-extrusion-color': ['case', ['boolean', ['feature-state', 'highlighted'], false], '#FF1493', '#dfdfdf'],
                'fill-extrusion-height': ['coalesce', ['get', 'height'], 20],
                'fill-extrusion-base': ['coalesce', ['get', 'min_height'], 0],
                'fill-extrusion-opacity': 0.85
            }
        });
        
        // Couches des pins et labels des annonces
        map.addLayer({
            id: LAYER_ID_PINS, type: 'circle', source: SOURCE_ID_ANNONCES,
            paint: { 'circle-radius': 18, 'circle-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#007bff', '#FFFFFF'], 'circle-stroke-width': ['case', ['boolean', ['feature-state', 'selected'], false], 2, 1.5], 'circle-stroke-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#FFFFFF', '#007bff'] }
        });
        map.addLayer({
            id: LAYER_ID_LABELS, type: 'symbol', source: SOURCE_ID_ANNONCES,
            layout: { 'text-field': ['concat', ['to-string', ['get', 'price']], '€'], 'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'], 'text-size': 11, 'text-allow-overlap': true },
            paint: { 'text-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#FFFFFF', '#333333'] }
        });
    }

    function clearRouteLayers() {
        // Supprime toutes les couches et sources liées à l'itinéraire
        const layers = map.getStyle().layers;
        layers.forEach(layer => {
            if (layer.id.startsWith('route-')) {
                map.removeLayer(layer.id);
            }
        });

        const sources = map.getStyle().sources;
        for (const sourceId in sources) {
            if (sourceId.startsWith('route-')) {
                map.removeSource(sourceId);
            }
        }
    }

    function drawRoute(mode, geojson) {
        clearRouteLayers();
        if (!geojson || !geojson.features || geojson.features.length === 0) return;

        const sourceId = `route-source-${mode}`;
        map.addSource(sourceId, { type: 'geojson', data: geojson });

        // Cas spécial pour les transports en commun avec plusieurs étapes
        if (mode === 'transit' && geojson.features.length > 1) {
             geojson.features.forEach((feature, index) => {
                const legMode = feature.properties.mode;
                const legColor = feature.properties.color || (legMode === 'walk' ? '#87CEFA' : '#FFD700');
                map.addLayer({
                    id: `route-layer-transit-${index}`,
                    type: 'line',
                    source: sourceId,
                    filter: ['==', ['get', 'id'], feature.properties.id], // Filtre pour ne dessiner que cette étape
                    layout: { 'line-join': 'round', 'line-cap': 'round' },
                    paint: {
                        'line-color': legColor,
                        'line-width': legMode === 'walk' ? 4 : 6,
                        'line-dasharray': legMode === 'walk' ? [0, 2] : [1]
                    }
                });
            });
        } else {
            // Itinéraires standards
            const paintProps = {
                'drive': { 'line-color': '#007bff', 'line-width': 5 },
                'walk': { 'line-color': '#8a2be2', 'line-width': 4, 'line-dasharray': [0, 2] },
                'bicycle': { 'line-color': '#006400', 'line-width': 5 }
            };

            map.addLayer({
                id: `route-layer-${mode}`,
                type: 'line',
                source: sourceId,
                layout: { 'line-join': 'round', 'line-cap': 'round' },
                paint: paintProps[mode]
            });
        }
    }

    // ========================================================================
    // GESTION DES ÉVÉNEMENTS
    // ========================================================================

    function setupEventListeners() {
        // Clic sur un pin
        map.on('click', LAYER_ID_PINS, handleMapClick);
        map.on('mouseenter', LAYER_ID_PINS, () => map.getCanvas().style.cursor = 'pointer');
        map.on('mouseleave', LAYER_ID_PINS, () => map.getCanvas().style.cursor = '');
        
        // Synchronisation de la liste
        map.on('moveend', updateVisibleList);

        // --- NOUVEAU : GESTIONNAIRES D'ÉVÉNEMENTS POUR LES ITINÉRAIRES ---
        setupLongPressListener();
        
        // Clic délégué pour le bouton "Itinéraire" dans les popups
        map.getContainer().addEventListener('click', (e) => {
            if (e.target.matches('.popup-directions-btn')) {
                const lng = parseFloat(e.target.dataset.lng);
                const lat = parseFloat(e.target.dataset.lat);
                originA = [lng, lat];
                console.log("Point A (logement) défini:", originA);
                openDirectionsModal();
                if(currentPopup) currentPopup.remove();
            }
        });

        // Contrôles de la modale d'itinéraire
        document.querySelector('#close-directions-modal').addEventListener('click', closeDirectionsModal);
        document.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', () => handleTabClick(button.dataset.mode));
        });
        document.querySelectorAll('.bike-option-btn').forEach(button => {
            button.addEventListener('click', () => handleBikeOptionClick(button.dataset.bikeType));
        });
    }

    function handleMapClick(e) {
        if (e.features && e.features.length > 0) {
            const feature = e.features[0];
            const coordinates = feature.geometry.coordinates.slice();
            const clickedPinId = feature.id;

            if (selectedPinId !== null && selectedPinId !== clickedPinId) {
                map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: selectedPinId }, { selected: false });
            }
            map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: clickedPinId }, { selected: true });
            selectedPinId = clickedPinId;

            if (currentPopup) currentPopup.remove();
            
            // On passe les coordonnées pour le bouton "Itinéraire"
            const popupHTML = createPopupHTML(feature.properties, coordinates);
            
            currentPopup = new maplibregl.Popup({ offset: 10, className: 'airbnb-style-popup' })
                .setLngLat(coordinates)
                .setHTML(popupHTML)
                .addTo(map);

            currentPopup.on('close', () => {
                if (selectedPinId === clickedPinId) {
                    map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: selectedPinId }, { selected: false });
                    selectedPinId = null;
                }
                currentPopup = null;
            });
        }
    }
    
    // ========================================================================
    // LOGIQUE DES ITINÉRAIRES
    // ========================================================================

    function setupLongPressListener() {
        const handleInteractionStart = (e) => {
            longPressTimer = setTimeout(() => {
                longPressTimer = null;
                destinationB = [e.lngLat.lng, e.lngLat.lat];
                console.log("Point B (destination) défini par clic long:", destinationB);
                
                if (destinationMarker) {
                    destinationMarker.setLngLat(destinationB);
                } else {
                    const el = document.createElement('div');
                    el.className = 'destination-marker';
                    destinationMarker = new maplibregl.Marker({element: el, draggable: true})
                        .setLngLat(destinationB)
                        .addTo(map);
                    
                    destinationMarker.on('dragend', () => {
                        destinationB = destinationMarker.getLngLat().toArray();
                        console.log("Point B (destination) mis à jour par glisser-déposer:", destinationB);
                        if(directionsModal.classList.contains('active')) {
                            fetchAllRouteTimesAndUpdateUI();
                        }
                    });
                }
                if (originA) openDirectionsModal();
            }, 700); // 700ms de pression
        };
        const handleInteractionEnd = () => {
            if (longPressTimer) clearTimeout(longPressTimer);
        };
        map.on('mousedown', handleInteractionStart);
        map.on('mouseup', handleInteractionEnd);
        map.on('mousemove', handleInteractionEnd);
        map.on('touchstart', handleInteractionStart);
        map.on('touchend', handleInteractionEnd);
        map.on('touchmove', handleInteractionEnd);
    }
    
    function openDirectionsModal() {
        if (!originA) {
            alert("Veuillez d'abord sélectionner une annonce.");
            return;
        }
        if (!destinationB) {
            directionsModal.querySelector('.directions-instructions').textContent = "Cliquez longuement sur la carte pour définir une destination.";
            directionsModal.classList.add('active');
            return;
        }
        directionsModal.classList.add('active');
        fetchAllRouteTimesAndUpdateUI();
    }
    
    function closeDirectionsModal() {
        directionsModal.classList.remove('active');
        clearRouteLayers();
        // On ne réinitialise pas originA et destinationB pour pouvoir rouvrir facilement
    }

    async function fetchAllRouteTimesAndUpdateUI() {
        if (!originA || !destinationB) return;

        // Réinitialise les temps et l'affichage
        document.querySelectorAll('.tab-button span').forEach(s => s.textContent = '--:--');
        directionsModal.querySelector('.directions-instructions').textContent = "Calcul des temps en cours...";

        const modes = ['drive', 'transit', 'walk', 'bicycle'];
        const promises = modes.map(mode => getRouteData(mode, originA, destinationB));
        
        const results = await Promise.allSettled(promises);
        
        let firstValidRoute = null;

        results.forEach((result, index) => {
            const mode = modes[index];
            if (result.status === 'fulfilled' && result.value) {
                const duration = result.value.routes[0]?.duration;
                document.getElementById(`time-${mode}`).textContent = formatDuration(duration);
                if (!firstValidRoute) {
                    firstValidRoute = { mode, geojson: result.value.routes[0]?.geometry };
                }
            } else {
                 document.getElementById(`time-${mode}`).textContent = "N/A";
                 console.warn(`Impossible de calculer l'itinéraire pour le mode ${mode}:`, result.reason);
            }
        });

        // Affiche le premier itinéraire valide trouvé (souvent la voiture)
        if (firstValidRoute) {
            handleTabClick(firstValidRoute.mode, firstValidRoute.geojson);
        } else {
            directionsModal.querySelector('.directions-instructions').textContent = "Aucun itinéraire trouvé.";
        }
    }
    
    async function handleTabClick(mode, preloadedGeometry = null) {
        document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`.tab-button[data-mode="${mode}"]`).classList.add('active');

        document.getElementById('bicycle-options').style.display = mode === 'bicycle' ? 'block' : 'none';
        
        currentRouteMode = mode;
        
        if (preloadedGeometry) {
            const geojsonForDrawing = { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: preloadedGeometry, properties: {} }] };
            drawRoute(mode, geojsonForDrawing);
            directionsModal.querySelector('.directions-instructions').textContent = `Affichage de l'itinéraire en ${mode}.`;
            return;
        }

        directionsModal.querySelector('.directions-instructions').textContent = `Chargement de l'itinéraire en ${mode}...`;
        const data = await getRouteData(mode, originA, destinationB);

        if (data && data.routes && data.routes.length > 0) {
            const route = data.routes[0];
            let geojsonForDrawing;
            
            // Transformer la réponse de l'API en GeoJSON standard
            if (mode === 'transit' && route.legs) {
                // Pour les transports, créer une feature par étape
                geojsonForDrawing = { type: 'FeatureCollection', features: route.legs.map((leg, i) => ({
                    type: 'Feature',
                    properties: { id: i, mode: leg.mode, color: leg.line_color },
                    geometry: leg.geometry
                }))};
            } else {
                // Pour les autres, une seule feature avec la géométrie globale
                geojsonForDrawing = { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: route.geometry, properties: {} }] };
            }

            drawRoute(mode, geojsonForDrawing);
            directionsModal.querySelector('.directions-instructions').textContent = `Durée estimée : ${formatDuration(route.duration)}.`;
        } else {
            directionsModal.querySelector('.directions-instructions').textContent = `Itinéraire en ${mode} indisponible.`;
            clearRouteLayers();
        }
    }
    
    function handleBikeOptionClick(bikeType) {
        currentBikeType = bikeType;
        document.querySelectorAll('.bike-option-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`.bike-option-btn[data-bike-type="${bikeType}"]`).classList.add('active');
        // Relance le calcul pour le vélo avec la nouvelle option
        handleTabClick('bicycle');
    }

    async function getRouteData(mode, start, end) {
        const profile = mode === 'transit' ? 'transit' : (mode === 'drive' ? 'driving' : mode);
        let url = `${DIRECTIONS_API_BASE}/${profile}/${start.join(',')};${end.join(',')}?key=${MAPTILER_API_KEY}&geometries=geojson&alternatives=false&steps=true`;
        
        if(mode === 'transit') url += '&arrive_by=2025-06-04T18:00:00'; // Date/heure pour un calcul pertinent
        if(mode === 'bicycle' && currentBikeType === 'shared') url += '&bicycle_type=hybrid'; // Option pour Vélib'

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
            return await response.json();
        } catch (error) {
            console.error(`Erreur de routage pour le mode ${mode}:`, error);
            return null;
        }
    }


    // ========================================================================
    // FONCTIONS UTILITAIRES ET EXISTANTES (certaines modifiées)
    // ========================================================================
    
    function createPopupHTML(properties, coordinates) {
        const placeholderImage = 'https://via.placeholder.com/280x150/cccccc/969696?text=Image';
        const coverPhoto = properties.coverPhoto || placeholderImage;
        const title = properties.title || "Titre non disponible";
        const priceText = `${properties.price || '?'} € / mois`;
        const detailLink = `annonce?id=${properties.id_str}`;
        // --- NOUVEAU : Bouton Itinéraire ---
        const directionsButton = `<button class="popup-directions-btn" data-lng="${coordinates[0]}" data-lat="${coordinates[1]}">Itinéraire</button>`;
    
        return `<div class="map-custom-popup">
                    <img src="${coverPhoto}" alt="${title}" class="popup-image" onerror="this.src='${placeholderImage}'">
                    <div class="popup-info">
                        <h4 class="popup-title">${title}</h4>
                        <p class="popup-price">${priceText}</p>
                        <div class="popup-actions">
                            <a href="${detailLink}" class="popup-link" target="_blank">Voir détails</a>
                            ${directionsButton}
                        </div>
                    </div>
                </div>`;
    }

    function formatDuration(seconds) {
        if (!seconds || seconds < 0) return "--:--";
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        if (hours > 0) {
            return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
        }
        return `${minutes} min`;
    }
    
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
    
    async function mettreAJourBatimentsSelectionnes(annonces) { /* ... fonction inchangée ... */ }
    function getBounds(geojson) { /* ... fonction inchangée ... */ }
    function updateVisibleList() { /* ... fonction inchangée ... */ }
    function getNestedValue(obj, path) { /* ... fonction inchangée ... */ }
    
    // Logique pour le bouton mobile
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

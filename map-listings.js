// map-listings.js - VERSION AMÉLIORÉE AVEC ITINÉRAIRES MULTIMODAUX
document.addEventListener('DOMContentLoaded', function() {
    console.log('[MAP_SCRIPT V13] Initialisation avec marqueurs HTML et itinéraires multimodaux.');

    // --- CONFIGURATION ---
    const MAPTILER_API_KEY = 'UsgTlLJiePXeSnyh57aL'; // Remplacez par votre clé API MapTiler
    maptilersdk.config.apiKey = MAPTILER_API_KEY;

    const MAP_CONTAINER_ID = 'map-section';
    const SOURCE_ID_ROUTE = 'directions-route-source';

    // --- ÉLÉMENTS DU DOM ---
    const directionsModal = document.getElementById('directions-modal');
    const directionsOutput = document.getElementById('directions-output');
    const closeDirectionsModalBtn = document.getElementById('close-directions-modal');
    const bicycleOptionsDiv = document.getElementById('bicycle-options');
    const mobileMapToggleButton = document.getElementById('mobile-map-toggle');

    // --- ÉTAT INTERNE ---
    let map = null;
    let currentMarkers = []; // Pour stocker les instances des marqueurs HTML
    let currentPopup = null;
    let selectedPinId = null;
    let destinationB = null; // Coordonnées [lng, lat] pour la destination (clic long)
    let destinationBMarker = null;
    let currentRouteLayers = []; // Pour stocker les IDs des couches d'itinéraire
    let longPressTimer = null;
    let originCoords = null; // Coordonnées du pin d'annonce pour l'itinéraire

    // --- ÉCOUTEUR D'ÉVÉNEMENT PRINCIPAL ---
    // Se déclenche quand home-form-display-v4.js a chargé et affiché les annonces
    document.addEventListener('annoncesChargeesEtRendues', (event) => {
        const annonces = event.detail.annonces;
        if (!annonces || !Array.isArray(annonces)) {
            console.warn('[MAP_SCRIPT] Événement "annoncesChargeesEtRendues" reçu sans données valides.');
            return;
        }

        const geojsonData = convertAnnoncesToGeoJSON(annonces);

        if (!map) {
            initializeMap(geojsonData);
        }
        
        // Mettre à jour les marqueurs sur la carte
        updateMapMarkers(geojsonData.features);

        // Ajuster la vue de la carte pour montrer tous les nouveaux marqueurs
        if (geojsonData.features.length > 0) {
            const bounds = getBounds(geojsonData);
            map.fitBounds(bounds, { padding: 80, maxZoom: 15, duration: 1000 });
        } else {
            map.flyTo({ center: [2.3522, 48.8566], zoom: 11 }); // Paris par défaut si pas de résultats
        }
    });

    // --- FONCTIONS DE LA CARTE ---

    function initializeMap(initialGeoJSON) {
        map = new maptilersdk.Map({
            container: MAP_CONTAINER_ID,
            style: maptilersdk.MapStyle.STREETS,
            center: [2.3522, 48.8566], // Paris
            zoom: 11,
            pitch: 20,
            bearing: 0,
        });

        window.map = map; // Rendre la map accessible globalement pour le débogage

        map.on('load', () => {
            console.log('[MAP_SCRIPT] Carte chargée.');
            
            // Événements pour le clic long (définir la destination B)
            map.on('mousedown', (e) => { longPressTimer = setTimeout(() => handleLongPress(e), 800); });
            map.on('mouseup', () => clearTimeout(longPressTimer));
            map.on('mouseout', () => clearTimeout(longPressTimer));
            map.on('touchstart', (e) => { if (e.points.length === 1) { longPressTimer = setTimeout(() => handleLongPress(e), 800); }});
            map.on('touchend', () => clearTimeout(longPressTimer));
            map.on('touchcancel', () => clearTimeout(longPressTimer));
        });

        map.addControl(new maptilersdk.NavigationControl(), 'top-right');
    }
    
    function updateMapMarkers(features) {
        // 1. Supprimer les anciens marqueurs
        currentMarkers.forEach(marker => marker.remove());
        currentMarkers = [];
        if (currentPopup) {
            currentPopup.remove();
        }

        // 2. Ajouter les nouveaux marqueurs HTML
        features.forEach(feature => {
            const { coordinates } = feature.geometry;
            const { price, id_str } = feature.properties;

            // Créer l'élément HTML pour le marqueur
            const el = document.createElement('div');
            el.className = 'price-marker-maplibre';
            el.textContent = `${price}€`;
            el.dataset.propertyId = id_str;
            
            // Ajouter le gestionnaire de clic
            el.addEventListener('click', (e) => {
                e.stopPropagation(); // Empêche le clic de se propager à la carte
                handlePinClick(feature);
            });

            // Créer et ajouter le marqueur à la carte
            const marker = new maptilersdk.Marker(el)
                .setLngLat(coordinates)
                .addTo(map);

            currentMarkers.push(marker);
        });
    }

    function handlePinClick(feature) {
        if (!feature) return;

        const { properties, geometry } = feature;
        const coordinates = geometry.coordinates.slice();
        originCoords = coordinates; // Définir l'origine pour tout futur calcul d'itinéraire

        if (currentPopup) currentPopup.remove();

        const popupHTML = createPopupHTML(properties);
        currentPopup = new maptilersdk.Popup({ offset: [0, -15], closeButton: false })
            .setLngLat(coordinates)
            .setHTML(popupHTML)
            .addTo(map);
            
        // Attacher l'événement au bouton "Itinéraire" DANS le popup
        const itineraireBtn = document.getElementById(`itineraire-btn-${properties.id_str}`);
        if (itineraireBtn) {
            itineraireBtn.onclick = () => {
                openDirectionsModal(coordinates);
                if (currentPopup) currentPopup.remove();
            };
        }
    }

    function handleLongPress(e) {
        destinationB = [e.lngLat.lng, e.lngLat.lat];
        console.log('Destination B fixée (clic long):', destinationB);

        if (destinationBMarker) destinationBMarker.remove();
        
        const el = document.createElement('div');
        el.className = 'destination-marker';
        destinationBMarker = new maptilersdk.Marker({element: el, anchor: 'bottom'})
            .setLngLat(destinationB)
            .addTo(map);
        
        // Si une origine est déjà définie et que la modale est ouverte, on rafraîchit l'itinéraire
        if (originCoords && directionsModal.classList.contains('active')) {
            const activeModeButton = directionsModal.querySelector('.tab-button.active');
            if (activeModeButton) {
                const mode = activeModeButton.dataset.mode;
                fetchAndDisplayRoute(originCoords, destinationB, mode);
            }
        } else if (originCoords) { // Si une origine est là mais la modale est fermée, on l'ouvre
             openDirectionsModal(originCoords);
        }
    }

    // --- FONCTIONS POUR LA MODALE D'ITINÉRAIRE ---

    function openDirectionsModal(startCoords) {
        originCoords = startCoords;
        directionsModal.classList.add('active');
        
        const defaultModeButton = directionsModal.querySelector('.tab-button.active') || directionsModal.querySelector('.tab-button');
        if (defaultModeButton) {
            const mode = defaultModeButton.dataset.mode;
            toggleBicycleOptions(mode === 'bicycle');
            if (destinationB) {
                fetchAndDisplayRoute(originCoords, destinationB, mode);
            } else {
                directionsOutput.innerHTML = "<p><strong>Définissez une destination.</strong><br>Effectuez un appui long sur la carte pour placer un repère.</p>";
                clearRoute();
                resetTravelTimes();
            }
        }
    }
    
    closeDirectionsModalBtn.addEventListener('click', () => {
        directionsModal.classList.remove('active');
        clearRoute();
    });

    directionsModal.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', () => {
            directionsModal.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            const mode = button.dataset.mode;
            toggleBicycleOptions(mode === 'bicycle');
            
            if (originCoords && destinationB) {
                fetchAndDisplayRoute(originCoords, destinationB, mode);
            } else if (!destinationB) {
                directionsOutput.innerHTML = "<p><strong>Définissez une destination.</strong><br>Effectuez un appui long sur la carte pour placer un repère.</p>";
                clearRoute();
            }
        });
    });
    
    bicycleOptionsDiv.querySelectorAll('button').forEach(button => {
        button.addEventListener('click', (e) => {
            const bikeType = e.target.dataset.bikeType;
            if (originCoords && destinationB) {
                fetchAndDisplayRoute(originCoords, destinationB, 'bicycle', bikeType);
            }
        });
    });

    // --- LOGIQUE DE CALCUL ET D'AFFICHAGE DES ITINÉRAIRES ---

    async function fetchAndDisplayRoute(start, end, mode, bikeType = 'personal') {
        clearRoute();
        directionsOutput.innerHTML = `<p>Calcul de l'itinéraire en ${mode}...</p>`;
        resetTravelTimes();

        try {
            if (mode === 'transit') {
                await fetchAndDisplayTransitRoute(start, end);
            } else if (mode === 'bicycle' && bikeType === 'shared_bike') {
                await fetchAndDisplaySharedBikeRoute(start, end);
            } else {
                // Gère 'drive', 'walk', et 'bicycle' (personnel)
                await fetchAndDisplayStandardRoute(start, end, mode);
            }
        } catch (error) {
            console.error(`Erreur lors du calcul de l'itinéraire (${mode}):`, error);
            directionsOutput.innerHTML = `<p>Erreur: Impossible de calculer l'itinéraire.</p>`;
            document.getElementById(`time-${mode}`).textContent = "Erreur";
        }
    }

    async function fetchAndDisplayStandardRoute(start, end, mode) {
        let profile = maptilersdk.RoutingProfiles.DRIVING;
        if (mode === 'walk') profile = maptilersdk.RoutingProfiles.WALKING;
        else if (mode === 'bicycle') profile = maptilersdk.RoutingProfiles.BICYCLING;

        const results = await maptilersdk.routing.search({
            profile: profile,
            waypoints: [start, end],
            steps: true,
            overview: maptilersdk.OverviewOutput.FULL
        });

        if (results.routes && results.routes.length > 0) {
            const route = results.routes[0];
            const routeStyle = getRouteStyle(mode);
            displayRouteOnMap(route.geometry, 'route-main', routeStyle);
            displayTravelTime(route.duration, mode);
            displayInstructions(route);
        } else {
            throw new Error("Aucun itinéraire standard trouvé.");
        }
    }

    async function fetchAndDisplayTransitRoute(start, end) {
        const url = `https://api.maptiler.com/directions/v1/transit?waypoints=${start.join(',')};${end.join(',')}&key=${MAPTILER_API_KEY}&overview=full&geometries=geojson`;
        
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Erreur API Transit: ${response.statusText}`);
        const data = await response.json();

        if (data.trips && data.trips.length > 0) {
            const trip = data.trips[0];
            let totalDuration = 0;

            const walkFeatures = [];
            const transitFeatures = [];

            trip.legs.forEach(leg => {
                totalDuration += leg.duration;
                leg.steps.forEach(step => {
                    if (step.travel_mode === 'WALK') {
                        walkFeatures.push(step.geometry);
                    } else { // BUS, SUBWAY, etc.
                        transitFeatures.push(step.geometry);
                    }
                });
            });

            // Afficher les segments de marche
            if (walkFeatures.length > 0) {
                const walkGeometry = { type: 'GeometryCollection', geometries: walkFeatures };
                displayRouteOnMap(walkGeometry, 'route-transit-walk', getRouteStyle('transit_walk'));
            }
            // Afficher les segments de transport
            if (transitFeatures.length > 0) {
                const transitGeometry = { type: 'GeometryCollection', geometries: transitFeatures };
                displayRouteOnMap(transitGeometry, 'route-transit-main', getRouteStyle('transit'));
            }

            displayTravelTime(totalDuration, 'transit');
            directionsOutput.innerHTML = `<p>Itinéraire en transport en commun trouvé. Suivez le tracé sur la carte.</p>`;

        } else {
            throw new Error("Aucun itinéraire en transport en commun trouvé.");
        }
    }
    
    function fetchAndDisplaySharedBikeRoute(start, end) {
        directionsOutput.innerHTML = `
            <h4>Fonctionnalité "Vélib" non disponible</h4>
            <p class="text-sm">Le calcul d'itinéraire avec vélos en libre-service nécessite une base de données des stations (ex: API OpenData de la ville) pour trouver les bornes les plus proches de l'origine et de la destination.</p>
            <p class="text-sm">Le trajet "Mon vélo" est disponible.</p>`;
        document.getElementById('time-bicycle').textContent = "N/A";
    }

    // --- FONCTIONS UTILITAIRES POUR L'AFFICHAGE ---

    function displayRouteOnMap(geometry, layerId, styleOptions) {
        const routeGeoJSON = {
            type: 'Feature',
            geometry: geometry,
            properties: {}
        };
        
        if (!map.getSource(SOURCE_ID_ROUTE)) {
            map.addSource(SOURCE_ID_ROUTE, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        }
        
        // On ne peut pas mettre à jour une seule feature, on doit mettre à jour la collection.
        // On récupère les features existantes et on ajoute la nouvelle.
        const source = map.getSource(SOURCE_ID_ROUTE);
        const currentData = source._data;
        currentData.features.push(routeGeoJSON);
        source.setData(currentData);

        map.addLayer({
            id: layerId,
            type: 'line',
            source: SOURCE_ID_ROUTE,
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
                'line-color': styleOptions.color,
                'line-width': styleOptions.width,
                'line-opacity': styleOptions.opacity,
                'line-dasharray': styleOptions.dasharray || [1]
            }
        });
        currentRouteLayers.push(layerId);
    }
    
    function getRouteStyle(mode) {
        switch(mode) {
            case 'walk': return { color: '#8A2BE2', width: 5, opacity: 0.8, dasharray: [0, 2] }; // Violet, pointillés
            case 'bicycle': return { color: '#006400', width: 5, opacity: 0.8 }; // Vert sapin
            case 'transit': return { color: '#FFD700', width: 6, opacity: 0.85 }; // Jaune
            case 'transit_walk': return { color: '#6495ED', width: 5, opacity: 0.9, dasharray: [0, 2] }; // Bleu clair, pointillés
            default: return { color: '#007bff', width: 5, opacity: 0.8 }; // Bleu (voiture)
        }
    }

    function clearRoute() {
        currentRouteLayers.forEach(layerId => {
            if (map.getLayer(layerId)) map.removeLayer(layerId);
        });
        currentRouteLayers = [];
        
        if (map.getSource(SOURCE_ID_ROUTE)) {
            const source = map.getSource(SOURCE_ID_ROUTE);
            if (source) {
                source.setData({ type: 'FeatureCollection', features: [] });
            }
        }
    }
    
    function displayTravelTime(durationSeconds, mode) {
        const minutes = Math.round(durationSeconds / 60);
        const timeString = minutes < 60 ? `${minutes} min` : `${Math.floor(minutes/60)}h${(minutes % 60).toString().padStart(2, '0')}`;
        const timeElement = document.getElementById(`time-${mode}`);
        if(timeElement) timeElement.textContent = timeString;
    }

    function resetTravelTimes() {
        ['drive', 'transit', 'walk', 'bicycle'].forEach(mode => {
            const el = document.getElementById(`time-${mode}`);
            if(el) el.textContent = "--:--";
        });
    }

    function displayInstructions(route) {
        let instructionsHtml = "<h4>Instructions :</h4><ol class='list-decimal list-inside text-sm space-y-1'>";
        route.legs[0].steps.forEach(step => {
            instructionsHtml += `<li>${step.maneuver.instruction} <span class="text-gray-500">(${Math.round(step.distance)}m)</span></li>`;
        });
        instructionsHtml += "</ol>";
        directionsOutput.innerHTML = instructionsHtml;
    }
    
    function toggleBicycleOptions(show) {
        bicycleOptionsDiv.classList.toggle('hidden', !show);
    }

    // --- CONVERTISSEURS ET UTILITAIRES GÉNÉRAUX ---

    function convertAnnoncesToGeoJSON(annonces) {
        const features = annonces.map(annonce => {
            const lat = getNestedValue(annonce, 'geo_location.data.lat');
            const lng = getNestedValue(annonce, 'geo_location.data.lng');
            if (annonce.id === undefined || lat === undefined || lng === undefined) return null;

            return {
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
                properties: {
                    id: parseInt(annonce.id, 10),
                    id_str: String(annonce.id),
                    price: getNestedValue(annonce, '_property_lease_of_property.0.loyer') || '???',
                    title: getNestedValue(annonce, 'property_title'),
                    coverPhoto: getNestedValue(annonce, '_property_photos.0.images.0.url'),
                    coordinates: [parseFloat(lng), parseFloat(lat)]
                }
            };
        }).filter(Boolean); // Filtrer les annonces sans coordonnées valides
        return { type: 'FeatureCollection', features };
    }

    function getBounds(geojson) {
        const bounds = new maptilersdk.LngLatBounds();
        geojson.features.forEach(feature => {
            bounds.extend(feature.geometry.coordinates);
        });
        return bounds;
    }

    function createPopupHTML(properties) {
        const placeholderImage = 'https://via.placeholder.com/280x150/cccccc/969696?text=Image';
        const coverPhoto = properties.coverPhoto || placeholderImage;
        const title = properties.title || "Titre non disponible";
        const priceText = `${properties.price} € / mois`;
        const detailLink = `annonce?id=${properties.id_str}`;

        return `
            <div class="map-custom-popup">
                <a href="${detailLink}" target="_blank" style="text-decoration: none; color: inherit;">
                    <img src="${coverPhoto}" alt="${title}" class="popup-image" onerror="this.src='${placeholderImage}'">
                    <div class="popup-info">
                        <h4 class="popup-title">${title}</h4>
                        <p class="popup-price">${priceText}</p>
                    </div>
                </a>
                <div class="popup-actions" style="padding: 0 12px 12px 12px;">
                    <button id="itineraire-btn-${properties.id_str}" class="popup-itineraire-btn">Itinéraire</button>
                </div>
            </div>
            <style>
                /* Styles spécifiques au popup pour plus de propreté */
                .popup-itineraire-btn { width: 100%; padding: 8px 12px; border: none; background-color: #007bff; color: white; border-radius: 6px; font-weight: 500; cursor: pointer; transition: background-color 0.2s; }
                .popup-itineraire-btn:hover { background-color: #0056b3; }
                .popup-info { padding: 12px; padding-bottom: 8px;}
            </style>
        `;
    }

    function getNestedValue(obj, path) {
        if (!path) return undefined;
        return path.split('.').reduce((acc, part) => {
            if (acc === undefined || acc === null) return undefined;
            const index = !isNaN(parseInt(part, 10)) ? parseInt(part, 10) : -1;
            if (Array.isArray(acc) && index !== -1) return acc[index];
            return acc[part];
        }, obj);
    }

    // --- LOGIQUE POUR LE BOUTON DE BASCULE MOBILE ---
    if (mobileMapToggleButton) {
         mobileMapToggleButton.addEventListener('click', () => {
            document.body.classList.toggle('map-is-active');
            if (document.body.classList.contains('map-is-active')) {
                if (map) map.resize(); // Très important pour que la carte se redessine correctement
                mobileMapToggleButton.textContent = `Voir la liste`;
            } else {
                mobileMapToggleButton.textContent = `Afficher la carte`;
            }
        });
    }
});

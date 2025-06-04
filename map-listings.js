 // map-listings.js - VERSION AVEC MODE TRAJET
        document.addEventListener('DOMContentLoaded', function() {
            console.log('[MAP_SCRIPT V12] Intégration Mode Trajet.');

            const MAPTILER_API_KEY = 'UsgTlLJiePXeSnyh57aL'; // Remplacez par votre clé API MapTiler
            maptilersdk.config.apiKey = MAPTILER_API_KEY;

            const MAP_CONTAINER_ID = 'map-section';
            const LIST_CONTAINER_ID = 'annonces-wrapper'; // Si vous utilisez toujours une liste séparée
            const SOURCE_ID_ANNONCES = 'annonces-source'; 
            const LAYER_ID_PINS = 'annonces-pins-layer';
            const LAYER_ID_LABELS = 'annonces-labels-layer';
            
            const directionsModal = document.getElementById('directions-modal');
            const directionsOutput = document.getElementById('directions-output');
            const closeDirectionsModalBtn = document.getElementById('close-directions-modal');
            const bicycleOptionsDiv = document.getElementById('bicycle-options');

            let map = null;
            let allAnnouncements = []; // Suppose que cela vient de home-form-display-v4.js
            let currentPopup = null;
            let selectedPinId = null; 
            
            let destinationB = null; // Coordonnées [lng, lat] pour la destination B
            let destinationBMarker = null;
            let currentRouteLayers = []; // Pour stocker les IDs des couches d'itinéraire affichées
            let currentRouteSourceId = 'directions-route-source';
            let longPressTimer = null;
            let originCoords = null; // Coordonnées du pin d'annonce pour l'itinéraire

            // Simuler la réception des annonces (remplacez par votre logique réelle)
            // Vous recevez probablement cela via l'événement 'annoncesChargeesEtRendues'
            // que vous avez dans votre code home-form-display-v4.js
            // Pour ce test, je vais créer quelques annonces fictives.
            /*
            allAnnouncements = [
                { id: 1, geo_location: { data: { lat: 48.8584, lng: 2.2945 } }, property_title: "Tour Eiffel Vue", _property_lease_of_property: [{loyer: 2500}]},
                { id: 2, geo_location: { data: { lat: 48.8600, lng: 2.3376 } }, property_title: "Appart Louvre", _property_lease_of_property: [{loyer: 1800}]}
            ];
            */

            document.addEventListener('annoncesChargeesEtRendues', (event) => {
                const annonces = event.detail.annonces;
                if (!annonces || !Array.isArray(annonces)) return;
                
                allAnnouncements = annonces;
                const geojsonData = convertAnnoncesToGeoJSON(allAnnouncements);

                if (!map) {
                    initializeMap(geojsonData);
                } else {
                    map.getSource(SOURCE_ID_ANNONCES).setData(geojsonData);
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
                    pitch: 0, // Commencer avec une vue 2D pour les itinéraires, l'utilisateur peut incliner
                    bearing: 0,
                    renderWorldCopies: false
                });
                
                window.map = map; 

                if (initialGeoJSON && initialGeoJSON.features.length > 0) {
                    const bounds = getBounds(initialGeoJSON);
                    map.fitBounds(bounds, { padding: 80, duration: 0, maxZoom: 16 });
                } else {
                    map.setCenter([2.3522, 48.8566]); // Paris par défaut
                    map.setZoom(11);
                }

                map.on('load', () => {
                    console.log('[MAP_SCRIPT V12] Carte chargée.');
                    map.addSource(SOURCE_ID_ANNONCES, { type: 'geojson', data: initialGeoJSON, promoteId: 'id' });
                    
                    map.addLayer({
                        id: LAYER_ID_PINS, type: 'circle', source: SOURCE_ID_ANNONCES,
                        paint: { 'circle-radius': 8, 'circle-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#007bff', '#3B82F6'], 'circle-stroke-width': 2, 'circle-stroke-color': '#FFFFFF' }
                    });
                    map.addLayer({
                        id: LAYER_ID_LABELS, type: 'symbol', source: SOURCE_ID_ANNONCES,
                        layout: { 'text-field': ['concat', ['to-string', ['get', 'price']], '€'], 'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'], 'text-size': 10, 'text-offset': [0, -1.8], 'text-allow-overlap': false },
                        paint: { 'text-color': '#000000', 'text-halo-color': '#FFFFFF', 'text-halo-width': 1 }
                    });
                    
                    map.on('click', LAYER_ID_PINS, handlePinClick);
                    map.on('mouseenter', LAYER_ID_PINS, () => map.getCanvas().style.cursor = 'pointer');
                    map.on('mouseleave', LAYER_ID_PINS, () => map.getCanvas().style.cursor = '');
                    
                    // Gestion du clic long pour définir la destination B
                    map.on('mousedown', (e) => {
                        longPressTimer = setTimeout(() => {
                            handleLongPress(e);
                        }, 800); // 800ms pour un clic long
                    });
                    map.on('mouseup', () => clearTimeout(longPressTimer));
                    map.on('mouseout', () => clearTimeout(longPressTimer)); // Annuler si la souris quitte la carte
                    map.on('touchstart', (e) => { // Pour mobile
                        if (e.points.length === 1) { // S'assurer que c'est un seul doigt
                             longPressTimer = setTimeout(() => {
                                handleLongPress(e);
                            }, 800);
                        }
                    });
                    map.on('touchend', () => clearTimeout(longPressTimer));
                    map.on('touchcancel', () => clearTimeout(longPressTimer));


                    // updateVisibleList(); // Si vous avez cette fonction pour synchroniser une liste
                });

                map.addControl(new maplibregl.NavigationControl(), 'top-right');
            }

            function handleLongPress(e) {
                destinationB = [e.lngLat.lng, e.lngLat.lat];
                console.log('Destination B fixée (clic long):', destinationB);

                if (destinationBMarker) {
                    destinationBMarker.remove();
                }
                const el = document.createElement('div');
                el.className = 'destination-marker';
                destinationBMarker = new maplibregl.Marker(el)
                    .setLngLat(destinationB)
                    .addTo(map);
                
                // Si une origine est déjà définie (un pin d'annonce a été cliqué pour itinéraire)
                // et que la modale est ouverte, on peut rafraîchir l'itinéraire
                if (originCoords && directionsModal.classList.contains('active')) {
                    const activeModeButton = directionsModal.querySelector('.tab-button.active');
                    if (activeModeButton) {
                        const mode = activeModeButton.dataset.mode;
                        fetchAndDisplayRoute(originCoords, destinationB, mode);
                    }
                } else if (originCoords) { // Si une origine est là mais modale fermée, on l'ouvre
                     openDirectionsModal(originCoords); // originCoords aurait été défini par handlePinClick
                }
            }

            function handlePinClick(e) {
                if (e.features.length > 0) {
                    const feature = e.features[0];
                    const coordinates = feature.geometry.coordinates.slice();
                    const properties = feature.properties;
                    const clickedPinIdFromEvent = feature.id; 

                    originCoords = coordinates; // Définir l'origine pour l'itinéraire

                    if (selectedPinId !== null && selectedPinId !== clickedPinIdFromEvent) {
                        map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: selectedPinId }, { selected: false });
                    }
                    map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: clickedPinIdFromEvent }, { selected: true });
                    selectedPinId = clickedPinIdFromEvent;

                    if (currentPopup) currentPopup.remove();
                    const popupHTML = createPopupHTML(properties);
                    currentPopup = new maplibregl.Popup({ offset: [0, -15] })
                        .setLngLat(coordinates)
                        .setHTML(popupHTML)
                        .addTo(map);
                    
                    // Attacher l'événement au bouton "Itinéraire" dans le popup
                    const itineraireBtn = document.getElementById(`itineraire-btn-${properties.id_str}`);
                    if (itineraireBtn) {
                        itineraireBtn.onclick = () => {
                            openDirectionsModal(coordinates);
                            currentPopup.remove(); // Fermer le popup après avoir cliqué sur itinéraire
                        };
                    }
                }
            }
            
            function openDirectionsModal(startCoords) {
                originCoords = startCoords; // S'assurer que l'origine est bien celle du pin
                directionsModal.classList.add('active');
                // Par défaut, charger l'itinéraire voiture ou le premier onglet actif
                const defaultModeButton = directionsModal.querySelector('.tab-button.active') || directionsModal.querySelector('.tab-button');
                if (defaultModeButton) {
                    const mode = defaultModeButton.dataset.mode;
                    if (destinationB) { // Si une destination B est déjà fixée
                        fetchAndDisplayRoute(originCoords, destinationB, mode);
                    } else {
                        directionsOutput.innerHTML = "<p>Effectuez un clic long sur la carte pour définir une destination.</p>";
                        clearRoute(); // Effacer les anciennes routes
                        resetTravelTimes();
                    }
                    toggleBicycleOptions(mode === 'bicycle');
                }
            }

            closeDirectionsModalBtn.addEventListener('click', () => {
                directionsModal.classList.remove('active');
                clearRoute(); // Effacer la route quand on ferme la modale
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
                        directionsOutput.innerHTML = "<p>Effectuez un clic long sur la carte pour définir une destination.</p>";
                        clearRoute();
                    } else {
                         directionsOutput.innerHTML = "<p>Veuillez d'abord sélectionner une annonce (origine).</p>";
                         clearRoute();
                    }
                });
            });
            
            bicycleOptionsDiv.querySelectorAll('button').forEach(button => {
                button.addEventListener('click', (e) => {
                    const bikeType = e.target.dataset.bikeType;
                     console.log("Option vélo sélectionnée:", bikeType);
                    // Ici, vous pourriez ajuster la requête d'itinéraire si l'API le permet
                    // Pour l'instant, on relance la même requête vélo.
                    if (originCoords && destinationB) {
                        fetchAndDisplayRoute(originCoords, destinationB, 'bicycle', bikeType);
                    }
                });
            });

            function toggleBicycleOptions(show) {
                bicycleOptionsDiv.classList.toggle('hidden', !show);
            }

            async function fetchAndDisplayRoute(start, end, mode, bikeType = 'personal') {
                console.log(`Fetching route from ${start} to ${end}, mode: ${mode}, bikeType: ${bikeType}`);
                clearRoute();
                directionsOutput.innerHTML = `<p>Calcul de l'itinéraire ${mode}...</p>`;
                resetTravelTimes();

                try {
                    let profile = maptilersdk.RoutingProfiles.DRIVING;
                    if (mode === 'walk') profile = maptilersdk.RoutingProfiles.WALKING;
                    else if (mode === 'bicycle') profile = maptilersdk.RoutingProfiles.BICYCLING;
                    else if (mode === 'transit') profile = maptilersdk.RoutingProfiles.TRANSIT; // Nécessite une gestion spécifique

                    // Pour le mode transit, l'API MapTiler peut être différente ou nécessiter des options spécifiques.
                    // Cette démo se concentre sur les modes plus directs.
                    // Le SDK JS de MapTiler ne gère pas directement le mode "transit" pour le routing simple.
                    // Il faudrait utiliser l'API Directions directement:
                    // https://docs.maptiler.com/cloud/api/directions-api/#tag/Routing/operation/transitSearchPOST
                    if (mode === 'transit') {
                        directionsOutput.innerHTML = "<p>Le mode transport en commun n'est pas entièrement implémenté dans cette démo via le SDK simple. Il nécessiterait un appel API direct.</p>";
                        // Ici, on pourrait simuler un trajet à pied vers une station et un trajet "générique"
                        // Pour l'instant, on affiche juste un message.
                        document.getElementById(`time-${mode}`).textContent = "N/A";
                        return;
                    }

                    const results = await maptilersdk.routing.search({
                        profile: profile,
                        waypoints: [
                            maptilersdk.LngLat.convert(start),
                            maptilersdk.LngLat.convert(end)
                        ],
                        alternatives: false, // true pour plusieurs routes
                        steps: true, // pour avoir les instructions textuelles
                        overview: maptilersdk.OverviewOutput.FULL // pour la géométrie complète
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
                    console.error("Erreur lors du calcul de l'itinéraire:", error);
                    directionsOutput.innerHTML = `<p>Erreur lors du calcul de l'itinéraire: ${error.message}</p>`;
                    document.getElementById(`time-${mode}`).textContent = "Erreur";
                }
            }
            
            function displayTravelTime(durationSeconds, mode) {
                const minutes = Math.round(durationSeconds / 60);
                const timeString = minutes < 60 ? `${minutes} min` : `${Math.floor(minutes/60)}h ${minutes % 60}min`;
                document.getElementById(`time-${mode}`).textContent = timeString;
            }

            function resetTravelTimes() {
                ['drive', 'transit', 'walk', 'bicycle'].forEach(mode => {
                    document.getElementById(`time-${mode}`).textContent = "--:--";
                });
            }

            function displayRouteOnMap(geometry, mode) {
                clearRoute(); // Efface les routes précédentes

                let color = '#007bff'; // Bleu par défaut (voiture)
                let lineDasharray = [];
                
                if (mode === 'walk') { color = '#8A2BE2'; lineDasharray = [0, 2]; } // Violet, pointillés (0 espace, 2 tiret)
                else if (mode === 'bicycle') { color = '#006400'; } // Vert sapin
                else if (mode === 'transit') { color = '#FFD700'; lineDasharray = [0,2];} // Jaune pour transit (marche en pointillé bleu clair)
                                                                    // Pour un vrai trajet en transport, il faudrait plusieurs segments.

                const routeGeoJSON = {
                    type: 'FeatureCollection',
                    features: [{
                        type: 'Feature',
                        geometry: geometry,
                        properties: {}
                    }]
                };

                if (!map.getSource(currentRouteSourceId)) {
                    map.addSource(currentRouteSourceId, {
                        type: 'geojson',
                        data: routeGeoJSON
                    });
                } else {
                    map.getSource(currentRouteSourceId).setData(routeGeoJSON);
                }
                
                const layerId = `route-layer-${mode}`;
                map.addLayer({
                    id: layerId,
                    type: 'line',
                    source: currentRouteSourceId,
                    layout: {
                        'line-join': 'round',
                        'line-cap': 'round'
                    },
                    paint: {
                        'line-color': color,
                        'line-width': 5,
                        'line-opacity': 0.8,
                        'line-dasharray': lineDasharray.length > 0 ? lineDasharray : [1] // [1] pour ligne continue si pas de dasharray
                    }
                });
                currentRouteLayers.push(layerId);

                // Si transit, et si on voulait simuler la marche vers la station
                if (mode === 'transit_walk_segment') { // Exemple de nom pour un segment de marche en mode transit
                     map.addLayer({
                        id: `${layerId}-walk`,
                        type: 'line',
                        source: currentRouteSourceId, // Supposons que la géométrie de marche est dans la même source
                        layout: { 'line-join': 'round', 'line-cap': 'round' },
                        paint: { 'line-color': '#ADD8E6', 'line-width': 4, 'line-opacity': 0.9, 'line-dasharray': [0, 2] }
                    });
                    currentRouteLayers.push(`${layerId}-walk`);
                }
            }

            function clearRoute() {
                currentRouteLayers.forEach(layerId => {
                    if (map.getLayer(layerId)) {
                        map.removeLayer(layerId);
                    }
                });
                currentRouteLayers = [];
                if (map.getSource(currentRouteSourceId)) {
                    // Optionnel: vider les données de la source si elle ne sera pas réutilisée immédiatement
                     map.getSource(currentRouteSourceId).setData({ type: 'FeatureCollection', features: [] });
                }
                // Ne pas supprimer la source ici si on veut la réutiliser, sinon:
                // if (map.getSource(currentRouteSourceId)) {
                //     map.removeSource(currentRouteSourceId);
                // }
            }

            function createPopupHTML(properties) {
                const placeholderImage = 'https://via.placeholder.com/280x150/cccccc/969696?text=Image';
                const coverPhoto = properties.coverPhoto || placeholderImage;
                const title = properties.title || "Titre non disponible";
                const priceText = `${properties.price || '?'} € / mois`;
                const detailLink = `annonce?id=${properties.id_str}`;
                // Ajout du bouton itinéraire avec un ID unique pour chaque pin
                return `
                    <div class="map-custom-popup">
                        ${coverPhoto ? `<img src="${coverPhoto}" alt="${title}" class="popup-image" onerror="this.src='${placeholderImage}'">` : ''}
                        <h4 class="popup-title">${title}</h4>
                        <p class="popup-price">${priceText}</p>
                        <a href="${detailLink}" class="popup-link" target="_blank">Voir détails</a>
                        <button id="itineraire-btn-${properties.id_str}" class="popup-itineraire-btn">Itinéraire</button>
                    </div>`;
            }
            
            function getNestedValue(obj, path) {
                if (!path) return undefined;
                return path.split('.').reduce((acc, part) => (acc && acc[part] !== undefined) ? (isNaN(parseInt(part, 10)) ? acc[part] : acc[parseInt(part, 10)]) : undefined, obj);
            }
            
            // Logique pour le bouton de bascule mobile (si vous l'utilisez)
            const mobileMapToggleButton = document.getElementById('mobile-map-toggle'); // Assurez-vous que cet ID existe si vous utilisez cette logique
            if (mobileMapToggleButton) {
                 mobileMapToggleButton.addEventListener('click', () => {
                    document.body.classList.toggle('map-is-active'); // Suppose que cette classe contrôle l'affichage map/liste
                    if (document.body.classList.contains('map-is-active')) {
                        if (map) map.resize();
                        mobileMapToggleButton.textContent = `Voir la liste`;
                    } else {
                        // if (listContainer) listContainer.scrollTo(0, 0); // Si vous avez une liste
                        mobileMapToggleButton.textContent = `Afficher la carte`;
                    }
                });
            }
            // Si vous n'avez pas de liste d'annonces externe et que tout est sur la carte,
            // la fonction updateVisibleList n'est peut-être pas nécessaire.
            // function updateVisibleList() { /* ... */ }

            // Appel initial pour charger les annonces si elles ne sont pas déjà chargées par un autre script
            // Si home-form-display-v4.js s'en occupe, cette partie n'est pas nécessaire ici.
             if (!allAnnouncements.length && typeof fetchAnnouncements === 'function') { // fetchAnnouncements viendrait de home-form-display-v4.js
                 // fetchAnnouncements(); // Ceci déclencherait 'annoncesChargeesEtRendues'
             } else if (allAnnouncements.length > 0 && !map) { // Si les annonces sont déjà là mais la carte pas initialisée
                 initializeMap(convertAnnoncesToGeoJSON(allAnnouncements));
             }

        });

// map-listings.js - VERSION FINALE v11.1 - Timing robuste et Opacité
document.addEventListener('DOMContentLoaded', function() {
    console.log('[MAP_SCRIPT V11.1] Timing robuste et Opacité.');

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
    let currentPopup = null;
    let selectedPinId = null; 
    let clickedBuildingId = null; 
    let initialAnnouncementsLoaded = false; // Indicateur pour le premier chargement

    document.addEventListener('annoncesChargeesEtRendues', (event) => {
        const annonces = event.detail.annonces;
        if (!annonces || !Array.isArray(annonces)) return;
        
        allAnnouncements = annonces;
        const geojsonData = convertAnnoncesToGeoJSON(allAnnouncements);

        if (!map) {
            initialAnnouncementsLoaded = true; // Marquer que les données initiales sont prêtes
            initializeMap(geojsonData); // L'initialisation s'occupera de la coloration après 'load'
        } else {
            map.getSource(SOURCE_ID_ANNONCES).setData(geojsonData);
            // Pour les mises à jour après le chargement initial de la carte
            if (map.isStyleLoaded()) {
                // Attendre que la carte soit inactive avant de mettre à jour les bâtiments
                map.once('idle', () => {
                    mettreAJourBatimentsSelectionnes(allAnnouncements);
                });
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
    
    // Fonction pour la logique de clic sur les bâtiments (simplifiée pour le test)
    function handleBuildingClick(e) {
        if (e.features.length > 0) {
            const newClickedBuildingId = e.features[0].id;
            console.log(`[BÂTIMENT CLIC] ID du bâtiment cliqué: ${newClickedBuildingId}, Feature:`, e.features[0]);

            if (clickedBuildingId !== null && clickedBuildingId !== newClickedBuildingId) {
                map.setFeatureState(
                    { source: SOURCE_NAME_BUILDINGS, sourceLayer: SOURCE_LAYER_NAME_BUILDINGS, id: clickedBuildingId },
                    { highlighted: false }
                );
                console.log(`[BÂTIMENT CLIC] Ancien bâtiment ${clickedBuildingId} réinitialisé.`);
            }

            map.setFeatureState(
                { source: SOURCE_NAME_BUILDINGS, sourceLayer: SOURCE_LAYER_NAME_BUILDINGS, id: newClickedBuildingId },
                { highlighted: true }
            );
            const newState = map.getFeatureState({ source: SOURCE_NAME_BUILDINGS, sourceLayer: SOURCE_LAYER_NAME_BUILDINGS, id: newClickedBuildingId });
            console.log(`[BÂTIMENT CLIC] Nouveau bâtiment ${newClickedBuildingId} mis en évidence. État actuel:`, JSON.stringify(newState));
            
            clickedBuildingId = newClickedBuildingId;
            map.triggerRepaint();
        }
    }


    // Rétablissement de la fonction pour colorer les bâtiments en fonction de la liste d'annonces
    async function mettreAJourBatimentsSelectionnes(annoncesAffichees) {
        if (!map.isStyleLoaded()) {
            console.warn("[BÂTIMENTS MAJ] Style non chargé, report de la mise à jour.");
            map.once('styledata', () => mettreAJourBatimentsSelectionnes(annoncesAffichees)); // Réessayer une fois le style chargé
            return;
        }
        if (!map.getSource(SOURCE_NAME_BUILDINGS)) {
            console.warn(`[BÂTIMENTS MAJ] Source '${SOURCE_NAME_BUILDINGS}' non trouvée.`);
            return;
        }

        console.log("[BÂTIMENTS MAJ] Début de la mise à jour des bâtiments colorés.");

        // D'abord, réinitialiser tous les bâtiments précédemment colorés
        if (window.lastHighlightedBuildingIds && window.lastHighlightedBuildingIds.size > 0) {
            window.lastHighlightedBuildingIds.forEach(id => {
                map.setFeatureState({ source: SOURCE_NAME_BUILDINGS, sourceLayer: SOURCE_LAYER_NAME_BUILDINGS, id: id }, { highlighted: false });
            });
        }
        window.lastHighlightedBuildingIds = new Set(); // Réinitialiser l'ensemble global

        if (!annoncesAffichees || annoncesAffichees.length === 0) {
            console.log("[BÂTIMENTS MAJ] Aucune annonce à afficher, tous les bâtiments redeviennent gris.");
            map.triggerRepaint();
            return;
        }
        
        // Attendre que la carte soit inactive pour éviter des requêtes pendant le mouvement
        await map.once('idle'); 
        
        let featuresFoundCount = 0;
        for (const annonce of annoncesAffichees) {
            const lat = getNestedValue(annonce, 'geo_location.data.lat');
            const lng = getNestedValue(annonce, 'geo_location.data.lng');
            if (lat && lng) {
                const point = map.project([lng, lat]);
                const queryBox = [ [point.x - 10, point.y - 10], [point.x + 10, point.y + 10] ];
                
                if (map.getLayer(LAYER_ID_BUILDINGS_3D)) { // Vérifier si la couche existe
                    const features = map.queryRenderedFeatures(queryBox, { layers: [LAYER_ID_BUILDINGS_3D] });
                    if (features.length > 0 && features[0].id !== undefined) { 
                        const buildingId = features[0].id;
                        map.setFeatureState({ source: SOURCE_NAME_BUILDINGS, sourceLayer: SOURCE_LAYER_NAME_BUILDINGS, id: buildingId }, { highlighted: true });
                        window.lastHighlightedBuildingIds.add(buildingId); // Ajouter à l'ensemble global
                        featuresFoundCount++;
                        // console.log(`[BÂTIMENTS MAJ] Annonce ${annonce.id} -> Building ID ${buildingId} mis à jour.`);
                    }
                }
            }
        }
        console.log(`[BÂTIMENTS MAJ] ${featuresFoundCount} bâtiments mis en évidence.`);
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

        if (initialGeoJSON.features.length > 0) {
            const bounds = getBounds(initialGeoJSON);
            map.fitBounds(bounds, { padding: 80, duration: 0, maxZoom: 16 });
        } else {
            map.setCenter([2.3522, 48.8566]);
            map.setZoom(11);
        }

        map.on('load', () => {
            console.log('[MAP_SCRIPT V11.1] Carte chargée. Ajout des couches.');
            map.addSource(SOURCE_ID_ANNONCES, { type: 'geojson', data: initialGeoJSON, promoteId: 'id' });

            const heightExpression = ['coalesce', ['get', 'height'], 20]; 
            const minHeightExpression = ['coalesce', ['get', 'min_height'], 0];

            const layers = map.getStyle().layers;
            let firstSymbolId;
            for (let i = 0; i < layers.length; i++) {
                if (layers[i].type === 'symbol') {
                    firstSymbolId = layers[i].id;
                    break;
                }
            }

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
                    'fill-extrusion-opacity': 1 // Opacité à 1 pour éviter les artefacts
                }
            }, firstSymbolId); 

            map.addLayer({
                id: LAYER_ID_PINS, type: 'circle', source: SOURCE_ID_ANNONCES,
                paint: { 'circle-radius': 18, 'circle-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#007bff', '#FFFFFF'], 'circle-stroke-width': ['case', ['boolean', ['feature-state', 'selected'], false], 2, 1.5], 'circle-stroke-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#FFFFFF', '#007bff'] }
            });
            
            map.addLayer({
                id: LAYER_ID_LABELS, type: 'symbol', source: SOURCE_ID_ANNONCES,
                layout: { 'text-field': ['concat', ['to-string', ['get', 'price']], '€'], 'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'], 'text-size': 11, 'text-allow-overlap': true },
                paint: { 'text-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#FFFFFF', '#333333'] }
            });
            
            map.on('click', LAYER_ID_PINS, handlePinClick);
            map.on('click', LAYER_ID_BUILDINGS_3D, handleBuildingClick); // Écouteur pour le clic sur bâtiment

            map.on('mouseenter', LAYER_ID_PINS, () => map.getCanvas().style.cursor = 'pointer');
            map.on('mouseleave', LAYER_ID_PINS, () => map.getCanvas().style.cursor = '');
            map.on('mouseenter', LAYER_ID_BUILDINGS_3D, () => map.getCanvas().style.cursor = 'pointer');
            map.on('mouseleave', LAYER_ID_BUILDINGS_3D, () => map.getCanvas().style.cursor = '');

            map.on('moveend', updateVisibleList);

            // Appel initial pour la liste et les bâtiments après que tout soit chargé
            updateVisibleList();
            if (initialAnnouncementsLoaded) { // S'assurer que les données sont là
                map.once('idle', () => { // Attendre que la carte soit complètement inactive
                     mettreAJourBatimentsSelectionnes(allAnnouncements);
                });
            }
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
    
    function handlePinClick(e) {
        if (e.features.length > 0) {
            const feature = e.features[0];
            const coordinates = feature.geometry.coordinates.slice();
            const properties = feature.properties;
            const clickedPinIdFromEvent = feature.id; 
            if (selectedPinId !== null && selectedPinId !== clickedPinIdFromEvent) {
                map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: selectedPinId }, { selected: false });
            }
            map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: clickedPinIdFromEvent }, { selected: true });
            selectedPinId = clickedPinIdFromEvent;
            if (currentPopup) currentPopup.remove();
            const popupHTML = createPopupHTML(properties);
            currentPopup = new maplibregl.Popup({ offset: 10, closeButton: true, className: 'airbnb-style-popup' }).setLngLat(coordinates).setHTML(popupHTML).addTo(map);
            currentPopup.on('close', () => {
                if (selectedPinId === clickedPinIdFromEvent) {
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

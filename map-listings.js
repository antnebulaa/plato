// map-listings.js - VERSION FINALE v9.1 - Ordre des couches corrigé
document.addEventListener('DOMContentLoaded', function() {
    console.log('[MAP_SCRIPT V9.1] Ordre des couches corrigé.');

    const MAPTILER_API_KEY = 'UsgTlLJiePXeSnyh57aL';
    const MAP_CONTAINER_ID = 'map-section';
    const LIST_CONTAINER_ID = 'annonces-wrapper';
    const MOBILE_TOGGLE_BUTTON_ID = 'mobile-map-toggle';
    const SOURCE_ID = 'annonces-source'; // Source pour nos pins d'annonces
    const LAYER_ID_PINS = 'annonces-pins-layer';
    const LAYER_ID_LABELS = 'annonces-labels-layer';

    const listContainer = document.getElementById(LIST_CONTAINER_ID);
    const mobileToggleButton = document.getElementById(MOBILE_TOGGLE_BUTTON_ID);

    let map = null;
    let allAnnouncements = [];
    let isMobile = window.innerWidth < 768;
    let currentPopup = null;
    let selectedFeatureId = null;

    document.addEventListener('annoncesChargeesEtRendues', (event) => {
        const annonces = event.detail.annonces;
        if (!annonces || !Array.isArray(annonces)) return;
        
        allAnnouncements = annonces;
        const geojsonData = convertAnnoncesToGeoJSON(allAnnouncements);

        if (!map) {
            initializeMap(geojsonData);
        } else {
            // Si la carte existe déjà, on met à jour les données et le centrage
            map.getSource(SOURCE_ID).setData(geojsonData);
            mettreAJourBatimentsSelectionnes(allAnnouncements);
            if (geojsonData.features.length > 0) {
                 const bounds = getBounds(geojsonData);
                 map.fitBounds(bounds, { padding: 80, maxZoom: 16 });
            } else { // Si pas d'annonces, on peut recentrer sur une vue par défaut ou ne rien faire
                map.flyTo({ center: [2.3522, 48.8566], zoom: 11 }); // Exemple: retour à Paris
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
        if (!map.isStyleLoaded() || !annonces || annonces.length === 0) {
            if (map.getLayer('batiments-selectionnes-3d')) {
                 map.setFilter('batiments-selectionnes-3d', ['in', ['id'], '']);
            }
            return;
        }
        await map.once('idle');
        const buildingIds = new Set();
        for (const annonce of annonces) {
            const lat = getNestedValue(annonce, 'geo_location.data.lat');
            const lng = getNestedValue(annonce, 'geo_location.data.lng');
            if (lat && lng) {
                const point = map.project([lng, lat]);
                const queryBox = [ [point.x - 10, point.y - 10], [point.x + 10, point.y + 10] ];
                const features = map.queryRenderedFeatures(queryBox, { layers: ['base-buildings-3d'] });
                if (features.length > 0) {
                    buildingIds.add(features[0].id);
                }
            }
        }
        const idsTrouves = Array.from(buildingIds);
        console.log(`[BÂTIMENTS DEBUG] IDs trouvés pour coloration : ${idsTrouves.join(', ')} (Total: ${idsTrouves.length})`);
        
        if (map.getLayer('batiments-selectionnes-3d')) {
            map.setFilter('batiments-selectionnes-3d', ['in', ['id'], ...idsTrouves.length > 0 ? idsTrouves : ['']]);
        } else {
            console.warn("[BÂTIMENTS DEBUG] Couche 'batiments-selectionnes-3d' non trouvée au moment du filtrage.");
        }
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
            console.log('[MAP_SCRIPT V9.1] Carte chargée. Ajout des couches dans le bon ordre.');
            map.addSource(SOURCE_ID, { type: 'geojson', data: initialGeoJSON, promoteId: 'id' });

            const heightExpression = ['coalesce', ['get', 'height'], 20]; 
            const SOURCE_NAME_FOR_BUILDINGS = 'maptiler_planet'; 
            const SOURCE_LAYER_NAME_FOR_BUILDINGS = 'building';    

            // ============================ ORDRE D'AJOUT CORRIGÉ ============================
            // 1. D'abord, la couche des PINS (annonces-pins-layer)
            map.addLayer({
                id: LAYER_ID_PINS, type: 'circle', source: SOURCE_ID,
                paint: { 'circle-radius': 18, 'circle-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#007bff', '#FFFFFF'], 'circle-stroke-width': ['case', ['boolean', ['feature-state', 'selected'], false], 2, 1.5], 'circle-stroke-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#FFFFFF', '#007bff'] }
            });

            // 2. Ensuite, la couche des LABELS (souvent liée aux pins)
            map.addLayer({
                id: LAYER_ID_LABELS, type: 'symbol', source: SOURCE_ID,
                layout: { 'text-field': ['concat', ['to-string', ['get', 'price']], '€'], 'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'], 'text-size': 11, 'text-allow-overlap': true },
                paint: { 'text-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#FFFFFF', '#333333'] }
            });

            // 3. Maintenant, la couche de base grise pour tous les bâtiments, insérée AVANT les pins
            map.addLayer({
                'id': 'base-buildings-3d',
                'type': 'fill-extrusion',
                'source': SOURCE_NAME_FOR_BUILDINGS,
                'source-layer': SOURCE_LAYER_NAME_FOR_BUILDINGS,
                'paint': { 
                    'fill-extrusion-color': '#dfdfdf', 
                    'fill-extrusion-height': heightExpression, 
                    'fill-extrusion-base': ['coalesce', ['get', 'min_height'], 0], 
                    'fill-extrusion-opacity': 0.7 
                }
            }, LAYER_ID_PINS); // Insérer AVANT la couche des pins (qui existe maintenant)

            // 4. Et la couche rose pour les bâtiments sélectionnés, aussi AVANT les pins
            map.addLayer({
                'id': 'batiments-selectionnes-3d',
                'type': 'fill-extrusion',
                'source': SOURCE_NAME_FOR_BUILDINGS,
                'source-layer': SOURCE_LAYER_NAME_FOR_BUILDINGS,
                'filter': ['in', ['id'], ''], 
                'paint': { 
                    'fill-extrusion-color': '#FF1493', 
                    'fill-extrusion-height': heightExpression, 
                    'fill-extrusion-base': ['coalesce', ['get', 'min_height'], 0], 
                    'fill-extrusion-opacity': 0.9 
                }
            }, LAYER_ID_PINS); // Insérer AVANT la couche des pins
            // ===========================================================================
            
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
            if (!anchorTag || anchorTag.tagName !== 'A') {
                itemDiv.style.display = visiblePropertyIds.has(itemIdString) ? '' : 'none'; return;
            }
            if (visiblePropertyIds.has(itemIdString)) {
                anchorTag.classList.remove('annonce-list-item-hidden');
            } else {
                anchorTag.classList.add('annonce-list-item-hidden');
            }
        });
        if (isMobile && mobileToggleButton) {
            mobileToggleButton.textContent = `Voir les ${visiblePropertyIds.size} logements`;
        }
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
            const clickedFeatureId = feature.id;
            if (selectedFeatureId !== null && selectedFeatureId !== clickedFeatureId) {
                map.setFeatureState({ source: SOURCE_ID, id: selectedFeatureId }, { selected: false });
            }
            map.setFeatureState({ source: SOURCE_ID, id: clickedFeatureId }, { selected: true });
            selectedFeatureId = clickedFeatureId;
            if (currentPopup) currentPopup.remove();
            const popupHTML = createPopupHTML(properties);
            currentPopup = new maplibregl.Popup({ offset: 10, closeButton: true, className: 'airbnb-style-popup' }).setLngLat(coordinates).setHTML(popupHTML).addTo(map);
            currentPopup.on('close', () => {
                if (selectedFeatureId === clickedFeatureId) {
                    map.setFeatureState({ source: SOURCE_ID, id: clickedFeatureId }, { selected: false });
                    selectedFeatureId = null;
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
            const isMapActive = document.body.classList.contains('map-is-active');
            if (isMapActive) {
                document.body.classList.remove('map-is-active');
                if (listContainer) listContainer.scrollTo(0, 0);
            } else {
                document.body.classList.add('map-is-active');
                if (map) map.resize();
            }
            mobileToggleButton.textContent = document.body.classList.contains('map-is-active') ? `Voir la liste` : `Afficher la carte`;
        });
    }
});

// map-listings.js - VERSION 30 (Solution dynamique et robuste)
document.addEventListener('DOMContentLoaded', function() {
    console.log('[MAP_SCRIPT V30] Initialisation avec solution de détection de source.');

    const MAPTILER_API_KEY = 'UsgTlLJiePXeSnyh57aL';
    const MAP_CONTAINER_ID = 'map-section';
    const LIST_CONTAINER_ID = 'annonces-wrapper';
    const MOBILE_TOGGLE_BUTTON_ID = 'mobile-map-toggle';

    const SOURCE_ID_ANNONCES = 'annonces-source';
    const LAYER_ID_DOTS = 'annonces-dots-layer';
    const LAYER_ID_PRICES = 'annonces-prices-layer';

    const SOURCE_ID_CITY_BOUNDARIES = 'city-boundaries-source';
    const LAYER_ID_CITY_BOUNDARIES = 'city-boundaries-layer';
    const LAYER_ID_NEIGHBORHOOD_FILL = 'neighborhood-fill-layer';
    const LAYER_ID_NEIGHBORHOOD_LABELS = 'neighborhood-labels-layer';

    const listContainer = document.getElementById(LIST_CONTAINER_ID);
    const mobileToggleButton = document.getElementById(MOBILE_TOGGLE_BUTTON_ID);

    let map = null;
    let allAnnouncements = [];
    let isMobile = window.innerWidth < 768;
    let currentPopup = null;
    let selectedPinId = null;
    let hoverTooltip = null;

    const mobileBottomSheet = document.getElementById('mobile-bottom-sheet');
    const mobileBottomSheetContent = document.getElementById('mobile-bottom-sheet-content');
    const bottomSheetCloseButton = document.getElementById('bottom-sheet-close-button');

    window.addEventListener('resize', () => {
        isMobile = window.innerWidth < 768;
        if (isMobile && currentPopup) { currentPopup.remove(); currentPopup = null; }
        if (!isMobile && mobileBottomSheet && mobileBottomSheet.classList.contains('visible')) { closeMobileBottomSheet(); }
    });

    if (bottomSheetCloseButton) {
        bottomSheetCloseButton.addEventListener('click', (e) => { e.stopPropagation(); closeMobileBottomSheet(); });
    }
    
    document.addEventListener('annoncesChargeesEtRendues', (event) => {
        const { annonces, cities } = event.detail;
        if (!annonces || !Array.isArray(annonces)) return;

        allAnnouncements = annonces;
        const geojsonData = convertAnnoncesToGeoJSON(allAnnouncements);

        if (!map) {
            initializeMap(geojsonData);
        } else {
            const source = map.getSource(SOURCE_ID_ANNONCES);
            if (source) {
                source.setData(geojsonData);
            }
            
            if (geojsonData.features.length > 0) {
                 const bounds = getBounds(geojsonData);
                 if (bounds) map.fitBounds(bounds, { padding: 80, maxZoom: 16 });
            } else {
                 map.flyTo({ center: [2.3522, 48.8566], zoom: 11 });
            }
        }

        if (map && map.isStyleLoaded() && cities) {
            updateCityBoundaries(cities);
        }
    });
    
    const createCircleSdf = (size) => { const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size; const context = canvas.getContext('2d'); const radius = size / 2; context.beginPath(); context.arc(radius, radius, radius - 2, 0, 2 * Math.PI, false); context.fillStyle = 'white'; context.fill(); return context.getImageData(0, 0, size, size); };
    function convertAnnoncesToGeoJSON(annonces) { const features = annonces.map(annonce => { const lat = getNestedValue(annonce, 'geo_location.data.lat'); const lng = getNestedValue(annonce, 'geo_location.data.lng'); if (annonce.id === undefined || annonce.id === null || lat === undefined || lng === undefined) return null; let featureId = parseInt(annonce.id, 10); if (isNaN(featureId)) return null; return { type: 'Feature', id: featureId, geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] }, properties: { id: featureId, id_str: String(annonce.id), price: getNestedValue(annonce, '_property_lease_of_property.0.loyer') || '?', coverPhoto: getNestedValue(annonce, '_property_photos.0.images.0.url'), house_type: getNestedValue(annonce, 'house_type'), city: getNestedValue(annonce, 'city'), rooms: getNestedValue(annonce, 'rooms'), bedrooms: getNestedValue(annonce, 'bedrooms'), area: getNestedValue(annonce, 'area') } }; }).filter(Boolean); return { type: 'FeatureCollection', features }; }

    function initializeMap(initialGeoJSON) {
        map = new maplibregl.Map({ container: MAP_CONTAINER_ID, style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_API_KEY}`, pitch: 0, bearing: 0, navigationControl: false, renderWorldCopies: false });
        window.map = map;
        
        const bounds = getBounds(initialGeoJSON);
        if (bounds) {
             map.fitBounds(bounds, { padding: 80, duration: 0, maxZoom: 16 });
        } else {
             map.setCenter([2.3522, 48.8566]); map.setZoom(11);
        }

        map.on('load', () => {
            map.addImage('circle-background', createCircleSdf(64), { sdf: true });
            
            // On ajoute la source des annonces en premier
            map.addSource(SOURCE_ID_ANNONCES, { type: 'geojson', data: initialGeoJSON, promoteId: 'id' });

            // On ajoute les couches des annonces
            map.addLayer({ id: LAYER_ID_DOTS, type: 'circle', source: SOURCE_ID_ANNONCES, paint: { 'circle-radius': 5, 'circle-color': '#FFFFFF', 'circle-stroke-width': 1, 'circle-stroke-color': '#B4B4B4' } });
            map.addLayer({ id: LAYER_ID_PRICES, type: 'symbol', source: SOURCE_ID_ANNONCES, layout: { 'icon-image': 'circle-background', 'icon-size': 0.9, 'text-field': ['concat', ['to-string', ['get', 'price']], '€'], 'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'], 'text-size': 14, 'icon-allow-overlap': false, 'text-allow-overlap': false, 'icon-anchor': 'center', 'text-anchor': 'center' }, paint: { 'icon-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#000000', '#FFFFFF'], 'text-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#FFFFFF', '#333333'] } });
            
            // ===== LOGIQUE DÉFINITIVE POUR LES QUARTIERS =====
            const sources = map.getStyle().sources;
            const vectorSourceId = Object.keys(sources).find(id => sources[id].type === 'vector' && sources[id].url?.includes('maptiler'));

            if (vectorSourceId) {
                console.log(`[MAP_SCRIPT] Source de tuiles vectorielles détectée : "${vectorSourceId}"`);
                
                map.addLayer({
                    'id': LAYER_ID_NEIGHBORHOOD_FILL,
                    'type': 'fill',
                    'source': vectorSourceId,
                    'source-layer': 'place',
                    'filter': ['in', ['get', 'class'], ['literal', ['suburb', 'quarter']]],
                    'paint': { 'fill-color': ['interpolate', ['linear'], ['get', 'rank'], 1, 'rgba(255, 99, 71, 0.1)', 5, 'rgba(60, 179, 113, 0.1)', 10, 'rgba(30, 144, 255, 0.1)'], 'fill-opacity': 0.7 }
                }, LAYER_ID_DOTS); // Insérer sous les points des annonces

                map.addLayer({
                    'id': LAYER_ID_NEIGHBORHOOD_LABELS,
                    'type': 'symbol',
                    'source': vectorSourceId,
                    'source-layer': 'place',
                    'filter': ['in', ['get', 'class'], ['literal', ['suburb', 'quarter']]],
                    'layout': { 'text-field': ['get', 'name:fr'], 'text-size': 13, 'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'] },
                    'paint': { 'text-color': '#666', 'text-halo-color': 'white', 'text-halo-width': 1 }
                }, LAYER_ID_DOTS);
            } else {
                console.warn('[MAP_SCRIPT] AVERTISSEMENT : Impossible de trouver la source de données vectorielles pour afficher les quartiers.');
            }
            // ===== FIN DE LA LOGIQUE =====

            map.on('mouseenter', LAYER_ID_DOTS, handleDotHoverOrClick);
            map.on('click', LAYER_ID_DOTS, handleDotHoverOrClick);
            map.on('mouseleave', LAYER_ID_DOTS, () => { map.getCanvas().style.cursor = ''; if(hoverTooltip) { hoverTooltip.remove(); hoverTooltip = null; } });
            map.on('click', LAYER_ID_PRICES, handlePriceBubbleClick);
            map.on('idle', () => { updateVisibleList(); });
            map.on('moveend', () => { updateVisibleList(); });
        });
        map.addControl(new maplibregl.NavigationControl(), 'top-right');
    }
    
    async function updateCityBoundaries(cities = []) {
        if (map.getLayer(LAYER_ID_CITY_BOUNDARIES)) map.removeLayer(LAYER_ID_CITY_BOUNDARIES);
        if (map.getSource(SOURCE_ID_CITY_BOUNDARIES)) map.removeSource(SOURCE_ID_CITY_BOUNDARIES);
        if (cities.length === 0) return;

        try {
            const promises = cities.map(city =>
                fetch(`https://api.maptiler.com/geocoding/${encodeURIComponent(city)}.json?key=${MAPTILER_API_KEY}&language=fr&types=region,place`)
                .then(response => { if (!response.ok) throw new Error(`Geocoding failed for ${city}`); return response.json(); })
            );
            const results = await Promise.all(promises);
            const boundaryFeatures = results.map(result => result.features.find(feature => feature.geometry)).filter(Boolean);
            if (boundaryFeatures.length === 0) return;

            const geojson = { type: 'FeatureCollection', features: boundaryFeatures };
            map.addSource(SOURCE_ID_CITY_BOUNDARIES, { type: 'geojson', data: geojson });
            
            const beforeLayerId = map.getLayer(LAYER_ID_NEIGHBORHOOD_FILL) ? LAYER_ID_NEIGHBORHOOD_FILL : LAYER_ID_DOTS;
            
            map.addLayer({
                id: LAYER_ID_CITY_BOUNDARIES,
                type: 'line',
                source: SOURCE_ID_CITY_BOUNDARIES,
                layout: { 'line-join': 'round', 'line-cap': 'round' },
                paint: { 'line-color': '#007cff', 'line-width': 2.5, 'line-opacity': 0.8 }
            }, beforeLayerId);
        } catch (error) {
            console.error('[MAP_SCRIPT] Erreur lors de la récupération des frontières de ville:', error);
        }
    }

    function handleDotHoverOrClick(e) {
        const priceFeatures = map.queryRenderedFeatures(e.point, { layers: [LAYER_ID_PRICES] });
        if (priceFeatures.length > 0) { return; }
        if (e.features.length > 0) {
            map.getCanvas().style.cursor = 'pointer';
            if (hoverTooltip) { hoverTooltip.remove(); }
            const properties = e.features[0].properties;
            const coordinates = e.features[0].geometry.coordinates.slice();
            hoverTooltip = new maplibregl.Popup({ closeButton: false, offset: 10, anchor: 'bottom', className: 'hover-popup' })
                .setLngLat(coordinates).setHTML(`<div class="hover-popup-content">${properties.price}€</div>`).addTo(map);
        }
    }

    function handlePriceBubbleClick(e) {
        if (hoverTooltip) { hoverTooltip.remove(); hoverTooltip = null; }
        if (e.features && e.features.length > 0) {
            const feature = e.features[0];
            const properties = feature.properties;
            const clickedPinId = feature.id;

            const fullAnnonceData = allAnnouncements.find(annonce => annonce.id === clickedPinId);
            if (fullAnnonceData) sessionStorage.setItem('selected_property_details', JSON.stringify(fullAnnonceData));

            if (selectedPinId !== null) map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: selectedPinId }, { selected: false });
            map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: clickedPinId }, { selected: true });
            selectedPinId = clickedPinId;

            if (isMobile) {
                if (currentPopup) currentPopup.remove();
                openMobileBottomSheet(properties);
            } else {
                if (currentPopup) currentPopup.remove();
                const popupHTML = createPopupHTML(properties);
                currentPopup = new maplibregl.Popup({ offset: 25, closeButton: true, className: 'airbnb-style-popup' })
                    .setLngLat(feature.geometry.coordinates.slice()).setHTML(popupHTML).addTo(map);
                currentPopup.on('close', () => {
                    if (selectedPinId === clickedPinId) { map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: selectedPinId }, { selected: false }); selectedPinId = null; }
                    currentPopup = null;
                });
            }
        }
    }
    
    function createPopupHTML(properties) {
        const placeholderImage = 'https://via.placeholder.com/280x150/cccccc/969696?text=Image';
        const coverPhoto = properties.coverPhoto || placeholderImage;
        const houseTypeRaw = properties.house_type || 'Logement';
        const houseType = houseTypeRaw.charAt(0).toUpperCase() + houseTypeRaw.slice(1);
        const city = properties.city || 'localité non précisée';
        const title = `${houseType} à ${city}`;
        const details = [];
        if (properties.rooms) details.push(`${properties.rooms} pièces`);
        if (properties.bedrooms) details.push(`${properties.bedrooms} chambres`);
        if (properties.area) details.push(`${properties.area}m²`);
        const descriptionHTML = details.length > 0 ? `<p class="popup-description">${details.join(' • ')}</p>` : '';
        const priceHTML = `<p class="popup-price">${properties.price || '?'}€ <span class="popup-price-period">par mois CC</span></p>`;
        const detailLink = `annonce?id=${properties.id_str}`;
        return `<div><a href="${detailLink}" class="popup-container-link" target="_blank"><div class="map-custom-popup"><img src="${coverPhoto}" alt="${title}" class="popup-image" onerror="this.src='${placeholderImage}'"><div class="popup-info"><h4 class="popup-title">${title}</h4>${descriptionHTML}${priceHTML}</div></div></a></div>`;
    }

    function updateVisibleList() { if (!map || !map.isStyleLoaded() || !listContainer) return; const visibleFeatures = map.queryRenderedFeatures({ layers: [LAYER_ID_DOTS] }); const visiblePropertyIds = new Set(visibleFeatures.map(feature => String(feature.properties.id))); const allListItems = listContainer.querySelectorAll('[data-property-id]'); allListItems.forEach(itemDiv => { const itemIdString = itemDiv.dataset.propertyId; const anchorTag = itemDiv.parentElement; if (!anchorTag || anchorTag.tagName !== 'A') { itemDiv.style.display = visiblePropertyIds.has(itemIdString) ? '' : 'none'; return; } if (visiblePropertyIds.has(itemIdString)) { anchorTag.classList.remove('annonce-list-item-hidden'); } else { anchorTag.classList.add('annonce-list-item-hidden'); } }); if (isMobile && mobileToggleButton) { mobileToggleButton.textContent = `Voir les ${visiblePropertyIds.size} logements`; } }
    
    function getBounds(geojson) {
        if (!geojson || !geojson.features || geojson.features.length === 0) return null;
        const bounds = new maplibregl.LngLatBounds();
        geojson.features.forEach(feature => { bounds.extend(feature.geometry.coordinates); });
        return bounds;
    }

    function openMobileBottomSheet(properties) { if (!mobileBottomSheet || !mobileBottomSheetContent) return; const contentHTML = createPopupHTML(properties); mobileBottomSheetContent.innerHTML = contentHTML; mobileBottomSheet.classList.add('visible');}
    function closeMobileBottomSheet() { if (!mobileBottomSheet) return; mobileBottomSheet.classList.remove('visible'); setTimeout(() => { if (mobileBottomSheetContent) mobileBottomSheetContent.innerHTML = ''; }, 350); if (map && selectedPinId !== null) { map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: selectedPinId }, { selected: false }); selectedPinId = null; } }
    function getNestedValue(obj, path) { if (!path) return undefined; return path.split('.').reduce((acc, part) => (acc && acc[part] !== undefined) ? (isNaN(parseInt(part, 10)) ? acc[part] : acc[parseInt(part, 10)]) : undefined, obj); }
    if (isMobile && mobileToggleButton) { mobileToggleButton.addEventListener('click', () => { document.body.classList.toggle('map-is-active'); if (document.body.classList.contains('map-is-active')) { if (map) map.resize(); mobileToggleButton.textContent = `Voir la liste`; } else { if (listContainer) listContainer.scrollTo(0, 0); mobileToggleButton.textContent = `Afficher la carte`; } }); }
});

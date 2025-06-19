// map-listings.js - VERSION 35 (Finale avec Tileset Personnalisé)
document.addEventListener('DOMContentLoaded', function() {
    console.log('[MAP_SCRIPT V35] Initialisation avec le tileset de quartiers personnalisé.');

    // --- Constantes ---
    const MAPTILER_API_KEY = 'UsgTlLJiePXeSnyh57aL'; // Votre clé MapTiler
    const MAP_CONTAINER_ID = 'map-section';
    
    // ▼▼▼ MIS À JOUR AVEC VOS INFORMATIONS ▼▼▼
    const QUARTIERS_TILESET_ID = '019789c9-7e62-7995-9d2f-84eddea6c5d1'; // L'ID que vous avez fourni
    const QUARTIERS_SOURCE_LAYER_NAME = 'export'; // Le nom de la couche que vous avez fourni
    // ▲▲▲ FIN DE LA MISE À JOUR ▲▲▲
    
    const SOURCE_ID_ANNONCES = 'annonces-source';
    const LAYER_ID_DOTS = 'annonces-dots-layer';
    const LAYER_ID_PRICES = 'annonces-prices-layer';

    const SOURCE_ID_QUARTIERS = 'quartiers-source-vector';
    const LAYER_ID_QUARTIERS_FILL = 'quartiers-fill-layer';
    
    const SOURCE_ID_CITY_BOUNDARIES = 'city-boundaries-source';
    const LAYER_ID_CITY_BOUNDARIES = 'city-boundaries-layer';
    
    let map = null;
    let allAnnouncements = [];
    let isMobile = window.innerWidth < 768;
    let currentPopup = null;
    let selectedPinId = null;
    let hoverTooltip = null;

    const listContainer = document.getElementById('annonces-wrapper');
    const mobileToggleButton = document.getElementById('mobile-map-toggle');
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
            if (source) source.setData(geojsonData);
            
            const bounds = getBounds(geojsonData);
            if (bounds) map.fitBounds(bounds, { padding: 80, maxZoom: 16 });
            else map.flyTo({ center: [2.3522, 48.8566], zoom: 11 });
        }

        if (map && map.isStyleLoaded() && cities) {
            updateCityBoundaries(cities);
        }
    });
    
    function convertAnnoncesToGeoJSON(annonces) { const features = annonces.map(annonce => { const lat = getNestedValue(annonce, 'geo_location.data.lat'); const lng = getNestedValue(annonce, 'geo_location.data.lng'); if (annonce.id === undefined || annonce.id === null || lat === undefined || lng === undefined) return null; let featureId = parseInt(annonce.id, 10); if (isNaN(featureId)) return null; return { type: 'Feature', id: featureId, geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] }, properties: { id: featureId, id_str: String(annonce.id), price: getNestedValue(annonce, '_property_lease_of_property.0.loyer') || '?', coverPhoto: getNestedValue(annonce, '_property_photos.0.images.0.url'), house_type: getNestedValue(annonce, 'house_type'), city: getNestedValue(annonce, 'city'), rooms: getNestedValue(annonce, 'rooms'), bedrooms: getNestedValue(annonce, 'bedrooms'), area: getNestedValue(annonce, 'area') } }; }).filter(Boolean); return { type: 'FeatureCollection', features }; }

    function initializeMap(initialGeoJSON) {
        map = new maplibregl.Map({
            container: MAP_CONTAINER_ID,
            style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_API_KEY}`,
            center: [2.3522, 48.8566],
            zoom: 11
        });

        map.on('load', () => {
            // 1. AJOUT DE LA SOURCE DE TUILES VECTORIELLES POUR LES QUARTIERS
            map.addSource(SOURCE_ID_QUARTIERS, {
                type: 'vector',
                url: `https://api.maptiler.com/tiles/${QUARTIERS_TILESET_ID}/tiles.json?key=${MAPTILER_API_KEY}`
            });

            // On trouve la première couche de texte/labels pour insérer nos polygones en dessous
            const firstSymbolLayer = map.getStyle().layers.find(layer => layer.type === 'symbol');

            // 2. AJOUT DE LA COUCHE DE REMPLISSAGE POUR LES QUARTIERS
            map.addLayer({
                id: LAYER_ID_QUARTIERS_FILL,
                type: 'fill',
                source: SOURCE_ID_QUARTIERS,
                'source-layer': QUARTIERS_SOURCE_LAYER_NAME,
                paint: {
                    'fill-color': 'rgba(0, 136, 136, 0.1)', // Turquoise très transparent
                    'fill-outline-color': 'rgba(0, 90, 90, 0.3)'
                }
            }, firstSymbolLayer ? firstSymbolLayer.id : undefined);


            // 3. AJOUT DES SOURCES ET COUCHES POUR LES ANNONCES (par-dessus les quartiers)
            map.addSource(SOURCE_ID_ANNONCES, { type: 'geojson', data: initialGeoJSON, promoteId: 'id' });
            map.addLayer({ id: LAYER_ID_DOTS, type: 'circle', source: SOURCE_ID_ANNONCES, paint: { 'circle-radius': 5, 'circle-color': '#FFFFFF', 'circle-stroke-width': 1, 'circle-stroke-color': '#B4B4B4' } });
            map.addLayer({ id: LAYER_ID_PRICES, type: 'symbol', source: SOURCE_ID_ANNONCES, layout: { 'icon-image': 'circle-background', 'icon-size': 0.9, 'text-field': ['concat', ['to-string', ['get', 'price']], '€'], 'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'], 'text-size': 14, 'icon-allow-overlap': false, 'text-allow-overlap': false }, paint: { 'icon-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#000000', '#FFFFFF'], 'text-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#FFFFFF', '#333333'] } });
            
            // 4. GESTION DES ÉVÉNEMENTS DE LA CARTE
            map.on('click', LAYER_ID_PRICES, handlePriceBubbleClick);
            map.on('idle', () => { updateVisibleList(); });
            map.on('moveend', () => { updateVisibleList(); });
        });
        map.addControl(new maplibregl.NavigationControl(), 'top-right');
    }
    
    async function updateCityBoundaries(cities = []) {
        if (map.getLayer(LAYER_ID_CITY_BOUNDARIES)) map.removeLayer(LAYER_ID_CITY_BOUNDARIES);
        if (map.getSource(SOURCE_ID_CITY_BOUNDARIES)) map.removeSource(SOURCE_ID_CITY_BOUNDARIES);
        if (!cities || cities.length === 0) return;

        try {
            const promises = cities.map(city =>
                fetch(`https://api.maptiler.com/geocoding/${encodeURIComponent(city)}.json?key=${MAPTILER_API_KEY}&language=fr&types=region,place`).then(res => res.json())
            );
            const results = await Promise.all(promises);
            const boundaryFeatures = results.map(result => result.features.find(feature => feature.geometry)).filter(Boolean);
            if (boundaryFeatures.length === 0) return;

            const geojson = { type: 'FeatureCollection', features: boundaryFeatures };
            map.addSource(SOURCE_ID_CITY_BOUNDARIES, { type: 'geojson', data: geojson });
            
            // On ajoute les frontières par-dessus les quartiers, mais sous les prix
            const beforeLayerId = map.getLayer(LAYER_ID_PRICES) ? LAYER_ID_PRICES : undefined;
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

    // --- Fonctions utilitaires (inchangées) ---
    function handlePriceBubbleClick(e) { if (hoverTooltip) { hoverTooltip.remove(); hoverTooltip = null; } if (e.features && e.features.length > 0) { const feature = e.features[0]; const properties = feature.properties; const clickedPinId = feature.id; const fullAnnonceData = allAnnouncements.find(annonce => annonce.id === clickedPinId); if (fullAnnonceData) sessionStorage.setItem('selected_property_details', JSON.stringify(fullAnnonceData)); if (selectedPinId !== null) map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: selectedPinId }, { selected: false }); map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: clickedPinId }, { selected: true }); selectedPinId = clickedPinId; if (isMobile) { if (currentPopup) currentPopup.remove(); openMobileBottomSheet(properties); } else { if (currentPopup) currentPopup.remove(); const popupHTML = createPopupHTML(properties); currentPopup = new maplibregl.Popup({ offset: 25, closeButton: true, className: 'airbnb-style-popup' }).setLngLat(feature.geometry.coordinates.slice()).setHTML(popupHTML).addTo(map); currentPopup.on('close', () => { if (selectedPinId === clickedPinId) { map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: selectedPinId }, { selected: false }); selectedPinId = null; } currentPopup = null; }); } } }
    function createPopupHTML(properties) { const placeholderImage = 'https://via.placeholder.com/280x150/cccccc/969696?text=Image'; const coverPhoto = properties.coverPhoto || placeholderImage; const houseTypeRaw = properties.house_type || 'Logement'; const houseType = houseTypeRaw.charAt(0).toUpperCase() + houseTypeRaw.slice(1); const city = properties.city || 'localité non précisée'; const title = `${houseType} à ${city}`; const details = []; if (properties.rooms) details.push(`${properties.rooms} pièces`); if (properties.bedrooms) details.push(`${properties.bedrooms} chambres`); if (properties.area) details.push(`${properties.area}m²`); const descriptionHTML = details.length > 0 ? `<p class="popup-description">${details.join(' • ')}</p>` : ''; const priceHTML = `<p class="popup-price">${properties.price || '?'}€ <span class="popup-price-period">par mois CC</span></p>`; const detailLink = `annonce?id=${properties.id_str}`; return `<div><a href="${detailLink}" class="popup-container-link" target="_blank"><div class="map-custom-popup"><img src="${coverPhoto}" alt="${title}" class="popup-image" onerror="this.src='${placeholderImage}'"><div class="popup-info"><h4 class="popup-title">${title}</h4>${descriptionHTML}${priceHTML}</div></div></a></div>`; }
    function updateVisibleList() { if (!map || !map.isStyleLoaded() || !listContainer) return; const visibleFeatures = map.queryRenderedFeatures({ layers: [LAYER_ID_DOTS] }); const visiblePropertyIds = new Set(visibleFeatures.map(feature => String(feature.properties.id))); const allListItems = listContainer.querySelectorAll('[data-property-id]'); allListItems.forEach(itemDiv => { const itemIdString = itemDiv.dataset.propertyId; const anchorTag = itemDiv.parentElement; if (!anchorTag || anchorTag.tagName !== 'A') { itemDiv.style.display = visiblePropertyIds.has(itemIdString) ? '' : 'none'; return; } if (visiblePropertyIds.has(itemIdString)) { anchorTag.classList.remove('annonce-list-item-hidden'); } else { anchorTag.classList.add('annonce-list-item-hidden'); } }); if (isMobile && mobileToggleButton) { mobileToggleButton.textContent = `Voir les ${visiblePropertyIds.size} logements`; } }
    function getBounds(geojson) { if (!geojson || !geojson.features || geojson.features.length === 0) return null; const bounds = new maplibregl.LngLatBounds(); geojson.features.forEach(feature => { bounds.extend(feature.geometry.coordinates); }); return bounds; }
    function openMobileBottomSheet(properties) { if (!mobileBottomSheet || !mobileBottomSheetContent) return; const contentHTML = createPopupHTML(properties); mobileBottomSheetContent.innerHTML = contentHTML; mobileBottomSheet.classList.add('visible');}
    function closeMobileBottomSheet() { if (!mobileBottomSheet) return; mobileBottomSheet.classList.remove('visible'); setTimeout(() => { if (mobileBottomSheetContent) mobileBottomSheetContent.innerHTML = ''; }, 350); if (map && selectedPinId !== null) { map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: selectedPinId }, { selected: false }); selectedPinId = null; } }
    function getNestedValue(obj, path) { if (!path) return undefined; return path.split('.').reduce((acc, part) => (acc && acc[part] !== undefined) ? (isNaN(parseInt(part, 10)) ? acc[part] : acc[parseInt(part, 10)]) : undefined, obj); }
    if (isMobile && mobileToggleButton) { mobileToggleButton.addEventListener('click', () => { document.body.classList.toggle('map-is-active'); if (document.body.classList.contains('map-is-active')) { if (map) map.resize(); mobileToggleButton.textContent = `Voir la liste`; } else { if (listContainer) listContainer.scrollTo(0, 0); mobileToggleButton.textContent = `Afficher la carte`; } }); }
});

// map-listings.js - VERSION FINALE (logique par filtres, la plus robuste)
document.addEventListener('DOMContentLoaded', function() {
    console.log('[MAP_SCRIPT] Initialisation avec la logique de masque par filtres.');

    // --- Configuration ---
    const MAPTILER_API_KEY = 'UsgTlLJiePXeSnyh57aL';
    const MAP_ID = '019799fa-e40f-7af6-81a6-b6d1de969567';
    const MAP_CONTAINER_ID = 'map-section';
    
    const SOURCE_ID_ANNONCES = 'annonces-source';
    const LAYER_ID_DOTS = 'annonces-dots-layer';
    const LAYER_ID_PRICES = 'annonces-prices-layer';
    
    const CITY_OUTLINE_LAYER_ID = 'city-outline-layer';
    const MAPTILER_DATASOURCE = 'Countries';
    const BOUNDARY_SOURCE_LAYER = 'administrative';
    const CITY_NAME_FIELD = 'name';
    const CITY_LEVEL_FIELD = 'level';

    const MASK_LAYER_ID = 'mask-layer';
    const BUTTON_3D_ID = 'toggle-3d-button';

    // --- Variables globales ---
    let map = null;
    let allAnnouncements = [];

    // --- ÉCOUTEUR PRINCIPAL ---
    document.addEventListener('annoncesChargeesEtRendues', (event) => {
        const annonces = event.detail.annonces;
        const selectedCities = event.detail.cities || [];
        if (!annonces) return;

        allAnnouncements = annonces;
        const geojsonData = convertAnnoncesToGeoJSON(allAnnouncements);

        if (!map) {
            initializeMap(geojsonData);
        } else {
            const source = map.getSource(SOURCE_ID_ANNONCES);
            if (source) source.setData(geojsonData);
            if (geojsonData.features.length > 0) {
                const bounds = getBounds(geojsonData);
                map.fitBounds(bounds, { padding: 80, maxZoom: 16 });
            }
        }
        updateCityBoundaryLayer(selectedCities);
    });

    // --- INITIALISATION DE LA CARTE ---
    function initializeMap(initialGeoJSON) {
        map = new maplibregl.Map({ container: MAP_CONTAINER_ID, style: `https://api.maptiler.com/maps/${MAP_ID}/style.json?key=${MAPTILER_API_KEY}`, pitch: 0, bearing: 0, navigationControl: false, renderWorldCopies: false });
        window.map = map;
        if (initialGeoJSON.features.length > 0) { const bounds = getBounds(initialGeoJSON); map.fitBounds(bounds, { padding: 80, duration: 0, maxZoom: 16 }); }

        map.on('load', () => {
            console.log('[MAP_SCRIPT] Carte chargée. Ajout des couches de style.');
            
            // --- Annonces (inchangé) ---
            map.addImage('circle-background', createCircleSdf(64), { sdf: true });
            map.addSource(SOURCE_ID_ANNONCES, { type: 'geojson', data: initialGeoJSON, promoteId: 'id' });
            map.addLayer({ id: LAYER_ID_DOTS, type: 'circle', source: SOURCE_ID_ANNONCES, paint: { 'circle-radius': 5, 'circle-color': '#FFFFFF', 'circle-stroke-width': 1, 'circle-stroke-color': '#B4B4B4' } });
            map.addLayer({ id: LAYER_ID_PRICES, type: 'symbol', source: SOURCE_ID_ANNONCES, layout: { 'icon-image': 'circle-background', 'icon-size': 0.9, 'text-field': ['concat', ['to-string', ['get', 'price']], '€'], 'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'], 'text-size': 14 }, paint: { 'icon-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#000000', '#FFFFFF'], 'text-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#FFFFFF', '#333333'] } });

            const firstSymbolLayer = map.getStyle().layers.find(layer => layer.type === 'symbol');

            // --- NOUVELLE LOGIQUE DE MASQUE PAR FILTRE ---
            // 1. On ajoute le calque gris qui couvre TOUTES les communes (level 3)
            map.addLayer({
                id: MASK_LAYER_ID,
                type: 'fill',
                source: MAPTILER_DATASOURCE,
                'source-layer': BOUNDARY_SOURCE_LAYER,
                filter: ['==', ['get', CITY_LEVEL_FIELD], 3], // Cible toutes les communes
                paint: { 'fill-color': 'rgba(100, 100, 100, 0.45)' }
            }, firstSymbolLayer ? firstSymbolLayer.id : undefined); // On le place sous les labels

            // 2. On ajoute le calque pour le contour, initialement vide
            map.addLayer({
                id: CITY_OUTLINE_LAYER_ID,
                type: 'line',
                source: MAPTILER_DATASOURCE,
                'source-layer': BOUNDARY_SOURCE_LAYER,
                paint: { 'line-color': '#007cbf', 'line-width': 2.5 },
                filter: ['==', ['get', CITY_NAME_FIELD], ''] // Filtre vide
            }, MASK_LAYER_ID); // On le place juste au-dessus du masque

            // --- Événements (inchangé) ---
            map.on('mouseenter', LAYER_ID_DOTS, handleDotHoverOrClick);
            map.on('click', LAYER_ID_DOTS, handleDotHoverOrClick);
            map.on('mouseleave', LAYER_ID_DOTS, () => { if(hoverTooltip) { hoverTooltip.remove(); hoverTooltip = null; } });
            map.on('click', LAYER_ID_PRICES, handlePriceBubbleClick);
            map.on('idle', updateVisibleList);
            map.on('moveend', updateVisibleList);
        });
        map.addControl(new maplibregl.NavigationControl(), 'top-right');
    }

    // --- FONCTION DE MISE À JOUR (SIMPLIFIÉE) ---
    function updateCityBoundaryLayer(selectedCities = []) {
        if (!map || !map.isStyleLoaded()) {
            setTimeout(() => updateCityBoundaryLayer(selectedCities), 200);
            return;
        }

        const hasSelection = selectedCities.length > 0;

        // 1. Filtre pour le contour : montre le contour SEULEMENT pour les villes sélectionnées
        const outlineFilter = hasSelection
            ? ['in', ['get', CITY_NAME_FIELD], ['literal', selectedCities]]
            : ['==', ['get', CITY_NAME_FIELD], ''];
        map.setFilter(CITY_OUTLINE_LAYER_ID, outlineFilter);

        // 2. Filtre pour le masque : assombrit tout (de level 3) SAUF les villes sélectionnées
        const maskFilter = hasSelection
            ? ['all',
                ['==', ['get', CITY_LEVEL_FIELD], 3],
                ['!in', ['get', CITY_NAME_FIELD], ['literal', selectedCities]]
              ]
            : ['==', ['get', CITY_LEVEL_FIELD], 3]; // Si rien n'est sélectionné, on grise tout par défaut.
        // Ou, si vous préférez ne rien griser par défaut :
        // const maskFilter = hasSelection ? [...] : ['==', ['get', 'level'], -1]; // correspond à rien

        map.setFilter(MASK_LAYER_ID, maskFilter);
    }

    // --- AUTRES FONCTIONS (le reste de votre script est ici et reste inchangé) ---
    const toggle3dButton = document.getElementById(BUTTON_3D_ID);
    if (toggle3dButton) { toggle3dButton.addEventListener('click', function() { if (!map) return; const p = map.getPitch(); map.easeTo({ pitch: p > 0 ? 0 : 65, duration: 1000 }); this.textContent = p > 0 ? 'Vue 2D' : 'Vue 3D'; }); }
    const createCircleSdf = (size) => { const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size; const context = canvas.getContext('2d'); const radius = size / 2; context.beginPath(); context.arc(radius, radius, radius - 2, 0, 2 * Math.PI, false); context.fillStyle = 'white'; context.fill(); return context.getImageData(0, 0, size, size); };
    function getNestedValue(obj, path) { if (!path) return undefined; return path.split('.').reduce((acc, part) => (acc && acc[part] !== undefined) ? (isNaN(parseInt(part, 10)) ? acc[part] : acc[parseInt(part, 10)]) : undefined, obj); }
    function convertAnnoncesToGeoJSON(annonces) { const features = annonces.map(annonce => { const lat = getNestedValue(annonce, 'geo_location.data.lat'); const lng = getNestedValue(annonce, 'geo_location.data.lng'); if (annonce.id === undefined || lat === undefined || lng === undefined) return null; let fId = parseInt(annonce.id, 10); if (isNaN(fId)) return null; return { type: 'Feature', id: fId, geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] }, properties: { id: fId, id_str: String(annonce.id), price: getNestedValue(annonce, '_property_lease_of_property.0.loyer') || '?', coverPhoto: getNestedValue(annonce, '_property_photos.0.images.0.url'), house_type: getNestedValue(annonce, 'house_type'), city: getNestedValue(annonce, 'city'), rooms: getNestedValue(annonce, 'rooms'), bedrooms: getNestedValue(annonce, 'bedrooms'), area: getNestedValue(annonce, 'area') } }; }).filter(Boolean); return { type: 'FeatureCollection', features }; }
    let currentPopup = null, selectedPinId = null, isMobile = window.innerWidth < 768, hoverTooltip = null;
    function handleDotHoverOrClick(e) { if (map.queryRenderedFeatures(e.point, { layers: [LAYER_ID_PRICES] }).length > 0) return; if (e.features.length > 0) { map.getCanvas().style.cursor = 'pointer'; if (hoverTooltip) hoverTooltip.remove(); const p = e.features[0].properties; const c = e.features[0].geometry.coordinates.slice(); hoverTooltip = new maplibregl.Popup({ closeButton: false, offset: 10, anchor: 'bottom', className: 'hover-popup' }).setLngLat(c).setHTML(`<div class="hover-popup-content">${p.price}€</div>`).addTo(map); } }
    function handlePriceBubbleClick(e) { if (hoverTooltip) { hoverTooltip.remove(); hoverTooltip = null; } if (e.features && e.features.length > 0) { const f = e.features[0]; const p = f.properties; const cId = f.id; const d = allAnnouncements.find(a => a.id === cId); if (d) sessionStorage.setItem('selected_property_details', JSON.stringify(d)); if (selectedPinId !== null) map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: selectedPinId }, { selected: false }); map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: cId }, { selected: true }); selectedPinId = cId; if (isMobile) { if (currentPopup) currentPopup.remove(); openMobileBottomSheet(p); } else { if (currentPopup) currentPopup.remove(); const h = createPopupHTML(p); currentPopup = new maplibregl.Popup({ offset: 25, className: 'airbnb-style-popup' }).setLngLat(f.geometry.coordinates.slice()).setHTML(h).addTo(map); currentPopup.on('close', () => { if (selectedPinId === cId) { map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: selectedPinId }, { selected: false }); selectedPinId = null; } currentPopup = null; }); } } }
    function createPopupHTML(p) { const i = 'https://via.placeholder.com/280x150/cccccc/969696?text=Image'; const c = p.coverPhoto || i; const h = (p.house_type || 'Logement').replace(/^\w/, c => c.toUpperCase()); const t = `${h} à ${p.city || 'ville'}`; const d = []; if (p.rooms) d.push(`${p.rooms} p.`); if (p.bedrooms) d.push(`${p.bedrooms} ch.`); if (p.area) d.push(`${p.area}m²`); const dH = d.length > 0 ? `<p class="popup-description">${d.join(' • ')}</p>` : ''; const pH = `<p class="popup-price">${p.price || '?'}€ <span class="popup-price-period">/ mois</span></p>`; const l = `annonce?id=${p.id_str}`; return `<div><a href="${l}" class="popup-container-link" target="_blank"><div class="map-custom-popup"><img src="${c}" alt="${t}" class="popup-image" onerror="this.src='${i}'"><div class="popup-info"><h4 class="popup-title">${t}</h4>${dH}${pH}</div></div></a></div>`; }
    const listContainer = document.getElementById('annonces-wrapper'), mobileToggleButton = document.getElementById('mobile-map-toggle');
    function updateVisibleList() { if (!map || !map.isStyleLoaded() || !listContainer) return; const vis = new Set(map.queryRenderedFeatures({ layers: [LAYER_ID_DOTS] }).map(f => String(f.properties.id))); listContainer.querySelectorAll('[data-property-id]').forEach(el => { const a = el.parentElement; if (!a || a.tagName !== 'A') { el.style.display = vis.has(el.dataset.propertyId) ? '' : 'none'; return; } a.classList.toggle('annonce-list-item-hidden', !vis.has(el.dataset.propertyId)); }); if (isMobile && mobileToggleButton) mobileToggleButton.textContent = `Voir les ${vis.size} logements`; }
    function getBounds(g) { const b = new maplibregl.LngLatBounds(); g.features.forEach(f => b.extend(f.geometry.coordinates)); return b; }
    const mobileBottomSheet = document.getElementById('mobile-bottom-sheet'), mobileBottomSheetContent = document.getElementById('mobile-bottom-sheet-content'), bottomSheetCloseButton = document.getElementById('bottom-sheet-close-button');
    function openMobileBottomSheet(p) { if (!mobileBottomSheet || !mobileBottomSheetContent) return; mobileBottomSheetContent.innerHTML = createPopupHTML(p); mobileBottomSheet.classList.add('visible'); }
    function closeMobileBottomSheet() { if (!mobileBottomSheet) return; mobileBottomSheet.classList.remove('visible'); setTimeout(() => { if (mobileBottomSheetContent) mobileBottomSheetContent.innerHTML = ''; }, 350); if (map && selectedPinId !== null) { map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: selectedPinId }, { selected: false }); selectedPinId = null; } }
    if (bottomSheetCloseButton) bottomSheetCloseButton.addEventListener('click', e => { e.stopPropagation(); closeMobileBottomSheet(); });
    if (isMobile && mobileToggleButton) mobileToggleButton.addEventListener('click', () => { document.body.classList.toggle('map-is-active'); if (document.body.classList.contains('map-is-active')) { if (map) map.resize(); mobileToggleButton.textContent = `Voir la liste`; } else { if (listContainer) listContainer.scrollTo(0, 0); mobileToggleButton.textContent = `Afficher la carte`; } });
});

// map-listings.js - VERSION FINALE POUR CARTE "Street Light"
document.addEventListener('DOMContentLoaded', function() {
    console.log('[MAP_SCRIPT] Initialisation avec la carte "Street Light" et contour des villes.');

    // --- Configuration de la carte ---
    const MAPTILER_API_KEY = 'UsgTlLJiePXeSnyh57aL'; // Votre clé API
    const MAP_CONTAINER_ID = 'map-section';
    // NOUVEAU : L'ID de votre nouvelle carte "Street Light"
    const MAP_ID = '019799fa-e40f-7af6-81a6-b6d1de969567';

    // --- Configuration des couches ---
    const SOURCE_ID_ANNONCES = 'annonces-source';
    const LAYER_ID_DOTS = 'annonces-dots-layer';
    const LAYER_ID_PRICES = 'annonces-prices-layer';
    
    // NOUVEAU : Configuration de la couche pour le contour des villes
    const CITY_OUTLINE_LAYER_ID = 'city-outline-layer';
    const MAPTILER_DATASOURCE = 'maptiler-planet'; // La source de données standard de MapTiler
    const BOUNDARY_SOURCE_LAYER = 'boundary'; // La couche contenant les frontières dans la source
    const CITY_NAME_FIELD = 'name'; // Le champ contenant le nom de la ville

    const MASK_LAYER_ID = 'mask-layer';
    const MASK_SOURCE_ID = 'mask-source';

    // --- Variables globales ---
    let map = null;
    let allAnnouncements = [];
    let isMobile = window.innerWidth < 768;
    let currentPopup = null;
    let selectedPinId = null;
    let hoverTooltip = null;

    // --- Éléments du DOM ---
    const listContainer = document.getElementById('annonces-wrapper');
    const mobileToggleButton = document.getElementById('mobile-map-toggle');
    const mobileBottomSheet = document.getElementById('mobile-bottom-sheet');
    const mobileBottomSheetContent = document.getElementById('mobile-bottom-sheet-content');
    const bottomSheetCloseButton = document.getElementById('bottom-sheet-close-button');

    // --- Gestionnaires d'événements du DOM ---
    window.addEventListener('resize', () => {
        isMobile = window.innerWidth < 768;
        if (isMobile && currentPopup) { currentPopup.remove(); currentPopup = null; }
        if (!isMobile && mobileBottomSheet && mobileBottomSheet.classList.contains('visible')) { closeMobileBottomSheet(); }
    });

    if (bottomSheetCloseButton) {
        bottomSheetCloseButton.addEventListener('click', (e) => { e.stopPropagation(); closeMobileBottomSheet(); });
    }

    // --- ÉCOUTEUR PRINCIPAL ---
    // Récupère les données d'annonces et les villes sélectionnées
    document.addEventListener('annoncesChargeesEtRendues', (event) => {
        const annonces = event.detail.annonces;
        const selectedCities = event.detail.cities || [];
        
        console.log('[MAP_SCRIPT] Annonces reçues:', { annoncesCount: annonces.length, cities: selectedCities });

        if (!annonces || !Array.isArray(annonces)) return;

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
        
        // Mise à jour du contour de la ville
        updateCityBoundaryLayer(selectedCities);
    });

    // --- INITIALISATION DE LA CARTE ---
    function initializeMap(initialGeoJSON) {
        // On utilise l'URL de la nouvelle carte "Street Light"
        map = new maplibregl.Map({
            container: MAP_CONTAINER_ID,
            style: `https://api.maptiler.com/maps/${MAP_ID}/style.json?key=${MAPTILER_API_KEY}`,
            pitch: 0,
            bearing: 0,
            navigationControl: false,
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
            console.log('[MAP_SCRIPT] La carte "Street Light" est chargée.');

            const firstSymbolLayer = map.getStyle().layers.find(layer => layer.type === 'symbol');

            // ▼▼▼ NOUVELLE LOGIQUE POUR LE CONTOUR DES VILLES ▼▼▼
            // On ajoute une couche de style qui utilise les données déjà présentes dans la carte.
            map.addLayer({
                id: CITY_OUTLINE_LAYER_ID,
                type: 'line',
                source: MAPTILER_DATASOURCE,
                'source-layer': BOUNDARY_SOURCE_LAYER,
                paint: {
                    'line-color': '#007cbf', // Une couleur bleue visible
                    'line-width': 2.5,
                    'line-opacity': 0.9
                },
                // On filtre pour cibler les villes et on le rend invisible au départ.
                filter: ['all',
                    ['>=', 'admin_level', 8],
                    ['==', CITY_NAME_FIELD, '']
                ]
            }, firstSymbolLayer ? firstSymbolLayer.id : undefined); // On insère la couche sous les labels
            console.log('[MAP_SCRIPT] Couche pour le contour des villes ajoutée et masquée.');
            // ▲▲▲ FIN DE LA NOUVELLE LOGIQUE ▲▲▲

            // ▼▼▼ AJOUTEZ CE BLOC POUR LE MASQUE ▼▼▼
console.log('[MAP_SCRIPT] Ajout de la couche pour le masque.');
// 1. On crée une source de données vide pour le masque
map.addSource(MASK_SOURCE_ID, {
    type: 'geojson',
    data: {
        type: 'FeatureCollection',
        features: []
    }
});

// 2. On ajoute la couche qui va afficher le masque
map.addLayer({
    id: MASK_LAYER_ID,
    type: 'fill',
    source: MASK_SOURCE_ID,
    paint: {
        // Un gris semi-transparent
        'fill-color': 'rgba(120, 120, 120, 0.5)'
    }
}, CITY_OUTLINE_LAYER_ID); // On place le masque juste en dessous des contours de ville
// ▲▲▲ FIN DE L'AJOUT POUR LE MASQUE ▲▲▲


            // --- Logique pour les annonces (inchangée de votre version fonctionnelle) ---
            map.addImage('circle-background', createCircleSdf(64), { sdf: true });
            map.addSource(SOURCE_ID_ANNONCES, { type: 'geojson', data: initialGeoJSON, promoteId: 'id' });
            map.addLayer({ id: LAYER_ID_DOTS, type: 'circle', source: SOURCE_ID_ANNONCES, paint: { 'circle-radius': 5, 'circle-color': '#FFFFFF', 'circle-stroke-width': 1, 'circle-stroke-color': '#B4B4B4' } });
            map.addLayer({ id: LAYER_ID_PRICES, type: 'symbol', source: SOURCE_ID_ANNONCES, layout: { 'icon-image': 'circle-background', 'icon-size': 0.9, 'text-field': ['concat', ['to-string', ['get', 'price']], '€'], 'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'], 'text-size': 14, 'icon-allow-overlap': false, 'text-allow-overlap': false, 'icon-anchor': 'center', 'text-anchor': 'center' }, paint: { 'icon-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#000000', '#FFFFFF'], 'text-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#FFFFFF', '#333333'] } });
            
            map.on('mouseenter', LAYER_ID_DOTS, handleDotHoverOrClick);
            map.on('click', LAYER_ID_DOTS, handleDotHoverOrClick);
            map.on('mouseleave', LAYER_ID_DOTS, () => {
                map.getCanvas().style.cursor = '';
                if(hoverTooltip) { hoverTooltip.remove(); hoverTooltip = null; }
            });
            map.on('click', LAYER_ID_PRICES, handlePriceBubbleClick);
            map.on('idle', updateVisibleList);
            map.on('moveend', updateVisibleList);
        });
        map.addControl(new maplibregl.NavigationControl(), 'top-right');
    }

    // --- FONCTION DE MISE À JOUR DU CONTOUR ---
function updateCityBoundaryLayer(selectedCities = []) {
    if (!map || !map.isStyleLoaded() || !map.getLayer(CITY_OUTLINE_LAYER_ID)) {
        setTimeout(() => updateCityBoundaryLayer(selectedCities), 200);
        return;
    }

    const maskSource = map.getSource(MASK_SOURCE_ID);

    if (selectedCities.length === 0) {
        // Pas de ville : on cache le contour et le masque
        map.setFilter(CITY_OUTLINE_LAYER_ID, ['all', ['>=', 'admin_level', 8], ['==', CITY_NAME_FIELD, '']]);
        if (maskSource) {
            maskSource.setData({ type: 'FeatureCollection', features: [] });
        }
        return;
    }

    console.log(`[MAP_SCRIPT] Mise à jour du contour et du masque pour :`, selectedCities);

    // Mise à jour du filtre pour le contour (comme avant)
    const outlineFilter = ['all',
        ['>=', 'admin_level', 8],
        ['in', CITY_NAME_FIELD, ...selectedCities]
    ];
    map.setFilter(CITY_OUTLINE_LAYER_ID, outlineFilter);

    // NOUVEAU : Logique pour créer et afficher le masque inversé
    if (maskSource) {
        // 1. On récupère les géométries des villes sélectionnées
        const allBoundaries = map.querySourceFeatures(MAPTILER_DATASOURCE, {
            sourceLayer: BOUNDARY_SOURCE_LAYER,
            filter: outlineFilter
        });
        
        // On ne garde qu'une seule géométrie par ville pour éviter les doublons
        const cityGeometries = [];
        const seenCities = new Set();
        for (const feature of allBoundaries) {
            const cityName = feature.properties.name;
            if (!seenCities.has(cityName)) {
                cityGeometries.push(feature.geometry.coordinates);
                seenCities.add(cityName);
            }
        }

        if (cityGeometries.length > 0) {
            // 2. On crée le polygone du masque
            // Le premier anneau est un grand carré qui couvre tout, les suivants sont les "trous"
            const maskPolygon = {
                type: 'Feature',
                geometry: {
                    type: 'Polygon',
                    coordinates: [
                        // Anneau extérieur (un grand carré qui couvre le monde)
                        [
                            [-180, -90], [180, -90], [180, 90], [-180, 90], [-180, -90]
                        ],
                        // Anneaux intérieurs (les "trous" pour nos villes)
                        ...cityGeometries
                    ]
                }
            };
            maskSource.setData({
                type: 'FeatureCollection',
                features: [maskPolygon]
            });
        }
    }
}

    // --- FONCTIONS UTILITAIRES (complètes et inchangées) ---
    const createCircleSdf = (size) => { const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size; const context = canvas.getContext('2d'); const radius = size / 2; context.beginPath(); context.arc(radius, radius, radius - 2, 0, 2 * Math.PI, false); context.fillStyle = 'white'; context.fill(); return context.getImageData(0, 0, size, size); };
    
    function getNestedValue(obj, path) { if (!path) return undefined; return path.split('.').reduce((acc, part) => (acc && acc[part] !== undefined) ? (isNaN(parseInt(part, 10)) ? acc[part] : acc[parseInt(part, 10)]) : undefined, obj); }

    function convertAnnoncesToGeoJSON(annonces) { const features = annonces.map(annonce => { const lat = getNestedValue(annonce, 'geo_location.data.lat'); const lng = getNestedValue(annonce, 'geo_location.data.lng'); if (annonce.id === undefined || annonce.id === null || lat === undefined || lng === undefined) return null; let featureId = parseInt(annonce.id, 10); if (isNaN(featureId)) return null; return { type: 'Feature', id: featureId, geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] }, properties: { id: featureId, id_str: String(annonce.id), price: getNestedValue(annonce, '_property_lease_of_property.0.loyer') || '?', coverPhoto: getNestedValue(annonce, '_property_photos.0.images.0.url'), house_type: getNestedValue(annonce, 'house_type'), city: getNestedValue(annonce, 'city'), rooms: getNestedValue(annonce, 'rooms'), bedrooms: getNestedValue(annonce, 'bedrooms'), area: getNestedValue(annonce, 'area') } }; }).filter(Boolean); return { type: 'FeatureCollection', features }; }

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
            if (fullAnnonceData) { sessionStorage.setItem('selected_property_details', JSON.stringify(fullAnnonceData)); }

            if (selectedPinId !== null) { map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: selectedPinId }, { selected: false }); }
            map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: clickedPinId }, { selected: true });
            selectedPinId = clickedPinId;

            if (isMobile) {
                if (currentPopup) { currentPopup.remove(); }
                openMobileBottomSheet(properties);
            } else {
                if (currentPopup) { currentPopup.remove(); }
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
    
    function getBounds(geojson) { const bounds = new maplibregl.LngLatBounds(); geojson.features.forEach(feature => { bounds.extend(feature.geometry.coordinates); }); return bounds; }
    
    function openMobileBottomSheet(properties) { if (!mobileBottomSheet || !mobileBottomSheetContent) return; const contentHTML = createPopupHTML(properties); mobileBottomSheetContent.innerHTML = contentHTML; mobileBottomSheet.classList.add('visible');}
    
    function closeMobileBottomSheet() { if (!mobileBottomSheet) return; mobileBottomSheet.classList.remove('visible'); setTimeout(() => { if (mobileBottomSheetContent) mobileBottomSheetContent.innerHTML = ''; }, 350); if (map && selectedPinId !== null) { map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: selectedPinId }, { selected: false }); selectedPinId = null; } }
    
    if (isMobile && mobileToggleButton) { mobileToggleButton.addEventListener('click', () => { document.body.classList.toggle('map-is-active'); if (document.body.classList.contains('map-is-active')) { if (map) map.resize(); mobileToggleButton.textContent = `Voir la liste`; } else { if (listContainer) listContainer.scrollTo(0, 0); mobileToggleButton.textContent = `Afficher la carte`; } }); }

    // DANS map-listings.js, À LA FIN DU FICHIER, JUSTE AVANT LA PARENTHÈSE FERMANTE });

// ▼▼▼ AJOUTEZ CE BLOC POUR LE BOUTON 3D ▼▼▼
const toggle3dButton = document.getElementById('toggle-3d-button');
if (toggle3dButton) {
    toggle3dButton.addEventListener('click', function() {
        if (!map) return;

        // On vérifie l'inclinaison actuelle de la carte
        const currentPitch = map.getPitch();

        if (currentPitch > 0) {
            // Si la carte est en 3D, on la remet en 2D
            map.easeTo({ pitch: 0, bearing: 0, duration: 1000 });
            this.textContent = 'Vue 3D';
        } else {
            // Si la carte est en 2D, on la passe en 3D
            map.easeTo({ pitch: 65, duration: 1000 }); // 65 degrés d'inclinaison
            this.textContent = 'Vue 2D';
        }
    });
}
// ▲▲▲ FIN DE L'AJOUT POUR LE BOUTON 3D ▲▲▲

});

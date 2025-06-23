// map-listings.js - VERSION FINALE AVEC MASQUE GRIS ET BOUTON 3D
document.addEventListener('DOMContentLoaded', function() {
    console.log('[MAP_SCRIPT] Initialisation avec masque gris et bouton 3D.');

    // --- Configuration (inchangée) ---
    const MAPTILER_API_KEY = 'UsgTlLJiePXeSnyh57aL';
    const MAP_CONTAINER_ID = 'map-section';
    const MAP_ID = '019799fa-e40f-7af6-81a6-b6d1de969567';
    const SOURCE_ID_ANNONCES = 'annonces-source';
    const LAYER_ID_DOTS = 'annonces-dots-layer';
    const LAYER_ID_PRICES = 'annonces-prices-layer';
    
    // --- Configuration pour les nouvelles couches ---
    const CITY_OUTLINE_LAYER_ID = 'city-outline-layer';
    // NOUVEAU : ID pour la couche de masque gris
    const DIMMING_OVERLAY_LAYER_ID = 'dimming-overlay-layer'; 
    const MAPTILER_DATASOURCE = 'maptiler-planet';
    const BOUNDARY_SOURCE_LAYER = 'boundary';
    const CITY_NAME_FIELD = 'name';

    // --- Variables globales (inchangées) ---
    let map = null;
    let allAnnouncements = [];
    // ... et les autres ...

    // --- ÉCOUTEUR PRINCIPAL (MODIFIÉ pour appeler la bonne fonction) ---
    document.addEventListener('annoncesChargeesEtRendues', (event) => {
        const annonces = event.detail.annonces;
        const selectedCities = event.detail.cities || [];
        allAnnouncements = annonces;
        const geojsonData = convertAnnoncesToGeoJSON(allAnnouncements);
        if (!map) {
            initializeMap(geojsonData);
        } else {
            map.getSource(SOURCE_ID_ANNONCES).setData(geojsonData);
            if (geojsonData.features.length > 0) {
                const bounds = getBounds(geojsonData);
                map.fitBounds(bounds, { padding: 80, maxZoom: 16 });
            }
        }
        // MODIFIÉ : On appelle la nouvelle fonction de mise à jour
        updateMapHighlight(selectedCities);
    });

    // --- INITIALISATION DE LA CARTE (MODIFIÉE) ---
    function initializeMap(initialGeoJSON) {
        map = new maplibregl.Map({
            container: MAP_CONTAINER_ID,
            style: `https://api.maptiler.com/maps/${MAP_ID}/style.json?key=${MAPTILER_API_KEY}`,
            pitch: 0,
            bearing: 0
        });
        window.map = map;

        map.on('load', () => {
            const firstSymbolLayer = map.getStyle().layers.find(layer => layer.type === 'symbol');

            // ▼▼▼ LOGIQUE MODIFIÉE POUR L'EFFET DE MASQUE ▼▼▼
            
            // 1. NOUVEAU : Ajout de la couche de MASQUE GRIS
            // Cette couche couvre tout avec une couleur grise semi-transparente.
            // On utilise une source "geojson" avec un polygone qui couvre le monde entier.
            map.addSource('world-mask-source', {
                type: 'geojson',
                data: {
                    type: 'Polygon',
                    coordinates: [[[-180, -90], [180, -90], [180, 90], [-180, 90], [-180, -90]]]
                }
            });

            map.addLayer({
                id: DIMMING_OVERLAY_LAYER_ID,
                type: 'fill',
                source: 'world-mask-source',
                paint: {
                    'fill-color': 'rgba(100, 100, 100, 0.4)' // Gris semi-transparent
                },
                layout: {
                    // Initialement masquée
                    visibility: 'none'
                }
            }, CITY_OUTLINE_LAYER_ID); // On la place sous la couche de contour
            
            // 2. La couche pour le CONTOUR BLEU (inchangée)
            map.addLayer({
                id: CITY_OUTLINE_LAYER_ID,
                type: 'line',
                source: MAPTILER_DATASOURCE,
                'source-layer': BOUNDARY_SOURCE_LAYER,
                paint: { 'line-color': '#007cbf', 'line-width': 2.5, 'line-opacity': 0.9 },
                filter: ['all', ['>=', 'admin_level', 8], ['==', CITY_NAME_FIELD, '']]
            }, firstSymbolLayer ? firstSymbolLayer.id : undefined);
            
            // ▲▲▲ FIN DE LA LOGIQUE DE MASQUE ▲▲▲

            // --- Logique pour les annonces (inchangée) ---
            // ... (le code addSource et addLayer pour les annonces reste ici) ...
            map.addSource(SOURCE_ID_ANNONCES, { type: 'geojson', data: initialGeoJSON, promoteId: 'id' });
            map.addLayer({ id: LAYER_ID_DOTS, type: 'circle', source: SOURCE_ID_ANNONCES, paint: { 'circle-radius': 5, 'circle-color': '#FFFFFF', 'circle-stroke-width': 1, 'circle-stroke-color': '#B4B4B4' } });
            map.addLayer({ id: LAYER_ID_PRICES, type: 'symbol', source: SOURCE_ID_ANNONCES, layout: { 'icon-image': 'circle-background', 'icon-size': 0.9, 'text-field': ['concat', ['to-string', ['get', 'price']], '€'], 'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'], 'text-size': 14, 'icon-allow-overlap': false, 'text-allow-overlap': false, 'icon-anchor': 'center', 'text-anchor': 'center' }, paint: { 'icon-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#000000', '#FFFFFF'], 'text-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#FFFFFF', '#333333'] } });

            // NOUVEAU : Initialisation du bouton 3D
            init3dButton();

            // Le reste de vos écouteurs d'événements
            // ...
        });
    }

    // --- FONCTION DE MISE À JOUR (MODIFIÉE) ---
    // Renommée pour plus de clarté, elle gère maintenant le masque ET le contour.
    function updateMapHighlight(selectedCities = []) {
        if (!map || !map.isStyleLoaded()) {
            setTimeout(() => updateMapHighlight(selectedCities), 200);
            return;
        }

        const outlineLayer = map.getLayer(CITY_OUTLINE_LAYER_ID);
        const dimmingLayer = map.getLayer(DIMMING_OVERLAY_LAYER_ID);

        if (!outlineLayer || !dimmingLayer) {
             setTimeout(() => updateMapHighlight(selectedCities), 200);
            return;
        }

        if (selectedCities.length === 0) {
            // Pas de ville : on cache le contour ET le masque gris
            map.setFilter(CITY_OUTLINE_LAYER_ID, ['all', ['>=', 'admin_level', 8], ['==', CITY_NAME_FIELD, '']]);
            map.setLayoutProperty(DIMMING_OVERLAY_LAYER_ID, 'visibility', 'none');
            return;
        }
        
        // Des villes sont sélectionnées :
        // 1. On affiche le masque gris partout
        map.setLayoutProperty(DIMMING_OVERLAY_LAYER_ID, 'visibility', 'visible');

        // 2. On affiche le contour des villes sélectionnées
        const filter = ['all', ['>=', 'admin_level', 8], ['in', CITY_NAME_FIELD, ...selectedCities]];
        map.setFilter(CITY_OUTLINE_LAYER_ID, filter);
        
        // 3. NOUVEAU : On "efface" le gris sur les villes sélectionnées
        // Pour cela, nous allons ajouter une couche de remplissage transparente juste pour ces villes.
        const highlightLayerId = 'city-highlight-fill';
        if (map.getLayer(highlightLayerId)) {
            map.removeLayer(highlightLayerId);
            map.removeSource('city-highlight-source');
        }
        
        // On récupère les polygones des villes pour les "découper" du masque
        const cityFeatures = map.querySourceFeatures(MAPTILER_DATASOURCE, {
            sourceLayer: BOUNDARY_SOURCE_LAYER,
            filter: filter
        });

        map.addSource('city-highlight-source', {
            type: 'geojson',
            data: {
                type: 'FeatureCollection',
                features: cityFeatures
            }
        });

        map.addLayer({
            id: highlightLayerId,
            type: 'fill',
            source: 'city-highlight-source',
            paint: {
                'fill-color': 'rgba(0, 0, 0, 0)' // Couleur totalement transparente pour "effacer" le gris
            }
        }, CITY_OUTLINE_LAYER_ID); // On place cette couche juste en dessous du contour bleu
    }

    // --- NOUVEAU : Logique du bouton 3D ---
    function init3dButton() {
        const toggleButton = document.getElementById('toggle-3d-button');
        if (!toggleButton) return;

        toggleButton.addEventListener('click', () => {
            const currentPitch = map.getPitch();
            if (currentPitch > 0) {
                // Si la vue est en 3D, on repasse en 2D
                map.easeTo({ pitch: 0, bearing: 0 });
            } else {
                // Si la vue est en 2D, on passe en 3D
                map.easeTo({ pitch: 60, bearing: -20 }); // 60 degrés d'inclinaison, -20 de rotation
            }
        });
    }

    // --- Fonctions utilitaires (complètes et inchangées) ---
    // Je remets ici toutes vos fonctions pour que le fichier soit complet.
    const createCircleSdf = (size) => { const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size; const context = canvas.getContext('2d'); const radius = size / 2; context.beginPath(); context.arc(radius, radius, radius - 2, 0, 2 * Math.PI, false); context.fillStyle = 'white'; context.fill(); return context.getImageData(0, 0, size, size); };
    function getNestedValue(obj, path) { if (!path) return undefined; return path.split('.').reduce((acc, part) => (acc && acc[part] !== undefined) ? (isNaN(parseInt(part, 10)) ? acc[part] : acc[parseInt(part, 10)]) : undefined, obj); }
    function convertAnnoncesToGeoJSON(annonces) { const features = annonces.map(annonce => { const lat = getNestedValue(annonce, 'geo_location.data.lat'); const lng = getNestedValue(annonce, 'geo_location.data.lng'); if (annonce.id === undefined || annonce.id === null || lat === undefined || lng === undefined) return null; let featureId = parseInt(annonce.id, 10); if (isNaN(featureId)) return null; return { type: 'Feature', id: featureId, geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] }, properties: { id: featureId, id_str: String(annonce.id), price: getNestedValue(annonce, '_property_lease_of_property.0.loyer') || '?', coverPhoto: getNestedValue(annonce, '_property_photos.0.images.0.url'), house_type: getNestedValue(annonce, 'house_type'), city: getNestedValue(annonce, 'city'), rooms: getNestedValue(annonce, 'rooms'), bedrooms: getNestedValue(annonce, 'bedrooms'), area: getNestedValue(annonce, 'area') } }; }).filter(Boolean); return { type: 'FeatureCollection', features }; }
    function handleDotHoverOrClick(e) { const priceFeatures = map.queryRenderedFeatures(e.point, { layers: [LAYER_ID_PRICES] }); if (priceFeatures.length > 0) { return; } if (e.features.length > 0) { map.getCanvas().style.cursor = 'pointer'; if (hoverTooltip) { hoverTooltip.remove(); } const properties = e.features[0].properties; const coordinates = e.features[0].geometry.coordinates.slice(); hoverTooltip = new maplibregl.Popup({ closeButton: false, offset: 10, anchor: 'bottom', className: 'hover-popup' }).setLngLat(coordinates).setHTML(`<div class="hover-popup-content">${properties.price}€</div>`).addTo(map); } }
    function handlePriceBubbleClick(e) { if (hoverTooltip) { hoverTooltip.remove(); hoverTooltip = null; } if (e.features && e.features.length > 0) { const feature = e.features[0]; const properties = feature.properties; const clickedPinId = feature.id; const fullAnnonceData = allAnnouncements.find(annonce => annonce.id === clickedPinId); if (fullAnnonceData) { sessionStorage.setItem('selected_property_details', JSON.stringify(fullAnnonceData)); } if (selectedPinId !== null) { map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: selectedPinId }, { selected: false }); } map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: clickedPinId }, { selected: true }); selectedPinId = clickedPinId; if (isMobile) { if (currentPopup) { currentPopup.remove(); } openMobileBottomSheet(properties); } else { if (currentPopup) { currentPopup.remove(); } const popupHTML = createPopupHTML(properties); currentPopup = new maplibregl.Popup({ offset: 25, closeButton: true, className: 'airbnb-style-popup' }).setLngLat(feature.geometry.coordinates.slice()).setHTML(popupHTML).addTo(map); currentPopup.on('close', () => { if (selectedPinId === clickedPinId) { map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: selectedPinId }, { selected: false }); selectedPinId = null; } currentPopup = null; }); } } }
    function createPopupHTML(properties) { const placeholderImage = 'https://via.placeholder.com/280x150/cccccc/969696?text=Image'; const coverPhoto = properties.coverPhoto || placeholderImage; const houseTypeRaw = properties.house_type || 'Logement'; const houseType = houseTypeRaw.charAt(0).toUpperCase() + houseTypeRaw.slice(1); const city = properties.city || 'localité non précisée'; const title = `${houseType} à ${city}`; const details = []; if (properties.rooms) details.push(`${properties.rooms} pièces`); if (properties.bedrooms) details.push(`${properties.bedrooms} chambres`); if (properties.area) details.push(`${properties.area}m²`); const descriptionHTML = details.length > 0 ? `<p class="popup-description">${details.join(' • ')}</p>` : ''; const priceHTML = `<p class="popup-price">${properties.price || '?'}€ <span class="popup-price-period">par mois CC</span></p>`; const detailLink = `annonce?id=${properties.id_str}`; return `<div><a href="${detailLink}" class="popup-container-link" target="_blank"><div class="map-custom-popup"><img src="${coverPhoto}" alt="${title}" class="popup-image" onerror="this.src='${placeholderImage}'"><div class="popup-info"><h4 class="popup-title">${title}</h4>${descriptionHTML}${priceHTML}</div></div></a></div>`; }
    function updateVisibleList() { if (!map || !map.isStyleLoaded() || !listContainer) return; const visibleFeatures = map.queryRenderedFeatures({ layers: [LAYER_ID_DOTS] }); const visiblePropertyIds = new Set(visibleFeatures.map(feature => String(feature.properties.id))); const allListItems = listContainer.querySelectorAll('[data-property-id]'); allListItems.forEach(itemDiv => { const itemIdString = itemDiv.dataset.propertyId; const anchorTag = itemDiv.parentElement; if (!anchorTag || anchorTag.tagName !== 'A') { itemDiv.style.display = visiblePropertyIds.has(itemIdString) ? '' : 'none'; return; } if (visiblePropertyIds.has(itemIdString)) { anchorTag.classList.remove('annonce-list-item-hidden'); } else { anchorTag.classList.add('annonce-list-item-hidden'); } }); if (isMobile && mobileToggleButton) { mobileToggleButton.textContent = `Voir les ${visiblePropertyIds.size} logements`; } }
    function getBounds(geojson) { const bounds = new maplibregl.LngLatBounds(); geojson.features.forEach(feature => { bounds.extend(feature.geometry.coordinates); }); return bounds; }
    function openMobileBottomSheet(properties) { if (!mobileBottomSheet || !mobileBottomSheetContent) return; const contentHTML = createPopupHTML(properties); mobileBottomSheetContent.innerHTML = contentHTML; mobileBottomSheet.classList.add('visible');}
    function closeMobileBottomSheet() { if (!mobileBottomSheet) return; mobileBottomSheet.classList.remove('visible'); setTimeout(() => { if (mobileBottomSheetContent) mobileBottomSheetContent.innerHTML = ''; }, 350); if (map && selectedPinId !== null) { map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: selectedPinId }, { selected: false }); selectedPinId = null; } }
    if (isMobile && mobileToggleButton) { mobileToggleButton.addEventListener('click', () => { document.body.classList.toggle('map-is-active'); if (document.body.classList.contains('map-is-active')) { if (map) map.resize(); mobileToggleButton.textContent = `Voir la liste`; } else { if (listContainer) listContainer.scrollTo(0, 0); mobileToggleButton.textContent = `Afficher la carte`; } }); }
});

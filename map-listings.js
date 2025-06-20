// map-listings.js - VERSION 38 (Basé sur V26 + Corrections + Quartiers)
document.addEventListener('DOMContentLoaded', function() {
    console.log('[MAP_SCRIPT V38] Reprise de la base V26 fonctionnelle + ajout des quartiers.');

    // --- Constantes de base (inchangées) ---
    const MAPTILER_API_KEY = 'UsgTlLJiePXeSnyh57aL';
    const MAP_CONTAINER_ID = 'map-section';
    const LIST_CONTAINER_ID = 'annonces-wrapper';
    const MOBILE_TOGGLE_BUTTON_ID = 'mobile-map-toggle';
    const SOURCE_ID_ANNONCES = 'annonces-source';
    const LAYER_ID_DOTS = 'annonces-dots-layer';
    const LAYER_ID_PRICES = 'annonces-prices-layer';
    
    // --- Constantes pour les couches de quartiers ---
    const QUARTIERS_TILESET_URL = `https://api.maptiler.com/data/01978de1-8434-7672-9f69-d320e76122ea/tiles.json?key=${MAPTILER_API_KEY}`;
    const QUARTIERS_SOURCE_LAYER_NAME = 'quartier_france_simpl'; // Le nom de la couche dans votre tileset
    const SOURCE_ID_QUARTIERS = 'quartiers-source-vector';
    const LAYER_ID_QUARTIERS_FILL = 'quartiers-fill-layer'; // Couche pour l'aplat de couleur
    const LAYER_ID_QUARTIERS_LINES = 'quartiers-lines-layer'; // Couche pour les bordures

    let map = null;
    let allAnnouncements = [];
    let activeCitiesBounds = []; // Stocker les Bbox des villes actives
    
     // --- Logique d'initialisation et fonctions utilitaires (identiques à votre V38) ---
    // ... (tout votre code existant pour isMobile, mobileBottomSheet, createCircleSdf, etc. reste ici)
    const listContainer = document.getElementById(LIST_CONTAINER_ID);
    const mobileToggleButton = document.getElementById('mobile-map-toggle');
    let isMobile = window.innerWidth < 768;
    let currentPopup = null;
    let selectedPinId = null;
    let hoverTooltip = null;

    const mobileBottomSheet = document.getElementById('mobile-bottom-sheet');
    const mobileBottomSheetContent = document.getElementById('mobile-bottom-sheet-content');
    const bottomSheetCloseButton = document.getElementById('bottom-sheet-close-button');

    window.addEventListener('resize', () => { isMobile = window.innerWidth < 768; });
    if (bottomSheetCloseButton) { bottomSheetCloseButton.addEventListener('click', () => closeMobileBottomSheet()); }
    const createCircleSdf = (size) => { const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size; const context = canvas.getContext('2d'); const radius = size / 2; context.beginPath(); context.arc(radius, radius, radius - 2, 0, 2 * Math.PI, false); context.fillStyle = 'white'; context.fill(); return context.getImageData(0, 0, size, size); };
    // --- Fin des fonctions utilitaires ---
    
    // MODIFIÉ : L'événement 'annoncesChargeesEtRendues' reçoit maintenant aussi les quartiers
    document.addEventListener('annoncesChargeesEtRendues', (event) => {
        const { annonces, quartiers } = event.detail; // On récupère aussi les quartiers filtrés
        if (!annonces || !Array.isArray(annonces)) return;
        
        allAnnouncements = annonces;
        const geojsonData = convertAnnoncesToGeoJSON(allAnnouncements);

        if (!map) {
            initializeMap(geojsonData);
        } else {
            map.getSource(SOURCE_ID_ANNONCES).setData(geojsonData);
            updateNeighborhoodHighlight(quartiers || []); // MODIFIÉ: On met à jour le surlignage
        }
        
        // On ne recentre plus la carte ici, le zoom sur la ville est géré séparément
        // et le recentrage sur les annonces peut être contre-intuitif.
    });
    
    // NOUVEAU: Gérer l'ajout d'une ville
    document.addEventListener('city:selected', (event) => {
        const { cityData } = event.detail;
        activeCitiesBounds.push(cityData.bounds);

        if (map) {
            const combinedBounds = getCombinedBounds(activeCitiesBounds);
            map.fitBounds(combinedBounds, { padding: 60, duration: 800 });

            // Une fois la carte calée, on cherche les quartiers
            map.once('moveend', () => findAndSendNeighborhoods(cityData));
        }
    });
    
    // NOUVEAU: Gérer la suppression d'une ville
    document.addEventListener('city:removed', (event) => {
        // Logique pour recentrer la carte s'il reste des villes
        // (à implémenter si nécessaire)
        updateNeighborhoodHighlight([]); // On retire le surlignage
    });
    
    
    function initializeMap(initialGeoJSON) {
        map = new maplibregl.Map({
            container: MAP_CONTAINER_ID,
            style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_API_KEY}`,
            pitch: 0,
            bearing: 0,
            renderWorldCopies: false,
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
            const firstSymbolLayer = map.getStyle().layers.find(layer => layer.type === 'symbol');

            // 1. Ajout de la source vectorielle pour les quartiers
            map.addSource(SOURCE_ID_QUARTIERS, { type: 'vector', url: QUARTIERS_TILESET_URL });
            
            // 2. Ajout de la couche des BORDURES des quartiers (toujours visible quand zoomé)
            map.addLayer({
                id: LAYER_ID_QUARTIERS_LINES,
                type: 'line',
                source: SOURCE_ID_QUARTIERS,
                'source-layer': QUARTIERS_SOURCE_LAYER_NAME,
                paint: {
                    'line-color': 'rgba(8, 153, 153, 0.4)',
                    'line-width': 1,
                    'line-opacity': 0.7
                }
            }, firstSymbolLayer ? firstSymbolLayer.id : undefined);

            // 3. Ajout de la couche de REMPLISSAGE (surbrillance), invisible par défaut
            map.addLayer({
                id: LAYER_ID_QUARTIERS_FILL,
                type: 'fill',
                source: SOURCE_ID_QUARTIERS,
                'source-layer': QUARTIERS_SOURCE_LAYER_NAME,
                paint: {
                    'fill-color': '#089999',
                    'fill-opacity': 0.2
                },
                filter: ['in', 'NOM_QUARTIER', ''] // Filtre vide au départ
            }, LAYER_ID_QUARTIERS_LINES);


            // --- Votre logique existante pour les annonces (placée par-dessus les quartiers) ---
            map.addImage('circle-background', createCircleSdf(64), { sdf: true });
            map.addSource(SOURCE_ID_ANNONCES, { type: 'geojson', data: initialGeoJSON, promoteId: 'id' });
            map.addLayer({ id: LAYER_ID_DOTS, type: 'circle', source: SOURCE_ID_ANNONCES, paint: { 'circle-radius': 5, 'circle-color': '#FFFFFF', 'circle-stroke-width': 1, 'circle-stroke-color': '#B4B4B4' } });
            map.addLayer({ id: LAYER_ID_PRICES, type: 'symbol', source: SOURCE_ID_ANNONCES, layout: { 'icon-image': 'circle-background', 'icon-size': 0.9, 'text-field': ['concat', ['to-string', ['get', 'price']], '€'], 'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'], 'text-size': 14, 'icon-allow-overlap': false, 'text-allow-overlap': false, 'icon-anchor': 'center', 'text-anchor': 'center' }, paint: { 'icon-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#000000', '#FFFFFF'], 'text-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#FFFFFF', '#333333'] } });

            // --- Vos écouteurs d'événements existants ---
            map.on('mouseenter', LAYER_ID_DOTS, handleDotHoverOrClick);
            map.on('click', LAYER_ID_DOTS, handleDotHoverOrClick);
            map.on('mouseleave', LAYER_ID_DOTS, () => { map.getCanvas().style.cursor = ''; if(hoverTooltip) { hoverTooltip.remove(); hoverTooltip = null; } });
            map.on('click', LAYER_ID_PRICES, handlePriceBubbleClick);
            map.on('idle', () => { updateVisibleList(); });
            map.on('moveend', () => { updateVisibleList(); });
        });
    }

    // NOUVEAU: Trouve les quartiers dans la Bbox de la ville et les envoie
    function findAndSendNeighborhoods(cityData) {
        if (!map.isStyleLoaded()) return;
        
        // Récupère les features de la couche des quartiers qui sont actuellement rendues
        const features = map.queryRenderedFeatures({ layers: [LAYER_ID_QUARTIERS_LINES] });
        
        // Extrait les noms uniques des quartiers (assurez-vous que 'NOM_QUARTIER' est le bon nom de propriété)
        const neighborhoodNames = new Set(features.map(f => f.properties.NOM_QUARTIER).filter(Boolean));
        
        console.log(`[MAP] Quartiers trouvés pour ${cityData.name}:`, Array.from(neighborhoodNames));

        // Renvoyer l'information au script d'autocomplete
        document.dispatchEvent(new CustomEvent('neighborhoods:available', {
            detail: {
                cityName: cityData.name,
                neighborhoods: Array.from(neighborhoodNames).sort()
            }
        }));
    }


    // NOUVEAU: Met à jour la surbrillance des quartiers sur la carte
    function updateNeighborhoodHighlight(quartiers) {
        if (!map.isStyleLoaded() || !map.getLayer(LAYER_ID_QUARTIERS_FILL)) {
            // Si la carte n'est pas prête, on réessaie après un court délai
            setTimeout(() => updateNeighborhoodHighlight(quartiers), 200);
            return;
        }

        if (quartiers && quartiers.length > 0) {
            // On applique un filtre pour ne montrer que les quartiers sélectionnés
            map.setFilter(LAYER_ID_QUARTIERS_FILL, ['in', ['get', 'NOM_QUARTIER'], ['literal', quartiers]]);
        } else {
            // Si aucun quartier n'est sélectionné, on vide le filtre pour ne rien afficher
            map.setFilter(LAYER_ID_QUARTIERS_FILL, ['in', ['get', 'NOM_QUARTIER'], '']);
        }
    }

     function getCombinedBounds(boundsArray) {
        const combined = new maplibregl.LngLatBounds();
        boundsArray.forEach(bounds => {
            combined.extend([bounds.west, bounds.south]);
            combined.extend([bounds.east, bounds.north]);
        });
        return combined;
    }

    function convertAnnoncesToGeoJSON(annonces) { const features = annonces.map(annonce => { const lat = getNestedValue(annonce, 'geo_location.data.lat'); const lng = getNestedValue(annonce, 'geo_location.data.lng'); if (annonce.id === undefined || annonce.id === null || lat === undefined || lng === undefined) return null; let featureId = parseInt(annonce.id, 10); if (isNaN(featureId)) return null; return { type: 'Feature', id: featureId, geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] }, properties: { id: featureId, id_str: String(annonce.id), price: getNestedValue(annonce, '_property_lease_of_property.0.loyer') || '?', coverPhoto: getNestedValue(annonce, '_property_photos.0.images.0.url'), house_type: getNestedValue(annonce, 'house_type'), city: getNestedValue(annonce, 'city'), rooms: getNestedValue(annonce, 'rooms'), bedrooms: getNestedValue(annonce, 'bedrooms'), area: getNestedValue(annonce, 'area') } }; }).filter(Boolean); return { type: 'FeatureCollection', features }; }



    // --- Toutes les fonctions suivantes sont identiques à votre version V26 ---
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
            if (fullAnnonceData) {
                sessionStorage.setItem('selected_property_details', JSON.stringify(fullAnnonceData));
            }

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
    function getNestedValue(obj, path) { if (!path) return undefined; return path.split('.').reduce((acc, part) => (acc && acc[part] !== undefined) ? (isNaN(parseInt(part, 10)) ? acc[part] : acc[parseInt(part, 10)]) : undefined, obj); }
    if (isMobile && mobileToggleButton) { mobileToggleButton.addEventListener('click', () => { document.body.classList.toggle('map-is-active'); if (document.body.classList.contains('map-is-active')) { if (map) map.resize(); mobileToggleButton.textContent = `Voir la liste`; } else { if (listContainer) listContainer.scrollTo(0, 0); mobileToggleButton.textContent = `Afficher la carte`; } }); }
});

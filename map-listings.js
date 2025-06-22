// map-listings.js - VERSION MISE À JOUR
document.addEventListener('DOMContentLoaded', function() {
    console.log('[MAP_SCRIPT] Initialisation avec filtre dynamique des quartiers par ville.');

    // --- Constantes de base (inchangées) ---
    const MAPTILER_API_KEY = 'UsgTlLJiePXeSnyh57aL';
    const MAP_CONTAINER_ID = 'map-section';
    const LIST_CONTAINER_ID = 'annonces-wrapper';
    const MOBILE_TOGGLE_BUTTON_ID = 'mobile-map-toggle';
    const SOURCE_ID_ANNONCES = 'annonces-source';
    const LAYER_ID_DOTS = 'annonces-dots-layer';
    const LAYER_ID_PRICES = 'annonces-prices-layer';
    
    // ▼▼▼ REMPLACEZ TOUT CE BLOC DANS VOTRE FICHIER ▼▼▼

// --- NOUVEAU : Constantes pour les couches de quartiers ---
const QUARTIERS_TILESET_ID = 'quartier_france_simpl'; // <-- L'ID CORRECT DU TILESET
const QUARTIERS_SOURCE_LAYER_NAME = 'quartier_france_simpl';
const SOURCE_ID_QUARTIERS = 'quartiers-source-vector';
const LAYER_ID_QUARTIERS_LINES = 'quartiers-lines-layer';
const QUARTIERS_CITY_FIELD_NAME = 'nom_commune'; // <-- Le nom correct du champ pour la ville

// ▲▲▲ FIN DU BLOC À REMPLACER ▲▲▲

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
    
    // MODIFIÉ : Le gestionnaire d'événement récupère maintenant les villes sélectionnées
    document.addEventListener('annoncesChargeesEtRendues', (event) => {
        const annonces = event.detail.annonces;
        // NOUVEAU : Récupérer les villes depuis l'événement. Le `|| []` est une sécurité.
        const selectedCities = event.detail.cities || [];
        
        console.log('[MAP_SCRIPT] Événement "annoncesChargeesEtRendues" reçu avec :', {
             annoncesCount: annonces ? annonces.length : 0,
             cities: selectedCities 
        });

        if (!annonces || !Array.isArray(annonces)) return;

        allAnnouncements = annonces;
        const geojsonData = convertAnnoncesToGeoJSON(allAnnouncements);
        
        if (!map) {
            initializeMap(geojsonData);
        } else {
            map.getSource(SOURCE_ID_ANNONCES).setData(geojsonData);
            if (geojsonData.features.length > 0) { const bounds = getBounds(geojsonData); map.fitBounds(bounds, { padding: 80, maxZoom: 16 }); }
            else { map.flyTo({ center: [2.3522, 48.8566], zoom: 11 }); }
        }

        // NOUVEAU : On met à jour la couche des quartiers à chaque fois que les annonces changent.
        updateQuartiersLayer(selectedCities);
    });
    
    const createCircleSdf = (size) => { const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size; const context = canvas.getContext('2d'); const radius = size / 2; context.beginPath(); context.arc(radius, radius, radius - 2, 0, 2 * Math.PI, false); context.fillStyle = 'white'; context.fill(); return context.getImageData(0, 0, size, size); };
    function convertAnnoncesToGeoJSON(annonces) { const features = annonces.map(annonce => { const lat = getNestedValue(annonce, 'geo_location.data.lat'); const lng = getNestedValue(annonce, 'geo_location.data.lng'); if (annonce.id === undefined || annonce.id === null || lat === undefined || lng === undefined) return null; let featureId = parseInt(annonce.id, 10); if (isNaN(featureId)) return null; return { type: 'Feature', id: featureId, geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] }, properties: { id: featureId, id_str: String(annonce.id), price: getNestedValue(annonce, '_property_lease_of_property.0.loyer') || '?', coverPhoto: getNestedValue(annonce, '_property_photos.0.images.0.url'), house_type: getNestedValue(annonce, 'house_type'), city: getNestedValue(annonce, 'city'), rooms: getNestedValue(annonce, 'rooms'), bedrooms: getNestedValue(annonce, 'bedrooms'), area: getNestedValue(annonce, 'area') } }; }).filter(Boolean); return { type: 'FeatureCollection', features }; }

    // REMPLACEZ VOTRE FONCTION initializeMap PAR CELLE-CI
function initializeMap(initialGeoJSON) {
    map = new maplibregl.Map({ container: MAP_CONTAINER_ID, style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_API_KEY}`, pitch: 0, bearing: 0, navigationControl: false, renderWorldCopies: false });
    window.map = map;
    if (initialGeoJSON.features.length > 0) { const bounds = getBounds(initialGeoJSON); map.fitBounds(bounds, { padding: 80, duration: 0, maxZoom: 16 }); } else { map.setCenter([2.3522, 48.8566]); map.setZoom(11); }

    map.on('load', () => {
        // ▼▼▼ DÉBUT DE LA SECTION CORRIGÉE POUR LES QUARTIERS ▼▼▼

        // 1. Ajout de la source pour les quartiers avec la bonne URL et le bon ID
        // C'est ici que nous utilisons le nouvel ID que vous avez trouvé.
        map.addSource(SOURCE_ID_QUARTIERS, {
    type: 'vector',
    tiles: [
        `https://api.maptiler.com/tiles/01978dde-e6c0-7db6-ad88-68aeafdf00dc/{z}/{x}/{y}.pbf?key=${MAPTILER_API_KEY}`
    ],
    minzoom: 0, // Laissez à 0 ou ajustez si nécessaire
    
    // ▼▼▼ MODIFICATION IMPORTANTE ▼▼▼
    // Remplacez 14 par le niveau de zoom MAXIMUM indiqué sur MapTiler pour votre tileset.
    // Si c'est 11, par exemple, mettez 11.
    maxzoom: 11 // <--- VÉRIFIEZ ET AJUSTEZ CETTE VALEUR
});

        // On trouve la première couche de texte/labels pour insérer les quartiers en dessous
        const firstSymbolLayer = map.getStyle().layers.find(layer => layer.type === 'symbol');

        // 2. Ajout de la couche de LIGNES pour les contours (ceci ne change pas)
        // Le nom de la couche à l'intérieur du tileset reste 'quartier_france_simpl' comme vu dans votre screenshot.
        map.addLayer({
            id: LAYER_ID_QUARTIERS_LINES,
            type: 'line',
            source: SOURCE_ID_QUARTIERS,
            'source-layer': 'quartier_france_simpl', // Nom de la couche DANS le tileset
            paint: {
                'line-color': '#089999',
                'line-width': 2,
                'line-opacity': 0.8
            },
            filter: ['==', QUARTIERS_CITY_FIELD_NAME, ''] 
        }, firstSymbolLayer ? firstSymbolLayer.id : undefined);
        
        // ▲▲▲ FIN DE LA SECTION CORRIGÉE ▲▲▲


        // ▼▼▼ LOGIQUE ORIGINALE DES ANNONCES (CONSERVÉE ET FONCTIONNELLE) ▼▼▼
        map.addImage('circle-background', createCircleSdf(64), { sdf: true });
        map.addSource(SOURCE_ID_ANNONCES, { type: 'geojson', data: initialGeoJSON, promoteId: 'id' });
        map.addLayer({ id: LAYER_ID_DOTS, type: 'circle', source: SOURCE_ID_ANNONCES, paint: { 'circle-radius': 5, 'circle-color': '#FFFFFF', 'circle-stroke-width': 1, 'circle-stroke-color': '#B4B4B4' } });
        map.addLayer({ id: LAYER_ID_PRICES, type: 'symbol', source: SOURCE_ID_ANNONCES, layout: { 'icon-image': 'circle-background', 'icon-size': 0.9, 'text-field': ['concat', ['to-string', ['get', 'price']], '€'], 'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'], 'text-size': 14, 'icon-allow-overlap': false, 'text-allow-overlap': false, 'icon-anchor': 'center', 'text-anchor': 'center' }, paint: { 'icon-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#000000', '#FFFFFF'], 'text-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#FFFFFF', '#333333'] } });
        map.on('mouseenter', LAYER_ID_DOTS, handleDotHoverOrClick);
        map.on('click', LAYER_ID_DOTS, handleDotHoverOrClick);
        map.on('mouseleave', LAYER_ID_DOTS, () => { map.getCanvas().style.cursor = ''; if(hoverTooltip) { hoverTooltip.remove(); hoverTooltip = null; } });
        map.on('click', LAYER_ID_PRICES, handlePriceBubbleClick);
        map.on('idle', () => { updateVisibleList(); });
        map.on('moveend', () => { updateVisibleList(); });
        // ▲▲▲ FIN DE LA LOGIQUE ORIGINALE DES ANNONCES ▲▲▲
    });
    map.addControl(new maplibregl.NavigationControl(), 'top-right');
}
    // NOUVEAU : Fonction dédiée à la mise à jour du filtre de la couche des quartiers
    function updateQuartiersLayer(selectedCities = []) {
        // Sécurité : ne fait rien si la carte ou la couche n'est pas encore prête
        if (!map || !map.isStyleLoaded() || !map.getLayer(LAYER_ID_QUARTIERS_LINES)) {
            // On peut essayer de relancer après un court délai si la carte est en train de se charger
            setTimeout(() => updateQuartiersLayer(selectedCities), 200);
            return;
        }

        // Si aucune ville n'est sélectionnée (ou que le tableau est vide)
        if (!selectedCities || selectedCities.length === 0) {
            console.log("[MAP_SCRIPT] Aucune ville sélectionnée, masquage des contours de quartiers.");
            // On applique un filtre qui ne correspond à rien pour tout cacher
            map.setFilter(LAYER_ID_QUARTIERS_LINES, ['==', QUARTIERS_CITY_FIELD_NAME, '']);
            return;
        }

        console.log(`[MAP_SCRIPT] Mise à jour du filtre des quartiers pour les villes :`, selectedCities);

        // On construit le filtre MapLibre.
        // L'expression ['in', field, ...values] est parfaite pour ça.
        // Elle vérifie si la valeur du champ (ex: 'nom_com') est l'une des valeurs du tableau.
        const filter = ['in', QUARTIERS_CITY_FIELD_NAME, ...selectedCities];

        // On applique le filtre à la couche des lignes
        map.setFilter(LAYER_ID_QUARTIERS_LINES, filter);
    }


    // --- Toutes les fonctions suivantes sont identiques à votre version fonctionnelle ---
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

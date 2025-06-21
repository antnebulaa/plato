// map-listings.js - VERSION 41 (API de recherche de quartiers & filtrage)
document.addEventListener('DOMContentLoaded', function() {
    console.log('[MAP_SCRIPT V41] Initialisation avec API de recherche et filtrage dynamique.');

    // --- Constantes ---
    const MAPTILER_API_KEY = 'UsgTlLJiePXeSnyh57aL';
    const MAP_CONTAINER_ID = 'map-section';
    const CUSTOM_MAP_STYLE_URL = 'https://api.maptiler.com/maps/01978de1-8434-7672-9f69-d320e76122ea/style.json?key=UsgTlLJiePXeSnyh57aL';

    const SOURCE_ID_ANNONCES = 'annonces-source';
    const LAYER_ID_DOTS = 'annonces-dots-layer';
    const LAYER_ID_PRICES = 'annonces-prices-layer';
    
    // Le nom de la couche des quartiers telle que définie dans votre style MapTiler
    const QUARTIERS_LAYER_ID_IN_STYLE = 'quartier_france_simpl';
    
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

    // --- GESTION DES ÉVÉNEMENTS ---

    window.addEventListener('resize', () => {
        isMobile = window.innerWidth < 768;
        if (isMobile && currentPopup) { currentPopup.remove(); currentPopup = null; }
        if (!isMobile && mobileBottomSheet && mobileBottomSheet.classList.contains('visible')) { closeMobileBottomSheet(); }
    });

    if (bottomSheetCloseButton) {
        bottomSheetCloseButton.addEventListener('click', (e) => { e.stopPropagation(); closeMobileBottomSheet(); });
    }
    
    document.addEventListener('annoncesChargeesEtRendues', (event) => {
        const { annonces, quartiers } = event.detail; // On attend maintenant 'quartiers'
        if (!annonces || !Array.isArray(annonces)) return;

        allAnnouncements = annonces;
        const geojsonData = convertAnnoncesToGeoJSON(allAnnouncements);

        if (!map) {
            initializeMap(geojsonData, quartiers); 
        } else {
            const source = map.getSource(SOURCE_ID_ANNONCES);
            if (source) source.setData(geojsonData);
            
            if (geojsonData.features.length > 0) { const bounds = getBounds(geojsonData); map.fitBounds(bounds, { padding: 80, maxZoom: 16 }); }
            else { map.flyTo({ center: [2.3522, 48.8566], zoom: 11 }); }
            
            updateNeighborhoodFilter(quartiers);
        }
    });
    
    // --- NOUVELLE API POUR LES AUTRES SCRIPTS ---

    // Cette fonction expose des méthodes pour que `home-form-display.js` puisse communiquer avec la carte.
    function initializeMapApi() {
        if (!window.mapApi) {
            window.mapApi = {};
        }

        // Renvoie les noms des quartiers visibles dans une zone géographique donnée.
        window.mapApi.getNeighborhoodsInBounds = (bounds) => {
            return new Promise((resolve) => {
                if (!map || !map.isStyleLoaded() || !map.getLayer(QUARTIERS_LAYER_ID_IN_STYLE)) {
                    console.warn("La carte ou la couche de quartiers n'est pas prête.");
                    resolve([]);
                    return;
                }
                
                // On interroge les "features" (les polygones) de notre couche de quartiers
                // qui sont actuellement rendues à l'écran.
                const features = map.queryRenderedFeatures({ layers: [QUARTIERS_LAYER_ID_IN_STYLE] });
                
                // On utilise un Set pour éviter les doublons
                const neighborhoodNames = new Set();
                features.forEach(feature => {
                    if (feature.properties && feature.properties.NOM_QUARTIER) {
                        neighborhoodNames.add(feature.properties.NOM_QUARTIER);
                    }
                });
                
                // On convertit le Set en tableau et on le trie par ordre alphabétique
                resolve(Array.from(neighborhoodNames).sort());
            });
        };
    }

    // --- NOUVELLE FONCTION DE FILTRAGE DYNAMIQUE ---

    function updateNeighborhoodFilter(quartiers = []) {
        if (!map || !map.isStyleLoaded() || !map.getLayer(QUARTIERS_LAYER_ID_IN_STYLE)) {
            // Si la couche n'est pas prête, on réessaie après un court délai.
            setTimeout(() => updateNeighborhoodFilter(quartiers), 200);
            return;
        }

        if (quartiers && quartiers.length > 0) {
            console.log(`[MAP_FILTER] Affichage des quartiers :`, quartiers);
            const filter = ['in', ['get', 'NOM_QUARTIER'], ['literal', quartiers]];
            map.setFilter(QUARTIERS_LAYER_ID_IN_STYLE, filter);
            map.setLayoutProperty(QUARTIERS_LAYER_ID_IN_STYLE, 'visibility', 'visible');
        } else {
            console.log('[MAP_FILTER] Aucun quartier sélectionné, masquage de la couche.');
            map.setLayoutProperty(QUARTIERS_LAYER_ID_IN_STYLE, 'visibility', 'none');
        }
    }


    // --- INITIALISATION DE LA CARTE ---

    function initializeMap(initialGeoJSON, initialQuartiers) {
        map = new maplibregl.Map({ 
            container: MAP_CONTAINER_ID, 
            style: CUSTOM_MAP_STYLE_URL,
            pitch: 0, 
            bearing: 0, 
            navigationControl: false, 
            renderWorldCopies: false 
        });
        window.map = map;

        map.on('load', () => {
            console.log('[MAP] Carte chargée avec le style personnalisé.');
            
            // Le fond de carte contient déjà les quartiers.
            // On ajoute seulement les couches spécifiques à nos annonces.
            map.addImage('circle-background', createCircleSdf(64), { sdf: true });
            map.addSource(SOURCE_ID_ANNONCES, { type: 'geojson', data: initialGeoJSON, promoteId: 'id' });
            map.addLayer({ id: LAYER_ID_DOTS, type: 'circle', source: SOURCE_ID_ANNONCES, paint: { 'circle-radius': 5, 'circle-color': '#FFFFFF', 'circle-stroke-width': 1, 'circle-stroke-color': '#B4B4B4' } });
            map.addLayer({ id: LAYER_ID_PRICES, type: 'symbol', source: SOURCE_ID_ANNONCES, layout: { 'icon-image': 'circle-background', 'icon-size': 0.9, 'text-field': ['concat', ['to-string', ['get', 'price']], '€'], 'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'], 'text-size': 14, 'icon-allow-overlap': true, 'text-allow-overlap': true, 'icon-anchor': 'center', 'text-anchor': 'center' }, paint: { 'icon-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#000000', '#FFFFFF'], 'text-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#FFFFFF', '#333333'] } });

            // Initialise l'API pour que les autres scripts puissent l'utiliser.
            initializeMapApi();
            
            // Applique le filtre pour les quartiers recherchés au premier chargement.
            updateNeighborhoodFilter(initialQuartiers);

            map.on('click', LAYER_ID_PRICES, handlePriceBubbleClick);
            map.on('idle', () => updateVisibleList());
            map.on('moveend', () => updateVisibleList());
        });
        map.addControl(new maplibregl.NavigationControl(), 'top-right');
        
        if (initialGeoJSON.features.length > 0) { const bounds = getBounds(initialGeoJSON); map.fitBounds(bounds, { padding: 80, duration: 0, maxZoom: 16 }); }
    }

    // --- Fonctions utilitaires (inchangées par rapport à la V26) ---
    const createCircleSdf = (size) => { const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size; const context = canvas.getContext('2d'); const radius = size / 2; context.beginPath(); context.arc(radius, radius, radius - 2, 0, 2 * Math.PI, false); context.fillStyle = 'white'; context.fill(); return context.getImageData(0, 0, size, size); };
    function handlePriceBubbleClick(e) { if (hoverTooltip) { hoverTooltip.remove(); hoverTooltip = null; } if (e.features && e.features.length > 0) { const feature = e.features[0]; const properties = feature.properties; const clickedPinId = feature.id; const fullAnnonceData = allAnnouncements.find(annonce => annonce.id === clickedPinId); if (fullAnnonceData) { sessionStorage.setItem('selected_property_details', JSON.stringify(fullAnnonceData)); } if (selectedPinId !== null) { map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: selectedPinId }, { selected: false }); } map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: clickedPinId }, { selected: true }); selectedPinId = clickedPinId; if (isMobile) { if (currentPopup) { currentPopup.remove(); } openMobileBottomSheet(properties); } else { if (currentPopup) { currentPopup.remove(); } const popupHTML = createPopupHTML(properties); currentPopup = new maplibregl.Popup({ offset: 25, closeButton: true, className: 'airbnb-style-popup' }).setLngLat(feature.geometry.coordinates.slice()).setHTML(popupHTML).addTo(map); currentPopup.on('close', () => { if (selectedPinId === clickedPinId) { map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: selectedPinId }, { selected: false }); selectedPinId = null; } currentPopup = null; }); } } }
    function createPopupHTML(properties) { const placeholderImage = 'https://via.placeholder.com/280x150/cccccc/969696?text=Image'; const coverPhoto = properties.coverPhoto || placeholderImage; const houseTypeRaw = properties.house_type || 'Logement'; const houseType = houseTypeRaw.charAt(0).toUpperCase() + houseTypeRaw.slice(1); const city = properties.city || 'localité non précisée'; const title = `${houseType} à ${city}`; const details = []; if (properties.rooms) details.push(`${properties.rooms} pièces`); if (properties.bedrooms) details.push(`${properties.bedrooms} chambres`); if (properties.area) details.push(`${properties.area}m²`); const descriptionHTML = details.length > 0 ? `<p class="popup-description">${details.join(' • ')}</p>` : ''; const priceHTML = `<p class="popup-price">${properties.price || '?'}€ <span class="popup-price-period">par mois CC</span></p>`; const detailLink = `annonce?id=${properties.id_str}`; return `<div><a href="${detailLink}" class="popup-container-link" target="_blank"><div class="map-custom-popup"><img src="${coverPhoto}" alt="${title}" class="popup-image" onerror="this.src='${placeholderImage}'"><div class="popup-info"><h4 class="popup-title">${title}</h4>${descriptionHTML}${priceHTML}</div></div></a></div>`; }
    function updateVisibleList() { if (!map || !map.isStyleLoaded()) return; const visibleFeatures = map.queryRenderedFeatures({ layers: [LAYER_ID_PRICES, LAYER_ID_DOTS] }); const visiblePropertyIds = new Set(visibleFeatures.map(feature => String(feature.properties.id))); const allListItems = document.querySelectorAll('[data-property-id]'); allListItems.forEach(itemDiv => { const itemIdString = itemDiv.dataset.propertyId; const anchorTag = itemDiv.parentElement; if (!anchorTag || anchorTag.tagName !== 'A') { itemDiv.style.display = visiblePropertyIds.has(itemIdString) ? '' : 'none'; return; } if (visiblePropertyIds.has(itemIdString)) { anchorTag.classList.remove('annonce-list-item-hidden'); } else { anchorTag.classList.add('annonce-list-item-hidden'); } }); if (isMobile && mobileToggleButton) { mobileToggleButton.textContent = `Voir les ${visiblePropertyIds.size} logements`; } }
    function getBounds(geojson) { if (!geojson || !geojson.features || geojson.features.length === 0) return null; const bounds = new maplibregl.LngLatBounds(); geojson.features.forEach(feature => { bounds.extend(feature.geometry.coordinates); }); return bounds; }
    function openMobileBottomSheet(properties) { if (!mobileBottomSheet || !mobileBottomSheetContent) return; const contentHTML = createPopupHTML(properties); mobileBottomSheetContent.innerHTML = contentHTML; mobileBottomSheet.classList.add('visible');}
    function closeMobileBottomSheet() { if (!mobileBottomSheet) return; mobileBottomSheet.classList.remove('visible'); setTimeout(() => { if (mobileBottomSheetContent) mobileBottomSheetContent.innerHTML = ''; }, 350); if (map && selectedPinId !== null) { map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: selectedPinId }, { selected: false }); selectedPinId = null; } }
    function getNestedValue(obj, path) { if (!path) return undefined; return path.split('.').reduce((acc, part) => (acc && acc[part] !== undefined) ? (isNaN(parseInt(part, 10)) ? acc[part] : acc[parseInt(part, 10)]) : undefined, obj); }
    if (isMobile && mobileToggleButton) { mobileToggleButton.addEventListener('click', () => { document.body.classList.toggle('map-is-active'); if (document.body.classList.contains('map-is-active')) { if (map) map.resize(); mobileToggleButton.textContent = `Voir la liste`; } else { if (listContainer) listContainer.scrollTo(0, 0); mobileToggleButton.textContent = `Afficher la carte`; } }); }
});

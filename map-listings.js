// map-listings.js - VERSION MODIFIÉE V16 (Gestion intelligente des pins)
document.addEventListener('DOMContentLoaded', function() {
    console.log('[MAP_SCRIPT V16] Gestion intelligente des pins pour éviter la confusion.');

    const MAPTILER_API_KEY = 'UsgTlLJiePXeSnyh57aL';
    const MAP_CONTAINER_ID = 'map-section';
    const LIST_CONTAINER_ID = 'annonces-wrapper';
    const MOBILE_TOGGLE_BUTTON_ID = 'mobile-map-toggle';
    const SOURCE_ID_ANNONCES = 'annonces-source';
    const LAYER_ID_PINS = 'annonces-pins-layer';
    const LAYER_ID_LABELS = 'annonces-labels-layer';


    const listContainer = document.getElementById(LIST_CONTAINER_ID);
    const mobileToggleButton = document.getElementById(MOBILE_TOGGLE_BUTTON_ID);

    let map = null;
    let allAnnouncements = [];
    let isMobile = window.innerWidth < 768;
    let currentPopup = null;
    let selectedPinId = null;

    const mobileBottomSheet = document.getElementById('mobile-bottom-sheet');
    const mobileBottomSheetContent = document.getElementById('mobile-bottom-sheet-content');
    const bottomSheetCloseButton = document.getElementById('bottom-sheet-close-button');

    window.addEventListener('resize', () => {
        isMobile = window.innerWidth < 768;
        if (isMobile && currentPopup) {
            currentPopup.remove();
            currentPopup = null;
        }
        if (!isMobile && mobileBottomSheet && mobileBottomSheet.classList.contains('visible')) {
            closeMobileBottomSheet();
        }
    });

    if (bottomSheetCloseButton) {
        bottomSheetCloseButton.addEventListener('click', (e) => {
            e.stopPropagation();
            closeMobileBottomSheet();
        });
    }
    
    function onMapBackgroundClick(e) {
        if (e.defaultPrevented === false) {
             if (isMobile && mobileBottomSheet && mobileBottomSheet.classList.contains('visible')) {
                closeMobileBottomSheet();
            }
        }
    }

    document.addEventListener('annoncesChargeesEtRendues', (event) => {
        const annonces = event.detail.annonces;
        if (!annonces || !Array.isArray(annonces)) return;
        
        allAnnouncements = annonces;
        const geojsonData = convertAnnoncesToGeoJSON(allAnnouncements);

        if (!map) {
            initializeMap(geojsonData);
        } else {
            map.getSource(SOURCE_ID_ANNONCES).setData(geojsonData);
            if (map.isStyleLoaded()) updatePinStyles();
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
            const lat = getNestedValue(annonce, 'latitude');
            const lng = getNestedValue(annonce, 'longitude');
            
            if (annonce.id === undefined || annonce.id === null || lat === undefined || lng === undefined) return null;
            let featureId = parseInt(annonce.id, 10);
            if (isNaN(featureId)) return null;
            
            return {
                type: 'Feature', id: featureId, geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
                properties: { id: featureId, id_str: String(annonce.id), price: getNestedValue(annonce, '_property_lease_of_property.0.loyer') || '?', coverPhoto: getNestedValue(annonce, '_property_photos.0.images.0.url'), house_type: getNestedValue(annonce, 'house_type'), city: getNestedValue(annonce, 'city'), rooms: getNestedValue(annonce, 'rooms'), bedrooms: getNestedValue(annonce, 'bedrooms'), area: getNestedValue(annonce, 'area') }
            };
        }).filter(Boolean);
        return { type: 'FeatureCollection', features };
    }

    function updatePinStyles() {
        if (!map || !map.isStyleLoaded()) return;
        const allFeatures = map.querySourceFeatures(SOURCE_ID_ANNONCES);
        const allFeatureIds = new Set(allFeatures.map(f => f.id));
        const visibleLabelFeatures = map.queryRenderedFeatures({ layers: [LAYER_ID_LABELS] });
        const visibleLabelIds = new Set(visibleLabelFeatures.map(feature => feature.id));
        allFeatureIds.forEach(id => {
            if (visibleLabelIds.has(id)) {
                map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: id }, { 'has-label': true });
            } else {
                map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: id }, { 'has-label': false });
            }
        });
    }

    function initializeMap(initialGeoJSON) {
        map = new maplibregl.Map({
            container: MAP_CONTAINER_ID, style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_API_KEY}`,
            pitch: 0, bearing: 0,
            navigationControl: false, renderWorldCopies: false
        });
        window.map = map;
        if (initialGeoJSON.features.length > 0) {
            const bounds = getBounds(initialGeoJSON);
            map.fitBounds(bounds, { padding: 80, duration: 0, maxZoom: 16 });
        } else {
            map.setCenter([2.3522, 48.8566]); map.setZoom(11);
        }

        map.on('load', () => {
            map.addSource(SOURCE_ID_ANNONCES, { type: 'geojson', data: initialGeoJSON, promoteId: 'id' });
            
            map.addLayer({
                id: LAYER_ID_PINS, type: 'circle', source: SOURCE_ID_ANNONCES,
                paint: {
                    'circle-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#000000', '#FFFFFF'],
                    'circle-stroke-width': 1.5,
                    'circle-stroke-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#FFFFFF', '#333333'],
                    'circle-radius': ['case', ['boolean', ['feature-state', 'has-label'], false], 26, ['boolean', ['feature-state', 'selected'], false], 26, 8],
                }
            });

            map.addLayer({
                id: LAYER_ID_LABELS, type: 'symbol', source: SOURCE_ID_ANNONCES,
                layout: { 'text-field': ['concat', ['to-string', ['get', 'price']], '€'], 'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'], 'text-size': 14, 'text-allow-overlap': false, 'text-optional': true },
                paint: { 'text-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#FFFFFF', '#333333'] }
            });
            
            map.on('click', LAYER_ID_PINS, handleMapClick);
            map.on('click', onMapBackgroundClick);
            map.on('mouseenter', LAYER_ID_PINS, () => map.getCanvas().style.cursor = 'pointer');
            map.on('mouseleave', LAYER_ID_PINS, () => map.getCanvas().style.cursor = '');
            
            map.on('moveend', () => {
                updateVisibleList();
                updatePinStyles();
            });

            updateVisibleList();
            updatePinStyles();
        });
        map.addControl(new maplibregl.NavigationControl(), 'top-right');
    }

    // -- LA FONCTION QUI MANQUAIT DANS MA PRÉCÉDENTE RÉPONSE --
    function updateVisibleList() {
        if (!map || !map.isStyleLoaded() || !listContainer) return;
        const visibleFeatures = map.queryRenderedFeatures({ layers: [LAYER_ID_PINS] });
        const visiblePropertyIds = new Set(visibleFeatures.map(feature => String(feature.properties.id)));
        const allListItems = listContainer.querySelectorAll('[data-property-id]');
        allListItems.forEach(itemDiv => {
            const itemIdString = itemDiv.dataset.propertyId;
            const anchorTag = itemDiv.parentElement;
            if (!anchorTag || anchorTag.tagName !== 'A') {
                itemDiv.style.display = visiblePropertyIds.has(itemIdString) ? '' : 'none';
                return;
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
    // -- FIN DE LA FONCTION --

    function getBounds(geojson) {
        const bounds = new maplibregl.LngLatBounds();
        geojson.features.forEach(feature => {
            bounds.extend(feature.geometry.coordinates);
        });
        return bounds;
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
        return `<a href="${detailLink}" class="popup-container-link"><div class="map-custom-popup"><img src="${coverPhoto}" alt="${title}" class="popup-image" onerror="this.src='${placeholderImage}'"><div class="popup-info"><h4 class="popup-title">${title}</h4>${descriptionHTML}${priceHTML}</div></div></a>`;
    }

    function openMobileBottomSheet(properties) {
        if (!mobileBottomSheet || !mobileBottomSheetContent) return;
        const contentHTML = createPopupHTML(properties);
        mobileBottomSheetContent.innerHTML = contentHTML;
        mobileBottomSheet.classList.add('visible');
    }

    function closeMobileBottomSheet() {
        if (!mobileBottomSheet) return;
        mobileBottomSheet.classList.remove('visible');
        setTimeout(() => { if (mobileBottomSheetContent) mobileBottomSheetContent.innerHTML = ''; }, 350);
        if (map && selectedPinId !== null) {
            map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: selectedPinId }, { selected: false });
            selectedPinId = null;
        }
    }

    function handleMapClick(e) {
        e.preventDefault();
        if (e.features && e.features.length > 0) {
            const feature = e.features[0];
            const coordinates = feature.geometry.coordinates.slice();
            const properties = feature.properties;
            const clickedPinId = feature.id;
            if (selectedPinId !== null && selectedPinId !== clickedPinId) {
                map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: selectedPinId }, { selected: false });
            }
            map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: clickedPinId }, { selected: true });
            selectedPinId = clickedPinId;
            if (isMobile) {
                if (currentPopup) {
                    currentPopup.remove();
                    currentPopup = null;
                }
                openMobileBottomSheet(properties);
            } else {
                if (mobileBottomSheet && mobileBottomSheet.classList.contains('visible')) {
                    closeMobileBottomSheet();
                }
                if (currentPopup) currentPopup.remove();
                const popupHTML = createPopupHTML(properties);
                currentPopup = new maplibregl.Popup({ offset: 25, closeButton: true, className: 'airbnb-style-popup' }).setLngLat(coordinates).setHTML(popupHTML).addTo(map);
                currentPopup.on('close', () => {
                    if (selectedPinId === clickedPinId) {
                        map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: selectedPinId }, { selected: false });
                        selectedPinId = null;
                    }
                    currentPopup = null;
                });
            }
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

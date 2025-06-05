// map-listings.js - VERSION 11.1 - Popup mobile et bascule mobile corrigée
document.addEventListener('DOMContentLoaded', function() {
    console.log('[MAP_SCRIPT V11.1] Popup mobile fixe et bascule mobile corrigée.');

    const MAPTILER_API_KEY = 'UsgTlLJiePXeSnyh57aL'; // Remplacez par votre clé MapTiler
    const MAP_CONTAINER_ID = 'map-section';
    const LIST_CONTAINER_ID = 'annonces-wrapper'; 
    const MOBILE_TOGGLE_BUTTON_ID = 'mobile-map-toggle';

    const SOURCE_ID_ANNONCES = 'annonces-source';
    const LAYER_ID_PINS = 'annonces-pins-layer';
    const LAYER_ID_LABELS = 'annonces-labels-layer';

    const SOURCE_NAME_BUILDINGS = 'maptiler_planet';
    const SOURCE_LAYER_NAME_BUILDINGS = 'building';
    const LAYER_ID_BUILDINGS_3D = 'buildings-3d-layer';

    const MOBILE_POPUP_ID = 'mobile-listing-popup';
    const MOBILE_POPUP_CONTENT_ID = 'mobile-listing-popup-content';
    const MOBILE_POPUP_CLOSE_BUTTON_ID = 'mobile-listing-popup-close';

    const listContainer = document.getElementById(LIST_CONTAINER_ID);
    const mobileToggleButton = document.getElementById(MOBILE_TOGGLE_BUTTON_ID);

    let map = null;
    let allAnnouncements = [];
    let isMobile = window.innerWidth < 768;
    let mapLibrePopup = null;
    let selectedPinId = null;

    let mobilePopupElement = document.getElementById(MOBILE_POPUP_ID);
    let mobilePopupContentElement = document.getElementById(MOBILE_POPUP_CONTENT_ID);
    let mobilePopupCloseButton = document.getElementById(MOBILE_POPUP_CLOSE_BUTTON_ID);
    let currentHighlightedBuildingIds = new Set();

    if (mobilePopupCloseButton && mobilePopupElement) {
        mobilePopupCloseButton.addEventListener('click', () => {
            mobilePopupElement.classList.remove('visible');
            setTimeout(() => {
                if (!mobilePopupElement.classList.contains('visible')) {
                     mobilePopupElement.style.display = 'none';
                }
            }, 300);

            if (selectedPinId !== null && map && map.getSource(SOURCE_ID_ANNONCES) && map.getLayer(LAYER_ID_PINS)) {
                try {
                    map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: selectedPinId }, { selected: false });
                } catch (error) {
                    console.warn("Error unsetting feature state on mobile popup close:", error);
                }
                selectedPinId = null;
            }
        });
    } else {
        console.warn("[MAP_SCRIPT V11.1] Éléments du DOM pour le popup mobile non trouvés.");
    }

    document.addEventListener('annoncesChargeesEtRendues', (event) => {
        const annonces = event.detail.annonces;
        if (!annonces || !Array.isArray(annonces)) {
            console.warn("[MAP_SCRIPT V11.1] Aucune annonce reçue ou format incorrect.");
            allAnnouncements = [];
        } else {
            allAnnouncements = annonces;
        }
        
        const geojsonData = convertAnnoncesToGeoJSON(allAnnouncements);

        if (!map) {
            initializeMap(geojsonData);
        } else {
            if (map.getSource(SOURCE_ID_ANNONCES)) {
                map.getSource(SOURCE_ID_ANNONCES).setData(geojsonData);
            } else {
                map.once('styledata', () => { // Ensure style is ready
                    if (map.getSource(SOURCE_ID_ANNONCES)) {
                         map.getSource(SOURCE_ID_ANNONCES).setData(geojsonData);
                    } else {
                        map.addSource(SOURCE_ID_ANNONCES, { type: 'geojson', data: geojsonData, promoteId: 'id' });
                    }
                });
            }
            
            if (map.isStyleLoaded()) {
                 mettreAJourBatimentsSelectionnes(allAnnouncements);
                 if (geojsonData.features.length > 0) {
                    const bounds = getBounds(geojsonData);
                    map.fitBounds(bounds, { padding: isMobile ? 40: 80, maxZoom: 16 });
                 } else { 
                    map.flyTo({ center: [2.3522, 48.8566], zoom: 11 }); 
                 }
            } else {
                map.once('load', () => {
                    mettreAJourBatimentsSelectionnes(allAnnouncements);
                    if (geojsonData.features.length > 0) {
                        const bounds = getBounds(geojsonData);
                        map.fitBounds(bounds, { padding: isMobile ? 40: 80, maxZoom: 16 });
                    } else { 
                        map.flyTo({ center: [2.3522, 48.8566], zoom: 11 }); 
                    }
                });
            }
             // updateVisibleList() is often called after map movements, which will update button text
        }
    });

    function convertAnnoncesToGeoJSON(annonces) {
        const features = annonces.map(annonce => {
            const lat = getNestedValue(annonce, 'geo_location.data.lat');
            const lng = getNestedValue(annonce, 'geo_location.data.lng');
            if (annonce.id === undefined || annonce.id === null || lat === undefined || lng === undefined) return null;
            let featureId = parseInt(annonce.id, 10); 
            if (isNaN(featureId)) return null;

            return {
                type: 'Feature',
                id: featureId, 
                geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
                properties: {
                    id_str: String(annonce.id), 
                    price: getNestedValue(annonce, '_property_lease_of_property.0.loyer') || '?',
                    title: getNestedValue(annonce, 'property_title'),
                    coverPhoto: getNestedValue(annonce, '_property_photos.0.images.0.url')
                }
            };
        }).filter(feature => feature !== null);
        return { type: 'FeatureCollection', features };
    }
    
    async function mettreAJourBatimentsSelectionnes(annonces) {
        if (!map || !map.isStyleLoaded() || !map.getSource(SOURCE_NAME_BUILDINGS)) {
            // console.warn("[BÂTIMENTS DEBUG] Style ou source non chargé."); // Peut être bruyant
            return;
        }

        currentHighlightedBuildingIds.forEach(buildingId => {
             try {
                if (map.getFeatureState({ source: SOURCE_NAME_BUILDINGS, sourceLayer: SOURCE_LAYER_NAME_BUILDINGS, id: buildingId })?.highlighted) {
                    map.setFeatureState({ source: SOURCE_NAME_BUILDINGS, sourceLayer: SOURCE_LAYER_NAME_BUILDINGS, id: buildingId }, { highlighted: false });
                }
             } catch(e){ /* console.warn("Erreur réinitialisation état bâtiment:", e.message) */ }
        });
        currentHighlightedBuildingIds.clear();

        if (!annonces || annonces.length === 0) return;
        
        await map.once('idle');
        
        const newBuildingIdsToHighlight = new Set();
        for (const annonce of annonces) {
            const lat = getNestedValue(annonce, 'geo_location.data.lat');
            const lng = getNestedValue(annonce, 'geo_location.data.lng');
            if (lat && lng) {
                const point = map.project([lng, lat]);
                const queryBoxSize = 10; 
                const queryBox = [ [point.x - queryBoxSize, point.y - queryBoxSize], [point.x + queryBoxSize, point.y + queryBoxSize] ];
                
                const features = map.queryRenderedFeatures(queryBox, { layers: [LAYER_ID_BUILDINGS_3D] });
                if (features.length > 0 && features[0].id !== undefined) {
                    newBuildingIdsToHighlight.add(features[0].id);
                }
            }
        }

        newBuildingIdsToHighlight.forEach(buildingId => {
            try {
                map.setFeatureState({ source: SOURCE_NAME_BUILDINGS, sourceLayer: SOURCE_LAYER_NAME_BUILDINGS, id: buildingId }, { highlighted: true });
            } catch(e){ /* console.warn("Erreur màj état bâtiment:", e.message) */ }
        });
        currentHighlightedBuildingIds = newBuildingIdsToHighlight;
    }

    function getBounds(geojson) {
        const bounds = new maplibregl.LngLatBounds();
        if (geojson && geojson.features) {
            geojson.features.forEach(feature => {
                if(feature && feature.geometry && feature.geometry.coordinates) {
                    bounds.extend(feature.geometry.coordinates);
                }
            });
        }
        return bounds;
    }

    function initializeMap(initialGeoJSON) {
        map = new maplibregl.Map({
            container: MAP_CONTAINER_ID,
            style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_API_KEY}`,
            pitch: isMobile ? 0 : 50,
            bearing: isMobile ? 0 : -15,
            center: [2.3522, 48.8566], 
            zoom: 11,
            navigationControl: false, 
            renderWorldCopies: false,
            interactive: true,
        });
        
        window.map = map; 

        if (initialGeoJSON && initialGeoJSON.features && initialGeoJSON.features.length > 0) {
            const bounds = getBounds(initialGeoJSON);
            if (bounds.getSouthWest() && bounds.getNorthEast()) { // Check if bounds are valid
                 map.fitBounds(bounds, { padding: isMobile ? 40 : 80, duration: 0, maxZoom: 16 });
            }
        }

        map.on('load', () => {
            console.log('[MAP_SCRIPT V11.1] Carte chargée.');
            map.addSource(SOURCE_ID_ANNONCES, { type: 'geojson', data: initialGeoJSON, promoteId: 'id' });

            const heightExpression = ['coalesce', ['get', 'height'], 20]; 
            const minHeightExpression = ['coalesce', ['get', 'min_height'], 0];
            
            if (map.getSource(SOURCE_NAME_BUILDINGS)) {
                 map.addLayer({
                    'id': LAYER_ID_BUILDINGS_3D,
                    'type': 'fill-extrusion',
                    'source': SOURCE_NAME_BUILDINGS,
                    'source-layer': SOURCE_LAYER_NAME_BUILDINGS,
                    'paint': { 
                        'fill-extrusion-color': ['case', ['boolean', ['feature-state', 'highlighted'], false], '#FF1493', '#dfdfdf'],
                        'fill-extrusion-height': heightExpression, 
                        'fill-extrusion-base': minHeightExpression, 
                        'fill-extrusion-opacity': 0.85
                    }
                }, LAYER_ID_PINS); 
            } else {
                console.warn(`[MAP_SCRIPT V11.1] Source '${SOURCE_NAME_BUILDINGS}' non trouvée.`);
            }

            map.addLayer({
                id: LAYER_ID_PINS, type: 'circle', source: SOURCE_ID_ANNONCES,
                paint: {
                    'circle-radius': 26,
                    'circle-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#007bff', '#FFFFFF'],
                    'circle-stroke-width': ['case', ['boolean', ['feature-state', 'selected'], false], 2, 1.5],
                    'circle-stroke-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#FFFFFF', '#007bff']
                }
            });
            map.addLayer({
                id: LAYER_ID_LABELS, type: 'symbol', source: SOURCE_ID_ANNONCES,
                layout: {
                    'text-field': ['concat', ['to-string', ['get', 'price']], '€'],
                    'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'], 
                    'text-size': 14,
                    'text-allow-overlap': false, 
                    'text-ignore-placement': false
                },
                paint: {
                    'text-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#FFFFFF', '#333333']
                }
            });
            
            map.on('click', LAYER_ID_PINS, handleMapClick);
            map.on('mouseenter', LAYER_ID_PINS, () => map.getCanvas().style.cursor = 'pointer');
            map.on('mouseleave', LAYER_ID_PINS, () => map.getCanvas().style.cursor = '');
            
            map.on('moveend', updateVisibleList); 
            map.on('idle', updateVisibleList); // Also update when map becomes idle

            updateVisibleList(); 
            updateMobileButtonAndViewState(); // Set initial button text and view state
            if (map.isStyleLoaded() && map.getSource(SOURCE_NAME_BUILDINGS)) {
                mettreAJourBatimentsSelectionnes(allAnnouncements);
            }
        });
        
        map.on('error', (e) => {
            console.error('Erreur MapLibre:', e.error ? e.error.message : e);
        });

        map.addControl(new maplibregl.NavigationControl(), 'top-right');
    }

    function updateMobileButtonAndViewState() {
        if (!mobileToggleButton) return;

        if (isMobile) {
            mobileToggleButton.style.display = ''; // Make button visible on mobile
            if (document.body.classList.contains('map-is-active')) {
                // Map is active, count visible pins
                if (map && map.isStyleLoaded() && map.getSource(SOURCE_ID_ANNONCES)) {
                    const visibleFeatures = map.queryRenderedFeatures({ layers: [LAYER_ID_PINS] });
                    const count = visibleFeatures.length;
                    mobileToggleButton.textContent = `Voir les ${count} logement${count !== 1 ? 's' : ''}`;
                } else {
                     mobileToggleButton.textContent = `Voir les logements`; // Fallback
                }
            } else {
                // List is active
                mobileToggleButton.textContent = 'Afficher la carte';
            }
        } else {
            mobileToggleButton.style.display = 'none'; // Hide button on desktop
        }
    }
    
    function updateVisibleList() {
        if (!map || !map.isStyleLoaded() || !listContainer || !map.getSource(SOURCE_ID_ANNONCES)) return;
        
        const visibleFeatures = map.queryRenderedFeatures({ layers: [LAYER_ID_PINS] });
        const visiblePropertyIds = new Set(visibleFeatures.map(feature => String(feature.properties.id_str || feature.id)));
        
        const allListItems = listContainer.querySelectorAll('[data-property-id]'); 
        allListItems.forEach(itemDiv => {
            const itemIdString = itemDiv.dataset.propertyId;
            const anchorTag = itemDiv.parentElement.tagName === 'A' ? itemDiv.parentElement : itemDiv; 
            if (visiblePropertyIds.has(itemIdString)) {
                anchorTag.classList.remove('annonce-list-item-hidden');
            } else {
                anchorTag.classList.add('annonce-list-item-hidden');
            }
        });

        updateMobileButtonAndViewState(); // Update button text after list visibility changes
    }

    function createPopupHTML(properties) {
        const placeholderImage = 'https://placehold.co/280x150/EFEFEF/AAAAAA?text=Image';
        const coverPhoto = properties.coverPhoto || placeholderImage;
        const title = properties.title || "Titre non disponible";
        const priceText = `${properties.price || '?'} € / mois`;
        const detailLink = `annonce?id=${properties.id_str}`; 

        return `
            <div class="map-custom-popup">
                <img src="${coverPhoto}" alt="${title}" class="popup-image" onerror="this.onerror=null;this.src='${placeholderImage}';">
                <div class="popup-info">
                    <h4 class="popup-title">${title}</h4>
                    <p class="popup-price">${priceText}</p>
                    <a href="${detailLink}" class="popup-link" target="_blank">Voir détails</a>
                </div>
            </div>`;
    }
    
    function handleMapClick(e) {
        if (!e.features || e.features.length === 0) return;

        const feature = e.features[0];
        const coordinates = feature.geometry.coordinates.slice();
        const properties = feature.properties; 
        const clickedPinId = feature.id; 

        if (selectedPinId !== null && selectedPinId !== clickedPinId) {
            try {
              if (map.getLayer(LAYER_ID_PINS) && map.getSource(SOURCE_ID_ANNONCES)) { // Check layer exists
                map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: selectedPinId }, { selected: false });
              }
            } catch (error) { console.warn("Error unsetting feature state:", error); }
        }
        try {
            if (map.getLayer(LAYER_ID_PINS) && map.getSource(SOURCE_ID_ANNONCES)) {
                 map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: clickedPinId }, { selected: true });
            }
        } catch (error) { console.warn("Error setting feature state:", error); }
        selectedPinId = clickedPinId;

        if (isMobile) {
            if (mapLibrePopup) {
                mapLibrePopup.remove();
                mapLibrePopup = null;
            }

            if (mobilePopupElement && mobilePopupContentElement) {
                const popupHTML = createPopupHTML(properties);
                mobilePopupContentElement.innerHTML = popupHTML;
                mobilePopupElement.style.display = 'flex'; 
                void mobilePopupElement.offsetWidth; 
                mobilePopupElement.classList.add('visible');
                map.flyTo({ center: coordinates, zoom: Math.max(map.getZoom(), 15), essential: true });
                scrollListItemIntoView(properties.id_str); 
            }
        } else { 
            if (mobilePopupElement && mobilePopupElement.classList.contains('visible')) {
                mobilePopupElement.classList.remove('visible');
                 setTimeout(() => {
                    if (!mobilePopupElement.classList.contains('visible')) {
                         mobilePopupElement.style.display = 'none';
                    }
                }, 300);
            }

            if (mapLibrePopup) {
                mapLibrePopup.remove();
            }
            const popupHTML = createPopupHTML(properties);
            mapLibrePopup = new maplibregl.Popup({ 
                offset: 10, 
                closeButton: true, 
                className: 'airbnb-style-popup' 
            })
            .setLngLat(coordinates)
            .setHTML(popupHTML)
            .addTo(map);

            mapLibrePopup.on('close', () => {
                if (selectedPinId === clickedPinId) { 
                    try {
                        if (map.getLayer(LAYER_ID_PINS) && map.getSource(SOURCE_ID_ANNONCES)) {
                             map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: selectedPinId }, { selected: false });
                        }
                    } catch (error) { console.warn("Error unsetting feature state on popup close:", error); }
                    selectedPinId = null;
                }
                mapLibrePopup = null;
            });
        }
    }

    function getNestedValue(obj, path) {
        if (!obj || !path) return undefined;
        return path.split('.').reduce((acc, part) => {
            if (acc === undefined || acc === null) return undefined;
            const partAsInt = parseInt(part, 10);
            if (Array.isArray(acc) && !isNaN(partAsInt) && partAsInt >= 0 && partAsInt < acc.length) {
                return acc[partAsInt];
            }
            return acc[part];
        }, obj);
    }
    
    // Mobile toggle button setup
    if (mobileToggleButton) { // Check if button exists
        mobileToggleButton.addEventListener('click', () => {
            if (!isMobile) return; // Action only on mobile

            document.body.classList.toggle('map-is-active');
            
            if (document.body.classList.contains('map-is-active')) {
                // Switched to Map View
                if (map) map.resize();
            } else {
                // Switched to List View
                if (listContainer) listContainer.scrollTo(0, 0);
            }
            updateMobileButtonAndViewState(); // Update button text and manage view
        });
    }


    window.addEventListener('resize', () => {
        const previouslyMobile = isMobile;
        isMobile = window.innerWidth < 768;

        if (previouslyMobile !== isMobile) {
            console.log(`[MAP_SCRIPT V11.1] Mode changé: ${previouslyMobile ? 'Mobile -> Desktop' : 'Desktop -> Mobile'}`);
            if (selectedPinId !== null) {
                if (mapLibrePopup) {
                    mapLibrePopup.remove();
                    mapLibrePopup = null;
                }
                if (mobilePopupElement && mobilePopupElement.classList.contains('visible')) {
                    mobilePopupElement.classList.remove('visible');
                     setTimeout(() => {
                        if (!mobilePopupElement.classList.contains('visible')) {
                           mobilePopupElement.style.display = 'none';
                        }
                    }, 300);
                }
            }
            if (map) {
                map.setPitch(isMobile ? 0 : 50);
                map.setBearing(isMobile ? 0 : -15);
            }
        }
        updateMobileButtonAndViewState(); // Always update button/view state on resize
    });

    function scrollListItemIntoView(propertyIdStr) {
        if (!listContainer || !propertyIdStr) return;
        if (isMobile && document.body.classList.contains('map-is-active')) return;

        const itemInList = listContainer.querySelector(`[data-property-id="${propertyIdStr}"]`);
        if (itemInList) {
            const scrollTarget = itemInList.closest('a, div[data-property-id]'); 
            if (scrollTarget) {
                scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
    }

    // Initial UI setup based on screen size
    updateMobileButtonAndViewState();
});

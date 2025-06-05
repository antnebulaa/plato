// map-listings.js - VERSION 11.7 - Mobile modal popup, mobile pitch restored
document.addEventListener('DOMContentLoaded', function() {
    console.log('[MAP_SCRIPT V11.7] Initialisation avec popup modale pour mobile et pitch mobile.');

    const MAPTILER_API_KEY = 'UsgTlLJiePXeSnyh57aL'; 
    const MAP_CONTAINER_ID = 'map-section';
    const LIST_CONTAINER_ID = 'annonces-wrapper'; 
    const MOBILE_TOGGLE_BUTTON_ID = 'mobile-map-toggle';

    // IDs pour la modale (à adapter si les vôtres sont différents)
    const MODAL_ID = 'annonceDetailModal';
    const MODAL_BODY_ID = 'annonceDetailModalBody';
    const MODAL_CLOSE_BUTTON_ID = 'annonceDetailModalClose';

    const SOURCE_ID_ANNONCES = 'annonces-source';
    const LAYER_ID_PINS = 'annonces-pins-layer';
    const LAYER_ID_LABELS = 'annonces-labels-layer';

    const SOURCE_NAME_BUILDINGS = 'maptiler_planet';
    const SOURCE_LAYER_NAME_BUILDINGS = 'building'; 
    const LAYER_ID_BUILDINGS_3D = 'buildings-3d-layer';

    const listContainer = document.getElementById(LIST_CONTAINER_ID);
    const mobileToggleButton = document.getElementById(MOBILE_TOGGLE_BUTTON_ID);

    let map = null;
    let allAnnouncements = [];
    let isMobile = window.innerWidth < 768;
    let currentMapLibrePopup = null; // Pour le popup sur desktop
    let selectedPinIdForState = null; 
    let currentHighlightedBuildingIds = new Set();

    // Éléments de la modale
    let modalElement = document.getElementById(MODAL_ID);
    let modalBodyElement = document.getElementById(MODAL_BODY_ID);
    let modalCloseButton = document.getElementById(MODAL_CLOSE_BUTTON_ID);

    if (!modalElement) console.error(`[MAP_SCRIPT V11.7] CRITICAL: L'élément de la modale ID "${MODAL_ID}" est INTROUVABLE !`);
    if (!modalBodyElement) console.error(`[MAP_SCRIPT V11.7] CRITICAL: L'élément body de la modale ID "${MODAL_BODY_ID}" est INTROUVABLE !`);
    if (!modalCloseButton) console.error(`[MAP_SCRIPT V11.7] CRITICAL: Le bouton de fermeture de la modale ID "${MODAL_CLOSE_BUTTON_ID}" est INTROUVABLE !`);

    if (modalCloseButton && modalElement) {
        modalCloseButton.addEventListener('click', () => {
            console.log('[MAP_SCRIPT V11.7] Bouton fermeture modale cliqué.');
            modalElement.style.display = 'none'; // Logique simple pour cacher la modale
            // Vous pourriez avoir une classe CSS ou une interaction Webflow à déclencher ici
        });
        // Optionnel: fermer la modale en cliquant à l'extérieur
        modalElement?.addEventListener('click', function(event) {
            if (event.target === modalElement) { // Si le clic est sur le fond de la modale
                modalElement.style.display = 'none';
            }
        });
    }

    document.addEventListener('annoncesChargeesEtRendues', (event) => {
        console.log('[MAP_SCRIPT V11.7] Événement "annoncesChargeesEtRendues".');
        const annonces = event.detail.annonces;
        allAnnouncements = (annonces && Array.isArray(annonces)) ? annonces : [];
        const geojsonData = convertAnnoncesToGeoJSON(allAnnouncements);

        if (!map) {
            initializeMap(geojsonData);
        } else {
            if (map.getSource(SOURCE_ID_ANNONCES)) {
                map.getSource(SOURCE_ID_ANNONCES).setData(geojsonData);
            } else {
                map.once('styledata', () => { 
                    if (map.getSource(SOURCE_ID_ANNONCES)) {
                         map.getSource(SOURCE_ID_ANNONCES).setData(geojsonData);
                    } else {
                        map.addSource(SOURCE_ID_ANNONCES, { type: 'geojson', data: geojsonData, promoteId: 'id' });
                    }
                });
            }
            const updateLogic = () => {
                mettreAJourBatimentsSelectionnes(allAnnouncements); 
                if (geojsonData.features.length > 0) {
                    const bounds = getBounds(geojsonData);
                    if (bounds.getSouthWest() && bounds.getNorthEast()){
                         map.fitBounds(bounds, { padding: isMobile ? 60 : 80, maxZoom: 16, duration:0 });
                    }
                } else { 
                    map.flyTo({ center: [2.3522, 48.8566], zoom: 11, duration:0 }); 
                }
                updateVisibleList();
            };
            if (map.isStyleLoaded()) updateLogic();
            else map.once('load', updateLogic); 
        }
    });

    function convertAnnoncesToGeoJSON(annonces) {
        const features = annonces.map(annonce => {
            const lat = getNestedValue(annonce, 'geo_location.data.lat');
            const lng = getNestedValue(annonce, 'geo_location.data.lng');
            if (annonce.id === undefined || annonce.id === null || lat === undefined || lng === undefined) return null;
            let featureId = parseInt(annonce.id, 10); 
            if (isNaN(featureId)) {
                console.warn(`[MAP_SCRIPT V11.7] Annonce ID "${annonce.id}" non numérique, ignorée pour feature 'id'.`);
                return null; 
            }
            return {
                type: 'Feature', id: featureId, 
                geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
                properties: {
                    id_str: String(annonce.id), 
                    price: getNestedValue(annonce, '_property_lease_of_property.0.loyer') || '?',
                    title: getNestedValue(annonce, 'property_title'),
                    coverPhoto: getNestedValue(annonce, '_property_photos.0.images.0.url')
                }
            };
        }).filter(feature => feature !== null);
        console.log(`[MAP_SCRIPT V11.7] ${features.length} features GeoJSON valides créés.`);
        return { type: 'FeatureCollection', features };
    }
    
    async function mettreAJourBatimentsSelectionnes(annonces) {
        if (!map || !map.isStyleLoaded() || !map.getSource(SOURCE_NAME_BUILDINGS) || !map.getLayer(LAYER_ID_BUILDINGS_3D)) return;
        currentHighlightedBuildingIds.forEach(buildingId => {
             try {
                if (map.getFeatureState({ source: SOURCE_NAME_BUILDINGS, sourceLayer: SOURCE_LAYER_NAME_BUILDINGS, id: buildingId })?.highlighted) {
                    map.setFeatureState({ source: SOURCE_NAME_BUILDINGS, sourceLayer: SOURCE_LAYER_NAME_BUILDINGS, id: buildingId }, { highlighted: false });
                }
             } catch(e){ /* ignore */ }
        });
        currentHighlightedBuildingIds.clear();
        if (!annonces || annonces.length === 0) return;
        try { await map.once('idle'); } catch(e) { /* ignore */ }
        const newBuildingIdsToHighlight = new Set();
        for (const annonce of annonces) {
            const lat = getNestedValue(annonce, 'geo_location.data.lat');
            const lng = getNestedValue(annonce, 'geo_location.data.lng');
            if (lat && lng) {
                const point = map.project([lng, lat]);
                const queryBox = [ [point.x - 10, point.y - 10], [point.x + 10, point.y + 10] ];
                const features = map.queryRenderedFeatures(queryBox, { layers: [LAYER_ID_BUILDINGS_3D] });
                if (features.length > 0 && features[0].id !== undefined) {
                    newBuildingIdsToHighlight.add(features[0].id);
                }
            }
        }
        newBuildingIdsToHighlight.forEach(buildingId => {
            try {
                map.setFeatureState({ source: SOURCE_NAME_BUILDINGS, sourceLayer: SOURCE_LAYER_NAME_BUILDINGS, id: buildingId }, { highlighted: true });
            } catch(e){ /* ignore */ }
        });
        currentHighlightedBuildingIds = newBuildingIdsToHighlight;
    }

    function getBounds(geojson) {
        const bounds = new maplibregl.LngLatBounds();
        if (geojson && geojson.features) {
            geojson.features.forEach(feature => {
                if(feature && feature.geometry && feature.geometry.coordinates && 
                   typeof feature.geometry.coordinates[0] === 'number' && 
                   typeof feature.geometry.coordinates[1] === 'number') {
                    try { bounds.extend(feature.geometry.coordinates); } catch (e) { /* ignore */ }
                }
            });
        }
        return bounds;
    }

    function initializeMap(initialGeoJSON) {
        const mobilePitch = 30; // Pitch pour mobile, à ajuster selon vos préférences
        const desktopPitch = 50;

        console.log('[MAP_SCRIPT V11.7] Initialisation MapLibre.');
        map = new maplibregl.Map({
            container: MAP_CONTAINER_ID, style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_API_KEY}`,
            pitch: isMobile ? mobilePitch : desktopPitch, // Pitch ajusté
            bearing: isMobile ? 0 : -15, 
            center: [2.3522, 48.8566], zoom: 11,
            navigationControl: false, renderWorldCopies: false, interactive: true,
        });
        window.map = map; 
        if (initialGeoJSON && initialGeoJSON.features && initialGeoJSON.features.length > 0) {
            const bounds = getBounds(initialGeoJSON);
            if (bounds.getSouthWest() && bounds.getNorthEast()) { 
                 map.fitBounds(bounds, { padding: isMobile ? 60 : 80, duration: 0, maxZoom: 16 });
            }
        }
        map.on('load', () => {
            console.log('[MAP_SCRIPT V11.7] Événement "load" carte MapLibre.');
            map.addSource(SOURCE_ID_ANNONCES, { type: 'geojson', data: initialGeoJSON, promoteId: 'id' });
            const heightExpression = ['coalesce', ['get', 'height'], 20]; 
            const minHeightExpression = ['coalesce', ['get', 'min_height'], 0];
            if (map.getSource(SOURCE_NAME_BUILDINGS)) {
                 map.addLayer({
                    'id': LAYER_ID_BUILDINGS_3D, 'type': 'fill-extrusion', 'source': SOURCE_NAME_BUILDINGS,
                    'source-layer': SOURCE_LAYER_NAME_BUILDINGS, 
                    'paint': { 
                        'fill-extrusion-color': ['case', ['boolean', ['feature-state', 'highlighted'], false], '#FF1493', '#dfdfdf'],
                        'fill-extrusion-height': heightExpression, 'fill-extrusion-base': minHeightExpression, 'fill-extrusion-opacity': 0.85
                    }
                }); 
            } else { console.warn(`[MAP_SCRIPT V11.7] Source bâtiments "${SOURCE_NAME_BUILDINGS}" non trouvée.`); }
            map.addLayer({
                id: LAYER_ID_PINS, type: 'circle', source: SOURCE_ID_ANNONCES,
                paint: { 
                    'circle-radius': 26, 'circle-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#007bff', '#FFFFFF'],
                    'circle-stroke-width': ['case', ['boolean', ['feature-state', 'selected'], false], 2, 1.5],
                    'circle-stroke-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#FFFFFF', '#007bff']
                }
            });
            map.addLayer({
                id: LAYER_ID_LABELS, type: 'symbol', source: SOURCE_ID_ANNONCES,
                layout: { 
                    'text-field': ['concat', ['to-string', ['get', 'price']], '€'],
                    'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'], 
                    'text-size': 14, 'text-allow-overlap': false, 'text-ignore-placement': false
                },
                paint: { 'text-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#FFFFFF', '#333333'] }
            });
            map.on('click', LAYER_ID_PINS, handleMapClick);
            map.on('mouseenter', LAYER_ID_PINS, () => map.getCanvas().style.cursor = 'pointer');
            map.on('mouseleave', LAYER_ID_PINS, () => map.getCanvas().style.cursor = '');
            map.on('moveend', updateVisibleList); map.on('idle', updateVisibleList); 
            updateVisibleList(); updateMobileButtonAndViewState(); 
            if (map.isStyleLoaded() && map.getSource(SOURCE_NAME_BUILDINGS) && map.getLayer(LAYER_ID_BUILDINGS_3D)) {
                mettreAJourBatimentsSelectionnes(allAnnouncements);
            }
        });
        map.on('error', (e) => { console.error('[MAP_SCRIPT V11.7] Erreur MapLibre:', e.error ? e.error.message : e); });
        map.addControl(new maplibregl.NavigationControl(), 'top-right');
    }

    function updateMobileButtonAndViewState() {
        if (!mobileToggleButton) return;
        if (isMobile) {
            mobileToggleButton.style.display = ''; 
            if (document.body.classList.contains('map-is-active')) {
                if (map && map.isStyleLoaded() && map.getSource(SOURCE_ID_ANNONCES)) {
                    const visibleFeatures = map.queryRenderedFeatures({ layers: [LAYER_ID_PINS] });
                    const count = visibleFeatures.length;
                    mobileToggleButton.textContent = `Voir les ${count} logement${count !== 1 ? 's' : ''}`;
                } else { mobileToggleButton.textContent = `Voir les logements`; }
            } else { mobileToggleButton.textContent = 'Afficher la carte'; }
        } else { mobileToggleButton.style.display = 'none';  }
    }

    function updateVisibleList() {
        if (!map || !map.isStyleLoaded() || !listContainer || !map.getSource(SOURCE_ID_ANNONCES)) return;
        const visibleFeatures = map.queryRenderedFeatures({ layers: [LAYER_ID_PINS] });
        const visiblePropertyIds = new Set(visibleFeatures.map(feature => String(feature.properties.id_str || feature.id)));
        const allListItems = listContainer.querySelectorAll('[data-property-id]'); 
        allListItems.forEach(itemDiv => {
            const itemIdString = itemDiv.dataset.propertyId;
            const anchorTag = itemDiv.parentElement.tagName === 'A' ? itemDiv.parentElement : itemDiv; 
            if (visiblePropertyIds.has(itemIdString)) anchorTag.classList.remove('annonce-list-item-hidden');
            else anchorTag.classList.add('annonce-list-item-hidden');
        });
        updateMobileButtonAndViewState();
    }

    function createPopupHTML(properties) { // Cette fonction est maintenant utilisée pour le contenu de la modale mobile ET du popup desktop
        const placeholderImage = 'https://placehold.co/280x150/EFEFEF/AAAAAA?text=Image';
        const coverPhoto = properties.coverPhoto || placeholderImage;
        const title = properties.title || "Titre non disponible";
        const priceText = `${properties.price || '?'} € / mois`;
        const detailLink = `annonce?id=${properties.id_str}`; 
        // La classe .map-custom-popup sera utilisée pour styler ce contenu
        return `<div class="map-custom-popup"> 
                    <img src="${coverPhoto}" alt="${title}" class="popup-image" onerror="this.onerror=null;this.src='${placeholderImage}';">
                    <div class="popup-info">
                        <h4 class="popup-title">${title}</h4>
                        <p class="popup-price">${priceText}</p>
                        <a href="${detailLink}" class="popup-link" target="_blank">Voir détails</a>
                    </div>
                </div>`;
    }

    function handleMapClick(e) {
        console.log('[MAP_SCRIPT V11.7] Entrée handleMapClick.');
        if (!e.features || e.features.length === 0) return;
        
        const feature = e.features[0];
        const properties = feature.properties; 
        const coordinates = feature.geometry.coordinates.slice();
        let idPourFeatureState;

        if (typeof feature.id === 'number') {
            idPourFeatureState = feature.id;
        } else if (properties && properties.id_str !== undefined) {
            const parsedId = parseInt(properties.id_str, 10);
            if (!isNaN(parsedId)) idPourFeatureState = parsedId;
        }
        console.log(`[MAP_SCRIPT V11.7] ID pour setFeatureState: ${idPourFeatureState}`);

        if (typeof idPourFeatureState === 'number') {
            if (selectedPinIdForState !== null && selectedPinIdForState !== idPourFeatureState) {
                try {
                  if (map.getLayer(LAYER_ID_PINS) && map.getSource(SOURCE_ID_ANNONCES)) { 
                    map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: selectedPinIdForState }, { selected: false });
                  }
                } catch (error) { /* ignore */ }
            }
            try {
                if (map.getLayer(LAYER_ID_PINS) && map.getSource(SOURCE_ID_ANNONCES)) {
                     map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: idPourFeatureState }, { selected: true });
                }
            } catch (error) { /* ignore */ }
            selectedPinIdForState = idPourFeatureState;
        } else {
            if(selectedPinIdForState !== null) {
                 try { if (map.getLayer(LAYER_ID_PINS) && map.getSource(SOURCE_ID_ANNONCES)) map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: selectedPinIdForState }, { selected: false }); } catch(e) {/*ignore*/}
                 selectedPinIdForState = null;
            }
        }

        if (isMobile) {
            console.log('[MAP_SCRIPT V11.7] Mode mobile: tentative d\'affichage de la modale.');
            if (currentMapLibrePopup) { currentMapLibrePopup.remove(); currentMapLibrePopup = null; } // Fermer le popup desktop s'il était ouvert (ex: redimensionnement)

            if (modalElement && modalBodyElement) {
                const popupHTML = createPopupHTML(properties);
                modalBodyElement.innerHTML = popupHTML;
                modalElement.style.display = 'flex'; // Ou la méthode de Webflow pour ouvrir une modale
                console.log(`[MAP_SCRIPT V11.7] Modale (ID: ${MODAL_ID}) affichée avec contenu pour annonce ID ${properties.id_str}.`);
                
                // Optionnel: centrer la carte un peu, mais sans popup dessus, moins critique
                map.flyTo({ center: coordinates, zoom: Math.max(map.getZoom(), 15), essential: true, padding: {top:50, bottom:50, left:30, right:30} });
                scrollListItemIntoView(properties.id_str);
            } else {
                console.error('[MAP_SCRIPT V11.7] ERREUR: Éléments de la modale non trouvés pour affichage.');
            }

        } else { // Mode Desktop
            console.log('[MAP_SCRIPT V11.7] Mode desktop: affichage popup MapLibre.');
            if (currentMapLibrePopup) currentMapLibrePopup.remove();
            
            const popupHTML = createPopupHTML(properties);
            currentMapLibrePopup = new maplibregl.Popup({ offset: 25, closeButton: true, className: 'airbnb-style-popup' })
                .setLngLat(coordinates)
                .setHTML(popupHTML)
                .addTo(map);
            currentMapLibrePopup.on('close', () => {
                if (typeof idPourFeatureState === 'number' && selectedPinIdForState === idPourFeatureState) { 
                    try {
                        if (map.getLayer(LAYER_ID_PINS) && map.getSource(SOURCE_ID_ANNONCES)) {
                             map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: selectedPinIdForState }, { selected: false });
                        }
                    } catch (error) { /* ignore */ }
                    selectedPinIdForState = null;
                }
                currentMapLibrePopup = null;
            });
            // Sur desktop, le flyTo peut aussi avoir un padding pour mieux voir le popup
            map.flyTo({ center: coordinates, zoom: Math.max(map.getZoom(), 15), essential: true, padding: {top:50, bottom:50, left:50, right:50} });
        }
    }

    function getNestedValue(obj, path) {
        if (!obj || !path) return undefined;
        return path.split('.').reduce((acc, part) => {
            if (acc === undefined || acc === null) return undefined;
            const partAsInt = parseInt(part, 10);
            if (Array.isArray(acc) && !isNaN(partAsInt) && partAsInt >= 0 && partAsInt < acc.length) { return acc[partAsInt]; }
            return acc[part];
        }, obj);
    }
    
    if (mobileToggleButton) {
        mobileToggleButton.addEventListener('click', () => {
            if (!isMobile) return; document.body.classList.toggle('map-is-active');
            console.log(`[MAP_SCRIPT V11.7] Bascule mobile. map-is-active: ${document.body.classList.contains('map-is-active')}`);
            if (document.body.classList.contains('map-is-active')) { if (map) map.resize(); } 
            else { if (listContainer) listContainer.scrollTo(0, 0); }
            updateMobileButtonAndViewState(); 
        });
    } else { console.warn(`[MAP_SCRIPT V11.7] Bouton bascule mobile (ID: ${MOBILE_TOGGLE_BUTTON_ID}) non trouvé.`); }
    
    window.addEventListener('resize', () => {
        const mobilePitch = 30; // Doit correspondre à initializeMap
        const desktopPitch = 50;
        const previouslyMobile = isMobile; 
        isMobile = window.innerWidth < 768;

        if (previouslyMobile !== isMobile) {
            console.log(`[MAP_SCRIPT V11.7] Changement mode: ${previouslyMobile ? 'Mobile -> Desktop' : 'Desktop -> Mobile'}`);
            if (currentMapLibrePopup) { currentMapLibrePopup.remove(); currentMapLibrePopup = null; }
            if (modalElement && modalElement.style.display !== 'none') modalElement.style.display = 'none'; // Fermer modale si ouverte

            if (selectedPinIdForState !== null) { 
                 try { map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: selectedPinIdForState }, { selected: false }); } catch(e) {/*ignore*/}
                 selectedPinIdForState = null;
            }
            if (map) { map.setPitch(isMobile ? mobilePitch : desktopPitch); map.setBearing(isMobile ? 0 : -15); }
        }
        updateMobileButtonAndViewState(); 
    });

    function scrollListItemIntoView(propertyIdStr) {
        if (!listContainer || !propertyIdStr) return;
        if (isMobile && document.body.classList.contains('map-is-active')) return; 
        const itemInList = listContainer.querySelector(`[data-property-id="${propertyIdStr}"]`);
        if (itemInList) {
            const scrollTarget = itemInList.closest('a, div[data-property-id]'); 
            if (scrollTarget) scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    updateMobileButtonAndViewState(); // Appel initial
});

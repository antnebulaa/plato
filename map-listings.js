// map-listings.js - VERSION 11.2 - Correction affichage popup mobile et diagnostics
document.addEventListener('DOMContentLoaded', function() {
    console.log('[MAP_SCRIPT V11.2] Initialisation avec correction popup mobile.');

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

    // Vérifications cruciales au démarrage
    if (!mobilePopupElement) {
        console.error(`[MAP_SCRIPT V11.2] CRITICAL: Element du popup mobile avec ID "${MOBILE_POPUP_ID}" NON TROUVÉ! Le popup mobile ne fonctionnera pas.`);
    }
    if (!mobilePopupContentElement) {
        console.error(`[MAP_SCRIPT V11.2] CRITICAL: Element de contenu du popup mobile avec ID "${MOBILE_POPUP_CONTENT_ID}" NON TROUVÉ!`);
    }
    if (!mobilePopupCloseButton) {
        console.error(`[MAP_SCRIPT V11.2] CRITICAL: Bouton de fermeture du popup mobile avec ID "${MOBILE_POPUP_CLOSE_BUTTON_ID}" NON TROUVÉ!`);
    }


    if (mobilePopupCloseButton && mobilePopupElement) {
        mobilePopupCloseButton.addEventListener('click', () => {
            console.log('[MAP_SCRIPT V11.2] Clic sur le bouton de fermeture du popup mobile.');
            mobilePopupElement.classList.remove('visible');
            // Cache l'élément après la fin de la transition CSS
            setTimeout(() => {
                // Vérifie si la classe 'visible' n'a pas été rajoutée entre-temps
                if (!mobilePopupElement.classList.contains('visible')) {
                     mobilePopupElement.style.display = 'none';
                }
            }, 300); // Durée de la transition CSS

            if (selectedPinId !== null && map && map.getSource(SOURCE_ID_ANNONCES) && map.getLayer(LAYER_ID_PINS)) {
                try {
                    map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: selectedPinId }, { selected: false });
                } catch (error) {
                    console.warn("[MAP_SCRIPT V11.2] Erreur lors de la désélection du feature state (fermeture popup mobile):", error.message);
                }
                selectedPinId = null;
            }
        });
    }

    document.addEventListener('annoncesChargeesEtRendues', (event) => {
        console.log('[MAP_SCRIPT V11.2] Événement "annoncesChargeesEtRendues" reçu.');
        const annonces = event.detail.annonces;
        if (!annonces || !Array.isArray(annonces)) {
            console.warn("[MAP_SCRIPT V11.2] Aucune annonce reçue ou format incorrect dans l'événement.");
            allAnnouncements = [];
        } else {
            allAnnouncements = annonces;
            console.log(`[MAP_SCRIPT V11.2] ${allAnnouncements.length} annonces chargées.`);
        }
        
        const geojsonData = convertAnnoncesToGeoJSON(allAnnouncements);

        if (!map) {
            console.log("[MAP_SCRIPT V11.2] Carte non initialisée, appel de initializeMap.");
            initializeMap(geojsonData);
        } else {
            console.log("[MAP_SCRIPT V11.2] Carte existante, mise à jour des données.");
            if (map.getSource(SOURCE_ID_ANNONCES)) {
                map.getSource(SOURCE_ID_ANNONCES).setData(geojsonData);
            } else {
                console.warn("[MAP_SCRIPT V11.2] Source d'annonces non trouvée sur carte existante. Tentative d'ajout sur 'styledata'.");
                map.once('styledata', () => { 
                    if (map.getSource(SOURCE_ID_ANNONCES)) {
                         map.getSource(SOURCE_ID_ANNONCES).setData(geojsonData);
                    } else {
                        console.log("[MAP_SCRIPT V11.2] Ajout de la source d'annonces après 'styledata'.");
                        map.addSource(SOURCE_ID_ANNONCES, { type: 'geojson', data: geojsonData, promoteId: 'id' });
                    }
                });
            }
            
            const updateAfterLoad = () => {
                mettreAJourBatimentsSelectionnes(allAnnouncements);
                if (geojsonData.features.length > 0) {
                    const bounds = getBounds(geojsonData);
                    if (bounds.getSouthWest() && bounds.getNorthEast()){ // Vérifie que les limites sont valides
                         console.log("[MAP_SCRIPT V11.2] Ajustement des limites de la carte aux nouvelles annonces.");
                         map.fitBounds(bounds, { padding: isMobile ? 40: 80, maxZoom: 16, duration:0 });
                    } else {
                        console.warn("[MAP_SCRIPT V11.2] Limites invalides pour les annonces, pas d'ajustement.");
                    }
                } else { 
                    console.log("[MAP_SCRIPT V11.2] Aucune annonce à afficher, centrage par défaut.");
                    map.flyTo({ center: [2.3522, 48.8566], zoom: 11, duration:0 }); 
                }
                updateVisibleList();
            };

            if (map.isStyleLoaded()) {
                 updateAfterLoad();
            } else {
                console.log("[MAP_SCRIPT V11.2] Style de carte non chargé, attente de l'événement 'load'.");
                map.once('load', updateAfterLoad);
            }
        }
    });

    function convertAnnoncesToGeoJSON(annonces) {
        const features = annonces.map(annonce => {
            const lat = getNestedValue(annonce, 'geo_location.data.lat');
            const lng = getNestedValue(annonce, 'geo_location.data.lng');
            if (annonce.id === undefined || annonce.id === null || lat === undefined || lng === undefined) {
                // console.warn("[MAP_SCRIPT V11.2] Annonce ignorée (ID ou coordonnées manquantes):", annonce.id);
                return null;
            }
            let featureId = parseInt(annonce.id, 10); 
            if (isNaN(featureId)) {
                // console.warn("[MAP_SCRIPT V11.2] Annonce ignorée (ID non numérique après conversion):", annonce.id);
                return null;
            }

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
        // console.log(`[MAP_SCRIPT V11.2] ${features.length} features GeoJSON créés.`);
        return { type: 'FeatureCollection', features };
    }
    
    async function mettreAJourBatimentsSelectionnes(annonces) {
        if (!map || !map.isStyleLoaded() || !map.getSource(SOURCE_NAME_BUILDINGS)) {
            return;
        }

        currentHighlightedBuildingIds.forEach(buildingId => {
             try {
                if (map.getFeatureState({ source: SOURCE_NAME_BUILDINGS, sourceLayer: SOURCE_LAYER_NAME_BUILDINGS, id: buildingId })?.highlighted) {
                    map.setFeatureState({ source: SOURCE_NAME_BUILDINGS, sourceLayer: SOURCE_LAYER_NAME_BUILDINGS, id: buildingId }, { highlighted: false });
                }
             } catch(e){ /* Ignorer discrètement */ }
        });
        currentHighlightedBuildingIds.clear();

        if (!annonces || annonces.length === 0) return;
        
        try { await map.once('idle'); } catch(e) { /* map already idle or error loading it */ }
                
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
            } catch(e){ /* Ignorer discrètement */ }
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
                    try {
                        bounds.extend(feature.geometry.coordinates);
                    } catch (e) {
                        console.warn("[MAP_SCRIPT V11.2] Coordonnées invalides pour calcul des limites:", feature.geometry.coordinates, e.message);
                    }
                } else {
                     // console.warn("[MAP_SCRIPT V11.2] Feature avec coordonnées invalides ou manquantes ignoré pour les limites:", feature);
                }
            });
        }
        return bounds;
    }

    function initializeMap(initialGeoJSON) {
        console.log('[MAP_SCRIPT V11.2] Initialisation de la carte MapLibre.');
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
        
        window.map = map; // Pour débogage

        if (initialGeoJSON && initialGeoJSON.features && initialGeoJSON.features.length > 0) {
            const bounds = getBounds(initialGeoJSON);
            if (bounds.getSouthWest() && bounds.getNorthEast()) { 
                 map.fitBounds(bounds, { padding: isMobile ? 40 : 80, duration: 0, maxZoom: 16 });
            } else {
                console.warn("[MAP_SCRIPT V11.2] Limites initiales invalides, pas d'ajustement.");
            }
        }

        map.on('load', () => {
            console.log('[MAP_SCRIPT V11.2] Carte MapLibre chargée (événement "load").');
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
                }, LAYER_ID_PINS); // Insérer avant les pins
            } else {
                console.warn(`[MAP_SCRIPT V11.2] Source des bâtiments '${SOURCE_NAME_BUILDINGS}' non trouvée. La couche 3D ne sera pas ajoutée.`);
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
            map.on('idle', updateVisibleList); 

            updateVisibleList(); 
            updateMobileButtonAndViewState(); 
            if (map.isStyleLoaded() && map.getSource(SOURCE_NAME_BUILDINGS)) {
                mettreAJourBatimentsSelectionnes(allAnnouncements);
            }
        });
        
        map.on('error', (e) => {
            console.error('[MAP_SCRIPT V11.2] Erreur MapLibre:', e.error ? e.error.message : e);
        });

        map.addControl(new maplibregl.NavigationControl(), 'top-right');
    }

    function updateMobileButtonAndViewState() {
        if (!mobileToggleButton) {
            // console.warn("[MAP_SCRIPT V11.2] Bouton de bascule mobile non trouvé pour mise à jour.");
            return;
        }

        if (isMobile) {
            mobileToggleButton.style.display = ''; // Afficher le bouton sur mobile
            console.log(`[MAP_SCRIPT V11.2] Mode mobile. Classe 'map-is-active' sur body: ${document.body.classList.contains('map-is-active')}`);
            if (document.body.classList.contains('map-is-active')) {
                // La carte est active
                if (map && map.isStyleLoaded() && map.getSource(SOURCE_ID_ANNONCES)) {
                    const visibleFeatures = map.queryRenderedFeatures({ layers: [LAYER_ID_PINS] });
                    const count = visibleFeatures.length;
                    mobileToggleButton.textContent = `Voir les ${count} logement${count !== 1 ? 's' : ''}`;
                } else {
                     mobileToggleButton.textContent = `Voir les logements`; // Fallback
                }
            } else {
                // La liste est active
                mobileToggleButton.textContent = 'Afficher la carte';
            }
        } else {
            console.log('[MAP_SCRIPT V11.2] Mode desktop, masquage du bouton de bascule mobile.');
            mobileToggleButton.style.display = 'none'; // Masquer le bouton sur desktop
        }
    }
    
    function updateVisibleList() {
        // console.log('[MAP_SCRIPT V11.2] Appel de updateVisibleList.');
        if (!map || !map.isStyleLoaded() || !listContainer || !map.getSource(SOURCE_ID_ANNONCES)) {
            // console.warn("[MAP_SCRIPT V11.2] Conditions non remplies pour updateVisibleList (carte, style, conteneur liste ou source).");
            return;
        }
        
        const visibleFeatures = map.queryRenderedFeatures({ layers: [LAYER_ID_PINS] });
        const visiblePropertyIds = new Set(visibleFeatures.map(feature => String(feature.properties.id_str || feature.id)));
        // console.log(`[MAP_SCRIPT V11.2] IDs des propriétés visibles sur la carte:`, visiblePropertyIds);
        
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

        updateMobileButtonAndViewState();
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
        console.log('[MAP_SCRIPT V11.2] Clic sur la carte détecté. Features:', e.features);
        if (!e.features || e.features.length === 0) return;

        const feature = e.features[0];
        const coordinates = feature.geometry.coordinates.slice();
        const properties = feature.properties; 
        const clickedPinId = feature.id; 
        console.log(`[MAP_SCRIPT V11.2] Pin cliqué: ID=${clickedPinId}, Propriétés:`, properties);


        if (selectedPinId !== null && selectedPinId !== clickedPinId) {
            try {
              if (map.getLayer(LAYER_ID_PINS) && map.getSource(SOURCE_ID_ANNONCES)) { 
                map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: selectedPinId }, { selected: false });
              }
            } catch (error) { console.warn("[MAP_SCRIPT V11.2] Erreur désélection feature state:", error.message); }
        }
        try {
            if (map.getLayer(LAYER_ID_PINS) && map.getSource(SOURCE_ID_ANNONCES)) {
                 map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: clickedPinId }, { selected: true });
            }
        } catch (error) { console.warn("[MAP_SCRIPT V11.2] Erreur sélection feature state:", error.message); }
        selectedPinId = clickedPinId;

        if (isMobile) {
            console.log('[MAP_SCRIPT V11.2] Mode mobile détecté pour handleMapClick.');
            if (mapLibrePopup) {
                mapLibrePopup.remove();
                mapLibrePopup = null;
            }

            if (mobilePopupElement && mobilePopupContentElement) {
                console.log('[MAP_SCRIPT V11.2] Éléments du popup mobile trouvés. Affichage du popup.');
                const popupHTML = createPopupHTML(properties);
                mobilePopupContentElement.innerHTML = popupHTML;
                
                // Assurez-vous que l'élément est prêt à être affiché avant d'ajouter la classe 'visible'
                mobilePopupElement.style.display = 'flex'; // Ou 'block' selon votre CSS

                // Utilisez requestAnimationFrame pour s'assurer que le style 'display' est appliqué
                // avant que la classe 'visible' ne soit ajoutée, ce qui permet à la transition de se déclencher.
                requestAnimationFrame(() => {
                    mobilePopupElement.classList.add('visible');
                    console.log('[MAP_SCRIPT V11.2] Classe "visible" ajoutée au popup mobile.');
                });
                
                map.flyTo({ center: coordinates, zoom: Math.max(map.getZoom(), 15), essential: true });
                scrollListItemIntoView(properties.id_str); 
            } else {
                console.error('[MAP_SCRIPT V11.2] ERREUR: mobilePopupElement ou mobilePopupContentElement est null en mode mobile.');
            }
        } else { 
            console.log('[MAP_SCRIPT V11.2] Mode desktop détecté pour handleMapClick.');
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
                    } catch (error) { console.warn("[MAP_SCRIPT V11.2] Erreur désélection feature state (fermeture popup desktop):", error.message); }
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
    
    if (mobileToggleButton) {
        mobileToggleButton.addEventListener('click', () => {
            console.log('[MAP_SCRIPT V11.2] Clic sur le bouton de bascule mobile.');
            if (!isMobile) return; 

            document.body.classList.toggle('map-is-active');
            console.log(`[MAP_SCRIPT V11.2] Classe 'map-is-active' sur body: ${document.body.classList.contains('map-is-active')}`);
            
            if (document.body.classList.contains('map-is-active')) {
                if (map) map.resize();
            } else {
                if (listContainer) listContainer.scrollTo(0, 0);
            }
            updateMobileButtonAndViewState(); 
        });
    } else {
        console.warn("[MAP_SCRIPT V11.2] Bouton de bascule mobile non trouvé. La fonctionnalité de bascule ne sera pas active.");
    }


    window.addEventListener('resize', () => {
        // console.log('[MAP_SCRIPT V11.2] Événement de redimensionnement de la fenêtre.');
        const previouslyMobile = isMobile;
        isMobile = window.innerWidth < 768;

        if (previouslyMobile !== isMobile) {
            console.log(`[MAP_SCRIPT V11.2] Changement de mode d'affichage: ${previouslyMobile ? 'Mobile -> Desktop' : 'Desktop -> Mobile'}`);
            if (selectedPinId !== null) { // Si un pin était sélectionné, fermer les popups pour éviter un affichage incorrect
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
            if (map) { // Adapter le pitch et le bearing de la carte
                map.setPitch(isMobile ? 0 : 50);
                map.setBearing(isMobile ? 0 : -15);
            }
        }
        updateMobileButtonAndViewState(); 
    });

    function scrollListItemIntoView(propertyIdStr) {
        if (!listContainer || !propertyIdStr) return;
        if (isMobile && document.body.classList.contains('map-is-active')) return; // Ne pas scroller si la carte est en plein écran

        const itemInList = listContainer.querySelector(`[data-property-id="${propertyIdStr}"]`);
        if (itemInList) {
            const scrollTarget = itemInList.closest('a, div[data-property-id]'); 
            if (scrollTarget) {
                // console.log(`[MAP_SCRIPT V11.2] Défilement de l'élément de liste ID ${propertyIdStr} en vue.`);
                scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
    }

    console.log('[MAP_SCRIPT V11.2] Configuration initiale de l\'état UI mobile/desktop.');
    updateMobileButtonAndViewState();
});

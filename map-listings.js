// map-listings.js - VERSION MODIFIÉE SANS BUILDINGS-3D
document.addEventListener('DOMContentLoaded', function() {
    console.log('[MAP_SCRIPT V11] Suppression de buildings-3d-layer.'); // Versionning

    const MAPTILER_API_KEY = 'UsgTlLJiePXeSnyh57aL'; // Reste inchangé
    const MAP_CONTAINER_ID = 'map-section'; // Reste inchangé
    const LIST_CONTAINER_ID = 'annonces-wrapper'; // Reste inchangé
    const MOBILE_TOGGLE_BUTTON_ID = 'mobile-map-toggle'; // Reste inchangé
    const SOURCE_ID_ANNONCES = 'annonces-source'; // Reste inchangé
    const LAYER_ID_PINS = 'annonces-pins-layer'; // Reste inchangé
    const LAYER_ID_LABELS = 'annonces-labels-layer'; // Reste inchangé

    // SUPPRESSION DES CONSTANTES LIÉES AUX BÂTIMENTS 3D
    // const SOURCE_NAME_BUILDINGS = 'maptiler_planet';
    // const SOURCE_LAYER_NAME_BUILDINGS = 'building';
    // const LAYER_ID_BUILDINGS_3D = 'buildings-3d-layer';

    const listContainer = document.getElementById(LIST_CONTAINER_ID); // Reste inchangé
    const mobileToggleButton = document.getElementById(MOBILE_TOGGLE_BUTTON_ID); // Reste inchangé

    let map = null; // Reste inchangé
    let allAnnouncements = []; // Reste inchangé
    let isMobile = window.innerWidth < 768; // Reste inchangé
    let currentPopup = null; // Reste inchangé
    let selectedPinId = null; // Reste inchangé
    // SUPPRESSION DE LA VARIABLE LIÉE AUX BÂTIMENTS 3D
    // let currentHighlightedBuildingIds = new Set();

    const mobileBottomSheet = document.getElementById('mobile-bottom-sheet'); // Reste inchangé
    const mobileBottomSheetContent = document.getElementById('mobile-bottom-sheet-content'); // Reste inchangé
    const bottomSheetCloseButton = document.getElementById('bottom-sheet-close-button'); // Reste inchangé

     // VÉRIFICATION IMMÉDIATE DES ÉLÉMENTS
    console.log('[DEBUG_MODAL_INIT] mobileBottomSheet trouvé:', mobileBottomSheet);
    console.log('[DEBUG_MODAL_INIT] mobileBottomSheetContent trouvé:', mobileBottomSheetContent);
    console.log('[DEBUG_MODAL_INIT] bottomSheetCloseButton trouvé:', bottomSheetCloseButton);

    if (!mobileBottomSheet || !mobileBottomSheetContent || !bottomSheetCloseButton) {
        console.error("ERREUR CRITIQUE: Un ou plusieurs éléments de la modale mobile sont INTROUVABLES. Vérifiez les IDs HTML !");
        // return; // Vous pourriez vouloir arrêter ici si les éléments sont manquants
    }

    window.addEventListener('resize', () => {
        const newIsMobile = window.innerWidth < 768;
        if (newIsMobile !== isMobile) { // Si l'état mobile a changé
            console.log('[DEBUG_MODAL_RESIZE] isMobile a changé pour:', newIsMobile);
            isMobile = newIsMobile;
        }

        if (isMobile && currentPopup) {
            console.log('[DEBUG_MODAL_RESIZE] Passage en mobile, fermeture popup desktop.');
            currentPopup.remove();
            currentPopup = null;
        }
        if (!isMobile && mobileBottomSheet && mobileBottomSheet.classList.contains('visible')) {
            console.log('[DEBUG_MODAL_RESIZE] Passage en desktop, fermeture modale mobile.');
            closeMobileBottomSheet();
        }
    });

    if (bottomSheetCloseButton) {
        bottomSheetCloseButton.addEventListener('click', () => {
            console.log('[DEBUG_MODAL] Clic sur bouton fermer de la modale mobile.');
            closeMobileBottomSheet();
        });
    }

    document.addEventListener('annoncesChargeesEtRendues', (event) => { // Reste inchangé
        const annonces = event.detail.annonces;
        if (!annonces || !Array.isArray(annonces)) return;
        
        allAnnouncements = annonces;
        const geojsonData = convertAnnoncesToGeoJSON(allAnnouncements);

        if (!map) {
            initializeMap(geojsonData);
        } else {
            map.getSource(SOURCE_ID_ANNONCES).setData(geojsonData);
            // SUPPRESSION DE L'APPEL A mettreAJourBatimentsSelectionnes
            // if (map.isStyleLoaded()) {
            //      mettreAJourBatimentsSelectionnes(allAnnouncements);
            // }
            if (geojsonData.features.length > 0) {
                 const bounds = getBounds(geojsonData);
                 map.fitBounds(bounds, { padding: 80, maxZoom: 16 });
            } else { 
                map.flyTo({ center: [2.3522, 48.8566], zoom: 11 }); 
            }
        }
    });

    function convertAnnoncesToGeoJSON(annonces) { // Reste inchangé
        const features = annonces.map(annonce => {
            const lat = getNestedValue(annonce, 'geo_location.data.lat');
            const lng = getNestedValue(annonce, 'geo_location.data.lng');
            if (annonce.id === undefined || annonce.id === null || lat === undefined || lng === undefined) return null;
            let featureId = parseInt(annonce.id, 10);
            if (isNaN(featureId)) return null;
            return { type: 'Feature', id: featureId, geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] }, properties: { id: featureId, id_str: String(annonce.id), price: getNestedValue(annonce, '_property_lease_of_property.0.loyer') || '?', title: getNestedValue(annonce, 'property_title'), coverPhoto: getNestedValue(annonce, '_property_photos.0.images.0.url') } };
        }).filter(Boolean);
        return { type: 'FeatureCollection', features };
    }

    // SUPPRESSION DE LA FONCTION mettreAJourBatimentsSelectionnes
    /*
    async function mettreAJourBatimentsSelectionnes(annonces) {
        // ... tout le contenu de la fonction est supprimé ...
    }
    */

    function getBounds(geojson) { // Reste inchangé
        const bounds = new maplibregl.LngLatBounds();
        geojson.features.forEach(feature => {
            bounds.extend(feature.geometry.coordinates);
        });
        return bounds;
    }

    function initializeMap(initialGeoJSON) { // Modifié
        map = new maplibregl.Map({
            container: MAP_CONTAINER_ID,
            style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_API_KEY}`,
            pitch: 50, // Vous pouvez réduire à 0 si vous n'utilisez plus la 3D
            bearing: -15, // Vous pouvez réduire à 0 si vous n'utilisez plus la 3D
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
            console.log('[MAP_SCRIPT V11] Carte chargée. Ajout des couches (sans bâtiments 3D).');
            map.addSource(SOURCE_ID_ANNONCES, { type: 'geojson', data: initialGeoJSON, promoteId: 'id' });

            // SUPPRESSION DE L'AJOUT DE LA COUCHE LAYER_ID_BUILDINGS_3D
            /*
            const heightExpression = ['coalesce', ['get', 'height'], 20]; 
            const minHeightExpression = ['coalesce', ['get', 'min_height'], 0];

            map.addLayer({
                'id': LAYER_ID_BUILDINGS_3D,
                // ...
            }, LAYER_ID_PINS); // Cette ligne causait l'erreur
            */
            
            // Ajout des couches Pins et Labels directement
            map.addLayer({
                id: LAYER_ID_PINS, type: 'circle', source: SOURCE_ID_ANNONCES,
                paint: { 'circle-radius': 26, 'circle-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#007bff', '#FFFFFF'], 'circle-stroke-width': ['case', ['boolean', ['feature-state', 'selected'], false], 1, 1.5], 'circle-stroke-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#FFFFFF', '#eeeeee'] }
            });
            map.addLayer({
                id: LAYER_ID_LABELS, type: 'symbol', source: SOURCE_ID_ANNONCES,
                layout: { 'text-field': ['concat', ['to-string', ['get', 'price']], '€'],'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'], 'text-size': 14, 'text-allow-overlap': false },
                paint: { 'text-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#FFFFFF', '#333333'] }
            });
            
            map.on('click', LAYER_ID_PINS, handleMapClick);
            map.on('mouseenter', LAYER_ID_PINS, () => map.getCanvas().style.cursor = 'pointer');
            map.on('mouseleave', LAYER_ID_PINS, () => map.getCanvas().style.cursor = '');
            map.on('moveend', updateVisibleList);

            updateVisibleList();
            // SUPPRESSION DE L'APPEL A mettreAJourBatimentsSelectionnes
            // mettreAJourBatimentsSelectionnes(allAnnouncements); 
        });

        map.addControl(new maplibregl.NavigationControl(), 'top-right');
    }
    
    function updateVisibleList() { // Reste inchangé
        if (!map || !map.isStyleLoaded() || !listContainer) return;
        const visibleFeatures = map.queryRenderedFeatures({ layers: [LAYER_ID_PINS] });
        const visiblePropertyIds = new Set(visibleFeatures.map(feature => String(feature.properties.id)));
        const allListItems = listContainer.querySelectorAll('[data-property-id]');
        allListItems.forEach(itemDiv => {
            const itemIdString = itemDiv.dataset.propertyId;
            const anchorTag = itemDiv.parentElement;
            if (!anchorTag || anchorTag.tagName !== 'A') { itemDiv.style.display = visiblePropertyIds.has(itemIdString) ? '' : 'none'; return; }
            if (visiblePropertyIds.has(itemIdString)) { anchorTag.classList.remove('annonce-list-item-hidden'); } 
            else { anchorTag.classList.add('annonce-list-item-hidden'); }
        });
        if (isMobile && mobileToggleButton) { mobileToggleButton.textContent = `Voir les ${visiblePropertyIds.size} logements`; }
    }

    function createPopupHTML(properties) { // Reste inchangé
        const placeholderImage = 'https://via.placeholder.com/280x150/cccccc/969696?text=Image';
        const coverPhoto = properties.coverPhoto || placeholderImage;
        const title = properties.title || "Titre non disponible";
        const priceText = `${properties.price || '?'} € / mois`;
        const detailLink = `annonce?id=${properties.id_str}`;
        return `<div class="map-custom-popup"><img src="${coverPhoto}" alt="${title}" class="popup-image" onerror="this.src='${placeholderImage}'"><div class="popup-info"><h4 class="popup-title">${title}</h4><p class="popup-price">${priceText}</p><a href="${detailLink}" class="popup-link" target="_blank">Voir détails</a></div></div>`;
    }
    
    function openMobileBottomSheet(properties) {
        console.log('[DEBUG_MODAL] Appel de openMobileBottomSheet. Properties:', properties);
        if (!mobileBottomSheet || !mobileBottomSheetContent) {
            console.error('[DEBUG_MODAL] Dans openMobileBottomSheet: Éléments de la modale non trouvés !');
            return;
        }
        console.log('[DEBUG_MODAL] Éléments modale OK. Contenu HTML en création...');
        const contentHTML = createPopupHTML(properties);
        mobileBottomSheetContent.innerHTML = contentHTML;
        console.log('[DEBUG_MODAL] Contenu injecté. Ajout de la classe "visible". Actuel classes:', mobileBottomSheet.classList);
        mobileBottomSheet.classList.add('visible');
        console.log('[DEBUG_MODAL] Classe "visible" ajoutée. Nouvelles classes:', mobileBottomSheet.classList);
    }

    function closeMobileBottomSheet() {
        console.log('[DEBUG_MODAL] Appel de closeMobileBottomSheet.');
        if (!mobileBottomSheet) {
            console.error('[DEBUG_MODAL] Dans closeMobileBottomSheet: Élément mobileBottomSheet non trouvé !');
            return;
        }
        mobileBottomSheet.classList.remove('visible');
        console.log('[DEBUG_MODAL] Classe "visible" retirée.');
        
        // setTimeout(() => { // Optionnel, pour vider après transition
        //     if (mobileBottomSheetContent) mobileBottomSheetContent.innerHTML = '';
        // }, 350); 

        if (map && selectedPinId !== null) {
            console.log('[DEBUG_MODAL] Désélection du pin ID:', selectedPinId);
            map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: selectedPinId }, { selected: false });
            selectedPinId = null;
        }
    }

    function handleMapClick(e) {
        console.log('[DEBUG_MODAL] handleMapClick déclenché!');
        console.log('[DEBUG_MODAL] Valeur de isMobile au moment du clic:', isMobile);

        if (e.features && e.features.length > 0) {
            const feature = e.features[0];
            // ... (reste de la logique pour properties, clickedPinId)
            const properties = feature.properties;
            const clickedPinId = feature.id;
            console.log('[DEBUG_MODAL] Clic sur Pin ID:', clickedPinId, 'isMobile:', isMobile);


            if (selectedPinId !== null && selectedPinId !== clickedPinId) {
                map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: selectedPinId }, { selected: false });
            }
            map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: clickedPinId }, { selected: true });
            selectedPinId = clickedPinId;

            if (isMobile) {
                console.log('[DEBUG_MODAL] Condition isMobile VRAIE. Tentative d\'ouverture de la modale mobile.');
                if (currentPopup) {
                    currentPopup.remove();
                    currentPopup = null;
                }
                openMobileBottomSheet(properties);
            } else {
                console.log('[DEBUG_MODAL] Condition isMobile FAUSSE. Tentative d\'ouverture du popup desktop.');
                if (mobileBottomSheet && mobileBottomSheet.classList.contains('visible')) {
                    closeMobileBottomSheet();
                }
                if (currentPopup) currentPopup.remove();

                const popupHTML = createPopupHTML(properties);
                currentPopup = new maplibregl.Popup({ offset: 10, closeButton: true, className: 'airbnb-style-popup' })
                    .setLngLat(feature.geometry.coordinates.slice()) // Assurez-vous d'utiliser les bonnes coordonnées
                    .setHTML(popupHTML)
                    .addTo(map);

                currentPopup.on('close', () => {
                    if (selectedPinId === clickedPinId) {
                        map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: selectedPinId }, { selected: false });
                        selectedPinId = null;
                    }
                    currentPopup = null;
                });
            }
        } else {
            console.log('[DEBUG_MODAL] Clic sur la carte mais pas sur un feature (pin).');
        }
    }

    function getNestedValue(obj, path) { // Reste inchangé
        if (!path) return undefined;
        return path.split('.').reduce((acc, part) => (acc && acc[part] !== undefined) ? (isNaN(parseInt(part, 10)) ? acc[part] : acc[parseInt(part, 10)]) : undefined, obj);
    }
    
    if (isMobile && mobileToggleButton) { // Reste inchangé
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

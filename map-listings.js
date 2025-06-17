// map-listings.js - VERSION MODIFIÉE AVEC BOTTOM SHEET MOBILE
document.addEventListener('DOMContentLoaded', function() {
    console.log('[MAP_SCRIPT V12] Intégration de la bottom sheet mobile.'); // Versionning

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

    // NOUVEAU : Références aux éléments de la Bottom Sheet
    const mobileBottomSheet = document.getElementById('mobile-bottom-sheet'); 
    const mobileBottomSheetContent = document.getElementById('mobile-bottom-sheet-content'); 
    const bottomSheetCloseButton = document.getElementById('bottom-sheet-close-button'); 

    // MODIFIÉ : Le listener de redimensionnement gère maintenant aussi la bottom sheet
    window.addEventListener('resize', () => { 
        isMobile = window.innerWidth < 768;
        // Si on passe en mobile et qu'un popup desktop est ouvert, on le ferme
        if (isMobile && currentPopup) {
            currentPopup.remove();
            currentPopup = null;
        }
        // Si on passe en desktop et que la bottom sheet mobile est ouverte, on la ferme
        if (!isMobile && mobileBottomSheet && mobileBottomSheet.classList.contains('visible')) {
            closeMobileBottomSheet();
        }
    });

    // NOUVEAU : Écouteur pour le bouton de fermeture de la bottom sheet
    if (bottomSheetCloseButton) { 
        bottomSheetCloseButton.addEventListener('click', closeMobileBottomSheet);
    }
    
    // NOUVEAU : Fermer la bottom sheet si on clique sur la carte en dehors d'un pin
    function onMapBackgroundClick(e) {
        // Cette condition vérifie si le clic a eu lieu sur la carte mais pas sur un pin
        if (e.defaultPrevented === false) { // `handleMapClick` met `defaultPrevented` à true
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
            const lat = getNestedValue(annonce, 'geo_location.data.lat');
            const lng = getNestedValue(annonce, 'geo_location.data.lng');
            if (annonce.id === undefined || annonce.id === null || lat === undefined || lng === undefined) return null;
            let featureId = parseInt(annonce.id, 10);
            if (isNaN(featureId)) return null;
            return { type: 'Feature', id: featureId, geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] }, properties: { id: featureId, id_str: String(annonce.id), price: getNestedValue(annonce, '_property_lease_of_property.0.loyer') || '?', title: getNestedValue(annonce, 'property_title'), coverPhoto: getNestedValue(annonce, '_property_photos.0.images.0.url') } };
        }).filter(Boolean);
        return { type: 'FeatureCollection', features };
    }

    function getBounds(geojson) { 
        const bounds = new maplibregl.LngLatBounds();
        geojson.features.forEach(feature => {
            bounds.extend(feature.geometry.coordinates);
        });
        return bounds;
    }

    function initializeMap(initialGeoJSON) { 
        map = new maplibregl.Map({
            container: MAP_CONTAINER_ID,
            style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_API_KEY}`,
            pitch: 50, 
            bearing: -15, 
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
            console.log('[MAP_SCRIPT V12] Carte chargée.');
            map.addSource(SOURCE_ID_ANNONCES, { type: 'geojson', data: initialGeoJSON, promoteId: 'id' });
            
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
            map.on('click', onMapBackgroundClick); // NOUVEAU : Listener de clic sur le fond de la carte
            map.on('mouseenter', LAYER_ID_PINS, () => map.getCanvas().style.cursor = 'pointer');
            map.on('mouseleave', LAYER_ID_PINS, () => map.getCanvas().style.cursor = '');
            map.on('moveend', updateVisibleList);

            updateVisibleList();
        });

        map.addControl(new maplibregl.NavigationControl(), 'top-right');
    }
    
    function updateVisibleList() { 
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

    function createPopupHTML(properties) {
        // MODIFIÉ : Légère simplification pour fonctionner dans les deux contextes
        const placeholderImage = 'https://via.placeholder.com/280x150/cccccc/969696?text=Image';
        const coverPhoto = properties.coverPhoto || placeholderImage;
        const title = properties.title || "Titre non disponible";
        const priceText = `${properties.price || '?'} € / mois`;
        const detailLink = `annonce?id=${properties.id_str}`;
        // La div englobante 'map-custom-popup' est ajoutée ici
        return `<div class="map-custom-popup">
                    <img src="${coverPhoto}" alt="${title}" class="popup-image" onerror="this.src='${placeholderImage}'">
                    <div class="popup-info">
                        <h4 class="popup-title">${title}</h4>
                        <p class="popup-price">${priceText}</p>
                        <a href="${detailLink}" class="popup-link" target="_blank">Voir détails</a>
                    </div>
                </div>`;
    }
    
    // NOUVEAU : Fonction pour ouvrir la bottom sheet sur mobile
    function openMobileBottomSheet(properties) { 
        if (!mobileBottomSheet || !mobileBottomSheetContent) return;
        const contentHTML = createPopupHTML(properties);
        mobileBottomSheetContent.innerHTML = contentHTML;
        mobileBottomSheet.classList.add('visible');
    }
    
    // NOUVEAU : Fonction pour fermer la bottom sheet
    function closeMobileBottomSheet() { 
        if (!mobileBottomSheet) return;
        mobileBottomSheet.classList.remove('visible');
        // Vider le contenu après la fin de l'animation de fermeture
        setTimeout(() => {
            if (mobileBottomSheetContent) mobileBottomSheetContent.innerHTML = '';
        }, 300); // 300ms correspond à la durée de la transition CSS
        
        // Déselectionner le pin sur la carte
        if (map && selectedPinId !== null) {
            map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: selectedPinId }, { selected: false });
            selectedPinId = null; 
        }
    }
    
    // MODIFIÉ : La fonction de clic sur la carte gère maintenant les deux cas (desktop/mobile)
    function handleMapClick(e) { 
        e.preventDefault(); // Empêche le listener `onMapBackgroundClick` de se déclencher
        if (e.features && e.features.length > 0) {
            const feature = e.features[0];
            const coordinates = feature.geometry.coordinates.slice(); 
            const properties = feature.properties;
            const clickedPinId = feature.id;

            // Gérer la déselection de l'ancien pin
            if (selectedPinId !== null && selectedPinId !== clickedPinId) {
                map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: selectedPinId }, { selected: false });
            }
            // Sélectionner le nouveau pin
            map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: clickedPinId }, { selected: true });
            selectedPinId = clickedPinId; 

            // LOGIQUE CONDITIONNELLE : MOBILE vs DESKTOP
            if (isMobile) {
                // Sur mobile, on ferme le popup desktop s'il existe par hasard
                if (currentPopup) {
                    currentPopup.remove();
                    currentPopup = null;
                }
                // Et on ouvre notre nouvelle bottom sheet
                openMobileBottomSheet(properties);

            } else {
                // Sur desktop, on ferme la bottom sheet si elle est ouverte
                if (mobileBottomSheet && mobileBottomSheet.classList.contains('visible')) {
                    closeMobileBottomSheet(); 
                }
                // Et on utilise le popup classique
                if (currentPopup) currentPopup.remove(); 

                const popupHTML = createPopupHTML(properties);
                currentPopup = new maplibregl.Popup({ offset: 25, closeButton: true, className: 'airbnb-style-popup' })
                    .setLngLat(coordinates)
                    .setHTML(popupHTML)
                    .addTo(map);

                // Gérer la fermeture du popup desktop
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

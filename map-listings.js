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
    let hoverPopup = null; // NOUVEAU : Pour gérer le popup de survol

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
    
    // =================================================================================
    // == SECTION ENTIÈREMENT NOUVELLE ET REFACTORISÉE POUR L'AFFICHAGE DE LA CARTE ==
    // =================================================================================
    
    // NOUVEAU : Helper pour créer une icône de cercle pour MapLibre
    // Cela nous permet de ne pas dépendre d'une image externe.
    const createCircleSdf = (size) => {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext('2d');
        const radius = size / 2;
        context.beginPath();
        context.arc(radius, radius, radius - 2, 0, 2 * Math.PI, false);
        context.fillStyle = 'white';
        context.fill();
        return context.getImageData(0, 0, size, size);
    };


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
            // NOUVEAU : On ajoute notre icône de cercle générée au style de la carte
            map.addImage('circle-background', createCircleSdf(64), { sdf: true });

            map.addSource(SOURCE_ID_ANNONCES, { type: 'geojson', data: initialGeoJSON, promoteId: 'id' });
            
            // COUCHE 1 : LES PETITS POINTS (toujours visibles)
            // Cette couche affiche un petit point pour CHAQUE annonce.
            map.addLayer({
                id: LAYER_ID_DOTS,
                type: 'circle',
                source: SOURCE_ID_ANNONCES,
                paint: {
                    'circle-radius': 5,
                    'circle-color': '#FFFFFF',
                    'circle-stroke-width': 1,
                    'circle-stroke-color': '#B4B4B4'
                }
            });

            // COUCHE 2 : LES BULLES DE PRIX (atomiques)
            // Cette couche tente d'afficher une icône de cercle ET un prix par-dessus la couche de points.
            // Si elle ne peut pas (collision), elle ne s'affiche pas, laissant le point de la couche 1 visible.
            map.addLayer({
                id: LAYER_ID_PRICES,
                type: 'symbol',
                source: SOURCE_ID_ANNONCES,
                layout: {
                    'icon-image': 'circle-background', // Utilise notre icône
                    'icon-size': 0.9,
                    'text-field': ['concat', ['to-string', ['get', 'price']], '€'],
                    'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                    'text-size': 14,
                    'icon-allow-overlap': false, // Ne pas afficher l'icône si elle chevauche
                    'text-allow-overlap': false, // Ne pas afficher le texte s'il chevauche
                    'icon-anchor': 'center',
                    'text-anchor': 'center'
                },
                paint: {
                    'icon-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#000000', '#FFFFFF'],
                    'text-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#FFFFFF', '#333333']
                }
            });

            // GESTION DU SURVOL (HOVER) SUR LES PETITS POINTS
            map.on('mouseenter', LAYER_ID_DOTS, (e) => {
                if (e.features.length > 0) {
                    map.getCanvas().style.cursor = 'pointer';
                    const properties = e.features[0].properties;
                    const coordinates = e.features[0].geometry.coordinates.slice();

                    // On crée un popup qui ressemble à nos bulles de prix
                    hoverPopup = new maplibregl.Popup({
                        closeButton: false,
                        offset: 10,
                        anchor: 'bottom',
                        className: 'hover-popup'
                    })
                    .setLngLat(coordinates)
                    .setHTML(`<div class="hover-popup-content">${properties.price}€</div>`)
                    .addTo(map);
                }
            });

            map.on('mouseleave', LAYER_ID_DOTS, () => {
                map.getCanvas().style.cursor = '';
                if(hoverPopup) {
                    hoverPopup.remove();
                    hoverPopup = null;
                }
            });
            
            // GESTION DU CLIC (identique mais sur les deux couches)
            map.on('click', [LAYER_ID_DOTS, LAYER_ID_PRICES], handleMapClick);

            // NOUVEAU : On attend que la carte soit "idle" pour la première synchro de la liste
            map.on('idle', () => {
                updateVisibleList();
            });

            map.on('moveend', () => {
                updateVisibleList();
            });
        });
        map.addControl(new maplibregl.NavigationControl(), 'top-right');
    }

    // Le reste du fichier est quasi identique, j'ai juste retiré les fonctions devenues inutiles.
    function updateVisibleList() {
        if (!map || !map.isStyleLoaded() || !listContainer) return;
        const visibleFeatures = map.queryRenderedFeatures({ layers: [LAYER_ID_DOTS] }); // On se base sur les points
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

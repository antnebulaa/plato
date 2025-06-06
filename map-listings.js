// map-listings.js - VERSION 12.3 STABLE - Correction ReferenceError et structure
document.addEventListener('DOMContentLoaded', function() {
    console.log('[MAP_SCRIPT V12.3] Initialisation du script de carte (version stable).');

    // --- Constantes de configuration ---
    const MAPTILER_API_KEY = 'UsgTlLJiePXeSnyh57aL'; // Conservez votre clé
    const MAP_CONTAINER_ID = 'map-section';
    const LIST_CONTAINER_ID = 'annonces-wrapper';
    const MOBILE_TOGGLE_BUTTON_ID = 'mobile-map-toggle';
    const SOURCE_ID_ANNONCES = 'annonces-source';
    const LAYER_ID_PINS = 'annonces-pins-layer';
    const LAYER_ID_LABELS = 'annonces-labels-layer';
    
    // --- Variables d'état ---
    let map = null;
    let isMobile = window.innerWidth < 768;
    let currentPopup = null;
    let selectedPinId = null;

    // =====================================================================
    // --- 1. FONCTIONS UTILITAIRES (Définies en premier pour être disponibles partout) ---
    // =====================================================================

    function getNestedValue(obj, path) {
        if (!obj || !path) return undefined;
        return path.split('.').reduce((acc, part) => {
            if (acc === null || acc === undefined) return undefined;
            const index = !isNaN(parseInt(part, 10)) ? parseInt(part, 10) : -1;
            if (Array.isArray(acc) && index !== -1 && acc.length > index) {
                return acc[index];
            }
            if (typeof acc === 'object' && part in acc) {
                return acc[part];
            }
            return undefined;
        }, obj);
    }

    function convertAnnoncesToGeoJSON(annonces) {
        const features = (annonces || []).map(annonce => {
            const lat = getNestedValue(annonce, 'geo_location.data.lat');
            const lng = getNestedValue(annonce, 'geo_location.data.lng');
            
            if (annonce.id === undefined || lat === undefined || lng === undefined) {
                return null;
            }
            let featureId = parseInt(annonce.id, 10);
            if (isNaN(featureId)) return null;

            return {
                type: 'Feature',
                id: featureId,
                geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
                properties: {
                    id: featureId,
                    id_str: String(annonce.id),
                    price: getNestedValue(annonce, '_property_lease_of_property.0.loyer'),
                    title: getNestedValue(annonce, 'property_title'),
                    coverPhoto: getNestedValue(annonce, '_property_photos.0.images.0.url'),
                    city: getNestedValue(annonce, 'city'),
                    type: getNestedValue(annonce, 'house_type.0') || getNestedValue(annonce, 'house_type') || "Logement",
                }
            };
        }).filter(Boolean);
        return { type: 'FeatureCollection', features };
    }
    
    function getBounds(geojson) {
        const bounds = new maplibregl.LngLatBounds();
        if (geojson && geojson.features) {
            geojson.features.forEach(feature => {
                if (feature.geometry && Array.isArray(feature.geometry.coordinates) && feature.geometry.coordinates.length === 2) {
                    bounds.extend(feature.geometry.coordinates);
                }
            });
        }
        return bounds;
    }

    function createMobileInfoCardHTML(properties) {
        const placeholderImage = 'https://via.placeholder.com/400x225/cccccc/969696?text=Image';
        const coverPhoto = properties.coverPhoto || placeholderImage;
        const title = properties.title || "Titre non disponible";
        const priceText = properties.price ? `<strong>${properties.price} €</strong> par mois` : "";
        const ratingDisplay = `★ 4.64 (314)`; // Placeholder, à remplacer par vos vraies données

        return `
            <div class="info-card-mobile">
                <a href="annonce?id=${properties.id_str}" style="text-decoration: none; color: inherit; display: block;">
                    <div class="info-card-mobile__image-container">
                        <img src="${coverPhoto}" alt="Photo de ${title}" class="info-card-mobile__image" onerror="this.src='${placeholderImage}'">
                    </div>
                    <div class="info-card-mobile__details">
                        <h4 class="info-card-mobile__title">${title}</h4>
                        <div class="info-card-mobile__rating">${ratingDisplay}</div>
                        <div class="info-card-mobile__price">${priceText}</div>
                    </div>
                </a>
                <button id="info-card-mobile-close-btn" class="info-card-mobile__close-btn" aria-label="Fermer">&times;</button>
            </div>
        `;
    }
    
    function createDesktopPopupHTML(properties) {
        const title = properties.title || "Titre non disponible";
        const priceText = properties.price ? `<strong>${properties.price}€</strong>` : "";
        return `<a href="annonce?id=${properties.id_str}" class="desktop-popup-link"><div>${title}</div><div>${priceText}</div></a>`;
    }

    // =====================================================================
    // --- 2. FONCTIONS DE GESTION DE LA CARTE ---
    // =====================================================================

    function openMobileInfoCard(properties) {
        const mobileInfoCardContainer = document.getElementById('mobile-bottom-sheet');
        const mobileInfoCardContent = document.getElementById('mobile-bottom-sheet-content');

        if (!mobileInfoCardContainer || !mobileInfoCardContent) {
            console.error('[INFO_CARD] Conteneur de la carte info mobile introuvable.');
            return;
        }
        
        mobileInfoCardContent.innerHTML = createMobileInfoCardHTML(properties);
        mobileInfoCardContainer.classList.add('visible');
        
        const newCloseButton = document.getElementById('info-card-mobile-close-btn');
        if (newCloseButton) {
            newCloseButton.addEventListener('click', closeMobileInfoCard, { once: true });
        }
    }

    function closeMobileInfoCard() {
        const mobileInfoCardContainer = document.getElementById('mobile-bottom-sheet');
        if (!mobileInfoCardContainer) return;
        
        mobileInfoCardContainer.classList.remove('visible');
        
        if (map && selectedPinId !== null) {
            map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: selectedPinId }, { selected: false });
            selectedPinId = null;
        }
    }

    function handlePinClick(e) {
        if (e.features && e.features.length > 0) {
            e.originalEvent.stopPropagation();

            const feature = e.features[0];
            const properties = feature.properties;
            const clickedPinId = feature.id;

            if (selectedPinId !== null) {
                map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: selectedPinId }, { selected: false });
            }
            map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: clickedPinId }, { selected: true });
            selectedPinId = clickedPinId;

            if (isMobile) {
                openMobileInfoCard(properties);
            } else {
                if (currentPopup) currentPopup.remove();
                currentPopup = new maplibregl.Popup({ offset: 25, closeButton: false, className: 'desktop-map-popup' })
                    .setLngLat(feature.geometry.coordinates)
                    .setHTML(createDesktopPopupHTML(properties))
                    .addTo(map);
            }
        }
    }

    function handleMapGeneralClick(e) {
        if (!map.queryRenderedFeatures(e.point, { layers: [LAYER_ID_PINS] }).length) {
            if (isMobile) {
                closeMobileInfoCard();
            } else {
                if (currentPopup) currentPopup.remove();
                if (selectedPinId !== null) {
                    map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: selectedPinId }, { selected: false });
                    selectedPinId = null;
                }
            }
        }
    }

    function updateVisibleList() {
        if (!map || !map.isStyleLoaded()) return;

        const listContainer = document.getElementById(LIST_CONTAINER_ID);
        const mobileToggleButton = document.getElementById(MOBILE_TOGGLE_BUTTON_ID);
        if (!listContainer) return;
        
        const visibleFeatures = map.queryRenderedFeatures({ layers: [LAYER_ID_PINS] });
        const visiblePropertyIds = new Set(visibleFeatures.map(feature => String(feature.properties.id)));
        
        const allListItems = listContainer.querySelectorAll('[data-property-id]');
        allListItems.forEach(itemDivOrAnchor => {
            let targetElement = itemDivOrAnchor.parentElement && itemDivOrAnchor.parentElement.tagName === 'A' ? itemDivOrAnchor.parentElement : itemDivOrAnchor;
            targetElement.style.display = visiblePropertyIds.has(itemDivOrAnchor.dataset.propertyId) ? '' : 'none';
        });

        if (isMobile && mobileToggleButton) {
            mobileToggleButton.textContent = `Voir les ${visiblePropertyIds.size} logements`;
        }
    }

    function initializeMap(initialGeoJSON) {
        if (map) return;
        
        map = new maplibregl.Map({
            container: MAP_CONTAINER_ID,
            style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_API_KEY}`,
            center: [2.3522, 48.8566],
            zoom: 11
        });
        
        map.on('load', () => {
            console.log('[MAP] Carte chargée.');
            map.addSource(SOURCE_ID_ANNONCES, { type: 'geojson', data: initialGeoJSON, promoteId: 'id' });
            
            map.addLayer({
                id: LAYER_ID_PINS,
                type: 'circle',
                source: SOURCE_ID_ANNONCES,
                paint: {
                    'circle-radius': 26,
                    'circle-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#222222', '#FFFFFF'],
                    'circle-stroke-width': 1.5,
                    'circle-stroke-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#FFFFFF', '#dddddd']
                }
            });
            map.addLayer({
                id: LAYER_ID_LABELS,
                type: 'symbol',
                source: SOURCE_ID_ANNONCES,
                layout: {
                    'text-field': ['concat', ['to-string', ['get', 'price']], '€'],
                    'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                    'text-size': 14,
                    'text-allow-overlap': true
                },
                paint: { 'text-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#FFFFFF', '#333333'] }
            });

            map.on('click', LAYER_ID_PINS, handlePinClick);
            map.on('click', handleMapGeneralClick);
            map.on('mouseenter', LAYER_ID_PINS, () => map.getCanvas().style.cursor = 'pointer');
            map.on('mouseleave', LAYER_ID_PINS, () => map.getCanvas().style.cursor = '');
            map.on('moveend', updateVisibleList);

            if (initialGeoJSON && initialGeoJSON.features.length > 0) {
                const bounds = getBounds(initialGeoJSON);
                if (!bounds.isEmpty()) { // CORRECTION ICI
                    map.fitBounds(bounds, { padding: 80, duration: 0, maxZoom: 16 });
                }
            }
            updateVisibleList();
        });

        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    }

    // =====================================================================
    // --- 3. ÉCOUTEURS D'ÉVÉNEMENTS ET INITIALISATION ---
    // =====================================================================

    window.addEventListener('resize', () => {
        isMobile = window.innerWidth < 768;
        const mobileToggleButton = document.getElementById(MOBILE_TOGGLE_BUTTON_ID);
        if (mobileToggleButton) mobileToggleButton.style.display = isMobile ? 'block' : 'none';
        
        // Gérer le basculement entre les popups/cartes lors du redimensionnement
        if (isMobile && currentPopup) {
            currentPopup.remove();
            currentPopup = null;
        }
        const mobileInfoCard = document.getElementById('mobile-bottom-sheet');
        if (!isMobile && mobileInfoCard && mobileInfoCard.classList.contains('visible')) {
            closeMobileInfoCard();
        }
    });

    document.addEventListener('annoncesChargeesEtRendues', (event) => {
        const annonces = event.detail.annonces || [];
        console.log(`[EVENT] ${annonces.length} annonces reçues.`);
        const geojsonData = convertAnnoncesToGeoJSON(annonces); // APPEL SÛR ICI

        if (!map) {
            initializeMap(geojsonData);
        } else {
            const source = map.getSource(SOURCE_ID_ANNONCES);
            if (source) {
                source.setData(geojsonData);
                if (geojsonData.features.length > 0) {
                    const bounds = getBounds(geojsonData);
                    if (!bounds.isEmpty()) { // CORRECTION ICI
                        map.fitBounds(bounds, { padding: 80, maxZoom: 16 });
                    }
                }
            }
        }
    });

    const mobileToggleButton = document.getElementById(MOBILE_TOGGLE_BUTTON_ID);
    if (mobileToggleButton) {
        mobileToggleButton.style.display = isMobile ? 'block' : 'none';
        mobileToggleButton.addEventListener('click', () => {
            document.body.classList.toggle('map-is-active');
            if (map && document.body.classList.contains('map-is-active')) {
                map.resize();
            }
        });
    }

});

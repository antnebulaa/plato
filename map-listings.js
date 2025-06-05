// map-listings.js - VERSION 12.1 - Correction bounds.isValid
document.addEventListener('DOMContentLoaded', function() {
    console.log('[MAP_SCRIPT V12.1] Correction bounds.isValid.');

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

    const mobileInfoCardContainer = document.getElementById('mobile-bottom-sheet');
    const mobileInfoCardContent = document.getElementById('mobile-bottom-sheet-content');

    window.addEventListener('resize', () => {
        const newIsMobile = window.innerWidth < 768;
        if (newIsMobile !== isMobile) {
            console.log('[RESIZE] isMobile a changé pour:', newIsMobile);
            isMobile = newIsMobile;
        }
        if (isMobile && currentPopup) {
            currentPopup.remove();
            currentPopup = null;
        }
        if (!isMobile && mobileInfoCardContainer && mobileInfoCardContainer.classList.contains('visible')) {
            closeMobileInfoCard();
        }
         // Mettre à jour la visibilité du bouton toggle au redimensionnement
        if (mobileToggleButton) {
            if (isMobile) {
                mobileToggleButton.style.display = 'block';
            } else {
                mobileToggleButton.style.display = 'none';
                if (document.body.classList.contains('map-is-active')) {
                    document.body.classList.remove('map-is-active');
                }
            }
        }
    });

    document.addEventListener('annoncesChargeesEtRendues', (event) => {
        const annonces = event.detail.annonces;
        if (!annonces || !Array.isArray(annonces)) {
            console.error("[MAP_SCRIPT] Aucune annonce reçue ou format incorrect.");
            return;
        }
        
        allAnnouncements = annonces;
        const geojsonData = convertAnnoncesToGeoJSON(allAnnouncements);

        if (!map) {
            console.log("[ANNONCES_CHARGEES] La carte n'est pas encore initialisée. Appel de initializeMap.");
            initializeMap(geojsonData);
        } else {
            console.log("[ANNONCES_CHARGEES] Mise à jour de la source de données de la carte.");
            if (map.getSource(SOURCE_ID_ANNONCES)) {
                map.getSource(SOURCE_ID_ANNONCES).setData(geojsonData);
            } else {
                console.error("[MAP_SCRIPT] Source d'annonces non trouvée pour la mise à jour.");
                // Recréer la source et les couches si elles ont été supprimées ou jamais ajoutées
                if (map.isStyleLoaded()) {
                    map.addSource(SOURCE_ID_ANNONCES, { type: 'geojson', data: geojsonData, promoteId: 'id' });
                    addMapLayers(); // Fonction pour ajouter les couches si elles n'existent pas
                }
            }
            
            if (geojsonData.features.length > 0) {
                 const bounds = getBounds(geojsonData);
                 if (bounds.getSouthWest() && bounds.getNorthEast() && !bounds.getSouthWest().equals(bounds.getNorthEast())) { // CORRECTION ICI
                    map.fitBounds(bounds, { padding: 80, maxZoom: 16 });
                 } else {
                    console.warn("[ANNONCES_CHARGEES] Les limites (bounds) ne sont pas valides. Centrage par défaut.");
                    map.flyTo({ center: [2.3522, 48.8566], zoom: 11 });
                 }
            } else { 
                console.warn("[ANNONCES_CHARGEES] Aucune feature dans geojsonData. Centrage par défaut.");
                map.flyTo({ center: [2.3522, 48.8566], zoom: 11 });
            }
            // S'assurer que la liste est mise à jour après le chargement des données
            if (map.isStyleLoaded()) {
                updateVisibleList();
            } else {
                map.once('styledata', updateVisibleList);
            }
        }
    });

    function convertAnnoncesToGeoJSON(annonces) {
        const features = annonces.map(annonce => {
            const lat = getNestedValue(annonce, 'geo_location.data.lat');
            const lng = getNestedValue(annonce, 'geo_location.data.lng');
            
            if (annonce.id === undefined || annonce.id === null || lat === undefined || lng === undefined) {
                console.warn("[GEOJSON_CONVERT] Annonce avec ID ou géolocalisation manquant:", annonce.id);
                return null;
            }
            let featureId = parseInt(annonce.id, 10);
            if (isNaN(featureId)) {
                console.warn("[GEOJSON_CONVERT] ID d'annonce invalide (non numérique):", annonce.id);
                return null;
            }

            const properties = {
                id: featureId,
                id_str: String(annonce.id),
                price: getNestedValue(annonce, '_property_lease_of_property.0.loyer'),
                title: getNestedValue(annonce, 'property_title'),
                coverPhoto: getNestedValue(annonce, '_property_photos.0.images.0.url'),
                city: getNestedValue(annonce, 'city'),
                type: getNestedValue(annonce, 'house_type.0') || getNestedValue(annonce, 'house_type') || "Logement",
            };
            
            return { type: 'Feature', id: featureId, geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] }, properties: properties };
        }).filter(Boolean);
        return { type: 'FeatureCollection', features };
    }

    function getBounds(geojson) {
        const bounds = new maplibregl.LngLatBounds();
        if (geojson && geojson.features && geojson.features.length > 0) {
            geojson.features.forEach(feature => {
                if (feature.geometry && feature.geometry.coordinates &&
                    typeof feature.geometry.coordinates[0] === 'number' &&
                    typeof feature.geometry.coordinates[1] === 'number') {
                    bounds.extend(feature.geometry.coordinates);
                } else {
                    console.warn("[GET_BOUNDS] Coordonnées invalides pour la feature:", feature);
                }
            });
        }
        return bounds;
    }

    function addMapLayers() { // Nouvelle fonction pour encapsuler l'ajout des couches
        if (!map.getSource(SOURCE_ID_ANNONCES)) {
            console.error("[ADD_LAYERS] La source d'annonces n'existe pas. Impossible d'ajouter les couches.");
            return;
        }
        if (!map.getLayer(LAYER_ID_PINS)) {
            map.addLayer({
                id: LAYER_ID_PINS,
                type: 'circle',
                source: SOURCE_ID_ANNONCES,
                paint: { /* ... vos styles ... */ } // Styles copiés d'initializeMap
            });
        }
        if (!map.getLayer(LAYER_ID_LABELS)) {
            map.addLayer({
                id: LAYER_ID_LABELS,
                type: 'symbol',
                source: SOURCE_ID_ANNONCES,
                layout: { /* ... vos layouts ... */ }, // Layouts copiés d'initializeMap
                paint: { /* ... vos styles ... */ } // Styles copiés d'initializeMap
            });
        }
    }


    function initializeMap(initialGeoJSON) {
        if (map) { // Empêcher la réinitialisation si la carte existe déjà
            console.warn("[MAP_INIT] Tentative de réinitialisation d'une carte existante. Ignoré.");
            return;
        }
        console.log("[MAP_INIT] Initialisation de la carte...");
        map = new maplibregl.Map({
            container: MAP_CONTAINER_ID,
            style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_API_KEY}`,
            pitch: 0,
            bearing: 0,
            navigationControl: false,
            renderWorldCopies: false,
            attributionControl: false
        });
        map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
        
        window.map = map;

        if (initialGeoJSON && initialGeoJSON.features && initialGeoJSON.features.length > 0) {
            const bounds = getBounds(initialGeoJSON);
            if (bounds.getSouthWest() && bounds.getNorthEast() && !bounds.getSouthWest().equals(bounds.getNorthEast())) { // CORRECTION ICI
                map.fitBounds(bounds, { padding: 80, duration: 0, maxZoom: 16 });
            } else {
                console.warn("[MAP_INIT] Les limites (bounds) initiales ne sont pas valides. Centrage par défaut.");
                map.setCenter([2.3522, 48.8566]); map.setZoom(11);
            }
        } else {
            console.warn("[MAP_INIT] Pas de GeoJSON initial ou vide. Centrage par défaut.");
            map.setCenter([2.3522, 48.8566]); map.setZoom(11);
        }

        map.on('load', () => {
            console.log('[MAP_SCRIPT] Événement "load" de la carte déclenché.');
            if (!map.getSource(SOURCE_ID_ANNONCES)) {
                map.addSource(SOURCE_ID_ANNONCES, { type: 'geojson', data: initialGeoJSON, promoteId: 'id' });
            } else {
                 map.getSource(SOURCE_ID_ANNONCES).setData(initialGeoJSON); // Mettre à jour si déjà existante
            }

            // Recréation des couches avec les styles exacts
            if (!map.getLayer(LAYER_ID_PINS)) {
                map.addLayer({
                    id: LAYER_ID_PINS,
                    type: 'circle',
                    source: SOURCE_ID_ANNONCES,
                    paint: {
                        'circle-radius': 26,
                        'circle-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#007bff', '#FFFFFF'],
                        'circle-stroke-width': ['case', ['boolean', ['feature-state', 'selected'], false], 1, 1.5],
                        'circle-stroke-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#FFFFFF', '#eeeeee']
                    }
                });
            }

            if (!map.getLayer(LAYER_ID_LABELS)) {
                map.addLayer({
                    id: LAYER_ID_LABELS,
                    type: 'symbol',
                    source: SOURCE_ID_ANNONCES,
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
            }
            
            map.on('click', LAYER_ID_PINS, handleMapClick);
            map.on('click', handleMapGeneralClick);
            map.on('mouseenter', LAYER_ID_PINS, () => map.getCanvas().style.cursor = 'pointer');
            map.on('mouseleave', LAYER_ID_PINS, () => map.getCanvas().style.cursor = '');
            
            // 'moveend' devrait être le dernier pour s'assurer que tout est chargé
            map.on('moveend', updateVisibleList); 
            // Appel initial après le chargement des couches
            updateVisibleList(); 
        });
         map.on('styledata', () => { // S'assurer que les couches sont ajoutées si le style change
            if (map.getSource(SOURCE_ID_ANNONCES) && map.isStyleLoaded()) {
                addMapLayers(); // Utilise la fonction pour ajouter/vérifier les couches
            }
        });

        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    }
    
    function updateVisibleList() {
        if (!map || !map.isStyleLoaded() || !listContainer || !map.getSource(SOURCE_ID_ANNONCES)) return;
        // Vérifier si les couches existent avant de les interroger
        if (!map.getLayer(LAYER_ID_PINS)) {
            console.warn("[UPDATE_LIST] La couche de pins n'existe pas, impossible de mettre à jour la liste.");
            return;
        }
        const visibleFeatures = map.queryRenderedFeatures({ layers: [LAYER_ID_PINS] });
        const visiblePropertyIds = new Set(visibleFeatures.map(feature => String(feature.properties.id)));
        
        const allListItems = listContainer.querySelectorAll('[data-property-id]');
        allListItems.forEach(itemDivOrAnchor => {
            let targetElement = itemDivOrAnchor;
            if (itemDivOrAnchor.tagName !== 'A' && itemDivOrAnchor.parentElement && itemDivOrAnchor.parentElement.tagName === 'A') {
                targetElement = itemDivOrAnchor.parentElement;
            }
            const itemIdString = itemDivOrAnchor.dataset.propertyId;

            if (visiblePropertyIds.has(itemIdString)) {
                targetElement.classList.remove('annonce-list-item-hidden');
                targetElement.style.display = '';
            } else {
                targetElement.classList.add('annonce-list-item-hidden');
                targetElement.style.display = 'none';
            }
        });

        if (isMobile && mobileToggleButton) {
            mobileToggleButton.textContent = `Voir les ${visiblePropertyIds.size} logements`;
        }
    }

    function createMobileInfoCardHTML(properties) {
        const placeholderImage = 'https://via.placeholder.com/400x225/cccccc/969696?text=Image';
        const coverPhoto = properties.coverPhoto || placeholderImage;
        const title = properties.title || "Titre non disponible";
        const priceText = properties.price ? `<strong>${properties.price} €</strong> par mois` : "Prix non disponible";
        const location = properties.city || "Lieu non disponible";
        const type = properties.type || "Logement"; 
        const ratingDisplay = `★ 4.64 (314)`; // Placeholder

        return `
            <div class="info-card-mobile">
                <div class="info-card-mobile__image-container">
                    <img src="${coverPhoto}" alt="Photo de ${title}" class="info-card-mobile__image" onerror="this.src='${placeholderImage}'">
                    <button id="info-card-mobile-close-btn" class="info-card-mobile__close-btn" aria-label="Fermer">&times;</button>
                </div>
                <div class="info-card-mobile__details">
                    <div class="info-card-mobile__location-type">${type} · ${location}</div>
                    <h4 class="info-card-mobile__title">${title}</h4>
                    <div class="info-card-mobile__rating">${ratingDisplay}</div>
                    <div class="info-card-mobile__price">${priceText}</div>
                </div>
            </div>
        `;
    }
    
    function createDesktopPopupHTML(properties) {
        const placeholderImage = 'https://via.placeholder.com/280x150/cccccc/969696?text=Image';
        const coverPhoto = properties.coverPhoto || placeholderImage;
        const title = properties.title || "Titre non disponible";
        const priceText = `${properties.price || '?'} € / mois`;
        const detailLink = `annonce?id=${properties.id_str}`;
        return `<div class="map-custom-popup"><img src="${coverPhoto}" alt="${title}" class="popup-image" onerror="this.src='${placeholderImage}'"><div class="popup-info"><h4 class="popup-title">${title}</h4><p class="popup-price">${priceText}</p><a href="${detailLink}" class="popup-link" target="_blank">Voir détails</a></div></div>`;
    }

    function openMobileInfoCard(properties) {
        if (!mobileInfoCardContainer || !mobileInfoCardContent) {
            console.error('[INFO_CARD] Conteneur de la carte info mobile introuvable.');
            return;
        }
        
        const cardHTML = createMobileInfoCardHTML(properties);
        mobileInfoCardContent.innerHTML = cardHTML;
        
        mobileInfoCardContainer.classList.add('visible');
        document.body.classList.add('mobile-bottom-sheet-is-visible');

        const newCloseButton = document.getElementById('info-card-mobile-close-btn');
        if (newCloseButton) {
            newCloseButton.addEventListener('click', closeMobileInfoCard, { once: true });
        } else {
            console.warn('[INFO_CARD] Bouton #info-card-mobile-close-btn non trouvé après injection HTML.');
        }
    }

    function closeMobileInfoCard() {
        if (!mobileInfoCardContainer) return;
        
        mobileInfoCardContainer.classList.remove('visible');
        document.body.classList.remove('mobile-bottom-sheet-is-visible');
        
        if (map && selectedPinId !== null) {
            map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: selectedPinId }, { selected: false });
            selectedPinId = null;
        }
    }
    
    function handleMapClick(e) {
        if (e.features && e.features.length > 0) {
            e.originalEvent.stopPropagation(); // Empêcher le clic de se propager à handleMapGeneralClick
            
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
                openMobileInfoCard(properties);
            } else {
                if (mobileInfoCardContainer && mobileInfoCardContainer.classList.contains('visible')) {
                    closeMobileInfoCard();
                }
                if (currentPopup) currentPopup.remove();

                const popupHTML = createDesktopPopupHTML(properties);
                currentPopup = new maplibregl.Popup({ offset: 10, closeButton: true, className: 'airbnb-style-popup' })
                    .setLngLat(coordinates)
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
        }
    }

    function handleMapGeneralClick(e) {
        if (!map.queryRenderedFeatures(e.point, { layers: [LAYER_ID_PINS] }).length) {
            if (isMobile && mobileInfoCardContainer && mobileInfoCardContainer.classList.contains('visible')) {
                closeMobileInfoCard();
            }
        }
    }

    function getNestedValue(obj, path) {
        if (!obj || !path) return undefined;
        return path.split('.').reduce((acc, part) => {
            if (acc && typeof acc === 'object' && acc[part] !== undefined) {
                const index = parseInt(part, 10);
                if (Array.isArray(acc) && !isNaN(index) && acc.length > index) { // Vérifier aussi la longueur du tableau
                    return acc[index];
                }
                return acc[part];
            }
            return undefined;
        }, obj);
    }
    
    if (mobileToggleButton) {
        if (isMobile) {
            mobileToggleButton.style.display = 'block';
        } else {
            mobileToggleButton.style.display = 'none';
        }

        mobileToggleButton.addEventListener('click', () => {
            document.body.classList.toggle('map-is-active');
            if (document.body.classList.contains('map-is-active')) {
                if (map) map.resize();
                mobileToggleButton.textContent = `Voir la liste`;
            } else {
                if (listContainer) listContainer.scrollTo(0, 0);
                 // Le texte est mis à jour par updateVisibleList si besoin, ou on le remet à son état initial ici
                 // mobileToggleButton.textContent = `Voir les X logements`; // updateVisibleList devrait s'en charger
            }
        });
    } else {
        console.warn(`[MAP_SCRIPT] Bouton avec ID '${MOBILE_TOGGLE_BUTTON_ID}' non trouvé.`);
    }

    // Appel initial pour configurer la carte si les données sont déjà là (peu probable au premier chargement du script)
    // mais l'événement 'annoncesChargeesEtRendues' est le principal déclencheur.
    if (allAnnouncements.length > 0 && !map) {
        console.log("[MAP_SCRIPT] Données d'annonces déjà présentes, initialisation de la carte.");
        initializeMap(convertAnnoncesToGeoJSON(allAnnouncements));
    } else if (!allAnnouncements.length && !map) {
        console.log("[MAP_SCRIPT] Aucune donnée d'annonce initiale, initialisation de la carte avec GeoJSON vide.");
        initializeMap({ type: 'FeatureCollection', features: [] });
    }

});

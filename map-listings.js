// map-listings.js - VERSION 12 - Corrigé et Amélioré
document.addEventListener('DOMContentLoaded', function() {
    console.log('[MAP_SCRIPT V12] Initialisation avec correctif des coordonnées et synchro liste -> carte.');

    // --- CONSTANTES ---
    const MAPTILER_API_KEY = 'UsgTlLJiePXeSnyh57aL';
    const MAP_CONTAINER_ID = 'map-section';
    const LIST_CONTAINER_ID = 'annonces-wrapper'; // Assurez-vous que cet ID est bien celui de votre conteneur de liste
    const SOURCE_ID_ANNONCES = 'annonces-source';
    const LAYER_ID_PINS = 'annonces-pins-layer';
    const LAYER_ID_LABELS = 'annonces-labels-layer';

    // --- ÉLÉMENTS DU DOM ---
    const listContainer = document.getElementById(LIST_CONTAINER_ID);

    // --- ÉTAT GLOBAL ---
    let map = null;
    let allAnnouncements = [];
    let currentPopup = null;
    let selectedPinId = null;

    // Se déclenche quand les annonces sont chargées par home-form-display-v4.js
    document.addEventListener('annoncesChargeesEtRendues', (event) => {
        const annonces = event.detail.annonces;
        if (!annonces || !Array.isArray(annonces)) {
            console.error("[MAP_SCRIPT] Événement 'annoncesChargeesEtRendues' reçu mais sans données d'annonces valides.");
            return;
        }
        
        console.log(`[MAP_SCRIPT] Événement 'annoncesChargeesEtRendues' reçu avec ${annonces.length} annonces.`);
        allAnnouncements = annonces;
        const geojsonData = convertAnnoncesToGeoJSON(allAnnouncements);

        if (geojsonData.features.length === 0) {
            console.warn("[MAP_SCRIPT] Aucune annonce avec des coordonnées valides n'a été trouvée pour l'affichage sur la carte.");
        }

        if (!map) {
            initializeMap(geojsonData);
        } else {
            map.getSource(SOURCE_ID_ANNONCES).setData(geojsonData);
            if (geojsonData.features.length > 0) {
                map.fitBounds(getBounds(geojsonData), { padding: 80, maxZoom: 16 });
            }
        }
    });

    /**
     * CORRECTION CRITIQUE : Cette fonction utilise maintenant `annonce.latitude` et `annonce.longitude`
     * pour correspondre à la structure de données de votre API Xano.
     */
    function convertAnnoncesToGeoJSON(annonces) {
        const features = annonces.map(annonce => {
            const lat = annonce.latitude;
            const lng = annonce.longitude;
            const loyer = getNestedValue(annonce, '_property_lease_of_property.0.loyer_cc') || getNestedValue(annonce, '_property_lease_of_property.0.loyer');

            if (!annonce.id || !lat || !lng) {
                console.warn("[MAP CONVERT] Annonce ignorée (ID ou coordonnées manquantes):", annonce.id);
                return null;
            }

            return {
                type: 'Feature',
                id: parseInt(annonce.id, 10),
                geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
                properties: {
                    id: parseInt(annonce.id, 10),
                    id_str: String(annonce.id),
                    price: loyer || '?',
                    title: getNestedValue(annonce, 'property_title'),
                    coverPhoto: getNestedValue(annonce, '_property_photos.0.images.0.url')
                }
            };
        }).filter(Boolean); // Retire les éléments null

        console.log(`[MAP CONVERT] ${features.length} annonces valides converties en GeoJSON.`);
        return { type: 'FeatureCollection', features };
    }


    function initializeMap(initialGeoJSON) {
        map = new maplibregl.Map({
            container: MAP_CONTAINER_ID,
            style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_API_KEY}`,
            pitch: 45,
            bearing: -10,
            renderWorldCopies: false,
            // Centre par défaut sur la France si aucune annonce n'est trouvée
            center: initialGeoJSON.features.length > 0 ? initialGeoJSON.features[0].geometry.coordinates : [2.3522, 48.8566],
            zoom: initialGeoJSON.features.length > 0 ? 12 : 5
        });

        window.map = map; // Pour débogage

        map.on('load', () => {
            console.log('[MAP_SCRIPT] Carte chargée.');
            map.addSource(SOURCE_ID_ANNONCES, { type: 'geojson', data: initialGeoJSON, promoteId: 'id' });

            addMapLayers();
            setupEventListeners();
            
            if (initialGeoJSON.features.length > 0) {
                map.fitBounds(getBounds(initialGeoJSON), { padding: 80, maxZoom: 16, duration: 0 });
            }
            updateVisibleList();
        });

        map.addControl(new maplibregl.NavigationControl(), 'top-right');
    }

    function addMapLayers() {
        // Couche des pins (cercles)
        map.addLayer({
            id: LAYER_ID_PINS, type: 'circle', source: SOURCE_ID_ANNONCES,
            paint: {
                'circle-radius': 18,
                'circle-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#0052d4', '#FFFFFF'],
                'circle-stroke-width': 2,
                'circle-stroke-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#FFFFFF', '#0052d4']
            }
        });
        // Couche des labels (prix)
        map.addLayer({
            id: LAYER_ID_LABELS, type: 'symbol', source: SOURCE_ID_ANNONCES,
            layout: {
                'text-field': ['concat', ['to-string', ['get', 'price']], '€'],
                'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                'text-size': 11,
                'text-allow-overlap': true
            },
            paint: {
                'text-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#FFFFFF', '#333333']
            }
        });
    }

    function setupEventListeners() {
        // Interaction avec les pins sur la carte
        map.on('click', LAYER_ID_PINS, handlePinClick);
        map.on('mouseenter', LAYER_ID_PINS, () => map.getCanvas().style.cursor = 'pointer');
        map.on('mouseleave', LAYER_ID_PINS, () => map.getCanvas().style.cursor = '');
        
        // Synchronisation Carte -> Liste
        map.on('moveend', updateVisibleList);

        // NOUVEAU : Synchronisation Liste -> Carte
        if (listContainer) {
            listContainer.addEventListener('click', handleListItemClick);
        }
    }
    
    function handlePinClick(e) {
        if (e.features && e.features.length > 0) {
            const feature = e.features[0];
            selectPin(feature.id, feature.geometry.coordinates);
        }
    }

    // NOUVEAU : Gère le clic sur un élément de la liste
    function handleListItemClick(e) {
        // On remonte dans l'arbre DOM pour trouver le lien parent qui a les coordonnées
        const link = e.target.closest('a[data-lng][data-lat]');
        if (link) {
            e.preventDefault(); // Empêche la navigation immédiate
            const { lng, lat, propertyIdLink } = link.dataset;
            const coordinates = [parseFloat(lng), parseFloat(lat)];
            
            map.flyTo({ center: coordinates, zoom: 16 });
            
            // On attend que la carte finisse son mouvement pour sélectionner le pin
            map.once('moveend', () => {
                selectPin(parseInt(propertyIdLink, 10), coordinates);
            });
        }
    }

    function selectPin(pinId, coordinates) {
        if (selectedPinId !== null) {
            map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: selectedPinId }, { selected: false });
        }
        map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: pinId }, { selected: true });
        selectedPinId = pinId;

        if (currentPopup) currentPopup.remove();
        
        const features = map.querySourceFeatures(SOURCE_ID_ANNONCES, { sourceLayer: LAYER_ID_PINS, filter: ['==', 'id', pinId] });
        if (features.length > 0) {
            const properties = features[0].properties;
            const popupHTML = createPopupHTML(properties);
            currentPopup = new maplibregl.Popup({ offset: 25, className: 'airbnb-style-popup' })
                .setLngLat(coordinates)
                .setHTML(popupHTML)
                .addTo(map);

            currentPopup.on('close', () => {
                map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: pinId }, { selected: false });
                selectedPinId = null;
                currentPopup = null;
            });
        }
    }

    function updateVisibleList() {
        if (!map || !map.isStyleLoaded() || !listContainer) return;

        const visibleFeatures = map.queryRenderedFeatures({ layers: [LAYER_ID_PINS] });
        const visiblePropertyIds = new Set(visibleFeatures.map(feature => String(feature.properties.id)));
        
        const allListItems = listContainer.querySelectorAll('a[data-property-id-link]');
        
        allListItems.forEach(itemLink => {
            const itemIdString = itemLink.dataset.propertyIdLink;
            if (visiblePropertyIds.has(itemIdString)) {
                itemLink.classList.remove('annonce-list-item-hidden');
            } else {
                itemLink.classList.add('annonce-list-item-hidden');
            }
        });
    }

    function createPopupHTML(properties) {
        const placeholderImage = 'https://via.placeholder.com/280x150/cccccc/969696?text=Image';
        const coverPhoto = properties.coverPhoto || placeholderImage;
        const title = properties.title || "Titre non disponible";
        const priceText = `${properties.price || '?'} € / mois`;
        const detailLink = `annonce?id=${properties.id_str}`;
    
        return `<div class="map-custom-popup">
                    <img src="${coverPhoto}" alt="${title}" class="popup-image" onerror="this.src='${placeholderImage}'">
                    <div class="popup-info">
                        <h4 class="popup-title">${title}</h4>
                        <p class="popup-price">${priceText}</p>
                        <a href="${detailLink}" class="popup-link" target="_blank">Voir les détails</a>
                    </div>
                </div>`;
    }
    
    function getBounds(geojson) {
        const bounds = new maplibregl.LngLatBounds();
        geojson.features.forEach(feature => {
            bounds.extend(feature.geometry.coordinates);
        });
        return bounds;
    }

    function getNestedValue(obj, path) {
        if (!path) return undefined;
        return path.split('.').reduce((acc, part) => {
            if (acc === undefined || acc === null) return undefined;
            const index = !isNaN(parseInt(part, 10)) ? parseInt(part, 10) : -1;
            if (index !== -1 && Array.isArray(acc)) return acc[index];
            return acc[part];
        }, obj);
    }
});

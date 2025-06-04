// map-listings.js - VERSION 19 - Pins type Airbnb et Popups améliorés
document.addEventListener('DOMContentLoaded', function() {
    console.log('[MAP_SCRIPT V19] Initialisation avec pins style Airbnb et popups améliorés.');

    // --- CONSTANTES GLOBALES ---
    const MAPTILER_API_KEY = 'Z8Gqj65EHchnshMYiN7P'; // Assurez-vous que c'est votre clé MapTiler active
    const MAP_CONTAINER_ID = 'map-section';
    const LIST_CONTAINER_ID = 'annonces-wrapper';
    const MOBILE_TOGGLE_BUTTON_ID = 'mobile-map-toggle';
    
    const SOURCE_ID_ANNONCES_INVISIBLE = 'annonces-source-invisible'; // Pour queryRenderedFeatures
    const LAYER_ID_PINS_INVISIBLE = 'annonces-pins-invisible';   // Pour queryRenderedFeatures

    const SOURCE_NAME_BUILDINGS = 'maptiler_planet';
    const SOURCE_LAYER_NAME_BUILDINGS = 'building';
    const LAYER_ID_BUILDINGS_3D = 'buildings-3d-layer';

    // --- ÉLÉMENTS DU DOM (pour le popup mobile) ---
    const mobilePopupSheet = document.getElementById('mobile-listing-popup-sheet');
    const mobilePopupImage = document.getElementById('mobile-popup-image');
    const mobilePopupTitle = document.getElementById('mobile-popup-title');
    const mobilePopupPrice = document.getElementById('mobile-popup-price');
    const mobilePopupLink = document.getElementById('mobile-popup-link');
    const closeMobilePopupSheetBtn = document.getElementById('close-mobile-popup-sheet');

    // --- VARIABLES D'ÉTAT GLOBAL (let) ---
    let map = null;
    let allAnnouncements = [];
    let isMobile = window.innerWidth < 768;
    let currentDesktopPopup = null;
    let currentSelectedMarkerEl = null; // L'élément DOM du marqueur HTML sélectionné
    let currentSelectedPropertyId = null;
    let htmlMarkers = []; // Pour stocker les marqueurs HTML
    let currentHighlightedBuildingIds = new Set();


    // --- ÉLÉMENTS DU DOM ---
    const listContainer = document.getElementById(LIST_CONTAINER_ID);
    const mobileToggleButton = document.getElementById(MOBILE_TOGGLE_BUTTON_ID);

    // ========================================================================
    // INITIALISATION
    // ========================================================================

    document.addEventListener('annoncesChargeesEtRendues', (event) => {
        allAnnouncements = event.detail.annonces || [];
        const geojsonData = convertAnnoncesToGeoJSON(allAnnouncements);
        if (!map) {
            initializeMap(geojsonData);
        } else {
            // Mettre à jour la source invisible pour updateVisibleList
            const source = map.getSource(SOURCE_ID_ANNONCES_INVISIBLE);
            if (source) source.setData(geojsonData);
            
            renderListingMarkers(geojsonData); // Re-créer les marqueurs HTML

            if (geojsonData.features.length > 0 && map.isStyleLoaded()) {
                try { map.fitBounds(getBounds(geojsonData), { padding: {top: 50, bottom:50, left: 50, right: 50}, maxZoom: 16 }); }
                catch (e) { console.warn("[MAP_SCRIPT V19] Erreur fitBounds (annonces MàJ):", e); }
            }
            if (map.isStyleLoaded()) mettreAJourBatimentsSelectionnes(allAnnouncements);
        }
    });

    function initializeMap(initialGeoJSON) {
        if (!document.getElementById(MAP_CONTAINER_ID)) {
            console.error(`[MAP_SCRIPT V19] Conteneur de carte #${MAP_CONTAINER_ID} introuvable.`);
            return;
        }
        map = new maplibregl.Map({
            container: MAP_CONTAINER_ID,
            style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_API_KEY}`,
            pitch: 50, bearing: -15, renderWorldCopies: false,
            center: initialGeoJSON && initialGeoJSON.features.length > 0 ? initialGeoJSON.features[0].geometry.coordinates : [2.3522, 48.8566],
            zoom: initialGeoJSON && initialGeoJSON.features.length > 0 ? 12 : 5
        });
        
        window.map = map;

        map.on('load', () => {
            console.log('[MAP_SCRIPT V19] Carte chargée.');
            // Source invisible pour la synchronisation map -> liste
            map.addSource(SOURCE_ID_ANNONCES_INVISIBLE, { type: 'geojson', data: initialGeoJSON, promoteId: 'id' });
            addMapLayers(); // Ajoute la couche invisible et les bâtiments 3D
            renderListingMarkers(initialGeoJSON); // Ajoute les marqueurs HTML visibles
            setupEventListeners();
            
            if (initialGeoJSON && initialGeoJSON.features.length > 0) {
                 try { map.fitBounds(getBounds(initialGeoJSON), { padding: {top: 50, bottom:50, left: 50, right: 50}, maxZoom: 16, duration:0 }); }
                 catch (e) { console.warn("[MAP_SCRIPT V19] Erreur fitBounds (init):", e); }
            }
            updateVisibleList(); // Basé sur la couche invisible
            mettreAJourBatimentsSelectionnes(allAnnouncements); 
        });
        map.addControl(new maplibregl.NavigationControl(), 'top-right');
    }

    // ========================================================================
    // GESTION DES COUCHES DE LA CARTE
    // ========================================================================
    function addMapLayers() { 
        // Couche invisible, utilisée uniquement pour queryRenderedFeatures afin de synchroniser la liste
        map.addLayer({
            id: LAYER_ID_PINS_INVISIBLE,
            type: 'circle',
            source: SOURCE_ID_ANNONCES_INVISIBLE,
            paint: { 'circle-radius': 0, 'circle-opacity': 0 } // Totalement invisible
        });
        // Couche bâtiments 3D
        map.addLayer({ 'id': LAYER_ID_BUILDINGS_3D, 'type': 'fill-extrusion', 'source': SOURCE_NAME_BUILDINGS, 'source-layer': SOURCE_LAYER_NAME_BUILDINGS, 'paint': { 'fill-extrusion-color': ['case', ['boolean', ['feature-state', 'highlighted'], false], '#FF1493', '#dfdfdf'], 'fill-extrusion-height': ['coalesce', ['get', 'height'], 20], 'fill-extrusion-base': ['coalesce', ['get', 'min_height'], 0], 'fill-extrusion-opacity': 0.85 }});
    }

    function renderListingMarkers(geojsonData) {
        // Supprimer les anciens marqueurs HTML
        htmlMarkers.forEach(marker => marker.remove());
        htmlMarkers = [];
        if (currentDesktopPopup) currentDesktopPopup.remove();
        if (mobilePopupSheet) mobilePopupSheet.classList.remove('active');

        if (!geojsonData || !geojsonData.features) return;

        geojsonData.features.forEach(feature => {
            if (!feature.geometry || !feature.geometry.coordinates) return;

            const el = document.createElement('div');
            el.className = 'price-marker-pill';
            el.textContent = `${feature.properties.price}€`;
            el.dataset.propertyId = feature.properties.id;

            const marker = new maplibregl.Marker(el)
                .setLngLat(feature.geometry.coordinates)
                .addTo(map);
            
            el.addEventListener('click', () => {
                handleMarkerClick(feature, el);
            });
            htmlMarkers.push(marker);
        });
    }
    
    async function mettreAJourBatimentsSelectionnes(annonces) { /* ... Identique à V17 ... */ }
    
    // ========================================================================
    // GESTIONNAIRES D'ÉVÉNEMENTS
    // ========================================================================
    function setupEventListeners() {
        map.on('moveend', updateVisibleList); // Basé sur la couche invisible
        if (listContainer) listContainer.addEventListener('click', handleListItemClick);
        if (isMobile && mobileToggleButton) {
            mobileToggleButton.addEventListener('click', () => {
                document.body.classList.toggle('map-is-active');
                const isActive = document.body.classList.contains('map-is-active');
                if (isActive && map) map.resize();
                const visibleCount = map.queryRenderedFeatures({layers: [LAYER_ID_PINS_INVISIBLE]}).length;
                mobileToggleButton.textContent = isActive ? `Voir la liste` : `Voir les ${visibleCount} logements`;
            });
        }
        window.addEventListener('resize', () => { isMobile = window.innerWidth < 768; });

        if(closeMobilePopupSheetBtn) {
            closeMobilePopupSheetBtn.addEventListener('click', () => {
                if(mobilePopupSheet) mobilePopupSheet.classList.remove('active');
                unselectCurrentMarker();
            });
        }
    }

    function handleMarkerClick(feature, markerEl) {
        isMobile = window.innerWidth < 768; // Re-vérifier au moment du clic
        const properties = feature.properties;
        const coordinates = feature.geometry.coordinates;

        // Désélectionner l'ancien marqueur/popup
        if (currentDesktopPopup) currentDesktopPopup.remove();
        if (mobilePopupSheet) mobilePopupSheet.classList.remove('active');
        unselectCurrentMarker();

        // Sélectionner le nouveau
        markerEl.classList.add('selected');
        currentSelectedMarkerEl = markerEl;
        currentSelectedPropertyId = properties.id;

        map.flyTo({ center: coordinates, zoom: map.getZoom() < 15 ? 15 : map.getZoom(), speed: 0.7 });

        if (isMobile) {
            // Afficher la bottom sheet mobile
            if(mobilePopupImage) mobilePopupImage.src = properties.coverPhoto || '';
            if(mobilePopupImage && properties.coverPhoto) mobilePopupImage.style.display = 'block'; else if(mobilePopupImage) mobilePopupImage.style.display = 'none';
            if(mobilePopupTitle) mobilePopupTitle.textContent = properties.title || 'Titre non disponible';
            if(mobilePopupPrice) mobilePopupPrice.textContent = `${properties.price}€ / mois`;
            if(mobilePopupLink) mobilePopupLink.href = `annonce?id=${properties.id_str}`;
            if(mobilePopupSheet) mobilePopupSheet.classList.add('active');
        } else {
            // Afficher le popup desktop
            currentDesktopPopup = new maplibregl.Popup({ offset: 25, className: 'airbnb-style-popup', maxWidth: "300px" })
                .setLngLat(coordinates)
                .setHTML(createDesktopPopupHTML(properties))
                .addTo(map);

            currentDesktopPopup.on('close', () => {
                unselectCurrentMarker();
                currentDesktopPopup = null;
            });
        }
    }

    function unselectCurrentMarker() {
        if (currentSelectedMarkerEl) {
            currentSelectedMarkerEl.classList.remove('selected');
            currentSelectedMarkerEl = null;
        }
        currentSelectedPropertyId = null;
    }
    
    function handleListItemClick(e) {
        const link = e.target.closest('a[data-lng][data-lat]');
        if (link && map) {
            e.preventDefault();
            const { lng, lat, propertyIdLink } = link.dataset;
            const propertyId = parseInt(propertyIdLink, 10);
            const coordinates = [parseFloat(lng), parseFloat(lat)];
            
            map.flyTo({ center: coordinates, zoom: 16, speed: 0.7 });

            // Trouver le feature et le marqueur DOM correspondant
            const feature = allAnnouncements.find(a => a.id === propertyId);
            const markerEl = htmlMarkers.find(m => m.getElement().dataset.propertyId == propertyId)?.getElement();

            if (feature && markerEl) {
                 map.once('moveend', () => handleMarkerClick(convertAnnoncesToGeoJSON([feature]).features[0], markerEl));
            } else {
                // Fallback si le marqueur n'est pas trouvé, juste centrer
                console.warn(`Marqueur HTML non trouvé pour l'annonce ${propertyId}`);
            }
        }
    }
    
    // ========================================================================
    // FONCTIONS UTILITAIRES ET DE SYNCHRONISATION
    // ========================================================================
    function updateVisibleList() { // Utilise la couche invisible
        if (!map || !map.isStyleLoaded() || !listContainer) return;
        const visibleIds = new Set(map.queryRenderedFeatures({ layers: [LAYER_ID_PINS_INVISIBLE] }).map(f => String(f.properties.id)));
        listContainer.querySelectorAll('a[data-property-id-link]').forEach(link => {
            link.classList.toggle('annonce-list-item-hidden', !visibleIds.has(link.dataset.propertyIdLink));
        });
    }

    function createDesktopPopupHTML(properties) {
        const detailLink = `annonce?id=${properties.id_str}`;
        return `<div class="map-custom-popup">
                    <img src="${properties.coverPhoto || ''}" alt="${properties.title}" class="popup-image" onerror="this.style.display='none'">
                    <div class="popup-info">
                        <h4 class="popup-title">${properties.title || 'Titre non disponible'}</h4>
                        <p class="popup-price">${properties.price}€ / mois</p>
                        <div class="popup-actions">
                            <a href="${detailLink}" class="popup-link" target="_blank">Voir les détails</a>
                        </div>
                    </div>
                </div>`;
    }
    
    function convertAnnoncesToGeoJSON(annonces) {
        return { type: 'FeatureCollection', features: annonces.map(annonce => {
            if (!annonce.id || annonce.latitude == null || annonce.longitude == null ) return null;
            const loyer = getNestedValue(annonce, '_property_lease_of_property.0.loyer') || getNestedValue(annonce, '_property_lease_of_property.0.loyer_cc');
            return {
                type: 'Feature', id: parseInt(annonce.id, 10), // Utilisé par la couche invisible promoteId
                geometry: { type: 'Point', coordinates: [parseFloat(annonce.longitude), parseFloat(annonce.latitude)] },
                properties: { 
                    id: parseInt(annonce.id, 10), // Nécessaire pour le dataset sur le marqueur HTML
                    id_str: String(annonce.id), 
                    price: loyer != null ? loyer : '?', 
                    title: getNestedValue(annonce, 'property_title'), 
                    coverPhoto: getNestedValue(annonce, '_property_photos.0.images.0.url') 
                }
            };
        }).filter(Boolean)};
    }
    
    function getBounds(geojson) { /* ... Identique à V17 ... */ }
    function getNestedValue(obj, path) { /* ... Identique à V17 ... */ }

    // Lancement initial
    if (document.getElementById(MAP_CONTAINER_ID)) {
        console.log("[MAP_SCRIPT V19] En attente de 'annoncesChargeesEtRendues' pour initialiser la carte.");
    } else {
        console.warn("[MAP_SCRIPT V19] Conteneur de carte non trouvé.");
    }
});

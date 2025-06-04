// map-listings.js - VERSION 20 - Retour aux couches MapLibre pour les pins, popups améliorés
document.addEventListener('DOMContentLoaded', function() {
    console.log('[MAP_SCRIPT V20] Utilisation des couches MapLibre pour les pins/prix, popups/sheets améliorés.');

    // --- CONSTANTES GLOBALES ---
    const MAPTILER_API_KEY = 'Z8Gqj65EHchnshMYiN7P';
    const MAP_CONTAINER_ID = 'map-section';
    const LIST_CONTAINER_ID = 'annonces-wrapper';
    const MOBILE_TOGGLE_BUTTON_ID = 'mobile-map-toggle';
    
    const SOURCE_ID_ANNONCES = 'annonces-source';
    const LAYER_ID_PINS = 'annonces-pins-circles'; // Cercles cliquables
    const LAYER_ID_LABELS = 'annonces-pins-labels';  // Labels de prix

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
    let currentSelectedPropertyId = null;
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
            const source = map.getSource(SOURCE_ID_ANNONCES);
            if (source) source.setData(geojsonData);
            
            if (geojsonData.features.length > 0 && map.isStyleLoaded()) {
                try { map.fitBounds(getBounds(geojsonData), { padding: {top: 50, bottom:50, left: 50, right: 50}, maxZoom: 16 }); }
                catch (e) { console.warn("[MAP_SCRIPT V20] Erreur fitBounds (annonces MàJ):", e); }
            } else if (map.isStyleLoaded()) { // Si pas de features, centrer par défaut
                 map.flyTo({ center: [2.3522, 48.8566], zoom: 5 });
            }
            if (map.isStyleLoaded()) mettreAJourBatimentsSelectionnes(allAnnouncements);
        }
    });

    function initializeMap(initialGeoJSON) {
        if (!document.getElementById(MAP_CONTAINER_ID)) {
            console.error(`[MAP_SCRIPT V20] Conteneur de carte #${MAP_CONTAINER_ID} introuvable.`);
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
            console.log('[MAP_SCRIPT V20] Carte chargée.');
            map.addSource(SOURCE_ID_ANNONCES, { type: 'geojson', data: initialGeoJSON, promoteId: 'id' }); // 'id' doit être un entier dans les properties
            addMapLayers();
            setupEventListeners();
            
            if (initialGeoJSON && initialGeoJSON.features.length > 0) {
                 try { map.fitBounds(getBounds(initialGeoJSON), { padding: {top: 50, bottom:50, left: 50, right: 50}, maxZoom: 16, duration:0 }); }
                 catch (e) { console.warn("[MAP_SCRIPT V20] Erreur fitBounds (init):", e); }
            }
            updateVisibleList();
            mettreAJourBatimentsSelectionnes(allAnnouncements); 
        });
        map.addControl(new maplibregl.NavigationControl(), 'top-right');
    }

    // ========================================================================
    // GESTION DES COUCHES DE LA CARTE
    // ========================================================================
    function addMapLayers() { 
        map.addLayer({ 'id': LAYER_ID_BUILDINGS_3D, 'type': 'fill-extrusion', 'source': SOURCE_NAME_BUILDINGS, 'source-layer': SOURCE_LAYER_NAME_BUILDINGS, 'paint': { 'fill-extrusion-color': ['case', ['boolean', ['feature-state', 'highlighted'], false], '#FF1493', '#dfdfdf'], 'fill-extrusion-height': ['coalesce', ['get', 'height'], 20], 'fill-extrusion-base': ['coalesce', ['get', 'min_height'], 0], 'fill-extrusion-opacity': 0.85 }});
        
        // Couche des cercles (représentant les pins)
        map.addLayer({ 
            id: LAYER_ID_PINS, 
            type: 'circle', 
            source: SOURCE_ID_ANNONCES, 
            paint: { 
                'circle-radius': 12, // Taille du cercle
                'circle-color': ['case', 
                    ['boolean', ['feature-state', 'selected'], false], '#007bff', // Bleu si sélectionné
                    '#FF385C'  // Rouge Airbnb par défaut
                ],
                'circle-stroke-width': 2,
                'circle-stroke-color': 'white'
            } 
        });

        // Couche des labels de prix
        map.addLayer({ 
            id: LAYER_ID_LABELS, 
            type: 'symbol', 
            source: SOURCE_ID_ANNONCES, 
            layout: { 
                'text-field': ['concat', ['to-string', ['get', 'price']], '€'], 
                'text-font': ['Noto Sans Bold'], // Police en gras
                'text-size': 13,              // Taille de police augmentée
                'text-allow-overlap': true,     // Permet aux labels de se chevaucher
                'text-ignore-placement': true   // Important avec allow-overlap
            }, 
            paint: { 
                'text-color': ['case',
                    ['boolean', ['feature-state', 'selected'], false], 'white', // Blanc sur fond bleu
                    '#222222' // Noir sur fond rouge/blanc par défaut
                ]
            } 
        });
    }
    
    async function mettreAJourBatimentsSelectionnes(annonces) { /* ... Identique à V17 ... */ }
    
    // ========================================================================
    // GESTIONNAIRES D'ÉVÉNEMENTS
    // ========================================================================
    function setupEventListeners() {
        map.on('click', LAYER_ID_PINS, handlePinClick); // Clic sur la couche des cercles
        map.on('mouseenter', LAYER_ID_PINS, () => map.getCanvas().style.cursor = 'pointer');
        map.on('mouseleave', LAYER_ID_PINS, () => map.getCanvas().style.cursor = '');
        map.on('moveend', updateVisibleList);
        if (listContainer) listContainer.addEventListener('click', handleListItemClick);

        if (mobileToggleButton) { // S'assurer que le bouton existe
             isMobile = window.innerWidth < 768; // Vérifier l'état initial
             if (isMobile) mobileToggleButton.style.display = 'block'; else mobileToggleButton.style.display = 'none';

            mobileToggleButton.addEventListener('click', () => {
                document.body.classList.toggle('map-is-active');
                const isActive = document.body.classList.contains('map-is-active');
                if (isActive && map) map.resize();
                const visibleCount = map.queryRenderedFeatures({layers: [LAYER_ID_PINS]}).length;
                mobileToggleButton.textContent = isActive ? `Voir la liste` : `Voir les ${visibleCount} logements`;
            });
             window.addEventListener('resize', () => {
                isMobile = window.innerWidth < 768;
                if (isMobile) mobileToggleButton.style.display = 'block'; else mobileToggleButton.style.display = 'none';
            });
        }

        if(closeMobilePopupSheetBtn) {
            closeMobilePopupSheetBtn.addEventListener('click', () => {
                if(mobilePopupSheet) mobilePopupSheet.classList.remove('active');
                unselectCurrentPin();
            });
        }
    }

    function handlePinClick(e) { 
        if (e.features && e.features.length > 0) {
            const feature = e.features[0];
            selectPin(feature.properties.id, feature.geometry.coordinates, feature.properties);
        }
    }
    
    function handleListItemClick(e) {
        const link = e.target.closest('a[data-lng][data-lat]');
        if (link && map) {
            e.preventDefault();
            const { lng, lat, propertyIdLink } = link.dataset;
            const propertyId = parseInt(propertyIdLink, 10);
            const coordinates = [parseFloat(lng), parseFloat(lat)];
            
            map.flyTo({ center: coordinates, zoom: 16, speed: 0.7 });

            // Trouver le feature correspondant pour passer toutes ses propriétés
            const sourceFeatures = map.querySourceFeatures(SOURCE_ID_ANNONCES, {
                filter: ['==', 'id', propertyId]
            });

            if (sourceFeatures.length > 0) {
                 map.once('moveend', () => selectPin(propertyId, coordinates, sourceFeatures[0].properties));
            } else {
                console.warn(`Feature non trouvée pour l'annonce ${propertyId} lors du clic sur la liste.`);
            }
        }
    }

    function selectPin(propertyId, coordinates, properties) {
        isMobile = window.innerWidth < 768; 

        if (currentDesktopPopup) currentDesktopPopup.remove();
        if (mobilePopupSheet) mobilePopupSheet.classList.remove('active');
        unselectCurrentPin(); // Désélectionne l'ancien pin (état visuel)

        map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: propertyId }, { selected: true });
        currentSelectedPropertyId = propertyId;

        // map.flyTo({ center: coordinates, zoom: map.getZoom() < 15 ? 15 : map.getZoom(), speed: 0.7 });

        if (isMobile) {
            if(mobilePopupImage) mobilePopupImage.src = properties.coverPhoto || '';
            if(mobilePopupImage && properties.coverPhoto) mobilePopupImage.style.display = 'block'; else if(mobilePopupImage) mobilePopupImage.style.display = 'none';
            if(mobilePopupTitle) mobilePopupTitle.textContent = properties.title || 'Titre non disponible';
            if(mobilePopupPrice) mobilePopupPrice.textContent = `${properties.price}€ / mois`;
            if(mobilePopupLink) mobilePopupLink.href = `annonce?id=${properties.id_str}`;
            if(mobilePopupSheet) mobilePopupSheet.classList.add('active');
        } else {
            currentDesktopPopup = new maplibregl.Popup({ offset: 15, className: 'airbnb-style-popup', maxWidth: "300px" })
                .setLngLat(coordinates)
                .setHTML(createDesktopPopupHTML(properties))
                .addTo(map);

            currentDesktopPopup.on('close', () => {
                unselectCurrentPin();
                currentDesktopPopup = null;
            });
        }
    }

    function unselectCurrentPin() {
        if (currentSelectedPropertyId !== null) {
            map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: currentSelectedPropertyId }, { selected: false });
            currentSelectedPropertyId = null;
        }
    }
    
    // ========================================================================
    // FONCTIONS UTILITAIRES ET DE SYNCHRONISATION
    // ========================================================================
    function updateVisibleList() {
        if (!map || !map.isStyleLoaded() || !listContainer) return;
        const visibleIds = new Set(map.queryRenderedFeatures({ layers: [LAYER_ID_PINS] }).map(f => String(f.properties.id)));
        listContainer.querySelectorAll('a[data-property-id-link]').forEach(link => {
            link.classList.toggle('annonce-list-item-hidden', !visibleIds.has(link.dataset.propertyIdLink));
        });
    }

    function createDesktopPopupHTML(properties) {
        const detailLink = `annonce?id=${properties.id_str}`;
        return `<div class="map-custom-popup">
                    <img src="${properties.coverPhoto || ''}" alt="${properties.title}" class="popup-image" onerror="this.style.display='none'; this.onerror=null;">
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
            
            // L'ID pour 'promoteId' DOIT être un entier.
            const idAsInt = parseInt(annonce.id, 10);
            if (isNaN(idAsInt)) {
                console.warn(`ID d'annonce non valide (non entier) ignoré: ${annonce.id}`);
                return null;
            }

            return {
                type: 'Feature', 
                id: idAsInt, // Utilisé par promoteId, doit être un nombre entier
                geometry: { type: 'Point', coordinates: [parseFloat(annonce.longitude), parseFloat(annonce.latitude)] },
                properties: { 
                    // id: idAsInt, // Déjà présent au niveau supérieur pour promoteId
                    id_str: String(annonce.id), // Garder une version string si besoin ailleurs
                    price: loyer != null ? loyer : '?', 
                    title: getNestedValue(annonce, 'property_title'), 
                    coverPhoto: getNestedValue(annonce, '_property_photos.0.images.0.url'),
                    // Passer toutes les propriétés de l'annonce pour le popup/sheet
                    full_details: JSON.stringify(annonce) 
                }
            };
        }).filter(Boolean)};
    }
    
    function getBounds(geojson) {
        const bounds = new maplibregl.LngLatBounds();
        if (geojson && geojson.features && geojson.features.length > 0) {
            geojson.features.forEach(feature => {
                if (feature && feature.geometry && feature.geometry.coordinates && feature.geometry.coordinates.length === 2) {
                    try { bounds.extend(feature.geometry.coordinates); } 
                    catch (e) { console.warn("[MAP_SCRIPT V20] Coordonnée invalide pour bounds.extend:", feature.geometry.coordinates, e); }
                } else {
                     console.warn("[MAP_SCRIPT V20] Feature invalide pour bounds:", feature);
                }
            });
        } else {
            // Retourner des limites par défaut ou null si aucune feature valide
            // Pour éviter l'erreur "Cannot read properties of undefined (reading 'getNorthWest')"
            // On peut retourner les limites de la France par exemple, ou laisser la carte gérer.
            // Si on retourne null, fitBounds ne doit pas être appelé ou doit gérer le cas null.
            // Pour l'instant, on laisse la fonction retourner un LngLatBounds vide si pas de features, 
            // et le code appelant devra gérer cela.
             console.warn("[MAP_SCRIPT V20] getBounds appelé avec geojson vide ou invalide.");
        }
        return bounds;
    }

    function getNestedValue(obj, path) {
        if (!path || obj == null) return undefined;
        return path.split('.').reduce((acc, part) => {
            if (acc === undefined || acc === null) return undefined;
            const i = !isNaN(parseInt(part, 10)) ? parseInt(part, 10) : -1;
            return i !== -1 && Array.isArray(acc) ? acc[i] : acc[part];
        }, obj);
    }

    // Lancement initial
    if (document.getElementById(MAP_CONTAINER_ID)) {
        console.log("[MAP_SCRIPT V20] En attente de 'annoncesChargeesEtRendues' pour initialiser la carte.");
    } else {
        console.warn("[MAP_SCRIPT V20] Conteneur de carte non trouvé.");
    }
});

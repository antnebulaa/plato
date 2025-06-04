// map-listings.js - VERSION 21 - Correctifs majeurs ID, Pins, Popups
document.addEventListener('DOMContentLoaded', function() {
    console.log('[MAP_SCRIPT V21] Tentative de correction des IDs, affichage des pins et popups.');

    // --- CONSTANTES GLOBALES ---
    const MAPTILER_API_KEY = 'Z8Gqj65EHchnshMYiN7P';
    const MAP_CONTAINER_ID = 'map-section';
    const LIST_CONTAINER_ID = 'annonces-wrapper';
    const MOBILE_TOGGLE_BUTTON_ID = 'mobile-map-toggle';
    
    const SOURCE_ID_ANNONCES = 'annonces-source';
    const LAYER_ID_PINS = 'annonces-pins-circles'; 
    const LAYER_ID_LABELS = 'annonces-pins-labels';

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
    let currentSelectedPropertyId = null; // Stockera l'ID (entier) du pin sélectionné
    let currentHighlightedBuildingIds = new Set();

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
            
            const bounds = getBounds(geojsonData);
            if (bounds && !bounds.isEmpty() && map.isStyleLoaded()) {
                try { map.fitBounds(bounds, { padding: {top: 70, bottom:70, left: 70, right: 70}, maxZoom: 16 }); }
                catch (e) { console.warn("[MAP_SCRIPT V21] Erreur fitBounds (annonces MàJ):", e); }
            } else if (map.isStyleLoaded()) {
                 map.flyTo({ center: [2.3522, 48.8566], zoom: 5 });
            }
            if (map.isStyleLoaded()) mettreAJourBatimentsSelectionnes(allAnnouncements);
        }
    });

    function initializeMap(initialGeoJSON) {
        if (!document.getElementById(MAP_CONTAINER_ID)) {
            console.error(`[MAP_SCRIPT V21] Conteneur de carte #${MAP_CONTAINER_ID} introuvable.`);
            return;
        }
        map = new maplibregl.Map({
            container: MAP_CONTAINER_ID,
            style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_API_KEY}`,
            pitch: 50, bearing: -15, renderWorldCopies: false,
            center: [2.3522, 48.8566], // Centre par défaut
            zoom: 5 // Zoom par défaut
        });
        
        window.map = map;

        map.on('load', () => {
            console.log('[MAP_SCRIPT V21] Carte chargée.');
            map.addSource(SOURCE_ID_ANNONCES, { type: 'geojson', data: initialGeoJSON, promoteId: 'id' });
            addMapLayers();
            setupEventListeners();
            
            const bounds = getBounds(initialGeoJSON);
            if (bounds && !bounds.isEmpty()) {
                 try { map.fitBounds(bounds, { padding: {top: 70, bottom:70, left: 70, right: 70}, maxZoom: 16, duration:0 }); }
                 catch (e) { console.warn("[MAP_SCRIPT V21] Erreur fitBounds (init):", e); }
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
        
        map.addLayer({ 
            id: LAYER_ID_PINS, 
            type: 'circle', 
            source: SOURCE_ID_ANNONCES, 
            paint: { 
                'circle-radius': 16, // Cercles plus grands
                'circle-color': ['case', 
                    ['boolean', ['feature-state', 'selected'], false], '#007bff', 
                    '#FF385C'
                ],
                'circle-stroke-width': 2,
                'circle-stroke-color': 'white'
            } 
        });

        map.addLayer({ 
            id: LAYER_ID_LABELS, 
            type: 'symbol', 
            source: SOURCE_ID_ANNONCES, 
            layout: { 
                'text-field': ['concat', ['to-string', ['get', 'price']], '€'], 
                'text-font': ['Noto Sans Bold'], 
                'text-size': 12, // Ajustée pour le cercle plus grand
                'text-allow-overlap': false, // Empêcher le chevauchement initial strict
                'text-ignore-placement': false,
                'text-optional': true // Rend le texte optionnel s'il ne rentre pas
            }, 
            paint: { 
                'text-color': 'white' // Prix toujours en blanc pour contraste avec cercle
            } 
        });
    }
    
    async function mettreAJourBatimentsSelectionnes(annonces) { /* ... Identique à V17 ... */ }
    
    // ========================================================================
    // GESTIONNAIRES D'ÉVÉNEMENTS
    // ========================================================================
    function setupEventListeners() {
        // Écouter les clics sur les DEUX couches : cercles et labels
        map.on('click', [LAYER_ID_PINS, LAYER_ID_LABELS], handlePinClick); 
        map.on('mouseenter', [LAYER_ID_PINS, LAYER_ID_LABELS], () => map.getCanvas().style.cursor = 'pointer');
        map.on('mouseleave', [LAYER_ID_PINS, LAYER_ID_LABELS], () => map.getCanvas().style.cursor = '');
        map.on('moveend', updateVisibleList);
        if (listContainer) listContainer.addEventListener('click', handleListItemClick);

        if (mobileToggleButton) {
             isMobile = window.innerWidth < 768;
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
            // CORRECTION : Utiliser feature.id (l'ID promu) qui est un entier
            selectPin(feature.id, feature.geometry.coordinates, JSON.parse(feature.properties.full_details));
        }
    }
    
    function handleListItemClick(e) {
        const link = e.target.closest('a[data-lng][data-lat]');
        if (link && map) {
            e.preventDefault();
            const { lng, lat, propertyIdLink } = link.dataset;
            const propertyId = parseInt(propertyIdLink, 10); // Ceci est correct
            const coordinates = [parseFloat(lng), parseFloat(lat)];
            
            map.flyTo({ center: coordinates, zoom: 16, speed: 0.7 });

            const announcementData = allAnnouncements.find(a => parseInt(a.id, 10) === propertyId);
            if (announcementData) {
                 map.once('moveend', () => selectPin(propertyId, coordinates, announcementData));
            } else {
                console.warn(`Données d'annonce non trouvées pour l'ID ${propertyId} lors du clic sur la liste.`);
            }
        }
    }

    // CORRIGÉ : 'properties' est maintenant l'objet annonce complet
    function selectPin(propertyIdAsInt, coordinates, annonceProperties) {
        isMobile = window.innerWidth < 768; 

        if (currentDesktopPopup) currentDesktopPopup.remove();
        if (mobilePopupSheet) mobilePopupSheet.classList.remove('active');
        unselectCurrentPin(); 

        // 'propertyIdAsInt' est l'ID numérique correct pour setFeatureState
        map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: propertyIdAsInt }, { selected: true });
        currentSelectedPropertyId = propertyIdAsInt;

        if (isMobile) {
            if(mobilePopupImage) mobilePopupImage.src = getNestedValue(annonceProperties, '_property_photos.0.images.0.url') || '';
            if(mobilePopupImage && getNestedValue(annonceProperties, '_property_photos.0.images.0.url')) mobilePopupImage.style.display = 'block'; else if(mobilePopupImage) mobilePopupImage.style.display = 'none';
            if(mobilePopupTitle) mobilePopupTitle.textContent = annonceProperties.property_title || 'Titre non disponible';
            const loyer = getNestedValue(annonceProperties, '_property_lease_of_property.0.loyer') || getNestedValue(annonceProperties, '_property_lease_of_property.0.loyer_cc');
            if(mobilePopupPrice) mobilePopupPrice.textContent = `${loyer || '?'}€ / mois`;
            if(mobilePopupLink) mobilePopupLink.href = `annonce?id=${annonceProperties.id}`;
            if(mobilePopupSheet) mobilePopupSheet.classList.add('active');
        } else {
            currentDesktopPopup = new maplibregl.Popup({ offset: 25, className: 'airbnb-style-popup', maxWidth: "320px" }) // offset augmenté
                .setLngLat(coordinates)
                .setHTML(createDesktopPopupHTML(annonceProperties)) // Passer l'objet annonce complet
                .addTo(map);

            currentDesktopPopup.on('close', () => {
                unselectCurrentPin();
                currentDesktopPopup = null;
            });
        }
    }

    function unselectCurrentPin() {
        if (currentSelectedPropertyId !== null) {
            // S'assurer que currentSelectedPropertyId est bien un nombre
            if (typeof currentSelectedPropertyId === 'number') {
                 map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: currentSelectedPropertyId }, { selected: false });
            }
            currentSelectedPropertyId = null;
        }
    }
    
    // ========================================================================
    // FONCTIONS UTILITAIRES ET DE SYNCHRONISATION
    // ========================================================================
    function updateVisibleList() {
        if (!map || !map.isStyleLoaded() || !listContainer) return;
        try {
            const visibleFeatures = map.queryRenderedFeatures({ layers: [LAYER_ID_PINS] });
            const visibleIds = new Set(visibleFeatures.map(f => String(f.id))); // Utiliser f.id directement
            
            listContainer.querySelectorAll('a[data-property-id-link]').forEach(link => {
                link.classList.toggle('annonce-list-item-hidden', !visibleIds.has(link.dataset.propertyIdLink));
            });
        } catch (e) {
            console.warn("[MAP_SCRIPT V21] Erreur dans updateVisibleList:", e);
        }
    }
    
    // CORRIGÉ : 'properties' est maintenant l'objet annonce complet
    function createDesktopPopupHTML(annonceProperties) {
        const detailLink = `annonce?id=${annonceProperties.id}`;
        const coverPhoto = getNestedValue(annonceProperties, '_property_photos.0.images.0.url');
        const title = annonceProperties.property_title;
        const loyer = getNestedValue(annonceProperties, '_property_lease_of_property.0.loyer') || getNestedValue(annonceProperties, '_property_lease_of_property.0.loyer_cc');
        const price = loyer != null ? loyer : '?';

        return `<div class="map-custom-popup">
                    <img src="${coverPhoto || ''}" alt="${title || ''}" class="popup-image" onerror="this.style.display='none'; this.onerror=null;">
                    <div class="popup-info">
                        <h4 class="popup-title">${title || 'Titre non disponible'}</h4>
                        <p class="popup-price">${price}€ / mois</p>
                        <div class="popup-actions">
                            <a href="${detailLink}" class="popup-link" target="_blank">Voir les détails</a>
                        </div>
                    </div>
                </div>`;
    }
    
    function convertAnnoncesToGeoJSON(annonces) {
        return { type: 'FeatureCollection', features: annonces.map(annonce => {
            if (!annonce || annonce.id == null || annonce.latitude == null || annonce.longitude == null ) {
                console.warn(`[MAP V21 CONVERT] Annonce ignorée (données de base manquantes):`, annonce);
                return null;
            }
            const loyer = getNestedValue(annonce, '_property_lease_of_property.0.loyer') || getNestedValue(annonce, '_property_lease_of_property.0.loyer_cc');
            const idAsInt = parseInt(annonce.id, 10);

            if (isNaN(idAsInt)) {
                console.warn(`[MAP V21 CONVERT] ID d'annonce non entier ignoré: ${annonce.id}`);
                return null;
            }

            return {
                type: 'Feature', 
                id: idAsInt, 
                geometry: { type: 'Point', coordinates: [parseFloat(annonce.longitude), parseFloat(annonce.latitude)] },
                properties: { 
                    // L'ID est déjà à la racine. On stocke id_str pour les liens URL.
                    id_str: String(annonce.id), 
                    price: loyer != null ? loyer : '?', 
                    title: getNestedValue(annonce, 'property_title'), 
                    coverPhoto: getNestedValue(annonce, '_property_photos.0.images.0.url'),
                    full_details: JSON.stringify(annonce) // Pour passer toutes les données facilement
                }
            };
        }).filter(Boolean)};
    }
    
    function getBounds(geojson) {
        const bounds = new maplibregl.LngLatBounds();
        if (geojson && geojson.features && geojson.features.length > 0) {
            let validCoordsFound = false;
            geojson.features.forEach(feature => {
                if (feature && feature.geometry && feature.geometry.coordinates && feature.geometry.coordinates.length === 2) {
                    const lng = feature.geometry.coordinates[0];
                    const lat = feature.geometry.coordinates[1];
                    if (typeof lng === 'number' && typeof lat === 'number' && !isNaN(lng) && !isNaN(lat)) {
                        try { 
                            bounds.extend([lng, lat]);
                            validCoordsFound = true;
                        } catch (e) { 
                            console.warn("[MAP_SCRIPT V21] Coordonnée invalide pour bounds.extend:", feature.geometry.coordinates, e); 
                        }
                    } else {
                        console.warn("[MAP_SCRIPT V21] Coordonnées non numériques ignorées pour bounds:", feature.geometry.coordinates);
                    }
                }
            });
            if (!validCoordsFound) return null; // Retourner null si aucune coordonnée valide n'a été ajoutée
        } else {
            return null; // Retourner null si geojson est vide ou invalide
        }
        return bounds;
    }

    function getNestedValue(obj, path) { /* ... Identique à V17 ... */ }

    if (document.getElementById(MAP_CONTAINER_ID)) {
        console.log("[MAP_SCRIPT V21] En attente de 'annoncesChargeesEtRendues' pour initialiser la carte.");
    } else {
        console.warn("[MAP_SCRIPT V21] Conteneur de carte non trouvé.");
    }
});

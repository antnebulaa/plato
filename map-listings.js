// map-listings.js - VERSION 12.2 - Corrigée et Robuste
document.addEventListener('DOMContentLoaded', function() {
    console.log('[MAP_SCRIPT V12.2] Initialisation du script de carte.');

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
    let currentPopup = null; // Pour le popup MapLibre sur desktop
    let selectedPinId = null;

    // --- Gestion du redimensionnement de la fenêtre ---
    window.addEventListener('resize', () => {
        isMobile = window.innerWidth < 768;
        const mobileToggleButton = document.getElementById(MOBILE_TOGGLE_BUTTON_ID);
        const mobileInfoCardContainer = document.getElementById('mobile-bottom-sheet');
        
        if (isMobile && currentPopup) {
            currentPopup.remove();
            currentPopup = null;
        }
        if (!isMobile && mobileInfoCardContainer && mobileInfoCardContainer.classList.contains('visible')) {
            closeMobileInfoCard();
        }
        if (mobileToggleButton) {
            mobileToggleButton.style.display = isMobile ? 'block' : 'none';
        }
    });

    // --- Écouteur principal pour le chargement des données d'annonces ---
    document.addEventListener('annoncesChargeesEtRendues', (event) => {
        const annonces = event.detail.annonces || [];
        const geojsonData = convertAnnoncesToGeoJSON(annonces);

        if (!map) {
            initializeMap(geojsonData);
        } else {
            const source = map.getSource(SOURCE_ID_ANNONCES);
            if (source) {
                source.setData(geojsonData);
                if (geojsonData.features.length > 0) {
                    const bounds = getBounds(geojsonData);
                    if (!bounds.isEmpty()) { // Utilisation de la méthode correcte !
                        map.fitBounds(bounds, { padding: 80, maxZoom: 16 });
                    }
                }
            }
        }
    });
    
    // --- Fonctions de la Carte ---

    function initializeMap(initialGeoJSON) {
        if (map) return; // Empêcher la réinitialisation
        
        map = new maplibregl.Map({
            container: MAP_CONTAINER_ID,
            style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_API_KEY}`,
            pitch: 0,
            bearing: 0,
            center: [2.3522, 48.8566], // Centre par défaut (Paris)
            zoom: 11
        });
        
        map.on('load', () => {
            console.log('[MAP] Carte chargée.');
            map.addSource(SOURCE_ID_ANNONCES, { type: 'geojson', data: initialGeoJSON, promoteId: 'id' });
            
            // Ajout des couches
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

            // Ajout des écouteurs d'événements
            map.on('click', LAYER_ID_PINS, handlePinClick);
            map.on('click', handleMapGeneralClick);
            map.on('mouseenter', LAYER_ID_PINS, () => map.getCanvas().style.cursor = 'pointer');
            map.on('mouseleave', LAYER_ID_PINS, () => map.getCanvas().style.cursor = '');
            map.on('moveend', updateVisibleList);

            // Zoom initial si des données sont présentes
            if (initialGeoJSON.features.length > 0) {
                const bounds = getBounds(initialGeoJSON);
                if (!bounds.isEmpty()) { // Utilisation de la méthode correcte !
                    map.fitBounds(bounds, { padding: 80, duration: 0, maxZoom: 16 });
                }
            }
            updateVisibleList();
        });

        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    }

    // Clic sur un Pin
    function handlePinClick(e) {
        if (e.features && e.features.length > 0) {
            e.originalEvent.stopPropagation(); // Empêcher que le clic soit aussi traité par handleMapGeneralClick

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

    // Clic en dehors d'un Pin
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

    // --- Fonctions de la Carte d'Info Mobile ---

    function openMobileInfoCard(properties) {
        // CORRECTION : On cherche l'élément ICI, au moment du clic.
        const mobileInfoCardContainer = document.getElementById('mobile-bottom-sheet');
        const mobileInfoCardContent = document.getElementById('mobile-bottom-sheet-content');

        if (!mobileInfoCardContainer || !mobileInfoCardContent) {
            console.error('[INFO_CARD] Conteneur de la carte info mobile introuvable. Vérifiez que l\'élément avec l\'ID "mobile-bottom-sheet" et son enfant avec l\'ID "mobile-bottom-sheet-content" existent dans le DOM.');
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
        // CORRECTION : On cherche l'élément ICI, au moment de la fermeture.
        const mobileInfoCardContainer = document.getElementById('mobile-bottom-sheet');
        if (!mobileInfoCardContainer) return;
        
        mobileInfoCardContainer.classList.remove('visible');
        
        if (map && selectedPinId !== null) {
            map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: selectedPinId }, { selected: false });
            selectedPinId = null;
        }
    }

    // --- Fonctions de génération de HTML ---

    function createMobileInfoCardHTML(properties) {
        const placeholderImage = 'https://via.placeholder.com/400x225/cccccc/969696?text=Image';
        const coverPhoto = properties.coverPhoto || placeholderImage;
        const title = properties.title || "Titre non disponible";
        const priceText = properties.price ? `<strong>${properties.price} €</strong> par mois` : "";
        const location = properties.city || "Lieu non disponible";
        const type = properties.type || "Logement";
        const ratingDisplay = `★ 4.64 (314)`; // Placeholder, à remplacer par vos vraies données

        return `
            <div class="info-card-mobile">
                <a href="annonce?id=${properties.id_str}" style="text-decoration: none; color: inherit;">
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

    // --- Fonctions Utilitaires ---

    function updateVisibleList() { /* ... Votre fonction existante ici ... */ }

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
    
    function getNestedValue(obj, path) { /* ... Votre fonction existante ici ... */ }

    // --- Initialisation du bouton Toggle Mobile ---
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

// map-listings.js - VERSION 11 - Popup mobile et améliorations
document.addEventListener('DOMContentLoaded', function() {
    console.log('[MAP_SCRIPT V11] Popup mobile fixe et améliorations.');

    const MAPTILER_API_KEY = 'UsgTlLJiePXeSnyh57aL'; // Remplacez par votre clé MapTiler
    const MAP_CONTAINER_ID = 'map-section';
    const LIST_CONTAINER_ID = 'annonces-wrapper'; // Assurez-vous que cet ID correspond à votre conteneur de liste
    const MOBILE_TOGGLE_BUTTON_ID = 'mobile-map-toggle';

    const SOURCE_ID_ANNONCES = 'annonces-source';
    const LAYER_ID_PINS = 'annonces-pins-layer';
    const LAYER_ID_LABELS = 'annonces-labels-layer';

    const SOURCE_NAME_BUILDINGS = 'maptiler_planet';
    const SOURCE_LAYER_NAME_BUILDINGS = 'building';
    const LAYER_ID_BUILDINGS_3D = 'buildings-3d-layer';

    // IDs pour le popup mobile
    const MOBILE_POPUP_ID = 'mobile-listing-popup';
    const MOBILE_POPUP_CONTENT_ID = 'mobile-listing-popup-content';
    const MOBILE_POPUP_CLOSE_BUTTON_ID = 'mobile-listing-popup-close';

    const listContainer = document.getElementById(LIST_CONTAINER_ID);
    const mobileToggleButton = document.getElementById(MOBILE_TOGGLE_BUTTON_ID);

    let map = null;
    let allAnnouncements = [];
    let isMobile = window.innerWidth < 768; // Point de rupture pour mobile
    let mapLibrePopup = null; // Pour le popup MapLibre sur desktop
    let selectedPinId = null;

    let mobilePopupElement = null;
    let mobilePopupContentElement = null;
    let mobilePopupCloseButton = null;
    let currentHighlightedBuildingIds = new Set();


    // Initialisation des éléments du DOM pour le popup mobile
    mobilePopupElement = document.getElementById(MOBILE_POPUP_ID);
    mobilePopupContentElement = document.getElementById(MOBILE_POPUP_CONTENT_ID);
    mobilePopupCloseButton = document.getElementById(MOBILE_POPUP_CLOSE_BUTTON_ID);

    if (mobilePopupCloseButton && mobilePopupElement) {
        mobilePopupCloseButton.addEventListener('click', () => {
            mobilePopupElement.classList.remove('visible');
            // Attendre la fin de la transition pour masquer complètement
            setTimeout(() => {
                if (!mobilePopupElement.classList.contains('visible')) { // Vérifier au cas où il aurait été rouvert
                     mobilePopupElement.style.display = 'none';
                }
            }, 300);


            if (selectedPinId !== null && map && map.getSource(SOURCE_ID_ANNONCES)) {
                map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: selectedPinId }, { selected: false });
                selectedPinId = null;
            }
        });
    } else {
        console.warn("[MAP_SCRIPT V11] Éléments du DOM pour le popup mobile non trouvés. Le popup mobile ne fonctionnera pas.");
    }


    document.addEventListener('annoncesChargeesEtRendues', (event) => {
        const annonces = event.detail.annonces;
        if (!annonces || !Array.isArray(annonces)) {
            console.warn("[MAP_SCRIPT V11] Aucune annonce reçue ou format incorrect.");
            return;
        }
        
        allAnnouncements = annonces;
        const geojsonData = convertAnnoncesToGeoJSON(allAnnouncements);

        if (!map) {
            initializeMap(geojsonData);
        } else {
            if (map.getSource(SOURCE_ID_ANNONCES)) {
                map.getSource(SOURCE_ID_ANNONCES).setData(geojsonData);
            } else {
                // Source pas encore prête, essayer d'ajouter plus tard ou recharger
                map.once('styledata', () => {
                    if (map.getSource(SOURCE_ID_ANNONCES)) {
                         map.getSource(SOURCE_ID_ANNONCES).setData(geojsonData);
                    } else {
                        // Si toujours pas là, on l'ajoute (cas rare)
                        map.addSource(SOURCE_ID_ANNONCES, { type: 'geojson', data: geojsonData, promoteId: 'id' });
                    }
                });
            }
            
            if (map.isStyleLoaded()) {
                 mettreAJourBatimentsSelectionnes(allAnnouncements);
            } else {
                map.once('load', () => mettreAJourBatimentsSelectionnes(allAnnouncements));
            }

            if (geojsonData.features.length > 0) {
                 const bounds = getBounds(geojsonData);
                 map.fitBounds(bounds, { padding: isMobile ? 40: 80, maxZoom: 16 });
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
            let featureId = parseInt(annonce.id, 10); // Assurer que l'ID est un nombre pour promoteId
            if (isNaN(featureId)) return null;

            return {
                type: 'Feature',
                id: featureId, // Utilisé par promoteId
                geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
                properties: {
                    // Garder id_str pour les liens car l'ID original peut être une chaîne
                    id_str: String(annonce.id), 
                    price: getNestedValue(annonce, '_property_lease_of_property.0.loyer') || '?',
                    title: getNestedValue(annonce, 'property_title'),
                    coverPhoto: getNestedValue(annonce, '_property_photos.0.images.0.url')
                }
            };
        }).filter(feature => feature !== null);
        return { type: 'FeatureCollection', features };
    }
    
    async function mettreAJourBatimentsSelectionnes(annonces) {
        if (!map || !map.isStyleLoaded() || !map.getSource(SOURCE_NAME_BUILDINGS)) {
            console.warn("[BÂTIMENTS DEBUG] Style ou source non chargé, impossible de mettre à jour les bâtiments.");
            return;
        }

        // Réinitialiser
        currentHighlightedBuildingIds.forEach(buildingId => {
             try {
                map.setFeatureState({ source: SOURCE_NAME_BUILDINGS, sourceLayer: SOURCE_LAYER_NAME_BUILDINGS, id: buildingId }, { highlighted: false });
             } catch(e){ /* console.warn("Erreur réinitialisation état bâtiment:", e.message) */ }
        });
        currentHighlightedBuildingIds.clear();

        if (!annonces || annonces.length === 0) return;
        
        await map.once('idle');
        
        const newBuildingIdsToHighlight = new Set();
        for (const annonce of annonces) {
            const lat = getNestedValue(annonce, 'geo_location.data.lat');
            const lng = getNestedValue(annonce, 'geo_location.data.lng');
            if (lat && lng) {
                const point = map.project([lng, lat]);
                const queryBoxSize = 10; // Taille de la boîte de requête autour du point
                const queryBox = [ [point.x - queryBoxSize, point.y - queryBoxSize], [point.x + queryBoxSize, point.y + queryBoxSize] ];
                
                const features = map.queryRenderedFeatures(queryBox, { layers: [LAYER_ID_BUILDINGS_3D] });
                if (features.length > 0 && features[0].id !== undefined) {
                    newBuildingIdsToHighlight.add(features[0].id);
                }
            }
        }

        newBuildingIdsToHighlight.forEach(buildingId => {
            try {
                map.setFeatureState({ source: SOURCE_NAME_BUILDINGS, sourceLayer: SOURCE_LAYER_NAME_BUILDINGS, id: buildingId }, { highlighted: true });
            } catch(e){ /* console.warn("Erreur màj état bâtiment:", e.message) */ }
        });
        currentHighlightedBuildingIds = newBuildingIdsToHighlight;
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
            pitch: isMobile ? 0 : 50, // Moins de pitch sur mobile pour une meilleure lisibilité
            bearing: isMobile ? 0 : -15,
            center: [2.3522, 48.8566], // Paris par défaut
            zoom: 11,
            navigationControl: false, // Sera ajouté manuellement
            renderWorldCopies: false,
            interactive: true, // Assurer que la carte est interactive
        });
        
        window.map = map; // Pour le débogage

        if (initialGeoJSON && initialGeoJSON.features.length > 0) {
            const bounds = getBounds(initialGeoJSON);
            map.fitBounds(bounds, { padding: isMobile ? 40 : 80, duration: 0, maxZoom: 16 });
        }

        map.on('load', () => {
            console.log('[MAP_SCRIPT V11] Carte chargée.');
            map.addSource(SOURCE_ID_ANNONCES, { type: 'geojson', data: initialGeoJSON, promoteId: 'id' });

            const heightExpression = ['coalesce', ['get', 'height'], 20]; 
            const minHeightExpression = ['coalesce', ['get', 'min_height'], 0];
            
            // Vérifier si la source des bâtiments existe avant d'ajouter la couche
            if (map.getSource(SOURCE_NAME_BUILDINGS)) {
                 map.addLayer({
                    'id': LAYER_ID_BUILDINGS_3D,
                    'type': 'fill-extrusion',
                    'source': SOURCE_NAME_BUILDINGS,
                    'source-layer': SOURCE_LAYER_NAME_BUILDINGS,
                    'paint': { 
                        'fill-extrusion-color': ['case', ['boolean', ['feature-state', 'highlighted'], false], '#FF1493', '#dfdfdf'],
                        'fill-extrusion-height': heightExpression, 
                        'fill-extrusion-base': minHeightExpression, 
                        'fill-extrusion-opacity': 0.85
                    }
                }, LAYER_ID_PINS); // Insertion avant les pins
            } else {
                console.warn(`[MAP_SCRIPT V11] Source '${SOURCE_NAME_BUILDINGS}' non trouvée. La couche 3D des bâtiments ne sera pas ajoutée.`);
            }


            map.addLayer({
                id: LAYER_ID_PINS, type: 'circle', source: SOURCE_ID_ANNONCES,
                paint: {
                    'circle-radius': 26,
                    'circle-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#007bff', '#FFFFFF'],
                    'circle-stroke-width': ['case', ['boolean', ['feature-state', 'selected'], false], 2, 1.5],
                    'circle-stroke-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#FFFFFF', '#007bff']
                }
            });
            map.addLayer({
                id: LAYER_ID_LABELS, type: 'symbol', source: SOURCE_ID_ANNONCES,
                layout: {
                    'text-field': ['concat', ['to-string', ['get', 'price']], '€'],
                    'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'], // Assurez-vous que ces polices sont disponibles
                    'text-size': 14,
                    'text-allow-overlap': false, // Éviter le chevauchement des labels
                    'text-ignore-placement': false
                },
                paint: {
                    'text-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#FFFFFF', '#333333']
                }
            });
            
            map.on('click', LAYER_ID_PINS, handleMapClick);
            map.on('mouseenter', LAYER_ID_PINS, () => map.getCanvas().style.cursor = 'pointer');
            map.on('mouseleave', LAYER_ID_PINS, () => map.getCanvas().style.cursor = '');
            
            map.on('moveend', updateVisibleList); // Mettre à jour la liste après chaque mouvement de carte

            updateVisibleList(); // Appel initial
             if (map.isStyleLoaded() && map.getSource(SOURCE_NAME_BUILDINGS)) {
                mettreAJourBatimentsSelectionnes(allAnnouncements);
            }
        });
        
        map.on('error', (e) => {
            console.error('Erreur MapLibre:', e.error);
        });


        map.addControl(new maplibregl.NavigationControl(), 'top-right');
    }
    
    function updateVisibleList() {
        if (!map || !map.isStyleLoaded() || !listContainer || !map.getSource(SOURCE_ID_ANNONCES)) return;
        
        const visibleFeatures = map.queryRenderedFeatures({ layers: [LAYER_ID_PINS] });
        const visiblePropertyIds = new Set(visibleFeatures.map(feature => String(feature.properties.id_str || feature.id))); // Utiliser id_str ou id
        
        const allListItems = listContainer.querySelectorAll('[data-property-id]'); // S'assurer que vos items de liste ont cet attribut
        
        allListItems.forEach(itemDiv => {
            const itemIdString = itemDiv.dataset.propertyId;
            const anchorTag = itemDiv.parentElement.tagName === 'A' ? itemDiv.parentElement : itemDiv; // L'item ou son parent 'A'

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

    function createPopupHTML(properties) {
        // properties contient id_str, price, title, coverPhoto
        const placeholderImage = 'https://placehold.co/280x150/EFEFEF/AAAAAA?text=Image'; // Placeholder plus neutre
        const coverPhoto = properties.coverPhoto || placeholderImage;
        const title = properties.title || "Titre non disponible";
        const priceText = `${properties.price || '?'} € / mois`; // Ou par nuit selon votre logique
        const detailLink = `annonce?id=${properties.id_str}`; // Lien vers la page de détail

        // La classe map-custom-popup sera stylée différemment pour mobile et desktop par le CSS
        return `
            <div class="map-custom-popup">
                <img src="${coverPhoto}" alt="${title}" class="popup-image" onerror="this.onerror=null;this.src='${placeholderImage}';">
                <div class="popup-info">
                    <h4 class="popup-title">${title}</h4>
                    <p class="popup-price">${priceText}</p>
                    <a href="${detailLink}" class="popup-link" target="_blank">Voir détails</a>
                </div>
            </div>`;
    }
    
    function handleMapClick(e) {
        if (!e.features || e.features.length === 0) return;

        const feature = e.features[0];
        const coordinates = feature.geometry.coordinates.slice();
        const properties = feature.properties; // Contient id_str, price, title, coverPhoto
        const clickedPinId = feature.id; // C'est l'ID numérique du feature (utilisé pour feature-state)

        // Désélectionner l'ancien pin si différent
        if (selectedPinId !== null && selectedPinId !== clickedPinId) {
            map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: selectedPinId }, { selected: false });
        }
        // Sélectionner le nouveau pin
        map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: clickedPinId }, { selected: true });
        selectedPinId = clickedPinId;

        if (isMobile) {
            // Cacher le popup MapLibre s'il existe (ex: après redimensionnement)
            if (mapLibrePopup) {
                mapLibrePopup.remove();
                mapLibrePopup = null;
            }

            if (mobilePopupElement && mobilePopupContentElement) {
                const popupHTML = createPopupHTML(properties);
                mobilePopupContentElement.innerHTML = popupHTML;
                mobilePopupElement.style.display = 'flex'; // Ou 'block' selon votre CSS final
                
                // Forcer le reflow pour que la transition s'applique
                void mobilePopupElement.offsetWidth; 
                mobilePopupElement.classList.add('visible');

                // Optionnel: centrer la carte sur le pin cliqué sur mobile
                map.flyTo({ center: coordinates, zoom: Math.max(map.getZoom(), 15), essential: true });
                scrollListItemIntoView(properties.id_str); // Scroller l'item dans la liste
            }
        } else { // Desktop
            // Cacher le popup mobile s'il est visible
            if (mobilePopupElement && mobilePopupElement.classList.contains('visible')) {
                mobilePopupElement.classList.remove('visible');
                 setTimeout(() => {
                    if (!mobilePopupElement.classList.contains('visible')) {
                         mobilePopupElement.style.display = 'none';
                    }
                }, 300);
            }

            if (mapLibrePopup) {
                mapLibrePopup.remove();
            }
            const popupHTML = createPopupHTML(properties);
            mapLibrePopup = new maplibregl.Popup({ 
                offset: 10, 
                closeButton: true, 
                className: 'airbnb-style-popup' // Pour le style CSS
            })
            .setLngLat(coordinates)
            .setHTML(popupHTML)
            .addTo(map);

            mapLibrePopup.on('close', () => {
                // Vérifier si c'est bien le pin actuellement sélectionné qui est fermé
                if (selectedPinId === clickedPinId) { 
                    map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: selectedPinId }, { selected: false });
                    selectedPinId = null;
                }
                mapLibrePopup = null;
            });
        }
    }

    function getNestedValue(obj, path) {
        if (!obj || !path) return undefined;
        return path.split('.').reduce((acc, part) => {
            if (acc === undefined || acc === null) return undefined;
            // Gérer les indices de tableau (ex: "0", "1")
            const partAsInt = parseInt(part, 10);
            if (Array.isArray(acc) && !isNaN(partAsInt) && partAsInt >= 0 && partAsInt < acc.length) {
                return acc[partAsInt];
            }
            return acc[part];
        }, obj);
    }
    
    if (isMobile && mobileToggleButton) {
        mobileToggleButton.addEventListener('click', () => {
            const isActive = document.body.classList.toggle('map-is-active');
            if (isActive) {
                if (map) map.resize(); // Important pour que la carte s'affiche correctement
                mobileToggleButton.textContent = `Voir la liste`;
            } else {
                if (listContainer) listContainer.scrollTo(0, 0); // Remonter en haut de la liste
                mobileToggleButton.textContent = `Afficher la carte`; // Texte initial
                updateVisibleList(); // Mettre à jour le compte sur le bouton
            }
        });
    }

    // Gestion du redimensionnement de la fenêtre
    window.addEventListener('resize', () => {
        const previouslyMobile = isMobile;
        isMobile = window.innerWidth < 768;

        if (previouslyMobile !== isMobile) {
            console.log(`[MAP_SCRIPT V11] Mode changé: ${previouslyMobile ? 'Mobile -> Desktop' : 'Desktop -> Mobile'}`);
            // Si un pin est sélectionné, on ferme les popups pour éviter le mauvais type d'affichage
            if (selectedPinId !== null) {
                if (mapLibrePopup) {
                    mapLibrePopup.remove();
                    mapLibrePopup = null;
                }
                if (mobilePopupElement && mobilePopupElement.classList.contains('visible')) {
                    mobilePopupElement.classList.remove('visible');
                     setTimeout(() => {
                        if (!mobilePopupElement.classList.contains('visible')) {
                           mobilePopupElement.style.display = 'none';
                        }
                    }, 300);
                }
                // Le pin reste sélectionné (état visuel sur la carte), un nouveau clic affichera le bon type de popup.
            }
            // Mettre à jour le pitch et bearing si on passe de/vers mobile
            if (map) {
                map.setPitch(isMobile ? 0 : 50);
                map.setBearing(isMobile ? 0 : -15);
            }
        }
    });

    function scrollListItemIntoView(propertyIdStr) {
        if (!listContainer || !propertyIdStr) return;
        // Ne pas scroller si la carte est en mode plein écran sur mobile
        if (isMobile && document.body.classList.contains('map-is-active')) return;

        const itemInList = listContainer.querySelector(`[data-property-id="${propertyIdStr}"]`);
        if (itemInList) {
            // L'élément peut être l'ancre <a> ou un div à l'intérieur.
            // On cherche le parent <a> si l'item trouvé n'est pas lui-même une ancre.
            const scrollTarget = itemInList.closest('a, div[data-property-id]'); // Cherche le parent cliquable ou l'item lui-même
            if (scrollTarget) {
                scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
    }

});

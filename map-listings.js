// map-listings.js - VERSION AVEC POPUP AMÉLIORÉ ET PIN SÉLECTIONNÉ

document.addEventListener('DOMContentLoaded', function() {
    console.log('[MAP_SCRIPT V3] Initialisation avec pin sélectionné.');

    const MAPTILER_API_KEY = 'UsgTlLJiePXeSnyh57aL';
    const MAP_CONTAINER_ID = 'map-section';
    const LIST_CONTAINER_ID = 'annonces-wrapper';
    const MOBILE_TOGGLE_BUTTON_ID = 'mobile-map-toggle';
    const SOURCE_ID = 'annonces-source';
    const LAYER_ID_PINS = 'annonces-pins-layer';
    const LAYER_ID_LABELS = 'annonces-labels-layer';

    const listContainer = document.getElementById(LIST_CONTAINER_ID);
    const mobileToggleButton = document.getElementById(MOBILE_TOGGLE_BUTTON_ID);

    let map = null;
    let allAnnouncements = [];
    let isMobile = window.innerWidth < 768;
    let currentPopup = null;
    let selectedFeatureId = null; // Pour garder l'ID du pin actuellement sélectionné

    document.addEventListener('annoncesChargeesEtRendues', (event) => {
    const annonces = event.detail.annonces;
    if (!annonces || !Array.isArray(annonces)) return;
    
    allAnnouncements = annonces;
    const geojsonData = convertAnnoncesToGeoJSON(allAnnouncements);

    if (!map) {
        initializeMap(geojsonData);
        // On appelle la fonction une fois que la carte est prête et que les données sont là
        map.on('load', () => mettreAJourBatimentsSelectionnes(allAnnouncements));
    } else {
        if (selectedFeatureId !== null) {
            map.setFeatureState({ source: SOURCE_ID, id: selectedFeatureId }, { selected: false });
            selectedFeatureId = null;
        }
        map.getSource(SOURCE_ID).setData(geojsonData);
        // On met à jour les bâtiments à chaque changement de filtre
        mettreAJourBatimentsSelectionnes(allAnnouncements);
    }
})

// Fichier : map-listings (3).js
// FONCTION CORRIGÉE

function convertAnnoncesToGeoJSON(annonces) {
    const features = annonces.map(annonce => {
        const lat = getNestedValue(annonce, 'geo_location.data.lat');
        const lng = getNestedValue(annonce, 'geo_location.data.lng');

        if (annonce.id === undefined || annonce.id === null || lat === undefined || lng === undefined) {
            console.warn('[GEOJSON_CONVERT] Annonce sans ID ou coordonnées valides, ignorée:', annonce);
            return null;
        }

        let featureId = parseInt(annonce.id, 10);
        if (isNaN(featureId)) {
            console.warn('[GEOJSON_CONVERT] ID d\'annonce non numérique, ignorée:', annonce);
            return null;
        }

        return {
            type: 'Feature',
            // Laisser l'ID à la racine est une bonne pratique, mais l'essentiel pour `promoteId` est de l'avoir dans les propriétés.
            id: featureId, 
            geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
            properties: {
                // --- AJOUT DE LA LIGNE CRUCIALE CI-DESSOUS ---
                id: featureId, // Assure que MapLibre peut "promouvoir" cet ID.

                // Le reste de vos propriétés
                id_str: String(annonce.id), 
                price: getNestedValue(annonce, '_property_lease_of_property.0.loyer') || '?',
                title: getNestedValue(annonce, 'property_title'),
                coverPhoto: getNestedValue(annonce, '_property_photos.0.images.0.url')
            }
        };
    }).filter(Boolean); // filter(Boolean) est une façon élégante de retirer les "null"
    
    return { type: 'FeatureCollection', features };
}

    function initializeMap(initialGeoJSON) {
        map = new maplibregl.Map({
            container: MAP_CONTAINER_ID,
            style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_API_KEY}`,
            center: [2.3522, 48.8566],
            zoom: 11,
            renderWorldCopies: false
        });

        map.on('load', () => {
            console.log('[MAP_SCRIPT V3] Carte chargée. Ajout des couches et des événements.');

            map.addSource(SOURCE_ID, { 
                type: 'geojson', 
                data: initialGeoJSON,
                promoteId: 'id' // Indique à MapLibre d'utiliser la propriété 'id' de nos features comme ID de source
            });

            // AJOUT DE LA NOUVELLE COUCHE POUR LES BÂTIMENTS EN 3D
map.addLayer({
    'id': 'batiments-selectionnes-3d',
    'type': 'fill-extrusion',
    // La source 'composite' et 'building' sont les standards pour les données de bâtiments de MapTiler
    'source': 'maptiler', 
    'source-layer': 'building',
    // Au début, on filtre pour ne rien afficher. ['in', ['id'], '']
    'filter': ['in', ['id'], ''], 
    'paint': {
        'fill-extrusion-color': '#FF1493', // Un rose "Deep Pink" bien visible
        'fill-extrusion-height': [
            // On essaie de récupérer la hauteur réelle du bâtiment depuis les données de la carte
            'interpolate', ['linear'], ['zoom'],
            15, 0,
            16, ['get', 'height']
        ],
        'fill-extrusion-base': ['get', 'min_height'],
        'fill-extrusion-opacity': 0.85
    }
}, LAYER_ID_PINS); // Important : pour placer cette couche SOUS les pins
            
            // Couche des CERCLES (fond des pins)
            map.addLayer({
                id: LAYER_ID_PINS,
                type: 'circle',
                source: SOURCE_ID,
                paint: {
                    'circle-color': [
        'case',
        ['boolean', ['feature-state', 'selected'], false],
        '#007bff', // Bleu si sélectionné
        '#FFFFFF'  // Blanc par défaut
    ],
    'circle-stroke-color': [
        'case',
        ['boolean', ['feature-state', 'selected'], false],
        '#0056b3', // Bordure bleu foncé si sélectionné
        '#CCCCCC'  // Bordure grise par défaut
    ],
                    'circle-radius': 18, // Légèrement plus grand
                    'circle-stroke-width': [
                        'case',
                        ['boolean', ['feature-state', 'selected'], false],
                        2,       // Épaisseur de la bordure si sélectionné
                        1.5      // Épaisseur par défaut
                    ],
                    'circle-stroke-color': [
                        'case',
                        ['boolean', ['feature-state', 'selected'], false],
                        '#FFFFFF', // Couleur de bordure si sélectionné (blanc)
                        '#007bff'  // Couleur de bordure par défaut (bleu)
                    ]
                }
            });

            // Couche des LABELS (prix)
            map.addLayer({
                id: LAYER_ID_LABELS,
                type: 'symbol',
                source: SOURCE_ID,
                layout: {
                    'text-field': ['concat', ['to-string', ['get', 'price']], '€'],
                    'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                    'text-size': 11, // Légèrement plus petit pour tenir dans le cercle
                    'text-allow-overlap': true
                },
                paint: {
                    'text-color': [
        'case',
        ['boolean', ['feature-state', 'selected'], false],
        '#FFFFFF', // Texte blanc si sélectionné (sur fond bleu)
        '#333333'  // Texte gris foncé par défaut (sur fond blanc)
    ]
                }
            });

            map.on('click', LAYER_ID_PINS, handleMapClick);
            // map.on('click', LAYER_ID_LABELS, handleMapClick); // On peut aussi cliquer sur le label
            map.on('mouseenter', LAYER_ID_PINS, () => map.getCanvas().style.cursor = 'pointer');
            map.on('mouseleave', LAYER_ID_PINS, () => map.getCanvas().style.cursor = '');
            
            map.on('moveend', updateVisibleList);
            updateVisibleList();
        });

        map.addControl(new maplibregl.NavigationControl(), 'top-right');
    }



async function mettreAJourBatimentsSelectionnes(annonces) {
    if (!map.isStyleLoaded()) {
        console.log("Le style de la carte n'est pas encore chargé.");
        return;
    }
    
    // Attendre que la carte soit inactive (plus de mouvement) pour éviter des requêtes inutiles
    await map.once('idle');

    const buildingIds = new Set(); // Utiliser un Set pour éviter les doublons

    for (const annonce of annonces) {
        const lat = getNestedValue(annonce, 'geo_location.data.lat');
        const lng = getNestedValue(annonce, 'geo_location.data.lng');

        if (lat && lng) {
            // On convertit les coordonnées GPS en coordonnées pixel de l'écran
            const point = map.project([lng, lat]);
            // On interroge la carte pour trouver les features à ce pixel
            const features = map.queryRenderedFeatures(point, {
                layers: ['batiments-selectionnes-3d'] // On interroge notre propre couche (qui a accès à tous les bâtiments)
            });

            if (features.length > 0) {
                // On a trouvé un bâtiment, on ajoute son ID
                buildingIds.add(features[0].id);
            }
        }
    }
    
    const idsTrouves = Array.from(buildingIds);
    console.log(`Bâtiments trouvés et mis en surbrillance : ${idsTrouves.length}`);
    
    if (idsTrouves.length > 0) {
        // On met à jour le filtre de la couche pour afficher SEULEMENT les bâtiments avec les bons IDs
        map.setFilter('batiments-selectionnes-3d', ['in', ['id'], ...idsTrouves]);
    } else {
        // Si aucun bâtiment n'est trouvé, on s'assure que le filtre est vide
        map.setFilter('batiments-selectionnes-3d', ['in', ['id'], '']);
    }
}

function updateVisibleList() {
    if (!map || !map.isStyleLoaded() || !listContainer) {
        return;
    }

    const visibleFeatures = map.queryRenderedFeatures({ layers: [LAYER_ID_PINS] });
    // Utiliser String() pour être sûr de comparer des chaînes de caractères (les ID d'attributs data-* sont des strings)
    const visiblePropertyIds = new Set(visibleFeatures.map(feature => String(feature.properties.id))); 

    console.log(`[UPDATE_LIST] Annonces visibles sur la carte : ${visiblePropertyIds.size}`);

    const allListItems = listContainer.querySelectorAll('[data-property-id]');
    
    if (allListItems.length === 0) {
        console.warn('[UPDATE_LIST] Aucun item de liste avec [data-property-id] trouvé dans le conteneur HTML.');
    }

    allListItems.forEach(itemDiv => {
        const itemIdString = itemDiv.dataset.propertyId;
        const anchorTag = itemDiv.parentElement; // On récupère la balise <a> parente

        // Vérification de sécurité pour s'assurer que la structure est correcte
        if (!anchorTag || anchorTag.tagName !== 'A') {
            console.warn('[UPDATE_LIST] L\'item de liste n\'est pas contenu dans une balise <a> comme attendu :', itemDiv);
            // On masque l'item lui-même en dernier recours
            itemDiv.style.display = visiblePropertyIds.has(itemIdString) ? '' : 'none';
            return;
        }

        // On vérifie si l'ID de l'annonce est dans la liste des annonces visibles sur la carte
        if (visiblePropertyIds.has(itemIdString)) {
            // Si oui, on s'assure qu'elle est visible en retirant la classe qui la masque
            anchorTag.classList.remove('annonce-list-item-hidden');
        } else {
            // Sinon, on la masque en ajoutant la classe
            anchorTag.classList.add('annonce-list-item-hidden');
        }
    });

    if (isMobile && mobileToggleButton) {
        mobileToggleButton.textContent = `Voir les ${visiblePropertyIds.size} logements`;
    }
}
    function createPopupHTML(properties) {
        const placeholderImage = 'https://i.imgur.com/KpaGW6j.png';
        // On utilise original_id car 'id' est maintenant l'ID du feature MapLibre
        const coverPhoto = properties.coverPhoto || placeholderImage;
        const title = properties.title || "Titre non disponible";
        const priceText = `${properties.price || '?'} € / mois`;
        const detailLink = `annonce?id=${properties.id_str}`;

        return `
            <div class="map-custom-popup">
                <img src="${coverPhoto}" alt="${title}" class="popup-image">
                <div class="popup-info">
                    <h4 class="popup-title">${title}</h4>
                    <p class="popup-price">${priceText}</p>
                    <a href="${detailLink}" class="popup-link" target="_blank">Voir détails</a>
                </div>
            </div>
        `;
    }
    
function handleMapClick(e) {
    if (e.features && e.features.length > 0) {
        const feature = e.features[0];
        // console.log('[HANDLE_MAP_CLICK] Clicked feature object:', JSON.parse(JSON.stringify(feature))); // Décommentez pour inspecter l'objet feature entier si besoin

        const coordinates = feature.geometry.coordinates.slice();
        const properties = feature.properties;
        const clickedFeatureId = feature.id; 

        console.log('[HANDLE_MAP_CLICK] Clic sur feature ID:', clickedFeatureId, 'Propriétés:', properties);

        // Désélectionner l'ancien pin SEULEMENT s'il est différent du nouveau pin cliqué
        if (selectedFeatureId !== null && selectedFeatureId !== clickedFeatureId) {
            console.log('[HANDLE_MAP_CLICK] Effacement état "selected" pour ancien ID:', selectedFeatureId);
            map.setFeatureState({ source: SOURCE_ID, id: selectedFeatureId }, { selected: false });
        }

        // Mettre l'état 'selected' sur le nouveau pin (ou le réappliquer si c'est le même)
        console.log('[HANDLE_MAP_CLICK] Application état "selected" pour ID:', clickedFeatureId);
        map.setFeatureState({ source: SOURCE_ID, id: clickedFeatureId }, { selected: true });

        // --- AJOUT IMPORTANT POUR DÉBOGAGE CI-DESSOUS ---
        const currentState = map.getFeatureState({ source: SOURCE_ID, id: clickedFeatureId });
        console.log('[HANDLE_MAP_CLICK] État actuel du feature après setFeatureState:', currentState); 
        // --- FIN DE L'AJOUT POUR DÉBOGAGE ---

        selectedFeatureId = clickedFeatureId; // Mettre à jour l'ID du pin actuellement sélectionné

        if (currentPopup) {
            currentPopup.remove();
        }

        // Création et affichage de la nouvelle popup
        const popupHTML = createPopupHTML(properties);
        currentPopup = new maplibregl.Popup({ 
                offset: 10,
                closeButton: true, 
                className: 'airbnb-style-popup'
            })
            .setLngLat(coordinates)
            .setHTML(popupHTML)
            .addTo(map);

        currentPopup.on('close', () => {
            // À la fermeture de la popup, on désélectionne le pin UNIQUEMENT s'il est toujours celui qui est considéré comme selectedFeatureId
            if (selectedFeatureId === clickedFeatureId) { 
                console.log('[POPUP_CLOSE] Effacement état "selected" à la fermeture du popup pour ID:', clickedFeatureId);
                map.setFeatureState({ source: SOURCE_ID, id: clickedFeatureId }, { selected: false });
                selectedFeatureId = null; 
            }
            currentPopup = null;
        });
    }
}

    function getNestedValue(obj, path) {
        if (!path) return undefined;
        return path.split('.').reduce((acc, part) => (acc && acc[part] !== undefined) ? (isNaN(parseInt(part, 10)) ? acc[part] : acc[parseInt(part, 10)]) : undefined, obj);
    }
    
    if (isMobile && mobileToggleButton) {
        mobileToggleButton.addEventListener('click', () => {
            const isMapActive = document.body.classList.contains('map-is-active');
            if (isMapActive) {
                document.body.classList.remove('map-is-active');
                mobileToggleButton.textContent = 'Afficher la carte';
                if (listContainer) listContainer.scrollTo(0, 0);
            } else {
                document.body.classList.add('map-is-active');
                if (map) map.resize();
            }
        });
    }
});

// map-listings.js - VERSION 12 - Carte Info Mobile Style Airbnb
document.addEventListener('DOMContentLoaded', function() {
    console.log('[MAP_SCRIPT V12] Passage à la carte info mobile style Airbnb.');

    const MAPTILER_API_KEY = 'UsgTlLJiePXeSnyh57aL'; // Conservez votre clé
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
    let currentPopup = null; // Pour le popup MapLibre sur desktop
    let selectedPinId = null;

    // Éléments pour la carte d'info mobile (anciennement bottom sheet)
    const mobileInfoCardContainer = document.getElementById('mobile-bottom-sheet'); // On garde cet ID pour le conteneur principal
    const mobileInfoCardContent = document.getElementById('mobile-bottom-sheet-content'); // Conteneur pour le contenu injecté

    // --- Gestion du redimensionnement de la fenêtre ---
    window.addEventListener('resize', () => {
        const newIsMobile = window.innerWidth < 768;
        if (newIsMobile !== isMobile) {
            console.log('[RESIZE] isMobile a changé pour:', newIsMobile);
            isMobile = newIsMobile;
        }
        // Si on passe en mode mobile et qu'un popup desktop est ouvert, on le ferme
        if (isMobile && currentPopup) {
            currentPopup.remove();
            currentPopup = null;
        }
        // Si on passe en mode desktop et que la carte info mobile est ouverte, on la ferme
        if (!isMobile && mobileInfoCardContainer && mobileInfoCardContainer.classList.contains('visible')) {
            closeMobileInfoCard();
        }
    });

    // --- Réception des annonces depuis l'autre script ---
    document.addEventListener('annoncesChargeesEtRendues', (event) => {
        const annonces = event.detail.annonces;
        if (!annonces || !Array.isArray(annonces)) {
            console.error("[MAP_SCRIPT] Aucune annonce reçue ou format incorrect.");
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
                console.error("[MAP_SCRIPT] Source d'annonces non trouvée pour la mise à jour.");
                // Peut-être réinitialiser la carte ou la source ici
            }
            
            if (geojsonData.features.length > 0) {
                 const bounds = getBounds(geojsonData);
                 if (bounds.isValid()) { // S'assurer que les limites sont valides
                    map.fitBounds(bounds, { padding: 80, maxZoom: 16 });
                 } else {
                    map.flyTo({ center: [2.3522, 48.8566], zoom: 11 }); // Fallback Paris
                 }
            } else { 
                map.flyTo({ center: [2.3522, 48.8566], zoom: 11 }); // Fallback Paris
            }
        }
    });

    // --- Conversion des données d'annonces en GeoJSON ---
    function convertAnnoncesToGeoJSON(annonces) {
        const features = annonces.map(annonce => {
            const lat = getNestedValue(annonce, 'geo_location.data.lat');
            const lng = getNestedValue(annonce, 'geo_location.data.lng');
            
            if (annonce.id === undefined || annonce.id === null || lat === undefined || lng === undefined) {
                console.warn("[GEOJSON_CONVERT] Annonce avec ID ou géolocalisation manquant:", annonce);
                return null;
            }
            let featureId = parseInt(annonce.id, 10);
            if (isNaN(featureId)) {
                console.warn("[GEOJSON_CONVERT] ID d'annonce invalide (non numérique):", annonce.id);
                return null;
            }

            // Préparer les propriétés pour la carte d'info
            const properties = {
                id: featureId,
                id_str: String(annonce.id),
                price: getNestedValue(annonce, '_property_lease_of_property.0.loyer'),
                title: getNestedValue(annonce, 'property_title'),
                coverPhoto: getNestedValue(annonce, '_property_photos.0.images.0.url'),
                city: getNestedValue(annonce, 'city'),
                type: getNestedValue(annonce, 'house_type.0') || "Logement", // Exemple, adaptez 'house_type.0'
                // Ajoutez d'autres champs si nécessaire pour createMobileInfoCardHTML
                // rating: getNestedValue(annonce, 'VOTRE_CHAMP_RATING'), 
                // reviews: getNestedValue(annonce, 'VOTRE_CHAMP_NB_AVIS'),
            };
            
            return {
                type: 'Feature',
                id: featureId,
                geometry: {
                    type: 'Point',
                    coordinates: [parseFloat(lng), parseFloat(lat)]
                },
                properties: properties
            };
        }).filter(Boolean); // Élimine les nulls si des annonces n'ont pas pu être converties
        return { type: 'FeatureCollection', features };
    }

    // --- Calcul des limites pour zoomer sur les annonces ---
    function getBounds(geojson) {
        const bounds = new maplibregl.LngLatBounds();
        if (geojson && geojson.features && geojson.features.length > 0) {
            geojson.features.forEach(feature => {
                if (feature.geometry && feature.geometry.coordinates) {
                    bounds.extend(feature.geometry.coordinates);
                }
            });
        }
        return bounds;
    }

    // --- Initialisation de la carte MapLibre ---
    function initializeMap(initialGeoJSON) {
        map = new maplibregl.Map({
            container: MAP_CONTAINER_ID,
            style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_API_KEY}`,
            pitch: 0, // Commence en 2D, peut être modifié plus tard si besoin
            bearing: 0,
            navigationControl: false,
            renderWorldCopies: false,
            attributionControl: false // Pour cacher l'attribution MapTiler par défaut si vous l'ajoutez ailleurs
        });
        map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
        
        window.map = map; // Pour débogage

        if (initialGeoJSON && initialGeoJSON.features && initialGeoJSON.features.length > 0) {
            const bounds = getBounds(initialGeoJSON);
            if (bounds.isValid()) {
                map.fitBounds(bounds, { padding: 80, duration: 0, maxZoom: 16 });
            } else {
                map.setCenter([2.3522, 48.8566]); map.setZoom(11); // Fallback Paris
            }
        } else {
            map.setCenter([2.3522, 48.8566]); map.setZoom(11); // Fallback Paris
        }

        map.on('load', () => {
            console.log('[MAP_SCRIPT] Carte chargée. Ajout des couches.');
            map.addSource(SOURCE_ID_ANNONCES, { type: 'geojson', data: initialGeoJSON, promoteId: 'id' });

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

            map.addLayer({
                id: LAYER_ID_LABELS,
                type: 'symbol',
                source: SOURCE_ID_ANNONCES,
                layout: {
                    'text-field': ['concat', ['to-string', ['get', 'price']], '€'],
                    'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'], // Assurez-vous que ces polices sont chargées
                    'text-size': 14,
                    'text-allow-overlap': false,
                    'text-ignore-placement': false
                },
                paint: {
                    'text-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#FFFFFF', '#333333']
                }
            });
            
            map.on('click', LAYER_ID_PINS, handleMapClick);
            map.on('click', handleMapGeneralClick); // Pour fermer la carte info si on clique en dehors des pins
            map.on('mouseenter', LAYER_ID_PINS, () => map.getCanvas().style.cursor = 'pointer');
            map.on('mouseleave', LAYER_ID_PINS, () => map.getCanvas().style.cursor = '');
            map.on('moveend', updateVisibleList);

            updateVisibleList();
        });

        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    }
    
    // --- Mise à jour de la liste d'annonces en fonction des pins visibles ---
    function updateVisibleList() {
        if (!map || !map.isStyleLoaded() || !listContainer) return;
        const visibleFeatures = map.queryRenderedFeatures({ layers: [LAYER_ID_PINS] });
        const visiblePropertyIds = new Set(visibleFeatures.map(feature => String(feature.properties.id)));
        
        const allListItems = listContainer.querySelectorAll('[data-property-id]');
        allListItems.forEach(itemDivOrAnchor => {
            // L'élément avec data-property-id pourrait être l'ancre elle-même ou un enfant
            let targetElement = itemDivOrAnchor;
            if (itemDivOrAnchor.tagName !== 'A' && itemDivOrAnchor.parentElement.tagName === 'A') {
                targetElement = itemDivOrAnchor.parentElement;
            }
            const itemIdString = itemDivOrAnchor.dataset.propertyId;

            if (visiblePropertyIds.has(itemIdString)) {
                targetElement.classList.remove('annonce-list-item-hidden');
                targetElement.style.display = ''; // Assurez-vous qu'il est visible
            } else {
                targetElement.classList.add('annonce-list-item-hidden');
                targetElement.style.display = 'none'; // Cachez-le
            }
        });

        if (isMobile && mobileToggleButton) {
            mobileToggleButton.textContent = `Voir les ${visiblePropertyIds.size} logements`;
        }
    }

    // --- Création du HTML pour la carte d'information mobile ---
    function createMobileInfoCardHTML(properties) {
        const placeholderImage = 'https://via.placeholder.com/400x225/cccccc/969696?text=Image'; // Ratio 16:9
        const coverPhoto = properties.coverPhoto || placeholderImage;
        const title = properties.title || "Titre non disponible";
        const priceText = properties.price ? `<strong>${properties.price} €</strong> par mois` : "Prix non disponible";
        const location = properties.city || "Lieu non disponible";
        const type = properties.type || "Logement"; // 'type' est un exemple, utilisez le bon champ de vos 'properties'

        // Exemple pour le rating, adaptez avec vos vrais champs de 'properties'
        // const ratingValue = properties.rating_average || "N/A"; 
        // const reviewCount = properties.reviews_count || 0;
        // const ratingDisplay = (properties.rating_average && properties.reviews_count) ? `★ ${ratingValue} (${reviewCount} avis)` : "Pas encore d'avis";
        const ratingDisplay = `★ 4.64 (314)`; // Placeholder, remplacez par vos données

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
    
    // --- Création du HTML pour le popup desktop ---
    function createDesktopPopupHTML(properties) {
        const placeholderImage = 'https://via.placeholder.com/280x150/cccccc/969696?text=Image';
        const coverPhoto = properties.coverPhoto || placeholderImage;
        const title = properties.title || "Titre non disponible";
        const priceText = `${properties.price || '?'} € / mois`;
        const detailLink = `annonce?id=${properties.id_str}`;
        return `<div class="map-custom-popup"><img src="${coverPhoto}" alt="${title}" class="popup-image" onerror="this.src='${placeholderImage}'"><div class="popup-info"><h4 class="popup-title">${title}</h4><p class="popup-price">${priceText}</p><a href="${detailLink}" class="popup-link" target="_blank">Voir détails</a></div></div>`;
    }

    // --- Affichage de la carte d'information mobile ---
    function openMobileInfoCard(properties) {
        if (!mobileInfoCardContainer || !mobileInfoCardContent) {
            console.error('[INFO_CARD] Conteneur de la carte info mobile introuvable.');
            return;
        }
        
        const cardHTML = createMobileInfoCardHTML(properties);
        mobileInfoCardContent.innerHTML = cardHTML;
        
        mobileInfoCardContainer.classList.add('visible');
        document.body.classList.add('mobile-bottom-sheet-is-visible'); // Pour styler d'autres éléments si besoin

        const newCloseButton = document.getElementById('info-card-mobile-close-btn');
        if (newCloseButton) {
            newCloseButton.addEventListener('click', closeMobileInfoCard, { once: true });
        } else {
            console.warn('[INFO_CARD] Bouton #info-card-mobile-close-btn non trouvé après injection HTML.');
        }
    }

    // --- Fermeture de la carte d'information mobile ---
    function closeMobileInfoCard() {
        if (!mobileInfoCardContainer) return;
        
        mobileInfoCardContainer.classList.remove('visible');
        document.body.classList.remove('mobile-bottom-sheet-is-visible');
        
        // Optionnel : vider le contenu pour libérer la mémoire un peu après la transition
        // setTimeout(() => {
        // if (mobileInfoCardContent) mobileInfoCardContent.innerHTML = '';
        // }, 350); // Doit correspondre à la durée de la transition CSS

        if (map && selectedPinId !== null) {
            map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: selectedPinId }, { selected: false });
            selectedPinId = null;
        }
    }
    
    // --- Gestion du clic sur un pin de la carte ---
    function handleMapClick(e) {
        // e.preventDefault(); // Si l'événement est direct et non propagé
        // e.stopPropagation(); // Empêche l'événement de se propager à handleMapGeneralClick
        
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
        // Ne pas appeler closeMobileInfoCard ici, car ce handler est spécifique aux clics sur les PINS.
        // La fermeture par clic extérieur sera gérée par handleMapGeneralClick.
    }

    // --- Gestion du clic général sur la carte (pour fermer la carte info si ouverte) ---
    function handleMapGeneralClick(e) {
        // Vérifier si le clic était sur un pin (géré par handleMapClick)
        // queryRenderedFeatures renverra une liste vide si on clique sur la carte "vide"
        const features = map.queryRenderedFeatures(e.point, { layers: [LAYER_ID_PINS] });

        if (!features.length) { // Si le clic n'est PAS sur un pin
            if (isMobile && mobileInfoCardContainer && mobileInfoCardContainer.classList.contains('visible')) {
                console.log('[MAP_GENERAL_CLICK] Clic en dehors d\'un pin, fermeture de la carte info mobile.');
                closeMobileInfoCard();
            }
        }
    }

    // --- Helper pour accéder aux valeurs imbriquées ---
    function getNestedValue(obj, path) {
        if (!obj || !path) return undefined;
        return path.split('.').reduce((acc, part) => {
            if (acc && typeof acc === 'object' && acc[part] !== undefined) {
                // Gérer les indices de tableau numériques
                const index = parseInt(part, 10);
                if (Array.isArray(acc) && !isNaN(index)) {
                    return acc[index];
                }
                return acc[part];
            }
            return undefined;
        }, obj);
    }
    
    // --- Gestion du bouton toggle pour mobile ---
    if (mobileToggleButton) { // On vérifie que le bouton existe avant d'ajouter l'écouteur
        if (isMobile) {
            mobileToggleButton.style.display = 'block'; // Afficher le bouton sur mobile
        } else {
            mobileToggleButton.style.display = 'none'; // Cacher le bouton sur desktop
        }

        mobileToggleButton.addEventListener('click', () => {
            document.body.classList.toggle('map-is-active');
            if (document.body.classList.contains('map-is-active')) {
                if (map) map.resize(); // Important pour que la carte s'affiche correctement
                mobileToggleButton.textContent = `Voir la liste`; // ou une icône
            } else {
                if (listContainer) listContainer.scrollTo(0, 0);
                // Le texte du bouton est mis à jour par updateVisibleList
            }
        });
    } else {
        console.warn(`[MAP_SCRIPT] Bouton avec ID '${MOBILE_TOGGLE_BUTTON_ID}' non trouvé.`);
    }

    // Mettre à jour la visibilité du bouton toggle au redimensionnement
    window.addEventListener('resize', () => {
        // ... (la logique isMobile est déjà mise à jour plus haut)
        if (mobileToggleButton) {
            if (isMobile) {
                mobileToggleButton.style.display = 'block';
            } else {
                mobileToggleButton.style.display = 'none';
                // Si on passe en desktop et que la carte était active, on revient à l'affichage par défaut
                if (document.body.classList.contains('map-is-active')) {
                    document.body.classList.remove('map-is-active');
                    // S'assurer que la liste est visible et la carte cachée (selon vos styles CSS desktop)
                }
            }
        }
    });

});

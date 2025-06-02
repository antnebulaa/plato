// map-listings.js - VERSION HAUTE PERFORMANCE

document.addEventListener('DOMContentLoaded', function() {
    console.log('[MAP_SCRIPT V2] Initialisation du module de carte haute performance.');

    // --- Configuration ---
    const MAPTILER_API_KEY = 'UsgTlLJiePXeSnyh57aL'; // !! REMPLACEZ TOUJOURS PAR VOTRE CLÉ
    const MAP_CONTAINER_ID = 'map-section';
    const LIST_CONTAINER_ID = 'annonces-wrapper';
    const MOBILE_TOGGLE_BUTTON_ID = 'mobile-map-toggle';
    const MODAL_ID = 'annonce-modal';
    const SOURCE_ID = 'annonces-source'; // ID pour notre source de données
    const LAYER_ID_PINS = 'annonces-pins-layer'; // ID pour la couche des "pins" (le cercle)
    const LAYER_ID_LABELS = 'annonces-labels-layer'; // ID pour la couche des prix (le texte)

    // --- Références DOM & État ---
    const mobileToggleButton = document.getElementById(MOBILE_TOGGLE_BUTTON_ID);
    const modalElement = document.getElementById(MODAL_ID);
    let map = null;
    let allAnnouncements = [];
    let isMobile = window.innerWidth < 768;

    /**
     * Point d'entrée : attend que les annonces soient chargées par l'autre script.
     */
    document.addEventListener('annoncesChargeesEtRendues', (event) => {
        const annonces = event.detail.annonces;
        if (!annonces || !Array.isArray(annonces)) return;
        
        allAnnouncements = annonces;
        const geojsonData = convertAnnoncesToGeoJSON(allAnnouncements);

        if (!map) {
            initializeMap(geojsonData);
        } else {
            // Si la carte existe déjà, on met juste à jour la source de données
            map.getSource(SOURCE_ID).setData(geojsonData);
        }
    });

    /**
     * Transforme notre tableau d'annonces en une FeatureCollection GeoJSON.
     */
    function convertAnnoncesToGeoJSON(annonces) {
        const features = annonces.map(annonce => {
            const lat = getNestedValue(annonce, 'geo_location.data.lat');
            const lng = getNestedValue(annonce, 'geo_location.data.lng');
            
            if (!lat || !lng) return null;

            return {
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [lng, lat]
                },
                properties: { // On attache toutes les données de l'annonce ici
                    id: annonce.id,
                    price: getNestedValue(annonce, '_property_lease_of_property.0.loyer') || '?',
                    title: getNestedValue(annonce, 'property_title'),
                    coverPhoto: getNestedValue(annonce, '_property_photos.0.images.0.url')
                }
            };
        }).filter(Boolean); // Retire les annonces sans coordonnées

        return { type: 'FeatureCollection', features };
    }

    /**
     * Initialise la carte, la source de données et les couches.
     */
    function initializeMap(initialGeoJSON) {
        map = new maplibregl.Map({
            container: MAP_CONTAINER_ID,
            style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_API_KEY}`,
            center: [2.3522, 48.8566],
            zoom: 11
        });

        map.on('load', () => {
            console.log('[MAP_SCRIPT V2] Carte chargée. Ajout de la source et des couches.');

            // 1. Ajouter la source de données GeoJSON
            map.addSource(SOURCE_ID, {
                type: 'geojson',
                data: initialGeoJSON
            });

            // 2. Ajouter la couche pour les CERCLES derrière le texte (le fond du pin)
            map.addLayer({
                id: LAYER_ID_PINS,
                type: 'circle',
                source: SOURCE_ID,
                paint: {
                    'circle-color': 'white',
                    'circle-radius': 16, // Taille du cercle
                    'circle-stroke-width': 1,
                    'circle-stroke-color': '#BDBDBD'
                }
            });

            // 3. Ajouter la couche pour le TEXTE (le prix)
            map.addLayer({
                id: LAYER_ID_LABELS,
                type: 'symbol',
                source: SOURCE_ID,
                layout: {
                    'text-field': ['concat', ['to-string', ['get', 'price']], '€'], // Affiche la propriété "price" + "€"
                    'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
                    'text-size': 12,
                    'text-allow-overlap': true // Permet aux étiquettes de se superposer
                },
                paint: {
                    'text-color': '#000000'
                }
            });

            // Gérer les clics sur nos couches
            map.on('click', LAYER_ID_PINS, handleMapClick);
            map.on('click', LAYER_ID_LABELS, handleMapClick);

            // Changer le curseur en pointeur au survol
            map.on('mouseenter', LAYER_ID_PINS, () => map.getCanvas().style.cursor = 'pointer');
            map.on('mouseleave', LAYER_ID_PINS, () => map.getCanvas().style.cursor = '');
        });

        map.addControl(new maplibregl.NavigationControl(), 'top-right');
    }

    /**
     * Gère le clic sur un pin de la carte.
     */
    function handleMapClick(e) {
        if (e.features && e.features.length > 0) {
            const properties = e.features[0].properties;
            showAnnonceModal(properties);
        }
    }

    /**
     * Affiche l'aperçu de l'annonce dans une modale.
     */
    function showAnnonceModal(properties) {
        document.getElementById('modal-title').textContent = properties.title || "Titre non disponible";
        document.getElementById('modal-price').textContent = `${properties.price} € / mois`;
        document.getElementById('modal-link').href = `annonce?id=${properties.id}`;
        document.getElementById('modal-image').src = properties.coverPhoto || 'https://via.placeholder.com/400x250';
        modalElement.style.display = 'flex';
    }

    // --- Logique Mobile et Utilitaires (inchangés) ---

    function getNestedValue(obj, path) {
        if (!path) return undefined;
        return path.split('.').reduce((acc, part) => {
            if (acc === undefined || acc === null) return undefined;
            const index = parseInt(part, 10);
            return isNaN(index) ? acc[part] : acc[index];
        }, obj);
    }
    
    document.getElementById('modal-close-button').addEventListener('click', () => modalElement.style.display = 'none');
    modalElement.addEventListener('click', (e) => {
        if (e.target === modalElement) {
            modalElement.style.display = 'none';
        }
    });

    if (isMobile) {
        // La logique mobile devra être adaptée car la mise à jour de la liste est différente.
        // Pour l'instant on se concentre sur la carte.
    }
});

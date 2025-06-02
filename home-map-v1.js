// home-map-v1.js

document.addEventListener('DOMContentLoaded', function() {
    console.log('[MAP_SCRIPT] DOMContentLoaded - Initialisation de la carte.');

    // --- CONFIGURATION ---
    const MAP_CONTAINER_ID = 'map';
    const MAPTILER_API_KEY = 'VOTRE_CLE_API_MAPTILER_ICI'; // <-- REMPLACEZ CECI !

    const mapContainer = document.getElementById(MAP_CONTAINER_ID);
    if (!mapContainer) {
        console.error(`[MAP_SCRIPT] Erreur: Conteneur de carte #${MAP_CONTAINER_ID} non trouvé.`);
        return;
    }
    if (MAPTILER_API_KEY === 'VOTRE_CLE_API_MAPTILER_ICI') {
         console.error("[MAP_SCRIPT] Erreur: Veuillez remplacer 'VOTRE_CLE_API_MAPTILER_ICI' par votre clé d'API MapTiler.");
         mapContainer.innerHTML = '<p style="color:red; text-align:center; padding: 20px;">Configuration de la carte incomplète (clé API manquante).</p>';
         return;
    }
    
    // Initialisation de la carte
    const map = new maplibregl.Map({
        container: MAP_CONTAINER_ID,
        style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_API_KEY}`,
        center: [2.3522, 48.8566], // Coordonnées initiales (Paris)
        zoom: 11
    });

    let markers = []; // Pour garder une référence aux marqueurs et les supprimer facilement

    /**
     * Met à jour les marqueurs sur la carte en fonction des annonces fournies.
     * @param {Array} annonces - Un tableau d'objets annonce.
     */
    function updateMapMarkers(annonces) {
        console.log(`[MAP_SCRIPT] Mise à jour des marqueurs pour ${annonces.length} annonces.`);

        // 1. Supprimer les anciens marqueurs
        markers.forEach(marker => marker.remove());
        markers = [];

        // 2. Ajouter les nouveaux marqueurs
        annonces.forEach(annonce => {
            // Vérifier si on a des coordonnées valides
            const lat = getNestedValue(annonce, 'location.data.lat');
            const lng = getNestedValue(annonce, 'location.data.lng');
            const prix = getNestedValue(annonce, '_property_lease_of_property.0.loyer');

            if (lat === undefined || lng === undefined) {
                console.warn('[MAP_SCRIPT] Annonce sans coordonnées ignorée:', annonce.id);
                return;
            }

            // Créer l'élément HTML pour le pin de prix
            const el = document.createElement('div');
            el.className = 'price-marker-maplibre';
            el.textContent = prix ? `${prix}€` : '?€';
            
            // Stocker les données de l'annonce sur l'élément pour la modale
            el.dataset.annonceId = annonce.id;
            el.dataset.annonceTitre = annonce.property_title;
            el.dataset.annoncePrix = prix;
            // Récupérer l'URL de la photo de couverture
            const coverPhoto = getNestedValue(annonce, '_property_photos.0.images.0.url');
            if(coverPhoto) {
                el.dataset.annonceImage = coverPhoto;
            }

            // Ajouter le listener pour ouvrir la modale au clic
            el.addEventListener('click', () => {
                showAnnonceModal(el.dataset);
            });
            
            // Créer le marqueur MapLibre et l'ajouter à la carte
            const marker = new maplibregl.Marker(el)
                .setLngLat([lng, lat])
                .addTo(map);

            markers.push(marker);
        });
        console.log(`[MAP_SCRIPT] ${markers.length} marqueurs ajoutés à la carte.`);
    }
    
    /**
     * Affiche une modale avec les détails d'une annonce.
     * @param {Object} annonceData - Les données de l'annonce stockées dans le dataset du marqueur.
     */
    function showAnnonceModal(annonceData) {
        // Supprimer une éventuelle modale existante
        const existingModal = document.querySelector('.map-modal-overlay');
        if (existingModal) existingModal.remove();

        // Créer la structure de la modale
        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'map-modal-overlay';
        
        const modalContent = document.createElement('div');
        modalContent.className = 'map-modal-content';

        modalContent.innerHTML = `
            <button class="map-modal-close">X</button>
            <img src="${annonceData.annonceImage || 'https://via.placeholder.com/300x200'}" alt="Photo de ${annonceData.annonceTitre}">
            <h3>${annonceData.annonceTitre}</h3>
            <p>Loyer : <strong>${annonceData.annoncePrix} €</strong> / mois</p>
            <a href="/annonce?id=${annonceData.annonceId}" class="map-modal-link">Voir les détails</a>
        `;
        
        modalOverlay.appendChild(modalContent);
        document.body.appendChild(modalOverlay);

        // Gérer la fermeture de la modale
        modalOverlay.addEventListener('click', () => modalOverlay.remove());
        modalContent.addEventListener('click', (e) => e.stopPropagation()); // Empêche la fermeture si on clique DANS la modale
        modalContent.querySelector('.map-modal-close').addEventListener('click', () => modalOverlay.remove());
    }


    // --- ECOUTEURS D'EVENEMENTS ---

    // 1. Quand les annonces sont chargées par le script home-form-display, on met à jour la carte.
    document.addEventListener('annoncesChargeesEtRendues', function(event) {
        console.log('[MAP_SCRIPT] Événement "annoncesChargeesEtRendues" reçu.');
        if (event.detail && event.detail.items) {
            updateMapMarkers(event.detail.items);
        }
    });

    // 2. Quand l'utilisateur bouge la carte, on pourrait mettre à jour la liste (logique plus avancée)
    map.on('moveend', () => {
        const bounds = map.getBounds();
        const bbox = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()].join(',');
        console.log('[MAP_SCRIPT] La carte a bougé. Nouvelles limites (bbox):', bbox);
        
        // **LOGIQUE AVANCÉE (Optionnelle)**:
        // Pour que la liste se mette à jour, il faudrait que votre endpoint Xano
        // accepte un paramètre "bbox". Si c'est le cas, vous pourriez appeler :
        // fetchAnnouncements({ bbox: bbox });
        // Cela nécessite que fetchAnnouncements soit globale (voir Étape 3).
    });

    // Fonction utilitaire pour extraire des valeurs imbriquées (vous l'avez déjà dans home-form-display-v4.js)
    function getNestedValue(obj, pathString) {
        if (!obj || typeof pathString !== 'string') return undefined;
        return pathString.split('.').reduce((acc, part) => acc && acc[part], obj);
    }
});

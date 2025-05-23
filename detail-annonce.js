// ============================================
// == SCRIPT POUR LA PAGE DE DÉTAIL D'ANNONCE ==
// ============================================


// Variable globale pour stocker les données de la carte si l'API se charge après les données Xano
let mapDataToDisplay = null;
window.mapDataToDisplay = null; // Attachée à window pour être vraiment globale
// Drapeau pour savoir si l'API Google Maps est prête
window.googleMapsApiIsReady = false;


// Fonction principale pour initialiser et afficher la carte
window initializeDetailMap(latitude, longitude) {
    console.log('[MAP_SCRIPT_DETAIL] Tentative d\'initialisation de la carte de détail.');
    const mapElement = document.getElementById('property-location-map');
    if (!mapElement) {
        console.error("[MAP_SCRIPT_DETAIL] Élément #property-location-map introuvable.");
        return;
    }
    // Vérifier si les coordonnées sont valides (nombres)
    const latNum = parseFloat(latitude);
    const lngNum = parseFloat(longitude);

    if (isNaN(latNum) || isNaN(lngNum)) {
        console.warn("[MAP_SCRIPT] Coordonnées latitude/longitude invalides ou manquantes. Carte non affichée.");
        mapElement.innerHTML = "<p style='text-align:center; padding:20px;'>Localisation approximative non disponible.</p>";
        return;
    }

    // --- Ajustement pour une localisation moins précise ---
    // Option 1: Arrondir les coordonnées à ~3 décimales (environ 100m de précision)
    const displayLat = parseFloat(latNum.toFixed(3));
    const displayLng = parseFloat(lngNum.toFixed(3));
    // Option 2 (plus de flou): Ajouter un petit décalage aléatoire
    // const offset = 0.002; // Environ 200m
    // const displayLat = latNum + (Math.random() - 0.5) * offset;
    // const displayLng = lngNum + (Math.random() - 0.5) * offset;


    console.log(`[MAP_SCRIPT] Initialisation de la carte avec Lat: ${displayLat}, Lng: ${displayLng}`);

    try {
        const map = new google.maps.Map(mapElement, {
            center: { lat: displayLat, lng: displayLng },
            zoom: 14, // Un zoom de 14-15 montre un quartier, pas une adresse exacte.
            disableDefaultUI: true, // Cache la plupart des contrôles
            zoomControl: true,      // Mais on peut garder le contrôle du zoom
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: false,
            gestureHandling: 'cooperative' // Recommandé pour l'interaction sur mobile/desktop
        });

        // Afficher un simple marqueur (sur les coordonnées ajustées)
        // new google.maps.Marker({
        //    position: { lat: displayLat, lng: displayLng },
        //    map: map,
       //     // title: "Zone approximative du logement" // Optionnel
       // });

        // Ou, pour un cercle représentant une zone :
        
        new google.maps.Circle({
            strokeColor: '#4A90E2', // Couleur de la bordure du cercle
            strokeOpacity: 0.7,
            strokeWeight: 1,
            fillColor: '#4A90E2', // Couleur de remplissage
            fillOpacity: 0.20,
            map: map,
            center: { lat: displayLat, lng: displayLng },
            radius: 300 // Rayon en mètres (ajustez selon le niveau de "flou" désiré)
        });
        
        console.log("[MAP_SCRIPT] Carte initialisée avec succès.");

    } catch (e) {
        console.error("[MAP_SCRIPT] Erreur lors de l'initialisation de Google Maps:", e);
        mapElement.innerHTML = "<p style='text-align:center; padding:20px;'>Erreur lors du chargement de la carte.</p>";
    }
}



document.addEventListener('DOMContentLoaded', function () {
    console.log('[DETAIL_SCRIPT] DOMContentLoaded');

    const XANO_API_BASE_URL = 'https://xwxl-obyg-b3e3.p7.xano.io/api:qom0bt4V'; // Identique à votre script principal

    // Récupérer l'ID de l'annonce depuis les paramètres de l'URL (ex: details-annonce.html?id=123)
    const urlParams = new URLSearchParams(window.location.search);
    const propertyId = urlParams.get('id'); // Assurez-vous que le paramètre s'appelle 'id' ou adaptez

    const detailContainerElement = document.querySelector('[data-xano-detail-container]');

    if (!detailContainerElement) {
        console.error('[DETAIL_SCRIPT] Conteneur de détail principal non trouvé.');
        document.body.innerHTML = '<p style="color:red;">Erreur de configuration: conteneur de détail manquant.</p>';
        return;
    }

    if (!propertyId) {
        console.error('[DETAIL_SCRIPT] Erreur: ID de la propriété manquant dans l\'URL.');
        detailContainerElement.innerHTML = '<p style="color:red;">Aucune propriété spécifiée. ID manquant dans l\'URL.</p>';
        return;
    }

    // --- Copiez/Collez les fonctions getNestedValue, bindDataToElement et initializePageSwipers ---
    // --- de votre fichier home-form-display-v3.js ici, ou chargez-les depuis un fichier JS utilitaire commun ---

    // ELIDED: getNestedValue function (identique à celle de home-form-display-v3.js)
    // ELIDED: bindDataToElement function (identique à celle de home-form-display-v3.js)
    // ELIDED: initializePageSwipers function (identique à celle de home-form-display-v3.js)
    
   



function renderPhotoGrid(allPhotos, annonceDetails) { // annonceDetails est l'objet de l'annonce (ex: propertyData)
    const gridContainer = document.querySelector('.photo-grid-container'); // Adaptez si votre sélecteur est différent

    if (!gridContainer) {
        console.error("renderPhotoGrid: Conteneur de grille '.photo-grid-container' non trouvé.");
        return;
    }

    if (!allPhotos || !Array.isArray(allPhotos) || allPhotos.length === 0) {
        console.warn("renderPhotoGrid: Aucune photo à afficher ou données photos non valides.");
        gridContainer.style.display = 'none'; // Cache la grille si pas de photos
        return;
    } else {
        gridContainer.style.display = ''; // Ou votre style d'affichage par défaut pour la grille (flex, grid, etc.)
    }

    const displayedPhotoIds = new Set();

    // --- Fonctions utilitaires pour cibler les images et leurs conteneurs ---
    function getImageUrl(photo) {
        if (photo && photo.images && Array.isArray(photo.images) && photo.images.length > 0 && photo.images[0].url) {
            return photo.images[0].url;
        }
        console.warn("renderPhotoGrid: URL d'image non trouvée ou structure 'images' incorrecte pour la photo ID:", photo ? photo.id : 'inconnue');
        return null; // Ou une URL de placeholder
    }

    function getImageElement(slotName) {
        return gridContainer.querySelector(`img[data-photo-src="${slotName}"]`);
    }

    function getSlotElement(slotName) {
        const imgEl = getImageElement(slotName);
        return imgEl ? imgEl.closest('[data-grid-slot]') || imgEl.parentElement : null;
    }

    function displayPhoto(slotName, photo) {
        const imgElement = getImageElement(slotName);
        const slotElement = getSlotElement(slotName);
        const imageUrl = photo ? getImageUrl(photo) : null;

        if (imgElement && imageUrl) {
            imgElement.src = imageUrl;
            imgElement.alt = photo.photo_desc || (annonceDetails && annonceDetails.property_title ? `${annonceDetails.property_title} - ${slotName}` : `Photo ${slotName}`);
            if (slotElement) slotElement.style.display = '';
            if (photo) displayedPhotoIds.add(photo.id);
        } else if (slotElement) {
            console.warn(`renderPhotoGrid: Pas de photo ou URL valide pour le slot "${slotName}". Photo data:`, photo);
            slotElement.style.display = 'none';
        } else if (!imgElement && slotName) {
            console.warn(`renderPhotoGrid: Élément img pour slot "${slotName}" non trouvé.`);
        }
    }

    // 1. Trouver et afficher la photo de couverture
    let coverPhoto = allPhotos.find(p => p.is_cover === true);
    if (!coverPhoto && allPhotos.length > 0) {
        coverPhoto = [...allPhotos].sort((a, b) => (new Date(b.created_at).getTime()) - (new Date(a.created_at).getTime()))[0];
    }
    displayPhoto("cover", coverPhoto);
    
    // 2. Préparer les photos pour les petits slots
    const photosForSmallSlots = [];

    // a. Photos prioritaires : photo avec photo_order = 1 de chaque pièce (non déjà affichée)
    const roomPhotosMap = new Map();
    allPhotos.forEach(p => {
        // Utiliser "property_photos_rooms_id" comme identifiant de la pièce
        const roomId = p.property_photos_rooms_id; 
        if (roomId && !displayedPhotoIds.has(p.id)) {
            const currentPhotoInMap = roomPhotosMap.get(roomId);
            if (!currentPhotoInMap ||
                (p.photo_order === 1 && (currentPhotoInMap.photo_order !== 1 || (new Date(p.created_at).getTime()) > (new Date(currentPhotoInMap.created_at).getTime()))) || // Priorité à photo_order 1, puis la plus récente si plusieurs order 1
                (p.photo_order !== 1 && currentPhotoInMap.photo_order !== 1 && (p.photo_order || Infinity) < (currentPhotoInMap.photo_order || Infinity)) ||
                (p.photo_order !== 1 && currentPhotoInMap.photo_order !== 1 && (p.photo_order === currentPhotoInMap.photo_order) && (new Date(p.created_at).getTime()) > (new Date(currentPhotoInMap.created_at).getTime()))
            ) {
                roomPhotosMap.set(roomId, p);
            }
        }
    });
    
    // Trier les photos de pièces (par exemple, par nom de pièce si disponible, ou ordre de création de la pièce - non implémenté ici)
    // Pour l'instant, on les prend dans l'ordre où elles sont venues après le filtrage par photo_order
    const uniqueRoomPhotos = Array.from(roomPhotosMap.values())
                              // Optionnel: trier les photos de pièces, par ex. par nom de pièce si vous l'aviez, ou par ID de pièce
                              .sort((a,b) => (a.property_photos_rooms_id || 0) - (b.property_photos_rooms_id || 0)); 

    uniqueRoomPhotos.forEach(p => {
        if (photosForSmallSlots.length < 4 && !displayedPhotoIds.has(p.id)) {
            photosForSmallSlots.push(p);
            displayedPhotoIds.add(p.id);
        }
    });

    // b. Photos de fallback : les plus récentes, non déjà affichées, pour combler
    if (photosForSmallSlots.length < 4) {
        const fallbackPhotos = [...allPhotos]
            .filter(p => !displayedPhotoIds.has(p.id))
            .sort((a, b) => (new Date(b.created_at).getTime()) - (new Date(a.created_at).getTime()));

        fallbackPhotos.forEach(p => {
            if (photosForSmallSlots.length < 4) {
                photosForSmallSlots.push(p);
                displayedPhotoIds.add(p.id);
            }
        });
    }

    // 3. Afficher les photos dans les petits slots
    for (let i = 0; i < 4; i++) {
        displayPhoto(`small-${i + 1}`, photosForSmallSlots[i]);
    }

    console.log("renderPhotoGrid: Affichage de la grille terminé.");
}


    async function fetchPropertyDetails() {
        console.log(`[DETAIL_SCRIPT_FETCH] Appel pour la propriété ID: ${propertyId}`);
        // detailContainerElement.innerHTML = '<p>Chargement des détails de l\'annonce...</p>';//

        // Adaptez l'URL de l'endpoint selon votre configuration Xano
        // Option 1: //{id}
        const urlToFetch = `${XANO_API_BASE_URL}/property_annonce/${propertyId}`;
        // Option 2: /some_endpoint?property_id_key={id}
        // const urlToFetch = `${XANO_API_BASE_URL}/votre_endpoint_details?id_annonce=${propertyId}`;

        console.log('[DETAIL_SCRIPT_FETCH] URL pour l\'appel fetch:', urlToFetch);

        try {
            const response = await fetch(urlToFetch);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: response.statusText }));
                throw new Error(`Erreur HTTP ${response.status}: ${errorData.message || response.statusText}`);
            }

            // Étape 1: Récupérer la réponse JSON brute de Xano (qui est un tableau)
            // Cette ligne est votre ligne 60. Appelons la variable responseDataArray pour plus de clarté.
            const responseDataArray = await response.json(); // <--- Changement de nom ici pour éviter le conflit
            console.log('[DETAIL_SCRIPT_FETCH] Réponse brute de Xano (devrait être un tableau):', JSON.stringify(responseDataArray, null, 2));

            // Étape 2: Déclarer 'propertyData' avec 'let' et initialiser à null.
            // C'est votre ligne 66. C'est la SEULE DÉCLARATION de propertyData.
            let propertyData = null; 

            // Étape 3: Extraire le premier objet du tableau (si le tableau existe et n'est pas vide)
            if (Array.isArray(responseDataArray) && responseDataArray.length > 0) {
                propertyData = responseDataArray[0]; // On assigne l'objet à propertyData
            }

            // Maintenant, 'propertyData' contient soit l'objet de l'annonce, soit null.
            // La suite de vos vérifications et appels à bindDataToElement utilisera cette variable 'propertyData'.
            if (!propertyData || typeof propertyData !== 'object' || Object.keys(propertyData).length === 0) {
                console.error('[DETAIL_SCRIPT_FETCH] Données de propriété non valides, vides, ou ID non trouvé après extraction du tableau.');
                detailContainerElement.innerHTML = `<p style="color:orange;">Les données pour cette annonce n'ont pas pu être chargées, sont vides ou l'ID est introuvable.</p>`;
                return;
            }

            // Le conteneur principal peut aussi avoir des bindings directs
            bindDataToElement(detailContainerElement, propertyData);

            // Appliquer les données à tous les éléments enfants avec data-xano-bind
            detailContainerElement.querySelectorAll('[data-xano-bind]').forEach(element => {
                bindDataToElement(element, propertyData);
            });
            
            // === NOUVEL APPEL POUR LA GRILLE PHOTO ===
            if (propertyData._property_photos && Array.isArray(propertyData._property_photos)) {
                renderPhotoGrid(propertyData._property_photos, propertyData); // On passe les photos et l'objet annonce entier
            } else {
                console.warn("Aucun tableau _property_photos valide trouvé dans les données de l'annonce pour la grille.");
                const gridContainer = document.querySelector('.photo-grid-container');
                if (gridContainer) gridContainer.style.display = 'none';
            }

            // === INITIALISATION DE LA GOOGLE MAP ===
    if (propertyData.geo_location && propertyData.geo_location.data) {
        const lat = propertyData.geo_location.data.lat;
        const lng = propertyData.geo_location.data.lng;

        // Vérifier que lat et lng ne sont pas null, undefined ou des chaînes vides
        if (lat != null && lng != null && String(lat).trim() !== '' && String(lng).trim() !== '') {
            const numLat = parseFloat(lat);
            const numLng = parseFloat(lng);

            if (!isNaN(numLat) && !isNaN(numLng)) {
                if (window.googleMapsApiIsReady) {
                    // Si l'API est déjà prête, on affiche la carte directement
                    console.log('[MAP_SCRIPT] API Google Maps prête, affichage direct de la carte.');
                    initializeDetailMap(numLat, numLng);
                } else {
                    // Sinon, on stocke les données pour que la fonction callback 'onGoogleMapsApiReady' les utilise
                    console.log('[MAP_SCRIPT] API Google Maps non prête, mise en attente des données de carte.');
                    mapDataToDisplay = { latitude: numLat, longitude: numLng };
                }
            } else {
                console.warn("[MAP_SCRIPT] Latitude ou longitude non numériques après conversion:", lat, lng);
                const mapElement = document.getElementById('property-location-map');
                if (mapElement) mapElement.innerHTML = "<p style='text-align:center; padding:20px;'>Localisation invalide.</p>";
            }
        } else {
            console.log("[MAP_SCRIPT] Latitude ou longitude vide ou null dans geo_location.data.");
            const mapElement = document.getElementById('property-location-map');
            if (mapElement) mapElement.innerHTML = "<p style='text-align:center; padding:20px;'>Localisation non fournie.</p>";
        }
    } else {
        console.log("[MAP_SCRIPT] Données geo_location non trouvées pour la carte.");
        const mapElement = document.getElementById('property-location-map');
        if (mapElement) mapElement.innerHTML = "<p style='text-align:center; padding:20px;'>Localisation non disponible.</p>";
    }
    // ======================================
            
            // Initialiser les sliders Swiper s'il y en a sur la page de détail
            // La fonction initializePageSwipers cherchera les éléments .swiper[data-slider-init="true"]
            // `bindDataToElement` devrait avoir mis cet attribut si un slider de photos a été peuplé.
           // initializePageSwipers(detailContainerElement);

            console.log('[DETAIL_SCRIPT_FETCH] Affichage des détails terminé.');

        } catch (error) {
            console.error('[DETAIL_SCRIPT_FETCH] Erreur lors de la récupération ou du traitement des détails:', error);
            detailContainerElement.innerHTML = `<p style="color:red;">Erreur lors du chargement des détails: ${error.message}</p>`;
        }
    }

    // Lancer la récupération des données pour l'annonce
    fetchPropertyDetails();
});


 // ASSUREZ-VOUS QUE LES TROIS FONCTIONS CI-DESSUS SONT DÉFINIES ICI.
    // Pour la lisibilité, je ne les ai pas recopiées, mais elles sont indispensables.
    // Vous pouvez les mettre directement ici, ou dans un fichier "utils.js" que vous chargez
    // dans les deux pages HTML (accueil et détails).

function getNestedValue(obj, pathString) {
    if (!obj || !pathString || typeof pathString !== 'string') return undefined;
    const path = pathString.split('.');
    let current = obj;
    for (let i = 0; i < path.length; i++) {
        const segment = path[i];
        if (current === null || current === undefined) return undefined;

        // Gérer les indices de tableau (ex: "0", "1")
        if (Array.isArray(current) && !isNaN(parseInt(segment, 10))) {
            current = current[parseInt(segment, 10)];
        } else if (typeof current !== 'object' || typeof current[segment] === 'undefined') {
            return undefined; // Chemin invalide ou propriété non trouvée
        } else {
            current = current[segment];
        }
    }
    return current;
}

function bindDataToElement(element, data) {
    const dataKey = element.getAttribute('data-xano-bind');
    if (!dataKey) return; // Pas de clé de binding

    // --- NOUVELLE LOGIQUE POUR LE SLIDER D'IMAGES ---
    if (dataKey === '_property_photos_slider') {
        const photosArray = data._property_photos; // Accède au tableau _property_photos de l'item actuel
        const swiperContainer = element.querySelector('.swiper'); // Cible le conteneur .swiper
        
        if (!swiperContainer) {
            console.warn("Conteneur .swiper non trouvé pour le slider de l'annonce:", data.id, "Élément:", element);
            return;
        }
        const swiperWrapper = swiperContainer.querySelector('.swiper-wrapper');

        if (photosArray && Array.isArray(photosArray) && swiperWrapper) {
            swiperWrapper.innerHTML = ''; // Vider les slides précédents au cas où

            if (photosArray.length > 0) {
                photosArray.forEach(photoEntry => {
                    // Votre structure de données montre que 'images' est un tableau,
                    // et l'URL est dans le premier élément de ce tableau 'images'.
                    if (photoEntry.images && photoEntry.images.length > 0 && photoEntry.images[0].url) {
                        const imageUrl = photoEntry.images[0].url;
                        const slideElement = document.createElement('div');
                        slideElement.className = 'swiper-slide';
                        
                        const imgElement = document.createElement('img');
                        imgElement.src = imageUrl;
                        // Essayez d'ajouter un alt pertinent
                        imgElement.alt = data.property_title ? `Photo de ${data.property_title}` : "Photo de la propriété"; 
                        // Vous pouvez ajouter des styles à imgElement si nécessaire, ex: imgElement.style.width = '100%';
                        
                        slideElement.appendChild(imgElement);
                        swiperWrapper.appendChild(slideElement);
                    }
                });
                // On ne initialise PAS Swiper ici. On va le marquer pour initialisation.
                swiperContainer.setAttribute('data-slider-init', 'true'); // Marqueur pour l'initialisation
                element.style.display = ''; // S'assurer que le conteneur du slider est visible
            } else {
                // Pas de photos, on cache le conteneur principal du slider pour cette annonce
                element.style.display = 'none'; 
            }
        } else {
            // Si photosArray n'existe pas ou n'est pas un tableau, ou si swiperWrapper est introuvable
            console.warn("Pas de données photos valides ou structure de slider incorrecte pour l'annonce:", data.id, "Élément:", element);
            element.style.display = 'none'; // Cacher le conteneur du slider
        }
        return; // Traitement spécifique pour le slider terminé
    }
    // --- FIN NOUVELLE LOGIQUE POUR LE SLIDER D'IMAGES ---

   // === MODIFICATION ICI : Utiliser getNestedValue pour récupérer la valeur ===
    const value = getNestedValue(data, dataKey); // Appel à getNestedValue
    // =======================================================================

    const displayValue = (value === null || value === undefined) ? '' : value;

    // Appliquer la valeur à l'élément (votre code switch existant)
    switch (element.tagName.toLowerCase()) {
        case 'img':
            // ... (votre logique pour img, en s'assurant d'utiliser displayValue si c'est une URL directe,
            // ou une logique spécifique si dataKey pointe vers un objet image complexe) ...
            // Pour une image simple dont l'URL est la displayValue :
            if (!element.closest('.swiper-slide')) { // Pour ne pas interférer avec les images du slider créées dynamiquement
                 // Si displayValue est bien l'URL de l'image
                if (typeof displayValue === 'string' && (displayValue.startsWith('http') || displayValue.startsWith('/'))) {
                    element.src = displayValue;
                } else if (typeof displayValue === 'object' && displayValue && displayValue.url) {
                    // Si displayValue est un objet contenant une URL (comme dans votre structure 'images')
                    element.src = displayValue.url;
                } else {
                    // console.warn(`Valeur pour src de <img> non reconnue pour dataKey "${dataKey}":`, displayValue);
                    element.src = ''; // ou une image placeholder
                }
            }
            break;
        case 'iframe':
        case 'video':
        case 'audio':
        case 'source': // Pour <video><source src="..."></video>
            element.src = displayValue;
            break;
        case 'input':
             if (element.type === 'checkbox' || element.type === 'radio') {
                 // Comparer la valeur de l'input avec la donnée
                 // Cocher si la valeur de l'input correspond à la donnée (pour radio)
                 // ou si la donnée est "truthy" (pour checkbox simple)
                 // Ceci est une interprétation simple, peut nécessiter ajustement
                 if (element.type === 'checkbox'){
                     element.checked = !!value; // Coché si truthy, décoché si falsy/null/undefined
                 } else { // radio
                     element.checked = (element.value == value); // Comparaison non stricte peut être utile
                 }
             } else if (element.type === 'date' && value) {
                 // Formater pour input[type=date] (YYYY-MM-DD)
                 try {
                     element.value = new Date(value).toISOString().split('T')[0];
                 } catch (e) { element.value = ''; console.warn("Impossible de formater la date", value); }
             } else if (element.type === 'datetime-local' && value) {
                  // Formater pour input[type=datetime-local] (YYYY-MM-DDTHH:mm)
                  try {
                     const d = new Date(value);
                      // Ajuster pour le fuseau horaire local si nécessaire avant formatage
                      // Ceci peut être complexe. Version simple sans ajustement timezone:
                     element.value = d.toISOString().substring(0, 16);
                  } catch (e) { element.value = ''; console.warn("Impossible de formater datetime-local", value); }
             }
             else {
                 element.value = displayValue;
             }
            break;
        case 'textarea':
        case 'select':
            element.value = displayValue;
            break;
        case 'a':
             // Ne met à jour href que si ce n'est pas géré par data-xano-link-to
            if (!element.hasAttribute('data-xano-link-to')) { // Ne pas écraser les liens gérés par data-xano-link-to
                 element.href = displayValue;
            }
             // Mettre à jour le texte du lien si vide ou si dataKey != 'href'
             if (!element.textContent.trim() || dataKey !== 'href') { 
                  element.textContent = displayValue;
              }
            break;
        // Cas pour les éléments qui utilisent innerHTML (à utiliser avec prudence à cause de XSS)
        // case 'div':
        // case 'span':
        //     if (element.hasAttribute('data-xano-bind-html')) { // Attribut spécifique pour HTML
        //         element.innerHTML = value; // Attention XSS ! N'utiliser que si la source est sûre.
        //     } else {
        //         element.textContent = displayValue;
        //     }
        //     break;
        default:
            // Par défaut, mettre à jour textContent (plus sûr que innerHTML)
            element.textContent = displayValue;
    }

    // Gérer les attributs liés (data-xano-bind-attr-*) (votre code existant)
    // Important : cette partie doit aussi utiliser getNestedValue pour attrValueKey
    for (const attr of element.attributes) {
        if (attr.name.startsWith('data-xano-bind-attr-')) {
            const attrName = attr.name.replace('data-xano-bind-attr-', '');
            const attrValueKey = attr.value; // La valeur de cet attribut est la clé dans l'objet data

            // === MODIFICATION ICI AUSSI : Utiliser getNestedValue ===
            const attrValue = getNestedValue(data, attrValueKey);
            // ======================================================

            if (attrValue !== undefined) {
                // Pour les attributs booléens (disabled, checked, selected...),
                // leur présence/absence est importante.
                if (typeof attrValue === 'boolean') {
                     if (attrValue) {
                         element.setAttribute(attrName, ''); // Ajoute l'attribut (ex: disabled)
                     } else {
                         element.removeAttribute(attrName); // Retire l'attribut
                     }
                } else {
                    element.setAttribute(attrName, attrValue);
                }
            } else {
                 // Si la donnée n'est pas trouvée, on peut vouloir retirer l'attribut
                 element.removeAttribute(attrName);
                 console.warn(`Clé "${attrValueKey}" pour l'attribut "${attrName}" non trouvée.`);
            }
        }
    }

     // Stocker l'ID si l'élément est aussi un lien (pour référence future si nécessaire)
     if (element.hasAttribute('data-xano-link-to') && data?.id !== undefined) {
         element.setAttribute('data-xano-data-id', data.id);
     }
}
function initializePageSwipers(parentElement) {
    // parentElement est le conteneur général où les annonces (et donc les sliders) ont été ajoutées.
    // Par exemple, ce que vous avez nommé 'itemsContainer' dans votre fonction de rendu.
    const slidersToInitialize = parentElement.querySelectorAll('.swiper[data-slider-init="true"]');
    console.log(`[SWIPER_INIT_FUNC] Trouvé ${slidersToInitialize.length} sliders à initialiser dans:`, parentElement);

    slidersToInitialize.forEach((swiperEl, sliderIndex) => {
        console.log(`[SWIPER_INIT_FUNC] Préparation pour initialiser slider #${sliderIndex}:`, swiperEl);
        
        // Utiliser requestAnimationFrame pour s'assurer que le DOM est stable
        // et que les dimensions sont calculées avant d'initialiser Swiper.
        requestAnimationFrame(() => { 
            try {
                const slides = swiperEl.querySelectorAll('.swiper-slide');
                const enableLoop = slides.length > 1;
                console.log(`[SWIPER_INIT_FUNC] Initialisation Swiper sur slider #${sliderIndex}. Nombre de slides: ${slides.length}, Loop activée: ${enableLoop}`);
                
                // Assurez-vous que la variable 'Swiper' (avec un 'S' majuscule) 
                // est disponible globalement (chargée via votre <script src="URL_VERS_SWIPER_BUNDLE.MIN.JS">)
                const swiperInstance = new Swiper(swiperEl, { // 'S' majuscule ici
                    loop: enableLoop,
                    spaceBetween: 10,
                    slidesPerView: 1,
                    pagination: {
                        el: swiperEl.querySelector('.swiper-pagination'), // Doit exister dans votre template de slider
                        clickable: true,
                        dynamicBullets: true,
                        dynamicMainBullets: 5, 
                    },
                    navigation: {
                        nextEl: swiperEl.querySelector('.swiper-button-next'), // Doit exister
                        prevEl: swiperEl.querySelector('.swiper-button-prev'), // Doit exister
                    },
                    observer: true,        
                    observeParents: true,   
                    observeSlideChildren: true, 
                    updateOnWindowResize: true,
                });
                swiperInstance.update(); // Utile pour forcer la mise à jour des dimensions
                
                swiperEl.removeAttribute('data-slider-init'); // TRÈS IMPORTANT : pour éviter la ré-initialisation
                console.log(`[SWIPER_INIT_FUNC] Slider #${sliderIndex} initialisé et attribut 'data-slider-init' retiré.`);

            } catch (swiperError) {
                console.error(`[SWIPER_INIT_FUNC] ERREUR lors de l'initialisation Swiper pour slider #${sliderIndex}:`, swiperError, swiperEl);
            }
        }); // Fin de requestAnimationFrame
    });
}


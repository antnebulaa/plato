// map-listings.js - VERSION FINALE (Correction de l'ordre des couches)
document.addEventListener('DOMContentLoaded', () => {
    console.log('[MAP_SCRIPT] Initialisation du script final avec ordre des couches corrigé.');

    // --- Configuration ---
    const MAPTILER_API_KEY = 'UsgTlLJiePXeSnyh57aL';
    const MAP_ID = '019799fa-e40f-7af6-81a6-b6d1de969567';
    const MAP_CONTAINER_ID = 'map-section';

    // Annonces
    const SOURCE_ID_ANNONCES = 'annonces-source';
    const LAYER_ID_DOTS = 'annonces-dots-layer';
    const LAYER_ID_PRICES = 'annonces-prices-layer';

    // Données pour les frontières
    const BOUNDARIES_SOURCE = 'countries'; // Le nom de la source à ajouter
    const BOUNDARIES_SOURCE_LAYER = 'administrative';
    const CITY_HIGHLIGHT_LAYER_ID = 'city-highlight-layer';
    const CITY_NAME_FIELD = 'name';
    const CITY_LEVEL = 3;

    // Bouton 3D
    const BUTTON_3D_ID = 'toggle-3d-button';

    // --- Variables globales ---
    let map = null;
    let allAnnouncements = [];

    // --- ÉCOUTEUR PRINCIPAL ---
    document.addEventListener('annoncesChargeesEtRendues', (event) => {
        const annonces = event.detail.annonces;
        const selectedCities = event.detail.cities || [];
        if (!annonces) return;

        allAnnouncements = annonces;
        const geojsonData = convertAnnoncesToGeoJSON(allAnnouncements);

        if (!map) {
            initializeMap(geojsonData, selectedCities);
        } else {
            const src = map.getSource(SOURCE_ID_ANNONCES);
            if (src) src.setData(geojsonData);
            if (geojsonData.features.length) {
                map.fitBounds(getBounds(geojsonData), { padding: 80, maxZoom: 16 });
            }
            updateCityHighlight(selectedCities);
        }
    });

    // --- INITIALISATION DE LA CARTE ---
    function initializeMap(initialGeoJSON, firstCityList) {
        map = new maplibregl.Map({
            container: MAP_CONTAINER_ID,
            style: `https://api.maptiler.com/maps/${MAP_ID}/style.json?key=${MAPTILER_API_KEY}`,
            pitch: 0, bearing: 0, renderWorldCopies: false
        });
        window.map = map;

        if (initialGeoJSON.features.length) {
            map.fitBounds(getBounds(initialGeoJSON), { padding: 80, duration: 0, maxZoom: 16 });
        }

        map.on('load', () => {
            console.log('[MAP_SCRIPT] Carte chargée. Ajout des sources et couches dans le bon ordre.');

            // --- 1. Ajout des sources de données ---
            // Source pour les frontières (villes)
            if (!map.getSource(BOUNDARIES_SOURCE)) {
                map.addSource(BOUNDARIES_SOURCE, {
                    type: 'vector',
                    url: `https://api.maptiler.com/tiles/countries/{z}/{x}/{y}.pbf?key=${MAPTILER_API_KEY}`
                });
            }
            /* -- Annonces (points + labels) -- */
      map.addImage('circle-background', createCircleSdf(64), { sdf: true });
      map.addSource(SOURCE_ID_ANNONCES, { type: 'geojson', data: initialGeoJSON, promoteId: 'id' });

      map.addLayer({
        id: LAYER_ID_DOTS,
        type: 'circle',
        source: SOURCE_ID_ANNONCES,
        paint: {
          'circle-radius': 5,
          'circle-color': '#FFFFFF',
          'circle-stroke-width': 1,
          'circle-stroke-color': '#B4B4B4'
        }
      });

      map.addLayer({
        id: LAYER_ID_PRICES,
        type: 'symbol',
        source: SOURCE_ID_ANNONCES,
        layout: {
          'icon-image': 'circle-background',
          'icon-size': 0.9,
          'text-field': ['concat', ['to-string', ['get', 'price']], '€'],
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-size': 14
        },
        paint: {
          'icon-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#000000', '#FFFFFF'],
          'text-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#FFFFFF', '#333333']
        }
      });

      /* -- Couche de coloration des communes (invisible au départ) -- */
      const firstSymbolLayer = map.getStyle().layers.find(l => l.type === 'symbol');

      map.addLayer({
        id: CITY_HIGHLIGHT_LAYER_ID,
        type: 'fill',
        source: BOUNDARIES_SOURCE,
        'source-layer': BOUNDARIES_SOURCE_LAYER,
        // uniquement les communes (level 3) et aucun nom (filtre vide)
        filter: ['all',
          ['==', ['get', 'level'], CITY_LEVEL],
          ['==', ['get', CITY_NAME_FIELD], '__none__']
        ],
        paint: {
  'fill-color'   : '#0269CC',
  'fill-opacity' : 0.08,
  'fill-outline-color': '#0269CC'
      }
      }, firstSymbolLayer?.id);

      console.log('[MAP_SCRIPT] Couche commune ajoutée');

            // --- 3. Événements de la carte ---
            map.on('mouseenter', LAYER_ID_DOTS, handleDotHoverOrClick);
            map.on('click', LAYER_ID_DOTS, handleDotHoverOrClick);
            map.on('mouseleave', LAYER_ID_DOTS, () => { if (hoverTooltip) { hoverTooltip.remove(); hoverTooltip = null; } });
            map.on('click', LAYER_ID_PRICES, handlePriceBubbleClick);
            map.on('idle', updateVisibleList);
            map.on('moveend', updateVisibleList);

            updateCityHighlight(firstCityList);
        });

        map.addControl(new maplibregl.NavigationControl(), 'top-right');
    }

    // --- MISE À JOUR DU HIGHLIGHT (inchangée) ---
    function updateCityHighlight(selectedCities = []) {
        if (!map?.isStyleLoaded() || !map.getLayer(CITY_HIGHLIGHT_LAYER_ID)) {
            setTimeout(() => updateCityHighlight(selectedCities), 200);
            return;
        }
        const filter = selectedCities.length > 0
            ? ['all', ['==', ['get', 'level'], CITY_LEVEL], ['in', ['get', CITY_NAME_FIELD], ['literal', selectedCities]]]
            : ['==', ['get', CITY_NAME_FIELD], '__none__'];
        map.setFilter(CITY_HIGHLIGHT_LAYER_ID, filter);
        console.log('[Highlight] Filtre de communes mis à jour pour :', selectedCities);
    }

    // --- LE RESTE DU SCRIPT (inchangé) ---
    const toggle3dButton = document.getElementById(BUTTON_3D_ID);
    if (toggle3dButton) { toggle3dButton.addEventListener('click', function() { if (!map) return; const p = map.getPitch(); map.easeTo({ pitch: p > 0 ? 0 : 65, duration: 1000 }); this.textContent = p > 0 ? 'Vue 2D' : 'Vue 3D'; }); }
    const createCircleSdf = (size) => { const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size; const context = canvas.getContext('2d'); const radius = size / 2; context.beginPath(); context.arc(radius, radius, radius - 2, 0, 2 * Math.PI, false); context.fillStyle = 'white'; context.fill(); return context.getImageData(0, 0, size, size); };
    function getNestedValue(obj, path) { if (!path) return undefined; return path.split('.').reduce((acc, part) => (acc && acc[part] !== undefined) ? (isNaN(parseInt(part, 10)) ? acc[part] : acc[parseInt(part, 10)]) : undefined, obj); }
    function convertAnnoncesToGeoJSON(annonces) { const features = annonces.map(annonce => { const lat = getNestedValue(annonce, 'geo_location.data.lat'); const lng = getNestedValue(annonce, 'geo_location.data.lng'); if (annonce.id === undefined || lat === undefined || lng === undefined) return null; let fId = parseInt(annonce.id, 10); if (isNaN(fId)) return null; return { type: 'Feature', id: fId, geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] }, properties: { id: fId, id_str: String(annonce.id), price: getNestedValue(annonce, '_property_lease_of_property.0.loyer') || '?', coverPhoto: getNestedValue(annonce, '_property_photos.0.images.0.url'), house_type: getNestedValue(annonce, 'house_type'), city: getNestedValue(annonce, 'city'), rooms: getNestedValue(annonce, 'rooms'), bedrooms: getNestedValue(annonce, 'bedrooms'), area: getNestedValue(annonce, 'area') } }; }).filter(Boolean); return { type: 'FeatureCollection', features }; }
    let currentPopup = null, selectedPinId = null, isMobile = window.innerWidth < 768, hoverTooltip = null;
    function handleDotHoverOrClick(e) { if (map.queryRenderedFeatures(e.point, { layers: [LAYER_ID_PRICES] }).length > 0) return; if (e.features.length > 0) { map.getCanvas().style.cursor = 'pointer'; if (hoverTooltip) hoverTooltip.remove(); const p = e.features[0].properties; const c = e.features[0].geometry.coordinates.slice(); hoverTooltip = new maplibregl.Popup({ closeButton: false, offset: 10, anchor: 'bottom', className: 'hover-popup' }).setLngLat(c).setHTML(`<div class="hover-popup-content">${p.price}€</div>`).addTo(map); } }
    function handlePriceBubbleClick(e) { if (hoverTooltip) { hoverTooltip.remove(); hoverTooltip = null; } if (e.features && e.features.length > 0) { const f = e.features[0]; const p = f.properties; const cId = f.id; const d = allAnnouncements.find(a => a.id === cId); if (d) sessionStorage.setItem('selected_property_details', JSON.stringify(d)); if (selectedPinId !== null) map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: selectedPinId }, { selected: false }); map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: cId }, { selected: true }); selectedPinId = cId; if (isMobile) { if (currentPopup) currentPopup.remove(); openMobileBottomSheet(p); } else { if (currentPopup) currentPopup.remove(); const h = createPopupHTML(p); currentPopup = new maplibregl.Popup({ offset: 25, className: 'airbnb-style-popup' }).setLngLat(f.geometry.coordinates.slice()).setHTML(h).addTo(map); currentPopup.on('close', () => { if (selectedPinId === cId) { map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: selectedPinId }, { selected: false }); selectedPinId = null; } currentPopup = null; }); } } }
    function createPopupHTML(p) { const i = 'https://via.placeholder.com/280x150/cccccc/969696?text=Image'; const c = p.coverPhoto || i; const h = (p.house_type || 'Logement').replace(/^\w/, c => c.toUpperCase()); const t = `${h} à ${p.city || 'ville'}`; const d = []; if (p.rooms) d.push(`${p.rooms} p.`); if (p.bedrooms) d.push(`${p.bedrooms} ch.`); if (p.area) d.push(`${p.area}m²`); const dH = d.length > 0 ? `<p class="popup-description">${d.join(' • ')}</p>` : ''; const pH = `<p class="popup-price">${p.price || '?'}€ <span class="popup-price-period">/ mois</span></p>`; const l = `annonce?id=${p.id_str}`; return `<div><a href="${l}" class="popup-container-link" target="_blank"><div class="map-custom-popup"><img src="${c}" alt="${t}" class="popup-image" onerror="this.src='${i}'"><div class="popup-info"><h4 class="popup-title">${t}</h4>${dH}${pH}</div></div></a></div>`; }
    const listContainer = document.getElementById('annonces-wrapper'), mobileToggleButton = document.getElementById('mobile-map-toggle');
   
// REMPLACEZ TOUT À PARTIR D'ICI JUSQU'À LA FIN DE VOTRE FICHIER

    function updateVisibleList() {
        if (!map || !map.isStyleLoaded() || !listContainer) return;

        const visibleFeatures = map.queryRenderedFeatures({ layers: [LAYER_ID_DOTS] });
        const visiblePropertyIds = new Set(visibleFeatures.map(feature => String(feature.properties.id)));
        
        const allListItems = listContainer.querySelectorAll('[data-property-id]');
        allListItems.forEach(itemDiv => {
            const anchorTag = itemDiv.parentElement;
            if (!anchorTag || anchorTag.tagName !== 'A') {
                itemDiv.style.display = visiblePropertyIds.has(itemDiv.dataset.propertyId) ? '' : 'none';
                return;
            }
            anchorTag.classList.toggle('annonce-list-item-hidden', !visiblePropertyIds.has(itemDiv.dataset.propertyId));
        });

        // Met à jour le texte du bouton SEULEMENT si la vue carte est active
        const mobileToggleText = document.getElementById('mobile-map-toggle-text');
        if (isMobile && mobileToggleText && document.body.classList.contains('map-is-active')) {
            mobileToggleText.textContent = `Voir les ${visiblePropertyIds.size} logements`;
        }
    }

    // REMPLACEZ LE BLOC À LA FIN DE VOTRE FICHIER PAR CELUI-CI

    function getBounds(g) { const b = new maplibregl.LngLatBounds(); g.features.forEach(f => b.extend(f.geometry.coordinates)); return b; }
    
    // --- GESTION DU PANNEAU MOBILE (BOTTOM SHEET) ---
    const mobileBottomSheet = document.getElementById('mobile-bottom-sheet');
    const mobileBottomSheetContent = document.getElementById('mobile-bottom-sheet-content');
    const bottomSheetCloseButton = document.getElementById('bottom-sheet-close-button');
    
    function openMobileBottomSheet(p) { if (!mobileBottomSheet || !mobileBottomSheetContent) return; mobileBottomSheetContent.innerHTML = createPopupHTML(p); mobileBottomSheet.classList.add('visible'); }
    function closeMobileBottomSheet() { if (!mobileBottomSheet) return; mobileBottomSheet.classList.remove('visible'); setTimeout(() => { if (mobileBottomSheetContent) mobileBottomSheetContent.innerHTML = ''; }, 350); if (map && selectedPinId !== null) { map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: selectedPinId }, { selected: false }); selectedPinId = null; } }
    if (bottomSheetCloseButton) { bottomSheetCloseButton.addEventListener('click', e => { e.stopPropagation(); closeMobileBottomSheet(); }); }


    // --- GESTION DU BOUTON MOBILE CARTE/LISTE (LOGIQUE UNIFIÉE ET CORRIGÉE) ---
    // Note : mobileToggleButton est déjà déclaré plus haut, on ne le redéclare pas ici.
    const mobileToggleText = document.getElementById('mobile-map-toggle-text');
    const mapIcon = document.getElementById('mobile-map-icon-map');
    const listIcon = document.getElementById('mobile-map-icon-list');

    // On utilise `mobileToggleButton` qui est déjà déclaré
    if (isMobile && mobileToggleButton && mobileToggleText && mapIcon && listIcon) {
        
        // On s'assure que l'état initial est correct (Vue Liste)
        mobileToggleText.textContent = 'Carte';
        mapIcon.style.display = 'inline-block';
        listIcon.style.display = 'none';

        mobileToggleButton.addEventListener('click', () => {
            const isMapNowActive = document.body.classList.toggle('map-is-active');

            if (isMapNowActive) {
                // --- On vient d'afficher la VUE CARTE ---
                if (map) {
                    map.resize();
                    setTimeout(() => {
                        updateVisibleList();
                    }, 300); 
                }
                mobileToggleText.textContent = 'Liste';
                mapIcon.style.display = 'none';
                listIcon.style.display = 'inline-block';
            } else {
                // --- On vient d'afficher la VUE LISTE ---
                if (listContainer) listContainer.scrollTo(0, 0);
                
                mobileToggleText.textContent = 'Carte';
                mapIcon.style.display = 'inline-block';
                listIcon.style.display = 'none';
            }
        });
    }

}); // Ceci est la toute dernière ligne de votre fichier

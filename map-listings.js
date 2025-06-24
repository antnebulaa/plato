// map-listings.js – version corrigée (mise en avant ou grisage des villes sélectionnées)
document.addEventListener('DOMContentLoaded', () => {
  console.log('[MAP_SCRIPT] Initialisation coloration communes 🇫🇷');

  /* ───────────────  CONFIG  ─────────────── */
  const MAPTILER_API_KEY     = 'UsgTlLJiePXeSnyh57aL';
  const MAP_ID               = '019799fa-e40f-7af6-81a6-b6d1de969567';
  const MAP_CONTAINER_ID     = 'map-section';

  // Source / layer MapTiler dédiés aux limites administratives
  const BOUNDARIES_SOURCE        = 'countries';      // ⚠︎ minuscule
  const BOUNDARIES_SOURCE_LAYER  = 'administrative';
  const CITY_LEVEL               = 3;                // communes
  const CITY_NAME_FIELD          = 'name';

  // ID de la couche qui coloriera les villes
  const CITY_HIGHLIGHT_LAYER_ID  = 'city-highlight-layer';

  // Annonces
  const SOURCE_ID_ANNONCES = 'annonces-source';
  // const LAYER_ID_DOTS  = 'annonces-dots-layer';   // plus utilisé
  // const LAYER_ID_PRICES = 'annonces-prices-layer'; // plus utilisé
  const LAYER_ID_PILLS = 'price-pill';   // ← ajouté

  // Bouton 3D
  const BUTTON_3D_ID       = 'toggle-3d-button';

  /* ───────────────  VARIABLES  ─────────────── */
  let map = null;
  let allAnnouncements = [];

  /* ───────────────  ÉCOUTEUR PRINCIPAL  ─────────────── */
  document.addEventListener('annoncesChargeesEtRendues', (event) => {
    const annonces       = event.detail.annonces;
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

  /* ───────────────  INITIALISATION  ─────────────── */
  /*  CONSTANTE pour le nouveau layer  */
const LAYER_ID_PILLS = 'price-pill';

/* ------------------------------------------------------------- */
/*  initializeMap : carte + pastilles + communes colorées        */
/* ------------------------------------------------------------- */
function initializeMap(initialGeoJSON, firstCityList) {
  map = new maplibregl.Map({
    container : MAP_CONTAINER_ID,
    style     : `https://api.maptiler.com/maps/${MAP_ID}/style.json?key=${MAPTILER_API_KEY}`,
    pitch     : 0,
    bearing   : 0,
    renderWorldCopies: false
  });
  window.map = map;

  if (initialGeoJSON.features.length) {
    map.fitBounds(getBounds(initialGeoJSON), { padding: 80, duration: 0, maxZoom: 16 });
  }

  map.on('load', () => {
    console.log('[MAP] chargée');

    /* 0) Nettoyage des anciens ronds/icons -------------------- */
    ['annonces-dots-layer', 'annonces-prices-layer'].forEach(id=>{
      if (map.getLayer(id)) map.removeLayer(id);
    });
    if (map.hasImage('circle-background')) map.removeImage('circle-background');

    /* 1) Source GeoJSON des annonces -------------------------- */
    map.addSource(SOURCE_ID_ANNONCES, {
      type: 'geojson',
      data: initialGeoJSON,
      promoteId: 'id'
    });

    /* 2) Icône SVG (pilule) encodée en base64 ----------------- */
    const pillSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="27" height="27" viewBox="0 0 27 27">
      <rect x="0.5" y="0.5" width="26" height="26" rx="12" ry="12"
            fill="#ffffff" stroke="#bbbbbb" stroke-width="1"/>
    </svg>`;
    const pillUrl = 'data:image/svg+xml;base64,' + btoa(pillSvg);

    /* 3) Charge l’icône puis crée le layer pastille ------------ */
    map.loadImage(pillUrl, (err, img) => {
      if (err) { console.error('loadImage pill', err); return; }
      if (!map.hasImage('pill-bg')) map.addImage('pill-bg', img, { sdf: true });

      const firstSymbol = map.getStyle().layers.find(l => l.type === 'symbol');

      map.addLayer({
        id   : LAYER_ID_PILLS,
        type : 'symbol',
        source: SOURCE_ID_ANNONCES,

        layout: {
          'text-field' : ['concat', ['to-string', ['get','price']], ' €'],
          'text-font'  : ['Open Sans Bold'],
          'text-size'  : 13,
          'icon-image' : 'pill-bg',
          'icon-text-fit' : 'both',
          'icon-text-fit-padding': [2,6,2,6],
          'text-allow-overlap': true,
          'icon-allow-overlap': true
        },
        paint: {
          'text-color': [
            'case', ['boolean',['feature-state','selected'],false],
            '#ffffff', '#000000'
          ],
          'icon-color': [
            'case', ['boolean',['feature-state','selected'],false],
            '#000000', '#ffffff'
          ],
          'icon-halo-color': [
            'case', ['boolean',['feature-state','selected'],false],
            '#000000', '#bbbbbb'
          ],
          'icon-halo-width': 1
        }
      }, firstSymbol ? firstSymbol.id : undefined);

      /* 3-bis) Événements sur la nouvelle couche  */
      map.on('mouseenter', LAYER_ID_PILLS, handleDotHoverOrClick);
      map.on('click',      LAYER_ID_PILLS, handleDotHoverOrClick);
      map.on('mouseleave', LAYER_ID_PILLS, () => {
        if (hoverTooltip) { hoverTooltip.remove(); hoverTooltip = null; }
      });
      map.on('click',      LAYER_ID_PILLS, handlePriceBubbleClick);

      /* 4) Met à jour la liste visible une première fois */
      updateVisibleList();
    });

    /* 5) Couche de coloration des communes -------------------- */
    const firstSymbolLayer = map.getStyle().layers.find(l => l.type === 'symbol');
    map.addLayer({
      id: CITY_HIGHLIGHT_LAYER_ID,
      type: 'fill',
      source: BOUNDARIES_SOURCE,
      'source-layer': BOUNDARIES_SOURCE_LAYER,
      filter: ['all',
        ['==', ['get','level'], CITY_LEVEL],
        ['==', ['get',CITY_NAME_FIELD], '__none__']
      ],
      paint: {
        'fill-color' : '#0269CC',
        'fill-opacity': 0.08,
        'fill-outline-color': '#0269CC'
      }
    }, firstSymbolLayer ? firstSymbolLayer.id : undefined);

    /* 6) Listeners globaux ------------------------------------ */
    map.on('idle',   updateVisibleList);
    map.on('moveend', updateVisibleList);

    /* 7) Premier highlight ville + liste ---------------------- */
    updateCityHighlight(firstCityList);
  });

  /* Zoom / rotation standard */
  map.addControl(new maplibregl.NavigationControl(), 'top-right');
}

    map.addControl(new maplibregl.NavigationControl(), 'top-right');
  }

  /* ───────────────  MISE À JOUR DU HIGHLIGHT  ─────────────── */
  function updateCityHighlight(selectedCities = []) {
    if (!map?.isStyleLoaded() || !map.getLayer(CITY_HIGHLIGHT_LAYER_ID)) return;

    const filter = selectedCities.length
      ? ['all',
          ['==', ['get', 'level'], CITY_LEVEL],
          ['in', ['get', CITY_NAME_FIELD], ['literal', selectedCities]]
        ]
      : ['==', ['get', CITY_NAME_FIELD], '__none__'];  // masque invisible

    map.setFilter(CITY_HIGHLIGHT_LAYER_ID, filter);
    console.log('[MAP_SCRIPT] Communes colorées :', selectedCities);
  }

    // --- LE RESTE DU SCRIPT (inchangé) ---
    const toggle3dButton = document.getElementById('toggle-3d-button');
if (toggle3dButton) {
    toggle3dButton.addEventListener('click', function() {
        if (!map) return;

        // On vérifie l'inclinaison actuelle de la carte
        const currentPitch = map.getPitch();

        if (currentPitch > 0) {
            // Si la carte est en 3D, on la remet en 2D
            map.easeTo({ pitch: 0, bearing: 0, duration: 1000 });
            this.textContent = '3D';
        } else {
            // Si la carte est en 2D, on la passe en 3D
            map.easeTo({ pitch: 65, duration: 1000 }); // 65 degrés d'inclinaison
            this.textContent = '2D';
        }
    });
}
// ▲▲▲ FIN DE L'AJOUT POUR LE BOUTON 3D ▲▲▲
    const createCircleSdf = (size) => { const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size; const context = canvas.getContext('2d'); const radius = size / 2; context.beginPath(); context.arc(radius, radius, radius - 2, 0, 2 * Math.PI, false); context.fillStyle = 'white'; context.fill(); return context.getImageData(0, 0, size, size); };
    function getNestedValue(obj, path) { if (!path) return undefined; return path.split('.').reduce((acc, part) => (acc && acc[part] !== undefined) ? (isNaN(parseInt(part, 10)) ? acc[part] : acc[parseInt(part, 10)]) : undefined, obj); }
    function convertAnnoncesToGeoJSON(annonces) { const features = annonces.map(annonce => { const lat = getNestedValue(annonce, 'geo_location.data.lat'); const lng = getNestedValue(annonce, 'geo_location.data.lng'); if (annonce.id === undefined || lat === undefined || lng === undefined) return null; let fId = parseInt(annonce.id, 10); if (isNaN(fId)) return null; return { type: 'Feature', id: fId, geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] }, properties: { id: fId, id_str: String(annonce.id), price: getNestedValue(annonce, '_property_lease_of_property.0.loyer') || '?', coverPhoto: getNestedValue(annonce, '_property_photos.0.images.0.url'), house_type: getNestedValue(annonce, 'house_type'), city: getNestedValue(annonce, 'city'), rooms: getNestedValue(annonce, 'rooms'), bedrooms: getNestedValue(annonce, 'bedrooms'), area: getNestedValue(annonce, 'area') } }; }).filter(Boolean); return { type: 'FeatureCollection', features }; }
    let currentPopup = null, selectedPinId = null, isMobile = window.innerWidth < 768, hoverTooltip = null;
    function handleDotHoverOrClick(e) { if (map.queryRenderedFeatures(e.point, { layers: [LAYER_ID_PRICES] }).length > 0) return; if (e.features.length > 0) { map.getCanvas().style.cursor = 'pointer'; if (hoverTooltip) hoverTooltip.remove(); const p = e.features[0].properties; const c = e.features[0].geometry.coordinates.slice(); hoverTooltip = new maplibregl.Popup({ closeButton: false, offset: 10, anchor: 'bottom', className: 'hover-popup' }).setLngLat(c).setHTML(`<div class="hover-popup-content">${p.price}€</div>`).addTo(map); } }
    function handlePriceBubbleClick(e) { if (hoverTooltip) { hoverTooltip.remove(); hoverTooltip = null; } if (e.features && e.features.length > 0) { const f = e.features[0]; const p = f.properties; const cId = f.id; const d = allAnnouncements.find(a => a.id === cId); if (d) sessionStorage.setItem('selected_property_details', JSON.stringify(d)); if (selectedPinId !== null) map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: selectedPinId }, { selected: false }); map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: cId }, { selected: true }); selectedPinId = cId; if (isMobile) { if (currentPopup) currentPopup.remove(); openMobileBottomSheet(p); } else { if (currentPopup) currentPopup.remove(); const h = createPopupHTML(p); currentPopup = new maplibregl.Popup({ offset: 25, className: 'airbnb-style-popup' }).setLngLat(f.geometry.coordinates.slice()).setHTML(h).addTo(map); currentPopup.on('close', () => { if (selectedPinId === cId) { map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: selectedPinId }, { selected: false }); selectedPinId = null; } currentPopup = null; }); } } }
    function createPopupHTML(p) { const i = 'https://via.placeholder.com/280x150/cccccc/969696?text=Image'; const c = p.coverPhoto || i; const h = (p.house_type || 'Logement').replace(/^\w/, c => c.toUpperCase()); const t = `${h} à ${p.city || 'ville'}`; const d = []; if (p.rooms) d.push(`${p.rooms} p.`); if (p.bedrooms) d.push(`${p.bedrooms} ch.`); if (p.area) d.push(`${p.area}m²`); const dH = d.length > 0 ? `<p class="popup-description">${d.join(' • ')}</p>` : ''; const pH = `<p class="popup-price">${p.price || '?'}€ <span class="popup-price-period">/ mois</span></p>`; const l = `annonce?id=${p.id_str}`; return `<div><a href="${l}" class="popup-container-link" target="_blank"><div class="map-custom-popup"><img src="${c}" alt="${t}" class="popup-image" onerror="this.src='${i}'"><div class="popup-info"><h4 class="popup-title">${t}</h4>${dH}${pH}</div></div></a></div>`; }
    const listContainer = document.getElementById('annonces-wrapper'), mobileToggleButton = document.getElementById('mobile-map-toggle');
    function updateVisibleList() { if (!map || !map.isStyleLoaded() || !listContainer) return; const vis = new Set(map.queryRenderedFeatures({ layers: [LAYER_ID_PILLS] }).map(f => String(f.properties.id))); listContainer.querySelectorAll('[data-property-id]').forEach(el => { const a = el.parentElement; if (!a || a.tagName !== 'A') { el.style.display = vis.has(el.dataset.propertyId) ? '' : 'none'; return; } a.classList.toggle('annonce-list-item-hidden', !vis.has(el.dataset.propertyId)); }); if (isMobile && mobileToggleButton) mobileToggleButton.textContent = `Voir les ${vis.size} logements`; }
    function getBounds(g) { const b = new maplibregl.LngLatBounds(); g.features.forEach(f => b.extend(f.geometry.coordinates)); return b; }
    const mobileBottomSheet = document.getElementById('mobile-bottom-sheet'), mobileBottomSheetContent = document.getElementById('mobile-bottom-sheet-content'), bottomSheetCloseButton = document.getElementById('bottom-sheet-close-button');
    function openMobileBottomSheet(p) { if (!mobileBottomSheet || !mobileBottomSheetContent) return; mobileBottomSheetContent.innerHTML = createPopupHTML(p); mobileBottomSheet.classList.add('visible'); }
    function closeMobileBottomSheet() { if (!mobileBottomSheet) return; mobileBottomSheet.classList.remove('visible'); setTimeout(() => { if (mobileBottomSheetContent) mobileBottomSheetContent.innerHTML = ''; }, 350); if (map && selectedPinId !== null) { map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: selectedPinId }, { selected: false }); selectedPinId = null; } }
    if (bottomSheetCloseButton) bottomSheetCloseButton.addEventListener('click', e => { e.stopPropagation(); closeMobileBottomSheet(); });
    if (isMobile && mobileToggleButton) mobileToggleButton.addEventListener('click', () => { document.body.classList.toggle('map-is-active'); if (document.body.classList.contains('map-is-active')) { if (map) map.resize(); mobileToggleButton.textContent = `Voir la liste`; } else { if (listContainer) listContainer.scrollTo(0, 0); mobileToggleButton.textContent = `Afficher la carte`; } });
});

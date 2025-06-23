// map-listings.js — version « failsafe » avec highlight des communes sélectionnées
document.addEventListener('DOMContentLoaded', () => {
  /* ───────── CONFIG ───────── */
  const MAPTILER_KEY   = 'UsgTlLJiePXeSnyh57aL';
  const MAP_ID         = '019799fa-e40f-7af6-81a6-b6d1de969567';
  const MAP_CONTAINER  = 'map-section';

  const COUNTRIES_SRC  = 'countries';          // dataset Boundaries
  const ADMIN_LAYER    = 'administrative';     // source-layer dans ce dataset
  const COMMUNE_LEVEL  = 3;                    // communes
  const NAME_FIELD     = 'name';

  const HIGHLIGHT_ID   = 'city-highlight-layer';
  const SRC_ANNONCES   = 'annonces-source';
  const DOT_LAYER      = 'annonces-dots-layer';
  const PRICE_LAYER    = 'annonces-prices-layer';

  let map, allAnnouncements = [];

  /* ───── écouteur principal ───── */
  document.addEventListener('annoncesChargeesEtRendues', e => {
    const annonces = e.detail.annonces || [];
    const cities   = e.detail.cities   || [];

    allAnnouncements = annonces;
    const gjson = convertAnnoncesToGeoJSON(annonces);

    if (!map) initializeMap(gjson, cities);
    else {
      map.getSource(SRC_ANNONCES)?.setData(gjson);
      if (gjson.features.length) map.fitBounds(getBounds(gjson), { padding: 80, maxZoom: 16 });
      updateCityHighlight(cities);
    }
  });

  /* ───── init carte ───── */
  function initializeMap(gjson, initCities) {
    map = new maplibregl.Map({
      container: MAP_CONTAINER,
      style:     `https://api.maptiler.com/maps/${MAP_ID}/style.json?key=${MAPTILER_KEY}`,
      renderWorldCopies: false
    });

    map.on('load', () => {
      /* 1. Assurer la présence de la source communes */
      if (!map.getSource(COUNTRIES_SRC)) {
        map.addSource(COUNTRIES_SRC, {
          type: 'vector',
          url:  `https://api.maptiler.com/tiles/countries/{z}/{x}/{y}.pbf?key=${MAPTILER_KEY}`
        });
      }

      /* 2. Annonces (points + prix) */
      map.addImage('circle-bg', createCircleSdf(64), { sdf: true });
      map.addSource(SRC_ANNONCES, { type: 'geojson', data: gjson, promoteId: 'id' });
      map.addLayer({ id: DOT_LAYER,   type: 'circle', source: SRC_ANNONCES,
        paint: { 'circle-radius': 5, 'circle-color': '#fff', 'circle-stroke-width': 1, 'circle-stroke-color': '#b4b4b4' }});
      map.addLayer({ id: PRICE_LAYER, type: 'symbol', source: SRC_ANNONCES,
        layout: { 'icon-image':'circle-bg','icon-size':0.9,'text-field':['concat',['get','price'],'€'],'text-font':['Open Sans Bold'], 'text-size':14 },
        paint:  { 'icon-color':'#000','text-color':'#333' }});

      /* 3. Couche highlight communes (vide au départ) */
      const topSymbol = map.getStyle().layers.find(l => l.type === 'symbol');
      map.addLayer({
        id: HIGHLIGHT_ID,
        type: 'fill',
        source: COUNTRIES_SRC,
        'source-layer': ADMIN_LAYER,
        filter: ['==', ['get', NAME_FIELD], '__none__'],
        paint: { 'fill-color':'rgba(4,153,153,0.35)', 'fill-outline-color':'rgba(4,153,153,1)' }
      }, topSymbol?.id);

      /* 4. premier highlight */
      updateCityHighlight(initCities);

      /* 5. Ajuste vue initiale */
      if (gjson.features.length) map.fitBounds(getBounds(gjson), { padding: 80, maxZoom: 16 });
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');
  }

  /* ───── MAJ couche sur changement de villes ───── */
  function updateCityHighlight(cityArr = []) {
    if (!map?.isStyleLoaded() || !map.getLayer(HIGHLIGHT_ID)) return;

    const filter = cityArr.length
      ? ['all', ['==', ['get','level'], COMMUNE_LEVEL], ['in', ['get', NAME_FIELD], ['literal', cityArr]]]
      : ['==', ['get', NAME_FIELD], '__none__'];

    map.setFilter(HIGHLIGHT_ID, filter);
    console.log('[Highlight] communes filtrées :', cityArr);
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
    function updateVisibleList() { if (!map || !map.isStyleLoaded() || !listContainer) return; const vis = new Set(map.queryRenderedFeatures({ layers: [LAYER_ID_DOTS] }).map(f => String(f.properties.id))); listContainer.querySelectorAll('[data-property-id]').forEach(el => { const a = el.parentElement; if (!a || a.tagName !== 'A') { el.style.display = vis.has(el.dataset.propertyId) ? '' : 'none'; return; } a.classList.toggle('annonce-list-item-hidden', !vis.has(el.dataset.propertyId)); }); if (isMobile && mobileToggleButton) mobileToggleButton.textContent = `Voir les ${vis.size} logements`; }
    function getBounds(g) { const b = new maplibregl.LngLatBounds(); g.features.forEach(f => b.extend(f.geometry.coordinates)); return b; }
    const mobileBottomSheet = document.getElementById('mobile-bottom-sheet'), mobileBottomSheetContent = document.getElementById('mobile-bottom-sheet-content'), bottomSheetCloseButton = document.getElementById('bottom-sheet-close-button');
    function openMobileBottomSheet(p) { if (!mobileBottomSheet || !mobileBottomSheetContent) return; mobileBottomSheetContent.innerHTML = createPopupHTML(p); mobileBottomSheet.classList.add('visible'); }
    function closeMobileBottomSheet() { if (!mobileBottomSheet) return; mobileBottomSheet.classList.remove('visible'); setTimeout(() => { if (mobileBottomSheetContent) mobileBottomSheetContent.innerHTML = ''; }, 350); if (map && selectedPinId !== null) { map.setFeatureState({ source: SOURCE_ID_ANNONCES, id: selectedPinId }, { selected: false }); selectedPinId = null; } }
    if (bottomSheetCloseButton) bottomSheetCloseButton.addEventListener('click', e => { e.stopPropagation(); closeMobileBottomSheet(); });
    if (isMobile && mobileToggleButton) mobileToggleButton.addEventListener('click', () => { document.body.classList.toggle('map-is-active'); if (document.body.classList.contains('map-is-active')) { if (map) map.resize(); mobileToggleButton.textContent = `Voir la liste`; } else { if (listContainer) listContainer.scrollTo(0, 0); mobileToggleButton.textContent = `Afficher la carte`; } });
});

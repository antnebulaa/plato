window.mapLoader = function() {
  if (typeof initMapAdresse === 'function') {
    initMapAdresse();
  } else {
    console.error("Fonction initMapAdresse non trouvée");
  }
};

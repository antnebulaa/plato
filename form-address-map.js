Map property edit

  <script>
  function initMapAdresse() {
    const elements = {
      userInput: document.getElementById("user-input-adresse"),
      autocompleteInput: document.getElementById("autocomplete-input-adresse"),
      dropdown: document.getElementById("custom-dropdown-adresse"),
      mapElement: document.getElementById("map-adresse"),
      formFields: {
        adresse: document.getElementById("address-line1"),
        ville: document.getElementById("city"),
        codePostal: document.getElementById("postal-code"),
        state: document.getElementById("state"),
        pays: document.getElementById("country"),
        // Ajout des champs pour les coordonnées
        latitude: document.getElementById("latitude"),
        longitude: document.getElementById("longitude"),
        geoLocation: document.getElementById("geo-location")
      }
    };

    // Initialisation de la carte
    const mapAdresse = new google.maps.Map(elements.mapElement, {
      center: { lat: 46.227638, lng: 2.213749 },
      zoom: 5,
      disableDefaultUI: true
    });

    const markerAdresse = new google.maps.Marker({ map: mapAdresse });
    let autocompleteAdresse;
    let placesService;

    // Configuration de l'autocomplete
    function setupAutocomplete() {
      autocompleteAdresse = new google.maps.places.Autocomplete(elements.autocompleteInput, {
        componentRestrictions: { country: "fr" },
        fields: ["address_components", "geometry", "place_id", "formatted_address"],
        types: ['address']
      });

      autocompleteAdresse.addListener('place_changed', () => {
        const place = autocompleteAdresse.getPlace();
        handlePlaceSelection(place);
      });
    }

    // Gestion centrale de la sélection
    function handlePlaceSelection(place) {
      if (!place.geometry) {
        console.error("Aucune géométrie disponible pour ce lieu");
        return;
      }

      // Mise à jour de la carte
      mapAdresse.fitBounds(place.geometry.viewport);
      markerAdresse.setPosition(place.geometry.location);
      markerAdresse.setVisible(true);

      // Extraction des coordonnées
      const latitude = place.geometry.location.lat();
      const longitude = place.geometry.location.lng();

      // Format pour Xano
      const geoLocationObj = {
        lat: latitude,
        lng: longitude
      };

      // Stockage des coordonnées dans les champs cachés (si présents)
      if (elements.formFields.latitude) {
        elements.formFields.latitude.value = latitude;
      }

      if (elements.formFields.longitude) {
        elements.formFields.longitude.value = longitude;
      }

      // Stockage du format JSON pour Xano
      if (elements.formFields.geoLocation) {
        elements.formFields.geoLocation.value = JSON.stringify(geoLocationObj);
      }

      // Récupération des composants d'adresse
      const addressComponents = {
        street_number: '',
        route: '',
        locality: '',
        postal_code: '',
        administrative_area_level_1: '',
        country: ''
      };

      place.address_components.forEach(component => {
        const componentType = component.types[0];
        if (addressComponents.hasOwnProperty(componentType)) {
          addressComponents[componentType] = component.long_name;
        }
      });

      // Mise à jour des champs du formulaire
      elements.formFields.adresse.value =
        `${addressComponents.street_number} ${addressComponents.route}`.trim();
      elements.formFields.ville.value = addressComponents.locality;
      elements.formFields.codePostal.value = addressComponents.postal_code;
      elements.formFields.state.value = addressComponents.administrative_area_level_1;
      elements.formFields.pays.value = addressComponents.country;

      // Synchronisation des inputs
      elements.userInput.value = place.formatted_address || '';

      // Log des coordonnées pour vérification
      console.log("Coordonnées récupérées:", latitude, longitude);
      console.log("Format JSON pour Xano:", JSON.stringify(geoLocationObj));
    }

    // Gestion du dropdown personnalisé
    elements.userInput.addEventListener('input', () => {
      const inputValue = elements.userInput.value;

      if (!inputValue) {
        elements.dropdown.style.display = 'none';
        return;
      }

      new google.maps.places.AutocompleteService().getPlacePredictions({
        input: inputValue,
        componentRestrictions: { country: 'fr' },
        types: ['address']
      }, (predictions, status) => {
        if (status !== 'OK' || !predictions) {
          elements.dropdown.style.display = 'none';
          return;
        }

        elements.dropdown.innerHTML = '';
        elements.dropdown.style.display = 'block';

        predictions.forEach(prediction => {
          const item = document.createElement('div');
          item.className = 'custom-dropdown-item';
          item.textContent = prediction.description;

          item.addEventListener('click', () => {
            elements.userInput.value = prediction.description;
            elements.dropdown.style.display = 'none';

            // Récupération des détails complets via le place_id
            placesService = placesService || new google.maps.places.PlacesService(
              mapAdresse);
            placesService.getDetails({
              placeId: prediction.place_id,
              fields: ['address_components', 'geometry', 'name',
                'formatted_address'
              ]
            }, (place, status) => {
              if (status === 'OK') handlePlaceSelection(place);
            });
          });

          elements.dropdown.appendChild(item);
        });
      });
    });

    // Fermeture du dropdown
    document.addEventListener('click', (e) => {
      if (!elements.userInput.contains(e.target) && !elements.dropdown.contains(e.target)) {
        elements.dropdown.style.display = 'none';
      }
    });

    // Initialisation finale
    setupAutocomplete();
    
    console.log("initMapAdresse exécutée"); // Ajout d'un log pour vérifier
  }

initMapAdresse();

</script>

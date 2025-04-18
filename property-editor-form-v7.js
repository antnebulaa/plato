

  // ==========================================
  // == Script Xano Unifié (Formulaires + Données) ==
  // ==========================================
  // Date: 2025-04-17 21h22

  let xanoClient; // Déclarez xanoClient ici


  // Variables pour la sélection multiple de photos
  let modeSelectionActif = false; // false = pas en mode sélection, true = en mode sélection
  let photosSelectionneesIds = [];
  let currentSelectedRoomId = null;
   
    function setupRoomTypeSelection() {
      // Cible le conteneur de ta Collection List (ajuste le sélecteur si besoin)
      const roomTypesListWrapper = document.querySelector(
      '[data-element="room-types-list-wrapper"]'); // Exemple d'attribut
  
      // Cible l'input caché dans le formulaire d'ajout de pièce (ajuste le sélecteur)
      // Il faut cibler l'input qui doit recevoir la valeur pour Xano (base_room_name)
      const addRoomForm = document.querySelector(
      '[data-xano-form="property_photos_rooms"]'); // Trouve le bon formulaire
      const hiddenRoomNameInput = addRoomForm ? addRoomForm.querySelector(
        '[data-xano-field-name="room_name"]') : null; // Trouve l'input caché
  
      if (!roomTypesListWrapper) {
        console.warn("setupRoomTypeSelection: Wrapper de la liste des types de pièce non trouvé.");
        return;
      }
      if (!addRoomForm) {
        console.warn("setupRoomTypeSelection: Formulaire d'ajout de pièce non trouvé.");
        return;
      }
      if (!hiddenRoomNameInput) {
        console.error(
          "setupRoomTypeSelection: Input caché [data-xano-field-name='room_name'] non trouvé dans le formulaire d'ajout !"
          );
        return;
      }
  
      console.log(
        "setupRoomTypeSelection: Initialisation de l'écouteur de clic pour la sélection du type de pièce."
        );
  
      roomTypesListWrapper.addEventListener('click', function (event) {
        // Trouve le bouton cliqué (ou son parent) qui a l'attribut data-action="select-room-type"
        const clickedButton = event.target.closest('[data-action="select-room-type"]');
  
        if (clickedButton) {
          // Récupère le nom de la pièce depuis l'attribut data-room-type-name
          const roomTypeName = clickedButton.getAttribute('data-room-type-name');
  
          if (roomTypeName) {
            console.log(`setupRoomTypeSelection: Type de pièce sélectionné: ${roomTypeName}`);
  
            // Met à jour la valeur de l'input caché dans le formulaire d'ajout
            hiddenRoomNameInput.value = roomTypeName;
  
            // Optionnel : Gérer le feedback visuel (classe 'is-selected')
            // Enlève la classe de tous les boutons de type
            roomTypesListWrapper.querySelectorAll('[data-action="select-room-type"]').forEach(
              btn => {
                btn.classList.remove('is-selected'); // Nom de classe à définir dans Webflow
              });
            // Ajoute la classe au bouton cliqué
            clickedButton.classList.add('is-selected');
  
            // Optionnel : Faire autre chose, comme afficher le formulaire s'il était caché
            // addRoomForm.style.display = 'block';
  
          } else {
            console.warn(
              "setupRoomTypeSelection: Attribut data-room-type-name manquant ou vide sur le bouton cliqué.",
              clickedButton);
          }
        }
      });
    }
  
  // Modifie ton écouteur DOMContentLoaded pour appeler la nouvelle fonction
  document.addEventListener('DOMContentLoaded', function () {
    // --- Configuration ---
     try { // Ajout d'un try/catch global pour l'init
    // Assignez la variable déclarée plus haut
    xanoClient = new XanoClient({ // Pas de 'const' ici
      apiGroupBaseUrl: 'https://xwxl-obyg-b3e3.p7.xano.io/api:qom0bt4V',
    });
   console.log("1. Instance xanoClient créée.");
       
    // --- Initialisation ---
    const authToken = getCookie('xano_auth_token');
    if (authToken) {
      xanoClient.setAuthToken(authToken);
    console.log("2. Auth Token appliqué à xanoClient.");
      } else {
        console.log("2. Pas d'Auth Token trouvé.");
      }
  
    initXanoForms(xanoClient); // Initialise tes formulaires existants
         console.log("3. initXanoForms appelé.");
    initXanoDataEndpoints(xanoClient); // Charge les données éventuelles
       console.log("4. initXanoDataEndpoints appelé.");
  
    // --- NOUVEAU : Active la sélection des types de pièces ---
    setupRoomTypeSelection();
       console.log("5. setupRoomTypeSelection appelé.");
    // ------------------------------------------------------
  
    initXanoLinkHandlers();
       console.log("6. initXanoLinkHandlers appelé.");
  
  
       // --- Vérification avant appel critique ---
      console.log("7. PRÊT à appeler setupCreatedRoomSelection.");
      console.log("   Vérification de xanoClient juste avant l'appel:", xanoClient); // Est-ce un objet valide ?
  
      if (typeof setupCreatedRoomSelection !== 'function') {
           console.error("ERREUR CRITIQUE: setupCreatedRoomSelection n'est pas une fonction !");
           return;
      }
      if (!xanoClient) {
           console.error("ERREUR CRITIQUE: xanoClient est undefined/null avant l'appel !");
           return;
      }
  
  
    // --- NOUVEAU : Active la sélection des pièces créées ---
    // Appelée ici, en supposant que initXanoDataEndpoints a eu le temps de rendre la liste.
    // Si le rendu est très lent ou asynchrone, il faudrait peut-être l'appeler
    // en réponse à l'événement 'xano:data-loaded' émis par fetchXanoData.
    setupCreatedRoomSelection(xanoClient);
    // -------------------------------------------------------
  
    console.log("8. Appel à setupCreatedRoomSelection TERMINÉ (ne signifie pas qu'elle a réussi).");
      // --- Fin Vérification ---
  
       setupPhotoSelectionMode();
  
  
      console.log("9. Initialisation UNIFIÉE terminée (fin du bloc try DOMContentLoaded).");
  
    } catch (initError) {
        console.error("ERREUR GLOBALE DANS DOMContentLoaded:", initError);
        // Une erreur ici pourrait empêcher setupCreatedRoomSelection d'être appelée
    }
  });
  
  // ==========================================
  // == Classe XanoClient Améliorée          ==
  // ==========================================
  class XanoClient {
    constructor(config) {
      this.apiGroupBaseUrl = config.apiGroupBaseUrl;
      this.authToken = null;
    }
  
    setAuthToken(token) {
      this.authToken = token;
    }
  
    async _request(method, endpoint, paramsOrBody = null, isFormData = false) {
      const url = `${this.apiGroupBaseUrl}/${endpoint}`;
      const options = {
        method: method,
        headers: {},
      };
  
      if (this.authToken) {
        options.headers['Authorization'] = `Bearer ${this.authToken}`;
      }
  
      let finalUrl = url;
  
      if (method === 'GET' && paramsOrBody) {
        // Construire les query parameters pour GET
        const queryParams = new URLSearchParams(paramsOrBody).toString();
        if (queryParams) {
          finalUrl = `${url}?${queryParams}`;
        }
      } else if (['POST', 'PUT', 'PATCH'].includes(method) && paramsOrBody) {
        if (isFormData) {
          // Ne pas définir Content-Type, le navigateur le fera avec la boundary correcte pour FormData
          options.body = paramsOrBody;
        } else {
          // Envoyer en JSON par défaut pour les objets
          options.headers['Content-Type'] = 'application/json';
          options.body = JSON.stringify(paramsOrBody);
        }
      }
      // DELETE n'a généralement pas de body, mais peut en avoir certains cas (rare)
      // Si paramsOrBody est fourni pour DELETE et n'est pas FormData, on pourrait envisager de le JSON.stringify aussi.
  
      try {
        const response = await fetch(finalUrl, options);
  
        // Gérer les réponses sans contenu (ex: 204 No Content pour DELETE)
        if (response.status === 204 || response.headers.get('content-length') === '0') {
          if (!response.ok) {
            // Même sans contenu, une erreur peut survenir (ex: 404 non trouvé)
            throw new Error(`Erreur HTTP ${response.status}`);
          }
          return null; // Pas de contenu à parser
        }
  
        // Essayer de parser en JSON par défaut
        const responseData = await response.json();
  
        if (!response.ok) {
          // Si Xano renvoie un message d'erreur dans le JSON
          const message = responseData.message || `Erreur HTTP ${response.status}`;
          throw new Error(message);
        }
        return responseData;
  
      } catch (error) {
        console.error(`Erreur lors de l'appel ${method} ${endpoint}:`, error);
        // Renvoie l'erreur pour qu'elle soit traitée par le code appelant
        throw error;
      }
    }
  
    async get(endpoint, params = null) {
      return this._request('GET', endpoint, params);
    }
  
    async post(endpoint, body = null, isFormData = false) {
      return this._request('POST', endpoint, body, isFormData);
    }
  
    async put(endpoint, body = null, isFormData = false) {
      return this._request('PUT', endpoint, body, isFormData);
    }
  
    async patch(endpoint, body = null, isFormData = false) {
      return this._request('PATCH', endpoint, body, isFormData);
    }
  
    async delete(endpoint, params = null) {
      // Pour DELETE, params est souvent dans l'URL, pas dans le body.
      // Si on voulait passer des params dans l'URL pour DELETE:
      let finalEndpoint = endpoint;
      if (params) {
        const queryParams = new URLSearchParams(params).toString();
        if (queryParams) {
          finalEndpoint = `${endpoint}?${queryParams}`;
        }
      }
      // On passe null comme body
      return this._request('DELETE', finalEndpoint, null);
    }
  }
  
  // ==========================================
  // == Initialisation des Formulaires       ==
  // ==========================================
  function initXanoForms(xanoClient) {
    const xanoForms = document.querySelectorAll('[data-xano-form]');
    xanoForms.forEach((form) => {
      form.addEventListener('submit', async function (e) {
        e.preventDefault();
  
        const endpoint = form.getAttribute('data-xano-form');
        const method = (form.getAttribute('data-xano-form-method') || 'POST').toUpperCase();
  
        // Indicateurs et bouton
        const loadingElement = form.querySelector('[data-xano-form-loading]') || document
          .querySelector(form.getAttribute(
          'data-xano-form-loading-selector')); // Supporte l'attribut direct ou un sélecteur
        const errorElement = form.querySelector('[data-xano-form-error]') || document
          .querySelector(form.getAttribute('data-xano-form-error-selector'));
        const submitButton = form.querySelector(
          'button[type="submit"], input[type="submit"]');
  
        if (errorElement) errorElement.style.display = 'none'; // Cacher ancienne erreur
        if (loadingElement) loadingElement.style.display = 'block';
        if (submitButton) submitButton.disabled = true;
  
        try {
          // Récupérer l'ID si nécessaire pour PUT/PATCH/DELETE
          let finalEndpoint = endpoint;
          let requestBody = null;
  
          if (form.hasAttribute('data-xano-form-id-param')) {
            const idParamName = form.getAttribute('data-xano-form-id-param');
            const idValue = getQueryParam(idParamName); // Utilise le helper getQueryParam
            if (idValue && ['PUT', 'PATCH', 'DELETE'].includes(method)) {
              // Typiquement, l'ID fait partie de l'URL pour ces méthodes
              finalEndpoint = `${endpoint}/${idValue}`;
            } else if (idValue && method === 'POST') {
              // Parfois, pour POST, l'ID peut être une partie du corps
              // ou l'endpoint peut le gérer comme un paramètre spécial
              // Ici, on suppose qu'il fait partie de l'URL pour rester cohérent
              // ou alors il faudrait le mettre dans le FormData
              // Si besoin dans le body, collectFormDataWithFiles devrait l'ajouter
              console.warn(
                "Utilisation de data-xano-form-id-param avec POST. L'ID sera ajouté à l'URL. Assurez-vous que c'est le comportement attendu."
                )
              finalEndpoint = `${endpoint}/${idValue}`;
            }
          }
  
          // Collecter les données du formulaire, y compris les fichiers
          const formData = collectFormDataWithFiles(form); // Utilise le helper
  
          // Déterminer la méthode client à appeler
          let responseData;
          switch (method) {
          case 'POST':
            responseData = await xanoClient.post(finalEndpoint, formData,
            true); // true = isFormData
            break;
          case 'PUT':
            responseData = await xanoClient.put(finalEndpoint, formData, true);
            break;
          case 'PATCH':
            responseData = await xanoClient.patch(finalEndpoint, formData, true);
            break;
          case 'DELETE':
            // DELETE n'utilise généralement pas FormData, l'ID est dans l'URL
            responseData = await xanoClient.delete(finalEndpoint);
            break;
          default:
            throw new Error(`Méthode de formulaire non supportée: ${method}`);
          }
  
          // Succès
          const successEvent = new CustomEvent('xano:form-success', {
            detail: { response: responseData, form: form },
            bubbles: true,
          });
          form.dispatchEvent(successEvent);
  
          // Gérer la redirection via attribut HTML
          if (form.hasAttribute('data-xano-form-redirect')) {
            const redirectUrl = form.getAttribute('data-xano-form-redirect');
            window.location.href = redirectUrl;
          } else {
            // Si pas de redirection, on peut vouloir réinitialiser le formulaire ou autre
            // form.reset(); // Optionnel: vider le formulaire après succès
          }
  
        } catch (error) {
          console.error('Erreur lors de la soumission du formulaire:', error);
          if (errorElement) {
            errorElement.textContent = error.message || "Une erreur inconnue est survenue.";
            errorElement.style.display = 'block';
          }
          const errorEvent = new CustomEvent('xano:form-error', {
            detail: { error: error, form: form },
            bubbles: true,
          });
          form.dispatchEvent(errorEvent);
        } finally {
          if (loadingElement) loadingElement.style.display = 'none';
          if (submitButton) submitButton.disabled = false;
        }
      });
    });
  }
  
  // ==========================================
  // == Init Récupération/Affichage Données  ==
  // ==========================================
  function initXanoDataEndpoints(xanoClient) {
    const xanoElements = document.querySelectorAll('[data-xano-endpoint]');
    xanoElements.forEach(element => {
      const endpoint = element.getAttribute('data-xano-endpoint');
      const method = (element.getAttribute('data-xano-method') || 'GET').toUpperCase();
      const params = {}; // Pour GET ou DELETE
  
      // Récupérer tous les paramètres statiques pour l'API call
      for (const attr of element.attributes) {
        if (attr.name.startsWith('data-xano-param-')) {
          params[attr.name.replace('data-xano-param-', '')] = attr.value;
        }
      }
  
      // Vérifier si nous avons des paramètres d'URL à utiliser
      if (element.hasAttribute('data-xano-use-url-param')) {
        const urlParamName = element.getAttribute('data-xano-use-url-param');
        const urlParamValue = getQueryParam(urlParamName); // Utilise le helper
        if (urlParamValue !== null) { // Vérifier si le paramètre existe, même vide
          const apiParamName = element.getAttribute('data-xano-url-param-to-api') || urlParamName;
          params[apiParamName] = urlParamValue;
        }
      }
  
      // Afficher indicateur de chargement (amélioration)
      const loadingIndicator = element.querySelector('[data-xano-loading]') || document
        .querySelector(element.getAttribute('data-xano-loading-selector'));
      if (loadingIndicator) loadingIndicator.style.display = 'block';
  
      // Appeler fetchXanoData
      fetchXanoData(xanoClient, endpoint, method, params, element, loadingIndicator);
    });
  }
  
  // ==========================================
  // == Init Gestionnaires de Liens          ==
  // ==========================================
  function initXanoLinkHandlers() {
    // Gérer les liens statiques (non dans les listes) APRÈS que les données soient potentiellement chargées
    // pour les cas où l'ID du lien viendrait d'un data-xano-endpoint sur un parent.
    document.addEventListener('xano:data-loaded', function (event) {
      const loadedElement = event.detail.element; // Élément qui a chargé les données
      const data = event.detail.data; // Données chargées
  
      // Cibler les liens DANS l'élément qui vient de charger, ou globalement s'ils ne sont pas dans une liste
      const potentialLinks = loadedElement.querySelectorAll('[data-xano-link-to]');
  
      potentialLinks.forEach(linkElement => {
        // Ne traiter que si ce n'est PAS un lien déjà géré dans renderListData
        if (!linkElement.closest('[data-xano-list-item]')) {
          const targetPage = linkElement.getAttribute('data-xano-link-to');
          const idField = linkElement.getAttribute('data-xano-link-param-id') ||
          'id'; // Champ ID dans les données
          const idParamName = linkElement.getAttribute('data-xano-link-url-param') ||
          'id'; // Nom du param dans l'URL cible
  
          // Essayer de trouver l'ID dans les données chargées (peut être un objet unique)
          // On prend data.body si c'est la structure Xano standard, sinon data directement.
          const sourceData = data?.body ? data.body : data;
          let linkTarget = targetPage;
  
          if (sourceData && typeof sourceData === 'object' && sourceData[idField]) {
            linkTarget =
              `${targetPage}?${idParamName}=${encodeURIComponent(sourceData[idField])}`;
          } else if (linkElement.hasAttribute('data-xano-data-id')) {
            // Fallback si l'ID a été mis via data-xano-data-id par bindDataToElement
            linkTarget =
              `${targetPage}?${idParamName}=${encodeURIComponent(linkElement.getAttribute('data-xano-data-id'))}`;
          }
          // Si pas d'ID trouvé, le lien reste tel quel (targetPage)
  
          // Mettre à jour l'URL du lien
          if (linkElement.tagName === 'A') {
            linkElement.href = linkTarget;
          } else {
            // Pour les non-liens, stocker la cible et ajouter un style/gestionnaire de clic
            linkElement.setAttribute('data-xano-link-target', linkTarget);
            linkElement.style.cursor = 'pointer'; // Indiquer qu'il est cliquable
          }
        }
      });
    });
  
    // Gestionnaire de clic global pour les éléments non-<a> avec data-xano-link-target
    document.addEventListener('click', function (event) {
      // Remonter le DOM pour trouver l'élément cliquable le plus proche
      const clickedElement = event.target.closest('[data-xano-link-target]');
      if (clickedElement && clickedElement.tagName !== 'A') {
        const linkTarget = clickedElement.getAttribute('data-xano-link-target');
        if (linkTarget) {
          window.location.href = linkTarget;
        }
      }
    });
  }
  
  // ==========================================
  // == Fonctions Logiques (Fetch, Render)   ==
  // ==========================================
  
  async function fetchXanoData(client, endpoint, method, params, targetElement, loadingIndicator) {
    try {
      let responseData;
      // Utiliser les méthodes du client Xano
      switch (method) {
      case 'GET':
        responseData = await client.get(endpoint, params);
        break;
      case 'POST': // Peut être utilisé pour fetch avec un body spécifique (rare pour juste afficher)
        responseData = await client.post(endpoint, params); // params serait le body ici
        break;
      case 'PUT':
      case 'PATCH':
        console.warn(
          `Utilisation de ${method} avec data-xano-endpoint. Est-ce intentionnel pour récupérer des données ?`
          );
        // Si PUT/PATCH doit envoyer un corps, il faudrait le récupérer d'une source.
        // Ici, on suppose que `params` pourrait être le corps.
        responseData = await client[method.toLowerCase()](endpoint, params);
        break;
      case 'DELETE': // Rarement utilisé pour *afficher* des données après
        responseData = await client.delete(endpoint, params);
        break;
      default:
        throw new Error(`Méthode HTTP non supportée pour data-xano-endpoint: ${method}`);
      }
  
      // Cacher l'indicateur de chargement AVANT le rendu
      if (loadingIndicator) loadingIndicator.style.display = 'none';
  
      renderData(responseData, targetElement); // Utilise le helper
  
      // Déclencher l'événement de succès après le rendu
      const successEvent = new CustomEvent('xano:data-loaded', {
        detail: { data: responseData, element: targetElement },
        bubbles: true
      });
      targetElement.dispatchEvent(successEvent);
  
    } catch (error) {
      console.error(`Erreur lors de la récupération des données pour ${endpoint}:`, error);
      if (loadingIndicator) loadingIndicator.style.display = 'none'; // Cacher aussi en cas d'erreur
  
      // Afficher l'erreur dans l'élément cible
      const errorDisplay = targetElement.querySelector('[data-xano-error]') ||
      targetElement; // Cherche un sous-élément ou utilise l'élément principal
      if (errorDisplay) {
        errorDisplay.textContent =
          `Erreur: ${error.message || 'Impossible de charger les données.'}`;
        // On pourrait ajouter un style pour l'erreur ici
        errorDisplay.style.color = 'red';
      }
  
      const errorEvent = new CustomEvent('xano:data-error', {
        detail: { error: error, element: targetElement },
        bubbles: true
      });
      targetElement.dispatchEvent(errorEvent);
    }
  }
  
  function renderData(data, element) {
    // --- Vérification SPÉCIFIQUE pour la liste de PHOTOS ---
    // On regarde si l'élément HTML où on doit afficher les données a l'ID 'room-photos-display'
    // ET s'il est bien configuré pour afficher une liste (a l'attribut data-xano-list)
    if (element.id === 'room-photos-display' && element.hasAttribute('data-xano-list')) {
        console.log("renderData: Appel de renderPhotoItems pour #room-photos-display"); // Log pour vérifier

        // Extraire la liste de données (Xano renvoie directement le tableau plat maintenant)
        let listData = null;
        if (Array.isArray(data)) {
            listData = data;
        } else {
             console.warn("renderData: Données reçues pour photos ne sont pas un tableau:", data);
             listData = []; // Sécurité: utiliser un tableau vide
        }
        // Appeler la fonction SPÉCIFIQUE aux photos
        renderPhotoItems(listData, element); // <<< APPEL renderPhotoItems ICI

    }
    // --- Logique pour TOUTES les AUTRES listes (ex: liste des rooms) ---
    else if (element.hasAttribute('data-xano-list')) {
        console.log("renderData: Appel de renderListData (générique) pour:", element); // Log pour vérifier

        // Extraire la liste de données (logique originale, cherche dans data, data.body, etc.)
        let listData = null;
        const potentialDataSources = [ data, data?.body, data?.items, data?.body?.items ]; // Adapter si besoin
        for (const source of potentialDataSources) {
             if (Array.isArray(source)) { listData = source; break; }
             if (source && typeof source === 'object') { for (const key in source) { if (Array.isArray(source[key])) { listData = source[key]; break; } } }
             if (listData) break;
        }
        if (!listData) {
            console.warn("renderData: Aucune donnée de liste trouvée pour", element, "dans", data);
            listData = []; // Sécurité: utiliser un tableau vide
        }
        // Appeler la fonction GÉNÉRIQUE (celle pour les rooms, etc.)
        renderListData(listData, element); // <<< APPEL renderListData ICI

    }
    // --- Logique pour les éléments uniques (non-listes) ---
    else {
        console.log("renderData: Affichage d'un élément unique pour:", element);
        // Code original pour gérer les éléments uniques avec bindDataToElement
        const sourceData = data?.body ? data.body : data;
         if (sourceData && typeof sourceData === 'object') {
             // Lier aux enfants directs ou à l'élément lui-même
             const boundElements = element.querySelectorAll('[data-xano-bind]');
             if (boundElements.length > 0) {
                 boundElements.forEach(boundElement => {
                     if (!boundElement.closest('[data-xano-list-item]')) { // Était '[data-xano-list] [data-xano-bind]', ajusté pour être plus sûr
                         bindDataToElement(boundElement, sourceData);
                     }
                 });
             } else if (element.hasAttribute('data-xano-bind')) {
                 bindDataToElement(element, sourceData);
             }
         } else {
             console.warn("renderData: Données pour élément unique non trouvées ou non objet:", sourceData);
         }
    }
}
  
  function renderListData(dataArray, listContainerElement) {
    dataArray = Array.isArray(dataArray) ? dataArray : [];
  
    const templateSelector = listContainerElement.getAttribute('data-xano-list');
    if (!templateSelector) {
      console.error("L'attribut data-xano-list doit contenir un sélecteur CSS pour le template.",
        listContainerElement);
      listContainerElement.textContent = "Erreur: Attribut data-xano-list manquant ou vide.";
      return;
    }
  
    const templateElement = document.querySelector(templateSelector);
    if (!templateElement) {
      console.error(`Élément template "${templateSelector}" introuvable.`);
      listContainerElement.textContent = `Erreur: Template "${templateSelector}" introuvable.`;
      return;
    }
  
    // Conteneur: soit un enfant spécifique, soit l'élément lui-même
    const container = listContainerElement.querySelector('[data-xano-list-container]') ||
      listContainerElement;
  
    // Vider le conteneur, en préservant le template s'il est à l'intérieur
    // Et en préservant les éléments qui ne sont PAS des data-xano-list-item générés précédemment
    let currentChild = container.firstChild;
    while (currentChild) {
      const nextChild = currentChild.nextSibling;
      // Ne supprimer que les éléments générés précédemment OU si le conteneur est l'élément principal
      // Et s'assurer de ne pas supprimer le template lui-même
      if (currentChild !== templateElement && currentChild.nodeType === Node.ELEMENT_NODE &&
        currentChild.hasAttribute('data-xano-list-item')) {
        container.removeChild(currentChild);
      } else if (container === listContainerElement && currentChild !== templateElement &&
        currentChild.nodeType === Node.ELEMENT_NODE) {
        // Si container = listContainerElement, on peut vouloir vider plus agressivement
        // Sauf si l'utilisateur a mis d'autres éléments statiques qu'il veut garder ?
        // Pour l'instant, on ne supprime que les items générés.
        // Option : Vider tout sauf le template si container === listContainerElement
        // container.removeChild(currentChild);
      }
      currentChild = nextChild;
    }
  
    // S'assurer que le template est bien caché (s'il n'est pas déjà dans une balise <template>)
    if (templateElement.tagName !== 'TEMPLATE') {
      templateElement.style.display = 'none';
      templateElement.setAttribute('aria-hidden', 'true'); // Pour l'accessibilité
    }
  
    // Générer les éléments de la liste
    if (dataArray.length > 0) {
      dataArray.forEach((item, index) => { // item est une ROOM ici (ou autre élément générique)
        // Cloner depuis le contenu de <template> ou l'élément lui-même
        const clone = templateElement.tagName === 'TEMPLATE' ?
          templateElement.content.cloneNode(true)
          .firstElementChild // Prend le premier élément du fragment cloné
          :
          templateElement.cloneNode(true);
  
        if (!clone) {
          console.error("Échec du clonage du template. Vérifiez la structure du template.",
            templateElement);
          return; // Passer à l'item suivant
        }
  
       
  
        // Rendre visible et marquer l'élément cloné
        clone.style.display = ''; // Enlever le display:none potentiel
        clone.removeAttribute('aria-hidden');
        clone.setAttribute('data-xano-list-item', ''); // Marqueur pour l'item généré
        clone.setAttribute('data-xano-item-index', index
      .toString()); // Index (utile pour debug ou style)
  
        // Lier les données aux sous-éléments [data-xano-bind]
        const boundElements = clone.querySelectorAll('[data-xano-bind]');
        boundElements.forEach(boundElement => {
          bindDataToElement(boundElement, item); // Utilise le helper
        });
        // Si le clone lui-même a data-xano-bind (cas d'un template simple comme juste <li>)
        if (clone.hasAttribute('data-xano-bind')) {
          bindDataToElement(clone, item);
        }
  
        // Gérer les liens dynamiques [data-xano-link-to] dans le clone
        const linkElements = clone.querySelectorAll('[data-xano-link-to]');
        linkElements.forEach(linkElement => {
          const targetPage = linkElement.getAttribute('data-xano-link-to');
          const idField = linkElement.getAttribute('data-xano-link-param-id') || 'id';
          const idParamName = linkElement.getAttribute('data-xano-link-url-param') || 'id';
  
          let linkTarget = targetPage; // Lien par défaut si pas d'ID
          const idValue = item[idField];
  
          if (idValue !== undefined && idValue !== null) {
            linkTarget = `${targetPage}?${idParamName}=${encodeURIComponent(idValue)}`;
          } else {
            console.warn(`ID field "${idField}" non trouvé dans l'item pour le lien`, item);
          }
  
          // Mettre à jour la cible du lien
          if (linkElement.tagName === 'A') {
            linkElement.href = linkTarget;
          } else {
            linkElement.setAttribute('data-xano-link-target', linkTarget);
            linkElement.style.cursor = 'pointer';
          }
        });
        // Si le clone lui-même a data-xano-link-to
        if (clone.hasAttribute('data-xano-link-to')) {
          const targetPage = clone.getAttribute('data-xano-link-to');
          const idField = clone.getAttribute('data-xano-link-param-id') || 'id';
          const idParamName = clone.getAttribute('data-xano-link-url-param') || 'id';
          let linkTarget = targetPage;
          const idValue = item[idField];
          if (idValue !== undefined && idValue !== null) {
            linkTarget = `${targetPage}?${idParamName}=${encodeURIComponent(idValue)}`;
          }
          if (clone.tagName === 'A') { clone.href = linkTarget; }
          else { clone.setAttribute('data-xano-link-target', linkTarget);
            clone.style.cursor = 'pointer'; }
        }
  
        // Trouve l'élément cliquable DANS le clone (celui où tu as mis data-action dans Webflow)
        const clickableElement = clone.querySelector('[data-action="select-created-room"]') ||
          clone; // Prend l'élément avec data-action, ou le clone entier par défaut
  
        if (item.id !== undefined) { // Vérifie que l'objet 'item' de Xano a bien un champ 'id'
          clickableElement.setAttribute('data-room-id', item.id);
          // Assure-toi aussi que data-action est bien là (au cas où il n'est pas sur le clone lui-même)
          if (!clickableElement.hasAttribute('data-action')) {
            clickableElement.setAttribute('data-action', 'select-created-room');
          }
        } else {
          console.warn("renderListData: ID manquant pour l'item:", item);
          // Empêcher de cliquer si pas d'ID? clickableElement.style.pointerEvents = 'none';
        }
       // --- Fin Logique ROOMS ---
        
        // Ajouter le clone au conteneur
        container.appendChild(clone);
      });
    } else {
      // Afficher un message si aucune donnée (amélioration)
      const emptyMessage = listContainerElement.getAttribute('data-xano-empty-message') ||
        "Aucune donnée à afficher.";
      // Vérifier s'il existe déjà un message vide pour ne pas le dupliquer
      if (!container.querySelector('.xano-empty-message')) {
        const messageElement = document.createElement('div'); // Ou 'p', 'li' selon le contexte
        messageElement.className = 'xano-empty-message'; // Classe pour styliser
        messageElement.textContent = emptyMessage;
        container.appendChild(messageElement);
      }
    }
  }
  

  function renderPhotoItems(dataArray, listContainerElement) {
    dataArray = Array.isArray(dataArray) ? dataArray : [];
  
    const templateSelector = listContainerElement.getAttribute('data-xano-list');
    if (!templateSelector) { console.error("renderPhotoItems: data-xano-list manquant.", listContainerElement); return; }
    const templateElement = document.querySelector(templateSelector);
    if (!templateElement) { console.error(`renderPhotoItems: Template "${templateSelector}" introuvable.`); return; }

  
    // Conteneur: soit un enfant spécifique, soit l'élément lui-même
    const container = listContainerElement.querySelector('[data-xano-list-container]') ||
      listContainerElement;
  
    // Vider le conteneur, en préservant le template s'il est à l'intérieur
    // Et en préservant les éléments qui ne sont PAS des data-xano-list-item générés précédemment
    let currentChild = container.firstChild;
    while (currentChild) {
      const nextChild = currentChild.nextSibling;
      // Ne supprimer que les éléments générés précédemment OU si le conteneur est l'élément principal
      // Et s'assurer de ne pas supprimer le template lui-même
      if (currentChild !== templateElement && currentChild.nodeType === Node.ELEMENT_NODE &&
        currentChild.hasAttribute('data-xano-list-item')) {
        container.removeChild(currentChild);
      } else if (container === listContainerElement && currentChild !== templateElement &&
        currentChild.nodeType === Node.ELEMENT_NODE) {
        // Si container = listContainerElement, on peut vouloir vider plus agressivement
        // Sauf si l'utilisateur a mis d'autres éléments statiques qu'il veut garder ?
        // Pour l'instant, on ne supprime que les items générés.
        // Option : Vider tout sauf le template si container === listContainerElement
        // container.removeChild(currentChild);
      }
      currentChild = nextChild;
    }
  
    // S'assurer que le template est bien caché (s'il n'est pas déjà dans une balise <template>)
    if (templateElement.tagName !== 'TEMPLATE') {
      templateElement.style.display = 'none';
      templateElement.setAttribute('aria-hidden', 'true'); // Pour l'accessibilité
    }
  
    // Générer les éléments de la liste
    if (dataArray.length > 0) {
      dataArray.forEach((item, index) => { // item est un objet image {url:..., path:...}
        const clone = templateElement.tagName === 'TEMPLATE' ?
          templateElement.content.cloneNode(true).firstElementChild : templateElement.cloneNode(true);
  
        if (!clone) {
          console.error("renderPhotoItems: Échec clonage pour item:", item);
          return; // Passer à l'item suivant
        }

        // --- Ajout spécifique aux photos ---
        if (item && item.path) {
      // Assurez-vous que 'clone' est l'élément principal du template (ex: la div externe)
      clone.setAttribute('data-photo-path', item.path);
  } else {
      // Log si jamais un objet image n'a pas de propriété 'path'
      console.warn("Impossible d'ajouter data-photo-path: 'path' manquant dans l'objet item", item);
  }
  
         // ... configuration de base du clone (display, aria-hidden, etc.) ...
         // Rendre visible et marquer
        clone.style.display = ''; // Enlever le display:none potentiel
        clone.removeAttribute('aria-hidden');
        clone.setAttribute('data-xano-list-item', ''); // Marqueur pour l'item généré
        clone.setAttribute('data-xano-item-index', index
      .toString()); // Index (utile pour debug ou style)
  
        // Lier les données aux sous-éléments [data-xano-bind]
        const boundElements = clone.querySelectorAll('[data-xano-bind]');
        boundElements.forEach(boundElement => {
          bindDataToElement(boundElement, item); // Utilise le helper
        });
        // Si le clone lui-même a data-xano-bind (cas d'un template simple comme juste <li>)
        if (clone.hasAttribute('data-xano-bind')) {
          bindDataToElement(clone, item); // item est l'objet photo {url:..., path:...}
        }
  
        // Ajouter le clone au conteneur
        container.appendChild(clone);
      });
    } else {
      // Afficher un message si aucune donnée (amélioration)
      const emptyMessage = listContainerElement.getAttribute('data-xano-empty-message') ||
        "Aucune donnée à afficher.";
      // Vérifier s'il existe déjà un message vide pour ne pas le dupliquer
      if (!container.querySelector('.xano-empty-message')) {
        const messageElement = document.createElement('div'); // Ou 'p', 'li' selon le contexte
        messageElement.className = 'xano-empty-message'; // Classe pour styliser
        messageElement.textContent = emptyMessage;
        container.appendChild(messageElement);
      }
    }
  }



  
  function bindDataToElement(element, data) {
    const dataKey = element.getAttribute('data-xano-bind');
    if (!dataKey) return; // Pas de clé de binding
  
    // Gestion de clés imbriquées simples (ex: user.name)
    let value = data;
    const keys = dataKey.split('.');
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        // Clé non trouvée ou donnée intermédiaire non objet
        console.warn(`Clé "${dataKey}" (partie "${key}") non trouvée ou chemin invalide dans:`, data);
        value = undefined; // Marquer comme non trouvé
        break;
      }
    }
  
    // Si la valeur finale est null ou undefined, on peut vouloir afficher une valeur par défaut ou rien
    const displayValue = value ?? ''; // Affiche une chaîne vide si null/undefined
  
    // Appliquer la valeur à l'élément
    switch (element.tagName.toLowerCase()) {
    case 'img':
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
        if (element.type === 'checkbox') {
          element.checked = !!value; // Coché si truthy, décoché si falsy/null/undefined
        } else { // radio
          element.checked = (element.value == value); // Comparaison non stricte peut être utile
        }
      } else if (element.type === 'date' && value) {
        // Formater pour input[type=date] (YYYY-MM-DD)
        try {
          element.value = new Date(value).toISOString().split('T')[0];
        } catch (e) { element.value = '';
          console.warn("Impossible de formater la date", value); }
      } else if (element.type === 'datetime-local' && value) {
        // Formater pour input[type=datetime-local] (YYYY-MM-DDTHH:mm)
        try {
          const d = new Date(value);
          // Ajuster pour le fuseau horaire local si nécessaire avant formatage
          // Ceci peut être complexe. Version simple sans ajustement timezone:
          element.value = d.toISOString().substring(0, 16);
        } catch (e) { element.value = '';
          console.warn("Impossible de formater datetime-local", value); }
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
      if (!element.hasAttribute('data-xano-link-to')) {
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
  
    // Gérer les attributs liés (data-xano-bind-attr-*)
    for (const attr of element.attributes) {
      if (attr.name.startsWith('data-xano-bind-attr-')) {
        const attrName = attr.name.replace('data-xano-bind-attr-', '');
        const attrValueKey = attr.value; // La valeur de cet attribut est la clé dans l'objet data
  
        // Gestion de clés imbriquées pour la valeur de l'attribut
        let attrValue = data;
        const attrKeys = attrValueKey.split('.');
        for (const key of attrKeys) {
          if (attrValue && typeof attrValue === 'object' && key in attrValue) {
            attrValue = attrValue[key];
          } else {
            attrValue = undefined;
            break;
          }
        }
  
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
  
  // ============================================================
  // == Fonctions pour Sélection Pièces (Types CMS & Créées) ==
  // ============================================================
  // === Version Corrigée de setupCreatedRoomSelection pour V2 ===
  function setupCreatedRoomSelection(client) {
      console.log("--- Entrée dans setupCreatedRoomSelection ---");
      if (!client) {
          console.error("ERREUR DANS setupCreatedRoomSelection: Le 'client' reçu est null ou undefined !"); return;
      }
      console.log("   Client reçu:", client);
  
      const photoUploadForm = document.querySelector('[data-xano-form="upload_multiple_photos"]');
      const photoDisplayContainer = document.querySelector('#room-photos-display');
  
      // === Vérification Spécifique listContainer ===
      console.log("Tentative sélection listContainer avec [data-xano-list-container=\"true\"]");
      const listContainer = document.querySelector('[data-xano-list-container="true"]');
  
      if (!listContainer) {
          console.error("ERREUR SETUP (Post-Query): Conteneur des rooms ([data-xano-list-container=\"true\"]) INTROUVABLE !");
          return; // Arrêter si non trouvé
      }
      // Double-check pour être sûr que ce n'est pas l'autre conteneur
      if (listContainer.id === 'room-photos-display') {
          console.error("ERREUR SETUP (Post-Query): Le sélecteur a trouvé #room-photos-display ! Problème d'attributs HTML.");
          return; // Arrêter si c'est le mauvais
      }
      console.log("listContainer trouvé avec succès (confirmé):", listContainer);
      // === Fin Vérification Spécifique ===
  
      // --- Autres Vérifications ---
      if (!photoUploadForm) {
          console.error("ERREUR SETUP: photoUploadForm introuvable."); return;
      }
      const roomDbIdInput = photoUploadForm.querySelector('[data-xano-field-name="property_photos_rooms_id"]');
      if (!roomDbIdInput) {
          console.error("ERREUR SETUP: roomDbIdInput introuvable."); return;
      }
      if (!photoDisplayContainer) {
          console.error("ERREUR SETUP: photoDisplayContainer introuvable."); return;
      }
      const photoLoadingIndicator = photoDisplayContainer.querySelector('[data-xano-loading]');
      console.log("Toutes les vérifications setup OK.");
      // --- Fin Autres Vérifications ---
  
  
      // --- Tentative d'Attachement Écouteur ---
      console.log("Tentative d'attachement de l'écouteur à listContainer...");
      try {
          listContainer.addEventListener('click', async function handleRoomClickFinal(event) {
              // === Code intérieur de l'écouteur ===
              console.log("--- CLIC DÉTECTÉ ---");
              const selectedElement = event.target.closest('[data-action="select-created-room"][data-room-id]');
              if (selectedElement) {
                  const roomDbId = selectedElement.getAttribute('data-room-id');
                  console.log(`Room ID: ${roomDbId}`);
               
                // currentSelectedRoomId = roomDbId;
                 currentSelectedRoomId = roomDbId;
                
                  try {
                      roomDbIdInput.value = roomDbId;
                      console.log(`Input mis à jour (valeur=${roomDbIdInput.value})`);
                  } catch (e) { console.error("Erreur maj input:", e); }
  
                
  
                  listContainer.querySelectorAll('[data-action="select-created-room"][data-room-id]').forEach(el => el.classList.remove('is-selected'));
                  selectedElement.classList.add('is-selected');
                  console.log("Feedback visuel appliqué.");
  
                  console.log("Préparation fetch photos...");
                  if (client) {
                      if (photoLoadingIndicator) photoLoadingIndicator.style.display = 'block';
                      const errorElement = photoDisplayContainer.querySelector('[data-xano-error]');
                      if (errorElement) errorElement.style.display = 'none';
                      const photoEndpoint = `property_photos/photos/${roomDbId}`;
                      const params = null;
                      try {
                          await fetchXanoData(client, photoEndpoint, 'GET', params, photoDisplayContainer, photoLoadingIndicator);
                          console.log(`Workspace photos OK pour room ${roomDbId}.`);
                      } catch (error) { console.error(`Erreur fetch photos pour room ${roomDbId}:`, error); }
                      finally { if (photoLoadingIndicator) photoLoadingIndicator.style.display = 'none'; }
                  } else { console.warn("Client Xano ou conteneur photo manquant pour fetch."); }
              } else { console.log("Clic ignoré (pas sur un élément de room valide)."); }
               // === Fin Code intérieur ===
          });
          // Si on arrive ici, l'appel à addEventListener n'a pas planté
          console.log("Attachement écouteur RÉUSSI (addEventListener n'a pas levé d'erreur).");
      } catch (error) {
          // Si addEventListener lui-même lève une erreur
          console.error("!!! ERREUR FATALE lors de l'APPEL à listContainer.addEventListener:", error);
      }
      // === Fin Tentative Attachement ===
  
      console.log("Fin de l'exécution normale de setupCreatedRoomSelection."); // Nouveau log final
  } // Fin de la fonction
  
  
  // ==========================================
  // Fonction pour initialiser le bouton de changement de mode sélection    ==
  // ==========================================
  
  function setupPhotoSelectionMode() {
    console.log("SETUP: Initialisation du bouton mode sélection photo.");
    const boutonModeSelection = document.getElementById('bouton-mode-selection');
    const conteneurPhotos = document.getElementById('room-photos-display'); // <<< Cible originale pour l'écouteur photo
    const photoListContainer = document.getElementById('photo-list-container'); // <<< Nécessaire pour trouver les photos à désélectionner
    const boutonSupprimerSelection = document.getElementById('bouton-supprimer-selection');

    // Vérification que les éléments existent
    if (!boutonModeSelection || !conteneurPhotos || !photoListContainer || !boutonSupprimerSelection) {
        console.error("SETUP ERROR: Un ou plusieurs éléments HTML manquants. IDs requis: bouton-mode-selection, room-photos-display, photo-list-container, bouton-supprimer-selection");
        return;
    }

    // --- Fonction HELPER pour gérer la visibilité du bouton Supprimer via les CLASSES ---
    function updateDeleteButtonVisibility() {
        if (!boutonSupprimerSelection) return;

        // Le bouton doit être visible SEULEMENT si on est en mode sélection ET qu'au moins une photo est sélectionnée.
        if (modeSelectionActif && photosSelectionneesIds.length > 0) {
            boutonSupprimerSelection.classList.remove('button-is-hidden');
            boutonSupprimerSelection.classList.add('button-is-visible');
            // console.log("Bouton supprimer rendu VISIBLE");
        } else {
            boutonSupprimerSelection.classList.remove('button-is-visible');
            boutonSupprimerSelection.classList.add('button-is-hidden');
            // console.log("Bouton supprimer rendu CACHÉ");
        }
    }

    // --- Écouteur sur le bouton Gérer/Annuler (#bouton-mode-selection) ---
    boutonModeSelection.addEventListener('click', function() {
        modeSelectionActif = !modeSelectionActif;
        console.log("Mode sélection photos :", modeSelectionActif);

        if (modeSelectionActif) {
            // On entre en mode sélection
            boutonModeSelection.textContent = "Annuler";
            conteneurPhotos.classList.add('selection-active'); // Classe sur le conteneur général
            // La visibilité du bouton dépendra de la sélection (gérée par updateDeleteButtonVisibility)
            updateDeleteButtonVisibility(); // Mettre à jour (devrait le cacher si 0 sélection)

        } else {
            // On sort du mode sélection (Clic sur "Annuler")
            boutonModeSelection.textContent = "Sélectionner les photos";
            conteneurPhotos.classList.remove('selection-active'); // Retire classe du conteneur général

            // >>> AJOUT: Logique de désélection <<<
            console.log("Annulation sélection : Désélection de toutes les photos.");
            // 1. Vider le tableau des sélections
            photosSelectionneesIds = [];
            console.log("   -> Tableau photosSelectionneesIds vidé.");

            // 2. Retirer la classe visuelle des photos DANS le photoListContainer
            if (photoListContainer) {
                 const selectedPhotos = photoListContainer.querySelectorAll('.is-photo-selected');
                 console.log(`   -> Trouvé ${selectedPhotos.length} photo(s) avec .is-photo-selected.`);
                 selectedPhotos.forEach(photoEl => {
                     photoEl.classList.remove('is-photo-selected');
                     // console.log("      -> Classe retirée de :", photoEl);
                 });
            } else {
                 console.warn("Impossible de désélectionner visuellement : #photo-list-container non trouvé.");
            }

            // 3. Cacher le bouton Supprimer (via la fonction helper)
            updateDeleteButtonVisibility();
            console.log("   -> Visibilité bouton Supprimer mise à jour (doit être caché).");
            // >>> FIN AJOUT <<<
        }
    });
    console.log("SETUP: Écouteur ajouté au bouton mode sélection.");


    // --- Écouteur sur le CONTENEUR des photos (#room-photos-display) ---
    // On garde la cible originale 'conteneurPhotos' comme dans votre script
    conteneurPhotos.addEventListener('click', function(event) {
        // console.log("--- Clic détecté sur conteneurPhotos (#room-photos-display) ---");
        if (!modeSelectionActif) {
            // console.log("Mode sélection inactif, clic photo ignoré.");
            return; // Mode sélection actif ?
        }
        // console.log("Mode sélection ACTIF. Cible du clic:", event.target);

        // Trouve l'élément parent le plus proche qui a data-photo-path
        const clickedPhotoElement = event.target.closest('[data-photo-path]');
        // console.log("Élément photo trouvé via closest:", clickedPhotoElement);

        if (!clickedPhotoElement) {
           // console.log("Clic en dehors d'une photo ou élément sans data-photo-path.");
            return; // Sortir si le clic n'est pas sur une photo identifiable (l'élément cloné)
        }

        // On ne veut pas forcément empêcher la propagation si besoin, mais on gère la sélection
        // event.preventDefault(); // À décommenter seulement si la photo est dans un lien et qu'on ne veut pas naviguer

        const photoPath = clickedPhotoElement.getAttribute('data-photo-path');
        if (!photoPath) {
             console.warn("Élément cliqué a [data-photo-path] mais l'attribut est vide.", clickedPhotoElement);
             return; // Sécurité
        }

        // Bascule la classe visuelle de sélection sur l'élément trouvé (le clone de photo-item-template)
        // C'EST ICI QUE LA SÉLECTION VISUELLE SE FAIT
        clickedPhotoElement.classList.toggle('is-photo-selected');
        const isNowSelected = clickedPhotoElement.classList.contains('is-photo-selected');
        console.log(`Photo [path: ${photoPath}] est maintenant sélectionnée: ${isNowSelected}`);

        // Met à jour le tableau photosSelectionneesIds (ajoute/retire photoPath)
        const indexInSelection = photosSelectionneesIds.indexOf(photoPath);
        if (indexInSelection > -1) {
             // Était sélectionné, on le retire du tableau (car toggle l'a désélectionné visuellement)
             if (!isNowSelected) { // Double vérification
                  photosSelectionneesIds.splice(indexInSelection, 1);
                  console.log(`   -> Photo retirée du tableau: ${photoPath}`);
             } else {
                   console.warn("Incohérence: Photo retirée visuellement mais encore dans le tableau?");
             }
        } else {
             // N'était pas sélectionné, on l'ajoute au tableau (car toggle l'a sélectionné visuellement)
              if (isNowSelected) { // Double vérification
                  photosSelectionneesIds.push(photoPath);
                  console.log(`   -> Photo ajoutée au tableau: ${photoPath}`);
              } else {
                    console.warn("Incohérence: Photo ajoutée visuellement mais pas ajoutée au tableau?");
              }
        }
        console.log("Photos sélectionnées (paths):", photosSelectionneesIds);

        // >>> MODIFIÉ : Utilisation de la fonction helper pour gérer la visibilité du bouton Supprimer <<<
        updateDeleteButtonVisibility();

    });
    console.log("SETUP: Écouteur ajouté au conteneur de photos (#room-photos-display).");

    // --- Écouteur sur le bouton "Supprimer la sélection" ---
    // La logique interne de cet écouteur (confirmation, appel API, rafraîchissement, réinitialisation)
    // de la version précédente semblait correcte et est conservée ici.
    if (boutonSupprimerSelection) {
        boutonSupprimerSelection.addEventListener('click', async function() {
           event.preventDefault();
            // ... (Même code que dans ma réponse précédente pour la logique de suppression) ...
            // [Copiez ici toute la partie 'addEventListener' pour 'boutonSupprimerSelection' de ma réponse précédente]
            // --- Début copie ---
            if (photosSelectionneesIds.length === 0) {
                console.warn("Clic sur Supprimer, mais aucune photo n'est sélectionnée.");
                return;
            }
            if (currentSelectedRoomId === null) {
                 console.error("Impossible de supprimer : ID de la room courante inconnu.");
                 alert("Erreur : Impossible d'identifier la room actuelle.");
                 return;
            }
            const confirmation = window.confirm(`Êtes-vous sûr de vouloir supprimer ${photosSelectionneesIds.length} photo(s) ? Cette action est irréversible.`);
            if (!confirmation) {
                console.log("Suppression annulée par l'utilisateur.");
                return;
            }
            console.log(`Suppression confirmée pour ${photosSelectionneesIds.length} photo(s) dans la room ${currentSelectedRoomId}. Paths:`, photosSelectionneesIds);
            boutonSupprimerSelection.disabled = true;
            boutonSupprimerSelection.textContent = "Suppression...";
            const payload = {
                room_id: parseInt(currentSelectedRoomId, 10),
                photo_paths: photosSelectionneesIds
            };
            const deleteEndpoint = 'property_photos/batch_delete';
            const deleteMethod = 'POST';
            try {
                const response = await xanoClient._request(deleteMethod, deleteEndpoint, payload, false);
                console.log('Réponse suppression Xano:', response);

                // Adaptez cette logique de succès si nécessaire
                let success = false;
                if (response && response.success === true) { success = true; }
                // Ajoutez d'autres conditions de succès si Xano répond différemment (ex: null, tableau...)

                if (success) {
                    console.log('Photos supprimées avec succès via API !');
                    alert('Les photos sélectionnées ont été supprimées.');
                    console.log(`Rafraîchissement des photos pour la room ${currentSelectedRoomId}...`);
                    const photoLoadingIndicator = photoDisplayContainer ? photoDisplayContainer.querySelector('[data-xano-loading]') : null;
                    const fetchEndpoint = `property_photos/photos/${currentSelectedRoomId}`;
                    const params = null;
                    if (photoDisplayContainer && xanoClient) {
                        if (photoLoadingIndicator) photoLoadingIndicator.style.display = 'block';
                         try {
                              await fetchXanoData(xanoClient, fetchEndpoint, 'GET', params, photoDisplayContainer, photoLoadingIndicator);
                              console.log("Rafraîchissement terminé.");
                         } catch (fetchError) {
                              console.error("Erreur lors du rafraîchissement des photos après suppression:", fetchError);
                              alert("Les photos ont été supprimées, mais l'affichage n'a pas pu être mis à jour automatiquement. Veuillez rafraîchir la page ou re-sélectionner la pièce.");
                         } finally {
                               if (photoLoadingIndicator) photoLoadingIndicator.style.display = 'none';
                         }
                    } else { console.warn("Impossible de rafraîchir : photoDisplayContainer ou xanoClient manquant."); }

                    // Réinitialiser l'état après succès
                    photosSelectionneesIds = [];
                    modeSelectionActif = false; // Important de sortir du mode
                    if(boutonModeSelection) boutonModeSelection.textContent = "Sélectionner les photos";
                    if(conteneurPhotos) conteneurPhotos.classList.remove('selection-active');
                    updateDeleteButtonVisibility(); // Pour cacher le bouton supprimer

                } else {
                    console.error("La suppression a échoué côté serveur (réponse non interprétée comme succès):", response);
                    let errorMessage = "La suppression des photos a échoué.";
                    if (response && response.message) { errorMessage += ` Message du serveur : ${response.message}`; }
                    else { errorMessage += " Réponse inattendue du serveur."; }
                    alert(errorMessage);
                }
            } catch (error) {
                console.error("Erreur lors de l'appel API de suppression:", error);
                alert("Erreur réseau ou technique lors de la tentative de suppression: " + error.message);
            } finally {
                boutonSupprimerSelection.disabled = false;
                boutonSupprimerSelection.textContent = "Supprimer la sélection";
                // Mettre à jour la visibilité finale (si succès, modeSelectionActif est false -> bouton caché)
                updateDeleteButtonVisibility();
            }
            // --- Fin copie ---
        });
        console.log("SETUP: Écouteur ajouté au bouton supprimer sélection.");
    }
     // --- FIN du listener boutonSupprimerSelection ---

     // Initialiser la visibilité du bouton Supprimer au chargement (il doit être caché)
      updateDeleteButtonVisibility();

} // Fin de setupPhotoSelectionMode
  
  
  // -----------------------------------------------------------------
  
  // ==========================================
  // == Fonctions Utilitaires (Helpers)      ==
  // ==========================================
  
  // Fonction pour collecter les données du formulaire avec prise en charge des fichiers
  // (Identique au script 1)
  function collectFormDataWithFiles(form) {
    const formData = new FormData();
    const inputs = form.querySelectorAll('input, select, textarea');
  
    inputs.forEach((input) => {
      const fieldName = input.getAttribute('data-xano-field-name') || input.name;
      if (!fieldName) return; // Ignorer les champs sans nom ou data-xano-field-name
  
      if (input.type === 'file') {
        // Utiliser data-xano-bind pour le nom du champ fichier si présent
        const fileFieldName = input.getAttribute('data-xano-bind') || fieldName;
        Array.from(input.files).forEach((file) => {
          formData.append(fileFieldName, file);
        });
      } else if (input.type === 'checkbox') {
        if (input.checked) {
          // Gérer les groupes de checkboxes avec la même `name`
          if (formData.has(fieldName)) {
            // Si existe déjà, convertir en tableau si ce n'est pas déjà fait
            let existing = formData.getAll(fieldName);
            formData.delete(fieldName); // Supprimer les anciennes clés
            existing.forEach(val => formData.append(fieldName, val)); // Remettre les anciennes
            formData.append(fieldName, input.value); // Ajouter la nouvelle
          } else {
            formData.append(fieldName, input.value); // Première checkbox avec ce nom
          }
        } else if (!form.querySelector(`input[type="checkbox"][name="${input.name}"]:checked`)) {
          // Si AUCUNE checkbox avec ce nom n'est cochée, on pourrait vouloir envoyer une valeur vide ?
          // Par défaut, FormData n'envoie rien pour une checkbox décochée. C'est souvent OK.
          // formData.append(fieldName, ''); // Décommentez si besoin d'envoyer vide.
        }
      } else if (input.type === 'radio') {
        if (input.checked) {
          formData.append(fieldName, input.value);
        }
      }
      else {
        formData.append(fieldName, input.value);
      }
    });
  
    return formData;
  }
  
  // Fonction pour obtenir un paramètre de l'URL
  // (Identique aux scripts précédents)
  function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
  }
  
  // Fonction pour obtenir un cookie
  // (Identique aux scripts précédents)
  function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) === ' ') {
        c = c.substring(1, c.length);
      }
      if (c.indexOf(nameEQ) === 0) {
        return decodeURIComponent(c.substring(nameEQ.length, c.length));
      }
    }
    return null;
  } 

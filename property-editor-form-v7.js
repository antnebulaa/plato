

  // ==========================================
  // == Script Xano Unifié (Formulaires + Données) ==
  // ==========================================
  // Date: 2025-04-18 12h20

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

             // Déclenche manuellement l'événement 'input' sur cet input pour que
            // l'autre script (qui surveille 'base_room_name') soit notifié du changement.
            const inputEvent = new Event('input', { bubbles: true, cancelable: true });
            hiddenRoomNameInput.dispatchEvent(inputEvent);
  
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
            // Définit l'ID (CODE EXISTANT)
            clickableElement.setAttribute('data-room-id', item.id);

            // Utiliser 'item.room_name' au lieu de 'item.name'
            if (item.room_name) { // <<< Changer ici
                 clickableElement.setAttribute('data-room-name', item.room_name); // <<< Changer ici
            } else {
                 // Message de log mis à jour pour refléter le bon nom de champ
                 console.warn("renderListData: Propriété 'room_name' manquante pour l'item:", item);
                 // clickableElement.setAttribute('data-room-name', 'Nom Inconnu'); // Optionnel
            }

            // Assure-toi aussi que data-action est bien là (CODE EXISTANT)
            if (!clickableElement.hasAttribute('data-action')) {
              clickableElement.setAttribute('data-action', 'select-created-room');
            }
        } else {
          // ID manquant (VOTRE CODE EXISTANT)
          console.warn("renderListData: ID manquant pour l'item:", item);
          // clickableElement.style.pointerEvents = 'none';
        }
       // --- Fin Logique ROOMS --- (Commentaire existant)
        
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

     // --- Chercher le placeholder pour l'état vide ---
     // Note: listContainerElement est probablement room-photos-display ici
     const emptyStatePlaceholder = document.getElementById('photo-empty-state-placeholder'); // Utilise la classe que vous avez définie

     const templateSelector = listContainerElement.getAttribute('data-xano-list');
     if (!templateSelector) { console.error("renderPhotoItems: data-xano-list manquant.", listContainerElement); return; }
     const templateElement = document.querySelector(templateSelector);
     if (!templateElement) { console.error(`renderPhotoItems: Template "${templateSelector}" introuvable.`); return; }

     const container = listContainerElement.querySelector('[data-xano-list-container]') || listContainerElement;

     // --- Vider le conteneur ---
     // Supprimer l'ancien message texte (au cas où)
     const existingEmptyMessage = container.querySelector('.xano-empty-message');
     if (existingEmptyMessage) container.removeChild(existingEmptyMessage);
     // Supprimer les anciens items photo
     let currentChild = container.firstChild;
     while (currentChild) {
         const nextChild = currentChild.nextSibling;
         if (currentChild.nodeType === Node.ELEMENT_NODE && currentChild.hasAttribute('data-xano-list-item')) {
             container.removeChild(currentChild);
         }
         currentChild = nextChild;
     }
     // --- Fin Vidage ---

     // Cacher le template photo
     if (templateElement.tagName !== 'TEMPLATE' && templateElement.style.display !== 'none') {
        templateElement.style.display = 'none';
        templateElement.setAttribute('aria-hidden', 'true');
     }

     // --- Afficher les photos OU le placeholder ---
     if (dataArray.length > 0) {
         // *** CAS 1 : Il y a des photos ***

         // 1. S'assurer que le placeholder est caché
         if (emptyStatePlaceholder) {
              emptyStatePlaceholder.style.display = 'none';
         } else {
              console.warn("renderPhotoItems: Placeholder '.photo-empty-state' non trouvé.");
         }

          // 2. Afficher les photos AVEC FADE-IN
         dataArray.forEach((item, index) => {
             // --- Début logique pour UNE photo ---
             const clone = templateElement.tagName === 'TEMPLATE' ? templateElement.content.cloneNode(true).firstElementChild : templateElement.cloneNode(true);
             if (!clone) return;

             // Configurer le clone (standard)
             clone.style.display = ''; // Assurer la visibilité du conteneur clone
             clone.removeAttribute('aria-hidden');
             clone.setAttribute('data-xano-list-item', '');
             clone.setAttribute('data-xano-item-index', index.toString());
             if (item && item.path) clone.setAttribute('data-photo-path', item.path);

             // *** Début Modifications Fade-in ***
             // a. Trouver l'élément image DANS le clone
             const imgElement = clone.querySelector('.photo-item-image');

             // b. Lier les données Xano (ceci mettra à jour l'attribut src de imgElement)
             const boundElements = clone.querySelectorAll('[data-xano-bind]');
             boundElements.forEach(boundElement => { bindDataToElement(boundElement, item); });
             if (clone.hasAttribute('data-xano-bind')) { bindDataToElement(clone, item); }

             // c. Ajouter classe initiale invisible (si img trouvée)
             if (imgElement) {
                  imgElement.classList.add('photo-item-loading');
             } else {
                  console.warn("renderPhotoItems: Image element (.photo-item-image) not found in clone for fade-in.");
             }
             // *** Fin Modifications Fade-in (Part 1) ***

             // d. Ajouter le clone (avec image initialement invisible) au DOM
             container.appendChild(clone);

             // *** Début Modifications Fade-in (Part 2) ***
             // e. Planifier retrait classe pour déclencher transition (si img trouvée)
             if (imgElement) {
                  requestAnimationFrame(() => {
                      requestAnimationFrame(() => {
                           imgElement.classList.remove('photo-item-loading');
                      });
                  });
             }
             // *** Fin Modifications Fade-in (Part 2) ***
             // --- Fin logique pour UNE photo ---
         }); // Fin forEach


     } else {
         // *** CAS 2 : Il n'y a PAS de photos ***
         // 2. Afficher le placeholder (s'il existe)
         if (emptyStatePlaceholder) {
              // Mettez ici le style display correct pour afficher votre placeholder
              // (block, flex, grid - selon votre design)
              emptyStatePlaceholder.style.display = 'flex'; // Ou 'flex', etc.
         } else {
              // Fallback si le placeholder n'a pas été trouvé dans le HTML
              console.warn("renderPhotoItems: Placeholder '.photo-empty-state' non trouvé. Affichage d'un message texte par défaut.");
              const emptyMessageText = listContainerElement.getAttribute('data-xano-empty-message') || "Aucune photo pour le moment.";
              if (!container.querySelector('.xano-empty-message')) {
                  const messageElement = document.createElement('div');
                  messageElement.className = 'xano-empty-message';
                  messageElement.textContent = emptyMessageText;
                  container.appendChild(messageElement);
              }
         }
     }
 } // --- FIN de renderPhotoItems ---


  
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

                   // --- AJOUT : Récupérer le nom et mettre à jour l'affichage ---
             const roomName = selectedElement.getAttribute('data-room-name') || `Pièce ID: ${roomDbId}`; // Récupère le nom, ou affiche l'ID par défaut
             const roomNameDisplayElement = document.getElementById('current-room-name-display'); // Trouve l'élément d'affichage par ID

             if (roomNameDisplayElement) {
                  roomNameDisplayElement.textContent = roomName; // Met à jour le texte
             } else {
                  console.warn("Élément d'affichage du nom de pièce (#current-room-name-display) non trouvé.");
             }
             // --- FIN AJOUT ---

             console.log(`Room ID: ${roomDbId}, Name: ${roomName}`); // Log amélioré

               
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
// Fonction pour initialiser le bouton et la modale de sélection/suppression photo
// ==========================================
function setupPhotoSelectionMode() {
    console.log("SETUP: Initialisation du bouton mode sélection photo.");
    // Récupération des éléments DOM essentiels
    const boutonModeSelection = document.getElementById('bouton-mode-selection');
    const conteneurPhotos = document.getElementById('room-photos-display');
    const photoListContainer = document.getElementById('photo-list-container');
    const boutonSupprimerSelection = document.getElementById('bouton-supprimer-selection');
    // xanoClient est accessible depuis la portée supérieure (DOMContentLoaded)

    // Vérification initiale
    if (!boutonModeSelection || !conteneurPhotos || !photoListContainer || !boutonSupprimerSelection) {
        console.error("SETUP ERROR: Un ou plusieurs éléments HTML manquants. IDs requis: bouton-mode-selection, room-photos-display, photo-list-container, bouton-supprimer-selection");
        return;
    }

    // --- Fonction HELPER pour gérer la visibilité du bouton Supprimer ---
    function updateDeleteButtonVisibility() {
        if (!boutonSupprimerSelection) return;
        if (modeSelectionActif && photosSelectionneesIds.length > 0) {
            boutonSupprimerSelection.classList.remove('button-is-hidden');
            boutonSupprimerSelection.classList.add('button-is-visible');
        } else {
            boutonSupprimerSelection.classList.remove('button-is-visible');
            boutonSupprimerSelection.classList.add('button-is-hidden');
        }
    }

    // --- Fonction Principale pour Exécuter la Suppression (appelée par la modale) ---
    async function executeDelete() {
        console.log(`Exécution suppression confirmée pour ${photosSelectionneesIds.length} photo(s) dans la room ${currentSelectedRoomId}. Paths:`, photosSelectionneesIds);

        const modalConfirmBtn = document.getElementById('modal-confirm-delete-button');
        if (modalConfirmBtn) {
             modalConfirmBtn.disabled = true;
             // Optionnel: changer le texte du bouton pendant la suppression
             // modalConfirmBtn.textContent = "Suppression...";
        }

       // <<< 1. MÉMORISER LA POSITION DE SCROLL >>>
        let scrollPos = window.scrollY || document.documentElement.scrollTop;
        console.log("Scroll position before delete/refresh:", scrollPos);

        // Préparer le payload pour l'API Xano
        const payload = {
            // Assurez-vous que Xano attend bien un entier pour room_id
            room_id: parseInt(currentSelectedRoomId, 10),
            photo_paths: photosSelectionneesIds // Le tableau des chemins
        };
        // Vérifiez le nom exact de votre endpoint
        const deleteEndpoint = 'property_photos/batch_delete'; // ou 'property_photos/batch_delete' ?
        const deleteMethod = 'POST'; // ou 'DELETE' ? Vérifiez la méthode attendue par Xano

        try {
            // Appel API via le client Xano
            const response = await xanoClient._request(deleteMethod, deleteEndpoint, payload, false); // false = Ce n'est pas FormData
            console.log('>>> RAW Response from _request:', response);

           // --- Logique de Vérification du Succès (Version Simplifiée) ---
            let success = false;
            let failureReason = "Unknown (Simplified Check)";

            console.log("--- Début Vérification Succès (Simplifiée) ---");
            console.log("Raw response:", response);

            // On vérifie juste si la réponse est un objet et si une propriété
            // qui ressemble à 'success' (avec ou sans quotes) est exactement true.
            if (response && typeof response === 'object') {
                 // On essaie les deux clés possibles
                 if (response.success === true || response["'success'"] === true) {
                     success = true;
                     failureReason = "N/A - Simplified Success Check OK";
                     console.log("Succès détecté (Vérification Simplifiée)");
                 } else {
                     success = false;
                     // Essayons de récupérer un message d'erreur potentiel
                     const errorMessageFromApi = response.message || response["'message'"] || "Pas de message d'erreur explicite.";
                     failureReason = `API indicated failure or unexpected success value. Message: ${errorMessageFromApi}`;
                     console.warn("Échec détecté ou valeur 'success' inattendue (Vérification Simplifiée). Message API:", errorMessageFromApi);
                 }
            } else if (response === null || response === undefined) {
                 // Cas 204 No Content ou réponse vide considérée comme succès
                 success = true;
                 failureReason = "N/A - Null/Undefined Response Assumed Success";
                 console.log("Réponse null/undefined interprétée comme succès (Vérification Simplifiée)");
            } else {
                 // Format de réponse totalement inattendu
                 success = false;
                 failureReason = "Unexpected response format (not object/null/undefined)";
                 console.warn("Format de réponse inattendu (Vérification Simplifiée):", response);
            }

            console.log(`>>> Success Check Result (Simplified): success=${success}, reason=${failureReason}`);
            console.log("--- Fin Vérification Succès (Simplifiée) ---");
            // --- Fin Vérification Succès ---

            if (success) {
                // Suppression réussie !
                console.log('Photos supprimées avec succès (API call OK)!');
                // Pas d'alerte ici, on ferme la modale et on rafraîchit

                console.log(`Rafraîchissement des photos pour la room ${currentSelectedRoomId}...`);
                const photoLoadingIndicator = conteneurPhotos ? conteneurPhotos.querySelector('[data-xano-loading]') : null;
                // Endpoint pour récupérer les photos de la room actuelle
                const fetchEndpoint = `property_photos/photos/${currentSelectedRoomId}`;
                const params = null; // Pas de paramètres pour GET ici

                if (conteneurPhotos && xanoClient) {
                    if (photoLoadingIndicator) photoLoadingIndicator.style.display = 'block';
                    try {
                        // Appel pour recharger et afficher les photos restantes
                        await fetchXanoData(xanoClient, fetchEndpoint, 'GET', params, conteneurPhotos, photoLoadingIndicator);
                        console.log("Rafraîchissement terminé.");

                        // <<< 2. RESTAURER LA POSITION DE SCROLL APRÈS LE RENDU >>>
                        // Utilise setTimeout pour exécuter après le cycle de rendu actuel
                        setTimeout(() => {
                             console.log("Attempting to restore scroll position to:", scrollPos);
                             // 'auto' pour un saut instantané, 'smooth' pour un défilement doux
                             window.scrollTo({ top: scrollPos, behavior: 'auto' });
                        }, 0); // Le délai 0 pousse l'exécution après le rendu en cours
                      
                    } catch (fetchError) {
                        console.error("Erreur lors du rafraîchissement des photos après suppression:", fetchError);
                        alert("Les photos ont été supprimées, mais l'affichage n'a pas pu être mis à jour automatiquement. Veuillez re-sélectionner la pièce ou rafraîchir.");
                    } finally {
                        if (photoLoadingIndicator) photoLoadingIndicator.style.display = 'none';
                    }
                } else {
                    console.warn("Impossible de rafraîchir : conteneurPhotos ou xanoClient manquant.");
                    alert("Les photos ont été supprimées, mais le rafraîchissement automatique a échoué car un élément requis est manquant.");
                }

                // Réinitialiser l'état de sélection APRÈS succès et rafraîchissement
                photosSelectionneesIds = [];
                modeSelectionActif = false;
                if (boutonModeSelection) boutonModeSelection.textContent = "Sélectionner les photos";
                if (conteneurPhotos) conteneurPhotos.classList.remove('selection-active');
                updateDeleteButtonVisibility(); // Cache le bouton Supprimer car mode inactif

            } else {
                // La suppression API a échoué (selon la vérification)
                console.error(`La suppression a échoué. Reason: ${failureReason}. Raw response:`, response);
                let errorMessage = "La suppression des photos a échoué.";
                if (response && response.message) { errorMessage += ` Message du serveur : ${response.message}`; }
                else { errorMessage += ` ${failureReason}`; }
                alert(errorMessage); // Afficher l'erreur à l'utilisateur
            }

        } catch (error) { // Erreur réseau ou technique pendant l'appel _request
            console.error("Erreur lors du processus de suppression:", error);
            alert("Erreur réseau ou technique lors du processus de suppression: " + error.message);
        } finally {
            // S'assurer que la modale se ferme et que le bouton est réactivé
            closeDeleteModal(); // Appel helper fermeture
            if (modalConfirmBtn) {
                 modalConfirmBtn.disabled = false;
                 // modalConfirmBtn.textContent = "Supprimer"; // Reset text
            }
        }
    } // --- FIN de executeDelete ---

    // --- Écouteur sur le bouton Gérer/Annuler ---
    boutonModeSelection.addEventListener('click', function() {
        modeSelectionActif = !modeSelectionActif;
        console.log("Mode sélection photos :", modeSelectionActif);
        if (modeSelectionActif) {
            boutonModeSelection.textContent = "Annuler";
            conteneurPhotos.classList.add('selection-active');
            updateDeleteButtonVisibility(); // Cache si 0 sélection
        } else {
            // Sortir du mode sélection
            boutonModeSelection.textContent = "Sélectionner les photos";
            conteneurPhotos.classList.remove('selection-active');
            console.log("Annulation sélection : Désélection de toutes les photos.");
            photosSelectionneesIds = []; // Vider le tableau
            // Retirer la classe visuelle
            if (photoListContainer) {
                photoListContainer.querySelectorAll('.is-photo-selected').forEach(photoEl => {
                    photoEl.classList.remove('is-photo-selected');
                });
            }
            updateDeleteButtonVisibility(); // Doit cacher le bouton
        }
    });
    console.log("SETUP: Écouteur ajouté au bouton mode sélection.");

    // --- Écouteur sur le Conteneur des Photos (pour sélection individuelle) ---
    conteneurPhotos.addEventListener('click', function(event) {
        if (!modeSelectionActif) return;
        const clickedPhotoElement = event.target.closest('[data-photo-path]');
        if (!clickedPhotoElement) return;
        const photoPath = clickedPhotoElement.getAttribute('data-photo-path');
        if (!photoPath) return;

        // Gérer la classe visuelle
        clickedPhotoElement.classList.toggle('is-photo-selected');
        const isNowSelected = clickedPhotoElement.classList.contains('is-photo-selected');
        console.log(`Photo [path: ${photoPath}] sélectionnée: ${isNowSelected}`);

        // Mettre à jour le tableau des IDs sélectionnés
        const indexInSelection = photosSelectionneesIds.indexOf(photoPath);
        if (isNowSelected && indexInSelection === -1) {
            photosSelectionneesIds.push(photoPath);
            console.log(`   -> Photo ajoutée au tableau: ${photoPath}`);
        } else if (!isNowSelected && indexInSelection > -1) {
            photosSelectionneesIds.splice(indexInSelection, 1);
            console.log(`   -> Photo retirée du tableau: ${photoPath}`);
        }
        console.log("Photos sélectionnées (paths):", photosSelectionneesIds);
        // Mettre à jour la visibilité du bouton Supprimer
        updateDeleteButtonVisibility();
    });
    console.log("SETUP: Écouteur ajouté au conteneur de photos.");

    // --- Écouteur MODIFIÉ sur le bouton "Supprimer la sélection" (Ouvre la modale) ---
    if (boutonSupprimerSelection) {
        boutonSupprimerSelection.addEventListener('click', function() {
            // Vérifications initiales
            if (photosSelectionneesIds.length === 0) {
                console.warn("Clic sur Supprimer, aucune photo sélectionnée.");
                return;
            }
            if (currentSelectedRoomId === null) {
                console.error("ID de la room courante inconnu.");
                alert("Erreur : Impossible d'identifier la room actuelle.");
                return;
            }

            // Récupérer les éléments de la modale
            const modalElement = document.querySelector('[fs-modal-element="delete-confirm"]');
            const thumbnailElement = modalElement?.querySelector('[data-modal-element="photo-thumbnail"]');
            const badgeElement = modalElement?.querySelector('[data-modal-element="photo-badge"]');
            const textElement = modalElement?.querySelector('[data-modal-element="confirm-text"]');

            // Vérifier si les éléments de la modale existent
            if (!modalElement || !thumbnailElement || !badgeElement || !textElement) {
                console.error("Éléments de la modale de confirmation introuvables ! Vérifiez les attributs.");
                // Fallback vers l'alerte standard
                const fallbackConfirm = window.confirm(`MODALE INTROUVABLE - Voulez-vous supprimer ${photosSelectionneesIds.length} photo(s) ?`);
                if (fallbackConfirm) {
                    executeDelete(); // Appel direct si la modale est cassée
                }
                return;
            }

            // Préparer le contenu dynamique pour la modale
            const count = photosSelectionneesIds.length;
            const firstPhotoPath = photosSelectionneesIds[0];
            let firstPhotoUrl = ''; // Laissez vide ou mettez une URL par défaut

            // Trouver l'URL de la miniature depuis le DOM
            const firstPhotoDOMElement = conteneurPhotos.querySelector(`[data-photo-path="${firstPhotoPath}"]`);
            const imgInside = firstPhotoDOMElement?.querySelector('img.photo-item-image'); // Cible l'image spécifique
            if (imgInside && imgInside.src) {
                firstPhotoUrl = imgInside.src;
            } else {
                console.warn("Impossible de trouver l'URL src pour la première photo sélectionnée:", firstPhotoPath);
                // Vous pouvez définir une image placeholder ici si l'URL n'est pas trouvée
                // firstPhotoUrl = 'URL_PLACEHOLDER.jpg';
            }

            // Mettre à jour les éléments de la modale
            thumbnailElement.src = firstPhotoUrl;
            thumbnailElement.alt = `Aperçu de la première photo sélectionnée (${count} au total)`; // Pour l'accessibilité

            // Gérer le badge compteur
            if (count > 1) {
                badgeElement.textContent = `+${count - 1}`;
                // Assurez-vous que le style display correspond à ce que vous voulez (flex, block, inline-block...)
                badgeElement.style.display = 'flex'; // Ou autre, selon votre CSS pour le badge
            } else {
                badgeElement.style.display = 'none'; // Cacher s'il n'y a qu'une seule photo
            }

            // Mettre à jour le texte de confirmation
            // Optionnel : récupérer le nom de la pièce si vous l'avez stocké quelque part
            // let roomName = "cette pièce"; // Récupérer le nom si possible
            textElement.textContent = `Voulez-vous supprimer ${count} photo${count > 1 ? 's' : ''} ? Cette action est irréversible.`;

            // Ouvrir la modale
            openDeleteModal();

        }); // --- FIN écouteur boutonSupprimerSelection ---
      
        console.log("SETUP: Écouteur MODIFIÉ ajouté au bouton supprimer sélection.");
    }

    // --- NOUVEAUX Écouteurs pour les boutons CONFIRMER/ANNULER de la modale ---
    const modalConfirmBtn = document.getElementById('modal-confirm-delete-button');
    const modalCancelBtn = document.getElementById('modal-cancel-delete-button'); // Si bouton Annuler SANS fs-modal-element=close

    if (modalConfirmBtn) {
        // S'assurer qu'on n'ajoute pas l'écouteur plusieurs fois si setupPhotoSelectionMode est appelé plusieurs fois
        if (!modalConfirmBtn.listenerAdded) {
             modalConfirmBtn.addEventListener('click', executeDelete); // Appelle la fonction principale de suppression
             modalConfirmBtn.listenerAdded = true; // Marqueur pour éviter duplicata
         }
    } else {
        console.warn("Bouton de confirmation de la modale (#modal-confirm-delete-button) introuvable.");
    }

    // Optionnel : Si le bouton Annuler n'a pas l'attribut fs-modal-element=close
    if (modalCancelBtn) {
         if (!modalCancelBtn.listenerAdded) {
             modalCancelBtn.addEventListener('click', closeDeleteModal); // Appelle juste la fermeture
             modalCancelBtn.listenerAdded = true;
         }
    }

   // --- NOUVELLES Fonctions Helper pour Ouvrir/Fermer la modale (MODIFIÉES pour être async) ---
 // --- Fonctions Helper pour Ouvrir/Fermer la modale (REVENIR à la version simulation clic) ---

 function openDeleteModal() {
     console.log("Attempting to open modal via hidden trigger...");
     // Trouve le bouton déclencheur caché par son ID
     const hiddenTrigger = document.getElementById('hidden-delete-modal-trigger');

     if (hiddenTrigger) {
         console.log("Hidden trigger found. Simulating click...");
         hiddenTrigger.click(); // Simule un clic sur le bouton caché
         console.log("Click simulated.");
     } else {
         console.error("Impossible d'ouvrir la modale : Déclencheur caché #hidden-delete-modal-trigger introuvable !");
         alert("Erreur: Impossible d'afficher la fenêtre de confirmation (trigger manquant).");
     }
 }

 function closeDeleteModal() {
     // Cherche un élément (bouton X, Annuler...) qui a l'attribut
     // configuré selon la méthode de l'utilisateur pour fermer cette instance.
     console.log("Attempting to close modal by finding element [fs-modal-element='close']...");
     const closeElement = document.querySelector('[fs-modal-element="close"]'); // Utilise VOTRE convention

     if (closeElement) {
          console.log("Close element found, simulating click...");
          try {
               closeElement.click(); // Simule un clic sur le bouton/lien de fermeture
               console.log("Close click simulated.");
          } catch(e) {
               console.error("Erreur lors de la simulation du clic de fermeture:", e);
          }
     } else {
         // Si aucun élément avec fs-modal-element="close" n'est trouvé,
         // la fermeture doit se faire via une interaction utilisateur sur un tel élément.
         // Le finally dans executeDelete aura au moins essayé.
         console.warn("Aucun élément de fermeture [fs-modal-element='close'] trouvé pour fermeture programmatique.");
     }
 }

    // Appel initial pour cacher le bouton Supprimer si rien n'est sélectionné
    updateDeleteButtonVisibility();

} // --- FIN de setupPhotoSelectionMode ---
  
  
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

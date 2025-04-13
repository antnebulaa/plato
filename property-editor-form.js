
  // ==========================================
  // == Script Xano Unifié (Formulaires + Données) ==
  // ==========================================
  // Date: 2025-03-30
  
  let xanoClientInstance = null;

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
  xanoClientInstance = new XanoClient({
    apiGroupBaseUrl: 'https://xwxl-obyg-b3e3.p7.xano.io/api:qom0bt4V',
  });

  // --- Initialisation ---
  const authToken = getCookie('xano_auth_token');
  if (authToken) {
    xanoClientInstance.setAuthToken(authToken);
  }

  initXanoForms(xanoClientInstance); // Initialise tes formulaires existants
  initXanoDataEndpoints(xanoClientInstance); // Charge les données éventuelles

  // --- NOUVEAU : Active la sélection des types de pièces ---
  setupRoomTypeSelection();
  // ------------------------------------------------------

  initXanoLinkHandlers();

  // --- NOUVEAU : Active la sélection des pièces créées ---
  // Appelée ici, en supposant que initXanoDataEndpoints a eu le temps de rendre la liste.
  // Si le rendu est très lent ou asynchrone, il faudrait peut-être l'appeler
  // en réponse à l'événement 'xano:data-loaded' émis par fetchXanoData.
  setupCreatedRoomSelection();
  // -------------------------------------------------------

  console.log("Initialisation UNIFIÉE terminée.");

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
  // Si l'élément a un attribut data-xano-list, c'est une liste
  if (element.hasAttribute('data-xano-list')) {
    // Trouver les données de liste (plus robuste)
    let listData = null;
    const potentialDataSources = [
      data,
      data?.body,
      data?.items,
      data?.body?.items
    ];

    for (const source of potentialDataSources) {
      if (Array.isArray(source)) {
        listData = source;
        break;
      }
      // Si ce n'est pas un tableau, mais un objet, chercher une clé qui contient un tableau
      if (source && typeof source === 'object') {
        for (const key in source) {
          if (Array.isArray(source[key])) {
            listData = source[key];
            // On pourrait vouloir être plus spécifique si plusieurs tableaux existent
            // console.warn(`Multiple arrays found in data source for list, using key: ${key}`);
            break; // Prend le premier tableau trouvé
          }
        }
      }
      if (listData) break; // Sortir de la boucle externe si trouvé
    }

    if (listData) {
      renderListData(listData, element); // Utilise le helper
    } else {
      console.warn('Aucun tableau de données trouvé dans la réponse pour la liste:', data);
      renderListData([], element); // Afficher la liste comme vide
      // Optionnellement, afficher une erreur plus explicite
      // element.textContent = "Erreur : Données de liste non valides ou non trouvées.";
    }
  } else {
    // Sinon, c'est un élément unique (ou un conteneur pour des éléments uniques)
    // Les données peuvent être dans data.body ou data directement
    const sourceData = data?.body ? data.body : data;

    if (sourceData && typeof sourceData === 'object') {
      // Lier les données aux enfants directs ou descendants avec data-xano-bind
      const boundElements = element.querySelectorAll('[data-xano-bind]');
      if (boundElements.length > 0) {
        boundElements.forEach(boundElement => {
          // Ne pas lier si l'élément est DANS un template de liste potentiel à l'intérieur de cet élément
          if (!boundElement.closest('[data-xano-list] [data-xano-bind]')) {
            bindDataToElement(boundElement, sourceData); // Utilise le helper
          }
        });
      } else if (element.hasAttribute('data-xano-bind')) {
        // Si l'élément lui-même a data-xano-bind (cas moins courant pour un conteneur)
        bindDataToElement(element, sourceData);
      }

    } else {
      console.warn("Données pour l'élément unique non trouvées ou non objet:", sourceData);
      // Que faire ici ? Afficher un message ? Laisser l'élément tel quel ?
      // element.textContent = "Données non disponibles.";
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
    dataArray.forEach((item, index) => {
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
function setupCreatedRoomSelection() {
  // Cible le conteneur où renderListData affiche les pièces créées
  // Utilise l'attribut que tu as mis sur le conteneur qui a data-xano-list / data-xano-list-container
  const listContainer = document.querySelector('[data-xano-list-container]') || document
    .querySelector('[data-xano-list]'); // Adapte si nécessaire

  // Cible le formulaire d'upload photo via son attribut data-xano-form
  const photoUploadForm = document.querySelector(
  '[data-xano-form="upload_multiple_photos"]'); // !! Remplace par le VRAI nom de ton endpoint d'upload !!

  // Cible l'input caché POUR L'ID DE LA PIECE dans ce formulaire d'upload
  const roomDbIdInput = photoUploadForm ? photoUploadForm.querySelector(
    '[data-xano-field-name="property_photos_rooms_id"]') :
  null; // !! Vérifie que cet attribut correspond bien à l'input Xano pour l'ID de la pièce !!

  // Vérifications
  if (!listContainer) {
    console.warn("setupCreatedRoomSelection: Conteneur de liste des pièces créées non trouvé.");
    return;
  }
  if (!photoUploadForm) {
    console.warn("setupCreatedRoomSelection: Formulaire d'upload photo non trouvé.");
    return;
  }
  if (!roomDbIdInput) {
    console.error(
      "setupCreatedRoomSelection: Input caché [data-xano-field-name='property_photos_rooms_id'] non trouvé dans le formulaire d'upload !"
      );
    return;
  }

  console.log(
    "setupCreatedRoomSelection: Initialisation écouteur de clics sur la liste des pièces créées.");

  listContainer.addEventListener('click', function (event) {
    console.log("DEBUG: Click event started on listContainer."); // <-- LOG 1
    
    // Trouve l'élément cliqué (ou parent) qui a l'attribut data-action="select-created-room" ET data-room-id
    const selectedElement = event.target.closest(
      '[data-action="select-created-room"][data-room-id]');

      console.log("DEBUG: Clicked element found:", selectedElement); // <-- LOG 2

    if (selectedElement) {
      console.log("DEBUG: Element has required attributes."); // <-- LOG 3
      const roomDbId = selectedElement.getAttribute('data-room-id'); // Récupère l'ID de la pièce
      console.log(`DEBUG: Room ID found: ${roomDbId}`); // <-- LOG 4
      console.log(`setupCreatedRoomSelection: Pièce créée sélectionnée ID = ${roomDbId}`);

      // Met à jour la valeur de l'input caché pour l'upload photo
      if (roomDbIdInput) {
            roomDbIdInput.value = roomDbId;
            console.log("DEBUG: Hidden input value set."); // <-- LOG 5
        } else {
            console.error("DEBUG: roomDbIdInput is null!"); // <-- LOG ERREUR INPUT
        }

      // Gère le feedback visuel (classe 'is-selected')
      listContainer.querySelectorAll('[data-action="select-created-room"][data-room-id]')
        .forEach(el => {
          el.classList.remove('is-selected'); // Adapte le nom de classe CSS si besoin
        });
      selectedElement.classList.add('is-selected');
      console.log("DEBUG: 'is-selected' class managed."); // <-- LOG 6

      // Optionnel : Afficher le formulaire d'upload si caché, etc.
        if (photoUploadForm) {
            photoUploadForm.style.display = '';
            console.log("DEBUG: Photo upload form displayed."); // <-- LOG 7
        } else {
             console.error("DEBUG: photoUploadForm is null!"); // <-- LOG ERREUR FORM
        }

    // --- Vérification et Appel ---
        console.log("DEBUG: About to check xanoClientInstance."); // <-- LOG 8 (Juste avant le point d'erreur probable)
      
     // Vérifie que xanoClientInstance existe avant de l'utiliser
     if (xanoClientInstance) {
    displayPhotosForRoom(roomDbId, xanoClientInstance);
} else {
    console.error("xanoClientInstance n'est pas disponible!");
}
} else {
        console.log("DEBUG: Clicked element does not match selector or missing data-room-id."); // <-- LOG 11 (Si le clic n'est pas sur le bon élément)
    }
     console.log("DEBUG: Click event handler finished."); // <-- LOG 12

      
    }
  });
}

// --- NOUVEAU : Fonction pour afficher les photos d'une pièce ---
async function displayPhotosForRoom(roomId) {
    console.log(`displayPhotosForRoom: Récupération des photos pour Room ID = ${roomId}`);

    
    // Adapte les sélecteurs si tu as utilisé d'autres noms
    const photoListContainer = document.querySelector('[data-element="photo-list-container"]');
    const photoTemplate = document.querySelector('[data-element="photo-item-template"]');
    // Optionnel: élément pour message d'erreur/vide spécifique aux photos
    const photoEmptyState = document.querySelector('[data-element="photo-empty-state"]');

    if (!photoListContainer || !photoTemplate) {
        console.error("displayPhotosForRoom: Conteneur [data-element='photo-list-container'] ou template [data-element='photo-item-template'] non trouvé !");
        return;
    }

    // Préparatifs UI
    photoTemplate.style.display = 'none';
    if (photoEmptyState) photoEmptyState.style.display = 'none';
    photoListContainer.innerHTML = ''; // Vide les anciennes photos
    // Afficher un loader ?
    // const photoLoader = document.querySelector('[data-element="photo-loader"]');
    // if(photoLoader) photoLoader.style.display = 'block';

    // Construire l'URL de l'endpoint Xano
    const endpoint = `room/${roomId}/photos`; // Utilise l'URL définie dans Xano

    try {
       // Utiliser le paramètre client passé à la fonction
        const photos = await client.get(endpoint); // Utiliser client, pas Client
      
        // if(photoLoader) photoLoader.style.display = 'none'; // Cacher le loader

        console.log(`displayPhotosForRoom: Photos reçues pour Room ID ${roomId}:`, photos);

        // Vérifier si la réponse est bien un tableau (Xano retourne directement la liste normalement)
        if (Array.isArray(photos) && photos.length > 0) {
            photos.forEach(photo => {
                const newItem = photoTemplate.cloneNode(true);
                newItem.style.display = ''; // Afficher

                // Utiliser bindDataToElement (qui existe déjà dans ton script)
                // pour peupler les éléments à l'intérieur du clone.
                // Important : Assure-toi que les clés ('image.url', 'photo_description')
                // correspondent bien à la structure des objets 'photo' retournés par Xano.
                const boundElements = newItem.querySelectorAll('[data-xano-bind]');
                boundElements.forEach(boundElement => {
                    bindDataToElement(boundElement, photo);
                });
                 // Si le clone lui-même a data-xano-bind (moins probable pour une photo)
                 if (newItem.hasAttribute('data-xano-bind')){
                     bindDataToElement(newItem, photo);
                 }

                 // Optionnel : Ajouter un data-attribut avec l'ID de la photo si besoin pour d'autres actions
                 // newItem.setAttribute('data-photo-id', photo.id);

                photoListContainer.appendChild(newItem);
            });
        } else {
            console.log("displayPhotosForRoom: Aucune photo trouvée pour cette pièce.");
            if (photoEmptyState) {
                photoEmptyState.textContent = "Aucune photo dans cet album.";
                photoEmptyState.style.display = '';
            }
        }

    } catch (error) {
        console.error(`displayPhotosForRoom: Erreur lors de la récupération/affichage des photos pour Room ID ${roomId}:`, error);
        // if(photoLoader) photoLoader.style.display = 'none';
        if (photoEmptyState) {
            photoEmptyState.textContent = `Erreur: ${error.message}`;
            photoEmptyState.style.display = '';
        }
    }
}
// --- FIN NOUVELLE FONCTION ---
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


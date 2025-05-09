
<!-- FORM -->
    <!-- Script principal qui gère les attributs personnalisés -->

// ==========================================
// == Script Xano Unifié (Formulaires + Données) ==
// ==========================================
// Date: 2025-03-30

document.addEventListener('DOMContentLoaded', function () {
    // --- Configuration ---
    const xanoClient = new XanoClient({
        // !!! IMPORTANT: Remplacez par VOTRE URL de base Xano !!!
        apiGroupBaseUrl: 'https://xwxl-obyg-b3e3.p7.xano.io/api:qom0bt4V',
    }); 

    // --- Initialisation ---
    // 1. Gérer l'authentification (si cookie présent)
    const authToken = getCookie('xano_auth_token');
    if (authToken) {
        xanoClient.setAuthToken(authToken);
    }

     initXanoForms(xanoClient);

    // --- Initialisation des Données (Liste des Annonces) ---
    const listingElement = document.querySelector('[data-xano-endpoint="property/getall"]');
    if (listingElement) {
        console.log("DOM LOADED: Appel initial pour la liste."); // LOG 1
        // Chargement initial sans filtres (ou avec filtres par défaut si nécessaire)
        fetchFilteredListings(xanoClient, listingElement, {}); // {} = pas de filtres initiaux
    } else {
        console.warn("DOM LOADED: listingElement pour 'property/getall' NON trouvé."); // LOG 2
    }

    initXanoLinkHandlers(); // Après le premier chargement potentiel

    // --- Gestion des Filtres ---
    const applyFiltersButton = document.getElementById('apply-filters-button');
    const filtersForm = document.getElementById('filters-form'); // Conteneur des filtres

    // LOG 3: Vérifier si les éléments sont trouvés
    console.log("DOM LOADED: applyFiltersButton trouvé?", applyFiltersButton);
    console.log("DOM LOADED: filtersForm trouvé?", filtersForm);
    console.log("DOM LOADED: listingElement (pour filtres) trouvé?", listingElement);

    if (applyFiltersButton && filtersForm && listingElement) {
        applyFiltersButton.addEventListener('click', function() {
            console.log("BOUTON FILTRE CLIQUE !"); // LOG 4
            const filterParams = collectFilterValues(filtersForm);
            console.log("PARAMÈTRES COLLECTÉS APRÈS CLIC:", filterParams); // LOG 5
            fetchFilteredListings(xanoClient, listingElement, filterParams);
        });
    } else {
         console.warn("AVERTISSEMENT: L'écouteur d'événement pour le filtre N'A PAS été attaché. Vérifiez les éléments ci-dessus."); // LOG 6
         if (!applyFiltersButton) console.warn("Bouton 'apply-filters-button' non trouvé.");
         if (!filtersForm) console.warn("Formulaire 'filters-form' non trouvé.");
    }

}); // Fin de DOMContentLoaded

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
            // Filtrer les clés avec des valeurs null/undefined/vides avant de construire les query params
            const cleanParams = {};
            for (const key in paramsOrBody) {
                if (paramsOrBody[key] !== null && paramsOrBody[key] !== undefined && paramsOrBody[key] !== '') {
                     cleanParams[key] = paramsOrBody[key];
                }
            }
            const queryParams = new URLSearchParams(cleanParams).toString();
            if (queryParams) {
                finalUrl = `${url}?${queryParams}`;
            }
        } else if (['POST', 'PUT', 'PATCH'].includes(method) && paramsOrBody) {
            if (isFormData) {
                options.body = paramsOrBody;
            } else {
                options.headers['Content-Type'] = 'application/json';
                options.body = JSON.stringify(paramsOrBody);
            }
        }
        // DELETE n'a généralement pas de body, mais peut en avoir certains cas (rare)
        // Si paramsOrBody est fourni pour DELETE et n'est pas FormData, on pourrait envisager de le JSON.stringify aussi.

         try {
            const response = await fetch(finalUrl, options);
            if (response.status === 204 || response.headers.get('content-length') === '0') {
                if (!response.ok) {
                   throw new Error(`Erreur HTTP ${response.status}`);
                }
                return null;
            }
            const responseData = await response.json();
            if (!response.ok) {
                const message = responseData.message || `Erreur HTTP ${response.status}`;
                throw new Error(message);
            }
            return responseData;
        } catch (error) {
            console.error(`Erreur lors de l'appel ${method} ${endpoint}:`, error);
            throw error;
        }
    }

    async get(endpoint, params = null) { return this._request('GET', endpoint, params); }
     async post(endpoint, body = null, isFormData = false) { return this._request('POST', endpoint, body, isFormData); }
     async put(endpoint, body = null, isFormData = false) { return this._request('PUT', endpoint, body, isFormData); }
     async patch(endpoint, body = null, isFormData = false) { return this._request('PATCH', endpoint, body, isFormData); }
     async delete(endpoint, params = null) {
         let finalEndpoint = endpoint;
         if (params) {
             const queryParams = new URLSearchParams(params).toString();
             if (queryParams) { finalEndpoint = `${endpoint}?${queryParams}`; }
         }
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
            const loadingElement = form.querySelector('[data-xano-form-loading]') || document.querySelector(form.getAttribute('data-xano-form-loading-selector')); // Supporte l'attribut direct ou un sélecteur
            const errorElement = form.querySelector('[data-xano-form-error]') || document.querySelector(form.getAttribute('data-xano-form-error-selector'));
            const submitButton = form.querySelector('button[type="submit"], input[type="submit"]');

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
                         console.warn("Utilisation de data-xano-form-id-param avec POST. L'ID sera ajouté à l'URL. Assurez-vous que c'est le comportement attendu.")
                         finalEndpoint = `${endpoint}/${idValue}`;
                    }
                }

                // Collecter les données du formulaire, y compris les fichiers
                const formData = collectFormDataWithFiles(form); // Utilise le helper

                // Déterminer la méthode client à appeler
                let responseData;
                switch (method) {
                    case 'POST':
                        responseData = await xanoClient.post(finalEndpoint, formData, true); // true = isFormData
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
        const loadingIndicator = element.querySelector('[data-xano-loading]') || document.querySelector(element.getAttribute('data-xano-loading-selector'));
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
    document.addEventListener('xano:data-loaded', function(event) {
        const loadedElement = event.detail.element; // Élément qui a chargé les données
        const data = event.detail.data; // Données chargées

        // Cibler les liens DANS l'élément qui vient de charger, ou globalement s'ils ne sont pas dans une liste
        const potentialLinks = loadedElement.querySelectorAll('[data-xano-link-to]');

        potentialLinks.forEach(linkElement => {
             // Ne traiter que si ce n'est PAS un lien déjà géré dans renderListData
            if (!linkElement.closest('[data-xano-list-item]')) {
                const targetPage = linkElement.getAttribute('data-xano-link-to');
                const idField = linkElement.getAttribute('data-xano-link-param-id') || 'id'; // Champ ID dans les données
                 const idParamName = linkElement.getAttribute('data-xano-link-url-param') || 'id'; // Nom du param dans l'URL cible

                // Essayer de trouver l'ID dans les données chargées (peut être un objet unique)
                // On prend data.body si c'est la structure Xano standard, sinon data directement.
                const sourceData = data?.body ? data.body : data;
                let linkTarget = targetPage;

                 if (sourceData && typeof sourceData === 'object' && sourceData[idField]) {
                    linkTarget = `${targetPage}?${idParamName}=${encodeURIComponent(sourceData[idField])}`;
                } else if (linkElement.hasAttribute('data-xano-data-id')) {
                     // Fallback si l'ID a été mis via data-xano-data-id par bindDataToElement
                     linkTarget = `${targetPage}?${idParamName}=${encodeURIComponent(linkElement.getAttribute('data-xano-data-id'))}`;
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
    document.addEventListener('click', function(event) {
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
// == Nouvelle Fonction: Collecter Filtres == // OU == Votre Fonction Collecter Filtres existante ==
// ==========================================
function collectFilterValues(formElement) { // formElement est le conteneur de vos filtres
    const params = {};
    console.log("collectFilterValues APPELÉ avec formElement:", formElement); // LOG 7 (comme suggéré)
    if (!formElement) {
        console.error("collectFilterValues: formElement est null ! Impossible de trouver les filtres.");
        return params;
    }

    // Sélectionne TOUS les inputs, selects, textareas DANS le formElement qui ont data-filter-key
    const filterElements = formElement.querySelectorAll('input[data-filter-key], select[data-filter-key], textarea[data-filter-key]');
    console.log("collectFilterValues: Nombre d'éléments de filtre trouvés au total:", filterElements.length); // LOG 8 (modifié pour tous les filtres)

    filterElements.forEach(el => {
        const key = el.getAttribute('data-filter-key');
        // LOG 9 (comme suggéré)
        console.log("collectFilterValues: Traitement de l'élément:", el, "avec data-filter-key:", key, "et valeur brute:", el.value);
        if (!key) return; // Sécurité

        let value = null;

        if (el.type === 'checkbox') {
        if (el.checked) {
            valueForCurrentElement = el.value; 
            
            if (!valueForCurrentElement || valueForCurrentElement === 'on') { 
                console.warn(`Checkbox pour la clé "${key}" ("${el.id || ''}") est cochée mais n'a pas de valeur définie exploitable. Ignorée.`);
                return; // Passe à l'itération suivante de la boucle filterElements.forEach
            }

            // MAINTENANT, on gère l'ajout à params[key] pour s'assurer que c'est une liste
            if (!params[key]) { // Si params[key] n'existe pas encore pour cette clé
                params[key] = []; // Initialise TOUJOURS params[key] comme une liste vide
            }
            // On vérifie que params[key] est bien un tableau (au cas où, même si on vient de l'initialiser)
            if (Array.isArray(params[key])) {
                params[key].push(valueForCurrentElement); // Ajoute la valeur de la checkbox actuelle à la liste
            } else {
                // Ce cas ne devrait plus arriver si on initialise toujours comme tableau,
                // mais par sécurité, on pourrait le logger ou le gérer.
                // Pour l'instant, on suppose qu'il sera toujours un tableau grâce à l'initialisation.
                console.warn(`Problème: params[${key}] devrait être un tableau mais ne l'est pas.`);
            }
            // Une fois la valeur de la checkbox traitée et ajoutée à la liste params[key],
            // on passe à l'élément suivant. On ne veut pas que la logique `params[key] = value`
            // à la fin de la boucle forEach écrase notre tableau.
            return; // FIN DU TRAITEMENT POUR CETTE CHECKBOX
        } else {
            // Si la checkbox n'est pas cochée, on ne fait rien pour cette clé et on passe à la suite.
            return; 
        }
        } else if (el.type === 'radio') {
            if (el.checked) {
                value = el.value;
            } else {
                 return; // Ignore les radios non sélectionnés
            }
        } else if (el.tagName === 'SELECT') {
             if (el.value !== '') { // Ignorer si la valeur est vide (ex: l'option "Indifférent")
               value = el.value;
             } else {
                 return; // Ignorer la sélection vide
             }
        } else { // Inputs (text, number, date, etc.)
             // Pour les champs texte, on peut vouloir trimmer les espaces
             const trimmedValue = el.value.trim();
             if (trimmedValue !== '') { // Ignorer les champs vides après trim
                // Pour les nombres, on peut vouloir les convertir en type numérique
                // Si l'input Xano attend un nombre.
                // Pour l'instant, on envoie comme chaîne, Xano est souvent flexible.
                // Si Xano se plaint du type, on pourra convertir ici avec parseFloat() ou parseInt().
                value = trimmedValue;
             } else {
                return; // Ignorer les champs vides
             }
        }
        // ---- FIN DE VOTRE LOGIQUE ORIGINALE ----

        if (value !== null && value !== undefined) {
            params[key] = value;
            // LOG 10 (comme suggéré, mais adapté pour une valeur générique)
            console.log(`collectFilterValues: Ajout de { "${key}": "${value}" } aux paramètres.`);
        }
    });

    console.log("Filtres collectés (potentiellement avec listes):", params);
    return params;
}


// ==========================================
// == Nouvelle Fonction: Récupérer Liste Filtrée ==
// ==========================================
async function fetchFilteredListings(client, targetElement, params) {
    const endpoint = targetElement.getAttribute('data-xano-endpoint');
    const method = 'GET'; // C'est presque toujours GET pour récupérer une liste filtrée
    const loadingIndicator = targetElement.querySelector('[data-xano-loading]') || document.querySelector(targetElement.getAttribute('data-xano-loading-selector'));
    console.log(`WorkspaceFilteredListings APPELÉ pour endpoint: ${endpoint}. Params ENVOYÉS À XANO:`, JSON.stringify(params)); // LOG 11

    // Afficher l'indicateur de chargement
    if (loadingIndicator) loadingIndicator.style.display = 'block';
    // Optionnel: Désactiver le bouton pendant le chargement
    const applyButton = document.getElementById('apply-filters-button');
    if (applyButton) applyButton.disabled = true;

    try {
        // Appel API avec les paramètres de filtre (la méthode GET de XanoClient gère l'ajout à l'URL)
        const responseData = await client.get(endpoint, params);
        console.log(`WorkspaceFilteredListings RÉPONSE DE XANO pour ${endpoint} avec params ${JSON.stringify(params)}:`, responseData); // LOG 12

        // Cacher l'indicateur de chargement AVANT le rendu
        if (loadingIndicator) loadingIndicator.style.display = 'none';

        // Utiliser votre fonction de rendu existante
        renderData(responseData, targetElement);

        // Déclencher l'événement de succès (si nécessaire pour d'autres scripts)
        const successEvent = new CustomEvent('xano:data-loaded', {
             detail: { data: responseData, element: targetElement, filters: params },
             bubbles: true
         });
        targetElement.dispatchEvent(successEvent);

    } catch (error) {
        console.error(`Erreur DANS fetchFilteredListings pour ${endpoint} avec params ${JSON.stringify(params)}:`, error); // LOG 13
        if (loadingIndicator) loadingIndicator.style.display = 'none'; // Cacher aussi en cas d'erreur

        // Afficher l'erreur dans l'élément cible (utilise votre logique existante si possible)
        const errorDisplay = targetElement.querySelector('[data-xano-error]') || targetElement.querySelector('.xano-empty-message') || targetElement; // Cherche un sous-élément ou utilise l'élément principal/message vide
        if (errorDisplay) {
            errorDisplay.textContent = `Erreur: ${error.message || 'Impossible de charger les données.'}`;
            errorDisplay.style.color = 'red'; // Exemple de style d'erreur
            // Assurez-vous de vider la liste précédente si une erreur survient après un succès
             const listContainer = targetElement.querySelector('[data-xano-list-container]') || targetElement;
             renderListData([], listContainer); // Affiche une liste vide
        }

        const errorEvent = new CustomEvent('xano:data-error', {
            detail: { error: error, element: targetElement, filters: params },
            bubbles: true
        });
        targetElement.dispatchEvent(errorEvent);
    } finally {
         // Réactiver le bouton
         if (applyButton) applyButton.disabled = false;
    }
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
                 console.warn(`Utilisation de ${method} avec data-xano-endpoint. Est-ce intentionnel pour récupérer des données ?`);
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
        const errorDisplay = targetElement.querySelector('[data-xano-error]') || targetElement; // Cherche un sous-élément ou utilise l'élément principal
        if (errorDisplay) {
            errorDisplay.textContent = `Erreur: ${error.message || 'Impossible de charger les données.'}`;
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
    console.log("renderData APPELÉ. Données reçues:", data, "Élément cible:", element); // LOG 14
    // Si l'élément a un attribut data-xano-list, c'est une liste
    if (element.hasAttribute('data-xano-list')) {
        // Trouver les données de liste (plus robuste)
        let listData = null;

         // ---- DEBUT MODIFICATION ----
        if (data && Array.isArray(data.items)) { // Cible directement data.items
            listData = data.items;
        } else if (Array.isArray(data)) { // Au cas où la réponse serait directement un tableau
            listData = data;
        }
        // ---- FIN MODIFICATION ----
        // L'ancienne logique avec potentialDataSources peut être commentée ou supprimée pour l'instant.

        console.log("renderData: listData déterminé (après modif):", listData); // LOG 15 (garder)
        if (listData && Array.isArray(listData)) {
            renderListData(listData, element);
        
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

         if (sourceData && typeof sourceData === 'object'){
              // Lier les données aux enfants directs ou descendants avec data-xano-bind
             const boundElements = element.querySelectorAll('[data-xano-bind]');
             if(boundElements.length > 0){
                boundElements.forEach(boundElement => {
                    // Ne pas lier si l'élément est DANS un template de liste potentiel à l'intérieur de cet élément
                    if (!boundElement.closest('[data-xano-list] [data-xano-bind]')) {
                        bindDataToElement(boundElement, sourceData); // Utilise le helper
                    }
                });
             } else if (element.hasAttribute('data-xano-bind')){
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
         console.error("L'attribut data-xano-list doit contenir un sélecteur CSS pour le template.", listContainerElement);
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
    const container = listContainerElement.querySelector('[data-xano-list-container]') || listContainerElement;

     // Vider le conteneur, en préservant le template s'il est à l'intérieur
     // Et en préservant les éléments qui ne sont PAS des data-xano-list-item générés précédemment
     let currentChild = container.firstChild;
     while (currentChild) { /* ... logique de vidage ... */ 
         const nextChild = currentChild.nextSibling;
         // Ne supprimer que les éléments générés précédemment OU si le conteneur est l'élément principal
         // Et s'assurer de ne pas supprimer le template lui-même
         if (currentChild !== templateElement && currentChild.nodeType === Node.ELEMENT_NODE && currentChild.hasAttribute('data-xano-list-item')) {
             container.removeChild(currentChild);
         } else if (container === listContainerElement && currentChild !== templateElement && currentChild.nodeType === Node.ELEMENT_NODE) {
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
            const clone = templateElement.tagName === 'TEMPLATE'
                ? templateElement.content.cloneNode(true).firstElementChild // Prend le premier élément du fragment cloné
                : templateElement.cloneNode(true);

            if (!clone) {
                console.error("Échec du clonage du template. Vérifiez la structure du template.", templateElement);
                return; // Passer à l'item suivant
            }

            // Rendre visible et marquer l'élément cloné
            clone.style.display = ''; // Enlever le display:none potentiel
            clone.removeAttribute('aria-hidden');
            clone.setAttribute('data-xano-list-item', ''); // Marqueur pour l'item généré
            clone.setAttribute('data-xano-item-index', index.toString()); // Index (utile pour debug ou style)

            // Lier les données aux sous-éléments [data-xano-bind]
            const boundElements = clone.querySelectorAll('[data-xano-bind]');
            boundElements.forEach(boundElement => {
                bindDataToElement(boundElement, item); // Utilise le helper
            });
            // Si le clone lui-même a data-xano-bind (cas d'un template simple comme juste <li>)
            if (clone.hasAttribute('data-xano-bind')){
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
             if (clone.hasAttribute('data-xano-link-to')){
                 const targetPage = clone.getAttribute('data-xano-link-to');
                 const idField = clone.getAttribute('data-xano-link-param-id') || 'id';
                 const idParamName = clone.getAttribute('data-xano-link-url-param') || 'id';
                 let linkTarget = targetPage;
                 const idValue = item[idField];
                 if (idValue !== undefined && idValue !== null) {
                     linkTarget = `${targetPage}?${idParamName}=${encodeURIComponent(idValue)}`;
                 }
                 if (clone.tagName === 'A') { clone.href = linkTarget; }
                 else { clone.setAttribute('data-xano-link-target', linkTarget); clone.style.cursor = 'pointer'; }
             }


            // Ajouter le clone au conteneur
            container.appendChild(clone);
        });


        // --- NOUVELLE SECTION : INITIALISATION DES SLIDERS SWIPER ---
        // Après que tous les clones ont été ajoutés au DOM et peuplés
        const slidersToInitialize = container.querySelectorAll('.swiper[data-slider-init="true"]');
        console.log(`renderListData: Trouvé ${slidersToInitialize.length} sliders à initialiser.`); // Log de débogage
        
        slidersToInitialize.forEach((swiperEl, sliderIndex) => {
        console.log(`renderListData: Initialisation du slider #${sliderIndex} pour l'élément:`, swiperEl); // Log de débogage

            // Compter les slides réellement présents dans ce conteneur swiper spécifique
       const slides = swiperEl.querySelectorAll('.swiper-slide');
       const enableLoop = slides.length > 1; // Activer la boucle seulement s'il y a plus d'une image
       console.log(`renderListData: Slider #${sliderIndex} a ${slides.length} slides. Loop activée: ${enableLoop}`); // Log de débogage

            // Donner un ID unique au conteneur du swiper peut être utile si vous avez des styles spécifiques
            // ou si vous voulez y accéder plus tard, mais pas indispensable pour l'init Swiper
            // swiperEl.id = `swiper-${listContainerElement.id}-item-${sliderIndex}`; 
 // --- AJOUT D'UN DÉLAI ---
    // On attend un tout petit peu que le DOM se stabilise (surtout dans une grille)
    setTimeout(() => {
            console.log(`renderListData: Exécution de l'initialisation (avec délai) pour Slider #${sliderIndex}.`);
            try { 
                const slides = swiperEl.querySelectorAll('.swiper-slide');
                const enableLoop = slides.length > 1; 
                console.log(`renderListData: Slider #${sliderIndex} a ${slides.length} slides. Loop activée: ${enableLoop}`);

                const swiperInstance = new Swiper(swiperEl, { 
                    // Options SwiperJS
                    loop: enableLoop, 
                    spaceBetween: 10, 
                    slidesPerView: 1, // Assurez-vous que c'est bien 1 par défaut
                    pagination: {
                        el: swiperEl.querySelector('.swiper-pagination'),
                        clickable: true,
                        dynamicBullets: true, 
                        dynamicMainBullets: 5, 
                    },
                    navigation: {
                        nextEl: swiperEl.querySelector('.swiper-button-next'),
                        prevEl: swiperEl.querySelector('.swiper-button-prev'),
                    },
                    observer: true,         // Surveille les changements du slider lui-même
                    observeParents: true,   // Surveille les changements des parents (important pour Grid/Flex)
                    observeSlideChildren: true, // Surveille changements dans les slides
                    updateOnWindowResize: true, // Se met à jour si la fenêtre change de taille
                });

                // Forcer une mise à jour immédiatement après l'initialisation Swiper
                // Cela peut l'aider à prendre les dimensions correctes une fois initialisé
                swiperInstance.update(); 
                console.log(`renderListData: Slider #${sliderIndex} initialisé et update() appelé.`);
        
        swiperEl.removeAttribute('data-slider-init'); // Important: Enlever l'attribut après initialisation réussie
    } catch (swiperError) {
        console.error(`Erreur lors de l'initialisation de Swiper pour le slider #${sliderIndex}:`, swiperEl, swiperError);
    }
                }, 300); // Essayez avec 250ms ou 300ms ou même 500ms si nécessaire
    }); // Fin de requestAnimationFrame
});
// --- FIN SECTION D'INITIALISATION SWIPER AMÉLIORÉE ---
        
    } else {
        // Afficher un message si aucune donnée (amélioration)
        const emptyMessage = listContainerElement.getAttribute('data-xano-empty-message') || "Aucune donnée à afficher.";
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

    // Gestion de clés imbriquées simples (ex: user.name ou _property_lease_of_property.0.loyer)
    let value = data;
    const keys = dataKey.split('.');
    for (const keyPart of keys) { // Renommé 'key' en 'keyPart' pour éviter conflit avec 'key' de la boucle précédente
        if (value && typeof value === 'object' && keyPart in value) {
            value = value[keyPart];
        } else {
            // Clé non trouvée ou donnée intermédiaire non objet
            // console.warn(`Clé "${dataKey}" (partie "${keyPart}") non trouvée ou chemin invalide dans:`, data); // Peut être verbeux
            value = undefined; // Marquer comme non trouvé
            break;
        }
    }

    // Si la valeur finale est null ou undefined, on peut vouloir afficher une valeur par défaut ou rien
     const displayValue = value ?? ''; // Affiche une chaîne vide si null/undefined

    // Appliquer la valeur à l'élément
    switch (element.tagName.toLowerCase()) {
        case 'img':
            // Cette condition est pour s'assurer qu'on ne met pas à jour le src des <img> DANS le slider
            // si l'élément <img> lui-même avait un data-xano-bind (ce qui n'est pas le cas ici, on le crée dynamiquement)
            if (!element.closest('.swiper-slide')) { 
                element.src = displayValue;
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

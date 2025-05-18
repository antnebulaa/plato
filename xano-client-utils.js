// xano-client-utils.js

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
            headers: {}
        };

        if (this.authToken) {
            options.headers['Authorization'] = `Bearer ${this.authToken}`;
        }

        let finalUrl = url;

        if (method === 'GET' && paramsOrBody) {
            const queryParams = new URLSearchParams(paramsOrBody).toString();
            if (queryParams) {
                finalUrl = `${url}?${queryParams}`;
            }
        } else if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && paramsOrBody) {
            if (isFormData) {
                options.body = paramsOrBody; // FormData est envoyé tel quel
            } else {
                options.headers['Content-Type'] = 'application/json';
                options.body = JSON.stringify(paramsOrBody);
            }
        }

        try {
            const response = await fetch(finalUrl, options);

            // Gérer les réponses sans contenu (ex: 204 No Content pour un DELETE réussi)
            if (response.status === 204 || response.headers.get('content-length') === '0') {
                if (!response.ok) {
                    // Même sans contenu, un statut non-ok est une erreur
                    throw new Error(`Erreur HTTP ${response.status}`);
                }
                return null; // Ou un objet indiquant le succès, ex: { success: true, status: response.status }
            }

            const responseData = await response.json();

            if (!response.ok) {
                // Utiliser le message d'erreur de Xano s'il existe, sinon un message générique
                const errorMessage = responseData.message || responseData.error || `Erreur HTTP ${response.status}`;
                throw new Error(errorMessage);
            }
            return responseData;
        } catch (error) {
            console.error(`Erreur lors de l'appel ${method} ${endpoint}:`, error.message);
            // Re-lancer l'erreur pour que le code appelant puisse la gérer
            // Vous pourriez vouloir la "wrapper" dans une erreur plus spécifique si besoin
            throw error;
        }
    }

    get(endpoint, params = null) {
        return this._request('GET', endpoint, params);
    }

    post(endpoint, body = null, isFormData = false) {
        return this._request('POST', endpoint, body, isFormData);
    }

    put(endpoint, body = null, isFormData = false) {
        return this._request('PUT', endpoint, body, isFormData);
    }

    patch(endpoint, body = null, isFormData = false) {
        return this._request('PATCH', endpoint, body, isFormData);
    }

    // La méthode delete peut envoyer un body JSON (selon la config de votre XanoClient)
    delete(endpoint, body = null) { // Assume JSON body si body est fourni
        return this._request('DELETE', endpoint, body, false);
    }
}

// Les fonctions cookie sont nécessaires pour auth-xano.js et potentiellement d'autres scripts
function setCookie(name, value, days) {
    let expires = "";
    if (days) {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = "; expires=" + date.toUTCString();
    }
    // Note: Pour localhost sans HTTPS, 'Secure' ne fonctionnera pas.
    // Pour la production sur HTTPS, ajoutez '; Secure'
    // document.cookie = name + "=" + (value || "") + expires + "; path=/; SameSite=Lax; Secure";
    document.cookie = name + "=" + (value || "") + expires + "; path=/; SameSite=Lax";
}

function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) return decodeURIComponent(c.substring(nameEQ.length, c.length));
    }
    return null;
}

function eraseCookie(name) {
    // Assurez-vous que les options Path et Domain (si utilisées lors de la création) sont les mêmes.
    // document.cookie = name + '=; Path=/; Domain=.votredomaine.com; Expires=Thu, 01 Jan 1970 00:00:01 GMT; SameSite=Lax; Secure';
    document.cookie = name + '=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; SameSite=Lax';
}

// Optionnel : si vous voulez utiliser les imports/exports de modules ES6 (nécessite <script type="module">)
// export { XanoClient, setCookie, getCookie, eraseCookie };
// Si vous n'utilisez pas type="module", ces fonctions et la classe seront simplement globales
// une fois le fichier xano-client-utils.js chargé.

// xano-client-utils.js

class XanoClient {
    constructor(config) {
        if (!config || !config.apiGroupBaseUrl) {
            throw new Error("Configuration XanoClient: apiGroupBaseUrl est requis.");
        }
        this.apiGroupBaseUrl = config.apiGroupBaseUrl;
        this.authToken = null;
        console.log(`[XanoClient] Instance créée pour ${this.apiGroupBaseUrl}`);
    }

    setAuthToken(token) {
        this.authToken = token;
        // console.log("[XanoClient] AuthToken appliqué.");
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
                options.body = paramsOrBody;
            } else {
                options.headers['Content-Type'] = 'application/json';
                options.body = JSON.stringify(paramsOrBody);
            }
        }

        // console.log(`[XanoClient] Requête: ${method} ${finalUrl}`, options.body ? `Body: ${options.body.substring(0,100)}...` : '');

        try {
            const response = await fetch(finalUrl, options);

            if (response.status === 204 || response.headers.get('content-length') === '0') {
                if (!response.ok) {
                    throw new Error(`Erreur HTTP ${response.status} (No Content)`);
                }
                // console.log(`[XanoClient] Réponse ${response.status} (No Content) pour ${method} ${finalUrl}`);
                return null;
            }

            const responseData = await response.json().catch(e => {
                console.error(`[XanoClient] Impossible de parser la réponse JSON pour ${method} ${finalUrl}. Status: ${response.status}`, e);
                throw new Error(`Réponse invalide du serveur (status ${response.status}).`);
            });

            if (!response.ok) {
                const errorMessage = responseData.message || responseData.error || `Erreur HTTP ${response.status}`;
                // console.error(`[XanoClient] Erreur API pour ${method} ${finalUrl}: ${errorMessage}`, responseData);
                throw new Error(errorMessage);
            }
            // console.log(`[XanoClient] Réponse OK pour ${method} ${finalUrl}`, responseData);
            return responseData;
        } catch (error) {
            console.error(`[XanoClient] Erreur lors de l'appel ${method} ${endpoint}:`, error.message);
            throw error;
        }
    }

    get(endpoint, params = null) { return this._request('GET', endpoint, params); }
    post(endpoint, body = null, isFormData = false) { return this._request('POST', endpoint, body, isFormData); }
    put(endpoint, body = null, isFormData = false) { return this._request('PUT', endpoint, body, isFormData); }
    patch(endpoint, body = null, isFormData = false) { return this._request('PATCH', endpoint, body, isFormData); }
    delete(endpoint, body = null) { return this._request('DELETE', endpoint, body, false); }
}

// Fonctions Cookie
function setCookie(name, value, days) {
    let expires = "";
    if (days) {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = "; expires=" + date.toUTCString();
    }
    // En production sur HTTPS, ajoutez '; Secure'
    // Pour l'instant, on omet 'Secure' pour faciliter les tests sur localhost si besoin.
    document.cookie = name + "=" + (value || "") + expires + "; path=/; SameSite=Lax";
    // console.log(`[Cookie] Cookie "${name}" créé/mis à jour.`);
}

function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) {
            // console.log(`[Cookie] Cookie "${name}" trouvé.`);
            return decodeURIComponent(c.substring(nameEQ.length, c.length));
        }
    }
    // console.log(`[Cookie] Cookie "${name}" non trouvé.`);
    return null;
}

function eraseCookie(name) {
    document.cookie = name + '=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; SameSite=Lax';
    // console.log(`[Cookie] Cookie "${name}" effacé.`);
}

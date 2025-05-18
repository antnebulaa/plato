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
        // ... votre logique fetch ...
    }
    get(endpoint, params = null) { return this._request('GET', endpoint, params); }
    post(endpoint, body = null, isFormData = false) { return this._request('POST', endpoint, body, isFormData); }
    // ... autres méthodes ...
}

// Si vous utilisez des modules ES6 (nécessite une configuration ou un type="module" dans la balise script)
// export { XanoClient }; // Optionnel, pour une importation type module

// Les fonctions cookie pourraient aussi aller ici
function setCookie(name, value, days) { /* ... */ }
function getCookie(name) { /* ... */ }
function eraseCookie(name) { /* ... */ }
// export { setCookie, getCookie, eraseCookie }; // Optionnel

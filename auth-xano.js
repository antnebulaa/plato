// auth-xano.js

// --- Classe XanoClient (peut être partagée ou dupliquée/importée depuis votre autre script) ---
// Assurez-vous que cette classe est disponible. Si elle est dans property-editor-form-v10.js,
// et que les deux scripts sont chargés sur la même page, elle sera accessible.
// Sinon, copiez-la ici ou créez un fichier JS séparé pour elle et importez-la.
/*
class XanoClient {
    constructor(config) { this.apiGroupBaseUrl = config.apiGroupBaseUrl; this.authToken = null; }
    setAuthToken(token) { this.authToken = token; }
    // ... (méthodes _request, get, post, put, patch, delete) ...
    // (Référez-vous à votre script property-editor-form-v10.js pour la définition complète)
}
*/

// --- Fonctions Utilitaires pour les Cookies (identiques à property-editor-form-v10.js) ---
function setCookie(name, value, days) {
    let expires = "";
    if (days) {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + (value || "") + expires + "; path=/; SameSite=Lax"; // SameSite=Lax est une bonne pratique
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
    document.cookie = name + '=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; SameSite=Lax';
}


// --- Instance XanoClient pour l'Authentification ---
// Remplacez par l'URL de base de votre groupe d'API Xano
const authApiBaseUrl = 'https://xwxl-obyg-b3e3.p7.xano.io/api:DbT4FHUS'; // Adaptez ceci !
const authXanoClient = new XanoClient({ apiGroupBaseUrl: authApiBaseUrl });


// --- Logique de gestion des formulaires d'authentification ---
function initAuthForms() {
    const forms = document.querySelectorAll('form[data-xano-form^="auth/"]'); // Cible les formulaires commençant par "auth/"

    forms.forEach(form => {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            const endpoint = form.getAttribute('data-xano-form');
            const method = (form.getAttribute('data-xano-form-method') || 'POST').toUpperCase(); // Devrait être POST

            const loadingElement = form.querySelector('[data-xano-form-loading]');
            const errorElement = form.querySelector('[data-xano-form-error]');
            const submitButton = form.querySelector('button[type="submit"], input[type="submit"]');

            if (errorElement) errorElement.style.display = 'none';
            if (loadingElement) loadingElement.style.display = 'block';
            if (submitButton) submitButton.disabled = true;

            // Collecter les données du formulaire
            // La fonction collectFormDataWithFiles de votre autre script est plus complexe
            // Pour l'auth, on a généralement que des champs simples, pas de fichiers.
            const formData = new FormData(form);
            const formObject = {};
            formData.forEach((value, key) => {
                // Si vous utilisez data-xano-field-name, ajustez la collecte ici
                // Pour l'instant, on suppose que les 'name' des inputs correspondent aux clés attendues par Xano
                formObject[key] = value;
            });

            try {
                let responseData;
                // Pour signup et login, on s'attend à envoyer un corps JSON, pas FormData directement
                // XanoClient.post gère la conversion en JSON si isFormData est false (par défaut)
                if (endpoint === 'auth/signup') {
                    responseData = await authXanoClient.post(endpoint, formObject);
                    // Gérer la réponse du signup
                    console.log('Signup successful:', responseData);
                    alert('Inscription réussie ! Vous pouvez maintenant vous connecter.');
                    // Optionnel : Si Xano retourne un token au signup, connectez l'utilisateur directement
                    if (responseData.authToken) { // Adaptez le nom du champ du token
                        setCookie('xano_auth_token', responseData.authToken, 7); // Stocke le token pour 7 jours
                        // Rediriger vers une page de profil ou tableau de bord
                        window.location.href = '/dashboard'; // Adaptez la page de redirection
                    } else {
                        // Rediriger vers la page de login
                        window.location.href = '/login'; // Adaptez la page de redirection
                    }
                } else if (endpoint === 'auth/login') {
                    responseData = await authXanoClient.post(endpoint, formObject);
                    // Gérer la réponse du login
                    console.log('Login successful:', responseData);
                    if (responseData.authToken) { // Adaptez le nom du champ du token
                        setCookie('xano_auth_token', responseData.authToken, 7); // Stocke le token pour 7 jours
                        // Rediriger vers une page de profil ou tableau de bord
                        window.location.href = '/dashboard'; // Adaptez la page de redirection
                    } else {
                        throw new Error(responseData.message || 'Token non reçu après connexion.');
                    }
                } else {
                    throw new Error(`Endpoint d'authentification non supporté: ${endpoint}`);
                }

            } catch (error) {
                console.error(`Erreur avec ${endpoint}:`, error);
                if (errorElement) {
                    errorElement.textContent = error.message || `Une erreur est survenue lors de : ${endpoint}.`;
                    errorElement.style.display = 'block';
                }
            } finally {
                if (loadingElement) loadingElement.style.display = 'none';
                if (submitButton) submitButton.disabled = false;
            }
        });
    });
}

// --- Gestion de la Déconnexion ---
function handleLogout() {
    const logoutButton = document.getElementById('logout-button'); // Assurez-vous d'avoir un bouton avec cet ID
    if (logoutButton) {
        logoutButton.addEventListener('click', function(e) {
            e.preventDefault();
            eraseCookie('xano_auth_token');
            // Optionnel: appeler un endpoint Xano /auth/logout si vous voulez invalider le token côté serveur
            // authXanoClient.post('auth/logout').then(...).catch(...);
            alert('Vous avez été déconnecté.');
            window.location.href = '/login'; // Rediriger vers la page de login
        });
    }
}

// --- Vérification de l'état de connexion et protection des routes ---
async function checkAuthStatusAndProtectRoutes() {
    const token = getCookie('xano_auth_token');
    const body = document.body; // Pour ajouter des classes contrôlant la visibilité

    if (token) {
        authXanoClient.setAuthToken(token); // Appliquer le token au client Xano
        try {
            const userData = await authXanoClient.get('auth/me'); // Endpoint pour récupérer les infos utilisateur
            console.log('Utilisateur connecté:', userData);
            // L'utilisateur est connecté
            body.classList.add('user-is-logged-in');
            body.classList.remove('user-is-logged-out');

            // Afficher les éléments pour utilisateurs connectés et masquer ceux pour non-connectés
            document.querySelectorAll('.show-if-logged-in').forEach(el => el.style.display = 'block'); // Ou la classe de display que vous utilisez
            document.querySelectorAll('.hide-if-logged-in').forEach(el => el.style.display = 'none');


            // Protection de route : si on est sur login/signup et qu'on est déjà connecté, rediriger
            if (window.location.pathname === '/login/' || window.location.pathname === '/signup/') { // Adaptez les chemins
                window.location.href = '/dashboard'; // Adaptez
            }

        } catch (error) {
            console.error('Token invalide ou session expirée:', error);
            eraseCookie('xano_auth_token'); // Supprimer le token invalide
            authXanoClient.setAuthToken(null);
            body.classList.add('user-is-logged-out');
            body.classList.remove('user-is-logged-in');
            document.querySelectorAll('.show-if-logged-out').forEach(el => el.style.display = 'block');
            document.querySelectorAll('.hide-if-logged-out').forEach(el => el.style.display = 'none');

            // Protection de route : si on est sur une page protégée et pas connecté, rediriger vers login
            if (body.hasAttribute('data-requires-auth')) { // Ajoutez cet attribut aux <body> des pages protégées
                window.location.href = '/login'; // Adaptez
            }
        }
    } else {
        // L'utilisateur n'est pas connecté
        body.classList.add('user-is-logged-out');
        body.classList.remove('user-is-logged-in');
        document.querySelectorAll('.show-if-logged-out').forEach(el => el.style.display = 'block');
        document.querySelectorAll('.hide-if-logged-out').forEach(el => el.style.display = 'none');

        // Protection de route
        if (body.hasAttribute('data-requires-auth')) {
            window.location.href = '/login'; // Adaptez
        }
    }
}


// --- Initialisation au chargement du DOM ---
document.addEventListener('DOMContentLoaded', function() {
    // S'assurer que XanoClient est défini (copiez/collez la définition ou importez)
    if (typeof XanoClient === 'undefined') {
        console.error("XanoClient n'est pas défini. Assurez-vous que la classe est incluse.");
        // Définition de secours (à remplacer par la vraie définition de votre autre script)
        class XanoClient {
            constructor(config) { this.apiGroupBaseUrl = config.apiGroupBaseUrl; this.authToken = null; console.warn("XanoClient: Utilisation d'une définition de secours."); }
            setAuthToken(token) { this.authToken = token; }
            async _request(method, endpoint, paramsOrBody = null, isFormData = false) { console.error("XanoClient._request non implémenté dans la version de secours"); throw new Error("XanoClient non pleinement implémenté"); }
            get(endpoint, params = null) { return this._request('GET', endpoint, params); }
            post(endpoint, body = null, isFormData = false) { return this._request('POST', endpoint, body, isFormData); }
        }
        // Collez ici la définition complète de XanoClient de votre autre fichier si vous n'avez pas de système de modules
    }


    initAuthForms();
    handleLogout();
    checkAuthStatusAndProtectRoutes(); // Appeler cette fonction pour gérer l'état au chargement

    console.log("Système d'authentification Xano initialisé.");
});

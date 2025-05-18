// auth-xano.js

document.addEventListener('DOMContentLoaded', function() {
    console.log("[AUTH_SCRIPT] DOMContentLoaded - Initialisation du système d'authentification Xano.");

    // Vérifier si XanoClient est défini (doit venir de xano-client-utils.js)
    if (typeof XanoClient === 'undefined') {
        console.error("[AUTH_SCRIPT] ERREUR CRITIQUE: La classe XanoClient n'est pas définie. Assurez-vous que xano-client-utils.js est chargé AVANT auth-xano.js.");
        return;
    }
    if (typeof getCookie !== 'function' || typeof setCookie !== 'function' || typeof eraseCookie !== 'function') {
        console.error("[AUTH_SCRIPT] ERREUR CRITIQUE: Les fonctions Cookie ne sont pas définies. Assurez-vous que xano-client-utils.js est chargé AVANT auth-xano.js.");
        return;
    }

    // Configurez ceci avec l'URL de base de votre API Xano pour les endpoints d'authentification
    const AUTH_XANO_API_BASE_URL = 'https://xwxl-obyg-b3e3.p7.xano.io/api:qom0bt4V'; // ADAPTEZ CETTE URL !
    const authXanoClient = new XanoClient({ apiGroupBaseUrl: AUTH_XANO_API_BASE_URL });
 
    // IDs de vos éléments HTML (adaptez si nécessaire)
    const LOGIN_FORM_ID = 'login-form';
    const LOGIN_BUTTON_ID = 'login-button'; // Doit être type="button"
    const SIGNUP_FORM_ID = 'signup-form';
    const SIGNUP_BUTTON_ID = 'signup-button'; // Doit être type="button"
    const LOGOUT_BUTTON_ID = 'logout-button';

    // URLs de redirection (adaptez si nécessaire)
    const REDIRECT_URL_AFTER_LOGIN = '/dashboard'; // Exemple
    const REDIRECT_URL_AFTER_LOGOUT = '/login';  // Exemple
    const REDIRECT_URL_IF_ALREADY_LOGGED_IN = '/dashboard'; // Si on visite login/signup étant déjà connecté

    // --- Initialisation du formulaire de Login ---
    function initLoginForm() {
        const loginForm = document.getElementById(LOGIN_FORM_ID);
        const loginButton = document.getElementById(LOGIN_BUTTON_ID);

        if (loginForm && loginButton) {
            console.log(`[AUTH_SCRIPT] Formulaire de login (#${LOGIN_FORM_ID}) et bouton (#${LOGIN_BUTTON_ID}) trouvés.`);
            if (loginButton.type !== 'button') {
                console.warn(`[AUTH_SCRIPT] AVERTISSEMENT: Le bouton de login (#${LOGIN_BUTTON_ID}) devrait être de type="button" pour éviter la soumission native.`);
            }

            loginButton.addEventListener('click', async function() {
                console.log('[AUTH_SCRIPT] Clic sur le bouton de login.');

                // Récupérer les éléments de manière robuste
                const emailInput = loginForm.querySelector('input[name="email"], input[data-xano-field-name="email"]');
                const passwordInput = loginForm.querySelector('input[name="password"], input[data-xano-field-name="password"]');
                const loadingElement = loginForm.querySelector('[data-xano-form-loading]');
                const errorElement = loginForm.querySelector('[data-xano-form-error]');

                if (!emailInput || !passwordInput) {
                    console.error('[AUTH_SCRIPT] Champs email ou mot de passe non trouvés dans le formulaire de login.');
                    if (errorElement) {
                        errorElement.textContent = 'Erreur interne du formulaire (champs manquants).';
                        errorElement.style.display = 'block';
                    }
                    return;
                }

                const email = emailInput.value;
                const password = passwordInput.value;

                if (!email || !password) {
                    if (errorElement) {
                        errorElement.textContent = 'Veuillez entrer votre email et mot de passe.';
                        errorElement.style.display = 'block';
                    }
                    return;
                }

                if (errorElement) errorElement.style.display = 'none';
                if (loadingElement) loadingElement.style.display = 'block';
                loginButton.disabled = true;

                try {
                    // Adaptez 'auth/login' si votre endpoint Xano a un nom différent
                    const responseData = await authXanoClient.post('auth/login', { email, password });

                    if (responseData && responseData.authToken) { // Adaptez 'authToken' au nom réel du champ token dans la réponse Xano
                        console.log('[AUTH_SCRIPT] Login Xano réussi, token reçu.');
                        setCookie('xano_auth_token', responseData.authToken, 7); // Stocke pour 7 jours
                        // Appeler checkAuthStatusAndProtectRoutes pour mettre à jour l'UI immédiatement avant redirection
                        await checkAuthStatusAndProtectRoutes();
                        window.location.href = REDIRECT_URL_AFTER_LOGIN;
                    } else {
                        throw new Error(responseData.message || 'Token d\'authentification manquant ou réponse invalide de Xano.');
                    }
                } catch (error) {
                    console.error('[AUTH_SCRIPT] Erreur de login Xano:', error);
                    if (errorElement) {
                        errorElement.textContent = error.message || 'Échec de la connexion. Vérifiez vos identifiants.';
                        errorElement.style.display = 'block';
                    }
                } finally {
                    if (loadingElement) loadingElement.style.display = 'none';
                    loginButton.disabled = false;
                }
            });
        } else {
            if (document.getElementById(LOGIN_FORM_ID) && !document.getElementById(LOGIN_BUTTON_ID)) {
                 console.warn(`[AUTH_SCRIPT] Formulaire de login (#${LOGIN_FORM_ID}) trouvé, mais bouton (#${LOGIN_BUTTON_ID}) introuvable.`);
            }
            // Pas d'erreur si le formulaire n'est pas sur la page, c'est normal
        }
    }

    // --- Initialisation du formulaire de Signup ---
    function initSignupForm() {
        const signupForm = document.getElementById(SIGNUP_FORM_ID);
        const signupButton = document.getElementById(SIGNUP_BUTTON_ID);

        if (signupForm && signupButton) {
            console.log(`[AUTH_SCRIPT] Formulaire de signup (#${SIGNUP_FORM_ID}) et bouton (#${SIGNUP_BUTTON_ID}) trouvés.`);
            if (signupButton.type !== 'button') {
                console.warn(`[AUTH_SCRIPT] AVERTISSEMENT: Le bouton de signup (#${SIGNUP_BUTTON_ID}) devrait être de type="button".`);
            }

            signupButton.addEventListener('click', async function() {
                console.log('[AUTH_SCRIPT] Clic sur le bouton de signup.');

                const nameInput = signupForm.querySelector('input[name="name"], input[data-xano-field-name="name"]'); // Optionnel
                const emailInput = signupForm.querySelector('input[name="email"], input[data-xano-field-name="email"]');
                const passwordInput = signupForm.querySelector('input[name="password"], input[data-xano-field-name="password"]');
                const loadingElement = signupForm.querySelector('[data-xano-form-loading]');
                const errorElement = signupForm.querySelector('[data-xano-form-error]');

                if (!emailInput || !passwordInput) { // nameInput est optionnel
                    console.error('[AUTH_SCRIPT] Champs email ou password non trouvés dans le formulaire de signup.');
                    if (errorElement) {
                        errorElement.textContent = 'Erreur interne du formulaire (champs manquants).';
                        errorElement.style.display = 'block';
                    }
                    return;
                }

                const name = nameInput ? nameInput.value : undefined;
                const email = emailInput.value;
                const password = passwordInput.value;

                if (!email || !password) { // Ajoutez une validation pour le nom si requis
                    if (errorElement) {
                        errorElement.textContent = 'Veuillez remplir l\'email et le mot de passe.';
                        errorElement.style.display = 'block';
                    }
                    return;
                }
                // Ajoutez ici une validation plus poussée si nécessaire (format email, complexité mdp)

                if (errorElement) errorElement.style.display = 'none';
                if (loadingElement) loadingElement.style.display = 'block';
                signupButton.disabled = true;

                try {
                    const payload = { email, password };
                    if (name) payload.name = name; // N'ajoute le nom que s'il est fourni

                    // Adaptez 'auth/signup' si votre endpoint Xano a un nom différent
                    const responseData = await authXanoClient.post('auth/signup', payload);
                    console.log('[AUTH_SCRIPT] Signup Xano réussi:', responseData);

                    // Décidez si vous voulez connecter l'utilisateur directement après signup
                    if (responseData && responseData.authToken) { // Si Xano retourne un token au signup
                        setCookie('xano_auth_token', responseData.authToken, 7);
                        await checkAuthStatusAndProtectRoutes();
                        window.location.href = REDIRECT_URL_AFTER_LOGIN; // Ou une page de bienvenue
                    } else {
                        // Si Xano ne retourne pas de token (l'utilisateur doit se logger séparément)
                        alert('Inscription réussie ! Vous pouvez maintenant vous connecter.');
                        window.location.href = REDIRECT_URL_AFTER_LOGOUT; // Redirige vers la page de login
                    }

                } catch (error) {
                    console.error('[AUTH_SCRIPT] Erreur de signup Xano:', error);
                    if (errorElement) {
                        errorElement.textContent = error.message || 'Échec de l\'inscription.';
                        errorElement.style.display = 'block';
                    }
                } finally {
                    if (loadingElement) loadingElement.style.display = 'none';
                    signupButton.disabled = false;
                }
            });
        } else {
             if (document.getElementById(SIGNUP_FORM_ID) && !document.getElementById(SIGNUP_BUTTON_ID)) {
                 console.warn(`[AUTH_SCRIPT] Formulaire de signup (#${SIGNUP_FORM_ID}) trouvé, mais bouton (#${SIGNUP_BUTTON_ID}) introuvable.`);
            }
        }
    }

    // --- Gestion de la Déconnexion ---
    function handleLogout() {
        const logoutButton = document.getElementById(LOGOUT_BUTTON_ID);
        if (logoutButton) {
            console.log(`[AUTH_SCRIPT] Bouton de déconnexion (#${LOGOUT_BUTTON_ID}) trouvé.`);
            logoutButton.addEventListener('click', async function(e) {
                e.preventDefault();
                console.log('[AUTH_SCRIPT] Clic sur le bouton de déconnexion.');
                eraseCookie('xano_auth_token');
                authXanoClient.setAuthToken(null); // Vider le token dans l'instance client

                // Optionnel : appeler un endpoint Xano /auth/logout pour invalider le token côté serveur
                // try {
                //     await authXanoClient.post('auth/logout'); // Assurez-vous que cet endpoint existe et est configuré
                //     console.log('[AUTH_SCRIPT] Token invalidé côté serveur (si endpoint /auth/logout existe).');
                // } catch (logoutError) {
                //     console.warn('[AUTH_SCRIPT] Erreur lors de l\'appel à /auth/logout (endpoint optionnel):', logoutError);
                // }

                // Mettre à jour l'UI et rediriger
                await checkAuthStatusAndProtectRoutes(); // Met à jour l'UI pour refléter l'état déconnecté
                window.location.href = REDIRECT_URL_AFTER_LOGOUT;
            });
        }
    }

    // --- Vérification de l'état de connexion et protection des routes ---
    async function checkAuthStatusAndProtectRoutes() {
        console.log('[AUTH_SCRIPT] Vérification du statut d\'authentification...');
        const token = getCookie('xano_auth_token');
        const body = document.body;

        // Classes pour contrôler la visibilité des éléments (à styler en CSS)
        const CLASS_LOGGED_IN = 'user-is-logged-in';
        const CLASS_LOGGED_OUT = 'user-is-logged-out';

        // Sélecteurs pour les éléments à afficher/masquer (ajoutez ces classes à vos éléments dans Webflow)
        const SHOW_IF_LOGGED_IN_SELECTOR = '.show-if-logged-in';
        const HIDE_IF_LOGGED_IN_SELECTOR = '.hide-if-logged-in';
        // Alternativement, vous pouvez utiliser les classes du body pour styler directement
        // Exemple CSS:
        // body.user-is-logged-out .show-if-logged-in { display: none !important; }
        // body.user-is-logged-in .hide-if-logged-in { display: none !important; }


        if (token) {
            authXanoClient.setAuthToken(token);
            try {
                // Adaptez 'auth/me' si votre endpoint Xano a un nom différent
                const userData = await authXanoClient.get('auth/me');
                if (userData) { // Assurez-vous que userData n'est pas null ou undefined
                    console.log('[AUTH_SCRIPT] Utilisateur connecté:', userData);
                    body.classList.add(CLASS_LOGGED_IN);
                    body.classList.remove(CLASS_LOGGED_OUT);

                    document.querySelectorAll(SHOW_IF_LOGGED_IN_SELECTOR).forEach(el => el.style.display = ''); // Ou votre style d'affichage par défaut
                    document.querySelectorAll(HIDE_IF_LOGGED_IN_SELECTOR).forEach(el => el.style.display = 'none');


                    const currentPagePath = window.location.pathname;
                    if (currentPagePath === '/login/' || currentPagePath === '/signin/' || currentPagePath === '/signup/') { // Adaptez les chemins
                        console.log('[AUTH_SCRIPT] Utilisateur connecté sur page login/signup, redirection vers dashboard.');
                        window.location.href = REDIRECT_URL_IF_ALREADY_LOGGED_IN;
                    }
                    return true; // Utilisateur authentifié
                } else {
                     // Si auth/me retourne null ou pas de données utilisateur valides malgré un token
                    throw new Error("Réponse de /auth/me invalide ou utilisateur non trouvé.");
                }
            } catch (error) {
                console.warn('[AUTH_SCRIPT] Token invalide ou session expirée:', error.message);
                eraseCookie('xano_auth_token');
                authXanoClient.setAuthToken(null);
                // Continue pour définir l'état comme déconnecté
            }
        }

        // Si pas de token ou si le token était invalide
        console.log('[AUTH_SCRIPT] Utilisateur non connecté ou token invalide.');
        body.classList.add(CLASS_LOGGED_OUT);
        body.classList.remove(CLASS_LOGGED_IN);

        document.querySelectorAll(SHOW_IF_LOGGED_IN_SELECTOR).forEach(el => el.style.display = 'none');
        document.querySelectorAll(HIDE_IF_LOGGED_IN_SELECTOR).forEach(el => el.style.display = ''); // Ou votre style d'affichage par défaut

        // Protection de route pour les pages nécessitant une authentification
        // Ajoutez data-requires-auth="true" à la balise <body> des pages concernées dans Webflow
        if (body.hasAttribute('data-requires-auth') && window.location.pathname !== REDIRECT_URL_AFTER_LOGOUT && !window.location.pathname.endsWith(REDIRECT_URL_AFTER_LOGOUT + '/')) {
            console.log('[AUTH_SCRIPT] Page protégée, utilisateur non connecté. Redirection vers login.');
            window.location.href = REDIRECT_URL_AFTER_LOGOUT;
        }
        return false; // Utilisateur non authentifié
    }

    // --- Appel des initialisations ---
    initLoginForm();
    initSignupForm();
    handleLogout();
    checkAuthStatusAndProtectRoutes(); // Vérifier l'état au chargement initial de la page
});

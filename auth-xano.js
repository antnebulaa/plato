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

    // --- Client pour l'authentification Email/Password ---
    const AUTH_EMAIL_API_BASE_URL = 'https://xwxl-obyg-b3e3.p7.xano.io/api:DbT4FHUS';
    const authEmailXanoClient = new XanoClient({ apiGroupBaseUrl: AUTH_EMAIL_API_BASE_URL });
    // Renommer l'instance précédente pour plus de clarté (ex: authEmailXanoClient au lieu de authXanoClient)
    // et utiliser authEmailXanoClient pour initLoginForm, initSignupForm, handleLogout, et la partie /auth/me de checkAuthStatus.

    // --- NOUVEAU : Client pour Google OAuth ---
    const GOOGLE_OAUTH_API_BASE_URL = 'https://xwxl-obyg-b3e3.p7.xano.io/api:Kr4nuSTF';
    const googleAuthXanoClient = new XanoClient({ apiGroupBaseUrl: GOOGLE_OAUTH_API_BASE_URL });

    // --- URL de la page Webflow qui gérera le retour de Google ---
    // C'est cette URL que Xano /oauth/google/init utilisera pour dire à Google où rediriger APRÈS l'authentification Google.
    // C'est aussi cette URL qui doit être listée comme "URI de redirection autorisé" dans Google Cloud Console
    // si le flux est Client -> Google -> Client (page Webflow) -> Xano.
    // MAIS, si le flux est Client -> Xano Init -> Google -> Xano Continue -> Client Page Webflow,
    // alors Xano Init prend l'URL de Xano Continue.
    //
    // D'après la logique Wized et notre discussion, Xano /oauth/google/init
    // prend en INPUT la redirect_uri qui sera utilisée par Google.
    // Cette redirect_uri doit être VOTRE endpoint Xano /oauth/google/continue.
    // C'est cet endpoint Xano /oauth/google/continue qui, APRÈS avoir traité le code,
    // redirigera vers une page de VOTRE site Webflow.
    
    // DONC, la variable envoyée à /oauth/google/init est bien l'URL de l'endpoint Xano de callback:
    const XANO_GOOGLE_CALLBACK_HANDLER_URL = 'https://xwxl-obyg-b3e3.p7.xano.io/api:Kr4nuSTF/oauth/google/continue';
    
    // Chemin de la page Webflow vers laquelle Xano redirige APRES avoir traité le callback Google
    const WEBFLOW_FINAL_CALLBACK_PAGE_PATH = 'https://adriens-sublime-site-ab1222.webflow.io/auth/google/callback-success'; // NOUVEAU - Créez cette page dans Webflow

    // IDs de vos éléments HTML (adaptez si nécessaire)
    const LOGIN_FORM_ID = 'login-form';
    const LOGIN_BUTTON_ID = 'login-button'; // Doit être type="button"
    const LOGOUT_BUTTON_ID = 'logout-button';

    // URLs de redirection (adaptez si nécessaire)
    const REDIRECT_URL_AFTER_LOGIN = '/'; // Exemple
    const REDIRECT_URL_AFTER_LOGOUT = '/signin';  // Exemple
    const REDIRECT_URL_IF_ALREADY_LOGGED_IN = '/'; // Si on visite login/signup étant déjà connecté

    const SIGNUP_FORM_ID = 'signup-form';
    const SIGNUP_BUTTON_ID = 'signup-button'; // Doit être type="button"
    const SIGNUP_PASSWORD_INPUT_ID = 'signup-password';
    const SIGNUP_CONFIRM_PASSWORD_INPUT_ID = 'signup-confirm-password';
    const TOGGLE_PASSWORD_VISIBILITY_BTN_ID = 'toggle-password-visibility';

    const PASSWORD_STRENGTH_BAR_ID = 'password-strength-bar';
    const PASSWORD_STRENGTH_TEXT_ID = 'password-strength-text';
    const PASSWORD_CRITERIA_CONTAINER_ID = 'password-criteria';
    const CONFIRM_PASSWORD_ERROR_ID = 'confirm-password-error';

    const GOOGLE_LOGIN_BUTTON_ID = 'google-login-button';

    function initGoogleLogin() {
    const googleLoginButton = document.getElementById(GOOGLE_LOGIN_BUTTON_ID);
        
        if (googleLoginButton) {
        console.log('[AUTH_SCRIPT] Bouton de login Google trouvé.');
        googleLoginButton.addEventListener('click', async function(event) {
            event.preventDefault(); 
            console.log('[AUTH_SCRIPT] Clic sur le bouton de login Google.');
            googleLoginButton.disabled = true;
            const loadingElement = document.querySelector('#' + LOGIN_FORM_ID + ' [data-xano-form-loading]'); // Ou un indicateur dédié
            if (loadingElement) loadingElement.style.display = 'block';

            try {
                // Étape 1: Appeler votre endpoint Xano qui initie le flux OAuth Google
                // Cet endpoint Xano devrait retourner l'URL d'autorisation Google
                // Adaptez 'oauth/google/initiate' au nom réel de votre endpoint Xano
                console.log(`[AUTH_SCRIPT] Appel à Xano /oauth/google/init avec redirect_uri: ${XANO_GOOGLE_CALLBACK_HANDLER_URL}`);
                const response = await googleAuthXanoClient.get('oauth/google/init', {
                    redirect_uri: XANO_GOOGLE_CALLBACK_HANDLER_URL // Utiliser la nouvelle constante
                });

                console.log('[AUTH_SCRIPT] Réponse de Xano /oauth/google/init:', response); // Log pour voir la réponse

                // Le nom du champ retourné par Xano qui contient l'URL d'autorisation Google
                // pourrait être 'auth_url', 'authorization_url', 'google_auth_url', etc.
                // Vérifiez la réponse de Xano. Supposons qu'il s'appelle 'authorization_url'.
                if (response && response.authUrl) {
                    // Rediriger l'utilisateur vers la page d'autorisation Google
                    console.log("URL d'autorisation Google:", response.authUrl);
                    window.location.href = response.authUrl;
                } else {
                    console.error('[AUTH_SCRIPT] Réponse de Xano /oauth/google/init:', response);
                    throw new Error("Champ 'authUrl' manquant ou invalide dans la réponse de Xano /oauth/google/init."); // Message d'erreur mis à jour
                }
            } catch (error) {
                console.error('[AUTH_SCRIPT] Erreur lors de l\'initiation du login Google via Xano:', error);
                const errorDisplay = document.querySelector('#' + LOGIN_FORM_ID + ' [data-xano-form-error]'); // Ou un afficheur d'erreur dédié
                if (errorDisplay) {
                    errorDisplay.textContent = error.message || "Erreur avec la connexion Google.";
                    errorDisplay.style.display = 'block';
                }
                if (loadingElement) loadingElement.style.display = 'none';
                googleLoginButton.disabled = false;
            }
        });
    }
}

    // Créez une nouvelle page dans Webflow, par exemple /auth/google/callback-success
// Cette page sera celle vers laquelle Xano redirigera après avoir traité le callback de Google.
// Sur cette page, vous mettrez un script pour récupérer le token.
function handleGoogleCallback() {
    const currentPath = window.location.pathname;
    // Vérifie si l'URL actuelle correspond au chemin de la page Webflow de callback finale
    if (currentPath.endsWith(WEBFLOW_FINAL_CALLBACK_PAGE_PATH)) { // ou .includes() si vous préférez
        console.log('[AUTH_SCRIPT] Sur la page de callback Webflow après traitement Xano.');
        const urlParams = new URLSearchParams(window.location.search);
        const xanoToken = urlParams.get('token'); // Xano doit ajouter ce paramètre 'token' lors de sa redirection

        if (xanoToken) {
            console.log('[AUTH_SCRIPT] Token Xano reçu sur la page de callback Webflow:', xanoToken);
            setCookie('xano_auth_token', xanoToken, 7); // Stocke VOTRE token Xano (du système principal)
            window.history.replaceState({}, document.title, currentPath); // Nettoyer l'URL pour enlever le token

            // Valider le token et mettre à jour l'UI/état de connexion
            // On utilise authEmailXanoClient car le token stocké est un token du système d'auth principal
            checkAuthStatusAndProtectRoutes(authEmailXanoClient).then(() => {
                 window.location.href = REDIRECT_URL_AFTER_LOGIN; // Rediriger vers la page de succès (ex: dashboard)
            });
        } else {
            console.error('[AUTH_SCRIPT] Callback Webflow mais token Xano manquant dans l\'URL.');
            alert("Une erreur est survenue lors de la finalisation de la connexion avec Google. Veuillez réessayer.");
            window.location.href = REDIRECT_URL_AFTER_LOGOUT; // Rediriger vers la page de login
        }
    }
}

     // --- Logique de vérification de la force du mot de passe ---
    function checkPasswordStrength(password) {
        const criteria = {
            length: password.length >= 8,
            uppercase: /[A-Z]/.test(password),
            lowercase: /[a-z]/.test(password),
            special: /[0-9\W_]/.test(password), // Chiffre OU caractère spécial (non-alphanumérique)
            // Vérifie s'il n'y a PAS trois caractères identiques consécutifs
            norepeat: !/(.)\1\1/.test(password) // (a)\1\1 -> aaa. Donc !(aaa) est valide.
        };

        let score = 0;
        if (criteria.length) score++;
        if (criteria.uppercase) score++;
        if (criteria.lowercase) score++;
        if (criteria.special) score++;
        if (criteria.norepeat) score++;
        // Vous pouvez ajouter un critère pour la confirmation du mot de passe ici si vous le souhaitez
        // ou le gérer séparément.

        let strengthLevel = 'weak';
        let strengthText = 'Faible';

        if (score <= 2) {
            strengthLevel = 'weak';
            strengthText = 'Faible';
        } else if (score <= 4) {
            strengthLevel = 'medium';
            strengthText = 'Moyen';
        } else if (score >= 5) { // Tous les critères de base
            strengthLevel = 'strong';
            strengthText = 'Fort';
        }
        return { criteria, strengthLevel, strengthText, score, totalCriteria: Object.keys(criteria).length };
    }

    function updatePasswordStrengthUI(password) {
        const strengthResult = checkPasswordStrength(password);
        const { criteria, strengthLevel, strengthText } = strengthResult;

        const strengthBar = document.getElementById(PASSWORD_STRENGTH_BAR_ID);
        const strengthTextElement = document.getElementById(PASSWORD_STRENGTH_TEXT_ID);
        const criteriaContainer = document.getElementById(PASSWORD_CRITERIA_CONTAINER_ID);

        if (strengthBar) {
            strengthBar.className = `strength-bar ${strengthLevel}`; // Applique la classe de force
        }
        if (strengthTextElement) {
            strengthTextElement.textContent = `Force : ${strengthText}`;
            strengthTextElement.className = `strength-text ${strengthLevel}`;
        }

        if (criteriaContainer) {
            for (const key in criteria) {
                const criterionElement = criteriaContainer.querySelector(`.criteria-item[data-criterion="${key}"]`);
                if (criterionElement) {
                    if (criteria[key]) {
                        criterionElement.classList.add('valid');
                        criterionElement.classList.remove('invalid');
                    } else {
                        criterionElement.classList.add('invalid');
                        criterionElement.classList.remove('valid');
                    }
                }
            }
        }
        return strengthResult; // Retourne le résultat pour une utilisation éventuelle dans le handler de signup
    }



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
                    const responseData = await authEmailXanoClient.post('auth/login', { email, password });

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

     // --- Initialisation du formulaire de Signup (MODIFIÉE) ---
    function initSignupForm() {
        const signupForm = document.getElementById(SIGNUP_FORM_ID);
        const signupButton = document.getElementById(SIGNUP_BUTTON_ID);
        const passwordInput = document.getElementById(SIGNUP_PASSWORD_INPUT_ID);
        const confirmPasswordInput = document.getElementById(SIGNUP_CONFIRM_PASSWORD_INPUT_ID);
        const togglePasswordBtn = document.getElementById(TOGGLE_PASSWORD_VISIBILITY_BTN_ID);
        const confirmPasswordErrorMsg = document.getElementById(CONFIRM_PASSWORD_ERROR_ID);

        if (signupForm && signupButton && passwordInput) {
            console.log(`[AUTH_SCRIPT] Formulaire de signup (#${SIGNUP_FORM_ID}), bouton (#${SIGNUP_BUTTON_ID}), et champ mdp trouvés.`);
            if (signupButton.type !== 'button') {
                console.warn(`[AUTH_SCRIPT] AVERTISSEMENT: Le bouton de signup (#${SIGNUP_BUTTON_ID}) devrait être de type="button".`);
            }

            // Écouteur pour la saisie du mot de passe
            passwordInput.addEventListener('input', function() {
                updatePasswordStrengthUI(this.value);
                if (confirmPasswordInput) validateConfirmPassword(); // Valider la confirmation si le champ mdp change
            });

            // Écouteur pour la confirmation du mot de passe
            if (confirmPasswordInput) {
                confirmPasswordInput.addEventListener('input', validateConfirmPassword);
            }

            function validateConfirmPassword() {
                if (passwordInput.value !== confirmPasswordInput.value) {
                    confirmPasswordErrorMsg.style.display = 'block';
                    confirmPasswordInput.setCustomValidity("Les mots de passe ne correspondent pas."); // Pour la validation native HTML5
                    return false;
                } else {
                    confirmPasswordErrorMsg.style.display = 'none';
                    confirmPasswordInput.setCustomValidity("");
                    return true;
                }
            }


            // Afficher/Masquer le mot de passe
            if (togglePasswordBtn) {
                togglePasswordBtn.addEventListener('click', function() {
                    const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
                    passwordInput.setAttribute('type', type);
                    // Change l'icône (exemple avec Material Icons)
                    this.querySelector('.material-icons-outlined').textContent = type === 'password' ? 'visibility' : 'visibility_off';
                    if(confirmPasswordInput) { // Aussi pour le champ de confirmation si présent
                        confirmPasswordInput.setAttribute('type', type);
                    }
                });
            }


            signupButton.addEventListener('click', async function() {
                console.log('[AUTH_SCRIPT] Clic sur le bouton de signup.');

                const nameInput = signupForm.querySelector('input[name="name"], input[data-xano-field-name="name"]');
                const emailInput = signupForm.querySelector('input[name="email"], input[data-xano-field-name="email"]');
                // passwordInput et confirmPasswordInput déjà récupérés

                const loadingElement = signupForm.querySelector('[data-xano-form-loading]');
                const errorElement = signupForm.querySelector('[data-xano-form-error]');

                if (!emailInput || !passwordInput || !confirmPasswordInput) {
                    console.error('[AUTH_SCRIPT] Champs email, password ou confirm password non trouvés.');
                    if (errorElement) {
                        errorElement.textContent = 'Erreur interne du formulaire.';
                        errorElement.style.display = 'block';
                    }
                    return;
                }

                const name = nameInput ? nameInput.value.trim() : undefined;
                const email = emailInput.value.trim();
                const password = passwordInput.value; // Pas de trim pour le mot de passe

                // Validation finale avant soumission
                if (!email || !password || !confirmPasswordInput.value) {
                    if (errorElement) {
                        errorElement.textContent = 'Veuillez remplir tous les champs requis.';
                        errorElement.style.display = 'block';
                    }
                    return;
                }

                if (!validateConfirmPassword()) { // Vérifie que les mots de passe correspondent
                     if (errorElement && confirmPasswordErrorMsg) { // S'assurer que l'erreur principale est aussi mise à jour
                        errorElement.textContent = confirmPasswordErrorMsg.textContent;
                        errorElement.style.display = 'block';
                    }
                    return;
                }

                const strengthCheck = checkPasswordStrength(password);
                if (strengthCheck.score < 5) { // Ou un autre seuil que vous jugez "acceptable"
                    if (errorElement) {
                        errorElement.textContent = 'Le mot de passe ne respecte pas tous les critères de complexité.';
                        errorElement.style.display = 'block';
                    }
                    return;
                }


                if (errorElement) errorElement.style.display = 'none';
                if (loadingElement) loadingElement.style.display = 'block';
                signupButton.disabled = true;

                try {
                    const payload = { email, password };
                    if (name) payload.name = name;

                    const responseData = await authEmailXanoClient.post('auth/signup', payload); // Adaptez l'endpoint
                    console.log('[AUTH_SCRIPT] Signup Xano réussi:', responseData);

                    if (responseData && responseData.authToken) {
                        setCookie('xano_auth_token', responseData.authToken, 7);
                        await checkAuthStatusAndProtectRoutes();
                        window.location.href = REDIRECT_URL_AFTER_LOGIN;
                    } else if (responseData) { // Inscription réussie mais pas de login auto
                         alert('Inscription réussie ! Vous pouvez maintenant vous connecter.');
                         window.location.href = REDIRECT_URL_AFTER_LOGOUT; // Page de login
                    } else {
                        throw new Error("Réponse inattendue du serveur après l'inscription.");
                    }

                } catch (error) {
                    console.error('[AUTH_SCRIPT] Erreur de signup Xano:', error);
                    if (errorElement) {
                        // Xano peut retourner un message spécifique si l'utilisateur existe déjà
                        errorElement.textContent = error.message || 'Échec de l\'inscription.';
                        errorElement.style.display = 'block';
                    }
                } finally {
                    if (loadingElement) loadingElement.style.display = 'none';
                    signupButton.disabled = false;
                }
            });
        } else {
            // ... (logs si formulaire ou bouton non trouvé)
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
                authEmailXanoClient.setAuthToken(null); // Vider le token dans l'instance client

                // Optionnel : appeler un endpoint Xano /auth/logout pour invalider le token côté serveur
                // try {
                //     await authEmailXanoClient.post('auth/logout'); // Assurez-vous que cet endpoint existe et est configuré
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
            authEmailXanoClient.setAuthToken(token);
            try {
                // Adaptez 'auth/me' si votre endpoint Xano a un nom différent
                const userData = await authEmailXanoClient.get('auth/me');
                if (userData) { // Assurez-vous que userData n'est pas null ou undefined
                    console.log('[AUTH_SCRIPT] Utilisateur connecté:', userData);
                    body.classList.add(CLASS_LOGGED_IN);
                    body.classList.remove(CLASS_LOGGED_OUT);

                    document.querySelectorAll(SHOW_IF_LOGGED_IN_SELECTOR).forEach(el => el.style.display = ''); // Ou votre style d'affichage par défaut
                    document.querySelectorAll(HIDE_IF_LOGGED_IN_SELECTOR).forEach(el => el.style.display = 'none');


                    const currentPagePath = window.location.pathname;
                    if (currentPagePath === '/signin/' || currentPagePath === '/signup/') { // Adaptez les chemins
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
                authEmailXanoClient.setAuthToken(null);
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
    // Assurez-vous que ces fonctions sont bien appelées :
     // --- Appel des initialisations ---
    if (document.getElementById(LOGIN_FORM_ID)) initLoginForm();
    if (document.getElementById(SIGNUP_FORM_ID)) initSignupForm();
    if (document.getElementById(LOGOUT_BUTTON_ID)) handleLogout();
    if (document.getElementById(GOOGLE_LOGIN_BUTTON_ID)) initGoogleLogin(); // <<< NOUVEL APPEL

    handleGoogleCallback();
    checkAuthStatusAndProtectRoutes(); // Vérifier l'état au chargement initial de la page
    
});

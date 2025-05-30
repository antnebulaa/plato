document.addEventListener('DOMContentLoaded', function() {
  const notificationElement = document.getElementById('custom-success-notification');
  const notificationMessageElement = document.getElementById('custom-notification-message');

  function showNotification(message, duration = 3000) {
    if (notificationElement && notificationMessageElement) {
      notificationMessageElement.textContent = message || 'Opération réussie !';
      notificationElement.classList.add('show');

      setTimeout(() => {
        notificationElement.classList.remove('show');
        // Optionnel: remettre display: none après la transition pour ne pas gêner les clics
        setTimeout(() => {
          if (!notificationElement.classList.contains('show')) { // Vérifier au cas où une autre notif aurait été déclenchée
             notificationElement.style.display = 'none';
          }
        }, 500); // doit correspondre à la durée de la transition CSS
      }, duration);
    }
  }

  // Exemple de déclenchement :
  // Tu devras intégrer cela avec la détection de succès de ton formulaire Webflow.
  // Si tu utilises un formulaire Webflow standard (pas celui géré par auth-xano.js),
  // tu peux écouter l'événement 'submit' et ensuite vérifier si le message .w-form-done apparaît.

  // Pour les formulaires gérés par ton script auth-xano.js (login, signup):
  // Tu peux appeler showNotification() directement dans les blocs .then() ou try après un succès.
  // Par exemple, dans initSignupForm, après un signup réussi :
  // ...
  // if (responseData && responseData.authToken) {
  //   setCookie('xano_auth_token', responseData.authToken, 7);
  //   await checkAuthStatusAndProtectRoutes();
  //   showNotification('Inscription réussie ! Redirection en cours...'); // << ICI
  //   setTimeout(() => { window.location.href = REDIRECT_URL_AFTER_LOGIN; }, 1500); // Petit délai pour voir la notif
  // } else if (responseData) {
  //   showNotification('Inscription réussie ! Vous pouvez maintenant vous connecter.'); // << OU ICI
  //   setTimeout(() => { window.location.href = REDIRECT_URL_AFTER_LOGOUT; }, 1500);
  // }
  // ...


  // Pour les formulaires Webflow natifs (par ex. un formulaire de contact) :
  // Ceci est une approche plus générique pour les formulaires Webflow.
  const webflowForms = document.querySelectorAll('form');
  webflowForms.forEach(form => {
    // Il faut trouver un moyen fiable de détecter le succès spécifique à Webflow.
    // Souvent, Webflow affiche un div avec la classe .w-form-done.
    // On peut utiliser MutationObserver pour surveiller son apparition.
    const successDiv = form.querySelector('.w-form-done');
    if (successDiv) {
      const observer = new MutationObserver(function(mutationsList, observer) {
        for(const mutation of mutationsList) {
          if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
            // Webflow change souvent le style display de none à block.
            if (successDiv.style.display === 'block' || successDiv.style.display === '') {
               // Vérifier que ce n'est pas le formulaire de login/signup déjà géré
               if (!form.id || (form.id !== 'login-form' && form.id !== 'signup-form')) {
                   const customMessage = form.getAttribute('data-success-message') || 'Formulaire soumis avec succès !';
                   showNotification(customMessage);
                   form.reset(); // Optionnel: vider le formulaire
                   // observer.disconnect(); // Si tu ne veux écouter qu'une fois par chargement de page pour ce formulaire
               }
            }
          }
        }
      });
      observer.observe(successDiv, { attributes: true });
    }
  });
});

// Pour l'utiliser depuis tes fonctions de auth-xano.js, assure-toi que cette fonction showNotification est globale
// ou passe une référence. Pour simplifier, tu peux la rendre globale :
window.showGlobalNotification = function(message, duration = 3000) {
  const notificationElement = document.getElementById('custom-success-notification');
  const notificationMessageElement = document.getElementById('custom-notification-message');
  if (notificationElement && notificationMessageElement) {
    notificationMessageElement.textContent = message || 'Opération réussie !';
    notificationElement.style.display = 'block'; // S'assurer qu'il est block avant d'ajouter la classe
    // Forcer un reflow pour que la transition se déclenche correctement si display était none
    void notificationElement.offsetWidth;
    notificationElement.classList.add('show');

    setTimeout(() => {
      notificationElement.classList.remove('show');
      setTimeout(() => {
        if (!notificationElement.classList.contains('show')) {
           notificationElement.style.display = 'none';
        }
      }, 500);
    }, duration);
  }
}
// Ensuite, dans ton auth-xano.js, tu pourrais appeler window.showGlobalNotification(...).

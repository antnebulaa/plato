 const dragArea = document.getElementById('drag-area');
        const fileInput = document.getElementById('file-upload');
        const previewContainer = document.getElementById('preview-container');
        const fileCountDisplay = document.getElementById('file-count');
        const submitButton = document.getElementById('submit-button');
        let uploadAreaSelectedFiles = []; // Tableau pour stocker les objets File

        // --- Gestion du Drag and Drop ---

        // Empêche le comportement par défaut (ouverture du fichier)
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dragArea.addEventListener(eventName, preventDefaults, false);
            document.body.addEventListener(eventName, preventDefaults, false); // Empêche drop sur toute la page
        });

        // Fonction pour compresser une image en WebP (avec qualité et redimensionnement)
function compressImageWebP(file, quality = 0.75, maxSize = 1600) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const reader = new FileReader();

        reader.onload = (e) => {
            img.src = e.target.result;
        };

        img.onload = () => {
            let width = img.width;
            let height = img.height;
            if (width > maxSize || height > maxSize) {
                if (width > height) {
                    height *= maxSize / width;
                    width = maxSize;
                } else {
                    width *= maxSize / height;
                    height = maxSize;
                }
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob((blob) => {
                if (blob) {
                    // On renomme l’extension .webp
                    const newName = file.name.replace(/\.[^.]+$/, '.webp');
                    const compressedFile = new File([blob], newName, {
                        type: 'image/webp',
                        lastModified: Date.now()
                    });
                    resolve(compressedFile);
                } else {
                    reject(new Error("Compression failed"));
                }
            }, 'image/webp', quality);
        };

        img.onerror = (e) => reject(e);
        reader.onerror = (e) => reject(e);
        reader.readAsDataURL(file);
    });
}


        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        // Ajoute un style visuel lors du survol
        ['dragenter', 'dragover'].forEach(eventName => {
            dragArea.addEventListener(eventName, () => dragArea.classList.add('dragging'), false);
        });

        // Retire le style visuel
        ['dragleave', 'drop'].forEach(eventName => {
            dragArea.addEventListener(eventName, () => dragArea.classList.remove('dragging'), false);
        });

        // Gère le dépôt de fichiers
        dragArea.addEventListener('drop', handleDrop, false);

        function handleDrop(e) {
            const dt = e.dataTransfer;
            const files = dt.files;
            handleFiles(files);
        }

        // --- Gestion de la sélection via l'input ---
        fileInput.addEventListener('change', (e) => {
            handleFiles(e.target.files);
        });

        // --- Traitement des fichiers (commun pour drop et input) ---
        // Nouvelle version ASYNCHRONE
async function handleFiles(files) {
    const imageFiles = [...files].filter(file => file.type.startsWith('image/'));
    for (const file of imageFiles) {
        // Évite les doublons (on compare le nom ET la taille originale)
        if (!uploadAreaSelectedFiles.some(existingFile => existingFile.name === file.name && existingFile.size === file.size)) {
            // Affiche un spinner global si tu veux (optionnel)
            // await pour compresser chaque image avant de l'ajouter !
            const compressed = await compressImageWebP(file, 0.75, 1600);
            uploadAreaSelectedFiles.push(compressed);
        }
    }
    updateFileInput();
    displayPreviews();
    updateFileCount();
    updateSubmitButtonState();
}

// On adapte l’appel dans les listeners (pas de souci, pas besoin de await ici, JS ne bloque pas le thread UI)
fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
});
dragArea.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    handleFiles(files);
});


        // --- Affichage des aperçus ---
        function displayPreviews() {
            previewContainer.innerHTML = ''; // Vide les anciens aperçus
            uploadAreaSelectedFiles.forEach((file, index) => {
                const reader = new FileReader();

                reader.onload = function(e) {
                    // Crée le conteneur pour l'image et le bouton de suppression
                    const previewWrapper = document.createElement('div');
                    previewWrapper.classList.add('preview-image-container', 'rounded-md', 'aspect-square', 'relative'); // aspect-square pour forcer un carré
                    previewWrapper.setAttribute('data-file-index', index); // Stocke l'index pour la suppression

                    // Ajoute une classe 'loading' initialement
                    previewWrapper.classList.add('loading');

                    // Crée l'élément image
                    const img = document.createElement('img');
                    img.src = e.target.result;
                    img.alt = `Aperçu de ${file.name}`;
                    img.classList.add('preview-image', 'rounded-md');

                    // Crée l'indicateur de chargement (spinner)
                    const loader = document.createElement('div');
                    loader.classList.add('loader');

                    // Crée le bouton de suppression
                    const removeBtn = document.createElement('button');
                    removeBtn.innerHTML = '&times;'; // Symbole croix
                    removeBtn.type = 'button'; // Empêche la soumission du formulaire
                    removeBtn.classList.add('remove-image-btn');
                    removeBtn.title = 'Supprimer cette image';
                    removeBtn.onclick = () => removeImage(index);

                    // Ajoute l'image, le loader et le bouton au wrapper
                    previewWrapper.appendChild(img);
                    previewWrapper.appendChild(loader);
                    previewWrapper.appendChild(removeBtn);

                    // Ajoute le wrapper au conteneur principal
                    previewContainer.appendChild(previewWrapper);

                    // Simule la fin du chargement (pour l'animation)
                    // Dans un cas réel, ceci serait déclenché après l'upload réel
                    // Ici, on le retire après un court délai pour la démo
                    setTimeout(() => {
                        previewWrapper.classList.remove('loading');
                    }, 500); // Délai de 0.5s pour voir le spinner
                }

                // Lit le fichier comme une URL de données
                reader.readAsDataURL(file);
            });
        }

        // --- Suppression d'une image ---
        function removeImage(indexToRemove) {
            // Retire le fichier du tableau uploadAreaSelectedFiles
            uploadAreaSelectedFiles.splice(indexToRemove, 1);

            // Met à jour l'input de fichier (important !)
            updateFileInput();

            // Réaffiche les aperçus restants
            displayPreviews();

            // Met à jour le compteur
            updateFileCount();

            // Met à jour l'état du bouton Envoyer
            updateSubmitButtonState();
        }

        // --- Mise à jour de l'input de fichier ---
        // Nécessaire car on ne peut pas directement modifier la FileList d'un input
        // On crée un nouvel objet DataTransfer pour contenir les fichiers restants
        function updateFileInput() {
            const dataTransfer = new DataTransfer();
            uploadAreaSelectedFiles.forEach(file => {
                dataTransfer.items.add(file);
            });
            fileInput.files = dataTransfer.files; // Assigne la nouvelle FileList
             // Déclenche manuellement un événement 'change' si nécessaire pour Webflow/Xano
             // fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        }

         // --- Mise à jour du compteur de fichiers ---
        function updateFileCount() {
            const count = uploadAreaSelectedFiles.length;
            if (count === 0) {
                fileCountDisplay.textContent = '';
            } else if (count === 1) {
                fileCountDisplay.textContent = '1 élément sélectionné';
            } else {
                fileCountDisplay.textContent = `${count} éléments sélectionnés`;
            }
        }

        // --- Activation/Désactivation du bouton Envoyer ---
         function updateSubmitButtonState() {
     // Le bouton est désactivé (true) si la longueur est 0, sinon il est activé (false)
     submitButton.disabled = uploadAreaSelectedFiles.length === 0;
     }

        // --- Optionnel : Gestion de la soumission (exemple simple) ---
        // Vous devrez adapter cette partie à la logique de soumission de Webflow/Xano
        const form = document.getElementById('form-image-upload');
        form.addEventListener('submit', function(e) {
            // Empêche la soumission HTML par défaut si vous la gérez en JS
            // e.preventDefault();

            if (uploadAreaSelectedFiles.length === 0) {
                alert("Veuillez sélectionner au moins une image.");
                return; // Bloque la soumission si aucun fichier
            }

            console.log("Soumission du formulaire avec les fichiers :", fileInput.files);
            // Ici, vous laisseriez Webflow/Xano gérer la soumission
            // ou vous ajouteriez votre propre logique d'upload AJAX si nécessaire.

            // Optionnel : Afficher un indicateur de chargement global pendant l'upload réel
            // submitButton.textContent = 'Envoi en cours...';
            // submitButton.disabled = true;
        });

        // Initialiser l'état du bouton au chargement
        updateSubmitButtonState();

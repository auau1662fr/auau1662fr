document.addEventListener("DOMContentLoaded", async () => {
  const profileButton = document.getElementById("profileButton");
  const profileMenu = document.getElementById("profileMenu");
  const profileUsername = document.getElementById("profileUsername");
  const logoutButton = document.getElementById("logoutButton");

  if (!profileButton || !profileMenu) return;

  // Ouvrir ou fermer le menu
  profileButton.addEventListener("click", () => {
    const isOpen = !profileMenu.hidden;

    profileMenu.hidden = isOpen;
    profileButton.setAttribute("aria-expanded", String(!isOpen));
  });

  // Fermer le menu en cliquant à l'extérieur
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".profile-wrapper")) {
      profileMenu.hidden = true;
      profileButton.setAttribute("aria-expanded", "false");
    }
  });

  // Fermer avec Échap
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      profileMenu.hidden = true;
      profileButton.setAttribute("aria-expanded", "false");
    }
  });

  // Vérifier le compte connecté
  try {
    const response = await fetch("/api/auth/me", {
      credentials: "same-origin"
    });

    if (response.ok) {
      const data = await response.json();

      profileUsername.textContent = data.user.username;
    } else {
      profileUsername.textContent = "Non connecté";

      logoutButton.textContent = "🔑 Se connecter";

      logoutButton.addEventListener("click", () => {
        window.location.href = "/login.html";
      });

      return;
    }
  } catch (error) {
    console.error("Erreur de vérification du compte :", error);
    profileUsername.textContent = "Connexion indisponible";
    logoutButton.disabled = true;
    return;
  }

  // Déconnexion
  logoutButton.addEventListener("click", async () => {
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin"
      });

      if (!response.ok) {
        throw new Error("Échec de la déconnexion.");
      }

      window.location.href = "/login.html";
    } catch (error) {
      console.error("Erreur de déconnexion :", error);
      alert("Impossible de se déconnecter.");
    }
  });
});
  // ==========================
  // PHOTO DE PROFIL
  // ==========================

  const profileImage = document.getElementById("profileImage");
  const profileIcon = document.getElementById("profileIcon");
  const profileImageInput = document.getElementById("profileImageInput");

  // Afficher la photo ou l'icône par défaut
  function displayAvatar(avatarUrl) {
    if (avatarUrl) {
      profileImage.src = avatarUrl + "?t=" + Date.now();
      profileImage.hidden = false;
      profileIcon.hidden = true;
    } else {
      profileImage.removeAttribute("src");
      profileImage.hidden = true;
      profileIcon.hidden = false;
    }
  }

  // Charger la photo du compte connecté
  async function loadAvatar() {
    try {
      const response = await fetch("/api/profile/me", {
        credentials: "same-origin"
      });

      if (!response.ok) return;

      const data = await response.json();
      displayAvatar(data.user.avatar);
    } catch (error) {
      console.error("Erreur de chargement de l'avatar :", error);
    }
  }

  // Envoyer une nouvelle photo au serveur
  profileImageInput?.addEventListener("change", async () => {
    const file = profileImageInput.files[0];

    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("L'image ne doit pas dépasser 2 Mo.");
      profileImageInput.value = "";
      return;
    }

    const formData = new FormData();
    formData.append("avatar", file);

    try {
      const response = await fetch("/api/profile/avatar", {
        method: "POST",
        credentials: "same-origin",
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Impossible d'enregistrer l'image.");
      }

      displayAvatar(data.avatar);
      alert("Photo de profil enregistrée !");

    } catch (error) {
      alert(error.message);
    } finally {
      profileImageInput.value = "";
    }
  });

  loadAvatar();

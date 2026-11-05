async function loadBuilds() {
  try {
    const response = await fetch("/api/builds");

    if (!response.ok) {
      throw new Error("Impossible de récupérer les builds");
    }

    const builds = await response.json();

    const container =
      document.getElementById("builds-container");

    container.innerHTML = "";

    if (!builds || builds.length === 0) {
      container.innerHTML = `
        <p class="empty">
          Aucun build sauvegardé pour le moment.
        </p>
      `;
      return;
    }

    for (const build of builds) {
      let components = [];

      try {
        const detailsResponse =
          await fetch(`/api/builds/${build.id}`);

        if (detailsResponse.ok) {
          const details =
            await detailsResponse.json();

          components = details.components || [];
        }
      } catch (error) {
        console.error(
          "Erreur lors du chargement des composants :",
          error
        );
      }

      const cpu =
        components.find(
          component => component.category === "CPU"
        );

      const gpu =
        components.find(
          component => component.category === "GPU"
        );

      const motherboard =
        components.find(
          component =>
            component.category === "Motherboard"
        );

      const card =
        document.createElement("div");

      card.className = "build-card";

      card.innerHTML = `
        <div class="build-title">
          <h3>${escapeHtml(build.name)}</h3>

          <button
            class="delete-build"
            type="button"
            title="Supprimer ce build"
            aria-label="Supprimer ${escapeHtml(build.name)}"
          >
            ×
          </button>
        </div>

        <div class="build-config">
          <p>
            <strong>CPU :</strong>
            ${cpu ? escapeHtml(cpu.name) : "Non sélectionné"}
          </p>

          <p>
            <strong>GPU :</strong>
            ${gpu ? escapeHtml(gpu.name) : "Non sélectionnée"}
          </p>

          <p>
            <strong>CM :</strong>
            ${
              motherboard
                ? escapeHtml(motherboard.name)
                : "Non sélectionnée"
            }
          </p>
        </div>

        <p class="build-price">
          ${Number(build.total_price || 0).toFixed(2)} €
        </p>

        <a
          class="action-card"
          href="builder.html?id=${build.id}"
        >
          🛠️ Ouvrir / Modifier
        </a>
      `;

      const deleteButton =
        card.querySelector(".delete-build");

      deleteButton.addEventListener(
        "click",
        () => {
          openDeleteModal(
            build.id,
            build.name,
            card
          );
        }
      );

      container.appendChild(card);
    }

  } catch (error) {
    console.error(error);

    const container =
      document.getElementById("builds-container");

    container.innerHTML = `
      <p class="empty">
        Impossible de charger les builds sauvegardés.
      </p>
    `;
  }
}


function openDeleteModal(
  buildId,
  buildName,
  card
) {
  const modal =
    document.createElement("div");

  modal.className = "delete-modal";

  modal.innerHTML = `
    <div class="delete-modal-content">

      <h2>Supprimer le build ?</h2>

      <p>
        Voulez-vous vraiment supprimer
        <strong>${escapeHtml(buildName)}</strong> ?
      </p>

      <div class="delete-modal-actions">

        <button
          type="button"
          class="cancel-delete"
        >
          Annuler
        </button>

        <button
          type="button"
          class="confirm-delete"
        >
          Supprimer
        </button>

      </div>

    </div>
  `;

  document.body.appendChild(modal);

  const cancelButton =
    modal.querySelector(".cancel-delete");

  const confirmButton =
    modal.querySelector(".confirm-delete");

  cancelButton.addEventListener(
    "click",
    () => {
      modal.remove();
    }
  );

  confirmButton.addEventListener(
    "click",
    async () => {

      confirmButton.disabled = true;
      confirmButton.textContent = "Suppression...";

      try {
        const response = await fetch(
          `/api/builds/${buildId}`,
          {
            method: "DELETE"
          }
        );

        if (!response.ok) {
          throw new Error(
            "Erreur lors de la suppression"
          );
        }

        card.remove();
        modal.remove();

        const container =
          document.getElementById(
            "builds-container"
          );

        if (
          !container.querySelector(
            ".build-card"
          )
        ) {
          container.innerHTML = `
            <p class="empty">
              Aucun build sauvegardé pour le moment.
            </p>
          `;
        }

      } catch (error) {
        console.error(error);

        confirmButton.disabled = false;
        confirmButton.textContent = "Supprimer";

        alert(
          "Impossible de supprimer le build."
        );
      }
    }
  );

  modal.addEventListener(
    "click",
    event => {
      if (event.target === modal) {
        modal.remove();
      }
    }
  );
}


function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


loadBuilds();

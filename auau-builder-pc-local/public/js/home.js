async function loadBuilds() {
  const response = await fetch('/api/builds');
  const builds = await response.json();

  const container = document.getElementById('builds-container');

  // IMPORTANT : reset avant de recharger
  container.innerHTML = "";

  if (!builds || builds.length === 0) {
    container.innerHTML = `<p class="empty">Aucun build pour le moment</p>`;
    return;
  }

  builds.forEach(build => {
    const card = document.createElement("div");
    card.className = "build-card";

    card.innerHTML = `
      <h2>${build.name}</h2>
      <p>${build.total_price} €</p>

      <a href="builder.html?id=${build.id}">
        Open Builder
      </a>
    `;

    container.appendChild(card);
  });
}

loadBuilds();

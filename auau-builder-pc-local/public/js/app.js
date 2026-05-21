const panel = document.getElementById("components-panel");

const title = document.getElementById("panel-title");

function togglePanel(category) {

  title.innerText = category + " Components";

  panel.classList.add("open");
}

function closePanel() {

  panel.classList.remove("open");
}

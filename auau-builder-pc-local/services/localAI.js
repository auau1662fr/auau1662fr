const path = require("path");
const fs = require("fs");

const MODEL_PATH = path.join(
  __dirname,
  "..",
  "models",
  "qwen3-4b-q4_k_m.gguf"
);

let aiPromise = null;
let generationQueue = Promise.resolve();

async function initializeAI() {
  if (!fs.existsSync(MODEL_PATH)) {
    throw new Error(
      `Modèle Qwen introuvable : ${MODEL_PATH}`
    );
  }

  console.log("🧠 Chargement du modèle Qwen local...");

  const { getLlama, LlamaChatSession } =
    await import("node-llama-cpp");

  const llama = await getLlama({
  gpu: "cuda"
  });

  const model = await llama.loadModel({
    modelPath: MODEL_PATH,
    gpuLayers: 36
  });

  console.log("[AUAU GPU] Backend :", llama.gpu, "| Couches GPU :", model.gpuLayers);

  const context = await model.createContext({
  contextSize: 8192
  });

  const sequence = context.getSequence();

  console.log("✅ Modèle Qwen chargé dans AUAU.");

  return {
    llama,
    model,
    context,
    sequence,
    LlamaChatSession
  };
}

async function getAI() {
  if (!aiPromise) {
    aiPromise = initializeAI().catch((error) => {
      aiPromise = null;
      throw error;
    });
  }

  return aiPromise;
}

async function generate(prompt) {
  const previousGeneration = generationQueue;

  let release;
  generationQueue = new Promise((resolve) => {
    release = resolve;
  });

  await previousGeneration;

  try {
    const ai = await getAI();

    // Crée une session neuve pour chaque analyse.
    // Cela évite de conserver l'historique des comparaisons précédentes.
    const session = new ai.LlamaChatSession({
      contextSequence: ai.sequence
    });

    try {
      console.log("[AUAU IA] Début de génération du rapport");
      const result = await session.promptWithMeta(prompt, {
        temperature: 0.5,
        maxTokens: 4096
      });

      console.log("[AUAU IA] Raison de fin :", result.stopReason);
      console.log(
        "[AUAU IA] Texte généré :",
        result.responseText.length,
        "caractères"
      );

      if (result.stopReason === "maxTokens") {
        console.warn("[AUAU IA] Attention : limite de tokens atteinte.");
      }

      return result.responseText;
    } finally {
      session.dispose();
    }
  } finally {
    release();
  }
}

module.exports = {
  getAI,
  generate
};

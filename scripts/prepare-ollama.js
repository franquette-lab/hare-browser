// Prépare ollama-bundle/ : runtime Ollama + uniquement le modèle qwen2.5:1.5b, pour l'empaquetage.
const fs = require("fs");
const path = require("path");

const MODEL = "qwen2.5";
const TAG = "1.5b";
const runtimeDir = path.join(process.env.LOCALAPPDATA, "Programs", "Ollama");
const modelsDir = path.join(process.env.OLLAMA_MODELS || path.join(process.env.USERPROFILE, ".ollama", "models"));
const out = path.join(__dirname, "..", "ollama-bundle");

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

fs.copyFileSync(path.join(runtimeDir, "ollama.exe"), path.join(out, "ollama.exe"));
fs.cpSync(path.join(runtimeDir, "lib"), path.join(out, "lib"), { recursive: true });

const manifestRel = path.join("manifests", "registry.ollama.ai", "library", MODEL, TAG);
const manifestSrc = path.join(modelsDir, manifestRel);
const manifest = JSON.parse(fs.readFileSync(manifestSrc, "utf8"));

const manifestDst = path.join(out, "models", manifestRel);
fs.mkdirSync(path.dirname(manifestDst), { recursive: true });
fs.copyFileSync(manifestSrc, manifestDst);

fs.mkdirSync(path.join(out, "models", "blobs"), { recursive: true });
for (const { digest } of [manifest.config, ...manifest.layers]) {
    const name = digest.replace(":", "-");
    fs.copyFileSync(path.join(modelsDir, "blobs", name), path.join(out, "models", "blobs", name));
}

console.log("ollama-bundle prêt :", out);

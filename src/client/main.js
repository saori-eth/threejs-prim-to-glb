import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

console.log("Main script started.");

const promptInput = document.getElementById("promptInput");
const generateButton = document.getElementById("generateButton");
const statusDiv = document.getElementById("status");
const canvas = document.getElementById("threejs-canvas");
const viewerContainer = document.getElementById("viewer-container");
const downloadButton = document.getElementById("downloadButton");
const modelSelect = document.getElementById("modelSelect");
const refinementPromptInput = document.getElementById("refinementPromptInput");
const refineButton = document.getElementById("refineButton");

let scene, camera, renderer, controls, loader;
let currentModel = null;
let currentObjectUrl = null;
let lastSuccessfulPrompt = "scene";
let currentThreeJsScript = null;
let currentFilenameBase = "scene";

function initThree() {
  console.log("initThree() called");
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x2a2a2a);

  camera = new THREE.PerspectiveCamera(
    50,
    viewerContainer.clientWidth / viewerContainer.clientHeight,
    0.1,
    1000,
  );
  camera.position.set(0, 1.5, 4);

  renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setSize(viewerContainer.clientWidth, viewerContainer.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.physicallyCorrectLights = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.screenSpacePanning = false;
  controls.minDistance = 0.5;
  controls.maxDistance = 50;
  controls.target.set(0, 1, 0);
  controls.update();

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 2.5);
  directionalLight.position.set(3, 10, 7);
  directionalLight.castShadow = true;
  scene.add(directionalLight);

  loader = new GLTFLoader();

  downloadButton.disabled = true;
  refineButton.disabled = true;

  window.addEventListener("resize", onWindowResize);
  animate();
}

function onWindowResize() {
  camera.aspect = viewerContainer.clientWidth / viewerContainer.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(viewerContainer.clientWidth, viewerContainer.clientHeight);
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

function frameArea(object) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  controls.reset();

  const maxSize = Math.max(size.x, size.y, size.z);
  const fitHeightDistance =
    maxSize / (2 * Math.atan((Math.PI * camera.fov) / 360));
  const fitWidthDistance = fitHeightDistance / camera.aspect;
  const distance = 1.2 * Math.max(fitHeightDistance, fitWidthDistance);

  const direction = controls.object.position
    .clone()
    .sub(center)
    .normalize()
    .multiplyScalar(distance);

  controls.maxDistance = distance * 10;
  controls.object.position.copy(center).add(direction);
  controls.target.copy(center);

  controls.update();
}

function loadModel(url) {
  if (currentModel) {
    scene.remove(currentModel);
    currentModel.traverse((child) => {
      if (child.isMesh) {
        child.geometry.dispose();
        if (child.material.isMaterial) {
          cleanMaterial(child.material);
        } else {
          for (const material of child.material) cleanMaterial(material);
        }
      }
    });
    currentModel = null;
  }

  statusDiv.textContent = "Loading model with Three.js...";
  loader.load(
    url,
    (gltf) => {
      currentModel = gltf.scene;
      scene.add(currentModel);
      frameArea(currentModel);
      statusDiv.textContent = "Model loaded successfully with Three.js!";
      statusDiv.style.color = "green";
      downloadButton.disabled = false;
      refineButton.disabled = !currentThreeJsScript;
    },
    undefined,
    (error) => {
      console.error("An error happened during GLB loading:", error);
      statusDiv.textContent = "Failed to load GLB model with Three.js.";
      statusDiv.style.color = "red";
      downloadButton.disabled = true;
      refineButton.disabled = true;
    },
  );
}

function cleanMaterial(material) {
  material.dispose();
  for (const key of Object.keys(material)) {
    const value = material[key];
    if (value && typeof value === "object" && "isTexture" in value) {
      value.dispose();
    }
  }
}

generateButton.addEventListener("click", async () => {
  console.log("Generate Scene button clicked.");

  const prompt = promptInput.value.trim();
  const selectedModelId = modelSelect.value;

  if (!prompt) {
    statusDiv.textContent = "Please enter a prompt.";
    statusDiv.style.color = "red";
    return;
  }

  generateButton.disabled = true;
  generateButton.textContent = "Generating...";
  statusDiv.textContent = "Sending prompt to API...";
  statusDiv.style.color = "inherit";

  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = null;
  }

  if (currentModel) {
    scene.remove(currentModel);
  }
  renderer.render(scene, camera);

  try {
    console.log(
      `Attempting to fetch /generate-scene with prompt: "${prompt}", model: "${selectedModelId}"`,
    );
    const response = await fetch("/generate-scene", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt: prompt, modelId: selectedModelId }),
    });

    statusDiv.textContent = "Receiving model from API...";

    if (!response.ok) {
      let errorMsg = `Error: ${response.status} ${response.statusText}`;
      try {
        const errorData = await response.json();
        errorMsg = errorData.error || errorMsg;
      } catch (e) {}
      throw new Error(errorMsg);
    }

    const blob = await response.blob();
    currentObjectUrl = URL.createObjectURL(blob);
    loadModel(currentObjectUrl);

    const scriptHeader = response.headers.get("X-Generated-Script");
    const filenameHeader = response.headers.get("X-Generated-Filename");

    if (scriptHeader) {
      currentThreeJsScript = decodeURIComponent(scriptHeader);
      console.log("Received and stored script from LLM.");
    } else {
      console.warn("X-Generated-Script header not found.");
      currentThreeJsScript = null;
    }

    if (filenameHeader) {
      currentFilenameBase = decodeURIComponent(filenameHeader);
      console.log("Received filename base from LLM:", currentFilenameBase);
    } else {
      currentFilenameBase =
        prompt.replace(/[^a-z0-9_]/gi, "_").substring(0, 50) || "scene";
      console.warn(
        "X-Generated-Filename header not found, using sanitized prompt as fallback for filename base.",
      );
    }

    downloadButton.disabled = false;
    refineButton.disabled = !currentThreeJsScript;
  } catch (error) {
    console.error("Error generating or loading scene:", error);
    statusDiv.textContent = `Failed to load model: ${error.message}`;
    statusDiv.style.color = "red";
    downloadButton.disabled = true;
    refineButton.disabled = true;
  } finally {
    generateButton.disabled = false;
    generateButton.textContent = "Generate Scene";
  }
});

downloadButton.addEventListener("click", () => {
  if (currentObjectUrl) {
    const a = document.createElement("a");
    a.href = currentObjectUrl;
    a.download = `${currentFilenameBase}.glb`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    console.log("Download initiated for:", a.download);
  } else {
    console.warn("No model URL available for download.");
    statusDiv.textContent = "No model available to download.";
    statusDiv.style.color = "orange";
  }
});

refineButton.addEventListener("click", async () => {
  console.log(
    "Refine Scene button clicked. Button disabled state:",
    refineButton.disabled,
  );
  console.log(
    "Current Three.js script available:",
    currentThreeJsScript ? "Yes, length: " + currentThreeJsScript.length : "No",
  );

  const refinementPrompt = refinementPromptInput.value.trim();
  const selectedModelId = modelSelect.value;
  console.log("Refinement prompt:", refinementPrompt);

  if (!currentThreeJsScript) {
    statusDiv.textContent =
      "No scene script available to refine. Please generate a scene first.";
    statusDiv.style.color = "orange";
    console.warn("Refinement aborted: currentThreeJsScript is not available.");
    return;
  }

  if (!refinementPrompt) {
    statusDiv.textContent = "Please enter a refinement prompt.";
    statusDiv.style.color = "red";
    console.warn("Refinement aborted: refinementPrompt is empty.");
    return;
  }

  refineButton.disabled = true;
  refineButton.textContent = "Refining...";
  generateButton.disabled = true;
  statusDiv.textContent = "Sending refinement request to API...";
  statusDiv.style.color = "inherit";

  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = null;
  }
  if (currentModel) {
    scene.remove(currentModel);
  }
  renderer.render(scene, camera);

  try {
    const payload = {
      originalScript: currentThreeJsScript,
      refinementPrompt: refinementPrompt,
      modelId: selectedModelId,
    };
    console.log(
      "Attempting to fetch /refine-scene with model:",
      selectedModelId,
      "Payload:",
      payload,
    );

    const response = await fetch("/refine-scene", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    statusDiv.textContent = "Receiving refined model from API...";

    if (!response.ok) {
      let errorMsg = `Error: ${response.status} ${response.statusText}`;
      try {
        const errorData = await response.json();
        errorMsg = errorData.error || errorMsg;
      } catch (e) {}
      console.error(
        "Refine API response not OK:",
        errorMsg,
        "Status:",
        response.status,
      );
      throw new Error(errorMsg);
    }

    const scriptHeader = response.headers.get("X-Generated-Script");
    const filenameHeader = response.headers.get("X-Generated-Filename");

    if (scriptHeader) {
      currentThreeJsScript = decodeURIComponent(scriptHeader);
      console.log(
        "Received and stored updated script from LLM after refinement.",
      );
    } else {
      console.warn("X-Generated-Script header not found after refinement.");
      currentThreeJsScript = null;
    }

    if (filenameHeader) {
      currentFilenameBase = decodeURIComponent(filenameHeader);
      console.log(
        "Received updated filename base from LLM after refinement:",
        currentFilenameBase,
      );
    } else {
      currentFilenameBase =
        (refinementPrompt.substring(0, 20) + "_refined").replace(
          /[^a-z0-9_]/gi,
          "_",
        ) || "scene_refined";
      console.warn(
        "X-Generated-Filename header not found after refinement, using sanitized prompt as fallback.",
      );
    }

    const blob = await response.blob();
    currentObjectUrl = URL.createObjectURL(blob);
    loadModel(currentObjectUrl);
  } catch (error) {
    console.error("Error refining scene:", error);
    statusDiv.textContent = `Failed to refine model: ${error.message}`;
    statusDiv.style.color = "red";
    downloadButton.disabled = true;
    refineButton.disabled = true;
  } finally {
    refineButton.disabled = !currentThreeJsScript;
    refineButton.textContent = "Refine Scene";
    generateButton.disabled = false;
  }
});

initThree();
console.log("Main script finished initial setup.");

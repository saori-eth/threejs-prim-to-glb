import { useState, useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const AVAILABLE_MODELS = {
  'claude-opus-4-5-20251101': 'Claude Opus 4.5 (20251101)',
  'claude-sonnet-4-5-20250929': 'Claude Sonnet 4.5 (20250929)',
  'claude-opus-4-20250514': 'Claude Opus 4 (20250514)',
  'claude-sonnet-4-20250514': 'Claude Sonnet 4 (20250514)',
};

export default function App() {
  const [prompt, setPrompt] = useState('a vibrant red cube next to a small blue sphere');
  const [refinementPrompt, setRefinementPrompt] = useState('');
  const [modelId, setModelId] = useState('claude-opus-4-5-20251101');
  const [status, setStatus] = useState({ text: '', type: '' });
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [canDownload, setCanDownload] = useState(false);
  const [canRefine, setCanRefine] = useState(false);

  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const loaderRef = useRef(null);
  const currentModelRef = useRef(null);
  const currentObjectUrlRef = useRef(null);
  const currentScriptRef = useRef(null);
  const currentFilenameRef = useRef('scene');
  const animationIdRef = useRef(null);

  const cleanMaterial = useCallback((material) => {
    material.dispose();
    for (const key of Object.keys(material)) {
      const value = material[key];
      if (value && typeof value === 'object' && 'isTexture' in value) {
        value.dispose();
      }
    }
  }, []);

  const frameArea = useCallback((object) => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    controls.reset();

    const maxSize = Math.max(size.x, size.y, size.z);
    const fitHeightDistance = maxSize / (2 * Math.atan((Math.PI * camera.fov) / 360));
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
  }, []);

  const loadModel = useCallback((url) => {
    const scene = sceneRef.current;
    const loader = loaderRef.current;
    if (!scene || !loader) return;

    if (currentModelRef.current) {
      scene.remove(currentModelRef.current);
      currentModelRef.current.traverse((child) => {
        if (child.isMesh) {
          child.geometry.dispose();
          if (child.material.isMaterial) {
            cleanMaterial(child.material);
          } else {
            for (const material of child.material) cleanMaterial(material);
          }
        }
      });
      currentModelRef.current = null;
    }

    setStatus({ text: 'Loading model with Three.js...', type: '' });

    loader.load(
      url,
      (gltf) => {
        currentModelRef.current = gltf.scene;
        scene.add(gltf.scene);
        frameArea(gltf.scene);
        setStatus({ text: 'Model loaded successfully!', type: 'success' });
        setCanDownload(true);
        setCanRefine(!!currentScriptRef.current);
      },
      undefined,
      (error) => {
        console.error('Error loading GLB:', error);
        setStatus({ text: 'Failed to load GLB model.', type: 'error' });
        setCanDownload(false);
        setCanRefine(false);
      }
    );
  }, [cleanMaterial, frameArea]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x2a2a2a);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 1.5, 4);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 0.5;
    controls.maxDistance = 50;
    controls.target.set(0, 1, 0);
    controls.update();
    controlsRef.current = controls;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 2.5);
    directionalLight.position.set(3, 10, 7);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    loaderRef.current = new GLTFLoader();

    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      renderer.dispose();
      controls.dispose();
    };
  }, []);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setStatus({ text: 'Please enter a prompt.', type: 'error' });
      return;
    }

    setIsGenerating(true);
    setStatus({ text: 'Sending prompt to API...', type: '' });

    if (currentObjectUrlRef.current) {
      URL.revokeObjectURL(currentObjectUrlRef.current);
      currentObjectUrlRef.current = null;
    }

    if (currentModelRef.current && sceneRef.current) {
      sceneRef.current.remove(currentModelRef.current);
    }

    try {
      const response = await fetch('/generate-scene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, modelId }),
      });

      setStatus({ text: 'Receiving model from API...', type: '' });

      if (!response.ok) {
        let errorMsg = `Error: ${response.status} ${response.statusText}`;
        try {
          const errorData = await response.json();
          errorMsg = errorData.error || errorMsg;
        } catch {}
        throw new Error(errorMsg);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      currentObjectUrlRef.current = objectUrl;

      const scriptHeader = response.headers.get('X-Generated-Script');
      const filenameHeader = response.headers.get('X-Generated-Filename');

      if (scriptHeader) {
        currentScriptRef.current = decodeURIComponent(scriptHeader);
      } else {
        currentScriptRef.current = null;
      }

      if (filenameHeader) {
        currentFilenameRef.current = decodeURIComponent(filenameHeader);
      } else {
        currentFilenameRef.current = prompt.replace(/[^a-z0-9_]/gi, '_').substring(0, 50) || 'scene';
      }

      loadModel(objectUrl);
    } catch (error) {
      console.error('Error generating scene:', error);
      setStatus({ text: `Failed to load model: ${error.message}`, type: 'error' });
      setCanDownload(false);
      setCanRefine(false);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRefine = async () => {
    if (!currentScriptRef.current) {
      setStatus({ text: 'No scene script available to refine.', type: 'error' });
      return;
    }

    if (!refinementPrompt.trim()) {
      setStatus({ text: 'Please enter a refinement prompt.', type: 'error' });
      return;
    }

    setIsRefining(true);
    setStatus({ text: 'Sending refinement request to API...', type: '' });

    if (currentObjectUrlRef.current) {
      URL.revokeObjectURL(currentObjectUrlRef.current);
      currentObjectUrlRef.current = null;
    }

    if (currentModelRef.current && sceneRef.current) {
      sceneRef.current.remove(currentModelRef.current);
    }

    try {
      const response = await fetch('/refine-scene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalScript: currentScriptRef.current,
          refinementPrompt,
          modelId,
        }),
      });

      setStatus({ text: 'Receiving refined model from API...', type: '' });

      if (!response.ok) {
        let errorMsg = `Error: ${response.status} ${response.statusText}`;
        try {
          const errorData = await response.json();
          errorMsg = errorData.error || errorMsg;
        } catch {}
        throw new Error(errorMsg);
      }

      const scriptHeader = response.headers.get('X-Generated-Script');
      const filenameHeader = response.headers.get('X-Generated-Filename');

      if (scriptHeader) {
        currentScriptRef.current = decodeURIComponent(scriptHeader);
      } else {
        currentScriptRef.current = null;
      }

      if (filenameHeader) {
        currentFilenameRef.current = decodeURIComponent(filenameHeader);
      } else {
        currentFilenameRef.current = (refinementPrompt.substring(0, 20) + '_refined').replace(/[^a-z0-9_]/gi, '_') || 'scene_refined';
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      currentObjectUrlRef.current = objectUrl;
      loadModel(objectUrl);
    } catch (error) {
      console.error('Error refining scene:', error);
      setStatus({ text: `Failed to refine model: ${error.message}`, type: 'error' });
      setCanDownload(false);
      setCanRefine(false);
    } finally {
      setIsRefining(false);
    }
  };

  const handleDownload = () => {
    if (currentObjectUrlRef.current) {
      const a = document.createElement('a');
      a.href = currentObjectUrlRef.current;
      a.download = `${currentFilenameRef.current}.glb`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  return (
    <>
      <h1>Three.js GLB Generator</h1>
      
      <div className="viewer-container" ref={containerRef}>
        <canvas ref={canvasRef} />
      </div>

      <div className="controls-container">
        <div>
          <label htmlFor="promptInput">Enter your prompt:</label>
          <input
            type="text"
            id="promptInput"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="modelSelect">Select Model:</label>
          <select
            id="modelSelect"
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
          >
            {Object.entries(AVAILABLE_MODELS).map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
        </div>

        <button onClick={handleGenerate} disabled={isGenerating || isRefining}>
          {isGenerating ? 'Generating...' : 'Generate Scene'}
        </button>

        <button onClick={handleDownload} disabled={!canDownload || isGenerating || isRefining}>
          Download GLB
        </button>

        <div className={`status ${status.type}`}>{status.text}</div>
      </div>

      <div className="controls-container">
        <label htmlFor="refinementPromptInput">Refine the current scene:</label>
        <input
          type="text"
          id="refinementPromptInput"
          placeholder="e.g., 'make the cube green', 'add a light from above'"
          value={refinementPrompt}
          onChange={(e) => setRefinementPrompt(e.target.value)}
        />
        <button onClick={handleRefine} disabled={!canRefine || isGenerating || isRefining}>
          {isRefining ? 'Refining...' : 'Refine Scene'}
        </button>
      </div>
    </>
  );
}

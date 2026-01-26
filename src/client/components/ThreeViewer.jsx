import {
  useRef,
  useEffect,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

function createStarfield() {
  const starCount = 2000;
  const positions = new Float32Array(starCount * 3);

  for (let i = 0; i < starCount; i++) {
    const radius = 200 + Math.random() * 600;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);

    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = radius * Math.cos(phi);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 2.0,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.9,
  });

  return new THREE.Points(geometry, material);
}

function createGrid() {
  const gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x222222);
  gridHelper.material.transparent = true;
  gridHelper.material.opacity = 0.4;
  gridHelper.position.y = 0;
  return gridHelper;
}

const ThreeViewer = forwardRef(function ThreeViewer(
  { onLoadSuccess, onLoadError },
  ref,
) {
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const loaderRef = useRef(null);
  const currentModelRef = useRef(null);
  const animationIdRef = useRef(null);

  const cleanMaterial = useCallback((material) => {
    material.dispose();
    for (const key of Object.keys(material)) {
      const value = material[key];
      if (value && typeof value === "object" && "isTexture" in value) {
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

    const maxSize = Math.max(size.x, size.y, size.z);
    const fitHeightDistance =
      maxSize / (2 * Math.atan((Math.PI * camera.fov) / 360));
    const fitWidthDistance = fitHeightDistance / camera.aspect;
    const distance = 1.5 * Math.max(fitHeightDistance, fitWidthDistance);

    const angle = Math.PI / 6;
    const cameraY = center.y + distance * Math.sin(angle);
    const cameraZ = center.z + distance * Math.cos(angle);

    controls.maxDistance = distance * 10;
    controls.object.position.set(center.x, Math.max(cameraY, 1), cameraZ);
    controls.target.copy(center);
    controls.update();
  }, []);

  const clearModel = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene || !currentModelRef.current) return;

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
  }, [cleanMaterial]);

  const loadModel = useCallback(
    (url) => {
      const scene = sceneRef.current;
      const loader = loaderRef.current;
      if (!scene || !loader) return;

      clearModel();

      loader.load(
        url,
        (gltf) => {
          currentModelRef.current = gltf.scene;
          scene.add(gltf.scene);
          frameArea(gltf.scene);
          onLoadSuccess?.();
        },
        undefined,
        (error) => {
          console.error("Error loading GLB:", error);
          onLoadError?.(error);
        },
      );
    },
    [clearModel, frameArea, onLoadSuccess, onLoadError],
  );

  useImperativeHandle(
    ref,
    () => ({
      loadModel,
      clearModel,
    }),
    [loadModel, clearModel],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    sceneRef.current = scene;

    const starfield = createStarfield();
    scene.add(starfield);

    const grid = createGrid();
    scene.add(grid);

    const camera = new THREE.PerspectiveCamera(
      50,
      window.innerWidth / window.innerHeight,
      0.1,
      1000,
    );
    camera.position.set(0, 2, 6);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enablePan = true;
    controls.minDistance = 0.5;
    controls.maxDistance = 100;
    controls.target.set(0, 0.5, 0);
    controls.update();
    controlsRef.current = controls;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 2.0);
    directionalLight.position.set(5, 10, 7);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    const fillLight = new THREE.DirectionalLight(0x4488ff, 0.5);
    fillLight.position.set(-5, 5, -5);
    scene.add(fillLight);

    loaderRef.current = new GLTFLoader();

    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate);
      starfield.rotation.y += 0.0001;
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      renderer.dispose();
      controls.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} className="viewer-canvas" />;
});

export default ThreeViewer;

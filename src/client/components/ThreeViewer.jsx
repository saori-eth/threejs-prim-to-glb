import { useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const ThreeViewer = forwardRef(function ThreeViewer({ onLoadSuccess, onLoadError }, ref) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
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

  const loadModel = useCallback((url) => {
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
        console.error('Error loading GLB:', error);
        onLoadError?.(error);
      }
    );
  }, [clearModel, frameArea, onLoadSuccess, onLoadError]);

  useImperativeHandle(ref, () => ({
    loadModel,
    clearModel,
  }), [loadModel, clearModel]);

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

  return (
    <div className="viewer-container" ref={containerRef}>
      <canvas ref={canvasRef} />
    </div>
  );
});

export default ThreeViewer;

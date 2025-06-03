import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import fs from 'fs';

/**
 * Executes a string of JavaScript code (presumably from an LLM) to generate a THREE.Scene.
 * @param {string} scriptString - The JavaScript code string.
 * @param {object} THREE_Reference - The THREE.js library object.
 * @returns {THREE.Scene} The generated Three.js scene.
 * @throws Will throw an error if the script fails to execute or doesn't return a THREE.Scene.
 */
function generateSceneFromScript(scriptString, THREE_Reference) {
    console.log("[Script Execution] Attempting to generate scene from script.");
    try {
        const sceneGeneratorFunction = new Function('THREE', scriptString);
        const scene = sceneGeneratorFunction(THREE_Reference);

        if (!(scene instanceof THREE_Reference.Scene)) {
            throw new Error("LLM script did not return a valid THREE.Scene object.");
        }
        console.log("[Script Execution] Scene generated successfully.");
        return scene;
    } catch (error) {
        console.error("[Script Execution] Error executing LLM script:", error);
        throw error; // Re-throw the error to be caught by the caller
    }
}

/**
 * Exports a given THREE.Scene object as a GLB file.
 * @param {THREE.Scene} scene - The Three.js scene to export.
 * @param {string} outputPath - The path where the GLB file will be saved.
 */
async function exportSceneToGLB(scene, outputPath) {
    return new Promise((resolve, reject) => {
        const exporter = new GLTFExporter();
        exporter.parse(
            scene,
            function (result) {
                if (result instanceof ArrayBuffer) {
                    const buffer = Buffer.from(result);
                    fs.writeFileSync(outputPath, buffer);
                    console.log(`[GLB Export] GLB file saved to: ${outputPath}`);
                    resolve(outputPath);
                } else {
                    // Fallback for GLTF (JSON format) if result is not ArrayBuffer
                    const output = JSON.stringify(result, null, 2);
                    const gltfPath = outputPath.replace(/\.glb$/i, '.gltf');
                    fs.writeFileSync(gltfPath, output);
                    console.log(`[GLB Export] GLTF (JSON) file saved to: ${gltfPath}`);
                    resolve(gltfPath);
                }
            },
            function (error) {
                console.error('[GLB Export] An error happened during GLTF export:', error);
                reject(error);
            },
            { binary: true } // Options for the exporter, binary for GLB
        );
    });
}

export { generateSceneFromScript, exportSceneToGLB }; 
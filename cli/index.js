import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Determine __dirname in ES module scope
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, '.env');
console.log(`[DEBUG] Attempting to load .env file from: ${envPath}`);

const dotenvResult = dotenv.config({ path: envPath });

if (dotenvResult.error) {
    console.error('[DEBUG] dotenv Error:', dotenvResult.error);
} else {
    console.log('[DEBUG] dotenv loaded variables:', dotenvResult.parsed);
}

console.log('[DEBUG] ANTHROPIC_API_KEY after dotenv.config():', process.env.ANTHROPIC_API_KEY ? 'Loaded' : 'NOT Loaded or Empty');
if (process.env.ANTHROPIC_API_KEY) {
    // console.log('[DEBUG] Loaded key (first 5 chars):', process.env.ANTHROPIC_API_KEY.substring(0, 5)); // Uncomment for more direct debugging if needed, be careful with logging keys
}

// --- BEGIN FileReader Shim ---
import { Blob } from 'buffer'; // Node.js Blob implementation

global.FileReader = class FileReader {
    readAsArrayBuffer(blob) {
        if (!(blob instanceof Blob)) {
            // GLTFExporter might pass ArrayBufferView directly, let's see.
            // For now, strictly check for Blob, or try to make a Blob if it's an ArrayBufferView
            // This part might need adjustment based on what GLTFExporter actually passes.
            if (blob && blob.buffer instanceof ArrayBuffer) { // Heuristic for ArrayBufferView
                blob = new Blob([blob.buffer]);
            } else {
                 console.error("FileReader shim: readAsArrayBuffer expects a Blob or ArrayBufferView.", blob);
                 if (typeof this.onerror === 'function') {
                    this.onerror(new TypeError("Failed to execute 'readAsArrayBuffer' on 'FileReader': parameter 1 is not of type 'Blob'."));
                }
                return;
            }
        }
        blob.arrayBuffer().then(arrayBuffer => {
            this.result = arrayBuffer;
            if (typeof this.onload === 'function') {
                this.onload({ target: this });
            }
            if (typeof this.onloadend === 'function') {
                this.onloadend({ target: this });
            }
        }).catch(err => {
            if (typeof this.onerror === 'function') {
                this.onerror(err);
            }
        });
    }
    // Add other methods if errors indicate they are needed.
    // For example, readAsDataURL:
    /*
    readAsDataURL(blob) {
        if (!(blob instanceof Blob)) {
            if (blob && blob.buffer instanceof ArrayBuffer) { 
                blob = new Blob([blob.buffer]);
            } else {
                console.error("FileReader shim: readAsDataURL expects a Blob or ArrayBufferView.", blob);
                if (typeof this.onerror === 'function') {
                    this.onerror(new TypeError("Failed to execute 'readAsDataURL' on 'FileReader': parameter 1 is not of type 'Blob'."));
                }
                return;
            }
        }
        const reader = new (require('stream').Readable)();
        reader._read = () => {};
        reader.push(Buffer.from(await blob.arrayBuffer()));
        reader.push(null);
        let data = '';
        reader.on('data', chunk => data += chunk.toString('base64'));
        reader.on('end', () => {
            this.result = `data:${blob.type || 'application/octet-stream'};base64,${data}`;
            if (typeof this.onload === 'function') {
                this.onload({ target: this });
            }
            if (typeof this.onloadend === 'function') {
                this.onloadend({ target: this });
            }
        });
        reader.on('error', err => {
             if (typeof this.onerror === 'function') {
                this.onerror(err);
            }
        });
    }
    */
};
// --- END FileReader Shim ---

// CLI tool main entry point
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import fs from 'fs';
import Anthropic from '@anthropic-ai/sdk'; // Import Anthropic SDK

console.log("CLI Tool Started");

// Anthropic client will be initialized inside getScriptFromLLM

/**
 * Generates a Three.js script based on a prompt using the Anthropic API.
 * @param {string} userPrompt - The user's text prompt.
 * @returns {Promise<string>} A promise that resolves to a string of JavaScript code to generate a Three.js scene.
 */
async function getScriptFromLLM(userPrompt) {
    console.log(`[Anthropic] Received prompt: "${userPrompt}"`);
    
    if (!process.env.ANTHROPIC_API_KEY) {
        console.error("[Anthropic] Error: ANTHROPIC_API_KEY environment variable is not set or not loaded from .env.");
        throw new Error("ANTHROPIC_API_KEY is not set. Please check your .env file in the 'cli' directory and ensure it contains: ANTHROPIC_API_KEY=your_key_here");
    }

    const anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const systemPrompt = `
        You are an expert Three.js programmer. Your task is to generate JavaScript code that creates a 3D scene based on a user's textual description.
        Follow these instructions carefully:
        1.  The code you generate must be *only* JavaScript. Do not include any explanatory text, comments outside the code, or markdown formatting like \'\'\'javascript ... \'\'\'.
        2.  The JavaScript code must use Three.js primitives (e.g., BoxGeometry, SphereGeometry, CylinderGeometry, TorusKnotGeometry, MeshBasicMaterial, MeshStandardMaterial, MeshPhongMaterial, etc.) to construct the objects in the scene.
        3.  The code will be executed within a function where the global 'THREE' object (the Three.js library) is already available and in scope. You must use it (e.g., \`new THREE.Scene()\`, \`new THREE.BoxGeometry(...)\`).
        4.  The script *must* create a \`THREE.Scene\` object instance named \`scene\`.
        5.  The script *must* add all generated 3D objects to this \`scene\` instance.
        6.  The script *must* end with the line \`return scene;\` to return the created scene object. No other code should follow this line.
        7.  If the user prompt is vague, make reasonable assumptions to create a visually interesting scene. Include basic lighting if using materials like MeshPhongMaterial or MeshStandardMaterial (e.g., AmbientLight, PointLight, DirectionalLight).
        8.  Focus on creating the geometry and materials. Position objects within the scene as appropriate based on the prompt.

        Example of expected output format for a user prompt like "a red cube and a blue sphere":
        \`\`\`javascript
        const scene = new THREE.Scene();
        const cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
        const cubeMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
        cube.position.x = -1;
        scene.add(cube);
        const sphereGeometry = new THREE.SphereGeometry(0.75, 32, 32);
        const sphereMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff });
        const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        sphere.position.x = 1;
        scene.add(sphere);
        return scene;
        \`\`\`
        Now, generate the JavaScript code for the following user prompt.
    `;

    try {
        console.log("[Anthropic] Sending request to Anthropic API...");
        const response = await anthropic.messages.create({
            model: "claude-opus-4-20250514", 
            max_tokens: 2048, 
            system: systemPrompt,
            messages: [
                { role: "user", content: userPrompt }
            ]
        });

        console.log("[Anthropic] Received response from API.");
        
        let generatedScript = '';
        if (response.content && response.content.length > 0 && response.content[0].type === 'text') {
            generatedScript = response.content[0].text;
        } else {
            throw new Error("Anthropic API did not return the expected text content.");
        }

        generatedScript = generatedScript.replace(/^\s*```javascript\s*|\s*```\s*$/g, '').trim();

        console.log("[Anthropic] Extracted script:\n", generatedScript);
        return generatedScript;

    } catch (error) {
        console.error("[Anthropic] Error calling Anthropic API:", error);
        throw error; 
    }
}

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
                    const output = JSON.stringify(result, null, 2);
                    fs.writeFileSync(outputPath.replace('.glb', '.gltf'), output);
                    console.log(`[GLB Export] GLTF (JSON) file saved to: ${outputPath.replace('.glb', '.gltf')}`);
                    resolve(outputPath.replace('.glb', '.gltf'));
                }
            },
            function (error) {
                console.error('[GLB Export] An error happened during GLTF export:', error);
                reject(error);
            },
            { binary: true }
        );
    });
}

async function main() {
    const argv = yargs(hideBin(process.argv))
        .option('prompt', {
            alias: 'p',
            type: 'string',
            description: 'Text prompt describing the 3D scene to generate',
            demandOption: true, 
        })
        .example('$0 --prompt "a red cube next to a blue sphere"' , 'Generate a scene with a red cube and a blue sphere')
        .help()
        .alias('help', 'h')
        .argv;

    const userPrompt = argv.prompt;
    console.log(`User prompt: ${userPrompt}`);

    const outputDir = path.join(process.cwd(), '..', 'glb');
    const sanitizedPrompt = userPrompt.toLowerCase().replace(/[^a-z0-9_\s-]/g, '').replace(/\s+/g, '_');
    const outputFileName = `${sanitizedPrompt || 'scene'}.glb`;
    const fullOutputPath = path.join(outputDir, outputFileName);
    console.log(`Output will be saved to: ${fullOutputPath}`);

    try {
        const llmScript = await getScriptFromLLM(userPrompt);
        const scene = generateSceneFromScript(llmScript, THREE);
        await exportSceneToGLB(scene, fullOutputPath);
        console.log("GLB generation process completed successfully.");
    } catch (error) {
        console.error("Failed in main generation pipeline:", error);
        process.exit(1); // Ensure cli exits with error code on failure
    }
}

main().catch(error => {
    // This catch might be redundant if main already handles its errors and exits,
    // but it's good for any top-level unhandled promise rejections from main itself.
    console.error("CLI execution failed at the very top level:", error);
    process.exit(1);
}); 
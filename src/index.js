import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { initializeFileReaderShim } from './utils/fileReaderShim.js';

// Initialize the FileReader shim
initializeFileReaderShim();

// Determine __dirname in ES module scope
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, '..', '.env');
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
// import { Blob } from 'buffer'; // Node.js Blob implementation

// global.FileReader = class FileReader { ... }; // REMOVE THIS ENTIRE BLOCK
// --- END FileReader Shim ---

// CLI tool main entry point
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import * as THREE from 'three';
import { getScriptFromLLM } from './llm-utils.js'; // Import the new LLM utility
import { generateSceneFromScript, exportSceneToGLB } from './three-utils.js'; // Added

console.log("CLI Tool Started");

// Anthropic client and getScriptFromLLM are now in llm-utils.js

/**
 * Exports a given THREE.Scene object as a GLB file.
 * @param {THREE.Scene} scene - The Three.js scene to export.
 * @param {string} outputPath - The path where the GLB file will be saved.
 */
// async function exportSceneToGLB(scene, outputPath) { ... } // Removed

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

    const outputDir = path.resolve(__dirname, '..', 'glb');

    try {
        const llmResponse = await getScriptFromLLM(userPrompt);

        const sanitizedFilename = (llmResponse.filename || 'scene').toLowerCase().replace(/[^a-z0-9_\s-]/g, '').replace(/\s+/g, '_');
        const outputFileName = `${sanitizedFilename}.glb`;
        const fullOutputPath = path.join(outputDir, outputFileName);
        console.log(`LLM suggested filename (sanitized): ${sanitizedFilename}`);
        console.log(`Output will be saved to: ${fullOutputPath}`);

        if (!fs.existsSync(outputDir)){
            fs.mkdirSync(outputDir, { recursive: true });
            console.log(`Created output directory: ${outputDir}`);
        }

        const scene = generateSceneFromScript(llmResponse.script, THREE);
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
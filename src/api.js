import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import helmet from 'helmet';

// Determine __dirname in ES module scope early for .env loading
const __filenameES = fileURLToPath(import.meta.url);
const __dirnameES = path.dirname(__filenameES);

// Load .env file as early as possible
const envPath = path.resolve(__dirnameES, '../.env');
const dotenvResult = dotenv.config({ path: envPath });

if (dotenvResult.error) {
    console.warn('[API DEBUG] dotenv Error (API):', dotenvResult.error.message);
} else {
    console.log('[API DEBUG] dotenv loaded variables (API):', Object.keys(dotenvResult.parsed || {}));
}
console.log('[API DEBUG] ANTHROPIC_API_KEY after dotenv.config() in API:', process.env.ANTHROPIC_API_KEY ? 'Loaded' : 'NOT Loaded or Empty');

import express from 'express';
import fs from 'fs';
import * as THREE from 'three';
import { getScriptFromLLM, AVAILABLE_MODELS, DEFAULT_MODEL_ID, getRefinedScriptFromLLM } from './llm-utils.js';
import { generateSceneFromScript, exportSceneToGLB } from './three-utils.js';
import { initializeFileReaderShim } from './utils/fileReaderShim.js';

// Initialize the FileReader shim
initializeFileReaderShim();

// Now __dirname can be reused or redefined if necessary, but __dirnameES is specific to ES module context for .env
const __filename = __filenameES; 
const __dirname = __dirnameES;

const app = express();

// Configure Helmet with custom CSP
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        'script-src': [
          "'self'",
          "'sha256-tTZ5O9wshl11CSlNgJJuNUnFjr7jT4WpdewXaLALVec='", // Hash for importmap
          "'sha256-sNN9FkwOz6soEhkd9E5gOG6G0cVbCL0WmViCYi8Znb0='", // Hash for main module script
          "https://cdn.jsdelivr.net" // Allow scripts from Three.js CDN
        ],
        'worker-src': ["'self'", "blob:", "https://cdn.jsdelivr.net"], // Allow workers from self, blobs, and CDN
        'img-src': ["'self'", "data:"], // Allow images from self and data URIs
        'connect-src': ["'self'", "blob:"], // Allow connections to self and blob URIs
        // Add other directives as needed, for example:
        // 'style-src': ["'self'", "'unsafe-inline'"], // If you have inline styles you can't easily move
      },
    },
  })
);

const port = process.env.PORT || 3000;

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, '../public')));

app.use(express.json()); // Middleware to parse JSON bodies

// Temporary directory for GLB files
const tempGlbDir = path.join(__dirname, 'temp_glb_files');
if (!fs.existsSync(tempGlbDir)) {
    fs.mkdirSync(tempGlbDir, { recursive: true });
}

app.post('/generate-scene', async (req, res) => {
    const { prompt, modelId: requestedModelId } = req.body;
    const modelId = AVAILABLE_MODELS.hasOwnProperty(requestedModelId) ? requestedModelId : DEFAULT_MODEL_ID;

    if (!prompt) {
        return res.status(400).send({ error: 'Prompt is required' });
    }

    console.log(`API Request - User prompt: ${prompt}, Model: ${modelId}`);

    try {
        const llmResponse = await getScriptFromLLM(prompt, modelId);

        // Generate a unique filename to avoid conflicts if multiple requests happen
        // And also to make it easier to clean up later if needed.
        const uniqueId = Date.now() + '-' + Math.random().toString(36).substring(2, 9);
        const sanitizedFilenameBase = (llmResponse.filename || 'scene').toLowerCase().replace(/[^a-z0-9_\s-]/g, '').replace(/\s+/g, '_');
        const outputFileName = `${sanitizedFilenameBase}-${uniqueId}.glb`;
        const fullOutputPath = path.join(tempGlbDir, outputFileName);

        console.log(`LLM suggested filename (sanitized base): ${sanitizedFilenameBase}`);
        console.log(`LLM script content (first 100 chars): ${llmResponse.script.substring(0,100)}`);
        console.log(`Temporary GLB will be saved to: ${fullOutputPath}`);

        const scene = generateSceneFromScript(llmResponse.script, THREE);
        await exportSceneToGLB(scene, fullOutputPath);

        console.log(`GLB generated successfully at: ${fullOutputPath}`);

        // Set headers for the script and original filename
        res.setHeader('X-Generated-Script', encodeURIComponent(llmResponse.script));
        res.setHeader('X-Generated-Filename', encodeURIComponent(llmResponse.filename));

        // Send the file back and then delete it
        res.sendFile(fullOutputPath, (err) => {
            if (err) {
                console.error('Error sending file:', err);
                // Avoid sending another response if headers already sent
                if (!res.headersSent) {
                    res.status(500).send({ error: 'Failed to send GLB file.' });
                }
            } else {
                console.log('File sent successfully. Deleting temporary file.');
            }
            // Clean up the temporary file
            fs.unlink(fullOutputPath, (unlinkErr) => {
                if (unlinkErr) {
                    console.error('Error deleting temporary file:', unlinkErr);
                } else {
                    console.log('Temporary file deleted successfully.');
                }
            });
        });

    } catch (error) {
        console.error("Failed in API generation pipeline:", error);
        if (!res.headersSent) {
            res.status(500).send({ error: 'Failed to generate 3D scene.' });
        }
    }
});

app.post('/refine-scene', async (req, res) => {
    const { originalScript, refinementPrompt, modelId: requestedModelId } = req.body;
    const modelId = AVAILABLE_MODELS.hasOwnProperty(requestedModelId) ? requestedModelId : DEFAULT_MODEL_ID;

    if (!originalScript || !refinementPrompt) {
        return res.status(400).send({ error: 'Original script and refinement prompt are required' });
    }

    console.log(`API Refinement Request - Model: ${modelId}`);
    // Avoid logging the full originalScript if it's very long
    console.log(`API Refinement Request - Refinement prompt: ${refinementPrompt}`);

    try {
        const llmResponse = await getRefinedScriptFromLLM(originalScript, refinementPrompt, modelId);

        const uniqueId = Date.now() + '-' + Math.random().toString(36).substring(2, 9);
        const sanitizedFilenameBase = (llmResponse.filename || 'scene_refined').toLowerCase().replace(/[^a-z0-9_\s-]/g, '').replace(/\s+/g, '_');
        const outputFileName = `${sanitizedFilenameBase}-${uniqueId}.glb`;
        const fullOutputPath = path.join(tempGlbDir, outputFileName);

        console.log(`LLM suggested filename for refinement (sanitized base): ${sanitizedFilenameBase}`);
        console.log(`Refined LLM script content (first 100 chars): ${llmResponse.script.substring(0,100)}`);
        console.log(`Temporary refined GLB will be saved to: ${fullOutputPath}`);

        const scene = generateSceneFromScript(llmResponse.script, THREE);
        await exportSceneToGLB(scene, fullOutputPath);

        console.log(`Refined GLB generated successfully at: ${fullOutputPath}`);

        res.setHeader('X-Generated-Script', encodeURIComponent(llmResponse.script));
        res.setHeader('X-Generated-Filename', encodeURIComponent(llmResponse.filename));

        res.sendFile(fullOutputPath, (err) => {
            if (err) {
                console.error('Error sending refined file:', err);
                if (!res.headersSent) {
                    res.status(500).send({ error: 'Failed to send refined GLB file.' });
                }
            } else {
                console.log('Refined file sent successfully. Deleting temporary file.');
            }
            fs.unlink(fullOutputPath, (unlinkErr) => {
                if (unlinkErr) {
                    console.error('Error deleting temporary refined file:', unlinkErr);
                } else {
                    console.log('Temporary refined file deleted successfully.');
                }
            });
        });

    } catch (error) {
        console.error("Failed in API refinement pipeline:", error);
        if (!res.headersSent) {
            res.status(500).send({ error: 'Failed to refine 3D scene.' });
        }
    }
});

// Health check endpoint
app.get('/healthz', (req, res) => {
  res.status(200).send('OK');
});

app.listen(port, () => {
    console.log(`Express API server listening on port ${port}`);
    console.log(`Try: curl -X POST http://localhost:${port}/generate-scene -H "Content-Type: application/json" -d '{"prompt":"a red cube"}'`);
});

// Basic error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    if (!res.headersSent) {
        res.status(500).send('Something broke!');
    }
});

// Handle SIGINT (Ctrl+C) for cleanup if needed in the future
process.on('SIGINT', () => {
    console.log('\nGracefully shutting down from SIGINT (Ctrl-C)');
    // Perform cleanup if necessary
    // For example, clear the temp_glb_files directory
    // fs.rmSync(tempGlbDir, { recursive: true, force: true }); // Be careful with this
    process.exit(0);
});

// Ensure .env is loaded for the API as well, if not already handled globally
// This might be redundant if your llm-utils or other parts already ensure dotenv runs.
// Consider if a more centralized .env loading strategy is needed.
// import dotenv from 'dotenv'; // MOVED TO TOP
// const envPath = path.resolve(__dirname, '.env'); // MOVED TO TOP
// const dotenvResult = dotenv.config({ path: envPath }); // MOVED TO TOP

// if (dotenvResult.error) { ... } // MOVED TO TOP
// console.log('[API DEBUG] ANTHROPIC_API_KEY after dotenv.config() in API:', ...); // MOVED TO TOP 
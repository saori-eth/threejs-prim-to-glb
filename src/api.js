import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

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
import { getScriptFromLLM } from './llm-utils.js';
import { generateSceneFromScript, exportSceneToGLB } from './three-utils.js';
import { initializeFileReaderShim } from './utils/fileReaderShim.js';

// Initialize the FileReader shim
initializeFileReaderShim();

// Now __dirname can be reused or redefined if necessary, but __dirnameES is specific to ES module context for .env
const __filename = __filenameES; 
const __dirname = __dirnameES;

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json()); // Middleware to parse JSON bodies

// Temporary directory for GLB files
const tempGlbDir = path.join(__dirname, 'temp_glb_files');
if (!fs.existsSync(tempGlbDir)) {
    fs.mkdirSync(tempGlbDir, { recursive: true });
}

app.post('/generate-scene', async (req, res) => {
    const { prompt } = req.body;

    if (!prompt) {
        return res.status(400).send({ error: 'Prompt is required' });
    }

    console.log(`API Request - User prompt: ${prompt}`);

    try {
        const llmResponse = await getScriptFromLLM(prompt);

        // Generate a unique filename to avoid conflicts if multiple requests happen
        // And also to make it easier to clean up later if needed.
        const uniqueId = Date.now() + '-' + Math.random().toString(36).substring(2, 9);
        const sanitizedFilenameBase = (llmResponse.filename || 'scene').toLowerCase().replace(/[^a-z0-9_\s-]/g, '').replace(/\s+/g, '_');
        const outputFileName = `${sanitizedFilenameBase}-${uniqueId}.glb`;
        const fullOutputPath = path.join(tempGlbDir, outputFileName);

        console.log(`LLM suggested filename (sanitized base): ${sanitizedFilenameBase}`);
        console.log(`Temporary GLB will be saved to: ${fullOutputPath}`);

        const scene = generateSceneFromScript(llmResponse.script, THREE);
        await exportSceneToGLB(scene, fullOutputPath);

        console.log(`GLB generated successfully at: ${fullOutputPath}`);

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
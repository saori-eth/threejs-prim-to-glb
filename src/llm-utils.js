import Anthropic from '@anthropic-ai/sdk';

export const AVAILABLE_MODELS = {
    "claude-opus-4-20250514": "Claude Opus 4 (20250514)",
    "claude-sonnet-4-20250514": "Claude Sonnet 4 (20250514)",
    "claude-3-7-sonnet-20250219": "Claude Sonnet 3.7 (20250219)",
    "claude-3-5-haiku-20241022": "Claude Haiku 3.5 (20241022)", // Assuming specific date for clarity
    "claude-3-5-sonnet-20241022": "Claude Sonnet 3.5 v2 (20241022)", // Assuming specific date for clarity
    "claude-3-5-sonnet-20240620": "Claude Sonnet 3.5 (20240620)",
    "claude-3-opus-20240229": "Claude Opus 3 (20240229)",
    "claude-3-sonnet-20240229": "Claude Sonnet 3 (20240229)",
    "claude-3-haiku-20240307": "Claude Haiku 3 (20240307)"
};

export const DEFAULT_MODEL_ID = "claude-3-5-sonnet-20240620";

// Note: It's assumed that dotenv.config() has been called in the entry point of the application (e.g., cli/index.js)
// to load ANTHROPIC_API_KEY into process.env.

/**
 * Generates a Three.js script based on a prompt using the Anthropic API.
 * @param {string} userPrompt - The user's text prompt.
 * @param {string} [modelId] - The ID of the Anthropic model to use. Defaults to DEFAULT_MODEL_ID.
 * @returns {Promise<{script: string, filename: string}>} A promise that resolves to an object containing the JavaScript code and a suggested filename.
 */
export async function getScriptFromLLM(userPrompt, modelId = DEFAULT_MODEL_ID) {
    console.log(`[Anthropic Service] Received prompt: "${userPrompt}" for model: ${modelId}`);

    if (!process.env.ANTHROPIC_API_KEY) {
        console.error("[Anthropic Service] Error: ANTHROPIC_API_KEY environment variable is not set or not loaded.");
        // It's crucial to also ensure .env is in the correct location relative to where the app is run,
        // or that ANTHROPIC_API_KEY is set directly in the environment.
        // For this CLI, .env should be in the 'cli' directory.
        throw new Error("ANTHROPIC_API_KEY is not set. Please ensure it's available in the environment or loaded via a .env file in the 'cli' directory (e.g., ANTHROPIC_API_KEY=your_key_here).");
    }

    const anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const systemPrompt = `
        You are an expert Three.js programmer. Generate JavaScript code for a 3D scene based on a user's description and suggest a suitable filename.
        Follow these instructions carefully:
        1.  Your response *must* be a single JSON object with two keys: "script" and "filename".
        2.  The "script" value must be a string containing *only* JavaScript code for Three.js. No explanatory text, external comments, or markdown.
        3.  The JavaScript code string *must* be properly escaped for JSON (e.g., newlines as \\\\n, tabs as \\\\t, backslashes as \\\\\\\\).
        4.  The JavaScript code must use Three.js primitives (e.g., BoxGeometry, SphereGeometry, CylinderGeometry, TorusKnotGeometry, MeshBasicMaterial, MeshStandardMaterial, MeshPhongMaterial) to construct scene objects.
        5.  **Do NOT add any lights to the scene.** Focus on geometry, meshes, and groups.
        6.  **Naming Objects**: Assign a descriptive \`name\` property to all significant 3D objects (\`THREE.Mesh\`, \`THREE.Group\`). Example: \`const mySphere = new THREE.Mesh(geometry, material); mySphere.name = 'user_sphere_01'; scene.add(mySphere);\`. Names should be simple, lowercase, with underscores for spaces (e.g., 'red_spinning_cube').
        7.  The code runs in a function where 'THREE' (Three.js library) is global. Use it (e.g., \`new THREE.Scene()\`, \`new THREE.BoxGeometry(...)\`).
        8.  The script *must* create a \`THREE.Scene\` instance named \`scene\`.
        9.  All generated 3D objects *must* be added to this \`scene\`.
        10. The script *must* end with \`return scene;\`. No code should follow.
        11. The "filename" must be a short, descriptive, URL-friendly string (e.g., "red_cube_blue_sphere", "futuristic_city_dawn"), without an extension.
        12. If the prompt is vague, make reasonable assumptions for a visually interesting scene using materials like MeshPhongMaterial or MeshStandardMaterial.

        Example of expected output format for "a red cube and a blue sphere":
        \`\`\`json
        {
          "script": "const scene = new THREE.Scene();\\\\nconst cubeGeometry = new THREE.BoxGeometry(1, 1, 1);\\\\nconst cubeMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });\\\\nconst cube = new THREE.Mesh(cubeGeometry, cubeMaterial);\\\\ncube.name = 'red_cube_01';\\\\ncube.position.x = -1;\\\\nscene.add(cube);\\\\nconst sphereGeometry = new THREE.SphereGeometry(0.75, 32, 32);\\\\nconst sphereMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff });\\\\nconst sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);\\\\nsphere.name = 'blue_sphere_01';\\\\nsphere.position.x = 1;\\\\nscene.add(sphere);\\\\nreturn scene;",
          "filename": "red_cube_blue_sphere"
        }
        \`\`\`
        Now, generate the JSON response for the following user prompt.
    `;

    try {
        console.log(`[Anthropic Service] Sending request to Anthropic API using model ${modelId}...`);
        const response = await anthropic.messages.create({
            model: modelId, // Use the provided or default modelId
            max_tokens: 2048, // Consider making max_tokens configurable
            system: systemPrompt,
            messages: [
                { role: "user", content: userPrompt }
            ]
        });

        console.log("[Anthropic Service] Received response from API.");

        let rawResponseText = '';
        if (response.content && response.content.length > 0 && response.content[0].type === 'text') {
            rawResponseText = response.content[0].text;
        } else {
            console.error("[Anthropic Service] Anthropic API did not return the expected text content. Response:", response);
            throw new Error("Anthropic API did not return the expected text content.");
        }
        
        // Attempt to find JSON block if markdown is present
        const jsonMatch = rawResponseText.match(/```json\n([\s\S]*?)\n```/);
        let jsonResponseString;
        if (jsonMatch && jsonMatch[1]) {
            jsonResponseString = jsonMatch[1];
            console.log("[Anthropic Service] Extracted JSON from markdown block.");
        } else {
            jsonResponseString = rawResponseText.trim();
            console.log("[Anthropic Service] Assuming entire response is JSON (no markdown block found).");
        }
        
        console.log("[Anthropic Service] Raw JSON string from LLM:", jsonResponseString);

        let parsedResponse;
        try {
            parsedResponse = JSON.parse(jsonResponseString);
        } catch (error) {
            console.error("[Anthropic Service] Failed to parse JSON response from LLM. Raw string:", jsonResponseString, "Error:", error);
            throw new Error(`Failed to parse LLM response as JSON. Response was: ${jsonResponseString}`);
        }

        if (!parsedResponse || typeof parsedResponse.script !== 'string' || typeof parsedResponse.filename !== 'string') {
            console.error("[Anthropic Service] LLM response JSON is malformed or missing 'script'/'filename' keys. Parsed:", parsedResponse);
            throw new Error("LLM response JSON is missing 'script' or 'filename' string keys.");
        }
        
        console.log("[Anthropic Service] Extracted script successfully.");
        console.log("[Anthropic Service] Extracted filename:", parsedResponse.filename);
        return { script: parsedResponse.script, filename: parsedResponse.filename };

    } catch (error) {
        console.error("[Anthropic Service] Error during Anthropic API call or processing:", error);
        // Re-throw the error so the caller can handle it. 
        // Add more specific error context if possible.
        if (error.message && error.message.includes("ANTHROPIC_API_KEY")) {
             throw error; // Already specific
        }
        throw new Error(`Anthropic service failed: ${error.message}`);
    }
}

/**
 * Generates a refined Three.js script based on an original script and a user's refinement prompt using the Anthropic API.
 * @param {string} originalScript - The original JavaScript code for the Three.js scene.
 * @param {string} userRefinementPrompt - The user's text prompt describing modifications.
 * @param {string} [modelId] - The ID of the Anthropic model to use. Defaults to DEFAULT_MODEL_ID.
 * @returns {Promise<{script: string, filename: string}>} A promise that resolves to an object containing the new JavaScript code and a suggested filename.
 */
export async function getRefinedScriptFromLLM(originalScript, userRefinementPrompt, modelId = DEFAULT_MODEL_ID) {
    console.log(`[Anthropic Refinement Service] Received original script and refinement prompt: "${userRefinementPrompt}" for model: ${modelId}`);

    if (!process.env.ANTHROPIC_API_KEY) {
        console.error("[Anthropic Refinement Service] Error: ANTHROPIC_API_KEY environment variable is not set or not loaded.");
        throw new Error("ANTHROPIC_API_KEY is not set.");
    }

    const anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const systemPrompt = `
        You are an expert Three.js programmer. Modify an existing Three.js script based on a user's textual description of changes, and suggest a suitable filename.
        Follow these instructions carefully:
        1.  Your response *must* be a single JSON object with two keys: "script" and "filename".
        2.  The "script" value must be a string containing *only* the *complete, new* JavaScript code for Three.js. No explanatory text, external comments, or markdown.
        3.  The JavaScript code string *must* be properly escaped for JSON (e.g., newlines as \\\\n, tabs as \\\\t, backslashes as \\\\\\\\).
        4.  The new JavaScript code must be a full, runnable script, incorporating the user's requested changes into the original script.
        5.  **Do NOT add any new lights to the scene.** Focus on modifying/adding geometry, meshes, and groups. If the original script contained lights and the user's request does not involve altering them, preserve those existing lights. However, do not introduce new light sources unless explicitly requested.
        6.  **Naming Objects**: Assign/update a descriptive \`name\` property for significant 3D objects you create or modify (\`THREE.Mesh\`, \`THREE.Group\`). Example: \`const mySphere = new THREE.Mesh(geometry, material); mySphere.name = 'user_sphere_01'; scene.add(mySphere);\`. Names should be simple, lowercase, with underscores for spaces (e.g., 'blue_modified_cube'). Preserve existing names if objects are not significantly altered unless the refinement implies a name change.
        7.  The code runs in a function where 'THREE' (Three.js library) is global. Use it (e.g., \`new THREE.Scene()\`, \`new THREE.BoxGeometry(...)\`).
        8.  The script *must* create or use an existing \`THREE.Scene\` instance named \`scene\`.
        9.  All generated/modified 3D objects *must* be part of this \`scene\`.
        10. The script *must* end with \`return scene;\`. No code should follow.
        11. The "filename" must be a short, descriptive, URL-friendly string (e.g., "red_cube_with_stripes", "city_at_night"), reflecting the refined scene, without an extension.
        12. If the prompt is vague, make reasonable assumptions. Preserve existing elements from the original script unless the refinement prompt explicitly asks to remove or change them.

        Example of expected output format:
        Suppose the original script created a red cube, and the user asks "make the cube blue and add a small green sphere next to it".
        The "script" value in your JSON response would be the *complete new script* for a blue cube and a green sphere, with newlines escaped as \\\\n.
        The "filename" might be "blue_cube_green_sphere".

        \`\`\`json
        {
          "script": "const scene = new THREE.Scene();\\\\n// ... (code for blue cube, e.g., cube.name = 'blue_cube_mod_01') ...\\\\n// ... (code for green sphere, e.g., sphere.name = 'green_sphere_new_01') ...\\\\nreturn scene;",
          "filename": "blue_cube_green_sphere"
        }
        \`\`\`
        Now, generate the JSON response for the following original script and user refinement request.
    `;

    try {
        console.log(`[Anthropic Refinement Service] Sending request to Anthropic API using model ${modelId}...`);
        const response = await anthropic.messages.create({
            model: modelId,
            max_tokens: 3072, // Increased max_tokens slightly for potentially longer refined scripts
            system: systemPrompt,
            messages: [
                {
                    role: "user",
                    content: `Here is the original Three.js script that needs modification:\\n\`\`\`javascript\\n${originalScript}\\n\`\`\`\\n\\nHere is my request to modify it: ${userRefinementPrompt}`
                }
            ]
        });

        console.log("[Anthropic Refinement Service] Received response from API.");

        let rawResponseText = '';
        if (response.content && response.content.length > 0 && response.content[0].type === 'text') {
            rawResponseText = response.content[0].text;
        } else {
            console.error("[Anthropic Refinement Service] Anthropic API did not return the expected text content. Response:", response);
            throw new Error("Anthropic API did not return the expected text content for refinement.");
        }
        
        const jsonMatch = rawResponseText.match(/```json\n([\\s\\S]*?)\\n```/);
        let jsonResponseString;
        if (jsonMatch && jsonMatch[1]) {
            jsonResponseString = jsonMatch[1];
            console.log("[Anthropic Refinement Service] Extracted JSON from markdown block.");
        } else {
            jsonResponseString = rawResponseText.trim();
            console.log("[Anthropic Refinement Service] Assuming entire response is JSON (no markdown block found for refinement).");
        }
        
        console.log("[Anthropic Refinement Service] Raw JSON string from LLM:", jsonResponseString);

        let parsedResponse;
        try {
            parsedResponse = JSON.parse(jsonResponseString);
        } catch (error) {
            console.error("[Anthropic Refinement Service] Failed to parse JSON response from LLM. Raw string:", jsonResponseString, "Error:", error);
            throw new Error(`Failed to parse LLM response for refinement as JSON. Response was: ${jsonResponseString}`);
        }

        if (!parsedResponse || typeof parsedResponse.script !== 'string' || typeof parsedResponse.filename !== 'string') {
            console.error("[Anthropic Refinement Service] LLM response JSON is malformed or missing 'script'/'filename' keys. Parsed:", parsedResponse);
            throw new Error("LLM response JSON for refinement is missing 'script' or 'filename' string keys.");
        }
        
        console.log("[Anthropic Refinement Service] Extracted refined script successfully.");
        console.log("[Anthropic Refinement Service] Extracted new filename:", parsedResponse.filename);
        return { script: parsedResponse.script, filename: parsedResponse.filename };

    } catch (error) {
        console.error("[Anthropic Refinement Service] Error during Anthropic API call or processing:", error);
        if (error.message && error.message.includes("ANTHROPIC_API_KEY")) {
             throw error;
        }
        throw new Error(`Anthropic refinement service failed: ${error.message}`);
    }
} 
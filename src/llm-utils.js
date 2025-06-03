import Anthropic from '@anthropic-ai/sdk';

// Note: It's assumed that dotenv.config() has been called in the entry point of the application (e.g., cli/index.js)
// to load ANTHROPIC_API_KEY into process.env.

/**
 * Generates a Three.js script based on a prompt using the Anthropic API.
 * @param {string} userPrompt - The user's text prompt.
 * @returns {Promise<{script: string, filename: string}>} A promise that resolves to an object containing the JavaScript code and a suggested filename.
 */
export async function getScriptFromLLM(userPrompt) {
    console.log(`[Anthropic Service] Received prompt: "${userPrompt}"`);

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
        You are an expert Three.js programmer. Your task is to generate JavaScript code that creates a 3D scene based on a user's textual description, and also suggest a suitable filename for the output.
        Follow these instructions carefully:
        1.  Your response *must* be a single JSON object.
        2.  The JSON object must have two keys: "script" and "filename".
        3.  The value of "script" must be a string containing *only* JavaScript code for Three.js. Do not include any explanatory text, comments outside the code, or markdown formatting like \\\`\\\`\\\`javascript ... \\\`\\\`\\\` within this script string.
        4.  The JavaScript code must use Three.js primitives (e.g., BoxGeometry, SphereGeometry, CylinderGeometry, TorusKnotGeometry, MeshBasicMaterial, MeshStandardMaterial, MeshPhongMaterial, etc.) to construct the objects in the scene.
        5.  The code will be executed within a function where the global 'THREE' object (the Three.js library) is already available and in scope. You must use it (e.g., \`new THREE.Scene()\`, \`new THREE.BoxGeometry(...)\`).
        6.  The script *must* create a \`THREE.Scene\` object instance named \`scene\`.
        7.  The script *must* add all generated 3D objects to this \`scene\` instance.
        8.  The script *must* end with the line \`return scene;\` to return the created scene object. No other code should follow this line.
        9.  The value of "filename" must be a short, descriptive, URL-friendly string (e.g., "red_cube_blue_sphere", "futuristic_city_dawn"). This filename should not include any extension.
        10. If the user prompt is vague, make reasonable assumptions to create a visually interesting scene. Include basic lighting if using materials like MeshPhongMaterial or MeshStandardMaterial (e.g., AmbientLight, PointLight, DirectionalLight).

        Example of expected output format for a user prompt like "a red cube and a blue sphere":
        \`\`\`json
        {
          "script": "const scene = new THREE.Scene();\\nconst cubeGeometry = new THREE.BoxGeometry(1, 1, 1);\\nconst cubeMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });\\nconst cube = new THREE.Mesh(cubeGeometry, cubeMaterial);\\ncube.position.x = -1;\\nscene.add(cube);\\nconst sphereGeometry = new THREE.SphereGeometry(0.75, 32, 32);\\nconst sphereMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff });\\nconst sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);\\nsphere.position.x = 1;\\nscene.add(sphere);\\nreturn scene;",
          "filename": "red_cube_blue_sphere"
        }
        \`\`\`
        Now, generate the JSON response for the following user prompt.
    `;

    try {
        console.log("[Anthropic Service] Sending request to Anthropic API...");
        const response = await anthropic.messages.create({
            model: "claude-opus-4-20250514", // Consider making model configurable
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
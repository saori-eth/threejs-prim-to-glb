# Project Title

## Overview

This application generates 3D objects using AI. It can be controlled via a Command Line Interface (CLI) or an Express.js API. The core functionality involves prompting an LLM (Claude Opus 4 via Anthropic API) to generate a Three.js script, which is then used to create a 3D object headlessly. This object is subsequently transformed into a GLB format. 

## Features

- **Dual Interface**: Usable as a CLI tool or an Express.js API.
- **AI-Powered 3D Generation**: Leverages Claude Opus 4 to generate Three.js scripts for 3D objects based on user prompts.
- **Headless Rendering**: Creates 3D objects without requiring a graphical interface.
- **GLB Export**: Transforms generated objects into the widely-compatible GLB format.
- **Flexible Output**: Saves GLB files locally when using the CLI, or returns them via HTTP response when using the API.
- **Web Interface**: Provides a user-friendly web page (`public/index.html`) for easier prompting, real-time 3D object viewing, downloading, and selection of different Anthropic models when using the API.

## Tech Stack

- **LLM**: Claude Opus 4 (Anthropic API)
- **3D Graphics**: Three.js
- **Backend (API)**: Express.js
- **CLI**: yargs
- **Language**: JavaScript (ES Modules)

## Prerequisites

- Node.js (version 18.0.0 or higher, as specified in `package.json`)
- npm (comes with Node.js)
- An Anthropic API Key

## Installation

1. **Clone the repository:**
   ```bash
   git clone <your-repository-url>
   cd <repository-name>
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   Create a `.env` file in the root of the project and add your Anthropic API key:
   ```
   ANTHROPIC_API_KEY=your_api_key_here
   ```

## Usage

### CLI

To generate a 3D object using the CLI:

```bash
node src/index.js --prompt "Your detailed prompt for the 3D object" [--output path/to/your/object.glb]
```

- `--prompt`: (Required) A textual description of the 3D object you want to generate.
- `--output`: (Optional) The file path where the generated GLB object will be saved. Defaults to `output.glb` in the project root or a predefined directory.

*(Please adjust the exact command and options based on your `yargs` setup in `src/index.js`)*

### API

1. **Start the API server:**
   ```bash
   npm run api
   ```
   The server will typically start on `http://localhost:3000` (or as configured). Once the server is running, you can also access a helper web interface by navigating to `http://localhost:3000/` in your browser. This interface allows for easier prompting, viewing of the generated 3D model, downloading the GLB file, and selecting different Anthropic models.

2. **Send a request to the generation endpoint (or use the web interface):**

   **Endpoint:** `POST /generate-3d`

   **Request Body:** (JSON)
   ```json
   {
     "prompt": "Your detailed prompt for the 3D object"
   }
   ```

   **Success Response:** (200 OK)
   - Content-Type: `model/gltf-binary`
   - Body: The GLB file data.

   **Error Response:** (e.g., 400 Bad Request, 500 Internal Server Error)
   - Content-Type: `application/json`
   - Body:
     ```json
     {
       "error": "Error message describing the issue"
     }
     ```

*(Please adjust the endpoint, port, and request/response structure based on your Express API setup in `src/api.js`)*

## Environment Variables

- `ANTHROPIC_API_KEY`: Your API key for the Anthropic (Claude) service. This is required for the LLM to function.
- `PORT`: (Optional) The port on which the Express API server will listen. Defaults to `3000` if not set. *(Adjust if your default is different or if it's configurable via `.env`)*

# LLM-Powered 3D Object Generator

This project aims to generate 3D objects (as .glb files) from text prompts using an LLM to create Three.js scripts.

## Project Outline

1.  **CLI Tool for Prompts:**
    *   A command-line interface to accept user text prompts.
2.  **LLM Interaction:**
    *   The CLI tool will send the prompt to an LLM provider.
    *   The LLM will be instructed to generate a JavaScript script that uses Three.js primitives to construct 3D objects based on the prompt.
3.  **Script Execution & Object Generation:**
    *   A Node.js environment will execute the LLM-generated Three.js script.
    *   This script will build the 3D objects in memory. No rendering to screen is required at this stage.
4.  **Export to GLB:**
    *   The in-memory Three.js scene/objects will be exported as a `.glb` file.
    *   Exported files will be saved to the `glb/` directory.
5.  **Three.js Client:**
    *   A simple web-based Three.js client to load and view the generated `.glb` files from the `glb/` directory.

## Directory Structure

```
.
├── cli/                # CLI tool for prompt input and LLM interaction
├── client/             # Three.js client for viewing GLB files
├── glb/                # Output directory for exported .glb files
├── scripts/            # To store LLM-generated scripts or helper scripts
├── src/                # (Optional) Shared utilities or core logic
├── .gitignore
├── package.json        # Project-level scripts and workspace config (if any)
└── README.md
``` 
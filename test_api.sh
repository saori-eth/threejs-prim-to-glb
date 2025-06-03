#!/bin/bash

# Script to test the 3D scene generation API

# Define the output directory relative to the script's location (project root)
OUTPUT_DIR="glb"
# Create the output directory if it doesn't exist
mkdir -p "$OUTPUT_DIR"

# Define the prompt
PROMPT="a green cylinder"

# Generate a unique filename using a timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OUTPUT_FILENAME="scene_${TIMESTAMP}.glb"
OUTPUT_PATH="${OUTPUT_DIR}/${OUTPUT_FILENAME}"

# API endpoint
API_URL="http://localhost:3000/generate-scene"

echo "Sending request to API for prompt: '${PROMPT}'"
echo "Saving output to: ${OUTPUT_PATH}"

# Make the curl request
# -s for silent (don't show progress meter)
# -S for show error (show error message if it fails)
# -o to specify output file
curl -sS -X POST "${API_URL}" \
     -H "Content-Type: application/json" \
     -d "{\"prompt\":\"${PROMPT}\"}" \
     -o "${OUTPUT_PATH}"

# Check if curl was successful
if [ $? -eq 0 ]; then
    echo "Successfully generated and saved scene to ${OUTPUT_PATH}"
    echo "File size: $(du -h "${OUTPUT_PATH}" | cut -f1)"
else
    echo "Error generating scene. Curl exit code: $?"
    echo "Please check the API server logs for more details."
    # If the output file was created but curl failed, it might be empty or contain an error message
    if [ -f "${OUTPUT_PATH}" ]; then
        echo "Content of the output file (${OUTPUT_PATH}):"
        cat "${OUTPUT_PATH}"
        # Optionally remove the potentially failed/empty file
        # rm "${OUTPUT_PATH}"
    fi
fi

echo "Script finished." 
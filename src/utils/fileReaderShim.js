import { Blob } from 'buffer'; // Node.js Blob implementation

export function initializeFileReaderShim() {
    if (typeof global.FileReader === 'undefined') {
        global.FileReader = class FileReader {
            readAsArrayBuffer(blob) {
                if (!(blob instanceof Blob)) {
                    // GLTFExporter might pass ArrayBufferView directly.
                    // Try to make a Blob if it's an ArrayBufferView
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
        };
        console.log("[DEBUG] FileReader shim initialized.");
    } else {
        console.log("[DEBUG] FileReader already exists, shim not initialized.");
    }
} 
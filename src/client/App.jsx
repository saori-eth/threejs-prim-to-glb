import { useState, useRef, useCallback } from 'react';
import ThreeViewer from './components/ThreeViewer.jsx';
import GenerateControls from './components/GenerateControls.jsx';
import RefineControls from './components/RefineControls.jsx';

export default function App() {
  const [modelId, setModelId] = useState('claude-opus-4-5-20251101');
  const [status, setStatus] = useState({ text: '', type: '' });
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [canDownload, setCanDownload] = useState(false);
  const [canRefine, setCanRefine] = useState(false);

  const viewerRef = useRef(null);
  const currentObjectUrlRef = useRef(null);
  const currentScriptRef = useRef(null);
  const currentFilenameRef = useRef('scene');

  const handleLoadSuccess = useCallback(() => {
    setStatus({ text: 'Model loaded successfully!', type: 'success' });
    setCanDownload(true);
    setCanRefine(!!currentScriptRef.current);
  }, []);

  const handleLoadError = useCallback(() => {
    setStatus({ text: 'Failed to load GLB model.', type: 'error' });
    setCanDownload(false);
    setCanRefine(false);
  }, []);

  const handleGenerate = async (prompt) => {
    if (!prompt.trim()) {
      setStatus({ text: 'Please enter a prompt.', type: 'error' });
      return;
    }

    setIsGenerating(true);
    setStatus({ text: 'Sending prompt to API...', type: '' });

    if (currentObjectUrlRef.current) {
      URL.revokeObjectURL(currentObjectUrlRef.current);
      currentObjectUrlRef.current = null;
    }

    viewerRef.current?.clearModel();

    try {
      const response = await fetch('/generate-scene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, modelId }),
      });

      setStatus({ text: 'Receiving model from API...', type: '' });

      if (!response.ok) {
        let errorMsg = `Error: ${response.status} ${response.statusText}`;
        try {
          const errorData = await response.json();
          errorMsg = errorData.error || errorMsg;
        } catch {}
        throw new Error(errorMsg);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      currentObjectUrlRef.current = objectUrl;

      const scriptHeader = response.headers.get('X-Generated-Script');
      const filenameHeader = response.headers.get('X-Generated-Filename');

      currentScriptRef.current = scriptHeader ? decodeURIComponent(scriptHeader) : null;
      currentFilenameRef.current = filenameHeader
        ? decodeURIComponent(filenameHeader)
        : prompt.replace(/[^a-z0-9_]/gi, '_').substring(0, 50) || 'scene';

      setStatus({ text: 'Loading model...', type: '' });
      viewerRef.current?.loadModel(objectUrl);
    } catch (error) {
      console.error('Error generating scene:', error);
      setStatus({ text: `Failed to load model: ${error.message}`, type: 'error' });
      setCanDownload(false);
      setCanRefine(false);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRefine = async (refinementPrompt) => {
    if (!currentScriptRef.current) {
      setStatus({ text: 'No scene script available to refine.', type: 'error' });
      return;
    }

    if (!refinementPrompt.trim()) {
      setStatus({ text: 'Please enter a refinement prompt.', type: 'error' });
      return;
    }

    setIsRefining(true);
    setStatus({ text: 'Sending refinement request to API...', type: '' });

    if (currentObjectUrlRef.current) {
      URL.revokeObjectURL(currentObjectUrlRef.current);
      currentObjectUrlRef.current = null;
    }

    viewerRef.current?.clearModel();

    try {
      const response = await fetch('/refine-scene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalScript: currentScriptRef.current,
          refinementPrompt,
          modelId,
        }),
      });

      setStatus({ text: 'Receiving refined model from API...', type: '' });

      if (!response.ok) {
        let errorMsg = `Error: ${response.status} ${response.statusText}`;
        try {
          const errorData = await response.json();
          errorMsg = errorData.error || errorMsg;
        } catch {}
        throw new Error(errorMsg);
      }

      const scriptHeader = response.headers.get('X-Generated-Script');
      const filenameHeader = response.headers.get('X-Generated-Filename');

      currentScriptRef.current = scriptHeader ? decodeURIComponent(scriptHeader) : null;
      currentFilenameRef.current = filenameHeader
        ? decodeURIComponent(filenameHeader)
        : (refinementPrompt.substring(0, 20) + '_refined').replace(/[^a-z0-9_]/gi, '_') || 'scene_refined';

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      currentObjectUrlRef.current = objectUrl;

      setStatus({ text: 'Loading refined model...', type: '' });
      viewerRef.current?.loadModel(objectUrl);
    } catch (error) {
      console.error('Error refining scene:', error);
      setStatus({ text: `Failed to refine model: ${error.message}`, type: 'error' });
      setCanDownload(false);
      setCanRefine(false);
    } finally {
      setIsRefining(false);
    }
  };

  const handleDownload = () => {
    if (currentObjectUrlRef.current) {
      const a = document.createElement('a');
      a.href = currentObjectUrlRef.current;
      a.download = `${currentFilenameRef.current}.glb`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  return (
    <>
      <h1>Three.js GLB Generator</h1>

      <ThreeViewer
        ref={viewerRef}
        onLoadSuccess={handleLoadSuccess}
        onLoadError={handleLoadError}
      />

      <GenerateControls
        onGenerate={handleGenerate}
        onDownload={handleDownload}
        canDownload={canDownload}
        isLoading={isGenerating || isRefining}
        status={status}
        modelId={modelId}
        onModelChange={setModelId}
      />

      <RefineControls
        onRefine={handleRefine}
        canRefine={canRefine}
        isLoading={isGenerating || isRefining}
      />
    </>
  );
}

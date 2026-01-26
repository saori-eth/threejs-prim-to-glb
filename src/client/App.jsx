import { useState, useRef, useCallback } from 'react';
import ThreeViewer from './components/ThreeViewer.jsx';
import Sidebar from './components/Sidebar.jsx';
import PromptModal from './components/PromptModal.jsx';

export default function App() {
  const [modelId, setModelId] = useState('claude-opus-4-5-20251101');
  const [status, setStatus] = useState({ text: '', type: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [generations, setGenerations] = useState([]);
  const [currentGenId, setCurrentGenId] = useState(null);
  const [mode, setMode] = useState('new');

  const viewerRef = useRef(null);

  const currentGen = generations.find((g) => g.id === currentGenId);

  const handleLoadSuccess = useCallback(() => {
    setStatus({ text: 'Model loaded!', type: 'success' });
  }, []);

  const handleLoadError = useCallback(() => {
    setStatus({ text: 'Failed to load model.', type: 'error' });
  }, []);

  const handleGenerate = async (prompt) => {
    if (!prompt.trim()) {
      setStatus({ text: 'Please enter a prompt.', type: 'error' });
      return;
    }

    setIsLoading(true);
    setStatus({ text: 'Generating...', type: '' });

    viewerRef.current?.clearModel();

    try {
      const response = await fetch('/generate-scene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, modelId }),
      });

      if (!response.ok) {
        let errorMsg = `Error: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMsg = errorData.error || errorMsg;
        } catch {}
        throw new Error(errorMsg);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);

      const scriptHeader = response.headers.get('X-Generated-Script');
      const filenameHeader = response.headers.get('X-Generated-Filename');

      const script = scriptHeader ? decodeURIComponent(scriptHeader) : null;
      const filename = filenameHeader
        ? decodeURIComponent(filenameHeader)
        : prompt.replace(/[^a-z0-9_]/gi, '_').substring(0, 30) || 'scene';

      const newGen = {
        id: Date.now().toString(),
        prompt,
        script,
        filename,
        objectUrl,
      };

      setGenerations((prev) => [newGen, ...prev]);
      setCurrentGenId(newGen.id);
      setMode('edit');
      setStatus({ text: 'Loading model...', type: '' });
      viewerRef.current?.loadModel(objectUrl);
    } catch (error) {
      console.error('Error generating scene:', error);
      setStatus({ text: error.message, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefine = async (refinementPrompt) => {
    if (!currentGen?.script) {
      setStatus({ text: 'No scene to refine.', type: 'error' });
      return;
    }

    if (!refinementPrompt.trim()) {
      setStatus({ text: 'Please enter a refinement prompt.', type: 'error' });
      return;
    }

    setIsLoading(true);
    setStatus({ text: 'Refining...', type: '' });

    viewerRef.current?.clearModel();

    try {
      const response = await fetch('/refine-scene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalScript: currentGen.script,
          refinementPrompt,
          modelId,
        }),
      });

      if (!response.ok) {
        let errorMsg = `Error: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMsg = errorData.error || errorMsg;
        } catch {}
        throw new Error(errorMsg);
      }

      const scriptHeader = response.headers.get('X-Generated-Script');
      const filenameHeader = response.headers.get('X-Generated-Filename');

      const script = scriptHeader ? decodeURIComponent(scriptHeader) : null;
      const filename = filenameHeader
        ? decodeURIComponent(filenameHeader)
        : currentGen.filename + '_v2';

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);

      if (currentGen.objectUrl) {
        URL.revokeObjectURL(currentGen.objectUrl);
      }

      setGenerations((prev) =>
        prev.map((g) =>
          g.id === currentGenId
            ? { ...g, script, filename, objectUrl, prompt: `${g.prompt} > ${refinementPrompt}` }
            : g
        )
      );

      setStatus({ text: 'Loading refined model...', type: '' });
      viewerRef.current?.loadModel(objectUrl);
    } catch (error) {
      console.error('Error refining scene:', error);
      setStatus({ text: error.message, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    if (currentGen?.objectUrl) {
      const a = document.createElement('a');
      a.href = currentGen.objectUrl;
      a.download = `${currentGen.filename}.glb`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const handleSelectGeneration = (id) => {
    const gen = generations.find((g) => g.id === id);
    if (gen) {
      setCurrentGenId(id);
      setMode('edit');
      setStatus({ text: '', type: '' });
      viewerRef.current?.loadModel(gen.objectUrl);
    }
  };

  const handleNewGeneration = () => {
    setCurrentGenId(null);
    setMode('new');
    setStatus({ text: '', type: '' });
    viewerRef.current?.clearModel();
  };

  return (
    <>
      <ThreeViewer
        ref={viewerRef}
        onLoadSuccess={handleLoadSuccess}
        onLoadError={handleLoadError}
      />

      <Sidebar
        generations={generations}
        currentId={currentGenId}
        onSelect={handleSelectGeneration}
        onNew={handleNewGeneration}
      />

      <PromptModal
        mode={mode}
        initialPrompt=""
        onGenerate={handleGenerate}
        onRefine={handleRefine}
        onDownload={handleDownload}
        canDownload={!!currentGen?.objectUrl}
        isLoading={isLoading}
        status={status}
        modelId={modelId}
        onModelChange={setModelId}
      />
    </>
  );
}

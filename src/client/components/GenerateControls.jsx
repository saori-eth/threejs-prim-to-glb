import { useState } from 'react';

const AVAILABLE_MODELS = {
  'claude-opus-4-5-20251101': 'Claude Opus 4.5 (20251101)',
  'claude-sonnet-4-5-20250929': 'Claude Sonnet 4.5 (20250929)',
  'claude-opus-4-20250514': 'Claude Opus 4 (20250514)',
  'claude-sonnet-4-20250514': 'Claude Sonnet 4 (20250514)',
};

export default function GenerateControls({
  onGenerate,
  onDownload,
  canDownload,
  isLoading,
  status,
  modelId,
  onModelChange,
}) {
  const [prompt, setPrompt] = useState('a vibrant red cube next to a small blue sphere');

  const handleSubmit = (e) => {
    e.preventDefault();
    onGenerate(prompt);
  };

  return (
    <div className="controls-container">
      <form onSubmit={handleSubmit}>
        <label htmlFor="promptInput">Enter your prompt:</label>
        <input
          type="text"
          id="promptInput"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />

        <label htmlFor="modelSelect">Select Model:</label>
        <select
          id="modelSelect"
          value={modelId}
          onChange={(e) => onModelChange(e.target.value)}
        >
          {Object.entries(AVAILABLE_MODELS).map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>

        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Generating...' : 'Generate Scene'}
        </button>
      </form>

      <button onClick={onDownload} disabled={!canDownload || isLoading}>
        Download GLB
      </button>

      <div className={`status ${status.type}`}>{status.text}</div>
    </div>
  );
}

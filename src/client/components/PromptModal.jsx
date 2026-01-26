import { useState, useEffect } from 'react';

const AVAILABLE_MODELS = {
  'claude-opus-4-5-20251101': 'Claude Opus 4.5',
  'claude-sonnet-4-5-20250929': 'Claude Sonnet 4.5',
  'claude-opus-4-20250514': 'Claude Opus 4',
  'claude-sonnet-4-20250514': 'Claude Sonnet 4',
};

export default function PromptModal({
  mode,
  initialPrompt,
  onGenerate,
  onRefine,
  onDownload,
  canDownload,
  isLoading,
  status,
  modelId,
  onModelChange,
}) {
  const [prompt, setPrompt] = useState(initialPrompt || '');

  useEffect(() => {
    if (mode === 'new') {
      setPrompt('');
    }
  }, [mode]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (mode === 'new') {
      onGenerate(prompt);
    } else {
      onRefine(prompt);
    }
  };

  return (
    <div className="prompt-modal">
      <form onSubmit={handleSubmit} className="prompt-modal__form">
        <div className="prompt-modal__input-row">
          <input
            type="text"
            className="prompt-modal__input"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={mode === 'new' ? 'Describe your 3D scene...' : 'Describe changes to make...'}
            disabled={isLoading}
          />
          <button
            type="submit"
            className="prompt-modal__submit"
            disabled={isLoading || !prompt.trim()}
          >
            {isLoading ? '...' : mode === 'new' ? 'Generate' : 'Refine'}
          </button>
        </div>

        <div className="prompt-modal__controls">
          <select
            className="prompt-modal__select"
            value={modelId}
            onChange={(e) => onModelChange(e.target.value)}
            disabled={isLoading}
          >
            {Object.entries(AVAILABLE_MODELS).map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>

          {canDownload && (
            <button
              type="button"
              className="prompt-modal__download"
              onClick={onDownload}
              disabled={isLoading}
            >
              Download GLB
            </button>
          )}
        </div>

        {status.text && (
          <div className={`prompt-modal__status prompt-modal__status--${status.type || 'info'}`}>
            {status.text}
          </div>
        )}
      </form>
    </div>
  );
}

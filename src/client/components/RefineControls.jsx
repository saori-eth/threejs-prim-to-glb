import { useState } from 'react';

export default function RefineControls({ onRefine, canRefine, isLoading }) {
  const [refinementPrompt, setRefinementPrompt] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onRefine(refinementPrompt);
  };

  return (
    <div className="controls-container">
      <form onSubmit={handleSubmit}>
        <label htmlFor="refinementPromptInput">Refine the current scene:</label>
        <input
          type="text"
          id="refinementPromptInput"
          placeholder="e.g., 'make the cube green', 'add a light from above'"
          value={refinementPrompt}
          onChange={(e) => setRefinementPrompt(e.target.value)}
        />
        <button type="submit" disabled={!canRefine || isLoading}>
          {isLoading ? 'Refining...' : 'Refine Scene'}
        </button>
      </form>
    </div>
  );
}

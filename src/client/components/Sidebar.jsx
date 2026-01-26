import { useState } from 'react';

export default function Sidebar({ generations, currentId, onSelect, onNew }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        className="sidebar-toggle"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? 'Close sidebar' : 'Open sidebar'}
      >
        {isOpen ? '\u2715' : '\u2630'}
      </button>

      <div className={`sidebar ${isOpen ? 'sidebar--open' : ''}`}>
        <div className="sidebar__header">
          <h2>Generations</h2>
          <button className="sidebar__new-btn" onClick={onNew}>
            + New
          </button>
        </div>

        <div className="sidebar__list">
          {generations.length === 0 ? (
            <p className="sidebar__empty">No generations yet</p>
          ) : (
            generations.map((gen) => (
              <button
                key={gen.id}
                className={`sidebar__item ${gen.id === currentId ? 'sidebar__item--active' : ''}`}
                onClick={() => onSelect(gen.id)}
              >
                <span className="sidebar__item-name">{gen.filename || 'Untitled'}</span>
                <span className="sidebar__item-prompt">{gen.prompt}</span>
              </button>
            ))
          )}
        </div>
      </div>

      {isOpen && <div className="sidebar-overlay" onClick={() => setIsOpen(false)} />}
    </>
  );
}

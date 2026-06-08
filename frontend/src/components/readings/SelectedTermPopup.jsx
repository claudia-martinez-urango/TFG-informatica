function SelectedTermPopup({ selectedText, preview, position, onAdd, onClose, loading, errorMessage }) {
  return (
    <div
      className="selection-popup"
      style={{ top: position.top, left: position.left }}
    >
      <div className="selection-popup-header">
        <span className="selection-popup-term">"{selectedText}"</span>
        <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>

      {loading && !preview && (
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '8px 0 0 0' }}>
          Loading…
        </p>
      )}

      {preview && (
        <>
          <div className="selection-popup-source">
            {preview.source_type === 'teacher_glossary' ? (
              <span className="status-badge published-badge">From teacher glossary</span>
            ) : (
              <span className="status-badge hidden-badge">No teacher definition yet</span>
            )}
          </div>

          {preview.definition ? (
            <p className="selection-popup-definition">{preview.definition}</p>
          ) : (
            <p className="selection-popup-definition selection-popup-no-definition">
              Definition not available yet.
            </p>
          )}

          {preview.example_sentence && (
            <p className="selection-popup-definition selection-popup-example">
              <strong>Example:</strong> {preview.example_sentence}
            </p>
          )}

          {preview.context_sentence && (
            <p className="selection-popup-context">
              <strong>Context:</strong> &ldquo;{preview.context_sentence}&rdquo;
            </p>
          )}
        </>
      )}

      {errorMessage && (
        <p style={{ fontSize: '13px', color: 'var(--error)', margin: '8px 0 0 0' }}>
          {errorMessage}
        </p>
      )}

      <div className="selection-popup-actions">
        <button
          type="button"
          className="small-button"
          onClick={onAdd}
          disabled={loading}
        >
          {loading ? 'Adding…' : 'Add to my glossary'}
        </button>
      </div>
    </div>
  );
}

export default SelectedTermPopup;

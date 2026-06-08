import { useRef, useCallback, useEffect } from 'react';

function extractContextSentence(content, selectedText) {
  if (!content || !selectedText) return '';
  const lower = selectedText.toLowerCase();
  const lines = content.split('\n');
  for (const line of lines) {
    if (line.toLowerCase().includes(lower)) {
      const trimmed = line.trim();
      if (trimmed) return trimmed;
    }
  }
  return '';
}

// Props:
//   content           — raw reading text
//   onSelectionChange — called with { selectedText, contextSentence } on valid selection
function SelectableReadingContent({ content, onSelectionChange }) {
  const containerRef = useRef(null);
  // Tracks the last reported text to avoid re-firing for the same selection
  const lastTextRef = useRef(null);

  const handleSelection = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const selectedText = selection.toString().trim();
    if (!selectedText) return;

    // Max 4 words
    if (selectedText.split(/\s+/).filter(Boolean).length > 4) return;

    // Must originate inside the reading container
    if (!containerRef.current) return;
    const range = selection.getRangeAt(0);
    if (!containerRef.current.contains(range.commonAncestorContainer)) return;

    // Avoid re-firing for the same word while it is being processed
    if (lastTextRef.current === selectedText) return;
    lastTextRef.current = selectedText;

    const contextSentence = extractContextSentence(content, selectedText);
    onSelectionChange({ selectedText, contextSentence });
  }, [content, onSelectionChange]);

  useEffect(() => {
    const onMouseUp = () => handleSelection();
    const onKeyUp = (e) => {
      if (e.shiftKey || e.key.startsWith('Arrow')) handleSelection();
    };
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('keyup', onKeyUp);
    return () => {
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('keyup', onKeyUp);
    };
  }, [handleSelection]);

  // Reset the dedup ref when the selection is cleared so the same word
  // can be re-selected after being dismissed
  useEffect(() => {
    const onSelChange = () => {
      if (!window.getSelection() || window.getSelection().isCollapsed) {
        lastTextRef.current = null;
      }
    };
    document.addEventListener('selectionchange', onSelChange);
    return () => document.removeEventListener('selectionchange', onSelChange);
  }, []);

  return (
    <div className="selectable-reading-wrapper">
      <p ref={containerRef} className="reading-detail-content">
        {content}
      </p>
    </div>
  );
}

export default SelectableReadingContent;

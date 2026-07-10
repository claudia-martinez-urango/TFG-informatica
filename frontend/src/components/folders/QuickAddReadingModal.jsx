import { useEffect, useState } from "react";

import { createReading } from "../../api/readingsApi";
import { getFolderSections } from "../../api/sectionsApi";
import { extractTextFromFile, getTitleFromFile } from "../../utils/fileTextExtraction";

function QuickAddReadingModal({ folders, onClose, onCreated }) {
  const [folderId, setFolderId] = useState("");
  const [sections, setSections] = useState([]);
  const [sectionId, setSectionId] = useState("");
  const [sectionsLoading, setSectionsLoading] = useState(false);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!folderId) {
      setSections([]);
      setSectionId("");
      return;
    }

    let cancelled = false;

    async function loadSections() {
      setSectionsLoading(true);
      setSectionId("");
      setErrorMessage("");
      try {
        const data = await getFolderSections(folderId);
        if (!cancelled) setSections(data);
      } catch (error) {
        if (!cancelled) setErrorMessage(error.message);
      } finally {
        if (!cancelled) setSectionsLoading(false);
      }
    }

    loadSections();

    return () => {
      cancelled = true;
    };
  }, [folderId]);

  async function handleFileUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setErrorMessage("");
      const extractedText = await extractTextFromFile(file);

      if (!title) {
        setTitle(getTitleFromFile(file));
      }

      setContent(extractedText);
    } catch (error) {
      setErrorMessage(error.message);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!sectionId) return;

    setSubmitting(true);
    setErrorMessage("");

    try {
      const newReading = await createReading({ sectionId, title, content });
      onCreated({ folderId, sectionId, reading: newReading });
    } catch (error) {
      setErrorMessage(error.message);
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <div className="modal-header">
          <h3>Add reading</h3>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="reading-form">
          <label>
            Folder
            <select
              value={folderId}
              onChange={(event) => setFolderId(event.target.value)}
              required
            >
              <option value="" disabled>Select a folder…</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Section
            <select
              value={sectionId}
              onChange={(event) => setSectionId(event.target.value)}
              disabled={!folderId || sectionsLoading}
              required
            >
              <option value="" disabled>
                {sectionsLoading ? "Loading sections…" : "Select a section…"}
              </option>
              {sections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.order_index}. {section.name}
                </option>
              ))}
            </select>
            {folderId && !sectionsLoading && sections.length === 0 && (
              <p className="small-text">This folder has no sections yet. Create one first.</p>
            )}
          </label>

          <label>
            Reading title
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Academic vocabulary in university life"
              required
            />
          </label>

          <label>
            Upload reading file
            <input
              type="file"
              accept=".txt,.docx,.pdf"
              onChange={handleFileUpload}
            />
          </label>

          <label>
            Reading content
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="Write, paste or upload the reading text here..."
              rows="10"
              required
            />
          </label>

          {errorMessage && <p className="error">{errorMessage}</p>}

          <div className="modal-actions">
            <button type="submit" disabled={submitting || !sectionId}>
              {submitting ? "Creating…" : "Create reading"}
            </button>
            <button type="button" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default QuickAddReadingModal;

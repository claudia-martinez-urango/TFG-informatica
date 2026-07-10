import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import {
  createReading,
  deleteReading,
  getSectionReadings,
  updateReading,
  updateReadingVisibility,
} from "../../api/readingsApi";
import { extractTextFromFile, getTitleFromFile } from "../../utils/fileTextExtraction";

import ConfirmModal from "../ui/ConfirmModal";
import ReadingGlossaryManager from "./ReadingGlossaryManager";

function SectionReadingsManager({ sectionId }) {
  const [readings, setReadings] = useState([]);

  const [showCreateForm, setShowCreateForm] = useState(false);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const [editingReadingId, setEditingReadingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingContent, setEditingContent] = useState("");

  const [readingToDelete, setReadingToDelete] = useState(null);
  const [visibleGlossaryReadingId, setVisibleGlossaryReadingId] = useState(null);

  function toggleGlossary(readingId) {
    setVisibleGlossaryReadingId((prev) => (prev === readingId ? null : readingId));
  }

  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  async function loadReadings() {
    try {
      setErrorMessage("");

      const data = await getSectionReadings(sectionId);
      setReadings(data);
    } catch (error) {
      setErrorMessage(error.message);
    }
  }

  useEffect(() => {
    loadReadings();
  }, [sectionId]);

  async function handleFileUpload(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    try {
      setMessage("");
      setErrorMessage("");

      const extractedText = await extractTextFromFile(file);

      if (!title) {
        setTitle(getTitleFromFile(file));
      }

      setContent(extractedText);
      setMessage("File text extracted successfully.");
    } catch (error) {
      setErrorMessage(error.message);
    }
  }

  async function handleEditFileUpload(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    try {
      setMessage("");
      setErrorMessage("");

      const extractedText = await extractTextFromFile(file);

      if (!editingTitle) {
        setEditingTitle(getTitleFromFile(file));
      }

      setEditingContent(extractedText);
      setMessage("File text extracted successfully.");
    } catch (error) {
      setErrorMessage(error.message);
    }
  }

  async function handleCreateReading(event) {
    event.preventDefault();

    try {
      setMessage("");
      setErrorMessage("");

      const newReading = await createReading({
        sectionId,
        title,
        content,
      });

      setReadings([newReading, ...readings]);

      setTitle("");
      setContent("");
      setShowCreateForm(false);

      setMessage(
        "Reading created successfully. It is hidden from students by default."
      );
    } catch (error) {
      setErrorMessage(error.message);
    }
  }

  function startEditing(reading) {
    setEditingReadingId(reading.id);
    setEditingTitle(reading.title);
    setEditingContent(reading.content);
  }

  function cancelEditing() {
    setEditingReadingId(null);
    setEditingTitle("");
    setEditingContent("");
  }

  async function handleUpdateReading(readingId) {
    try {
      setMessage("");
      setErrorMessage("");

      const updatedReading = await updateReading({
        readingId,
        title: editingTitle,
        content: editingContent,
      });

      setReadings(
        readings.map((reading) =>
          reading.id === readingId ? updatedReading : reading
        )
      );

      cancelEditing();
      setMessage("Reading updated successfully.");
    } catch (error) {
      setErrorMessage(error.message);
    }
  }

  async function handleToggleVisibility(reading) {
    try {
      setMessage("");
      setErrorMessage("");

      const updatedReading = await updateReadingVisibility({
        readingId: reading.id,
        isVisibleToStudents: !reading.is_visible_to_students,
      });

      setReadings(
        readings.map((currentReading) =>
          currentReading.id === reading.id ? updatedReading : currentReading
        )
      );

      if (updatedReading.is_visible_to_students) {
        setMessage("Reading published. Students can now see it.");
      } else {
        setMessage("Reading hidden. Students can no longer see it.");
      }
    } catch (error) {
      setErrorMessage(error.message);
    }
  }

  async function confirmDeleteReading() {
    if (!readingToDelete) return;

    try {
      setMessage("");
      setErrorMessage("");

      await deleteReading(readingToDelete.id);

      setReadings(
        readings.filter((reading) => reading.id !== readingToDelete.id)
      );

      setReadingToDelete(null);
      setMessage("Reading deleted successfully.");
    } catch (error) {
      setErrorMessage(error.message);
      setReadingToDelete(null);
    }
  }

  return (
    <div className="readings-box">
      <div className="section-header-row">
        <div>
          <h4>Readings</h4>
          <p className="small-text">
            Readings are hidden from students by default. You can write the text
            manually or upload a .txt, .docx or .pdf file.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreateForm(!showCreateForm)}
        >
          {showCreateForm ? "Cancel" : "+ Add reading"}
        </button>
      </div>

      {showCreateForm && (
        <form onSubmit={handleCreateReading} className="reading-form">
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

          <button type="submit">Create reading</button>
        </form>
      )}

      {message && <p className="success">{message}</p>}
      {errorMessage && <p className="error">{errorMessage}</p>}

      {readings.length === 0 ? (
        <p>No readings created yet.</p>
      ) : (
        <div className="readings-list">
          {readings.map((reading) => {
            const isEditing = editingReadingId === reading.id;

            return (
              <div key={reading.id} className="reading-card">
                {isEditing ? (
                  <div className="reading-edit-form">
                    <div className="section-edit-header">
                      <h5>Edit reading</h5>

                      <span
                        className={
                          reading.is_visible_to_students
                            ? "status-badge published-badge"
                            : "status-badge hidden-badge"
                        }
                      >
                        {reading.is_visible_to_students
                          ? "Visible to students"
                          : "Hidden from students"}
                      </span>
                    </div>

                    <label>
                      Reading title
                      <input
                        type="text"
                        value={editingTitle}
                        onChange={(event) =>
                          setEditingTitle(event.target.value)
                        }
                        required
                      />
                    </label>

                    <label>
                      Upload replacement file
                      <input
                        type="file"
                        accept=".txt,.docx,.pdf"
                        onChange={handleEditFileUpload}
                      />
                    </label>

                    <label>
                      Reading content
                      <textarea
                        value={editingContent}
                        onChange={(event) =>
                          setEditingContent(event.target.value)
                        }
                        rows="10"
                        required
                      />
                    </label>

                    <div className="action-row">
                      <button
                        type="button"
                        onClick={() => handleUpdateReading(reading.id)}
                      >
                        Save changes
                      </button>

                      <button type="button" onClick={cancelEditing}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="section-title-row">
                      <h5>{reading.title}</h5>

                      <span
                        className={
                          reading.is_visible_to_students
                            ? "status-badge published-badge"
                            : "status-badge hidden-badge"
                        }
                      >
                        {reading.is_visible_to_students
                          ? "Visible to students"
                          : "Hidden from students"}
                      </span>
                    </div>

                    <p className="reading-preview">
                      {reading.content.length > 220
                        ? `${reading.content.slice(0, 220)}...`
                        : reading.content}
                    </p>

                    <div className="action-row">
                      <Link
                        to={`/reading/${reading.id}`}
                        className="reading-open-button"
                      >
                        Open reading
                      </Link>

                      <button
                        type="button"
                        onClick={() => startEditing(reading)}
                      >
                        Edit reading
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleVisibility(reading)}
                      >
                        {reading.is_visible_to_students
                          ? "Hide from students"
                          : "Publish to students"}
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleGlossary(reading.id)}
                      >
                        {visibleGlossaryReadingId === reading.id
                          ? "Hide glossary"
                          : "Manage glossary"}
                      </button>

                      <button
                        type="button"
                        className="danger-button"
                        onClick={() => setReadingToDelete(reading)}
                      >
                        Delete reading
                      </button>
                    </div>

                    {visibleGlossaryReadingId === reading.id && (
                      <ReadingGlossaryManager readingId={reading.id} />
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {readingToDelete && (
        <ConfirmModal
          title="Delete reading"
          message={`Are you sure you want to delete "${readingToDelete.title}"? This action cannot be undone.`}
          confirmText="Delete"
          cancelText="Cancel"
          onConfirm={confirmDeleteReading}
          onCancel={() => setReadingToDelete(null)}
        />
      )}
    </div>
  );
}

export default SectionReadingsManager;
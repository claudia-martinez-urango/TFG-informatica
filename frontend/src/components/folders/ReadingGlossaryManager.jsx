import { useEffect, useState } from "react";

import {
  createGlossaryTerm,
  deleteGlossaryTerm,
  getReadingGlossaryTerms,
  updateGlossaryTerm,
  updateGlossaryTermVisibility,
} from "../../api/glossaryApi";

import ConfirmModal from "../ui/ConfirmModal";
import GlossaryImportModal from "./GlossaryImportModal";

function ReadingGlossaryManager({ readingId }) {
  const [terms, setTerms] = useState([]);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTerm, setNewTerm] = useState("");
  const [newDefinition, setNewDefinition] = useState("");
  const [newExampleSentence, setNewExampleSentence] = useState("");
  const [newContextSentence, setNewContextSentence] = useState("");

  const [editingTermId, setEditingTermId] = useState(null);
  const [editingTerm, setEditingTerm] = useState("");
  const [editingDefinition, setEditingDefinition] = useState("");
  const [editingExampleSentence, setEditingExampleSentence] = useState("");
  const [editingContextSentence, setEditingContextSentence] = useState("");

  const [termToDelete, setTermToDelete] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  async function loadTerms() {
    try {
      setErrorMessage("");
      const data = await getReadingGlossaryTerms(readingId);
      setTerms(data);
    } catch (error) {
      setErrorMessage(error.message);
    }
  }

  useEffect(() => {
    loadTerms();
  }, [readingId]);

  async function handleCreateTerm(event) {
    event.preventDefault();

    try {
      setMessage("");
      setErrorMessage("");

      const created = await createGlossaryTerm({
        readingId,
        term: newTerm,
        definition: newDefinition,
        exampleSentence: newExampleSentence,
        contextSentence: newContextSentence,
      });

      setTerms([...terms, created]);
      setNewTerm("");
      setNewDefinition("");
      setNewExampleSentence("");
      setNewContextSentence("");
      setShowCreateForm(false);
      setMessage("Term created. It is hidden from students by default.");
    } catch (error) {
      setErrorMessage(error.message);
    }
  }

  function startEditing(termItem) {
    setEditingTermId(termItem.id);
    setEditingTerm(termItem.term);
    setEditingDefinition(termItem.definition);
    setEditingExampleSentence(termItem.example_sentence || "");
    setEditingContextSentence(termItem.context_sentence || "");
  }

  function cancelEditing() {
    setEditingTermId(null);
    setEditingTerm("");
    setEditingDefinition("");
    setEditingExampleSentence("");
    setEditingContextSentence("");
  }

  async function handleUpdateTerm(termId) {
    try {
      setMessage("");
      setErrorMessage("");

      const updated = await updateGlossaryTerm({
        termId,
        term: editingTerm,
        definition: editingDefinition,
        exampleSentence: editingExampleSentence,
        contextSentence: editingContextSentence,
      });

      setTerms(terms.map((t) => (t.id === termId ? updated : t)));
      cancelEditing();
      setMessage("Term updated successfully.");
    } catch (error) {
      setErrorMessage(error.message);
    }
  }

  async function handleToggleVisibility(termItem) {
    try {
      setMessage("");
      setErrorMessage("");

      const updated = await updateGlossaryTermVisibility({
        termId: termItem.id,
        isVisibleToStudents: !termItem.is_visible_to_students,
      });

      setTerms(terms.map((t) => (t.id === termItem.id ? updated : t)));

      if (updated.is_visible_to_students) {
        setMessage("Term published. Students can now see it.");
      } else {
        setMessage("Term hidden. Students can no longer see it.");
      }
    } catch (error) {
      setErrorMessage(error.message);
    }
  }

  async function handleImported(count) {
    setShowImportModal(false);
    setMessage(`${count} term${count !== 1 ? "s" : ""} imported. They are hidden from students by default.`);
    await loadTerms();
  }

  async function confirmDeleteTerm() {
    if (!termToDelete) return;

    try {
      setMessage("");
      setErrorMessage("");

      await deleteGlossaryTerm(termToDelete.id);
      setTerms(terms.filter((t) => t.id !== termToDelete.id));
      setTermToDelete(null);
      setMessage("Term deleted successfully.");
    } catch (error) {
      setErrorMessage(error.message);
      setTermToDelete(null);
    }
  }

  return (
    <div className="glossary-box">
      <h4 style={{ margin: "0 0 4px 0" }}>Glossary terms</h4>
      <p className="small-text" style={{ margin: "0 0 12px 0" }}>
        Glossary terms are hidden from students by default.
      </p>

      <div className="glossary-header-actions">
        <button
          type="button"
          onClick={() => setShowCreateForm(!showCreateForm)}
        >
          {showCreateForm ? "Cancel" : "+ Add term"}
        </button>
        <button
          type="button"
          onClick={() => setShowImportModal(true)}
        >
          Import from file
        </button>
      </div>

      {showCreateForm && (
        <form onSubmit={handleCreateTerm} className="glossary-form">
          <label>
            Term
            <input
              type="text"
              value={newTerm}
              onChange={(e) => setNewTerm(e.target.value)}
              placeholder="e.g. Cognitive bias"
              required
            />
          </label>

          <label>
            Definition
            <textarea
              value={newDefinition}
              onChange={(e) => setNewDefinition(e.target.value)}
              placeholder="A clear and concise definition..."
              rows="3"
              required
            />
          </label>

          <label>
            Example sentence
            <input
              type="text"
              value={newExampleSentence}
              onChange={(e) => setNewExampleSentence(e.target.value)}
              placeholder="Optional — a sentence using the term"
            />
          </label>

          <label>
            Context sentence
            <input
              type="text"
              value={newContextSentence}
              onChange={(e) => setNewContextSentence(e.target.value)}
              placeholder="Optional — from the reading text"
            />
          </label>

          <button type="submit">Create term</button>
        </form>
      )}

      {message && <p className="success">{message}</p>}
      {errorMessage && <p className="error">{errorMessage}</p>}

      {terms.length === 0 ? (
        <p className="glossary-empty">No glossary terms created yet.</p>
      ) : (
        <div className="glossary-terms-list">
          {terms.map((termItem) => {
            const isEditing = editingTermId === termItem.id;

            return (
              <div key={termItem.id} className="glossary-term-card">
                {isEditing ? (
                  <div className="reading-edit-form">
                    <div className="section-edit-header">
                      <h5>Edit term</h5>

                      <span
                        className={
                          termItem.is_visible_to_students
                            ? "status-badge published-badge"
                            : "status-badge hidden-badge"
                        }
                      >
                        {termItem.is_visible_to_students
                          ? "Visible to students"
                          : "Hidden from students"}
                      </span>
                    </div>

                    <label>
                      Term
                      <input
                        type="text"
                        value={editingTerm}
                        onChange={(e) => setEditingTerm(e.target.value)}
                        required
                      />
                    </label>

                    <label>
                      Definition
                      <textarea
                        value={editingDefinition}
                        onChange={(e) => setEditingDefinition(e.target.value)}
                        rows="3"
                        required
                      />
                    </label>

                    <label>
                      Example sentence
                      <input
                        type="text"
                        value={editingExampleSentence}
                        onChange={(e) =>
                          setEditingExampleSentence(e.target.value)
                        }
                      />
                    </label>

                    <label>
                      Context sentence
                      <input
                        type="text"
                        value={editingContextSentence}
                        onChange={(e) =>
                          setEditingContextSentence(e.target.value)
                        }
                      />
                    </label>

                    <div className="action-row">
                      <button
                        type="button"
                        onClick={() => handleUpdateTerm(termItem.id)}
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
                      <h5>{termItem.term}</h5>

                      <span
                        className={
                          termItem.is_visible_to_students
                            ? "status-badge published-badge"
                            : "status-badge hidden-badge"
                        }
                      >
                        {termItem.is_visible_to_students
                          ? "Visible to students"
                          : "Hidden from students"}
                      </span>
                    </div>

                    <p className="glossary-term-definition">
                      {termItem.definition}
                    </p>

                    {termItem.example_sentence && (
                      <p className="glossary-term-meta">
                        <span className="glossary-meta-label">Example:</span>{" "}
                        {termItem.example_sentence}
                      </p>
                    )}

                    {termItem.context_sentence && (
                      <p className="glossary-term-meta">
                        <span className="glossary-meta-label">Context:</span>{" "}
                        {termItem.context_sentence}
                      </p>
                    )}

                    <div className="action-row">
                      <button
                        type="button"
                        onClick={() => startEditing(termItem)}
                      >
                        Edit term
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleVisibility(termItem)}
                      >
                        {termItem.is_visible_to_students
                          ? "Hide from students"
                          : "Publish to students"}
                      </button>

                      <button
                        type="button"
                        className="danger-button"
                        onClick={() => setTermToDelete(termItem)}
                      >
                        Delete term
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showImportModal && (
        <GlossaryImportModal
          readingId={readingId}
          onImported={handleImported}
          onClose={() => setShowImportModal(false)}
        />
      )}

      {termToDelete && (
        <ConfirmModal
          title="Delete glossary term"
          message={`Are you sure you want to delete "${termToDelete.term}"? This action cannot be undone.`}
          confirmText="Delete"
          cancelText="Cancel"
          onConfirm={confirmDeleteTerm}
          onCancel={() => setTermToDelete(null)}
        />
      )}
    </div>
  );
}

export default ReadingGlossaryManager;

import { useEffect, useState } from "react";
import {
  createFolderSection,
  deleteFolderSection,
  getFolderSections,
  updateFolderSection,
  updateSectionVisibility,
} from "../../api/sectionsApi";
import ConfirmModal from "../ui/ConfirmModal";

function FolderSectionsManager({ folderId }) {
  const [sections, setSections] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const [sectionName, setSectionName] = useState("");
  const [sectionDescription, setSectionDescription] = useState("");
  const [sectionOrder, setSectionOrder] = useState(0);

  const [editingSectionId, setEditingSectionId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [editingDescription, setEditingDescription] = useState("");
  const [editingOrder, setEditingOrder] = useState(0);

  const [sectionToDelete, setSectionToDelete] = useState(null);

  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  async function loadSections() {
    try {
      setErrorMessage("");
      const data = await getFolderSections(folderId);
      setSections(data);
    } catch (error) {
      setErrorMessage(error.message);
    }
  }

  useEffect(() => {
    loadSections();
  }, [folderId]);

  async function handleCreateSection(event) {
    event.preventDefault();

    try {
      setMessage("");
      setErrorMessage("");

      const newSection = await createFolderSection({
        folderId,
        name: sectionName,
        description: sectionDescription,
        orderIndex: Number(sectionOrder),
      });

      setSections(
        [...sections, newSection].sort(
          (a, b) => a.order_index - b.order_index
        )
      );

      setSectionName("");
      setSectionDescription("");
      setSectionOrder(0);
      setShowCreateForm(false);

      setMessage(
        "Section created successfully. It is hidden from students by default."
      );
    } catch (error) {
      setErrorMessage(error.message);
    }
  }

  function startEditing(section) {
    setEditingSectionId(section.id);
    setEditingName(section.name);
    setEditingDescription(section.description || "");
    setEditingOrder(section.order_index || 0);
  }

  function cancelEditing() {
    setEditingSectionId(null);
    setEditingName("");
    setEditingDescription("");
    setEditingOrder(0);
  }

  async function handleUpdateSection(sectionId) {
    try {
      setMessage("");
      setErrorMessage("");

      const updatedSection = await updateFolderSection({
        sectionId,
        name: editingName,
        description: editingDescription,
        orderIndex: Number(editingOrder),
      });

      setSections(
        sections
          .map((section) =>
            section.id === sectionId ? updatedSection : section
          )
          .sort((a, b) => a.order_index - b.order_index)
      );

      cancelEditing();
      setMessage("Section updated successfully.");
    } catch (error) {
      setErrorMessage(error.message);
    }
  }

  async function handleToggleVisibility(section) {
    try {
      setMessage("");
      setErrorMessage("");

      const updatedSection = await updateSectionVisibility({
        sectionId: section.id,
        isVisibleToStudents: !section.is_visible_to_students,
      });

      setSections(
        sections
          .map((currentSection) =>
            currentSection.id === section.id ? updatedSection : currentSection
          )
          .sort((a, b) => a.order_index - b.order_index)
      );

      if (updatedSection.is_visible_to_students) {
        setMessage("Section published. Students can now see it.");
      } else {
        setMessage("Section hidden. Students can no longer see it.");
      }
    } catch (error) {
      setErrorMessage(error.message);
    }
  }

  async function confirmDeleteSection() {
    if (!sectionToDelete) return;

    try {
      setMessage("");
      setErrorMessage("");

      await deleteFolderSection(sectionToDelete.id);

      setSections(
        sections.filter((section) => section.id !== sectionToDelete.id)
      );

      setSectionToDelete(null);
      setMessage("Section deleted successfully.");
    } catch (error) {
      setErrorMessage(error.message);
      setSectionToDelete(null);
    }
  }

  return (
    <div className="sections-box">
      <div className="section-header-row">
        <div>
          <h4>Sections / Subfolders</h4>
          <p className="small-text">
            New sections are hidden from students by default.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreateForm(!showCreateForm)}
        >
          {showCreateForm ? "Cancel" : "+ Add section"}
        </button>
      </div>

      {showCreateForm && (
        <form onSubmit={handleCreateSection} className="section-form">
          <label>
            Section name
            <input
              type="text"
              value={sectionName}
              onChange={(event) => setSectionName(event.target.value)}
              placeholder="Unit 1 - Academic Vocabulary"
              required
            />
          </label>

          <label>
            Description
            <textarea
              value={sectionDescription}
              onChange={(event) => setSectionDescription(event.target.value)}
              placeholder="Materials and readings for this unit."
              rows="3"
            />
          </label>

          <label>
            Order
            <input
              type="number"
              value={sectionOrder}
              onChange={(event) => setSectionOrder(event.target.value)}
              min="0"
            />
          </label>

          <button type="submit">Create section</button>
        </form>
      )}

      {message && <p className="success">{message}</p>}
      {errorMessage && <p className="error">{errorMessage}</p>}

      {sections.length === 0 ? (
        <p>No sections created yet.</p>
      ) : (
        <div className="sections-list">
          {sections.map((section) => {
            const isEditing = editingSectionId === section.id;

            return (
              <div key={section.id} className="section-card">
                {isEditing ? (
                  <div className="section-edit-form">
                    <div className="section-edit-header">
                      <h5>Edit section</h5>
                      <span
                        className={
                          section.is_visible_to_students
                            ? "status-badge published-badge"
                            : "status-badge hidden-badge"
                        }
                      >
                        {section.is_visible_to_students
                          ? "Visible to students"
                          : "Hidden from students"}
                      </span>
                    </div>

                    <label>
                      Section name
                      <input
                        type="text"
                        value={editingName}
                        onChange={(event) => setEditingName(event.target.value)}
                        required
                      />
                    </label>

                    <label>
                      Description
                      <textarea
                        value={editingDescription}
                        onChange={(event) =>
                          setEditingDescription(event.target.value)
                        }
                        rows="3"
                      />
                    </label>

                    <label>
                      Order
                      <input
                        type="number"
                        value={editingOrder}
                        onChange={(event) =>
                          setEditingOrder(event.target.value)
                        }
                        min="0"
                      />
                    </label>

                    <div className="action-row">
                      <button
                        type="button"
                        onClick={() => handleUpdateSection(section.id)}
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
                      <h5>
                        {section.order_index}. {section.name}
                      </h5>

                      <span
                        className={
                          section.is_visible_to_students
                            ? "status-badge published-badge"
                            : "status-badge hidden-badge"
                        }
                      >
                        {section.is_visible_to_students
                          ? "Visible to students"
                          : "Hidden from students"}
                      </span>
                    </div>

                    <p>{section.description || "No description provided."}</p>

                    <div className="action-row">
                      <button
                        type="button"
                        onClick={() => startEditing(section)}
                      >
                        Edit section
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleVisibility(section)}
                      >
                        {section.is_visible_to_students
                          ? "Hide from students"
                          : "Publish to students"}
                      </button>

                      <button
                        type="button"
                        className="danger-button"
                        onClick={() => setSectionToDelete(section)}
                      >
                        Delete section
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {sectionToDelete && (
        <ConfirmModal
          title="Delete section"
          message={`Are you sure you want to delete "${sectionToDelete.name}"? This action cannot be undone.`}
          confirmText="Delete"
          cancelText="Cancel"
          onConfirm={confirmDeleteSection}
          onCancel={() => setSectionToDelete(null)}
        />
      )}
    </div>
  );
}

export default FolderSectionsManager;
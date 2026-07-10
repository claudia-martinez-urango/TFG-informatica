import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "../auth/AuthContext";
import {
  approveFolderJoinRequest,
  createLearningFolder,
  createOrganization,
  deleteLearningFolder,
  getFolderJoinRequests,
  getFolderStudents,
  getTeacherFolders,
  getTeacherOrganization,
  rejectFolderJoinRequest,
  removeStudentFromFolder,
  updateFolderVisibility,
  updateLearningFolder,
  updateOrganization,
} from "../api/foldersApi";
import FolderSectionsManager from "../components/folders/FolderSectionsManager";
import QuickAddReadingModal from "../components/folders/QuickAddReadingModal";

function TeacherFoldersPage() {
  const { profile } = useAuth();
  const location    = useLocation();

  const [organization, setOrganization] = useState(null);
  const [folders, setFolders] = useState([]);

  const [expandedFolders, setExpandedFolders] = useState(new Set());

  const [selectedFolderStudents, setSelectedFolderStudents] = useState({});
  const [visibleStudentsFolderId, setVisibleStudentsFolderId] = useState(null);

  const [selectedFolderRequests, setSelectedFolderRequests] = useState({});
  const [visibleRequestsFolderId, setVisibleRequestsFolderId] = useState(null);

  const [organizationName, setOrganizationName] = useState("");
  const [organizationEditName, setOrganizationEditName] = useState("");

  const [folderName, setFolderName] = useState("");
  const [folderDescription, setFolderDescription] = useState("");

  const [editingFolderId, setEditingFolderId] = useState(null);
  const [editingFolderName, setEditingFolderName] = useState("");
  const [editingFolderDescription, setEditingFolderDescription] = useState("");

  const [searchTerm, setSearchTerm] = useState("");

  const [showQuickAddReading, setShowQuickAddReading] = useState(false);
  const [quickAddMessage, setQuickAddMessage] = useState("");
  const [lastCreatedReadingLocation, setLastCreatedReadingLocation] = useState(null);

  const [loading, setLoading] = useState(true);
  const [organizationMessage, setOrganizationMessage] = useState("");
  const [folderMessage, setFolderMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  async function loadData() {
    if (!profile?.id) return;

    try {
      setLoading(true);
      setErrorMessage("");

      const org = await getTeacherOrganization(profile.id);
      setOrganization(org);
      setOrganizationEditName(org?.name || "");

      const teacherFolders = await getTeacherFolders(profile.id);
      setFolders(teacherFolders);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [profile?.id]);

  // Auto-expand and scroll to a folder when navigated from dashboard
  useEffect(() => {
    const targetId = location.state?.openFolderId;
    if (!targetId || folders.length === 0) return;
    setExpandedFolders((prev) => new Set([...prev, targetId]));
    setTimeout(() => {
      const el = document.getElementById(`folder-${targetId}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
  }, [folders, location.state?.openFolderId]);

  function clearMessages() {
    setOrganizationMessage("");
    setFolderMessage("");
    setErrorMessage("");
  }

  function toggleExpanded(folderId) {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  }

  async function handleCreateOrganization(event) {
    event.preventDefault();
    try {
      clearMessages();
      const newOrg = await createOrganization({ name: organizationName, teacherId: profile.id });
      setOrganization(newOrg);
      setOrganizationEditName(newOrg.name);
      setOrganizationName("");
      setOrganizationMessage("Organization created successfully.");
    } catch (error) {
      setErrorMessage(error.message);
    }
  }

  async function handleUpdateOrganization(event) {
    event.preventDefault();
    if (!organization) return;
    try {
      clearMessages();
      const updated = await updateOrganization({ organizationId: organization.id, name: organizationEditName });
      setOrganization(updated);
      setOrganizationMessage("Organization updated successfully.");
    } catch (error) {
      setErrorMessage(error.message);
    }
  }

  async function handleCreateFolder(event) {
    event.preventDefault();
    if (!organization) {
      setErrorMessage("You need to create an organization first.");
      return;
    }
    try {
      clearMessages();
      const newFolder = await createLearningFolder({
        organizationId: organization.id,
        teacherId: profile.id,
        name: folderName,
        description: folderDescription,
      });
      setFolders([newFolder, ...folders]);
      setFolderName("");
      setFolderDescription("");
      setFolderMessage("Folder created successfully.");
    } catch (error) {
      setErrorMessage(error.message);
    }
  }

  function startEditingFolder(folder) {
    setEditingFolderId(folder.id);
    setEditingFolderName(folder.name);
    setEditingFolderDescription(folder.description || "");
    setExpandedFolders((prev) => new Set([...prev, folder.id]));
  }

  function cancelEditingFolder() {
    setEditingFolderId(null);
    setEditingFolderName("");
    setEditingFolderDescription("");
  }

  async function handleUpdateFolder(folderId) {
    try {
      clearMessages();
      const updated = await updateLearningFolder({
        folderId,
        name: editingFolderName,
        description: editingFolderDescription,
      });
      setFolders(folders.map((f) => (f.id === folderId ? updated : f)));
      cancelEditingFolder();
      setFolderMessage("Folder updated successfully.");
    } catch (error) {
      setErrorMessage(error.message);
    }
  }

  async function handleToggleVisibility(folder) {
    try {
      clearMessages();
      const updated = await updateFolderVisibility({
        folderId: folder.id,
        isVisibleToStudents: !folder.is_visible_to_students,
      });
      setFolders(folders.map((f) => (f.id === folder.id ? updated : f)));
      setFolderMessage(
        updated.is_visible_to_students
          ? "Folder published. Students can now see it."
          : "Folder hidden. Students can no longer see it."
      );
    } catch (error) {
      setErrorMessage(error.message);
    }
  }

  async function handleDeleteFolder(folderId) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this folder? Students will lose access to it."
    );
    if (!confirmed) return;

    try {
      clearMessages();
      await deleteLearningFolder(folderId);
      setFolders(folders.filter((f) => f.id !== folderId));
      setSelectedFolderStudents((prev) => { const c = { ...prev }; delete c[folderId]; return c; });
      setSelectedFolderRequests((prev) => { const c = { ...prev }; delete c[folderId]; return c; });
      if (visibleStudentsFolderId === folderId) setVisibleStudentsFolderId(null);
      if (visibleRequestsFolderId === folderId) setVisibleRequestsFolderId(null);
      setExpandedFolders((prev) => { const n = new Set(prev); n.delete(folderId); return n; });
      setFolderMessage("Folder deleted successfully.");
    } catch (error) {
      setErrorMessage(error.message);
    }
  }

  async function handleToggleStudents(folderId) {
    if (visibleStudentsFolderId === folderId) {
      setVisibleStudentsFolderId(null);
      return;
    }
    try {
      clearMessages();
      const students = await getFolderStudents(folderId);
      setSelectedFolderStudents({ ...selectedFolderStudents, [folderId]: students });
      setVisibleStudentsFolderId(folderId);
    } catch (error) {
      setErrorMessage(error.message);
    }
  }

  async function handleToggleRequests(folderId) {
    if (visibleRequestsFolderId === folderId) {
      setVisibleRequestsFolderId(null);
      return;
    }
    try {
      clearMessages();
      const requests = await getFolderJoinRequests(folderId);
      setSelectedFolderRequests({ ...selectedFolderRequests, [folderId]: requests });
      setVisibleRequestsFolderId(folderId);
    } catch (error) {
      setErrorMessage(error.message);
    }
  }

  async function handleApproveRequest(folderId, requestId) {
    try {
      clearMessages();
      await approveFolderJoinRequest(requestId);
      const [updatedRequests, updatedStudents] = await Promise.all([
        getFolderJoinRequests(folderId),
        getFolderStudents(folderId),
      ]);
      setSelectedFolderRequests({ ...selectedFolderRequests, [folderId]: updatedRequests });
      setSelectedFolderStudents({ ...selectedFolderStudents, [folderId]: updatedStudents });
      setFolderMessage("Request approved successfully.");
    } catch (error) {
      setErrorMessage(error.message);
    }
  }

  async function handleRejectRequest(folderId, requestId) {
    try {
      clearMessages();
      await rejectFolderJoinRequest(requestId);
      const updatedRequests = await getFolderJoinRequests(folderId);
      setSelectedFolderRequests({ ...selectedFolderRequests, [folderId]: updatedRequests });
      setFolderMessage("Request rejected.");
    } catch (error) {
      setErrorMessage(error.message);
    }
  }

  async function handleRemoveStudent(folderId, studentId) {
    const confirmed = window.confirm("Are you sure you want to remove this student from the folder?");
    if (!confirmed) return;

    try {
      clearMessages();
      await removeStudentFromFolder(folderId, studentId);
      const [updatedStudents, updatedRequests] = await Promise.all([
        getFolderStudents(folderId),
        getFolderJoinRequests(folderId),
      ]);
      setSelectedFolderStudents({ ...selectedFolderStudents, [folderId]: updatedStudents });
      setSelectedFolderRequests({ ...selectedFolderRequests, [folderId]: updatedRequests });
      setFolderMessage("Student removed from folder.");
    } catch (error) {
      setErrorMessage(error.message);
    }
  }

  function handleQuickReadingCreated({ folderId, sectionId }) {
    setShowQuickAddReading(false);
    setQuickAddMessage("Reading created successfully. It is hidden from students by default.");
    setLastCreatedReadingLocation({ folderId, sectionId });
    setExpandedFolders((prev) => new Set([...prev, folderId]));
    setTimeout(() => {
      const el = document.getElementById(`folder-${folderId}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
  }

  const filteredFolders = folders.filter((f) =>
    f.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <main className="page">Loading folders...</main>;
  }

  return (
    <main className="page">
      <h1>Teacher Folders</h1>

      <section className="section">
        {organization ? (
          <div className="info-box">
            <h2>Your organization</h2>
            <p>You belong to: <strong>{organization.name}</strong></p>
            <form onSubmit={handleUpdateOrganization} className="form">
              <label>
                Modify organization name
                <input
                  type="text"
                  value={organizationEditName}
                  onChange={(e) => setOrganizationEditName(e.target.value)}
                  required
                />
              </label>
              <button type="submit">Update organization</button>
            </form>
            {organizationMessage && <p className="success">{organizationMessage}</p>}
          </div>
        ) : (
          <div className="info-box">
            <h2>Create your organization</h2>
            <p>Before creating folders, define the organization you belong to.</p>
            <form onSubmit={handleCreateOrganization} className="form">
              <label>
                Organization name
                <input
                  type="text"
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  placeholder="Universidad Francisco de Vitoria"
                  required
                />
              </label>
              <button type="submit">Create organization</button>
            </form>
            {organizationMessage && <p className="success">{organizationMessage}</p>}
          </div>
        )}
      </section>

      {organization && (
        <section className="section">
          <h2>Create folder</h2>
          <form onSubmit={handleCreateFolder} className="form">
            <label>
              Folder name
              <input
                type="text"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                placeholder="English Vocabulary B2"
                required
              />
            </label>
            <label>
              Description
              <textarea
                value={folderDescription}
                onChange={(e) => setFolderDescription(e.target.value)}
                placeholder="Folder for vocabulary readings and practice."
                rows="3"
              />
            </label>
            <button type="submit">Create folder</button>
          </form>
          {folderMessage && <p className="success">{folderMessage}</p>}
        </section>
      )}

      {errorMessage && <p className="error">{errorMessage}</p>}

      <section className="section">
        <div className="folder-list-header">
          <h2>Your folders</h2>
          <div className="folder-list-header-actions">
            {folders.length > 0 && (
              <input
                type="search"
                className="folder-search-input"
                placeholder="Search by name…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            )}
            {folders.length > 0 && (
              <button
                type="button"
                className="primary-button"
                onClick={() => setShowQuickAddReading(true)}
              >
                + Add Reading
              </button>
            )}
          </div>
        </div>

        {quickAddMessage && <p className="success">{quickAddMessage}</p>}

        {folders.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>No folders created yet.</p>
        ) : filteredFolders.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>
            No folders match &quot;{searchTerm}&quot;.
          </p>
        ) : (
          <div className="teacher-folder-list">
            {filteredFolders.map((folder) => {
              const joinUrl = `${window.location.origin}/join/${folder.join_code}`;
              const isEditing = editingFolderId === folder.id;
              const isExpanded = expandedFolders.has(folder.id);
              const isVisible = folder.is_visible_to_students ?? true;
              const students = selectedFolderStudents[folder.id] || [];
              const requests = selectedFolderRequests[folder.id] || [];
              const showStudents = visibleStudentsFolderId === folder.id;
              const showRequests = visibleRequestsFolderId === folder.id;

              return (
                <article key={folder.id} id={`folder-${folder.id}`} className="folder-row-card">
                  {/* Header — siempre visible */}
                  <div className="folder-row-header">
                    <div className="folder-row-info">
                      <h3>{folder.name}</h3>
                      <span
                        className={
                          isVisible
                            ? "status-badge published-badge"
                            : "status-badge hidden-badge"
                        }
                      >
                        {isVisible ? "Visible to students" : "Hidden from students"}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="folder-expand-btn"
                      onClick={() => toggleExpanded(folder.id)}
                      aria-expanded={isExpanded}
                    >
                      {isExpanded ? "Collapse ▲" : "Expand ▼"}
                    </button>
                  </div>

                  {/* Cuerpo — colapsable */}
                  {isExpanded && (
                    <div className="folder-row-body">
                      {isEditing ? (
                        <div className="edit-folder-form">
                          <label>
                            Folder name
                            <input
                              type="text"
                              value={editingFolderName}
                              onChange={(e) => setEditingFolderName(e.target.value)}
                              required
                            />
                          </label>
                          <label>
                            Description
                            <textarea
                              value={editingFolderDescription}
                              onChange={(e) => setEditingFolderDescription(e.target.value)}
                              rows="3"
                            />
                          </label>
                          <div className="action-row">
                            <button type="button" onClick={() => handleUpdateFolder(folder.id)}>
                              Save
                            </button>
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={cancelEditingFolder}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p style={{ color: "var(--text-muted)", fontSize: "14px", marginTop: 0 }}>
                            {folder.description || "No description provided."}
                          </p>

                          <p style={{ fontSize: "14px" }}>
                            Join code: <strong>{folder.join_code}</strong>
                          </p>

                          <div className="qr-box">
                            <QRCodeSVG value={joinUrl} size={128} />
                          </div>

                          <p className="small-text">{joinUrl}</p>

                          <div className="action-row">
                            <button type="button" onClick={() => startEditingFolder(folder)}>
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() => handleToggleVisibility(folder)}
                            >
                              {isVisible ? "Hide from students" : "Publish to students"}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleToggleStudents(folder.id)}
                            >
                              {showStudents ? "Hide students" : "View students"}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleToggleRequests(folder.id)}
                            >
                              {showRequests ? "Hide requests" : "View requests"}
                            </button>

                            <button
                              type="button"
                              className="danger-button"
                              onClick={() => handleDeleteFolder(folder.id)}
                            >
                              Delete
                            </button>
                          </div>

                          {showStudents && (
                            <div className="students-box">
                              <h4>Joined students</h4>
                              {students.length === 0 ? (
                                <p style={{ fontSize: "14px", margin: 0, color: "var(--text-muted)" }}>
                                  No students have joined this folder yet.
                                </p>
                              ) : (
                                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                                  {students.map((student) => (
                                    <li key={student.student_id} className="student-row">
                                      <span>
                                        {student.first_name} {student.last_name} — {student.email}
                                      </span>
                                      <button
                                        type="button"
                                        className="danger-button small-button"
                                        onClick={() =>
                                          handleRemoveStudent(folder.id, student.student_id)
                                        }
                                      >
                                        Remove
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          )}

                          {showRequests && (
                            <div className="students-box">
                              <h4>Join requests</h4>
                              {requests.length === 0 ? (
                                <p style={{ fontSize: "14px", margin: 0, color: "var(--text-muted)" }}>
                                  No join requests for this folder.
                                </p>
                              ) : (
                                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                                  {requests.map((request) => (
                                    <li key={request.request_id} className="student-row">
                                      <span>
                                        {request.first_name} {request.last_name} — {request.email}{" "}
                                        — <strong>{request.status}</strong>
                                      </span>
                                      {request.status === "pending" && (
                                        <div className="request-actions">
                                          <button
                                            type="button"
                                            className="small-button success-button"
                                            onClick={() =>
                                              handleApproveRequest(folder.id, request.request_id)
                                            }
                                          >
                                            Accept
                                          </button>
                                          <button
                                            type="button"
                                            className="danger-button small-button"
                                            onClick={() =>
                                              handleRejectRequest(folder.id, request.request_id)
                                            }
                                          >
                                            Reject
                                          </button>
                                        </div>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          )}

                          <FolderSectionsManager
                            folderId={folder.id}
                            autoOpenSectionId={
                              lastCreatedReadingLocation?.folderId === folder.id
                                ? lastCreatedReadingLocation.sectionId
                                : undefined
                            }
                          />
                        </>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {showQuickAddReading && (
        <QuickAddReadingModal
          folders={folders}
          onClose={() => setShowQuickAddReading(false)}
          onCreated={handleQuickReadingCreated}
        />
      )}
    </main>
  );
}

export default TeacherFoldersPage;

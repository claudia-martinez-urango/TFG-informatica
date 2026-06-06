import { useEffect, useState } from "react";
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
  updateLearningFolder,
  updateOrganization,
} from "../api/foldersApi";

function TeacherFoldersPage() {
  const { profile } = useAuth();

  const [organization, setOrganization] = useState(null);
  const [folders, setFolders] = useState([]);

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

  async function handleCreateOrganization(event) {
    event.preventDefault();

    try {
      setOrganizationMessage("");
      setFolderMessage("");
      setErrorMessage("");

      const newOrganization = await createOrganization({
        name: organizationName,
        teacherId: profile.id,
      });

      setOrganization(newOrganization);
      setOrganizationEditName(newOrganization.name);
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
      setOrganizationMessage("");
      setFolderMessage("");
      setErrorMessage("");

      const updatedOrganization = await updateOrganization({
        organizationId: organization.id,
        name: organizationEditName,
      });

      setOrganization(updatedOrganization);
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
      setOrganizationMessage("");
      setFolderMessage("");
      setErrorMessage("");

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
  }

  function cancelEditingFolder() {
    setEditingFolderId(null);
    setEditingFolderName("");
    setEditingFolderDescription("");
  }

  async function handleUpdateFolder(folderId) {
    try {
      setOrganizationMessage("");
      setFolderMessage("");
      setErrorMessage("");

      const updatedFolder = await updateLearningFolder({
        folderId,
        name: editingFolderName,
        description: editingFolderDescription,
      });

      setFolders(
        folders.map((folder) =>
          folder.id === folderId ? updatedFolder : folder
        )
      );

      cancelEditingFolder();
      setFolderMessage("Folder updated successfully.");
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
      setOrganizationMessage("");
      setFolderMessage("");
      setErrorMessage("");

      await deleteLearningFolder(folderId);

      setFolders(folders.filter((folder) => folder.id !== folderId));

      setSelectedFolderStudents((currentStudents) => {
        const copy = { ...currentStudents };
        delete copy[folderId];
        return copy;
      });

      setSelectedFolderRequests((currentRequests) => {
        const copy = { ...currentRequests };
        delete copy[folderId];
        return copy;
      });

      if (visibleStudentsFolderId === folderId) {
        setVisibleStudentsFolderId(null);
      }

      if (visibleRequestsFolderId === folderId) {
        setVisibleRequestsFolderId(null);
      }

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
      setOrganizationMessage("");
      setFolderMessage("");
      setErrorMessage("");

      const students = await getFolderStudents(folderId);

      setSelectedFolderStudents({
        ...selectedFolderStudents,
        [folderId]: students,
      });

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
      setOrganizationMessage("");
      setFolderMessage("");
      setErrorMessage("");

      const requests = await getFolderJoinRequests(folderId);

      setSelectedFolderRequests({
        ...selectedFolderRequests,
        [folderId]: requests,
      });

      setVisibleRequestsFolderId(folderId);
    } catch (error) {
      setErrorMessage(error.message);
    }
  }

  async function handleApproveRequest(folderId, requestId) {
    try {
      setOrganizationMessage("");
      setFolderMessage("");
      setErrorMessage("");

      await approveFolderJoinRequest(requestId);

      const updatedRequests = await getFolderJoinRequests(folderId);
      const updatedStudents = await getFolderStudents(folderId);

      setSelectedFolderRequests({
        ...selectedFolderRequests,
        [folderId]: updatedRequests,
      });

      setSelectedFolderStudents({
        ...selectedFolderStudents,
        [folderId]: updatedStudents,
      });

      setFolderMessage("Request approved successfully.");
    } catch (error) {
      setErrorMessage(error.message);
    }
  }

  async function handleRejectRequest(folderId, requestId) {
    try {
      setOrganizationMessage("");
      setFolderMessage("");
      setErrorMessage("");

      await rejectFolderJoinRequest(requestId);

      const updatedRequests = await getFolderJoinRequests(folderId);

      setSelectedFolderRequests({
        ...selectedFolderRequests,
        [folderId]: updatedRequests,
      });

      setFolderMessage("Request rejected.");
    } catch (error) {
      setErrorMessage(error.message);
    }
  }

  async function handleRemoveStudent(folderId, studentId) {
    const confirmed = window.confirm(
      "Are you sure you want to remove this student from the folder?"
    );

    if (!confirmed) return;

    try {
      setOrganizationMessage("");
      setFolderMessage("");
      setErrorMessage("");

      await removeStudentFromFolder(folderId, studentId);

      const updatedStudents = await getFolderStudents(folderId);
      const updatedRequests = await getFolderJoinRequests(folderId);

      setSelectedFolderStudents({
        ...selectedFolderStudents,
        [folderId]: updatedStudents,
      });

      setSelectedFolderRequests({
        ...selectedFolderRequests,
        [folderId]: updatedRequests,
      });

      setFolderMessage("Student removed from folder.");
    } catch (error) {
      setErrorMessage(error.message);
    }
  }

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

            <p>
              You belong to: <strong>{organization.name}</strong>
            </p>

            <form onSubmit={handleUpdateOrganization} className="form">
              <label>
                Modify organization name
                <input
                  type="text"
                  value={organizationEditName}
                  onChange={(event) =>
                    setOrganizationEditName(event.target.value)
                  }
                  required
                />
              </label>

              <button type="submit">Update organization</button>
            </form>

            {organizationMessage && (
              <p className="success">{organizationMessage}</p>
            )}
          </div>
        ) : (
          <div className="info-box">
            <h2>Create your organization</h2>

            <p>
              Before creating folders, define the organization you belong to.
            </p>

            <form onSubmit={handleCreateOrganization} className="form">
              <label>
                Organization name
                <input
                  type="text"
                  value={organizationName}
                  onChange={(event) => setOrganizationName(event.target.value)}
                  placeholder="Universidad Francisco de Vitoria"
                  required
                />
              </label>

              <button type="submit">Create organization</button>
            </form>

            {organizationMessage && (
              <p className="success">{organizationMessage}</p>
            )}
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
                onChange={(event) => setFolderName(event.target.value)}
                placeholder="English Vocabulary B2"
                required
              />
            </label>

            <label>
              Description
              <textarea
                value={folderDescription}
                onChange={(event) => setFolderDescription(event.target.value)}
                placeholder="Folder for vocabulary readings and practice."
                rows="4"
              />
            </label>

            <button type="submit">Create folder</button>
          </form>

          {folderMessage && <p className="success">{folderMessage}</p>}
        </section>
      )}

      {errorMessage && <p className="error">{errorMessage}</p>}

      <section className="section">
        <h2>Your folders</h2>

        {folders.length === 0 ? (
          <p>No folders created yet.</p>
        ) : (
          <div className="folder-grid">
            {folders.map((folder) => {
              const joinUrl = `${window.location.origin}/join/${folder.join_code}`;
              const isEditing = editingFolderId === folder.id;
              const students = selectedFolderStudents[folder.id] || [];
              const requests = selectedFolderRequests[folder.id] || [];
              const showStudents = visibleStudentsFolderId === folder.id;
              const showRequests = visibleRequestsFolderId === folder.id;

              return (
                <article key={folder.id} className="folder-card">
                  {isEditing ? (
                    <div className="edit-folder-form">
                      <label>
                        Folder name
                        <input
                          type="text"
                          value={editingFolderName}
                          onChange={(event) =>
                            setEditingFolderName(event.target.value)
                          }
                          required
                        />
                      </label>

                      <label>
                        Description
                        <textarea
                          value={editingFolderDescription}
                          onChange={(event) =>
                            setEditingFolderDescription(event.target.value)
                          }
                          rows="4"
                        />
                      </label>

                      <div className="action-row">
                        <button
                          type="button"
                          onClick={() => handleUpdateFolder(folder.id)}
                        >
                          Save
                        </button>

                        <button type="button" onClick={cancelEditingFolder}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <h3>{folder.name}</h3>

                      <p>{folder.description || "No description provided."}</p>

                      <p>
                        Join code: <strong>{folder.join_code}</strong>
                      </p>

                      <div className="qr-box">
                        <QRCodeSVG value={joinUrl} size={128} />
                      </div>

                      <p className="small-text">{joinUrl}</p>

                      <div className="action-row">
                        <button
                          type="button"
                          onClick={() => startEditingFolder(folder)}
                        >
                          Edit
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
                            <p>No students have joined this folder yet.</p>
                          ) : (
                            <ul>
                              {students.map((student) => (
                                <li
                                  key={student.student_id}
                                  className="student-row"
                                >
                                  <span>
                                    {student.first_name} {student.last_name} —{" "}
                                    {student.email}
                                  </span>

                                  <button
                                    type="button"
                                    className="danger-button small-button"
                                    onClick={() =>
                                      handleRemoveStudent(
                                        folder.id,
                                        student.student_id
                                      )
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
                            <p>No join requests for this folder.</p>
                          ) : (
                            <ul>
                              {requests.map((request) => (
                                <li
                                  key={request.request_id}
                                  className="student-row"
                                >
                                  <span>
                                    {request.first_name} {request.last_name} —{" "}
                                    {request.email} —{" "}
                                    <strong>{request.status}</strong>
                                  </span>

                                  {request.status === "pending" && (
                                    <div className="request-actions">
                                      <button
                                        type="button"
                                        className="small-button"
                                        onClick={() =>
                                          handleApproveRequest(
                                            folder.id,
                                            request.request_id
                                          )
                                        }
                                      >
                                        Accept
                                      </button>

                                      <button
                                        type="button"
                                        className="danger-button small-button"
                                        onClick={() =>
                                          handleRejectRequest(
                                            folder.id,
                                            request.request_id
                                          )
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
                    </>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

export default TeacherFoldersPage;
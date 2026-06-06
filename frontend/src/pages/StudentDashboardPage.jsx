import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { getMyStudentFolders } from "../api/foldersApi";
import { getFolderSections } from "../api/sectionsApi";

function StudentDashboardPage() {
  const { profile } = useAuth();
  const [folders, setFolders] = useState([]);
  const [sectionsByFolder, setSectionsByFolder] = useState({});
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadFoldersAndSections() {
      try {
        const data = await getMyStudentFolders();
        setFolders(data);

        const sectionsMap = {};

        for (const folder of data) {
          const sections = await getFolderSections(folder.folder_id);
          sectionsMap[folder.folder_id] = sections;
        }

        setSectionsByFolder(sectionsMap);
      } catch (error) {
        setErrorMessage(error.message);
      }
    }

    loadFoldersAndSections();
  }, []);

  return (
    <main className="page">
      <h1>Student Dashboard</h1>

      <p>
        Welcome, {profile?.first_name} {profile?.last_name}.
      </p>

      <p>
        Here the student will see assigned readings, saved glossary terms,
        practice activities and progress by Bloom level.
      </p>

      {errorMessage && <p className="error">{errorMessage}</p>}

      <section className="section">
        <h2>My folders</h2>

        {folders.length === 0 ? (
          <p>You have not joined any folders yet.</p>
        ) : (
          <div className="folder-grid">
            {folders.map((folder) => {
              const sections = sectionsByFolder[folder.folder_id] || [];

              return (
                <article key={folder.folder_id} className="folder-card">
                  <h3>{folder.folder_name}</h3>

                  <p>
                    {folder.folder_description || "No description provided."}
                  </p>

                  <p>
                    Organization: <strong>{folder.organization_name}</strong>
                  </p>

                  <p>
                    Code: <strong>{folder.join_code}</strong>
                  </p>

                  <div className="student-sections-box">
                    <h4>Sections</h4>

                    {sections.length === 0 ? (
                      <p>No sections available yet.</p>
                    ) : (
                      <ul>
                        {sections.map((section) => (
                          <li key={section.id}>
                            <strong>
                              {section.order_index}. {section.name}
                            </strong>
                            <br />
                            {section.description || "No description provided."}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

export default StudentDashboardPage;
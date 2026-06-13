import { Link } from 'react-router-dom';

function TeacherFolderOverview({ folders }) {
  if (!folders || folders.length === 0) {
    return (
      <div className="dashboard-empty-state">
        No folders created yet.{' '}
        <Link to="/teacher/folders">Create your first folder</Link>.
      </div>
    );
  }

  return (
    <div className="teacher-folder-overview">
      <div className="overview-table-wrapper">
        <table className="overview-table">
          <thead>
            <tr>
              <th>Folder</th>
              <th>Organisation</th>
              <th>Visibility</th>
              <th>Students</th>
              <th>Sections</th>
              <th>Readings</th>
              <th>Requests</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {folders.map((folder) => (
              <tr key={folder.folder_id}>
                <td className="overview-table-name">{folder.folder_name}</td>
                <td className="overview-table-org">{folder.organization_name}</td>
                <td>
                  {folder.is_visible_to_students ? (
                    <span className="badge badge--success">Visible</span>
                  ) : (
                    <span className="badge badge--muted">Hidden</span>
                  )}
                </td>
                <td>{folder.students_count}</td>
                <td>{folder.sections_count}</td>
                <td>{folder.readings_count}</td>
                <td>
                  {folder.pending_requests_count > 0 ? (
                    <span className="badge badge--warning">
                      {folder.pending_requests_count} pending
                    </span>
                  ) : (
                    <span style={{ color: 'var(--text-light)' }}>0</span>
                  )}
                </td>
                <td>
                  <Link
                    to="/teacher/folders"
                    state={{ openFolderId: folder.folder_id }}
                    className="overview-table-link"
                  >
                    Manage
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default TeacherFolderOverview;

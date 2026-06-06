import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

function TeacherDashboardPage() {
  const { profile } = useAuth();

  return (
    <main className="page">
      <div className="dashboard-welcome">
        <h2>Welcome back, {profile?.first_name} {profile?.last_name}</h2>
        <p>Manage your folders, sections, and student access from here.</p>
      </div>

      <h1>Teacher Dashboard</h1>

      <p>
        Create folders to organise your content, add sections with readings,
        and control what students can see. Share folders via code or QR and
        approve student requests.
      </p>

      <div className="action-row">
        <Link to="/teacher/folders">
          <button type="button">Manage folders</button>
        </Link>
      </div>
    </main>
  );
}

export default TeacherDashboardPage;

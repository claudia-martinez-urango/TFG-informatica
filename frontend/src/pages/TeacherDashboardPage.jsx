import { useAuth } from "../auth/AuthContext";

function TeacherDashboardPage() {
  const { profile } = useAuth();

  return (
    <main className="page">
      <h1>Teacher Dashboard</h1>

      <p>
        Welcome, {profile?.first_name} {profile?.last_name}.
      </p>

      <p>
        Here the teacher will create courses, upload readings, select vocabulary
        and monitor student progress.
      </p>
    </main>
  );
}

export default TeacherDashboardPage;
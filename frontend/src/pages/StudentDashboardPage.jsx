import { useAuth } from "../auth/AuthContext";

function StudentDashboardPage() {
  const { profile } = useAuth();

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
    </main>
  );
}

export default StudentDashboardPage;
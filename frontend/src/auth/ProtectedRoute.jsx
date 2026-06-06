import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

function ProtectedRoute({ children, allowedRole }) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return <main className="page">Loading...</main>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!profile) {
    return (
      <main className="page">
        <h1>Profile not found</h1>
        <p>Your user account exists, but your profile could not be loaded.</p>
      </main>
    );
  }

  if (allowedRole && profile.role !== allowedRole) {
    if (profile.role === "teacher") {
      return <Navigate to="/teacher/dashboard" replace />;
    }

    if (profile.role === "student") {
      return <Navigate to="/student/dashboard" replace />;
    }

    return <Navigate to="/" replace />;
  }

  return children;
}

export default ProtectedRoute;
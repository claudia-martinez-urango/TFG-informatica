import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { requestJoinFolderByCode } from "../api/foldersApi";

function JoinFolderPage() {
  const { joinCode } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [code, setCode] = useState(joinCode || "");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleJoin(event) {
    event.preventDefault();

    if (profile?.role !== "student") {
      setErrorMessage("Only students can request access to folders.");
      return;
    }

    try {
      setLoading(true);
      setMessage("");
      setErrorMessage("");

      const request = await requestJoinFolderByCode(code.trim());

      if (!request) {
        setErrorMessage("Folder not found.");
        return;
      }

      setMessage(
        `Your request to join "${request.folder_name}" has been sent to the teacher.`
      );

      setTimeout(() => {
        navigate("/student/dashboard");
      }, 1800);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (joinCode && profile?.role === "student") {
      setCode(joinCode);
    }
  }, [joinCode, profile?.role]);

  return (
    <main className="page">
      <h1>Join folder</h1>

      <p>
        Enter the numeric code provided by your teacher or scan the QR code.
        The teacher must approve your request before you can access the folder.
      </p>

      <form onSubmit={handleJoin} className="form">
        <label>
          Folder code
          <input
            type="text"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="482913"
            required
          />
        </label>

        <button type="submit" disabled={loading}>
          {loading ? "Sending request..." : "Request access"}
        </button>
      </form>

      {message && <p className="success">{message}</p>}
      {errorMessage && <p className="error">{errorMessage}</p>}
    </main>
  );
}

export default JoinFolderPage;
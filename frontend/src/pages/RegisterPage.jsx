import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../auth/supabaseClient";

function RegisterPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState("student");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const passwordRules = useMemo(() => {
    return {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      symbol: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password),
    };
  }, [password]);

  const isPasswordValid = Object.values(passwordRules).every(Boolean);

  async function handleRegister(event) {
    event.preventDefault();

    setMessage("");
    setErrorMessage("");

    if (!isPasswordValid) {
      setErrorMessage("Password does not meet the required security rules.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          role,
        },
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });

    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }

    setMessage(
      "Account created successfully. Please check your email to confirm your account before logging in."
    );

    setFirstName("");
    setLastName("");
    setRole("student");
    setEmail("");
    setPassword("");
    setLoading(false);
  }

  return (
    <main className="page">
      <h1>Register</h1>

      <form onSubmit={handleRegister} className="form">
        <label>
          First name
          <input
            type="text"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            required
          />
        </label>

        <label>
          Last name
          <input
            type="text"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            required
          />
        </label>

        <label>
          Role
          <select
            value={role}
            onChange={(event) => setRole(event.target.value)}
          >
            <option value="student">Student</option>
            <option value="teacher">Teacher</option>
          </select>
        </label>

        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>

        <div className="password-rules">
          <p>Password must contain:</p>
          <ul>
            <li className={passwordRules.length ? "valid-rule" : "invalid-rule"}>
              At least 8 characters
            </li>
            <li className={passwordRules.uppercase ? "valid-rule" : "invalid-rule"}>
              One uppercase letter
            </li>
            <li className={passwordRules.lowercase ? "valid-rule" : "invalid-rule"}>
              One lowercase letter
            </li>
            <li className={passwordRules.number ? "valid-rule" : "invalid-rule"}>
              One number
            </li>
            <li className={passwordRules.symbol ? "valid-rule" : "invalid-rule"}>
              One symbol
            </li>
          </ul>
        </div>

        <button type="submit" disabled={loading || !isPasswordValid}>
          {loading ? "Creating account..." : "Register"}
        </button>
      </form>

      <p>
        Already have an account? <Link to="/login">Login here</Link>
      </p>

      {message && <p className="success">{message}</p>}
      {errorMessage && <p className="error">{errorMessage}</p>}
    </main>
  );
}

export default RegisterPage;
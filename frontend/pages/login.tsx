import React, { useState } from "react";
import { useRouter } from "next/router";

const LoginPage: React.FC = () => {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (res.ok && data.token) {
        // Save JWT and redirect (replace with your method)
        localStorage.setItem("token", data.token);
        router.push("/dashboard");
      } else {
        setError(data.error || "Login failed.");
      }
    } catch (err: any) {
      setError("Network error.");
    }
    setLoading(false);
  };

  return (
    <div style={{ maxWidth: 400, margin: "80px auto", padding: 16, boxShadow: "0 0 8px #ccc", borderRadius: 8 }}>
      <h2 style={{ textAlign: "center" }}>M DENT Login</h2>
      <form onSubmit={handleLogin}>
        <label>
          Email or Username:
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
            style={{ width: "100%", marginBottom: 12 }}
          />
        </label>
        <label>
          Password:
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            style={{ width: "100%", marginBottom: 12 }}
          />
        </label>
        <button type="submit" style={{ width: "100%", padding: 8 }} disabled={loading}>
          {loading ? "Logging in..." : "Login"}
        </button>
        {error && <div style={{ color: "red", marginTop: 12 }}>{error}</div>}
      </form>
    </div>
  );
};

export default LoginPage;

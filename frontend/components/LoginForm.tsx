import { useState } from "react";

export default function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const res = await fetch("https://api.mdent.cloud/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      let data;
      try {
        data = await res.json();
      } catch (jsonErr) {
        setError("Server response was not JSON.");
        return;
      }
      if (res.ok) {
        // Do token set, redirect etc
        alert("Login successful!");
      } else {
        setError(data.error || `Login failed (HTTP ${res.status})`);
      }
    } catch (err: any) {
      setError("Network error: " + (err?.message || ""));
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        name="username"
        value={username}
        onChange={e => setUsername(e.target.value)}
        placeholder="Username"
        autoFocus
        required
      />
      <input
        name="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        placeholder="Password"
        type="password"
        required
      />
      <button type="submit">Login</button>
      {error && <div style={{ color: "red" }}>{error}</div>}
    </form>
  );
}

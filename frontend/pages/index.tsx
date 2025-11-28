import React, { useEffect, useState } from "react";
import Link from "next/link";

export default function Dashboard() {
  const [stats, setStats] = useState({
    patientCount: "-",
    staffCount: "-",
    loading: true,
  });

  useEffect(() => {
    async function fetchStats() {
      try {
        const [patientsRes, usersRes] = await Promise.all([
          fetch("/api/patients"),
          fetch("/api/users")
        ]);
        const patients = await patientsRes.json();
        const users = await usersRes.json();
        setStats({
          patientCount: Array.isArray(patients) ? patients.length : "-",
          staffCount: Array.isArray(users) ? users.length : "-",
          loading: false,
        });
      } catch {
        setStats(s => ({ ...s, loading: false }));
      }
    }
    fetchStats();
  }, []);

  return (
    <main style={{
      maxWidth: 700,
      margin: "40px auto",
      padding: 24,
      fontFamily: "sans-serif"
    }}>
      <h1>🦷 M Dent Dashboard</h1>
      <p style={{ color: "#004080", fontSize: "1.25em" }}>
        Welcome to Mon Family Dental Cloud Clinic Management!
      </p>
      <section style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 16,
        margin: "36px 0"
      }}>
        <div style={{
          background: "#eafeef",
          padding: 24,
          borderRadius: 8,
          boxShadow: "0 2px 8px #b1d",
          textAlign: "center"
        }}>
          <div style={{ fontSize: 42, marginBottom: 2 }}>👥</div>
          <div style={{ fontSize: 24, fontWeight: 600 }}>
            {stats.patientCount}
          </div>
          <div>Patients</div>
        </div>
        <div style={{
          background: "#e7f0fa",
          padding: 24,
          borderRadius: 8,
          boxShadow: "0 2px 8px #1bd",
          textAlign: "center"
        }}>
          <div style={{ fontSize: 42, marginBottom: 2 }}>🧑‍⚕️</div>
          <div style={{ fontSize: 24, fontWeight: 600 }}>
            {stats.staffCount}
          </div>
          <div>Staff</div>
        </div>
      </section>
      <nav style={{ marginTop: 22 }}>
        <h2 style={{ fontSize: "1.2em" }}>Navigate</h2>
        <ul style={{ fontSize: "1.1em", paddingLeft: 10 }}>
          <li><Link href="/patients">Patient Management</Link></li>
          <li><Link href="/appointments">Appointments</Link></li>
          <li><Link href="/encounters">Encounters & History Book</Link></li>
          <li><Link href="/billing">Billing & Invoices</Link></li>
          <li><Link href="/users">Staff/Users</Link></li>
          <li><Link href="/branches">Branches</Link></li>
        </ul>
      </nav>
      <footer style={{ marginTop: 48, fontSize: "0.92em", color: "#888" }}>
        M Dent Software &copy; 2025 – Developed for Mon Family Dental Clinic
      </footer>
    </main>
  );
}

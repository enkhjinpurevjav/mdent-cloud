// Name formatting utilities

import type { Patient, Doctor } from "../types/encounter-admin";

export function formatPatientName(p: Patient): string {
  const name = p.name || "";
  const ovog = (p.ovog || "").trim();
  if (ovog) {
    const first = ovog.charAt(0).toUpperCase();
    return `${first}.${name}`;
  }
  return name || p.regNo || String(p.id);
}

export function formatDoctorName(d: Doctor | null): string {
  if (!d) return "-";
  const name = d.name || "";
  const ovog = (d.ovog || "").trim();
  if (name && ovog) {
    const first = ovog.charAt(0).toUpperCase();
    return `${first}.${name}`;
  }
  if (name) return name;
  return d.email || "-";
}

export function formatStaffName(u: {
  name?: string | null;
  ovog?: string | null;
  email: string;
} | null | undefined): string {
  if (!u) return "-";
  const name = u.name || "";
  const ovog = (u.ovog || "").trim();
  if (name && ovog) {
    const first = ovog.charAt(0).toUpperCase();
    return `${first}.${name}`;
  }
  if (name) return name;
  return u.email || "-";
}

export function formatDoctorDisplayName(d: Doctor | null): string {
  return formatDoctorName(d);
}

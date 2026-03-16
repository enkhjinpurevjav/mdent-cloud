// frontend/pages/reception/patients.tsx
// Reception portal — patient search/create page.
// Receptionist can create and edit patients but NOT delete.
// Delete is hidden in UI; backend also enforces 403 for DELETE.

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import type { AuthUser } from "../../utils/auth";
import { getMe } from "../../utils/auth";
import ReceptionLayout from "../../components/ReceptionLayout";

type Branch = {
  id: number;
  name: string;
};

type Patient = {
  id: number;
  ovog?: string | null;
  name: string;
  regNo?: string | null;
  phone?: string | null;
  branchId: number;
  branch?: { id: number; name: string } | null;
  patientBook?: { bookNumber: string } | null;
  gender?: string | null;
  birthDate?: string | null;
  createdAt?: string;
};

const inputCls =
  "w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

function RequiredMark() {
  return <span className="text-red-500 ml-0.5">*</span>;
}

function RegisterForm({
  branches,
  onSuccess,
}: {
  branches: Branch[];
  onSuccess: (p: Patient) => void;
}) {
  const [form, setForm] = useState({
    ovog: "",
    name: "",
    regNo: "",
    phone: "",
    branchId: "",
    bookNumber: "",
    gender: "",
    birthDate: "",
    citizenship: "Монгол",
    emergencyPhone: "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.branchId) {
      setError("Нэр болон салбар шаардлагатай.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const body: Record<string, unknown> = {
        ovog: form.ovog.trim() || null,
        name: form.name.trim(),
        regNo: form.regNo.trim() || null,
        phone: form.phone.trim() || null,
        branchId: Number(form.branchId),
        gender: form.gender || null,
        birthDate: form.birthDate || null,
        citizenship: form.citizenship || "Монгол",
        emergencyPhone: form.emergencyPhone.trim() || null,
      };
      if (form.bookNumber.trim()) body.bookNumber = form.bookNumber.trim();

      const res = await fetch("/api/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as any).error || "Алдаа гарлаа.");
        return;
      }
      onSuccess(data as Patient);
      setForm({
        ovog: "", name: "", regNo: "", phone: "", branchId: form.branchId,
        bookNumber: "", gender: "", birthDate: "", citizenship: "Монгол", emergencyPhone: "",
      });
    } catch {
      setError("Сүлжээгээ шалгана уу.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {error && (
        <div style={{ color: "#dc2626", fontSize: 13 }}>{error}</div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>Овог</label>
          <input className={inputCls} name="ovog" value={form.ovog} onChange={handleChange} placeholder="Овог" />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>Нэр <RequiredMark /></label>
          <input className={inputCls} name="name" value={form.name} onChange={handleChange} placeholder="Нэр" required />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>Регистрийн дугаар</label>
          <input className={inputCls} name="regNo" value={form.regNo} onChange={handleChange} placeholder="АА99999999" />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>Утасны дугаар</label>
          <input className={inputCls} name="phone" value={form.phone} onChange={handleChange} placeholder="99001122" />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>Салбар <RequiredMark /></label>
          <select className={inputCls} name="branchId" value={form.branchId} onChange={handleChange} required>
            <option value="">Салбар сонгох</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>Картын дугаар</label>
          <input className={inputCls} name="bookNumber" value={form.bookNumber} onChange={handleChange} placeholder="Автомат" />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>Хүйс</label>
          <select className={inputCls} name="gender" value={form.gender} onChange={handleChange}>
            <option value="">—</option>
            <option value="эр">Эрэгтэй</option>
            <option value="эм">Эмэгтэй</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>Төрсөн огноо</label>
          <input className={inputCls} type="date" name="birthDate" value={form.birthDate} onChange={handleChange} />
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          type="submit"
          disabled={submitting}
          style={{ borderRadius: 8, background: "#131a29", color: "#fff", border: "none", padding: "8px 20px", fontSize: 14, cursor: submitting ? "default" : "pointer", fontWeight: 600 }}
        >
          {submitting ? "Хадгалж байна..." : "Бүртгэх"}
        </button>
      </div>
    </form>
  );
}

export default function ReceptionPatientsPage() {
  const router = useRouter();
  const [me, setMe] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    getMe()
      .then((u) => {
        if (!u) { router.replace("/login"); return; }
        if (u.role !== "receptionist" && u.role !== "admin" && u.role !== "super_admin") {
          router.replace("/login");
          return;
        }
        setMe(u);
      })
      .catch(() => router.replace("/login"))
      .finally(() => setAuthLoading(false));
  }, [router]);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [showRegister, setShowRegister] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const limit = 30;

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search]);

  useEffect(() => {
    fetch("/api/branches").then((r) => r.json()).then((d) => setBranches(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  const loadPatients = useCallback(async (q: string, currentPage: number) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      params.set("page", String(currentPage));
      params.set("limit", String(limit));
      const res = await fetch(`/api/patients?${params.toString()}`);
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) throw new Error("failed");
      const list = Array.isArray(data) ? data : (Array.isArray(data.data) ? data.data : []);
      setPatients(list);
      setTotal(data.total ?? list.length);
      setTotalPages(data.totalPages ?? Math.ceil((data.total ?? list.length) / limit));
    } catch {
      setError("Үйлчлүүлэгчдийг ачаалах үед алдаа гарлаа.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPatients(debouncedSearch, page);
  }, [debouncedSearch, page, loadPatients]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-gray-500">Ачаалж байна...</div>
      </div>
    );
  }

  return (
    <ReceptionLayout>
      <div style={{ marginTop: 12 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
          <input
            type="search"
            placeholder="Нэр, регистр, утас, картын дугаар..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            style={{ flex: 1, minWidth: 200, borderRadius: 8, border: "1px solid #d1d5db", padding: "7px 12px", fontSize: 14 }}
          />
          <button
            onClick={() => setShowRegister((v) => !v)}
            style={{ borderRadius: 8, background: "#131a29", color: "#fff", border: "none", padding: "7px 16px", fontSize: 14, cursor: "pointer", fontWeight: 600 }}
          >
            {showRegister ? "✕ Хаах" : "+ Үйлчлүүлэгч бүртгэх"}
          </button>
        </div>

        {/* Register form */}
        {showRegister && (
          <div
            style={{
              background: "#f9fafb",
              border: "1px solid #e5e7eb",
              borderRadius: 10,
              padding: 16,
              marginBottom: 16,
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 10 }}>
              Шинэ үйлчлүүлэгч бүртгэх
            </div>
            <RegisterForm
              branches={branches}
              onSuccess={(p) => {
                setPatients((prev) => [p, ...prev]);
                setShowRegister(false);
              }}
            />
          </div>
        )}

        {error && <div style={{ color: "#dc2626", fontSize: 13, marginBottom: 8 }}>{error}</div>}
        {loading && <div style={{ color: "#6b7280", fontSize: 13, marginBottom: 8 }}>Ачаалж байна...</div>}

        {/* Patient list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {patients.map((p) => {
            const name = [p.ovog ? p.ovog.charAt(0) + "." : null, p.name].filter(Boolean).join("") || "—";
            const bookNo = p.patientBook?.bookNumber;
            return (
              <div
                key={p.id}
                onClick={() => {
                  if (bookNo) router.push(`/patients/${bookNo}`);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  background: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  padding: "10px 14px",
                  cursor: bookNo ? "pointer" : "default",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#111827" }}>{name}</div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>
                    {[bookNo ? `#${bookNo}` : null, p.regNo, p.phone, p.branch?.name].filter(Boolean).join(" · ")}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 16 }}>
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              style={{ borderRadius: 6, border: "1px solid #d1d5db", padding: "4px 12px", cursor: page > 1 ? "pointer" : "default", fontSize: 13 }}
            >
              ‹
            </button>
            <span style={{ fontSize: 13, color: "#374151", padding: "4px 0" }}>
              {page} / {totalPages} ({total} нийт)
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              style={{ borderRadius: 6, border: "1px solid #d1d5db", padding: "4px 12px", cursor: page < totalPages ? "pointer" : "default", fontSize: 13 }}
            >
              ›
            </button>
          </div>
        )}
      </div>
    </ReceptionLayout>
  );
}

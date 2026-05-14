import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";

type Branch = { id: number; name: string };
type Doctor = { id: number; name: string | null; ovog: string | null; email: string };
type Tool = { id: number; branchId: number; name: string; baselineAmount: number };

type NurseSession = {
  nurseId: number;
  name: string | null;
  ovog: string | null;
  email: string;
  branchId: number;
};

function formatDateOnly(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatHHmm(date: Date) {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function formatUserLabel(u: { id?: number; email?: string | null; name?: string | null; ovog?: string | null }): string {
  if (u.ovog && u.ovog.trim() && u.name && u.name.trim()) return `${u.ovog.trim().charAt(0)}.${u.name.trim()}`;
  if (u.name && u.name.trim()) return u.name.trim();
  if (u.email) return u.email;
  return `User #${u.id ?? ""}`.trim();
}

export default function BranchNurseReturnsPage() {
  const router = useRouter();
  const now = useMemo(() => new Date(), []);
  const todayYmd = useMemo(() => formatDateOnly(now), [now]);

  const [session, setSession] = useState<NurseSession | null>(null);
  const [branchName, setBranchName] = useState("");
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [qtyByToolId, setQtyByToolId] = useState<Record<number, number>>({});
  const [toolFilter, setToolFilter] = useState("");

  const [date, setDate] = useState<string>(todayYmd);
  const [time, setTime] = useState<string>(formatHHmm(new Date()));
  const [doctorId, setDoctorId] = useState<number | "">("");
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const meRes = await fetch("/api/branch/nurse/me", { credentials: "include" });
        const meJson = await meRes.json().catch(() => ({}));
        if (!meRes.ok) {
          router.replace("/branch-nurse");
          return;
        }
        if (!mounted) return;
        const nurseSession = meJson as NurseSession;
        setSession(nurseSession);

        const [branchRes, doctorRes, toolsRes] = await Promise.all([
          fetch("/api/branches", { credentials: "include" }),
          fetch("/api/branch/nurse/doctors", { credentials: "include" }),
          fetch(`/api/sterilization/items?branchId=${nurseSession.branchId}`, { credentials: "include" }),
        ]);
        const branchJson = await branchRes.json().catch(() => []);
        const doctorJson = await doctorRes.json().catch(() => ({}));
        const toolsJson = await toolsRes.json().catch(() => []);

        if (!mounted) return;

        const branches = Array.isArray(branchJson) ? (branchJson as Branch[]) : [];
        const currentBranch = branches.find((b) => b.id === nurseSession.branchId);
        setBranchName(currentBranch?.name || `#${nurseSession.branchId}`);

        const doctorList = Array.isArray((doctorJson as any).doctors) ? (doctorJson as any).doctors : [];
        setDoctors(doctorList);
        setDoctorId(doctorList.length > 0 ? doctorList[0].id : "");

        const toolList = Array.isArray(toolsJson) ? (toolsJson as Tool[]) : [];
        setTools(toolList);
        setQtyByToolId(
          toolList.reduce<Record<number, number>>((acc, t) => {
            acc[t.id] = 0;
            return acc;
          }, {})
        );
      } catch {
        if (mounted) {
          setError("Мэдээлэл ачааллах үед алдаа гарлаа.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [router]);

  const filteredTools = useMemo(() => {
    const q = toolFilter.trim().toLowerCase();
    if (!q) return tools;
    return tools.filter((t) => t.name.toLowerCase().includes(q));
  }, [toolFilter, tools]);

  const totalReturnQty = useMemo(
    () => Object.values(qtyByToolId).reduce((sum, qty) => sum + Number(qty || 0), 0),
    [qtyByToolId]
  );

  async function handleLogoutNurse() {
    await fetch("/api/branch/nurse/logout", { method: "POST", credentials: "include" }).catch(() => undefined);
    router.replace("/branch-nurse");
  }

  async function submit() {
    setError("");
    setSuccessMsg("");

    if (!session) return setError("Сувилагчийн киоск сесс олдсонгүй.");
    if (!doctorId) return setError("Эмч сонгоно уу.");
    if (!date) return setError("Огноо оруулна уу.");
    if (!time) return setError("Цаг оруулна уу.");

    const lines = tools
      .map((t) => ({ toolId: t.id, returnedQty: Math.floor(Number(qtyByToolId[t.id] || 0)) }))
      .filter((x) => x.returnedQty > 0);
    if (lines.length === 0) {
      return setError("Дор хаяж нэг багажийн буцаасан тоо 0-ээс их байх ёстой.");
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/branch/nurse/returns", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctorId: Number(doctorId),
          date,
          time,
          notes: notes.trim() || null,
          lines,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((json as any)?.error || "Багаж буцаалт хадгалахад алдаа гарлаа.");
      }
      setSuccessMsg("✅ Багаж буцаалт амжилттай хадгалагдлаа.");
      setDate(todayYmd);
      setTime(formatHHmm(new Date()));
      setNotes("");
      setQtyByToolId((prev) => {
        const next: Record<number, number> = {};
        for (const t of tools) next[t.id] = Number(prev[t.id]) ? 0 : 0;
        return next;
      });
    } catch (e: any) {
      setError(e?.message || "Алдаа гарлаа.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-gray-500">Ачаалж байна...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-5xl rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="mb-1 text-2xl font-bold text-gray-800">Ариутгал → Багаж буцаалт</h1>
        <p className="mb-5 text-sm text-gray-500">Шинэ буцаалт бүртгэх</p>

        {error && <div className="mb-3 rounded bg-red-50 p-2.5 text-red-700">{error}</div>}
        {successMsg && <div className="mb-3 rounded bg-green-50 p-2.5 text-green-700">{successMsg}</div>}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block font-bold">Салбар</label>
            <input value={branchName} readOnly className="w-full rounded border border-gray-300 bg-gray-100 p-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block font-bold">Сувилагчийн нэр</label>
            <input
              value={session ? formatUserLabel(session) : ""}
              readOnly
              className="w-full rounded border border-gray-300 bg-gray-100 p-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block font-bold">
              Эмч <span className="text-red-600">*</span>
            </label>
            <select
              value={doctorId}
              onChange={(e) => setDoctorId(e.target.value ? Number(e.target.value) : "")}
              className="w-full rounded border border-gray-300 p-2 text-sm"
            >
              {doctors.length === 0 && <option value="">Эмч олдсонгүй</option>}
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {formatUserLabel(d)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block font-bold">
              Огноо <span className="text-red-600">*</span>
            </label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded border border-gray-300 p-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block font-bold">
              Цаг <span className="text-red-600">*</span>
            </label>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full rounded border border-gray-300 p-2 text-sm" />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block font-bold">Тэмдэглэл</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded border border-gray-300 p-2 text-sm"
              placeholder="Тэмдэглэл..."
            />
          </div>
        </div>

        <div className="mt-5">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
            <div className="font-bold">Багажийн жагсаалт (буцаасан тоо)</div>
            <input
              value={toolFilter}
              onChange={(e) => setToolFilter(e.target.value)}
              placeholder="Багаж хайх..."
              className="min-w-[240px] rounded border border-gray-300 p-2 text-sm"
            />
          </div>

          {tools.length === 0 && <div className="text-sm text-gray-500">Энэ салбарт багаж бүртгэгдээгүй байна.</div>}

          {tools.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border-b-2 border-gray-300 p-2.5 text-left">Багаж</th>
                    <th className="w-[160px] border-b-2 border-gray-300 p-2.5 text-right">Буцаасан тоо</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTools.map((tool) => (
                    <tr key={tool.id} className="border-b border-gray-200">
                      <td className="p-2.5">{tool.name}</td>
                      <td className="p-2.5 text-right">
                        <input
                          type="number"
                          min={0}
                          value={qtyByToolId[tool.id] ?? 0}
                          onChange={(e) => {
                            const v = Math.max(0, Math.floor(Number(e.target.value) || 0));
                            setQtyByToolId((prev) => ({ ...prev, [tool.id]: v }));
                          }}
                          className="w-[120px] rounded border border-gray-300 p-1.5 text-right text-sm"
                        />
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-gray-300">
                    <td className="p-2.5 font-bold">Нийт</td>
                    <td className="p-2.5 text-right font-bold">{totalReturnQty}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void submit()}
            disabled={submitting}
            className={`rounded px-5 py-2.5 text-base text-white ${submitting ? "cursor-not-allowed bg-gray-300" : "cursor-pointer bg-green-600"}`}
          >
            {submitting ? "Хадгалж байна..." : "Хадгалах"}
          </button>
          <button
            type="button"
            onClick={() => void handleLogoutNurse()}
            className="rounded border border-gray-300 bg-white px-5 py-2.5 text-sm text-gray-700"
          >
            Сувилагч солих
          </button>
        </div>
      </div>
    </main>
  );
}

import Head from "next/head";
import { useMemo, useState } from "react";
import { useAuth } from "../contexts/AuthContext";

type PartKey = "doctor" | "relation" | "subject" | "status";

type AnnouncementPart = {
  id: string;
  label: string;
};

type AnnouncementGroup = {
  key: PartKey;
  title: string;
  options: AnnouncementPart[];
};

const ANNOUNCEMENT_GROUPS: AnnouncementGroup[] = [
  {
    key: "doctor",
    title: "Эмч",
    options: [{ id: "khaliunaa", label: "Халиунаа" }],
  },
  {
    key: "relation",
    title: "Хамаарал",
    options: [{ id: "doctor_possessive", label: "эмчийн" }],
  },
  {
    key: "subject",
    title: "Хэн",
    options: [{ id: "patient", label: "үйлчлүүлэгч" }],
  },
  {
    key: "status",
    title: "Төлөв",
    options: [{ id: "arrived", label: "ирлээ" }],
  },
];

const INITIAL_PARTS: Record<PartKey, string> = {
  doctor: "khaliunaa",
  relation: "doctor_possessive",
  subject: "patient",
  status: "arrived",
};

function buildMessage(parts: Record<PartKey, string>) {
  return ANNOUNCEMENT_GROUPS.map((group) => {
    const option = group.options.find((item) => item.id === parts[group.key]);
    return option?.label || "";
  })
    .filter(Boolean)
    .join(" ");
}

function canUseBranchAnnounce(role?: string | null) {
  return role === "receptionist" || role === "super_admin";
}

export default function BranchAnnouncePage() {
  const { me, loading } = useAuth();
  const [parts, setParts] = useState<Record<PartKey, string>>(INITIAL_PARTS);
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const message = useMemo(() => buildMessage(parts), [parts]);
  const allowed = canUseBranchAnnounce(me?.role);

  function selectPart(groupKey: PartKey, optionId: string) {
    setParts((prev) => ({ ...prev, [groupKey]: optionId }));
    setSuccess("");
    setError("");
  }

  async function handleAnnounce() {
    setSending(true);
    setSuccess("");
    setError("");

    try {
      const res = await fetch("/api/branch-announce", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parts }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          data?.code === "BRIDGE_NOT_CONFIGURED"
            ? "Speaker bridge тохируулаагүй байна."
            : data?.error || "Зар хүргэхэд алдаа гарлаа."
        );
      }

      setSuccess(`Зар илгээгдлээ: ${data?.message || message}`);
    } catch (err: any) {
      setError(err?.message || "Зар хүргэхэд алдаа гарлаа.");
    } finally {
      setSending(false);
    }
  }

  if (loading || !me) {
    return (
      <main className="min-h-[100dvh] bg-slate-950 flex items-center justify-center text-white">
        <div className="text-lg">Ачаалж байна...</div>
      </main>
    );
  }

  if (!allowed) {
    return (
      <main className="min-h-[100dvh] bg-slate-950 flex items-center justify-center px-4 text-white">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center text-slate-900 shadow-2xl">
          <h1 className="text-2xl font-bold">Хандах эрхгүй</h1>
          <p className="mt-3 text-slate-600">
            Энэ хуудсыг зөвхөн reception болон super admin ашиглана.
          </p>
        </div>
      </main>
    );
  }

  return (
    <>
      <Head>
        <title>Branch announce</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main className="min-h-[100dvh] bg-slate-950 px-4 py-6 text-slate-900">
        <section className="mx-auto flex min-h-[calc(100dvh-48px)] w-full max-w-3xl flex-col rounded-[32px] bg-slate-100 p-5 shadow-2xl sm:p-8">
          <header className="mb-6">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-600">
              Branch announcement
            </p>
            <h1 className="mt-2 text-3xl font-black text-slate-950 sm:text-4xl">
              Эмчийн өрөөнд зарлах
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Хатуу тохируулсан өгүүлбэрийг сонгоод Nest speaker рүү илгээнэ.
            </p>
          </header>

          <div className="space-y-5">
            {ANNOUNCEMENT_GROUPS.map((group) => (
              <section
                key={group.key}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
                  {group.title}
                </h2>
                <div className="flex flex-wrap gap-3">
                  {group.options.map((option) => {
                    const active = parts[group.key] === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => selectPart(group.key, option.id)}
                        className={`rounded-2xl border px-5 py-4 text-xl font-extrabold shadow-sm transition active:scale-[0.98] sm:text-2xl ${
                          active
                            ? "border-orange-500 bg-orange-500 text-white"
                            : "border-slate-200 bg-slate-50 text-slate-900"
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>

          <section className="mt-6 rounded-3xl bg-slate-950 p-5 text-white shadow-xl">
            <label className="text-sm font-bold uppercase tracking-wide text-slate-300">
              Автоматаар үүссэн текст
            </label>
            <textarea
              readOnly
              value={message}
              className="mt-3 min-h-28 w-full resize-none rounded-2xl border border-white/10 bg-white px-4 py-4 text-2xl font-extrabold leading-snug text-slate-950 outline-none sm:text-3xl"
            />

            {success && (
              <div className="mt-4 rounded-2xl bg-emerald-500/15 px-4 py-3 text-sm font-semibold text-emerald-100">
                {success}
              </div>
            )}
            {error && (
              <div className="mt-4 rounded-2xl bg-red-500/15 px-4 py-3 text-sm font-semibold text-red-100">
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={handleAnnounce}
              disabled={sending || !message}
              className="mt-5 w-full rounded-3xl bg-orange-500 px-6 py-5 text-2xl font-black uppercase tracking-wide text-white shadow-lg shadow-orange-500/30 transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 sm:text-3xl"
            >
              {sending ? "Илгээж байна..." : "Announce"}
            </button>
          </section>
        </section>
      </main>
    </>
  );
}

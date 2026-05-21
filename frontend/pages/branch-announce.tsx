import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
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

const NAVY = "#131a29";
const ORANGE = "#f97316";
const MAX_MESSAGE_LENGTH = 180;

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

function buildQuickMessage(parts: Record<PartKey, string>) {
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

function displayName(me: ReturnType<typeof useAuth>["me"]) {
  if (!me) return "";
  const ovog = me.ovog?.trim();
  if (ovog) return ovog.charAt(0).toUpperCase() + "." + me.name;
  return me.name || "Reception";
}

function getMongolianVoice(voices: SpeechSynthesisVoice[]) {
  return voices.find((voice) => voice.lang.toLowerCase().startsWith("mn")) || null;
}

export default function BranchAnnouncePage() {
  const { me, loading } = useAuth();
  const [parts, setParts] = useState<Record<PartKey, string>>(INITIAL_PARTS);
  const [message, setMessage] = useState(() => buildQuickMessage(INITIAL_PARTS));
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speaking, setSpeaking] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const allowed = canUseBranchAnnounce(me?.role);
  const charsLeft = MAX_MESSAGE_LENGTH - message.length;
  const trimmedMessage = useMemo(() => message.trim(), [message]);
  const mongolianVoice = useMemo(() => getMongolianVoice(voices), [voices]);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const loadVoices = () => setVoices(window.speechSynthesis.getVoices());
    loadVoices();
    window.speechSynthesis.addEventListener?.("voiceschanged", loadVoices);
    return () => {
      window.speechSynthesis.cancel();
      window.speechSynthesis.removeEventListener?.("voiceschanged", loadVoices);
    };
  }, []);

  function rebuildFromParts(nextParts: Record<PartKey, string>) {
    setMessage(buildQuickMessage(nextParts));
    setSuccess("");
    setError("");
  }

  function selectPart(groupKey: PartKey, optionId: string) {
    const nextParts = { ...parts, [groupKey]: optionId };
    setParts(nextParts);
    rebuildFromParts(nextParts);
  }

  function useDefaultSentence() {
    setParts(INITIAL_PARTS);
    rebuildFromParts(INITIAL_PARTS);
  }

  function stopAnnouncement() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
  }

  function handleAnnounce() {
    setSuccess("");
    setError("");

    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setError("Энэ төхөөрөмж дээр browser speech synthesis дэмжигдээгүй байна.");
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(trimmedMessage);
    utterance.lang = "mn-MN";
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.volume = 1;
    if (mongolianVoice) utterance.voice = mongolianVoice;

    utterance.onstart = () => {
      setSpeaking(true);
    };
    utterance.onend = () => {
      setSpeaking(false);
      setSuccess("Зар дуудагдлаа. Tablet audio Nest speaker рүү cast хийгдсэн эсэхийг шалгана уу.");
    };
    utterance.onerror = () => {
      setSpeaking(false);
      setError("Зарыг дуугаар уншихад алдаа гарлаа.");
    };

    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }

  if (loading || !me) {
    return (
      <main className="min-h-[100dvh] bg-gray-100 flex items-center justify-center">
        <div className="rounded-2xl bg-white px-6 py-4 text-sm font-semibold text-gray-500 shadow-sm">
          Ачаалж байна...
        </div>
      </main>
    );
  }

  if (!allowed) {
    return (
      <main className="min-h-[100dvh] bg-gray-100 flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm border border-gray-200">
          <h1 className="text-2xl font-bold" style={{ color: NAVY }}>Хандах эрхгүй</h1>
          <p className="mt-3 text-gray-500">
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

      <main className="min-h-[100dvh] bg-gray-100 text-gray-900">
        <header className="h-14 text-white shadow-sm" style={{ background: NAVY }}>
          <div className="mx-auto flex h-full max-w-5xl items-center justify-between px-4">
            <div className="flex min-w-0 items-center gap-3">
              <img
                src="https://mdent.cloud/mdent.svg"
                alt="mDent"
                className="h-8 w-8 shrink-0 rounded-md bg-white"
              />
              <div className="min-w-0">
                <div className="truncate text-sm font-extrabold tracking-wide">
                  <span className="text-orange-400">M</span> Dent Cloud
                </div>
                <div className="truncate text-xs text-white/65">Branch announce</div>
              </div>
            </div>
            <div className="truncate text-right text-xs text-white/70 sm:text-sm">
              {displayName(me)}
            </div>
          </div>
        </header>

        <section className="mx-auto w-full max-w-5xl px-4 py-5 sm:py-8">
          <div className="mb-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-500">
                  Single branch utility
                </p>
                <h1 className="mt-2 text-2xl font-black sm:text-3xl" style={{ color: NAVY }}>
                  Эмчийн өрөөнд зарлах
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-gray-500">
                  Доорх товчнууд өгүүлбэрийг хурдан үүсгэнэ. Текст хэсгийг гараар засаж болно. Tablet audio Nest speaker рүү cast хийгдсэн үед Nest дээр сонсогдоно.
                </p>
              </div>
              <button
                type="button"
                onClick={useDefaultSentence}
                className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-700 shadow-sm hover:bg-gray-50"
              >
                Default sentence
              </button>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-base font-black" style={{ color: NAVY }}>Хурдан сонголт</h2>
              <p className="mt-1 text-sm text-gray-500">Сонголт дарахад textbox автоматаар шинэчлэгдэнэ.</p>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {ANNOUNCEMENT_GROUPS.map((group) => (
                  <div key={group.key} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-500">
                      {group.title}
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {group.options.map((option) => {
                        const active = parts[group.key] === option.id;
                        const buttonClass = active
                          ? "border-orange-500 bg-orange-500 text-white shadow-sm"
                          : "border-gray-300 bg-white text-gray-800 hover:bg-gray-50";
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => selectPart(group.key, option.id)}
                            className={"rounded-xl border px-4 py-3 text-lg font-extrabold transition active:scale-[0.98] " + buttonClass}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-black" style={{ color: NAVY }}>Зарлах текст</h2>
                <span className={charsLeft < 0 ? "text-xs font-bold text-red-600" : "text-xs font-semibold text-gray-400"}>
                  {charsLeft} тэмдэгт
                </span>
              </div>

              <textarea
                value={message}
                onChange={(event) => {
                  setMessage(event.target.value);
                  setSuccess("");
                  setError("");
                }}
                maxLength={MAX_MESSAGE_LENGTH + 20}
                className="mt-4 min-h-40 w-full resize-none rounded-xl border border-gray-300 bg-white px-4 py-3 text-xl font-bold leading-snug text-gray-900 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                placeholder="Зарлах текстээ бичнэ үү"
              />

              <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-gray-500">
                <span>
                  Voice: {mongolianVoice ? mongolianVoice.name : "mn-MN default"}
                </span>
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMessage("");
                    setSuccess("");
                    setError("");
                  }}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={stopAnnouncement}
                  disabled={!speaking}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Stop
                </button>
              </div>

              {success && (
                <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                  {success}
                </div>
              )}
              {error && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                  {error}
                </div>
              )}

              <button
                type="button"
                onClick={handleAnnounce}
                disabled={speaking || !trimmedMessage || charsLeft < 0}
                className="mt-5 w-full rounded-xl px-5 py-4 text-lg font-black uppercase tracking-wide text-white shadow-sm transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                style={{ background: ORANGE }}
              >
                {speaking ? "Дуудаж байна..." : "Announce"}
              </button>
            </section>
          </div>
        </section>
      </main>
    </>
  );
}

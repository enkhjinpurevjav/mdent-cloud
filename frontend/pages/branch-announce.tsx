import Head from "next/head";
import Script from "next/script";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";

const NAVY = "#131a29";
const ORANGE = "#f97316";
const CAST_SDK_URL =
  "https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1";

const DOCTOR_NAMES = [
  "Бигэрмижид",
  "Дэлгэрмаа",
  "Мөнхсүлд",
  "Отгончимэг",
  "Хаш-Эрдэнэ",
  "Энхцэцэг",
];

const DOCTOR_TEMPLATES = [
  "эмчийн үйлчлүүлэгч ирлээ",
  "эмчийг ресепшн дээр дуудаж байна",
];

const FIXED_ANNOUNCEMENTS = [
  "Сувилагчийг эмчилгээний танхимд дуудаж байна",
  "Хоол ирлээ",
  "Хүргэлт ирлээ",
];

function canUseBranchAnnounce(role?: string | null) {
  return role === "receptionist" || role === "super_admin";
}

function displayName(me: ReturnType<typeof useAuth>["me"]) {
  if (!me) return "";
  const ovog = me.ovog?.trim();
  if (ovog) return ovog.charAt(0).toUpperCase() + "." + me.name;
  return me.name || "Reception";
}

type CastStatus = "unavailable" | "ready" | "connected";
type AudioStatus = "idle" | "loading" | "playing";

export default function BranchAnnouncePage() {
  const { me, loading } = useAuth();
  const [selectedDoctor, setSelectedDoctor] = useState("");
  const [message, setMessage] = useState("");
  const [castStatus, setCastStatus] = useState<CastStatus>("unavailable");
  const [audioStatus, setAudioStatus] = useState<AudioStatus>("idle");
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  const allowed = canUseBranchAnnounce(me?.role);
  const trimmedMessage = useMemo(() => message.trim(), [message]);
  const busy = audioStatus === "loading" || audioStatus === "playing";

  useEffect(() => {
    if (typeof window === "undefined") return;

    const initializeCast = () => {
      const castFramework = window.cast?.framework;
      const chromeCast = window.chrome?.cast;
      if (!castFramework || !chromeCast) return;

      const context = castFramework.CastContext.getInstance();
      context.setOptions({
        receiverApplicationId: chromeCast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
        autoJoinPolicy: chromeCast.AutoJoinPolicy.ORIGIN_SCOPED,
      });

      const updateStatus = () => {
        const state = context.getSessionState?.();
        setCastStatus(
          state === castFramework.SessionState.SESSION_STARTED ||
            state === castFramework.SessionState.SESSION_RESUMED
            ? "connected"
            : "ready"
        );
      };

      updateStatus();
      if (!window.__branchAnnounceCastListenerAttached) {
        context.addEventListener(
          castFramework.CastContextEventType.SESSION_STATE_CHANGED,
          updateStatus
        );
        window.__branchAnnounceCastListenerAttached = true;
      }
    };

    window.__onGCastApiAvailable = (isAvailable: boolean) => {
      if (!isAvailable) return;
      initializeCast();
    };

    initializeCast();
  }, []);

  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, []);

  function cleanupAudioUrl() {
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
  }

  function stopAudio() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    cleanupAudioUrl();
    setAudioStatus("idle");
  }

  function chooseDoctor(doctor: string) {
    setSelectedDoctor(doctor);
    setSuccess("");
    setError("");
  }

  function chooseDoctorTemplate(template: string) {
    setSuccess("");
    setError("");
    if (!selectedDoctor) {
      setError("Эхлээд эмчийн нэр сонгоно уу.");
      return;
    }
    setMessage(selectedDoctor + " " + template);
  }

  function chooseFixedAnnouncement(nextMessage: string) {
    setMessage(nextMessage);
    setSuccess("");
    setError("");
  }

  async function handleAnnounce() {
    setSuccess("");
    setError("");

    if (!trimmedMessage) {
      setError("Эхлээд зарлах өгүүлбэр сонгоно уу.");
      return;
    }

    stopAudio();
    setAudioStatus("loading");

    try {
      const res = await fetch("/api/branch-announce/audio", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmedMessage }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Зарын audio үүсгэхэд алдаа гарлаа.");
      }

      const cacheState = res.headers.get("X-Branch-Announce-Cache") || "MISS";
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      audioUrlRef.current = url;

      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onplay = () => setAudioStatus("playing");
      audio.onended = () => {
        cleanupAudioUrl();
        audioRef.current = null;
        setAudioStatus("idle");
        setSuccess(
          cacheState === "HIT"
            ? "Кэшлэгдсэн audio тоглогдлоо."
            : "Шинэ audio үүсгэж тоглууллаа. Дараагийн удаа кэшээс шууд тоглоно."
        );
      };
      audio.onerror = () => {
        cleanupAudioUrl();
        audioRef.current = null;
        setAudioStatus("idle");
        setError("Audio тоглуулахад алдаа гарлаа.");
      };

      await audio.play();
    } catch (err: any) {
      cleanupAudioUrl();
      audioRef.current = null;
      setAudioStatus("idle");
      setError(err?.message || "Зарын audio үүсгэхэд алдаа гарлаа.");
    }
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
      <Script src={CAST_SDK_URL} strategy="afterInteractive" />

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
                  Эмч сонгоод template дарна уу. Audio эхний удаа Chimege-ээр үүсэж кэшлэгдэнэ, дараагийн удаа шууд тоглоно.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-3 py-2 shadow-sm">
                  <google-cast-launcher className="h-6 w-6" />
                  <span className="text-xs font-bold text-gray-600">
                    {castStatus === "connected"
                      ? "Nest connected"
                      : castStatus === "ready"
                        ? "Tap to cast"
                        : "Cast loading"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-base font-black" style={{ color: NAVY }}>Хурдан сонголт</h2>
              <p className="mt-1 text-sm text-gray-500">Зөвхөн баталгаажсан өгүүлбэрүүд audio үүсгэнэ.</p>

              <div className="mt-5 space-y-4">
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-500">Эмч</h3>
                  <div className="flex flex-wrap gap-2">
                    {DOCTOR_NAMES.map((doctor) => {
                      const active = selectedDoctor === doctor;
                      return (
                        <button
                          key={doctor}
                          type="button"
                          onClick={() => chooseDoctor(doctor)}
                          className={
                            "rounded-lg border px-3 py-2 text-sm font-semibold transition active:scale-[0.98] " +
                            (active
                              ? "border-orange-500 bg-orange-50 text-orange-700"
                              : "border-gray-300 bg-white text-gray-800 hover:border-orange-300 hover:bg-orange-50")
                          }
                        >
                          {doctor}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-500">Эмчийн template</h3>
                  <div className="flex flex-wrap gap-2">
                    {DOCTOR_TEMPLATES.map((template) => (
                      <button
                        key={template}
                        type="button"
                        onClick={() => chooseDoctorTemplate(template)}
                        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-left text-sm font-semibold text-gray-800 transition hover:border-orange-300 hover:bg-orange-50 active:scale-[0.98]"
                      >
                        {template}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-500">Бусад</h3>
                  <div className="flex flex-wrap gap-2">
                    {FIXED_ANNOUNCEMENTS.map((fixedMessage) => (
                      <button
                        key={fixedMessage}
                        type="button"
                        onClick={() => chooseFixedAnnouncement(fixedMessage)}
                        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-left text-sm font-semibold text-gray-800 transition hover:border-orange-300 hover:bg-orange-50 active:scale-[0.98]"
                      >
                        {fixedMessage}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-black" style={{ color: NAVY }}>Зарлах текст</h2>
                <span className="text-xs font-semibold text-gray-400">
                  {message.length} тэмдэгт
                </span>
              </div>

              <textarea
                readOnly
                value={message}
                className="mt-4 min-h-40 w-full resize-none rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 text-xl font-bold leading-snug text-gray-900 outline-none"
                placeholder="Эмч/template эсвэл бусад зар сонгоно уу"
              />

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    stopAudio();
                    setMessage("");
                    setSelectedDoctor("");
                    setSuccess("");
                    setError("");
                  }}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={stopAudio}
                  disabled={audioStatus !== "playing"}
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
                disabled={busy || !trimmedMessage}
                className="mt-5 w-full rounded-xl px-5 py-4 text-lg font-black uppercase tracking-wide text-white shadow-sm transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                style={{ background: ORANGE }}
              >
                {audioStatus === "loading"
                  ? "Audio бэлдэж байна..."
                  : audioStatus === "playing"
                    ? "Дуудаж байна..."
                    : "Announce"}
              </button>
            </section>
          </div>
        </section>
      </main>
    </>
  );
}

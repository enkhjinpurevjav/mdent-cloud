import { useEffect, useRef, useState } from "react";
import type { ScheduledDoctor } from "../appointments/types";

type UseScheduledDoctorsV2Params = {
  date: string;
  branchId: string;
};

export function useScheduledDoctorsV2({ date, branchId }: UseScheduledDoctorsV2Params) {
  const [scheduledDoctors, setScheduledDoctors] = useState<ScheduledDoctor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!date) {
      setScheduledDoctors([]);
      return;
    }

    const controller = new AbortController();

    async function run() {
      setLoading(true);
      setError("");

      requestIdRef.current += 1;
      const currentRequestId = requestIdRef.current;

      try {
        const params = new URLSearchParams({ date });
        if (branchId) params.set("branchId", branchId);

        const res = await fetch(`/api/doctors/scheduled?${params.toString()}`, {
          signal: controller.signal,
        });
        const data = await res.json().catch(() => []);

        if (controller.signal.aborted) return;
        if (currentRequestId !== requestIdRef.current) return;

        if (!res.ok || !Array.isArray(data)) {
          setScheduledDoctors([]);
          setError("Эмчийн хуваарь ачаалахад алдаа гарлаа.");
          return;
        }

        setScheduledDoctors(data);
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        if (currentRequestId !== requestIdRef.current) return;
        setScheduledDoctors([]);
        setError("Эмчийн хуваарь ачаалахад алдаа гарлаа.");
      } finally {
        if (!controller.signal.aborted && currentRequestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    }

    run();

    return () => {
      controller.abort();
    };
  }, [date, branchId]);

  return { scheduledDoctors, loading, error };
}

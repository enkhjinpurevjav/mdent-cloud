import { useEffect, useState } from "react";
import type { Appointment } from "../appointments/types";

type StreamStatus = "connecting" | "connected" | "disconnected";

type UseAppointmentsStreamV2Params = {
  date: string;
  branchId: string;
  onCreated: (appointment: Appointment) => void;
  onUpdated: (appointment: Appointment) => void;
  onDeleted: (payload: { id: number }) => void;
};

export function useAppointmentsStreamV2({
  date,
  branchId,
  onCreated,
  onUpdated,
  onDeleted,
}: UseAppointmentsStreamV2Params) {
  const [status, setStatus] = useState<StreamStatus>("connecting");
  const [lastEventAt, setLastEventAt] = useState<Date | null>(null);

  useEffect(() => {
    if (!date) return;

    let es: EventSource | null = null;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    let closed = false;

    const params = new URLSearchParams({ date });
    if (branchId) params.set("branchId", branchId);

    const connect = () => {
      if (closed) return;
      setStatus("connecting");

      es = new EventSource(`/api/appointments/stream?${params.toString()}`);

      es.onopen = () => {
        setStatus("connected");
      };

      const markEvent = () => {
        setLastEventAt(new Date());
      };

      es.addEventListener("appointment_created", (e: MessageEvent) => {
        markEvent();
        try {
          onCreated(JSON.parse(e.data) as Appointment);
        } catch {
          // ignore parse errors
        }
      });

      es.addEventListener("appointment_updated", (e: MessageEvent) => {
        markEvent();
        try {
          onUpdated(JSON.parse(e.data) as Appointment);
        } catch {
          // ignore parse errors
        }
      });

      es.addEventListener("appointment_deleted", (e: MessageEvent) => {
        markEvent();
        try {
          onDeleted(JSON.parse(e.data) as { id: number });
        } catch {
          // ignore parse errors
        }
      });

      es.onerror = () => {
        if (closed) return;
        es?.close();
        es = null;
        setStatus("disconnected");
        retryTimeout = setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      closed = true;
      if (retryTimeout) clearTimeout(retryTimeout);
      es?.close();
    };
  }, [date, branchId, onCreated, onUpdated, onDeleted]);

  return { status, lastEventAt };
}

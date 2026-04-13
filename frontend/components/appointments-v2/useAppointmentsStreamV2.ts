import { useEffect, useRef, useState } from "react";
import type { Appointment } from "../appointments/types";

type StreamStatus = "connecting" | "connected" | "disconnected";

type UseAppointmentsStreamV2Params = {
  date: string;
  branchId: string;
  onCreated: (appointment: Appointment) => void;
  onUpdated: (appointment: Appointment) => void;
  onDeleted: (payload: { id: number }) => void;
  config?: {
    flushIntervalMs?: number;
  };
};

export function useAppointmentsStreamV2({
  date,
  branchId,
  onCreated,
  onUpdated,
  onDeleted,
  config,
}: UseAppointmentsStreamV2Params) {
  const [status, setStatus] = useState<StreamStatus>("connecting");
  const [lastEventAt, setLastEventAt] = useState<Date | null>(null);
  const onCreatedRef = useRef(onCreated);
  const onUpdatedRef = useRef(onUpdated);
  const onDeletedRef = useRef(onDeleted);
  const flushIntervalMs = config?.flushIntervalMs ?? 300;

  useEffect(() => {
    onCreatedRef.current = onCreated;
  }, [onCreated]);

  useEffect(() => {
    onUpdatedRef.current = onUpdated;
  }, [onUpdated]);

  useEffect(() => {
    onDeletedRef.current = onDeleted;
  }, [onDeleted]);

  useEffect(() => {
    if (!date) return;

    let es: EventSource | null = null;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    let flushTimeout: ReturnType<typeof setTimeout> | null = null;
    let closed = false;
    const pendingCreated = new Map<number, Appointment>();
    const pendingUpdated = new Map<number, Appointment>();
    const pendingDeleted = new Set<number>();

    const params = new URLSearchParams({ date });
    if (branchId) params.set("branchId", branchId);

    const clearPending = () => {
      pendingCreated.clear();
      pendingUpdated.clear();
      pendingDeleted.clear();
      if (flushTimeout) {
        clearTimeout(flushTimeout);
        flushTimeout = null;
      }
    };

    const flushPending = () => {
      flushTimeout = null;

      pendingDeleted.forEach((id) => onDeletedRef.current({ id }));
      pendingCreated.forEach((appointment) => onCreatedRef.current(appointment));
      pendingUpdated.forEach((appointment) => onUpdatedRef.current(appointment));

      pendingCreated.clear();
      pendingUpdated.clear();
      pendingDeleted.clear();
    };

    const scheduleFlush = () => {
      if (flushTimeout) return;
      flushTimeout = setTimeout(flushPending, flushIntervalMs);
    };

    const connect = () => {
      if (closed) return;
      setStatus("connecting");
      clearPending();

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
          const appointment = JSON.parse(e.data) as Appointment;
          pendingDeleted.delete(appointment.id);
          pendingUpdated.delete(appointment.id);
          pendingCreated.set(appointment.id, appointment);
          scheduleFlush();
        } catch {
          // ignore parse errors
        }
      });

      es.addEventListener("appointment_updated", (e: MessageEvent) => {
        markEvent();
        try {
          const appointment = JSON.parse(e.data) as Appointment;
          if (pendingCreated.has(appointment.id)) {
            pendingCreated.set(appointment.id, appointment);
          } else {
            pendingUpdated.set(appointment.id, appointment);
          }
          pendingDeleted.delete(appointment.id);
          scheduleFlush();
        } catch {
          // ignore parse errors
        }
      });

      es.addEventListener("appointment_deleted", (e: MessageEvent) => {
        markEvent();
        try {
          const payload = JSON.parse(e.data) as { id: number };
          pendingCreated.delete(payload.id);
          pendingUpdated.delete(payload.id);
          pendingDeleted.add(payload.id);
          scheduleFlush();
        } catch {
          // ignore parse errors
        }
      });

      es.onerror = () => {
        if (closed) return;
        es?.close();
        es = null;
        clearPending();
        setStatus("disconnected");
        retryTimeout = setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      closed = true;
      if (retryTimeout) clearTimeout(retryTimeout);
      clearPending();
      es?.close();
    };
  }, [date, branchId, flushIntervalMs]);

  return { status, lastEventAt };
}

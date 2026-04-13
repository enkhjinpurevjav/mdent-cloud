import { useEffect, useRef, useState } from "react";
import type { Appointment } from "../types";

type StreamStatus = "connecting" | "connected" | "disconnected";

export const SSE_FLUSH_DELAY_MS = 300;

type UseBufferedAppointmentsSseParams = {
  filterDate: string;
  effectiveBranchId: string;
  onApplyUpserts: (appointments: Appointment[]) => void;
  onApplyDeletes: (ids: number[]) => void;
  flushDelayMs?: number;
};

function isInCurrentView(
  appointment: Appointment,
  filterDate: string,
  effectiveBranchId: string
) {
  const appointmentDate = appointment.scheduledAt
    ? appointment.scheduledAt.slice(0, 10)
    : "";
  if (appointmentDate !== filterDate) return false;
  if (effectiveBranchId && String(appointment.branchId) !== effectiveBranchId) {
    return false;
  }
  return true;
}

export function useBufferedAppointmentsSse({
  filterDate,
  effectiveBranchId,
  onApplyUpserts,
  onApplyDeletes,
  flushDelayMs = SSE_FLUSH_DELAY_MS,
}: UseBufferedAppointmentsSseParams) {
  const [status, setStatus] = useState<StreamStatus>("connecting");
  const [lastEventAt, setLastEventAt] = useState<Date | null>(null);

  const onApplyUpsertsRef = useRef(onApplyUpserts);
  const onApplyDeletesRef = useRef(onApplyDeletes);

  useEffect(() => {
    onApplyUpsertsRef.current = onApplyUpserts;
  }, [onApplyUpserts]);

  useEffect(() => {
    onApplyDeletesRef.current = onApplyDeletes;
  }, [onApplyDeletes]);

  useEffect(() => {
    if (!filterDate) return;

    let es: EventSource | null = null;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    let flushTimeout: ReturnType<typeof setTimeout> | null = null;
    let closed = false;

    const pendingUpserts = new Map<number, Appointment>();
    const pendingDeletes = new Set<number>();

    const clearBuffers = () => {
      pendingUpserts.clear();
      pendingDeletes.clear();
      if (flushTimeout) {
        clearTimeout(flushTimeout);
        flushTimeout = null;
      }
    };

    const flush = () => {
      flushTimeout = null;
      if (pendingUpserts.size === 0 && pendingDeletes.size === 0) return;

      const deletedIds = Array.from(pendingDeletes);
      const upserts = Array.from(pendingUpserts.values()).filter(
        (appointment) => !pendingDeletes.has(appointment.id)
      );

      pendingUpserts.clear();
      pendingDeletes.clear();

      if (upserts.length > 0) onApplyUpsertsRef.current(upserts);
      if (deletedIds.length > 0) onApplyDeletesRef.current(deletedIds);
    };

    const scheduleFlush = () => {
      if (flushTimeout) return;
      flushTimeout = setTimeout(flush, flushDelayMs);
    };

    const queueUpsert = (appointment: Appointment) => {
      pendingDeletes.delete(appointment.id);
      pendingUpserts.set(appointment.id, appointment);
      scheduleFlush();
    };

    const queueDelete = (appointmentId: number) => {
      pendingUpserts.delete(appointmentId);
      pendingDeletes.add(appointmentId);
      scheduleFlush();
    };

    const params = new URLSearchParams({ date: filterDate });
    if (effectiveBranchId) params.set("branchId", effectiveBranchId);

    const connect = () => {
      if (closed) return;

      clearBuffers();
      setStatus("connecting");
      es = new EventSource(`/api/appointments/stream?${params.toString()}`);

      es.onopen = () => setStatus("connected");

      const markEvent = () => setLastEventAt(new Date());

      es.addEventListener("appointment_created", (event: MessageEvent) => {
        markEvent();
        try {
          const appointment = JSON.parse(event.data) as Appointment;
          if (!isInCurrentView(appointment, filterDate, effectiveBranchId)) return;
          queueUpsert(appointment);
        } catch {
          // ignore parse errors
        }
      });

      es.addEventListener("appointment_updated", (event: MessageEvent) => {
        markEvent();
        try {
          const appointment = JSON.parse(event.data) as Appointment;
          if (!isInCurrentView(appointment, filterDate, effectiveBranchId)) {
            queueDelete(appointment.id);
            return;
          }
          queueUpsert(appointment);
        } catch {
          // ignore parse errors
        }
      });

      es.addEventListener("appointment_deleted", (event: MessageEvent) => {
        markEvent();
        try {
          const payload = JSON.parse(event.data) as { id: number };
          queueDelete(payload.id);
        } catch {
          // ignore parse errors
        }
      });

      es.onerror = () => {
        if (closed) return;
        es?.close();
        es = null;
        clearBuffers();
        setStatus("disconnected");
        retryTimeout = setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      closed = true;
      clearBuffers();
      if (retryTimeout) clearTimeout(retryTimeout);
      es?.close();
    };
  }, [filterDate, effectiveBranchId, flushDelayMs]);

  return { status, lastEventAt };
}

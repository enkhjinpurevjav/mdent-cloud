import { useEffect, useMemo, useRef, useState } from "react";
import AppointmentsV2Grid from "../../components/appointments-v2/AppointmentsV2Grid";
import type { Appointment, ScheduledDoctor } from "../../components/appointments/types";
import type { AppointmentBlockGeometry } from "../../components/appointments-v2/AppointmentBlockV2";
import {
  assignStableTwoLanes,
  computeDoctorSlotOccupancy,
  getVisibleAppointmentsV2,
} from "../../components/appointments-v2/gridLayoutV2";
import {
  generateTimeSlotsForDay,
  getDateFromYMD,
  SLOT_MINUTES,
} from "../../components/appointments/time";
import { getBusinessYmd, naiveToFakeUtcDate } from "../../utils/businessTime";

const SLOT_HEIGHT_PX = 30;
const MIN_BLOCK_HEIGHT_PX = 18;
const GRID_STICKY_HEADER_HEIGHT = 41;

type BranchPerformance = {
  branchId: number;
  branchName: string;
  doctorCount: number;
  possibleSlots: number;
  filledSlots: number;
  fillingRate: number | null;
  salesToday: number;
  completedCount: number;
  bookedCount: number;
  noShowCount: number;
};

type Branch = {
  id: number;
  name: string;
};

type DashboardResponse = {
  day: string;
  branch: Branch;
  performance: BranchPerformance;
};

type AppointmentsResponse = {
  date: string;
  branch: Branch;
  scheduledDoctors: ScheduledDoctor[];
  appointments: Appointment[];
};

function formatMoney(amount: number): string {
  return `${new Intl.NumberFormat("mn-MN").format(Math.round(amount || 0))}₮`;
}

function getFillingColor(rate: number | null) {
  if (rate === null) return "#9ca3af";
  if (rate <= 39) return "#dc2626";
  if (rate <= 69) return "#d97706";
  return "#16a34a";
}

export default function InvestorPortalPage() {
  const today = useMemo(() => getBusinessYmd(), []);
  const [selectedDate, setSelectedDate] = useState(today);
  const [branch, setBranch] = useState<Branch | null>(null);
  const [performance, setPerformance] = useState<BranchPerformance | null>(null);
  const [scheduledDoctors, setScheduledDoctors] = useState<ScheduledDoctor[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [error, setError] = useState("");
  const gridScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      setDashboardLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/investor/dashboard?day=${encodeURIComponent(today)}`, {
          credentials: "include",
        });
        const data = (await res.json().catch(() => null)) as DashboardResponse | null;
        if (!res.ok || !data?.performance || !data.branch) {
          throw new Error((data as any)?.error || "Мэдээлэл ачаалж чадсангүй.");
        }
        if (cancelled) return;
        setBranch(data.branch);
        setPerformance(data.performance);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || "Мэдээлэл ачаалж чадсангүй.");
      } finally {
        if (!cancelled) setDashboardLoading(false);
      }
    }

    void loadDashboard();
    return () => {
      cancelled = true;
    };
  }, [today]);

  useEffect(() => {
    let cancelled = false;

    async function loadAppointments() {
      setCalendarLoading(true);
      setError("");
      try {
        const res = await fetch(
          `/api/investor/appointments?date=${encodeURIComponent(selectedDate)}`,
          { credentials: "include" }
        );
        const data = (await res.json().catch(() => null)) as AppointmentsResponse | null;
        if (!res.ok || !data || !Array.isArray(data.scheduledDoctors) || !Array.isArray(data.appointments)) {
          throw new Error((data as any)?.error || "Цагийн мэдээлэл ачаалж чадсангүй.");
        }
        if (cancelled) return;
        setBranch(data.branch);
        setScheduledDoctors(data.scheduledDoctors);
        setAppointments(data.appointments);
      } catch (err: any) {
        if (!cancelled) {
          setScheduledDoctors([]);
          setAppointments([]);
          setError(err?.message || "Цагийн мэдээлэл ачаалж чадсангүй.");
        }
      } finally {
        if (!cancelled) setCalendarLoading(false);
      }
    }

    void loadAppointments();
    return () => {
      cancelled = true;
    };
  }, [selectedDate]);

  const timeSlots = useMemo(
    () => generateTimeSlotsForDay(getDateFromYMD(selectedDate)),
    [selectedDate]
  );
  const firstSlot = timeSlots[0]?.start;
  const lastSlot = timeSlots[timeSlots.length - 1]?.end;
  const totalMinutes = useMemo(() => {
    if (!firstSlot || !lastSlot) return 1;
    return Math.max(1, (lastSlot.getTime() - firstSlot.getTime()) / 60000);
  }, [firstSlot, lastSlot]);
  const columnHeightPx = timeSlots.length * SLOT_HEIGHT_PX;

  const appointmentsByDoctorId = useMemo(() => {
    const grouped: Record<number, Appointment[]> = {};
    for (const appointment of getVisibleAppointmentsV2(appointments)) {
      if (!appointment.doctorId) continue;
      if (!grouped[appointment.doctorId]) grouped[appointment.doctorId] = [];
      grouped[appointment.doctorId].push(appointment);
    }
    return grouped;
  }, [appointments]);

  const blocksByDoctorId = useMemo(() => {
    const result: Record<number, AppointmentBlockGeometry[]> = {};
    if (!firstSlot) return result;
    const dayStartMs = firstSlot.getTime();

    for (const doctor of scheduledDoctors) {
      const doctorAppointments = appointmentsByDoctorId[doctor.id] || [];
      const { laneByAppointmentId, overlappingAppointmentIds } =
        assignStableTwoLanes(doctorAppointments);
      const sortedAppointments = [...doctorAppointments].sort((a, b) => {
        const sa = naiveToFakeUtcDate(a.scheduledAt).getTime();
        const sb = naiveToFakeUtcDate(b.scheduledAt).getTime();
        return sa - sb || a.id - b.id;
      });

      result[doctor.id] = sortedAppointments.map((appointment) => {
        const startMs = naiveToFakeUtcDate(appointment.scheduledAt).getTime();
        const defaultEnd = startMs + SLOT_MINUTES * 60_000;
        const endMs = appointment.endAt
          ? naiveToFakeUtcDate(appointment.endAt).getTime()
          : defaultEnd;
        const clampedStartMs = Math.max(dayStartMs, startMs);
        const clampedEndMs = Math.max(clampedStartMs + 1, endMs);
        const minutesFromStart = (clampedStartMs - dayStartMs) / 60000;
        const durationMinutes = Math.max(1, (clampedEndMs - clampedStartMs) / 60000);

        return {
          appointment,
          top: (minutesFromStart / totalMinutes) * columnHeightPx,
          height: Math.max(
            MIN_BLOCK_HEIGHT_PX,
            (durationMinutes / totalMinutes) * columnHeightPx
          ),
          lane: laneByAppointmentId[appointment.id] ?? 0,
          split: overlappingAppointmentIds.has(appointment.id),
        };
      });
    }

    return result;
  }, [appointmentsByDoctorId, columnHeightPx, firstSlot, scheduledDoctors, totalMinutes]);

  const branchIdString = branch?.id != null ? String(branch.id) : "";
  const slotOccupancyByDoctorId = useMemo(
    () =>
      computeDoctorSlotOccupancy({
        appointments,
        scheduledDoctors,
        timeSlots,
        resolveDoctorBranchIdForDay: () => branchIdString,
      }),
    [appointments, branchIdString, scheduledDoctors, timeSlots]
  );

  const color = getFillingColor(performance?.fillingRate ?? null);
  const progressWidth = `${Math.max(0, Math.min(100, performance?.fillingRate ?? 0))}%`;
  const loading = dashboardLoading || calendarLoading;

  return (
    <main className="min-h-[calc(100vh-64px)] bg-gray-50 px-4 py-6 text-gray-900 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="flex flex-col gap-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-orange-600">
            Хөрөнгө оруулагч
          </p>
          <h1 className="text-2xl font-black sm:text-3xl">Салбарын цаг захиалга</h1>
          <p className="text-sm text-gray-500">
            {branch?.name || "Таны салбар"}-ын өнөөдрийн үзүүлэлт болон цагийн хуваарь.
          </p>
        </section>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          {dashboardLoading && !performance ? (
            <div className="text-sm text-gray-500">Үзүүлэлт ачаалж байна...</div>
          ) : performance ? (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-xl font-black text-gray-950">{performance.branchName}</h2>
                  <p className="mt-3 text-lg font-bold text-gray-900 sm:text-2xl">
                    Өнөөдрийн борлуулалт: {formatMoney(performance.salesToday)}
                  </p>
                </div>
                <div className="rounded-full bg-orange-50 px-4 py-2 text-sm font-bold text-orange-700">
                  Өнөөдөр
                </div>
              </div>

              <div className="flex items-center justify-between gap-4">
                <span className="text-lg font-medium text-gray-500 sm:text-2xl">Дүүргэлт</span>
                <strong className="text-2xl font-black sm:text-3xl" style={{ color }}>
                  {performance.fillingRate === null ? "—" : `${performance.fillingRate}%`}
                </strong>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full rounded-full transition-[width] duration-300"
                  style={{ width: progressWidth, background: color }}
                />
              </div>

              <div className="grid gap-3 text-sm text-gray-700 sm:grid-cols-2">
                <div className="rounded-2xl bg-gray-50 p-3">
                  Эмч ажиллаж буй: <strong>{performance.doctorCount}</strong>
                </div>
                <div className="rounded-2xl bg-gray-50 p-3">
                  Дууссан / Бүртгэлтэй / Ирээгүй:{" "}
                  <strong>
                    {performance.completedCount} / {performance.bookedCount} /{" "}
                    {performance.noShowCount}
                  </strong>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-500">Үзүүлэлт байхгүй байна.</div>
          )}
        </section>

        <section className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-950">Цаг захиалгын календар</h2>
              <p className="text-sm text-gray-500">
                Зөвхөн харах горим. Цаг дээр дарахад засварлах цонх нээгдэхгүй.
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              Өдөр
              <input
                type="date"
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-300"
              />
            </label>
          </div>

          {loading ? (
            <div className="rounded-xl border border-dashed border-gray-300 py-12 text-center text-sm text-gray-500">
              Календар ачаалж байна...
            </div>
          ) : (
            <AppointmentsV2Grid
              doctors={scheduledDoctors}
              timeSlots={timeSlots}
              slotHeightPx={SLOT_HEIGHT_PX}
              columnHeightPx={columnHeightPx}
              stickyHeaderHeightPx={GRID_STICKY_HEADER_HEIGHT}
              nowPosition={null}
              blocksByDoctorId={blocksByDoctorId}
              slotOccupancyByDoctorId={slotOccupancyByDoctorId}
              onCellClick={() => undefined}
              onAppointmentClick={() => undefined}
              canDragAppointment={() => false}
              pendingSaveId={null}
              activeDragAppointmentId={null}
              invalidDragAppointmentId={null}
              dragPreviewDoctorId={null}
              dragPreviewSlotLabels={[]}
              onAppointmentMouseDown={() => undefined}
              disableAppointmentClicks
              scrollContainerRef={gridScrollRef}
            />
          )}
        </section>
      </div>
    </main>
  );
}

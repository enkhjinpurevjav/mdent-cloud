export type AppointmentStatus =
  // frontend legacy uppercase
  | "BOOKED"
  | "CONFIRMED"
  | "ONLINE"
  | "ONGOING"
  | "READY_TO_PAY"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW"
  | "OTHER"
  // backend db lowercase (actual values stored)
  | "booked"
  | "confirmed"
  | "online"
  | "ongoing"
  | "ready_to_pay"
  | "completed"
  | "cancelled"
  | "no_show"
  | "other";

export type AppointmentRow = {
  id: number;

  // ===== Legacy flat fields (used by visits pages) =====
  patientName?: string | null;
  regNo?: string | null;
  branchName?: string | null;
  doctorName?: string | null;
  status: AppointmentStatus;
  startTime?: string | null; // ISO (legacy alias)
  endTime?: string | null;   // ISO (legacy alias)

  // ===== New fields returned by /api/appointments (preferred) =====
  scheduledAt?: string | null;
  endAt?: string | null;

  patientOvog?: string | null;
  patientPhone?: string | null;
  patientRegNo?: string | null;

  branchId?: number | null;
  doctorId?: number | null;
  patientId?: number | null;

  notes?: string | null;

  // Optional nested objects (backend returns these)
  patient?: {
    id: number;
    name: string;
    ovog?: string | null;
    regNo?: string | null;
    phone?: string | null;
    patientBook?: any;
  } | null;

  branch?: {
    id: number;
    name: string;
  } | null;
};

export type AppointmentFilters = {
  dateFrom: string;
  dateTo: string;
  status?: AppointmentStatus | "ALL";
  branchId?: string;
  search?: string;
  includeCancelled?: boolean;
};

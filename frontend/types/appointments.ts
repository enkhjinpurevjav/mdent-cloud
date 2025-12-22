export type AppointmentStatus =
  | "BOOKED"
  | "ONGOING"
  | "COMPLETED"
  | "CANCELLED";

export type AppointmentRow = {
  id: number;
  patientName: string;
  regNo: string;
  branchName: string;
  doctorName: string;
  status: AppointmentStatus;
  startTime: string; // ISO
  endTime?: string | null;
};

export type AppointmentFilters = {
  dateFrom: string;
  dateTo: string;
  status?: AppointmentStatus | "ALL";
  branchId?: string;
  search?: string;
  includeCancelled?: boolean;
};

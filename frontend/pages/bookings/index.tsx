// frontend/pages/bookings/index.tsx
import React, { useEffect, useMemo, useState } from "react";

type Branch = {
  id: number;
  name: string;
};

type Doctor = {
  id: number;
  name?: string | null;
  email: string;
  branches?: Branch[];
  branch?: Branch | null;
};

type BookingStatus =
  | "PENDING"
  | "CONFIRMED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

type Booking = {
  id: number;
  date: string; // "YYYY-MM-DD"
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  status: BookingStatus;
  note?: string | null;
  doctor: { id: number; name?: string | null; email: string };
  branch: Branch;
  patient: {
    id: number;
    name?: string | null;
    regNo?: string | null;
    phone?: string | null;
  };
};

type DoctorScheduleDay = {
  id: number;
  date: string; // "YYYY-MM-DD"
  branch: Branch;
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  note?: string | null;
};

type WorkingDoctor = {
  doctor: Doctor;
  schedule: DoctorScheduleDay;
};

const SLOT_MINUTES = 30;
const ROW_HEIGHT = 40; // px per 30-min slot

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function formatDoctorName(d: Doctor): string {
  if (d.name && d.name.trim().length > 0) return d.name;
  return d.email;
}

export default function BookingsPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().slice(0, 10);
  });

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [bookingsError, setBookingsError] = useState<string | null>(null);

  const [workingDoctors, setWorkingDoctors] = useState<WorkingDoctor[]>([]);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  const [globalError, setGlobalError] = useState<string | null>(null);

  // Load branches & doctors once
  useEffect(() => {
    async function loadInitial() {
      try {
        const [bRes, dRes] = await Promise.all([
          fetch("/api/branches"),
          fetch("/api/users?role=doctor"),
        ]);

        const bData = await bRes.json();
        if (bRes.ok && Array.isArray(bData)) {
          setBranches(bData);
          if (!selectedBranchId && bData.length > 0) {
            setSelectedBranchId(String(bData[0].id));
          }
        }

        const dData = await dRes.json();
        if (dRes.ok && Array.isArray(dData)) {
          setDoctors(dData);
        }
      } catch (e) {
        console.error(e);
        setGlobalError("Сүлжээгээ шалгана уу");
      }
    }

    loadInitial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load bookings whenever branch/date change
  useEffect(() => {
    if (!selectedBranchId || !selectedDate) return;

    async function loadBookings() {
      setLoadingBookings(true);
      setBookingsError(null);
      try {
        const url = `/api/bookings?branchId=${selectedBranchId}&date=${selectedDate}`;
        const res = await fetch(url);
        const data = await res.json();

        if (!res.ok) {
          setBookingsError(data?.error || "Цаг захиалга ачаалж чадсангүй");
          setBookings([]);
          return;
        }

        if (!Array.isArray(data)) {
          setBookingsError("Алдаатай өгөгдөл ирлээ");
          setBookings([]);
          return;
        }

        setBookings(data);
      } catch (e) {
        console.error(e);
        setBookingsError("Сүлжээгээ шалгана уу");
        setBookings([]);
      } finally {
        setLoadingBookings(false);
      }
    }

    loadBookings();
  }, [selectedBranchId, selectedDate]);

  // Load working doctors (schedule) for branch+date
  useEffect(() => {
    if (!selectedBranchId || !selectedDate || doctors.length === 0) return;

    async function loadWorkingDoctors() {
      setLoadingSchedule(true);
      setScheduleError(null);
      try {
        const branchIdNum = Number(selectedBranchId);
        if (Number.isNaN(branchIdNum)) {
          setScheduleError("Салбарын ID буруу байна");
          setWorkingDoctors([]);
          return;
        }

        const from = selectedDate;
        const to = selectedDate;

        const results: WorkingDoctor[] = [];

        for (const doc of doctors) {
          const res = await fetch(
            `/api/users/${doc.id}/schedule?from=${from}&to=${to}&branchId=${branchIdNum}`
          );
          const data = await res.json();

          if (!res.ok || !Array.isArray(data) || data.length === 0) {
            continue;
          }

          const schedule: DoctorScheduleDay = data[0];
          results.push({ doctor: doc, schedule });
        }

        setWorkingDoctors(results);
      } catch (e) {
        console.error(e);
        setScheduleError("Ажлын хуваарь ачаалж чадсангүй");
        setWorkingDoctors([]);
      } finally {
        setLoadingSchedule(false);
      }
    }

    loadWorkingDoctors();
  }, [selectedBranchId, selectedDate,](#)*


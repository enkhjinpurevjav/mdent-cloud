import React, { useState } from "react";
import DoctorWeeklyBookingGrid from "../components/DoctorWeeklyBookingGrid";

export default function FollowupBookingPage() {
  const [selected, setSelected] = useState<any>(null);

  return (
    <div style={{ padding: 24 }}>
      <h1>Давтан үзлэгийн цаг авах (7 хоног)</h1>

      <DoctorWeeklyBookingGrid
        doctorId={6}
        slotMinutes={30}
        onSelectSlot={(payload) => {
          // Next step: open patient search modal (reuse from appointments.tsx)
          setSelected(payload);
          console.log("Selected slot:", payload);
        }}
      />

      {selected && (
        <div style={{ marginTop: 12 }}>
          Сонгосон: {selected.ymd} {selected.time} (branchId={selected.branchId})
        </div>
      )}
    </div>
  );
}

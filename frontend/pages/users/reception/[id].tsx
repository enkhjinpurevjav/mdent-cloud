import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";

type Branch = {
  id: number;
  name: string;
};

type Receptionist = {
  id: number;
  email: string;
  name?: string | null;
  ovog?: string | null;
  role: string;
  regNo?: string | null;
  phone?: string | null;
  branchId?: number | null;
  branch?: Branch | null;
  branches?: Branch[];
  createdAt?: string;
};

type ReceptionScheduleDay = {
  id: number;
  date: string; // YYYY-MM-DD
  branch: Branch;
  startTime: string; // HH:MM
  endTime: string;   // HH:MM
  note?: string | null;
};

type ShiftType = "AM" | "PM" | "WEEKEND_FULL";

export default function ReceptionProfilePage() {
  const router = useRouter();
  const idParam = router.query.id;
  const receptionId =
    typeof idParam === "string" ? Number(idParam) : NaN;

  const [user, setUser] = useState<Receptionist | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [schedule, setSchedule] = useState<ReceptionScheduleDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // profile form
  const [form, setForm] = useState({
    ovog: "",
    name: "",
    email: "",
    regNo: "",
    phone: "",
    branchId: "" as string | "",
  });

  // branch assignment form
  const [branchIds, setBranchIds] = useState<number[]>([]);

  // schedule create form
  const [scheduleForm, setScheduleForm] = useState<{
    date: string;
    branchId: string;
    shiftType: ShiftType;
    startTime: string;
    endTime: string;
    note: string;
  }>({
    date: "",
    branchId: "",
    shiftType: "AM",
    startTime: "09:00",
    endTime: "15:00",
    note: "",
  });

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [scheduleError, setScheduleError] = useState("");

  useEffect(() => {
    if (!receptionId || Number.isNaN(receptionId)) return;

    async function load() {
      try {
        setLoading(true);
        setError("");

        const [userRes, branchesRes, scheduleRes] = await Promise.all([
          fetch(`/api/users/${receptionId}`),
          fetch("/api/branches"),
          fetch(`/api/users/${receptionId}/reception-schedule`),
        ]);

        const [userData, branchesData, scheduleData] = await Promise.all([
          userRes.json().catch(() => null),
          branchesRes.json().catch(() => []),
          scheduleRes.json().catch(() => []),
        ]);

        if (!userRes.ok || !userData || !userData.id) {
          throw new Error(
            (userData && userData.error) || "Ресепшн олдсонгүй"
          );
        }

        setUser(userData as Receptionist);

        const branchList = Array.isArray(branchesData)
          ? (branchesData as Branch[])
          : [];
        setBranches(branchList);

        if (Array.isArray(scheduleData)) {
          setSchedule(scheduleData as ReceptionScheduleDay[]);
        } else {
          setSchedule([]);
        }

        setForm({
          ovog: userData.ovog || "",
          name: userData.name || "",
          email: userData.email || "",
          regNo: userData.regNo || "",
          phone: userData.phone || "",
          branchId:
            userData.branchId ??
            (userData.branch ? String(userData.branch.id) : "") ??
            "",
        });

        const currentBranchIds =
          Array.isArray(userData.branches) && userData.branches.length > 0
            ? userData.branches.map((b: any) => b.id)
            : userData.branch
            ? [userData.branch.id]
            : [];
        setBranchIds(currentBranchIds);
      } catch (e: any) {
        console.error(e);
        setError(e.message || "Ачаалах үед алдаа гарлаа");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [receptionId]);

  const handleProfileChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const toggleBranch = (branchId: number) => {
    setBranchIds((prev) => {
      const exists = prev.includes(branchId);
      const next = exists
        ? prev.filter((id) => id !== branchId)
        : [...prev, branchId];
      return next;
    });
  };

  const handleScheduleFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    if (name === "shiftType") {
      let startTime = "09:00";
      let endTime = "15:00";
      if (value === "PM") {
        startTime = "15:00";
        endTime = "21:00";
      } else if (value === "WEEKEND_FULL") {
        startTime = "10:00";
        endTime = "19:00";
      }
      setScheduleForm((prev) => ({
        ...prev,
        shiftType: value as ShiftType,
        startTime,
        endTime,
      }));
      return;
    }

    setScheduleForm((prev) => ({ ...prev, [name]: value }));
  };

  const reloadSchedule = async () => {
    if (!receptionId || Number.isNaN(receptionId)) return;
    try {
      const res = await fetch(`/api/users/${receptionId}/reception-schedule`);
      const data = await res.json().catch(() => []);
      if (res.ok && Array.isArray(data)) {
        setSchedule(data as ReceptionScheduleDay[]);
      }
    } catch (e) {
      console.error("Failed to reload schedule", e);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSavingProfile(true);
    try {
      const payload: any = {
        name: form.name || null,
        ovog: form.ovog || null,
        email: form.email || null,
        regNo: form.regNo || null,
        phone: form.phone || null,
        branchId: form.branchId ? Number(form.branchId) : null,
      };

      const res = await fetch(`/api/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok || !data || !data.id) {
        alert((data && data.error) || "Хадгалах үед алдаа гарлаа");
        return;
      }

      setUser((prev) =>
        prev
          ? {
              ...prev,
              name: data.name,
              ovog: data.ovog,
              regNo: data.regNo,
              phone: data.phone,
              branchId: data.branchId,
              branch: data.branch,
            }
          : prev
      );
    } catch (e) {
      console.error(e);
      alert("Сүлжээгээ шалгана уу");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveBranches = async () => {
    if (!user) return;

    try {
      const res = await fetch(`/api/users/${user.id}/branches`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchIds }),
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok || !data) {
        alert((data && data.error) || "Салбар хадгалах үед алдаа гарлаа");
        return;
      }

      const updatedBranches =
        data && Array.isArray(data.branches) ? data.branches : [];

      setUser((prev) =>
        prev ? { ...prev, branches: updatedBranches } : prev
      );
      alert("Салбар амжилттай хадгалагдлаа.");
    } catch (e) {
      console.error(e);
      alert("Сүлжээгээ шалгана уу");
    }
  };

  const handleDeleteUser = async () => {
    if (!user) return;
    const ok = window.confirm(
      "Та энэхүү ресепшн ажилтныг устгахдаа итгэлтэй байна уу?"
    );
    if (!ok) return;

    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "DELETE",
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok) {
        alert((data && data.error) || "Устгах үед алдаа гарлаа");
        return;
      }

      router.push("/users/reception");
    } catch (e) {
      console.error(e);
      alert("Сүлжээгээ шалгана уу");
    }
  };

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setScheduleError("");
    if (!user) return;

    if (!scheduleForm.date || !scheduleForm.branchId) {
      setScheduleError("Огноо болон салбарыг сонгоно уу.");
      return;
    }

    try {
      setSavingSchedule(true);

      const payload = {
        date: scheduleForm.date,
        branchId: Number(scheduleForm.branchId),
        startTime: scheduleForm.startTime,
        endTime: scheduleForm.endTime,
        note: scheduleForm.note || null,
      };

      const res = await fetch(`/api/users/${user.id}/reception-schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok || !data || !data.id) {
        setScheduleError(
          (data && data.error) || "Ажлын хуваарь хадгалах үед алдаа гарлаа."
        );
        setSavingSchedule(false);
        return;
      }

      await reloadSchedule();
      setScheduleForm((prev) => ({
        ...prev,
        note: "",
      }));
    } catch (e) {
      console.error(e);
      setScheduleError("Сүлжээгээ шалгана уу.");
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleDeleteSchedule = async (scheduleId: number) => {
    if (!user) return;
    const ok = window.confirm("Энэ ажлын хуваарийг устгах уу?");
    if (!ok) return;

    try {
      const res = await fetch(
        `/api/users/${user.id}/reception-schedule/${scheduleId}`,
        {
          method: "DELETE",
        }
      );

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok) {
        alert((data && data.error) || "Хуваарь устгах үед алдаа гарлаа");
        return;
      }

      setSchedule((prev) => prev.filter((s) => s.id !== scheduleId));
    } catch (e) {
      console.error(e);
      alert("Сүлжээгээ шалгана уу.");
    }
  };

  if (!receptionId || Number.isNaN(receptionId)) {
    return <div>Буруу ID</div>;
  }

  return (
    <main
      style={{
        maxWidth: 900,
        margin: "40px auto",
        padding: 24,
        fontFamily: "sans-serif",
      }}
    >
      <button
        type="button"
        onClick={() => router.back()}
        style={{
          marginBottom: 16,
          padding: "4px 10px",
          borderRadius: 6,
          border: "1px solid #d1d5db",
          background: "#f9fafb",
          cursor: "pointer",
          fontSize: 13,
        }}
      >
        ← Буцах
      </button>

      {loading && <div>Ачааллаж байна...</div>}
      {!loading && error && <div style={{ color: "red" }}>{error}</div>}
      {!loading && !error && user && (
        <>
          {/* Header + picture placeholder */}
          <section
            style={{
              marginBottom: 24,
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 24,
              alignItems: "flex-start",
            }}
          >
            <div>
              <h1 style={{ margin: "0 0 16px", fontSize: 24 }}>
                Ресепшн: {user.name || "-"}
              </h1>

              <form onSubmit={handleSaveProfile}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 8,
                    marginBottom: 12,
                  }}
                >
                  <div>
                    <label style={{ fontSize: 13 }}>Овог</label>
                    <input
                      name="ovog"
                      value={form.ovog}
                      onChange={handleProfileChange}
                      style={{
                        width: "100%",
                        padding: 6,
                        borderRadius: 6,
                        border: "1px solid #d1d5db",
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 13 }}>Нэр</label>
                    <input
                      name="name"
                      value={form.name}
                      onChange={handleProfileChange}
                      style={{
                        width: "100%",
                        padding: 6,
                        borderRadius: 6,
                        border: "1px solid #d1d5db",
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 13 }}>И-мэйл</label>
                    <input
                      name="email"
                      type="email"
                      value={form.email}
                      onChange={handleProfileChange}
                      style={{
                        width: "100%",
                        padding: 6,
                        borderRadius: 6,
                        border: "1px solid #d1d5db",
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 13 }}>Үндсэн салбар</label>
                    <select
                      name="branchId"
                      value={form.branchId}
                      onChange={handleProfileChange}
                      style={{
                        width: "100%",
                        padding: 6,
                        borderRadius: 6,
                        border: "1px solid #d1d5db",
                      }}
                    >
                      <option value="">Сонгох</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 13 }}>РД</label>
                    <input
                      name="regNo"
                      value={form.regNo}
                      onChange={handleProfileChange}
                      style={{
                        width: "100%",
                        padding: 6,
                        borderRadius: 6,
                        border: "1px solid #d1d5db",
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 13 }}>Утас</label>
                    <input
                      name="phone"
                      value={form.phone}
                      onChange={handleProfileChange}
                      style={{
                        width: "100%",
                        padding: 6,
                        borderRadius: 6,
                        border: "1px solid #d1d5db",
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button
                    type="submit"
                    disabled={savingProfile}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 6,
                      border: "none",
                      background: "#2563eb",
                      color: "white",
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    {savingProfile ? "Хадгалж байна..." : "Хадгалах"}
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteUser}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 6,
                      border: "1px solid #ef4444",
                      background: "#fef2f2",
                      color: "#b91c1c",
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    Ажилтныг устгах
                  </button>
                </div>
              </form>
            </div>

            {/* Picture placeholder (similar to doctor page) */}
            <div
              style={{
                alignSelf: "flex-start",
                display: "flex",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  width: 220,
                  height: 260,
                  borderRadius: 12,
                  border: "2px dashed #d1d5db",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#9ca3af",
                  fontSize: 13,
                  textAlign: "center",
                }}
              >
                Зураг байрлах хэсэг
              </div>
            </div>
          </section>

          {/* Branch assignment section */}
          <section style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 18, marginBottom: 4 }}>Салбарын тохиргоо</h2>
            <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 8 }}>
              Энэ ресепшн аль салбаруудад ажиллахыг доороос сонгоно уу.
            </p>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                marginBottom: 8,
              }}
            >
              {branches.map((b) => (
                <label
                  key={b.id}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    border: "1px solid #ddd",
                    borderRadius: 6,
                    padding: "4px 10px",
                    fontSize: 13,
                    background: branchIds.includes(b.id)
                      ? "#dbeafe"
                      : "#f9fafb",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={branchIds.includes(b.id)}
                    onChange={() => toggleBranch(b.id)}
                  />
                  {b.name}
                </label>
              ))}
            </div>

            <button
              type="button"
              onClick={handleSaveBranches}
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                border: "none",
                background: "#16a34a",
                color: "white",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Салбар хадгалах
            </button>
          </section>

          {/* Schedule create + list */}
          <section>
            <h2 style={{ fontSize: 18, marginBottom: 8 }}>
              Ажлын хуваарь шинээр нэмэх
            </h2>
            <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 8 }}>
              Сонгосон өдөр, салбар, ээлжийн дагуу шинэ ажлын хуваарь үүсгэнэ.
            </p>

            <form
              onSubmit={handleSaveSchedule}
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 8,
                marginBottom: 8,
              }}
            >
              <div>
                <label style={{ fontSize: 13 }}>Огноо</label>
                <input
                  type="date"
                  name="date"
                  value={scheduleForm.date}
                  onChange={handleScheduleFormChange}
                  style={{
                    width: "100%",
                    padding: 6,
                    borderRadius: 6,
                    border: "1px solid #d1d5db",
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 13 }}>Салбар</label>
                <select
                  name="branchId"
                  value={scheduleForm.branchId}
                  onChange={handleScheduleFormChange}
                  style={{
                    width: "100%",
                    padding: 6,
                    borderRadius: 6,
                    border: "1px solid #d1d5db",
                  }}
                >
                  <option value="">Сонгох</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 13 }}>Ээлж</label>
                <select
                  name="shiftType"
                  value={scheduleForm.shiftType}
                  onChange={handleScheduleFormChange}
                  style={{
                    width: "100%",
                    padding: 6,
                    borderRadius: 6,
                    border: "1px solid #d1d5db",
                  }}
                >
                  <option value="AM">Өглөө ээлж</option>
                  <option value="PM">Оройн ээлж</option>
                  <option value="WEEKEND_FULL">Бямба/Ням бүтэн</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: 13 }}>Эхлэх цаг</label>
                <input
                  type="time"
                  name="startTime"
                  value={scheduleForm.startTime}
                  onChange={handleScheduleFormChange}
                  style={{
                    width: "100%",
                    padding: 6,
                    borderRadius: 6,
                    border: "1px solid #d1d5db",
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: 13 }}>Дуусах цаг</label>
                <input
                  type="time"
                  name="endTime"
                  value={scheduleForm.endTime}
                  onChange={handleScheduleFormChange}
                  style={{
                    width: "100%",
                    padding: 6,
                    borderRadius: 6,
                    border: "1px solid #d1d5db",
                  }}
                />
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ fontSize: 13 }}>Тэмдэглэл</label>
                <input
                  name="note"
                  value={scheduleForm.note}
                  onChange={handleScheduleFormChange}
                  placeholder="Жишээ нь: 30 минут хоцорч эхэлнэ"
                  style={{
                    width: "100%",
                    padding: 6,
                    borderRadius: 6,
                    border: "1px solid #d1d5db",
                  }}
                />
              </div>

              <div
                style={{
                  gridColumn: "1 / -1",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                {scheduleError && (
                  <span style={{ color: "#b91c1c", fontSize: 12 }}>
                    {scheduleError}
                  </span>
                )}
                <button
                  type="submit"
                  disabled={savingSchedule}
                  style={{
                    marginLeft: "auto",
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: "none",
                    background: "#2563eb",
                    color: "white",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  {savingSchedule ? "Хадгалж байна..." : "Хуваарь хадгалах"}
                </button>
              </div>
            </form>

            <h3 style={{ marginTop: 24, marginBottom: 8 }}>
              Дараагийн 1 сарын ажлын хуваарь
            </h3>

            {schedule.length === 0 ? (
              <div style={{ color: "#6b7280", fontSize: 13 }}>
                Төлөвлөсөн ажлын хуваарь алга.
              </div>
            ) : (
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 13,
                }}
              >
                <thead>
                  <tr>
                    <th
                      style={{
                        textAlign: "left",
                        borderBottom: "1px solid #ddd",
                        padding: 6,
                      }}
                    >
                      Огноо
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        borderBottom: "1px solid #ddd",
                        padding: 6,
                      }}
                    >
                      Салбар
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        borderBottom: "1px solid #ddd",
                        padding: 6,
                      }}
                    >
                      Цаг
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        borderBottom: "1px solid #ddd",
                        padding: 6,
                      }}
                    >
                      Тэмдэглэл
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        borderBottom: "1px solid #ddd",
                        padding: 6,
                      }}
                    >
                      Үйлдэл
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {schedule.map((s) => {
                    const dateObj = new Date(s.date);
                    const dateLabel = dateObj.toLocaleDateString("mn-MN", {
                      weekday: "short",
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                    });

                    return (
                      <tr key={s.id}>
                        <td
                          style={{
                            borderBottom: "1px solid #f0f0f0",
                            padding: 6,
                          }}
                        >
                          {dateLabel}
                        </td>
                        <td
                          style={{
                            borderBottom: "1px solid #f0f0f0",
                            padding: 6,
                          }}
                        >
                          {s.branch?.name ?? "-"}
                        </td>
                        <td
                          style={{
                            borderBottom: "1px solid #f0f0f0",
                            padding: 6,
                          }}
                        >
                          {s.startTime} - {s.endTime}
                        </td>
                        <td
                          style={{
                            borderBottom: "1px solid #f0f0f0",
                            padding: 6,
                          }}
                        >
                          {s.note || "-"}
                        </td>
                        <td
                          style={{
                            borderBottom: "1px solid #f0f0f0",
                            padding: 6,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {/* Simple delete button for now; inline edit can be added later */}
                          <button
                            type="button"
                            onClick={() => handleDeleteSchedule(s.id)}
                            style={{
                              padding: "2px 8px",
                              borderRadius: 4,
                              border: "1px solid #ef4444",
                              background: "#fef2f2",
                              color: "#b91c1c",
                              fontSize: 12,
                              cursor: "pointer",
                            }}
                          >
                            Устгах
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </main>
  );
}

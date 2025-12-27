
    typeof bookNumber === "string" && bookNumber.trim()
      ? bookNumber.trim()
      : "";

  const parseOrZero = (v: string | undefined | null): number =>
    !v ? 0 : Number.parseFloat(v) || 0;

  const updateSumOfIncisor = (
    key: keyof SumOfIncisorInputs,
    value: string
  ) => {
    const cleaned = value.replace(/[^0-9.]/g, "");
    setSumOfIncisorInputs((prev) => ({ ...prev, [key]: cleaned }));
  };

  const u1Sum =
    parseOrZero(sumOfIncisorInputs.u12) +
    parseOrZero(sumOfIncisorInputs.u11) +
    parseOrZero(sumOfIncisorInputs.u21) +
    parseOrZero(sumOfIncisorInputs.u22);

  const l1Sum =
    parseOrZero(sumOfIncisorInputs.l32) +
    parseOrZero(sumOfIncisorInputs.l31) +
    parseOrZero(sumOfIncisorInputs.l41) +
    parseOrZero(sumOfIncisorInputs.l42);

  const u1l1Ratio = l1Sum > 0 ? (u1Sum / l1Sum).toFixed(2) : "";

  const updateBoltonUpper6 = (index: number, value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, "");
    setBoltonInputs((prev) => {
      const next = structuredClone(prev) as BoltonInputs;
      next.upper6[index] = cleaned;
      next.upper12[index] = cleaned;
      return next;
    });
  };

  const updateBoltonLower6 = (index: number, value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, "");
    setBoltonInputs((prev) => {
      const next = structuredClone(prev) as BoltonInputs;
      next.lower6[index] = cleaned;
      next.lower12[index] = cleaned;
      return next;
    });
  };

  const updateBoltonUpper12 = (index: number, value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, "");
    setBoltonInputs((prev) => {
      const next = structuredClone(prev) as BoltonInputs;
      next.upper12[index] = cleaned;
      return next;
    });
  };

  const updateBoltonLower12 = (index: number, value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, "");
    setBoltonInputs((prev) => {
      const next = structuredClone(prev) as BoltonInputs;
      next.lower12[index] = cleaned;
      return next;
    });
  };

  const sumArray = (arr: string[]): number =>
    arr.reduce((acc, v) => acc + parseOrZero(v), 0);

  const upper6Sum = sumArray(boltonInputs.upper6);
  const lower6Sum = sumArray(boltonInputs.lower6);
  const upper12Sum = sumArray(boltonInputs.upper12);
  const lower12Sum = sumArray(boltonInputs.lower12);

  const bolton6Result =
    upper6Sum > 0 ? ((lower6Sum / upper6Sum) * 100).toFixed(1) : "";
  const bolton12Result =
    upper12Sum > 0 ? ((lower12Sum / upper12Sum) * 100).toFixed(1) : "";

  const updateHowes = (field: keyof HowesInputs, value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, "");
    setHowesInputs((prev) => ({ ...prev, [field]: cleaned }));
  };

  const pmbawNum = parseOrZero(howesInputs.pmbaw);
  const tmNum = parseOrZero(howesInputs.tm);
  const howesResult =
    tmNum > 0 ? ((pmbawNum / tmNum) * 100).toFixed(1) : "";

  const getHowesCategory = () => {
    const v = Number.parseFloat(howesResult || "");
    if (!howesResult || Number.isNaN(v)) return { label: "", color: "" };
    if (v < 37)
      return {
        label: "< 37% — Суурь яс дутмаг → шүд авах магадлал өндөр",
        color: "#b91c1c",
      };
    if (v > 44)
      return {
        label: "> 44% — Суурь өргөн их → шүд авахгүй байх нь тохиромжтой",
        color: "#16a34a",
      };
    return {
      label: "37–44% — Хэвийн / завсрын бүс",
      color: "#f97316",
    };
  };

  const howesCategory = getHowesCategory();

  type AxisKey =
    | "ald"
    | "midline"
    | "curveOfSpee"
    | "expansion"
    | "fmiaABPlane"
    | "overjet"
    | "total";

  const updateDiscrepancy = (
    axis: Exclude<AxisKey, "total">,
    pos: keyof DiscrepancyAxis,
    value: string
  ) => {
    const cleaned = value.replace(/[^0-9.+-]/g, "");
    setDiscrepancyInputs((prev) => ({
      ...prev,
      [axis]: {
        ...prev[axis],
        [pos]: cleaned,
      },
    }));
  };

  const valueAt = (ax: DiscrepancyAxis, pos: keyof DiscrepancyAxis): number =>
    parseOrZero(ax[pos]);

  const ald = discrepancyInputs.ald;
  const midline = discrepancyInputs.midline;
  const curveOfSpee = discrepancyInputs.curveOfSpee;
  const expansion = discrepancyInputs.expansion;
  const fmia = discrepancyInputs.fmiaABPlane;
  const overjet = discrepancyInputs.overjet;

  const totalAxis: DiscrepancyAxis = {
    upperLeft: (
      valueAt(ald, "upperLeft") +
      valueAt(midline, "upperLeft") +
      valueAt(curveOfSpee, "upperLeft") +
      valueAt(expansion, "upperLeft") +
      valueAt(fmia, "upperLeft") +
      valueAt(overjet, "upperLeft")
    ).toFixed(2),
    upperRight: (
      valueAt(ald, "upperRight") +
      valueAt(midline, "upperRight") +
      valueAt(curveOfSpee, "upperRight") +
      valueAt(expansion, "upperRight") +
      valueAt(fmia, "upperRight") +
      valueAt(overjet, "upperRight")
    ).toFixed(2),
    lowerLeft: (
      valueAt(ald, "lowerLeft") +
      valueAt(midline, "lowerLeft") +
      valueAt(curveOfSpee, "lowerLeft") +
      valueAt(expansion, "lowerLeft") +
      valueAt(fmia, "lowerLeft") +
      valueAt(overjet, "lowerLeft")
    ).toFixed(2),
    lowerRight: (
      valueAt(ald, "lowerRight") +
      valueAt(midline, "lowerRight") +
      valueAt(curveOfSpee, "lowerRight") +
      valueAt(expansion, "lowerRight") +
      valueAt(fmia, "lowerRight") +
      valueAt(overjet, "lowerRight")
    ).toFixed(2),
  };

  const handleSave = async () => {
    if (!patientBookId) {
      setError("PatientBook ID олдсонгүй.");
      return;
    }

    setSaving(true);
    setError("");
    setInfo("");

    try {
      const discrepancyWithTotal: DiscrepancyInputs = {
        ...discrepancyInputs,
        total: totalAxis,
      };

      const payload: OrthoCardData = {
        patientName: cardPatientName || undefined,
        notes: cardNotes || undefined,
        toothChart,
        supernumeraryNote: extraToothText || undefined,
        sumOfIncisorInputs,
        boltonInputs,
        howesInputs,
        discrepancyInputs: discrepancyWithTotal,
        survey,
        physicalExam,
        habits,
        attachment,
        tmj,
        utts,
        lip,
      };

      const res = await fetch(`/api/patients/ortho-card/${patientBookId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: payload }),
      });
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(
          (json && json.error) ||
            "Гажиг заслын карт хадгалахад алдаа гарлаа."
        );
      }

      setInfo("Гажиг заслын карт амжилттай хадгалагдлаа.");
    } catch (err: any) {
      console.error("save ortho card failed", err);
      setError(
        err?.message || "Гажиг заслын карт хадгалахад алдаа гарлаа."
      );
    } finally {
      setSaving(false);
    }
  };

  const uniformInputStyle: React.CSSProperties = {
    width: 68,
    borderRadius: 4,
    border: "1px solid #d1d5db",
    padding: "2px 4px",
    fontSize: 11,
  };

  const uniformTotalBoxBase: React.CSSProperties = {
    width: 68,
    borderRadius: 4,
    border: "1px solid #d1d5db",
    padding: "2px 4px",
    background: "#f9fafb",
    fontSize: 11,
    fontWeight: 700,
  };

  const renderAxis = (
    axisKey: Exclude<AxisKey, "total">,
    label: string,
    axis: DiscrepancyAxis
  ) => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        fontSize: 12,
      }}
    >
      <div style={{ marginBottom: 4, fontWeight: 500 }}>{label}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div
          style={{
            display: "flex",
            gap: 6,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <input
            type="text"
            value={axis.upperLeft}
            onChange={(e) =>
              updateDiscrepancy(axisKey, "upperLeft", e.target.value)
            }
            style={uniformInputStyle}
          />
          <input
            type="text"
            value={axis.upperRight}
            onChange={(e) =>
              updateDiscrepancy(axisKey, "upperRight", e.target.value)
            }
            style={uniformInputStyle}
          />
        </div>
        <div
          style={{
            display: "flex",
            gap: 6,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <input
            type="text"
            value={axis.lowerLeft}
            onChange={(e) =>
              updateDiscrepancy(axisKey, "lowerLeft", e.target.value)
            }
            style={uniformInputStyle}
          />
          <input
            type="text"
            value={axis.lowerRight}
            onChange={(e) =>
              updateDiscrepancy(axisKey, "lowerRight", e.target.value)
            }
            style={uniformInputStyle}
          />
        </div>
      </div>
    </div>
  );

  const Arrow = () => (
    <div
      style={{
        width: 32,
        height: 1,
        background: "#d1d5db",
        position: "relative",
        margin: "0 4px",
      }}
    >
      <div
        style={{
          position: "absolute",
          right: 0,
          top: -3,
          width: 0,
          height: 0,
          borderTop: "4px solid transparent",
          borderBottom: "4px solid transparent",
          borderLeft: "6px solid #6b7280",
        }}
      />
    </div>
  );

  return (
    <main
      style={{
        maxWidth: 1200,
        margin: "40px auto",
        padding: 24,
        fontFamily: "sans-serif",
      }}
    >
      <button
        type="button"
        onClick={() => {
          if (!bookNumber || typeof bookNumber !== "string") {
            router.push("/patients");
            return;
          }
          router.push(`/patients/${encodeURIComponent(bookNumber)}`);
        }}
        style={{
          marginBottom: 16,
          padding: "4px 8px",
          borderRadius: 4,
          border: "1px solid #d1d5db",
          background: "#f9fafb",
          cursor: "pointer",
          fontSize: 13,
        }}
      >
        ← Үйлчлүүлэгчийн хэсэг рүү буцах
      </button>

      <h1 style={{ fontSize: 20, marginTop: 0, marginBottom: 8 }}>
        Гажиг заслын үйлчлүүлэгчийн карт
      </h1>

      {/* Patient header */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          fontSize: 13,
          color: "#111827",
          marginBottom: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 16,
            alignItems: "baseline",
          }}
        >
          <div>
            <span style={{ color: "#6b7280", marginRight: 4 }}>
              Картын дугаар:
            </span>
            <span style={{ fontWeight: 600 }}>{bn || "—"}</span>
          </div>

          <div>
            <span style={{ color: "#6b7280", marginRight: 4 }}>
              Үйлчлүүлэгч:
            </span>
            <span style={{ fontWeight: 600 }}>
              {patientNameHeader || "—"}
            </span>
          </div>

          <div>
            <span style={{ color: "#6b7280", marginRight: 4 }}>РД:</span>
            <span style={{ fontWeight: 500 }}>{patientRegNo || "—"}</span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 16,
            alignItems: "baseline",
          }}
        >
          <div>
            <span style={{ color: "#6b7280", marginRight: 4 }}>Нас:</span>
            <span style={{ fontWeight: 500 }}>{patientAge || "—"}</span>
          </div>

          <div>
            <span style={{ color: "#6b7280", marginRight: 4 }}>Хүйс:</span>
            <span style={{ fontWeight: 500 }}>{patientGender || "—"}</span>
          </div>

          <div>
            <span style={{ color: "#6b7280", marginRight: 4 }}>Утас:</span>
            <span style={{ fontWeight: 500 }}>{patientPhone || "—"}</span>
          </div>
        </div>

        <div>
          <span style={{ color: "#6b7280", marginRight: 4 }}>Хаяг:</span>
          <span style={{ fontWeight: 500 }}>{patientAddress || "—"}</span>
        </div>
      </div>

      {loading && <div>Ачааллаж байна...</div>}
      {!loading && error && (
        <div style={{ color: "#b91c1c", fontSize: 13, marginBottom: 8 }}>
          {error}
        </div>
      )}
      {!loading && info && (
        <div style={{ color: "#16a34a", fontSize: 13, marginBottom: 8 }}>
          {info}
        </div>
      )}

      {!loading && !error && (
        <section
          style={{
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            padding: 16,
            background: "white",
          }}
        >
          {/* ЗУРШИЛ, ХОЛБООС, ЭРҮҮНИЙ ҮЕ, УТТС, УРУУЛ */}
          <section
            style={{
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              padding: 12,
              background: "#ffffff",
              fontSize: 13,
              marginBottom: 16,
            }}
          >
            {/* ЗУРШИЛ */}
            <div style={{ fontWeight: 700, marginBottom: 4 }}>ЗУРШИЛ</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div>
                <span style={{ width: 90, display: "inline-block" }}>
                  Зуршил:
                </span>
                <label style={{ marginRight: 12 }}>
                  <input
                    type="checkbox"
                    checked={!!habits.tongueThrust}
                    onChange={() => toggleHabitBool("tongueThrust")}
                    style={{ marginRight: 4 }}
                  />
                  Хэлээр түлхэх
                </label>
                <label style={{ marginRight: 12 }}>
                  <input
                    type="checkbox"
                    checked={!!habits.lipNailBite}
                    onChange={() => toggleHabitBool("lipNailBite")}
                    style={{ marginRight: 4 }}
                  />
                  Уруул, хумс мэрэх
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={!!habits.fingerSucking}
                    onChange={() => toggleHabitBool("fingerSucking")}
                    style={{ marginRight: 4 }}
                  />
                  Хуруу хөхөх
                </label>
              </div>

              <div>
                <span style={{ width: 90, display: "inline-block" }}>
                  Амьсгалалт:
                </span>
                <label style={{ marginRight: 12 }}>
                  <input
                    type="checkbox"
                    checked={!!habits.breathingMouth}
                    onChange={() => toggleHabitBool("breathingMouth")}
                    style={{ marginRight: 4 }}
                  />
                  Амаар
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={!!habits.breathingNose}
                    onChange={() => toggleHabitBool("breathingNose")}
                    style={{ marginRight: 4 }}
                  />
                  Хамраар
                </label>
              </div>

              <div>
                <span style={{ width: 90, display: "inline-block" }}>
                  Залгилт:
                </span>
                <label style={{ marginRight: 12 }}>
                  <input
                    type="checkbox"
                    checked={!!habits.swallowNormal}
                    onChange={() => toggleHabitBool("swallowNormal")}
                    style={{ marginRight: 4 }}
                  />
                  Хэвийн
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={!!habits.swallowAbnormal}
                    onChange={() => toggleHabitBool("swallowAbnormal")}
                    style={{ marginRight: 4 }}
                  />
                  Хэвийн бус
                </label>
              </div>

              <div>
                <span style={{ width: 90, display: "inline-block" }}>
                  Бусад:
                </span>
                <input
                  type="text"
                  value={habits.other || ""}
                  onChange={(e) => updateHabitText("other", e.target.value)}
                  style={{
                    width: "60%",
                    borderRadius: 6,
                    border: "1px solid #d1d5db",
                    padding: "3px 6px",
                  }}
                />
              </div>
            </div>

            {/* ХОЛБООС */}
            <div
              style={{
                fontWeight: 700,
                marginTop: 12,
                marginBottom: 4,
              }}
            >
              ХОЛБООС
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div>
                <span style={{ width: 90, display: "inline-block" }}>
                  АХЭА:
                </span>
                <label style={{ marginRight: 12 }}>
                  <input
                    type="checkbox"
                    checked={!!attachment.aheaGood}
                    onChange={() => toggleAttachmentBool("aheaGood")}
                    style={{ marginRight: 4 }}
                  />
                  Сайн
                </label>
                <label style={{ marginRight: 12 }}>
                  <input
                    type="checkbox"
                    checked={!!attachment.aheaMedium}
                    onChange={() => toggleAttachmentBool("aheaMedium")}
                    style={{ marginRight: 4 }}
                  />
                  Дунд
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={!!attachment.aheaPoor}
                    onChange={() => toggleAttachmentBool("aheaPoor")}
                    style={{ marginRight: 4 }}
                  />
                  Муу
                </label>
              </div>

              <div>
                <span style={{ width: 130, display: "inline-block" }}>
                  Буйлны үрэвсэл:
                </span>
                <label style={{ marginRight: 12 }}>
                  <input
                    type="checkbox"
                    checked={!!attachment.gingivitis}
                    onChange={() => toggleAttachmentBool("gingivitis")}
                    style={{ marginRight: 4 }}
                  />
                  Тийм
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={!!attachment.gingivitisNo}
                    onChange={() => toggleAttachmentBool("gingivitisNo")}
                    style={{ marginRight: 4 }}
                  />
                  Үгүй
                </label>
              </div>

              <div>
                <span style={{ width: 130, display: "inline-block" }}>
                  Холбоосын үрэвсэл:
                </span>
                <label style={{ marginRight: 12 }}>
                  <input
                    type="checkbox"
                    checked={!!attachment.frenumInflammation}
                    onChange={() =>
                      toggleAttachmentBool("frenumInflammation")
                    }
                    style={{ marginRight: 4 }}
                  />
                  Тийм
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={!!attachment.frenumInflammationNo}
                    onChange={() =>
                      toggleAttachmentBool("frenumInflammationNo")
                    }
                    style={{ marginRight: 4 }}
                  />
                  Үгүй
                </label>
              </div>
            </div>

            {/* ЭРҮҮНИЙ ҮЕ */}
            <div
              style={{
                fontWeight: 700,
                marginTop: 12,
                marginBottom: 4,
              }}
            >
              ЭРҮҮНИЙ ҮЕ
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div>
                <span style={{ width: 190, display: "inline-block" }}>
                  Өмнө өвдөж байсан эсэх:
                </span>
                <label style={{ marginRight: 12 }}>
                  <input
                    type="checkbox"
                    checked={!!tmj.previousPainYes}
                    onChange={() => toggleTmjBool("previousPainYes")}
                    style={{ marginRight: 4 }}
                  />
                  Тийм
                </label>
                <label style={{ marginRight: 12 }}>
                  <input
                    type="checkbox"
                    checked={!!tmj.previousPainNo}
                    onChange={() => toggleTmjBool("previousPainNo")}
                    style={{ marginRight: 4 }}
                  />
                  Үгүй
                </label>
                <label style={{ marginRight: 12 }}>
                  <input
                    type="checkbox"
                    checked={!!tmj.asymptomatic}
                    onChange={() => toggleTmjBool("asymptomatic")}
                    style={{ marginRight: 4 }}
                  />
                  Asymptomatic
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={!!tmj.symptomatic}
                    onChange={() => toggleTmjBool("symptomatic")}
                    style={{ marginRight: 4 }}
                  />
                  Symptomatic
                </label>
              </div>

              <div>
                <span style={{ width: 60, display: "inline-block" }}>
                  Дуу:
                </span>
                <label style={{ marginRight: 12 }}>
                  <input
                    type="checkbox"
                    checked={!!tmj.soundRight}
                    onChange={() => toggleTmjBool("soundRight")}
                    style={{ marginRight: 4 }}
                  />
                  Баруун
                </label>
                <label style={{ marginRight: 32 }}>
                  <input
                    type="checkbox"
                    checked={!!tmj.soundLeft}
                    onChange={() => toggleTmjBool("soundLeft")}
                    style={{ marginRight: 4 }}
                  />
                  Зүүн
                </label>

                <span style={{ width: 80, display: "inline-block" }}>
                  Өвдөлт:
                </span>
                <label style={{ marginRight: 12 }}>
                  <input
                    type="checkbox"
                    checked={!!tmj.painRight}
                    onChange={() => toggleTmjBool("painRight")}
                    style={{ marginRight: 4 }}
                  />
                  Баруун
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={!!tmj.painLeft}
                    onChange={() => toggleTmjBool("painLeft")}
                    style={{ marginRight: 4 }}
                  />
                  Зүүн
                </label>
              </div>

              <div>
                <span style={{ width: 120, display: "inline-block" }}>
                  Толгой өвдөлт:
                </span>
                <label style={{ marginRight: 12 }}>
                  <input
                    type="checkbox"
                    checked={!!tmj.headacheYes}
                    onChange={() => toggleTmjBool("headacheYes")}
                    style={{ marginRight: 4 }}
                  />
                  Тийм
                </label>
                <label style={{ marginRight: 32 }}>
                  <input
                    type="checkbox"
                    checked={!!tmj.headacheNo}
                    onChange={() => toggleTmjBool("headacheNo")}
                    style={{ marginRight: 4 }}
                  />
                  Үгүй
                </label>

                <span style={{ width: 150, display: "inline-block" }}>
                  Булчингийн чангарал:
                </span>
                <label style={{ marginRight: 12 }}>
                  <input
                    type="checkbox"
                    checked={!!tmj.muscleTensionYes}
                    onChange={() => toggleTmjBool("muscleTensionYes")}
                    style={{ marginRight: 4 }}
                  />
                  Тийм
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={!!tmj.muscleTensionNo}
                    onChange={() => toggleTmjBool("muscleTensionNo")}
                    style={{ marginRight: 4 }}
                  />
                  Үгүй
                </label>
              </div>

              <div>
                <span style={{ width: 120, display: "inline-block" }}>
                  Ам ангайллт:
                </span>
                <label style={{ marginRight: 12 }}>
                  <input
                    type="checkbox"
                    checked={!!tmj.mouthOpeningNormal}
                    onChange={() => toggleTmjBool("mouthOpeningNormal")}
                    style={{ marginRight: 4 }}
                  />
                  Хэвийн
                </label>
                <label style={{ marginRight: 32 }}>
                  <input
                    type="checkbox"
                    checked={!!tmj.mouthOpeningLimited}
                    onChange={() => toggleTmjBool("mouthOpeningLimited")}
                    style={{ marginRight: 4 }}
                  />
                  Хязгаарлагдсан
                </label>

                <span style={{ width: 150, display: "inline-block" }}>
                  Max. ам ангайллт:
                </span>
                <input
                  type="text"
                  value={tmj.maxMouthOpeningMm || ""}
                  onChange={(e) =>
                    updateTmjText("maxMouthOpeningMm", e.target.value)
                  }
                  style={{
                    width: 70,
                    borderRadius: 4,
                    border: "1px solid #d1d5db",
                    padding: "2px 4px",
                    fontSize: 12,
                    marginRight: 4,
                  }}
                />
                мм
              </div>
            </div>

            {/* УТТС */}
            <div
              style={{
                fontWeight: 700,
                marginTop: 12,
                marginBottom: 4,
              }}
            >
              УТТС
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div>
                <label style={{ marginRight: 12 }}>
                  <input
                    type="checkbox"
                    checked={!!utts.lipCleft}
                    onChange={() => toggleUttsBool("lipCleft")}
                    style={{ marginRight: 4 }}
                  />
                  Уруулын сэтэрхий
                </label>
                <label style={{ marginRight: 12 }}>
                  <input
                    type="checkbox"
                    checked={!!utts.palateCleft}
                    onChange={() => toggleUttsBool("palateCleft")}
                    style={{ marginRight: 4 }}
                  />
                  Тагнайн сэтэрхий
                </label>
                <label style={{ marginRight: 8 }}>
                  <input
                    type="checkbox"
                    checked={!!utts.unilateral}
                    onChange={() => toggleUttsBool("unilateral")}
                    style={{ marginRight: 4 }}
                  />
                  Нэг талын (Б/З):
                </label>
                <input
                  type="text"
                  value={utts.unilateralSide || ""}
                  onChange={(e) =>
                    updateUttsText("unilateralSide", e.target.value)
                  }
                  style={{
                    width: 60,
                    borderRadius: 4,
                    border: "1px solid #d1d5db",
                    padding: "2px 4px",
                    fontSize: 12,
                  }}
                />
              </div>

              <div>
                <label style={{ marginRight: 16 }}>
                  <input
                    type="checkbox"
                    checked={!!utts.bilateral}
                    onChange={() => toggleUttsBool("bilateral")}
                    style={{ marginRight: 4 }}
                  />
                  Хоёр талын
                </label>
                <span style={{ marginRight: 4 }}>Бусад</span>
                <input
                  type="text"
                  value={utts.otherText || ""}
                  onChange={(e) =>
                    updateUttsText("otherText", e.target.value)
                  }
                  style={{
                    width: "55%",
                    borderRadius: 4,
                    border: "1px solid #d1d5db",
                    padding: "2px 4px",
                    fontSize: 12,
                  }}
                />
              </div>
            </div>

            {/* УРУУЛ */}
            <div
              style={{
                fontWeight: 700,
                marginTop: 12,
                marginBottom: 4,
              }}
            >
              УРУУЛ
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div>
                <label style={{ marginRight: 12 }}>
                  <input
                    type="checkbox"
                    checked={!!lip.closed}
                    onChange={() => toggleLipBool("closed")}
                    style={{ marginRight: 4 }}
                  />
                  Нийлсэн
                </label>
                <label style={{ marginRight: 24 }}>
                  <input
                    type="checkbox"
                    checked={!!lip.open}
                    onChange={() => toggleLipBool("open")}
                    style={{ marginRight: 4 }}
                  />
                  Нийлээгүй
                </label>
                <span style={{ marginRight: 4 }}>rest lip</span>
                <input
                  type="text"
                  value={lip.restLipMm || ""}
                  onChange={(e) =>
                    updateLipText("restLipMm", e.target.value)
                  }
                  style={{
                    width: 60,
                    borderRadius: 4,
                    border: "1px solid #d1d5db",
                    padding: "2px 4px",
                    fontSize: 12,
                    marginRight: 4,
                  }}
                />
                мм
              </div>
              <div>
                <span style={{ marginRight: 8 }}>smiling</span>
                <input
                  type="text"
                  value={lip.smilingMm || ""}
                  onChange={(e) =>
                    updateLipText("smilingMm", e.target.value)
                  }
                  style={{
                    width: 60,
                    borderRadius: 4,
                    border: "1px solid #d1d5db",
                    padding: "2px 4px",
                    fontSize: 12,
                    marginRight: 4,
                  }}
                />
                мм
              </div>
            </div>
          </section>

          {/* Odontogram + legend */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 2.2fr) minmax(230px, 1fr)",
              gap: 16,
              alignItems: "flex-start",
            }}
          >
            <div>
              <FullArchDiscOdontogram
                value={toothChart}
                onChange={setToothChart}
                activeStatus={activeStatus}
              />
            </div>

            <aside
              style={{
                borderRadius: 10,
                border: "1px solid #e5e7eb",
                padding: 12,
                background: "#f9fafb",
                fontSize: 12,
              }}
            >
              <div style={{ fontWeight: 500, marginBottom: 8 }}>
                Тэмдэглэгээ / Үйлдэл сонгох
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  marginBottom: 8,
                }}
              >
                {STATUS_BUTTONS.map((s) => {
                  const isActive = activeStatus === s.key;
                  return (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() =>
                        setActiveStatus((prev) =>
                          prev === s.key ? null : s.key
                        )
                      }
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "4px 8px",
                        borderRadius: 999,
                        border: isActive
                          ? `2px solid ${s.color}`
                          : "1px solid #d1d5db",
                        background: isActive ? "#ffffff" : "#f3f4f6",
                        cursor: "pointer",
                        fontSize: 12,
                      }}
                    >
                      <span>{s.label}</span>
                      <span
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: 999,
                          backgroundColor: s.color,
                          display: "inline-block",
                        }}
                      />
                    </button>
                  );
                })}
              </div>

              {activeStatus === "supernumerary" && (
                <div
                  style={{
                    marginTop: 4,
                    paddingTop: 6,
                    borderTop: "1px dashed #e5e7eb",
                  }}
                >
                  <div style={{ fontSize: 12, marginBottom: 2 }}>
                    Илүү шүдний байрлал / тайлбар:
                  </div>
                  <input
                    value={extraToothText}
                    onChange={(e) => setExtraToothText(e.target.value)}
                    placeholder='Жишээ: "баруун дээд, 3 дахь шүдний дотор"'
                    style={{
                      width: "100%",
                      borderRadius: 6,
                      border: "1px solid #d1d5db",
                      padding: "4px 6px",
                      fontSize: 12,
                    }}
                  />
                </div>
              )}
            </aside>
          </div>

          {/* MODEL MEASUREMENTS (ЗАГВАР ХЭМЖИЛ) – Sum of incisors + Bolton + Howes */}
          <section
            style={{
              marginTop: 16,
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              padding: 12,
              background: "#ffffff",
              fontSize: 13,
            }}
          >
            <div
              style={{
                fontWeight: 700,
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              ЗАГВАР ХЭМЖИЛЗҮЙ
            </div>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>
              Sum of incisor
            </div>

            {/* Upper incisors */}
            <div style={{ marginBottom: 8 }}>
              <div style={{ marginBottom: 4, fontWeight: 500 }}>
                Дээд үүдэн шүд (U1)
              </div>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  alignItems: "center",
                }}
              >
                <span>12:</span>
                <input
                  type="text"
                  value={sumOfIncisorInputs.u12}
                  onChange={(e) =>
                    updateSumOfIncisor("u12", e.target.value)
                  }
                  style={{
                    width: 60,
                    borderRadius: 6,
                    border: "1px solid #d1d5db",
                    padding: "4px 6px",
                  }}
                />
                <span>11:</span>
                <input
                  type="text"
                  value={sumOfIncisorInputs.u11}
                  onChange={(e) =>
                    updateSumOfIncisor("u11", e.target.value)
                  }
                  style={{
                    width: 60,
                    borderRadius: 6,
                    border: "1px solid #d1d5db",
                    padding: "4px 6px",
                  }}
                />
                <span>21:</span>
                <input
                  type="text"
                  value={sumOfIncisorInputs.u21}
                  onChange={(e) =>
                    updateSumOfIncisor("u21", e.target.value)
                  }
                  style={{
                    width: 60,
                    borderRadius: 6,
                    border: "1px solid #d1d5db",
                    padding: "4px 6px",
                  }}
                />
                <span>22:</span>
                <input
                  type="text"
                  value={sumOfIncisorInputs.u22}
                  onChange={(e) =>
                    updateSumOfIncisor("u22", e.target.value)
                  }
                  style={{
                    width: 60,
                    borderRadius: 6,
                    border: "1px solid #d1d5db",
                    padding: "4px 6px",
                  }}
                />
                <span style={{ marginLeft: 12 }}>
                  U1 сум ={" "}
                  <span style={{ fontWeight: 700 }}>
                    {u1Sum.toFixed(2)}
                  </span>{" "}
                  мм
                </span>
              </div>
            </div>

            {/* Lower incisors */}
            <div>
              <div style={{ marginBottom: 4, fontWeight: 500 }}>
                Доод үүдэн шүд (L1)
              </div>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  alignItems: "center",
                }}
              >
                <span>32:</span>
                <input
                  type="text"
                  value={sumOfIncisorInputs.l32}
                  onChange={(e) =>
                    updateSumOfIncisor("l32", e.target.value)
                  }
                  style={{
                    width: 60,
                    borderRadius: 6,
                    border: "1px solid #d1d5db",
                    padding: "4px 6px",
                  }}
                />
                <span>31:</span>
                <input
                  type="text"
                  value={sumOfIncisorInputs.l31}
                  onChange={(e) =>
                    updateSumOfIncisor("l31", e.target.value)
                  }
                  style={{
                    width: 60,
                    borderRadius: 6,
                    border: "1px solid #d1d5db",
                    padding: "4px 6px",
                  }}
                />
                <span>41:</span>
                <input
                  type="text"
                  value={sumOfIncisorInputs.l41}
                  onChange={(e) =>
                    updateSumOfIncisor("l41", e.target.value)
                  }
                  style={{
                    width: 60,
                    borderRadius: 6,
                    border: "1px solid #d1d5db",
                    padding: "4px 6px",
                  }}
                />
                <span>42:</span>
                <input
                  type="text"
                  value={sumOfIncisorInputs.l42}
                  onChange={(e) =>
                    updateSumOfIncisor("l42", e.target.value)
                  }
                  style={{
                    width: 60,
                    borderRadius: 6,
                    border: "1px solid #d1d5db",
                    padding: "4px 6px",
                  }}
                />
                <span style={{ marginLeft: 12 }}>
                  L1 сум ={" "}
                  <span style={{ fontWeight: 700 }}>
                    {l1Sum.toFixed(2)}
                  </span>{" "}
                  мм
                </span>
              </div>
            </div>

            {/* U1 : L1 ratio */}
            <div
              style={{
                marginTop: 12,
                marginBottom: 16,
                fontSize: 13,
                color: "#111827",
              }}
            >
              U1 : L1 харьцаа (лавлагаа болгон):{" "}
              {u1l1Ratio ? (
                <span style={{ fontWeight: 700 }}>{u1l1Ratio} : 1</span>
              ) : (
                "-"
              )}
            </div>

            {/* Bolton index */}
            <div style={{ fontWeight: 600, marginBottom: 8 }}>
              Bolton Index
            </div>

            {/* 6) */}
            <div style={{ marginBottom: 10 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 4,
                  flexWrap: "wrap",
                }}
              >
                <span>6)</span>
                <span>дээд</span>
                {boltonInputs.upper6.map((val, i) => (
                  <input
                    key={`u6-${i}`}
                    type="text"
                    value={val}
                    onChange={(e) => updateBoltonUpper6(i, e.target.value)}
                    style={{
                      width: 60,
                      borderRadius: 6,
                      border: "1px solid #d1d5db",
                      padding: "4px 6px",
                    }}
                  />
                ))}
                <span style={{ marginLeft: 8 }}>
                  Σ ={" "}
                  <span style={{ fontWeight: 700 }}>
                    {upper6Sum.toFixed(2)}
                  </span>
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <span style={{ width: 24 }} />
                <span>доод</span>
                {boltonInputs.lower6.map((val, i) => (
                  <input
                    key={`l6-${i}`}
                    type="text"
                    value={val}
                    onChange={(e) => updateBoltonLower6(i, e.target.value)}
                    style={{
                      width: 60,
                      borderRadius: 6,
                      border: "1px solid #d1d5db",
                      padding: "4px 6px",
                    }}
                  />
                ))}
                <span style={{ marginLeft: 8 }}>
                  Σ ={" "}
                  <span style={{ fontWeight: 700 }}>
                    {lower6Sum.toFixed(2)}
                  </span>
                </span>
              </div>
            </div>

            {/* 12) */}
            <div style={{ marginBottom: 10 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 4,
                  flexWrap: "wrap",
                }}
              >
                <span>12)</span>
                <span>дээд</span>
                {boltonInputs.upper12.map((val, i) => (
                  <input
                    key={`u12-${i}`}
                    type="text"
                    value={val}
                    onChange={(e) =>
                      updateBoltonUpper12(i, e.target.value)
                    }
                    style={{
                      width: 60,
                      borderRadius: 6,
                      border: "1px solid #d1d5db",
                      padding: "4px 6px",
                    }}
                  />
                ))}
                <span style={{ marginLeft: 8 }}>
                  Σ ={" "}
                  <span style={{ fontWeight: 700 }}>
                    {upper12Sum.toFixed(2)}
                  </span>
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <span style={{ width: 28 }} />
                <span>доод</span>
                {boltonInputs.lower12.map((val, i) => (
                  <input
                    key={`l12-${i}`}
                    type="text"
                    value={val}
                    onChange={(e) =>
                      updateBoltonLower12(i, e.target.value)
                    }
                    style={{
                      width: 60,
                      borderRadius: 6,
                      border: "1px solid #d1d5db",
                      padding: "4px 6px",
                    }}
                  />
                ))}
                <span style={{ marginLeft: 8 }}>
                  Σ ={" "}
                  <span style={{ fontWeight: 700 }}>
                    {lower12Sum.toFixed(2)}
                  </span>
                </span>
              </div>
            </div>

            {/* Bolton summary */}
            <div style={{ fontSize: 13, marginTop: 4, marginBottom: 12 }}>
              6 = 78.1% (
              <span style={{ fontWeight: 600 }}>
                {bolton6Result || ""}
              </span>
              ){" "}
              <span style={{ marginLeft: 24 }}>
                12 = 91.4% (
                <span style={{ fontWeight: 600 }}>
                  {bolton12Result || ""}
                </span>
                )
              </span>
            </div>

            {/* Howes' Ax */}
            <div style={{ fontWeight: 600, marginBottom: 8 }}>
              Howes&apos; AX
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 6,
                fontSize: 13,
              }}
            >
              <span>Howes AX (%) =</span>
              <span>PMBAW</span>
              <input
                type="text"
                value={howesInputs.pmbaw || ""}
                onChange={(e) => updateHowes("pmbaw", e.target.value)}
                style={{
                  width: 80,
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                  padding: "4px 6px",
                }}
              />
              <span>/ TM</span>
              <input
                type="text"
                value={howesInputs.tm || ""}
                onChange={(e) => updateHowes("tm", e.target.value)}
                style={{
                  width: 80,
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                  padding: "4px 6px",
                }}
              />
              <span>× 100 =</span>
              <span
                style={{
                  minWidth: 60,
                  fontWeight: 700,
                }}
              >
                {howesResult ? `${howesResult} %` : ""}
              </span>
            </div>
            {howesCategory.label && (
              <div
                style={{
                  marginTop: 6,
                  fontSize: 12,
                  color: howesCategory.color,
                  fontWeight: 600,
                }}
              >
                {howesCategory.label}
              </div>
            )}
          </section>

          {/* TOTAL DISCREPANCY */}
          <section
            style={{
              marginTop: 16,
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              padding: 12,
              background: "#ffffff",
              fontSize: 13,
            }}
          >
            <div
              style={{
                fontWeight: 700,
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              TOTAL DISCREPANCY
            </div>

            {/* Row 1: ALD -> Mid line -> Curve of spee -> Expansion */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 24,
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              {[
                { key: "ald" as AxisKey, label: "ALD" },
                { key: "midline" as AxisKey, label: "Mid line" },
                { key: "curveOfSpee" as AxisKey, label: "Curve of spee" },
                { key: "expansion" as AxisKey, label: "Expansion" },
              ].map(({ key, label }, index, arr) => {
                const axis = discrepancyInputs[key];
                const isLast = index === arr.length - 1;
                return (
                  <div
                    key={key}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    {renderAxis(key as Exclude<AxisKey, "total">, label, axis)}
                    {!isLast && <Arrow />}
                  </div>
                );
              })}
            </div>

            {/* Row 2: FMIA/A-B -> Overjet -> Total discrepancy */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 24,
                alignItems: "center",
              }}
            >
              {[
                { key: "fmiaABPlane" as AxisKey, label: "FMIA / A-B plane" },
                { key: "overjet" as AxisKey, label: "Overjet" },
              ].map(({ key, label }, index, arr) => {
                const axis = discrepancyInputs[key];
                const isLastAxis = index === arr.length - 1;
                return (
                  <div
                    key={key}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    {renderAxis(key as Exclude<AxisKey, "total">, label, axis)}
                    {!isLastAxis && <Arrow />}
                  </div>
                );
              })}

              {/* Arrow to Total discrepancy */}
              <Arrow />

              {/* Total discrepancy block */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  fontSize: 12,
                }}
              >
                <div style={{ marginBottom: 4, fontWeight: 600 }}>
                  Total discrepancy
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      justifyContent: "center",
                    }}
                  >
                    <div
                      style={{
                        ...uniformTotalBoxBase,
                        textAlign: "left",
                      }}
                    >
                      {totalAxis.upperLeft}
                    </div>
                    <div
                      style={{
                        ...uniformTotalBoxBase,
                        textAlign: "right",
                      }}
                    >
                      {totalAxis.upperRight}
                    </div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      justifyContent: "center",
                    }}
                  >
                    <div
                      style={{
                        ...uniformTotalBoxBase,
                        textAlign: "left",
                      }}
                    >
                      {totalAxis.lowerLeft}
                    </div>
                    <div
                      style={{
                        ...uniformTotalBoxBase,
                        textAlign: "right",
                      }}
                    >
                      {totalAxis.lowerRight}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Actions */}
          <div
            style={{
              marginTop: 16,
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
            }}
          >
            <button
              type="button"
              onClick={() => router.back()}
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                border: "1px solid #d1d5db",
                background: "#f9fafb",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Буцах
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                border: "none",
                background: saving ? "#9ca3af" : "#2563eb",
                color: "#ffffff",
                fontSize: 13,
                cursor: saving ? "default" : "pointer",
              }}
            >
              {saving ? "Хадгалж байна..." : "Карт хадгалах"}
            </button>
          </div>
        </section>
      )}
    </main>
  );
}




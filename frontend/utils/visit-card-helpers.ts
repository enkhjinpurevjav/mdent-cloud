// Visit card utilities

import type { VisitCard, WarningLine } from "../types/encounter-admin";

export function extractWarningLinesFromVisitCard(
  visitCard: VisitCard | null
): WarningLine[] {
  if (!visitCard || !visitCard.answers) return [];
  const a = visitCard.answers;
  const lines: WarningLine[] = [];

  const generalMedicalLabels: Record<string, string> =
    visitCard.type === "CHILD"
      ? {
          heartDisease: "Зүрх судасны өвчинтэй эсэх",
          highBloodPressure: "Даралт ихсэх өвчинтэй эсэх",
          infectiousDisease: "Халдварт өвчинтэй эсэх",
          tuberculosis: "Сүрьеэ өвчнөөр өвчилж байсан эсэх",
          hepatitisBC: "Халдварт гепатит В, С-ээр өвдөж байсан эсэх",
          diabetes: "Чихрийн шижинтэй эсэх",
          onMedication: "Одоо хэрэглэж байгаа эм, тариа байгаа эсэх",
          seriousIllnessOrSurgery:
            "Ойрын 5 жилд хүнд өвчнөөр өвчилсөн болон мэс ажилбарт орж байсан эсэх",
          implant: "Зүрхний импланттай эсэх",
          generalAnesthesia: "Бүтэн наркоз хийлгэж байсан эсэх",
          chemoOrRadiation: "Химийн/ туяа эмчилгээ хийлгэж байгаа эсэх",
        }
      : {
          heartDisease: "Зүрх судасны өвчтэй эсэх",
          highBloodPressure: "Даралт ихсэх өвчтэй эсэх",
          infectiousDisease: "Халдварт өвчний түүхтэй эсэх",
          tuberculosis: "Сүрьеэ өвчнөөр өвчилж байсан эсэх",
          hepatitisBC:
            "Халдварт гепатит B, C‑сээр өвдөж байсан эсэх",
          diabetes: "Чихрийн шижинтэй эсэх",
          onMedication: "Одоо хэрэглэж байгаа эм, тариа байгаа эсэх",
          seriousIllnessOrSurgery:
            "Ойрын 5 жилд хүнд өвчнөөр өвчилсөн болон мэс ажилбар хийлгэж байсан эсэх",
          implant: "Зүрхний импланттай эсэх",
          generalAnesthesia: "Бүтэн наркоз хийлгэж байсан эсэх",
          chemoOrRadiation: "Хими / туяа эмчилгээ хийлгэж байгаа эсэх",
        };

  if (a.generalMedical) {
    Object.keys(generalMedicalLabels).forEach((key) => {
      const v = (a.generalMedical as any)[key];
      if (v === "yes") {
        const label = generalMedicalLabels[key];
        const detailKey = `${key}Detail`;
        const detail =
          (a.generalMedical as any)[detailKey] ||
          (a.generalMedical as any).details ||
          "";
        const tail = detail ? `Тийм - ${detail}` : "Тийм";
        lines.push({ label, value: tail });
      }
    });

    if ((a.generalMedical as any).pregnant === "yes") {
      lines.push({
        label: "Жирэмсэн эсэх",
        value: "Тийм",
      });
    }
    if ((a.generalMedical as any).childAllergyFood === "yes") {
      lines.push({
        label: "Хүүхэд хүнсний харшилтай эсэх",
        value: "Тийм",
      });
    }
  }

  if (a.allergies) {
    const allergyLabels: Record<string, string> = {
      drug: "Харшил - Эм тариа",
      metal: "Харшил - Метал",
      localAnesthetic: "Харшил - Шүдний мэдээ алдуулах тариа",
      latex: "Харшил - Латекс",
      other: "Харшил - Бусад",
    };

    (["drug", "metal", "localAnesthetic", "latex", "other"] as const).forEach(
      (key) => {
        const v = (a.allergies as any)[key];
        if (v === "yes") {
          const label = allergyLabels[key];
          const detailKey =
            key === "other" ? "otherDetail" : `${key}Detail`;
          const detail = (a.allergies as any)[detailKey] || "";
          const tail = detail ? `Тийм - ${detail}` : "Тийм";
          lines.push({ label, value: tail });
        }
      }
    );
  }

  if (a.habits) {
    const habitLabelsAdult: Record<string, string> = {
      smoking: "Зуршил - Тамхи татдаг эсэх",
      alcohol: "Зуршил - Архи хэрэглэдэг эсэх",
      coffee: "Зуршил - Кофе хэрэглэдэг эсэх",
      nightGrinding: "Шөнө шүдээ хавирдаг эсэх",
      mouthBreathing: "Ам ангайж унтдаг / амаар амьсгалдаг эсэх",
      other: "Зуршил - Бусад",
    };

    const habitLabelsChild: Record<string, string> = {
      mouthBreathing: "Хэл, хуруу хөхдөг эсэх",
      nightGrinding: "Шөнө амаа ангайж унтдаг эсэх",
      other: "Зуршил - Бусад",
    };

    const labels =
      visitCard.type === "CHILD" ? habitLabelsChild : habitLabelsAdult;

    Object.keys(labels).forEach((key) => {
      const v = (a.habits as any)[key];
      if (v === "yes") {
        const label = labels[key];
        const detailKey =
          key === "other" ? "otherDetail" : `${key}Detail`;
        const detail = (a.habits as any)[detailKey] || "";
        const tail = detail ? `Тийм - ${detail}` : "Тийм";
        lines.push({ label, value: tail });
      }
    });
  }

  if (a.dentalFollowup) {
    const dentalLabels: Record<string, string> = {
      regularCheckups: "Шүдний эмчид байнга үзүүлдэг эсэх",
      bleedingAfterExtraction:
        "Шүд авахуулсны дараа цус тогтол удаан эсэх",
      gumBleeding: "Буйлнаас цус гардаг эсэх",
      badBreath: "Амнаас эвгүй үнэр гардаг эсэх",
    };

    Object.keys(dentalLabels).forEach((key) => {
      const v = (a.dentalFollowup as any)[key];
      if (v === "yes") {
        const label = dentalLabels[key];
        const detailKey = `${key}Detail`;
        const detail = (a.dentalFollowup as any)[detailKey] || "";
        const tail = detail ? `Тийм - ${detail}` : "Тийм";
        lines.push({ label, value: tail });
      }
    });
  }

  return lines;
}

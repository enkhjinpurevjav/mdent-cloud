// Parse Mongolian registration number (РД) -> birthDate + gender
// Rules confirmed in chat:
// - Format: 2 letters + 8 digits, digits = YYMMDDSS
// - If MM 01..12 => 1900s: year = 19YY, month=MM
// - If MM 21..32 => 2000s: year = 20YY, month=MM-20
// - Gender digit: 2nd from last digit overall (tens digit of SS)
//     odd => male ("эр"), even including 0 => female ("эм")

function normalizeRegNo(input) {
  if (input == null) return null;
  return String(input).trim().toUpperCase();
}

export function parseRegNo(regNoRaw) {
  const regNo = normalizeRegNo(regNoRaw);
  if (!regNo) {
    return { isValid: false, reason: "regNo is required" };
  }

  // 2 letters + 8 digits (total 10)
  // Letters are Mongolian Cyrillic; easiest is: first 2 chars non-digits + 8 digits
  const m = regNo.match(/^(\D{2})(\d{8})$/);
  if (!m) {
    return {
      isValid: false,
      reason: "regNo must be 2 letters + 8 digits",
    };
  }

  const digits = m[2]; // YYMMDDSS
  const yy = Number(digits.slice(0, 2));
  const mmRaw = Number(digits.slice(2, 4));
  const dd = Number(digits.slice(4, 6));
  const ss = digits.slice(6, 8);

  if (Number.isNaN(yy) || Number.isNaN(mmRaw) || Number.isNaN(dd)) {
    return { isValid: false, reason: "Invalid numeric parts" };
  }

  let year;
  let month;

  if (mmRaw >= 1 && mmRaw <= 12) {
    year = 1900 + yy;
    month = mmRaw;
  } else if (mmRaw >= 21 && mmRaw <= 32) {
    year = 2000 + yy;
    month = mmRaw - 20;
  } else {
    return {
      isValid: false,
      reason: "Invalid month encoding in regNo",
    };
  }

  // Validate actual calendar date
  // Create date in UTC to avoid timezone shifting issues.
  const birthDate = new Date(Date.UTC(year, month - 1, dd));
  if (
    birthDate.getUTCFullYear() !== year ||
    birthDate.getUTCMonth() !== month - 1 ||
    birthDate.getUTCDate() !== dd
  ) {
    return { isValid: false, reason: "Invalid date in regNo" };
  }

  // Gender from 2nd-from-last digit (tens digit of SS)
  const genderDigit = Number(ss[0]); // tens digit
  if (Number.isNaN(genderDigit)) {
    return { isValid: false, reason: "Invalid gender digit in regNo" };
  }

  const gender = genderDigit % 2 === 1 ? "эр" : "эм";

  // Return birthDate as YYYY-MM-DD for frontend
  const yyyy = String(year).padStart(4, "0");
  const mm = String(month).padStart(2, "0");
  const ddStr = String(dd).padStart(2, "0");

  return {
    isValid: true,
    reason: null,
    birthDate: `${yyyy}-${mm}-${ddStr}`,
    gender,
  };
}

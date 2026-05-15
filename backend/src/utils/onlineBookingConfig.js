const DEFAULT_ONLINE_BOOKING_DEPOSIT_AMOUNT = 30_000;

export function getOnlineBookingDepositAmount() {
  const raw = process.env.ONLINE_BOOKING_DEPOSIT_AMOUNT;
  if (raw === undefined || raw === null || raw === "") {
    return DEFAULT_ONLINE_BOOKING_DEPOSIT_AMOUNT;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_ONLINE_BOOKING_DEPOSIT_AMOUNT;
  }

  return Math.floor(parsed);
}

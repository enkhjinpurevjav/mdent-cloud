const ONLINE_BOOKING_DEPOSIT_METHOD_KEY = "ONLINE_BOOKING_DEPOSIT";
const ONLINE_BOOKING_DEPOSIT_LABEL = "онлайн цаг захиалга";
const ONLINE_BOOKING_DEPOSIT_SORT_ORDER = 65;

/**
 * Ensure dedicated online booking deposit method exists and is active.
 * This keeps billing payment settings consistent across environments.
 */
export async function ensureOnlineBookingDepositPaymentMethod(prismaClient) {
  if (!prismaClient?.paymentMethodConfig) return;

  await prismaClient.paymentMethodConfig.upsert({
    where: { key: ONLINE_BOOKING_DEPOSIT_METHOD_KEY },
    create: {
      key: ONLINE_BOOKING_DEPOSIT_METHOD_KEY,
      label: ONLINE_BOOKING_DEPOSIT_LABEL,
      isActive: true,
      sortOrder: ONLINE_BOOKING_DEPOSIT_SORT_ORDER,
    },
    update: {
      label: ONLINE_BOOKING_DEPOSIT_LABEL,
      isActive: true,
      sortOrder: ONLINE_BOOKING_DEPOSIT_SORT_ORDER,
    },
  });
}


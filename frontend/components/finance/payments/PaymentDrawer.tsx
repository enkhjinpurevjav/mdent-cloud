import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import ReversePaymentModal from "./ReversePaymentModal";
import {
  fmtMnt,
  formatPaymentDateTime,
  formatPaymentMethod,
  formatPaymentScheduleDateTime,
  formatPaymentStatus,
  formatPersonName,
} from "./formatters";
import type { PaymentDetail } from "./types";

type Props = {
  paymentId: number | null;
  open: boolean;
  canReverse: boolean;
  refreshSignal: number;
  onClose: () => void;
  onDataChanged: () => void;
};

export default function PaymentDrawer({
  paymentId,
  open,
  canReverse,
  refreshSignal,
  onClose,
  onDataChanged,
}: Props) {
  const router = useRouter();
  const [payment, setPayment] = useState<PaymentDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reverseOpen, setReverseOpen] = useState(false);
  const [reverseSubmitting, setReverseSubmitting] = useState(false);
  const [reverseError, setReverseError] = useState("");

  const load = useCallback(async () => {
    if (!paymentId || !open) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/payments/${paymentId}`, { credentials: "include" });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error || "Төлбөрийн мэдээлэл татахад алдаа гарлаа.");
      }
      setPayment(json as PaymentDetail);
    } catch (err: any) {
      setError(err?.message || "Төлбөрийн мэдээлэл татахад алдаа гарлаа.");
      setPayment(null);
    } finally {
      setLoading(false);
    }
  }, [open, paymentId]);

  useEffect(() => {
    void load();
  }, [load, refreshSignal]);

  const reverseAllowed = useMemo(() => {
    if (!canReverse || !payment) return false;
    if (payment.status !== "active") return false;
    if (!payment.invoice) return false;
    const invoiceStatus = String(payment.invoice.statusLegacy || "").toLowerCase();
    if (invoiceStatus === "voided") return false;
    return true;
  }, [canReverse, payment]);

  const submitReverse = async (reason: string) => {
    if (!payment || !reverseAllowed) return;
    setReverseSubmitting(true);
    setReverseError("");
    try {
      const res = await fetch(`/api/payments/${payment.id}/reverse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reason }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error || "Төлбөр буцаахад алдаа гарлаа.");
      }
      setReverseOpen(false);
      await load();
      onDataChanged();
    } catch (err: any) {
      setReverseError(err?.message || "Төлбөр буцаахад алдаа гарлаа.");
    } finally {
      setReverseSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <aside className="fixed right-0 top-0 z-50 h-full w-full max-w-xl overflow-y-auto bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 p-4">
          <h2 className="text-lg font-semibold">Төлбөрийн дэлгэрэнгүй</h2>
          <button type="button" onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700">
            ✕
          </button>
        </div>

        {loading ? (
          <div className="p-4 text-sm text-gray-500">Ачаалж байна...</div>
        ) : error ? (
          <div className="m-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
        ) : !payment ? (
          <div className="p-4 text-sm text-gray-500">Төлбөр олдсонгүй.</div>
        ) : (
          <div className="p-4 text-sm">
            <section className="mb-4 rounded-lg border border-gray-200 p-3">
              <h3 className="mb-2 font-semibold">1) Төлбөрийн мэдээлэл</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                <div>Төлбөрийн ID: <strong>#{payment.id}</strong></div>
                <div>Огноо/Цаг: <strong>{formatPaymentDateTime(payment.timestamp)}</strong></div>
                <div>Төлбөрийн хэлбэр: <strong>{formatPaymentMethod(payment.method)}</strong></div>
                <div>Дүн: <strong>{fmtMnt(payment.amount)}</strong></div>
                <div>Төлөв: <strong>{formatPaymentStatus(payment.status)}</strong></div>
              </div>
            </section>

            <section className="mb-4 rounded-lg border border-gray-200 p-3">
              <h3 className="mb-2 font-semibold">2) Холбоотой мэдээлэл</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                <div>Нэхэмжлэлийн ID: <strong>{payment.invoice ? `#${payment.invoice.id}` : "-"}</strong></div>
                <div>Өвчтөн: <strong>{formatPersonName(payment.patient.ovog, payment.patient.name)}</strong></div>
                <div>Эмч: <strong>{formatPersonName(payment.doctor?.ovog, payment.doctor?.name)}</strong></div>
                <div>Салбар: <strong>{payment.branch?.name || "-"}</strong></div>
                <div>
                  Захиалгын огноо:{" "}
                  <strong>{formatPaymentScheduleDateTime(payment.invoice?.encounter?.appointment?.scheduledAt)}</strong>
                </div>
              </div>
            </section>

            <section className="mb-4 rounded-lg border border-gray-200 p-3">
              <h3 className="mb-2 font-semibold">3) Аудит</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                <div>Бүртгэсэн: <strong>{formatPersonName(payment.createdByUser?.ovog, payment.createdByUser?.name)}</strong></div>
                <div>Тэмдэглэл: <strong>{payment.note || "-"}</strong></div>
                <div>Лавлагаа: <strong>{payment.reference || "-"}</strong></div>
                <div>Буцаасан огноо: <strong>{formatPaymentDateTime(payment.reversal?.reversedAt || null)}</strong></div>
                <div>Буцаасан хэрэглэгч: <strong>{formatPersonName(payment.reversal?.reversedByUser?.ovog, payment.reversal?.reversedByUser?.name)}</strong></div>
                <div>
                  Буцаалтын төлбөрийн ID: <strong>{payment.reversal?.reversalPaymentId ? `#${payment.reversal.reversalPaymentId}` : "-"}</strong>
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-gray-200 p-3">
              <h3 className="mb-2 font-semibold">4) Үйлдэл</h3>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!payment.invoice}
                  onClick={() => {
                    if (!payment.invoice) return;
                    void router.push(`/finance/invoices?invoiceId=${payment.invoice.id}`);
                  }}
                  className="rounded-md border border-blue-300 bg-blue-50 px-3 py-1.5 text-sm text-blue-700 disabled:opacity-50"
                >
                  Нэхэмжлэл нээх
                </button>
                {reverseAllowed && (
                  <button
                    type="button"
                    onClick={() => {
                      setReverseError("");
                      setReverseOpen(true);
                    }}
                    className="rounded-md bg-red-600 px-3 py-1.5 text-sm text-white"
                  >
                    Төлбөр буцаах
                  </button>
                )}
              </div>
            </section>
          </div>
        )}
      </aside>

      <ReversePaymentModal
        open={reverseOpen}
        submitting={reverseSubmitting}
        error={reverseError}
        onClose={() => setReverseOpen(false)}
        onConfirm={submitReverse}
      />
    </>
  );
}

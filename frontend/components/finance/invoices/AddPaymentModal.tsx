import React, { useMemo, useState } from "react";

const METHODS = [
  { value: "CASH", label: "Бэлэн" },
  { value: "POS", label: "POS" },
  { value: "QPAY", label: "QPay" },
  { value: "WALLET", label: "Хэтэвч" },
  { value: "TRANSFER", label: "Шилжүүлэг" },
  { value: "INSURANCE", label: "Даатгал" },
  { value: "APPLICATION", label: "Апп" },
];

const REFERENCE_REQUIRED = new Set(["POS", "QPAY", "TRANSFER", "INSURANCE", "APPLICATION"]);

type Props = {
  open: boolean;
  invoiceId: number | null;
  onClose: () => void;
  onSuccess: () => void;
};

export default function AddPaymentModal({ open, invoiceId, onClose, onSuccess }: Props) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("CASH");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const requiresReference = useMemo(() => REFERENCE_REQUIRED.has(method), [method]);

  const resetState = () => {
    setAmount("");
    setMethod("CASH");
    setReference("");
    setNote("");
    setError("");
    setSaving(false);
  };

  if (!open || !invoiceId) return null;

  const handleClose = () => {
    resetState();
    onClose();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = Number(amount);
    if (!Number.isInteger(amountNum) || amountNum <= 0) {
      setError("Дүн эерэг бүхэл тоо байх ёстой.");
      return;
    }
    if (!method) {
      setError("Арга сонгоно уу.");
      return;
    }
    if (requiresReference && !reference.trim()) {
      setError("Тайлбар заавал шаардлагатай.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const meta: Record<string, unknown> = {};
      if (reference.trim()) meta.reference = reference.trim();
      if (note.trim()) meta.note = note.trim();
      if (method === "QPAY" && reference.trim()) meta.qpayPaymentId = reference.trim();

      const res = await fetch(`/api/invoices/${invoiceId}/settlement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          amount: amountNum,
          method,
          meta,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Төлбөр нэмэхэд алдаа гарлаа.");

      resetState();
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || "Төлбөр нэмэхэд алдаа гарлаа.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/50 p-4" onClick={handleClose}>
      <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-3 text-base font-semibold">Төлбөр оруулах</h3>
        <form onSubmit={submit} className="space-y-3">
          <label className="block text-xs text-gray-600">
            Дүн
            <input
              type="number"
              min={1}
              step={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              required
            />
          </label>
          <label className="block text-xs text-gray-600">
            Төлбөрийн хэрэгсэл
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              required
            >
              {METHODS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-gray-600">
            Тайлбар
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              required={requiresReference}
            />
          </label>
          <label className="block text-xs text-gray-600">
            Тэмдэглэл
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            >
              Болих
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white disabled:bg-blue-300"
            >
              {saving ? "Хадгалж байна..." : "Хадгалах"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

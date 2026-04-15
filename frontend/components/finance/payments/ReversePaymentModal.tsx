import React, { useEffect, useState } from "react";

type Props = {
  open: boolean;
  submitting: boolean;
  error: string;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
};

export default function ReversePaymentModal({ open, submitting, error, onClose, onConfirm }: Props) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!open) {
      setReason("");
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
        <h3 className="text-lg font-semibold">Төлбөр буцаах</h3>
        <p className="mt-2 text-sm text-gray-700">
          Энэ төлбөрийг буцаахдаа итгэлтэй байна уу? Анхны бүртгэлийг устгахгүй. Аудитын зориулалтаар буцаалтын бүртгэл үүсгэнэ.
        </p>

        <label className="mt-4 block text-sm text-gray-700">
          Буцаах шалтгаан
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          />
        </label>

        {error && <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          >
            Болих
          </button>
          <button
            type="button"
            disabled={submitting || !reason.trim()}
            onClick={() => onConfirm(reason.trim())}
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm text-white disabled:bg-red-300"
          >
            {submitting ? "Боловсруулж байна..." : "Буцаах"}
          </button>
        </div>
      </div>
    </div>
  );
}

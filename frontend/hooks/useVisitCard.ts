// Hook for visit card loading/saving/signature logic

import { useEffect, useState } from 'react';
import type { VisitCard, VisitCardType, VisitCardAnswers } from '../types/visitCard';
import type { ActiveTab } from '../types/patients';

interface UseVisitCardProps {
  bookNumber: string | string[] | undefined;
  activeTab: ActiveTab;
  patientBookId: number | null;
}

export function useVisitCard({ bookNumber, activeTab, patientBookId }: UseVisitCardProps) {
  const [visitCard, setVisitCard] = useState<VisitCard | null>(null);
  const [visitCards, setVisitCards] = useState<VisitCard[]>([]);
  const [visitCardLoading, setVisitCardLoading] = useState(false);
  const [visitCardError, setVisitCardError] = useState("");
  const [visitCardTypeDraft, setVisitCardTypeDraft] = useState<VisitCardType | null>("ADULT");
  const [visitCardAnswers, setVisitCardAnswers] = useState<VisitCardAnswers>({});
  const [visitCardSaving, setVisitCardSaving] = useState(false);
  const [signatureSaving, setSignatureSaving] = useState(false);

  // Load visit card only when visit_card tab is active
  useEffect(() => {
    if (!bookNumber || typeof bookNumber !== "string") return;
    if (activeTab !== "visit_card") return;

    const loadVisitCard = async () => {
      setVisitCardLoading(true);
      setVisitCardError("");
      try {
        const res = await fetch(
          `/api/patients/visit-card/by-book/${encodeURIComponent(bookNumber)}`
        );
        const json = await res.json().catch(() => null);

        if (!res.ok) {
          throw new Error(
            (json && json.error) || "Үзлэгийн карт ачаалахад алдаа гарлаа."
          );
        }

        const card: VisitCard | null = json.visitCard || null;
        const cards: VisitCard[] = json.visitCards || [];
        
        setVisitCard(card);
        setVisitCards(cards);
        
        if (card) {
          setVisitCardTypeDraft(card.type);
          setVisitCardAnswers(card.answers || {});
        } else {
          setVisitCardTypeDraft("ADULT");
          setVisitCardAnswers({});
        }
      } catch (err: any) {
        console.error("loadVisitCard failed", err);
        setVisitCardError(
          err?.message || "Үзлэгийн карт ачаалахад алдаа гарлаа."
        );
        setVisitCard(null);
        setVisitCards([]);
      } finally {
        setVisitCardLoading(false);
      }
    };

    void loadVisitCard();
  }, [bookNumber, activeTab]);

  const handleTypeChange = (newType: VisitCardType) => {
    setVisitCardTypeDraft(newType);
    
    const existingCard = visitCards.find(c => c.type === newType);
    
    if (existingCard) {
      setVisitCardAnswers(existingCard.answers || {});
      setVisitCard(existingCard);
    } else {
      setVisitCardAnswers({});
      setVisitCard(null);
    }
  };

  const updateVisitCardAnswer = (
    key: keyof VisitCardAnswers,
    value: VisitCardAnswers[typeof key]
  ) => {
    setVisitCardAnswers((prev: VisitCardAnswers) => ({
      ...(prev || {}),
      [key]: value,
    }));
  };

  const updateNested = (
    section: keyof VisitCardAnswers,
    field: string,
    value: any
  ) => {
    setVisitCardAnswers((prev: VisitCardAnswers) => ({
      ...(prev || {}),
      [section]: {
        ...(prev?.[section] as any),
        [field]: value,
      },
    }));
  };

  const handleSaveVisitCard = async () => {
    if (!patientBookId) {
      setVisitCardError("PatientBook ID олдсонгүй.");
      return;
    }

    const type = visitCardTypeDraft;
    if (!type) {
      setVisitCardError(
        "Эхлээд картын төрлийг сонгоно уу (том хүн / хүүхэд)."
      );
      return;
    }

    setVisitCardSaving(true);
    setVisitCardError("");
    try {
      const res = await fetch(`/api/patients/visit-card/${patientBookId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          answers: visitCardAnswers,
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          (json && json.error) || "Үзлэгийн карт хадгалахад алдаа гарлаа."
        );
      }

      const card: VisitCard = json.visitCard;
      
      setVisitCards((prev) => {
        const filtered = prev.filter(c => c.type !== card.type);
        return [...filtered, card];
      });
      
      setVisitCard(card);
      setVisitCardTypeDraft(card.type);
      setVisitCardAnswers(card.answers || {});
    } catch (err: any) {
      console.error("save visit card failed", err);
      setVisitCardError(
        err?.message || "Үзлэгийн карт хадгалахад алдаа гарлаа."
      );
    } finally {
      setVisitCardSaving(false);
    }
  };

  const handleUploadSignature = async (blob: Blob) => {
    if (!patientBookId) {
      setVisitCardError("PatientBook ID олдсонгүй.");
      return;
    }
    
    const currentType = visitCardTypeDraft;
    if (!currentType) {
      setVisitCardError("Картын төрлийг сонгоно уу.");
      return;
    }
    
    setSignatureSaving(true);
    setVisitCardError("");
    try {
      const formData = new FormData();
      formData.append("file", blob, "signature.png");
      formData.append("type", currentType);

      const res = await fetch(
        `/api/patients/visit-card/${patientBookId}/signature`,
        {
          method: "POST",
          body: formData,
        }
      );

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          (json && json.error) || "Гарын үсэг хадгалахад алдаа гарлаа."
        );
      }

      const existingCard = visitCards.find(c => c.type === json.type);
      const updatedCard = {
        ...(existingCard || visitCard || {}),
        patientSignaturePath: json.patientSignaturePath,
        signedAt: json.signedAt,
        type: json.type,
      } as VisitCard;
      
      setVisitCard(updatedCard);
      
      setVisitCards((prev) => {
        const filtered = prev.filter(c => c.type !== json.type);
        return [...filtered, updatedCard];
      });
    } catch (err: any) {
      console.error("upload signature failed", err);
      setVisitCardError(
        err?.message || "Гарын үсэг хадгалахад алдаа гарлаа."
      );
    } finally {
      setSignatureSaving(false);
    }
  };

  return {
    visitCard,
    visitCards,
    visitCardLoading,
    visitCardError,
    visitCardTypeDraft,
    visitCardAnswers,
    visitCardSaving,
    signatureSaving,
    handleTypeChange,
    updateVisitCardAnswer,
    updateNested,
    handleSaveVisitCard,
    handleUploadSignature,
    setVisitCardTypeDraft,
  };
}

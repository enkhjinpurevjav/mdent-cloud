import React, { useState, useEffect } from "react";
import type {
  SterilizationDraftAttachment,
  ToolLineSearchResult,
} from "../../types/encounter-admin";

type SterilizationToolLineSelectorProps = {
  diagnosisRowId: number | undefined;
  branchId: number;
  draftAttachments: SterilizationDraftAttachment[];
  searchText: string;
  isOpen: boolean;
  isLocked: boolean;
  onSearchTextChange: (text: string) => void;
  onOpen: () => void;
  onClose: () => void;
  onAddToolLine: (toolLineId: number) => Promise<void>;
  onRemoveDraft: (draftId: number) => Promise<void>;
};

export default function SterilizationToolLineSelector({
  diagnosisRowId,
  branchId,
  draftAttachments,
  searchText,
  isOpen,
  isLocked,
  onSearchTextChange,
  onOpen,
  onClose,
  onAddToolLine,
  onRemoveDraft,
}: SterilizationToolLineSelectorProps) {
  const [toolLineResults, setToolLineResults] = useState<ToolLineSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  // Load tool line search results when search text changes
  useEffect(() => {
    if (!isOpen || !branchId) {
      setToolLineResults([]);
      return;
    }

    const searchToolLines = async () => {
      setSearching(true);
      try {
        const params = new URLSearchParams();
        params.set("branchId", String(branchId));
        if (searchText) {
          params.set("query", searchText);
        }

        const res = await fetch(`/api/sterilization/tool-lines/search?${params.toString()}`);
        if (res.ok) {
          const json = await res.json();
          setToolLineResults(Array.isArray(json) ? json : []);
        } else {
          setToolLineResults([]);
        }
      } catch (err) {
        console.error("Failed to search tool lines:", err);
        setToolLineResults([]);
      } finally {
        setSearching(false);
      }
    };

    searchToolLines();
  }, [isOpen, branchId, searchText]);

  // Show all drafts as chips (allow viewing duplicates with their quantities)
  return (
    <div style={{ marginBottom: 8, position: "relative" }}>
      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>
        Ариутгалын багаж (багаж/цикл)
      </div>

      {/* Selected tool lines (chips) */}
      {draftAttachments.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            marginBottom: 6,
          }}
        >
          {draftAttachments.map((draft) => {
            const label = `${draft.tool.name} — ${draft.cycle.code}`;
            return (
              <div
                key={draft.id}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 8px",
                  borderRadius: 999,
                  border: "1px solid #d1d5db",
                  background: "#ffffff",
                  fontSize: 12,
                  opacity: isLocked ? 0.6 : 1,
                }}
              >
                <span>
                  {label} {draft.requestedQty > 1 && `×${draft.requestedQty}`}
                </span>
                {!isLocked && (
                  <button
                    type="button"
                    onClick={() => onRemoveDraft(draft.id)}
                    style={{
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      color: "#dc2626",
                      fontWeight: 700,
                      lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Search input */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <div
          style={{ position: "relative", minWidth: 260, flex: "0 0 auto" }}
        >
          <input
            placeholder="Багаж эсвэл циклын кодоор хайх..."
            value={searchText}
            onChange={(e) => {
              if (isLocked) return;
              onSearchTextChange(e.target.value);
            }}
            onFocus={() => {
              if (!isLocked) onOpen();
            }}
            onBlur={() => {
              setTimeout(() => onClose(), 150);
            }}
            disabled={isLocked || !diagnosisRowId}
            style={{
              width: "100%",
              borderRadius: 6,
              border: "1px solid #d1d5db",
              padding: "6px 8px",
              fontSize: 13,
              background: isLocked || !diagnosisRowId ? "#f3f4f6" : "#ffffff",
              cursor: isLocked || !diagnosisRowId ? "not-allowed" : "text",
              opacity: isLocked || !diagnosisRowId ? 0.6 : 1,
            }}
          />

          {isOpen && diagnosisRowId && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                maxHeight: 220,
                overflowY: "auto",
                marginTop: 4,
                background: "white",
                borderRadius: 6,
                boxShadow:
                  "0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)",
                zIndex: 20,
                fontSize: 13,
              }}
            >
              {searching ? (
                <div style={{ padding: "12px 8px", color: "#6b7280" }}>
                  Хайж байна...
                </div>
              ) : toolLineResults.length === 0 ? (
                <div style={{ padding: "12px 8px", color: "#6b7280" }}>
                  {searchText ? "Хайлт олдсонгүй" : "Багаж оруулаад хайна уу"}
                </div>
              ) : (
                toolLineResults.map((result) => (
                  <div
                    key={result.toolLineId}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onAddToolLine(result.toolLineId);
                      onSearchTextChange("");
                    }}
                    style={{
                      padding: "6px 8px",
                      cursor: "pointer",
                      borderBottom: "1px solid #f3f4f6",
                      background: "white",
                    }}
                  >
                    <div style={{ fontWeight: 500 }}>
                      {result.toolName} — {result.cycleCode}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

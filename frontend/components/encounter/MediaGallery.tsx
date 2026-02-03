import React, { useState } from "react";
import type { EncounterMedia } from "../../types/encounter-admin";
import { formatDateTime } from "../../utils/date-formatters";

type PendingImage = {
  file: File;
  previewUrl: string;
  id: string;
};

type MediaGalleryProps = {
  media: EncounterMedia[];
  mediaLoading: boolean;
  mediaError: string;
  uploadingMedia: boolean;
  onUpload: (files: File[]) => Promise<void>;
  onDelete: (mediaId: number) => Promise<void>;
};

export default function MediaGallery({
  media,
  mediaLoading,
  mediaError,
  uploadingMedia,
  onUpload,
  onDelete,
}: MediaGalleryProps) {
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set());

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newPending = files.map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
      id: `${Date.now()}-${Math.random()}`,
    }));

    setPendingImages((prev) => [...prev, ...newPending]);
    e.target.value = "";
  };

  const handleRemovePending = (id: string) => {
    setPendingImages((prev) => {
      const item = prev.find((p) => p.id === id);
      if (item) {
        URL.revokeObjectURL(item.previewUrl);
      }
      return prev.filter((p) => p.id !== id);
    });
  };

  const handleSave = async () => {
    if (pendingImages.length === 0) return;

    const files = pendingImages.map((p) => p.file);
    await onUpload(files);

    // Clean up preview URLs
    pendingImages.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    setPendingImages([]);
  };

  const handleDelete = async (mediaId: number) => {
    if (deletingIds.has(mediaId)) return;

    setDeletingIds((prev) => new Set(prev).add(mediaId));
    try {
      await onDelete(mediaId);
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(mediaId);
        return next;
      });
    }
  };
  return (
    <div
      style={{
        marginTop: 16,
        paddingTop: 12,
        borderTop: "1px dashed #e5e7eb",
      }}
    >
      <h3
        style={{
          fontSize: 14,
          margin: 0,
          marginBottom: 6,
        }}
      >
        Рентген / зураг
      </h3>
      <p
        style={{
          marginTop: 0,
          marginBottom: 6,
          fontSize: 12,
          color: "#6b7280",
        }}
      >
        Энэ үзлэгт холбоотой рентген болон бусад зургууд.
      </p>

      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "6px 12px",
            borderRadius: 6,
            border: "1px solid #2563eb",
            background: "#eff6ff",
            color: "#2563eb",
            fontSize: 12,
            cursor: uploadingMedia ? "default" : "pointer",
          }}
        >
          {uploadingMedia ? "Хуулж байна..." : "+ Зураг нэмэх"}
          <input
            type="file"
            accept="image/*"
            multiple
            style={{ display: "none" }}
            disabled={uploadingMedia}
            onChange={handleFileSelect}
          />
        </label>

        {pendingImages.length > 0 && (
          <button
            type="button"
            onClick={handleSave}
            disabled={uploadingMedia}
            style={{
              padding: "6px 12px",
              borderRadius: 6,
              border: "1px solid #16a34a",
              background: uploadingMedia ? "#f3f4f6" : "#dcfce7",
              color: uploadingMedia ? "#9ca3af" : "#16a34a",
              fontSize: 12,
              fontWeight: 600,
              cursor: uploadingMedia ? "default" : "pointer",
            }}
          >
            {uploadingMedia
              ? "Хадгалж байна..."
              : `Хадгалах (${pendingImages.length})`}
          </button>
        )}
      </div>

      {mediaLoading && (
        <div style={{ fontSize: 13 }}>Зураг ачаалж байна...</div>
      )}

      {mediaError && (
        <div style={{ color: "red", fontSize: 13, marginBottom: 8 }}>
          {mediaError}
        </div>
      )}

      {!mediaLoading && media.length === 0 && pendingImages.length === 0 && !mediaError && (
        <div style={{ fontSize: 13, color: "#6b7280" }}>
          Одоогоор энэ үзлэгт зураг хадгалаагүй байна.
        </div>
      )}

      {(media.length > 0 || pendingImages.length > 0) && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fill, minmax(120px, 1fr))",
            gap: 12,
            marginTop: 8,
          }}
        >
          {/* Render pending images */}
          {pendingImages.map((pending) => (
            <div
              key={pending.id}
              style={{
                display: "flex",
                flexDirection: "column",
                textDecoration: "none",
                color: "#111827",
                borderRadius: 8,
                border: "2px dashed #2563eb",
                overflow: "hidden",
                background: "#eff6ff",
                position: "relative",
              }}
            >
              <button
                type="button"
                onClick={() => handleRemovePending(pending.id)}
                style={{
                  position: "absolute",
                  top: 4,
                  right: 4,
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  background: "rgba(239, 68, 68, 0.9)",
                  color: "white",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 14,
                  fontWeight: "bold",
                  zIndex: 1,
                }}
                title="Устгах"
              >
                ×
              </button>
              <div
                style={{
                  width: "100%",
                  aspectRatio: "4 / 3",
                  overflow: "hidden",
                  background: "#111827",
                }}
              >
                <img
                  src={pending.previewUrl}
                  alt="Шинэ зураг"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
              </div>
              <div
                style={{
                  padding: 6,
                  fontSize: 11,
                  borderTop: "1px solid #2563eb",
                  background: "#ffffff",
                }}
              >
                <div style={{ color: "#2563eb", fontWeight: 600 }}>
                  Шинэ (хадгалаагүй)
                </div>
              </div>
            </div>
          ))}

          {/* Render uploaded images */}
          {media.map((m) => {
            const href = m.filePath.startsWith("http")
              ? m.filePath
              : m.filePath.startsWith("/")
              ? m.filePath
              : `/${m.filePath}`;
            const isDeleting = deletingIds.has(m.id);
            
            return (
              <div
                key={m.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  textDecoration: "none",
                  color: "#111827",
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                  overflow: "hidden",
                  background: "#f9fafb",
                  position: "relative",
                  opacity: isDeleting ? 0.5 : 1,
                }}
              >
                {!isDeleting && (
                  <button
                    type="button"
                    onClick={() => handleDelete(m.id)}
                    style={{
                      position: "absolute",
                      top: 4,
                      right: 4,
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      background: "rgba(239, 68, 68, 0.9)",
                      color: "white",
                      border: "none",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 14,
                      fontWeight: "bold",
                      zIndex: 1,
                    }}
                    title="Устгах"
                  >
                    ×
                  </button>
                )}
                {isDeleting && (
                  <div
                    style={{
                      position: "absolute",
                      top: 4,
                      right: 4,
                      padding: "2px 6px",
                      borderRadius: 4,
                      background: "rgba(0, 0, 0, 0.7)",
                      color: "white",
                      fontSize: 10,
                      zIndex: 1,
                    }}
                  >
                    Устгаж байна...
                  </div>
                )}
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  <div
                    style={{
                      width: "100%",
                      aspectRatio: "4 / 3",
                      overflow: "hidden",
                      background: "#111827",
                    }}
                  >
                    <img
                      src={href}
                      alt={m.toothCode || "Рентген зураг"}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        display: "block",
                      }}
                    />
                  </div>
                  <div
                    style={{
                      padding: 6,
                      fontSize: 11,
                      borderTop: "1px solid #e5e7eb",
                      background: "#ffffff",
                    }}
                  >
                    <div>
                      {m.type === "XRAY" ? "Рентген" : "Зураг"}{" "}
                      {m.toothCode ? `(${m.toothCode})` : ""}
                    </div>
                    {m.createdAt && (
                      <div style={{ color: "#6b7280", marginTop: 2 }}>
                        {formatDateTime(m.createdAt)}
                      </div>
                    )}
                  </div>
                </a>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

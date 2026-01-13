import React from "react";
import type { EncounterMedia } from "../../types/encounter-admin";
import { formatDateTime } from "../../utils/date-formatters";

type MediaGalleryProps = {
  media: EncounterMedia[];
  mediaLoading: boolean;
  mediaError: string;
  uploadingMedia: boolean;
  onUpload: (file: File) => void;
  onReload: () => void;
};

export default function MediaGallery({
  media,
  mediaLoading,
  mediaError,
  uploadingMedia,
  onUpload,
  onReload,
}: MediaGalleryProps) {
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
            style={{ display: "none" }}
            disabled={uploadingMedia}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                onUpload(file);
                e.target.value = "";
              }
            }}
          />
        </label>

        <button
          type="button"
          onClick={onReload}
          disabled={mediaLoading}
          style={{
            padding: "6px 12px",
            borderRadius: 6,
            border: "1px solid #6b7280",
            background: "#f3f4f6",
            color: "#374151",
            fontSize: 12,
            cursor: mediaLoading ? "default" : "pointer",
          }}
        >
          {mediaLoading ? "Шинэчилж байна..." : "Зураг шинэчлэх"}
        </button>
      </div>

      {mediaLoading && (
        <div style={{ fontSize: 13 }}>Зураг ачаалж байна...</div>
      )}

      {mediaError && (
        <div style={{ color: "red", fontSize: 13, marginBottom: 8 }}>
          {mediaError}
        </div>
      )}

      {!mediaLoading && media.length === 0 && !mediaError && (
        <div style={{ fontSize: 13, color: "#6b7280" }}>
          Одоогоор энэ үзлэгт зураг хадгалаагүй байна.
        </div>
      )}

      {media.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fill, minmax(120px, 1fr))",
            gap: 12,
            marginTop: 8,
          }}
        >
          {media.map((m) => {
            const href = m.filePath.startsWith("http")
              ? m.filePath
              : m.filePath.startsWith("/")
              ? m.filePath
              : `/${m.filePath}`;
            return (
              <a
                key={m.id}
                href={href}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  textDecoration: "none",
                  color: "#111827",
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                  overflow: "hidden",
                  background: "#f9fafb",
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
            );
          })}
        </div>
      )}
    </div>
  );
}

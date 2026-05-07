export type AnnouncementType = "LOGIN_POPUP" | "ALERT_LIST";
export type AnnouncementContentMode = "TEXT" | "IMAGE";

export type AnnouncementAttachment = {
  id?: number;
  filePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes?: number | null;
  createdAt?: string;
};

export type Announcement = {
  id: number;
  type: AnnouncementType;
  contentMode: AnnouncementContentMode;
  title: string;
  body: string;
  imagePath: string | null;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  updatedAt?: string;
  isActive?: boolean;
  readAt?: string | null;
  attachments?: AnnouncementAttachment[];
  receipt?: {
    readAt: string | null;
    dontShowAgain: boolean;
    firstShownAt: string | null;
    lastShownAt: string | null;
  } | null;
};

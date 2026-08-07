export interface ExportFormat {
  id: string;
  label: string;
  width: number;
  height: number;
}

export const EXPORT_FORMATS: ExportFormat[] = [
  { id: "instagram-feed", label: "Instagram Feed", width: 1080, height: 1350 },
  { id: "instagram-story", label: "Instagram Story", width: 1080, height: 1920 },
  { id: "facebook", label: "Facebook", width: 1200, height: 630 },
  { id: "x", label: "X (Twitter)", width: 1600, height: 900 },
  { id: "youtube-community", label: "YouTube Community", width: 1080, height: 1080 },
  { id: "youtube-thumbnail", label: "YouTube Thumbnail", width: 1280, height: 720 },
  { id: "square", label: "Square Post", width: 1080, height: 1080 },
  { id: "portrait", label: "Portrait Post", width: 1080, height: 1350 },
  { id: "landscape", label: "Landscape Post", width: 1920, height: 1080 },
];

export function getFormat(id: string): ExportFormat {
  return EXPORT_FORMATS.find((f) => f.id === id) ?? EXPORT_FORMATS[0];
}

export type AspectRatio = "1:1" | "2:3" | "3:2" | "3:4" | "4:3" | "4:5" | "5:4" | "9:16" | "16:9" | "21:9" | "auto";
export type ImageSize = "1K" | "2K" | "4K" | "auto";

export interface ReferenceImage {
  id: string;
  data: string; // URL or base64
  mimeType: string;
  filename?: string; // Filename for server-side deletion
}

export interface Style {
  text?: string;
  images?: ReferenceImage[];
}

export interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  timestamp: number;
  generationTime?: number; // Generation time in milliseconds
  metadata: {
    request: {
      prompt: {
        text: string;
        images?: string[]; // Array of filenames
        original?: string; // Original prompt with gacha notation
      };
      style?: {
        text?: string;
        images?: string[]; // Array of filenames
      };
      generationConfig: {
        aspectRatio?: AspectRatio;
        imageSize?: ImageSize;
      };
    };
    response?: {
      modelVersion?: string;
      responseId?: string;
      usageMetadata?: any;
    };
    generationTime?: number; // Generation time in milliseconds
    bookmarked: boolean; // Bookmark status
  };
}


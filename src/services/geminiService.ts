import { GoogleGenAI } from "@google/genai";
import { AspectRatio, ImageSize, ReferenceImage, Style } from "../types";
import { convertImageToBase64 } from "../lib/imageUtils";

/**
 * Get API key from environment variable
 */
const getApiKey = (): string | null => {
  return import.meta.env.VITE_GEMINI_API_KEY || null;
};

export interface GenerateImageResponse {
  imageUrl: string;
  textFeedback?: string;
  modelVersion?: string;
  responseId?: string;
  usageMetadata?: any;
}

export const generateImage = async (
  prompt: string,
  config: {
    aspectRatio: AspectRatio;
    imageSize: ImageSize;
  },
  style?: Style,
  promptImages?: ReferenceImage[]
): Promise<GenerateImageResponse> => {
  const apiKey = getApiKey();
  
  if (!apiKey) {
    throw new Error("API_KEY_REQUIRED");
  }

  const ai = new GoogleGenAI({ apiKey });

  const hasPromptText   = !!(prompt && prompt.trim() !== '');
  const hasPromptImages = !!(promptImages && promptImages.length > 0);
  const hasPrompt       = hasPromptText || hasPromptImages;
  const hasStyleText    = !!(style && style.text);
  const hasStyleImages  = !!(style && style.images && style.images.length > 0);
  const hasStyle        = hasStyleText || hasStyleImages;

  const parts: any[] = [];

  if (hasPrompt) {
    const promptHeader = [];
    promptHeader.push(
      "# Prompt",
      "This section defines what to generate. Follow the rules below:",
      "- Defines subject, content, and intent",
      "- May include TextPrompt and/or ImagePrompt",
      "- Responsible for what appears in the image",
    
      // Allowed content
      "- Allowed content",
      "  - Subject, motif, object, character",
      "  - Scene, situation, action",
      "  - Environment, background, context",
      "  - Narrative, emotion, mood",
      "  - Time, place, era",
      "  - Composition, layout, framing",
      "  - Camera, perspective, angle",
      "  - Lighting and atmosphere",
      "  - Image size, aspect ratio, resolution (if needed)",
    );
    
    promptHeader.push(
      // Text prompt
      "- TextPrompt",
      "  - Semantic description of what should appear",
      "  - Clear subjects, objects, and actions",
      "  - Intent and content constraints",
    
      // Image prompt
      "- ImagePrompt",
      "  - Reference images for subject or composition",
      "  - Identifiable objects or scenes allowed",
      "  - Used to convey structure, layout, or content",
    );
    
    if (hasStyle) {
      promptHeader.push(
        // Separation rules
        "- Separation rules",
        "  - Do not include drawing style descriptions",
        "  - Do not restate or override # Style Reference",
        "  - Assume style is provided externally",
        "  - Do not enforce strict shape, proportion, or detail fidelity",
        "  - Allow objects to be deformed or simplified by # Style Reference",
    
        // Principle
        "- Principle",
        "  - # Prompt defines what",
        "  - # Style Reference defines how",
        "  - When conflicts occur, # Style Reference overrides semantic accuracy",
        "  - Visual style may alter or obscure object details if required",
      );
    }
    parts.push({ text: promptHeader.join("\n") });
    
    if (hasPromptText) {
      parts.push({ text: prompt });
    }
    
    if (hasPromptImages) {
      for (const img of promptImages) {
        try {
          const base64Data = await convertImageToBase64(img.data);
          parts.push({
            inlineData: {
              data: base64Data,
              mimeType: img.mimeType,
            },
          });
        } catch (error) {
          console.error('Failed to convert prompt image to base64:', error);
          continue;
        }
      }
    }
  }

  if (hasStyle) {
    parts.push({ text: [
      "# Style Reference",
      "This section is used to guide the generation style. Please follow the following rules:",
    
      // Scope
      "- Drawing style only",
      "- No subject, motif, object, character, or scene description",
      "- No image size, aspect ratio, resolution, or framing",
      "- No composition, layout, or camera instructions",
      "- No environment, background, or context",
      "- No narrative, emotion, or story implication",
      "- No lighting setup tied to a scene",
      "- No time, place, or era specification",
    
      // Focus
      "- Focus on line quality, stroke behavior, shape language",
      "- Focus on color usage rules (or explicit absence of color)",
      "- Focus on texture, material feel, surface treatment",
      "- Focus on rendering method (flat, shaded, gradient, etc.)",
      "- Focus on abstraction level (realistic, stylized, symbolic, etc.)",
      "- Style must be applicable to any subject",
      "- Treat this section as a reusable style modifier",
    
      // Style priority
      "- Style priority rules",
      "  - Style interpretation has priority over object fidelity",
      "  - Accurate shape, proportion, or detail preservation is not required",
      "  - Objects may be simplified, distorted, or abstracted to follow the style",
      "  - Loss of detail or form is acceptable if required by the style",
    
      // Emphasis
      "- Emphasis rules",
      "  - Overall impression over precise form",
      "  - Style-driven deformation and ambiguity",
      "  - Expressive rendering rather than literal depiction",
    
      // Avoidance
      "- Avoidance rules",
      "  - Photorealistic or high-fidelity detail retention",
      "  - Rigid outlines or exact silhouettes",
      "  - Overly faithful rendering of object structure",
    
      // Text instructions
      "- If text instructions are provided",
      "  - Description of visual language",
      "  - Rules and constraints",
      "  - What to emphasize",
      "  - What to avoid",
    
      // Image instructions
      "- If image instructions are provided",
      "  - Pure style reference images only",
      "  - No identifiable subjects or motifs",
      "  - Used only to convey rendering, line, color, texture",
    ].join("\n") });
    
    if (hasStyleText) {
      parts.push({ text: style.text });
    }
    
    if (hasStyleImages && style.images) {
      for (const img of style.images) {
        try {
          const base64Data = await convertImageToBase64(img.data);
          parts.push({
            inlineData: {
              data: base64Data,
              mimeType: img.mimeType,
            },
          });
        } catch (error) {
          console.error('Failed to convert style reference image to base64:', error);
          continue;
        }
      }
    }
  }

  const imageConfig: any = {};
  if (config.aspectRatio !== 'auto') {
    imageConfig.aspectRatio = config.aspectRatio;
  }
  if (config.imageSize !== 'auto') {
    imageConfig.imageSize = config.imageSize;
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: { parts },
      config: {
        ...(Object.keys(imageConfig).length > 0 ? { imageConfig } : {}),
      },
    });

    let imageUrl = "";
    let textFeedback = "";

    if (response.candidates && response.candidates[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        } else if (part.text) {
          textFeedback = part.text;
        }
      }
    }

    if (!imageUrl) {
      throw new Error("No image was generated by the model.");
    }

    return {
      imageUrl,
      textFeedback,
      modelVersion: response.modelVersion,
      responseId: response.responseId,
      usageMetadata: response.usageMetadata,
    };
  } catch (error: any) {
    if (error.message?.includes("Requested entity was not found.")) {
      throw new Error("API_KEY_EXPIRED");
    }
    throw error;
  }
};


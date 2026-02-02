/**
 * Image utility functions for converting between different formats
 */

/**
 * Resolve image URL to full URL
 * Handles both absolute URLs and relative paths
 */
export const resolveImageUrl = (url: string): string => {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  return `${apiUrl}${url.startsWith('/') ? url : `/${url}`}`;
};

/**
 * Convert image URL or base64 data URL to base64 string (without data URL prefix)
 * @param imageData - Image URL or base64 data URL
 * @returns Promise resolving to base64 string (without prefix)
 */
export const convertImageToBase64 = async (imageData: string): Promise<string> => {
  if (imageData.startsWith('data:')) {
    return imageData.split(',')[1];
  }
  
  const imageUrl = resolveImageUrl(imageData);
  const response = await fetch(imageUrl);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.statusText}`);
  }
  
  const blob = await response.blob();
  
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

/**
 * Convert image URL or base64 data URL to Blob
 * @param imageData - Image URL or base64 data URL
 * @returns Promise resolving to Blob
 */
export const convertImageToBlob = async (imageData: string): Promise<Blob> => {
  if (imageData.startsWith('data:')) {
    const response = await fetch(imageData);
    return response.blob();
  }
  
  const imageUrl = resolveImageUrl(imageData);
  const response = await fetch(imageUrl);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.statusText}`);
  }
  
  return response.blob();
};

/**
 * Convert image URL or base64 data URL to File
 * @param imageData - Image URL or base64 data URL
 * @param filename - Filename for the File object
 * @param mimeType - MIME type for the File object
 * @returns Promise resolving to File
 */
export const convertImageToFile = async (
  imageData: string,
  filename: string = 'image.png',
  mimeType: string = 'image/png'
): Promise<File> => {
  const blob = await convertImageToBlob(imageData);
  return new File([blob], filename, { type: mimeType });
};

/**
 * Convert Blob to base64 string (without data URL prefix)
 * @param blob - Blob to convert
 * @returns Promise resolving to base64 string
 */
export const convertBlobToBase64 = async (blob: Blob): Promise<string> => {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

/**
 * Get API base URL
 */
export const getApiUrl = (): string => {
  return import.meta.env.VITE_API_URL || 'http://localhost:3001';
};

/**
 * Download image from URL
 * @param imageUrl - Image URL to download
 * @param filename - Filename for the downloaded file
 * @throws Error if download fails
 */
export const downloadImage = async (imageUrl: string, filename: string = 'image.png'): Promise<void> => {
  // Convert image to blob
  const imageBlob = await convertImageToBlob(imageUrl);
  const url = URL.createObjectURL(imageBlob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Download image with metadata JSON file
 * @param image - GeneratedImage object containing image URL and metadata
 * @throws Error if download fails
 */
export const downloadImageWithMetadata = async (image: { id: string; url: string; metadata?: any }): Promise<void> => {
  const baseFilename = `gemini-gen-${image.id}`;
  
  // Download image
  await downloadImage(image.url, `${baseFilename}.png`);

  // Download metadata JSON if available
  if (image.metadata) {
    const jsonData = JSON.stringify(image.metadata, null, 2);
    const jsonBlob = new Blob([jsonData], { type: 'application/json' });
    const jsonUrl = URL.createObjectURL(jsonBlob);
    const jsonLink = document.createElement('a');
    jsonLink.href = jsonUrl;
    jsonLink.download = `${baseFilename}.json`;
    document.body.appendChild(jsonLink);
    jsonLink.click();
    document.body.removeChild(jsonLink);
    URL.revokeObjectURL(jsonUrl);
  }
};


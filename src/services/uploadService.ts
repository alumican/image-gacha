import { convertImageToBlob, getApiUrl } from '../lib/imageUtils';

/**
 * Upload image and metadata to server
 * @param imageUrl - Base64 image URL
 * @param metadata - Metadata JSON object
 * @param filename - Base filename (without extension)
 * @param projectId - Project ID
 * @returns Promise resolving to upload result
 */
export const uploadToServer = async (
  imageUrl: string,
  metadata: any,
  filename: string,
  projectId: string = 'default'
): Promise<{ success: boolean; message?: string; error?: string }> => {
  try {
    const blob = await convertImageToBlob(imageUrl);
    const formData = new FormData();
    
    const imageFile = new File([blob], `${filename}.png`, { type: 'image/png' });
    formData.append('image', imageFile);
    
    const metadataJson = JSON.stringify(metadata, null, 2);
    const metadataBlob = new Blob([metadataJson], { type: 'application/json' });
    const metadataFile = new File([metadataBlob], `${filename}.json`, { type: 'application/json' });
    formData.append('metadata', metadataFile);
    formData.append('projectId', projectId);
    
    const apiUrl = getApiUrl();
    const uploadResponse = await fetch(`${apiUrl}/api/upload`, {
      method: 'POST',
      body: formData,
    });
    
    if (!uploadResponse.ok) {
      const errorData = await uploadResponse.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(errorData.error || 'Upload failed');
    }
    
    const result = await uploadResponse.json();
    return { success: true, message: result.message };
  } catch (error: any) {
    console.error('Upload error:', error);
    return { success: false, error: error.message || 'Failed to upload' };
  }
};


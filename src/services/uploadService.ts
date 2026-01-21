import { convertImageToBlob, getApiUrl } from '../lib/imageUtils';

/**
 * Create metadata JSON file on server (before image generation)
 * @param imageId - Image ID
 * @param metadata - Metadata JSON object
 * @param projectId - Project ID
 * @returns Promise resolving to creation result
 */
export const createMetadataOnServer = async (
  imageId: string,
  metadata: any,
  projectId: string = 'default'
): Promise<{ success: boolean; message?: string; error?: string }> => {
  try {
    const apiUrl = getApiUrl();
    const response = await fetch(`${apiUrl}/api/projects/${projectId}/images/${imageId}/metadata`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ metadata }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to create metadata' }));
      throw new Error(errorData.error || 'Failed to create metadata');
    }
    
    const result = await response.json();
    return { success: true, message: result.message };
  } catch (error: any) {
    console.error('Create metadata error:', error);
    return { success: false, error: error.message || 'Failed to create metadata' };
  }
};

/**
 * Update image and metadata on server (after image generation)
 * @param imageId - Image ID
 * @param imageUrl - Base64 image URL
 * @param metadata - Updated metadata JSON object (optional, will be merged with existing)
 * @param projectId - Project ID
 * @returns Promise resolving to update result
 */
export const updateImageOnServer = async (
  imageId: string,
  imageUrl: string,
  metadata: any | null,
  projectId: string = 'default'
): Promise<{ success: boolean; message?: string; imageUrl?: string; error?: string }> => {
  try {
    const blob = await convertImageToBlob(imageUrl);
    const formData = new FormData();
    
    const imageFile = new File([blob], `${imageId}.png`, { type: 'image/png' });
    formData.append('image', imageFile);
    
    if (metadata) {
      const metadataJson = JSON.stringify(metadata, null, 2);
      formData.append('metadata', metadataJson);
    }
    
    const apiUrl = getApiUrl();
    const response = await fetch(`${apiUrl}/api/projects/${projectId}/images/${imageId}`, {
      method: 'PUT',
      body: formData,
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to update image' }));
      throw new Error(errorData.error || 'Failed to update image');
    }
    
    const result = await response.json();
    return { success: true, message: result.message, imageUrl: result.imageUrl };
  } catch (error: any) {
    console.error('Update image error:', error);
    return { success: false, error: error.message || 'Failed to update image' };
  }
};

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


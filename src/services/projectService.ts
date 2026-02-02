/**
 * Project management service
 */

import { getApiUrl } from '../utils/imageUtils';

export interface Project {
  id: string;
  name: string;
  createdAt: number;
}

const apiUrl = getApiUrl();

/**
 * Get all projects
 */
export const getProjects = async (): Promise<Project[]> => {
  try {
    const response = await fetch(`${apiUrl}/api/projects`);
    if (!response.ok) {
      throw new Error('Failed to fetch projects');
    }
    const data = await response.json();
    return data.projects || [];
  } catch (error) {
    console.error('Failed to fetch projects:', error);
    return [];
  }
};

/**
 * Create a new project
 */
export const createProject = async (name: string): Promise<Project | null> => {
  try {
    const response = await fetch(`${apiUrl}/api/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to create project');
    }
    
    const data = await response.json();
    return data.project || null;
  } catch (error) {
    console.error('Failed to create project:', error);
    return null;
  }
};

/**
 * Get project settings
 */
export const getProjectSettings = async (
  projectId: string
): Promise<{
  prompt: string;
  aspectRatio: string;
  imageSize: string;
  batchCount: string;
  referenceImages: Array<{ filename: string; url: string }>;
  promptImages?: Array<{ filename: string; url: string }>;
  styleText?: string;
  styleImages?: Array<{ filename: string; url: string }>;
} | null> => {
  try {
    const response = await fetch(`${apiUrl}/api/projects/${projectId}/settings`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch project settings');
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to fetch project settings:', error);
    return null;
  }
};

/**
 * Save project settings
 */
export const saveProjectSettings = async (
  projectId: string,
  settings: {
    prompt: string;
    aspectRatio: string;
    imageSize: string;
    batchCount: string;
    promptImageFilenames?: string[];
    referenceImageFilenames?: string[];
    styleText?: string;
    styleImageFilenames?: string[];
  }
): Promise<boolean> => {
  try {
    const response = await fetch(`${apiUrl}/api/projects/${projectId}/settings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(settings),
    });
    
    return response.ok;
  } catch (error) {
    console.error('Failed to save project settings:', error);
    return false;
  }
};

/**
 * Upload reference image for settings
 */
export const uploadReferenceImageForSettings = async (
  projectId: string,
  imageFile: File
): Promise<{ success: boolean; imageUrl?: string; filename?: string; error?: string }> => {
  try {
    const formData = new FormData();
    formData.append('image', imageFile);
    
    const response = await fetch(`${apiUrl}/api/projects/${projectId}/settings/reference-images`, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(errorData.error || 'Upload failed');
    }
    
    const data = await response.json();
    return {
      success: true,
      imageUrl: data.imageUrl.startsWith('http') ? data.imageUrl : `${apiUrl}${data.imageUrl}`,
      filename: data.filename,
    };
  } catch (error: any) {
    console.error('Failed to upload reference image:', error);
    return {
      success: false,
      error: error.message || 'Failed to upload reference image',
    };
  }
};

/**
 * Delete reference image from settings
 */
export const deleteReferenceImageFromSettings = async (
  projectId: string,
  filename: string
): Promise<boolean> => {
  try {
    const response = await fetch(`${apiUrl}/api/projects/${projectId}/settings/reference-images/${filename}`, {
      method: 'DELETE',
    });
    
    return response.ok;
  } catch (error) {
    console.error('Failed to delete reference image:', error);
    return false;
  }
};

/**
 * Upload reference image for outputs (hash-based deduplication)
 */
export const uploadReferenceImageForOutputs = async (
  projectId: string,
  imageFile: File
): Promise<{ success: boolean; imageUrl?: string; filename?: string; error?: string }> => {
  try {
    const formData = new FormData();
    formData.append('image', imageFile);
    
    const response = await fetch(`${apiUrl}/api/projects/${projectId}/outputs/reference-images`, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(errorData.error || 'Upload failed');
    }
    
    const data = await response.json();
    return {
      success: true,
      imageUrl: data.imageUrl.startsWith('http') ? data.imageUrl : `${apiUrl}${data.imageUrl}`,
      filename: data.filename,
    };
  } catch (error: any) {
    console.error('Failed to upload reference image:', error);
    return {
      success: false,
      error: error.message || 'Failed to upload reference image',
    };
  }
};

/**
 * Copy reference images from outputs to settings
 */
export const copyReferenceImagesFromOutputsToSettings = async (
  projectId: string,
  filenames: string[]
): Promise<{ success: boolean; images?: Array<{ originalFilename: string; filename: string; imageUrl: string }>; error?: string }> => {
  try {
    const response = await fetch(`${apiUrl}/api/projects/${projectId}/settings/reference-images/copy-from-outputs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ filenames }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Copy failed' }));
      throw new Error(errorData.error || 'Copy failed');
    }
    
    const data = await response.json();
    return {
      success: true,
      images: data.images.map((img: any) => ({
        originalFilename: img.originalFilename,
        filename: img.filename,
        imageUrl: img.imageUrl.startsWith('http') ? img.imageUrl : `${apiUrl}${img.imageUrl}`,
      })),
    };
  } catch (error: any) {
    console.error('Failed to copy reference images:', error);
    return {
      success: false,
      error: error.message || 'Failed to copy reference images',
    };
  }
};


import { GeneratedImage } from '../types';
import { getApiUrl } from '../lib/imageUtils';

/**
 * Fetch all generated images from server for a project
 * @param projectId - Project ID (default: 'default')
 * @returns Promise resolving to array of GeneratedImage
 */
export const fetchGeneratedImages = async (projectId: string = 'default'): Promise<GeneratedImage[]> => {
  try {
    const apiUrl = getApiUrl();
    const response = await fetch(`${apiUrl}/api/files?projectId=${projectId}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch images');
    }
    
    const data = await response.json();
    
    // Convert server response to GeneratedImage format
    const images: GeneratedImage[] = data.files
      .filter((file: any) => file.metadata) // Only include files with metadata
      .map((file: any) => {
        // Construct full image URL (empty string if image is not yet generated)
        const imageUrl = file.imageUrl && file.imageUrl.trim() !== ''
          ? (file.imageUrl.startsWith('http') 
              ? file.imageUrl 
              : `${apiUrl}${file.imageUrl}`)
          : '';
        
        if (!file.metadata) {
          throw new Error(`Metadata missing for image ${file.id}`);
        }
        
        const metadata = {
          request: {
            prompt: file.metadata.request.prompt,
            ...(file.metadata.request.style && { style: file.metadata.request.style }),
            generationConfig: file.metadata.request.generationConfig || {},
          },
          response: file.metadata.response || undefined,
          generationTime: file.metadata.generationTime || file.generationTime || 0,
          bookmarked: file.metadata.bookmarked === true,
        };
        
        const promptText = metadata.request.prompt.text || file.prompt || '';
        const isGenerating = file.isGenerating === true || !imageUrl;
        
        return {
          id: file.id,
          url: imageUrl,
          prompt: promptText,
          timestamp: file.timestamp || 0,
          generationTime: metadata.generationTime,
          isGenerating,
          metadata,
        };
      });
    
    return images;
  } catch (error: any) {
    console.error('Failed to fetch generated images:', error);
    return [];
  }
};


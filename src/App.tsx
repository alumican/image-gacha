import React, { useState, useEffect, useRef } from 'react';
import { generateImage } from './services/geminiService';
import { uploadToServer, createMetadataOnServer, updateImageOnServer } from './services/uploadService';
import { fetchGeneratedImages } from './services/fetchService';
import { getProjects, createProject, getProjectSettings, saveProjectSettings, uploadReferenceImageForSettings, uploadReferenceImageForOutputs, deleteReferenceImageFromSettings, copyReferenceImagesFromOutputsToSettings, Project } from './services/projectService';
import { parseGachaPrompt, previewGachaPrompt } from './lib/gachaParser';
import { convertImageToFile, convertImageToBlob, getApiUrl } from './lib/imageUtils';
import { AspectRatio, ImageSize, ReferenceImage, GeneratedImage, Style } from './types';
import { Timer } from './utils/timer';
import { getCurrentProjectId, setCurrentProjectId as saveCurrentProjectId } from './utils/localStorage';
import { Button } from './components/ui/button';
import { Textarea } from './components/ui/textarea';
import { Card, CardContent } from './components/ui/card';
import { Label } from './components/ui/label';
import { Input } from './components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './components/ui/dialog';
import { HelpDialog } from './components/HelpDialog';
import { ExpandablePane } from './components/ExpandablePane';
import { ParameterCard } from './components/ParameterCard';
import { FormField } from './components/FormField';
import { SimpleSelect } from './components/SimpleSelect';
import { ModalSection } from './components/ModalSection';
import { BookmarkButton } from './components/BookmarkButton';
import { Toaster } from './components/ui/toaster';
import { useToast } from './components/ui/use-toast';
import { X, Upload, Download, Loader2, Pencil, Grid3x3, List, Search, Copy, Plus, RotateCcw, Bookmark, BookmarkCheck } from 'lucide-react';

const ThumbnailImage: React.FC<{
  initialUrl: string;
  fallbackUrl: string;
  alt: string;
  onImageClick: (url: string) => void;
}> = ({ initialUrl, fallbackUrl, alt, onImageClick }) => {
  const [imageUrl, setImageUrl] = useState<string>(initialUrl);
  
  return (
    <div 
      className="relative border rounded-md overflow-hidden bg-muted cursor-pointer group"
      style={{ width: '100px', height: '100px' }}
      onClick={() => onImageClick(imageUrl)}
    >
      <img
        src={imageUrl}
        alt={alt}
        className="w-full h-full object-contain"
        onError={() => {
          if (imageUrl !== fallbackUrl) {
            setImageUrl(fallbackUrl);
          }
        }}
      />
    </div>
  );
};

function App() {
  const { toast } = useToast();
  const [promptText, setPromptText] = useState<string>('');
  const [promptImages, setPromptImages] = useState<ReferenceImage[]>([]);
  const [refImages, setRefImages] = useState<ReferenceImage[]>([]);
  const [styleText, setStyleText] = useState<string>('');
  const [styleImages, setStyleImages] = useState<ReferenceImage[]>([]);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('auto');
  const [imageSize, setImageSize] = useState<ImageSize>('auto');
  const [batchCount, setBatchCount] = useState<string>('1');
  const [history, setHistory] = useState<GeneratedImage[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const timerRef = useRef<Timer | null>(null);
  const elapsedIntervalRef = useRef<number | null>(null);
  const generatingImagesRef = useRef<Set<string>>(new Set());
  const generatingTimersRef = useRef<Map<string, Timer>>(new Map());
  const [generatingElapsedTimes, setGeneratingElapsedTimes] = useState<Map<string, number>>(new Map());
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null);
  const [selectedThumbnailImage, setSelectedThumbnailImage] = useState<string | null>(null);
  const [promptPreview, setPromptPreview] = useState<string>('');
  const [helpDialogOpen, setHelpDialogOpen] = useState<{
    prompt: boolean;
    style: boolean;
    settings: boolean;
    batch: boolean;
  }>({
    prompt: false,
    style: false,
    settings: false,
    batch: false,
  });
  const [isPromptEditDialogOpen, setIsPromptEditDialogOpen] = useState<boolean>(false);
  const [editingPrompt, setEditingPrompt] = useState<string>('');
  const [viewMode, setViewMode] = useState<'large' | 'small'>('large');
  const [viewingImage, setViewingImage] = useState<GeneratedImage | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string>(() => {
    // Restore from localStorage on mount
    return getCurrentProjectId() || 'default';
  });
  const [isCreateProjectDialogOpen, setIsCreateProjectDialogOpen] = useState<boolean>(false);
  const [newProjectName, setNewProjectName] = useState<string>('');
  const [showBookmarkedOnly, setShowBookmarkedOnly] = useState<boolean>(false);

  const toggleBookmark = async (imageId: string) => {
    const image = history.find(img => img.id === imageId);
    if (!image) return;
    
    const newBookmarked = !image.metadata.bookmarked;
    const updatedImage = { ...image, metadata: { ...image.metadata, bookmarked: newBookmarked } };
    setHistory(prev => prev.map(img => 
      img.id === imageId ? updatedImage : img
    ));
    
    if (selectedImage && selectedImage.id === imageId) {
      setSelectedImage(updatedImage);
    }
    
    if (viewingImage && viewingImage.id === imageId) {
      setViewingImage(updatedImage);
    }
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/projects/${currentProjectId}/images/${imageId}/bookmark`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bookmarked: newBookmarked }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update bookmark');
      }
    } catch (error) {
      console.error('Failed to update bookmark on server:', error);
      toast({
        variant: "destructive",
        description: "Failed to save bookmark status.",
      });
    }
  };

  // Check for API key on mount
  useEffect(() => {
    const envKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!envKey) {
      toast({
        variant: "destructive",
        title: "API Key Not Found",
        description: "Please run 'npm run setup' to configure your API key.",
      });
    }
  }, []);

  useEffect(() => {
    const loadProjects = async () => {
      try {
        const projectList = await getProjects();
        setProjects(projectList);
        
        // Validate current project ID against available projects
        if (projectList.length > 0) {
          const savedProjectId = getCurrentProjectId();
          const isValidProject = projectList.find(p => p.id === currentProjectId);
          
          if (!isValidProject) {
            // If saved project doesn't exist, use saved one if valid, otherwise use first project
            const savedIsValid = savedProjectId && projectList.find(p => p.id === savedProjectId);
            const newProjectId = savedIsValid ? savedProjectId : projectList[0].id;
            setCurrentProjectId(newProjectId);
            saveCurrentProjectId(newProjectId);
          }
        }
      } catch (error) {
        console.warn('Failed to load projects:', error);
      }
    };
    loadProjects();
  }, []);

  // Save project ID to localStorage when it changes
  useEffect(() => {
    if (currentProjectId) {
      saveCurrentProjectId(currentProjectId);
    }
  }, [currentProjectId]);

  useEffect(() => {
    const loadImages = async () => {
      try {
        const images = await fetchGeneratedImages(currentProjectId);
        setHistory(images);
      } catch (error) {
        console.warn('Failed to load images from server:', error);
      }
    };
    loadImages();
  }, [currentProjectId]);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await getProjectSettings(currentProjectId);
        if (settings) {
          if (settings.prompt) setPromptText(settings.prompt);
          if (settings.aspectRatio) setAspectRatio(settings.aspectRatio as AspectRatio);
          if (settings.imageSize) setImageSize(settings.imageSize as ImageSize);
          if (settings.batchCount) setBatchCount(settings.batchCount);
          
          const apiUrl = getApiUrl();
          const refImagesList = settings.referenceImages.map((refImg) => ({
            id: Math.random().toString(36).substr(2, 9),
            data: refImg.url.startsWith('http') ? refImg.url : `${apiUrl}${refImg.url}`,
            mimeType: 'image/png', // Default, could be improved
            filename: refImg.filename,
          }));
          setRefImages(refImagesList);
          
          if (settings.promptImages) {
            const promptImagesList = settings.promptImages.map((refImg) => ({
              id: Math.random().toString(36).substr(2, 9),
              data: refImg.url.startsWith('http') ? refImg.url : `${apiUrl}${refImg.url}`,
              mimeType: 'image/png', // Default, could be improved
              filename: refImg.filename,
            }));
            setPromptImages(promptImagesList);
          }
          
          if (settings.styleImages) {
            const styleImagesList = settings.styleImages.map((refImg) => ({
              id: Math.random().toString(36).substr(2, 9),
              data: refImg.url.startsWith('http') ? refImg.url : `${apiUrl}${refImg.url}`,
              mimeType: 'image/png', // Default, could be improved
              filename: refImg.filename,
            }));
            setStyleImages(styleImagesList);
          }
          
          if (settings.styleText) {
            setStyleText(settings.styleText);
          }
        } else {
          // Reset to defaults
          setPromptText('');
          setAspectRatio('auto');
          setImageSize('auto');
          setBatchCount('1');
          setRefImages([]);
          setPromptImages([]);
          setStyleText('');
          setStyleImages([]);
        }
      } catch (error) {
        console.warn('Failed to load project settings:', error);
      }
    };
    if (currentProjectId) {
      loadSettings();
    }
  }, [currentProjectId]);

  useEffect(() => {
    if (promptText.trim()) {
      setPromptPreview(previewGachaPrompt(promptText));
    } else {
      setPromptPreview('');
    }
  }, [promptText]);

  // Update viewingImage when history is updated (e.g., when generation completes)
  useEffect(() => {
    if (viewingImage) {
      const updatedImage = history.find(img => img.id === viewingImage.id);
      if (updatedImage) {
        // Check if there are actual changes (e.g., response metadata was added, URL was set)
        const hasChanges = 
          updatedImage.url !== viewingImage.url ||
          updatedImage.isGenerating !== viewingImage.isGenerating ||
          JSON.stringify(updatedImage.metadata?.response) !== JSON.stringify(viewingImage.metadata?.response) ||
          updatedImage.generationTime !== viewingImage.generationTime;
        
        if (hasChanges) {
          setViewingImage(updatedImage);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history]);

  // Track elapsed time for generating images
  useEffect(() => {
    const generatingImages = history.filter(img => img.isGenerating);
    
    // Start timers for new generating images
    generatingImages.forEach(img => {
      if (!generatingTimersRef.current.has(img.id)) {
        const timer = new Timer();
        timer.start();
        generatingTimersRef.current.set(img.id, timer);
      }
    });
    
    // Stop timers for completed images
    const completedImageIds: string[] = [];
    generatingTimersRef.current.forEach((timer, imageId) => {
      const image = history.find(img => img.id === imageId);
      if (!image || !image.isGenerating) {
        timer.stop();
        completedImageIds.push(imageId);
      }
    });
    
    // Clean up completed timers
    completedImageIds.forEach(id => {
      generatingTimersRef.current.delete(id);
      setGeneratingElapsedTimes(prev => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
    });
    
    // Update elapsed times every second
    const interval = setInterval(() => {
      const elapsedTimes = new Map<string, number>();
      generatingTimersRef.current.forEach((timer, imageId) => {
        const elapsedSeconds = timer.getElapsedSeconds();
        elapsedTimes.set(imageId, elapsedSeconds);
      });
      
      if (elapsedTimes.size > 0) {
        setGeneratingElapsedTimes(elapsedTimes);
      }
    }, 1000);
    
    return () => {
      clearInterval(interval);
    };
  }, [history]);

  // Handle image generation for cards with isGenerating=true
  useEffect(() => {
    const generateImagesForCards = async () => {
      const generatingImages = history.filter(img => img.isGenerating && !generatingImagesRef.current.has(img.id));
      
      for (const image of generatingImages) {
        generatingImagesRef.current.add(image.id);
        
        // Start generation in background
        (async () => {
          try {
            const imageTimer = new Timer();
            imageTimer.start();
            
            const metadata = image.metadata;
            const request = metadata.request;
            const processedPrompt = request.prompt.text;
            const aspectRatio = request.generationConfig?.aspectRatio || 'auto';
            const imageSize = request.generationConfig?.imageSize || 'auto';
            
            // Reconstruct style from metadata
            const style: Style | undefined = request.style
              ? {
                  text: request.style.text,
                  images: request.style.images?.map((filename: string) => {
                    // Find image in styleImages or promptImages by filename
                    const found = [...styleImages, ...promptImages].find(img => img.filename === filename);
                    return found || {
                      id: Math.random().toString(36).substr(2, 9),
                      data: '',
                      mimeType: 'image/png',
                      filename,
                    };
                  }).filter((img: ReferenceImage) => img.data !== ''),
                }
              : undefined;
            
            // Reconstruct promptImages from metadata
            const promptImagesForGeneration: ReferenceImage[] = request.prompt.images?.map((filename: string) => {
              const found = [...promptImages, ...refImages].find(img => img.filename === filename);
              return found || {
                id: Math.random().toString(36).substr(2, 9),
                data: '',
                mimeType: 'image/png',
                filename,
              };
            }).filter((img: ReferenceImage) => img.data !== '') || [];
            
            const result = await generateImage(
              processedPrompt,
              { aspectRatio: aspectRatio as AspectRatio, imageSize: imageSize as ImageSize },
              style,
              promptImagesForGeneration.length > 0 ? promptImagesForGeneration : undefined
            );
            const generationTime = imageTimer.stop();
            
            // Update metadata with response
            const updatedMetadata = {
              ...metadata,
              response: {
                modelVersion: result.modelVersion,
                responseId: result.responseId,
                usageMetadata: result.usageMetadata,
              },
              generationTime,
            };
            
            // Update image on server
            const updateResult = await updateImageOnServer(image.id, result.imageUrl, updatedMetadata, currentProjectId);
            
            if (updateResult.success) {
              // Convert relative URL to absolute URL if needed
              let finalImageUrl = updateResult.imageUrl || result.imageUrl;
              if (finalImageUrl && !finalImageUrl.startsWith('http') && !finalImageUrl.startsWith('data:')) {
                const apiUrl = getApiUrl();
                finalImageUrl = `${apiUrl}${finalImageUrl.startsWith('/') ? finalImageUrl : `/${finalImageUrl}`}`;
              }
              
              // Update local state while preserving order
              setHistory((prev) => prev.map((img) => 
                img.id === image.id
                  ? {
                      ...img,
                      url: finalImageUrl,
                      isGenerating: false,
                      generationTime,
                      metadata: updatedMetadata,
                    }
                  : img
              ));
            }
          } catch (error: any) {
            console.error('Failed to generate image:', error);
            // Update image to show error state
            setHistory((prev) => prev.map((img) => 
              img.id === image.id
                ? {
                    ...img,
                    isGenerating: false,
                    url: '', // Keep empty URL to indicate error
                  }
                : img
            ));
            
            if (error.message === "API_KEY_EXPIRED" || error.message === "API_KEY_REQUIRED") {
              toast({
                variant: "destructive",
                title: "API Key Error",
                description: "API key is not set or expired. Please run 'npm run setup' to configure your API key.",
              });
            } else {
              toast({
                variant: "destructive",
                description: `Failed to generate image ${image.id}: ${error.message || "An unexpected error occurred."}`,
              });
            }
          } finally {
            generatingImagesRef.current.delete(image.id);
          }
        })();
      }
    };
    
    generateImagesForCards();
  }, [history, currentProjectId, styleImages, promptImages, refImages, toast]);

  const processFiles = async (files: FileList | File[], target: 'prompt' | 'reference' | 'style' = 'reference') => {
    for (const file of Array.from(files) as File[]) {
      // Only process image files
      if (!file.type.startsWith('image/')) continue;
      
      try {
        const result = await uploadReferenceImageForSettings(currentProjectId, file);
        if (result.success && result.imageUrl && result.filename) {
          // Check if this image already exists in other collections (by filename/hash)
          const existingInPrompt = promptImages.find(img => img.filename === result.filename);
          const existingInStyle = styleImages.find(img => img.filename === result.filename);
          
          // If already exists in another collection, reuse that image object
          const existingImage = existingInPrompt || existingInStyle;
          
          if (existingImage) {
          if (target === 'prompt' && !existingInPrompt) {
              setPromptImages((prev) => [...prev, existingImage]);
            } else if (target === 'style' && !existingInStyle) {
              setStyleImages((prev) => [...prev, existingImage]);
            }
            // If already in target collection, do nothing (no duplicate)
          } else {
            // New image - create new image object
            const newImage = {
              id: Math.random().toString(36).substr(2, 9),
              data: result.imageUrl!,
              mimeType: file.type,
              filename: result.filename,
            };
            
            if (target === 'prompt') {
              setPromptImages((prev) => [...prev, newImage]);
            } else if (target === 'reference') {
              setRefImages((prev) => [...prev, newImage]);
            } else if (target === 'style') {
              setStyleImages((prev) => [...prev, newImage]);
            }
          }
        } else {
          toast({
            variant: "destructive",
            description: result.error || "Failed to upload reference image.",
          });
        }
      } catch (error) {
        console.error('Failed to upload reference image:', error);
        toast({
          variant: "destructive",
          description: "Failed to upload reference image.",
        });
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, target: 'prompt' | 'reference' | 'style' = 'reference') => {
    const files = e.target.files;
    if (!files) return;
    processFiles(files, target);
  };

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>, target: 'prompt' | 'reference' | 'style' = 'reference') => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processFiles(files, target);
    }
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    
    try {
      const project = await createProject(newProjectName.trim());
      if (project) {
        const projectList = await getProjects();
        setProjects(projectList);
        setCurrentProjectId(project.id);
        setIsCreateProjectDialogOpen(false);
        setNewProjectName('');
        toast({
          description: "Project created successfully.",
        });
      } else {
        throw new Error('Failed to create project');
      }
    } catch (error) {
      console.error('Failed to create project:', error);
      toast({
        variant: "destructive",
        description: "Failed to create project.",
      });
    }
  };

  const removePromptImage = async (id: string) => {
    const imageToRemove = promptImages.find(img => img.id === id);
    if (imageToRemove && imageToRemove.filename) {
      // Check if the same image is used in style images
      const isUsedInStyle = styleImages.some(img => img.filename === imageToRemove.filename);
      
      // Only delete from server if not used in other places
      if (!isUsedInStyle) {
        try {
          await deleteReferenceImageFromSettings(currentProjectId, imageToRemove.filename);
        } catch (error) {
          console.warn('Failed to delete prompt image from server:', error);
        }
      }
    }
    setPromptImages((prev) => prev.filter((img) => img.id !== id));
  };

  const removeStyleImage = async (id: string) => {
    const imageToRemove = styleImages.find(img => img.id === id);
    if (imageToRemove && imageToRemove.filename) {
      // Check if the same image is used in prompt images
      const isUsedInPrompt = promptImages.some(img => img.filename === imageToRemove.filename);
      
      // Only delete from server if not used in other places
      if (!isUsedInPrompt) {
        try {
          await deleteReferenceImageFromSettings(currentProjectId, imageToRemove.filename);
        } catch (error) {
          console.warn('Failed to delete style image from server:', error);
        }
      }
    }
    setStyleImages((prev) => prev.filter((img) => img.id !== id));
  };



  const handleSaveSettings = async (): Promise<boolean> => {
    try {
      const promptImageFilenames = promptImages.map(img => img.filename || '').filter(Boolean);
      const referenceImageFilenames = refImages.map(img => img.filename || '').filter(Boolean);
      const styleImageFilenames = styleImages.map(img => img.filename || '').filter(Boolean);
      const success = await saveProjectSettings(currentProjectId, {
        prompt: promptText,
        aspectRatio,
        imageSize,
        batchCount,
        promptImageFilenames: promptImageFilenames.length > 0 ? promptImageFilenames : undefined,
        referenceImageFilenames,
        styleText: styleText.trim() || undefined,
        styleImageFilenames: styleImageFilenames.length > 0 ? styleImageFilenames : undefined,
      });
      
      if (success) {
        toast({
          description: "Settings saved.",
        });
        return true;
      } else {
        throw new Error('Failed to save settings');
      }
    } catch (error) {
      console.warn('Failed to save settings:', error);
      toast({
        variant: "destructive",
        description: "Failed to save settings.",
      });
      return false;
    }
  };

  const handleGenerate = async () => {
    if (!promptText.trim()) {
      toast({
        variant: "destructive",
        description: "Please enter a prompt.",
      });
      return;
    }

    await handleSaveSettings();

    const count = parseInt(batchCount.trim() || '1', 10);
    const totalBatchSize = isNaN(count) || count < 1 ? 1 : count;

    try {
      const promptImageFilenames: string[] = [];
      const styleImageFilenames: string[] = [];
      for (const promptImage of promptImages) {
        try {
          const file = await convertImageToFile(
            promptImage.data,
            promptImage.filename || 'ref-image.png',
            promptImage.mimeType
          );
          
          const uploadResult = await uploadReferenceImageForOutputs(currentProjectId, file);
          if (uploadResult.success && uploadResult.filename) {
            promptImageFilenames.push(uploadResult.filename);
          }
        } catch (error) {
          console.warn('Failed to upload prompt image for output:', error);
        }
      }
      
      for (const refImage of refImages) {
        try {
          const file = await convertImageToFile(
            refImage.data,
            refImage.filename || 'ref-image.png',
            refImage.mimeType
          );
          
          const uploadResult = await uploadReferenceImageForOutputs(currentProjectId, file);
          if (uploadResult.success && uploadResult.filename) {
            if (!promptImageFilenames.includes(uploadResult.filename)) {
              promptImageFilenames.push(uploadResult.filename);
            }
          }
        } catch (error) {
          console.warn('Failed to upload reference image for output:', error);
        }
      }
      for (const styleImage of styleImages) {
        try {
          const file = await convertImageToFile(
            styleImage.data,
            styleImage.filename || 'ref-image.png',
            styleImage.mimeType
          );
          
          const uploadResult = await uploadReferenceImageForOutputs(currentProjectId, file);
          if (uploadResult.success && uploadResult.filename) {
            styleImageFilenames.push(uploadResult.filename);
          }
        } catch (error) {
          console.warn('Failed to upload style image for output:', error);
        }
      }

      const processedPrompt = parseGachaPrompt(promptText);
      const style: Style | undefined = 
        (styleText.trim() || styleImages.length > 0)
          ? {
              text: styleText.trim() || undefined,
              images: styleImages.length > 0 ? styleImages : undefined,
            }
          : undefined;

      // Create image cards with metadata only (before generation)
      const baseTimestamp = Date.now();
      const newImages: GeneratedImage[] = [];
      for (let i = 0; i < totalBatchSize; i++) {
        const imageId = `${baseTimestamp}-${i}-${Math.round(Math.random() * 1E9)}`;
        const timestamp = baseTimestamp;
        
        const metadata = {
          request: {
            prompt: {
              text: processedPrompt,
              ...(promptImageFilenames.length > 0 && { images: promptImageFilenames }),
              ...(promptText !== processedPrompt && { original: promptText }),
            },
            ...(style && (style.text || styleImageFilenames.length > 0) && {
              style: {
                ...(style.text && { text: style.text }),
                ...(styleImageFilenames.length > 0 && { images: styleImageFilenames }),
              },
            }),
            generationConfig: {
              ...(aspectRatio !== 'auto' && { aspectRatio }),
              ...(imageSize !== 'auto' && { imageSize }),
            },
          },
          bookmarked: false,
        };

        // Create metadata on server
        try {
          await createMetadataOnServer(imageId, metadata, currentProjectId);
        } catch (error) {
          console.warn('Failed to create metadata on server:', error);
        }

        const newImage: GeneratedImage = {
          id: imageId,
          url: '', // Empty URL indicates image is being generated
          prompt: processedPrompt,
          timestamp,
          isGenerating: true,
          metadata,
        };

        newImages.push(newImage);
      }

      // Sort newImages by batch index (larger index first) to ensure correct order
      // Image ID format: ${timestamp}-${i}-${random}
      newImages.sort((a, b) => {
        const extractBatchIndex = (id: string): number => {
          const parts = id.split('-');
          if (parts.length >= 2) {
            const index = parseInt(parts[1], 10);
            return isNaN(index) ? 0 : index;
          }
          return 0;
        };
        const indexA = extractBatchIndex(a.id);
        const indexB = extractBatchIndex(b.id);
        return indexB - indexA; // Descending order (larger index first)
      });

      // Add new images to history
      setHistory((prev) => [...newImages, ...prev]);

      // Save project settings
      try {
        const promptImageFilenames = promptImages.map(img => img.filename || '').filter(Boolean);
        const referenceImageFilenames = refImages.map(img => img.filename || '').filter(Boolean);
        const styleImageFilenames = styleImages.map(img => img.filename || '').filter(Boolean);
        await saveProjectSettings(currentProjectId, {
          prompt: promptText,
          aspectRatio,
          imageSize,
          batchCount,
          promptImageFilenames: promptImageFilenames.length > 0 ? promptImageFilenames : undefined,
          referenceImageFilenames,
          styleText: styleText.trim() || undefined,
          styleImageFilenames: styleImageFilenames.length > 0 ? styleImageFilenames : undefined,
        });
      } catch (error) {
        console.warn('Failed to save prompt settings:', error);
      }
    } catch (err: any) {
      if (err.message === "API_KEY_EXPIRED" || err.message === "API_KEY_REQUIRED") {
        toast({
          variant: "destructive",
          title: "API Key Error",
          description: "API key is not set or expired. Please run 'npm run setup' to configure your API key.",
        });
      } else {
        toast({
          variant: "destructive",
          description: err.message || "An unexpected error occurred.",
        });
      }
    }
  };

  /**
   * Download image and JSON metadata as a set
   */
  const downloadImage = async (imageUrl: string, filename: string = 'image.png') => {
    try {
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
    } catch (error) {
      console.error('Download error:', error);
      toast({
        variant: "destructive",
        description: "Failed to download image.",
      });
    }
  };

  const downloadImageWithMetadata = async (image: GeneratedImage) => {
    const baseFilename = `gemini-gen-${image.id}`;
    
    try {
      // Download image only
      await downloadImage(image.url, `${baseFilename}.png`);

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
    } catch (error) {
      console.error('Failed to download image:', error);
      toast({
        variant: "destructive",
        description: "Failed to download image.",
      });
    }
  };

  // Restore input parameters from image metadata
  const restoreParametersFromImage = async (image: GeneratedImage) => {
    try {
      if (!image.metadata?.request) {
        toast({
          variant: "destructive",
          description: "Metadata not found.",
        });
        return;
      }

      const { request } = image.metadata;
      const apiUrl = getApiUrl();

      // Collect all image filenames that need to be copied from outputs to settings
      const imageFilenamesToCopy: string[] = [];
      if (request.prompt.images && request.prompt.images.length > 0) {
        imageFilenamesToCopy.push(...request.prompt.images);
      }
      if (request.style?.images && request.style.images.length > 0) {
        imageFilenamesToCopy.push(...request.style.images);
      }

      // Copy images from outputs/reference-images to settings/reference-images
      // Create a map of original filename to copied image info for quick lookup
      const copiedImagesMap = new Map<string, { filename: string; imageUrl: string }>();
      if (imageFilenamesToCopy.length > 0) {
        const copyResult = await copyReferenceImagesFromOutputsToSettings(currentProjectId, imageFilenamesToCopy);
        if (copyResult.success && copyResult.images) {
          for (const img of copyResult.images) {
            copiedImagesMap.set(img.originalFilename, {
              filename: img.filename,
              imageUrl: img.imageUrl,
            });
          }
        } else {
          console.warn('Failed to copy some images from outputs to settings:', copyResult.error);
        }
      }

      const promptTextToRestore = request.prompt.original || request.prompt.text || '';
      setPromptText(promptTextToRestore);
      if (request.prompt.images && request.prompt.images.length > 0) {
        const promptImagesList: ReferenceImage[] = [];
        for (const originalFilename of request.prompt.images) {
          const copiedImage = copiedImagesMap.get(originalFilename);
          if (copiedImage) {
            // Use the copied image from settings
            promptImagesList.push({
              id: Math.random().toString(36).substr(2, 9),
              data: copiedImage.imageUrl,
              mimeType: 'image/png', // Default, actual type doesn't matter for display
              filename: copiedImage.filename,
            });
          } else {
            // Fallback: try to load from settings (in case it already exists)
            try {
              const settingsImageUrl = `${apiUrl}/uploads/projects/${currentProjectId}/settings/reference-images/${originalFilename}`;
              const settingsResponse = await fetch(settingsImageUrl);
              if (settingsResponse.ok) {
                const imageMimeType = settingsResponse.headers.get('content-type') || 'image/png';
                promptImagesList.push({
                  id: Math.random().toString(36).substr(2, 9),
                  data: settingsImageUrl.startsWith('http') ? settingsImageUrl : `${apiUrl}${settingsImageUrl}`,
                  mimeType: imageMimeType,
                  filename: originalFilename,
                });
              } else {
                console.warn(`Image not found in settings: ${originalFilename}`);
              }
            } catch (error) {
              console.warn(`Failed to load prompt image ${originalFilename}:`, error);
            }
          }
        }
        setPromptImages(promptImagesList);
      } else {
        setPromptImages([]);
      }

      const styleTextToRestore = request.style?.text || '';
      setStyleText(styleTextToRestore);
      if (request.style?.images && request.style.images.length > 0) {
        const styleImagesList: ReferenceImage[] = [];
        for (const originalFilename of request.style.images) {
          const copiedImage = copiedImagesMap.get(originalFilename);
          if (copiedImage) {
            // Use the copied image from settings
            styleImagesList.push({
              id: Math.random().toString(36).substr(2, 9),
              data: copiedImage.imageUrl,
              mimeType: 'image/png', // Default, actual type doesn't matter for display
              filename: copiedImage.filename,
            });
          } else {
            // Fallback: try to load from settings (in case it already exists)
            try {
              const settingsImageUrl = `${apiUrl}/uploads/projects/${currentProjectId}/settings/reference-images/${originalFilename}`;
              const settingsResponse = await fetch(settingsImageUrl);
              if (settingsResponse.ok) {
                const imageMimeType = settingsResponse.headers.get('content-type') || 'image/png';
                styleImagesList.push({
                  id: Math.random().toString(36).substr(2, 9),
                  data: settingsImageUrl.startsWith('http') ? settingsImageUrl : `${apiUrl}${settingsImageUrl}`,
                  mimeType: imageMimeType,
                  filename: originalFilename,
                });
              } else {
                console.warn(`Image not found in settings: ${originalFilename}`);
              }
            } catch (error) {
              console.warn(`Failed to load style image ${originalFilename}:`, error);
            }
          }
        }
        setStyleImages(styleImagesList);
      } else {
        setStyleImages([]);
      }

      if (request.generationConfig) {
        setAspectRatio(request.generationConfig.aspectRatio || 'auto');
        setImageSize(request.generationConfig.imageSize || 'auto');
      } else {
        setAspectRatio('auto');
        setImageSize('auto');
      }

      toast({
        description: "Parameters restored from image metadata.",
      });
    } catch (error) {
      console.error('Failed to restore parameters:', error);
      toast({
        variant: "destructive",
        description: "Failed to restore parameters.",
      });
    }
  };

  const aspectRatios: AspectRatio[] = [
    '1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'
  ];

  const imageSizes: ImageSize[] = ['1K', '2K', '4K'];

  return (
    <div className="min-h-screen bg-background">
      <div className="w-full px-4 py-8">
        {/* Header */}
        <header className="mb-12 border-b pb-8">
          <div className="flex flex-col md:flex-row md:items-end gap-8">
                <div className="flex flex-col">
                  <h1 className="text-4xl font-bold tracking-tight mb-2">
                    Image Gacha
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    GACHA NOTATIONAL GENERATION
                  </p>
                </div>
                <div className="flex flex-col">
                  <p className="text-sm font-semibold uppercase tracking-wider mb-2">
                    PROJECTS
                  </p>
                  <div className="flex items-center gap-2">
                    <SimpleSelect
                      value={currentProjectId}
                      onValueChange={setCurrentProjectId}
                      options={projects.map((project) => ({
                        value: project.id,
                        label: project.name,
                      }))}
                      className="w-[200px]"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setIsCreateProjectDialogOpen(true)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground ml-2">
                      {currentProjectId}
                    </p>
                  </div>
                </div>
            <div className="flex items-center gap-4 ml-auto">
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <a 
                  href="https://ai.google.dev/gemini-api/docs" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="hover:text-foreground transition-colors"
                >
                  API Documentation
                </a>
                <a 
                  href="https://docs.cloud.google.com/vertex-ai/generative-ai/pricing" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="hover:text-foreground transition-colors"
                >
                  Billing Documentation
                </a>
              </div>
            </div>
          </div>
        </header>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar / Controls */}
          <aside className="w-full lg:w-[380px] lg:flex-shrink-0 space-y-6">
            <ParameterCard
              number="01"
              title="PROMPT"
              onHelpClick={() => setHelpDialogOpen({ ...helpDialogOpen, prompt: true })}
              contentClassName="space-y-4"
            >
                <FormField label="Text">
                  <ExpandablePane
                    initialHeight={120}
                    minHeight={80}
                    maxHeight={600}
                    className="relative"
                  >
                    <Textarea
                      value={promptText}
                      onChange={(e) => setPromptText(e.target.value)}
                      placeholder="Describe the image you want to generate...&#10;Example: a beautiful {{cat,dog,bird}}(2) in the garden"
                      className="resize-none font-mono text-sm pr-10 h-full"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute bottom-2 right-2 h-8 w-8 text-muted-foreground hover:text-foreground z-10"
                      onClick={() => {
                        setEditingPrompt(promptText);
                        setIsPromptEditDialogOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </ExpandablePane>
                  {promptPreview && promptPreview !== promptText && (
                    <div className="p-3 bg-muted rounded-md border border-dashed">
                      <p className="text-xs text-muted-foreground mb-1">Preview:</p>
                      <p className="text-sm font-mono">{promptPreview}</p>
                    </div>
                  )}
                </FormField>
                <FormField label="Images">
                  <div className="grid grid-cols-3 gap-2">
                    {promptImages.map((img) => (
                      <div key={img.id} className="relative bg-muted aspect-square group cursor-pointer" onClick={() => setSelectedThumbnailImage(img.data)}>
                        <img 
                          src={img.data} 
                          alt="Prompt" 
                          className="w-full h-full object-contain rounded-md border"
                        />
                        <Button
                          variant="destructive"
                          size="icon"
                          className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            removePromptImage(img.id);
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                    <label 
                      className={`aspect-square border-2 border-dashed rounded-md flex flex-col items-center justify-center cursor-pointer transition-colors ${
                        isDragging 
                          ? 'bg-accent border-primary border-solid' 
                          : 'hover:bg-accent'
                      }`}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, 'prompt')}
                    >
                      <Upload className="h-6 w-6 mb-1 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">UPLOAD</span>
                      <input 
                        type="file" 
                        multiple 
                        accept="image/*" 
                        onChange={(e) => handleFileChange(e, 'prompt')} 
                        className="hidden" 
                      />
                    </label>
                  </div>
                </FormField>
            </ParameterCard>

            {/* Style Reference */}
            <ParameterCard
              number="02"
              title="STYLE REFERENCE"
              onHelpClick={() => setHelpDialogOpen({ ...helpDialogOpen, style: true })}
              contentClassName="space-y-4"
            >
                <FormField label="Text">
                  <ExpandablePane
                    initialHeight={120}
                    minHeight={80}
                    maxHeight={600}
                    className="relative"
                  >
                    <Textarea
                      value={styleText}
                      onChange={(e) => setStyleText(e.target.value)}
                      placeholder="Describe the style you want to reference..."
                      className="resize-none font-mono text-sm h-full"
                    />
                  </ExpandablePane>
                </FormField>
                <FormField label="Images">
                  <div className="grid grid-cols-3 gap-2">
                    {styleImages.map((img) => (
                      <div key={img.id} className="relative bg-muted aspect-square group cursor-pointer" onClick={() => setSelectedThumbnailImage(img.data)}>
                        <img 
                          src={img.data} 
                          alt="Style Reference" 
                          className="w-full h-full object-contain rounded-md border"
                        />
                        <Button
                          variant="destructive"
                          size="icon"
                          className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeStyleImage(img.id);
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                    <label 
                      className={`aspect-square border-2 border-dashed rounded-md flex flex-col items-center justify-center cursor-pointer transition-colors ${
                        isDragging 
                          ? 'bg-accent border-primary border-solid' 
                          : 'hover:bg-accent'
                      }`}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, 'style')}
                    >
                      <Upload className="h-6 w-6 mb-1 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">UPLOAD</span>
                      <input 
                        type="file" 
                        multiple 
                        accept="image/*" 
                        onChange={(e) => handleFileChange(e, 'style')} 
                        className="hidden" 
                      />
                    </label>
                  </div>
                </FormField>
            </ParameterCard>

            {/* Settings */}
            <ParameterCard
              number="03"
              title="SETTINGS"
              onHelpClick={() => setHelpDialogOpen({ ...helpDialogOpen, settings: true })}
              contentClassName="space-y-6"
            >
                <FormField label="Aspect Ratio">
                  <SimpleSelect
                    value={aspectRatio}
                    onValueChange={(value) => setAspectRatio(value as AspectRatio)}
                    options={[
                      { value: 'auto', label: 'Not specified' },
                      ...aspectRatios.map((ratio) => ({ value: ratio, label: ratio })),
                    ]}
                  />
                </FormField>

                <FormField label="Image Size">
                  <SimpleSelect
                    value={imageSize}
                    onValueChange={(value) => setImageSize(value as ImageSize)}
                    options={[
                      { value: 'auto', label: 'Not specified' },
                      ...imageSizes.map((size) => ({ value: size, label: size })),
                    ]}
                  />
                </FormField>
            </ParameterCard>

            {/* Batch Count Setting */}
            <ParameterCard
              number="04"
              title="BATCH COUNT"
              onHelpClick={() => setHelpDialogOpen({ ...helpDialogOpen, batch: true })}
            >
                <FormField label="Number of Images" htmlFor="batch-count">
                  <Input
                    id="batch-count"
                    type="text"
                    inputMode="numeric"
                    value={batchCount}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Allow empty string or numeric values
                      if (value === '' || /^\d+$/.test(value)) {
                        setBatchCount(value);
                      }
                    }}
                    placeholder="1"
                    className="font-mono"
                  />
                </FormField>
            </ParameterCard>

            {/* Save Button */}
            <Button
              variant="outline"
              onClick={handleSaveSettings}
              className="w-full border-primary"
              size="lg"
            >
              SAVE
            </Button>

            {/* Action Button */}
            <Button
              onClick={handleGenerate}
              className="w-full"
              size="lg"
            >
              GENERATE IMAGE
            </Button>
          </aside>

          {/* Output / History Section */}
          <main className="flex-1 space-y-8 min-w-0">
            {/* View controls */}
            {history.length > 0 && (
              <div className="flex items-center justify-between gap-4 pb-4 border-b">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1 border rounded-md p-1">
                    <Button
                      variant={viewMode === 'large' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('large')}
                      className="h-8"
                    >
                      <List className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={viewMode === 'small' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('small')}
                      className="h-8"
                    >
                      <Grid3x3 className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button
                    variant={showBookmarkedOnly ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setShowBookmarkedOnly(!showBookmarkedOnly)}
                    className="h-8"
                    title={showBookmarkedOnly ? "Show all images" : "Show bookmarked only"}
                  >
                    {showBookmarkedOnly ? (
                      <BookmarkCheck className="h-4 w-4 fill-current" />
                    ) : (
                      <Bookmark className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            )}
            {history.length === 0 && (
              viewMode === 'large' ? (
                <Card>
                  <CardContent className="pt-6">
                    <div className="w-full max-h-[500px] flex flex-col items-center justify-center text-muted-foreground min-h-[300px] border rounded-lg">
                      <p className="text-sm uppercase tracking-wider">
                        No images generated yet
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="flex flex-wrap gap-4">
                  <div className="w-[200px] h-[200px] rounded-lg border overflow-hidden bg-muted flex items-center justify-center flex-shrink-0">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">
                      No images
                    </p>
                  </div>
                </div>
              )
            )}

            <div className="flex flex-wrap gap-4">
              {history
                .filter(item => !showBookmarkedOnly || item.metadata.bookmarked === true)
                .map((item, idx) => (
                viewMode === 'large' ? (
                  <Card key={item.id} className="w-full max-w-2xl">
                    <CardContent className="pt-6">
                      <div className="space-y-4">
                        <div className="relative group">
                          <div className="w-full max-h-[500px] flex items-center justify-center bg-muted rounded-lg border overflow-hidden min-h-[300px]"
                               onClick={() => !item.isGenerating && setSelectedImage(item)}>
                            {item.isGenerating || !item.url ? (
                              <div className="flex flex-col items-center justify-center">
                                <Loader2 className="h-12 w-12 animate-spin text-muted-foreground mb-4" />
                                <p className="text-sm text-muted-foreground uppercase tracking-wider mb-1">
                                  Generating...
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {generatingElapsedTimes.get(item.id) || 0}s
                                </p>
                              </div>
                            ) : (
                              <img 
                                src={item.url} 
                                alt={`Generated ${idx}`} 
                                className="max-w-full max-h-[500px] object-contain cursor-pointer hover:opacity-90 transition-opacity"
                                style={{ objectFit: 'contain' }}
                              />
                            )}
                          </div>
                        </div>
                        
                        <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between">
                              <p 
                                className="text-xs uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  try {
                                    await navigator.clipboard.writeText(item.id);
                                    toast({
                                      description: "ID copied to clipboard.",
                                    });
                                  } catch (error) {
                                    console.error('Failed to copy ID:', error);
                                    toast({
                                      variant: "destructive",
                                      description: "Failed to copy ID.",
                                    });
                                  }
                                }}
                              >
                                #{item.id}
                              </p>
                              <span className="text-xs text-muted-foreground">
                                {item.isGenerating 
                                  ? (generatingElapsedTimes.get(item.id) || 0) + 's'
                                  : (item.generationTime !== undefined ? Math.round(item.generationTime / 1000) + 's' : '0s')
                                }
                              </span>
                            </div>
                            <p className="text-sm leading-relaxed line-clamp-3">{item.prompt}</p>
                          </div>
                          <div className="flex flex-col items-end gap-2 shrink-0">
                            <div className="grid grid-cols-2 gap-2">
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => setViewingImage(item)}
                              >
                                <Search className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => downloadImageWithMetadata(item)}
                                disabled={item.isGenerating || !item.url}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              <BookmarkButton
                                image={item}
                                onToggle={toggleBookmark}
                                disabled={item.isGenerating || !item.url}
                              />
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  restoreParametersFromImage(item);
                                }}
                                title="Restore parameters"
                              >
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <div
                    key={item.id}
                    className="relative w-[200px] h-[200px] rounded-lg border overflow-hidden bg-muted flex-shrink-0 group"
                    onClick={() => !item.isGenerating && setSelectedImage(item)}
                  >
                    {item.isGenerating || !item.url ? (
                      <div className="w-full h-full flex flex-col items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-2" />
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                          Generating...
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {generatingElapsedTimes.get(item.id) || 0}s
                        </p>
                      </div>
                    ) : (
                      <>
                        <img 
                          src={item.url} 
                          alt={`Generated ${idx}`} 
                          className="w-full h-full object-contain cursor-pointer hover:opacity-90 transition-opacity"
                          style={{ objectFit: 'contain' }}
                        />
                        {/* Bookmarked: Always show borderless icon */}
                        {item.metadata.bookmarked ? (
                          <div className="absolute bottom-2 right-2">
                            <button
                              className="p-1.5 rounded-full hover:bg-background/20 transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleBookmark(item.id);
                              }}
                              title="Remove bookmark"
                            >
                              <BookmarkCheck className="h-4 w-4 fill-current text-foreground" />
                            </button>
                          </div>
                        ) : (
                          /* Not bookmarked: Show overlay button on hover */
                          <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7 bg-background/90 backdrop-blur-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleBookmark(item.id);
                              }}
                              title="Add bookmark"
                            >
                              <Bookmark className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )
              ))}
            </div>
          </main>
        </div>

        <footer className="mt-16 pt-8 border-t text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} Yukiya Okuda</span>
        </footer>
      </div>

      {/* Image Preview Dialog */}
      <Dialog open={selectedImage !== null} onOpenChange={(open) => !open && setSelectedImage(null)}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-0">
          <div className="relative w-full h-full flex items-center justify-center bg-muted p-4">
            {selectedImage && (
              <>
                <img 
                  src={selectedImage.url} 
                  alt="Preview" 
                  className="max-w-full max-h-[85vh] object-contain rounded-lg"
                  style={{ objectFit: 'contain' }}
                />
                <div className="absolute bottom-4 right-4 flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setViewingImage(selectedImage)}
                  >
                    <Search className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => downloadImage(selectedImage.url, `gemini-gen-${selectedImage.id}.png`)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <BookmarkButton
                    image={selectedImage}
                    onToggle={toggleBookmark}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      restoreParametersFromImage(selectedImage);
                    }}
                    title="Restore parameters"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Prompt Edit Dialog */}
      <Dialog open={isPromptEditDialogOpen} onOpenChange={setIsPromptEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Edit Prompt</DialogTitle>
            <DialogDescription>
              Edit your prompt in a larger area
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Textarea
              value={editingPrompt}
              onChange={(e) => setEditingPrompt(e.target.value)}
              placeholder="生成したい画像を説明してください...&#10;例: a beautiful {{cat,dog,bird}}(2) in the garden"
              className="min-h-[400px] resize-none font-mono text-sm"
            />
            {editingPrompt && previewGachaPrompt(editingPrompt) !== editingPrompt && (
              <div className="p-3 bg-muted rounded-md border border-dashed">
                <p className="text-xs text-muted-foreground mb-1">プレビュー:</p>
                <p className="text-sm font-mono">{previewGachaPrompt(editingPrompt)}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPromptEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                setPromptText(editingPrompt);
                setIsPromptEditDialogOpen(false);

                try {
                  const promptImageFilenames = promptImages.map(img => img.filename || '').filter(Boolean);
                  const referenceImageFilenames = refImages.map(img => img.filename || '').filter(Boolean);
                  const styleImageFilenames = styleImages.map(img => img.filename || '').filter(Boolean);
                  const success = await saveProjectSettings(currentProjectId, {
                    prompt: editingPrompt,
                    aspectRatio,
                    imageSize,
                    batchCount,
                    promptImageFilenames: promptImageFilenames.length > 0 ? promptImageFilenames : undefined,
                    referenceImageFilenames,
                    styleText: styleText.trim() || undefined,
                    styleImageFilenames: styleImageFilenames.length > 0 ? styleImageFilenames : undefined,
                  });
                  
                  if (success) {
                    toast({
                      description: "Prompt settings saved.",
                    });
                  } else {
                    throw new Error('Failed to save settings');
                  }
                } catch (error) {
                  console.warn('Failed to save prompt settings:', error);
                  toast({
                    variant: "destructive",
                    description: "Failed to save prompt settings.",
                  });
                }
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Project Dialog */}
      <Dialog open={isCreateProjectDialogOpen} onOpenChange={setIsCreateProjectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
            <DialogDescription>
              Enter a name for the new project
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="project-name">Project Name</Label>
              <Input
                id="project-name"
                type="text"
                placeholder="My Project"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newProjectName.trim()) {
                    handleCreateProject();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsCreateProjectDialogOpen(false);
              setNewProjectName('');
            }}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateProject}
              disabled={!newProjectName.trim()}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Help Dialogs */}
      <HelpDialog
        open={helpDialogOpen.prompt}
        onOpenChange={(open) => setHelpDialogOpen({ ...helpDialogOpen, prompt: open })}
        title="01 / PROMPT"
      >
        <p className="text-sm">
          Enter text describing the image you want to generate.
        </p>
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-semibold">Gacha Notation</p>
            <p className="text-sm text-muted-foreground">
              You can use gacha notation to randomly select elements.
            </p>
            <div className="p-3 bg-muted rounded-md font-mono text-sm">
              {`{{AAA,BBB,CCC}}(2)`}
            </div>
            <p className="text-sm text-muted-foreground">
              This notation randomly selects 2 items from AAA, BBB, and CCC and embeds them into the prompt.
            </p>
            <p className="text-sm text-muted-foreground">
              You can specify a custom separator:
            </p>
            <div className="p-3 bg-muted rounded-md font-mono text-sm">
              {`{{AAA,BBB,CCC}}(2, ", ")`}
            </div>
            <p className="text-sm text-muted-foreground">
              Multi-line notation is also supported:
            </p>
            <div className="p-3 bg-muted rounded-md font-mono text-sm whitespace-pre">
              {`{{
   AAA,
   BBB,
   CCC
}}(2)`}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold">Images</p>
            <p className="text-sm text-muted-foreground">
              You can upload reference images for the image you want to generate.
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li>You can upload multiple images</li>
              <li>Uploaded images will be used as references during generation</li>
              <li>To delete an image, hover over it and click the × button</li>
              <li>You can drag and drop images directly onto the upload area</li>
            </ul>
          </div>
        </div>
      </HelpDialog>

      <HelpDialog
        open={helpDialogOpen.style}
        onOpenChange={(open) => setHelpDialogOpen({ ...helpDialogOpen, style: open })}
        title="02 / STYLE REFERENCE"
      >
        <p className="text-sm">
          Specify style reference using text and/or images. This helps guide the generation style.
        </p>
      </HelpDialog>

      <HelpDialog
        open={helpDialogOpen.settings}
        onOpenChange={(open) => setHelpDialogOpen({ ...helpDialogOpen, settings: open })}
        title="03 / SETTINGS"
      >
        <p className="text-sm">
          Configure detailed settings for image generation.
        </p>
        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold mb-2">Aspect Ratio</p>
            <p className="text-sm text-muted-foreground">
              Specify the aspect ratio of the generated image. If not specified, it will be determined automatically.
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Available aspect ratios: 1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold mb-2">Image Size</p>
            <p className="text-sm text-muted-foreground">
              Specify the resolution of the generated image. You can choose from 1K, 2K, or 4K. If not specified, it will be determined automatically.
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground mt-1">
              <li><strong>1K</strong>: 1024px equivalent resolution</li>
              <li><strong>2K</strong>: 2048px equivalent resolution</li>
              <li><strong>4K</strong>: 4096px equivalent resolution</li>
            </ul>
          </div>
        </div>
      </HelpDialog>

      <HelpDialog
        open={helpDialogOpen.batch}
        onOpenChange={(open) => setHelpDialogOpen({ ...helpDialogOpen, batch: open })}
        title="04 / BATCH COUNT"
      >
        <p className="text-sm">
          Number of images to generate in sequence. Gacha notation will be executed for each image.
        </p>
        <div className="space-y-2 mt-4">
          <p className="text-sm text-muted-foreground">
            When you set a batch count greater than 1, the system will generate multiple images in sequence. Each image generation will independently execute the gacha notation in your prompt, resulting in different random selections for each image.
          </p>
          <p className="text-sm text-muted-foreground">
            If the field is empty or contains an invalid value, it defaults to 1.
          </p>
        </div>
      </HelpDialog>

      {/* Prompt View Dialog */}
      <Dialog open={viewingImage !== null} onOpenChange={(open) => !open && setViewingImage(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Generation Parameters</DialogTitle>
          </DialogHeader>
          <div className="py-4 overflow-y-auto border border-border rounded-md p-4 max-h-[60vh] space-y-3">
            {viewingImage && (
              <>
                {/* Prompt */}
                {viewingImage.metadata?.request?.prompt && (
                  <ModalSection title="Prompt">
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Text</p>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{viewingImage.metadata.request.prompt.text}</p>
                      </div>
                      {viewingImage.metadata.request.prompt.original && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Original (with gacha notation):</p>
                          <p className="text-sm leading-relaxed whitespace-pre-wrap font-mono bg-muted p-2 rounded">{viewingImage.metadata.request.prompt.original}</p>
                        </div>
                      )}
                      {viewingImage.metadata.request.prompt.images && viewingImage.metadata.request.prompt.images.length > 0 && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-2">Images</p>
                          <div className="grid grid-cols-3 gap-2">
                            {viewingImage.metadata.request.prompt.images.map((filename: string, index: number) => {
                              const apiUrl = getApiUrl();
                              const settingsImageUrl = `${apiUrl}/uploads/projects/${currentProjectId}/settings/reference-images/${filename}`;
                              const outputsImageUrl = `${apiUrl}/uploads/projects/${currentProjectId}/outputs/reference-images/${filename}`;
                              return (
                                <ThumbnailImage
                                  key={index}
                                  initialUrl={settingsImageUrl}
                                  fallbackUrl={outputsImageUrl}
                                  alt={`Prompt Image ${index + 1}`}
                                  onImageClick={setSelectedThumbnailImage}
                                />
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </ModalSection>
                )}

                {/* Style Reference */}
                {viewingImage.metadata?.request?.style && (
                  <ModalSection title="Style Reference">
                    <div className="space-y-3">
                      {viewingImage.metadata.request.style.text && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Text</p>
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{viewingImage.metadata.request.style.text}</p>
                        </div>
                      )}
                      {viewingImage.metadata.request.style.images && viewingImage.metadata.request.style.images.length > 0 && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-2">Images</p>
                          <div className="flex flex-wrap gap-2">
                            {viewingImage.metadata.request.style.images.map((filename: string, index: number) => {
                              const apiUrl = getApiUrl();
                              const settingsImageUrl = `${apiUrl}/uploads/projects/${currentProjectId}/settings/reference-images/${filename}`;
                              const outputsImageUrl = `${apiUrl}/uploads/projects/${currentProjectId}/outputs/reference-images/${filename}`;
                              return (
                                <ThumbnailImage
                                  key={index}
                                  initialUrl={settingsImageUrl}
                                  fallbackUrl={outputsImageUrl}
                                  alt={`Style Reference Image ${index + 1}`}
                                  onImageClick={setSelectedThumbnailImage}
                                />
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </ModalSection>
                )}

                {/* Generation Config */}
                {viewingImage.metadata?.request?.generationConfig && (
                  <ModalSection title="Generation Config">
                    <div className="space-y-1 text-sm">
                      {viewingImage.metadata.request.generationConfig.aspectRatio && (
                        <div>
                          <span className="font-medium">Aspect Ratio: </span>
                          <span>{viewingImage.metadata.request.generationConfig.aspectRatio}</span>
                        </div>
                      )}
                      {viewingImage.metadata.request.generationConfig.imageSize && (
                        <div>
                          <span className="font-medium">Image Size: </span>
                          <span>{viewingImage.metadata.request.generationConfig.imageSize}</span>
                        </div>
                      )}
                    </div>
                  </ModalSection>
                )}

                {/* Response Metadata */}
                {viewingImage.metadata?.response && !viewingImage.isGenerating && (
                  <ModalSection title="Response Metadata">
                    <div className="space-y-1 text-sm">
                      {viewingImage.metadata.response.modelVersion && (
                        <div>
                          <span className="font-medium">Model Version: </span>
                          <span>{viewingImage.metadata.response.modelVersion}</span>
                        </div>
                      )}
                      {viewingImage.metadata.response.responseId && (
                        <div>
                          <span className="font-medium">Response ID: </span>
                          <span className="font-mono text-xs">{viewingImage.metadata.response.responseId}</span>
                        </div>
                      )}
                      {viewingImage.metadata.response.usageMetadata && (
                        <div>
                          <span className="font-medium">Usage: </span>
                          <span>{JSON.stringify(viewingImage.metadata.response.usageMetadata)}</span>
                        </div>
                      )}
                    </div>
                  </ModalSection>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="icon"
              onClick={async () => {
                if (viewingImage?.prompt) {
                  try {
                    const promptText = viewingImage.metadata?.request?.prompt?.text || viewingImage.prompt;
                    await navigator.clipboard.writeText(promptText);
                    toast({
                      description: "Prompt copied to clipboard.",
                    });
                  } catch (error) {
                    console.error('Failed to copy:', error);
                    toast({
                      variant: "destructive",
                      description: "Failed to copy prompt.",
                    });
                  }
                }
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={() => setViewingImage(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Thumbnail Image Preview Dialog */}
      <Dialog open={selectedThumbnailImage !== null} onOpenChange={(open) => !open && setSelectedThumbnailImage(null)}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-0">
          <div className="relative w-full h-full flex items-center justify-center bg-muted p-4">
            {selectedThumbnailImage && (
              <>
                <img 
                  src={selectedThumbnailImage} 
                  alt="Thumbnail Preview" 
                  className="max-w-full max-h-[85vh] object-contain rounded-lg"
                  style={{ objectFit: 'contain' }}
                />
                <div className="absolute bottom-4 right-4 flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      const filename = selectedThumbnailImage.split('/').pop() || 'image.png';
                      downloadImage(selectedThumbnailImage, filename);
                    }}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Toaster */}
      <Toaster />
    </div>
  );
}

export default App;


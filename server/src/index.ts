import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads');
const projectsDir = path.join(uploadsDir, 'projects');
fs.mkdir(uploadsDir, { recursive: true }).catch(console.error);
fs.mkdir(projectsDir, { recursive: true }).catch(console.error);

// Helper function to read or create project.json
const getOrCreateProjectJson = async (projectDir: string, projectId: string, defaultName?: string): Promise<{ projectId: string; projectName: string }> => {
  const projectJsonPath = path.join(projectDir, 'project.json');
  
  try {
    const content = await fs.readFile(projectJsonPath, 'utf-8');
    const projectData = JSON.parse(content);
    return {
      projectId: projectData.projectId || projectId,
      projectName: projectData.projectName || defaultName || projectId,
    };
  } catch {
    // project.json doesn't exist, create it
    const projectName = defaultName || (projectId === 'default' ? 'Default' : projectId);
    const projectData = {
      projectId,
      projectName,
    };
    await fs.writeFile(projectJsonPath, JSON.stringify(projectData, null, 2));
    return projectData;
  }
};

// Initialize default project
const initializeDefaultProject = async () => {
  const defaultProjectDir = path.join(projectsDir, 'default');
  const defaultOutputsDir = path.join(defaultProjectDir, 'outputs');
  const defaultGeneratedImagesDir = path.join(defaultOutputsDir, 'generated-images');
  const defaultOutputRefImagesDir = path.join(defaultOutputsDir, 'reference-images');
  const defaultSettingsDir = path.join(defaultProjectDir, 'settings');
  const defaultSettingsRefImagesDir = path.join(defaultSettingsDir, 'reference-images');
  
  await fs.mkdir(defaultProjectDir, { recursive: true });
  await fs.mkdir(defaultOutputsDir, { recursive: true });
  await fs.mkdir(defaultGeneratedImagesDir, { recursive: true });
  await fs.mkdir(defaultOutputRefImagesDir, { recursive: true });
  await fs.mkdir(defaultSettingsDir, { recursive: true });
  await fs.mkdir(defaultSettingsRefImagesDir, { recursive: true });
  
  // Create project.json for default project
  await getOrCreateProjectJson(defaultProjectDir, 'default', 'Default');
  
  // Initialize existing project "1768016808143-618481043" if it exists
  const existingProjectId = '1768016808143-618481043';
  const existingProjectDir = path.join(projectsDir, existingProjectId);
  try {
    const stat = await fs.stat(existingProjectDir);
    if (stat.isDirectory()) {
      await getOrCreateProjectJson(existingProjectDir, existingProjectId, 'Style Convert');
    }
  } catch {
    // Project doesn't exist, skip
  }
  
  // Move existing files to default project outputs/generated-images
  try {
    const files = await fs.readdir(uploadsDir);
    const imageFiles = files.filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f));
    const jsonFiles = files.filter(f => /\.json$/i.test(f));
    
    for (const imageFile of imageFiles) {
      const sourcePath = path.join(uploadsDir, imageFile);
      const destPath = path.join(defaultGeneratedImagesDir, imageFile);
      await fs.rename(sourcePath, destPath);
    }
    
    for (const jsonFile of jsonFiles) {
      const sourcePath = path.join(uploadsDir, jsonFile);
      const destPath = path.join(defaultGeneratedImagesDir, jsonFile);
      await fs.rename(sourcePath, destPath);
    }
  } catch (error) {
    // Ignore errors if files don't exist or already moved
  }
};

initializeDefaultProject().catch(console.error);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    await fs.mkdir(uploadsDir, { recursive: true });
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({ storage });

/**
 * Upload image and JSON metadata to project outputs
 * POST /api/upload
 * Body: FormData with 'image' (file), 'metadata' (JSON string), and 'projectId' (string)
 */
app.post('/api/upload', upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'metadata', maxCount: 1 }
]), async (req, res) => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const projectId = req.body.projectId || 'default';
    
    if (!files.image || !files.image[0]) {
      return res.status(400).json({ error: 'Image file is required' });
    }

    if (!files.metadata || !files.metadata[0]) {
      return res.status(400).json({ error: 'Metadata file is required' });
    }

    const imageFile = files.image[0];
    const metadataFile = files.metadata[0];

    // Read metadata JSON
    const metadataContent = await fs.readFile(metadataFile.path, 'utf-8');
    const metadata = JSON.parse(metadataContent);

    // Ensure project directories exist
    const projectDir = path.join(projectsDir, projectId);
    const outputsDir = path.join(projectDir, 'outputs');
    const generatedImagesDir = path.join(outputsDir, 'generated-images');
    await fs.mkdir(generatedImagesDir, { recursive: true });

    // Rename files to match (same base name)
    const baseName = path.parse(imageFile.filename).name.replace('image-', '');
    const imageExt = path.extname(imageFile.filename);
    const jsonPath = path.join(generatedImagesDir, `${baseName}.json`);
    const imagePath = path.join(generatedImagesDir, `${baseName}${imageExt}`);

    // Rename files
    await fs.rename(imageFile.path, imagePath);
    await fs.rename(metadataFile.path, jsonPath);

    res.json({
      success: true,
      message: 'Files uploaded successfully',
      files: {
        image: path.basename(imagePath),
        metadata: path.basename(jsonPath)
      }
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

/**
 * Create metadata JSON file for an image (before image generation)
 * POST /api/projects/:projectId/images/:imageId/metadata
 * Body: { metadata: object }
 */
app.post('/api/projects/:projectId/images/:imageId/metadata', async (req, res) => {
  try {
    const { projectId, imageId } = req.params;
    const { metadata } = req.body;
    
    if (!metadata || typeof metadata !== 'object') {
      return res.status(400).json({ error: 'Metadata object is required' });
    }
    
    const projectDir = path.join(projectsDir, projectId);
    const generatedImagesDir = path.join(projectDir, 'outputs', 'generated-images');
    await fs.mkdir(generatedImagesDir, { recursive: true });
    
    const jsonPath = path.join(generatedImagesDir, `${imageId}.json`);
    
    // Write metadata JSON file
    await fs.writeFile(jsonPath, JSON.stringify(metadata, null, 2));
    
    res.json({
      success: true,
      message: 'Metadata created successfully',
      imageId,
    });
  } catch (error: any) {
    console.error('Create metadata error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

/**
 * Update image and metadata (after image generation)
 * PUT /api/projects/:projectId/images/:imageId
 * Body: FormData with 'image' (file) and optional 'metadata' (JSON string)
 */
app.put('/api/projects/:projectId/images/:imageId', upload.single('image'), async (req, res) => {
  try {
    const { projectId, imageId } = req.params;
    
    if (!req.file) {
      return res.status(400).json({ error: 'Image file is required' });
    }
    
    const projectDir = path.join(projectsDir, projectId);
    const generatedImagesDir = path.join(projectDir, 'outputs', 'generated-images');
    await fs.mkdir(generatedImagesDir, { recursive: true });
    
    const imageExt = path.extname(req.file.filename);
    const imagePath = path.join(generatedImagesDir, `${imageId}${imageExt}`);
    const jsonPath = path.join(generatedImagesDir, `${imageId}.json`);
    
    // Move uploaded image file
    await fs.rename(req.file.path, imagePath);
    
    // Update metadata if provided
    if (req.body.metadata) {
      let metadata;
      try {
        metadata = JSON.parse(req.body.metadata);
      } catch {
        return res.status(400).json({ error: 'Invalid metadata JSON' });
      }
      
      // Read existing metadata if it exists, otherwise use provided metadata
      let existingMetadata = metadata;
      try {
        const existingContent = await fs.readFile(jsonPath, 'utf-8');
        existingMetadata = JSON.parse(existingContent);
        // Merge with provided metadata (provided metadata takes precedence)
        existingMetadata = { ...existingMetadata, ...metadata };
      } catch {
        // JSON file doesn't exist, use provided metadata
      }
      
      await fs.writeFile(jsonPath, JSON.stringify(existingMetadata, null, 2));
    }
    
    res.json({
      success: true,
      message: 'Image and metadata updated successfully',
      imageId,
      imageUrl: `/uploads/projects/${projectId}/outputs/generated-images/${imageId}${imageExt}`,
    });
  } catch (error: any) {
    console.error('Update image error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

/**
 * Get list of uploaded files for a project (latest first)
 * GET /api/files?projectId=default
 */
app.get('/api/files', async (req, res) => {
  try {
    const projectId = req.query.projectId as string || 'default';
    const projectDir = path.join(projectsDir, projectId);
    const generatedImagesDir = path.join(projectDir, 'outputs', 'generated-images');
    
    // Check if project exists
    try {
      await fs.access(generatedImagesDir);
    } catch {
      return res.json({ files: [] });
    }
    
    const files = await fs.readdir(generatedImagesDir);
    const jsonFiles = files.filter(f => /\.json$/i.test(f));
    
    const fileList = await Promise.all(
      jsonFiles.map(async (jsonFile) => {
        const baseName = path.parse(jsonFile).name;
        const jsonPath = path.join(generatedImagesDir, jsonFile);
        
        let metadata = null;
        try {
          const metadataContent = await fs.readFile(jsonPath, 'utf-8');
          metadata = JSON.parse(metadataContent);
        } catch {
          // JSON file doesn't exist or invalid, skip
          return null;
        }

        // Extract image ID from filename
        const imageId = baseName;
        
        // Check if image file exists
        const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp'];
        let imageUrl = '';
        let imageExists = false;
        
        for (const ext of imageExtensions) {
          const imagePath = path.join(generatedImagesDir, `${imageId}${ext}`);
          try {
            await fs.access(imagePath);
            imageUrl = `/uploads/projects/${projectId}/outputs/generated-images/${imageId}${ext}`;
            imageExists = true;
            break;
          } catch {
            // Image file doesn't exist with this extension, try next
          }
        }
        
        // If no image file exists, use placeholder
        if (!imageExists) {
          imageUrl = ''; // Empty string indicates image is not yet generated
        }
        
        // Extract timestamp from metadata or filename
        let timestamp = 0;
        if (metadata?.request?.timestamp) {
          timestamp = metadata.request.timestamp;
        } else {
          // Try to extract from filename
          const timestampMatch = imageId.match(/^(\d+)/);
          if (timestampMatch) {
            timestamp = parseInt(timestampMatch[1], 10);
          } else {
            timestamp = Date.now(); // Fallback to current time
          }
        }

        // Extract prompt text (new format only)
        const promptText = metadata?.request?.prompt?.text || '';

        // Ensure bookmarked field exists (default to false if not present)
        if (!metadata) {
          return null;
        }
        
        if (metadata.bookmarked === undefined) {
          metadata.bookmarked = false;
        }

        return {
          id: imageId,
          imageUrl,
          prompt: promptText,
          timestamp,
          metadata: metadata,
          isGenerating: !imageExists, // Indicate if image is still being generated
        };
      })
    );
    
    // Filter out null entries
    const validFileList = fileList.filter((item): item is NonNullable<typeof item> => item !== null);

    // Sort by timestamp (newest first), then by batch index (larger index first) for same timestamp
    validFileList.sort((a, b) => {
      if (b.timestamp !== a.timestamp) {
        return b.timestamp - a.timestamp;
      }
      // If timestamps are equal, extract batch index (i) from image ID and sort descending
      // Image ID format: ${timestamp}-${i}-${random}
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

    res.json({ files: validFileList });
  } catch (error: any) {
    console.error('List files error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

/**
 * Get list of projects
 * GET /api/projects
 */
app.get('/api/projects', async (req, res) => {
  try {
    const projectDirs = await fs.readdir(projectsDir, { withFileTypes: true });
    const projects = await Promise.all(
      projectDirs
        .filter(dirent => dirent.isDirectory())
        .map(async (dirent) => {
          const projectId = dirent.name;
          const projectDir = path.join(projectsDir, projectId);
          
          // Read project.json
          const projectData = await getOrCreateProjectJson(projectDir, projectId);
          
          return {
            id: projectData.projectId,
            name: projectData.projectName,
            createdAt: projectId === 'default' ? 0 : parseInt(projectId.split('-')[0]) || 0,
          };
        })
    );
    
    // Sort: default last, others by createdAt descending
    projects.sort((a, b) => {
      if (a.id === 'default') return 1;
      if (b.id === 'default') return -1;
      return b.createdAt - a.createdAt;
    });
    
    res.json({ projects });
  } catch (error: any) {
    console.error('List projects error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

/**
 * Create a new project
 * POST /api/projects
 * Body: { name: string }
 */
app.post('/api/projects', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: 'Project name is required' });
    }
    
    const projectId = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const projectDir = path.join(projectsDir, projectId);
    const outputsDir = path.join(projectDir, 'outputs');
    const generatedImagesDir = path.join(outputsDir, 'generated-images');
    const outputRefImagesDir = path.join(outputsDir, 'reference-images');
    const settingsDir = path.join(projectDir, 'settings');
    const settingsRefImagesDir = path.join(settingsDir, 'reference-images');
    
    await fs.mkdir(outputsDir, { recursive: true });
    await fs.mkdir(generatedImagesDir, { recursive: true });
    await fs.mkdir(outputRefImagesDir, { recursive: true });
    await fs.mkdir(settingsDir, { recursive: true });
    await fs.mkdir(settingsRefImagesDir, { recursive: true });
    
    // Create project.json
    const projectJsonPath = path.join(projectDir, 'project.json');
    const projectData = {
      projectId,
      projectName: name.trim(),
    };
    await fs.writeFile(projectJsonPath, JSON.stringify(projectData, null, 2));
    
    res.json({
      success: true,
      project: {
        id: projectId,
        name: name.trim(),
        createdAt: parseInt(projectId.split('-')[0]),
      }
    });
  } catch (error: any) {
    console.error('Create project error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

/**
 * Save project settings (request parameters)
 * POST /api/projects/:projectId/settings
 * Body: { prompt, aspectRatio, imageSize, batchCount, referenceImageFilenames }
 */
app.post('/api/projects/:projectId/settings', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { prompt, aspectRatio, imageSize, batchCount, promptImageFilenames, referenceImageFilenames, styleText, styleImageFilenames } = req.body;
    
    const projectDir = path.join(projectsDir, projectId);
    const settingsDir = path.join(projectDir, 'settings');
    await fs.mkdir(settingsDir, { recursive: true });
    
    const settingsPath = path.join(settingsDir, 'request-params.json');
    
    // New format: structure matches output JSON request format
    const settings = {
      request: {
        prompt: {
          text: prompt || '',
          ...(promptImageFilenames && promptImageFilenames.length > 0 && { images: promptImageFilenames }),
        },
        ...(styleText || (styleImageFilenames && styleImageFilenames.length > 0)) && {
          style: {
            ...(styleText && { text: styleText }),
            ...(styleImageFilenames && styleImageFilenames.length > 0 && { images: styleImageFilenames }),
          },
        },
        generationConfig: {
          ...(aspectRatio && { aspectRatio }),
          ...(imageSize && { imageSize }),
        },
        batchCount: batchCount || '1',
      },
      timestamp: Date.now(),
    };
    
    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));
    
    res.json({ success: true });
  } catch (error: any) {
    console.error('Save settings error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

/**
 * Get project settings
 * GET /api/projects/:projectId/settings
 */
app.get('/api/projects/:projectId/settings', async (req, res) => {
  try {
    const { projectId } = req.params;
    const settingsPath = path.join(projectsDir, projectId, 'settings', 'request-params.json');
    
    try {
      const settingsContent = await fs.readFile(settingsPath, 'utf-8');
      const settings = JSON.parse(settingsContent);
      
      // Support both old and new format for backward compatibility
      let requestData: any;
      if (settings.request) {
        // New format
        requestData = settings.request;
      } else {
        // Old flat format - convert to new format
        requestData = {
          prompt: {
            text: settings.prompt || '',
            ...(settings.promptImageFilenames && settings.promptImageFilenames.length > 0 && { images: settings.promptImageFilenames }),
          },
          ...(settings.styleText || (settings.styleImageFilenames && settings.styleImageFilenames.length > 0)) && {
            style: {
              ...(settings.styleText && { text: settings.styleText }),
              ...(settings.styleImageFilenames && settings.styleImageFilenames.length > 0 && { images: settings.styleImageFilenames }),
            },
          },
          generationConfig: {
            ...(settings.aspectRatio && { aspectRatio: settings.aspectRatio }),
            ...(settings.imageSize && { imageSize: settings.imageSize }),
          },
          batchCount: settings.batchCount || '1',
        };
      }
      
      // Load prompt images URLs
      const promptImageFilenames = requestData.prompt?.images || [];
      const promptImages = promptImageFilenames.map((filename: string) => ({
        filename,
        url: `/uploads/projects/${projectId}/settings/reference-images/${filename}`,
      }));
      
      // Load style images URLs
      const styleImageFilenames = requestData.style?.images || [];
      const styleImages = styleImageFilenames.map((filename: string) => ({
        filename,
        url: `/uploads/projects/${projectId}/settings/reference-images/${filename}`,
      }));
      
      // Return in API format
      const response: any = {
        prompt: requestData.prompt?.text || '',
        aspectRatio: requestData.generationConfig?.aspectRatio || 'auto',
        imageSize: requestData.generationConfig?.imageSize || 'auto',
        batchCount: requestData.batchCount || '1',
        referenceImageFilenames: [],
        referenceImages: [],
      };
      
      if (promptImages.length > 0) {
        response.promptImageFilenames = promptImageFilenames;
        response.promptImages = promptImages;
      }
      if (styleImages.length > 0) {
        response.styleImageFilenames = styleImageFilenames;
        response.styleImages = styleImages;
      }
      if (requestData.style?.text) {
        response.styleText = requestData.style.text;
      }
      
      res.json(response);
    } catch {
      res.json({
        prompt: '',
        aspectRatio: 'auto',
        imageSize: 'auto',
        batchCount: '1',
        referenceImageFilenames: [],
        referenceImages: [],
        promptImageFilenames: [],
        promptImages: [],
        styleText: '',
        styleImages: [],
      });
    }
  } catch (error: any) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

/**
 * Calculate file hash
 */
const calculateFileHash = async (filePath: string): Promise<string> => {
  const fileBuffer = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
};

/**
 * Upload reference image for settings (current input parameters)
 * POST /api/projects/:projectId/settings/reference-images
 * Body: FormData with 'image' (file)
 */
const settingsRefImageStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const projectId = req.params.projectId || 'default';
    const refImagesDir = path.join(projectsDir, projectId, 'settings', 'reference-images');
    await fs.mkdir(refImagesDir, { recursive: true });
    cb(null, refImagesDir);
  },
  filename: (req, file, cb) => {
    // Temporary filename, will be renamed based on hash
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `temp-${uniqueSuffix}${ext}`);
  }
});

const settingsRefImageUpload = multer({ storage: settingsRefImageStorage });

app.post('/api/projects/:projectId/settings/reference-images', settingsRefImageUpload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Image file is required' });
    }
    
    const { projectId } = req.params;
    const refImagesDir = path.join(projectsDir, projectId, 'settings', 'reference-images');
    
    // Calculate hash of the uploaded file
    const hash = await calculateFileHash(req.file.path);
    const hashPrefix = hash.substring(0, 16); // Use first 16 characters
    const ext = path.extname(req.file.filename);
    const finalFilename = `ref-${hashPrefix}${ext}`;
    const finalPath = path.join(refImagesDir, finalFilename);
    
    // Check if file with same hash already exists
    let existingFile = false;
    try {
      await fs.access(finalPath);
      // File already exists, delete temporary file
      await fs.unlink(req.file.path);
      existingFile = true;
    } catch {
      // File doesn't exist, rename temporary file to hash-based name
      await fs.rename(req.file.path, finalPath);
    }
    
    const imageUrl = `/uploads/projects/${projectId}/settings/reference-images/${finalFilename}`;
    
    res.json({
      success: true,
      imageUrl,
      filename: finalFilename,
      isExisting: existingFile, // Indicate if this was an existing file
    });
  } catch (error: any) {
    console.error('Upload reference image error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

/**
 * Delete reference image from settings
 * DELETE /api/projects/:projectId/settings/reference-images/:filename
 */
app.delete('/api/projects/:projectId/settings/reference-images/:filename', async (req, res) => {
  try {
    const { projectId, filename } = req.params;
    const filePath = path.join(projectsDir, projectId, 'settings', 'reference-images', filename);
    
    try {
      await fs.unlink(filePath);
      res.json({ success: true });
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return res.status(404).json({ error: 'File not found' });
      }
      throw error;
    }
  } catch (error: any) {
    console.error('Delete reference image error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

/**
 * Copy reference images from outputs to settings
 * POST /api/projects/:projectId/settings/reference-images/copy-from-outputs
 * Body: { filenames: string[] }
 * Clears settings/reference-images folder before copying to avoid unused images
 */
app.post('/api/projects/:projectId/settings/reference-images/copy-from-outputs', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { filenames } = req.body;
    
    if (!Array.isArray(filenames)) {
      return res.status(400).json({ error: 'Filenames array is required' });
    }
    
    const outputsRefImagesDir = path.join(projectsDir, projectId, 'outputs', 'reference-images');
    const settingsRefImagesDir = path.join(projectsDir, projectId, 'settings', 'reference-images');
    await fs.mkdir(settingsRefImagesDir, { recursive: true });
    
    // Clear all existing files in settings/reference-images folder
    try {
      const existingFiles = await fs.readdir(settingsRefImagesDir);
      await Promise.all(
        existingFiles.map(async (file) => {
          const filePath = path.join(settingsRefImagesDir, file);
          try {
            const stat = await fs.stat(filePath);
            if (stat.isFile()) {
              await fs.unlink(filePath);
            }
          } catch (error) {
            // Ignore errors for individual file deletion
            console.warn(`Failed to delete file ${file}:`, error);
          }
        })
      );
    } catch (error) {
      // If directory doesn't exist or is empty, that's fine
      console.warn('Failed to clear settings/reference-images folder:', error);
    }
    
    // If no filenames provided, just clear the folder and return
    if (filenames.length === 0) {
      return res.json({
        success: true,
        images: [],
      });
    }
    
    const copiedImages: Array<{ originalFilename: string; filename: string; imageUrl: string }> = [];
    
    for (const originalFilename of filenames) {
      try {
        const sourcePath = path.join(outputsRefImagesDir, originalFilename);
        
        // Check if source file exists
        try {
          await fs.access(sourcePath);
        } catch {
          console.warn(`Source file not found: ${originalFilename}`);
          continue;
        }
        
        // Calculate hash of the source file
        const hash = await calculateFileHash(sourcePath);
        const hashPrefix = hash.substring(0, 16);
        const ext = path.extname(originalFilename);
        const finalFilename = `ref-${hashPrefix}${ext}`;
        const destPath = path.join(settingsRefImagesDir, finalFilename);
        
        // Copy the file (folder is already cleared, so no need to check for existing files)
        await fs.copyFile(sourcePath, destPath);
        copiedImages.push({
          originalFilename,
          filename: finalFilename,
          imageUrl: `/uploads/projects/${projectId}/settings/reference-images/${finalFilename}`,
        });
      } catch (error: any) {
        console.error(`Failed to copy image ${originalFilename}:`, error);
        // Continue with other images
      }
    }
    
    res.json({
      success: true,
      images: copiedImages,
    });
  } catch (error: any) {
    console.error('Copy reference images error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

/**
 * Upload reference image for outputs (used in generation)
 * POST /api/projects/:projectId/outputs/reference-images
 * Body: FormData with 'image' (file)
 * Uses hash-based filename to avoid duplicates
 */
const outputRefImageStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const projectId = req.params.projectId || 'default';
    const refImagesDir = path.join(projectsDir, projectId, 'outputs', 'reference-images');
    await fs.mkdir(refImagesDir, { recursive: true });
    cb(null, refImagesDir);
  },
  filename: (req, file, cb) => {
    // Temporary filename, will be renamed based on hash
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `temp-${uniqueSuffix}${ext}`);
  }
});

const outputRefImageUpload = multer({ storage: outputRefImageStorage });

app.post('/api/projects/:projectId/outputs/reference-images', outputRefImageUpload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Image file is required' });
    }
    
    const projectId = req.params.projectId || 'default';
    const refImagesDir = path.join(projectsDir, projectId, 'outputs', 'reference-images');
    
    // Calculate hash of the uploaded file
    const hash = await calculateFileHash(req.file.path);
    const hashPrefix = hash.substring(0, 16); // Use first 16 characters
    const ext = path.extname(req.file.filename);
    const finalFilename = `ref-${hashPrefix}${ext}`;
    const finalPath = path.join(refImagesDir, finalFilename);
    
    // Check if file with same hash already exists
    try {
      await fs.access(finalPath);
      // File already exists, delete temporary file
      await fs.unlink(req.file.path);
    } catch {
      // File doesn't exist, rename temporary file to hash-based name
      await fs.rename(req.file.path, finalPath);
    }
    
    const imageUrl = `/uploads/projects/${projectId}/outputs/reference-images/${finalFilename}`;
    
    res.json({
      success: true,
      imageUrl,
      filename: finalFilename,
    });
  } catch (error: any) {
    console.error('Upload reference image error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

/**
 * Update bookmark status for an image
 * POST /api/projects/:projectId/images/:imageId/bookmark
 * Body: { bookmarked: boolean }
 */
app.post('/api/projects/:projectId/images/:imageId/bookmark', async (req, res) => {
  try {
    const { projectId, imageId } = req.params;
    const { bookmarked } = req.body;
    
    if (typeof bookmarked !== 'boolean') {
      return res.status(400).json({ error: 'bookmarked must be a boolean' });
    }
    
    const projectDir = path.join(projectsDir, projectId);
    const generatedImagesDir = path.join(projectDir, 'outputs', 'generated-images');
    const jsonPath = path.join(generatedImagesDir, `${imageId}.json`);
    
    // Check if JSON file exists
    try {
      await fs.access(jsonPath);
    } catch {
      return res.status(404).json({ error: 'Image metadata not found' });
    }
    
    // Read existing metadata
    const metadataContent = await fs.readFile(jsonPath, 'utf-8');
    const metadata = JSON.parse(metadataContent);
    
    // Update bookmark status
    metadata.bookmarked = bookmarked;
    
    // Write back to file
    await fs.writeFile(jsonPath, JSON.stringify(metadata, null, 2));
    
    res.json({ success: true, bookmarked });
  } catch (error: any) {
    console.error('Update bookmark error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

/**
 * Update memo for an image
 * POST /api/projects/:projectId/images/:imageId/memo
 * Body: { memo: string }
 */
app.post('/api/projects/:projectId/images/:imageId/memo', async (req, res) => {
  try {
    const { projectId, imageId } = req.params;
    const { memo } = req.body;
    
    if (typeof memo !== 'string') {
      return res.status(400).json({ error: 'memo must be a string' });
    }
    
    const projectDir = path.join(projectsDir, projectId);
    const generatedImagesDir = path.join(projectDir, 'outputs', 'generated-images');
    const jsonPath = path.join(generatedImagesDir, `${imageId}.json`);
    
    // Check if JSON file exists
    try {
      await fs.access(jsonPath);
    } catch {
      return res.status(404).json({ error: 'Image metadata not found' });
    }
    
    // Read existing metadata
    const metadataContent = await fs.readFile(jsonPath, 'utf-8');
    const metadata = JSON.parse(metadataContent);
    
    // Update memo
    metadata.memo = memo;
    
    // Write back to file
    await fs.writeFile(jsonPath, JSON.stringify(metadata, null, 2));
    
    res.json({ success: true, memo });
  } catch (error: any) {
    console.error('Update memo error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

/**
 * Serve uploaded files
 * GET /uploads/projects/:projectId/outputs/:filename
 * GET /uploads/projects/:projectId/reference-images/:filename
 */
app.use('/uploads', express.static(uploadsDir));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Uploads directory: ${uploadsDir}`);
});


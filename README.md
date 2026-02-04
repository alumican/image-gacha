# Image Gacha

A local image generation application using Gemini 3 Pro Image API.

## Features

- **Text Prompt Generation**: Create images from text descriptions
- **Reference Images**: Upload multiple reference images for style or composition guidance
- **Gacha Notation**: Use `{{option1,option2,option3}}(N)` syntax to randomly select from multiple options
- **Aspect Ratios**: Choose from `1:1`, `2:3`, `3:2`, `3:4`, `4:3`, `4:5`, `5:4`, `9:16`, `16:9`, `21:9`
- **Image Sizes**: Select `1K`, `2K`, or `4K` resolution
- **Project Management**: Organize your work into multiple projects with separate settings and history
- **Reproducibility**: Save and restore generation parameters for each image
- **Generation History**: View, bookmark, and download all generated images

## Prerequisites

- Node.js 18+ and npm
- Gemini API key ([Get your API key](https://aistudio.google.com/app/apikey))

## Quick Start

### 1. Setup

```bash
./setup.sh
```

This will:
- Install all dependencies (client and server)
- Prompt you to enter your Gemini API key
- Create `.env.local` configuration file

### 2. Launch

```bash
./launch.sh
```

This will:
- Start development servers (frontend and backend)
- Automatically open your browser
- Skip servers that are already running

The application will be available at `http://localhost:5173` (default).

## Usage

### Creating a Project

1. Click the project selector dropdown
2. Click "Create New Project"
3. Enter a project name
4. Start generating images in your new project

### Generating Images

1. Enter your prompt text (supports gacha notation)
2. Optionally upload reference images for the prompt
3. Optionally add style text and style reference images
4. Select aspect ratio and image size
5. Click "Generate"

### Gacha Notation

Use `{{option1,option2,option3}}(N)` syntax to randomly select items:

```
{{red,blue,green}}(2)
```

This randomly selects 2 items from the list (e.g., `red green` or `blue red`).

**Features:**
- Multi-line format supported
- Custom separators: `{{A,B}}(2, ", ")` → `A, B`
- Escape special characters with backslash: `\{`, `\}`, `\,`, `\\`, `\n`, `\t`, `\r`

**Example:**
```
A {{cat,dog,bird}}(2) in a {{forest,city,beach}}(1)
```
This might generate: `A cat bird in a forest` (randomly selected).

### Restoring Parameters

Click the "Restore Parameters" button (↻ icon) on any generated image card to restore all input parameters used for that generation. This will:
- Restore prompt text (including original gacha notation)
- Restore prompt images and style images (copies from outputs to settings if needed)
- Restore style text
- Restore aspect ratio and image size settings

### Bookmarking

Bookmark your favorite images for easy access. Use the bookmark filter to show only bookmarked images.

## Configuration

### Environment Variables

The application uses `.env.local` for configuration (created by `setup.sh`):

- `VITE_GEMINI_API_KEY`: Your Gemini API key (required)
- `VITE_API_URL`: Backend server URL (default: `http://localhost:3001`)
- `VITE_FRONTEND_URL`: Frontend URL (default: `http://localhost:5173`)

To change ports, edit `.env.local` and update the URLs accordingly.

### Manual Commands

If you prefer to use npm commands directly:

```bash
# Setup (install dependencies and configure API key)
npm run setup

# Launch (start servers and open browser)
npm run launch

# Uninstall (remove node_modules)
npm run uninstall

# Start servers manually
npm run dev:all
```

## Security & Privacy

- **API Keys**: Stored locally in `.env.local` (never committed to Git)
- **Generated Content**: All images and metadata are stored locally in `server/uploads/` (excluded from Git)
- **No Cloud Storage**: Everything remains on your machine
- **Local Server**: The Express server runs locally and does not expose data externally

## Notes

- API usage may incur costs. Check [Google's pricing](https://docs.cloud.google.com/vertex-ai/generative-ai/pricing) for details
- The `server/uploads/` directory is automatically created on first run
- Project settings and generation history persist across browser sessions
- Reference images are stored separately in `outputs/reference-images` (for generation) and `settings/reference-images` (for current input parameters)
- When restoring parameters, images are automatically copied from outputs to settings if needed

## License

MIT License - see [LICENSE](LICENSE) file for details.

# Image Gacha

A local image generation application using Gemini 3 Pro Image API.

## Purpose

Generate images efficiently on your local machine using Google's Gemini 3 Pro Image API. All API keys and generated content remain stored locally, ensuring privacy and security.

## Features

- **Text Prompt Generation**: Create images from text descriptions
- **Reference Images**: Upload multiple reference images for style or composition guidance
- **Gacha Notation**: Use `{{option1,option2,option3}}(N)` syntax to randomly select from multiple options
- **Aspect Ratios**: Choose from 1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9
- **Image Sizes**: Select 1K, 2K, or 4K resolution
- **Project Management**: Organize your work into multiple projects with separate settings and history
- **Reproducibility**: Save and restore generation parameters for each image
- **Generation History**: View, bookmark, and download all generated images
- **Parameter Restoration**: Restore input parameters from any generated image

## Gacha Notation

The gacha notation allows you to randomly select items from a list:

```
{{red,blue,green}}(2)
```

This randomly selects 2 items from the list (e.g., "red green" or "blue red").

**Features:**
- Multi-line format supported
- Custom separators: `{{A,B}}(2, ", ")` → "A, B"
- Escape special characters with backslash: `\{`, `\}`, `\,`, `\\`, `\n`, `\t`, `\r`

**Example:**
```
A {{cat,dog,bird}}(2) in a {{forest,city,beach}}()
```

This might generate: "A cat bird in a forest" (randomly selected).

## Installation

### Prerequisites

- Node.js 18+ and npm
- Gemini API key ([Get your API key](https://aistudio.google.com/app/apikey))

### Setup

1. **Clone the repository**
   ```bash
   git clone git@github.com:alumican/image-gacha.git
   cd image-gacha/app
   ```

2. **Install dependencies**
   ```bash
   # Client
   npm install
   # Server
   cd server
   npm install
   cd ..
   ```

3. **Configure API key**
   
   Run the setup script to interactively create `.env.local`:
   ```bash
   npm run setup
   ```
   
   This will prompt you to enter your Gemini API key.

4. **Start the application**
   ```bash
   # Client and server together
   npm run dev:all
   ```
   
   ```bash
   # Or separately:
   npm run dev          # Client only (port 5173)
   npm run dev:server   # Server only (port 3001)
   ```
   
   To change the API server URL or frontend URL, edit `.env.local`.

5. **Open your browser**
   
   Navigate to [http://localhost:5173](http://localhost:5173)

## Project Structure

```
app/
├── src/
│   ├── components/     # React components
│   ├── services/       # API services
│   ├── lib/            # Utilities (gacha parser, image utils)
│   ├── utils/          # Helper utilities (localStorage, timer)
│   └── types.ts         # TypeScript type definitions
├── server/
│   ├── src/
│   │   └── index.ts     # Express server
│   └── uploads/         # Generated images and metadata (local only)
└── package.json
```

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

### Restoring Parameters

Click the "Restore Parameters" button on any generated image card to restore all input parameters used for that generation.

### Bookmarking

Bookmark your favorite images for easy access. Use the bookmark filter to show only bookmarked images.

## Security & Privacy

- **API Keys**: Stored locally in browser localStorage or `.env.local` (never committed to Git)
- **Generated Content**: All images and metadata are stored locally in `server/uploads/` (excluded from Git)
- **No Cloud Storage**: Everything remains on your machine
- **Local Server**: The Express server runs locally and does not expose data externally

## Development

### Build

```bash
npm run build
```

### Lint

```bash
npm run lint
```

## Technology Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend**: Node.js, Express, TypeScript, Multer
- **API**: Google Gemini 3 Pro Image API

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Notes

- API usage may incur costs. Check [Google's pricing](https://docs.cloud.google.com/vertex-ai/generative-ai/pricing) for details
- The `server/uploads/` directory is automatically created on first run
- Project settings and generation history persist across browser sessions

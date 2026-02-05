# LeadrScribe Website

The official website for LeadrScribe - free offline speech-to-text.

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

## Required Assets

Place the following images in the `public/` folder:

1. **app-idle.png** - Screenshot of the app in idle state (800x500 recommended)
2. **app-recording.png** - Screenshot of the app while recording/transcribing (700x440 recommended)
3. **logo.png** - App logo
4. **og-image.png** - Social media preview image (1200x630)
5. **favicon.ico** - Browser favicon

## Deployment

Deploy to Vercel:

```bash
vercel
```

Or connect your GitHub repo to Vercel for automatic deployments.

## Features

- Next.js 14 with App Router
- Framer Motion animations
- GitHub Releases API integration (auto-detects latest downloads)
- Responsive design
- Dark theme
- SEO optimized

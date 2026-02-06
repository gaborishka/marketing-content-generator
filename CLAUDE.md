# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MarketGen AI — an enterprise AI marketing content generator built with React + TypeScript. It uses Google Gemini APIs to generate marketing copy, images, and video storyboards for multi-channel campaigns. Originally scaffolded from Google AI Studio.

## Commands

- `npm run dev` — start dev server on port 3000
- `npm run build` — production build via Vite
- `npm run preview` — preview production build

No test runner, linter, or formatter is configured.

## Architecture

**Flat file structure** — all source files are at the root or one level deep. No `src/` directory.

### Entry & Routing

- `index.tsx` — React 19 entry point, mounts `<App />`
- `App.tsx` — top-level state owner and router (HashRouter). All application state (products, campaigns, content) lives here as `useState` hooks. Seeds IndexedDB with mock data on first load if empty.
- Routes: `/` (Dashboard), `/campaigns` (list), `/campaigns/new` (generator wizard), `/campaigns/:id` (canvas workspace), `/products` (catalog)

### State & Persistence

- **All state flows top-down from App.tsx** — no context providers or state management library. Components receive data and callbacks as props.
- `services/storageService.ts` — IndexedDB wrapper (`MarketGenDB`) with three object stores: `products`, `campaigns`, `content`. Simple `getAll`, `put`, `clear` API.
- State updates in App.tsx write to both React state and IndexedDB in parallel (fire-and-forget DB writes).

### AI Service Layer

- `services/geminiService.ts` — all Gemini API interactions:
  - `generateMarketingContent()` — text generation via `gemini-3-flash-preview` with structured JSON output schema. Falls back to `mockGeneration()` if no API key or on error.
  - `generateImage()` — image generation via `gemini-3-pro-image-preview`. Falls back to picsum.photos placeholder URLs.
  - `generateVideoFromStoryboard()` — video generation via `veo-3.1-generate-preview` with polling loop. Requires real base64 images (not URLs).
  - Image generation runs as a fire-and-forget async loop after text generation completes, updating cards one at a time via `onImageUpdate` callback.

### API Key

- The Gemini API key comes from `GEMINI_API_KEY` in `.env.local`
- Vite config injects it as `process.env.API_KEY` and `process.env.GEMINI_API_KEY` at build time
- Also supports AI Studio runtime key selection via `window.aistudio` (shows key connect screen if not available)

### Key Components

- `components/Layout.tsx` — sidebar + header shell with react-router navigation
- `components/ContentGenerator.tsx` — 2-step campaign creation wizard (scope selection → strategy config → generate)
- `components/CampaignDetail.tsx` — campaign workspace with left sidebar controls (context, products, audiences, channels) and canvas area. Handles "Generate New Variants" with placeholder-then-fill pattern.
- `components/CanvasBoard.tsx` — infinite canvas with pan/zoom, card drag, multi-select. Renders SVG connection lines between cards.
- `components/CanvasCard.tsx` — content card with channel-specific styling, compliance badge, image/storyboard preview
- `components/VideoStoryboardModal.tsx` — modal for video storyboard review and Veo video generation

### Styling

- Tailwind CSS loaded via CDN script tag in `index.html` (not PostCSS/build-integrated)
- Inter font from Google Fonts
- Path alias `@/*` maps to project root (configured in both `tsconfig.json` and `vite.config.ts`)

### Type System

- `types.ts` — all shared interfaces: `Product`, `Campaign`, `GeneratedContent`, `Scene`, `DashboardMetrics`, `ChartData`
- `GeneratedContent` has canvas positioning fields (`x`, `y`, `width`) and optional video fields (`storyboard`, `videoUrl`, `videoStatus`)
- Campaign supports both product-focused and brand/idea campaigns (`primaryProductId` is optional)

### Dependencies

- React 19, react-router-dom 7, recharts (dashboard charts), lucide-react (icons), @google/genai (Gemini SDK)
- `index.html` contains an importmap pointing to esm.sh CDN — this is for the AI Studio sandbox runtime, not used during local Vite dev

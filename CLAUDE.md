# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DDoc is a privacy-first, decentralized document editor built on TipTap/ProseMirror. It provides real-time collaboration, end-to-end encryption, and offline editing capabilities. The package is published as `@fileverse-dev/ddoc` on npm.

## Commands

```bash
# Development server (Vite)
npm run dev

# Build the library
npm run build

# Build with watch mode
npm run build:watch

# Lint and auto-fix
npm run lint

# Preview production build
npm run preview
```

For the demo app in `/demo`:
```bash
cd demo && npm i && npm run dev
```

## Architecture

### Entry Point
- `index.ts` - Main exports: `DdocEditor`, `PreviewDdocEditor`, `useHeadlessEditor`, `handleContentPrint`, `ReminderBlock`

### Core Package Structure (`/package`)

**Main Components:**
- `ddoc-editor.tsx` - Main editor component with all UI (toolbar, bubble menu, comments, presentation mode)
- `preview-ddoc-editor.tsx` - Read-only preview version of the editor
- `use-ddoc-editor.tsx` - Core hook that initializes TipTap editor with all extensions and collaboration
- `types.ts` - TypeScript interfaces including `DdocProps`, `ICollaborationConfig`

**Extensions (`/package/extensions`):**
TipTap extensions providing editor features:
- `default-extension.ts` - Bundles all default extensions
- `slash-command/` - Slash command menu (/)
- `ai-writer/` & `ai-autocomplete/` - AI text generation
- `comment/` - Inline commenting system
- `d-block/` - Custom block wrapper
- `resizable-media/` - Image/video with resize handles
- `supercharged-table/` - Enhanced table support
- `multi-column/` - Multi-column layouts
- `reminder-block/` - Reminder functionality
- `twitter-embed/` - Twitter/X embed support
- `link-preview/` - URL preview cards
- `code-block/` - Syntax highlighted code blocks

**Sync/Collaboration (`/package/sync-local`):**
- `syncMachine.ts` - XState machine for collaboration state
- `socketClient.ts` - WebSocket client for real-time sync
- `useSyncMachine.ts` - React hook for sync machine
- Uses Yjs for CRDT-based collaboration

**Components (`/package/components`):**
- `editor-toolbar.tsx` - Main formatting toolbar
- `mobile-toolbar.tsx` - Mobile-optimized toolbar
- `editor-bubble-menu/` - Selection-based floating menu
- `inline-comment/` - Comment UI components
- `presentation-mode/` - Slide presentation view
- `toc/` - Table of contents sidebar

**Hooks (`/package/hooks`):**
- `use-headless-editor.tsx` - Editor without UI for programmatic use
- `use-editor-states.tsx` - Editor state management
- `use-content-item-actions.tsx` - Block-level actions

**Utils (`/package/utils`):**
- `handle-print.ts` - PDF/print export
- `md-to-html.ts` & `md-to-slides.ts` - Markdown conversion
- `upload-images.tsx` - Image upload handling
- `security.ts` - Encryption utilities

### Build Configuration
- Built as ES module library via Vite
- React and ReactDOM are external dependencies
- TypeScript declarations generated via `vite-plugin-dts`

## Key Patterns

**Editor Initialization:**
The editor is initialized through `useDdocEditor` hook which:
1. Creates a Yjs document for collaboration
2. Configures TipTap with all extensions
3. Sets up IndexedDB persistence (optional)
4. Manages collaboration state via XState

**Collaboration Flow:**
1. `ICollaborationConfig` provides room/auth details
2. `useSyncMachine` manages connection state
3. `socketClient.ts` handles WebSocket communication
4. Yjs syncs document state across peers

**Extension Architecture:**
Extensions follow TipTap patterns - each extension folder typically contains:
- Main extension file
- React node view component (if visual)
- Type definitions

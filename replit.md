# GOMI SNAP - Replit Configuration

## Overview
GOMI SNAP is a mobile-first utility application designed to help APU students and Beppu residents correctly identify trash disposal categories. The app aims to promote environmental responsibility by providing AI-powered image recognition for waste sorting across 30 world languages. Its primary goal is to deliver rapid, accurate waste sorting information ("5-Second Rule") and is adaptable for use in any city globally. The project seeks to streamline waste sorting, reduce confusion, and enable communities to manage waste effectively.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
The frontend uses React 18, TypeScript, and Vite, with Wouter for routing and TanStack Query for server state. UI components are built with Shadcn UI (Radix UI) and styled with Tailwind CSS, adhering to a mobile-first Material Design aesthetic with a custom purple/blue gradient, glass morphism, rounded corners, and a sci-fi camera interface. Key features include a "Why?" button for rule explanations and a quick-select panel.

### Backend
The backend is an Express.js server (TypeScript, Node.js) integrating OpenAI's GPT-5 for AI identification. It uses Drizzle ORM with PostgreSQL (or in-memory fallback) for data. The core API processes base64-encoded images, employing perceptual hashing for intelligent image caching to reduce OpenAI calls.

**AI Classification Logic:**
- **Intelligent Clarification:** Identifies 5 material categories requiring user clarification based on Beppu City rules. Returns `needsClarification: true` with a question, re-classifying after user input.
- **Multi-Part Item Detection:** Returns language-agnostic `itemType` for consistent separation rules across 6 languages, providing localized `partInstructions`.
- **Zero-Cost Rejection System:** Pre-checks for non-waste content (e.g., humans, non-physical objects) and rejects early with `invalid-scan` to optimize processing.
- **Confidence Thresholds:** Classifies items even with low confidence (<= 0.60), adding an advisory to "double-check Beppu City disposal rules".
- **City-Excluded Category:** Identifies items not collected by Beppu City (e.g., large appliances, PCs) and provides manufacturer recycling instructions instead of rejection.

### Data Storage & Analytics
PostgreSQL via Drizzle ORM (with in-memory fallback) stores user data, feedback, `ImageCache` (AI results, hashes, thumbnails), and `trashScanEvents`. A comprehensive analytics system records `trashScanEvents` (location, language, categories, cache efficiency) for tracking environmental impact and geographic reach. It includes investor-ready analytics (`analyticsEvents` table for detailed event logging, `anonymousUserId`, `sessionId`), a Pilot Location System via QR codes, and post-scan feedback. User stats (daily scans, streaks) are tracked and displayed.

### Impact Analytics Engine
The system quantifies environmental impact by calculating avoided CO2 emissions, prevented mis-sorts, and cost savings per scan. It uses configurable factors like emission factors, disposal costs, and baseline mis-sort rates. A `scanImpacts` table stores calculated metrics for auditing, and admin endpoints provide KPI summaries and export capabilities.

### Admin Features
An admin dashboard facilitates feedback management, displays analytics KPIs, and offers health monitoring endpoints for database status, data consistency, and real-time updates via SSE.

### Beppu City Waste Classification Rules
The AI adheres strictly to the official Beppu City garbage separation guide. The classification decision logic follows a hierarchical order:
1.  **CITY-EXCLUDED:** Home appliances, PCs, motorcycles.
2.  **UNCOLLECTABLE:** Items like fire extinguishers, gas cylinders, concrete, tires.
3.  **OVERSIZED:** Items too large for designated bags (paid service).
4.  **RECYCLABLE (Pink bag):** Rinsed cans, glass bottles, PET bottles.
5.  **OLD-PAPER-CLOTHING:** Clean, dry paper and cloth.
6.  **NON-BURNABLE (Transparent bag):** Metals, ceramics, small appliances, batteries, plastic products (non-containers).
7.  **BURNABLE (Green bag):** All other waste, including food waste, soiled paper/cloth, and certain plastic containers.

## External Dependencies

### Third-Party Services
-   **OpenAI API (GPT-5):** AI-powered trash identification.
-   **Neon Database:** Serverless PostgreSQL hosting.

### UI Component Libraries
-   **Radix UI Primitives:** Accessible, unstyled UI components.
-   **Shadcn UI:** Component system built on Radix UI and Tailwind CSS.

### Build and Development Tools
-   **Vite:** Fast development and optimized production builds.
-   **TypeScript:** For type safety.
-   **PostCSS, Tailwind CSS, Autoprefixer:** For styling.
-   **ESBuild:** Server-side bundling.
-   **Sharp:** Image processing library (perceptual hashing).

### Browser APIs
-   **Notifications API:** Daily trash reminder alerts.
-   **LocalStorage:** Persisting alarm settings, user/session IDs.
-   **File/Camera input:** Mobile image capture.
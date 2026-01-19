# replit.md

## Overview

This is an educational learning platform called "Ideal Inspiration Classes (IIC)" - a React-based web application for students and administrators. The platform provides video lectures, PDF notes, MCQ practice tests, weekly tests, a gamification system with credits/coins, subscription management, and real-time chat features. It's built as a comprehensive Learning Management System (LMS) targeting Indian school boards (CBSE, BSEB) and competitive exam preparation.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 19 with TypeScript, using Vite as the build tool
- **Styling**: Tailwind CSS (loaded via CDN) with custom CSS animations
- **Component Pattern**: Functional components with React Hooks throughout
- **State Management**: React useState/useEffect with localStorage for persistence and Firebase for real-time sync
- **Rendering**: Client-side rendering with conditional component mounting based on user role (STUDENT vs ADMIN)

### Role-Based Design
- **Students**: Access learning content, take tests, earn credits, participate in gamification (spin wheel), view leaderboards
- **Admins**: Full dashboard access for user management, content management, subscription/code generation, system settings, analytics

### Content Structure
- Hierarchical: Board → Class → Stream → Subject → Chapter → Content (Videos/PDFs/MCQs)
- Content types include free and premium tiers with credit-based unlocking
- Sequential chapter unlock system requiring 100 MCQs solved per chapter

### Authentication Flow
- Firebase Authentication (anonymous sign-in supported)
- Custom user management stored in both Firestore and Realtime Database
- Role-based access control (STUDENT, ADMIN roles)
- Password recovery via admin-approved requests

### Data Persistence Strategy
- Firebase Realtime Database: Content data, system settings, redeem codes
- Firebase Firestore: User profiles, authentication data
- LocalStorage: User session cache, history, leaderboard cache, system settings cache

## External Dependencies

### Core Services
- **Firebase**: Authentication, Firestore (user database), Realtime Database (content/settings)
  - Config located in `firebase.ts`
  - Singapore region database URL configured
- **Google Gemini AI**: Content generation for chapters, lessons, MCQs, and developer assistance
  - API key via `GEMINI_API_KEY` environment variable
  - Service functions in `services/gemini.ts`

### Third-Party Libraries
- **react-pdf**: PDF viewing with Mozilla's pdfjs-dist worker
- **react-easy-crop**: Image cropping for profile pictures
- **react-markdown** with remark-math/rehype-katex: Markdown rendering with LaTeX math support
- **KaTeX**: Mathematical formula rendering (loaded via CDN)
- **JSZip**: File compression for data export/backup
- **lucide-react**: Icon library

### External Integrations
- **YouTube**: Embedded video player with custom branding overlay
- **Payment**: UPI/WhatsApp-based payment flow (configurable via admin settings)
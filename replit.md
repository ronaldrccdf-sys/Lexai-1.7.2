# LexAI Pro - Legal Management System

## Overview
LexAI Pro is a React-based legal management application for law firms, featuring AI-powered assistance via Google Gemini. It includes modules for case management, client contacts, hearings, agenda, billing, and AI-generated reports.

## Project Structure
- `/` - Root directory with main app files
  - `App.tsx` - Main application component with routing and state
  - `index.tsx` - React entry point
  - `index.html` - HTML template with Tailwind CSS
  - `types.ts` - TypeScript type definitions
- `/components/` - Reusable UI components
  - `Sidebar.tsx` - Navigation sidebar
  - `AIAssistant.tsx` - AI chat assistant component
- `/views/` - Page components
  - `Dashboard.tsx`, `Matters.tsx`, `Contacts.tsx`, `Audiencias.tsx`, `Agenda.tsx`, `Billing.tsx`, `Reports.tsx`, `AIStudio.tsx`
- `/services/` - API and service integrations
  - `gemini.ts` - Google Gemini AI integration
  - `escavador.ts` - Legal data service
  - `storage.ts` - Local storage utilities

## Tech Stack
- React 19.x with TypeScript
- Vite for build and development
- Tailwind CSS (CDN) for styling
- Recharts for data visualization
- Google Gemini API for AI features

## Running the Project
- Development: `npm run dev` (runs on port 5000)
- Build: `npm run build` (outputs to `dist/`)
- Preview: `npm run preview`

## Environment Variables
- `GEMINI_API_KEY` - Required for AI features (Google Gemini API key)

## Deployment
Configured as static deployment with:
- Build command: `npm run build`
- Public directory: `dist`

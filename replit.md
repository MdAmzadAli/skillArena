# Skill Showcase Video Platform

## Overview

This is a full-stack video sharing platform where users can upload videos showcasing their skills, vote on submissions, and compete on a weekly leaderboard. The application features user authentication, video uploads with file validation, interactive voting system, and real-time leaderboard rankings.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The client uses React with TypeScript and Vite for fast development. The UI is built with shadcn/ui components (Radix UI primitives) and styled with Tailwind CSS. State management is handled through TanStack Query for server state and React Context for authentication. The application uses Wouter for client-side routing.

Key architectural decisions:
- **React with TypeScript**: Provides type safety and better developer experience
- **TanStack Query**: Manages server state, caching, and real-time data fetching with 5-30 second intervals
- **shadcn/ui + Radix UI**: Ensures accessible, customizable components with consistent design
- **Tailwind CSS**: Utility-first styling for rapid UI development
- **Wouter**: Lightweight routing solution instead of React Router

### Backend Architecture
The server is built with Express.js and uses TypeScript throughout. Authentication is handled via Passport.js with local strategy using session-based authentication. File uploads are managed through Multer with validation for video formats (MP4, MOV, AVI) and size limits (50MB).

Key architectural decisions:
- **Express.js**: Fast, minimal web framework for Node.js
- **Session-based authentication**: Uses express-session with PostgreSQL store for persistence
- **Passport.js Local Strategy**: Handles username/password authentication with scrypt password hashing
- **Multer**: Manages file uploads with proper validation and storage
- **Memory storage fallback**: Development storage interface that can be swapped for database implementation

### Data Storage Solutions
The application uses Drizzle ORM with PostgreSQL as the primary database. The schema defines three main entities: users, videos, and votes. Database migrations are managed through Drizzle Kit.

Key architectural decisions:
- **PostgreSQL**: Relational database for complex queries and data integrity
- **Drizzle ORM**: Type-safe database access with excellent TypeScript integration
- **Shared schema**: Common type definitions between client and server prevent type mismatches
- **UUID primary keys**: Better for distributed systems and security

### Authentication and Authorization
Authentication uses a traditional session-based approach with secure password hashing. The system includes protected routes that require authentication and user context throughout the application.

Key architectural decisions:
- **Session-based auth**: More secure than JWT for web applications, harder to compromise
- **Scrypt password hashing**: Industry standard for secure password storage
- **Protected route wrapper**: Centralized authentication logic for route protection
- **Express session store**: Persisted sessions survive server restarts

## External Dependencies

### Core Framework Dependencies
- **React + TypeScript**: Frontend framework with type safety
- **Express.js**: Backend web framework
- **Vite**: Fast build tool and development server
- **Node.js**: JavaScript runtime environment

### Database and ORM
- **PostgreSQL**: Primary database (via DATABASE_URL environment variable)
- **Neon Database**: Serverless PostgreSQL provider (@neondatabase/serverless)
- **Drizzle ORM**: Type-safe database toolkit
- **Drizzle Kit**: Database migrations and schema management

### Authentication
- **Passport.js**: Authentication middleware with local strategy
- **express-session**: Session management
- **connect-pg-simple**: PostgreSQL session store

### UI and Styling
- **Tailwind CSS**: Utility-first CSS framework
- **Radix UI**: Headless accessible component library
- **Lucide React**: Icon library
- **shadcn/ui**: Pre-built component library

### File Handling
- **Multer**: Multipart form data and file upload handling
- **File system storage**: Local file storage for uploaded videos

### Development Tools
- **TypeScript**: Static type checking
- **PostCSS + Autoprefixer**: CSS processing
- **ESBuild**: Fast JavaScript bundler for production
- **TSX**: TypeScript execution for development

### State Management
- **TanStack Query**: Server state management and caching
- **React Hook Form**: Form state management with validation
- **Zod**: Schema validation and type inference
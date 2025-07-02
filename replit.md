# Task Management Application

## Overview

This is a full-stack task management application built with React frontend and Express backend. The application features comprehensive task management, real-time communication through WebSocket, group channels, workflows, and email notifications. It uses PostgreSQL as the database with Drizzle ORM for database operations.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript
- **Build Tool**: Vite for development and production builds
- **Styling**: Tailwind CSS with shadcn/ui component library
- **State Management**: TanStack React Query for server state management
- **Routing**: Wouter for client-side routing
- **Forms**: React Hook Form with Zod validation
- **UI Components**: Radix UI primitives with custom styling

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Passport.js with local strategy and session-based auth
- **Real-time Communication**: WebSocket server for live updates
- **File Handling**: Multer for file uploads
- **Email Service**: Nodemailer with SMTP support

## Key Components

### Database Schema
- **Users**: User accounts with notification preferences
- **Tasks**: Core task entities with workflow integration
- **Subtasks & TaskSteps**: Hierarchical task breakdown
- **Comments**: Task discussion system
- **Workflows & WorkflowStages**: Custom workflow management
- **Group Channels**: Team communication channels
- **Private Messages**: Direct messaging between users
- **File Attachments**: File upload and attachment system
- **Email Notifications**: Outbound email queue system

### Core Features
1. **Task Management**: Create, update, delete tasks with workflow stages
2. **Real-time Updates**: WebSocket integration for live collaboration
3. **Group Communication**: Channel-based team messaging
4. **Private Messaging**: Direct user-to-user communication
5. **File Attachments**: Upload and share files in tasks and messages
6. **Email Notifications**: Configurable email alerts for task updates
7. **Workflow System**: Custom workflow stages for task organization
8. **Calendar Integration**: iCalendar export for tasks and events

### Authentication & Authorization
- Session-based authentication using Passport.js
- Password hashing with Node.js crypto (scrypt)
- Role-based access (admin users have ID 1)
- Protected routes on both frontend and backend

## Data Flow

1. **Client Requests**: Frontend makes API calls through a centralized `apiRequest` function
2. **Authentication**: Express middleware validates sessions before processing requests
3. **Database Operations**: Drizzle ORM handles all database interactions with connection pooling
4. **Real-time Updates**: WebSocket server broadcasts changes to connected clients
5. **Error Handling**: Comprehensive error boundaries and structured error responses

## External Dependencies

### Database
- **Neon Database**: PostgreSQL serverless database provider
- **Connection Pooling**: Configured for production scalability

### Email Service
- **SMTP Integration**: Configurable SMTP settings for email notifications
- **Email Templates**: HTML and text email template system

### File Storage
- **Local File System**: Files stored in server uploads directory
- **Multer**: Handles multipart form data for file uploads

### WebSocket
- **ws Library**: WebSocket server implementation
- **Compression**: Per-message deflate for optimized data transfer

## Deployment Strategy

### Development
- **Hot Reload**: Vite dev server with HMR for frontend
- **TypeScript Compilation**: Real-time type checking
- **Database Migrations**: Drizzle Kit for schema management

### Production Build
- **Frontend**: Vite builds optimized static assets
- **Backend**: ESBuild bundles server code for Node.js deployment
- **Environment Variables**: DATABASE_URL required for database connection
- **Process Management**: Single Node.js process serving both API and static files

### Database Management
- **Schema Versioning**: Drizzle migrations in `/migrations` directory
- **Push to Database**: `npm run db:push` command for schema updates
- **Connection Retry Logic**: Automatic retry with exponential backoff

## Changelog
- July 02, 2025. Initial setup

## User Preferences
Preferred communication style: Simple, everyday language.
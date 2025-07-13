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
- July 13, 2025. Fixed critical mobile navigation scrolling issue and enhanced mobile user experience
  - Replaced ScrollArea component with native mobile-optimized scrolling for better touch device compatibility
  - Added mobile-specific CSS including -webkit-overflow-scrolling: touch for smooth scrolling
  - Implemented touch optimization with improved tap handling and reduced selection issues
  - Enhanced mobile button sizes (h-12) and touch targets for better usability
  - Fixed mobile layout padding to properly account for fixed header positioning
  - Added overscroll-behavior containment to prevent unwanted scrolling effects
  - Created responsive mobile navigation with proper Sheet component layout
  - User confirmed mobile navigation now works perfectly on touch devices
- July 13, 2025. Fixed WebSocket production connectivity issues for chat functionality
  - Diagnosed Apache reverse proxy configuration issue preventing WebSocket upgrades on teamtaskflow.atalou.info
  - Created robust WebSocket connection system with automatic fallback to HTTP polling for problematic domains
  - Implemented production-ready WebSocket configuration with better error handling and reconnection logic
  - Added comprehensive Apache configuration guide for WebSocket proxy setup
  - Created fallback system that switches to HTTP polling when WebSocket connections fail
  - Enhanced chat connection reliability with domain-specific configuration and debugging tools
- July 04, 2025. Created comprehensive project documentation including GitHub README and multilingual user manuals
  - Developed professional GitHub README with complete feature overview, installation instructions, and technical specifications
  - Created detailed English user manual covering all application features and functionality
  - Developed complete French user manual (Manuel d'Utilisation) with full feature coverage and navigation guidance
  - Added technical documentation for developers including architecture, API endpoints, and deployment guidelines
  - Created installation guide with step-by-step setup instructions and troubleshooting section
  - Organized all documentation in /docs directory for easy access and maintenance
- July 04, 2025. Completed comprehensive multilingual implementation for Estimations page with full language support
  - Successfully resolved critical duplicate translation key errors that prevented application startup
  - Implemented complete Estimations page translation across English, French, and Spanish languages
  - Added useI18n hook integration to Estimations page for proper multilingual functionality
  - Translated all UI elements including page headers, form dialogs, filter controls, and action buttons
  - Created clean translation structure with organized sections for navigation, common actions, and page-specific content
  - Confirmed working multilingual functionality with user verification showing proper French language display
  - Fixed build issues and ensured stable application performance with comprehensive translation coverage
- July 04, 2025. Implemented comprehensive Expenses management system for tracking company fixed expenses
  - Created complete database schema for expenses and expense receipts with proper relations
  - Built full REST API for expenses with CRUD operations and file upload capabilities for receipts
  - Developed frontend Expenses page with expense creation, editing, deletion, and receipt management
  - Added receipt upload functionality similar to task comments with support for images and PDFs
  - Integrated expense payment tracking with payment history and automatic frequency calculation
  - Added comprehensive filtering system for expenses by service name, beneficiary, and date ranges
  - Implemented expense status tracking (active, paused, cancelled) and payment due date management
  - Added navigation link to Expenses page with Receipt icon in main navigation menu
- July 04, 2025. Enhanced filtering systems for Estimations and Proformas pages
  - Added comprehensive filtering to Estimations page (filter by name and date range)
  - Added comprehensive filtering to Proformas page (filter by proforma number and date range)
  - Implemented date range filters: All Time, Last Week, Last Month, and Custom Range with date pickers
  - Added collapsible filter controls with clear filters functionality for both pages
- July 04, 2025. Completed comprehensive Proforma Access Management system
  - Implemented complete user permission database schema for proforma access control
  - Built permission middleware system with proper authentication and authorization checks
  - Created REST API endpoints for managing user proforma permissions with CRUD operations
  - Developed frontend permission checking hooks for conditional UI rendering
  - Added permission-based navigation visibility to hide Proformas link from unauthorized users
  - Implemented conditional "Manage Access" button visibility based on user management permissions
  - Integrated with existing user management system allowing granular permission assignment
  - Added four permission levels: View, Create/Edit, Delete, and Manage Access permissions
  - Ensured admin users (ID 1) automatically receive all permissions in the system
- July 04, 2025. Enhanced Proformas system with complete logo integration and print functionality
  - Fixed company logo assignment to automatically pull logo from selected company profile during proforma creation
  - Added company logo display in top right corner of proforma cards with fallback placeholder for missing logos
  - Updated proforma creation form to use company selection dropdown instead of manual company data entry
  - Fixed logo path construction to properly display company logos in proforma interface
  - Improved proforma card layout with better spacing and visual hierarchy including company branding
  - Implemented complete logo integration in print output with base64 image embedding for PDF generation
  - Fixed print template layout with proper company name positioning under logo and correct client information display
  - Added dynamic validity period display using actual proforma validUntil date instead of hardcoded text
  - Enhanced print template CSS for professional invoice appearance with proper image sizing and layout structure
- July 04, 2025. Implemented comprehensive Company Settings management system
  - Created companies database table with support for company name, contact information, address, and logo storage
  - Built complete company management API with CRUD operations for companies
  - Developed Company Settings page with creation, editing, deletion, and logo upload capabilities
  - Added company selection to proforma system allowing users to select which company profile to use per quote
  - Integrated company management navigation link in user dropdown menu with Building2 icon
  - Added default company functionality to streamline proforma creation workflow
- July 04, 2025. Enhanced Proformas system with cost display and print functionality
  - Added comprehensive cost information display in proforma cards showing both costs and selling prices
  - Expanded proforma dialog width to 800px with better spacing and organized form sections
  - Enhanced proforma view table to show unit costs alongside unit prices with proper visual hierarchy
  - Implemented HTML-based print functionality with professional invoice template including all cost breakdowns
  - Fixed TypeScript errors for proper cost and profit calculations in both frontend and backend
  - Added proper route for proforma print view accessible via /api/proformas/:id/print
- July 03, 2025. Added Technique field to estimations with user selection dropdown
  - Enhanced estimations database schema with techniqueId field referencing users table
  - Updated both create and edit estimation forms to include technique user selection
  - Integrated with existing users API to populate technique dropdown with all system users
  - Simplified estimation interface to focus on items and quantities only, removing cost displays
  - Updated estimation cards and item management to show only essential workflow information
- July 03, 2025. Implemented comprehensive Estimations management system
  - Created complete backend schema for estimations and estimation items with database tables and relations
  - Built full REST API for estimations with CRUD operations for both estimations and their items
  - Developed frontend Estimations page with creation, editing, deletion, and item management capabilities
  - Added automatic cost calculation system that updates total costs when items are modified
  - Integrated with existing stock system to use current stock item prices for estimations
  - Added navigation link and proper routing for the Estimations feature
  - Fixed movement history functionality with proper data type handling between frontend and backend
- July 03, 2025. Completed stock management system with user permissions
  - Fixed critical database errors preventing member management dialog from loading
  - Implemented missing GET endpoint for fetching user stock permissions
  - Added comprehensive user permission validation system with proper null handling
  - Enhanced stock access control with View/Manage/Adjust permission levels
  - Successfully validated permission system with non-admin users accessing stock features
- July 03, 2025. Added file upload and preview functionality to task comments
  - Implemented complete backend schema for comment attachments with database tables and relations
  - Created comment file upload API endpoint with proper validation and error handling
  - Enhanced frontend TaskComments component with file upload interface and drag-and-drop support
  - Added image preview functionality for uploaded files both before and after posting
  - Integrated file download functionality with proper MIME type handling and visual indicators
  - Fixed database relation issues and ensured proper file storage and retrieval
- July 02, 2025. Initial setup

## User Preferences
Preferred communication style: Simple, everyday language.
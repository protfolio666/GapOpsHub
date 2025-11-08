# SolvExtra GO - Process Gap Intelligence & Resolution Hub

## Overview
SolvExtra GO is a full-stack AI-assisted Process Gap Intelligence & Resolution system designed to streamline the identification, tracking, and resolution of operational inefficiencies. It features a robust role-based access control system, AI-powered semantic search for gap similarity, a comprehensive gap management workflow with real-time updates and notifications, and dynamic form creation. The system aims to improve organizational efficiency, ensure compliance through detailed audit logging, and provide clear insights into process performance through role-specific dashboards. Built with React, Express, and PostgreSQL, SolvExtra GO offers a scalable and maintainable solution for enhancing operational smoothness.

## User Preferences
I prefer detailed explanations.
I want iterative development.
Ask before making major changes.
Do not make changes to the folder `shared/`.
Do not make changes to the file `design_guidelines.md`.

## System Architecture
The system is built on a React 18 (TypeScript) frontend utilizing `shadcn/ui` for components, `Wouter` for routing, `TanStack Query` for data management, `Tiptap` for rich text editing, and `Recharts` for data visualization. The backend is an Express (TypeScript) server with a PostgreSQL (Neon Serverless) database managed by `Drizzle ORM`. Real-time communication is handled by `Socket.io`.

### UI/UX Decisions
- Adheres to **Material Design** principles, **Linear's** dashboard aesthetics, and **Gmail's** threading patterns.
- Uses **Inter** font for UI text and **JetBrains Mono** for technical data.
- Emphasizes information density, role-aware interfaces, and status-driven design with visual clarity for gap states and color-coded priority indicators.

### Technical Implementations
- **AI-Powered Gap Similarity Detection**: Integrates OpenRouter AI (GPT-4) for semantic similarity analysis, running concurrently and asynchronously to identify duplicate and related gaps.
- **Complete Gap Workflow**: Manages gap lifecycle through statuses (PendingAI, NeedsReview, Assigned, InProgress, Resolved, Closed) with overdue detection and assignment tracking.
- **Real-Time Comments**: Utilizes WebSockets for live comment updates with Gmail-style threading and file attachments.
- **SOP Management**: Supports version control, departmental categorization, and AI-driven suggestions for relevant SOPs.
- **Dynamic Form Builder**: Allows creation of custom, department-specific forms with various field types, drag & drop functionality, and conditional logic.
- **Audit Logging**: Comprehensive tracking of all CRUD operations, user activity, and IP addresses for compliance.
- **Role-Based Dashboards**: Provides tailored analytics and metrics for Admin, Management, QA/Ops, and POC roles.

### System Design Choices
- **Drizzle ORM**: Chosen for type-safe SQL queries, performance, and strong TypeScript integration.
- **Session-Based Authentication**: Implemented for its simplicity, enhanced security for web applications, and server-side session invalidation compared to JWT.
- **Socket.io**: Selected for reliable WebSocket communication, automatic fallbacks, and efficient room-based broadcasting.

## External Dependencies
- **PostgreSQL (Neon Serverless)**: Primary database for all application data.
- **OpenRouter AI**: Used for AI-powered semantic similarity detection of process gaps.
- **SendGrid**: For sending all email notifications related to gap assignments, resolutions, TAT extensions, and deadline warnings.
- **Socket.io**: Enables real-time, bidirectional communication between web clients and the server.
## Recent Changes

### November 8, 2025 (Latest - Branding Update & Secondary POC Permissions)
- **Secondary POC Full Permissions**: Enabled all gap resolution actions for secondary POCs
  - Added `isAnyPocOnGap` helper function to check both primary and secondary POC status
  - Secondary POCs can now mark gaps as In Progress
  - Secondary POCs can now resolve gaps with resolution summary and attachments
  - Secondary POCs can now request TAT extensions
  - Updated all permission checks in GapDetailPage to use the helper function
- **SolvExtra GO Branding**: Complete rebrand from GapOps to SolvExtra GO
  - Updated application title in index.html
  - Updated sidebar header with "SE" logo and "SolvExtra GO" text
  - Updated replit.md documentation
  - Updated login page with new branding and logo
- **Login Page Redesign**: Modern two-column layout with gradient background
  - Left side: animated gradient background with floating logo
  - Right side: glass morphism card with login form
  - Smooth fade-in animations and pulse effect on logo
  - Responsive design with mobile optimization

### November 8, 2025 (Earlier - Bug Fixes & POC Visibility)
- **TAT Extensions Page Fix**: Fixed runtime error where `requester` was undefined
  - Changed to use `requestedBy` property to match backend response
- **POC Performance Query Fix**: Fixed database error with audit log queries
  - Replaced SQL `ANY` syntax with `inArray` for Postgres compatibility
  - Fixed empty set handling to prevent query errors
- **POC Assignment Permissions**: Restricted POC addition to Primary POC only
  - Only Primary POC, Admin, and Management can now add/remove POCs
  - Previously all POCs could add other POCs (fixed security issue)
- **POC Gap Visibility**: Newly added POCs can now see their assigned gaps
  - Created `getGapsByPoc` method to include both primary and secondary POC assignments
  - POCs now see gaps where they are either the primary assignee OR in the POC list
  - Fixed issue where secondary POCs couldn't see gaps assigned to them

### November 8, 2025 (Earlier - POC Performance & TAT Extensions Review)
- **POC Performance Tracking System**: Complete performance metrics and dashboard
  - Admin dashboard showing all POCs with comprehensive performance metrics
  - POC-specific dashboard showing their own performance data
  - Metrics include: assigned gaps, resolved gaps, reopen rate with detailed history, delayed responses vs TAT, TAT extension requests count
  - Performance score calculation based on resolution rate and timeliness
  - Reopen history shows dates and resolutions given at each reopening
  - Backend endpoints: `/api/poc-performance` (Admin), `/api/poc-performance/me` (POC)
  - Role-based access control with proper RBAC enforcement
- **TAT Extension Requests Review Page**: Admin/Management workflow for TAT extensions
  - New dedicated page at `/admin/tat-extensions` and `/management/tat-extensions`
  - Shows all pending TAT extension requests with gap details
  - Approve/reject functionality with immediate feedback and cache invalidation
  - Added to Admin and Management sidebars with Clock icon
  - Complete RBAC enforcement (Admin/Management only)
- **Reports Page Filter Fix**: Fixed Apply Filters button for Admin/Management
  - Query now defers until "Apply Filters" is clicked using hasAppliedFilters state
  - POC/QA users still auto-load data immediately (no Apply button needed)
  - Clear Filters properly resets both filter state and enable flag

### November 8, 2025 (Earlier - File Upload & Email Fixes)
- **File Upload Integration**: Complete file upload support for dynamic form templates
  - Created `useFileUpload` hook for async file uploads to `/api/files/upload`
  - Updated DynamicFormRenderer to upload files immediately when selected
  - Files are stored as metadata objects (originalName, filename, size, mimetype, path)
  - Real-time upload progress indicator with file size display
  - Automatic extraction and inclusion of attachments in gap submissions
  - Fixed "View Original Gap" navigation to use role-based routes
  - **CRITICAL FIX**: Fixed `getAllGapAttachments` to include main gap attachments (was only checking resolution and comment attachments, causing download failures)
- **Email Configuration**: Updated SendGrid FROM_EMAIL to `contactus@solvextra.com`
  - Enhanced logging for email sending debugging
  - Comprehensive error handling and delivery tracking
  - Duplicate marking email notifications include closer details

### November 7, 2025 (AI, Email, & Audit Enhancements)
- **OpenRouter AI Integration**: Upgraded gap similarity detection from TF-IDF to GPT-4 semantic search
  - Parallel processing of all similarity calculations for better performance
  - More accurate duplicate detection with AI reasoning
  - Error resilience - individual API failures don't block gap creation
  - Automatic SOP suggestions based on gap content
- **SendGrid Email Notifications**: Complete workflow notification system
  - Gap assignment emails to POCs with deadline information
  - Resolution emails to reporters with gap details
  - TAT extension request emails to all managers/admins
  - Professional HTML templates with branding
  - Non-blocking async email sending
- **Audit Logging System**: Comprehensive compliance tracking
  - Complete audit trail for all CRUD operations
  - Password sanitization - sensitive data never logged
  - IP address and user agent tracking
  - Login/logout tracking with timestamps
  - Gap creation, assignment, and status change logging
  - Admin-only audit log viewer API endpoint (`GET /api/audit-logs`)
- **Storage Layer Updates**: Fixed updateGap signature to allow timestamp fields

### November 7, 2025 (Earlier)
- **Dynamic Form Submission**: Fully integrated Form Builder templates with Gap Submission workflow
- **Logout Feature**: Added logout button to sidebar footer with proper session cleanup
- **Bug Fixes**: Fixed conditional visibility, validation, and repeatable section cleanup

## Environment Variables Required

- `DATABASE_URL` - PostgreSQL connection string (configured automatically)
- `SESSION_SECRET` - Session encryption key (configured automatically)
- `OPENROUTER_API_KEY` - OpenRouter API key for AI similarity detection
- `SENDGRID_API_KEY` - SendGrid API key for email notifications (optional - emails skip silently if not configured)

## Notes

All enhancements are production-ready. The OpenRouter AI integration runs asynchronously and doesn't block HTTP responses. Email notifications fail gracefully if SendGrid is not configured. Audit logging captures all important events with proper password sanitization for security.

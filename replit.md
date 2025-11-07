# GapOps - Process Gap Intelligence & Resolution Hub

## Project Overview

GapOps is a full-stack AI-assisted Process Gap Intelligence & Resolution system built with React, Express, PostgreSQL (Neon), and Socket.io. The system features role-based access control (RBAC) with 4 roles, dynamic form builder, AI-powered gap similarity detection using TF-IDF algorithm, complete gap management workflow with TAT tracking and breach detection, Gmail-style threaded comments with real-time updates, SOP management with AI suggestions, and role-specific dashboards with comprehensive metrics.

## Technology Stack

### Frontend
- **React 18** with TypeScript
- **Wouter** for routing
- **TanStack Query (React Query)** for data fetching and caching
- **shadcn/ui** component library with Tailwind CSS
- **Tiptap** rich text editor
- **Recharts** for data visualization
- **Socket.io-client** for real-time WebSocket communication
- **Vite** for build tooling

### Backend
- **Express** server
- **PostgreSQL** (Neon Serverless) database
- **Drizzle ORM** for database operations
- **express-session** for authentication
- **Socket.io** for real-time features
- **TypeScript** throughout

### Design System
- **Material Design** principles
- **Linear's** dashboard aesthetics
- **Gmail's** threading patterns
- **Inter** font for UI text
- **JetBrains Mono** for technical data

## Database Schema

### Core Tables
- `users` - User accounts with roles (Admin, Management, QA/Ops, POC)
- `gaps` - Process gap records with workflow states
- `comments` - Threaded discussion for gaps
- `sops` - Standard Operating Procedures
- `form_templates` - Dynamic form definitions
- `form_fields` - Fields within templates
- `gap_assignments` - Assignment history tracking
- `tat_extensions` - Time and Attendance extension requests
- `similar_gaps` - AI similarity cache

## User Roles & Permissions

### Admin
- Full system access
- User and role management
- SOP management
- System settings
- Global reports

### Management
- Review all gaps
- Assign gaps to POCs
- Approve/reject TAT extensions
- Create form templates
- Access analytics and reports

### QA/Ops
- Submit new process gaps
- Track own submissions
- View gap status updates
- Attach documentation
- Earn "Smoothness Score" based on validated gaps

### POC (Point of Contact)
- View assigned gaps
- Update gap status (In Progress, Resolved)
- Add comments and resolutions
- Request TAT extensions
- Track personal performance metrics

## Key Features

### 1. AI-Powered Gap Similarity Detection
- **TF-IDF Algorithm**: Custom implementation for text similarity
- **Automatic Processing**: New gaps are automatically analyzed
- **Similarity Scoring**: 0-100% match scores
- **Duplicate Detection**: Helps prevent duplicate submissions
- **Related Gaps**: Shows historical similar issues

### 2. Complete Gap Workflow
- **Status Flow**: PendingAI → NeedsReview → Assigned → InProgress → Resolved → Closed
- **Overdue Detection**: Automatic TAT breach tracking
- **Reopen Capability**: Gaps can be reopened if issues resurface
- **Assignment Tracking**: Full audit trail of assignments

### 3. Real-Time Comments
- **WebSocket Integration**: Live comment updates
- **Gmail-Style Threading**: Clean, familiar interface
- **File Attachments**: Support for documentation
- **User Avatars**: Visual identification
- **Timestamp Tracking**: Relative time display

### 4. SOP Management
- **Version Control**: Track SOP versions
- **Department Categorization**: Organize by department
- **AI Suggestions**: Suggest relevant SOPs for gaps
- **Active/Inactive**: Control SOP visibility

### 5. Dynamic Form Builder
- **Field Types**: Text, Textarea, Select, Multi-Select, File Upload
- **Drag & Drop**: Intuitive field ordering
- **Required Fields**: Validation controls
- **Templates**: Reusable form definitions
- **Department-Specific**: Custom forms per department

### 6. Dashboard Analytics
- **Role-Specific Metrics**: Tailored to each user role
- **Trend Analysis**: Week-over-week comparisons
- **TAT Tracking**: Deadline monitoring
- **Status Distribution**: Visual gap breakdown
- **Performance Metrics**: Individual and team statistics

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user

### Users
- `GET /api/users` - Get all users
- `GET /api/users/role/:role` - Get users by role

### Gaps
- `GET /api/gaps` - Get all gaps (filterable)
- `GET /api/gaps/:id` - Get gap details
- `POST /api/gaps` - Create new gap
- `PATCH /api/gaps/:id` - Update gap
- `POST /api/gaps/:id/assign` - Assign gap to POC
- `POST /api/gaps/:id/resolve` - Mark gap as resolved
- `POST /api/gaps/:id/reopen` - Reopen closed gap
- `GET /api/gaps/:id/similar` - Get similar gaps

### Comments
- `GET /api/gaps/:gapId/comments` - Get gap comments
- `POST /api/gaps/:gapId/comments` - Add comment

### SOPs
- `GET /api/sops` - Get all SOPs
- `GET /api/sops/:id` - Get SOP details
- `POST /api/sops` - Create SOP (Management/Admin only)
- `PATCH /api/sops/:id` - Update SOP (Management/Admin only)

### Form Templates
- `GET /api/form-templates` - Get all templates
- `GET /api/form-templates/:id` - Get template with fields
- `POST /api/form-templates` - Create template (Management/Admin only)

### TAT Extensions
- `GET /api/tat-extensions/pending` - Get pending extensions (Management/Admin only)
- `POST /api/gaps/:gapId/tat-extensions` - Request extension
- `PATCH /api/tat-extensions/:id` - Approve/reject extension (Management/Admin only)

### Dashboard
- `GET /api/dashboard/metrics` - Get role-specific metrics

## WebSocket Events

### Client → Server
- `join-gap` - Join gap room for real-time updates
- `leave-gap` - Leave gap room

### Server → Client
- `new-comment` - Broadcast new comment to gap room members

## Project Structure

```
├── client/
│   └── src/
│       ├── components/        # Reusable UI components
│       │   ├── ui/           # shadcn/ui base components
│       │   ├── examples/     # Component examples/demos
│       │   ├── StatusBadge.tsx
│       │   ├── PriorityIndicator.tsx
│       │   ├── MetricCard.tsx
│       │   ├── UserAvatar.tsx
│       │   ├── GapCard.tsx
│       │   ├── AISuggestionPanel.tsx
│       │   ├── CommentThread.tsx
│       │   ├── TimelineView.tsx
│       │   ├── AppSidebar.tsx
│       │   ├── Header.tsx
│       │   ├── RichTextEditor.tsx
│       │   └── FormBuilder.tsx
│       ├── pages/            # Route pages
│       │   ├── LoginPage.tsx
│       │   ├── ManagementDashboard.tsx
│       │   ├── POCDashboard.tsx
│       │   ├── QAOpsDashboard.tsx
│       │   ├── GapDetailPage.tsx
│       │   └── GapSubmissionForm.tsx
│       ├── lib/              # Utilities
│       │   ├── api.ts        # API client functions
│       │   └── queryClient.ts # React Query setup
│       ├── App.tsx           # Main app component
│       └── index.css         # Global styles
├── server/
│   ├── db.ts                 # Database connection
│   ├── storage.ts            # Storage interface & implementation
│   ├── auth.ts               # Authentication middleware
│   ├── routes.ts             # API routes
│   ├── ai-similarity.ts      # TF-IDF similarity algorithm
│   ├── seed.ts               # Database seeding
│   └── index.ts              # Express server setup
├── shared/
│   └── schema.ts             # Drizzle schema & Zod types
└── design_guidelines.md      # Design system documentation
```

## Development Workflow

### Setup
1. Database is automatically provisioned (Neon PostgreSQL)
2. Schema is pushed via `npm run db:push`
3. Seed data via `tsx server/seed.ts` (optional)

### Running
- `npm run dev` - Starts Express + Vite dev server on port 5000

### Authentication
Demo users (after seeding):
- `admin@gapops.com` - Admin role
- `manager@gapops.com` - Management role
- `qa@gapops.com` - QA/Ops role
- `poc@gapops.com` - POC role

Any email can be used with role selection for demo purposes.

## Design Principles

### Information Density
- Dense but breathable layout
- Gmail-inspired threading for comments
- Scannable status indicators
- Efficient use of screen space

### Role-Aware Interfaces
- Each role sees tailored dashboards
- Workflows optimized for specific tasks
- Permissions enforced at UI and API levels

### Status-Driven Design
- Visual clarity for gap states
- Color-coded priority indicators
- Pulsing animation for overdue items
- Timeline visualization for workflow progress

### AI Integration
- Non-intrusive suggestions
- Confidence scores displayed
- One-click SOP application
- Similarity percentages for transparency

## Recent Changes

### November 7, 2025
- **Backend Implementation**: Complete API routes for all features
- **Database Schema**: Drizzle ORM schema with 9 core tables
- **Authentication**: Session-based auth with role-based access control
- **AI Similarity**: TF-IDF algorithm for gap matching
- **WebSocket**: Real-time comment updates
- **Frontend Integration**: Connected all pages to backend APIs
- **Seeding**: Database seeding script for initial data

## Future Enhancements

### Planned Features
1. **Email Notifications**: Automated alerts for assignments, TAT breaches
2. **Advanced Analytics**: Recurring gap patterns, department heatmaps
3. **SOP Versioning**: Full version history and diff viewing
4. **Bulk Actions**: Assign multiple gaps, batch updates
5. **Export Functionality**: PDF reports, CSV exports
6. **Mobile App**: React Native companion app
7. **Integration**: Slack, Microsoft Teams webhooks

### Technical Debt
- Type safety improvements in API client
- Error boundary components
- Comprehensive test coverage
- Performance optimization for large datasets
- Pagination for gap lists

## Production Deployment

### Environment Variables
- `DATABASE_URL` - Neon PostgreSQL connection string
- `SESSION_SECRET` - Session encryption key
- `PORT` - Server port (default: 5000)

### Considerations
- Enable session persistence (e.g., connect-pg-simple)
- Configure CORS for production domain
- Enable production SSL for WebSocket
- Set up monitoring and error tracking
- Implement rate limiting
- Enable database backups

## Architecture Decisions

### Why Drizzle ORM?
- Type-safe SQL queries
- Better performance than traditional ORMs
- Direct SQL control when needed
- Excellent TypeScript integration

### Why Session-Based Auth?
- Simpler than JWT for this use case
- Better security for web applications
- Server-side session invalidation
- Lower complexity

### Why TF-IDF Over ML?
- No external API dependencies
- Fast computation
- Interpretable results
- Sufficient for text similarity
- Can be enhanced with ML later

### Why Socket.io?
- Reliable WebSocket implementation
- Automatic fallback mechanisms
- Room-based broadcasting
- Well-documented and battle-tested

## Performance Considerations

- React Query caching reduces API calls
- Optimistic updates for better UX
- Lazy loading for modals and dialogs
- Indexed database columns for fast queries
- Connection pooling for database
- WebSocket rooms prevent unnecessary broadcasts

---

**Last Updated**: November 7, 2025  
**Version**: 1.0.0  
**Status**: Full Backend & Frontend Implementation Complete

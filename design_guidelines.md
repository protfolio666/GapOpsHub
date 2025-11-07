# GapOps Design Guidelines

## Design Approach
**System-Based Approach**: Material Design principles combined with Linear's dashboard aesthetics and Gmail's threading patterns. This enterprise workflow tool prioritizes clarity, information density, and efficient task completion over visual experimentation.

## Core Design Principles
1. **Functional Clarity**: Every element serves the workflow - reduce decoration, maximize information accessibility
2. **Role-Aware Hierarchy**: Each user role sees tailored interfaces optimized for their tasks
3. **Status-Driven Design**: Visual indicators for gap states (Pending, Assigned, Overdue, Resolved, Reopened) must be immediately scannable
4. **Dense but Breathable**: Pack information efficiently while maintaining comfortable reading rhythm

---

## Typography

**Font Families** (via Google Fonts CDN):
- Primary: Inter (400, 500, 600, 700) - UI text, labels, buttons
- Monospace: JetBrains Mono (400, 500) - gap IDs, timestamps, technical data

**Hierarchy**:
- Page Headers: text-2xl font-semibold (Management Dashboard, POC Panel)
- Section Headers: text-lg font-medium (New Submissions Queue, Assigned Gaps)
- Card Titles: text-base font-medium (gap titles in lists)
- Body Text: text-sm font-normal (descriptions, comments)
- Metadata/Labels: text-xs font-medium uppercase tracking-wide (STATUS, PRIORITY labels)
- Micro Text: text-xs (timestamps, "3 days ago")

---

## Layout System

**Spacing Primitives** (Tailwind units): Use p-2, p-4, p-6, p-8 consistently
- Card padding: p-6
- Section spacing: space-y-6 or space-y-8
- List item padding: p-4
- Button padding: px-4 py-2
- Dashboard grid gaps: gap-6

**Grid Structures**:
- Dashboard Cards: 3-column grid on desktop (grid-cols-1 md:grid-cols-2 lg:grid-cols-3)
- Metrics Overview: 4-column for stat cards (grid-cols-2 lg:grid-cols-4)
- Gap Lists: Single column with clear separators
- Form Builder: 2-column layout (field palette left, canvas right)

**Containers**:
- Max-width: max-w-7xl for main content areas
- Sidebar navigation: Fixed width w-64
- Detail panels: Full-width with inner max-w-4xl for readability

---

## Component Library

### Navigation
- **Top Bar**: Fixed header with logo, role indicator badge, user dropdown, notification bell icon
- **Sidebar** (Desktop): Vertical nav with icons + labels, active state with left border accent
- **Mobile**: Hamburger menu → slide-out drawer

### Cards & Lists
- **Metric Cards**: Elevated cards with large number (text-3xl font-bold), small label below, optional trend indicator
- **Gap Cards**: Compact cards with gap ID badge, title, status pill, priority icon, assigned user avatar, timestamp
- **List Items**: Alternating subtle background (hover state), clear dividers, dense 3-line preview (title, metadata row, description snippet)

### Forms & Inputs
- **Form Builder Canvas**: Drag-drop zone with dotted border placeholder, field cards with drag handles and delete icons
- **Gap Submission Form**: Rich text editor (Tiptap-style toolbar), file upload drop zone with preview thumbnails
- **Input Fields**: Outlined style with floating labels, validation states (error red border, success green checkmark)

### Status & Priority Indicators
- **Status Pills**: Small rounded badges (rounded-full px-3 py-1 text-xs font-medium)
  - PendingAI: neutral gray
  - Assigned: blue
  - InProgress: amber
  - Overdue: red with pulse animation
  - Resolved: green
  - Closed: gray outline
- **Priority Icons**: Triangle (high), circle (medium), dash (low) with corresponding urgency

### AI Suggestion Panel
- **Similar Gaps Section**: Card with gradient border, 3 stacked mini-cards showing similarity percentage (85% match), gap title, quick-view button
- **SOP Suggestion**: Highlighted card with confidence score, SOP title, link, "Apply SOP" primary button

### Comments & Threading
- **Gmail-Style Threading**: Nested indentation (ml-8 for replies), avatar + name header, timestamp, message body in text-sm, attachment chips below
- **Comment Input**: Bottom-docked composer with rich text toolbar, attachment button, submit button

### Data Visualization
- **Charts**: Use Recharts bar charts for gap trends, line charts for smoothness score over time, donut charts for status distribution
- **Heatmap**: Grid visualization for department recurring gaps (darker shades = more frequent)

### Modals & Overlays
- **Assignment Modal**: Center-screen with POC selector dropdown, priority/severity toggles, date picker for TAT, assign button
- **Extension Request Modal**: Reason textarea, requested date picker, submit/cancel buttons

### Buttons
- **Primary**: Solid background, rounded-md px-4 py-2, font-medium
- **Secondary**: Outlined border, transparent background
- **Ghost**: No border, hover background only
- **Destructive**: Red variant for delete/reject actions

---

## Page-Specific Layouts

### Management Dashboard
- **Top Row**: 4 metric cards (Total Gaps, Pending Review, Overdue, Resolved This Week)
- **AI Queue Section**: Full-width card with tabs (New Submissions, AI Flagged, Extension Requests), table view with expand-on-click rows showing AI panel
- **Charts Row**: 2-column grid (Gap Status Distribution donut, Top QA Teams bar chart)

### POC Panel
- **Priority List**: Sorted table/list, Overdue items at top with red left border, High Priority with amber accent
- **Gap Detail View**: Split layout (left: metadata sidebar with status, assigned date, TAT countdown; right: description, comments thread, action buttons)

### QA/Ops Submission
- **Create Gap**: Full-screen form with progress indicator (if multi-step), prominent submit button
- **My Submissions**: Filterable card grid, search bar, status filter chips

### Gap Detail Page
- **Header**: Gap ID badge, title (text-xl font-semibold), status pill, priority, assigned user avatar
- **Body Layout**: 2-column on desktop (left: 65% for description + comments, right: 35% sidebar for metadata, AI suggestions, attachments gallery)
- **Timeline**: Vertical progress stepper showing Created → AI Review → Assigned → Resolved → Closed with timestamps

---

## Responsive Behavior
- **Desktop (lg)**: Full sidebar + multi-column dashboards
- **Tablet (md)**: Collapsible sidebar, 2-column grids reduce to 1-2 columns
- **Mobile**: Bottom tab navigation, single-column lists, stacked detail views

---

## Animations
Use sparingly - only for:
- Status transitions (fade between pills)
- Modal entry/exit (scale + fade)
- Notification toasts (slide-in from top-right)
- Overdue pulse (subtle red glow on overdue badges)

---

## Images
**No hero images** - this is a functional dashboard tool. Use:
- **User Avatars**: Circular, 32px for lists, 40px for headers
- **Attachment Thumbnails**: Square 80px previews in galleries
- **Empty States**: Simple illustrations (e.g., "No gaps submitted yet" with minimal line art icon)
- **File Type Icons**: Standard document/image/video icons for attachment lists
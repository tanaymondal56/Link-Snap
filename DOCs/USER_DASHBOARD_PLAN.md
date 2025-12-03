# Link Snap - User Dashboard & Experience Strategy

## 1. Philosophy: The "Power User" Workspace

The dashboard is where the user lives. It shouldn't just list links; it should help them _manage_ their digital footprint. It needs to be fast, intuitive, and offer "Pro" features that make them feel in control.

---

## 2. The Layout Structure (DashboardLayout)

A persistent frame that keeps tools accessible.

- **Sidebar (Collapsible)**:
  - **Brand**: "Link Snap" Logo.
  - **Primary CTA**: A large, distinct "New Link" button.
  - **Navigation**:
    - 🏠 **Overview**: High-level stats and recent activity.
    - 🔗 **My Links**: The full library with search/filter.
    - 📈 **Analytics**: Aggregated data across all links.
    - ⚙️ **Settings**: Profile, API Keys (future), Password.
  - **Footer**: User Avatar + Name (Dropdown for Logout).
- **Top Bar**:
  - **Global Search**: "Search by URL, alias, or tag..." (Cmd+K style).
  - **Theme Toggle**: Sun/Moon icon.
  - **Notifications**: Bell icon for system alerts.

---

## 3. The "Main App Page" (Dashboard Home)

This is the landing zone after login. It focuses on **Speed** and **Insight**.

### A. The "Quick Snap" Widget

Placed prominently at the top.

- **Input**: "Paste a long URL to shorten..."
- **Action**: Pressing Enter instantly creates a link and shows a "Success Toast" with a Copy button.
- **UX**: No page reload. Instant gratification.

### B. Performance Cards (At a Glance)

A row of 4 stats to show value immediately.

1.  **Total Clicks**: Big number.
2.  **Clicks Today**: With a trend indicator (e.g., "↑ 12% from yesterday").
3.  **Active Links**: Count of working links.
4.  **Top Performer**: The alias of the most clicked link today.

### C. Recent Activity Feed

A simplified list of the last 5 created links.

- **Columns**: Icon (Favicon), Short Link, Created Time, Clicks (Today).
- **Quick Actions**: Copy, QR Code, View Stats.

---

## 4. The "My Links" Library (Feature Rich)

The core management interface.

### View Options

- **List View**: Data-dense, good for managing hundreds of links.
- **Grid View**: Visual cards, showing the QR code and a preview image of the destination.

### Advanced Filtering & Search

- **Search**: Real-time filtering by Alias or Original URL.
- **Sort**: By Date Created (Newest), Most Clicked, Least Clicked.
- **Filter**: Active vs. Inactive.

### The Link Row (Component)

Each item in the list is feature-packed:

- **Favicon**: Automatically fetched from the destination URL (visual recognition).
- **Short Link**: Click-to-copy behavior.
- **Sparkline**: A tiny line chart _inside the row_ showing the last 7 days of activity.
- **Tags**: Small colored badges (e.g., "Marketing", "Personal").
- **Action Menu (Three Dots)**:
  - ✏️ **Edit**: Change the destination (if allowed) or custom alias.
  - 📱 **QR Code**: Open the QR modal.
  - 📊 **Analytics**: Go to the detailed report.
  - 🗑️ **Delete**: With confirmation.

---

## 5. The "Create New" Experience (Modal)

When clicking "New Link", open a modal with advanced options.

- **Destination URL**: The required field.
- **Custom Alias**: "link-snap.com/[your-text-here]".
- **Title/Tag**: Add a friendly name for internal organization.
- **QR Settings**: Option to customize QR color (Future feature).

---

## 6. UX Micro-Interactions

- **Copy Feedback**: Clicking a link changes the icon to a checkmark and shows "Copied!" tooltip.
- **Empty States**: If the user has no links, show a friendly illustration and a "Create your first link" button.
- **Loading Skeletons**: Never show a blank screen while fetching data; use gray shimmer placeholders.
- **Error Handling**: If a custom alias is taken, show the error instantly (debounce validation) before they click submit.

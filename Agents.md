# Project: NBSupportApp Agents Guide

This document serves as the central knowledge base and rule set for AI agents (and developers) working on the NBSupportApp project.

## 1. Project Structure

- **frontend/**: ReactJS application (Vite).
- **backend/**: Spring Boot application.
- **services/**: Contains external or auxiliary services.
  - **dctm-rest/**: Deployed war file and documentation of Documentum REST services.

## 2. Operational Rules & Constraints

### 🛑 Read-Only Directories

- **`services/dctm-rest`**: This directory is **STRICTLY FOR ANALYSIS PURPOSES ONLY**.
  - Do **NOT** modify any code, configuration, or structural files within this directory.
  - Usage is limited to inspecting functionality, reviewing recovered source code, or checking documentation.

### 📚 API Documentation

- **Documentum REST API**:
  - Always refer to **`services/dctm-rest/docs/index.html`** (or the companion `rest.yaml`) to understand available endpoints, request schemas, and response formats for Documentum operations.
  - Do not guess API contracts; verify them against this documentation first.

## 3. Development Workflows

### Startup & Shutdown

- **Start Services**: Run `./start_services.sh` in the root directory.
  - This script automatically handles port conflicts (ports 5173 & 8080) before starting.
- **Stop Services**: Run `./stop_services.sh` to forcefully stop the backend and frontend services.

## 4. Environment

- **Frontend Port**: 5173
- **Backend Port**: 8080

## 5. Coding Standards & Best Practices

### Frontend (ReactJS)

Adhere to industry-standard best practices and Vercel's React guidelines:

- **Component Architecture**:
  - Build small, reusable, single-responsibility functional components.
  - Use strict file co-location (keep styles, tests, and component logic together or well-structured).
- **Performance**:
  - Optimize for Core Web Vitals (LCP, FID, CLS).
  - Use code-splitting (React.lazy) and lazy loading for assets.
  - Avoid unnecessary re-renders; use `useMemo` and `useCallback` appropriately.
- **State Management**:
  - Prefer server-state libraries (TanStack Query, SWR) for API data.
  - Use Context API sparingly for global global UI state (themes, auth).
  - Avoid prop-drilling; use composition.
- **Hooks**: Use custom hooks to abstract complex logic from UI components.
- **Naming Conventions**: PascalCase for components, camelCase for functions/variables.

### Backend (Spring Boot)

Follow industry-standard Java and Spring Boot best practices:

- **Layered Architecture**: Maintain strict separation of concerns (`Controller` -> `Service` -> `Repository`).
- **Dependency Injection**: Always use **Constructor Injection** (Lombok `@RequiredArgsConstructor`) instead of field injection (`@Autowired`).
- **REST Principles**:
  - Use standard HTTP methods and status codes.
  - APIs must be stateless.
  - Use DTOs (Data Transfer Objects) for requests and responses; never expose Entity models directly.
- **Error Handling**: Implement Global Exception Handling (using `@ControllerAdvice`) for consistent API error responses.
- **Security**:
  - Validate all inputs using Bean Validation (`@Valid`, `@NotNull`, inside DTOs).
  - Never log sensitive data.
- **Logging**: Use SLF4J (Lombok `@Slf4j`); strictly avoid `System.out.println`.

## 6. UI/UX Design Guidelines

### Modal Windows & Dialogs

**Dimension Constraints:**
- **Maximum Height**: Modals must not exceed **70% of viewport height** (`max-h-[70vh]`)
  - Rationale: Ensures visibility of parent window context and prevents overwhelming users
  - Users should always be aware they're in a modal, not a new page
- **Maximum Width**: Use semantic breakpoints (e.g., `max-w-5xl` for large forms, `max-w-2xl` for simple dialogs)
- **Minimum Spacing**: Maintain 16px (`p-4`) padding from viewport edges on all sides

**Scrolling Behavior:**
- **Large Content Lists**: When content exceeds modal height, implement internal scrolling
  - Apply `overflow-y-auto` to content panels, not the entire modal
  - Use custom styled scrollbars for professional appearance:
    ```css
    .scrollbar-thin {
      scrollbar-width: thin;
      scrollbar-color: #cbd5e1 #f1f5f9;
    }
    ```
  - Keep modal header and footer fixed (not scrollable)
  - Example: Member lists with 50+ items should scroll within their panel

**Modal Structure Best Practice:**
```jsx
<div className="fixed inset-0">  {/* Backdrop */}
  <div className="max-h-[70vh] flex flex-col">  {/* Modal container */}
    <header>Fixed Header</header>
    <div className="flex-1 overflow-y-auto min-h-0">  {/* Scrollable content */}
      Content with potential overflow
    </div>
    <footer>Fixed Footer</footer>
  </div>
</div>
```

**Key Principles:**
- Fixed header with title and close button
- Scrollable content area (applies `min-h-0` and `flex-1`)
- Fixed footer with action buttons
- Smooth transitions on open/close (`transition-all duration-300`)

### Tables & Data Grids

**Scrolling:**
- Horizontal scrolling enabled for tables with many columns: `overflow-x-auto`
- Sticky headers for vertical scrolling: Use `position: sticky` on `<thead>`
- Display visible row ranges: "Showing 1-10 of 150"

**Performance:**
- Implement pagination for datasets > 50 items
- Default page sizes: 10, 25, 50, 100
- Server-side pagination preferred over client-side filtering

### Loading States

**Guidelines:**
- Use skeleton screens for initial loads (pulse animation)
- Spinner with descriptive text for actions ("Loading members...")
- Disable action buttons during operations to prevent double-submission
- Minimum loading state duration: 200ms (prevents flashing)

### Notifications & Feedback

**Toast Notifications:**
- Position: Top-center or top-right
- Auto-dismiss: 3 seconds for success, 5 seconds for errors
- Color coding:
  - Success: Green (`bg-green-50`, `text-green-800`, `border-green-200`)
  - Error: Red (`bg-red-50`, `text-red-800`, `border-red-200`)
  - Warning: Yellow (`bg-yellow-50`, `text-yellow-800`, `border-yellow-200`)
  - Info: Blue (`bg-blue-50`, `text-blue-800`, `border-blue-200`)

**Inline Confirmations:**
- Use inline confirmation for destructive actions (delete, remove)
- Two-step pattern: Click action → Confirm/Cancel buttons appear
- Never rely solely on browser confirms (`window.confirm()`)

### Responsive Design

**Breakpoints (Tailwind):**
- Mobile: < 640px (sm)
- Tablet: 640px - 1024px (md, lg)
- Desktop: > 1024px (xl, 2xl)

**Modal Behavior:**
- Mobile: Full-screen or 95% viewport height
- Desktop: Centered with max 70% height
- Always maintain minimum 16px padding

### Color Palette (Professional Enterprise Theme)

**Primary Colors:**
- Brand Blue: `#0A66C2` (LinkedIn-inspired professional blue)
- Text Primary: `#0f172a` (slate-900)
- Text Secondary: `#64748b` (slate-500)
- Background: `#f8fafc` (slate-50)

**Interactive States:**
- Hover: Darken by 10% or use `hover:bg-opacity-90`
- Active: `ring-2 ring-blue-500/20`
- Disabled: `opacity-50 cursor-not-allowed`

**Borders & Dividers:**
- Light: `border-slate-200` (#e2e8f0)
- Medium: `border-slate-300` (#cbd5e1)

### Accessibility

**Keyboard Navigation:**
- Modal: Close on Escape key
- Focus trap within modal (prevent tabbing outside)
- Visible focus indicators (`focus:ring-2`)

**ARIA Labels:**
- Add `aria-label` to icon-only buttons
- Use `role="dialog"` for modals
- Provide `aria-describedby` for form hints

**Color Contrast:**
- Minimum 4.5:1 for normal text
- Minimum 3:1 for large text (18px+)
- Test with WebAIM contrast checker

### Animation & Transitions

**Duration Standards:**
- Fast: 150ms (hover effects)
- Normal: 300ms (modal open/close, dropdowns)
- Slow: 500ms (page transitions)

**Easing:**
- Use `ease-in-out` for most transitions
- `ease-out` for elements entering the viewport
- `ease-in` for elements leaving

**Performance:**
- Prefer `transform` and `opacity` over layout properties
- Use `will-change` sparingly and remove after animation

---

**Summary**: These guidelines ensure consistent, professional, and accessible user interfaces across the NBSupportApp. All UI components should follow these standards unless there's a compelling reason documented in code comments.

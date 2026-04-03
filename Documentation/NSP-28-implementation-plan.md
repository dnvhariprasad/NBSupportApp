# NSP-28: Edit Details of Users - By Super Admin and Local Admin

## Implementation Plan

**Jira:** [NSP-28](https://sedin.atlassian.net/browse/NSP-28)
**Branch:** NSP-28
**Status:** In Progress
**Assignee:** Hari Prasad

---

## Current State

- Basic user profile editing exists (14 fields via `EditUserProfileModal`)
- Only Documentum superuser detection (privilege=16), no app-level admin roles
- No email service, no scheduled tasks, no department head/OIC concepts
- No case delegation or pending case validation
- No RBAC at application level

---

## Phase 1: Foundation - Role-Based Access Control

### Task 1.1 - Admin Role Model & RBAC Backend
- Add `admin_role` field to `cms_user_profile` (values: `super_admin`, `local_admin`, `user`)
- Create `RoleService.java` to check admin permissions
- Add Spring interceptor/filter to enforce role-based API access
- Protect admin-only endpoints

**Files to create/modify:**
- `backend/src/main/java/com/example/backend/service/RoleService.java` (new)
- `backend/src/main/java/com/example/backend/config/RoleInterceptor.java` (new)
- `backend/src/main/java/com/example/backend/service/UserService.java` (modify)
- `backend/src/main/java/com/example/backend/service/AuthService.java` (modify)

### Task 1.2 - RBAC Frontend Guards
- Store user role in localStorage on login
- Add route guards for admin-only pages/actions
- Conditionally render edit controls based on role (Super Admin sees all, Local Admin sees subset)

**Files to create/modify:**
- `frontend/src/components/ProtectedRoute.jsx` (new)
- `frontend/src/App.jsx` (modify)
- `frontend/src/pages/UsersPage.jsx` (modify)
- `frontend/src/components/EditUserProfileModal.jsx` (modify)

---

## Phase 2: Core Admin Features

### Task 2.1 - Edit Designation (Super Admin + Local Admin)
- Restrict designation editing to only Super Admin and Local Admin
- Add audit trail for designation changes

**Files to modify:**
- `frontend/src/components/EditUserProfileModal.jsx`
- `backend/src/main/java/com/example/backend/service/UserService.java`

### Task 2.2 - Disable/Enable User (Super Admin only)
- Backend: New endpoint `PATCH /api/users/profiles/{id}/status` with `enable`/`disable` action
- Sync `is_active` flag in `cms_user_profile` + `user_state` in `dm_user`
- Frontend: Toggle switch in user edit modal, visible only to Super Admin

**Files to create/modify:**
- `backend/src/main/java/com/example/backend/controller/UserController.java` (modify)
- `backend/src/main/java/com/example/backend/service/UserService.java` (modify)
- `frontend/src/components/EditUserProfileModal.jsx` (modify)

### Task 2.3 - Auto-Disable Inactive Users (30 days)
- Add `spring-boot-starter-quartz` or use `@Scheduled`
- Create `UserInactivityScheduler.java` - runs daily
- Query `dm_user` for `user_login_date` older than 30 days
- Auto-set `user_state = 1` (inactive) for matching users
- Log all auto-disablements

**Files to create/modify:**
- `backend/pom.xml` (modify - add scheduler dependency)
- `backend/src/main/java/com/example/backend/scheduler/UserInactivityScheduler.java` (new)
- `backend/src/main/java/com/example/backend/BackendApplication.java` (modify - enable scheduling)

### Task 2.4 - Deactivate User Permanently (Super Admin only)
- Backend: New endpoint `POST /api/users/profiles/{id}/deactivate`
- **Validation**: Query pending cases assigned to user before deactivation
- If pending cases found: return case list and prompt for delegation
- New endpoint `POST /api/users/profiles/{id}/deactivate-with-delegation` accepting target user
- Frontend: Deactivation modal with pending case warning + delegation user picker

**Files to create/modify:**
- `backend/src/main/java/com/example/backend/controller/UserController.java` (modify)
- `backend/src/main/java/com/example/backend/service/UserService.java` (modify)
- `backend/src/main/java/com/example/backend/service/CaseService.java` (modify)
- `frontend/src/components/DeactivateUserModal.jsx` (new)
- `frontend/src/components/EditUserProfileModal.jsx` (modify)

---

## Phase 3: Email Infrastructure

### Task 3.1 - Email Service Setup
- Add `spring-boot-starter-mail` dependency
- Configure SMTP in `application.properties`
- Create `EmailService.java` with template support
- Create email templates: password reset, department head assignment, letter reassignment

**Files to create/modify:**
- `backend/pom.xml` (modify)
- `backend/src/main/resources/application.properties` (modify)
- `backend/src/main/java/com/example/backend/service/EmailService.java` (new)
- `backend/src/main/resources/templates/` (new directory with email templates)

### Task 3.2 - Password Reset via Email (Super Admin only)
- Backend: `POST /api/users/profiles/{id}/reset-password` - triggers email
- Documentum password update via `dm_user` object
- Frontend: "Reset Password" button in user edit modal (Super Admin only)

**Files to create/modify:**
- `backend/src/main/java/com/example/backend/controller/UserController.java` (modify)
- `backend/src/main/java/com/example/backend/service/UserService.java` (modify)
- `backend/src/main/java/com/example/backend/service/EmailService.java` (modify)
- `frontend/src/components/EditUserProfileModal.jsx` (modify)

---

## Phase 4: Department/Vertical Head Management

### Task 4.1 - Department Head Data Model
- Add `is_department_head` / `is_vertical_head` boolean fields to `cms_user_profile`
- Create `DepartmentService.java` for head management logic

**Files to create/modify:**
- `backend/src/main/java/com/example/backend/service/DepartmentService.java` (new)
- `backend/src/main/java/com/example/backend/service/UserService.java` (modify)

### Task 4.2 - Assign Department/Vertical Head (Super Admin + Local Admin)
- Backend: `POST /api/users/profiles/{id}/make-department-head`
- **Validation**: Check if department already has a head
- If existing head found: auto-reassign all letters to new head
- Create `LetterReassignmentService.java` for letter transfer logic
- Send email notification to new head with letter details
- Frontend: "Make Department Head" / "Make Vertical Head" buttons

**Files to create/modify:**
- `backend/src/main/java/com/example/backend/controller/UserController.java` (modify)
- `backend/src/main/java/com/example/backend/service/DepartmentService.java` (modify)
- `backend/src/main/java/com/example/backend/service/LetterReassignmentService.java` (new)
- `backend/src/main/java/com/example/backend/service/EmailService.java` (modify)
- `frontend/src/components/EditUserProfileModal.jsx` (modify)

---

## Phase 5: OIC (Officer in Charge) Management

### Task 5.1 - OIC Data Model & Service
- Add `is_oic`, `oic_start_date`, `oic_end_date` fields to `cms_user_profile`
- Create `OICService.java` for OIC assignment logic
- Validate: user must be senior-most officer below GM grade
- OIC grants case-marking rights to DMD/Chairman only

**Files to create/modify:**
- `backend/src/main/java/com/example/backend/service/OICService.java` (new)
- `backend/src/main/java/com/example/backend/service/UserService.java` (modify)

### Task 5.2 - OIC Assignment UI (Super Admin only)
- Backend: `POST /api/users/profiles/{id}/make-oic` with duration params
- Scheduled task to auto-revoke OIC when duration expires
- Frontend: "Make OIC" button with date range picker modal

**Files to create/modify:**
- `backend/src/main/java/com/example/backend/controller/UserController.java` (modify)
- `backend/src/main/java/com/example/backend/service/OICService.java` (modify)
- `backend/src/main/java/com/example/backend/scheduler/OICExpiryScheduler.java` (new)
- `frontend/src/components/OICAssignmentModal.jsx` (new)
- `frontend/src/components/EditUserProfileModal.jsx` (modify)

---

## Phase 6: Enhanced Admin UI & Audit

### Task 6.1 - Redesign User Edit Modal
- Split into tabbed interface: **Profile | Status | Roles | Actions**
- Profile tab: designation, contact info (existing fields)
- Status tab: Enable/Disable, Deactivate (with case check)
- Roles tab: Department Head, Vertical Head, OIC assignment
- Actions tab: Reset Password, View Audit Log
- Show/hide tabs based on admin role

**Files to modify:**
- `frontend/src/components/EditUserProfileModal.jsx` (major refactor)

### Task 6.2 - Admin Action Audit Log
- Create `cms_admin_audit` Documentum object type
- Log all admin actions: who changed what, when, previous value
- Add audit log viewer accessible to Super Admin

**Files to create/modify:**
- `backend/src/main/java/com/example/backend/service/AuditService.java` (new)
- `backend/src/main/java/com/example/backend/controller/AuditController.java` (new)
- `frontend/src/components/AuditLogViewer.jsx` (new)

---

## Dependency Graph

```
Phase 1 (RBAC) ───────────┐
                           ├──> Phase 2 (Core Features)
Phase 3 (Email) ──────────┤
                           ├──> Phase 4 (Dept Head) ──> Phase 6 (UI + Audit)
                           └──> Phase 5 (OIC) ─────────┘
```

## Priority Order

| Priority | Phase | Description | Depends On |
|----------|-------|-------------|------------|
| 1 | Phase 1 | RBAC Foundation | None |
| 2 | Phase 2 | Core Admin Features | Phase 1 |
| 3 | Phase 3 | Email Infrastructure | None |
| 4 | Phase 4 | Department Head Management | Phase 1, Phase 3 |
| 5 | Phase 5 | OIC Management | Phase 1, Phase 3 |
| 6 | Phase 6 | Enhanced UI & Audit | Phase 1-5 |

## Feature Matrix

| Feature | Super Admin | Local Admin |
|---------|-------------|-------------|
| Edit Designation | Yes | Yes |
| Disable/Enable User | Yes | No |
| Auto-Disable (30 days) | System | System |
| Deactivate User | Yes | No |
| Reset Password (email) | Yes | No |
| Make Department Head | Yes | Yes |
| Make Vertical Head | Yes | Yes |
| Make OIC | Yes | No |
| View Audit Log | Yes | No |

# NBSupportApp — Design Patterns

This document defines the module separation, endpoint conventions, and implementation patterns for the NBSupportApp project.

## Module Separation: CMS vs Digidak

The application has two distinct modules. All features, endpoints, and Documentum storage must be clearly assigned to one module.

### CMS Module

- **Purpose**: Case management, user/group administration, department management, metadata for case workflows
- **Documentum folder root**: `/ECM CONFIG/`
- **Object types**: `cms_file_number`, `cms_case_folder`, `cms_user_profile`, `dm_folder` (for simple metadata lists)
- **API path convention**: `/api/metadata/<resource-name>` (e.g., `/api/metadata/file-numbers`, `/api/metadata/case-types`, `/api/metadata/hindi-comments`)
- **Frontend tab**: "Case" section in MetadataPage

### Digidak Module

- **Purpose**: Digitization/dispatch metadata — nature of correspondence, mode of dispatch, external categories
- **Documentum folder root**: `/Digidak Config/`
- **Object type**: `cms_digidak_metadata` (with `input`/`results` fields)
- **API path convention**: `/api/metadata/digidak/metadata` (generic, filtered by `input` param)
- **Frontend tab**: "Digidak" section in MetadataPage

### Summary Table

| Aspect | CMS | Digidak |
|--------|-----|---------|
| Folder root | `/ECM CONFIG/` | `/Digidak Config/` |
| Object types | `cms_file_number`, `dm_folder` | `cms_digidak_metadata` |
| API prefix | `/api/metadata/<name>` | `/api/metadata/digidak/metadata` |
| Frontend section | CaseSection | DigidakSection |
| Examples | File Numbers, Case Types, Hindi Comments | Nature of Correspondence, Mode of Dispatch, Category External |

### Rule

> **Never use Digidak endpoints (`/api/metadata/digidak/*`) or `cms_digidak_metadata` for CMS features.** CMS metadata uses dedicated endpoints and stores under `/ECM CONFIG/`.

---

## ECM CONFIG Folder Structure (Documentum)

Current folders under `/ECM CONFIG/`:

| Folder | ID | Used By | Status |
|--------|----|---------|--------|
| `Case Type` | `0b02cba0800113b9` | MetadataService.listCaseTypes/createCaseType | Active |
| `CaseMovementSlipTemplate` | `0b02cba08005e6ba` | — | Template storage |
| `File Number` | `0b02cba08000e50d` | MetadataService.listFileNumbers/createFileNumber | Active |
| `Hindi Comments` | `0b02cba08011b946` | **Not yet implemented** | Empty, ready to use |
| `NotesheetTemplate` | `0b02cba0800323aa` | — | Template storage |
| `Office Type` | `0b02cba0800113c1` | DepartmentService | Active (HO/RO/TE hierarchy) |

---

## CMS Metadata Implementation Pattern

When adding a new CMS metadata type (e.g., Hindi Comments), follow the **Case Type pattern** — store entries as `dm_folder` objects under `/ECM CONFIG/<Name>/`.

### Step 1: Backend Service (`MetadataService.java`)

Add two methods:

```java
// LIST: Query all entries from the folder
public List<Map<String, Object>> listHindiComments() {
    String dql = "SELECT r_object_id, object_name FROM dm_folder "
               + "WHERE FOLDER('/ECM CONFIG/Hindi Comments') ORDER BY object_name";
    // Execute DQL with pagination loop (PAGE_SIZE=100)
    // Extract entries[].content.properties from response
    // Return list of {r_object_id, object_name}
}

// CREATE: Resolve parent folder, POST new dm_folder inheriting ACL
public Map<String, Object> createHindiComment(String objectName) {
    // 1. resolveFolderInfo() for '/ECM CONFIG/Hindi Comments' → get folderId, acl_name, acl_domain
    // 2. Build properties: {r_object_type: "dm_folder", object_name, acl_name, acl_domain}
    // 3. POST to /repositories/{repo}/folders/{folderId}/objects
    // 4. Return {success: true, message: "..."}
}
```

### Step 2: Backend Controller (`MetadataController.java`)

Add CMS-scoped endpoints (NOT under `/digidak/`):

```java
@GetMapping("/hindi-comments")
public ResponseEntity<?> listHindiComments() { ... }

@PostMapping("/hindi-comments")
public ResponseEntity<Map<String, Object>> createHindiComment(@RequestBody Map<String, Object> request) { ... }
```

### Step 3: Frontend (`MetadataPage.jsx`)

Add a `HindiCommentsTab` component inside `CaseSection`, following the `CaseTypeTab` pattern:
- Left panel: Create form (single text input + submit button)
- Right panel: List display with refresh
- Wire into `CASE_TABS` array

### Key Implementation Details

- **DQL for listing**: `SELECT r_object_id, object_name FROM dm_folder WHERE FOLDER('/ECM CONFIG/Hindi Comments') ORDER BY object_name`
- **Folder resolution**: Use existing `resolveFolderInfo()` helper to get parent folder ID and ACL
- **ACL inheritance**: New objects inherit `acl_name` and `acl_domain` from parent folder
- **Object creation**: POST to `/repositories/{repo}/folders/{folderId}/objects` with `Content-Type: application/vnd.emc.documentum+json`
- **Update method**: POST with `X-HTTP-Method-Override: PATCH` header
- **Delete method**: DELETE to `/repositories/{repo}/objects/{objectId}`
- **Error handling**: Wrap in try/catch, return `{success: false, message: ...}` on failure
- **Logging prefix**: `[HindiComments]` for SLF4J log messages

---

## Digidak Metadata Implementation Pattern

For Digidak features, use the existing generic `NatureOfCorrespondenceTab` component and digidak endpoints.

### Backend

Already generic — no code changes needed. The existing endpoints handle any `cms_digidak_metadata` filtered by `input` value:
- `POST /api/metadata/digidak/metadata` — body: `{input, results, folder_path}`
- `GET /api/metadata/digidak/metadata?input={value}` — list by input key
- `PUT /api/metadata/digidak/metadata/{objectId}` — update results
- `DELETE /api/metadata/digidak/metadata/{objectId}` — delete

### Frontend

Reuse `NatureOfCorrespondenceTab` with appropriate props:
```jsx
<NatureOfCorrespondenceTab
  inputValue="new_digidak_type"
  folderPath="/Digidak Config/New Type"
  listLabel="New Type Values"
  formTitle="Add New Type"
  fieldLabel="Value"
  onToast={onToast}
/>
```

Wire into `DigidakSection` tabs (not CaseSection).

---

## Endpoint Naming Convention

| Module | Pattern | Examples |
|--------|---------|---------|
| CMS | `GET/POST /api/metadata/<kebab-name>` | `/api/metadata/file-numbers`, `/api/metadata/case-types`, `/api/metadata/hindi-comments` |
| Digidak | `GET/POST/PUT/DELETE /api/metadata/digidak/metadata` | Always the same path, filtered by `input` query param |
| Auth | `/api/auth/*` | `/api/auth/login`, `/api/auth/users` |
| Cases | `/api/cases/*` | `/api/cases/search` |
| Workflows | `/api/workflows/*` | `/api/workflows/processes`, `/api/workflows/instances` |
| Groups | `/api/groups/*` | `/api/groups/search`, `/api/groups/{name}/members` |
| Users | `/api/users/*` | `/api/users/profiles`, `/api/users/by-dept` |
| Departments | `/api/departments` | `/api/departments` |
| Inbox | `/api/inbox/*` | `/api/inbox`, `/api/inbox/tasklist` |
| Delegation | `/api/delegate/*` | `/api/delegate/cases`, `/api/delegate` |
| Query | `/api/query/*` | `/api/query/execute` |
| Transliterate | `/api/transliterate` | `/api/transliterate?text=...` |
| Settings | `/api/settings` | `/api/settings` |

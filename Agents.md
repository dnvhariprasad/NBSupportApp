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

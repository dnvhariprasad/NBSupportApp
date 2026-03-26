package com.example.backend.service;

import com.example.backend.config.OtdsConfig;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.*;
import java.util.stream.Collectors;

@Service
@Slf4j
public class OtdsService {

    private final OtdsConfig otdsConfig;
    private final RestClient restClient;

    // All known OTDS authentication endpoint variants (relative to host root)
    private static final List<String> AUTH_CANDIDATES = List.of(
            "/otdsws/rest/authentication/credentials",      // OTDS 25.x (spec at /otdsws/rest/openapi.json)
            "/otdsws/api/authentication/credentials",       // Swagger UI at /otdsws/api/index.html
            "/otdsws/api/v1/authentication/credentials",    // versioned under /api/
            "/otdsws/api/authentication",                   // alternate under /api/
            "/otdsws/rest/v1/authentication/credentials",   // OTDS 16.x standard
            "/otdsws/rest/v2/authentication/credentials",   // OTDS 22.x
            "/otdsws/rest/v1/authentication",               // some versions
            "/otdsws/rest/v1/auth",                         // alternate
            "/otdsws/authentication/credentials",           // no-version path
            "/otdsws/authentication",                       // older OTDS
            "/otds/rest/v1/authentication/credentials",     // /otds Tomcat context
            "/otds/rest/authentication/credentials",        // /otds without version
            "/otds/authentication/credentials",             // /otds direct
            "/otdstenant/rest/v1/authentication/credentials" // multi-tenant
    );

    // Swagger/OpenAPI spec locations to auto-discover actual endpoints
    private static final List<String> SWAGGER_SPEC_CANDIDATES = List.of(
            "/otdsws/rest/openapi.json",                    // OTDS 25.x confirmed
            "/otdsws/api/swagger.json",
            "/otdsws/api/v2/api-docs",
            "/otdsws/api/openapi.json",
            "/otdsws/rest/v1/swagger.json",
            "/otds/api/swagger.json",
            "/otds/api/v2/api-docs"
    );

    // Known OTDS password-update endpoint patterns (relative to host root)
    // %s = user login name
    private static final List<String> PASSWORD_CANDIDATES = List.of(
            "/otdsws/api/users/%s/password",
            "/otdsws/api/v1/users/%s/password",
            "/otdsws/rest/v1/users/%s/password",
            "/otdsws/rest/v2/users/%s/password",
            "/otdsws/users/%s/password",
            "/otds/rest/v1/users/%s/password",
            "/otds/users/%s/password"
    );

    public OtdsService(OtdsConfig otdsConfig, RestClient.Builder restClientBuilder) {
        this.otdsConfig = otdsConfig;
        this.restClient = restClientBuilder.build();
    }

    // ─── Authentication ───────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private String getAdminTicket() {
        String authUrl = otdsConfig.getUrl() + "/authentication/credentials";
        log.info("[OTDS] Authenticating at: {}", authUrl);

        Map<String, String> body = Map.of(
                "userName", otdsConfig.getUsername(),
                "password", otdsConfig.getPassword()
        );

        try {
            Map<String, Object> response = restClient.post()
                    .uri(authUrl)
                    .contentType(MediaType.APPLICATION_JSON)
                    .accept(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(Map.class);

            if (response == null || !response.containsKey("ticket")) {
                log.error("[OTDS] Auth response missing 'ticket'. Keys: {}", response != null ? response.keySet() : "null");
                throw new RuntimeException("OTDS authentication failed: no ticket in response");
            }
            log.info("[OTDS] Authentication successful");
            return (String) response.get("ticket");
        } catch (RestClientException e) {
            log.error("[OTDS] Authentication failed at {}: {}", authUrl, e.getMessage());
            throw new RuntimeException("OTDS authentication failed (" + authUrl + "): " + e.getMessage(), e);
        }
    }

    // ─── Password Update ──────────────────────────────────────────────────────

    /** Updates OTDS password. Existing callers keep the "require change on next login" default. */
    public void updateUserPassword(String loginName, String newPassword) {
        updateUserPassword(loginName, newPassword, true);
    }

    public void updateUserPassword(String loginName, String newPassword, boolean requirePasswordChange) {
        String ticket = getAdminTicket();
        // Use URI template so RestClient percent-encodes the '@' in qualified IDs like loginName@DCTMPartitions
        String pwUrlTemplate = otdsConfig.getUrl() + "/users/{userId}/password";
        log.info("[OTDS] Updating password for '{}' at: {}", loginName, pwUrlTemplate);

        // PasswordResetParams schema (from OTDS OpenAPI spec) only contains "newPassword"
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("newPassword", newPassword);

        try {
            restClient.put()
                    .uri(pwUrlTemplate, loginName)
                    .header("OTDSTicket", ticket)
                    .contentType(MediaType.APPLICATION_JSON)
                    .accept(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .toBodilessEntity();
            log.info("[OTDS] Password updated for: {}", loginName);
        } catch (RestClientException e) {
            log.error("[OTDS] Password update failed for '{}': {}", loginName, e.getMessage());
            throw new RuntimeException("OTDS password update failed for '" + loginName + "': " + e.getMessage(), e);
        }
    }

    // ─── New User Provisioning ────────────────────────────────────────────────

    /**
     * Creates a brand-new user account in OTDS using the exact User schema from the OpenAPI spec:
     *   POST /users  { "name": "loginName", "userPartitionID": "DCTMPartitions",
     *                  "values": [ { "name": "displayName", "values": ["Full Name"] },
     *                              { "name": "UserMustChangePasswordAtNextSignIn", "values": ["false"] } ] }
     *
     * "UserMustChangePasswordAtNextSignIn" = "false" → "Do not require password change on reset"
     * "UserMustChangePasswordAtNextSignIn" = "true"  → "Require password change on reset"
     */
    public void createOtdsUserInPartition(String loginName, String displayName, String email,
                                          String partitionName, boolean requirePasswordChange) {
        String ticket = getAdminTicket();
        String url = otdsConfig.getUrl() + "/users";
        log.info("[OTDS] Creating user '{}' in partition '{}' at: {}", loginName, partitionName, url);

        // values = array of Attribute objects: { "name": "attrName", "values": ["val"] }
        List<Map<String, Object>> valuesList = new ArrayList<>();
        if (displayName != null && !displayName.isBlank()) {
            valuesList.add(Map.of("name", "displayName", "values", List.of(displayName)));
        }
        if (email != null && !email.isBlank()) {
            valuesList.add(Map.of("name", "mail", "values", List.of(email)));
        }
        // Password Options: "UserMustChangePasswordAtNextSignIn" false = "Do not require password change on reset"
        valuesList.add(Map.of("name", "UserMustChangePasswordAtNextSignIn",
                "values", List.of(String.valueOf(requirePasswordChange))));

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("name", loginName);               // object CN / login name
        body.put("userPartitionID", partitionName); // target partition
        body.put("values", valuesList);

        try {
            restClient.post()
                    .uri(url)
                    .header("OTDSTicket", ticket)
                    .contentType(MediaType.APPLICATION_JSON)
                    .accept(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .toBodilessEntity();
            log.info("[OTDS] User '{}' created in partition '{}' (requirePasswordChange={})",
                    loginName, partitionName, requirePasswordChange);
        } catch (RestClientException e) {
            log.error("[OTDS] User creation failed for '{}': {}", loginName, e.getMessage());
            throw new RuntimeException("OTDS user creation failed for '" + loginName + "': " + e.getMessage(), e);
        }
    }

    /**
     * Full OTDS setup for a newly created Documentum user:
     * 1. Creates the OTDS user account in the named partition (with password-change option set)
     * 2. Sets the initial password
     */
    public void setupNewOtdsUser(String loginName, String displayName, String email,
                                  String password, String partitionName, boolean requirePasswordChange) {
        log.info("[OTDS] setupNewOtdsUser: loginName={}, partition={}", loginName, partitionName);
        createOtdsUserInPartition(loginName, displayName, email, partitionName, requirePasswordChange);
        // OTDS user ID after creation is "loginName@partitionName" — use qualified ID for password update
        updateUserPassword(loginName + "@" + partitionName, password, requirePasswordChange);
        log.info("[OTDS] setupNewOtdsUser complete for: {}", loginName);
    }

    // ─── Account Enable / Disable ─────────────────────────────────────────────

    /**
     * Enables or disables an OTDS account via PUT /users/{userId}.
     * Sets attribute: { "name": "accountDisabled", "values": ["true"|"false"] }
     * userId should be the qualified ID, e.g. "loginName@DCTMPartitions".
     */
    public void setAccountDisabled(String userId, boolean disabled) {
        String ticket = getAdminTicket();
        String url = otdsConfig.getUrl() + "/users/{userId}";
        log.info("[OTDS] {} account for '{}'", disabled ? "Disabling" : "Enabling", userId);

        // accountDisabled = "true" → Account is disabled in OTDS admin UI
        List<Map<String, Object>> valuesList = List.of(
                Map.of("name", "accountDisabled", "values", List.of(disabled ? "true" : "false"))
        );
        Map<String, Object> body = Map.of("values", valuesList);

        try {
            restClient.put()
                    .uri(url, userId)
                    .header("OTDSTicket", ticket)
                    .contentType(MediaType.APPLICATION_JSON)
                    .accept(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .toBodilessEntity();
            log.info("[OTDS] Account {} for '{}'", disabled ? "disabled" : "enabled", userId);
        } catch (RestClientException e) {
            log.error("[OTDS] Account status change failed for '{}': {}", userId, e.getMessage());
            throw new RuntimeException("OTDS account status change failed for '" + userId + "': " + e.getMessage(), e);
        }
    }

    // ─── User Attribute Inspection (diagnostic) ───────────────────────────────

    /**
     * Fetches a single OTDS user by qualified ID (loginName@partitionName) with ALL attributes.
     * Pass the userId as a URI template variable so RestClient encodes the @ correctly.
     * Calls: GET /users/{userId}?attrs=*
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> inspectPartitionUserAttributes(String userId) {
        String ticket = getAdminTicket();
        log.info("[OTDS] Inspecting user '{}' full attributes", userId);
        try {
            Map<String, Object> response = restClient.get()
                    .uri(otdsConfig.getUrl() + "/users/{userId}?attrs=*", userId)
                    .header("OTDSTicket", ticket)
                    .accept(MediaType.APPLICATION_JSON)
                    .retrieve()
                    .body(Map.class);
            return response != null ? response : Collections.emptyMap();
        } catch (RestClientException e) {
            log.error("[OTDS] User inspect failed for '{}': {}", userId, e.getMessage());
            throw new RuntimeException("OTDS user inspect failed: " + e.getMessage(), e);
        }
    }

    // ─── Comprehensive Diagnostic ─────────────────────────────────────────────

    /**
     * Probes all known OTDS authentication endpoint variants to find the correct one.
     * Also discovers the correct password-update endpoint.
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> probeConnection() {
        String host = extractHost(otdsConfig.getUrl());
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("configuredUrl", otdsConfig.getUrl());
        result.put("host", host);
        result.put("configuredUser", otdsConfig.getUsername());

        Map<String, String> authBody = Map.of(
                "userName", otdsConfig.getUsername(),
                "password", otdsConfig.getPassword()
        );

        // ── Phase 0: auto-discover via Swagger/OpenAPI spec ──
        for (String specPath : SWAGGER_SPEC_CANDIDATES) {
            String specUrl = host + specPath;
            try {
                String specContent = restClient.get()
                        .uri(specUrl)
                        .accept(MediaType.APPLICATION_JSON)
                        .retrieve()
                        .body(String.class);
                if (specContent != null && !specContent.trim().startsWith("<")) {
                    // Found a JSON spec — extract authentication-related paths
                    result.put("swaggerSpecFound", specUrl);
                    // Pull out lines mentioning authentication to find the endpoint path
                    List<String> authLines = Arrays.stream(specContent.split("\n"))
                            .filter(l -> l.toLowerCase().contains("authentication") || l.toLowerCase().contains("credentials") || l.toLowerCase().contains("ticket"))
                            .limit(20)
                            .toList();
                    result.put("swaggerAuthHints", authLines);
                    break;
                }
            } catch (Exception ignored) { }
        }

        // ── Phase 1: find working auth endpoint ──
        List<Map<String, Object>> authProbes = new ArrayList<>();
        String workingTicket = null;
        String workingAuthUrl = null;

        for (String authPath : AUTH_CANDIDATES) {
            String url = host + authPath;
            Map<String, Object> probe = new LinkedHashMap<>();
            probe.put("url", url);
            try {
                Map<String, Object> resp = restClient.post()
                        .uri(url)
                        .contentType(MediaType.APPLICATION_JSON)
                        .accept(MediaType.APPLICATION_JSON)
                        .body(authBody)
                        .retrieve()
                        .body(Map.class);

                if (resp != null && resp.containsKey("ticket")) {
                    probe.put("status", "SUCCESS");
                    probe.put("note", "Ticket obtained — this is the correct auth endpoint");
                    workingTicket = (String) resp.get("ticket");
                    workingAuthUrl = url;
                } else {
                    probe.put("status", "2xx but no ticket");
                    probe.put("responseKeys", resp != null ? resp.keySet() : Collections.emptySet());
                }
            } catch (Exception e) {
                String msg = e.getMessage();
                probe.put("status", "FAILED");
                // Truncate HTML error bodies
                if (msg != null && msg.contains("<!doctype html")) {
                    probe.put("error", msg.substring(0, Math.min(msg.indexOf('\n') > 0 ? msg.indexOf('\n') : 120, 120)) + "…");
                } else {
                    probe.put("error", msg);
                }
            }
            authProbes.add(probe);
            if (workingAuthUrl != null) break;
        }
        result.put("authProbes", authProbes);

        if (workingAuthUrl == null) {
            result.put("conclusion", "NONE of the known auth endpoints worked. Check OTDS version or try fetching " + host + "/otdsws/ in a browser.");
            return result;
        }

        // ── Phase 2: find working password-update endpoint ──
        result.put("workingAuthUrl", workingAuthUrl);
        result.put("recommendation_auth", "Set otds.url to base of: " + workingAuthUrl);

        List<Map<String, Object>> pwProbes = new ArrayList<>();
        String testUser = "otadmin";
        for (String pwPattern : PASSWORD_CANDIDATES) {
            String url = String.format(host + pwPattern, testUser);
            Map<String, Object> probe = new LinkedHashMap<>();
            probe.put("url", url.replace(testUser, "{loginName}"));
            try {
                // Use a dummy password change to test — expect 2xx or 403 (not 404)
                restClient.put()
                        .uri(url)
                        .header("OTDSTicket", workingTicket)
                        .contentType(MediaType.APPLICATION_JSON)
                        .accept(MediaType.APPLICATION_JSON)
                        .body(Map.of("newPassword", "PROBE_DO_NOT_USE"))
                        .retrieve()
                        .toBodilessEntity();
                probe.put("status", "2xx — endpoint exists");
            } catch (Exception e) {
                String msg = e.getMessage();
                if (msg != null && msg.startsWith("403")) {
                    probe.put("status", "403 Forbidden — endpoint EXISTS (permission issue)");
                } else if (msg != null && (msg.startsWith("404") || msg.contains("not available"))) {
                    probe.put("status", "FAILED 404 — endpoint not found");
                } else {
                    probe.put("status", "FAILED: " + (msg != null ? msg.substring(0, Math.min(msg.length(), 100)) : "null"));
                }
            }
            pwProbes.add(probe);
        }
        result.put("passwordEndpointProbes", pwProbes);

        // Derive recommended otds.url (base without the path suffix)
        String authBase = workingAuthUrl
                .replace("/authentication/credentials", "")
                .replace("/authentication", "")
                .replace("/auth", "");
        result.put("conclusion", "Set otds.url=" + authBase + " in application-azure.properties and restart.");

        return result;
    }

    private String extractHost(String url) {
        try {
            java.net.URI uri = java.net.URI.create(url);
            return uri.getScheme() + "://" + uri.getHost() + (uri.getPort() != -1 ? ":" + uri.getPort() : "");
        } catch (Exception e) {
            int idx = url.indexOf("://");
            if (idx >= 0) { int s = url.indexOf('/', idx + 3); return s >= 0 ? url.substring(0, s) : url; }
            return url;
        }
    }
}

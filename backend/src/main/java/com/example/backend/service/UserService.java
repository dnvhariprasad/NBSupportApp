package com.example.backend.service;

import com.example.backend.config.DctmConfig;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.nio.charset.StandardCharsets;
import java.util.*;

@Service
@Slf4j
public class UserService {

    private final DctmConfig dctmConfig;
    private final OtdsService otdsService;
    private final RestClient restClient;

    public UserService(DctmConfig dctmConfig, OtdsService otdsService, RestClient.Builder restClientBuilder) {
        this.dctmConfig = dctmConfig;
        this.otdsService = otdsService;
        this.restClient = restClientBuilder.build();
    }

    private String getAuthHeader() {
        String username = dctmConfig.getUsername();
        String password = dctmConfig.getPassword();
        return "Basic " + Base64.getEncoder().encodeToString(
                (username + ":" + password).getBytes(StandardCharsets.UTF_8));
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> searchUserProfiles(String query, int page, int itemsPerPage) {
        StringBuilder dqlBuilder = new StringBuilder();
        dqlBuilder.append("SELECT r_object_id, object_name, uin, department_name, user_grade, designation, ");
        dqlBuilder.append("user_email_address, user_login_name, primary_mobile_number, location, office_type, ");
        dqlBuilder.append("is_active, hindi_user_name, hindi_designation, user_role ");
        dqlBuilder.append("FROM cms_user_profile WHERE object_name IS NOT NULL AND object_name != ' ' ");
        
        if (query != null && !query.trim().isEmpty()) {
            String q = query.trim();
            dqlBuilder.append("AND (object_name LIKE '%").append(q).append("%' ");
            dqlBuilder.append("OR uin LIKE '%").append(q).append("%' ");
            dqlBuilder.append("OR user_login_name LIKE '%").append(q).append("%' ");
            dqlBuilder.append("OR department_name LIKE '%").append(q).append("%' ");
            dqlBuilder.append("OR designation LIKE '%").append(q).append("%') ");
        }
        
        dqlBuilder.append("ORDER BY object_name");

        return executeDql(dqlBuilder.toString(), page, itemsPerPage);
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> createUser(Map<String, Object> request) {
        String url = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository() + "/users";

        List<String> allowedFields = List.of(
            "user_name", "user_login_name", "user_address", "user_privileges",
            "user_source", "user_state", "user_os_name", "user_db_name",
            "user_password", "user_global_unique_id", "default_folder",
            "home_docbase", "acl_name", "description"
        );

        Map<String, Object> props = new HashMap<>();
        for (String field : allowedFields) {
            if (request.containsKey(field) && request.get(field) != null) {
                Object val = request.get(field);
                if (val instanceof String s && s.isBlank()) continue;
                props.put(field, val);
            }
        }



        Map<String, Object> body = new HashMap<>();
        body.put("properties", props);

        try {
            Map<String, Object> response = restClient.post()
                    .uri(url)
                    .header("Authorization", getAuthHeader())
                    .header("Content-Type", "application/vnd.emc.documentum+json")
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .body(body)
                    .retrieve()
                    .body(Map.class);

            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("message", "User created successfully");
            if (response != null) {
                result.put("data", response);
            }

            // Automatically add the new user to dm_superusers_dynamic.
            // Documentum REST /users/{name} resolves by user_name (the object identifier),
            // not user_login_name — so pass user_name here.
            String userName = (String) props.get("user_name");
            if (userName != null && !userName.isBlank()) {
                addUserToGroup(userName, "dm_superusers_dynamic");
            }

            return result;
        } catch (RestClientResponseException e) {
            String body2 = e.getResponseBodyAsString(StandardCharsets.UTF_8);
            log.error("Error creating user [{}]: {}", e.getStatusCode(), body2);
            throw new RuntimeException("Failed to create user [" + e.getStatusCode() + "]: " + body2);
        } catch (Exception e) {
            log.error("Error creating user: {}", e.getMessage());
            throw new RuntimeException("Failed to create user: " + e.getMessage());
        }
    }

    /**
     * Adds a dm_user to a Documentum group via REST POST /groups/{groupName}/users
     * with body {"href": ".../users/{userName}"} — the format confirmed by probing the API.
     * userName must be the dm_user's user_name (object identifier), not user_login_name.
     * Logs a warning on failure but does not abort the parent operation.
     */
    private void addUserToGroup(String userName, String groupName) {
        log.info("[Group] Adding user '{}' to group '{}'", userName, groupName);
        String usersUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository()
                + "/groups/" + groupName + "/users";
        // Documentum REST URL lookup is case-sensitive — use user_name exactly as stored.
        String userHref = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository()
                + "/users/" + userName;
        Map<String, String> body = Map.of("href", userHref);
        try {
            restClient.post()
                    .uri(usersUrl)
                    .header("Authorization", getAuthHeader())
                    .header("Content-Type", "application/vnd.emc.documentum+json")
                    .header("Accept",        "application/vnd.emc.documentum+json")
                    .body(body)
                    .retrieve()
                    .toBodilessEntity();
            log.info("[Group] User '{}' successfully added to group '{}'", userName, groupName);
        } catch (RestClientResponseException e) {
            log.warn("[Group] Failed to add user '{}' to group '{}' [{}]: {}",
                    userName, groupName, e.getStatusCode(),
                    e.getResponseBodyAsString(StandardCharsets.UTF_8));
        } catch (Exception e) {
            log.warn("[Group] Failed to add user '{}' to group '{}': {}", userName, groupName, e.getMessage());
        }
    }

    /**
     * Sets the password for an inline-password dm_user via Documentum REST API.
     * Must be called after the user has been created, as the creation body does not apply the password.
     */
    /**
     * Updates the password of an inline-password dm_user via DQL —
     * the same mechanism used for user_state updates, confirmed working.
     */
    /**
     * Updates the password of an inline-password dm_user.
     * Tries multiple Documentum REST approaches in order and logs the result of each.
     */
    public Map<String, Object> updateInlineUserPassword(String loginName, String newPassword) {
        String userUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository() + "/users/" + loginName;
        Map<String, Object> body = Map.of("properties", Map.of("user_password", newPassword));

        // Attempt 1: POST /users/{loginName} + X-Method-Override: PATCH
        log.info("[InlinePwd] Attempt POST+PATCH on /users/{}", loginName);
        try {
            restClient.post()
                    .uri(userUrl)
                    .header("Authorization", getAuthHeader())
                    .header("Content-Type", "application/vnd.emc.documentum+json")
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .header("X-Method-Override", "PATCH")
                    .body(body)
                    .retrieve()
                    .toBodilessEntity();
            log.info("[InlinePwd] POST+PATCH succeeded for: {}", loginName);
            return Map.of("success", true, "message", "Password updated successfully for user: " + loginName);
        } catch (RestClientResponseException e1) {
            String r1 = e1.getResponseBodyAsString(StandardCharsets.UTF_8);
            log.warn("[InlinePwd] POST+PATCH failed [{}]: {}", e1.getStatusCode(), r1);

            // Attempt 2: POST /users/{loginName} + X-Method-Override: PUT
            log.info("[InlinePwd] Attempt POST+PUT on /users/{}", loginName);
            try {
                restClient.post()
                        .uri(userUrl)
                        .header("Authorization", getAuthHeader())
                        .header("Content-Type", "application/vnd.emc.documentum+json")
                        .header("Accept", "application/vnd.emc.documentum+json")
                        .header("X-Method-Override", "PUT")
                        .body(body)
                        .retrieve()
                        .toBodilessEntity();
                log.info("[InlinePwd] POST+PUT succeeded for: {}", loginName);
                return Map.of("success", true, "message", "Password updated successfully for user: " + loginName);
            } catch (RestClientResponseException e2) {
                String r2 = e2.getResponseBodyAsString(StandardCharsets.UTF_8);
                log.error("[InlinePwd] POST+PUT also failed [{}]: {}", e2.getStatusCode(), r2);
                throw new RuntimeException(
                        "Password update failed. POST+PATCH: [" + e1.getStatusCode() + "] " + r1
                        + " | POST+PUT: [" + e2.getStatusCode() + "] " + r2);
            }
        }
    }

    public Map<String, Object> updateUserPassword(String loginName, String newPassword) {
        // OTDS manages passwords for OTDS users — delegate to OtdsService
        otdsService.updateUserPassword(loginName, newPassword);
        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("message", "Password updated successfully for user: " + loginName);
        return result;
    }

    public Map<String, Object> searchDmUsers(String query, int page, int itemsPerPage) {
        StringBuilder dql = new StringBuilder();
        dql.append("SELECT user_name, user_login_name, user_address, user_source, ");
        dql.append("user_privileges, user_state, description ");
        dql.append("FROM dm_user WHERE user_login_name IS NOT NULL AND user_login_name != ' ' ");

        if (query != null && !query.trim().isEmpty()) {
            String q = query.trim();
            dql.append("AND (user_name LIKE '%").append(q).append("%' ");
            dql.append("OR user_login_name LIKE '%").append(q).append("%' ");
            dql.append("OR user_address LIKE '%").append(q).append("%') ");
        }
        dql.append("ORDER BY user_name");
        return executeDql(dql.toString(), page, itemsPerPage);
    }

    public Map<String, Object> updateDmUser(String loginName, Map<String, Object> properties) {
        String userUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository()
                + "/users/" + loginName;

        List<String> allowedFields = List.of(
            "user_name", "user_address", "user_privileges", "user_state",
            "description", "user_os_name", "user_db_name", "default_folder",
            "home_docbase", "acl_name"
        );

        Map<String, Object> props = new HashMap<>();
        for (String field : allowedFields) {
            if (properties.containsKey(field) && properties.get(field) != null) {
                props.put(field, properties.get(field));
            }
        }

        Map<String, Object> body = Map.of("properties", props);
        try {
            restClient.post()
                    .uri(userUrl)
                    .header("Authorization", getAuthHeader())
                    .header("Content-Type", "application/vnd.emc.documentum+json")
                    .header("Accept",        "application/vnd.emc.documentum+json")
                    .header("X-Method-Override", "PATCH")
                    .body(body)
                    .retrieve()
                    .toBodilessEntity();
            return Map.of("success", true, "message", "User updated successfully");
        } catch (RestClientResponseException e) {
            String respBody = e.getResponseBodyAsString(StandardCharsets.UTF_8);
            log.error("Error updating dm_user [{}]: {}", e.getStatusCode(), respBody);
            throw new RuntimeException("Failed to update user [" + e.getStatusCode() + "]: " + respBody);
        } catch (Exception e) {
            log.error("Error updating dm_user: {}", e.getMessage());
            throw new RuntimeException("Failed to update user: " + e.getMessage());
        }
    }

    public Map<String, Object> updateUserProfile(String objectId, Map<String, Object> properties) {
        String url = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository() + "/objects/" + objectId;

        // 1. If updating is_active, sync with dm_user
        if (properties.containsKey("is_active")) {
            Object activeVal = properties.get("is_active");
            boolean isActive = false;
            if (activeVal instanceof Boolean) {
                isActive = (Boolean) activeVal;
            } else if (activeVal != null) {
                isActive = Boolean.parseBoolean(activeVal.toString());
            }
            syncDmUserStatus(objectId, isActive);
        }

        // 2. Prepare properties for cms_user_profile update
        Map<String, Object> body = new HashMap<>();
        Map<String, Object> props = new HashMap<>();

        List<String> allowedProps = List.of(
            "object_name", "uin", "department_name", "department_short_code",
            "ro_short_code", "user_grade", "grade_level", "designation",
            "user_email_address", "primary_mobile_number", "location", "office_type",
            "is_active", "hindi_user_name", "hindi_designation", "user_role"
        );

        for (String key : properties.keySet()) {
            if (allowedProps.contains(key)) {
                props.put(key, properties.get(key));
            }
        }
        // department_short_code_multi is a repeating attribute — handle separately
        Object multiRaw = properties.get("department_short_code_multi");
        if (multiRaw instanceof List<?> multiList && !multiList.isEmpty()) {
            props.put("department_short_code_multi", multiList);
        } else {
            String deptCode = (String) properties.get("department_short_code");
            if (deptCode != null && !deptCode.isBlank())
                props.put("department_short_code_multi", List.of(deptCode));
        }
        body.put("properties", props);

        try {
            return restClient.post()
                    .uri(url)
                    .header("Authorization", getAuthHeader())
                    .header("Content-Type", "application/vnd.emc.documentum+json")
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .header("X-Method-Override", "PATCH")
                    .body(body)
                    .retrieve()
                    .body(Map.class);
        } catch (Exception e) {
            log.error("Error updating user profile " + objectId, e);
            throw new RuntimeException("Failed to update user profile: " + e.getMessage());
        }
    }

    /**
     * Creates a cms_user_profile object in /UserProfile/UsersProfileBO and links it there.
     */
    public Map<String, Object> createCmsUserProfile(Map<String, Object> request) {
        String repoUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository();

        // Step 1 — resolve folder r_object_id for /UserProfile/UsersProfileBO
        // r_folder_path is a repeating attribute — must use ANY keyword in DQL
        String folderDql = "SELECT r_object_id FROM dm_folder WHERE ANY r_folder_path = '/UserProfile/UsersProfileBO'";
        log.info("Resolving folder /UserProfile/UsersProfileBO");
        String folderId = resolveSingleObjectId(repoUrl, folderDql, "folder /UserProfile/UsersProfileBO");

        // Step 2 — build properties
        Map<String, Object> props = new LinkedHashMap<>();
        props.put("r_object_type", "cms_user_profile");
        putIfPresent(props, request, "object_name");
        putIfPresent(props, request, "user_login_name");
        putIfPresent(props, request, "user_email_address");
        putIfPresent(props, request, "designation");
        putIfPresent(props, request, "hindi_designation");
        putIfPresent(props, request, "hindi_user_name");
        putIfPresent(props, request, "uin");
        putIfPresent(props, request, "location");
        putIfPresent(props, request, "office_type");
        putIfPresent(props, request, "ro_short_code");
        putIfPresent(props, request, "user_grade");
        putIfPresent(props, request, "department_name");
        putIfPresent(props, request, "department_short_code");
        if (request.get("grade_level") != null) props.put("grade_level", request.get("grade_level"));
        if (request.containsKey("is_active"))   props.put("is_active", request.get("is_active"));
        // department_short_code_multi is a repeating attribute
        // Frontend sends it as a List<String>; fall back to single department_short_code if absent
        Object multiRaw = request.get("department_short_code_multi");
        if (multiRaw instanceof List<?> multiList && !multiList.isEmpty()) {
            props.put("department_short_code_multi", multiList);
        } else {
            String deptCode = (String) request.get("department_short_code");
            if (deptCode != null && !deptCode.isBlank())
                props.put("department_short_code_multi", List.of(deptCode));
        }

        // Step 3 — POST to /folders/{folderId}/objects.
        // /folders/{id}/documents is restricted to dm_document subtypes only.
        // /folders/{id}/objects accepts any SysObject subtype including cms_user_profile.
        String createUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository()
                + "/folders/" + folderId + "/objects";

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("properties", props);
        log.info("Creating cms_user_profile for '{}' in folder {} | hindi_user_name='{}' hindi_designation='{}'",
                request.get("user_login_name"), folderId,
                request.get("hindi_user_name"), request.get("hindi_designation"));
        try {
            Map<String, Object> response = restClient.post()
                    .uri(createUrl)
                    .header("Authorization", getAuthHeader())
                    .header("Content-Type", "application/vnd.emc.documentum+json;charset=UTF-8")
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .body(body)
                    .retrieve()
                    .body(Map.class);
            log.info("cms_user_profile created for: {}", request.get("user_login_name"));
            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("message", "User profile created successfully");
            if (response != null) result.put("data", response);
            return result;
        } catch (RestClientResponseException e) {
            String respBody = e.getResponseBodyAsString(StandardCharsets.UTF_8);
            log.error("Failed to create cms_user_profile [{}]: {}", e.getStatusCode(), respBody);
            throw new RuntimeException("Profile creation failed [" + e.getStatusCode() + "]: " + respBody);
        }
    }

    @SuppressWarnings("unchecked")
    private String resolveSingleObjectId(String repoUrl, String dql, String label) {
        try {
            Map<String, Object> resp = restClient.get()
                    .uri(repoUrl + "?dql={dql}&items-per-page=1&inline=true", dql)
                    .header("Authorization", getAuthHeader())
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .retrieve()
                    .body(Map.class);
            if (resp != null) {
                List<Map<String, Object>> entries = (List<Map<String, Object>>) resp.get("entries");
                if (entries != null && !entries.isEmpty()) {
                    Map<String, Object> content = (Map<String, Object>) entries.get(0).get("content");
                    if (content != null) {
                        Map<String, Object> p = (Map<String, Object>) content.get("properties");
                        if (p != null && p.get("r_object_id") != null)
                            return (String) p.get("r_object_id");
                    }
                }
            }
        } catch (RestClientResponseException e) {
            String rb = e.getResponseBodyAsString(StandardCharsets.UTF_8);
            throw new RuntimeException("Could not resolve " + label + " [" + e.getStatusCode() + "]: " + rb);
        }
        throw new RuntimeException("Could not find " + label + " — check the folder path exists in Documentum");
    }

    private void putIfPresent(Map<String, Object> target, Map<String, Object> source, String key) {
        Object val = source.get(key);
        if (val instanceof String s) { if (!s.isBlank()) target.put(key, s); }
        else if (val != null) target.put(key, val);
    }

    @SuppressWarnings("unchecked")
    private void syncDmUserStatus(String profileId, boolean isActive) {
        // Fetch profile to get user_login_name
        String dql = "SELECT user_login_name FROM cms_user_profile WHERE r_object_id = '" + profileId + "'";
        Map<String, Object> response = executeDql(dql, 1, 1);
        
        List<Map<String, Object>> users = (List<Map<String, Object>>) response.get("users");
        if (users != null && !users.isEmpty()) {
            String loginName = (String) users.get(0).get("user_login_name");
            if (loginName != null && !loginName.isBlank()) {
                int userState = isActive ? 0 : 1; // 0=Active, 1=Inactive
                // Update dm_user
                String updateDql = "UPDATE dm_user OBJECTS SET user_state = " + userState + " WHERE user_name = '" + loginName + "'";
                log.info("Syncing dm_user status for {}: user_state={}", loginName, userState);
                executeDqlUpdate(updateDql);
            }
        }
    }

    /**
     * Fetch cms_user_profile objects for a given HO department short code.
     * department_short_code_multi is a repeating attribute → use ANY keyword.
     */
    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> getUsersByDeptShortCode(String shortCode) {
        String safe = shortCode.replace("'", "''");
        String dql  = "SELECT object_name, user_login_name FROM cms_user_profile"
                    + " WHERE ANY department_short_code_multi = '" + safe + "'"
                    + " ORDER BY object_name";
        Map<String, Object> result = executeDql(dql, 1, 500);
        List<?> raw = (List<?>) result.get("users");
        if (raw == null) return Collections.emptyList();
        List<Map<String, Object>> list = new ArrayList<>();
        for (Object o : raw) { if (o instanceof Map<?,?> m) list.add((Map<String, Object>) m); }
        return list;
    }

    private void executeDqlUpdate(String dql) {
         String url = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository();
         try {
             // Sending DQL update via GET (standard simplified REST DQL execution)
             restClient.get()
                .uri(url + "?dql={dql}", dql)
                .header("Authorization", getAuthHeader())
                .retrieve()
                .toBodilessEntity();
         } catch (Exception e) {
             log.error("Error executing DQL update: " + dql, e);
             // We continue even if this fails, though ideally we should handle it
         }
    }

    private Map<String, Object> executeDql(String dql, int page, int itemsPerPage) {
        String url = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository();
        try {
            Map<String, Object> response = restClient.get()
                    .uri(url + "?dql={dql}&items-per-page={itemsPerPage}&page={page}&inline=true", 
                         dql, itemsPerPage, page)
                    .header("Authorization", getAuthHeader())
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .retrieve()
                    .body(Map.class);

            return transformResponse(response, page, itemsPerPage);
        } catch (Exception e) {
            log.error("Error executing DQL", e);
            throw new RuntimeException("DQL execution failed: " + e.getMessage());
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> transformResponse(Map<String, Object> response, int page, int itemsPerPage) {
        Map<String, Object> result = new HashMap<>();
        if (response == null) {
            result.put("users", new ArrayList<>());
            result.put("total", 0);
            return result;
        }

        List<Map<String, Object>> users = new ArrayList<>();
        List<Map<String, Object>> entries = (List<Map<String, Object>>) response.get("entries");
        
        if (entries != null) {
            for (Map<String, Object> entry : entries) {
                Map<String, Object> content = (Map<String, Object>) entry.get("content");
                if (content != null) {
                    Map<String, Object> props = (Map<String, Object>) content.get("properties");
                    if (props != null) {
                        users.add(props);
                    }
                }
            }
        }
        
        result.put("users", users);
        result.put("page", page);
        result.put("itemsPerPage", itemsPerPage);
        
        List<Map<String, Object>> links = (List<Map<String, Object>>) response.get("links");
        boolean hasNext = false;
        if (links != null) {
            hasNext = links.stream().anyMatch(link -> "next".equals(link.get("rel")));
        }
        result.put("hasNext", hasNext);

        return result;
    }
}

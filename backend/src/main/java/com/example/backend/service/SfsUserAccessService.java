package com.example.backend.service;

import com.example.backend.config.DctmConfig;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.stream.Collectors;
import java.net.URLDecoder;

@Service
@Slf4j
public class SfsUserAccessService {

    private final DctmConfig dctmConfig;
    private final RestClient restClient;
    private final UserService userService;

    public SfsUserAccessService(DctmConfig dctmConfig, RestClient.Builder restClientBuilder, UserService userService) {
        this.dctmConfig = dctmConfig;
        this.restClient = restClientBuilder.build();
        this.userService = userService;
    }

    private String getAuthHeader() {
        String username = dctmConfig.getUsername();
        String password = dctmConfig.getPassword();
        return "Basic " + Base64.getEncoder().encodeToString(
                (username + ":" + password).getBytes(StandardCharsets.UTF_8));
    }

    @SuppressWarnings("unchecked")
    public List<String> getLocations() {
        try {
            log.info("[SFS] Fetching distinct locations from user profiles");

            // Fetch all user profiles and extract unique locations (same as User Management)
            Map<String, Object> profilesResp = userService.searchUserProfiles(
                    null,           // query
                    1,              // page
                    5000,           // size - fetch all users to get all locations
                    null,           // officeTypeFilter: null to get all offices
                    null,           // locationFilter: null to get all locations
                    null            // deptNames: null to get all departments
            );

            Set<String> uniqueLocations = new LinkedHashSet<>();

            if (profilesResp != null && profilesResp.containsKey("users")) {
                List<Map<String, Object>> users = (List<Map<String, Object>>) profilesResp.get("users");
                if (users != null) {
                    for (Map<String, Object> user : users) {
                        Object locationObj = user.get("location");
                        if (locationObj != null) {
                            String location = locationObj.toString().trim();
                            if (!location.isEmpty() && !"-".equals(location)) {
                                uniqueLocations.add(location);
                            }
                        }
                    }
                }
            }

            List<String> locationsList = new ArrayList<>(uniqueLocations);
            Collections.sort(locationsList);

            log.info("[SFS] Found {} distinct locations", locationsList.size());
            return locationsList;
        } catch (Exception e) {
            log.error("[SFS] Failed to fetch locations: {}", e.getMessage(), e);
            // Fallback to empty list instead of hardcoded
            return new ArrayList<>();
        }
    }

    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> getUsersByRole(String officeType, String department, String location, String role) {
        String repoUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository();

        try {
            // If role is null, fetch all users by office type and department
            if (role == null || role.isEmpty()) {
                log.info("[SFS] Fetching all users for officeType={}, department={}, location={}", officeType, department, location);
                return fetchAllUsersByOfficeAndDept(repoUrl, officeType, department, location);
            }

            // If role is specified, fetch users for that role filtered by office type
            log.info("[SFS] Fetching users for role={}, officeType={}, department={}, location={}", role, officeType, department, location);
            return fetchUsersForRole(repoUrl, role, officeType, department, location);
        } catch (Exception e) {
            log.error("[SFS] Failed to fetch users: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to fetch users: " + e.getMessage(), e);
        }
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> fetchAllUsersByOfficeAndDept(String repoUrl, String officeType, String department, String location) {
        try {
            log.info("[SFS] Fetching all users for officeType={}, department={}", officeType, department);

            // Use UserService.searchUserProfiles to fetch users (same as User Access page does)
            // This returns user profiles with office_type and department information
            Map<String, Object> profilesResp = userService.searchUserProfiles(
                    null,           // query
                    1,              // page
                    5000,           // size - fetch all users
                    officeType,     // officeTypeFilter: HO, RO, TE
                    location,       // locationFilter: pass location for RO/TE filtering
                    department      // deptNames: HRMD (comma-separated for multiple)
            );

            log.info("[SFS] searchUserProfiles response keys: {}", profilesResp != null ? profilesResp.keySet() : "null");

            List<Map<String, Object>> result = new ArrayList<>();

            if (profilesResp != null) {
                // The response is a map that may contain user entries in different keys
                // Try to extract the list of users
                List<Map<String, Object>> entries = null;

                if (profilesResp.containsKey("entries")) {
                    entries = (List<Map<String, Object>>) profilesResp.get("entries");
                } else if (profilesResp.containsKey("data")) {
                    entries = (List<Map<String, Object>>) profilesResp.get("data");
                } else if (profilesResp.containsKey("users")) {
                    entries = (List<Map<String, Object>>) profilesResp.get("users");
                } else {
                    // searchUserProfiles returns a Map where user objects are inline with metadata
                    // Filter out metadata fields and collect actual user objects
                    entries = new ArrayList<>();
                    for (Map.Entry<String, Object> entry : profilesResp.entrySet()) {
                        Object val = entry.getValue();
                        // Check if value is a List of Maps (users)
                        if (val instanceof List) {
                            List<?> list = (List<?>) val;
                            if (!list.isEmpty() && list.get(0) instanceof Map) {
                                entries = (List<Map<String, Object>>) val;
                                log.info("[SFS] Found user list under key: {}", entry.getKey());
                                break;
                            }
                        }
                    }
                }

                if (entries != null && !entries.isEmpty()) {
                    log.info("[SFS] Retrieved {} user profiles from UserService", entries.size());

                    for (Map<String, Object> entry : entries) {
                        Map<String, Object> userObj = new HashMap<>();
                        // Map properties, trying multiple field names
                        Object userName = entry.get("user_name");
                        if (userName == null) userName = entry.get("object_name");

                        userObj.put("user_name", userName);
                        userObj.put("user_login_name", entry.get("user_login_name"));
                        userObj.put("r_object_id", entry.get("r_object_id"));
                        userObj.put("uin", entry.get("uin"));
                        result.add(userObj);
                    }
                } else {
                    log.warn("[SFS] No user entries found in response. Response keys: {}", profilesResp.keySet());
                }
            } else {
                log.warn("[SFS] searchUserProfiles returned null");
            }

            log.info("[SFS] Fetched {} users for officeType={}, department={}", result.size(), officeType, department);
            return result;
        } catch (Exception e) {
            log.error("[SFS] Failed to fetch all users: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to fetch all users: " + e.getMessage(), e);
        }
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> fetchUsersForRole(String repoUrl, String role, String officeType, String department, String location) {
        // Map role to group name
        String groupName = mapRoleToGroup(role, officeType, department);
        if (groupName == null) {
            throw new RuntimeException("Invalid role or parameters");
        }

        try {
            log.info("[SFS] Fetching users for role: {} (group: {}) officeType={} location={}", role, groupName, officeType, location);

            // Step 1: Fetch users from the group - extract login names
            String groupId = findGroupIdByName(repoUrl, groupName);
            if (groupId == null) {
                log.info("[SFS] Group not found: {}", groupName);
                return new ArrayList<>();
            }

            Set<String> groupUserLogins = new HashSet<>();
            String usersUrl = repoUrl + "/groups/" + groupId + "/users";
            Map<String, Object> usersResp = restClient.get()
                    .uri(usersUrl)
                    .header("Authorization", getAuthHeader())
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .retrieve()
                    .body(Map.class);

            if (usersResp != null && usersResp.containsKey("entries")) {
                List<Map<String, Object>> entries = (List<Map<String, Object>>) usersResp.get("entries");
                log.info("[SFS] Processing {} group entries", entries.size());
                for (Map<String, Object> entry : entries) {
                    log.debug("[SFS] Entry keys: {}, id={}, title={}, name={}",
                        entry.keySet(), entry.get("id"), entry.get("title"), entry.get("name"));

                    // Try to get the login/username from various fields
                    String login = null;

                    // First try: Extract from id URL - should be the actual login name
                    Object idObj = entry.get("id");
                    if (idObj != null) {
                        String idStr = idObj.toString().trim();
                        log.debug("[SFS] ID field: {}", idStr);
                        if (idStr.contains("/users/")) {
                            login = idStr.substring(idStr.lastIndexOf("/users/") + 7);
                            try {
                                login = URLDecoder.decode(login, "UTF-8");
                            } catch (Exception e) {
                                log.debug("[SFS] URLDecoder failed");
                            }
                            log.info("[SFS] Extracted login from id URL: '{}'", login);
                        }
                    }

                    if (login != null && !login.isEmpty()) {
                        groupUserLogins.add(login);
                        groupUserLogins.add(login.toLowerCase());
                        log.info("[SFS] Added to group members: '{}' and '{}'", login, login.toLowerCase());
                    }
                }
            }

            log.info("[SFS] Found {} members in group {}: {}", groupUserLogins.size(), groupName, groupUserLogins);

            if (groupUserLogins.isEmpty()) {
                log.info("[SFS] No users found in group: {}", groupName);
                return new ArrayList<>();
            }

            // Step 2: Fetch all users for the office type
            List<Map<String, Object>> officeTypeUsers = fetchAllUsersByOfficeAndDept(repoUrl, officeType, department, location);
            log.info("[SFS] Found {} users for office type: {}", officeTypeUsers.size(), officeType);

            // Step 3: Filter - keep only users whose name (display name) is in the group
            List<Map<String, Object>> result = new ArrayList<>();
            for (Map<String, Object> user : officeTypeUsers) {
                // Try matching with user_name (display name) first - this matches the group member names
                String userName = (String) user.get("user_name");
                boolean found = false;

                if (userName != null) {
                    // Replace spaces with + for matching against group names (which have +)
                    String nameWithPlus = userName.replaceAll("\\s+", "+");
                    found = groupUserLogins.contains(userName) ||
                            groupUserLogins.contains(nameWithPlus) ||
                            groupUserLogins.contains(userName.toLowerCase()) ||
                            groupUserLogins.contains(nameWithPlus.toLowerCase());
                }

                // Fallback: try user_login_name
                if (!found) {
                    String userLogin = (String) user.get("user_login_name");
                    found = userLogin != null && groupUserLogins.contains(userLogin);
                }

                if (found) {
                    result.add(user);
                    if (result.size() <= 3) {
                        log.info("[SFS] ✓ Matched user {} to group {}", userName, groupName);
                    }
                }
            }

            log.info("[SFS] Fetched {} users that are in role {} for office type {}", result.size(), role, officeType);
            return result;
        } catch (Exception e) {
            log.error("[SFS] Failed to fetch users for role {}: {}", role, e.getMessage(), e);
            throw new RuntimeException("Failed to fetch users for role: " + role + " - " + e.getMessage(), e);
        }
    }

    @SuppressWarnings("unchecked")
    private List<String> fetchUsersFromGroup(String repoUrl, String groupName) {
        List<String> userNames = new ArrayList<>();

        try {
            log.info("[SFS] Fetching users from group: {}", groupName);

            // Step 1: Find the group using helper method
            String groupId = findGroupIdByName(repoUrl, groupName);
            if (groupId == null) {
                log.warn("[SFS] Group not found: {}", groupName);
                return userNames;
            }

            log.info("[SFS] Using group ID: {} for group: {}", groupId, groupName);

            // Step 2: Fetch users from the group
            String usersUrl = repoUrl + "/groups/" + groupId + "/users";
            Map<String, Object> usersResp = restClient.get()
                    .uri(usersUrl)
                    .header("Authorization", getAuthHeader())
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .retrieve()
                    .body(Map.class);

            if (usersResp != null && usersResp.containsKey("entries")) {
                List<Map<String, Object>> entries = (List<Map<String, Object>>) usersResp.get("entries");
                log.info("[SFS] Group {} has {} user entries", groupName, entries.size());
                if (!entries.isEmpty()) {
                    log.info("[SFS] Entry structure - keys: {}, first entry: {}", entries.get(0).keySet(), entries.get(0));
                }

                for (Map<String, Object> entry : entries) {
                    // The REST API groups endpoint returns user entries in Atom format with:
                    // - "title": display name (e.g., "Dhinesh S R")
                    // - "id": URL with login name at the end (e.g., .../users/Dhinesh%2BS%2BR)
                    // We need to extract the login name from the id URL
                    String name = null;

                    // Debug: Log all entry keys
                    log.debug("[SFS] Entry keys: {}", entry.keySet());

                    // Primary: Extract login name from "id" URL
                    // Format: https://host/.../users/{loginName}
                    Object idObj = entry.get("id");
                    if (idObj != null) {
                        String idStr = idObj.toString().trim();
                        log.debug("[SFS] Found id field: {}", idStr);
                        try {
                            // Extract the last part of the URL (the login name)
                            if (idStr.contains("/users/")) {
                                String afterUsers = idStr.substring(idStr.lastIndexOf("/users/") + 7);
                                log.debug("[SFS] Before decode: {}", afterUsers);
                                // URL decode it (this handles %XX encoding)
                                name = URLDecoder.decode(afterUsers, "UTF-8");
                                log.debug("[SFS] Extracted login from id URL: {}", name);
                            }
                        } catch (Exception e) {
                            log.debug("[SFS] Failed to extract login from id URL {}: {}", idStr, e.getMessage());
                        }
                    } else {
                        log.debug("[SFS] No id field found");
                    }

                    // Fallback: Try "name" field
                    if (name == null || name.isEmpty()) {
                        Object nameObj = entry.get("name");
                        if (nameObj != null) {
                            name = nameObj.toString().trim();
                            // URL decode it in case it came encoded
                            try {
                                name = URLDecoder.decode(name, "UTF-8").replace("+", " ");
                            } catch (Exception e) {
                                // Keep original if decode fails
                            }
                            log.debug("[SFS] Used 'name' field: {}", name);
                        }
                    }

                    // Fallback: Try "title" field (display name)
                    if (name == null || name.isEmpty()) {
                        Object titleObj = entry.get("title");
                        if (titleObj != null) {
                            name = titleObj.toString().trim();
                            // URL decode it in case it came encoded
                            try {
                                name = URLDecoder.decode(name, "UTF-8").replace("+", " ");
                            } catch (Exception e) {
                                // Keep original if decode fails
                            }
                            log.debug("[SFS] Used 'title' field: {}", name);
                        }
                    }

                    // Fallback: Try "user_name" field
                    if (name == null || name.isEmpty()) {
                        Object userNameObj = entry.get("user_name");
                        if (userNameObj != null) {
                            name = userNameObj.toString().trim();
                            // URL decode it in case it came encoded
                            try {
                                name = URLDecoder.decode(name, "UTF-8").replace("+", " ");
                            } catch (Exception e) {
                                // Keep original if decode fails
                            }
                            log.debug("[SFS] Used 'user_name' field: {}", name);
                        }
                    }

                    if (name != null && !name.isEmpty() && !"-".equals(name)) {
                        userNames.add(name);
                        log.info("[SFS] Added user '{}' from group {} (contains + = {})", name, groupName, name.contains("+"));
                    } else {
                        log.debug("[SFS] Skipped entry from group {}, no valid name found. Keys: {}, entry: {}", groupName, entry.keySet(), entry);
                    }
                }
            } else {
                log.warn("[SFS] No entries found in group response for {}", groupName);
            }

            log.info("[SFS] Fetched {} user names from group {}", userNames.size(), groupName);
            return userNames;
        } catch (Exception e) {
            log.error("[SFS] Failed to fetch users from group {}: {}", groupName, e.getMessage(), e);
            return userNames;
        }
    }

    @SuppressWarnings("unchecked")
    public boolean isUserInGroup(String userName, String role, String officeType, String department) {
        String repoUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository();
        String groupName = mapRoleToGroup(role, officeType, department);

        if (groupName == null) {
            return false;
        }

        try {
            log.info("[SFS] Checking if user {} is in group {}", userName, groupName);

            String groupId = findGroupIdByName(repoUrl, groupName);
            if (groupId == null) {
                return false;
            }

            // Fetch users in the group
            String usersUrl = repoUrl + "/groups/" + groupId + "/users";
            Map<String, Object> usersResp = restClient.get()
                    .uri(usersUrl)
                    .header("Authorization", getAuthHeader())
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .retrieve()
                    .body(Map.class);

            if (usersResp != null && usersResp.containsKey("entries")) {
                List<Map<String, Object>> entries = (List<Map<String, Object>>) usersResp.get("entries");
                for (Map<String, Object> entry : entries) {
                    Object titleObj = entry.get("title");
                    if (titleObj != null && userName.equalsIgnoreCase(titleObj.toString())) {
                        log.info("[SFS] User {} is in group {}", userName, groupName);
                        return true;
                    }
                }
            }

            log.info("[SFS] User {} is NOT in group {}", userName, groupName);
            return false;
        } catch (Exception e) {
            log.error("[SFS] Failed to check user in group: {}", e.getMessage());
            return false;
        }
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> addUserToGroup(String userName, String role, String officeType, String department, String location) {
        String repoUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository();
        String groupName = mapRoleToGroup(role, officeType, department);

        if (groupName == null) {
            throw new RuntimeException("Invalid role or parameters");
        }

        try {
            // Step 1: Check if user is already in group
            boolean isAlreadyMember = isUserInGroup(userName, role, officeType, department);
            log.info("[SFS] User {} is {} in group {}", userName, isAlreadyMember ? "already" : "not", groupName);

            // Step 2: Find the group using REST API
            String groupId = findGroupIdByName(repoUrl, groupName);
            if (groupId == null) {
                log.error("[SFS] Group not found: {}", groupName);
                throw new RuntimeException("Group not found: " + groupName);
            }

            log.info("[SFS] Found group {} with ID: {}", groupName, groupId);

            String usersUrl = repoUrl + "/groups/" + groupId + "/users";
            String userHref = "/repositories/" + dctmConfig.getRepository() + "/users/" + userName;

            if (isAlreadyMember) {
                // REMOVE user from group via DELETE
                log.info("[SFS] Removing user {} from group {} (ID: {})", userName, groupName, groupId);

                try {
                    restClient.delete()
                            .uri(usersUrl + "/" + userName)
                            .header("Authorization", getAuthHeader())
                            .header("Accept", "application/vnd.emc.documentum+json")
                            .retrieve()
                            .toBodilessEntity();

                    Map<String, Object> result = new HashMap<>();
                    result.put("success", true);
                    result.put("message", "User " + userName + " removed from " + groupName + " successfully");
                    log.info("[SFS] Successfully removed user {} from group {}", userName, groupName);
                    return result;
                } catch (RestClientResponseException e) {
                    String rb = e.getResponseBodyAsString(StandardCharsets.UTF_8);
                    log.error("[SFS] Failed to remove user [{}]: {} - {}", e.getStatusCode(), rb, e.getMessage());
                    throw new RuntimeException("Failed to remove user [" + e.getStatusCode() + "]: " + rb);
                }
            } else {
                // ADD user to group via POST
                log.info("[SFS] Adding user {} to group {} (ID: {})", userName, groupName, groupId);

                Map<String, Object> addBody = new LinkedHashMap<>();
                addBody.put("href", userHref);

                Map<String, Object> addResp = restClient.post()
                        .uri(usersUrl)
                        .header("Authorization", getAuthHeader())
                        .header("Content-Type", "application/vnd.emc.documentum+json;charset=UTF-8")
                        .header("Accept", "application/vnd.emc.documentum+json")
                        .body(addBody)
                        .retrieve()
                        .body(Map.class);

                Map<String, Object> result = new HashMap<>();
                result.put("success", true);
                result.put("message", "User " + userName + " added to " + groupName + " successfully");
                if (addResp != null) result.put("data", addResp);
                log.info("[SFS] Successfully added user {} to group {}", userName, groupName);
                return result;
            }
        } catch (Exception e) {
            log.error("[SFS] Error toggling user in group: {}", e.getMessage(), e);
            throw new RuntimeException("Error toggling user: " + e.getMessage(), e);
        }
    }

    @SuppressWarnings("unchecked")
    private String findGroupIdByName(String repoUrl, String groupName) {
        try {
            log.info("[SFS] Finding group: {}", groupName);

            // Try Approach 1: Access group directly by name using /groups/{name}
            String directGroupUrl = repoUrl + "/groups/" + groupName;
            try {
                Map<String, Object> groupResp = restClient.get()
                        .uri(directGroupUrl)
                        .header("Authorization", getAuthHeader())
                        .header("Accept", "application/vnd.emc.documentum+json")
                        .retrieve()
                        .body(Map.class);

                if (groupResp != null) {
                    Object id = groupResp.get("id");
                    if (id != null) {
                        String groupId = id.toString();
                        log.info("[SFS] Found group {} directly via /groups/{} with ID: {}", groupName, groupName, groupId);
                        return groupId;
                    }
                    Object objId = groupResp.get("r_object_id");
                    if (objId != null) {
                        String groupId = objId.toString();
                        log.info("[SFS] Found group {} directly via /groups/{} with ID: {}", groupName, groupName, groupId);
                        return groupId;
                    }
                }
            } catch (Exception e1) {
                log.debug("[SFS] Direct group access via /groups/{} failed for {}: {}", groupName, groupName, e1.getMessage());
            }

            // Try Approach 2: Use group name directly (return the name as-is, may work with some APIs)
            log.info("[SFS] Attempting to use group name {} directly as group ID", groupName);
            return groupName;

        } catch (Exception e) {
            log.error("[SFS] Failed to find group {}: {}", groupName, e.getMessage(), e);
            return null;
        }
    }


    private String mapRoleToGroup(String role, String officeType, String department) {
        // Only support HRMD department for now
        if (!"HRMD".equals(department)) {
            return null;
        }

        switch (role) {
            case "Digitization":
                return "ecm_sfs_digitization";
            case "Request Document":
                return "ecm_sfs_request_document";
            case "View SFS Document":
                return "ecm_sfs_view";
            case "View Download":
                return "ecm_sfs_view_download";
            default:
                return null;
        }
    }
}

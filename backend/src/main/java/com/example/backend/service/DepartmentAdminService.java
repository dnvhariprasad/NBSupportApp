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
public class DepartmentAdminService {

    private final DctmConfig dctmConfig;
    private final RestClient restClient;

    public DepartmentAdminService(DctmConfig dctmConfig, RestClient.Builder restClientBuilder) {
        this.dctmConfig = dctmConfig;
        this.restClient = restClientBuilder.build();
    }

    private String getAuthHeader() {
        return "Basic " + Base64.getEncoder().encodeToString(
                (dctmConfig.getUsername() + ":" + dctmConfig.getPassword()).getBytes(StandardCharsets.UTF_8));
    }

    private String repoUrl() {
        return dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository();
    }

    // ─── Find Groups by Prefix ───────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> findGroupsByPrefix(String prefix) {
        String safePrefix = prefix.replace("'", "''");
        String dql = "SELECT group_name, description FROM dm_group"
                + " WHERE group_name LIKE '" + safePrefix + "%' ORDER BY group_name";

        List<Map<String, Object>> results = new ArrayList<>();
        int page = 1;

        try {
            while (true) {
                Map<String, Object> resp = restClient.get()
                        .uri(repoUrl() + "?dql={dql}&items-per-page=100&page={page}&inline=true", dql, page)
                        .header("Authorization", getAuthHeader())
                        .header("Accept", "application/vnd.emc.documentum+json")
                        .retrieve()
                        .body(Map.class);

                if (resp == null) break;
                List<Map<String, Object>> entries = (List<Map<String, Object>>) resp.get("entries");
                if (entries == null || entries.isEmpty()) break;

                for (Map<String, Object> entry : entries) {
                    Map<String, Object> content = (Map<String, Object>) entry.get("content");
                    if (content == null) continue;
                    Map<String, Object> props = (Map<String, Object>) content.get("properties");
                    if (props != null) results.add(props);
                }

                List<Map<String, Object>> links = (List<Map<String, Object>>) resp.get("links");
                boolean hasNext = links != null && links.stream().anyMatch(l -> "next".equals(l.get("rel")));
                if (!hasNext) break;
                page++;
            }
        } catch (Exception e) {
            log.error("[DeptAdmin] findGroupsByPrefix('{}') failed: {}", prefix, e.getMessage());
        }

        log.info("[DeptAdmin] Found {} groups with prefix '{}'", results.size(), prefix);
        return results;
    }

    // ─── Get Group Members ───────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    public Map<String, Object> getGroupMembers(String groupName) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("groupName", groupName);
        List<Map<String, Object>> users = new ArrayList<>();
        List<Map<String, Object>> groups = new ArrayList<>();

        try {
            String url = repoUrl() + "/groups/" + groupName;
            Map<String, Object> resp = restClient.get()
                    .uri(url)
                    .header("Authorization", getAuthHeader())
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .retrieve()
                    .body(Map.class);

            if (resp != null) {
                Map<String, Object> props = (Map<String, Object>) resp.get("properties");
                if (props != null) {
                    Object usersNames = props.get("users_names");
                    if (usersNames instanceof List) {
                        for (Object u : (List<?>) usersNames) {
                            String name = String.valueOf(u);
                            if (!name.isBlank()) users.add(Map.of("name", name, "type", "user"));
                        }
                    } else if (usersNames instanceof String && !((String) usersNames).isBlank()) {
                        users.add(Map.of("name", (String) usersNames, "type", "user"));
                    }

                    Object groupsNames = props.get("groups_names");
                    if (groupsNames instanceof List) {
                        for (Object g : (List<?>) groupsNames) {
                            String name = String.valueOf(g);
                            if (!name.isBlank()) groups.add(Map.of("name", name, "type", "group"));
                        }
                    } else if (groupsNames instanceof String && !((String) groupsNames).isBlank()) {
                        groups.add(Map.of("name", (String) groupsNames, "type", "group"));
                    }
                }
            }
        } catch (Exception e) {
            log.error("[DeptAdmin] getGroupMembers('{}') failed: {}", groupName, e.getMessage());
            result.put("error", e.getMessage());
        }

        result.put("users", users);
        result.put("groups", groups);
        result.put("totalCount", users.size() + groups.size());
        return result;
    }

    // ─── Create Group ────────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    public Map<String, Object> createGroup(String groupName) {
        log.info("[DeptAdmin] Creating group '{}'", groupName);
        try {
            Map<String, Object> props = new LinkedHashMap<>();
            props.put("group_name", groupName);

            Map<String, Object> body = new LinkedHashMap<>();
            body.put("properties", props);

            restClient.post()
                    .uri(repoUrl() + "/groups")
                    .header("Authorization", getAuthHeader())
                    .header("Content-Type", "application/vnd.emc.documentum+json")
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .body(body)
                    .retrieve()
                    .body(Map.class);

            return Map.of("success", true, "message", "Group '" + groupName + "' created");
        } catch (RestClientResponseException e) {
            String rb = e.getResponseBodyAsString(StandardCharsets.UTF_8);
            log.error("[DeptAdmin] createGroup('{}') failed [{}]: {}", groupName, e.getStatusCode(), rb);
            return Map.of("success", false, "message", "Failed to create '" + groupName + "': " + rb);
        }
    }

    // ─── Move Member (add to target, remove from source) ─────────────────────

    public Map<String, Object> moveMember(String sourceGroup, String targetGroup, String memberName, String memberType) {
        log.info("[DeptAdmin] Moving {} '{}' from '{}' to '{}'", memberType, memberName, sourceGroup, targetGroup);
        Map<String, Object> result = new LinkedHashMap<>();

        // Step 1: Add to target
        try {
            String subPath = "user".equals(memberType) ? "users" : "groups";
            String addUrl = repoUrl() + "/groups/" + targetGroup + "/" + subPath;

            Map<String, Object> body = new LinkedHashMap<>();
            body.put("href", repoUrl() + "/" + subPath + "/" + memberName);

            restClient.post()
                    .uri(addUrl)
                    .header("Authorization", getAuthHeader())
                    .header("Content-Type", "application/vnd.emc.documentum+json")
                    .body(body)
                    .retrieve()
                    .toBodilessEntity();
        } catch (RestClientResponseException e) {
            String rb = e.getResponseBodyAsString(StandardCharsets.UTF_8);
            // 409 Conflict = already a member, that's OK
            if (e.getStatusCode().value() != 409) {
                log.error("[DeptAdmin] addMember failed: {}", rb);
                return Map.of("success", false, "message", "Failed to add to target: " + rb);
            }
        }

        // Step 2: Remove from source
        try {
            String subPath = "user".equals(memberType) ? "users" : "groups";
            String removeUrl = repoUrl() + "/groups/" + sourceGroup + "/" + subPath + "/" + memberName;

            restClient.delete()
                    .uri(removeUrl)
                    .header("Authorization", getAuthHeader())
                    .retrieve()
                    .toBodilessEntity();
        } catch (RestClientResponseException e) {
            String rb = e.getResponseBodyAsString(StandardCharsets.UTF_8);
            log.error("[DeptAdmin] removeMember failed: {}", rb);
            return Map.of("success", false, "message", "Added to target but failed to remove from source: " + rb);
        }

        result.put("success", true);
        result.put("message", memberType + " '" + memberName + "' moved from '" + sourceGroup + "' to '" + targetGroup + "'");
        return result;
    }

    // ─── Find Users in Department ────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> findUsersInDepartment(String deptShortCode) {
        String safe = deptShortCode.replace("'", "''");
        String dql = "SELECT r_object_id, object_name, user_login_name, department_name, office_type"
                + " FROM cms_user_profile"
                + " WHERE ANY department_short_code_multi = '" + safe + "'"
                + " ORDER BY object_name";

        List<Map<String, Object>> results = new ArrayList<>();
        int page = 1;

        try {
            while (true) {
                Map<String, Object> resp = restClient.get()
                        .uri(repoUrl() + "?dql={dql}&items-per-page=100&page={page}&inline=true", dql, page)
                        .header("Authorization", getAuthHeader())
                        .header("Accept", "application/vnd.emc.documentum+json")
                        .retrieve()
                        .body(Map.class);

                if (resp == null) break;
                List<Map<String, Object>> entries = (List<Map<String, Object>>) resp.get("entries");
                if (entries == null || entries.isEmpty()) break;

                for (Map<String, Object> entry : entries) {
                    Map<String, Object> content = (Map<String, Object>) entry.get("content");
                    if (content == null) continue;
                    Map<String, Object> props = (Map<String, Object>) content.get("properties");
                    if (props != null) results.add(props);
                }

                List<Map<String, Object>> links = (List<Map<String, Object>>) resp.get("links");
                boolean hasNext = links != null && links.stream().anyMatch(l -> "next".equals(l.get("rel")));
                if (!hasNext) break;
                page++;
            }
        } catch (Exception e) {
            log.error("[DeptAdmin] findUsersInDepartment('{}') failed: {}", deptShortCode, e.getMessage());
        }

        log.info("[DeptAdmin] Found {} users in dept '{}'", results.size(), deptShortCode);
        return results;
    }

    // ─── Update User Profile ─────────────────────────────────────────────────

    public Map<String, Object> updateUserDepartment(String objectId, String newDeptName, String oldShortCode, String newShortCode) {
        log.info("[DeptAdmin] Updating user '{}' dept: {} → {}", objectId, oldShortCode, newShortCode);
        try {
            Map<String, Object> props = new LinkedHashMap<>();
            props.put("department_name", newDeptName);

            Map<String, Object> body = new LinkedHashMap<>();
            body.put("properties", props);

            restClient.post()
                    .uri(repoUrl() + "/objects/" + objectId)
                    .header("Authorization", getAuthHeader())
                    .header("Content-Type", "application/vnd.emc.documentum+json")
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .header("X-HTTP-Method-Override", "PATCH")
                    .body(body)
                    .retrieve()
                    .toBodilessEntity();

            return Map.of("success", true, "message", "User profile updated");
        } catch (RestClientResponseException e) {
            String rb = e.getResponseBodyAsString(StandardCharsets.UTF_8);
            log.error("[DeptAdmin] updateUserDepartment failed [{}]: {}", e.getStatusCode(), rb);
            return Map.of("success", false, "message", "Update failed: " + rb);
        }
    }

    // ─── Get Department Folder ───────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    public Map<String, Object> getDepartmentFolder(String folderPath) {
        String safePath = folderPath.replace("'", "''");
        String dql = "SELECT r_object_id, object_name FROM dm_folder WHERE ANY r_folder_path = '" + safePath + "'";

        try {
            Map<String, Object> resp = restClient.get()
                    .uri(repoUrl() + "?dql={dql}&items-per-page=1&inline=true", dql)
                    .header("Authorization", getAuthHeader())
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .retrieve()
                    .body(Map.class);

            if (resp != null) {
                List<Map<String, Object>> entries = (List<Map<String, Object>>) resp.get("entries");
                if (entries != null && !entries.isEmpty()) {
                    Map<String, Object> content = (Map<String, Object>) entries.get(0).get("content");
                    if (content != null) {
                        return (Map<String, Object>) content.get("properties");
                    }
                }
            }
        } catch (Exception e) {
            log.error("[DeptAdmin] getDepartmentFolder('{}') failed: {}", folderPath, e.getMessage());
        }
        return null;
    }

    // ─── Rename Folder ───────────────────────────────────────────────────────

    public Map<String, Object> renameFolder(String folderId, String newName) {
        log.info("[DeptAdmin] Renaming folder '{}' to '{}'", folderId, newName);
        try {
            Map<String, Object> props = new LinkedHashMap<>();
            props.put("object_name", newName);

            Map<String, Object> body = new LinkedHashMap<>();
            body.put("properties", props);

            restClient.post()
                    .uri(repoUrl() + "/objects/" + folderId)
                    .header("Authorization", getAuthHeader())
                    .header("Content-Type", "application/vnd.emc.documentum+json")
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .header("X-HTTP-Method-Override", "PATCH")
                    .body(body)
                    .retrieve()
                    .toBodilessEntity();

            return Map.of("success", true, "message", "Folder renamed to '" + newName + "'");
        } catch (RestClientResponseException e) {
            String rb = e.getResponseBodyAsString(StandardCharsets.UTF_8);
            log.error("[DeptAdmin] renameFolder failed [{}]: {}", e.getStatusCode(), rb);
            return Map.of("success", false, "message", "Rename failed: " + rb);
        }
    }

    // ─── Check if Group Exists ───────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    public boolean groupExists(String groupName) {
        try {
            restClient.get()
                    .uri(repoUrl() + "/groups/" + groupName)
                    .header("Authorization", getAuthHeader())
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .retrieve()
                    .body(Map.class);
            return true;
        } catch (RestClientResponseException e) {
            return false;
        }
    }
}

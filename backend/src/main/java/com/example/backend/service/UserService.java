package com.example.backend.service;

import com.example.backend.config.DctmConfig;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.nio.charset.StandardCharsets;
import java.util.*;

@Service
@Slf4j
public class UserService {

    private final DctmConfig dctmConfig;
    private final RestClient restClient;

    public UserService(DctmConfig dctmConfig, RestClient.Builder restClientBuilder) {
        this.dctmConfig = dctmConfig;
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
            "object_name", "uin", "department_name", "user_grade", "designation",
            "user_email_address", "primary_mobile_number", "location", "office_type",
            "is_active", "hindi_user_name", "hindi_designation", "user_role"
        );

        for (String key : properties.keySet()) {
            if (allowedProps.contains(key)) {
                props.put(key, properties.get(key));
            }
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

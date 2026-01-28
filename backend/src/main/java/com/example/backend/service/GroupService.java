package com.example.backend.service;

import com.example.backend.config.DctmConfig;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.nio.charset.StandardCharsets;
import java.util.*;

@Service
@Slf4j
public class GroupService {

    private final DctmConfig dctmConfig;
    private final RestClient restClient;

    public GroupService(DctmConfig dctmConfig, RestClient.Builder restClientBuilder) {
        this.dctmConfig = dctmConfig;
        this.restClient = restClientBuilder.build();
    }

    private String getAuthHeader() {
        String username = dctmConfig.getUsername();
        String password = dctmConfig.getPassword();
        return "Basic " + Base64.getEncoder().encodeToString(
                (username + ":" + password).getBytes(StandardCharsets.UTF_8));
    }

    /**
     * Search groups (dm_group) by group name using DQL.
     * Returns paginated list of groups with their details.
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> searchGroups(String groupName, int page, int itemsPerPage) {

        // Build DQL query
        StringBuilder dqlQuery = new StringBuilder("SELECT r_object_id, group_name, description, owner_name, users_names, groups_names, r_creation_date, r_modify_date FROM dm_group");

        // Add filter condition if group name is provided
        if (groupName != null && !groupName.isBlank()) {
            dqlQuery.append(" WHERE group_name LIKE '").append(groupName.trim()).append("%'");
        }

        dqlQuery.append(" ORDER BY group_name");

        String baseUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository() + "/dql";

        StringBuilder urlBuilder = new StringBuilder(baseUrl);
        urlBuilder.append("?dql=").append(java.net.URLEncoder.encode(dqlQuery.toString(), StandardCharsets.UTF_8));
        urlBuilder.append("&items-per-page=").append(itemsPerPage);
        urlBuilder.append("&page=").append(page);
        urlBuilder.append("&inline=true");

        String fullUrl = urlBuilder.toString();
        log.info("Searching groups with DQL: {}", dqlQuery.toString());

        try {
            Map<String, Object> response = restClient.get()
                    .uri(fullUrl)
                    .header("Authorization", getAuthHeader())
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .retrieve()
                    .body(Map.class);

            return transformResponse(response, page);

        } catch (Exception e) {
            log.error("Error searching groups with DQL", e);
            throw new RuntimeException("Failed to search groups: " + e.getMessage());
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> transformResponse(Map<String, Object> response, int page) {
        Map<String, Object> result = new HashMap<>();

        if (response == null) {
            result.put("groups", new ArrayList<>());
            result.put("hasNext", false);
            result.put("page", page);
            return result;
        }

        result.put("page", response.get("page"));
        result.put("itemsPerPage", response.get("items-per-page"));

        // Check for next link
        List<Map<String, Object>> links = (List<Map<String, Object>>) response.get("links");
        boolean hasNext = false;
        if (links != null) {
            hasNext = links.stream().anyMatch(link -> "next".equals(link.get("rel")));
        }
        result.put("hasNext", hasNext);

        // Transform entries
        List<Map<String, Object>> groups = new ArrayList<>();
        List<Map<String, Object>> entries = (List<Map<String, Object>>) response.get("entries");

        if (entries != null) {
            for (Map<String, Object> entry : entries) {
                Map<String, Object> content = (Map<String, Object>) entry.get("content");
                if (content != null) {
                    Map<String, Object> props = (Map<String, Object>) content.get("properties");
                    if (props != null) {
                        Map<String, Object> groupItem = new HashMap<>();
                        groupItem.put("r_object_id", props.get("r_object_id"));
                        groupItem.put("group_name", props.get("group_name"));
                        groupItem.put("description", props.get("description"));
                        groupItem.put("owner_name", props.get("owner_name"));
                        groupItem.put("users_names", props.get("users_names"));
                        groupItem.put("groups_names", props.get("groups_names"));
                        groupItem.put("r_creation_date", props.get("r_creation_date"));
                        groupItem.put("r_modify_date", props.get("r_modify_date"));

                        groups.add(groupItem);
                    }
                }
            }
        }
        result.put("groups", groups);

        return result;
    }
}

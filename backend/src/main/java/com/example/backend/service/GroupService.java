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
     * Search groups using DCTM REST API /groups endpoint.
     * Returns paginated list of groups with their details.
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> searchGroups(String groupName, int page, int itemsPerPage) {

        String baseUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository() + "/groups";

        // Build URL with proper query parameters
        StringBuilder urlBuilder = new StringBuilder(baseUrl);
        urlBuilder.append("?items-per-page=").append(itemsPerPage);
        urlBuilder.append("&page=").append(page);
        urlBuilder.append("&inline=true");

        // If group name filter is provided, add it as a filter parameter
        if (groupName != null && !groupName.isBlank()) {
            // Use proper filter syntax for DCTM REST API
            String filterValue = "group_name like '" + groupName.trim() + "%'";
            urlBuilder.append("&filter=").append(java.net.URLEncoder.encode(filterValue, StandardCharsets.UTF_8));
        }

        String fullUrl = urlBuilder.toString();
        log.info("Fetching groups from URL: {}", fullUrl);

        try {
            Map<String, Object> response = restClient.get()
                    .uri(fullUrl)
                    .header("Authorization", getAuthHeader())
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .retrieve()
                    .body(Map.class);

            log.info("Groups API response received with {} entries",
                response != null && response.containsKey("entries") ?
                ((List<?>) response.get("entries")).size() : 0);

            return transformResponse(response, page);

        } catch (Exception e) {
            log.error("Error fetching groups from REST API: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to fetch groups: " + e.getMessage());
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
                    List<Map<String, Object>> entryLinks = (List<Map<String, Object>>) content.get("links");

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

                        // Include available actions from links
                        if (entryLinks != null) {
                            Map<String, String> actions = new HashMap<>();
                            for (Map<String, Object> link : entryLinks) {
                                String rel = (String) link.get("rel");
                                String href = (String) link.get("href");
                                if (rel != null && href != null) {
                                    actions.put(rel, href);
                                }
                            }
                            groupItem.put("actions", actions);
                        }

                        groups.add(groupItem);
                    }
                }
            }
        }
        result.put("groups", groups);

        return result;
    }

    /**
     * Get detailed information about a specific group including all available actions/links
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> getGroupDetails(String groupName) {
        String url = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository()
                + "/groups/" + groupName;

        log.info("Fetching group details for: {}", groupName);

        try {
            Map<String, Object> response = restClient.get()
                    .uri(url)
                    .header("Authorization", getAuthHeader())
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .retrieve()
                    .body(Map.class);

            Map<String, Object> result = new HashMap<>();

            if (response != null) {
                Map<String, Object> props = (Map<String, Object>) response.get("properties");
                List<Map<String, Object>> links = (List<Map<String, Object>>) response.get("links");

                if (props != null) {
                    result.put("properties", props);
                }

                // Extract available actions from links
                if (links != null) {
                    Map<String, Map<String, String>> actions = new HashMap<>();
                    for (Map<String, Object> link : links) {
                        String rel = (String) link.get("rel");
                        String href = (String) link.get("href");
                        String method = (String) link.get("method"); // HTTP method (GET, POST, PUT, DELETE)

                        if (rel != null && href != null) {
                            Map<String, String> actionDetails = new HashMap<>();
                            actionDetails.put("href", href);
                            actionDetails.put("method", method != null ? method : "GET");
                            actions.put(rel, actionDetails);
                        }
                    }
                    result.put("availableActions", actions);

                    // Log available actions for debugging
                    log.info("Available actions for group '{}': {}", groupName, actions.keySet());
                }
            }

            return result;

        } catch (Exception e) {
            log.error("Error fetching group details for '{}': {}", groupName, e.getMessage(), e);
            throw new RuntimeException("Failed to fetch group details: " + e.getMessage());
        }
    }
}

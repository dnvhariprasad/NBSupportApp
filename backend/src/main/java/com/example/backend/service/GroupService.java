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

    /**
     * Get all members of a group
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> getGroupMembers(String groupName) {
        String url = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository()
                + "/groups/" + groupName;

        log.info("Fetching members for group: {}", groupName);

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
                if (props != null) {
                    Object usersNames = props.get("users_names");
                    Object groupsNames = props.get("groups_names");

                    List<Map<String, String>> users = new ArrayList<>();
                    List<Map<String, String>> groups = new ArrayList<>();

                    // Process user members
                    if (usersNames instanceof List) {
                        for (Object name : (List<?>) usersNames) {
                            if (name != null && !name.toString().trim().isEmpty()) {
                                Map<String, String> user = new HashMap<>();
                                user.put("name", name.toString());
                                user.put("type", "user");
                                users.add(user);
                            }
                        }
                    } else if (usersNames != null && !usersNames.toString().trim().isEmpty()) {
                        Map<String, String> user = new HashMap<>();
                        user.put("name", usersNames.toString());
                        user.put("type", "user");
                        users.add(user);
                    }

                    // Process group members
                    if (groupsNames instanceof List) {
                        for (Object name : (List<?>) groupsNames) {
                            if (name != null && !name.toString().trim().isEmpty()) {
                                Map<String, String> group = new HashMap<>();
                                group.put("name", name.toString());
                                group.put("type", "group");
                                groups.add(group);
                            }
                        }
                    } else if (groupsNames != null && !groupsNames.toString().trim().isEmpty()) {
                        Map<String, String> group = new HashMap<>();
                        group.put("name", groupsNames.toString());
                        group.put("type", "group");
                        groups.add(group);
                    }

                    result.put("users", users);
                    result.put("groups", groups);
                    result.put("totalCount", users.size() + groups.size());
                }
            }

            return result;

        } catch (Exception e) {
            log.error("Error fetching members for group '{}': {}", groupName, e.getMessage(), e);
            throw new RuntimeException("Failed to fetch group members: " + e.getMessage());
        }
    }

    /**
     * Add a member to a group using DCTM REST API
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> addMember(String groupName, String memberName, String memberType, String memberSrc) {
        log.info("Adding {} '{}' to group '{}'", memberType, memberName, groupName);

        try {
            // Step 1: Fetch the full user/group object first
            String fetchUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository();
            if ("user".equalsIgnoreCase(memberType)) {
                fetchUrl += "/users/" + memberName;
            } else {
                fetchUrl += "/groups/" + memberName;
            }

            log.info("Fetching member object from: {}", fetchUrl);

            Map<String, Object> memberObject = restClient.get()
                    .uri(fetchUrl)
                    .header("Authorization", getAuthHeader())
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .retrieve()
                    .body(Map.class);

            if (memberObject == null) {
                throw new RuntimeException("Member not found: " + memberName);
            }

            log.info("Fetched member object: {}", memberObject);

            // Step 2: Build the endpoint URL for adding to group
            String addUrl;
            if ("user".equalsIgnoreCase(memberType)) {
                addUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository()
                        + "/groups/" + groupName + "/users";
            } else {
                addUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository()
                        + "/groups/" + groupName + "/groups";
            }

            log.info("Adding member to group via: {}", addUrl);

            // Step 3: Post the member object to the group
            // Use the full object structure from the GET response
            Map<String, Object> response = restClient.post()
                    .uri(addUrl)
                    .header("Authorization", getAuthHeader())
                    .header("Content-Type", "application/vnd.emc.documentum+json")
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .body(memberObject)
                    .retrieve()
                    .body(Map.class);

            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("message", memberType + " '" + memberName + "' added successfully");

            return result;

        } catch (Exception e) {
            log.error("Error adding member '{}' to group '{}': {}", memberName, groupName, e.getMessage(), e);
            Map<String, Object> result = new HashMap<>();
            result.put("success", false);
            result.put("message", "Failed to add member: " + e.getMessage());
            return result;
        }
    }

    /**
     * Remove a member from a group using DCTM REST API
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> removeMember(String groupName, String memberName, String memberType) {
        log.info("Removing {} '{}' from group '{}'", memberType, memberName, groupName);

        try {
            // Build the correct endpoint URL based on member type
            String url;
            if ("user".equalsIgnoreCase(memberType)) {
                // DELETE /repositories/{repo}/groups/{groupName}/users/{userName}
                url = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository()
                        + "/groups/" + groupName + "/users/" + memberName;
            } else {
                // DELETE /repositories/{repo}/groups/{groupName}/groups/{memberName}
                url = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository()
                        + "/groups/" + groupName + "/groups/" + memberName;
            }

            // Remove the member using the dedicated REST endpoint
            restClient.delete()
                    .uri(url)
                    .header("Authorization", getAuthHeader())
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .retrieve()
                    .toBodilessEntity();

            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("message", memberType + " '" + memberName + "' removed successfully");

            return result;

        } catch (Exception e) {
            log.error("Error removing member '{}' from group '{}': {}", memberName, groupName, e.getMessage(), e);
            Map<String, Object> result = new HashMap<>();
            result.put("success", false);
            result.put("message", "Failed to remove member: " + e.getMessage());
            return result;
        }
    }

    /**
     * Search for users or groups to add as members using DQL
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> searchMembers(String query, String type) {
        String objectType = "user".equalsIgnoreCase(type) ? "dm_user" : "dm_group";
        String nameField = "user".equalsIgnoreCase(type) ? "user_name" : "group_name";

        // Build DQL query with LIKE clause for partial matching
        // Escape single quotes in query but use %% for SQL wildcard
        String escapedQuery = query.replace("'", "''");

        String dqlQuery;
        if ("user".equalsIgnoreCase(type)) {
            dqlQuery = "SELECT user_name, user_login_name, user_os_name FROM dm_user WHERE user_name LIKE '"
                + escapedQuery + "%' ORDER BY user_name";
        } else {
            dqlQuery = "SELECT group_name, description FROM dm_group WHERE group_name LIKE '"
                + escapedQuery + "%' ORDER BY group_name";
        }

        String baseUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository();

        // Build URL using RestClient URI template to avoid encoding issues
        // The RestClient will handle proper encoding
        String url = baseUrl + "?dql={dql}&items-per-page=20&page=1&inline=true";

        log.info("Searching for {} with DQL: {}", type, dqlQuery);

        try {
            Map<String, Object> response = restClient.get()
                    .uri(url, dqlQuery)  // Use URI template with variable
                    .header("Authorization", getAuthHeader())
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .retrieve()
                    .body(Map.class);

            List<Map<String, String>> results = new ArrayList<>();
            List<Map<String, Object>> entries = (List<Map<String, Object>>) response.get("entries");

            if (entries != null) {
                for (Map<String, Object> entry : entries) {
                    Map<String, Object> content = (Map<String, Object>) entry.get("content");
                    if (content != null) {
                        Map<String, Object> props = (Map<String, Object>) content.get("properties");
                        if (props != null) {
                            Map<String, String> item = new HashMap<>();
                            item.put("name", (String) props.get(nameField));
                            item.put("type", type);

                            // Capture the src link for adding members later
                            String src = (String) content.get("src");
                            if (src != null) {
                                item.put("src", src);
                            }

                            if ("user".equalsIgnoreCase(type)) {
                                String loginName = (String) props.get("user_login_name");
                                String osName = (String) props.get("user_os_name");
                                // Use login name or OS name as full name
                                item.put("fullName", loginName != null ? loginName : osName);
                            } else {
                                item.put("fullName", (String) props.get("description"));
                            }
                            results.add(item);
                        }
                    }
                }
            }

            Map<String, Object> result = new HashMap<>();
            result.put("results", results);
            result.put("count", results.size());

            log.info("Found {} {}s matching '{}'", results.size(), type, query);
            return result;

        } catch (Exception e) {
            log.error("Error searching for {} with query '{}': {}", type, query, e.getMessage(), e);
            Map<String, Object> result = new HashMap<>();
            result.put("results", new ArrayList<>());
            result.put("count", 0);
            return result;
        }
    }
}

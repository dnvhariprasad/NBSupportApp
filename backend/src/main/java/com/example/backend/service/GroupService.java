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
     * Add a member to a group
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> addMember(String groupName, String memberName, String memberType) {
        String url = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository()
                + "/groups/" + groupName;

        log.info("Adding {} '{}' to group '{}'", memberType, memberName, groupName);

        try {
            // First, get current group properties
            Map<String, Object> currentGroup = restClient.get()
                    .uri(url)
                    .header("Authorization", getAuthHeader())
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .retrieve()
                    .body(Map.class);

            if (currentGroup == null) {
                throw new RuntimeException("Group not found");
            }

            Map<String, Object> props = (Map<String, Object>) currentGroup.get("properties");
            List<String> currentUsers = new ArrayList<>();
            List<String> currentGroups = new ArrayList<>();

            // Get current members
            if ("user".equalsIgnoreCase(memberType)) {
                Object usersNames = props.get("users_names");
                if (usersNames instanceof List) {
                    currentUsers.addAll((List<String>) usersNames);
                } else if (usersNames != null) {
                    currentUsers.add(usersNames.toString());
                }
                // Add new user
                if (!currentUsers.contains(memberName)) {
                    currentUsers.add(memberName);
                }
            } else {
                Object groupsNames = props.get("groups_names");
                if (groupsNames instanceof List) {
                    currentGroups.addAll((List<String>) groupsNames);
                } else if (groupsNames != null) {
                    currentGroups.add(groupsNames.toString());
                }
                // Add new group
                if (!currentGroups.contains(memberName)) {
                    currentGroups.add(memberName);
                }
            }

            // Prepare update payload
            Map<String, Object> updatePayload = new HashMap<>();
            if ("user".equalsIgnoreCase(memberType)) {
                updatePayload.put("users_names", currentUsers);
            } else {
                updatePayload.put("groups_names", currentGroups);
            }

            // Update the group
            Map<String, Object> response = restClient.post()
                    .uri(url)
                    .header("Authorization", getAuthHeader())
                    .header("Content-Type", "application/vnd.emc.documentum+json")
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .body(updatePayload)
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
     * Remove a member from a group
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> removeMember(String groupName, String memberName, String memberType) {
        String url = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository()
                + "/groups/" + groupName;

        log.info("Removing {} '{}' from group '{}'", memberType, memberName, groupName);

        try {
            // First, get current group properties
            Map<String, Object> currentGroup = restClient.get()
                    .uri(url)
                    .header("Authorization", getAuthHeader())
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .retrieve()
                    .body(Map.class);

            if (currentGroup == null) {
                throw new RuntimeException("Group not found");
            }

            Map<String, Object> props = (Map<String, Object>) currentGroup.get("properties");
            List<String> updatedMembers = new ArrayList<>();

            // Get current members and remove the specified one
            if ("user".equalsIgnoreCase(memberType)) {
                Object usersNames = props.get("users_names");
                if (usersNames instanceof List) {
                    for (Object name : (List<?>) usersNames) {
                        if (name != null && !name.toString().equals(memberName)) {
                            updatedMembers.add(name.toString());
                        }
                    }
                }
            } else {
                Object groupsNames = props.get("groups_names");
                if (groupsNames instanceof List) {
                    for (Object name : (List<?>) groupsNames) {
                        if (name != null && !name.toString().equals(memberName)) {
                            updatedMembers.add(name.toString());
                        }
                    }
                }
            }

            // Prepare update payload
            Map<String, Object> updatePayload = new HashMap<>();
            if ("user".equalsIgnoreCase(memberType)) {
                updatePayload.put("users_names", updatedMembers);
            } else {
                updatePayload.put("groups_names", updatedMembers);
            }

            // Update the group
            restClient.post()
                    .uri(url)
                    .header("Authorization", getAuthHeader())
                    .header("Content-Type", "application/vnd.emc.documentum+json")
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .body(updatePayload)
                    .retrieve()
                    .body(Map.class);

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
     * Search for users or groups to add as members
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> searchMembers(String query, String type) {
        String objectType = "user".equalsIgnoreCase(type) ? "dm_user" : "dm_group";
        String nameField = "user".equalsIgnoreCase(type) ? "user_name" : "group_name";

        String baseUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository() + "/search";

        StringBuilder urlBuilder = new StringBuilder(baseUrl);
        urlBuilder.append("?object-type=").append(objectType);
        urlBuilder.append("&items-per-page=20");
        urlBuilder.append("&page=1");
        urlBuilder.append("&inline=true");
        urlBuilder.append("&q=").append(java.net.URLEncoder.encode(query, StandardCharsets.UTF_8));

        String fullUrl = urlBuilder.toString();
        log.info("Searching for {} with query: {}", type, query);

        try {
            Map<String, Object> response = restClient.get()
                    .uri(fullUrl)
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
                            if ("user".equalsIgnoreCase(type)) {
                                item.put("fullName", (String) props.get("user_login_name"));
                            }
                            results.add(item);
                        }
                    }
                }
            }

            Map<String, Object> result = new HashMap<>();
            result.put("results", results);
            result.put("count", results.size());

            return result;

        } catch (Exception e) {
            log.error("Error searching for {}: {}", type, e.getMessage(), e);
            Map<String, Object> result = new HashMap<>();
            result.put("results", new ArrayList<>());
            result.put("count", 0);
            return result;
        }
    }
}

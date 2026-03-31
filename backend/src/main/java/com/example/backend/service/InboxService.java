package com.example.backend.service;

import com.example.backend.config.DctmConfig;
import com.example.backend.config.TasklistConfig;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Case Inbox query — three-step DQL approach:
 *
 *   Step 1: SELECT router_id FROM dmi_queue_item WHERE name = '<username>'
 *
 *   Step 2: SELECT distinct r_component_id FROM dmi_package
 *           WHERE r_workflow_id IN (<router_ids>) AND r_package_type = 'cms_case_folder'
 *
 *   Step 3: SELECT object_name, description, status, r_creator_name, task_priority, r_object_id
 *           FROM cms_case_folder WHERE r_object_id IN (<component_ids>)
 */
@Service
@Slf4j
public class InboxService {

    private final TasklistConfig tasklistConfig;
    private final DctmConfig dctmConfig;
    private final RestClient restClient;

    public InboxService(TasklistConfig tasklistConfig,
                        DctmConfig dctmConfig,
                        RestClient.Builder restClientBuilder) {
        this.tasklistConfig = tasklistConfig;
        this.dctmConfig = dctmConfig;
        this.restClient = restClientBuilder.build();
    }

    private String getAuthHeader() {
        String credentials = dctmConfig.getUsername() + ":" + dctmConfig.getPassword();
        return "Basic " + Base64.getEncoder()
                .encodeToString(credentials.getBytes(StandardCharsets.UTF_8));
    }

    private String repoUrl() {
        return dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository();
    }

    private java.net.URI buildUri(String dql, int itemsPerPage, int page) {
        return org.springframework.web.util.UriComponentsBuilder
                .fromUriString(repoUrl())
                .queryParam("dql", dql)
                .queryParam("items-per-page", itemsPerPage)
                .queryParam("page", page)
                .queryParam("inline", true)
                .build()
                .encode()   // encodes = as %3D and space as %20 inside each param value
                .toUri();
    }

    // ─── Main entry point ─────────────────────────────────────────────────────

    public Map<String, Object> getInboxTasks(String username, int page, int itemsPerPage) {
        String safeUser = username.replace("'", "''");

        // Step 1: get router_ids for user
        List<String> routerIds = fetchRouterIds(safeUser);
        log.info("Step-1: found {} router_ids for user '{}'", routerIds.size(), username);
        if (routerIds.isEmpty()) {
            return Map.of("tasks", List.of(), "total", 0, "success", true);
        }

        // Step 2: get component_ids from dmi_package
        List<String> componentIds = fetchComponentIds(routerIds);
        log.info("Step-2: found {} component_ids", componentIds.size());
        if (componentIds.isEmpty()) {
            return Map.of("tasks", List.of(), "total", 0, "success", true);
        }

        // Step 3: get case data from cms_case_folder
        return fetchCaseFolders(componentIds, page, itemsPerPage);
    }

    // ─── Step 1: router_ids for the user (most-recent-assignee check) ────────
    //
    // SELECT qi.router_id
    // FROM dmi_queue_item qi
    // WHERE qi.router_id IN (
    //     SELECT distinct router_id FROM dmi_queue_item WHERE name = '<user>'
    // )
    // AND qi.date_sent = (
    //     SELECT MAX(qi2.date_sent) FROM dmi_queue_item qi2
    //     WHERE qi2.router_id = qi.router_id
    // )
    // AND qi.name = '<user>'
    //
    // Logic: for each router_id the user ever had, check that they are still
    // the MOST RECENT assignee (max date_sent). This naturally excludes cases
    // that were delegated away to someone else.
    //
    @SuppressWarnings("unchecked")
    private List<String> fetchRouterIds(String safeUser) {
        String dql =
            "SELECT qi.router_id " +
            "FROM dmi_queue_item qi " +
            "WHERE qi.router_id IN (" +
            "  SELECT distinct router_id FROM dmi_queue_item WHERE name = '" + safeUser + "'" +
            ") " +
            "AND qi.date_sent = (" +
            "  SELECT MAX(qi2.date_sent) FROM dmi_queue_item qi2 " +
            "  WHERE qi2.router_id = qi.router_id" +
            ") " +
            "AND qi.name = '" + safeUser + "'";
        log.debug("Step-1 DQL: {}", dql);
        try {
            Map<String, Object> response = restClient.get()
                    .uri(buildUri(dql, 500, 1))
                    .header("Authorization", getAuthHeader())
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .retrieve()
                    .body(Map.class);

            List<String> ids = new ArrayList<>();
            if (response == null) return ids;
            Object entriesObj = response.get("entries");
            if (!(entriesObj instanceof List<?> entries)) return ids;
            for (Object entry : entries) {
                Map<?, ?> props = extractProps(entry);
                if (props == null) continue;
                String routerId = (String) props.get("router_id");
                if (routerId != null && !routerId.isBlank()
                        && !routerId.equals("0000000000000000")
                        && !ids.contains(routerId)) {
                    ids.add(routerId);
                }
            }
            log.info("Step-1: found {} router_ids for user '{}'", ids.size(), safeUser);
            return ids;
        } catch (Exception e) {
            log.error("Step-1 failed for user '{}': {}", safeUser, e.getMessage());
            return List.of();
        }
    }

    // ─── Step 2: r_component_ids from dmi_package ────────────────────────────
    //
    // SELECT distinct r_component_id FROM dmi_package
    // WHERE r_workflow_id IN (<router_ids>) AND r_package_type = 'cms_case_folder'
    //
    @SuppressWarnings("unchecked")
    private List<String> fetchComponentIds(List<String> routerIds) {
        String inClause = routerIds.stream()
                .map(id -> "'" + id.replace("'", "''") + "'")
                .collect(Collectors.joining(","));

        String dql =
            "SELECT distinct r_component_id FROM dmi_package " +
            "WHERE r_workflow_id IN (" + inClause + ") " +
            "AND r_package_type = 'cms_case_folder'";
        log.debug("Step-2 DQL: {}", dql);
        try {
            Map<String, Object> response = restClient.get()
                    .uri(buildUri(dql, 500, 1))
                    .header("Authorization", getAuthHeader())
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .retrieve()
                    .body(Map.class);

            List<String> ids = new ArrayList<>();
            if (response == null) return ids;
            Object entriesObj = response.get("entries");
            if (!(entriesObj instanceof List<?> entries)) return ids;
            for (Object entry : entries) {
                Map<?, ?> props = extractProps(entry);
                if (props == null) continue;
                Object compId = props.get("r_component_id");
                // r_component_id is a repeating attribute — may return as String or List
                if (compId instanceof String s && !s.isBlank()) {
                    if (!ids.contains(s)) ids.add(s);
                } else if (compId instanceof List<?> list) {
                    for (Object v : list) {
                        if (v instanceof String s && !s.isBlank() && !ids.contains(s)) {
                            ids.add(s);
                        }
                    }
                }
            }
            return ids;
        } catch (Exception e) {
            log.error("Step-2 failed: {}", e.getMessage());
            return List.of();
        }
    }

    // ─── Step 3: case data from cms_case_folder ───────────────────────────────
    //
    // SELECT object_name, description, status, r_creator_name as initiator,
    //        task_priority as priority, r_object_id as objectId
    // FROM cms_case_folder WHERE r_object_id IN (<component_ids>)
    //
    @SuppressWarnings("unchecked")
    private Map<String, Object> fetchCaseFolders(List<String> componentIds, int page, int itemsPerPage) {
        String inClause = componentIds.stream()
                .map(id -> "'" + id.replace("'", "''") + "'")
                .collect(Collectors.joining(","));

        String dql =
            "SELECT object_name, description, status, r_creator_name, task_priority, r_object_id " +
            "FROM cms_case_folder " +
            "WHERE r_object_id IN (" + inClause + ")";
        log.debug("Step-3 DQL: {}", dql);
        try {
            Map<String, Object> response = restClient.get()
                    .uri(buildUri(dql, itemsPerPage, page))
                    .header("Authorization", getAuthHeader())
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .retrieve()
                    .body(Map.class);

            List<Map<String, Object>> tasks = new ArrayList<>();
            int total = componentIds.size();

            if (response != null) {
                Object totalObj = response.get("total");
                if (totalObj instanceof Number n) total = n.intValue();

                Object entriesObj = response.get("entries");
                if (entriesObj instanceof List<?> entries) {
                    for (Object entry : entries) {
                        Map<?, ?> props = extractProps(entry);
                        if (props == null) continue;
                        Map<String, Object> task = new HashMap<>();
                        task.put("objectId",    props.get("r_object_id"));
                        task.put("caseName",    props.get("object_name"));
                        task.put("description", props.get("description"));
                        task.put("status",      props.get("status"));
                        task.put("initiator",   props.get("r_creator_name"));
                        task.put("priority",    props.get("task_priority"));
                        tasks.add(task);
                    }
                }
            }

            Map<String, Object> result = new HashMap<>();
            result.put("tasks", tasks);
            result.put("total", total);
            result.put("success", true);
            return result;
        } catch (Exception e) {
            log.error("Step-3 failed: {}", e.getMessage());
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("message", e.getMessage());
            error.put("tasks", List.of());
            error.put("total", 0);
            return error;
        }
    }

    // ─── Debug: raw dmi_queue_item response ──────────────────────────────────

    @SuppressWarnings("unchecked")
    public Map<String, Object> getRawResponse(String username) {
        String safeUser = username.replace("'", "''");
        String dql =
            "SELECT r_object_id, name, router_id, task_name, sender_name, date_sent, item_state " +
            "FROM dmi_queue_item " +
            "WHERE UPPER(name) = UPPER('" + safeUser + "') " +
            "ORDER BY date_sent DESC";

        log.info("Raw dmi_queue_item DQL for '{}': {}", username, dql);
        try {
            Map<String, Object> response = restClient.get()
                    .uri(buildUri(dql, 10, 1))
                    .header("Authorization", getAuthHeader())
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .retrieve()
                    .body(Map.class);
            if (response == null) return Map.of("error", "null response", "_dql", dql);
            response.put("_dql", dql);
            return response;
        } catch (Exception e) {
            return Map.of("error", e.getMessage(), "_dql", dql);
        }
    }

    // ─── Debug: discover actual name format in dmi_queue_item ────────────────

    @SuppressWarnings("unchecked")
    public Map<String, Object> debugQueueItemName(String username) {
        // Search using the first word of the name so we can see what's actually stored
        String firstWord = username.split("\\s+")[0].replace("'", "''");
        String dql = "SELECT r_object_id, name, router_id FROM dmi_queue_item " +
                     "WHERE name LIKE '" + firstWord + "%' ENABLE(RETURN_TOP 20)";
        log.info("Debug name DQL: {}", dql);
        try {
            Map<String, Object> response = restClient.get()
                    .uri(buildUri(dql, 20, 1))
                    .header("Authorization", getAuthHeader())
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .retrieve()
                    .body(Map.class);
            if (response == null) return Map.of("error", "null response", "_dql", dql);
            response.put("_dql", dql);
            return response;
        } catch (Exception e) {
            return Map.of("error", e.getMessage(), "_dql", dql);
        }
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private Map<?, ?> extractProps(Object entry) {
        if (!(entry instanceof Map<?, ?> entryMap)) return null;
        Object content = entryMap.get("content");
        if (!(content instanceof Map<?, ?> contentMap)) return null;
        Object props = contentMap.get("properties");
        return props instanceof Map<?, ?> ? (Map<?, ?>) props : null;
    }
}

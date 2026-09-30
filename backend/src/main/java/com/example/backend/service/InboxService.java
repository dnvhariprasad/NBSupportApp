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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
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
    private final GroupService groupService;

    public InboxService(TasklistConfig tasklistConfig,
                        DctmConfig dctmConfig,
                        RestClient.Builder restClientBuilder,
                        GroupService groupService) {
        this.tasklistConfig = tasklistConfig;
        this.dctmConfig = dctmConfig;
        this.restClient = restClientBuilder.build();
        this.groupService = groupService;
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
            "WHERE r_object_id IN (" + inClause + ") " +
            "AND (is_migrated IS NULL OR is_migrated = FALSE)";
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

    // ─── CMS Tasklist all-user-inbox proxy ───────────────────────────────────
    //
    // Proxies: GET <cms-inbox-url>/cms_all_user_inbox
    //          ?inline=true&input_performer_name=<username>&page=<page>&start=<start>
    //
    @SuppressWarnings("unchecked")
    public Map<String, Object> getTasklistInbox(String username, int page, int start) {
        try {
            String encoded = java.net.URLEncoder.encode(username, StandardCharsets.UTF_8);
            String url = tasklistConfig.getCmsInboxUrl()
                    + "/cms_all_user_inbox"
                    + "?inline=true&input_performer_name=" + encoded
                    + "&page=" + page + "&start=" + start;
            log.info("CMS tasklist inbox URL: {}", url);
            Map<String, Object> response = restClient.get()
                    .uri(java.net.URI.create(url))
                    .header("Authorization", getAuthHeader())
                    .header("Accept", "application/json")
                    .retrieve()
                    .body(Map.class);
            if (response == null) return Map.of("success", false, "entries", List.of(), "total", 0);
            response.put("success", true);
            return response;
        } catch (Exception e) {
            log.error("CMS tasklist inbox failed for '{}': {}", username, e.getMessage());
            return Map.of("success", false, "message", e.getMessage(), "entries", List.of(), "total", 0);
        }
    }

    // ─── To be Verified inbox (union over user + their groups) ───────────────

    private static final String TO_BE_VERIFIED_PREFIX = "to be verified";

    /**
     * "To be Verified" tasks for a user.
     *
     * <p>The {@code cms_all_user_inbox} tasklist query filters the task performer with
     * {@code EQUAL}, so a single call only returns tasks queued to the person. Verification
     * tasks are queued to <em>groups</em> ({@code ecm_chairman} and the per-case
     * {@code ecm_chairman_&lt;caseId&gt;} groups), which that call can never see. So we run the
     * query once per performer — the user plus every group they belong to — and merge the
     * results, de-duplicating on the task id.
     *
     * <p>Rows are then narrowed to task names beginning "To be Verified", which covers
     * "To be Verified Chairman" as well as the DMDS1/2/3 variants.
     */
    public Map<String, Object> getToBeVerifiedTasklist(String username) {
        List<String> performers = new ArrayList<>();
        performers.add(username);
        try {
            for (Map<String, String> group : groupService.getGroupsByUser(username)) {
                String name = group.get("group_name");
                if (name != null && !name.isBlank() && !performers.contains(name)) {
                    performers.add(name);
                }
            }
        } catch (Exception e) {
            log.warn("Could not resolve groups for '{}', falling back to the user alone: {}",
                     username, e.getMessage());
        }

        Map<String, Object> merged = new LinkedHashMap<>();
        ExecutorService pool = Executors.newFixedThreadPool(Math.min(10, performers.size()));
        try {
            List<Callable<List<?>>> jobs = new ArrayList<>();
            for (String performer : performers) {
                jobs.add(() -> fetchTasklistEntries(performer));
            }
            for (Future<List<?>> future : pool.invokeAll(jobs, 120, TimeUnit.SECONDS)) {
                List<?> entries;
                try {
                    entries = future.get();
                } catch (Exception e) {
                    continue;
                }
                for (Object entry : entries) {
                    Map<?, ?> props = extractProps(entry);
                    if (props == null) continue;
                    String taskName = str(props.get("packagesworkflow_paramtask_name"));
                    if (!taskName.trim().toLowerCase().startsWith(TO_BE_VERIFIED_PREFIX)) continue;
                    String key = str(props.get("id"));
                    if (key.isBlank()) key = String.valueOf(System.identityHashCode(entry));
                    merged.putIfAbsent(key, entry);
                }
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.warn("To-be-Verified fetch interrupted for '{}'", username);
        } finally {
            pool.shutdown();
        }

        List<Object> entries = new ArrayList<>(merged.values());
        log.info("To be Verified for '{}': {} task(s) across {} performer(s)",
                 username, entries.size(), performers.size());
        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("entries", entries);
        result.put("total", entries.size());
        result.put("performers", performers.size());
        return result;
    }

    /** One {@code cms_all_user_inbox} call for a single performer (user or group). */
    @SuppressWarnings("unchecked")
    private List<?> fetchTasklistEntries(String performer) {
        try {
            String url = tasklistConfig.getCmsInboxUrl()
                    + "/cms_all_user_inbox"
                    + "?inline=true&items-per-page=500&input_performer_name="
                    + java.net.URLEncoder.encode(performer, StandardCharsets.UTF_8);
            Map<String, Object> response = restClient.get()
                    .uri(java.net.URI.create(url))
                    .header("Authorization", getAuthHeader())
                    .header("Accept", "application/json")
                    .retrieve()
                    .body(Map.class);
            if (response == null) return List.of();
            Object entries = response.get("entries");
            return entries instanceof List<?> list ? list : List.of();
        } catch (Exception e) {
            log.debug("Tasklist call failed for performer '{}': {}", performer, e.getMessage());
            return List.of();
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

    private String str(Object value) {
        return value == null ? "" : String.valueOf(value);
    }
}

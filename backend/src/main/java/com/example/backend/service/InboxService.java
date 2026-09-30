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

    // --- Case Inbox, by task name --------------------------------------------

    /**
     * A user's inbox tasks carrying one task name, matching what the CMS shows.
     *
     * <p>Both CMS inbox tabs are this one query with a different name: the first passes
     * {@code input_task_name = 'FYA'} and the second "To be Verified &lt;DEPT&gt;"
     * (Inbox.jsx). It runs {@code cms_inbox}, whose {@code input_task_name} is an
     * {@code IN} over the {@code cms_workflow_param} package joined to the task. We
     * cannot reuse it: it is scoped to the caller's own worklist and the Admin Portal
     * runs as a service account, and this repository's REST tier exposes no login-ticket
     * endpoint to impersonate with.
     *
     * <p>{@code cms_all_user_inbox} is not a substitute either. It has no task-name input,
     * matches the performer with {@code EQUAL} so group-queued tasks are invisible, and
     * when a workflow has accumulated several {@code cms_workflow_param} packages it
     * returns at most one row for the task and sometimes none at all.
     *
     * <p>So the set is resolved against the repository instead, with the same join the
     * task-list query makes: queue item to work item to the packages of that work item's
     * activity, one of which is the {@code cms_workflow_param} carrying the task name and
     * another the {@code cms_case_folder} to display. Pinning the params to the work
     * item's own activity is what makes the name mean "the task in hand" rather than
     * "somewhere in this case's history" - a case that has been through an FYA hop keeps
     * that param for good, so an any-activity join counts it twice.
     *
     * <p>Reproduces the CMS figures exactly:
     * Shaji K V 25 FYA / 18 To be Verified Chairman,
     * Ajay K Sood 15 FYA / 5 To be Verified DMDS2.
     */
    public Map<String, Object> getInboxByTaskName(String username, String taskName) {
        List<String> performers = new ArrayList<>();
        performers.add(username);
        performers.addAll(fetchGroupsOfUser(username));

        Map<String, Object> entries = new LinkedHashMap<>();   // queue item id -> entry
        for (List<String> batch : batches(performers, PERFORMER_BATCH)) {
            for (Map<String, String> row : select(inboxDql(batch, taskName), resultFields())) {
                String queueId = row.get("queue_id");
                if (queueId == null || queueId.isBlank() || entries.containsKey(queueId)) continue;

                Map<String, Object> props = new LinkedHashMap<>();
                props.put("packagescase_folderid", row.getOrDefault("case_id", ""));
                for (String field : CASE_FIELDS) {
                    props.put("packagescase_folder" + field, row.getOrDefault("case_" + field, ""));
                }
                props.put("packagescase_folderr_object_type", "cms_case_folder");
                props.put("packagesworkflow_paramtask_name", taskName);
                props.put("task_performer_name", row.getOrDefault("performer", ""));
                props.put("id", queueId);
                entries.put(queueId, Map.of("id", queueId, "content", Map.of("properties", props)));
            }
        }

        log.info("Inbox '{}' for '{}': {} task(s) across {} performer(s)",
                 taskName, username, entries.size(), performers.size());

        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("entries", new ArrayList<>(entries.values()));
        result.put("total", entries.size());
        result.put("performers", performers.size());
        return result;
    }

    /**
     * Queue items for these performers whose activity carries {@code taskName}.
     *
     * <p>{@code pk} is the workflow-param package that holds the task name and {@code pc}
     * the case-folder package shown in the grid; both are pinned to the work item's own
     * activity, so a task is never classified by a param left behind at an earlier hop.
     *
     * <p>{@code ENABLE(ROW_BASED)} is required, not an optimisation: joining on
     * {@code dmi_package.r_component_id} is otherwise rejected with
     * {@code DM_QUERY_E_REPEATING_USED} because it is a repeating attribute. Row-based
     * evaluation also means one row per repeating value, so callers de-duplicate on the
     * queue item id.
     */
    private String inboxDql(List<String> performers, String taskName) {
        StringBuilder columns = new StringBuilder(
            "qi.r_object_id AS queue_id, qi.name AS performer, cf.r_object_id AS case_id");
        for (String field : CASE_FIELDS) {
            columns.append(", cf.").append(field).append(" AS case_").append(field);
        }
        return "SELECT " + columns + " "
             + "FROM dmi_queue_item qi, dmi_workitem wi, dmi_package pk, cms_workflow_param wp, "
             + "dmi_package pc, cms_case_folder cf "
             + "WHERE qi.item_id = wi.r_object_id "
             + "AND wi.r_workflow_id = pk.r_workflow_id AND wi.r_act_seqno = pk.r_act_seqno "
             + "AND pk.r_component_id = wp.r_object_id "
             + "AND wp.task_name = '" + taskName.replace("'", "''") + "' "
             + "AND wi.r_workflow_id = pc.r_workflow_id AND wi.r_act_seqno = pc.r_act_seqno "
             + "AND pc.r_component_id = cf.r_object_id "
             + "AND qi.delete_flag = 0 "
             + "AND qi.name IN (" + inClause(performers) + ") "
             + "ENABLE(ROW_BASED)";
    }

    private String[] resultFields() {
        List<String> fields = new ArrayList<>(List.of("queue_id", "performer", "case_id"));
        for (String field : CASE_FIELDS) fields.add("case_" + field);
        return fields.toArray(new String[0]);
    }

    /** Every group the user belongs to, including nested membership. */
    private List<String> fetchGroupsOfUser(String username) {
        List<String> groups = new ArrayList<>();
        for (Map<String, String> row : select(
                "SELECT group_name FROM dm_group WHERE ANY i_all_users_names = '"
                + username.replace("'", "''") + "'", "group_name")) {
            String name = row.get("group_name");
            if (name != null && !name.isBlank() && !groups.contains(name)) groups.add(name);
        }
        return groups;
    }

    // --- Small DQL helpers ---------------------------------------------------

    /** Keeps the performer IN-list to a sane query length for users in many groups. */
    private static final int PERFORMER_BATCH = 50;
    private static final int PAGE_SIZE = 500;
    private static final int MAX_PAGES = 40;

    private static final String[] CASE_FIELDS = {
        "object_name", "description", "department_name", "department_short_code", "ho_ro",
        "status", "task_priority", "r_creator_name", "functions", "function_short_code",
        "file_number", "case_nature", "types", "language_type"
    };

    private List<List<String>> batches(List<String> values, int size) {
        List<List<String>> out = new ArrayList<>();
        for (int i = 0; i < values.size(); i += size) {
            out.add(values.subList(i, Math.min(values.size(), i + size)));
        }
        return out;
    }

    private String inClause(List<String> values) {
        return values.stream()
                .map(v -> "'" + v.replace("'", "''") + "'")
                .collect(Collectors.joining(","));
    }

    /**
     * Run a DQL query and pull the named properties out of each row.
     *
     * <p>Pages until a short page comes back: the repository caps how many rows one page
     * returns regardless of {@code items-per-page}, so reading only the first page can
     * silently lose rows.
     */
    @SuppressWarnings("unchecked")
    private List<Map<String, String>> select(String dql, String... fields) {
        List<Map<String, String>> rows = new ArrayList<>();
        for (int page = 1; page <= MAX_PAGES; page++) {
            List<?> entries;
            try {
                Map<String, Object> response = restClient.get()
                        .uri(buildUri(dql, PAGE_SIZE, page))
                        .header("Authorization", getAuthHeader())
                        .header("Accept", "application/vnd.emc.documentum+json")
                        .retrieve()
                        .body(Map.class);
                if (response == null || !(response.get("entries") instanceof List<?> list)) break;
                entries = list;
            } catch (Exception e) {
                log.error("DQL failed on page {} [{}]: {}", page, dql, e.getMessage());
                break;
            }
            for (Object entry : entries) {
                Map<?, ?> props = extractProps(entry);
                if (props == null) continue;
                Map<String, String> row = new HashMap<>();
                for (String field : fields) row.put(field, str(props.get(field)));
                rows.add(row);
            }
            if (entries.size() < PAGE_SIZE) break;
        }
        return rows;
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

    /**
     * A property as a single string.
     *
     * <p>Repeating attributes - {@code dmi_package.r_component_id} among them - come back
     * from the REST tier as JSON arrays. Passing one straight to {@code String.valueOf}
     * yields "[0802cba080042db2]", brackets included, which then matches nothing when fed
     * back into a DQL IN-list.
     */
    private String str(Object value) {
        if (value == null) return "";
        if (value instanceof List<?> list) {
            return list.isEmpty() ? "" : str(list.get(0));
        }
        return String.valueOf(value);
    }
}

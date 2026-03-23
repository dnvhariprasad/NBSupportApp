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

/**
 * Replicates the xCP inbox.tasklist query via DQL.
 *
 * Key dmi_queue_item attribute corrections:
 *   - Assignee is stored in scalar attribute "name" (NOT "for_user", NOT repeating)
 *     → filter with:  name = '<username>'
 *   - Task type is stored in "task_name" (FYA, FYI, etc.)
 *   - "r_task_state" does NOT exist on dmi_queue_item (it's on dmi_workitem as r_state)
 *
 * Three-step approach (avoids DM_QUERY_E_REPEATING_USED on dmi_package.r_component_id):
 *   Step 1: dmi_queue_item JOIN dmi_workitem → task rows + r_workflow_id
 *   Step 2: cms_case_folder via IN(SELECT r_component_id FROM dmi_package ...)
 *   Step 3: cms_workflow_param via IN(SELECT r_component_id FROM dmi_package ...) + task_name='FYA'
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

    // ─── Step 1: queue items + workflow IDs ──────────────────────────────────
    //
    // SELECT qi.r_object_id, qi.task_name, qi.sender_name, qi.date_sent, wi.r_workflow_id
    // FROM   dmi_queue_item qi, dmi_workitem wi
    // WHERE  qi.name = '<username>'           ← "name" is a scalar assignee attribute
    // AND    qi.item_id = wi.r_object_id
    // ORDER  BY qi.date_sent DESC
    //
    @SuppressWarnings("unchecked")
    public Map<String, Object> getInboxTasks(String username, int page, int itemsPerPage) {
        String safeUser = username.replace("'", "''");

        String dql =
            "SELECT qi.r_object_id, qi.task_name, qi.sender_name, qi.date_sent, wi.r_workflow_id " +
            "FROM dmi_queue_item qi, dmi_workitem wi " +
            "WHERE qi.name = '" + safeUser + "' " +
            "AND qi.item_id = wi.r_object_id " +
            "ORDER BY qi.date_sent DESC";

        log.info("Fetching FYA inbox tasks for user '{}'", username);
        log.debug("Step-1 DQL: {}", dql);

        try {
            Map<String, Object> response = restClient.get()
                    .uri(repoUrl() + "?dql={dql}&items-per-page={size}&page={page}&inline=true",
                         dql, itemsPerPage, page)
                    .header("Authorization", getAuthHeader())
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .retrieve()
                    .body(Map.class);

            return parseDqlResponse(response);
        } catch (Exception e) {
            log.error("Failed to fetch inbox tasks for user '{}': {}", username, e.getMessage());
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("message", e.getMessage());
            error.put("tasks", List.of());
            error.put("total", 0);
            return error;
        }
    }

    // ─── Step 2: cms_case_folder for a workflow ───────────────────────────────
    //
    // SELECT object_name, status, task_priority, case_nature, description,
    //        r_creator_name, r_modifier, reason_for_cancellation
    // FROM   cms_case_folder
    // WHERE  r_object_id IN (
    //     SELECT r_component_id FROM dmi_package
    //     WHERE  r_workflow_id = '<workflowId>'
    //     AND    r_package_name = 'CASE'
    // )
    //
    @SuppressWarnings("unchecked")
    private Map<String, Object> fetchCaseFolder(String workflowId) {
        if (workflowId == null || workflowId.isBlank()) return Map.of();
        String dql =
            "SELECT object_name, status, task_priority, case_nature, description, " +
            "r_creator_name, r_modifier, reason_for_cancellation " +
            "FROM cms_case_folder " +
            "WHERE r_object_id IN (" +
            "  SELECT r_component_id FROM dmi_package " +
            "  WHERE r_workflow_id = '" + workflowId.replace("'", "''") + "' " +
            "  AND r_package_name = 'CASE'" +
            ")";
        try {
            Map<String, Object> response = restClient.get()
                    .uri(repoUrl() + "?dql={dql}&items-per-page=1&page=1&inline=true", dql)
                    .header("Authorization", getAuthHeader())
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .retrieve()
                    .body(Map.class);
            return extractFirstProps(response);
        } catch (Exception e) {
            log.warn("fetchCaseFolder failed for workflow {}: {}", workflowId, e.getMessage());
            return Map.of();
        }
    }

    // ─── Step 3: cms_workflow_param filtered by task_name='FYA' ──────────────
    //
    // SELECT task_name, task_received, department
    // FROM   cms_workflow_param
    // WHERE  r_object_id IN (
    //     SELECT r_component_id FROM dmi_package
    //     WHERE  r_workflow_id = '<workflowId>'
    //     AND    r_package_name = 'WFParam'
    // )
    // AND    task_name = 'FYA'
    //
    // Returns null when no row found (task_name != 'FYA' → exclude from results).
    //
    @SuppressWarnings("unchecked")
    private Map<String, Object> fetchWorkflowParam(String workflowId) {
        if (workflowId == null || workflowId.isBlank()) return null;
        String dql =
            "SELECT task_name, task_received, department " +
            "FROM cms_workflow_param " +
            "WHERE r_object_id IN (" +
            "  SELECT r_component_id FROM dmi_package " +
            "  WHERE r_workflow_id = '" + workflowId.replace("'", "''") + "' " +
            "  AND r_package_name = 'WFParam'" +
            ") " +
            "AND task_name = 'FYA'";
        try {
            Map<String, Object> response = restClient.get()
                    .uri(repoUrl() + "?dql={dql}&items-per-page=1&page=1&inline=true", dql)
                    .header("Authorization", getAuthHeader())
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .retrieve()
                    .body(Map.class);
            if (response == null) return null;
            List<?> entries = (List<?>) response.get("entries");
            if (entries == null || entries.isEmpty()) return null;
            Map<?, ?> props = extractProps(entries.get(0));
            return props != null ? (Map<String, Object>) props : null;
        } catch (Exception e) {
            log.warn("fetchWorkflowParam failed for workflow {}: {}", workflowId, e.getMessage());
            return Map.of();
        }
    }

    // ─── Debug: simplest possible queue item query (no joins) ─────────────────
    //
    // SELECT r_object_id, task_name, sender_name, date_sent, item_state
    // FROM   dmi_queue_item
    // WHERE  name = '<username>'
    // ORDER  BY date_sent DESC
    //
    @SuppressWarnings("unchecked")
    public Map<String, Object> getRawResponse(String username) {
        String safeUser = username.replace("'", "''");
        // Simplest possible query — just dmi_queue_item, no joins — to verify data exists
        String dql =
            "SELECT r_object_id, task_name, sender_name, date_sent, item_state " +
            "FROM dmi_queue_item " +
            "WHERE name = '" + safeUser + "' " +
            "ORDER BY date_sent DESC";

        log.info("Raw dmi_queue_item DQL for '{}': {}", username, dql);
        try {
            Map<String, Object> response = restClient.get()
                    .uri(repoUrl() + "?dql={dql}&items-per-page=10&page=1&inline=true", dql)
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

    // ─── Response parsing ─────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private Map<String, Object> parseDqlResponse(Map<String, Object> response) {
        List<Map<String, Object>> tasks = new ArrayList<>();
        int total = 0;

        if (response == null) {
            return Map.of("tasks", tasks, "total", total, "success", true);
        }

        Object totalObj = response.get("total");
        if (totalObj instanceof Number n) {
            total = n.intValue();
        }

        Object entriesObj = response.get("entries");
        if (entriesObj instanceof List<?> entries) {
            for (Object entry : entries) {
                Map<?, ?> props = extractProps(entry);
                if (props == null) continue;

                String workflowId = (String) props.get("r_workflow_id");

                // Step 3: filter on task_name='FYA' via cms_workflow_param
                Map<String, Object> wp = fetchWorkflowParam(workflowId);
                if (wp == null) continue; // not an FYA task — exclude

                // Step 2: enrich with cms_case_folder data
                Map<String, Object> cf = fetchCaseFolder(workflowId);

                Map<String, Object> task = new HashMap<>();
                // From dmi_queue_item / dmi_workitem
                task.put("objectId",   props.get("r_object_id"));
                task.put("taskName",   props.get("task_name"));
                task.put("senderName", props.get("sender_name"));
                task.put("dateSent",   props.get("date_sent"));
                // From cms_case_folder (CASE package)
                task.put("caseName",              cf.get("object_name"));
                task.put("status",                cf.get("status"));
                task.put("taskPriority",          cf.get("task_priority"));
                task.put("caseNature",            cf.get("case_nature"));
                task.put("description",           cf.get("description"));
                task.put("createdBy",             cf.get("r_creator_name"));
                task.put("changedBy",             cf.get("r_modifier"));
                task.put("reasonForCancellation", cf.get("reason_for_cancellation"));
                // From cms_workflow_param (WFParam package)
                task.put("wfTaskName",   wp.get("task_name"));
                task.put("taskReceived", wp.get("task_received"));
                task.put("department",   wp.get("department"));

                tasks.add(task);
            }
        }

        Map<String, Object> result = new HashMap<>();
        result.put("tasks", tasks);
        result.put("total", total);
        result.put("success", true);
        return result;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> extractFirstProps(Map<String, Object> response) {
        if (response == null) return Map.of();
        List<?> entries = (List<?>) response.get("entries");
        if (entries == null || entries.isEmpty()) return Map.of();
        Map<?, ?> props = extractProps(entries.get(0));
        return props != null ? (Map<String, Object>) props : Map.of();
    }

    @SuppressWarnings("unchecked")
    private Map<?, ?> extractProps(Object entry) {
        if (!(entry instanceof Map<?, ?> entryMap)) return null;
        Object content = entryMap.get("content");
        if (!(content instanceof Map<?, ?> contentMap)) return null;
        Object props = contentMap.get("properties");
        return props instanceof Map<?, ?> ? (Map<?, ?>) props : null;
    }
}

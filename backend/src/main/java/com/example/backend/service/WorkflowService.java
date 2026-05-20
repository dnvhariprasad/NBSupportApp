package com.example.backend.service;

import com.example.backend.config.DctmConfig;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.ArrayList;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.nio.charset.StandardCharsets;

@Service
@Slf4j
public class WorkflowService {

    private final DctmConfig dctmConfig;
    private final DctmAuthService authService;
    private final RestClient restClient;

    public WorkflowService(DctmConfig dctmConfig,
            DctmAuthService authService,
            RestClient.Builder restClientBuilder) {
        this.dctmConfig = dctmConfig;
        this.authService = authService;
        this.restClient = restClientBuilder.build();
    }

    private String getAuthHeader() {
        return authService.getUserAuthHeader();
    }

    private String getServiceAuthHeader() {
        return authService.getServiceAuthHeader();
    }

    @org.springframework.beans.factory.annotation.Value("${app.workflow.processes}")
    private String processList;

    public List<Map<String, Object>> getProcessTemplates() {
        List<Map<String, Object>> templates = new ArrayList<>();
        if (processList != null && !processList.isEmpty()) {
            String[] processes = processList.split(",");
            for (String process : processes) {
                Map<String, Object> template = new HashMap<>();
                String trimmedProcess = process.trim();
                template.put("title", trimmedProcess);
                template.put("object_name", trimmedProcess);
                templates.add(template);
            }
        }
        return templates;
    }

    public Map<String, Object> getRunningWorkflows(String processName, int page, int itemsPerPage) {
        String baseUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository();
        
        // Use DQL to get workflows with their associated case (component) name
        // Note: We join with dmi_package (p) and dm_sysobject (c) to get the case number (object_name of the component)
        String dql = "SELECT w.r_object_id, w.object_name, w.r_creator_name, w.r_runtime_state, w.r_start_date, " +
                    "p.r_component_id as case_id, c.object_name as case_number " +
                    "FROM dm_workflow w, dmi_package p, dm_sysobject c " +
                    "WHERE w.process_id = '" + processName + "' " +
                    "AND p.r_workflow_id = w.r_object_id " +
                    "AND c.r_object_id = p.r_component_id";

        try {
            // Using DQL via the repository endpoint
            return restClient.get()
                    .uri(baseUrl + "?dql={dql}&page={page}&items-per-page={size}&inline=true", 
                         dql, page, itemsPerPage)
                    .header("Authorization", getAuthHeader())
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .retrieve()
                    .body(Map.class);
        } catch (Exception e) {
            log.error("Error fetching workflows with DQL for process {}", processName, e);
            // Fallback to basic REST if DQL fails (e.g. if processName is not an ID)
            String url = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository() + "/workflows";
            String filter = "process_id='" + processName + "'";
            return restClient.get()
                    .uri(url + "?filter=" + filter + "&items-per-page=" + itemsPerPage + "&page=" + page + "&inline=true")
                    .header("Authorization", getAuthHeader())
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .retrieve()
                    .body(Map.class);
        }
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> getWorkflowsByCaseNumber(String caseNumber) {
        Map<String, Object> result = new HashMap<>();
        String baseUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository();

        try {
            String safeNumber = caseNumber.trim().replace("'", "''");
            String dql = "SELECT r_object_id, object_name, subject FROM cms_case_folder " +
                    "WHERE object_name = '" + safeNumber + "' ENABLE(RETURN_TOP 1)";

            Map<String, Object> caseResponse = restClient.get()
                    .uri(baseUrl + "?dql={dql}&inline=true&items-per-page=1", dql)
                    .header("Authorization", getAuthHeader())
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .retrieve()
                    .body(Map.class);

            String caseObjectId = null;
            String caseSubject = null;

            if (caseResponse != null && caseResponse.containsKey("entries")) {
                List<Map<String, Object>> entries = (List<Map<String, Object>>) caseResponse.get("entries");
                if (!entries.isEmpty()) {
                    Map<String, Object> content = (Map<String, Object>) entries.get(0).get("content");
                    if (content != null && content.containsKey("properties")) {
                        Map<String, Object> props = (Map<String, Object>) content.get("properties");
                        caseObjectId = (String) props.get("r_object_id");
                        caseSubject = (String) props.get("subject");
                    }
                }
            }

            if (caseObjectId == null) {
                result.put("error", "Case not found: " + caseNumber);
                result.put("caseNumber", caseNumber);
                result.put("workflows", new ArrayList<>());
                result.put("count", 0);
                return result;
            }

            Map<String, Object> workflowResult = getWorkflowsForCase(caseObjectId);
            workflowResult.put("caseNumber", caseNumber);
            workflowResult.put("caseObjectId", caseObjectId);
            workflowResult.put("caseSubject", caseSubject);
            return workflowResult;

        } catch (Exception e) {
            log.error("Error searching workflows by case number {}: {}", caseNumber, e.getMessage());
            result.put("error", "Failed to search by case number: " + e.getMessage());
            result.put("caseNumber", caseNumber);
            result.put("workflows", new ArrayList<>());
            result.put("count", 0);
            return result;
        }
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> getWorkflowsForCase(String caseId) {
        Map<String, Object> result = new HashMap<>();
        List<Map<String, Object>> workflows = new ArrayList<>();
        List<String> debugLogs = new ArrayList<>();

        debugLogs.add("Starting workflow search for Case ID: " + caseId);

        try {
            String chronId = "";
            try {
                String caseUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository() +
                        "/objects/" + caseId;
                Map<String, Object> caseProps = restClient.get()
                        .uri(caseUrl)
                        .header("Authorization", getAuthHeader())
                        .header("Accept", "application/vnd.emc.documentum+json")
                        .retrieve()
                        .body(Map.class);
                if (caseProps != null && caseProps.containsKey("properties")) {
                    Map<String, Object> props = (Map<String, Object>) caseProps.get("properties");
                    chronId = (String) props.get("i_chronicle_id");
                    debugLogs.add("Found Chronicle ID: " + chronId);
                }
            } catch (Exception e) {
                debugLogs.add("Could not fetch chronicle ID: " + e.getMessage());
            }

            StringBuilder packageDql = new StringBuilder();
            packageDql.append("SELECT r_object_id, r_workflow_id, r_package_name FROM dmi_package WHERE ");
            packageDql.append("ANY r_component_id = '").append(caseId).append("'");
            if (chronId != null && !chronId.isEmpty()) {
                packageDql.append(" OR ANY r_component_chron_id = '").append(chronId).append("'");
            }

            String baseUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository();

            Map<String, Object> packageResponse = restClient.get()
                    .uri(baseUrl + "?dql={dql}&inline=true&items-per-page={itemsPerPage}",
                            packageDql.toString(), 100)
                    .header("Authorization", getAuthHeader())
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .retrieve()
                    .body(Map.class);

            List<String> workflowIds = new ArrayList<>();
            if (packageResponse != null && packageResponse.containsKey("entries")) {
                List<Map<String, Object>> entries = (List<Map<String, Object>>) packageResponse.get("entries");
                for (Map<String, Object> entry : entries) {
                    Map<String, Object> content = (Map<String, Object>) entry.get("content");
                    if (content != null && content.containsKey("properties")) {
                        Map<String, Object> props = (Map<String, Object>) content.get("properties");
                        String wfId = (String) props.get("r_workflow_id");
                        if (wfId != null && !workflowIds.contains(wfId) && !wfId.equals("0000000000000000")) {
                            workflowIds.add(wfId);
                        }
                    }
                }
            }

            for (String workflowId : workflowIds) {
                try {
                    Map<String, Object> workflowDetails = new HashMap<>();
                    workflowDetails.put("r_object_id", workflowId);

                    try {
                        String wfDql = "SELECT object_name, r_object_id, r_creator_name, supervisor_name, r_start_date, process_id, r_runtime_state FROM dm_workflow WHERE r_object_id = '"
                                + workflowId + "'";
                        Map<String, Object> wfResponse = restClient.get()
                                .uri(baseUrl + "?dql={dql}&inline=true&items-per-page=1", wfDql)
                                .header("Authorization", getAuthHeader())
                                .header("Accept", "application/vnd.emc.documentum+json")
                                .retrieve()
                                .body(Map.class);

                        if (wfResponse != null && wfResponse.containsKey("entries")) {
                            List<Map<String, Object>> entries = (List<Map<String, Object>>) wfResponse.get("entries");
                            if (!entries.isEmpty()) {
                                Map<String, Object> content = (Map<String, Object>) entries.get(0).get("content");
                                if (content != null && content.containsKey("properties")) {
                                    workflowDetails.putAll((Map<String, Object>) content.get("properties"));
                                }
                            }
                        }
                    } catch (Exception e) {
                        workflowDetails.put("process_name", "Unknown (ID: " + workflowId + ")");
                        workflowDetails.put("r_runtime_state", "unknown");
                    }

                    // For the multi-workflow fetch, we use simpler queries to be faster/safer
                    workflowDetails.put("workItems", new ArrayList<>());
                    workflowDetails.put("queueItems", new ArrayList<>());
                    workflows.add(workflowDetails);
                } catch (Exception e) {
                    debugLogs.add("Error processing workflow " + workflowId + ": " + e.getMessage());
                }
            }

            result.put("workflows", workflows);
            result.put("count", workflows.size());
            result.put("debug", debugLogs);

        } catch (Exception e) {
            log.error("Error fetching workflows for case {}: {}", caseId, e.getMessage());
            result.put("workflows", workflows);
            result.put("count", 0);
            result.put("error", "Failed to fetch workflow information: " + e.getMessage());
            result.put("debug", debugLogs);
        }

        return result;
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> getWorkflowById(String workflowId) {
        Map<String, Object> result = new HashMap<>();
        String baseUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository();

        try {
            // 1. Basic Workflow Properties
            String wfDql = "SELECT object_name, r_object_id, r_creator_name, supervisor_name, r_start_date, process_id, r_runtime_state FROM dm_workflow WHERE r_object_id = '"
                    + workflowId + "'";
            Map<String, Object> wfResponse = restClient.get()
                    .uri(baseUrl + "?dql={dql}&inline=true&items-per-page=1", wfDql)
                    .header("Authorization", getAuthHeader())
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .retrieve()
                    .body(Map.class);

            if (wfResponse != null && wfResponse.containsKey("entries")) {
                List<Map<String, Object>> entries = (List<Map<String, Object>>) wfResponse.get("entries");
                if (!entries.isEmpty()) {
                    Map<String, Object> content = (Map<String, Object>) entries.get(0).get("content");
                    if (content != null && content.containsKey("properties")) {
                        result.putAll((Map<String, Object>) content.get("properties"));
                    }
                }
            }

            // 1.5 Fetch associated Case Number
            try {
                String caseDql = "SELECT c.object_name as case_number " +
                        "FROM dmi_package p, dm_sysobject c " +
                        "WHERE p.r_workflow_id = '" + workflowId + "' " +
                        "AND c.r_object_id = p.r_component_id ENABLE(RETURN_TOP 1)";
                Map<String, Object> caseResponse = restClient.get()
                        .uri(baseUrl + "?dql={dql}&inline=true&items-per-page=1", caseDql)
                        .header("Authorization", getAuthHeader())
                        .header("Accept", "application/vnd.emc.documentum+json")
                        .retrieve()
                        .body(Map.class);
                if (caseResponse != null && caseResponse.containsKey("entries")) {
                    List<Map<String, Object>> caseEntries = (List<Map<String, Object>>) caseResponse.get("entries");
                    if (!caseEntries.isEmpty()) {
                        Map<String, Object> caseContent = (Map<String, Object>) caseEntries.get(0).get("content");
                        if (caseContent != null && caseContent.containsKey("properties")) {
                            Map<String, Object> props = (Map<String, Object>) caseContent.get("properties");
                            if (props.containsKey("case_number")) {
                                result.put("case_number", props.get("case_number"));
                            }
                        }
                    }
                }
            } catch (Exception e) {
                log.warn("Error fetching case number for workflow {}: {}", workflowId, e.getMessage());
            }


            // 2. Fetch Work Items (With Activity Names)
            try {
                // Join dmi_workitem with dm_activity to get human-readable names
                String tasksDql = "SELECT i.r_object_id, i.r_act_seqno, i.r_runtime_state, i.r_performer_name, i.r_creation_date, i.r_act_def_id, i.a_wq_name, a.object_name as r_act_name "
                        + "FROM dmi_workitem i, dm_activity a "
                        + "WHERE i.r_act_def_id = a.r_object_id AND i.r_workflow_id = '" + workflowId + "' "
                        + "ORDER BY i.r_act_seqno ASC, i.r_creation_date ASC";

                Map<String, Object> tasksResponse = restClient.get()
                        .uri(baseUrl + "?dql={dql}&inline=true&items-per-page=100", tasksDql)
                        .header("Authorization", getAuthHeader())
                        .header("Accept", "application/vnd.emc.documentum+json")
                        .retrieve()
                        .body(Map.class);

                List<Map<String, Object>> tasks = new ArrayList<>();
                if (tasksResponse != null && tasksResponse.containsKey("entries")) {
                    List<Map<String, Object>> taskEntries = (List<Map<String, Object>>) tasksResponse.get("entries");
                    for (Map<String, Object> taskEntry : taskEntries) {
                        Map<String, Object> taskContent = (Map<String, Object>) taskEntry.get("content");
                        if (taskContent != null && taskContent.containsKey("properties")) {
                            tasks.add((Map<String, Object>) taskContent.get("properties"));
                        }
                    }
                } else {
                    // Fallback to simple query if join fails or returns nothing
                    log.info("Join query returned no entries, falling back to simple workitem query for workflow {}",
                            workflowId);
                    String simpleTasksDql = "SELECT r_object_id, r_act_seqno, r_runtime_state, r_performer_name, r_creation_date, r_act_def_id, a_wq_name FROM dmi_workitem WHERE r_workflow_id = '"
                            + workflowId + "'";
                    Map<String, Object> simpleTasksResponse = restClient.get()
                            .uri(baseUrl + "?dql={dql}&inline=true&items-per-page=100", simpleTasksDql)
                            .header("Authorization", getAuthHeader())
                            .header("Accept", "application/vnd.emc.documentum+json")
                            .retrieve()
                            .body(Map.class);
                    if (simpleTasksResponse != null && simpleTasksResponse.containsKey("entries")) {
                        List<Map<String, Object>> taskEntries = (List<Map<String, Object>>) simpleTasksResponse
                                .get("entries");
                        for (Map<String, Object> taskEntry : taskEntries) {
                            Map<String, Object> taskContent = (Map<String, Object>) taskEntry.get("content");
                            if (taskContent != null && taskContent.containsKey("properties")) {
                                tasks.add((Map<String, Object>) taskContent.get("properties"));
                            }
                        }
                    }
                }
                result.put("workItems", tasks);
            } catch (Exception e) {
                log.warn("Error fetching work items for workflow {}: {}", workflowId, e.getMessage());
                result.put("workItems", new ArrayList<>());
            }

            // 3. Fetch Queue Items (Resilient to missing BPS fields)
            try {
                // Try basic fields first (always supported)
                String queueDql = "SELECT r_object_id, name, task_state, sent_by, date_sent, item_id, router_id FROM dmi_queue_item WHERE router_id = '"
                        + workflowId + "'";

                Map<String, Object> queueResponse = restClient.get()
                        .uri(baseUrl + "?dql={dql}&inline=true&items-per-page=100", queueDql)
                        .header("Authorization", getAuthHeader())
                        .header("Accept", "application/vnd.emc.documentum+json")
                        .retrieve()
                        .body(Map.class);

                List<Map<String, Object>> queueItems = new ArrayList<>();
                if (queueResponse != null && queueResponse.containsKey("entries")) {
                    List<Map<String, Object>> qEntries = (List<Map<String, Object>>) queueResponse.get("entries");
                    for (Map<String, Object> qEntry : qEntries) {
                        Map<String, Object> qContent = (Map<String, Object>) qEntry.get("content");
                        if (qContent != null && qContent.containsKey("properties")) {
                            Map<String, Object> qProps = new HashMap<>(
                                    (Map<String, Object>) qContent.get("properties"));

                            // 4. Optionally fetch BPS fields and error details for paused items
                            String state = String.valueOf(qProps.get("task_state"));
                            if ("paused".equalsIgnoreCase(state) || "4".equals(state)) {
                                try {
                                    String bpsDql = "SELECT message, source, step_id FROM dmi_queue_item WHERE r_object_id = '"
                                            + qProps.get("r_object_id") + "'";
                                    Map<String, Object> bpsRes = restClient.get()
                                            .uri(baseUrl + "?dql={dql}&inline=true&items-per-page=1", bpsDql)
                                            .header("Authorization", getAuthHeader())
                                            .header("Accept", "application/vnd.emc.documentum+json")
                                            .retrieve()
                                            .body(Map.class);
                                    if (bpsRes != null && bpsRes.containsKey("entries")) {
                                        List<Map<String, Object>> bpsEntries = (List<Map<String, Object>>) bpsRes
                                                .get("entries");
                                        if (!bpsEntries.isEmpty()) {
                                            Map<String, Object> bpsProps = (Map<String, Object>) ((Map<String, Object>) bpsEntries
                                                    .get(0).get("content")).get("properties");
                                            qProps.putAll(bpsProps);
                                        }
                                    }
                                } catch (Exception ignored) {
                                    // BPS fields probably don't exist in this repo
                                }

                                // Fetch error details from associated work item
                                try {
                                    String itemId = (String) qProps.get("item_id");
                                    String workItemDql = "SELECT r_exec_os_error, r_exec_result_id FROM dmi_workitem WHERE r_object_id = '"
                                            + itemId + "'";
                                    Map<String, Object> wiRes = restClient.get()
                                            .uri(baseUrl + "?dql={dql}&inline=true&items-per-page=1", workItemDql)
                                            .header("Authorization", getAuthHeader())
                                            .header("Accept", "application/vnd.emc.documentum+json")
                                            .retrieve()
                                            .body(Map.class);
                                    if (wiRes != null && wiRes.containsKey("entries")) {
                                        List<Map<String, Object>> wiEntries = (List<Map<String, Object>>) wiRes.get("entries");
                                        if (!wiEntries.isEmpty()) {
                                            Map<String, Object> wiProps = (Map<String, Object>) ((Map<String, Object>) wiEntries
                                                    .get(0).get("content")).get("properties");
                                            if (wiProps.containsKey("r_exec_os_error")) {
                                                qProps.put("r_exec_os_error", wiProps.get("r_exec_os_error"));
                                            }
                                            if (wiProps.containsKey("r_exec_result_id")) {
                                                qProps.put("r_exec_result_id", wiProps.get("r_exec_result_id"));
                                            }
                                        }
                                    }
                                } catch (Exception ignored) {
                                    // Work item fields don't exist
                                }
                            }
                            queueItems.add(qProps);
                        }
                    }
                }
                result.put("queueItems", queueItems);
            } catch (Exception e) {
                log.warn("Error fetching queue items for workflow {}: {}", workflowId, e.getMessage());
                result.put("queueItems", new ArrayList<>());
            }

            // 5. Fetch Process Variables
            try {
                String varDql = "SELECT object_name, string_value FROM dmc_wfsd_element_string WHERE workflow_id='"
                        + workflowId + "' ORDER BY object_name ASC";
                Map<String, Object> varResponse = restClient.get()
                        .uri(baseUrl + "?dql={dql}&inline=true&items-per-page=100", varDql)
                        .header("Authorization", getAuthHeader())
                        .header("Accept", "application/vnd.emc.documentum+json")
                        .retrieve()
                        .body(Map.class);

                List<Map<String, Object>> variables = new ArrayList<>();
                if (varResponse != null && varResponse.containsKey("entries")) {
                    List<Map<String, Object>> varEntries = (List<Map<String, Object>>) varResponse.get("entries");
                    for (Map<String, Object> varEntry : varEntries) {
                        Map<String, Object> varContent = (Map<String, Object>) varEntry.get("content");
                        if (varContent != null && varContent.containsKey("properties")) {
                            variables.add((Map<String, Object>) varContent.get("properties"));
                        }
                    }
                }
                result.put("processVariables", variables);
            } catch (Exception ignored) {
            }

            result.put("r_object_id", workflowId);
            return result;

        } catch (Exception e) {
            log.error("Error fetching workflow {}: {}", workflowId, e.getMessage());
            result.put("error", "Failed to fetch workflow: " + e.getMessage());
            result.put("r_object_id", workflowId);
            return result;
        }
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> restartWorkflow(String workflowId) {
        Map<String, Object> result = new HashMap<>();
        String baseUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository();

        log.info("==== NEW RESTART CODE PATH EXECUTING ====");
        log.info("Restarting workflow: {}", workflowId);
        try {
            // Fetch the workflow using the working getWorkflowById method
            Map<String, Object> workflow = getWorkflowById(workflowId);

            if (workflow == null || workflow.isEmpty()) {
                log.info("Could not fetch workflow");
                result.put("success", false);
                result.put("error", "Could not fetch workflow");
                return result;
            }

            Map<String, Object> workflowProps = workflow;

            // Find the paused work item
            List<Map<String, Object>> queueItems = (List<Map<String, Object>>) workflowProps.get("queueItems");
            if (queueItems == null || queueItems.isEmpty()) {
                log.info("No paused items found in workflow");
                result.put("success", false);
                result.put("error", "No paused activity found in workflow");
                return result;
            }

            // Find first paused item
            Map<String, Object> pausedQueueItem = null;
            String pausedItemId = null;
            Integer actSeqno = null;

            for (Map<String, Object> item : queueItems) {
                if ("paused".equals(item.get("task_state"))) {
                    pausedQueueItem = item;
                    pausedItemId = (String) item.get("item_id");
                    break;
                }
            }

            if (pausedItemId == null) {
                log.info("No paused item found");
                result.put("success", false);
                result.put("error", "No paused activity found in workflow");
                return result;
            }
            log.info("Found paused item ID: {}", pausedItemId);

            // Find the activity name from workItems using the item_id
            List<Map<String, Object>> workItems = (List<Map<String, Object>>) workflowProps.get("workItems");
            String activityName = null;

            if (workItems != null) {
                for (Map<String, Object> workItem : workItems) {
                    if (pausedItemId.equals(workItem.get("r_object_id"))) {
                        activityName = (String) workItem.get("r_act_name");
                        actSeqno = ((Number) workItem.get("r_act_seqno")).intValue();
                        break;
                    }
                }
            }

            if (activityName == null) {
                log.info("Could not determine activity name");
                result.put("success", false);
                result.put("error", "Could not determine activity name");
                return result;
            }
            log.info("Found activity name: {}", activityName);

            // Use REST API PUT endpoint with resume-all action to restart paused activities
            String workflowUrl = baseUrl + "/workflows/" + workflowId + "?action=resume-all";

            log.info("=== RESUMING PAUSED ACTIVITIES ===");
            log.info("PUT URL: {}", workflowUrl);

            Map<String, Object> response = restClient.put()
                    .uri(workflowUrl)
                    .header("Authorization", getAuthHeader())
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .header("Content-Type", "application/json")
                    .retrieve()
                    .body(Map.class);

            if (response != null) {
                result.put("success", true);
                result.put("message", "Workflow activity '" + activityName + "' restarted successfully");
                result.put("data", response);
            } else {
                result.put("success", true);
                result.put("message", "Workflow activity '" + activityName + "' restarted successfully");
            }
            return result;
        } catch (Exception e) {
            log.error("Error restarting workflow {}: {}", workflowId, e.getMessage());
            result.put("success", false);
            result.put("error", e.getMessage());
            return result;
        }
    }

    public Map<String, Object> retryActivity(String workflowId, String activityId) {
        try {
            String url = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository() +
                    "/workflows/" + workflowId + "/activities/" + activityId + "/retry";
            Map<String, Object> response = restClient.post()
                    .uri(url)
                    .header("Authorization", getServiceAuthHeader())
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .retrieve()
                    .body(Map.class);

            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            return result;
        } catch (Exception e) {
            log.error("Error retrying activity {} in workflow {}: {}", activityId, workflowId, e.getMessage());
            Map<String, Object> result = new HashMap<>();
            result.put("success", false);
            result.put("error", e.getMessage());
            return result;
        }
    }

    @SuppressWarnings("unchecked")
    public String getDocumentContent(String documentId) {
        String baseUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository();

        try {
            log.info("Fetching document content for ID: {}", documentId);

            // Fetch the document object to get its properties
            String docUrl = baseUrl + "/objects/" + documentId;
            Map<String, Object> response = restClient.get()
                    .uri(docUrl)
                    .header("Authorization", getAuthHeader())
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .retrieve()
                    .body(Map.class);

            if (response != null && response.containsKey("content")) {
                Map<String, Object> content = (Map<String, Object>) response.get("content");
                if (content != null && content.containsKey("properties")) {
                    // Return the object_name and other basic properties
                    Map<String, Object> props = (Map<String, Object>) content.get("properties");
                    return props.toString();
                }
            }
            return "Document metadata: " + (response != null ? response.toString() : "Not found");

        } catch (Exception e) {
            log.error("Error fetching document {} content: {}", documentId, e.getMessage());
            return "Error fetching document: " + e.getMessage();
        }
    }
}

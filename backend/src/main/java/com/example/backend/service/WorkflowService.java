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
    private final RestClient restClient;

    public WorkflowService(DctmConfig dctmConfig, RestClient.Builder restClientBuilder) {
        this.dctmConfig = dctmConfig;
        this.restClient = restClientBuilder.build();
    }

    private String getAuthHeader() {
        String username = dctmConfig.getUsername();
        String password = dctmConfig.getPassword();
        return "Basic " + Base64.getEncoder().encodeToString(
                (username + ":" + password).getBytes(StandardCharsets.UTF_8));
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

    // Use DQL to fetch running workflows with task details
    // Use standard REST API to fetch workflows
    public Map<String, Object> getRunningWorkflows(String processName, int page, int itemsPerPage) {
        String url = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository() + "/workflows";

        // Build query params
        // Filter by process_id (the r_object_id of the workflow template)
        // Note: REST API filter doesn't support AND for multiple conditions easily
        // The 'processName' parameter should be the process template ID (e.g.,
        // 4b02cba08000624a)

        String filterQuery = "process_id='" + processName + "'";

        // Build URL manually to avoid over-encoding of the filter parameter
        // The filter expression like process_id='xxx' should NOT have = encoded
        String fullUrl = url + "?filter=" + filterQuery +
                "&items-per-page=" + itemsPerPage +
                "&page=" + page +
                "&inline=true";

        try {
            return restClient.get()
                    .uri(fullUrl)
                    .header("Authorization", getAuthHeader())
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .retrieve()
                    .body(Map.class);
        } catch (Exception e) {
            log.error("Error fetching workflows", e);
            throw new RuntimeException("Failed to fetch running workflows: " + e.getMessage());
        }
    }

    /**
     * Get workflows associated with a specific case
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> getWorkflowsForCase(String caseId) {
        Map<String, Object> result = new HashMap<>();
        List<Map<String, Object>> workflows = new ArrayList<>();
        List<String> debugLogs = new ArrayList<>();

        debugLogs.add("Starting workflow search for Case ID: " + caseId);

        try {
            // Step 1: Get chronicle ID for the case
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

            // Step 2: Build DQL to find workflow packages
            // Note: r_component_id is a repeating attribute, use ANY clause
            StringBuilder packageDql = new StringBuilder();
            packageDql.append("SELECT r_object_id, r_workflow_id, r_package_name FROM dmi_package WHERE ");
            packageDql.append("ANY r_component_id = '").append(caseId).append("'");
            if (chronId != null && !chronId.isEmpty()) {
                packageDql.append(" OR ANY r_component_chron_id = '").append(chronId).append("'");
            }

            String baseUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository();

            debugLogs.add("Package DQL: " + packageDql.toString());

            Map<String, Object> packageResponse = restClient.get()
                    .uri(baseUrl + "?dql={dql}&inline=true&items-per-page={itemsPerPage}",
                         packageDql.toString(), 100)
                    .header("Authorization", getAuthHeader())
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .retrieve()
                    .body(Map.class);

            // Step 3: Extract workflow IDs
            List<String> workflowIds = new ArrayList<>();
            if (packageResponse != null && packageResponse.containsKey("entries")) {
                List<Map<String, Object>> entries = (List<Map<String, Object>>) packageResponse.get("entries");
                debugLogs.add("Found " + entries.size() + " package entries.");

                for (Map<String, Object> entry : entries) {
                    Map<String, Object> content = (Map<String, Object>) entry.get("content");
                    if (content != null && content.containsKey("properties")) {
                        Map<String, Object> props = (Map<String, Object>) content.get("properties");
                        String wfId = (String) props.get("r_workflow_id");
                        if (wfId != null && !workflowIds.contains(wfId) && !wfId.equals("0000000000000000")) {
                            workflowIds.add(wfId);
                            debugLogs.add("Added Workflow ID: " + wfId);
                        }
                    }
                }
            } else {
                debugLogs.add("No package entries found.");
            }

            log.info("Found {} unique workflow IDs for case {}", workflowIds.size(), caseId);

            // Step 4: Fetch details for each workflow
            for (String workflowId : workflowIds) {
                try {
                    Map<String, Object> workflowDetails = new HashMap<>();
                    workflowDetails.put("r_object_id", workflowId);

                    // Fetch workflow object properties
                    try {
                        String workflowUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository() +
                                            "/objects/" + workflowId;

                        Map<String, Object> wfResponse = restClient.get()
                                .uri(workflowUrl)
                                .header("Authorization", getAuthHeader())
                                .header("Accept", "application/vnd.emc.documentum+json")
                                .retrieve()
                                .body(Map.class);

                        if (wfResponse != null && wfResponse.containsKey("properties")) {
                            workflowDetails.putAll((Map<String, Object>) wfResponse.get("properties"));
                        }
                    } catch (Exception e) {
                        debugLogs.add("Error fetching workflow object " + workflowId + ": " + e.getMessage());
                        workflowDetails.put("process_name", "Unknown (ID: " + workflowId + ")");
                        workflowDetails.put("r_runtime_state", "unknown");
                    }

                    // Fetch work items (activity history)
                    try {
                        String tasksDql = "SELECT r_object_id, r_act_seqno, r_runtime_state, r_performer_name, r_creation_date, r_act_def_id, a_wq_name " +
                                          "FROM dmi_workitem WHERE r_workflow_id = '" + workflowId + "' ORDER BY r_act_seqno ASC, r_creation_date ASC";

                        Map<String, Object> tasksResponse = restClient.get()
                                .uri(baseUrl + "?dql={dql}&inline=true&items-per-page={itemsPerPage}",
                                     tasksDql, 100)
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
                        }
                        workflowDetails.put("workItems", tasks);
                    } catch (Exception e) {
                        debugLogs.add("Error fetching work items for " + workflowId + ": " + e.getMessage());
                        workflowDetails.put("workItems", new ArrayList<>());
                    }

                    // Fetch queue items (current inbox status)
                    try {
                        String queueDql = "SELECT r_object_id, name, task_state, sent_by, date_sent, item_id, router_id " +
                                          "FROM dmi_queue_item WHERE router_id = '" + workflowId + "'";

                        Map<String, Object> queueResponse = restClient.get()
                                .uri(baseUrl + "?dql={dql}&inline=true&items-per-page={itemsPerPage}",
                                     queueDql, 100)
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
                                    queueItems.add((Map<String, Object>) qContent.get("properties"));
                                }
                            }
                        }
                        workflowDetails.put("queueItems", queueItems);
                    } catch (Exception e) {
                        debugLogs.add("Error fetching queue items for " + workflowId + ": " + e.getMessage());
                        workflowDetails.put("queueItems", new ArrayList<>());
                    }

                    workflows.add(workflowDetails);
                } catch (Exception e) {
                    debugLogs.add("Critical error processing workflow " + workflowId + ": " + e.getMessage());
                }
            }

            result.put("workflows", workflows);
            result.put("count", workflows.size());
            result.put("debug", debugLogs);
            log.info("Successfully fetched {} workflow details for case {}", workflows.size(), caseId);

        } catch (Exception e) {
            log.error("Error fetching workflows for case {}: {}", caseId, e.getMessage());
            result.put("workflows", workflows);
            result.put("count", 0);
            result.put("error", "Failed to fetch workflow information: " + e.getMessage());
            debugLogs.add("Exception: " + e.getMessage());
            result.put("debug", debugLogs);
        }

        return result;
    }
}

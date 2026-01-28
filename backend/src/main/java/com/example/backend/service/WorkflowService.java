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

        try {
            // First, fetch workflow IDs from dmi_package table
            String packageDql = "SELECT DISTINCT r_workflow_id FROM dmi_package WHERE r_component_id = '" + caseId + "'";

            String packageUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository() +
                              "/search?dql=" + java.net.URLEncoder.encode(packageDql, StandardCharsets.UTF_8) +
                              "&inline=true&items-per-page=100";

            log.info("Fetching workflow IDs for case {} with DQL: {}", caseId, packageDql);

            Map<String, Object> packageResponse = restClient.get()
                    .uri(packageUrl)
                    .header("Authorization", getAuthHeader())
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .retrieve()
                    .body(Map.class);

            // Extract workflow IDs
            List<String> workflowIds = new ArrayList<>();
            if (packageResponse != null && packageResponse.containsKey("entries")) {
                List<Map<String, Object>> entries = (List<Map<String, Object>>) packageResponse.get("entries");
                for (Map<String, Object> entry : entries) {
                    Map<String, Object> content = (Map<String, Object>) entry.get("content");
                    if (content != null && content.containsKey("properties")) {
                        Map<String, Object> props = (Map<String, Object>) content.get("properties");
                        String wfId = (String) props.get("r_workflow_id");
                        if (wfId != null && !workflowIds.contains(wfId)) {
                            workflowIds.add(wfId);
                        }
                    }
                }
            }

            log.info("Found {} unique workflow IDs for case {}", workflowIds.size(), caseId);

            // Now fetch details for each workflow
            for (String workflowId : workflowIds) {
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
                        workflows.add((Map<String, Object>) wfResponse.get("properties"));
                    }
                } catch (Exception e) {
                    log.warn("Error fetching workflow details for {}: {}", workflowId, e.getMessage());
                }
            }

            result.put("workflows", workflows);
            result.put("count", workflows.size());
            log.info("Successfully fetched {} workflow details for case {}", workflows.size(), caseId);

        } catch (Exception e) {
            log.error("Error fetching workflows for case {}: {}", caseId, e.getMessage());
            result.put("workflows", workflows);
            result.put("count", 0);
            result.put("error", "Failed to fetch workflow information: " + e.getMessage());
        }

        return result;
    }
}

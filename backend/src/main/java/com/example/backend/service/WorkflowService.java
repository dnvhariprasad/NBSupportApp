package com.example.backend.service;

import com.example.backend.config.DctmConfig;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

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
        // and r_runtime_state=1 (Running)
        // The 'processName' parameter should be the process template ID (e.g.,
        // 4b02cba08000624a)

        String filterQuery = "process_id='" + processName + "' AND r_runtime_state=1"; // 1=Running

        UriComponentsBuilder builder = UriComponentsBuilder.fromHttpUrl(url)
                .queryParam("filter", filterQuery)
                .queryParam("items-per-page", itemsPerPage)
                .queryParam("page", page)
                .queryParam("inline", "true"); // Get properties inline

        try {
            return restClient.get()
                    .uri(builder.toUriString())
                    .header("Authorization", getAuthHeader())
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .retrieve()
                    .body(Map.class);
        } catch (Exception e) {
            log.error("Error fetching workflows", e);
            throw new RuntimeException("Failed to fetch running workflows: " + e.getMessage());
        }
    }
}

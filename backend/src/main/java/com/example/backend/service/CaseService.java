package com.example.backend.service;

import com.example.backend.config.AppConfig;
import com.example.backend.config.DctmConfig;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@Slf4j
public class CaseService {

    private final DctmConfig dctmConfig;
    private final AppConfig appConfig;
    private final RestClient restClient;

    public CaseService(DctmConfig dctmConfig, AppConfig appConfig, RestClient.Builder restClientBuilder) {
        this.dctmConfig = dctmConfig;
        this.appConfig = appConfig;
        this.restClient = restClientBuilder.build();
    }

    private String getAuthHeader() {
        String username = dctmConfig.getUsername();
        String password = dctmConfig.getPassword();
        return "Basic " + Base64.getEncoder().encodeToString(
                (username + ":" + password).getBytes(StandardCharsets.UTF_8));
    }

    /**
     * Search cases (cms_case_folder) by case number or load recent cases.
     * If caseNumber is null/empty, loads cases from last 3 months.
     * First searches for matching objects, then fetches full details for each.
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> searchCases(String caseNumber, int page, int itemsPerPage) {

        // If no caseNumber provided, load last 3 months of cases
        if (caseNumber == null || caseNumber.isBlank()) {
            return loadRecentCases(page, itemsPerPage);
        }

        // Search for matching cases by case number
        String baseUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository() + "/search";

        StringBuilder urlBuilder = new StringBuilder(baseUrl);
        urlBuilder.append("?object-type=cms_case_folder");
        urlBuilder.append("&items-per-page=").append(itemsPerPage);
        urlBuilder.append("&page=").append(page);
        urlBuilder.append("&inline=true");
        urlBuilder.append("&sort=r_creation_date desc");
        urlBuilder.append("&q=").append(caseNumber.trim());

        String fullUrl = urlBuilder.toString();
        log.info("Searching cases with URL: {}", fullUrl);

        try {
            Map<String, Object> response = restClient.get()
                    .uri(fullUrl)
                    .header("Authorization", getAuthHeader())
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .retrieve()
                    .body(Map.class);

            return transformAndEnrichResponse(response);

        } catch (Exception e) {
            log.error("Error searching cases", e);
            throw new RuntimeException("Failed to search cases: " + e.getMessage());
        }
    }

    /**
     * Load cases from the last N months (configured in app.cases.default-load-months)
     */
    @SuppressWarnings("unchecked")
    private Map<String, Object> loadRecentCases(int page, int itemsPerPage) {
        // Get configured number of months from properties
        int months = appConfig.getCases().getDefaultLoadMonths();

        // Calculate date N months ago
        java.time.LocalDate startDate = java.time.LocalDate.now().minusMonths(months);
        String dateFilter = startDate.format(java.time.format.DateTimeFormatter.ISO_LOCAL_DATE);

        String baseUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository() + "/search";

        StringBuilder urlBuilder = new StringBuilder(baseUrl);
        urlBuilder.append("?object-type=cms_case_folder");
        urlBuilder.append("&items-per-page=").append(itemsPerPage);
        urlBuilder.append("&page=").append(page);
        urlBuilder.append("&inline=true");
        urlBuilder.append("&sort=r_creation_date desc");
        // Filter by creation date >= 3 months ago
        urlBuilder.append("&r_creation_date>=").append(dateFilter);

        String fullUrl = urlBuilder.toString();
        log.info("Loading recent cases (last {} months) with URL: {}", months, fullUrl);

        try {
            Map<String, Object> response = restClient.get()
                    .uri(fullUrl)
                    .header("Authorization", getAuthHeader())
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .retrieve()
                    .body(Map.class);

            return transformAndEnrichResponse(response);

        } catch (Exception e) {
            log.error("Error loading recent cases", e);
            // Return empty result on error
            Map<String, Object> emptyResult = new HashMap<>();
            emptyResult.put("cases", new ArrayList<>());
            emptyResult.put("hasNext", false);
            emptyResult.put("page", page);
            return emptyResult;
        }
    }

    /**
     * Fetch full object details including custom attributes
     */
    @SuppressWarnings("unchecked")
    private Map<String, Object> fetchObjectDetails(String objectId) {
        String url = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository()
                + "/objects/" + objectId + "?view=:all";

        try {
            Map<String, Object> response = restClient.get()
                    .uri(url)
                    .header("Authorization", getAuthHeader())
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .retrieve()
                    .body(Map.class);

            if (response != null) {
                return (Map<String, Object>) response.get("properties");
            }
        } catch (Exception e) {
            log.warn("Error fetching object details for {}: {}", objectId, e.getMessage());
        }
        return null;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> transformAndEnrichResponse(Map<String, Object> response) {
        Map<String, Object> result = new HashMap<>();

        if (response == null) {
            result.put("cases", new ArrayList<>());
            result.put("hasNext", false);
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

        // Transform entries and fetch full details
        List<Map<String, Object>> cases = new ArrayList<>();
        List<Map<String, Object>> entries = (List<Map<String, Object>>) response.get("entries");
        if (entries != null) {
            for (Map<String, Object> entry : entries) {
                Map<String, Object> content = (Map<String, Object>) entry.get("content");
                if (content != null) {
                    Map<String, Object> props = (Map<String, Object>) content.get("properties");
                    if (props != null) {
                        String objectId = (String) props.get("r_object_id");
                        String objectName = (String) props.get("object_name");

                        // Fetch full object details with custom attributes
                        Map<String, Object> fullProps = fetchObjectDetails(objectId);

                        Map<String, Object> caseItem = new HashMap<>();
                        caseItem.put("r_object_id", objectId);
                        caseItem.put("object_name", objectName);

                        if (fullProps != null) {
                            caseItem.put("subject", fullProps.get("subject"));
                            caseItem.put("ho_ro", fullProps.get("ho_ro"));
                            caseItem.put("description", fullProps.get("description"));
                            caseItem.put("department_name", fullProps.get("department_name"));
                            caseItem.put("functions", fullProps.get("functions"));
                            caseItem.put("r_creation_date", fullProps.get("r_creation_date"));
                        }

                        cases.add(caseItem);
                    }
                }
            }
        }
        result.put("cases", cases);

        return result;
    }
}

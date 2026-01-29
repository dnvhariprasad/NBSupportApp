package com.example.backend.service;

import com.example.backend.config.AppConfig;
import com.example.backend.config.DctmConfig;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
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
     * Search cases (cms_case_folder) by case number or load recent cases using DQL.
     * Uses a single DQL query to fetch all required fields, eliminating N+1 query problem.
     * If caseNumber is null/empty, loads cases from last N months (configured in properties).
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> searchCases(String caseNumber, int page, int itemsPerPage) {
        try {
            String dql;

            if (caseNumber == null || caseNumber.isBlank()) {
                // Build DQL for recent cases (last N months)
                int months = appConfig.getCases().getDefaultLoadMonths();
                LocalDate startDate = LocalDate.now().minusMonths(months);
                String dateStr = startDate.format(DateTimeFormatter.ISO_LOCAL_DATE);

                dql = String.format(
                    "SELECT r_object_id, object_name, subject, ho_ro, description, " +
                    "department_name, functions, r_creation_date " +
                    "FROM cms_case_folder " +
                    "WHERE r_creation_date >= DATE('%s', 'yyyy-mm-dd') " +
                    "ORDER BY r_creation_date DESC " +
                    "ENABLE(RETURN_TOP %d)",
                    dateStr,
                    page * itemsPerPage
                );

                log.info("Loading recent cases (last {} months) from {}", months, dateStr);
            } else {
                // Build DQL for search by case number
                // Escape single quotes for SQL injection protection
                String searchTerm = caseNumber.trim().replace("'", "''");

                dql = String.format(
                    "SELECT r_object_id, object_name, subject, ho_ro, description, " +
                    "department_name, functions, r_creation_date " +
                    "FROM cms_case_folder " +
                    "WHERE object_name LIKE '%%%s%%' " +
                    "ORDER BY r_creation_date DESC " +
                    "ENABLE(RETURN_TOP %d)",
                    searchTerm,
                    page * itemsPerPage
                );

                log.info("Searching cases for: {}", searchTerm);
            }

            return executeCaseDQL(dql, page, itemsPerPage);

        } catch (Exception e) {
            log.error("Error in searchCases", e);
            Map<String, Object> errorResult = new HashMap<>();
            errorResult.put("cases", new ArrayList<>());
            errorResult.put("hasNext", false);
            errorResult.put("page", page);
            errorResult.put("itemsPerPage", itemsPerPage);
            errorResult.put("error", "Failed to search cases: " + e.getMessage());
            return errorResult;
        }
    }

    /**
     * Execute a DQL query for cases and return paginated results.
     * Uses Documentum REST API with DQL parameter.
     */
    @SuppressWarnings("unchecked")
    private Map<String, Object> executeCaseDQL(String dql, int page, int itemsPerPage) {
        try {
            String baseUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository();

            log.debug("Executing DQL: {}", dql);

            // Use URI templates for proper encoding (RestClient handles encoding)
            Map<String, Object> response = restClient.get()
                    .uri(baseUrl + "?dql={dql}&items-per-page={itemsPerPage}&page={page}&inline=true",
                         dql, itemsPerPage, page)
                    .header("Authorization", getAuthHeader())
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .retrieve()
                    .body(Map.class);

            return transformDQLResponse(response, page, itemsPerPage);

        } catch (Exception e) {
            log.error("Error executing case DQL", e);
            throw new RuntimeException("Failed to execute DQL query: " + e.getMessage(), e);
        }
    }

    /**
     * Transform DQL response to the expected format.
     * Extracts cases from entries and preserves pagination metadata.
     */
    @SuppressWarnings("unchecked")
    private Map<String, Object> transformDQLResponse(Map<String, Object> response, int page, int itemsPerPage) {
        Map<String, Object> result = new HashMap<>();

        if (response == null) {
            result.put("cases", new ArrayList<>());
            result.put("hasNext", false);
            result.put("page", page);
            result.put("itemsPerPage", itemsPerPage);
            return result;
        }

        // Extract cases from entries
        List<Map<String, Object>> cases = new ArrayList<>();
        List<Map<String, Object>> entries = (List<Map<String, Object>>) response.get("entries");

        if (entries != null) {
            for (Map<String, Object> entry : entries) {
                Map<String, Object> content = (Map<String, Object>) entry.get("content");
                if (content != null) {
                    Map<String, Object> props = (Map<String, Object>) content.get("properties");
                    if (props != null) {
                        // All fields are already present in DQL result
                        // No need for additional API calls
                        cases.add(props);
                    }
                }
            }
        }

        result.put("cases", cases);
        result.put("page", page);
        result.put("itemsPerPage", itemsPerPage);

        // Check for next link to determine if there are more pages
        List<Map<String, Object>> links = (List<Map<String, Object>>) response.get("links");
        boolean hasNext = false;
        if (links != null) {
            hasNext = links.stream().anyMatch(link -> "next".equals(link.get("rel")));
        }
        result.put("hasNext", hasNext);

        log.info("Transformed {} cases for page {}, hasNext: {}", cases.size(), page, hasNext);

        return result;
    }
}

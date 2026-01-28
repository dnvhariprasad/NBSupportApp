package com.example.backend.service;

import com.example.backend.config.DctmConfig;
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

@Service
@Slf4j
public class QueryService {

    private final DctmConfig dctmConfig;
    private final RestClient restClient;

    public QueryService(DctmConfig dctmConfig, RestClient.Builder restClientBuilder) {
        this.dctmConfig = dctmConfig;
        this.restClient = restClientBuilder.build();
    }

    private String getAuthHeader() {
        String username = dctmConfig.getUsername();
        String password = dctmConfig.getPassword();
        return "Basic " + Base64.getEncoder().encodeToString(
                (username + ":" + password).getBytes(StandardCharsets.UTF_8));
    }

    /**
     * Execute a DQL query and return results.
     * Automatically adds r_object_id and r_object_type to the SELECT if not
     * present.
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> executeQuery(String dqlQuery) {
        if (dqlQuery == null || dqlQuery.isBlank()) {
            Map<String, Object> emptyResult = new HashMap<>();
            emptyResult.put("rows", new ArrayList<>());
            emptyResult.put("columns", new ArrayList<>());
            emptyResult.put("error", "Query cannot be empty");
            return emptyResult;
        }

        // Modify query to include r_object_id and r_object_type if not present
        String modifiedQuery = ensureRequiredColumns(dqlQuery.trim());

        // Build URL - fetch all results (max 1000 items)
        String baseUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository();

        log.info("Executing DQL query: {}", modifiedQuery);

        try {
            List<Map<String, Object>> allRows = new ArrayList<>();
            List<String> columns = new ArrayList<>();
            int page = 1;
            int itemsPerPage = 100; // Fetch in batches of 100
            boolean hasMore = true;

            while (hasMore && page <= 10) { // Max 10 pages = 1000 results
                Map<String, Object> response = restClient.get()
                        .uri(baseUrl + "?dql={dql}&items-per-page={itemsPerPage}&page={page}&inline=true",
                                modifiedQuery, itemsPerPage, page)
                        .header("Authorization", getAuthHeader())
                        .header("Accept", "application/vnd.emc.documentum+json")
                        .retrieve()
                        .body(Map.class);

                Map<String, Object> pageResult = transformPageResponse(response, columns);
                List<Map<String, Object>> pageRows = (List<Map<String, Object>>) pageResult.get("rows");
                allRows.addAll(pageRows);

                // Check if there's a next page
                List<Map<String, Object>> links = (List<Map<String, Object>>) response.get("links");
                hasMore = links != null && links.stream().anyMatch(link -> "next".equals(link.get("rel")));
                page++;
            }

            Map<String, Object> result = new HashMap<>();
            result.put("rows", allRows);
            result.put("columns", columns);
            result.put("totalCount", allRows.size());
            return result;

        } catch (Exception e) {
            log.error("Error executing DQL query", e);
            Map<String, Object> errorResult = new HashMap<>();
            errorResult.put("rows", new ArrayList<>());
            errorResult.put("columns", new ArrayList<>());
            errorResult.put("error", "Query failed: " + e.getMessage());
            return errorResult;
        }
    }

    /**
     * Ensures r_object_id and r_object_type are in the SELECT clause.
     * Skips modification for aggregate queries (count, sum, avg, etc.) and SELECT
     * *.
     */
    private String ensureRequiredColumns(String query) {
        String upperQuery = query.toUpperCase();

        // Check if it's a SELECT query
        if (!upperQuery.startsWith("SELECT")) {
            return query;
        }

        // Find the FROM keyword
        int fromIndex = upperQuery.indexOf(" FROM ");
        if (fromIndex == -1) {
            return query;
        }

        // Extract the SELECT columns part
        String selectPart = query.substring(7, fromIndex).trim(); // After "SELECT "
        String fromPart = query.substring(fromIndex);

        // Check if using SELECT * or aggregate functions
        if (selectPart.equals("*")) {
            return query; // * already includes all columns
        }

        String upperSelectPart = selectPart.toUpperCase();

        // Skip aggregate function queries - don't add columns to count, sum, avg, min,
        // max, etc.
        if (upperSelectPart.contains("COUNT(") || upperSelectPart.contains("SUM(") ||
                upperSelectPart.contains("AVG(") || upperSelectPart.contains("MIN(") ||
                upperSelectPart.contains("MAX(") || upperSelectPart.contains("DISTINCT ")) {
            return query;
        }

        // Add missing required columns
        List<String> columnsToAdd = new ArrayList<>();
        if (!upperSelectPart.contains("R_OBJECT_ID")) {
            columnsToAdd.add("r_object_id");
        }
        if (!upperSelectPart.contains("R_OBJECT_TYPE")) {
            columnsToAdd.add("r_object_type");
        }

        if (columnsToAdd.isEmpty()) {
            return query;
        }

        // Prepend missing columns
        String newSelectPart = String.join(", ", columnsToAdd) + ", " + selectPart;
        return "SELECT " + newSelectPart + fromPart;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> transformResponse(Map<String, Object> response) {
        Map<String, Object> result = new HashMap<>();

        if (response == null) {
            result.put("rows", new ArrayList<>());
            result.put("columns", new ArrayList<>());
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

        // Transform entries
        List<Map<String, Object>> rows = new ArrayList<>();
        List<String> columns = new ArrayList<>();
        boolean columnsExtracted = false;

        List<Map<String, Object>> entries = (List<Map<String, Object>>) response.get("entries");
        if (entries != null) {
            for (Map<String, Object> entry : entries) {
                Map<String, Object> content = (Map<String, Object>) entry.get("content");
                if (content != null) {
                    Map<String, Object> props = (Map<String, Object>) content.get("properties");
                    if (props != null) {
                        // Extract column names from first row
                        if (!columnsExtracted) {
                            columns.addAll(props.keySet());
                            columnsExtracted = true;
                        }

                        // Create ordered row data
                        Map<String, Object> row = new LinkedHashMap<>();
                        for (String col : columns) {
                            row.put(col, props.get(col));
                        }
                        rows.add(row);
                    }
                }
            }
        }

        result.put("rows", rows);
        result.put("columns", columns);

        return result;
    }
}

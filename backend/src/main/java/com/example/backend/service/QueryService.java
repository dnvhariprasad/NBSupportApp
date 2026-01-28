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
     * Automatically adds r_object_id and r_object_type to the SELECT if not present.
     * Uses DQL ENABLE(RETURN_TOP n) hint to limit results at database level.
     *
     * @param dqlQuery The DQL query to execute
     * @param limit Maximum number of results to return (uses DQL hint)
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> executeQuery(String dqlQuery, int limit) {
        if (dqlQuery == null || dqlQuery.isBlank()) {
            Map<String, Object> emptyResult = new HashMap<>();
            emptyResult.put("rows", new ArrayList<>());
            emptyResult.put("columns", new ArrayList<>());
            emptyResult.put("error", "Query cannot be empty");
            return emptyResult;
        }

        // Modify query to include r_object_id and r_object_type if not present
        String modifiedQuery = ensureRequiredColumns(dqlQuery.trim());

        // Add DQL ENABLE(RETURN_TOP n) hint to limit results at database level
        modifiedQuery = addReturnTopHint(modifiedQuery, limit);

        // Build URL
        String baseUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository();

        log.info("Executing DQL query with limit {}: {}", limit, modifiedQuery);

        try {
            List<Map<String, Object>> allRows = new ArrayList<>();
            List<String> columns = new ArrayList<>();
            int page = 1;
            int itemsPerPage = Math.min(100, limit); // Fetch in batches
            boolean hasMore = true;
            int maxPages = (int) Math.ceil((double) limit / itemsPerPage);

            while (hasMore && page <= maxPages && allRows.size() < limit) {
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

            // Ensure we don't exceed the limit
            if (allRows.size() > limit) {
                allRows = allRows.subList(0, limit);
            }

            Map<String, Object> result = new HashMap<>();
            result.put("rows", allRows);
            result.put("columns", columns);
            result.put("totalCount", allRows.size());
            result.put("limit", limit);
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
     * Legacy method for backward compatibility
     */
    public Map<String, Object> executeQuery(String dqlQuery) {
        return executeQuery(dqlQuery, 10000); // Default limit
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

        // Only add r_object_id if not present (all persistent objects have this)
        // Don't add r_object_type as not all object types have it (e.g., dm_user, dm_group)
        if (!upperSelectPart.contains("R_OBJECT_ID")) {
            String newSelectPart = "r_object_id, " + selectPart;
            return "SELECT " + newSelectPart + fromPart;
        }

        return query;
    }

    /**
     * Add DQL ENABLE(RETURN_TOP n) hint to limit results at database level.
     * The hint is appended at the end of the query, e.g.:
     * SELECT * FROM dm_document ENABLE(RETURN_TOP 100)
     *
     * @param query The DQL query
     * @param limit The maximum number of rows to return
     * @return Query with RETURN_TOP hint
     */
    private String addReturnTopHint(String query, int limit) {
        String trimmedQuery = query.trim();
        String upperQuery = trimmedQuery.toUpperCase();

        // Check if query already has ENABLE hints
        if (upperQuery.contains("ENABLE(RETURN_TOP")) {
            return query; // Don't add if already present
        }

        // Check if it's a SELECT query
        if (!upperQuery.startsWith("SELECT")) {
            return query; // Not a SELECT query
        }

        // Append ENABLE(RETURN_TOP n) at the end of the query
        return trimmedQuery + " ENABLE(RETURN_TOP " + limit + ")";
    }

    /**
     * Transform a single page response and populate columns if empty.
     */
    @SuppressWarnings("unchecked")
    private Map<String, Object> transformPageResponse(Map<String, Object> response, List<String> columns) {
        Map<String, Object> result = new HashMap<>();

        if (response == null) {
            result.put("rows", new ArrayList<>());
            return result;
        }

        // Transform entries
        List<Map<String, Object>> rows = new ArrayList<>();

        List<Map<String, Object>> entries = (List<Map<String, Object>>) response.get("entries");
        if (entries != null) {
            for (Map<String, Object> entry : entries) {
                Map<String, Object> content = (Map<String, Object>) entry.get("content");
                if (content != null) {
                    Map<String, Object> props = (Map<String, Object>) content.get("properties");
                    if (props != null) {
                        // Extract column names from first row (if not already done)
                        if (columns.isEmpty()) {
                            columns.addAll(props.keySet());
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
        return result;
    }
}

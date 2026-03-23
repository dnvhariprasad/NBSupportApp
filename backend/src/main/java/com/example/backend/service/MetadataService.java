package com.example.backend.service;

import com.example.backend.config.DctmConfig;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.nio.charset.StandardCharsets;
import java.util.*;

@Service
@Slf4j
public class MetadataService {

    private final DctmConfig dctmConfig;
    private final RestClient restClient;

    public MetadataService(DctmConfig dctmConfig, RestClient.Builder restClientBuilder) {
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
     * Creates a cms_file_number object under /ECM CONFIG/File Number.
     * Fetches the parent folder's acl_name and applies it to the new object.
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> createFileNumber(Map<String, Object> request) {
        String repoUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository();

        // Step 1 — resolve /ECM CONFIG/File Number: get r_object_id, acl_name AND acl_domain
        String folderDql = "SELECT r_object_id, acl_name, acl_domain FROM dm_folder"
                + " WHERE ANY r_folder_path = '/ECM CONFIG/File Number'";
        log.info("[FileNumber] Resolving folder /ECM CONFIG/File Number");
        Map<String, String> folderInfo = resolveFolderInfo(repoUrl, folderDql, "/ECM CONFIG/File Number");
        String folderId   = folderInfo.get("r_object_id");
        String aclName    = folderInfo.get("acl_name");
        String aclDomain  = folderInfo.get("acl_domain");
        log.info("[FileNumber] folder={} acl={} aclDomain={}", folderId, aclName, aclDomain);

        // Step 2 — build properties
        Map<String, Object> props = new LinkedHashMap<>();
        props.put("r_object_type",  "cms_file_number");
        props.put("object_name",    request.get("object_name"));
        props.put("ho_ro",          request.get("ho_ro"));
        props.put("dept_short_code",request.get("dept_short_code"));
        String roShortCode = (String) request.getOrDefault("ro_short_code", "");
        props.put("ro_short_code",  roShortCode != null ? roShortCode : "");
        Object desc = request.get("description");
        if (desc != null) props.put("description", desc);
        if (aclName  != null && !aclName.isBlank())  props.put("acl_name",   aclName);
        if (aclDomain != null && !aclDomain.isBlank()) props.put("acl_domain", aclDomain);

        // Step 3 — POST to /folders/{folderId}/objects
        String createUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository()
                + "/folders/" + folderId + "/objects";
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("properties", props);

        log.info("[FileNumber] Creating '{}' ho_ro='{}' dept='{}' ro='{}'",
                request.get("object_name"), request.get("ho_ro"),
                request.get("dept_short_code"), roShortCode);
        try {
            Map<String, Object> response = restClient.post()
                    .uri(createUrl)
                    .header("Authorization", getAuthHeader())
                    .header("Content-Type", "application/vnd.emc.documentum+json;charset=UTF-8")
                    .header("Accept",       "application/vnd.emc.documentum+json")
                    .body(body)
                    .retrieve()
                    .body(Map.class);
            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("message", "File number '" + request.get("object_name") + "' created successfully");
            if (response != null) result.put("data", response);
            return result;
        } catch (RestClientResponseException e) {
            String rb = e.getResponseBodyAsString(StandardCharsets.UTF_8);
            log.error("[FileNumber] Failed [{}]: {}", e.getStatusCode(), rb);
            throw new RuntimeException("File number creation failed [" + e.getStatusCode() + "]: " + rb);
        }
    }

    /**
     * Deletes a cms_file_number object by its r_object_id.
     * DELETE /repositories/{repo}/objects/{objectId}
     */
    public Map<String, Object> deleteFileNumber(String objectId) {
        String url = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository()
                + "/objects/" + objectId;
        log.info("[FileNumber] Deleting object '{}'", objectId);
        try {
            restClient.delete()
                    .uri(url)
                    .header("Authorization", getAuthHeader())
                    .retrieve()
                    .toBodilessEntity();
            log.info("[FileNumber] Deleted '{}'", objectId);
            return Map.of("success", true, "message", "File number deleted successfully");
        } catch (RestClientResponseException e) {
            String rb = e.getResponseBodyAsString(StandardCharsets.UTF_8);
            log.error("[FileNumber] Delete failed [{}]: {}", e.getStatusCode(), rb);
            throw new RuntimeException("File number deletion failed [" + e.getStatusCode() + "]: " + rb);
        }
    }

    /**
     * Lists existing cms_file_number objects filtered by ho_ro, dept_short_code,
     * and optionally ro_short_code (for RO/TE).
     *
     * GET /api/metadata/file-numbers?hoRo=HO&deptShortCode=fsdd
     * GET /api/metadata/file-numbers?hoRo=RO&deptShortCode=bid&roShortCode=jk
     */
    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> listFileNumbers(String hoRo, String deptShortCode, String roShortCode) {
        String safe_hoRo = hoRo.replace("'", "''");
        String safe_dept = deptShortCode.replace("'", "''");

        StringBuilder dql = new StringBuilder(
                "SELECT r_object_id, object_name, description, ho_ro, dept_short_code, ro_short_code"
                + " FROM cms_file_number"
                + " WHERE ho_ro = '" + safe_hoRo + "'"
                + " AND dept_short_code = '" + safe_dept + "'");
        if (roShortCode != null && !roShortCode.isBlank()) {
            dql.append(" AND ro_short_code = '").append(roShortCode.replace("'", "''")).append("'");
        }
        dql.append(" ORDER BY object_name");

        String baseUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository();
        final int PAGE_SIZE = 100;
        List<Map<String, Object>> allResults = new ArrayList<>();
        int page = 1;

        log.info("[FileNumber] Listing all pages: {}", dql);
        try {
            while (true) {
                Map<String, Object> resp = restClient.get()
                        .uri(baseUrl + "?dql={dql}&items-per-page={size}&page={page}&inline=true",
                                dql.toString(), PAGE_SIZE, page)
                        .header("Authorization", getAuthHeader())
                        .header("Accept", "application/vnd.emc.documentum+json")
                        .retrieve()
                        .body(Map.class);

                if (resp == null) break;

                List<Map<String, Object>> entries = (List<Map<String, Object>>) resp.get("entries");
                if (entries != null) {
                    for (Map<String, Object> entry : entries) {
                        Map<String, Object> content = (Map<String, Object>) entry.get("content");
                        if (content != null) {
                            Map<String, Object> p = (Map<String, Object>) content.get("properties");
                            if (p != null) allResults.add(p);
                        }
                    }
                }

                // Check for a "next" link — stop if there are no more pages
                List<Map<String, Object>> links = (List<Map<String, Object>>) resp.get("links");
                boolean hasNext = links != null && links.stream()
                        .anyMatch(l -> "next".equals(l.get("rel")));
                if (!hasNext) break;
                page++;
            }
        } catch (RestClientResponseException e) {
            String rb = e.getResponseBodyAsString(StandardCharsets.UTF_8);
            log.error("[FileNumber] List failed [{}]: {}", e.getStatusCode(), rb);
            throw new RuntimeException("File number list failed [" + e.getStatusCode() + "]: " + rb);
        }

        log.info("[FileNumber] Total fetched: {}", allResults.size());
        return allResults;
    }

    /** Resolves a folder by DQL, returning its r_object_id and acl_name. */
    @SuppressWarnings("unchecked")
    private Map<String, String> resolveFolderInfo(String repoUrl, String dql, String label) {
        try {
            Map<String, Object> resp = restClient.get()
                    .uri(repoUrl + "?dql={dql}&items-per-page=1&inline=true", dql)
                    .header("Authorization", getAuthHeader())
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .retrieve()
                    .body(Map.class);
            if (resp != null) {
                List<Map<String, Object>> entries = (List<Map<String, Object>>) resp.get("entries");
                if (entries != null && !entries.isEmpty()) {
                    Map<String, Object> content = (Map<String, Object>) entries.get(0).get("content");
                    if (content != null) {
                        Map<String, Object> p = (Map<String, Object>) content.get("properties");
                        if (p != null && p.get("r_object_id") != null) {
                            Map<String, String> info = new HashMap<>();
                            info.put("r_object_id", (String) p.get("r_object_id"));
                            info.put("acl_name",    p.get("acl_name")   != null ? (String) p.get("acl_name")   : "");
                            info.put("acl_domain",  p.get("acl_domain") != null ? (String) p.get("acl_domain") : "");
                            return info;
                        }
                    }
                }
            }
        } catch (RestClientResponseException e) {
            String rb = e.getResponseBodyAsString(StandardCharsets.UTF_8);
            throw new RuntimeException("Could not resolve " + label + " [" + e.getStatusCode() + "]: " + rb);
        }
        throw new RuntimeException("Could not find folder '" + label + "' — check the path exists in Documentum");
    }
}

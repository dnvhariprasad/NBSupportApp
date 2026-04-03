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
public class DepartmentService {

    private final DctmConfig dctmConfig;
    private final RestClient restClient;

    public DepartmentService(DctmConfig dctmConfig, RestClient.Builder restClientBuilder) {
        this.dctmConfig = dctmConfig;
        this.restClient = restClientBuilder.build();
    }

    private String getAuthHeader() {
        return "Basic " + Base64.getEncoder().encodeToString(
                (dctmConfig.getUsername() + ":" + dctmConfig.getPassword())
                        .getBytes(StandardCharsets.UTF_8));
    }

    /**
     * Lists departments (child dm_folder objects) under a given office type path.
     * HO:    /ECM CONFIG/Office Type/HO
     * RO/TE: /ECM CONFIG/Office Type/{officeType}/{location}
     *
     * Each folder's object_name = department name, title = short code.
     */
    @SuppressWarnings("unchecked")
    public List<Map<String, String>> listDepartments(String officeType, String location) {
        String path;
        if ("HO".equalsIgnoreCase(officeType)) {
            path = "/ECM CONFIG/Office Type/HO";
        } else {
            if (location == null || location.isBlank()) {
                throw new IllegalArgumentException("Location is required for " + officeType);
            }
            path = "/ECM CONFIG/Office Type/" + officeType.toUpperCase() + "/" + location;
        }

        String safePath = path.replace("'", "''");
        String dql = "SELECT object_name, title FROM dm_folder"
                + " WHERE FOLDER('" + safePath + "')"
                + " ORDER BY object_name";

        String repoUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository();
        List<Map<String, String>> departments = new ArrayList<>();
        int page = 1;
        final int PAGE_SIZE = 100;

        log.info("[Dept] Listing departments under '{}'", path);
        try {
            while (true) {
                Map<String, Object> resp = restClient.get()
                        .uri(repoUrl + "?dql={dql}&items-per-page={size}&page={page}&inline=true",
                                dql, PAGE_SIZE, page)
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
                            if (p != null) {
                                String name = (String) p.get("object_name");
                                String shortCode = (String) p.get("title");
                                if (name != null) {
                                    Map<String, String> dept = new LinkedHashMap<>();
                                    dept.put("name", name);
                                    dept.put("shortCode", shortCode != null ? shortCode : name.toLowerCase());
                                    departments.add(dept);
                                }
                            }
                        }
                    }
                }

                List<Map<String, Object>> links = (List<Map<String, Object>>) resp.get("links");
                boolean hasNext = links != null && links.stream()
                        .anyMatch(l -> "next".equals(l.get("rel")));
                if (!hasNext) break;
                page++;
            }
        } catch (RestClientResponseException e) {
            String rb = e.getResponseBodyAsString(StandardCharsets.UTF_8);
            log.error("[Dept] List failed [{}]: {}", e.getStatusCode(), rb);
            throw new RuntimeException("Department list failed [" + e.getStatusCode() + "]: " + rb);
        }

        log.info("[Dept] Found {} departments under '{}'", departments.size(), path);
        return departments;
    }

    /**
     * Orchestrates department creation in Documentum.
     * Creates dm_folder, dm_group(s), and cms_digidak_metadata objects
     * based on the selected office type.
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> createDepartment(Map<String, Object> request) {
        String officeType = ((String) request.get("officeType")).toUpperCase();
        String deptName = ((String) request.get("departmentName")).toUpperCase();
        String shortCode = ((String) request.get("departmentShortCode")).toLowerCase();
        String dmdSelection = (String) request.get("dmdSelection"); // DMDS1 or DMDS2 or null
        String locationShortCode = (String) request.get("locationShortCode");
        String locationName = (String) request.get("locationName");

        List<Map<String, Object>> steps = new ArrayList<>();

        if ("HO".equals(officeType)) {
            createHoDepartment(deptName, shortCode, dmdSelection, steps);
        } else {
            createRoTeDepartment(officeType, deptName, shortCode, locationShortCode, locationName, steps);
        }

        // Build summary
        long succeeded = steps.stream().filter(s -> Boolean.TRUE.equals(s.get("success"))).count();
        long failed = steps.stream().filter(s -> Boolean.FALSE.equals(s.get("success"))).count();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("success", failed == 0);
        result.put("message", failed == 0
                ? "Department '" + deptName + "' created successfully (" + succeeded + " steps completed)"
                : succeeded + " of " + steps.size() + " steps completed, " + failed + " failed");
        result.put("steps", steps);
        return result;
    }

    // ─── HO Department ──────────────────────────────────────────────────────────

    private void createHoDepartment(String deptName, String shortCode, String dmdSelection,
                                     List<Map<String, Object>> steps) {
        // Step 1: Create dm_folder under /ECM CONFIG/Office Type/HO
        steps.add(createFolder(deptName, shortCode,
                "ecm_ho_" + shortCode,
                "/ECM CONFIG/Office Type/HO",
                "dm_folder under /ECM CONFIG/Office Type/HO"));

        // Step 2: Create dm_group ecm_ho_<shortCode>
        steps.add(createGroup(
                "ecm_ho_" + shortCode,
                "ECM-HO-" + deptName,
                "Main department group"));

        // Step 3: Create dm_group ecm_ho_<shortCode>_cgm_sec
        steps.add(createGroup(
                "ecm_ho_" + shortCode + "_cgm_sec",
                "ECM HO " + deptName + " CGM SEC",
                "CGM SEC group"));

        // Step 4: Create dm_group ecm_<shortCode>_alternate_cgm
        steps.add(createGroup(
                "ecm_" + shortCode + "_alternate_cgm",
                deptName + " ALTERNATE CGM",
                "Alternate CGM group"));

        // Step 5: Create dm_group ecm_digidak_ho_<shortCode>_cgm
        steps.add(createGroup(
                "ecm_digidak_ho_" + shortCode + "_cgm",
                "ECM DIGIDAK HO " + deptName + " CGM",
                "Digidak CGM group"));

        // Step 6: Create dm_group ecm_digidak_ho_<shortCode>_cgm_ps
        steps.add(createGroup(
                "ecm_digidak_ho_" + shortCode + "_cgm_ps",
                "ECM DIGIDAK HO " + deptName + " CGM PS",
                "Digidak CGM PS group"));

        // Step 7: Create cms_digidak_metadata (input=deptName, result=cgm group, cgm_ps=cgm_ps group)
        steps.add(createDigidakMetadataWithCgmPs(
                deptName,
                "ecm_digidak_ho_" + shortCode + "_cgm",
                "ecm_digidak_ho_" + shortCode + "_cgm_ps",
                "/Digidak Config/Metadata",
                "Digidak metadata (department CGM mapping)"));

        // Step 8: Create cms_digidak_metadata (input=HO, result=<deptName> -B)
        steps.add(createDigidakMetadata(
                "HO",
                deptName + " -B",
                "/Digidak Config/Metadata",
                "Digidak metadata (HO branch mapping)"));

        // Step 9: Conditional DMD metadata
        if ("DMDS1".equalsIgnoreCase(dmdSelection)) {
            steps.add(createDigidakMetadata(
                    "DMDS1HO",
                    deptName,
                    "/Digidak Config/Metadata",
                    "Digidak metadata (DMDS1HO mapping)"));
        } else if ("DMDS2".equalsIgnoreCase(dmdSelection)) {
            steps.add(createDigidakMetadata(
                    "DMDS2HO",
                    deptName,
                    "/Digidak Config/Metadata",
                    "Digidak metadata (DMDS2HO mapping)"));
        }
    }

    // ─── RO/TE Department ───────────────────────────────────────────────────────

    private void createRoTeDepartment(String officeType, String deptName, String shortCode,
                                       String locationShortCode, String locationName,
                                       List<Map<String, Object>> steps) {
        String locCode = locationShortCode.toLowerCase();
        String folderPath = "/ECM CONFIG/Office Type/" + officeType + "/" + locationName;

        // Step 1: Create dm_folder under /ECM CONFIG/Office Type/<RO|TE>/<location>
        steps.add(createFolder(deptName, shortCode,
                "ecm_" + locCode + "_" + shortCode,
                folderPath,
                "dm_folder under " + folderPath));

        // Step 2: Create dm_group ecm_<locCode>_<shortCode>
        steps.add(createGroup(
                "ecm_" + locCode + "_" + shortCode,
                "ECM-" + locCode.toUpperCase() + "-" + deptName,
                "Location department group"));
    }

    // ─── Primitives ─────────────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private Map<String, Object> createFolder(String objectName, String title, String subject,
                                              String parentPath, String stepLabel) {
        try {
            String repoUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository();
            String safe = parentPath.replace("'", "''");
            String dql = "SELECT r_object_id FROM dm_folder WHERE ANY r_folder_path = '" + safe + "'";

            log.info("[Dept] Resolving folder: {}", parentPath);
            Map<String, Object> dqlResp = restClient.get()
                    .uri(repoUrl + "?dql={dql}&items-per-page=1&page=1&inline=true", dql)
                    .header("Authorization", getAuthHeader())
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .retrieve()
                    .body(Map.class);

            List<Map<String, Object>> entries = dqlResp != null
                    ? (List<Map<String, Object>>) dqlResp.get("entries") : null;
            if (entries == null || entries.isEmpty()) {
                throw new RuntimeException("Parent folder not found: " + parentPath);
            }
            Map<String, Object> content = (Map<String, Object>) entries.get(0).get("content");
            Map<String, Object> props = (Map<String, Object>) content.get("properties");
            String parentId = (String) props.get("r_object_id");

            // Create folder
            String folderUrl = repoUrl + "/folders/" + parentId + "/folders";
            Map<String, Object> folderProps = new LinkedHashMap<>();
            folderProps.put("object_name", objectName);
            folderProps.put("title", title);
            folderProps.put("subject", subject);

            log.info("[Dept] Creating folder '{}' (title='{}', subject='{}') under {}", objectName, title, subject, parentId);
            restClient.post()
                    .uri(folderUrl)
                    .header("Authorization", getAuthHeader())
                    .header("Content-Type", "application/vnd.emc.documentum+json")
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .body(Map.of("properties", folderProps))
                    .retrieve()
                    .toBodilessEntity();

            log.info("[Dept] Folder '{}' created successfully", objectName);
            return Map.of("success", true, "step", stepLabel, "message", "Folder '" + objectName + "' created");
        } catch (RestClientResponseException e) {
            String rb = e.getResponseBodyAsString(StandardCharsets.UTF_8);
            log.error("[Dept] Folder creation failed [{}]: {}", e.getStatusCode(), rb);
            return Map.of("success", false, "step", stepLabel, "error", rb);
        } catch (Exception e) {
            log.error("[Dept] Folder creation failed: {}", e.getMessage());
            return Map.of("success", false, "step", stepLabel, "error", e.getMessage());
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> createGroup(String groupName, String displayName, String stepLabel) {
        try {
            String url = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository() + "/groups";

            Map<String, Object> props = new LinkedHashMap<>();
            props.put("group_name", groupName);
            props.put("group_class", "group");
            props.put("group_display_name", displayName);

            log.info("[Dept] Creating group '{}' (display='{}')", groupName, displayName);
            restClient.post()
                    .uri(url)
                    .header("Authorization", getAuthHeader())
                    .header("Content-Type", "application/vnd.emc.documentum+json")
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .body(Map.of("properties", props))
                    .retrieve()
                    .body(Map.class);

            log.info("[Dept] Group '{}' created successfully", groupName);
            return Map.of("success", true, "step", stepLabel, "message", "Group '" + groupName + "' created");
        } catch (RestClientResponseException e) {
            String rb = e.getResponseBodyAsString(StandardCharsets.UTF_8);
            log.error("[Dept] Group creation failed [{}]: {}", e.getStatusCode(), rb);
            return Map.of("success", false, "step", stepLabel, "error", rb);
        } catch (Exception e) {
            log.error("[Dept] Group creation failed: {}", e.getMessage());
            return Map.of("success", false, "step", stepLabel, "error", e.getMessage());
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> createDigidakMetadata(String input, String results,
                                                       String folderPath, String stepLabel) {
        try {
            String repoUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository();
            String safePath = folderPath.replace("'", "''");
            String folderDql = "SELECT r_object_id, acl_name, acl_domain FROM dm_folder"
                    + " WHERE ANY r_folder_path = '" + safePath + "'";

            Map<String, String> folderInfo = resolveFolderInfo(repoUrl, folderDql, folderPath);
            String folderId = folderInfo.get("r_object_id");
            String aclName = folderInfo.get("acl_name");
            String aclDomain = folderInfo.get("acl_domain");

            Map<String, Object> props = new LinkedHashMap<>();
            props.put("r_object_type", "cms_digidak_metadata");
            props.put("object_name", results);
            props.put("input", input);
            props.put("results", results);
            if (aclName != null && !aclName.isBlank()) props.put("acl_name", aclName);
            if (aclDomain != null && !aclDomain.isBlank()) props.put("acl_domain", aclDomain);

            String createUrl = repoUrl + "/folders/" + folderId + "/objects";
            log.info("[Dept] Creating digidak metadata input='{}' results='{}'", input, results);
            restClient.post()
                    .uri(createUrl)
                    .header("Authorization", getAuthHeader())
                    .header("Content-Type", "application/vnd.emc.documentum+json;charset=UTF-8")
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .body(Map.of("properties", props))
                    .retrieve()
                    .body(Map.class);

            log.info("[Dept] Digidak metadata created: input='{}' results='{}'", input, results);
            return Map.of("success", true, "step", stepLabel, "message", "Metadata (input='" + input + "') created");
        } catch (RestClientResponseException e) {
            String rb = e.getResponseBodyAsString(StandardCharsets.UTF_8);
            log.error("[Dept] Digidak metadata creation failed [{}]: {}", e.getStatusCode(), rb);
            return Map.of("success", false, "step", stepLabel, "error", rb);
        } catch (Exception e) {
            log.error("[Dept] Digidak metadata creation failed: {}", e.getMessage());
            return Map.of("success", false, "step", stepLabel, "error", e.getMessage());
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> createDigidakMetadataWithCgmPs(String input, String results,
                                                                String cgmPs, String folderPath,
                                                                String stepLabel) {
        try {
            String repoUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository();
            String safePath = folderPath.replace("'", "''");
            String folderDql = "SELECT r_object_id, acl_name, acl_domain FROM dm_folder"
                    + " WHERE ANY r_folder_path = '" + safePath + "'";

            Map<String, String> folderInfo = resolveFolderInfo(repoUrl, folderDql, folderPath);
            String folderId = folderInfo.get("r_object_id");
            String aclName = folderInfo.get("acl_name");
            String aclDomain = folderInfo.get("acl_domain");

            Map<String, Object> props = new LinkedHashMap<>();
            props.put("r_object_type", "cms_digidak_metadata");
            props.put("object_name", results);
            props.put("input", input);
            props.put("results", results);
            props.put("cgm_ps", cgmPs);
            if (aclName != null && !aclName.isBlank()) props.put("acl_name", aclName);
            if (aclDomain != null && !aclDomain.isBlank()) props.put("acl_domain", aclDomain);

            String createUrl = repoUrl + "/folders/" + folderId + "/objects";
            log.info("[Dept] Creating digidak metadata input='{}' results='{}' cgm_ps='{}'", input, results, cgmPs);
            restClient.post()
                    .uri(createUrl)
                    .header("Authorization", getAuthHeader())
                    .header("Content-Type", "application/vnd.emc.documentum+json;charset=UTF-8")
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .body(Map.of("properties", props))
                    .retrieve()
                    .body(Map.class);

            log.info("[Dept] Digidak metadata with cgm_ps created: input='{}'", input);
            return Map.of("success", true, "step", stepLabel, "message", "Metadata (input='" + input + "') created with cgm_ps");
        } catch (RestClientResponseException e) {
            String rb = e.getResponseBodyAsString(StandardCharsets.UTF_8);
            log.error("[Dept] Digidak metadata creation failed [{}]: {}", e.getStatusCode(), rb);
            return Map.of("success", false, "step", stepLabel, "error", rb);
        } catch (Exception e) {
            log.error("[Dept] Digidak metadata creation failed: {}", e.getMessage());
            return Map.of("success", false, "step", stepLabel, "error", e.getMessage());
        }
    }

    /** Resolves a folder by DQL, returning r_object_id, acl_name, and acl_domain. */
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
                            info.put("acl_name", p.get("acl_name") != null ? (String) p.get("acl_name") : "");
                            info.put("acl_domain", p.get("acl_domain") != null ? (String) p.get("acl_domain") : "");
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

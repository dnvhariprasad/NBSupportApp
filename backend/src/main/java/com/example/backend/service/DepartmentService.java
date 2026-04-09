package com.example.backend.service;

import com.example.backend.config.DctmConfig;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.nio.charset.StandardCharsets;
import java.util.*;

// ─── Resource Tracking for Transactional Rollback ───────────────────
record CreatedResource(ResourceType type, String id, String label) {}
enum ResourceType { FOLDER, GROUP, METADATA }

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
     * Orchestrates department creation in Documentum with transactional rollback.
     * Creates dm_folder, dm_group(s), and cms_digidak_metadata objects.
     * If any step fails, all successfully created resources are rolled back.
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> createDepartment(Map<String, Object> request) {
        String officeType = ((String) request.get("officeType")).toUpperCase();
        String deptName = ((String) request.get("departmentName")).toUpperCase();
        String shortCode = ((String) request.get("departmentShortCode")).toLowerCase();
        String dmdSelection = (String) request.get("dmdSelection"); // DMDS1 or DMDS2 or null
        String locationShortCode = (String) request.get("locationShortCode");
        String locationName = (String) request.get("locationName");

        List<CreatedResource> created = new ArrayList<>();
        List<Map<String, Object>> steps = new ArrayList<>();

        try {
            if ("HO".equals(officeType)) {
                createHoDepartment(deptName, shortCode, dmdSelection, steps, created);
            } else {
                createRoTeDepartment(officeType, deptName, shortCode, locationShortCode, locationName, steps, created);
            }

            // All steps succeeded
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("success", true);
            result.put("message", "Department '" + deptName + "' created successfully (" + steps.size() + " steps completed)");
            result.put("steps", steps);
            return result;

        } catch (Exception e) {
            log.warn("[Dept] Department creation failed at step, rolling back {} resources: {}", created.size(), e.getMessage());
            rollback(created, steps);

            // Determine user-friendly error message based on what failed
            String userMessage = buildErrorMessage(deptName, e.getMessage(), steps);

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("success", false);
            result.put("message", userMessage);
            result.put("failedStep", e.getMessage());
            result.put("steps", steps);
            return result;
        }
    }

    // ─── HO Department ──────────────────────────────────────────────────────────

    private void createHoDepartment(String deptName, String shortCode, String dmdSelection,
                                     List<Map<String, Object>> steps, List<CreatedResource> created) {
        // Step 1: Create dm_folder under /ECM CONFIG/Office Type/HO
        String folderId = createFolder(deptName, shortCode,
                "ecm_ho_" + shortCode,
                "/ECM CONFIG/Office Type/HO",
                "dm_folder under /ECM CONFIG/Office Type/HO");
        created.add(new CreatedResource(ResourceType.FOLDER, folderId, "Folder: " + deptName));
        steps.add(Map.of("success", true, "step", "dm_folder under /ECM CONFIG/Office Type/HO", "message", "Folder '" + deptName + "' created"));

        // Step 2: Create dm_group ecm_ho_<shortCode>
        String group1 = createGroup("ecm_ho_" + shortCode, "ECM-HO-" + deptName, "Main department group");
        created.add(new CreatedResource(ResourceType.GROUP, group1, "Group: " + group1));
        steps.add(Map.of("success", true, "step", "Main department group", "message", "Group '" + group1 + "' created"));

        // Step 3: Create dm_group ecm_ho_<shortCode>_cgm_sec
        String group2 = createGroup("ecm_ho_" + shortCode + "_cgm_sec", "ECM HO " + deptName + " CGM SEC", "CGM SEC group");
        created.add(new CreatedResource(ResourceType.GROUP, group2, "Group: " + group2));
        steps.add(Map.of("success", true, "step", "CGM SEC group", "message", "Group '" + group2 + "' created"));

        // Step 4: Create dm_group ecm_<shortCode>_alternate_cgm
        String group3 = createGroup("ecm_" + shortCode + "_alternate_cgm", deptName + " ALTERNATE CGM", "Alternate CGM group");
        created.add(new CreatedResource(ResourceType.GROUP, group3, "Group: " + group3));
        steps.add(Map.of("success", true, "step", "Alternate CGM group", "message", "Group '" + group3 + "' created"));

        // Step 5: Create dm_group ecm_digidak_ho_<shortCode>_cgm
        String group4 = createGroup("ecm_digidak_ho_" + shortCode + "_cgm", "ECM DIGIDAK HO " + deptName + " CGM", "Digidak CGM group");
        created.add(new CreatedResource(ResourceType.GROUP, group4, "Group: " + group4));
        steps.add(Map.of("success", true, "step", "Digidak CGM group", "message", "Group '" + group4 + "' created"));

        // Step 6: Create dm_group ecm_digidak_ho_<shortCode>_cgm_ps
        String group5 = createGroup("ecm_digidak_ho_" + shortCode + "_cgm_ps", "ECM DIGIDAK HO " + deptName + " CGM PS", "Digidak CGM PS group");
        created.add(new CreatedResource(ResourceType.GROUP, group5, "Group: " + group5));
        steps.add(Map.of("success", true, "step", "Digidak CGM PS group", "message", "Group '" + group5 + "' created"));

        // Step 7: Create cms_digidak_metadata (input=deptName, result=cgm group, cgm_ps=cgm_ps group)
        String meta1 = createDigidakMetadataWithCgmPs(deptName, "ecm_digidak_ho_" + shortCode + "_cgm",
                "ecm_digidak_ho_" + shortCode + "_cgm_ps", "/Digidak Config/Metadata",
                "Digidak metadata (department CGM mapping)");
        created.add(new CreatedResource(ResourceType.METADATA, meta1, "Metadata: " + deptName));
        steps.add(Map.of("success", true, "step", "Digidak metadata (department CGM mapping)", "message", "Metadata (input='" + deptName + "') created"));

        // Step 8: Create cms_digidak_metadata (input=HO, result=<deptName> -B)
        String meta2 = createDigidakMetadata("HO", deptName + " -B", "/Digidak Config/Metadata",
                "Digidak metadata (HO branch mapping)");
        created.add(new CreatedResource(ResourceType.METADATA, meta2, "Metadata: " + deptName + " -B"));
        steps.add(Map.of("success", true, "step", "Digidak metadata (HO branch mapping)", "message", "Metadata (input='HO') created"));

        // Step 9: Conditional DMD metadata
        if ("DMDS1".equalsIgnoreCase(dmdSelection)) {
            String meta3 = createDigidakMetadata("DMDS1HO", deptName, "/Digidak Config/Metadata",
                    "Digidak metadata (DMDS1HO mapping)");
            created.add(new CreatedResource(ResourceType.METADATA, meta3, "Metadata: DMDS1HO-" + deptName));
            steps.add(Map.of("success", true, "step", "Digidak metadata (DMDS1HO mapping)", "message", "Metadata (input='DMDS1HO') created"));
        } else if ("DMDS2".equalsIgnoreCase(dmdSelection)) {
            String meta4 = createDigidakMetadata("DMDS2HO", deptName, "/Digidak Config/Metadata",
                    "Digidak metadata (DMDS2HO mapping)");
            created.add(new CreatedResource(ResourceType.METADATA, meta4, "Metadata: DMDS2HO-" + deptName));
            steps.add(Map.of("success", true, "step", "Digidak metadata (DMDS2HO mapping)", "message", "Metadata (input='DMDS2HO') created"));
        }
    }

    // ─── RO/TE Department ───────────────────────────────────────────────────────

    private void createRoTeDepartment(String officeType, String deptName, String shortCode,
                                       String locationShortCode, String locationName,
                                       List<Map<String, Object>> steps, List<CreatedResource> created) {
        String locCode = locationShortCode.toLowerCase();
        String folderPath = "/ECM CONFIG/Office Type/" + officeType + "/" + locationName;

        // Step 1: Create dm_folder under /ECM CONFIG/Office Type/<RO|TE>/<location>
        String folderId = createFolder(deptName, shortCode,
                "ecm_" + locCode + "_" + shortCode,
                folderPath,
                "dm_folder under " + folderPath);
        created.add(new CreatedResource(ResourceType.FOLDER, folderId, "Folder: " + deptName));
        steps.add(Map.of("success", true, "step", "dm_folder under " + folderPath, "message", "Folder '" + deptName + "' created"));

        // Step 2: Create dm_group ecm_<locCode>_<shortCode>
        String groupName = "ecm_" + locCode + "_" + shortCode;
        String group = createGroup(groupName, "ECM-" + locCode.toUpperCase() + "-" + deptName, "Location department group");
        created.add(new CreatedResource(ResourceType.GROUP, group, "Group: " + group));
        steps.add(Map.of("success", true, "step", "Location department group", "message", "Group '" + group + "' created"));
    }

    // ─── Primitives ─────────────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private String createFolder(String objectName, String title, String subject,
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
            Map<String, Object> response = restClient.post()
                    .uri(folderUrl)
                    .header("Authorization", getAuthHeader())
                    .header("Content-Type", "application/vnd.emc.documentum+json")
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .body(Map.of("properties", folderProps))
                    .retrieve()
                    .body(Map.class);

            // Extract the created folder's ID from response
            String folderId = null;
            if (response != null) {
                Map<String, Object> respProps = (Map<String, Object>) response.get("properties");
                if (respProps != null) {
                    folderId = (String) respProps.get("r_object_id");
                }
            }
            if (folderId == null) {
                throw new RuntimeException("Failed to retrieve folder ID after creation");
            }

            log.info("[Dept] Folder '{}' created successfully with ID {}", objectName, folderId);
            return folderId;
        } catch (RestClientResponseException e) {
            String rb = e.getResponseBodyAsString(StandardCharsets.UTF_8);
            log.error("[Dept] Folder creation failed [{}]: {}", e.getStatusCode(), rb);
            throw new RuntimeException("Folder '" + objectName + "' creation failed: " + rb);
        } catch (Exception e) {
            log.error("[Dept] Folder creation failed: {}", e.getMessage());
            throw new RuntimeException("Folder '" + objectName + "' creation failed: " + e.getMessage(), e);
        }
    }

    @SuppressWarnings("unchecked")
    private String createGroup(String groupName, String displayName, String stepLabel) {
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
            return groupName;
        } catch (RestClientResponseException e) {
            String rb = e.getResponseBodyAsString(StandardCharsets.UTF_8);
            log.error("[Dept] Group creation failed [{}]: {}", e.getStatusCode(), rb);
            throw new RuntimeException("Group '" + groupName + "' creation failed: " + rb);
        } catch (Exception e) {
            log.error("[Dept] Group creation failed: {}", e.getMessage());
            throw new RuntimeException("Group '" + groupName + "' creation failed: " + e.getMessage(), e);
        }
    }

    @SuppressWarnings("unchecked")
    private String createDigidakMetadata(String input, String results,
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
            Map<String, Object> response = restClient.post()
                    .uri(createUrl)
                    .header("Authorization", getAuthHeader())
                    .header("Content-Type", "application/vnd.emc.documentum+json;charset=UTF-8")
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .body(Map.of("properties", props))
                    .retrieve()
                    .body(Map.class);

            String metadataId = null;
            if (response != null) {
                Map<String, Object> respProps = (Map<String, Object>) response.get("properties");
                if (respProps != null) {
                    metadataId = (String) respProps.get("r_object_id");
                }
            }
            if (metadataId == null) {
                throw new RuntimeException("Failed to retrieve metadata ID after creation");
            }

            log.info("[Dept] Digidak metadata created: input='{}' results='{}' ID={}", input, results, metadataId);
            return metadataId;
        } catch (RestClientResponseException e) {
            String rb = e.getResponseBodyAsString(StandardCharsets.UTF_8);
            log.error("[Dept] Digidak metadata creation failed [{}]: {}", e.getStatusCode(), rb);
            throw new RuntimeException("Digidak metadata (input='" + input + "') creation failed: " + rb);
        } catch (Exception e) {
            log.error("[Dept] Digidak metadata creation failed: {}", e.getMessage());
            throw new RuntimeException("Digidak metadata (input='" + input + "') creation failed: " + e.getMessage(), e);
        }
    }

    @SuppressWarnings("unchecked")
    private String createDigidakMetadataWithCgmPs(String input, String results,
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
            Map<String, Object> response = restClient.post()
                    .uri(createUrl)
                    .header("Authorization", getAuthHeader())
                    .header("Content-Type", "application/vnd.emc.documentum+json;charset=UTF-8")
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .body(Map.of("properties", props))
                    .retrieve()
                    .body(Map.class);

            String metadataId = null;
            if (response != null) {
                Map<String, Object> respProps = (Map<String, Object>) response.get("properties");
                if (respProps != null) {
                    metadataId = (String) respProps.get("r_object_id");
                }
            }
            if (metadataId == null) {
                throw new RuntimeException("Failed to retrieve metadata ID after creation");
            }

            log.info("[Dept] Digidak metadata with cgm_ps created: input='{}' ID={}", input, metadataId);
            return metadataId;
        } catch (RestClientResponseException e) {
            String rb = e.getResponseBodyAsString(StandardCharsets.UTF_8);
            log.error("[Dept] Digidak metadata creation failed [{}]: {}", e.getStatusCode(), rb);
            throw new RuntimeException("Digidak metadata (input='" + input + "' with cgm_ps) creation failed: " + rb);
        } catch (Exception e) {
            log.error("[Dept] Digidak metadata creation failed: {}", e.getMessage());
            throw new RuntimeException("Digidak metadata (input='" + input + "' with cgm_ps) creation failed: " + e.getMessage(), e);
        }
    }

    // ─── Error Message Builder ──────────────────────────────────────────────────

    /**
     * Builds a user-friendly error message based on what failed.
     * Checks if it's a folder already exists error or other specific failures.
     */
    private String buildErrorMessage(String deptName, String errorMsg, List<Map<String, Object>> steps) {
        String errorLower = errorMsg.toLowerCase();

        // Check if it's a folder creation failure (first step)
        if (steps.isEmpty() || (steps.size() > 0 && steps.get(0).get("step").toString().contains("dm_folder"))) {
            if (errorLower.contains("folder") && (errorLower.contains("already exist") || errorLower.contains("path_exists"))) {
                return "Department '" + deptName + "' already exists";
            }
            if (errorLower.contains("folder")) {
                return "Failed to create department folder: " + errorMsg;
            }
        }

        // Check if it's a group creation failure
        if (errorLower.contains("group") && (errorLower.contains("already exist") || errorLower.contains("duplicate"))) {
            return "One or more groups for department '" + deptName + "' already exist";
        }
        if (errorLower.contains("group")) {
            return "Failed to create department groups: " + errorMsg;
        }

        // Check if it's metadata creation failure
        if (errorLower.contains("metadata")) {
            return "Failed to create department metadata: " + errorMsg;
        }

        // Generic message for unknown failures
        return "Department creation failed — all changes have been rolled back. Error: " + errorMsg;
    }

    // ─── Rollback & Cleanup ─────────────────────────────────────────────────────

    /**
     * Rolls back all successfully created resources in reverse order.
     * Adds rollback steps to the steps list for reporting.
     */
    private void rollback(List<CreatedResource> created, List<Map<String, Object>> steps) {
        log.info("[Dept] Rolling back {} created resources", created.size());
        for (int i = created.size() - 1; i >= 0; i--) {
            CreatedResource r = created.get(i);
            try {
                switch (r.type()) {
                    case FOLDER -> deleteFolder(r.id());
                    case GROUP  -> deleteGroup(r.id());
                    case METADATA -> deleteMetadata(r.id());
                }
                log.info("[Dept] Rollback: deleted {} '{}'", r.type(), r.label());
                steps.add(Map.of("success", true, "step", "Rollback: " + r.label(), "message", "Deleted during rollback"));
            } catch (Exception ex) {
                log.error("[Dept] Rollback failed for {} '{}': {}", r.type(), r.label(), ex.getMessage());
                steps.add(Map.of("success", false, "step", "Rollback: " + r.label(), "error", "Failed to delete: " + ex.getMessage()));
            }
        }
    }

    private void deleteFolder(String folderId) {
        try {
            String repoUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository();
            String url = repoUrl + "/folders/" + folderId + "?del-non-empty=true";

            log.info("[Dept] Deleting folder {}", folderId);
            restClient.delete()
                    .uri(url)
                    .header("Authorization", getAuthHeader())
                    .retrieve()
                    .toBodilessEntity();

            log.info("[Dept] Folder {} deleted successfully", folderId);
        } catch (RestClientResponseException e) {
            String rb = e.getResponseBodyAsString(StandardCharsets.UTF_8);
            log.error("[Dept] Folder deletion failed [{}]: {}", e.getStatusCode(), rb);
            throw new RuntimeException("Failed to delete folder " + folderId + ": " + rb);
        } catch (Exception e) {
            log.error("[Dept] Folder deletion failed: {}", e.getMessage());
            throw new RuntimeException("Failed to delete folder " + folderId + ": " + e.getMessage(), e);
        }
    }

    private void deleteGroup(String groupName) {
        try {
            String repoUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository();
            String url = repoUrl + "/groups/" + groupName;

            log.info("[Dept] Deleting group {}", groupName);
            restClient.delete()
                    .uri(url)
                    .header("Authorization", getAuthHeader())
                    .retrieve()
                    .toBodilessEntity();

            log.info("[Dept] Group {} deleted successfully", groupName);
        } catch (RestClientResponseException e) {
            String rb = e.getResponseBodyAsString(StandardCharsets.UTF_8);
            log.error("[Dept] Group deletion failed [{}]: {}", e.getStatusCode(), rb);
            throw new RuntimeException("Failed to delete group " + groupName + ": " + rb);
        } catch (Exception e) {
            log.error("[Dept] Group deletion failed: {}", e.getMessage());
            throw new RuntimeException("Failed to delete group " + groupName + ": " + e.getMessage(), e);
        }
    }

    private void deleteMetadata(String objectId) {
        try {
            String repoUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository();
            String url = repoUrl + "/objects/" + objectId + "?delete=true";

            log.info("[Dept] Deleting metadata object {}", objectId);
            restClient.delete()
                    .uri(url)
                    .header("Authorization", getAuthHeader())
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .retrieve()
                    .toBodilessEntity();

            log.info("[Dept] Metadata object {} deleted successfully", objectId);
        } catch (RestClientResponseException e) {
            String rb = e.getResponseBodyAsString(StandardCharsets.UTF_8);
            log.error("[Dept] Metadata deletion failed [{}]: {}", e.getStatusCode(), rb);
            throw new RuntimeException("Failed to delete metadata " + objectId + ": " + rb);
        } catch (Exception e) {
            log.error("[Dept] Metadata deletion failed: {}", e.getMessage());
            throw new RuntimeException("Failed to delete metadata " + objectId + ": " + e.getMessage(), e);
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

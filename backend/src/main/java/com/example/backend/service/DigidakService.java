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
public class DigidakService {

    private final DctmConfig dctmConfig;
    private final AppConfig appConfig;
    private final RestClient restClient;

    public DigidakService(DctmConfig dctmConfig, AppConfig appConfig, RestClient.Builder restClientBuilder) {
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
     * Get Digidak report with Inbox/Outbox filtering and date range.
     * Always excludes:
     * - is_migrated = false
     * Mandatory filters:
     * - is_ddm = false
     * - decision = 'Inward' (inbox) or 'Outward' (outbox)
     * - status IN ('Unread','Opened','Assigned Head','Assigned','Closed','Reassigned','Reassign Head','Responded','Follow-Up','Inprocess','Pushback')
     * - login_cgm_group = 'ecm_digidak_<officeType>_<deptShortCode>_cgm'
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> getDigidakReport(String decisionType, String hoRo, String location, String deptNames,
                                                 String fromDate, String toDate, String language, String modeOfReceipt,
                                                 String priority, String secrecy, String status, String typeCategory, String sourceVertical,
                                                 boolean export, int page, int itemsPerPage) {
        try {
            // Build WHERE clause with mandatory filters
            StringBuilder where = new StringBuilder();
            where.append("is_ddm = false");
            where.append(" AND is_migrated = false");

            // Decision filter: Inbox = Inward, Outbox = Outward
            String decision = "Outward"; // default to Outbox
            if ("inbox".equalsIgnoreCase(decisionType)) {
                decision = "Inward";
            }
            where.append(" AND decision = '").append(decision).append("'");

            // Status filter - use provided status if given, otherwise use mandatory list
            if (status != null && !status.isBlank()) {
                String[] statuses = status.split(",");
                where.append(" AND status IN (");
                for (int i = 0; i < statuses.length; i++) {
                    if (i > 0) where.append(", ");
                    where.append("'").append(statuses[i].trim()).append("'");
                }
                where.append(")");
            } else {
                where.append(" AND status IN ('Unread','Opened','Assigned Head','Assigned','Closed','Reassigned','Reassign Head','Responded','Follow-Up','Inprocess','Pushback')");
            }

            // Optional filters - support comma-separated values with IN operator
            if (language != null && !language.isBlank()) {
                String[] langs = language.split(",");
                where.append(" AND languages IN (");
                for (int i = 0; i < langs.length; i++) {
                    if (i > 0) where.append(", ");
                    where.append("'").append(langs[i].trim()).append("'");
                }
                where.append(")");
            }
            if (modeOfReceipt != null && !modeOfReceipt.isBlank()) {
                String[] modes = modeOfReceipt.split(",");
                where.append(" AND mode_of_receipt IN (");
                for (int i = 0; i < modes.length; i++) {
                    if (i > 0) where.append(", ");
                    where.append("'").append(modes[i].trim()).append("'");
                }
                where.append(")");
            }
            if (priority != null && !priority.isBlank()) {
                String[] priorities = priority.split(",");
                where.append(" AND priority IN (");
                for (int i = 0; i < priorities.length; i++) {
                    if (i > 0) where.append(", ");
                    where.append("'").append(priorities[i].trim()).append("'");
                }
                where.append(")");
            }
            if (secrecy != null && !secrecy.isBlank()) {
                String[] secrecies = secrecy.split(",");
                where.append(" AND secrecy IN (");
                for (int i = 0; i < secrecies.length; i++) {
                    if (i > 0) where.append(", ");
                    where.append("'").append(secrecies[i].trim()).append("'");
                }
                where.append(")");
            }
            if (typeCategory != null && !typeCategory.isBlank()) {
                String[] categories = typeCategory.split(",");
                where.append(" AND type_category IN (");
                for (int i = 0; i < categories.length; i++) {
                    if (i > 0) where.append(", ");
                    where.append("'").append(categories[i].trim()).append("'");
                }
                where.append(")");
            }
            // Source Vertical filter - only add if user selected values
            if (sourceVertical != null && !sourceVertical.isBlank()) {
                String[] verticals = sourceVertical.split(",");
                where.append(" AND (");
                for (int i = 0; i < verticals.length; i++) {
                    if (i > 0) where.append(" OR ");
                    where.append("ANY source_vertical = '").append(verticals[i].trim()).append("'");
                }
                where.append(")");
            }

            // Office type filter (HO, RO, TE)
            if (hoRo == null || hoRo.isBlank()) {
                log.warn("Office type (hoRo) is required for Digidak report");
                return buildErrorResponse("Office type is required", page, itemsPerPage);
            }

            String officeType = hoRo.trim().toUpperCase();
            boolean isRoTe = "RO".equals(officeType) || "TE".equals(officeType);

            // Build CGM group filter based on office type
            StringBuilder cgmFilter = new StringBuilder(" AND (");

            if (isRoTe) {
                // For RO/TE: use location shortcode
                if (location == null || location.isBlank()) {
                    log.warn("Location is required for RO/TE Digidak report");
                    return buildErrorResponse("Location is required for RO/TE", page, itemsPerPage);
                }
                String locationShortCode = getLocationShortCode(location.trim());
                cgmFilter.append("login_cgm_group = 'ecm_digidak_").append(officeType.toLowerCase()).append("_")
                         .append(locationShortCode.toLowerCase()).append("_cgm'");
            } else {
                // For HO: use department code
                if (deptNames == null || deptNames.isBlank()) {
                    log.warn("Department is required for HO Digidak report");
                    return buildErrorResponse("Department is required", page, itemsPerPage);
                }

                Map<String, String> deptNameToCode = new HashMap<>();
                String[] deptArray = deptNames.split(",");
                for (String name : deptArray) {
                    deptNameToCode.put(name.trim(), getDeptShortCode(name.trim()));
                }

                for (int i = 0; i < deptArray.length; i++) {
                    if (i > 0) cgmFilter.append(" OR ");
                    String deptCode = deptNameToCode.get(deptArray[i].trim());
                    if (deptCode == null) {
                        deptCode = getDeptShortCode(deptArray[i].trim());
                    }
                    cgmFilter.append("login_cgm_group = 'ecm_digidak_").append(officeType.toLowerCase()).append("_")
                             .append(deptCode.toLowerCase()).append("_cgm'");
                }
            }

            cgmFilter.append(")");
            where.append(cgmFilter);

            // Date range filter
            if (fromDate != null && !fromDate.isBlank()) {
                where.append(" AND r_creation_date >= DATE('").append(formatDateToDDMMYYYY(fromDate))
                     .append("', 'dd/mm/yyyy')");
            }

            if (toDate != null && !toDate.isBlank()) {
                // Add 1 day to toDate for inclusive range
                where.append(" AND r_creation_date <= DATE('").append(formatDateToDDMMYYYY(addOneDay(toDate)))
                     .append("', 'dd/mm/yyyy')");
            }

            String selectClause = "SELECT " + (export ? "" : "DISTINCT ") +
                "r_object_id, uid_number, letter_subject, initiator, file_number, type_category, " +
                "status, r_creation_date, decision, languages, mode_of_receipt, priority, secrecy, selected_region";
            if (export) {
                selectClause += ", source_vertical";
            }

            String dql = String.format(
                selectClause + " " +
                "FROM cms_digidak_folder " +
                "WHERE %s " +
                "ORDER BY r_creation_date DESC " +
                "ENABLE(RETURN_TOP %d)",
                where, page * itemsPerPage
            );

            log.info("Digidak report DQL — decisionType: {}, hoRo: {}, location: {}, deptNames: {}, export: {}, from: {}, to: {}",
                     decisionType, hoRo, location, deptNames, export, fromDate, toDate);

            return executeDigidakDQL(dql, page, itemsPerPage);

        } catch (Exception e) {
            log.error("Error in getDigidakReport", e);
            return buildErrorResponse("Failed to get Digidak report: " + e.getMessage(), page, itemsPerPage);
        }
    }

    /**
     * Get department short code from name (simple mapping - can be extended)
     */
    private String getDeptShortCode(String deptName) {
        Map<String, String> deptCodeMap = new HashMap<>();
        // Add mappings for departments
        deptCodeMap.put("AD", "ad");
        deptCodeMap.put("BID", "bid");
        deptCodeMap.put("CC", "cc");
        deptCodeMap.put("CCD", "ccd");
        deptCodeMap.put("CHMNS", "chmns");
        deptCodeMap.put("CISO", "ciso");
        deptCodeMap.put("CPD", "cpd");
        deptCodeMap.put("CSDD", "csdd");
        deptCodeMap.put("CVC", "cvc");
        deptCodeMap.put("DCAS", "dcas");
        deptCodeMap.put("DDMABI", "ddmabi");
        deptCodeMap.put("DDSI", "ddsi");
        deptCodeMap.put("DEAR", "dear");
        deptCodeMap.put("DFIBT", "dfibt");
        deptCodeMap.put("DIT", "dit");
        deptCodeMap.put("FAD", "fad");
        deptCodeMap.put("FSDD", "fsdd");
        deptCodeMap.put("HRMD", "hrmd");

        String trimmed = deptName.trim().toUpperCase();
        return deptCodeMap.getOrDefault(trimmed, trimmed.toLowerCase());
    }

    /**
     * Get location short code from name (maps location names to shortcodes)
     */
    private String getLocationShortCode(String locationName) {
        Map<String, String> locationCodeMap = new HashMap<>();
        // RO Locations
        locationCodeMap.put("Andaman and Nicobar", "an");
        locationCodeMap.put("Andhra Pradesh", "ad");
        locationCodeMap.put("Arunachal Pradesh", "ar");
        locationCodeMap.put("Assam", "as");
        locationCodeMap.put("Bihar", "br");
        locationCodeMap.put("Chhattisgarh", "ch");
        locationCodeMap.put("Goa", "ga");
        locationCodeMap.put("Gujarat", "gj");
        locationCodeMap.put("Haryana", "hr");
        locationCodeMap.put("Himachal Pradesh", "hp");
        locationCodeMap.put("Jammu and Kashmir", "jk");
        locationCodeMap.put("Jharkhand", "jh");
        locationCodeMap.put("Karnataka", "ka");
        locationCodeMap.put("Kerala", "kl");
        locationCodeMap.put("Madhya Pradesh", "mp");
        locationCodeMap.put("Maharashtra", "mh");
        locationCodeMap.put("Manipur", "mn");
        locationCodeMap.put("Meghalaya", "ml");
        locationCodeMap.put("Mizoram", "mz");
        locationCodeMap.put("Nagaland", "nl");
        locationCodeMap.put("New Delhi", "dl");
        locationCodeMap.put("Odisha", "or");
        locationCodeMap.put("Punjab", "pn");
        locationCodeMap.put("Rajasthan", "rj");
        locationCodeMap.put("Sikkim", "sk");
        locationCodeMap.put("Tamilnadu", "tn");
        locationCodeMap.put("Telangana", "tg");
        locationCodeMap.put("Tripura", "tr");
        locationCodeMap.put("Uttarakhand", "uk");
        locationCodeMap.put("Uttar Pradesh", "up");
        locationCodeMap.put("West Bengal", "wb");
        // TE Locations
        locationCodeMap.put("Bird Kolkata", "bk");
        locationCodeMap.put("Bird Lucknow", "bl");
        locationCodeMap.put("Bird Mangalore", "bm");
        locationCodeMap.put("NBSC Lucknow", "nc");

        String trimmed = locationName.trim();
        return locationCodeMap.getOrDefault(trimmed, trimmed.toLowerCase());
    }

    /**
     * Format date from yyyy-MM-dd to dd/MM/yyyy
     */
    private String formatDateToDDMMYYYY(String dateStr) {
        try {
            if (dateStr == null || dateStr.isBlank()) {
                return dateStr;
            }
            LocalDate date = LocalDate.parse(dateStr, DateTimeFormatter.ISO_LOCAL_DATE);
            return date.format(DateTimeFormatter.ofPattern("dd/MM/yyyy"));
        } catch (Exception e) {
            log.warn("Failed to parse date: {}", dateStr);
            return dateStr;
        }
    }

    /**
     * Add one day to date string
     */
    private String addOneDay(String dateStr) {
        try {
            if (dateStr == null || dateStr.isBlank()) {
                return dateStr;
            }
            LocalDate date = LocalDate.parse(dateStr, DateTimeFormatter.ISO_LOCAL_DATE);
            return date.plusDays(1).format(DateTimeFormatter.ISO_LOCAL_DATE);
        } catch (Exception e) {
            log.warn("Failed to add day to date: {}", dateStr);
            return dateStr;
        }
    }

    /**
     * Execute a DQL query for Digidak and return paginated results.
     */
    @SuppressWarnings("unchecked")
    private Map<String, Object> executeDigidakDQL(String dql, int page, int itemsPerPage) {
        try {
            String baseUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository();

            log.debug("Executing Digidak DQL: {}", dql);

            Map<String, Object> response = restClient.get()
                    .uri(baseUrl + "?dql={dql}&items-per-page={itemsPerPage}&page={page}&inline=true",
                         dql, itemsPerPage, page)
                    .header("Authorization", getAuthHeader())
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .retrieve()
                    .body(Map.class);

            return transformDigidakResponse(response, page, itemsPerPage);

        } catch (Exception e) {
            log.error("Error executing Digidak DQL", e);
            throw new RuntimeException("Failed to execute DQL query: " + e.getMessage(), e);
        }
    }

    /**
     * Transform Digidak DQL response to the expected format.
     */
    @SuppressWarnings("unchecked")
    private Map<String, Object> transformDigidakResponse(Map<String, Object> response, int page, int itemsPerPage) {
        Map<String, Object> result = new HashMap<>();

        if (response == null) {
            result.put("items", new ArrayList<>());
            result.put("hasNext", false);
            result.put("page", page);
            result.put("itemsPerPage", itemsPerPage);
            return result;
        }

        List<Map<String, Object>> items = new ArrayList<>();
        List<Map<String, Object>> entries = (List<Map<String, Object>>) response.get("entries");

        if (entries != null) {
            for (Map<String, Object> entry : entries) {
                Map<String, Object> content = (Map<String, Object>) entry.get("content");
                if (content != null) {
                    Map<String, Object> props = (Map<String, Object>) content.get("properties");
                    if (props != null) {
                        items.add(props);
                    }
                }
            }
        }

        result.put("items", items);
        result.put("page", page);
        result.put("itemsPerPage", itemsPerPage);

        List<Map<String, Object>> links = (List<Map<String, Object>>) response.get("links");
        boolean hasNext = false;
        if (links != null) {
            hasNext = links.stream().anyMatch(link -> "next".equals(link.get("rel")));
        }
        result.put("hasNext", hasNext);

        log.info("Transformed {} Digidak items for page {}, hasNext: {}", items.size(), page, hasNext);

        return result;
    }

    private Map<String, Object> buildErrorResponse(String error, int page, int itemsPerPage) {
        Map<String, Object> result = new HashMap<>();
        result.put("items", new ArrayList<>());
        result.put("hasNext", false);
        result.put("page", page);
        result.put("itemsPerPage", itemsPerPage);
        result.put("error", error);
        return result;
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> getDigidakUsers(String officeType, String location, String deptName) {
        Map<String, Object> result = new HashMap<>();
        List<String> users = new ArrayList<>();
        try {
            String baseUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository();
            StringBuilder dql = new StringBuilder("SELECT DISTINCT user_name FROM dm_user WHERE");

            if ("HO".equalsIgnoreCase(officeType)) {
                if (deptName != null && !deptName.isBlank()) {
                    dql.append(" user_login_name LIKE '%_").append(deptName.trim().toLowerCase()).append("_%'");
                }
            } else if ("RO".equalsIgnoreCase(officeType) || "TE".equalsIgnoreCase(officeType)) {
                if (location != null && !location.isBlank()) {
                    String locCode = getLocationShortCode(location.trim());
                    dql.append(" user_login_name LIKE '%_").append(locCode.toLowerCase()).append("_%'");
                }
            } else {
                result.put("users", users);
                return result;
            }

            dql.append(" ORDER BY user_name");

            Map<String, Object> response = restClient.get()
                    .uri(baseUrl + "?dql={dql}&inline=true", dql.toString())
                    .header("Authorization", getAuthHeader())
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .retrieve()
                    .body(Map.class);

            if (response != null) {
                List<Map<String, Object>> entries = (List<Map<String, Object>>) response.get("entries");
                if (entries != null) {
                    for (Map<String, Object> entry : entries) {
                        Map<String, Object> content = (Map<String, Object>) entry.get("content");
                        if (content != null) {
                            Map<String, Object> props = (Map<String, Object>) content.get("properties");
                            if (props != null && props.get("user_name") != null) {
                                users.add(props.get("user_name").toString());
                            }
                        }
                    }
                }
            }

        } catch (Exception e) {
            log.error("Error fetching Digidak users", e);
        }
        result.put("users", users);
        return result;
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> getDigidakInbox(String hoRo, String location, String deptNames, String username,
                                               String fromDate, String toDate, String language, String modeOfReceipt,
                                               String priority, String secrecy, String status, String typeCategory,
                                               int page, int itemsPerPage) {
        try {
            // Query 1: Get groups for the selected username
            List<String> groups = getWorkflowGroupsForUser(username);
            if (groups.isEmpty()) {
                return buildErrorResponse("No groups found for user: " + username, page, itemsPerPage);
            }

            // Query 2: Query cms_digidak_folder with workflow_groups
            StringBuilder where = new StringBuilder();
            where.append("is_migrated = false");
            where.append(" AND nature_of_correspondence != 'DO Letter'");

            // Status filter - use provided status if given, otherwise use mandatory list
            if (status != null && !status.isBlank()) {
                String[] statuses = status.split(",");
                where.append(" AND status IN (");
                for (int i = 0; i < statuses.length; i++) {
                    if (i > 0) where.append(", ");
                    where.append("'").append(statuses[i].trim()).append("'");
                }
                where.append(")");
            } else {
                where.append(" AND status IN ('Unread','Opened','Assigned Head','Assigned','Closed','Reassigned','Reassign Head','Responded','Follow-Up','Inprocess','Pushback')");
            }

            // Workflow groups filter
            where.append(" AND (");
            for (int i = 0; i < groups.size(); i++) {
                if (i > 0) where.append(" OR ");
                where.append("ANY workflow_groups = '").append(groups.get(i)).append("'");
            }
            where.append(")");

            // Optional filters - support comma-separated values with IN operator
            if (language != null && !language.isBlank()) {
                String[] langs = language.split(",");
                where.append(" AND languages IN (");
                for (int i = 0; i < langs.length; i++) {
                    if (i > 0) where.append(", ");
                    where.append("'").append(langs[i].trim()).append("'");
                }
                where.append(")");
            }
            if (modeOfReceipt != null && !modeOfReceipt.isBlank()) {
                String[] modes = modeOfReceipt.split(",");
                where.append(" AND mode_of_receipt IN (");
                for (int i = 0; i < modes.length; i++) {
                    if (i > 0) where.append(", ");
                    where.append("'").append(modes[i].trim()).append("'");
                }
                where.append(")");
            }
            if (priority != null && !priority.isBlank()) {
                String[] priorities = priority.split(",");
                where.append(" AND priority IN (");
                for (int i = 0; i < priorities.length; i++) {
                    if (i > 0) where.append(", ");
                    where.append("'").append(priorities[i].trim()).append("'");
                }
                where.append(")");
            }
            if (secrecy != null && !secrecy.isBlank()) {
                String[] secrecies = secrecy.split(",");
                where.append(" AND secrecy IN (");
                for (int i = 0; i < secrecies.length; i++) {
                    if (i > 0) where.append(", ");
                    where.append("'").append(secrecies[i].trim()).append("'");
                }
                where.append(")");
            }
            if (typeCategory != null && !typeCategory.isBlank()) {
                String[] categories = typeCategory.split(",");
                where.append(" AND type_category IN (");
                for (int i = 0; i < categories.length; i++) {
                    if (i > 0) where.append(", ");
                    where.append("'").append(categories[i].trim()).append("'");
                }
                where.append(")");
            }

            // Date range filter
            if (fromDate != null && !fromDate.isBlank()) {
                where.append(" AND r_creation_date >= DATE('").append(formatDateToDDMMYYYY(fromDate))
                     .append("', 'dd/mm/yyyy')");
            }

            if (toDate != null && !toDate.isBlank()) {
                where.append(" AND r_creation_date <= DATE('").append(formatDateToDDMMYYYY(addOneDay(toDate)))
                     .append("', 'dd/mm/yyyy')");
            }

            String dql = String.format(
                "SELECT DISTINCT r_object_id, uid_number, letter_subject, initiator, file_number, type_category, " +
                "status, r_creation_date, decision, languages, mode_of_receipt, priority, secrecy, selected_region " +
                "FROM cms_digidak_folder " +
                "WHERE %s " +
                "ORDER BY r_creation_date DESC " +
                "ENABLE(RETURN_TOP %d)",
                where, page * itemsPerPage
            );

            log.info("Digidak Inbox DQL — hoRo: {}, username: {}, from: {}, to: {}", hoRo, username, fromDate, toDate);

            return executeDigidakDQL(dql, page, itemsPerPage);

        } catch (Exception e) {
            log.error("Error in getDigidakInbox", e);
            return buildErrorResponse("Failed to get Digidak Inbox report: " + e.getMessage(), page, itemsPerPage);
        }
    }

    @SuppressWarnings("unchecked")
    private List<String> getWorkflowGroupsForUser(String username) {
        List<String> groups = new ArrayList<>();
        try {
            String baseUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository();
            String dql = String.format(
                "SELECT group_name FROM dm_group WHERE ANY i_all_users_names = '%s' " +
                "AND group_name NOT LIKE 'dm%%' AND group_name NOT LIKE '%%_grade_%%' " +
                "UNION ALL SELECT user_name FROM dm_user WHERE user_name = '%s'",
                username, username
            );

            Map<String, Object> response = restClient.get()
                    .uri(baseUrl + "?dql={dql}&inline=true", dql)
                    .header("Authorization", getAuthHeader())
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .retrieve()
                    .body(Map.class);

            if (response != null) {
                List<Map<String, Object>> entries = (List<Map<String, Object>>) response.get("entries");
                if (entries != null) {
                    for (Map<String, Object> entry : entries) {
                        Map<String, Object> content = (Map<String, Object>) entry.get("content");
                        if (content != null) {
                            Map<String, Object> props = (Map<String, Object>) content.get("properties");
                            if (props != null) {
                                Object groupName = props.get("group_name");
                                Object userName = props.get("user_name");
                                if (groupName != null) {
                                    groups.add(groupName.toString());
                                } else if (userName != null) {
                                    groups.add(userName.toString());
                                }
                            }
                        }
                    }
                }
            }

            log.info("Found {} workflow groups for user '{}'", groups.size(), username);
        } catch (Exception e) {
            log.error("Error fetching workflow groups for user: {}", username, e);
        }
        return groups;
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> getDigidakMetadata() {
        Map<String, Object> metadata = new HashMap<>();
        try {
            String baseUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository();
            String[] inputs = {"languages", "mode_of_receipt", "priority", "secrecy", "status"};

            for (String input : inputs) {
                String dql = String.format(
                    "SELECT DISTINCT results FROM cms_digidak_metadata WHERE input = '%s'",
                    input
                );

                log.debug("Fetching Digidak metadata for input: {} with DQL: {}", input, dql);

                Map<String, Object> response = restClient.get()
                        .uri(baseUrl + "?dql={dql}&inline=true", dql)
                        .header("Authorization", getAuthHeader())
                        .header("Accept", "application/vnd.emc.documentum+json")
                        .retrieve()
                        .body(Map.class);

                List<String> values = new ArrayList<>();
                if (response != null) {
                    List<Map<String, Object>> entries = (List<Map<String, Object>>) response.get("entries");
                    if (entries != null) {
                        for (Map<String, Object> entry : entries) {
                            Map<String, Object> content = (Map<String, Object>) entry.get("content");
                            if (content != null) {
                                Map<String, Object> props = (Map<String, Object>) content.get("properties");
                                if (props != null && props.get("results") != null) {
                                    String resultValue = props.get("results").toString().trim();
                                    if (!resultValue.isEmpty()) {
                                        values.add(resultValue);
                                    }
                                }
                            }
                        }
                    }
                }
                log.info("Fetched {} values for input '{}': {}", values.size(), input, values);
                metadata.put(input, values);
            }

            // Add hardcoded Type Category values
            List<String> typeCategories = new ArrayList<>();
            typeCategories.add("Information");
            typeCategories.add("Actionable");
            metadata.put("type_category", typeCategories);

        } catch (Exception e) {
            log.error("Error fetching Digidak metadata", e);
            // Return empty lists on error
            String[] inputs = {"languages", "mode_of_receipt", "priority", "secrecy", "status", "type_category"};
            for (String input : inputs) {
                metadata.put(input, new ArrayList<>());
            }
        }
        return metadata;
    }

    /**
     * Get Digidak movement register records for a given digidak folder.
     * Queries cms_digidak_movement_re where i_folder_id matches the digidak folder's r_object_id.
     */
    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> getDigidakMovement(String digidakId) {
        String safe = digidakId.replace("'", "''");
        String dql = "SELECT r_object_id, type_category, letter_subject, performer, status, assigned_user, entry_type, received_date, completed_date " +
                     "FROM cms_digidak_movement_re WHERE ANY i_folder_id = '" + safe + "' ORDER BY r_creation_date DESC";
        log.info("Digidak movement register DQL for digidak {}", digidakId);

        try {
            String baseUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository();
            Map<String, Object> response = restClient.get()
                    .uri(baseUrl + "?dql={dql}&items-per-page=200&page=1&inline=true", dql)
                    .header("Authorization", getAuthHeader())
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .retrieve()
                    .body(Map.class);

            List<Map<String, Object>> records = new ArrayList<>();
            if (response != null) {
                List<Map<String, Object>> entries = (List<Map<String, Object>>) response.get("entries");
                if (entries != null) {
                    for (Map<String, Object> entry : entries) {
                        Map<String, Object> content = (Map<String, Object>) entry.get("content");
                        if (content != null) {
                            Map<String, Object> props = (Map<String, Object>) content.get("properties");
                            if (props != null) records.add(props);
                        }
                    }
                }
            }
            return records;
        } catch (Exception e) {
            log.error("Error fetching movement register for digidak {}: {}", digidakId, e.getMessage());
            return new ArrayList<>();
        }
    }

    public List<Map<String, String>> getDigidakVerticals(String officeType, String location, String deptName) {
        String dql;

        if (officeType.equalsIgnoreCase("HO") && !deptName.isEmpty()) {
            // Get department short code from name
            String deptCode = getDeptShortCode(deptName.trim());
            String safe = deptCode.replace("'", "''");
            dql = "SELECT group_display_name FROM dm_group " +
                  "WHERE group_name LIKE 'ecm_ho_" + safe.toLowerCase() + "_%' " +
                  "AND group_name NOT LIKE 'dm%' " +
                  "AND group_name NOT LIKE '%_grade_%' " +
                  "AND group_name NOT LIKE '%vertical_head%' " +
                  "AND group_name NOT LIKE '%cgm_sec%' " +
                  "ORDER BY group_display_name";
        } else if ((officeType.equalsIgnoreCase("RO") || officeType.equalsIgnoreCase("TE")) && !location.isEmpty()) {
            String locationShortCode = getLocationShortCode(location.trim());
            String safe = locationShortCode.replace("'", "''");
            dql = "SELECT group_display_name FROM dm_group " +
                  "WHERE group_name LIKE 'ecm_" + safe.toLowerCase() + "_%' " +
                  "AND group_name NOT LIKE 'dm%' " +
                  "AND group_name NOT LIKE '%_grade_%' " +
                  "AND group_name NOT LIKE '%vertical_head%' " +
                  "AND group_name NOT LIKE '%cgm_sec%' " +
                  "ORDER BY group_display_name";
        } else {
            return new ArrayList<>();
        }

        log.info("Digidak verticals DQL for officeType={}, location={}, deptName={}", officeType, location, deptName);

        try {
            String baseUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository();
            Map<String, Object> response = restClient.get()
                    .uri(baseUrl + "?dql={dql}&items-per-page=200&page=1&inline=true", dql)
                    .header("Authorization", getAuthHeader())
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .retrieve()
                    .body(Map.class);

            List<Map<String, String>> verticals = new ArrayList<>();
            if (response != null) {
                List<Map<String, Object>> entries = (List<Map<String, Object>>) response.get("entries");
                if (entries != null) {
                    for (Map<String, Object> entry : entries) {
                        Map<String, Object> content = (Map<String, Object>) entry.get("content");
                        if (content != null) {
                            Map<String, Object> props = (Map<String, Object>) content.get("properties");
                            if (props != null) {
                                String displayName = (String) props.get("group_display_name");
                                if (displayName != null && !displayName.isEmpty()) {
                                    Map<String, String> vertical = new HashMap<>();
                                    vertical.put("name", displayName);
                                    vertical.put("value", displayName);
                                    verticals.add(vertical);
                                }
                            }
                        }
                    }
                }
            }
            return verticals;
        } catch (Exception e) {
            log.error("Error fetching digidak verticals: {}", e.getMessage());
            return new ArrayList<>();
        }
    }
}

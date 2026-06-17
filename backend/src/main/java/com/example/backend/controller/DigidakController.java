package com.example.backend.controller;

import com.example.backend.service.DigidakService;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/digidak")
@CrossOrigin(origins = { "http://localhost:5173", "http://localhost:5174" })
public class DigidakController {

    private final DigidakService digidakService;

    public DigidakController(DigidakService digidakService) {
        this.digidakService = digidakService;
    }

    /**
     * Digidak report endpoint with Inbox/Outbox filtering, date range, office type, location and department filters.
     * Always excludes is_migrated=false cases, is_endorsed_letter=false cases
     * Uses mandatory filters: is_ddm=false, decision='Outward'/'Inward', status in specific list, login_cgm_group match
     */
    @GetMapping("/report")
    public Map<String, Object> getDigidakReport(
            @RequestParam(defaultValue = "inbox") String decisionType,
            @RequestParam(defaultValue = "") String hoRo,
            @RequestParam(defaultValue = "") String location,
            @RequestParam(defaultValue = "") String deptNames,
            @RequestParam(defaultValue = "") String fromDate,
            @RequestParam(defaultValue = "") String toDate,
            @RequestParam(defaultValue = "") String language,
            @RequestParam(defaultValue = "") String modeOfReceipt,
            @RequestParam(defaultValue = "") String priority,
            @RequestParam(defaultValue = "") String secrecy,
            @RequestParam(defaultValue = "") String status,
            @RequestParam(defaultValue = "") String typeCategory,
            @RequestParam(defaultValue = "") String sourceVertical,
            @RequestParam(defaultValue = "false") boolean export,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size) {
        return digidakService.getDigidakReport(decisionType, hoRo, location, deptNames, fromDate, toDate,
                language, modeOfReceipt, priority, secrecy, status, typeCategory, sourceVertical, export, page, size);
    }

    @GetMapping("/metadata")
    public Map<String, Object> getDigidakMetadata() {
        return digidakService.getDigidakMetadata();
    }

    @GetMapping("/users")
    public Map<String, Object> getDigidakUsers(
            @RequestParam(defaultValue = "") String officeType,
            @RequestParam(defaultValue = "") String location,
            @RequestParam(defaultValue = "") String deptName) {
        return digidakService.getDigidakUsers(officeType, location, deptName);
    }

    @GetMapping("/inbox")
    public Map<String, Object> getDigidakInbox(
            @RequestParam(defaultValue = "") String hoRo,
            @RequestParam(defaultValue = "") String location,
            @RequestParam(defaultValue = "") String deptNames,
            @RequestParam(defaultValue = "") String username,
            @RequestParam(defaultValue = "") String fromDate,
            @RequestParam(defaultValue = "") String toDate,
            @RequestParam(defaultValue = "") String language,
            @RequestParam(defaultValue = "") String modeOfReceipt,
            @RequestParam(defaultValue = "") String priority,
            @RequestParam(defaultValue = "") String secrecy,
            @RequestParam(defaultValue = "") String status,
            @RequestParam(defaultValue = "") String typeCategory,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size) {
        return digidakService.getDigidakInbox(hoRo, location, deptNames, username, fromDate, toDate,
                language, modeOfReceipt, priority, secrecy, status, typeCategory, page, size);
    }

    @GetMapping("/{digidakId}/movement")
    public java.util.List<Map<String, Object>> getDigidakMovement(@PathVariable String digidakId) {
        return digidakService.getDigidakMovement(digidakId);
    }

    @GetMapping("/verticals")
    public java.util.List<Map<String, String>> getDigidakVerticals(
            @RequestParam(defaultValue = "") String officeType,
            @RequestParam(defaultValue = "") String location,
            @RequestParam(defaultValue = "") String deptName) {
        return digidakService.getDigidakVerticals(officeType, location, deptName);
    }
}

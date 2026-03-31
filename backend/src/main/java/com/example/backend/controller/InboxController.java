package com.example.backend.controller;

import com.example.backend.service.InboxService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/inbox")
@CrossOrigin(origins = { "http://localhost:5173", "http://localhost:5174" })
public class InboxController {

    private final InboxService inboxService;

    public InboxController(InboxService inboxService) {
        this.inboxService = inboxService;
    }

    /**
     * Fetch inbox tasks for a user.
     * GET /api/inbox?username=nirmal.joshi&page=1&size=50
     */
    @GetMapping
    public ResponseEntity<Map<String, Object>> getInbox(
            @RequestParam String username,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "50") int size) {
        try {
            return ResponseEntity.ok(inboxService.getInboxTasks(username, page, size));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage(),
                                 "tasks", java.util.List.of(), "total", 0));
        }
    }

    /**
     * Debug: returns the raw JSON from the DCTM tasklist API so you can inspect
     * the actual response structure and field names.
     * GET /api/inbox/raw?username=nirmal.joshi
     */
    @GetMapping("/raw")
    public ResponseEntity<Map<String, Object>> getRaw(@RequestParam String username) {
        return ResponseEntity.ok(inboxService.getRawResponse(username));
    }

    /**
     * Debug: find exact name values stored in dmi_queue_item using LIKE on the first word.
     * Use this to discover the actual format stored for multi-word usernames.
     * GET /api/inbox/debug-name?username=Rajkumar Yaiphaba Meitei
     */
    @GetMapping("/debug-name")
    public ResponseEntity<Map<String, Object>> debugName(@RequestParam String username) {
        return ResponseEntity.ok(inboxService.debugQueueItemName(username));
    }
}

package com.example.backend.controller;

import com.example.backend.service.WorkflowService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/workflows")
@CrossOrigin(origins = { "http://localhost:5173", "http://localhost:5174" })
public class WorkflowController {

    private final WorkflowService workflowService;

    public WorkflowController(WorkflowService workflowService) {
        this.workflowService = workflowService;
    }

    @GetMapping("/processes")
    public ResponseEntity<List<Map<String, Object>>> getProcessTemplates() {
        return ResponseEntity.ok(workflowService.getProcessTemplates());
    }

    @GetMapping("/instances")
    public ResponseEntity<Map<String, Object>> getRunningWorkflows(
            @RequestParam String processName,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(workflowService.getRunningWorkflows(processName, page, size));
    }
}

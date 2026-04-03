package com.example.backend.controller;

import com.example.backend.service.DepartmentService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/departments")
@CrossOrigin(origins = { "http://localhost:5173", "http://localhost:5174" })
public class DepartmentController {

    private final DepartmentService departmentService;

    public DepartmentController(DepartmentService departmentService) {
        this.departmentService = departmentService;
    }

    /**
     * Create a department with all associated DCTM objects (folders, groups, metadata).
     * POST /api/departments
     *
     * Body: { officeType, departmentName, departmentShortCode, dmdSelection, locationShortCode, locationName }
     */
    @PostMapping
    public ResponseEntity<Map<String, Object>> createDepartment(@RequestBody Map<String, Object> request) {
        try {
            return ResponseEntity.ok(departmentService.createDepartment(request));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }
}

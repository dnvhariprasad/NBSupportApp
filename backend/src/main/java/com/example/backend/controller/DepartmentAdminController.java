package com.example.backend.controller;

import com.example.backend.service.DepartmentAdminService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/admin/departments")
@CrossOrigin(origins = { "http://localhost:5173", "http://localhost:5174" })
public class DepartmentAdminController {

    private final DepartmentAdminService adminService;

    public DepartmentAdminController(DepartmentAdminService adminService) {
        this.adminService = adminService;
    }

    // ─── Groups ──────────────────────────────────────────────────────────────

    @GetMapping("/groups")
    public ResponseEntity<?> findGroups(@RequestParam String prefix) {
        try {
            return ResponseEntity.ok(adminService.findGroupsByPrefix(prefix));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @GetMapping("/groups/{groupName}/members")
    public ResponseEntity<?> getGroupMembers(@PathVariable String groupName) {
        try {
            return ResponseEntity.ok(adminService.getGroupMembers(groupName));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @PostMapping("/groups/create")
    public ResponseEntity<?> createGroup(@RequestBody Map<String, Object> request) {
        try {
            String groupName = (String) request.get("groupName");
            return ResponseEntity.ok(adminService.createGroup(groupName));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @GetMapping("/groups/{groupName}/exists")
    public ResponseEntity<?> groupExists(@PathVariable String groupName) {
        try {
            boolean exists = adminService.groupExists(groupName);
            return ResponseEntity.ok(Map.of("exists", exists, "groupName", groupName));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    // ─── Members ─────────────────────────────────────────────────────────────

    @PostMapping("/members/move")
    public ResponseEntity<?> moveMember(@RequestBody Map<String, Object> request) {
        try {
            String sourceGroup = (String) request.get("sourceGroup");
            String targetGroup = (String) request.get("targetGroup");
            String memberName = (String) request.get("memberName");
            String memberType = (String) request.getOrDefault("memberType", "user");
            return ResponseEntity.ok(adminService.moveMember(sourceGroup, targetGroup, memberName, memberType));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    // ─── Users ───────────────────────────────────────────────────────────────

    @GetMapping("/users")
    public ResponseEntity<?> findUsers(@RequestParam String deptShortCode) {
        try {
            return ResponseEntity.ok(adminService.findUsersInDepartment(deptShortCode));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @PatchMapping("/users/{objectId}")
    public ResponseEntity<?> updateUserDepartment(
            @PathVariable String objectId,
            @RequestBody Map<String, Object> request) {
        try {
            String newDeptName = (String) request.get("newDeptName");
            String oldShortCode = (String) request.get("oldShortCode");
            String newShortCode = (String) request.get("newShortCode");
            return ResponseEntity.ok(adminService.updateUserDepartment(objectId, newDeptName, oldShortCode, newShortCode));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    // ─── Folder ──────────────────────────────────────────────────────────────

    @GetMapping("/folder")
    public ResponseEntity<?> getDepartmentFolder(@RequestParam String path) {
        try {
            Map<String, Object> folder = adminService.getDepartmentFolder(path);
            if (folder != null) {
                return ResponseEntity.ok(folder);
            }
            return ResponseEntity.ok(Map.of("success", false, "message", "Folder not found: " + path));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @PatchMapping("/folder/{folderId}")
    public ResponseEntity<?> renameFolder(
            @PathVariable String folderId,
            @RequestBody Map<String, Object> request) {
        try {
            String newName = (String) request.get("newName");
            return ResponseEntity.ok(adminService.renameFolder(folderId, newName));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }
}

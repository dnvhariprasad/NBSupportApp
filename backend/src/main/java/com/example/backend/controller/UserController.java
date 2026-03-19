package com.example.backend.controller;

import com.example.backend.service.OtdsService;
import com.example.backend.service.UserService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
@CrossOrigin(origins = { "http://localhost:5173", "http://localhost:5174" })
public class UserController {

    private final UserService userService;
    private final OtdsService otdsService;

    public UserController(UserService userService, OtdsService otdsService) {
        this.userService = userService;
        this.otdsService = otdsService;
    }

    /**
     * Diagnostic: probes common OTDS REST API base paths to find the correct one.
     * GET /api/users/otds/probe
     */
    @GetMapping("/otds/probe")
    public Map<String, Object> probeOtds() {
        return otdsService.probeConnection();
    }

    /**
     * Diagnostic: returns a single OTDS user's full attributes.
     * Pass the qualified user ID (loginName@partitionName) as the 'userId' query param.
     * GET /api/users/otds/inspect?userId=nirmal.joshi@DCTMPartitions
     */
    @GetMapping("/otds/inspect")
    public ResponseEntity<Map<String, Object>> inspectOtdsUser(
            @RequestParam String userId) {
        try {
            return ResponseEntity.ok(otdsService.inspectPartitionUserAttributes(userId));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Search dm_user objects
     * GET /api/users/dm
     */
    @GetMapping("/dm")
    public Map<String, Object> searchDmUsers(
            @RequestParam(required = false) String query,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "50") int size) {
        return userService.searchDmUsers(query, page, size);
    }

    /**
     * List cms_user_profile users belonging to an HO department short code.
     * GET /api/users/by-dept?shortCode=ddsi
     */
    @GetMapping("/by-dept")
    public List<Map<String, Object>> getUsersByDept(@RequestParam String shortCode) {
        return userService.getUsersByDeptShortCode(shortCode);
    }

    /**
     * List cms_user_profile users by location (for RO/TE offices).
     * GET /api/users/by-location?location=Chennai
     */
    @GetMapping("/by-location")
    public List<Map<String, Object>> getUsersByLocation(@RequestParam String location) {
        return userService.getUsersByLocation(location);
    }

    /**
     * Append a vertical folder's r_object_id to vertical_ids on cms_user_profile.
     * POST /api/users/profiles/{objectId}/vertical-ids
     */
    @PostMapping("/profiles/{objectId}/vertical-ids")
    public ResponseEntity<Map<String, Object>> addVerticalIdToProfile(
            @PathVariable String objectId,
            @RequestBody Map<String, Object> request) {
        String verticalGroupName = (String) request.get("verticalGroupName");
        try {
            return ResponseEntity.ok(userService.addVerticalIdToProfile(objectId, verticalGroupName));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * Remove a vertical folder's r_object_id from vertical_ids on cms_user_profile.
     * DELETE /api/users/profile-vertical-ids?userLoginName=abc&verticalGroupName=ecm_ho_ddsi_bpe
     */
    @DeleteMapping("/profile-vertical-ids")
    public ResponseEntity<Map<String, Object>> removeVerticalIdFromProfile(
            @RequestParam String userLoginName,
            @RequestParam String verticalGroupName) {
        try {
            return ResponseEntity.ok(userService.removeVerticalIdFromProfile(userLoginName, verticalGroupName));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * Update editable properties on a dm_user
     * PATCH /api/users/dm/{loginName}
     */
    @PatchMapping("/dm/{loginName}")
    public ResponseEntity<Map<String, Object>> updateDmUser(
            @PathVariable String loginName,
            @RequestBody Map<String, Object> properties) {
        try {
            return ResponseEntity.ok(userService.updateDmUser(loginName, properties));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * Search user profiles
     */
    @GetMapping("/profiles")
    public Map<String, Object> searchUserProfiles(
            @RequestParam(required = false) String query,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "50") int size) {
        return userService.searchUserProfiles(query, page, size);
    }

    /**
     * Create a new dm_user
     */
    @PostMapping
    public ResponseEntity<Map<String, Object>> createUser(@RequestBody Map<String, Object> request) {
        try {
            return ResponseEntity.ok(userService.createUser(request));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * Create a cms_user_profile object in /UserProfile/UsersProfileBO.
     * POST /api/users/profile
     */
    @PostMapping("/profile")
    public ResponseEntity<Map<String, Object>> createUserProfile(@RequestBody Map<String, Object> request) {
        try {
            return ResponseEntity.ok(userService.createCmsUserProfile(request));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * OTDS post-creation setup: creates OTDS user, adds to partition, sets initial password.
     * POST /api/users/otds/setup
     */
    @PostMapping("/otds/setup")
    public ResponseEntity<Map<String, Object>> setupOtdsUser(@RequestBody Map<String, Object> req) {
        String loginName   = (String) req.get("loginName");
        String displayName = (String) req.getOrDefault("displayName", loginName);
        String email       = (String) req.getOrDefault("email", "");
        String password    = (String) req.get("password");
        String partition   = (String) req.getOrDefault("partition", "DCTMPartitions");
        boolean reqChange  = Boolean.TRUE.equals(req.get("requirePasswordChange"));
        try {
            otdsService.setupNewOtdsUser(loginName, displayName, email, password, partition, reqChange);
            return ResponseEntity.ok(Map.of("success", true, "message", "OTDS user provisioned successfully"));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * Update password for a dm_user by login name (OTDS-sourced users)
     */
    @PatchMapping("/{loginName}/password")
    public ResponseEntity<Map<String, Object>> updateUserPassword(
            @PathVariable String loginName,
            @RequestBody Map<String, Object> request) {
        String newPassword = (String) request.get("password");
        try {
            Map<String, Object> result = userService.updateUserPassword(loginName, newPassword);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * Update password for an inline-password dm_user directly in Documentum (no OTDS).
     * PATCH /api/users/{loginName}/inline-password
     */
    @PatchMapping("/{loginName}/inline-password")
    public ResponseEntity<Map<String, Object>> updateInlineUserPassword(
            @PathVariable String loginName,
            @RequestBody Map<String, Object> request) {
        String newPassword = (String) request.get("password");
        try {
            Map<String, Object> result = userService.updateInlineUserPassword(loginName, newPassword);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * Get a single user profile by object ID (returns all properties including repeating attrs).
     * GET /api/users/profiles/{objectId}
     */
    @GetMapping("/profiles/{objectId}")
    public ResponseEntity<Map<String, Object>> getProfileById(@PathVariable String objectId) {
        try {
            return ResponseEntity.ok(userService.getProfileById(objectId));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * Update user profile
     */
    @PatchMapping("/profiles/{objectId}")
    public Map<String, Object> updateUserProfile(
            @PathVariable String objectId,
            @RequestBody Map<String, Object> properties) {
        return userService.updateUserProfile(objectId, properties);
    }
}

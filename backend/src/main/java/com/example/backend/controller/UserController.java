package com.example.backend.controller;

import com.example.backend.service.UserService;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/users")
@CrossOrigin(origins = { "http://localhost:5173", "http://localhost:5174" })
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
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
     * Update user profile
     */
    @PatchMapping("/profiles/{objectId}")
    public Map<String, Object> updateUserProfile(
            @PathVariable String objectId,
            @RequestBody Map<String, Object> properties) {
        return userService.updateUserProfile(objectId, properties);
    }
}

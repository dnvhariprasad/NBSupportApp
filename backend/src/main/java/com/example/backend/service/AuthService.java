package com.example.backend.service;

import com.example.backend.config.DctmConfig;
import com.example.backend.dto.AuthResponse;
import com.example.backend.dto.LoginRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private final DctmConfig dctmConfig;
    private final RestClient.Builder restClientBuilder;
    private final GroupService groupService;

    public AuthResponse authenticate(LoginRequest request) {
        String repoName = (request.getRepository() != null && !request.getRepository().isEmpty())
                ? request.getRepository()
                : dctmConfig.getRepository();

        // Use credentials from request if provided, otherwise fallback to config
        // (service account)
        String username = request.getUsername();
        String password = request.getPassword();

        if (username == null || username.isBlank()) {
            // Logic for service account login if needed, though usually user logs in
            username = dctmConfig.getUsername();
            password = dctmConfig.getPassword();
        }

        String authHeader = "Basic " + Base64.getEncoder().encodeToString(
                (username + ":" + password).getBytes(StandardCharsets.UTF_8));

        String url = dctmConfig.getUrl() + "/repositories/" + repoName + "/currentuser";

        log.info("Authenticating user '{}' against repository '{}'", username, repoName);

        try {
            RestClient restClient = restClientBuilder.build();
            @SuppressWarnings("unchecked")
            Map<String, Object> result = restClient.get()
                    .uri(url)
                    .header(HttpHeaders.AUTHORIZATION, authHeader)
                    .accept(MediaType.APPLICATION_JSON)
                    .retrieve()
                    .body(Map.class);

            // Resolve admin role from group membership
            String adminRole = resolveAdminRole(username);
            if (result != null) {
                @SuppressWarnings("unchecked")
                Map<String, Object> properties = (Map<String, Object>) result.get("properties");
                if (properties != null) {
                    properties.put("admin_role", adminRole);
                } else {
                    // Documentum returned a flat structure — inject at top level
                    result.put("admin_role", adminRole);
                }
                log.info("Resolved admin role for user '{}': {}", username, adminRole);
            }

            return AuthResponse.success(username, repoName, result);

        } catch (HttpClientErrorException.Unauthorized e) {
            log.warn("Authentication failed for user '{}': Unauthorized", username);
            return AuthResponse.failure("Invalid credentials");
        } catch (HttpClientErrorException.Forbidden e) {
            log.warn("Authentication failed for user '{}': Forbidden", username);
            return AuthResponse.failure("Access denied");
        } catch (Exception e) {
            log.error("Error during authentication for user '{}'", username, e);
            return AuthResponse.failure("System error during authentication: " + e.getMessage());
        }
    }

    private String resolveAdminRole(String username) {
        try {
            List<Map<String, String>> groups = groupService.getGroupsByUser(username);
            boolean isSuperAdmin = groups.stream()
                    .anyMatch(g -> "ecm_super_admin".equals(g.get("group_name")));
            if (isSuperAdmin) return "Super Admin";

            boolean isLocalAdmin = groups.stream()
                    .anyMatch(g -> "ecm_local_admin".equals(g.get("group_name")));
            if (isLocalAdmin) return "Local Admin";
        } catch (Exception e) {
            log.warn("Could not resolve admin role for user '{}': {}", username, e.getMessage());
        }
        return "Standard User";
    }
}

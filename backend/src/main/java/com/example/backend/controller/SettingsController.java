package com.example.backend.controller;

import com.example.backend.config.AppConfig;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/settings")
@CrossOrigin(origins = "http://localhost:5173")
@Slf4j
public class SettingsController {

    private final AppConfig appConfig;

    public SettingsController(AppConfig appConfig) {
        this.appConfig = appConfig;
    }

    /**
     * Get application settings for the frontend
     */
    @GetMapping
    public ResponseEntity<Map<String, Object>> getSettings() {
        Map<String, Object> settings = new HashMap<>();

        // Cases settings
        Map<String, Object> casesSettings = new HashMap<>();
        casesSettings.put("defaultLoadMonths", appConfig.getCases().getDefaultLoadMonths());
        settings.put("cases", casesSettings);

        log.info("Returning application settings: {}", settings);
        return ResponseEntity.ok(settings);
    }
}

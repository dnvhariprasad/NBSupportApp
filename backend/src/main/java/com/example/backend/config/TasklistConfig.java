package com.example.backend.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import lombok.Data;

@Configuration
@ConfigurationProperties(prefix = "tasklist")
@Data
public class TasklistConfig {
    private String url;
    private String cmsInboxUrl;
}

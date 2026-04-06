package com.example.backend.controller;

import com.example.backend.service.MetadataService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(MetadataController.class)
class MetadataControllerHindiCommentsTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private MetadataService metadataService;

    // ─── POST /api/metadata/hindi-comments ───────────────────────────────────

    @Test
    void createHindiComment_success() throws Exception {
        when(metadataService.createHindiComment("टिप्पणी"))
                .thenReturn(Map.of("success", true, "message", "Hindi comment 'टिप्पणी' created successfully"));

        mockMvc.perform(post("/api/metadata/hindi-comments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"object_name\": \"टिप्पणी\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Hindi comment 'टिप्पणी' created successfully"));

        verify(metadataService).createHindiComment("टिप्पणी");
    }

    @Test
    void createHindiComment_serviceThrows_returns500() throws Exception {
        when(metadataService.createHindiComment(anyString()))
                .thenThrow(new RuntimeException("Folder not found"));

        mockMvc.perform(post("/api/metadata/hindi-comments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"object_name\": \"test\"}"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Folder not found"));
    }

    // ─── GET /api/metadata/hindi-comments ────────────────────────────────────

    @Test
    void listHindiComments_returnsItems() throws Exception {
        when(metadataService.listHindiComments())
                .thenReturn(List.of(
                        Map.of("r_object_id", "obj001", "object_name", "टिप्पणी 1"),
                        Map.of("r_object_id", "obj002", "object_name", "टिप्पणी 2")
                ));

        mockMvc.perform(get("/api/metadata/hindi-comments"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].object_name").value("टिप्पणी 1"))
                .andExpect(jsonPath("$[1].object_name").value("टिप्पणी 2"));
    }

    @Test
    void listHindiComments_emptyList() throws Exception {
        when(metadataService.listHindiComments()).thenReturn(List.of());

        mockMvc.perform(get("/api/metadata/hindi-comments"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void listHindiComments_serviceThrows_returns500() throws Exception {
        when(metadataService.listHindiComments())
                .thenThrow(new RuntimeException("Connection failed"));

        mockMvc.perform(get("/api/metadata/hindi-comments"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Connection failed"));
    }
}

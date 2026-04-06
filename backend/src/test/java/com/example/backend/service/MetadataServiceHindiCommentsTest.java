package com.example.backend.service;

import com.example.backend.config.DctmConfig;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.client.RestClient;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.mockito.Mockito.doReturn;

@ExtendWith(MockitoExtension.class)
class MetadataServiceHindiCommentsTest {

    @Mock
    private DctmConfig dctmConfig;

    @Mock
    private RestClient.Builder restClientBuilder;

    @Mock
    private RestClient restClient;

    @Mock
    private RestClient.RequestBodyUriSpec postSpec;

    @Mock
    private RestClient.RequestHeadersUriSpec<?> getSpec;

    @Mock
    private RestClient.ResponseSpec responseSpec;

    private MetadataService metadataService;

    @BeforeEach
    void setUp() {
        when(restClientBuilder.build()).thenReturn(restClient);
        metadataService = new MetadataService(dctmConfig, restClientBuilder);

        when(dctmConfig.getUrl()).thenReturn("https://localhost:3030/dctm-rest");
        when(dctmConfig.getRepository()).thenReturn("NABARDUAT");
        when(dctmConfig.getUsername()).thenReturn("dmadmin");
        when(dctmConfig.getPassword()).thenReturn("password");
    }

    // ─── createHindiComment ──────────────────────────────────────────────────

    @Test
    void createHindiComment_success() {
        // Mock folder resolution (resolveFolderInfo)
        Map<String, Object> folderProps = new LinkedHashMap<>();
        folderProps.put("r_object_id", "0b02cba08011b946");
        folderProps.put("acl_name", "dm_4502cba080002500");
        folderProps.put("acl_domain", "test");

        Map<String, Object> folderContent = Map.of("properties", folderProps);
        Map<String, Object> folderEntry = Map.of("content", folderContent);
        Map<String, Object> folderResponse = Map.of("entries", List.of(folderEntry));

        // Mock the GET for folder resolution
        RestClient.RequestHeadersUriSpec rawGetSpec = mock(RestClient.RequestHeadersUriSpec.class);
        when(restClient.get()).thenReturn(rawGetSpec);
        when(rawGetSpec.uri(anyString(), any(Object[].class))).thenReturn(rawGetSpec);
        when(rawGetSpec.header(anyString(), anyString())).thenReturn(rawGetSpec);
        when(rawGetSpec.retrieve()).thenReturn(responseSpec);
        when(responseSpec.body(Map.class)).thenReturn(folderResponse);

        // Mock the POST for creation
        Map<String, Object> createResponse = Map.of("properties", Map.of("r_object_id", "0b02new123"));
        when(restClient.post()).thenReturn(postSpec);
        when(postSpec.uri(anyString())).thenReturn(postSpec);
        when(postSpec.header(anyString(), anyString())).thenReturn(postSpec);
        doReturn(postSpec).when(postSpec).body(any(Map.class));
        when(postSpec.retrieve()).thenReturn(responseSpec);
        // Second call to body() returns the create response
        when(responseSpec.body(Map.class)).thenReturn(folderResponse).thenReturn(createResponse);

        Map<String, Object> result = metadataService.createHindiComment("टिप्पणी");

        assertTrue((Boolean) result.get("success"));
        assertEquals("Hindi comment 'टिप्पणी' created successfully", result.get("message"));
        assertNotNull(result.get("data"));
    }

    @Test
    void createHindiComment_folderNotFound_throwsException() {
        // Mock folder resolution returning empty entries
        Map<String, Object> emptyResponse = Map.of("entries", List.of());

        RestClient.RequestHeadersUriSpec rawGetSpec = mock(RestClient.RequestHeadersUriSpec.class);
        when(restClient.get()).thenReturn(rawGetSpec);
        when(rawGetSpec.uri(anyString(), any(Object[].class))).thenReturn(rawGetSpec);
        when(rawGetSpec.header(anyString(), anyString())).thenReturn(rawGetSpec);
        when(rawGetSpec.retrieve()).thenReturn(responseSpec);
        when(responseSpec.body(Map.class)).thenReturn(emptyResponse);

        RuntimeException ex = assertThrows(RuntimeException.class,
                () -> metadataService.createHindiComment("test"));
        assertTrue(ex.getMessage().contains("/ECM CONFIG/Hindi Comments"));
    }

    // ─── listHindiComments ───────────────────────────────────────────────────

    @Test
    void listHindiComments_returnsItems() {
        // Build a response with 2 entries and no "next" link
        Map<String, Object> props1 = new LinkedHashMap<>();
        props1.put("r_object_id", "obj001");
        props1.put("object_name", "टिप्पणी 1");

        Map<String, Object> props2 = new LinkedHashMap<>();
        props2.put("r_object_id", "obj002");
        props2.put("object_name", "टिप्पणी 2");

        List<Map<String, Object>> entries = List.of(
                Map.of("content", Map.of("properties", props1)),
                Map.of("content", Map.of("properties", props2))
        );
        Map<String, Object> response = Map.of(
                "entries", entries,
                "links", List.of(Map.of("rel", "self", "href", "http://example.com"))
        );

        RestClient.RequestHeadersUriSpec rawGetSpec = mock(RestClient.RequestHeadersUriSpec.class);
        when(restClient.get()).thenReturn(rawGetSpec);
        when(rawGetSpec.uri(anyString(), any(Object[].class))).thenReturn(rawGetSpec);
        when(rawGetSpec.header(anyString(), anyString())).thenReturn(rawGetSpec);
        when(rawGetSpec.retrieve()).thenReturn(responseSpec);
        when(responseSpec.body(Map.class)).thenReturn(response);

        List<Map<String, Object>> result = metadataService.listHindiComments();

        assertEquals(2, result.size());
        assertEquals("टिप्पणी 1", result.get(0).get("object_name"));
        assertEquals("टिप्पणी 2", result.get(1).get("object_name"));
    }

    @Test
    void listHindiComments_emptyFolder_returnsEmptyList() {
        Map<String, Object> response = Map.of(
                "entries", List.of(),
                "links", List.of()
        );

        RestClient.RequestHeadersUriSpec rawGetSpec = mock(RestClient.RequestHeadersUriSpec.class);
        when(restClient.get()).thenReturn(rawGetSpec);
        when(rawGetSpec.uri(anyString(), any(Object[].class))).thenReturn(rawGetSpec);
        when(rawGetSpec.header(anyString(), anyString())).thenReturn(rawGetSpec);
        when(rawGetSpec.retrieve()).thenReturn(responseSpec);
        when(responseSpec.body(Map.class)).thenReturn(response);

        List<Map<String, Object>> result = metadataService.listHindiComments();

        assertTrue(result.isEmpty());
    }

    @Test
    void listHindiComments_nullResponse_returnsEmptyList() {
        RestClient.RequestHeadersUriSpec rawGetSpec = mock(RestClient.RequestHeadersUriSpec.class);
        when(restClient.get()).thenReturn(rawGetSpec);
        when(rawGetSpec.uri(anyString(), any(Object[].class))).thenReturn(rawGetSpec);
        when(rawGetSpec.header(anyString(), anyString())).thenReturn(rawGetSpec);
        when(rawGetSpec.retrieve()).thenReturn(responseSpec);
        when(responseSpec.body(Map.class)).thenReturn(null);

        List<Map<String, Object>> result = metadataService.listHindiComments();

        assertTrue(result.isEmpty());
    }
}

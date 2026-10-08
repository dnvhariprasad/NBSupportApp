package com.example.backend.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import javax.net.ssl.*;
import java.io.IOException;
import java.net.HttpURLConnection;
import java.security.cert.X509Certificate;

@Configuration
public class RestClientConfig {

    @Bean
    public RestClient.Builder restClientBuilder() {
        return RestClient.builder()
                .requestFactory(new TrustAllRequestFactory());
    }

    /**
     * For reports whose individual queries can legitimately run for minutes against a
     * large repository. The default 30s read timeout is right for interactive calls but
     * cuts a heavy Rajbhasha count short, and a cut-short query is worse than a slow one:
     * it surfaces as a failure the caller must handle rather than a real number.
     */
    @Bean("longRunningRestClientBuilder")
    public RestClient.Builder longRunningRestClientBuilder() {
        TrustAllRequestFactory factory = new TrustAllRequestFactory();
        factory.setReadTimeout(LONG_READ_TIMEOUT_MS);
        return RestClient.builder().requestFactory(factory);
    }

    private static final int LONG_READ_TIMEOUT_MS = 180_000;

    // Custom RequestFactory to bypass SSL verification and add timeout
    static class TrustAllRequestFactory extends SimpleClientHttpRequestFactory {
        public TrustAllRequestFactory() {
            // Set connection and read timeouts (30 seconds each)
            this.setConnectTimeout(30000);
            this.setReadTimeout(30000);
        }

        @Override
        protected void prepareConnection(HttpURLConnection connection, String httpMethod) throws IOException {
            if (connection instanceof HttpsURLConnection) {
                ((HttpsURLConnection) connection).setHostnameVerifier((hostname, session) -> true);
                ((HttpsURLConnection) connection).setSSLSocketFactory(trustAllSslSocketFactory());
            }
            super.prepareConnection(connection, httpMethod);
        }

        private SSLSocketFactory trustAllSslSocketFactory() {
            try {
                TrustManager[] trustAllCerts = new TrustManager[] {
                        new X509TrustManager() {
                            public X509Certificate[] getAcceptedIssuers() {
                                return null;
                            }

                            public void checkClientTrusted(X509Certificate[] certs, String authType) {
                            }

                            public void checkServerTrusted(X509Certificate[] certs, String authType) {
                            }
                        }
                };

                SSLContext sc = SSLContext.getInstance("TLS");
                sc.init(null, trustAllCerts, new java.security.SecureRandom());
                return sc.getSocketFactory();
            } catch (Exception e) {
                throw new RuntimeException("Failed to create trust-all SSL socket factory", e);
            }
        }
    }
}

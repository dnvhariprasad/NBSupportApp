import axios from "axios";

// Spring Boot backend. Defaults to the local dev server, so nothing changes
// unless a build sets VITE_API_BASE_URL — which is how a UAT or production
// build points at its own backend instead of the developer's machine.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8080/api",
  headers: {
    "Content-Type": "application/json",
  },
});

// Add OTDS token to all requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;

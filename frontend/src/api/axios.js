import axios from "axios";

const api = axios.create({
  baseURL: "/neoadminBackend/api", // Spring Boot Backend
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

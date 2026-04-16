import axios from "axios";

const api = axios.create({
  baseURL: "/neoadminBackend/api", // Spring Boot Backend
  headers: {
    "Content-Type": "application/json",
  },
});

export default api;

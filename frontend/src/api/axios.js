import axios from "axios";

const api = axios.create({
  baseURL: "/backend/api",
  headers: {
    "Content-Type": "application/json",
  },
});

export default api;

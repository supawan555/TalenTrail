import axios from 'axios';

const API_BASE_URL = import.meta.env?.VITE_API_URL ?? 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL, // URL ของ Backend
  withCredentials: true, // <--- บรรทัดนี้สำคัญที่สุด! ถ้าไม่มี Cookie จะไม่ถูกส่งไป
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;
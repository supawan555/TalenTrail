import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000', // URL ของ Backend
  withCredentials: true, // <--- บรรทัดนี้สำคัญที่สุด! ถ้าไม่มี Cookie จะไม่ถูกส่งไป
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;
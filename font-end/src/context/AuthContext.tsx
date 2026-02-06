// src/context/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../lib/api';

// กำหนด Type ของ User
interface User {
  email: string;
  role: 'hr-recruiter' | 'hiring-manager' | 'management' | 'ADMIN';
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, otp: string) => Promise<void>; // สมมติว่ารับ OTP
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // ฟังก์ชันเช็คว่า Login อยู่ไหม (ยิงไปถาม Backend)
  const checkAuth = async () => {
    setLoading(true);
    try {
      // เรียก route ที่เราทำไว้ เช่น /dashboard/profile
      // Backend จะอ่าน Cookie แล้วตอบกลับมาว่าเราคือใคร
      const res = await api.get('/dashboard/profile'); 
      setUser({ email: res.data.email, role: res.data.role });
    } catch (error) {
      setUser(null); // ถ้า Error (401) แปลว่า Cookie หมดอายุ/ไม่มี
    } finally {
      setLoading(false);
    }
  };

  // เรียก checkAuth ครั้งแรกที่เข้าเว็บ
  useEffect(() => {
    checkAuth();
  }, []);

  // ฟังก์ชัน Login (แบบย่อ - ของคุณอาจจะเป็น verify-otp)
  const login = async (email: string, otp: string) => {
    // ยิงไปที่ Route ที่ Set-Cookie
    await api.post('/auth/verify-otp', { email, code: otp }); 
    // พอผ่านแล้ว ให้ดึงข้อมูล User มาเก็บใน State
    await checkAuth(); 
  };

  const logout = async () => {
    await api.post('/auth/logout');
    setUser(null);
    window.location.href = '/login'; // หรือใช้ navigate
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook สำหรับเรียกใช้ในหน้าอื่นง่ายๆ
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
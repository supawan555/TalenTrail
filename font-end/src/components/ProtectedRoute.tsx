// src/components/ProtectedRoute.tsx
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface Props {
  allowedRoles?: string[]; // รับ Role ที่อนุญาต (Optional)
}

const ProtectedRoute = ({ allowedRoles }: Props) => {
  const { user, loading } = useAuth();

  if (loading) return <div>Loading...</div>; // หรือใส่ Spinner สวยๆ

  // 1. ถ้ายังไม่ Login -> ดีดไปหน้า Login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // 2. ถ้า Login แล้ว แต่ Role ไม่ตรง -> ไปหน้า Forbidden หรือ Home
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <div className="text-red-500">คุณไม่มีสิทธิ์เข้าถึงหน้านี้ (403 Forbidden)</div>;
  }

  // ถ้าผ่านหมด -> ให้แสดงเนื้อหาข้างใน (Outlet)
  return <Outlet />;
};

export default ProtectedRoute;
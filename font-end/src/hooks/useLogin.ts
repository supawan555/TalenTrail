// hooks/useLogin.ts

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';

export const useLogin = () => {
  const navigate = useNavigate();
  const { checkAuth } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showOtpDialog, setShowOtpDialog] = useState(false);
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [error, setError] = useState('');
  const [isBackendReady, setIsBackendReady] = useState(false);
  const [isCheckingBackend, setIsCheckingBackend] = useState(true);
  const [healthCheckAttempts, setHealthCheckAttempts] = useState(0);

  // ===== health check =====
  useEffect(() => {
    let isMounted = true;
    let pollInterval: number | null = null;

    const checkBackendHealth = async () => {
      try {
        const response = await api.get('/health', { timeout: 5000 });
        if (response.data?.status === 'healthy' && isMounted) {
          setIsBackendReady(true);
          setIsCheckingBackend(false);
          if (pollInterval) clearInterval(pollInterval);
        }
      } catch {
        if (isMounted) {
          setHealthCheckAttempts(prev => prev + 1);
        }
      }
    };

    checkBackendHealth();

    pollInterval = window.setInterval(() => {
      if (!isBackendReady) checkBackendHealth();
    }, 5000);

    return () => {
      isMounted = false;
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [isBackendReady]);

  // ===== login =====
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const res = await api.post('/auth/login', { email, password });
      const data = res.data;

      if (data?.pendingToken) {
        setPendingToken(data.pendingToken);
        setShowOtpDialog(true);
      } else {
        await checkAuth();
        navigate('/');
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Invalid email or password');
    } finally {
      setIsLoading(false);
    }
  };

  // ===== otp =====
  const handleVerifyOtp = async () => {
    if (!pendingToken) return;
    setError('');

    try {
      await api.post('/auth/verify-otp', { pendingToken, code: otpCode });
      await checkAuth();

      setShowOtpDialog(false);
      setOtpCode('');
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Invalid or expired OTP');
    }
  };

  return {
    // state
    showPassword,
    setShowPassword,
    email,
    setEmail,
    password,
    setPassword,
    isLoading,
    showOtpDialog,
    setShowOtpDialog,
    otpCode,
    setOtpCode,
    error,
    isBackendReady,
    isCheckingBackend,
    healthCheckAttempts,

    // actions
    handleSignIn,
    handleVerifyOtp,
  };
};
// hooks/useForgotPassword.ts

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { ForgotPasswordStep } from '../components/new-compo/ForgotPassword';

const RESEND_COOLDOWN_SECONDS = 60;

export const useForgotPassword = () => {
  const navigate = useNavigate();

  const [step, setStep] = useState<ForgotPasswordStep>('request');
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  const cooldownInterval = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (cooldownInterval.current) clearInterval(cooldownInterval.current);
    };
  }, []);

  const startCooldown = () => {
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
    if (cooldownInterval.current) clearInterval(cooldownInterval.current);
    cooldownInterval.current = window.setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          if (cooldownInterval.current) clearInterval(cooldownInterval.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const sendCode = async () => {
    await api.post('/auth/forgot-password', { email: email.trim().toLowerCase() });
    startCooldown();
  };

  // ===== step 1: request code =====
  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await sendCode();
      setOtpCode('');
      setStep('verify');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Could not send verification code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0) return;
    setError('');
    try {
      await sendCode();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Could not resend verification code. Please try again.');
    }
  };

  const handleChangeEmail = () => {
    setStep('request');
    setOtpCode('');
    setError('');
    setResendCooldown(0);
    if (cooldownInterval.current) clearInterval(cooldownInterval.current);
  };

  // ===== step 2: verify code =====
  const handleSubmitVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const res = await api.post('/auth/verify-reset-otp', {
        email: email.trim().toLowerCase(),
        code: otpCode,
      });
      setResetToken(res.data?.resetToken ?? null);
      setNewPassword('');
      setConfirmPassword('');
      setStep('reset');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Invalid or expired verification code');
    } finally {
      setIsLoading(false);
    }
  };

  // ===== step 3: reset password =====
  const handleSubmitReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (!resetToken) {
      setError('Your session has expired. Please start over.');
      setStep('request');
      return;
    }

    setIsLoading(true);
    try {
      await api.post('/auth/reset-password', {
        resetToken,
        new_password: newPassword,
      });
      setStep('success');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Could not reset password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToLogin = () => {
    navigate('/login');
  };

  return {
    step,
    email,
    setEmail,
    otpCode,
    setOtpCode,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    showPassword,
    setShowPassword,
    showConfirmPassword,
    setShowConfirmPassword,
    isLoading,
    error,
    resendCooldown,

    handleSubmitRequest,
    handleSubmitVerify,
    handleSubmitReset,
    handleResendCode,
    handleChangeEmail,
    handleBackToLogin,
  };
};

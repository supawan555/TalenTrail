// hooks/useRegister.ts

import { useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL ?? 'https://talentrail-1.onrender.com';

export const useRegister = (onRegister: () => void) => {
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [role, setRole] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [serverError, setServerError] = useState('');
    const [errors, setErrors] = useState<{ [key: string]: string }>({});
    const [showOtpModal, setShowOtpModal] = useState(false);
    const [otpAuthUrl, setOtpAuthUrl] = useState('');
    const [otpSecret, setOtpSecret] = useState('');
    const [showSecret, setShowSecret] = useState(false);

    // ===== validate =====
    const validateForm = () => {
        const newErrors: { [key: string]: string } = {};

        if (!fullName.trim()) newErrors.fullName = 'Full name is required';

        if (!email.trim()) newErrors.email = 'Email is required';
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
            newErrors.email = 'Invalid email format';

        if (!password) newErrors.password = 'Password is required';
        else if (password.length < 8)
            newErrors.password = 'Password must be at least 8 characters';

        if (!confirmPassword)
            newErrors.confirmPassword = 'Please confirm your password';
        else if (password !== confirmPassword)
            newErrors.confirmPassword = 'Passwords do not match';

        if (!role) newErrors.role = 'Please select a role';

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // ===== register =====
    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) return;

        setIsLoading(true);
        setServerError('');

        try {
            const res = await fetch(`${API_BASE}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: fullName, email, password, role }),
            });

            if (!res.ok) throw new Error(`Register failed (${res.status})`);

            const data = await res.json();

            setOtpAuthUrl(data?.otpauth_url || '');
            setOtpSecret(data?.secret || '');
            setShowOtpModal(true);
        } catch (err) {
            setServerError(err + '\nRegistration failed. Email may already be registered.');
        } finally {
            setIsLoading(false);
        }
    };

    // ===== copy =====
    const copyToClipboard = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
        } catch {
            const el = document.createElement('textarea');
            el.value = text;
            document.body.appendChild(el);
            el.select();
            document.execCommand('copy');
            document.body.removeChild(el);
        }
    };

    return {
        // state
        showPassword,
        setShowPassword,
        showConfirmPassword,
        setShowConfirmPassword,
        fullName,
        setFullName,
        email,
        setEmail,
        password,
        setPassword,
        confirmPassword,
        setConfirmPassword,
        role,
        setRole,
        isLoading,
        serverError,
        errors,
        setErrors,
        showOtpModal,
        setShowOtpModal,
        otpAuthUrl,
        otpSecret,
        showSecret,
        setShowSecret,

        // actions
        handleRegister,
        copyToClipboard,
    };
};
// hooks/useSettings.ts

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import api from '../lib/api';
import { toast } from 'sonner';
import type { AxiosError } from 'axios';

type ApiErrorResponse = {
    detail?: string;
    message?: string;
    errors?: string[];
};

const extractErrorMessage = (error: unknown, fallback: string) => {
    const axiosError = error as AxiosError<ApiErrorResponse>;
    return (
        axiosError?.response?.data?.detail ??
        axiosError?.response?.data?.message ??
        axiosError?.response?.data?.errors?.[0] ??
        axiosError?.message ??
        fallback
    );
};

export const useSettings = (user: any) => {
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [profileLoading, setProfileLoading] = useState(true);
    const [profileError, setProfileError] = useState<string | null>(null);

    const profileForm = useForm({
        defaultValues: {
            name: '',
            email: user?.email || '',
        },
    });

    const passwordForm = useForm({
        defaultValues: {
            currentPassword: '',
            newPassword: '',
            confirmPassword: '',
        },
    });

    // ===== fetch profile =====
    useEffect(() => {
        let isMounted = true;

        const fetchProfile = async () => {
            if (!user) {
                profileForm.reset({ name: '', email: '' });
                setProfileError('You need to sign in to manage profile settings.');
                setProfileLoading(false);
                return;
            }

            setProfileLoading(true);
            setProfileError(null);

            try {
                const res = await api.get('/settings/profile');

                if (!isMounted) return;

                profileForm.reset({
                    name: res.data.name ?? '',
                    email: res.data.email ?? user.email,
                });
            } catch (error) {
                if (!isMounted) return;
                const message = extractErrorMessage(error, 'Unable to load profile information');
                setProfileError(message);
                toast.error(message);
            } finally {
                if (isMounted) setProfileLoading(false);
            }
        };

        fetchProfile();

        return () => { isMounted = false; };
    }, [user]);

    // ===== profile submit =====
    const onProfileSubmit = async (data: any) => {
        try {
            const res = await api.put('/settings/profile', {
                name: data.name.trim(),
                email: data.email,
            });

            profileForm.reset({
                name: res.data.name ?? data.name.trim(),
                email: res.data.email ?? data.email,
            });

            toast.success('Profile updated successfully!');
        } catch (error) {
            toast.error(extractErrorMessage(error, 'Unable to update profile'));
        }
    };

    // ===== password submit =====
    const onPasswordSubmit = async (data: any) => {
        if (data.newPassword !== data.confirmPassword) {
            passwordForm.setError('confirmPassword', {
                type: 'manual',
                message: 'Passwords do not match',
            });
            return;
        }

        if (data.newPassword.length < 8) {
            passwordForm.setError('newPassword', {
                type: 'manual',
                message: 'Password must be at least 8 characters long',
            });
            return;
        }

        try {
            await api.put('/settings/password', {
                current_password: data.currentPassword,
                new_password: data.newPassword,
            });

            toast.success('Password changed successfully!');
            passwordForm.reset();
        } catch (error) {
            toast.error(extractErrorMessage(error, 'Unable to change password'));
        }
    };

    return {
        // state
        showCurrentPassword,
        setShowCurrentPassword,
        showNewPassword,
        setShowNewPassword,
        showConfirmPassword,
        setShowConfirmPassword,
        profileLoading,
        profileError,

        // forms
        profileForm,
        passwordForm,

        // actions
        onProfileSubmit,
        onPasswordSubmit,
    };
};
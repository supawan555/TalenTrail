// components/ForgotPassword.ui.tsx

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { Lock, Mail, Eye, EyeOff, Shield, KeyRound, CheckCircle2, ArrowLeft } from 'lucide-react';

const BlobBackground = () => (
  <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
    <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob" />
    <div className="absolute top-0 -right-4 w-72 h-72 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000" />
    <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000" />
    <div className="absolute bottom-8 right-20 w-72 h-72 bg-blue-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-6000" />
  </div>
);

const BlobStyles = () => (
  <style>{`
    @keyframes blob {
      0%   { transform: translate(0px, 0px) scale(1); }
      33%  { transform: translate(30px, -50px) scale(1.1); }
      66%  { transform: translate(-20px, 20px) scale(0.9); }
      100% { transform: translate(0px, 0px) scale(1); }
    }
    .animate-blob { animation: blob 7s infinite; }
    .animation-delay-2000 { animation-delay: 2s; }
    .animation-delay-4000 { animation-delay: 4s; }
    .animation-delay-6000 { animation-delay: 6s; }
  `}</style>
);

export type ForgotPasswordStep = 'request' | 'verify' | 'reset' | 'success';

interface StepMeta {
  icon: React.ReactNode;
  title: string;
  description: string;
}

interface ForgotPasswordUIProps {
  step: ForgotPasswordStep;

  // Request step
  email: string;
  onEmailChange: (value: string) => void;

  // Verify step
  otpCode: string;
  onOtpCodeChange: (value: string) => void;
  resendCooldown: number;
  onResendCode: () => void;
  onChangeEmail: () => void;

  // Reset step
  newPassword: string;
  onNewPasswordChange: (value: string) => void;
  confirmPassword: string;
  onConfirmPasswordChange: (value: string) => void;
  showPassword: boolean;
  onTogglePassword: () => void;
  showConfirmPassword: boolean;
  onToggleConfirmPassword: () => void;

  isLoading: boolean;
  error: string;

  onSubmitRequest: (e: React.FormEvent) => void;
  onSubmitVerify: (e: React.FormEvent) => void;
  onSubmitReset: (e: React.FormEvent) => void;
  onBackToLogin: () => void;
}

export function ForgotPasswordUI({
  step,
  email,
  onEmailChange,
  otpCode,
  onOtpCodeChange,
  resendCooldown,
  onResendCode,
  onChangeEmail,
  newPassword,
  onNewPasswordChange,
  confirmPassword,
  onConfirmPasswordChange,
  showPassword,
  onTogglePassword,
  showConfirmPassword,
  onToggleConfirmPassword,
  isLoading,
  error,
  onSubmitRequest,
  onSubmitVerify,
  onSubmitReset,
  onBackToLogin,
}: ForgotPasswordUIProps) {
  const stepMeta: Record<ForgotPasswordStep, StepMeta> = {
    request: {
      icon: <Mail className="w-5 h-5 text-indigo-600" />,
      title: 'Forgot Password',
      description: 'Enter your email and we\'ll send you a verification code',
    },
    verify: {
      icon: <KeyRound className="w-5 h-5 text-indigo-600" />,
      title: 'Verify Code',
      description: `Enter the 6-digit code sent to ${email}`,
    },
    reset: {
      icon: <Lock className="w-5 h-5 text-indigo-600" />,
      title: 'Reset Password',
      description: 'Choose a new password for your account',
    },
    success: {
      icon: <CheckCircle2 className="w-5 h-5 text-indigo-600" />,
      title: 'Password Reset',
      description: 'Your password has been updated successfully',
    },
  };

  const meta = stepMeta[step];

  return (
    <div className="min-h-screen w-full relative overflow-hidden flex items-center justify-center p-4">
      <BlobBackground />

      <div className="relative z-10 w-full max-w-md">
        <Card className="backdrop-blur-xl bg-white/80 border-white/20 shadow-2xl">
          <CardHeader className="space-y-4 text-center pb-8 pt-10">
            <div className="mx-auto w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg transform hover:scale-105 transition-transform duration-300">
              <div className="relative">
                <Shield className="w-10 h-10 text-white" />
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white" />
              </div>
            </div>
            <div className="text-2xl bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent tracking-tight">
              TalentTrail
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2">
                {meta.icon}
                <CardTitle className="text-3xl bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  {meta.title}
                </CardTitle>
              </div>
              <CardDescription className="text-base text-gray-600">
                {meta.description}
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-6 px-8 pb-10">
            {step === 'request' && (
              <form onSubmit={onSubmitRequest} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm text-gray-700">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => onEmailChange(e.target.value)}
                      className="pl-11 h-12 bg-white/60 backdrop-blur-sm border-gray-200 focus:border-indigo-500 focus:ring-indigo-500 rounded-xl transition-all duration-200"
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Sending code...</span>
                    </div>
                  ) : (
                    'Send Verification Code'
                  )}
                </Button>
              </form>
            )}

            {step === 'verify' && (
              <form onSubmit={onSubmitVerify} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="otp" className="text-sm text-gray-700">Verification Code</Label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <Input
                      id="otp"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="123456"
                      value={otpCode}
                      onChange={(e) => onOtpCodeChange(e.target.value.replace(/\D/g, ''))}
                      className="pl-11 h-12 bg-white/60 backdrop-blur-sm border-gray-200 focus:border-indigo-500 focus:ring-indigo-500 rounded-xl transition-all duration-200 tracking-widest"
                      required
                    />
                  </div>
                </div>

                <div className="flex justify-between text-sm">
                  <button
                    type="button"
                    onClick={onChangeEmail}
                    className="text-gray-500 hover:text-gray-700 hover:underline transition-colors"
                  >
                    Change email
                  </button>
                  <button
                    type="button"
                    onClick={onResendCode}
                    disabled={resendCooldown > 0}
                    className="text-indigo-600 hover:text-indigo-700 hover:underline transition-colors disabled:text-gray-400 disabled:cursor-not-allowed disabled:no-underline"
                  >
                    {resendCooldown > 0 ? `Resend code (${resendCooldown}s)` : 'Resend code'}
                  </button>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading || otpCode.length !== 6}
                  className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Verifying...</span>
                    </div>
                  ) : (
                    'Verify Code'
                  )}
                </Button>
              </form>
            )}

            {step === 'reset' && (
              <form onSubmit={onSubmitReset} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="new-password" className="text-sm text-gray-700">New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <Input
                      id="new-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={newPassword}
                      onChange={(e) => onNewPasswordChange(e.target.value)}
                      className="pl-11 pr-11 h-12 bg-white/60 backdrop-blur-sm border-gray-200 focus:border-indigo-500 focus:ring-indigo-500 rounded-xl transition-all duration-200"
                      required
                      minLength={8}
                    />
                    <button
                      type="button"
                      onClick={onTogglePassword}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password" className="text-sm text-gray-700">Confirm New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <Input
                      id="confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => onConfirmPasswordChange(e.target.value)}
                      className="pl-11 pr-11 h-12 bg-white/60 backdrop-blur-sm border-gray-200 focus:border-indigo-500 focus:ring-indigo-500 rounded-xl transition-all duration-200"
                      required
                      minLength={8}
                    />
                    <button
                      type="button"
                      onClick={onToggleConfirmPassword}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Resetting...</span>
                    </div>
                  ) : (
                    'Reset Password'
                  )}
                </Button>
              </form>
            )}

            {step === 'success' && (
              <div className="space-y-6 text-center">
                <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-9 h-9 text-green-600" />
                </div>
                <p className="text-sm text-gray-600">
                  You can now sign in with your new password.
                </p>
                <Button
                  type="button"
                  onClick={onBackToLogin}
                  className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200"
                >
                  Back to Sign In
                </Button>
              </div>
            )}

            {error && <p className="text-sm text-red-600 text-center">{error}</p>}

            {step !== 'success' && (
              <div className="text-center">
                <button
                  type="button"
                  onClick={onBackToLogin}
                  className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-700 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Sign In
                </button>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-6 flex items-center justify-center gap-2 text-sm text-gray-600">
          <Shield className="w-4 h-4" />
          <span>Secured with end-to-end encryption</span>
        </div>
      </div>

      <BlobStyles />
    </div>
  );
}

// components/Login.ui.tsx

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { Lock, Mail, Eye, EyeOff, Shield } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';

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

// ===== SKELETON =====

interface LoginSkeletonUIProps {
  healthCheckAttempts: number;
}

export function LoginSkeletonUI({ healthCheckAttempts }: LoginSkeletonUIProps) {
  return (
    <div className="min-h-screen w-full relative overflow-hidden flex items-center justify-center p-4">
      <BlobBackground />
      <div className="relative z-10 w-full max-w-md">
        <Card className="backdrop-blur-xl bg-white/80 border-white/20 shadow-2xl">
          <CardHeader className="space-y-4 text-center pb-8 pt-10">
            <div className="mx-auto w-20 h-20 bg-gradient-to-br from-gray-200 to-gray-300 rounded-2xl flex items-center justify-center shadow-lg animate-pulse">
              <Shield className="w-10 h-10 text-gray-400" />
            </div>
            <div className="h-8 w-32 mx-auto bg-gray-200 rounded animate-pulse" />
            <div className="space-y-2">
              <div className="h-9 w-48 mx-auto bg-gray-200 rounded animate-pulse" />
              <div className="h-5 w-64 mx-auto bg-gray-100 rounded animate-pulse" />
            </div>
          </CardHeader>
          <CardContent className="space-y-6 px-8 pb-10">
            <div className="space-y-2">
              <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
              <div className="h-12 bg-gray-100 rounded-xl animate-pulse" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
              <div className="h-12 bg-gray-100 rounded-xl animate-pulse" />
            </div>
            <div className="flex justify-end">
              <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
            </div>
            <div className="h-12 bg-gray-200 rounded-xl animate-pulse" />
            <div className="text-center space-y-2">
              <p className="text-sm text-gray-500 flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                Connecting to the server...
              </p>
              {healthCheckAttempts > 0 && (
                <p className="text-xs text-gray-400">
                  Polling attempt {healthCheckAttempts}
                </p>
              )}
            </div>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white/80 text-gray-400">Don't have an account?</span>
              </div>
            </div>
            <div className="h-5 w-32 mx-auto bg-gray-200 rounded animate-pulse" />
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

// ===== MAIN UI =====

interface LoginUIProps {
  // Form state
  email: string;
  onEmailChange: (value: string) => void;
  password: string;
  onPasswordChange: (value: string) => void;
  showPassword: boolean;
  onTogglePassword: () => void;
  isLoading: boolean;
  isBackendReady: boolean;
  error: string;

  // OTP dialog
  showOtpDialog: boolean;
  onCloseOtpDialog: () => void;
  otpCode: string;
  onOtpCodeChange: (value: string) => void;

  // Actions
  onSubmit: (e: React.FormEvent) => void;
  onVerifyOtp: () => void;
  onShowRegister: () => void;
}

export function LoginUI({
  email,
  onEmailChange,
  password,
  onPasswordChange,
  showPassword,
  onTogglePassword,
  isLoading,
  isBackendReady,
  error,
  showOtpDialog,
  onCloseOtpDialog,
  otpCode,
  onOtpCodeChange,
  onSubmit,
  onVerifyOtp,
  onShowRegister,
}: LoginUIProps) {
  return (
    <>
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
                  <Lock className="w-5 h-5 text-indigo-600" />
                  <CardTitle className="text-3xl bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    Welcome Back
                  </CardTitle>
                </div>
                <CardDescription className="text-base text-gray-600">
                  Sign in to continue to your account
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="space-y-6 px-8 pb-10">
              <form onSubmit={onSubmit} className="space-y-5">

                {/* Email */}
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
                      disabled={!isBackendReady}
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm text-gray-700">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => onPasswordChange(e.target.value)}
                      className="pl-11 pr-11 h-12 bg-white/60 backdrop-blur-sm border-gray-200 focus:border-indigo-500 focus:ring-indigo-500 rounded-xl transition-all duration-200"
                      required
                      disabled={!isBackendReady}
                    />
                    <button
                      type="button"
                      onClick={onTogglePassword}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      disabled={!isBackendReady}
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Forgot password */}
                <div className="flex justify-end">
                  <button
                    type="button"
                    className="text-sm text-indigo-600 hover:text-indigo-700 hover:underline transition-colors disabled:text-gray-400 disabled:cursor-not-allowed"
                    disabled={!isBackendReady}
                  >
                    Forgot Password?
                  </button>
                </div>

                {/* Submit */}
                <Button
                  type="submit"
                  disabled={isLoading || !isBackendReady}
                  className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Signing in...</span>
                    </div>
                  ) : !isBackendReady ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Connecting...</span>
                    </div>
                  ) : (
                    'Sign In'
                  )}
                </Button>
              </form>

              {error && <p className="text-sm text-red-600 text-center">{error}</p>}

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white/80 text-gray-500">Don't have an account?</span>
                </div>
              </div>

              <div className="text-center">
                <button
                  type="button"
                  onClick={onShowRegister}
                  className="text-indigo-600 hover:text-indigo-700 transition-colors"
                >
                  Create Account
                </button>
              </div>
            </CardContent>
          </Card>

          <div className="mt-6 flex items-center justify-center gap-2 text-sm text-gray-600">
            <Shield className="w-4 h-4" />
            <span>Secured with end-to-end encryption</span>
          </div>
        </div>

        <BlobStyles />
      </div>

      {/* OTP Dialog */}
      <Dialog open={showOtpDialog} onOpenChange={onCloseOtpDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Two-Factor Authentication</DialogTitle>
            <DialogDescription>Enter the 6-digit code from your authenticator app.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="otp">OTP Code</Label>
            <Input
              id="otp"
              inputMode="numeric"
              maxLength={6}
              value={otpCode}
              onChange={(e) => onOtpCodeChange(e.target.value)}
              placeholder="123456"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={onCloseOtpDialog}>Cancel</Button>
            <Button onClick={onVerifyOtp}>Verify</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
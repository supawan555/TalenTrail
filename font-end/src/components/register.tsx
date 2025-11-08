  import { useState } from 'react';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
  import { Input } from './ui/input';
  import { Label } from './ui/label';
  import { Button } from './ui/button';
  import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
  import { Lock, Mail, Eye, EyeOff, Shield, User, Briefcase, Copy } from 'lucide-react';
  import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';

  const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

  interface RegisterProps {
    onRegister: () => void;
    onBackToLogin: () => void;
  }

  export function Register({ onRegister, onBackToLogin }: RegisterProps) {
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
    const [otpAuthUrl, setOtpAuthUrl] = useState<string>('');
    const [otpSecret, setOtpSecret] = useState<string>('');
    const [showSecret, setShowSecret] = useState(false);

    const validateForm = () => {
      const newErrors: { [key: string]: string } = {};

      if (!fullName.trim()) {
        newErrors.fullName = 'Full name is required';
      }

      if (!email.trim()) {
        newErrors.email = 'Email is required';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        newErrors.email = 'Invalid email format';
      }

      if (!password) {
        newErrors.password = 'Password is required';
      } else if (password.length < 8) {
        newErrors.password = 'Password must be at least 8 characters';
      }

      if (!confirmPassword) {
        newErrors.confirmPassword = 'Please confirm your password';
      } else if (password !== confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }

      if (!role) {
        newErrors.role = 'Please select a role';
      }

      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    };

    const handleRegister = async (e: React.FormEvent) => {
      e.preventDefault();
      
      if (!validateForm()) {
        return;
      }

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
        // Show OTP provisioning info in a popup (otpauth URL and secret)
        setOtpAuthUrl(data?.otpauth_url || '');
        setOtpSecret(data?.secret || '');
        setShowOtpModal(true);
      } catch (err) {
        setServerError('Registration failed. Email may already be registered.');
      } finally {
        setIsLoading(false);
      }
    };

    const copyToClipboard = async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        // fallback: create temp textarea
        const el = document.createElement('textarea');
        el.value = text;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
    };

    return (
      <div className="min-h-screen w-full relative overflow-hidden flex items-center justify-center p-4">
        {/* Animated Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
          {/* Animated blurred shapes */}
          <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
          <div className="absolute top-0 -right-4 w-72 h-72 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
          <div className="absolute bottom-8 right-20 w-72 h-72 bg-blue-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-6000"></div>
        </div>

        {/* Glassmorphic Register Card */}
        <div className="relative z-10 w-full max-w-md">
          <Card className="backdrop-blur-xl bg-white/80 border-white/20 shadow-2xl">
            <CardHeader className="space-y-4 text-center pb-6 pt-8">
              {/* Logo/Icon */}
              <div className="mx-auto w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg transform hover:scale-105 transition-transform duration-300">
                <div className="relative">
                  <Shield className="w-10 h-10 text-white" />
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white"></div>
                </div>
              </div>
              
              {/* App Name */}
              <div className="text-2xl bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent tracking-tight">
                TalentTrail
              </div>
              
              {/* Title with User Icon */}
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2">
                  <User className="w-5 h-5 text-indigo-600" />
                  <CardTitle className="text-3xl bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    Create Account
                  </CardTitle>
                </div>
                <CardDescription className="text-base text-gray-600">
                  Join TalentTrail to streamline your recruitment
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="space-y-6 px-8 pb-8">
              <form onSubmit={handleRegister} className="space-y-4">
                {/* Full Name Input */}
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-sm text-gray-700">
                    Full Name
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <Input
                      id="fullName"
                      type="text"
                      placeholder="John Doe"
                      value={fullName}
                      onChange={(e) => {
                        setFullName(e.target.value);
                        setErrors({ ...errors, fullName: '' });
                      }}
                      className={`pl-11 h-12 bg-white/60 backdrop-blur-sm border-gray-200 focus:border-indigo-500 focus:ring-indigo-500 rounded-xl transition-all duration-200 ${
                        errors.fullName ? 'border-red-500' : ''
                      }`}
                    />
                  </div>
                  {errors.fullName && (
                    <p className="text-xs text-red-500">{errors.fullName}</p>
                  )}
                </div>

                {/* Email Input */}
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm text-gray-700">
                    Email Address
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setErrors({ ...errors, email: '' });
                      }}
                      className={`pl-11 h-12 bg-white/60 backdrop-blur-sm border-gray-200 focus:border-indigo-500 focus:ring-indigo-500 rounded-xl transition-all duration-200 ${
                        errors.email ? 'border-red-500' : ''
                      }`}
                    />
                  </div>
                  {errors.email && (
                    <p className="text-xs text-red-500">{errors.email}</p>
                  )}
                </div>

                {/* Password Input */}
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm text-gray-700">
                    Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setErrors({ ...errors, password: '' });
                      }}
                      className={`pl-11 pr-11 h-12 bg-white/60 backdrop-blur-sm border-gray-200 focus:border-indigo-500 focus:ring-indigo-500 rounded-xl transition-all duration-200 ${
                        errors.password ? 'border-red-500' : ''
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-xs text-red-500">{errors.password}</p>
                  )}
                </div>

                {/* Confirm Password Input */}
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-sm text-gray-700">
                    Confirm Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        setErrors({ ...errors, confirmPassword: '' });
                      }}
                      className={`pl-11 pr-11 h-12 bg-white/60 backdrop-blur-sm border-gray-200 focus:border-indigo-500 focus:ring-indigo-500 rounded-xl transition-all duration-200 ${
                        errors.confirmPassword ? 'border-red-500' : ''
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                  {errors.confirmPassword && (
                    <p className="text-xs text-red-500">{errors.confirmPassword}</p>
                  )}
                </div>

                {/* Role Select */}
                <div className="space-y-2">
                  <Label htmlFor="role" className="text-sm text-gray-700">
                    Role
                  </Label>
                  <div className="relative">
                    <Briefcase className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 z-10 pointer-events-none" />
                    <Select value={role} onValueChange={(value: string) => {
                      setRole(value);
                      setErrors({ ...errors, role: '' });
                    }}>
                      <SelectTrigger 
                        className={`pl-11 h-12 bg-white/60 backdrop-blur-sm border-gray-200 focus:border-indigo-500 focus:ring-indigo-500 rounded-xl transition-all duration-200 ${
                          errors.role ? 'border-red-500' : ''
                        }`}
                      >
                        <SelectValue placeholder="Select your role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hr-recruiter">HR / Recruiter</SelectItem>
                        <SelectItem value="hiring-manager">Hiring Manager</SelectItem>
                        <SelectItem value="management">Management</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {errors.role && (
                    <p className="text-xs text-red-500">{errors.role}</p>
                  )}
                </div>

                {/* Create Account Button */}
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none mt-2"
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Creating account...</span>
                    </div>
                  ) : (
                    'Create Account'
                  )}
                </Button>
              </form>
              {serverError && (
                <p className="text-sm text-red-600 text-center">{serverError}</p>
              )}

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white/80 text-gray-500">
                    Already have an account?
                  </span>
                </div>
              </div>

              {/* Sign In Link */}
              <div className="text-center">
                <button
                  type="button"
                  onClick={onBackToLogin}
                  className="text-indigo-600 hover:text-indigo-700 transition-colors"
                >
                  Sign In
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Security Badge */}
          <div className="mt-6 flex items-center justify-center gap-2 text-sm text-gray-600">
            <Shield className="w-4 h-4" />
            <span>Secured with end-to-end encryption</span>
          </div>
        </div>

        {/* Custom animations */}
        <style>{`
          @keyframes blob {
            0% {
              transform: translate(0px, 0px) scale(1);
            }
            33% {
              transform: translate(30px, -50px) scale(1.1);
            }
            66% {
              transform: translate(-20px, 20px) scale(0.9);
            }
            100% {
              transform: translate(0px, 0px) scale(1);
            }
          }
          .animate-blob {
            animation: blob 7s infinite;
          }
          .animation-delay-2000 {
            animation-delay: 2s;
          }
          .animation-delay-4000 {
            animation-delay: 4s;
          }
          .animation-delay-6000 {
            animation-delay: 6s;
          }
        `}</style>
        {/* OTP Provisioning Modal */}
        <Dialog open={showOtpModal} onOpenChange={setShowOtpModal}>
          <DialogContent
            className="w-full max-w-[540px] mx-auto rounded-2xl p-0 overflow-hidden bg-white shadow-xl"
          >
            <div className="max-h-[80vh] flex flex-col overflow-hidden">
              {/* Scrollable body */}
              <div className="px-6 py-6 sm:px-8 sm:py-8 overflow-y-auto">
                <DialogHeader className="space-y-3">
                  <DialogTitle className="text-2xl font-semibold tracking-tight">Set up your Authenticator</DialogTitle>
                  <DialogDescription className="text-sm text-gray-600 leading-relaxed">
                    Add this account to any TOTP app (Google Authenticator, Microsoft Authenticator, etc.). Use the setup link or scan the QR code below, then enter codes during sign‑in.
                  </DialogDescription>
                </DialogHeader>

                {/* Content sections */}
                <div className="mt-6 space-y-8">
                  {/* Section 1: OTP setup link */}
                  <section className="space-y-2">
                    <h2 className="text-sm font-medium text-gray-900">OTP setup link (otpauth URL)</h2>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        {otpAuthUrl ? (
                          <a href={otpAuthUrl} target="_blank" rel="noreferrer" className="block group">
                            <div className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 overflow-hidden text-ellipsis whitespace-nowrap group-hover:bg-gray-100 transition-colors">
                              {otpAuthUrl}
                            </div>
                          </a>
                        ) : (
                          <div className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-400">—</div>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        className="h-8 px-3 text-xs font-medium"
                        onClick={() => otpAuthUrl && copyToClipboard(otpAuthUrl)}
                        disabled={!otpAuthUrl}
                      >
                        <Copy className="w-4 h-4 mr-1" /> Copy
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500">Opening this on mobile may launch your authenticator app automatically.</p>
                  </section>

                  {/* Section 2: QR code */}
                  {otpAuthUrl && (
                    <section className="space-y-2">
                      <h2 className="text-sm font-medium text-gray-900">Or scan a QR code</h2>
                      <div className="flex justify-center">
                        <div className="w-[240px] sm:w-[260px] rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                          <img
                            alt="Authenticator QR code"
                            className="block mx-auto"
                            width={220}
                            height={220}
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(otpAuthUrl)}`}
                          />
                        </div>
                      </div>
                      <p className="text-xs text-gray-500">Scan with any TOTP-compatible app.</p>
                    </section>
                  )}
                </div>
              </div>
              {/* Sticky footer */}
              <div className="sticky bottom-0 border-t bg-white px-6 py-4 sm:px-8 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowOtpModal(false)}
                  className="text-sm"
                >
                  Close
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setShowOtpModal(false);
                    onRegister();
                  }}
                  className="text-sm"
                >
                  Go to Sign In
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }
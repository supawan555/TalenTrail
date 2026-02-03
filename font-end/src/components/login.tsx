import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Lock, Mail, Eye, EyeOff, Shield } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import api from '../lib/api'; // <--- 1. Import api (Axios) มาใช้แทน

export function Login({ onLogin, onShowRegister }: any) { // ใช้ any แก้ขัดไปก่อนถ้ามีปัญหาเรื่อง type
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

  // Poll backend health endpoint with retry logic
  useEffect(() => {
    let isMounted = true;
    let pollInterval: number | null = null;

    const checkBackendHealth = async () => {
      try {
        const response = await api.get('/health', { timeout: 5000 });
        if (response.data?.status === 'healthy' && isMounted) {
          console.log('✅ Backend is healthy');
          setIsBackendReady(true);
          setIsCheckingBackend(false);
          if (pollInterval) clearInterval(pollInterval);
        }
      } catch (err: any) {
        if (isMounted) {
          setHealthCheckAttempts(prev => prev + 1);
          console.log(`⏳ Backend health check attempt ${healthCheckAttempts + 1} failed:`, err.message);
          // Continue polling - don't stop on error
        }
      }
    };

    // Initial check
    checkBackendHealth();

    // Poll every 2 seconds until backend is ready
    pollInterval = window.setInterval(() => {
      if (!isBackendReady) {
        checkBackendHealth();
      }
    }, 2000);

    return () => {
      isMounted = false;
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [isBackendReady, healthCheckAttempts]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    try {
      // 2. ใช้ api.post แทน fetch
      const res = await api.post('/auth/login', { email, password });
      
      // Axios จะ throw error เองถ้า status ไม่ใช่ 200 ไม่ต้องเช็ค res.ok
      const data = res.data;
      
      if (data?.pendingToken) {
        setPendingToken(data.pendingToken);
        setShowOtpDialog(true);
      } else {
        // กรณีไม่มี OTP
        await checkAuth();
        navigate('/'); 
      }
    } catch (err: any) {
      // Axios เก็บ error msg ไว้ใน err.response.data.detail
      const msg = err.response?.data?.detail || 'Invalid email or password';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!pendingToken) return;
    setError('');
    try {
      // 3. ใช้ api.post แทน fetch (สำคัญมาก! บรรทัดนี้แหละที่ช่วยเซฟ Cookie)
      await api.post('/auth/verify-otp', { pendingToken, code: otpCode });

      // ถ้าผ่าน (ไม่ Error) แปลว่า Cookie ถูกฝังแล้ว
      await checkAuth(); // โหลดข้อมูล User ใหม่จาก Cookie
      
      setShowOtpDialog(false);
      setOtpCode('');
      
      // ไปหน้า Dashboard
      navigate('/');

    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Invalid or expired OTP';
      setError(msg);
    }
  };

  // Skeleton Loading UI
  if (isCheckingBackend) {
    return (
      <div className="min-h-screen w-full relative overflow-hidden flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
          <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
          <div className="absolute top-0 -right-4 w-72 h-72 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
          <div className="absolute bottom-8 right-20 w-72 h-72 bg-blue-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-6000"></div>
        </div>

        <div className="relative z-10 w-full max-w-md">
          <Card className="backdrop-blur-xl bg-white/80 border-white/20 shadow-2xl">
            <CardHeader className="space-y-4 text-center pb-8 pt-10">
              <div className="mx-auto w-20 h-20 bg-gradient-to-br from-gray-200 to-gray-300 rounded-2xl flex items-center justify-center shadow-lg animate-pulse">
                <Shield className="w-10 h-10 text-gray-400" />
              </div>
              
              <div className="h-8 w-32 mx-auto bg-gray-200 rounded animate-pulse"></div>
              
              <div className="space-y-2">
                <div className="h-9 w-48 mx-auto bg-gray-200 rounded animate-pulse"></div>
                <div className="h-5 w-64 mx-auto bg-gray-100 rounded animate-pulse"></div>
              </div>
            </CardHeader>

            <CardContent className="space-y-6 px-8 pb-10">
              {/* Email Field Skeleton */}
              <div className="space-y-2">
                <div className="h-4 w-24 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-12 bg-gray-100 rounded-xl animate-pulse"></div>
              </div>

              {/* Password Field Skeleton */}
              <div className="space-y-2">
                <div className="h-4 w-20 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-12 bg-gray-100 rounded-xl animate-pulse"></div>
              </div>

              {/* Forgot Password Skeleton */}
              <div className="flex justify-end">
                <div className="h-4 w-32 bg-gray-200 rounded animate-pulse"></div>
              </div>

              {/* Submit Button Skeleton */}
              <div className="h-12 bg-gray-200 rounded-xl animate-pulse"></div>

              {/* Loading Status */}
              <div className="text-center space-y-2">
                <p className="text-sm text-gray-500 flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                  Connecting to the server...
                </p>
                {healthCheckAttempts > 0 && (
                  <p className="text-xs text-gray-400">
                    Polling attempt {healthCheckAttempts}
                  </p>
                )}
              </div>

              {/* Divider Skeleton */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white/80 text-gray-400">
                    Don't have an account?
                  </span>
                </div>
              </div>

              {/* Register Link Skeleton */}
              <div className="h-5 w-32 mx-auto bg-gray-200 rounded animate-pulse"></div>
            </CardContent>
          </Card>

          <div className="mt-6 flex items-center justify-center gap-2 text-sm text-gray-600">
            <Shield className="w-4 h-4" />
            <span>Secured with end-to-end encryption</span>
          </div>
        </div>

        <style>{`
          @keyframes blob {
            0% { transform: translate(0px, 0px) scale(1); }
            33% { transform: translate(30px, -50px) scale(1.1); }
            66% { transform: translate(-20px, 20px) scale(0.9); }
            100% { transform: translate(0px, 0px) scale(1); }
          }
          .animate-blob { animation: blob 7s infinite; }
          .animation-delay-2000 { animation-delay: 2s; }
          .animation-delay-4000 { animation-delay: 4s; }
          .animation-delay-6000 { animation-delay: 6s; }
        `}</style>
      </div>
    );
  }

  return (
    <>
      {/* ... (ส่วน JSX UI ด้านล่างเหมือนเดิมเป๊ะ ไม่ต้องแก้) ... */}
      <div className="min-h-screen w-full relative overflow-hidden flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
        <div className="absolute top-0 -right-4 w-72 h-72 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
        <div className="absolute bottom-8 right-20 w-72 h-72 bg-blue-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-6000"></div>
      </div>

      <div className="relative z-10 w-full max-w-md">
        <Card className="backdrop-blur-xl bg-white/80 border-white/20 shadow-2xl">
          <CardHeader className="space-y-4 text-center pb-8 pt-10">
            <div className="mx-auto w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg transform hover:scale-105 transition-transform duration-300">
              <div className="relative">
                <Shield className="w-10 h-10 text-white" />
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white"></div>
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
            <form onSubmit={handleSignIn} className="space-y-5">
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
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-11 h-12 bg-white/60 backdrop-blur-sm border-gray-200 focus:border-indigo-500 focus:ring-indigo-500 rounded-xl transition-all duration-200"
                    required
                    disabled={!isBackendReady}
                  />
                </div>
              </div>

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
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-11 pr-11 h-12 bg-white/60 backdrop-blur-sm border-gray-200 focus:border-indigo-500 focus:ring-indigo-500 rounded-xl transition-all duration-200"
                    required
                    disabled={!isBackendReady}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    disabled={!isBackendReady}
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  className="text-sm text-indigo-600 hover:text-indigo-700 hover:underline transition-colors disabled:text-gray-400 disabled:cursor-not-allowed"
                  disabled={!isBackendReady}
                >
                  Forgot Password?
                </button>
              </div>

              <Button
                type="submit"
                disabled={isLoading || !isBackendReady}
                className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Signing in...</span>
                  </div>
                ) : !isBackendReady ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Connecting...</span>
                  </div>
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>
            {error && (
              <p className="text-sm text-red-600 text-center">{error}</p>
            )}

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white/80 text-gray-500">
                  Don't have an account?
                </span>
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

      <style>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob { animation: blob 7s infinite; }
        .animation-delay-2000 { animation-delay: 2s; }
        .animation-delay-4000 { animation-delay: 4s; }
        .animation-delay-6000 { animation-delay: 6s; }
      `}</style>
  </div>

  <Dialog open={showOtpDialog} onOpenChange={setShowOtpDialog}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Two-Factor Authentication</DialogTitle>
          <DialogDescription>Enter the 6-digit code from your authenticator app.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="otp">OTP Code</Label>
          <Input id="otp" inputMode="numeric" maxLength={6} value={otpCode} onChange={(e) => setOtpCode(e.target.value)} placeholder="123456" />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowOtpDialog(false)}>Cancel</Button>
          <Button onClick={handleVerifyOtp}>Verify</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
import { LoginSkeletonUI, LoginUI } from '../components/new-compo/Login';
import { useLogin } from '../hooks/useLogin';

interface LoginProps {
  onLogin?: () => void;
  onShowRegister: () => void;
}

export function Login({ onShowRegister }: LoginProps) {
  const {
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
    handleSignIn,
    handleVerifyOtp,
  } = useLogin();

  if (isCheckingBackend) {
    return <LoginSkeletonUI healthCheckAttempts={healthCheckAttempts} />;
  }

  return (
    <LoginUI
      email={email}
      onEmailChange={setEmail}
      password={password}
      onPasswordChange={setPassword}
      showPassword={showPassword}
      onTogglePassword={() => setShowPassword(!showPassword)}
      isLoading={isLoading}
      isBackendReady={isBackendReady}
      error={error}
      showOtpDialog={showOtpDialog}
      onCloseOtpDialog={() => setShowOtpDialog(false)}
      otpCode={otpCode}
      onOtpCodeChange={setOtpCode}
      onSubmit={handleSignIn}
      onVerifyOtp={handleVerifyOtp}
      onShowRegister={onShowRegister}
    />
  );
}

import { RegisterUI } from '../components/new-compo/Register';
import { useRegister } from '../hooks/useRegister';

interface RegisterProps {
  onRegister: () => void;
  onBackToLogin: () => void;
}

export function Register({ onRegister, onBackToLogin }: RegisterProps) {
  const {
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
    handleRegister,
    copyToClipboard,
  } = useRegister(onRegister);

  return (
    <RegisterUI
      onRegister={onRegister}
      onBackToLogin={onBackToLogin}
      showPassword={showPassword}
      setShowPassword={setShowPassword}
      showConfirmPassword={showConfirmPassword}
      setShowConfirmPassword={setShowConfirmPassword}
      fullName={fullName}
      setFullName={setFullName}
      email={email}
      setEmail={setEmail}
      password={password}
      setPassword={setPassword}
      confirmPassword={confirmPassword}
      setConfirmPassword={setConfirmPassword}
      role={role}
      setRole={setRole}
      isLoading={isLoading}
      serverError={serverError}
      errors={errors}
      setErrors={setErrors}
      showOtpModal={showOtpModal}
      setShowOtpModal={setShowOtpModal}
      otpAuthUrl={otpAuthUrl}
      handleRegister={handleRegister}
      copyToClipboard={copyToClipboard}
    />
  );
}

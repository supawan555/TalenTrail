import { ForgotPasswordUI } from '../components/new-compo/ForgotPassword';
import { useForgotPassword } from '../hooks/useForgotPassword';

export function ForgotPassword() {
  const {
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
  } = useForgotPassword();

  return (
    <ForgotPasswordUI
      step={step}
      email={email}
      onEmailChange={setEmail}
      otpCode={otpCode}
      onOtpCodeChange={setOtpCode}
      resendCooldown={resendCooldown}
      onResendCode={handleResendCode}
      onChangeEmail={handleChangeEmail}
      newPassword={newPassword}
      onNewPasswordChange={setNewPassword}
      confirmPassword={confirmPassword}
      onConfirmPasswordChange={setConfirmPassword}
      showPassword={showPassword}
      onTogglePassword={() => setShowPassword(!showPassword)}
      showConfirmPassword={showConfirmPassword}
      onToggleConfirmPassword={() => setShowConfirmPassword(!showConfirmPassword)}
      isLoading={isLoading}
      error={error}
      onSubmitRequest={handleSubmitRequest}
      onSubmitVerify={handleSubmitVerify}
      onSubmitReset={handleSubmitReset}
      onBackToLogin={handleBackToLogin}
    />
  );
}

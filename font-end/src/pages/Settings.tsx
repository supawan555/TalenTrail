import { SettingsUI } from '../components/new-compo/Settings';
import { useSettings } from '../hooks/useSettings';
import { useAuth } from '../context/AuthContext';

interface SettingsProps {
  onLogout?: () => void;
}

export function Settings({ onLogout }: SettingsProps) {
  const { user, logout } = useAuth();
  const {
    showCurrentPassword,
    setShowCurrentPassword,
    showNewPassword,
    setShowNewPassword,
    showConfirmPassword,
    setShowConfirmPassword,
    profileLoading,
    profileError,
    profileForm,
    passwordForm,
    onProfileSubmit,
    onPasswordSubmit,
  } = useSettings(user);

  return (
    <SettingsUI
      onLogout={onLogout}
      logout={logout}
      showCurrentPassword={showCurrentPassword}
      setShowCurrentPassword={setShowCurrentPassword}
      showNewPassword={showNewPassword}
      setShowNewPassword={setShowNewPassword}
      showConfirmPassword={showConfirmPassword}
      setShowConfirmPassword={setShowConfirmPassword}
      profileLoading={profileLoading}
      profileError={profileError}
      profileForm={profileForm as any}
      passwordForm={passwordForm as any}
      onProfileSubmit={onProfileSubmit as any}
      onPasswordSubmit={onPasswordSubmit as any}
    />
  );
}

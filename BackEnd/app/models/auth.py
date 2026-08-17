from pydantic import BaseModel, EmailStr, constr
from typing import Optional


class User(BaseModel):
    name: str
    email: str
    password: str
    role: Optional[str] = None

 
class RegisterResponse(BaseModel):
    message: str
    otpauth_url: str
    secret: str


class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    otp_required: bool = True
    pendingToken: str


class VerifyOtpRequest(BaseModel):
    pendingToken: str
    code: str

 
class TokenResponse(BaseModel):
    accessToken: str
    tokenType: str = "bearer"


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class VerifyResetOtpRequest(BaseModel):
    email: EmailStr
    code: constr(strip_whitespace=True, min_length=6, max_length=6)


class VerifyResetOtpResponse(BaseModel):
    resetToken: str


class ResetPasswordRequest(BaseModel):
    resetToken: str
    new_password: constr(strip_whitespace=True, min_length=8, max_length=128)

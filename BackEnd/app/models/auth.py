from pydantic import BaseModel
from typing import Optional


class RegisterRequest(BaseModel):
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

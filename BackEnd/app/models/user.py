from typing import Optional

from pydantic import BaseModel, EmailStr, Field, constr


class ProfileResponse(BaseModel):
    name: Optional[str] = ""
    email: EmailStr
    role: Optional[str] = None


class ProfileUpdateRequest(BaseModel):
    name: Optional[constr(strip_whitespace=True, min_length=2, max_length=120)] = Field(
        default=None,
        description="Full name used across the platform.",
    )
    email: Optional[EmailStr] = Field(
        default=None,
        description="Email is read-only but included for completeness.",
    )

    class Config:
        extra = "ignore"


class PasswordChangeRequest(BaseModel):
    current_password: constr(strip_whitespace=True, min_length=1)
    new_password: constr(strip_whitespace=True, min_length=8, max_length=128)

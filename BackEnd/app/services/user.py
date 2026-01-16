"""User domain helpers."""
from typing import Dict, Any

from fastapi import HTTPException

from app.db import auth_users_collection


def get_user_by_email_or_404(email: str) -> Dict[str, Any]:
	user = auth_users_collection.find_one({"email": email})
	if not user:
		raise HTTPException(status_code=404, detail="User not found")
	return user


def to_profile_payload(user: Dict[str, Any]) -> Dict[str, Any]:
	return {
		"name": user.get("name", ""),
		"email": user.get("email", ""),
		"role": user.get("role"),
	}

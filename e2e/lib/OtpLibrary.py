"""Tiny helper library: compute a TOTP code for the OTP-login E2E test.

``pyotp`` is an optional dependency. It is NOT part of the Robot Framework
venv by default. Install it only when you want to run the P2 OTP test:

    venv\\Scripts\\python.exe -m pip install pyotp
"""

from robot.api.deco import keyword

try:
    import pyotp
except ImportError:  # pragma: no cover - optional dep
    pyotp = None


@keyword
def compute_totp(secret: str) -> str:
    """Return the current 6-digit TOTP code for ``secret`` (base32)."""
    if pyotp is None:
        raise RuntimeError(
            "pyotp is not installed. Run: venv\\Scripts\\python.exe -m pip install pyotp"
        )
    return pyotp.TOTP(secret).now()

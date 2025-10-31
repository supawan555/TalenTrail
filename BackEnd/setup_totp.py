import pyotp
import time

# 1) ใช้ secret คงที่ก่อน (เอาอันนี้ไปสแกนใหม่)
SECRET = "JBSWY3DPEHPK3PXP"  # ตัวอย่าง base32 มาตรฐาน

totp = pyotp.TOTP(SECRET)

print("Current OTP (Python):", totp.now())
print("Provisioning URI:", totp.provisioning_uri(name="TalentTailUser", issuer_name="TalentTail"))

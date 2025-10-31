import pyotp
import time

SECRET = "JBSWY3DPEHPK3PXP"  # ต้องตรงกับที่สแกนเมื่อกี้

totp = pyotp.TOTP(SECRET)

while True:
    print(totp.verify(input("Enter OTP: ")))

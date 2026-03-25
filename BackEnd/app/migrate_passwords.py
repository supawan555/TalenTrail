import bcrypt
from pymongo import MongoClient
import config

def migrate():
    # 1. เชื่อมต่อ DB
    client = MongoClient(config.MONGO_URL)
    db = client[config.PRIMARY_DB]
    auth_users = db["auth_users"]

    # 2. ดึง User ที่ยังเป็น dict
    users = auth_users.find()
    updated_count = 0

    for user in users:
        old_pw_hash = user.get("password_hash")

        if isinstance(old_pw_hash, dict):
            print(f"Migrating user: {user.get('email')}")
            
            # 3. ใช้ bcrypt เพียวๆ ปั่นรหัส 'password123'
            password = "password123".encode('utf-8')
            salt = bcrypt.gensalt()
            # bcrypt.hashpw คืนค่าเป็น bytes เราต้อง .decode() เป็น string เพื่อเก็บลง mongo
            new_hash_string = bcrypt.hashpw(password, salt).decode('utf-8')

            # 4. อัปเดตกลับลง DB
            auth_users.update_one(
                {"_id": user["_id"]},
                {"$set": {"password_hash": new_hash_string}}
            )
            updated_count += 1

    print(f"--- Finished! Updated {updated_count} users ---")
    print("All users now have password: 'password123'")

if __name__ == "__main__":
    migrate()
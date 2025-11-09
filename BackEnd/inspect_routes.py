from app.main import app

for r in app.routes:
    try:
        path = r.path
        methods = sorted(list(getattr(r, 'methods', [])))
        print(f"{path} -> {methods}")
    except Exception:
        pass

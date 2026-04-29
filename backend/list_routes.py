from main import app
for route in app.routes:
    print(f"{getattr(route, 'methods', 'WS')} {route.path}")

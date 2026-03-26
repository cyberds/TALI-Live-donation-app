import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.contrib.auth.models import User
from api.models import AdminEmail, Event

if not User.objects.filter(username="dskbagain@gmail.com").exists():
    User.objects.create_superuser("dskbagain@gmail.com", "dskbagain@gmail.com", "@BereDoosu0")

if not AdminEmail.objects.filter(email="dskbagain@gmail.com").exists():
    AdminEmail.objects.create(email="dskbagain@gmail.com", name="Doosu Admin", is_active=True)

if not Event.objects.exists():
    Event.objects.create(
        title="TALI Live Fundraiser Gala 2026: Building the Future",
        description="Fresh production gala initialization",
        target_amount=15000000.00,
        is_active=True
    )

print("Database successfully seeded.")

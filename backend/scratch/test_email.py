import os
import django
import sys

# Add the backend directory to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from api.email_utils import send_tali_email, send_donation_receipt
from api.models import Donation, Event
from django.utils import timezone

def test_login_email():
    print("Testing admin login email...")
    success = send_tali_email(
        'Test Admin Login Code',
        'api/emails/admin_login_code.html',
        {'code': '123456'},
        ['dskbagain@gmail.com']
    )
    print(f"Login email sent: {success}")

def test_donation_email():
    print("Testing donation receipt email...")
    # Create a dummy donation object for testing
    event = Event.objects.first()
    if not event:
        print("No event found for testing.")
        return
        
    donation = Donation(
        event=event,
        donor_name="Test Donor",
        email="dskbagain@gmail.com",
        amount=1000.00,
        payment_mode="FLUTTERWAVE",
        transaction_reference="TALI-TEST-REF",
    )
    donation.created_at = timezone.now()
    # We don't save to DB, just use it for rendering
    success = send_donation_receipt(donation)
    print(f"Donation email sent: {success}")

if __name__ == "__main__":
    test_login_email()
    test_donation_email()

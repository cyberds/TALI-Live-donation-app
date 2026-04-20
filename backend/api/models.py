import uuid
from django.db import models

class Event(models.Model):
    name = models.CharField(max_length=100)
    title = models.CharField(max_length=200)
    target_amount = models.DecimalField(max_digits=12, decimal_places=2)
    bank_name = models.CharField(max_length=100, blank=True, null=True)
    account_name = models.CharField(max_length=100, blank=True, null=True)
    account_number = models.CharField(max_length=20, blank=True, null=True)
    purpose_link = models.URLField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    celebration_count = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.title} ({self.name})"


class Donation(models.Model):
    PAYMENT_MODE_CHOICES = [
        ('FLUTTERWAVE', 'Flutterwave'),
        ('BANK_TRANSFER', 'Bank Transfer'),
        ('MANUAL', 'Manual Entry'),
        ('INTENT', 'Payment Intent'),
    ]

    PAYMENT_STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('SUCCESS', 'Success'),
        ('FAILED', 'Failed'),
    ]

    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name='donations')
    donor_name = models.CharField(max_length=150, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    is_anonymous = models.BooleanField(default=False)
    
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    payment_mode = models.CharField(max_length=20, choices=PAYMENT_MODE_CHOICES)
    payment_status = models.CharField(max_length=20, choices=PAYMENT_STATUS_CHOICES, default='PENDING')
    transaction_reference = models.CharField(max_length=100, unique=True, blank=True, null=True)
    is_verified = models.BooleanField(default=False)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        name = "Anonymous" if self.is_anonymous else (self.donor_name or "Unknown")
        return f"{name} - {self.amount} ({self.get_payment_status_display()})"
    
    def save(self, *args, **kwargs):
        # Determine the appropriate prefix for the payment mode
        prefix_map = {
            'FLUTTERWAVE': 'TALI-FLW',
            'BANK_TRANSFER': 'TALI-BT',
            'MANUAL': 'TALI-MAN',
            'INTENT': 'TALI-INT',
        }
        prefix = prefix_map.get(self.payment_mode, 'TALI')

        if not self.transaction_reference:
            # Brand new record — generate a fresh reference
            self.transaction_reference = f"{prefix}-{uuid.uuid4().hex[:12].upper()}"
        elif self.transaction_reference.startswith('TALI-INT-') and self.payment_mode != 'INTENT':
            # Upgrading from INTENT to a real payment mode — regenerate with correct prefix
            self.transaction_reference = f"{prefix}-{uuid.uuid4().hex[:12].upper()}"
        # Otherwise: keep the existing reference unchanged (idempotent)

        super().save(*args, **kwargs)

class AdminEmail(models.Model):
    email = models.EmailField(unique=True)
    name = models.CharField(max_length=150, default='TALI Staff')
    is_active = models.BooleanField(default=True)
    
    def __str__(self):
        return self.email

class LoginCode(models.Model):
    email = models.EmailField()
    code = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)
    is_used = models.BooleanField(default=False)

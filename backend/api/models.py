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
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.title} ({self.name})"


class Donation(models.Model):
    PAYMENT_MODE_CHOICES = [
        ('FLUTTERWAVE', 'Flutterwave'),
        ('BANK_TRANSFER', 'Bank Transfer'),
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
        if not self.transaction_reference and self.payment_mode == 'BANK_TRANSFER':
            # Generate a ref for bank transfers to ensure uniqueness if not provided
            self.transaction_reference = f"TALI-BT-{uuid.uuid4().hex[:12].upper()}"
        super().save(*args, **kwargs)

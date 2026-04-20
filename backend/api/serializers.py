from rest_framework import serializers
from .models import Event, Donation

class EventSummarySerializer(serializers.ModelSerializer):
    raised_amount = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    donation_count = serializers.IntegerField(read_only=True)
    highest_donation = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    highest_donor = serializers.CharField(read_only=True)

    class Meta:
        model = Event
        fields = [
            'id', 'name', 'title', 'target_amount', 'purpose_link', 'is_active', 
            'bank_name', 'account_name', 'account_number',
            'raised_amount', 'donation_count', 'highest_donation', 'highest_donor'
        ]

class RecentDonationSerializer(serializers.ModelSerializer):
    donor_display = serializers.SerializerMethodField()

    class Meta:
        model = Donation
        fields = ['id', 'donor_display', 'amount', 'created_at']

    def get_donor_display(self, obj):
        if obj.is_anonymous:
            return "Anonymous"
        return obj.donor_name or "Unknown"

class DonationCreateSerializer(serializers.ModelSerializer):
    transaction_reference = serializers.CharField(read_only=True)

    class Meta:
        model = Donation
        fields = ['event', 'donor_name', 'email', 'phone', 'is_anonymous', 'amount', 'payment_mode', 'transaction_reference']
        
    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Amount must be greater than zero.")
        return value

class AdminDonationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Donation
        fields = ['id', 'donor_name', 'email', 'phone', 'is_anonymous', 'amount', 'payment_mode', 'payment_status', 'transaction_reference', 'created_at']

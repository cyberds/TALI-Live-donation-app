from django.contrib import admin
from .models import Event, Donation, AdminEmail

@admin.register(AdminEmail)
class AdminEmailAdmin(admin.ModelAdmin):
    list_display = ('email', 'is_active')

@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = ('name', 'title', 'target_amount', 'is_active', 'created_at')
    list_filter = ('is_active',)
    search_fields = ('name', 'title')

@admin.register(Donation)
class DonationAdmin(admin.ModelAdmin):
    list_display = ('donor_display', 'amount', 'event', 'payment_mode', 'payment_status', 'is_verified', 'created_at')
    list_filter = ('payment_status', 'payment_mode', 'is_verified', 'is_anonymous', 'event')
    search_fields = ('donor_name', 'email', 'phone', 'transaction_reference')
    readonly_fields = ('created_at', 'updated_at')

    def donor_display(self, obj):
        if obj.is_anonymous:
            return "Anonymous"
        return obj.donor_name or "Unknown"
    donor_display.short_description = 'Donor'

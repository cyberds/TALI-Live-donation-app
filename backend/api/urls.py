from django.urls import path
from . import views

urlpatterns = [
    path('events/<int:event_id>/summary/', views.EventSummaryView.as_view(), name='event-summary'),
    path('events/<int:event_id>/recent-donations/', views.RecentDonationsView.as_view(), name='recent-donations'),
    path('donations/', views.DonationCreateView.as_view(), name='donation-create'),
    path('donations/<int:donation_id>/confirm-transfer/', views.ConfirmBankTransferView.as_view(), name='confirm-transfer'),
    path('donations/<int:donation_id>/verify/', views.VerifyFlutterwavePaymentView.as_view(), name='verify-payment'),
    path('webhooks/flutterwave/', views.flutterwave_webhook, name='flutterwave-webhook'),
    path('events/<int:event_id>/stream/', views.sse_event_stream, name='sse-event-stream'),
]

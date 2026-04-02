from django.urls import path
from . import views

urlpatterns = [
    path('events/active/summary/', views.ActiveEventSummaryView.as_view(), name='active-event-summary'),
    path('events/active/stream/', views.active_sse_event_stream, name='active-sse-event-stream'),
    path('events/<int:event_id>/summary/', views.EventSummaryView.as_view(), name='event-summary'),
    path('events/<int:event_id>/recent-donations/', views.RecentDonationsView.as_view(), name='recent-donations'),
    path('donations/', views.DonationListCreateView.as_view(), name='donation-create'),
    path('donations/<int:donation_id>/confirm-transfer/', views.ConfirmBankTransferView.as_view(), name='confirm-transfer'),
    path('donations/<int:donation_id>/verify/', views.VerifyFlutterwavePaymentView.as_view(), name='verify-payment'),
    path('webhooks/flutterwave/', views.flutterwave_webhook, name='flutterwave-webhook'),
    path('events/<int:event_id>/stream/', views.sse_event_stream, name='sse-event-stream'),
    path('auth/request-code/', views.RequestLoginCodeView.as_view(), name='request-code'),
    path('auth/verify-code/', views.VerifyLoginCodeView.as_view(), name='verify-code'),
    path('admin/overview/', views.AdminOverviewView.as_view(), name='admin-overview'),
    path('admin/transactions/', views.AdminTransactionsView.as_view(), name='admin-transactions'),
    path('admin/transactions/export/', views.AdminTransactionsExportView.as_view(), name='admin-export'),
    path('admin/events/', views.AdminEventListView.as_view(), name='admin-events'),
    path('admin/donations/manual/', views.ManualDonationView.as_view(), name='admin-manual-donation'),
    path('admin/donations/<int:donation_id>/verify-ref/', views.VerifyFlutterwaveByRefView.as_view(), name='admin-verify-ref'),
    path('webhooks/github-deploy/', views.GithubWebhookDeployView.as_view(), name='github-deploy'),
]

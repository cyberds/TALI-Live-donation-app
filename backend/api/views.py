import os
import requests
import random
import csv
import hmac
import hashlib
import threading
import subprocess
import sys
from django.conf import settings
import requests
import random
import csv
from datetime import timedelta
from django.db.models import Sum, Max, Count, Q
from django.shortcuts import get_object_or_404
from django.http import StreamingHttpResponse, HttpResponse
from django.core.mail import send_mail
from django.utils import timezone
from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.authtoken.models import Token

from .models import Event, Donation, AdminEmail, LoginCode
from .serializers import EventSummarySerializer, RecentDonationSerializer, DonationCreateSerializer, AdminDonationSerializer

class ActiveEventSummaryView(APIView):
    def get(self, request):
        event = Event.objects.filter(is_active=True).first()
        if not event:
            return Response({"error": "No active event found"}, status=status.HTTP_404_NOT_FOUND)
            
        successful_donations = event.donations.filter(payment_status='SUCCESS')
        aggregates = successful_donations.aggregate(
            raised_amount=Sum('amount'),
            donation_count=Count('id'),
            highest_donation=Max('amount')
        )
        
        highest_donor_record = successful_donations.order_by('-amount').first()
        highest_donor = "Anonymous"
        if highest_donor_record:
            highest_donor = "Anonymous" if highest_donor_record.is_anonymous else (highest_donor_record.donor_name or "Unknown")

        event.raised_amount = aggregates['raised_amount'] or 0
        event.donation_count = aggregates['donation_count'] or 0
        event.highest_donation = aggregates['highest_donation'] or 0
        event.highest_donor = highest_donor

        serializer = EventSummarySerializer(event)
        return Response(serializer.data)

class EventSummaryView(APIView):
    def get(self, request, event_id):
        event = get_object_or_404(Event, id=event_id, is_active=True)
        
        successful_donations = event.donations.filter(payment_status='SUCCESS')
        aggregates = successful_donations.aggregate(
            raised_amount=Sum('amount'),
            donation_count=Count('id'),
            highest_donation=Max('amount')
        )
        
        highest_donor_record = successful_donations.order_by('-amount').first()
        highest_donor = "Anonymous"
        if highest_donor_record:
            highest_donor = "Anonymous" if highest_donor_record.is_anonymous else (highest_donor_record.donor_name or "Unknown")

        event.raised_amount = aggregates['raised_amount'] or 0
        event.donation_count = aggregates['donation_count'] or 0
        event.highest_donation = aggregates['highest_donation'] or 0
        event.highest_donor = highest_donor

        serializer = EventSummarySerializer(event)
        return Response(serializer.data)

class RecentDonationsView(APIView):
    def get(self, request, event_id):
        donations = Donation.objects.filter(
            event_id=event_id, 
            payment_status='SUCCESS'
        ).order_by('-created_at')[:10]
        
        serializer = RecentDonationSerializer(donations, many=True)
        return Response(serializer.data)

class DonationListCreateView(APIView):
    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsAuthenticated()]
        return []

    def get(self, request):
        donations = Donation.objects.all().order_by('-created_at')
        serializer = AdminDonationSerializer(donations, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = DonationCreateSerializer(data=request.data)
        if serializer.is_valid():
            donation = serializer.save()
            return Response({
                'id': donation.id,
                'transaction_reference': donation.transaction_reference,
                'amount': serializer.data.get('amount'),
                'payment_mode': donation.payment_mode
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class ConfirmBankTransferView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, donation_id):
        donation = get_object_or_404(Donation, id=donation_id, payment_mode='BANK_TRANSFER')
        if donation.payment_status == 'SUCCESS':
            return Response({'message': 'Donation already confirmed'}, status=status.HTTP_400_BAD_REQUEST)
        
        donation.payment_status = 'SUCCESS'
        donation.is_verified = True
        donation.save()
        return Response({'message': 'Bank transfer confirmed successfully'}, status=status.HTTP_200_OK)

class VerifyFlutterwavePaymentView(APIView):
    def post(self, request, donation_id):
        transaction_id = request.data.get('transaction_id')
        if not transaction_id:
            return Response({'error': 'transaction_id is required'}, status=status.HTTP_400_BAD_REQUEST)
             
        donation = get_object_or_404(Donation, id=donation_id)
        if donation.payment_status == 'SUCCESS':
            return Response({'message': 'Already verified'}, status=status.HTTP_200_OK)
             
        secret_key = os.environ.get('FLUTTERWAVE_SECRET_KEY', 'dummy-key')
        
        url = f"https://api.flutterwave.com/v3/transactions/{transaction_id}/verify"
        headers = {
             "Authorization": f"Bearer {secret_key}"
        }
        
        if secret_key == 'dummy-key':
            donation.payment_status = 'SUCCESS'
            donation.is_verified = True
            donation.save()
            return Response({'status': 'Mock verified (development)'}, status=status.HTTP_200_OK)
             
        resp = requests.get(url, headers=headers)
        if resp.status_code == 200:
            data = resp.json().get('data', {})
            if data.get('status') == 'successful' and data.get('amount') >= donation.amount:
                donation.payment_status = 'SUCCESS'
                donation.is_verified = True
                donation.save()
                return Response({'status': 'verified'}, status=status.HTTP_200_OK)
        
        donation.payment_status = 'FAILED'
        donation.save()
        return Response({'status': 'failed verification'}, status=status.HTTP_400_BAD_REQUEST)

class RequestLoginCodeView(APIView):
    def post(self, request):
        email = request.data.get('email')
        if not email or not AdminEmail.objects.filter(email=email, is_active=True).exists():
            # return Response({'message': 'If this email is registered, a code has been sent.'}, status=status.HTTP_200_OK)
            return Response({'message': 'If this email is registered, a code has been sent.'}, status=status.HTTP_400_BAD_REQUEST)
        code = str(random.randint(100000, 999999))
        LoginCode.objects.create(email=email, code=code)
        
        try:
            send_mail(
                'Your Admin Login Code',
                f'Your code is {code}. It expires in 10 minutes.',
                'noreply@theabilitylife.org',
                [email],
                fail_silently=False,
            )
        except Exception as e:
            print(f'Could not send email for RequestLoginCodeView, here is the code for test {code} and error {e}')
            return Response({'message': f'There was a problem sending the email. Error: {e}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
        return Response({'message': 'If this email is registered, a code has been sent.'}, status=status.HTTP_200_OK)

class VerifyLoginCodeView(APIView):
    def post(self, request):
        email = request.data.get('email')
        code = request.data.get('code')
        
        if not email or not code:
            return Response({'error': 'Email and code are required.'}, status=status.HTTP_400_BAD_REQUEST)
            
        valid_time = timezone.now() - timedelta(minutes=10)
        login_code = LoginCode.objects.filter(email=email, code=code, is_used=False, created_at__gte=valid_time).first()
        
        if login_code:
            login_code.is_used = True
            login_code.save()
            
            user, _ = User.objects.get_or_create(username=email, defaults={'email': email})
            token, _ = Token.objects.get_or_create(user=user)
            
            admin_email = AdminEmail.objects.filter(email=email).first()
            admin_name = admin_email.name if admin_email else 'TALI Staff'
            
            return Response({'token': token.key, 'name': admin_name}, status=status.HTTP_200_OK)
            
        return Response({'error': 'Invalid or expired code.'}, status=status.HTTP_400_BAD_REQUEST)

def get_filtered_transactions(request):
    event_id = request.query_params.get('event_id')
    if event_id:
        event = get_object_or_404(Event, id=event_id)
    else:
        event = get_object_or_404(Event, is_active=True)

    donations = event.donations.all().order_by('-created_at')
    
    search = request.query_params.get('search', '')
    if search:
        donations = donations.filter(
            Q(donor_name__icontains=search) | 
            Q(email__icontains=search) | 
            Q(transaction_reference__icontains=search)
        )
        
    method = request.query_params.get('method', 'All')
    if method != 'All':
        mapped = 'FLUTTERWAVE' if method == 'Flutterwave' else \
                 'BANK_TRANSFER' if method == 'Bank Transfer' else \
                 'MANUAL' if method == 'Manual' else None
        if mapped:
            donations = donations.filter(payment_mode=mapped)
        
    status_param = request.query_params.get('status', 'All')
    if status_param != 'All':
        mapped = 'SUCCESS' if status_param == 'Confirmed' else 'PENDING'
        donations = donations.filter(payment_status=mapped)
        
    date_filter = request.query_params.get('date', 'All')
    now = timezone.now()
    if date_filter == 'Today':
        donations = donations.filter(created_at__date=now.date())
        
    return donations


class AdminOverviewView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        event_id = request.query_params.get('event_id')
        if event_id:
            event = get_object_or_404(Event, id=event_id)
        else:
            event = get_object_or_404(Event, is_active=True)
            
        donations = event.donations.filter(payment_status='SUCCESS')
        all_time_raised = donations.aggregate(Sum('amount'))['amount__sum'] or 0

        date_range = request.query_params.get('range', 'all')
        now = timezone.now()
        if date_range == 'today':
            donations = donations.filter(created_at__date=now.date())
        elif date_range == 'week':
            start_of_week = now - timedelta(days=now.weekday())
            donations = donations.filter(created_at__gte=start_of_week.replace(hour=0, minute=0, second=0))

        total_raised = donations.aggregate(Sum('amount'))['amount__sum'] or 0
        campaign_goal = event.target_amount or 1
        percent_funded = (total_raised / campaign_goal) * 100
        
        donor_count = donations.count()
        anonymous_count = donations.filter(is_anonymous=True).count()
        
        flutterwave_amount = donations.filter(payment_mode='FLUTTERWAVE').aggregate(Sum('amount'))['amount__sum'] or 0
        bank_amount = donations.filter(payment_mode='BANK_TRANSFER').aggregate(Sum('amount'))['amount__sum'] or 0

        # Calculate 'today' specifically for the +85,000 Today badge shown in mock
        today_donations = event.donations.filter(payment_status='SUCCESS', created_at__date=now.date())
        today_raised = today_donations.aggregate(Sum('amount'))['amount__sum'] or 0

        return Response({
            'total_raised': total_raised,
            'all_time_raised': all_time_raised,
            'today_raised': today_raised,
            'campaign_goal': campaign_goal,
            'percent_funded': percent_funded,
            'donor_count': donor_count,
            'anonymous_count': anonymous_count,
            'methods': {
                'FLUTTERWAVE': flutterwave_amount,
                'BANK_TRANSFER': bank_amount
            }
        })


class TriggerCelebrationView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, event_id):
        event = get_object_or_404(Event, id=event_id)
        event.celebration_count += 1
        event.save()
        return Response({'success': True, 'celebration_count': event.celebration_count})


from rest_framework.pagination import LimitOffsetPagination

class AdminTransactionsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        donations = get_filtered_transactions(request)
        
        paginator = LimitOffsetPagination()
        paginator.default_limit = 12
        paginated_donations = paginator.paginate_queryset(donations, request)
        
        serializer = AdminDonationSerializer(paginated_donations, many=True)
        return paginator.get_paginated_response(serializer.data)

class ManualDonationView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        event_id = request.data.get('event')
        if event_id:
            event = get_object_or_404(Event, id=event_id)
        else:
            event = Event.objects.filter(is_active=True).first()
            if not event:
                 return Response({"error": "No active event found"}, status=status.HTTP_404_NOT_FOUND)

        payment_mode = request.data.get('payment_mode', 'MANUAL')
        serializer = DonationCreateSerializer(data=request.data)
        if serializer.is_valid():
            donation = serializer.save(
                event=event,
                payment_mode=payment_mode,
                payment_status='SUCCESS',
                is_verified=True
            )
            return Response(AdminDonationSerializer(donation).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class DonationUpdateView(APIView):
    def patch(self, request, donation_id):
        donation = get_object_or_404(Donation, id=donation_id)
        serializer = DonationCreateSerializer(donation, data=request.data, partial=True)
        if serializer.is_valid():
            updated_donation = serializer.save()
            return Response(AdminDonationSerializer(updated_donation).data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class VerifyFlutterwaveByRefView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, donation_id):
        donation = get_object_or_404(Donation, id=donation_id, payment_mode='FLUTTERWAVE')
        if donation.payment_status == 'SUCCESS':
            return Response({'message': 'Already verified'}, status=status.HTTP_200_OK)
            
        secret_key = os.environ.get('FLUTTERWAVE_SECRET_KEY', 'dummy-key')
        if secret_key == 'dummy-key':
            donation.payment_status = 'SUCCESS'
            donation.is_verified = True
            donation.save()
            return Response({'status': 'Mock verified (development)'}, status=status.HTTP_200_OK)
            
        url = f"https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref={donation.transaction_reference}"
        resp = requests.get(url, headers={"Authorization": f"Bearer {secret_key}"})
        if resp.status_code == 200:
            data = resp.json().get('data', {})
            if data.get('status') == 'successful' and data.get('amount') >= donation.amount:
                donation.payment_status = 'SUCCESS'
                donation.is_verified = True
                donation.save()
                return Response({'status': 'verified'}, status=status.HTTP_200_OK)
                
        return Response({'status': 'Not successful on Flutterwave'}, status=status.HTTP_400_BAD_REQUEST)

class AdminTransactionsExportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        donations = get_filtered_transactions(request)
        
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="transactions.csv"'
        
        writer = csv.writer(response)
        writer.writerow(['Date', 'Donor Name', 'Email', 'Phone', 'Anonymous', 'Amount (NGN)', 'Method', 'Status', 'Transaction Ref'])
        
        for don in donations:
            writer.writerow([
                don.created_at.strftime('%Y-%m-%d %H:%M:%S'),
                don.donor_name if not don.is_anonymous else 'Hidden',
                don.email if not don.is_anonymous else 'Hidden',
                don.phone,
                'Yes' if don.is_anonymous else 'No',
                don.amount,
                don.payment_mode,
                don.payment_status,
                don.transaction_reference
            ])
            
        return response

class AdminEventListView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        events = Event.objects.all().order_by('-id')
        data = [{'id': e.id, 'title': e.title, 'is_active': e.is_active} for e in events]
        return Response(data, status=status.HTTP_200_OK)


@api_view(['POST'])
def flutterwave_webhook(request):
    secret_hash = os.environ.get('FLUTTERWAVE_WEBHOOK_HASH', '')
    signature = request.headers.get('verif-hash', '')
    
    if secret_hash and signature != secret_hash:
        return Response(status=status.HTTP_401_UNAUTHORIZED)
        
    payload = request.data
    
    if payload.get('event') == 'charge.completed' and payload.get('data', {}).get('status') == 'successful':
        tx_ref = payload['data']['tx_ref']
        try:
            donation = Donation.objects.get(transaction_reference=tx_ref)
            if donation.payment_status != 'SUCCESS':
                donation.payment_status = 'SUCCESS'
                donation.is_verified = True
                donation.save()
                return Response({'status': 'Payment verified'}, status=status.HTTP_200_OK)
        except Donation.DoesNotExist:
            return Response({'error': 'Donation not found'}, status=status.HTTP_404_NOT_FOUND)
            
    return Response(status=status.HTTP_200_OK)

import time
import json

def active_sse_event_stream(request):
    event = Event.objects.filter(is_active=True).first()
    if event:
        return sse_event_stream(request, event.id)
    def err_stream():
        yield "data: {\"error\": \"No active event\"}\n\n"
    return StreamingHttpResponse(err_stream(), content_type='text/event-stream')

def sse_event_stream(request, event_id):
    def event_stream():
        last_donation_id = 0
        last_count = -1
        last_celebration_count = -1
        start_time = time.time()
        max_duration = 300  # 5 minute max connection, client will reconnect
        
        while True:
            # Enforce max connection duration
            if time.time() - start_time > max_duration:
                yield f"event: reconnect\ndata: {json.dumps({'message': 'Connection timeout, please reconnect'})}\n\n"
                break

            try:
                event = Event.objects.filter(id=event_id, is_active=True).first()
                if not event:
                    yield f"event: error\ndata: {json.dumps({'message': 'Event not found'})}\n\n"
                    break
                    
                successful_donations = event.donations.filter(payment_status='SUCCESS')
                current_count = successful_donations.count()
                current_celebration_count = event.celebration_count
                
                if current_count != last_count or current_celebration_count != last_celebration_count:
                    aggregates = successful_donations.aggregate(
                        raised_amount=Sum('amount'),
                        highest_donation=Max('amount')
                    )
                    
                    new_donations = successful_donations.filter(id__gt=last_donation_id).order_by('id')
                    new_donation_data = []
                    for don in new_donations:
                        new_donation_data.insert(0, {
                            'id': don.id,
                            'donor_display': "Anonymous" if don.is_anonymous else (don.donor_name or "Unknown"),
                            'amount': str(don.amount),
                            'created_at': don.created_at.isoformat()
                        })
                        last_donation_id = max(last_donation_id, don.id)
                    
                    highest_donor_record = successful_donations.order_by('-amount').first()
                    highest_donor = "Anonymous"
                    if highest_donor_record:
                        highest_donor = "Anonymous" if highest_donor_record.is_anonymous else (highest_donor_record.donor_name or "Unknown")
                    
                    raised_amount = aggregates['raised_amount'] or 0
                    
                    milestone_msg = None
                    if event.target_amount and event.target_amount > 0:
                        percent = (raised_amount / event.target_amount) * 100
                        if percent >= 100:
                            milestone_msg = "Goal Achieved! Thank you to all donors!"
                        elif percent >= 75:
                            milestone_msg = "We're 75% there! Let's keep going!"
                        elif percent >= 50:
                            milestone_msg = "Halfway to our goal!"

                    data = {
                        'raised_amount': str(raised_amount),
                        'donation_count': current_count,
                        'highest_donation': str(aggregates['highest_donation'] or 0),
                        'highest_donor': highest_donor,
                        'new_donations': new_donation_data,
                        'milestone': milestone_msg,
                        'celebration_count': current_celebration_count
                    }
                    
                    yield f"data: {json.dumps(data)}\n\n"
                    last_count = current_count
                    last_celebration_count = current_celebration_count
                else:
                    yield ": heartbeat\n\n"
            except Exception as e:
                # Transient DB error — don't kill the stream
                yield f": error-recovery\n\n"
                time.sleep(5)
                continue
                
            time.sleep(3)

    response = StreamingHttpResponse(event_stream(), content_type='text/event-stream')
    response['Cache-Control'] = 'no-cache'
    response['X-Accel-Buffering'] = 'no'
    return response

def execute_alwaysdata_deploy():
    try:
        print("Starting alwaysdata deployment...")
        # 1. git pull
        subprocess.run(["git", "pull", "origin", "main"], cwd=settings.BASE_DIR, check=True)
        print("Git pull successful")
        
        # 2. pip install
        subprocess.run([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"], cwd=settings.BASE_DIR, check=True)
        print("Pip install successful")
        
        # 3. manage.py migrate
        subprocess.run([sys.executable, "manage.py", "migrate"], cwd=settings.BASE_DIR, check=True)
        print("Migrate successful")
        
        # 4. manage.py collectstatic
        subprocess.run([sys.executable, "manage.py", "collectstatic", "--noinput"], cwd=settings.BASE_DIR, check=True)
        print("Collectstatic successful")
        
        # 5. Restart site via alwaysdata API
        api_key = os.environ.get('ALWAYSDATA_API_KEY')
        site_id = os.environ.get('ALWAYSDATA_SITE_ID')
        if api_key and site_id:
            response = requests.post(f"https://api.alwaysdata.com/v1/site/{site_id}/restart/", auth=(api_key, ''))
            print(f"Alwaysdata restart API response: {response.status_code}")
        else:
            print("Skipped server restart: ALWAYSDATA_API_KEY or ALWAYSDATA_SITE_ID env var is missing.")
            
    except Exception as e:
        print(f"Deployment process failed: {e}")

class GithubWebhookDeployView(APIView):
    """
    Webhook endpoint to trigger auto-deploy from GitHub.
    Accepts POST requests, validates the signature, and runs the deploy in a background thread.
    """
    def post(self, request):
        secret = os.environ.get('GITHUB_WEBHOOK_SECRET')
        if not secret:
            return Response({'error': 'Webhook secret not configured'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
        signature_header = request.headers.get('X-Hub-Signature-256')
        if not signature_header:
            return Response({'error': 'Missing signature'}, status=status.HTTP_401_UNAUTHORIZED)
            
        # Validate signature
        hash_object = hmac.new(secret.encode('utf-8'), msg=request.body, digestmod=hashlib.sha256)
        expected_signature = "sha256=" + hash_object.hexdigest()
        
        if not hmac.compare_digest(expected_signature, signature_header):
            return Response({'error': 'Invalid signature'}, status=status.HTTP_403_FORBIDDEN)
            
        # Trigger background deployment
        threading.Thread(target=execute_alwaysdata_deploy).start()
        
        return Response({'status': 'Deployment started'}, status=status.HTTP_200_OK)


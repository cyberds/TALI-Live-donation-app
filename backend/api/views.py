import os
import requests
from django.db.models import Sum, Max, Count
from django.shortcuts import get_object_or_404
from django.http import StreamingHttpResponse
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Event, Donation
from .serializers import EventSummarySerializer, RecentDonationSerializer, DonationCreateSerializer

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

class DonationCreateView(APIView):
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
    def post(self, request, donation_id):
        # NOTE: In production, protect this endpoint with appropriate permissions
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

def sse_event_stream(request, event_id):
    def event_stream():
        last_donation_id = 0
        last_count = -1
        
        while True:
            event = Event.objects.filter(id=event_id, is_active=True).first()
            if not event:
                yield f"event: error\ndata: {json.dumps({'message': 'Event not found'})}\n\n"
                break
                
            successful_donations = event.donations.filter(payment_status='SUCCESS')
            current_count = successful_donations.count()
            
            if current_count != last_count:
                aggregates = successful_donations.aggregate(
                    raised_amount=Sum('amount'),
                    highest_donation=Max('amount')
                )
                
                new_donations = successful_donations.filter(id__gt=last_donation_id).order_by('id')
                new_donation_data = []
                for don in new_donations:
                    new_donation_data.append({
                        'id': don.id,
                        'donor_display': "Anonymous" if don.is_anonymous else (don.donor_name or "Unknown"),
                        'amount': str(don.amount),
                        'created_at': don.created_at.isoformat()
                    })
                    last_donation_id = don.id
                
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
                    'milestone': milestone_msg
                }
                
                yield f"data: {json.dumps(data)}\n\n"
                last_count = current_count
            else:
                yield ": heartbeat\n\n"
                
            time.sleep(2)

    response = StreamingHttpResponse(event_stream(), content_type='text/event-stream')
    response['Cache-Control'] = 'no-cache'
    response['X-Accel-Buffering'] = 'no'
    return response

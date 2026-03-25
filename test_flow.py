import requests

print("Creating donation...")
r = requests.post('http://127.0.0.1:8000/api/donations/', json={
    'event':1, 
    'donor_name':'Test User', 
    'email':'test@example.com', 
    'amount':5000, 
    'payment_mode':'BANK_TRANSFER', 
    'is_anonymous':False
})
print("Result:", r.status_code, r.text)

if r.status_code == 201:
    d_id = r.json().get('id')
    print("Confirming transfer...", d_id)
    r2 = requests.post(f'http://127.0.0.1:8000/api/donations/{d_id}/confirm-transfer/')
    print("Result:", r2.status_code, r2.text)

    print("Fetching summary...")
    r3 = requests.get('http://127.0.0.1:8000/api/events/1/summary/')
    print("Result:", r3.status_code, r3.text)

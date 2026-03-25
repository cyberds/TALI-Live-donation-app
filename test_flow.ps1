$ErrorActionPreference = 'Stop'

echo "Testing Donation Creation..."
$res1 = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/donations/" -Method Post -Body '{"event":1, "donor_name":"Test User", "email":"test@example.com", "amount":5000, "payment_mode":"BANK_TRANSFER", "is_anonymous":false}' -ContentType "application/json"
echo $res1 | ConvertTo-Json

$donId = $res1.id

echo "Testing Bank Transfer Manual Confirmation..."
$res2 = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/donations/$donId/confirm-transfer/" -Method Post
echo $res2 | ConvertTo-Json

echo "Testing Live Event Summary..."
$res3 = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/events/1/summary/" -Method Get
echo $res3 | ConvertTo-Json

echo "All tests passed successfully!"

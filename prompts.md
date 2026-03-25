## Prompt 1 — Project setup and structure
Set up the project structure for the TALI live donation system using Next.js for the frontend and Django + DRF for the backend. Keep the architecture simple and clean. Do not implement business logic yet. Create the minimum scaffolding needed for:
- donor page
- admin dashboard
- live screen
- backend API
- SSE endpoint placeholder

Return a summary of folders, files, and routing decisions. Do not do unrelated refactors.


## Prompt 2 — Data models
Implement the core Django models for events and donations. Include fields for donor identity, anonymity, amount, payment mode, status, transaction reference, and timestamps. Add admin registrations and basic validation. Keep the model design simple and production-friendly. Do not build frontend UI yet.


## Prompt 3 — Donation API
Build the backend REST endpoints for:
- creating a donation record
- retrieving event donation summary
- retrieving recent donations
- confirming bank transfer donations manually
- verifying Flutterwave payment callbacks/webhooks

Make sure the API returns only what the frontend needs. Keep the response shapes stable and simple.


## Prompt 4 — SSE live updates
Implement Server-Sent Events in Django for live donation updates. Create one stream endpoint for the admin dashboard and live screen. The stream should push:
- new donations
- updated totals
- donor count changes
- top donor changes
- milestone messages

Keep the implementation lightweight, resilient, and easy to reconnect to. Do not introduce WebSockets.


## Prompt 5 — Donor page UI
Build the donor landing page in Next.js. It should include:
- short donation message
- link to what the money will be used for
- donor form
- anonymity option
- Flutterwave payment action
- copyable bank account details

Optimize for mobile. Keep the form short and conversion-focused. Do not build admin or live screen UI yet.


## Prompt 6 — Payment flow
Connect the donor page to Flutterwave payment flow. When a payment succeeds, ensure the backend records the donation only after verification. Handle success, failure, and abandoned payment states cleanly. Do not implement SSE UI in this task.


## Prompt 7 — Admin dashboard
Build the admin dashboard UI for staff. Show all donations in a clean table with:
- name
- email
- phone
- anonymity
- amount
- mode of transfer
- status
- timestamp

Add live toast notifications for new donations using the SSE stream. Keep the dashboard practical and easy to scan.



## Prompt 8 — Event screen UI
Build the large-screen live donation page. It should show:
- target amount
- total raised
- amount left
- donation count
- highest donor
- highest single donation
- short donation instructions
- scrollable recent donor cards

Use a strong visual progress component and make the page readable from a distance. Do not let announcement cards overlap.


## Prompt 9 — Donation announcement cards
Implement the floating donation announcement behavior on the event screen. Each new donation should appear as a card for a few seconds and then disappear. Multiple cards may exist at the same time, but they must be stacked cleanly without overlap. Hide donor identity whenever anonymity is selected.


## Prompt 10 — Polish, testing, and edge cases
Review the whole system for:
- anonymous donor handling
- duplicate donation prevention
- failed payment handling
- bank transfer confirmation flow
- SSE reconnect behavior
- responsive layout issues
- empty-state handling
- loading states
- accessibility basics

Only make targeted fixes. Do not expand scope.
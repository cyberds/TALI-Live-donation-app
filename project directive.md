# TALI Live Donation System — Implementation Directive

## Purpose
Build a live donation web app for TALI’s event. The system must let attendees scan a QR code on their table, land on a donation page, donate quickly, optionally leave their details, choose anonymity, and trigger live updates on an admin dashboard and an event screen.

## Long form description
I want to build a web app for a live donation programme that an NGO called TALI (https://www.theabilitylife.org/) will be organising shortly.
The participants will see a QR Code on their table that leads to a web page that will have a short message encouraging them to donate, a link to what the money will be used for, a payment link controlled by flutterwave SDK, and copiable account details (number, name) in case they prefer to make a transfer from their mobile bank apps. They will also be able to put their names, contact details (email, phone) and there should be a step in the form that asks them if they want their name to be announced or anonymous. 
There should be an admin dashboard for the staff where they will be able to see all the donations that are made (name, contact details, anonimity, amount, mode of transfer). There should also be toast notifications that shows up each time there is a new donation.
There should also be a main page for the event's large screen which will show the live donation. It will show the target amount, a beautiful color coded bar or a coin jar with coins adding in based on how much has been donated and how much is left. There should be other information like how many people has donated, who the highest donor is, the highest amount that has been donated by a single person. A small instruction of how to donate. On a part of the page should be a scrollable section showing the people who has donated in cards, the latest first.  Each time anyone donates, a card should show up for a few seconds displaying the person (if not set to anonymous) and the amount. With this you know multiple of these announcement cards may appear at the same time, we don't want them to overlap each other.

## Primary Goals
1. Make donating fast and simple on mobile.
2. Support payment by Flutterwave and by bank transfer.
3. Capture donor identity only if they choose to provide it.
4. Show real-time donation updates on admin and live event screens.
5. Keep the system reliable, lightweight, and event-friendly.
6. Use Server-Sent Events (SSE) for real-time updates becasue of its simplicity.

## Recommended Stack
- Frontend: Next.js
- Backend: Django + Django REST Framework
- Real-time: SSE from Django
- Database: PostgreSQL
- Email: ZeptoMail
- Payments: Flutterwave SDK + Flutterwave webhook verification
- Styling: modern responsive UI with mobile-first design
- Optional: Redis only if needed for event fanout/caching, but keep the first version simple

## Core User Flows

### 1. Donor Flow
- User scans QR code.
- Lands on a donation page with:
  - short emotional message
  - link to the funding purpose / what the money will be used for
  - donation form
  - Flutterwave payment option
  - copyable bank account details for direct transfer
- Form collects:
  - name
  - email
  - phone
  - anonymity choice: announce name or anonymous
- Donor submits payment or transfer intent.
- On success, the system records the donation and updates live screens in real time.

### 2. Admin Flow
- Staff log into dashboard.
- They can see all donations in real time.
- Each donation shows:
  - name
  - email
  - phone
  - anonymity choice
  - amount
  - mode of transfer
  - status
  - timestamp
- Toast notifications appear whenever a new donation arrives.
- Admin can monitor totals and recent activity.

### 3. Live Event Screen Flow
- A large screen page shows:
  - target amount
  - total raised
  - amount left
  - donation count
  - highest donor
  - highest single donation
  - short donation instructions
  - scrollable list of recent donors
- A visual progress component must be prominent:
  - either a colored progress bar
  - or an animated coin jar
- New donations should appear as floating announcement cards.
- Multiple cards may be visible at once, but they must not overlap.
- Cards should auto-dismiss after a few seconds.

## UX Requirements
- Mobile-first and fast-loading.
- Donation flow must feel minimal and low-friction.
- Keep the form short and clear.
- Support anonymous donation without friction.
- Make the live screen feel exciting but not cluttered.
- Use motion sparingly and only where it helps the event atmosphere.
- Large-screen UI must be readable from far away.
- Use clear hierarchy: total, progress, recent donors, highlights.
- Brand colors #1F305C, #D24B25, #9BCB6C

## Gamification Ideas
- Display percent toward target.
- Show milestone messages at key thresholds.
- Highlight recent donations as social proof.
- Emphasize top donor and largest contribution.
- Use subtle celebratory animation when milestones are reached.

## Technical Requirements
- Use Django as the source of truth.
- Use Flutterwave webhook verification before marking card payments as successful.
- Bank transfers must be recorded as pending until staff confirms them.
- SSE must push updates from backend to:
  - admin dashboard
  - live screen
- Ensure anonymous donors are hidden wherever anonymity is selected.
- Avoid duplicate donation records.
- Create clear event and donation models.
- Build robust error handling for failed payments, invalid input, and network issues.

## Data to Capture
Donation:
- id
- event
- donor_name
- email
- phone
- anonymous flag
- amount
- payment mode
- payment status
- transaction reference
- is_verified
- created_at

Event:
- name
- title
- target_amount
- bank_name
- account_name
- account_number
- purpose link
- active flag

## SSE Behavior
- Create an SSE endpoint for live donation updates.
- The endpoint should stream:
  - new donation events
  - total raised updates
  - donor count updates
  - top donor updates
  - milestone updates
- Keep the stream resilient and lightweight.
- Reconnect gracefully on client-side disconnects.
- Use a simple event payload format that the frontend can consume easily.

## Acceptance Criteria
- A donor can scan QR and complete donation flow on mobile.
- Staff can see live donation activity in the admin dashboard.
- The event screen updates without refresh.
- Anonymous donors do not have their names displayed publicly.
- Flutterwave payments are verified before success is recorded.
- Bank transfer donations can be tracked and confirmed.
- The UI looks polished on both phones and large displays.

## Implementation Rules
- Do not do unrelated refactors.
- Do not rename things unless necessary.
- Keep changes small and testable.
- Prefer clarity over cleverness.
- Stop after the requested scope is complete.
- Report what changed and what still needs work.
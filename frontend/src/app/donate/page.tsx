"use client";

import React, { useState, useEffect } from 'react';
import Script from 'next/script';
import './../globals.css';
import './donate-theme.css';

interface ActiveEvent {
  id: number;
  bank_name: string | null;
  account_name: string | null;
  account_number: string | null;
}

export default function DonatePage() {
  const [amount, setAmount] = useState<number | ''>('');
  const [isCustom, setIsCustom] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const [loading, setLoading] = useState(false);
  const [paymentState, setPaymentState] = useState<'SUCCESS' | 'FAILED' | 'ABANDONED' | null>(null);
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferRef, setTransferRef] = useState<string | null>(null);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [activeDonationId, setActiveDonationId] = useState<number | null>(null);

  // Dynamically loaded event data (bank info + ID)
  const [activeEvent, setActiveEvent] = useState<ActiveEvent | null>(null);
  const [formStep, setFormStep] = useState<1 | 2 | 3>(1);
  const hasAmount = Number(amount) > 0;
  const hasIdentity = Boolean(name.trim() && email.trim());

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/events/active/summary/`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && data.id) {
          setActiveEvent({
            id: data.id,
            bank_name: data.bank_name || null,
            account_name: data.account_name || null,
            account_number: data.account_number || null,
          });
        }
      })
      .catch(() => { });
  }, []);

  const handleCopy = () => {
    if (!activeEvent?.account_number) return;
    try {
      navigator.clipboard.writeText(activeEvent.account_number);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = activeEvent.account_number;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAmountSelect = (val: number) => {
    setAmount(val);
    setIsCustom(false);
  };

  const goToDetailsStep = () => {
    if (!hasAmount) return;
    setFormStep(2);
  };

  const goToReviewStep = async () => {
    if (!hasIdentity) return;
    setTransferError(null);
    setLoading(true);

    try {
      if (activeDonationId) {
        // Update existing intent
        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/donations/${activeDonationId}/`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            donor_name: name,
            email,
            phone,
            is_anonymous: isAnonymous,
            amount,
            payment_mode: 'INTENT'
          })
        });
      } else {
        // Create new intent
        const data = await createDonation('INTENT');
        setActiveDonationId(data.id);
      }
      setFormStep(3);
    } catch (err) {
      console.error("Failed to save intent:", err);
    } finally {
      setLoading(false);
    }
  };

  const createDonation = async (paymentMode: 'FLUTTERWAVE' | 'BANK_TRANSFER' | 'INTENT') => {
    if (!activeEvent) {
      throw new Error('No active event found');
    }
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/donations/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: activeEvent.id,
        donor_name: name,
        email,
        phone,
        is_anonymous: isAnonymous,
        amount,
        payment_mode: paymentMode
      })
    });
    if (!res.ok) {
      throw new Error('Could not initialize donation instance.');
    }
    return res.json();
  };

  const handleFlutterwavePayment = async () => {
    if (!amount || !email) return;

    setLoading(true);
    setPaymentState(null);

    try {
      let currentDonationId = activeDonationId;
      let transactionReference = '';

      if (currentDonationId) {
        // Update intent to FLUTTERWAVE
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/donations/${currentDonationId}/`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payment_mode: 'FLUTTERWAVE' })
        });
        const data = await res.json();
        transactionReference = data.transaction_reference;
      } else {
        const data = await createDonation('FLUTTERWAVE');
        currentDonationId = data.id;
        transactionReference = data.transaction_reference;
      }

      // 2. Guard: Check if Flutterwave SDK loaded
      // @ts-ignore
      if (typeof FlutterwaveCheckout === 'undefined') {
        setPaymentState('FAILED');
        setLoading(false);
        return;
      }

      // 3. Open FlutterwaveCheckout modal
      // @ts-ignore
      FlutterwaveCheckout({
        public_key: process.env.NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY || "FLWPUBK_TEST-dummy-key",
        tx_ref: transactionReference,
        amount: amount,
        currency: "NGN",
        payment_options: "card,banktransfer,ussd",
        customer: {
          email: email,
          phone_number: phone,
          name: isAnonymous ? 'Anonymous Donor' : name,
        },
        customizations: {
          title: "ART FOR ABILITY",
          description: "Creative Inclusion & Enterprise Auction — support for TALI.",
          logo: "https://www.theabilitylife.org/favicon.ico",
        },
        callback: async function (payment: any) {
          try {
            const verifyRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/donations/${currentDonationId}/verify/`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ transaction_id: payment.transaction_id })
            });

            if (verifyRes.ok) {
              setPaymentState('SUCCESS');
            } else {
              setPaymentState('FAILED');
            }
          } catch (err) {
            setPaymentState('FAILED');
          }
        },
        onclose: function () {
          setLoading(false);
          setPaymentState(prev => prev === 'SUCCESS' ? 'SUCCESS' : 'ABANDONED');
        }
      });
    } catch (err) {
      console.error(err);
      setPaymentState('FAILED');
      setLoading(false);
    }
  };

  const handleBankTransferDeclaration = async () => {
    if (!amount || !email || !name.trim() || transferLoading) return;
    setTransferLoading(true);
    setTransferError(null);
    try {
      let transactionReference = '';
      if (activeDonationId) {
        // Update intent to BANK_TRANSFER
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/donations/${activeDonationId}/`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payment_mode: 'BANK_TRANSFER' })
        });
        const data = await res.json();
        transactionReference = data.transaction_reference;
      } else {
        const data = await createDonation('BANK_TRANSFER');
        transactionReference = data.transaction_reference;
      }
      setTransferRef(transactionReference || null);
    } catch (err) {
      setTransferError('Could not submit your transfer notice right now. Please try again.');
    } finally {
      setTransferLoading(false);
    }
  };

  // Render a success screen if payment verified
  if (paymentState === 'SUCCESS') {
    return (
      <div className="art-for-ability donate-page">
        <div className="donate-bg-layer" />
        <main className="donate-stage" style={{ gridTemplateColumns: '1fr' }}>
          <section className="donate-panel" style={{ padding: '3rem 2rem', textAlign: 'center', maxWidth: '540px', margin: 'auto' }}>
            <div style={{ fontSize: '64px', color: 'var(--sage)', marginBottom: '1rem' }}>✓</div>
            <h1 style={{ fontFamily: '"Cormorant Garamond", serif', fontSize: '2.5rem', margin: '0 0 1rem' }}>Thank You!</h1>
            <p style={{ fontSize: '1.1rem', lineHeight: '1.6', color: 'rgba(31, 27, 22, 0.8)', marginBottom: '2rem' }}>
              Your generous donation has been securely received and recorded.
              Together we are bridging the gap for persons living with disabilities.
            </p>
            <button className="btn-primary" onClick={() => { setPaymentState(null); setAmount(''); }} style={{ width: 'auto', padding: '0.8rem 2rem' }}>
              Make another donation
            </button>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="art-for-ability donate-page">
      <Script src="https://checkout.flutterwave.com/v3.js" strategy="lazyOnload" />

      <main className="donate-stage">
        <div className="donate-bg-layer" aria-hidden />
        <section className="donate-art-col" aria-hidden>
          <img src="/TALI MAIN PIC.png" alt="TALI signature artwork" className="donate-art-image" />
        </section>

        <section className="donate-panel donate-panel--form">
          <a className="donate-hero__logo-link" href="https://www.theabilitylife.org" target="_blank" rel="noopener noreferrer">
            <img src="/tali-logo.avif" alt="TALI Logo" className="donate-hero__logo" />
          </a>
          <div className="donate-form__header">
            {/* <p className="donate-hero__eyebrow">The Ability Life Initiative</p> */}
            <h2>Donate Securely</h2>
            <p>Your support funds seed grants and opportunities for entrepreneurs living with disabilities across Nigeria.</p>
          </div>

          <ol className="donate-steps-indicator" aria-label="Donation steps">
            <li className={`step-item ${formStep >= 1 ? 'is-active' : ''} ${formStep > 1 ? 'is-complete' : ''}`}>
              <span className="step-dot">1</span>
              <span className="step-text">Amount</span>
            </li>
            <li className={`step-item ${formStep >= 2 ? 'is-active' : ''} ${formStep > 2 ? 'is-complete' : ''}`}>
              <span className="step-dot">2</span>
              <span className="step-text">Details</span>
            </li>
            <li className={`step-item ${formStep >= 3 ? 'is-active' : ''}`}>
              <span className="step-dot">3</span>
              <span className="step-text">Payment</span>
            </li>
          </ol>

          {paymentState === 'ABANDONED' && (
            <div className="notice notice--warning">
              Payment cancelled. You can continue whenever you are ready.
            </div>
          )}
          {paymentState === 'FAILED' && (
            <div className="notice notice--error">
              There was an issue processing your payment. Please try again.
            </div>
          )}

          <form className="donate-form" onSubmit={(e) => e.preventDefault()}>
            {formStep === 1 && (
              <>
                <div className="donate-form__section">
                  <label htmlFor="custom-amount" className="form-label">Choose amount (NGN)</label>
                  <div className="amount-grid">
                    <button
                      type="button"
                      className={`amount-btn ${amount === 1000000 && !isCustom ? 'active' : ''}`}
                      onClick={() => handleAmountSelect(1000000)}
                    >₦1.0M</button>
                    <button
                      type="button"
                      className={`amount-btn ${amount === 5000000 && !isCustom ? 'active' : ''}`}
                      onClick={() => handleAmountSelect(5000000)}
                    >₦5.0M</button>
                    <button
                      type="button"
                      className={`amount-btn ${amount === 10000000 && !isCustom ? 'active' : ''}`}
                      onClick={() => handleAmountSelect(10000000)}
                    >₦10M</button>
                  </div>
                  <input
                    id="custom-amount"
                    type="number"
                    className="form-input"
                    placeholder="Or enter custom amount"
                    value={amount}
                    onChange={(e) => {
                      setIsCustom(true);
                      setAmount(e.target.value ? Number(e.target.value) : '');
                    }}
                    onClick={() => setIsCustom(true)}
                    min={100}
                  />
                  {hasAmount ? <p className="field-hint">Selected amount: ₦{Number(amount).toLocaleString()}</p> : null}
                </div>
                <div className="wizard-actions">
                  <button type="button" className="btn-primary" disabled={!hasAmount} onClick={goToDetailsStep}>
                    Next: Donor details
                  </button>
                </div>
              </>
            )}

            {formStep === 2 && (
              <>
                <div className="donate-form__fields">
                  <div className="form-group">
                    <label htmlFor="donor-name" className="form-label">Full Name</label>
                    <input
                      id="donor-name"
                      type="text"
                      className="form-input"
                      placeholder="e.g. John Doe"
                      required
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        if (!e.target.value.trim()) setIsAnonymous(false);
                      }}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="donor-email" className="form-label">Email Address</label>
                    <input
                      id="donor-email"
                      type="email"
                      className="form-input"
                      placeholder="john@example.com"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="donor-phone" className="form-label">Phone Number (Optional)</label>
                    <input
                      id="donor-phone"
                      type="tel"
                      className="form-input"
                      placeholder="+234 XXX XXXX"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>

                  <div className="donate-form__section donate-form__section--compact">
                    <label className="checkbox-group" htmlFor="anonymous-check">
                      <input
                        id="anonymous-check"
                        type="checkbox"
                        checked={isAnonymous}
                        disabled={!name.trim()}
                        onChange={(e) => setIsAnonymous(e.target.checked)}
                      />
                      <span>Keep my donation anonymous publicly</span>
                    </label>
                  </div>
              </div>
                <div className="wizard-actions">
                  <button type="button" className="btn-secondary wizard-btn" onClick={() => setFormStep(1)}>
                    Back
                  </button>
                  <button type="button" className="btn-primary wizard-btn" disabled={!hasIdentity} onClick={goToReviewStep}>
                    Next: Payment
                  </button>
                </div>
              </>
            )}

            {formStep === 3 && (
              <>
                <div className="payment-choice-grid">
                  <section className="payment-option-card payment-option-card--online">
                    <p className="payment-option-label">Option 1</p>
                    <h3>Pay online now</h3>
                    <p>Instant confirmation via secure Flutterwave checkout.</p>
                    <button
                      type="button"
                      className="btn-primary donate-submit"
                      disabled={!hasAmount || !hasIdentity || loading || transferLoading}
                      onClick={handleFlutterwavePayment}
                    >
                      {loading ? 'Opening checkout...' : `Pay ₦${Number(amount || 0).toLocaleString()} online`}
                    </button>
                  </section>

                  <section className="payment-option-card payment-option-card--transfer">
                    <p className="payment-option-label">Option 2</p>
                    <h3>Bank transfer</h3>
                    <p>Transfer to the account below, then notify us immediately.</p>
                    <div className="bank-details">
                      <div className="bank-name">{activeEvent?.bank_name || 'Bank details unavailable'}</div>
                      <div className="account-number">{activeEvent?.account_number || '—'}</div>
                      <div className="account-name">{activeEvent?.account_name || '—'}</div>
                    </div>
                    <button
                      type="button"
                      className="btn-secondary bank-copy-btn"
                      onClick={handleCopy}
                      disabled={!activeEvent?.account_number}
                    >
                      {copied ? 'Account copied' : 'Copy account number'}
                    </button>
                    <button
                      type="button"
                      className="btn-primary transfer-confirm-btn"
                      disabled={!activeEvent?.account_number || !hasAmount || !hasIdentity || transferLoading || loading}
                      onClick={handleBankTransferDeclaration}
                    >
                      {transferLoading ? 'Submitting...' : "I've made the transfer"}
                    </button>
                    {transferRef ? (
                      <p className="transfer-feedback success">
                        Transfer notice submitted. Reference: <strong>{transferRef}</strong>
                      </p>
                    ) : null}
                    {transferError ? <p className="transfer-feedback error">{transferError}</p> : null}
                  </section>
                </div>
                <div className="wizard-actions">
                  <button type="button" className="btn-secondary wizard-btn" onClick={() => setFormStep(2)}>
                    Back
                  </button>
                </div>
              </>
            )}
          </form>
        </section>
      </main>

      <footer className="donate-footer">
        &copy; {new Date().getFullYear()} The Ability Life Initiative. All rights reserved.
      </footer>
    </div>
  );
}

"use client";

import React, { useState } from 'react';
import Script from 'next/script';
import './../globals.css';

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

  const bankInfo = {
    bank: "Zenith Bank",
    number: "1234567890",
    name: "The Ability Life Initiative"
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(bankInfo.number);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAmountSelect = (val: number) => {
    setAmount(val);
    setIsCustom(false);
  };

  const handleFlutterwavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !email) return;

    setLoading(true);
    setPaymentState(null);

    try {
      // 1. Create a pending donation intent in the backend
      const res = await fetch('http://127.0.0.1:8000/api/donations/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 1, // Assumes event ID 1 exists as the active event
          donor_name: isAnonymous ? '' : name,
          email: email,
          phone: phone,
          is_anonymous: isAnonymous,
          amount: amount,
          payment_mode: 'FLUTTERWAVE'
        })
      });

      if (!res.ok) {
        throw new Error("Could not initialize donation instance.");
      }
      
      const data = await res.json();
      
      // 2. Open FlutterwaveCheckout modal
      // @ts-ignore
      FlutterwaveCheckout({
        public_key: process.env.NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY || "FLWPUBK_TEST-dummy-key",
        tx_ref: data.transaction_reference,
        amount: amount,
        currency: "NGN",
        payment_options: "card,banktransfer,ussd",
        customer: {
          email: email,
          phone_number: phone,
          name: isAnonymous ? 'Anonymous Donor' : name,
        },
        customizations: {
          title: "TALI Donation",
          description: "Generous support for TALI initiatives.",
          logo: "https://www.theabilitylife.org/favicon.ico",
        },
        callback: async function (payment: any) {
          // 3. Verify Payment with backend before assuming success
          try {
            const verifyRes = await fetch(`http://127.0.0.1:8000/api/donations/${data.id}/verify/`, {
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
        onclose: function() {
          // Runs when modal is closed manually
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

  // Render a success screen if payment verified
  if (paymentState === 'SUCCESS') {
    return (
      <div className="container" style={{ textAlign: 'center', paddingTop: '80px' }}>
        <div style={{ fontSize: '48px', color: 'var(--tali-green)', marginBottom: '16px' }}>✓</div>
        <h1 className="title" style={{ fontSize: '32px' }}>Thank You!</h1>
        <p className="subtitle" style={{ fontSize: '16px', margin: '16px 0 32px' }}>
          Your generous donation has been securely received and recorded.
          Together we are bridging the gap for persons living with disabilities.
        </p>
        <button className="btn-secondary" onClick={() => { setPaymentState(null); setAmount(''); }}>
          Make another donation
        </button>
      </div>
    );
  }

  return (
    <>
      <Script src="https://checkout.flutterwave.com/v3.js" strategy="lazyOnload" />
      <div className="container">
        <header className="header">
          <h1 className="title">Make a Difference</h1>
          <p className="subtitle">Your contribution helps us bridge the gap for persons living with disabilities in Nigeria.</p>
          <a href="https://www.theabilitylife.org/what-we-do" target="_blank" rel="noopener noreferrer" className="purpose-link">
            See what we fund &rarr;
          </a>
        </header>

        {paymentState === 'ABANDONED' && (
          <div style={{ padding: '12px', background: '#fff3cd', color: '#856404', borderRadius: '8px', marginBottom: '16px', fontSize: '14px', textAlign: 'center' }}>
            Payment cancelled. You can try again whenever you are ready.
          </div>
        )}
        {paymentState === 'FAILED' && (
          <div style={{ padding: '12px', background: '#f8d7da', color: '#721c24', borderRadius: '8px', marginBottom: '16px', fontSize: '14px', textAlign: 'center' }}>
            There was an issue processing your payment. Please try again.
          </div>
        )}

        <form className="card" onSubmit={handleFlutterwavePayment}>
          <div className="form-group">
            <label htmlFor="custom-amount" className="form-label">Select Amount (NGN)</label>
            <div className="amount-grid">
              <button 
                type="button"
                className={`amount-btn ${amount === 1000 && !isCustom ? 'active' : ''}`}
                onClick={() => handleAmountSelect(1000)}
              >₦1,000</button>
              <button 
                type="button"
                className={`amount-btn ${amount === 5000 && !isCustom ? 'active' : ''}`}
                onClick={() => handleAmountSelect(5000)}
              >₦5,000</button>
              <button 
                type="button"
                className={`amount-btn ${amount === 10000 && !isCustom ? 'active' : ''}`}
                onClick={() => handleAmountSelect(10000)}
              >₦10,000</button>
            </div>
            
            <input 
              id="custom-amount"
              type="number" 
              className="form-input" 
              placeholder="Custom Amount" 
              value={isCustom ? amount : ''}
              onChange={(e) => {
                setIsCustom(true);
                setAmount(e.target.value ? Number(e.target.value) : '');
              }}
              onClick={() => setIsCustom(true)}
            />
          </div>

          <div className="form-group" style={{ margin: '24px 0' }}>
            <label className="checkbox-group" htmlFor="anonymous-check">
              <input 
                id="anonymous-check"
                type="checkbox" 
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
              />
              <span style={{ fontSize: '14px', fontWeight: 500 }}>Make my donation anonymous</span>
            </label>
          </div>

          {!isAnonymous && (
            <div className="form-group">
              <label htmlFor="donor-name" className="form-label">Full Name</label>
              <input id="donor-name" type="text" className="form-input" placeholder="John Doe" required={!isAnonymous} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="donor-email" className="form-label">Email Address</label>
            <input id="donor-email" type="email" className="form-input" placeholder="john@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          <div className="form-group">
            <label htmlFor="donor-phone" className="form-label">Phone Number (Optional)</label>
            <input id="donor-phone" type="tel" className="form-input" placeholder="+234 XXX XXXX" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>

          <div style={{ marginTop: '30px' }}>
            <button 
              type="submit" 
              className="btn-primary" 
              disabled={!amount || loading}
              style={{ opacity: (!amount || loading) ? 0.5 : 1, cursor: (!amount || loading) ? 'not-allowed' : 'pointer' }}
            >
              {loading ? 'Processing...' : `Donate ${amount ? `₦${amount.toLocaleString()}` : ''} securely`}
            </button>
          </div>
        </form>

        <div className="divider">OR</div>

        <div className="card" style={{ padding: '24px 16px' }}>
          <h2 className="title" style={{ fontSize: '18px', textAlign: 'center', marginBottom: '16px' }}>Bank Transfer</h2>
          <div className="bank-details">
            <div className="bank-name">{bankInfo.bank}</div>
            <div className="account-number">{bankInfo.number}</div>
            <div className="account-name">{bankInfo.name}</div>
            
            <button className="btn-secondary" onClick={handleCopy}>
              {copied ? 'Copied!' : 'Copy Account Number'}
            </button>
            <p style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text-secondary)' }}>Include "Donation" in your transfer description.</p>
          </div>
        </div>
      </div>
    </>
  );
}

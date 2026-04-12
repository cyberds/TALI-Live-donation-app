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

  // Dynamically loaded event data (bank info + ID)
  const [activeEvent, setActiveEvent] = useState<ActiveEvent | null>(null);

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

  const handleFlutterwavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !email) return;

    setLoading(true);
    setPaymentState(null);

    try {
      if (!activeEvent) {
        setPaymentState('FAILED');
        setLoading(false);
        return;
      }

      // 1. Create a pending donation intent in the backend
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/donations/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: activeEvent.id,
          donor_name: name,
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
          title: "ART FOR ABILITY",
          description: "Creative Inclusion & Enterprise Auction — support for TALI.",
          logo: "https://www.theabilitylife.org/favicon.ico",
        },
        callback: async function (payment: any) {
          try {
            const verifyRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/donations/${data.id}/verify/`, {
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

  // Render a success screen if payment verified
  if (paymentState === 'SUCCESS') {
    return (
      <div className="art-for-ability">
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
      </div>
    );
  }

  return (
    <div className="art-for-ability">
      <Script src="https://checkout.flutterwave.com/v3.js" strategy="lazyOnload" />

      <nav className="nav-logo">
        <a href="https://www.theabilitylife.org" target="_blank" rel="noopener noreferrer">
          <img src="/tali-logo.avif" alt="TALI Logo" className="tali-logo-img" />
        </a>
      </nav>

      <section className="hero-section">
        <div className="hero-overlay"></div>
        <img src="https://static.wixstatic.com/media/782bc6_037b319d1505496cbd4c70f3e023afb2~mv2.jpg/v1/fit/w_1080,h_717,q_90,enc_avif,quality_auto/782bc6_037b319d1505496cbd4c70f3e023afb2~mv2.jpg" alt="TALI Gala" className="hero-image" />
        <div className="hero-content">
          <div className="hero-logo-wrap">
            <img src="/tali-logo.avif" alt="TALI Logo" className="hero-logo-img" style={{ filter: 'brightness(0) invert(1)' }} />
          </div>
          <p className="hero-eyebrow">The Ability Life Initiative</p>
          <h1 className="hero-title">
            <span className="hero-title-line">ART FOR <span className="hero-title-accent">ABILITY</span></span>
          </h1>
          <p className="hero-subtitle">Where art meets impact — funding dreams and building futures. Your gift supports seed grants for entrepreneurs with disabilities across Nigeria.</p>
        </div>
      </section>

      <div className="container" style={{ position: 'relative', zIndex: 10 }}>
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

        <form className="card glass-card" onSubmit={handleFlutterwavePayment}>
          <header className="header" style={{ marginBottom: 32 }}>
            <h1 className="title" style={{ fontSize: 24 }}>Make a Donation</h1>
            <p className="subtitle">Creative Inclusion &amp; Enterprise Auction — every contribution helps fund seed grants and TALI programmes.</p>
          </header>

          <div className="form-group">
            <label htmlFor="custom-amount" className="form-label">Select Amount (NGN)</label>
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
              placeholder="Enter Other Amount"
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

          <div className="form-group">
            <label htmlFor="donor-name" className="form-label">Full Name</label>
            <input id="donor-name" type="text" className="form-input" placeholder="e.g. John Doe" required={!isAnonymous} value={name} onChange={(e) => setName(e.target.value)} />
          </div>

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
              style={{ padding: '18px', borderRadius: 14, opacity: (!amount || loading) ? 0.5 : 1, cursor: (!amount || loading) ? 'not-allowed' : 'pointer' }}
            >
              {loading ? 'Processing...' : `Donate ${amount ? `₦${amount.toLocaleString()}` : ''} securely`}
            </button>
          </div>

          
        </form>

        {activeEvent?.account_number ? (
          <>
            <div className="divider">OR BANK TRANSFER</div>

            <div className="card" style={{ padding: '32px 24px', borderRadius: 24, border: '1px dashed #d2d2d7' }}>
              <h2 className="title" style={{ fontSize: '18px', textAlign: 'center', marginBottom: '16px' }}>Direct Bank Deposit</h2>
              <div className="bank-details" style={{ background: 'transparent', border: 'none' }}>
                <div className="bank-name">{activeEvent.bank_name}</div>
                <div className="account-number" style={{ fontSize: 28, margin: '12px 0' }}>{activeEvent.account_number}</div>
                <div className="account-name" style={{ fontWeight: 600 }}>{activeEvent.account_name}</div>
                
                <div style={{ marginTop: 24 }}>
                  <button className="btn-secondary" onClick={handleCopy} style={{ borderRadius: 12, padding: '12px 24px' }}>
                    {copied ? 'Copied Details!' : 'Copy Bank Details'}
                  </button>
                </div>
                <p style={{ marginTop: '20px', fontSize: '12px', color: 'var(--text-secondary)' }}>Include "Donation" in your transfer description for tracking.</p>
              </div>
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)', fontSize: '13px' }}>
            {loading ? 'Loading bank details...' : ''}
          </div>
        )}

        <section className="impact-section">
          <h3 className="impact-title">Our Impact</h3>
          <div className="impact-grid">
            <div className="impact-card">
              <div className="impact-img-wrap">
                <img src="/cripplegraduate.png" alt="Empowerment" />
              </div>
              <div className="impact-info">
                <h4>Empowerment</h4>
                <p>Helping persons with disabilities achieve their full potential through education.</p>
              </div>
            </div>
            <div className="impact-card">
              <div className="impact-img-wrap">
                <img src="/downsyndrome.png" alt="Inclusion" />
              </div>
              <div className="impact-info">
                <h4>Inclusion</h4>
                <p>Creating a world where every ability is celebrated and supported.</p>
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <a href="https://www.theabilitylife.org/copy-of-projects" target="_blank" rel="noopener noreferrer" className="purpose-link">
              See what we fund &rarr;
            </a>
          </div>
        </section>
      </div>

      <footer style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)', fontSize: 13 }}>
        &copy; {new Date().getFullYear()} The Ability Life Initiative. All rights reserved.
      </footer>
    </div>
  );
}

"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AdminContext } from './AdminContext';
import './../globals.css';
import './admin.css';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [adminName, setAdminName] = useState<string>('TALI Staff');
  const [authStep, setAuthStep] = useState<1 | 2>(1);
  const [authEmail, setAuthEmail] = useState('');
  const [authCode, setAuthCode] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Context state
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const pathname = usePathname();
  const router = useRouter();

  // Initialize token
  useEffect(() => {
    const savedToken = localStorage.getItem('tali_admin_token');
    const savedName = localStorage.getItem('tali_admin_name');
    if (savedToken) {
      setToken(savedToken);
      if (savedName) setAdminName(savedName);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
     if (token) {
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/events/`, {
           headers: { 'Authorization': `Token ${token}` }
        })
        .then(res => {
            if (res.status === 401) {
                // Token expired — force re-login
                localStorage.removeItem('tali_admin_token');
                localStorage.removeItem('tali_admin_name');
                setToken(null);
                return null;
            }
            return res.json();
        })
        .then(data => {
            if (data && Array.isArray(data)) {
                setEvents(data);
                const active = data.find((e: any) => e.is_active) || data[0];
                if (active) setSelectedEventId(active.id);
            }
        }).catch(err => console.error(err));
     }
  }, [token]);

  const triggerCelebration = async (eventId: number) => {
    if (!token) return;
    try {
       await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/events/${eventId}/celebrate/`, {
          method: 'POST',
          headers: { 'Authorization': `Token ${token}` }
       });
    } catch (e) {
       console.error("Celebration failed", e);
    }
  };

  // Close mobile menu on route change
  useEffect(() => {
     setIsMobileMenuOpen(false);
  }, [pathname]);

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/request-code/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authEmail })
      });
      setAuthStep(2);
    } catch (err) {
      setAuthError('Network error occurred.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/verify-code/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authEmail, code: authCode })
      });
      const data = await res.json();
      if (res.ok && data.token) {
        localStorage.setItem('tali_admin_token', data.token);
        localStorage.setItem('tali_admin_name', data.name || 'TALI Staff');
        setToken(data.token);
        setAdminName(data.name || 'TALI Staff');
      } else {
        setAuthError(data.error || 'Invalid code.');
      }
    } catch (err) {
      setAuthError('Network error occurred.');
    } finally {
      setAuthLoading(false);
    }
  };

  if (loading) {
    return <div className="auth-wrapper"><div style={{ color: '#86868b' }}>Loading security module...</div></div>;
  }

  // AUTH WALL RENDER
  if (!token) {
     return (
        <div className="auth-wrapper">
          <div className="auth-card">
            <h2 style={{ textAlign: 'center', marginBottom: '8px', fontSize: '24px', fontWeight: 600 }}>TALI Admin</h2>
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '30px', fontSize: '14px' }}>
              {authStep === 1 ? 'Enter your registered email to continue.' : `Enter the 6-digit code sent to ${authEmail}.`}
            </p>

            {authError && (
              <div style={{ backgroundColor: '#f8d7da', color: '#721c24', padding: '12px', borderRadius: '8px', marginBottom: '20px', fontSize: '14px', textAlign: 'center', fontWeight: 500 }}>
                {authError}
              </div>
            )}

            {authStep === 1 ? (
              <form onSubmit={handleRequestCode}>
                <div className="form-group">
                  <label className="form-label" htmlFor="admin-email">Email Address</label>
                  <input 
                    id="admin-email" type="email" className="form-input" placeholder="admin@theabilitylife.org" 
                    required value={authEmail} onChange={e => setAuthEmail(e.target.value)} 
                  />
                </div>
                <button type="submit" className="btn-primary" disabled={authLoading} style={{ marginTop: '20px' }}>
                  {authLoading ? 'Sending...' : 'Send Login Code'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyCode}>
                <div className="form-group">
                  <label className="form-label" htmlFor="admin-code">6-Digit Code</label>
                  <input 
                    id="admin-code" type="text" maxLength={6} className="form-input" placeholder="123456" 
                    required value={authCode} onChange={e => setAuthCode(e.target.value.replace(/\D/g, ''))} 
                    style={{ letterSpacing: '4px', textAlign: 'center', fontSize: '20px', fontWeight: 600 }}
                  />
                </div>
                <button type="submit" className="btn-primary" disabled={authLoading || authCode.length !== 6} style={{ marginTop: '20px' }}>
                  {authLoading ? 'Verifying...' : 'Verify & Login'}
                </button>
                <button 
                  type="button" 
                  onClick={() => { setAuthStep(1); setAuthCode(''); setAuthError(''); }} 
                  style={{ width: '100%', marginTop: '16px', background: 'transparent', border: 'none', color: 'var(--tali-blue)', fontWeight: 600, cursor: 'pointer' }}
                >
                  Back to Email
                </button>
              </form>
            )}
          </div>
        </div>
     );
  }

  // DASHBOARD LAYOUT
  return (
    <AdminContext.Provider value={{ selectedEventId, setSelectedEventId, events, setEvents, triggerCelebration }}>
    <div className="admin-layout">
      {/* Mobile Header */}
      <div className="mobile-header">
         <div className="sidebar-logo" style={{ marginBottom: 0 }}>TALI <span className="admin-badge">Admin</span></div>
         <button className="mobile-menu-btn" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
         </button>
      </div>

      {isMobileMenuOpen && <div className="mobile-backdrop" onClick={() => setIsMobileMenuOpen(false)}></div>}

      <aside className={`admin-sidebar ${isMobileMenuOpen ? 'open' : ''}`}>
         <div className="sidebar-logo">TALI <span className="admin-badge">Admin</span></div>
         <div className="sidebar-user">
            <div className="user-avatar">{adminName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'TS'}</div>
            <div className="user-info">
               <span className="user-name">{adminName}</span>
               <button className="sign-out" onClick={() => { localStorage.removeItem('tali_admin_token'); localStorage.removeItem('tali_admin_name'); setToken(null); router.push('/admin'); }}>Sign out</button>
            </div>
         </div>
         <nav className="sidebar-nav">
            <Link href="/admin/overview" className={`nav-link ${pathname.includes('overview') ? 'active' : ''}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
              Overview
            </Link>
            <Link href="/admin/transactions" className={`nav-link ${pathname.includes('transactions') ? 'active' : ''}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
              Transactions
            </Link>
         </nav>
         
         <div className="sidebar-bottom">
            <div className="live-indicator"><span className="dot"></span> Live</div>
            <div className="campaign-selector">
                <label>Campaign</label>
                <select value={selectedEventId || ''} onChange={e => setSelectedEventId(Number(e.target.value))}>
                    {events.map(ev => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
                </select>
            </div>
         </div>
      </aside>
      <main className="admin-main-content">
         {children}
      </main>
    </div>
    </AdminContext.Provider>
  );
}

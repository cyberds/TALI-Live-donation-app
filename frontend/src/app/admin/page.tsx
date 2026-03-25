"use client";

import React, { useEffect, useState } from 'react';
import './../globals.css';
import './admin.css';

interface Donation {
  id: number;
  donor_name: string | null;
  email: string | null;
  phone: string | null;
  is_anonymous: boolean;
  amount: string;
  payment_mode: string;
  payment_status: string;
  transaction_reference: string;
  created_at: string;
}

interface Toast {
  id: number;
  message: string;
}

export default function AdminDashboardPage() {
  const [donations, setDonations] = useState<Donation[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [loading, setLoading] = useState(true);

  const addToast = (msg: string) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message: msg }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  const fetchDonations = async () => {
    try {
      const res = await fetch('http://127.0.0.1:8000/api/donations/');
      const data = await res.json();
      setDonations(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmTransfer = async (id: number) => {
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/donations/${id}/confirm-transfer/`, { method: 'POST' });
      if (res.ok) {
        addToast("Bank transfer confirmed manually!");
        fetchDonations();
      } else {
        addToast("Error confirming transfer.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchDonations();

    // Setup SSE for Live Toasts
    const eventSource = new EventSource('http://127.0.0.1:8000/api/events/1/stream/');
    
    eventSource.onmessage = (event) => {
      if (event.data === ': heartbeat') return;
      try {
        const data = JSON.parse(event.data);
        if (data.new_donations && data.new_donations.length > 0) {
          data.new_donations.forEach((don: any) => {
            addToast(`New Donation! ${don.donor_display} just gave ₦${Number(don.amount).toLocaleString()}`);
          });
          // Refresh table cleanly
          fetchDonations();
        }
      } catch (e) {
        console.error("Error parsing SSE data", e);
      }
    };

    return () => {
      eventSource.close();
    };
  }, []);

  return (
    <div className="admin-container">
      <header className="admin-header">
        <h1 className="title" style={{ margin: 0 }}>TALI Admin Dashboard</h1>
        <button className="btn-secondary" onClick={fetchDonations}>Refresh Data</button>
      </header>

      {/* Toasts Container */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className="toast">
             <span style={{ marginRight: '8px' }}>🎉</span> {t.message}
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: '0', overflowX: 'auto', borderRadius: '12px' }}>
        {loading ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#86868b' }}>Loading donations...</div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Name</th>
                <th>Contact</th>
                <th>Anon</th>
                <th>Amount (NGN)</th>
                <th>Method</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {donations.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: '#86868b' }}>No donations recorded yet.</td>
                </tr>
              ) : (
                donations.map(don => (
                  <tr key={don.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{new Date(don.created_at).toLocaleString()}</td>
                    <td>{don.donor_name || '-'}</td>
                    <td>
                      <div>{don.email || '-'}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{don.phone}</div>
                    </td>
                    <td>{don.is_anonymous ? 'Yes' : 'No'}</td>
                    <td style={{ fontWeight: 600 }}>₦{Number(don.amount).toLocaleString()}</td>
                    <td>{don.payment_mode}</td>
                    <td>
                      <span className={`status-badge status-${don.payment_status.toLowerCase()}`}>
                        {don.payment_status}
                      </span>
                      {don.payment_mode === 'BANK_TRANSFER' && don.payment_status === 'PENDING' && (
                        <button 
                          style={{
                            marginLeft: '12px', background: 'transparent', border: '1px solid var(--tali-blue)', 
                            borderRadius: '12px', fontSize: '11px', padding: '4px 8px', color: 'var(--tali-blue)',
                            cursor: 'pointer', fontWeight: 600
                          }}
                          onClick={() => handleConfirmTransfer(don.id)}
                        >
                          Confirm
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

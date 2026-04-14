"use client";
import React, { useEffect, useState, useCallback } from 'react';
import { useAdminContext } from '../AdminContext';
import './../admin.css';

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

export default function TransactionsPage() {
  const { selectedEventId, triggerCelebration } = useAdminContext();
  const [transactions, setTransactions] = useState<Donation[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  
  // View Anonymous donors state
  const [unmaskedDonors, setUnmaskedDonors] = useState<Set<number>>(new Set());

  // Filters
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [dateRange, setDateRange] = useState('All');
  const [method, setMethod] = useState('All');
  const [status, setStatus] = useState('All');
  
  // Pagination
  const [offset, setOffset] = useState(0);
  const limit = 12;
  
  // Auto-refresh timer
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [secondsAgo, setSecondsAgo] = useState(0);

  // Manual Transaction Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualAmount, setManualAmount] = useState('');
  const [manualIsAnonymous, setManualIsAnonymous] = useState(false);
  const [manualPaymentMode, setManualPaymentMode] = useState('MANUAL');
  const [actionLoading, setActionLoading] = useState(false);

  // Debounce search
  useEffect(() => {
     const timer = setTimeout(() => setDebouncedSearch(search), 500);
     return () => clearTimeout(timer);
  }, [search]);

  // Reset pagination when filters change
  useEffect(() => {
     setOffset(0);
  }, [debouncedSearch, dateRange, method, status, selectedEventId]);

  const fetchTransactions = useCallback(async () => {
    const token = localStorage.getItem('tali_admin_token');
    if (!token || !selectedEventId) return;
    
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
         limit: limit.toString(),
         offset: offset.toString()
      });
      if (selectedEventId) queryParams.append('event_id', selectedEventId.toString());
      if (debouncedSearch) queryParams.append('search', debouncedSearch);
      if (dateRange !== 'All') queryParams.append('date', dateRange);
      if (method !== 'All') queryParams.append('method', method);
      if (status !== 'All') queryParams.append('status', status);

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/transactions/?${queryParams.toString()}`, {
        headers: { 'Authorization': `Token ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
         setTransactions(data.results);
         setTotalCount(data.count);
         setLastUpdated(new Date());
         setSecondsAgo(0);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, dateRange, method, status, offset, selectedEventId]);

  useEffect(() => {
    fetchTransactions();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
       fetchTransactions();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [fetchTransactions]);

  useEffect(() => {
     const timer = setInterval(() => {
        setSecondsAgo(Math.floor((new Date().getTime() - lastUpdated.getTime()) / 1000));
     }, 5000);
     return () => clearInterval(timer);
  }, [lastUpdated]);

  const handleExportCSV = () => {
      const token = localStorage.getItem('tali_admin_token');
      if (!token) return;
      
      const queryParams = new URLSearchParams();
      if (selectedEventId) queryParams.append('event_id', selectedEventId.toString());
      if (debouncedSearch) queryParams.append('search', debouncedSearch);
      if (dateRange !== 'All') queryParams.append('date', dateRange);
      if (method !== 'All') queryParams.append('method', method);
      if (status !== 'All') queryParams.append('status', status);

      const url = `${process.env.NEXT_PUBLIC_API_URL}/api/admin/transactions/export/?${queryParams.toString()}`;
      
      setActionLoading(true);
      fetch(url, { headers: { 'Authorization': `Token ${token}` } })
         .then(res => res.blob())
         .then(blob => {
             const url = window.URL.createObjectURL(blob);
             const a = document.createElement('a');
             a.href = url;
             a.download = `transactions_${new Date().getTime()}.csv`;
             document.body.appendChild(a);
             a.click();
             a.remove();
         })
         .finally(() => setActionLoading(false));
  };

  const handleConfirmTransfer = async (id: number) => {
    const token = localStorage.getItem('tali_admin_token');
    if (!token) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/donations/${id}/confirm-transfer/`, { 
        method: 'POST',
        headers: { 'Authorization': `Token ${token}` }
      });
      if (res.ok) fetchTransactions();
    } catch (err) {
    } finally {
      setActionLoading(false);
    }
  };

  const handleVerifyFlutterwave = async (id: number) => {
    const token = localStorage.getItem('tali_admin_token');
    if (!token) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/donations/${id}/verify-ref/`, { 
        method: 'POST',
        headers: { 'Authorization': `Token ${token}` }
      });
      if (res.ok) fetchTransactions();
    } catch (err) {
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmitManual = async (e: React.FormEvent) => {
      e.preventDefault();
      const token = localStorage.getItem('tali_admin_token');
      if (!token || !selectedEventId) return;

      setIsSubmitting(true);
      try {
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/donations/manual/`, {
              method: 'POST',
              headers: { 
                  'Authorization': `Token ${token}`,
                  'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                  event: selectedEventId,
                  donor_name: manualName,
                  email: manualEmail,
                  phone: manualPhone,
                  amount: manualAmount,
                  is_anonymous: manualIsAnonymous,
                  payment_mode: manualPaymentMode
              })
          });

          if (res.ok) {
              setIsModalOpen(false);
              setManualName('');
              setManualEmail('');
              setManualPhone('');
              setManualAmount('');
              setManualIsAnonymous(false);
              setManualPaymentMode('MANUAL');
              fetchTransactions();
          } else {
              const data = await res.json();
              alert(`Error: ${JSON.stringify(data)}`);
          }
      } catch (err) {
          console.error(err);
          alert('Failed to connect to server.');
      } finally {
          setIsSubmitting(false);
      }
  };

  const toggleUnmask = (id: number) => {
     setUnmaskedDonors(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
     });
  };

  const handleCopy = (text: string) => {
      try {
        navigator.clipboard.writeText(text);
      } catch {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
  };

  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(totalCount / limit) || 1;

  return (
    <div className="transactions-container">
        <div className="transactions-header">
           <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <h2 style={{ lineHeight: 1 }}>Transactions</h2>
                <div className="live-indicator" style={{ marginBottom: 0 }}><span className="dot"></span> Active Event</div>
           </div>
           <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                {selectedEventId && (
                  <button 
                    onClick={() => triggerCelebration(selectedEventId)}
                    className="btn-secondary" 
                    style={{ height: '36px', padding: '0 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', borderStyle: 'dashed' }}
                  >
                    <span role="img" aria-label="party">🎉</span> Celebrate
                  </button>
                )}
                <button className="btn-primary" onClick={() => setIsModalOpen(true)} style={{ padding: '0 20px', height: 40, fontSize: 13, borderRadius: 10 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: 8}}><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    Manual Entry
                </button>
                <button className="btn-secondary" onClick={handleExportCSV} disabled={actionLoading} style={{ padding: '0 20px', height: 40, width: 'fit-content', fontSize: 13, borderRadius: 10, opacity: actionLoading ? 0.7 : 1 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: 8}}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    {actionLoading ? 'Exporting...' : 'Export CSV'}
                </button>
           </div>
        </div>

       <div className="filters-bar">
           <div className="search-box">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              <input type="text" placeholder="Search by name, email, or ref..." value={search} onChange={e => setSearch(e.target.value)} />
           </div>

           <select className="filter-select" value={dateRange} onChange={e => setDateRange(e.target.value)}>
               <option value="All">All Time</option>
               <option value="Today">Today</option>
           </select>

           <div className="filter-toggle">
               <button className={method === 'All' ? 'active' : ''} onClick={() => setMethod('All')}>All</button>
               <button className={method === 'Flutterwave' ? 'active' : ''} onClick={() => setMethod('Flutterwave')}>Flutterwave</button>
               <button className={method === 'Bank Transfer' ? 'active' : ''} onClick={() => setMethod('Bank Transfer')}>Bank Transfer</button>
               <button className={method === 'Manual' ? 'active' : ''} onClick={() => setMethod('Manual')}>Manual Entry</button>
           </div>

           <div className="filter-toggle">
               <button className={status === 'All' ? 'active' : ''} onClick={() => setStatus('All')}>All</button>
               <button className={status === 'Confirmed' ? 'active' : ''} onClick={() => setStatus('Confirmed')}>Confirmed</button>
               <button className={status === 'Pending' ? 'active' : ''} onClick={() => setStatus('Pending')}>Pending</button>
           </div>

           <div style={{ flexGrow: 1 }}></div>

           <div className="refresh-indicator">
              <div className="dot"></div>
              <span>Auto-refreshing Last updated {secondsAgo}s ago</span>
           </div>
       </div>

       <div className="card" style={{ padding: 0, overflowX: 'auto', opacity: loading ? 0.6 : 1, transition: 'opacity 0.2s' }}>
           <table className="admin-table">
              <thead>
                 <tr>
                    <th style={{width: 40}}>#</th>
                    <th>Donor</th>
                    <th>Email</th>
                    <th>Amount</th>
                    <th>Method</th>
                    <th>Date & Time</th>
                    <th>Status</th>
                    <th>Ref</th>
                 </tr>
              </thead>
              <tbody>
                 {loading && transactions.length === 0 ? (
                    <tr><td colSpan={8} style={{textAlign: 'center', padding: 40, color: 'var(--text-secondary)'}}>Loading...</td></tr>
                 ) : transactions.length === 0 ? (
                    <tr><td colSpan={8} style={{textAlign: 'center', padding: 40, color: 'var(--text-secondary)'}}>No transactions found.</td></tr>
                 ) : (
                    transactions.map((tx, idx) => (
                       <tr key={tx.id}>
                          <td style={{color: 'var(--text-secondary)'}}>{offset + idx + 1}</td>
                          <td style={{fontWeight: 500}}>
                             {tx.is_anonymous ? (
                                <div style={{display: 'flex', alignItems: 'center', gap: 6}}>
                                   <span>{unmaskedDonors.has(tx.id) && tx.donor_name ? tx.donor_name : 'Anonymous'}</span>
                                   <button 
                                     onClick={() => toggleUnmask(tx.id)}
                                     style={{fontSize: 10, border: 'none', cursor: 'pointer', color: 'var(--tali-blue)', background: '#f2f2f7', padding: '2px 6px', borderRadius: 4}}
                                   >
                                      {unmaskedDonors.has(tx.id) ? 'Hide' : 'View'}
                                   </button>
                                </div>
                             ) : (tx.donor_name || '-')}
                          </td>
                          <td style={{color: 'var(--text-secondary)'}}>{tx.is_anonymous && !unmaskedDonors.has(tx.id) ? 'Hidden' : tx.email}</td>
                          <td style={{fontWeight: 700}}>₦{Number(tx.amount).toLocaleString()}</td>
                          <td>
                             <span className="method-pill">
                                {tx.payment_mode === 'BANK_TRANSFER' ? 'Bank Transfer' : 
                                 tx.payment_mode === 'MANUAL' ? 'Manual Entry' :
                                 tx.payment_mode === 'INTENT' ? 'Intent' : 'Flutterwave'}
                             </span>
                          </td>
                          <td style={{fontSize: 13, color: 'var(--text-secondary)'}}>
                             <div>{new Date(tx.created_at).toLocaleDateString()}</div>
                             <div style={{fontSize: 11}}>{new Date(tx.created_at).toLocaleTimeString()}</div>
                          </td>
                          <td>
                             <span className={`status-badge status-${tx.payment_status.toLowerCase()}`}>
                                {tx.payment_status === 'SUCCESS' ? 'Confirmed' : 'Pending'}
                             </span>
                              {tx.payment_mode === 'BANK_TRANSFER' && tx.payment_status !== 'SUCCESS' && (
                                 <button className="confirm-btn-mini" onClick={() => handleConfirmTransfer(tx.id)} disabled={actionLoading}>
                                     {actionLoading ? '...' : 'Confirm'}
                                 </button>
                              )}
                              {tx.payment_mode === 'FLUTTERWAVE' && tx.payment_status !== 'SUCCESS' && (
                                 <button className="confirm-btn-mini" onClick={() => handleVerifyFlutterwave(tx.id)} disabled={actionLoading}>
                                     {actionLoading ? '...' : 'Verify'}
                                 </button>
                              )}
                          </td>
                          <td>
                             <div style={{display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)'}}>
                                {tx.transaction_reference}
                                <button className="copy-btn" onClick={() => handleCopy(tx.transaction_reference)} title="Copy Ref">
                                   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                                </button>
                             </div>
                          </td>
                       </tr>
                    ))
                 )}
              </tbody>
           </table>
       </div>

       <div className="pagination-bar">
           <div className="pagination-info">
              Showing {Math.min(offset + 1, totalCount)}–{Math.min(offset + limit, totalCount)} of {totalCount} transactions
           </div>
           <div className="pagination-controls">
              <button disabled={currentPage === 1} onClick={() => setOffset(offset - limit)}>&larr; Prev</button>
              <div className="page-numbers">
                  <span className="page-num active">{currentPage}</span>
                  {currentPage < totalPages && <span className="page-num" onClick={() => setOffset(offset + limit)}>{currentPage + 1}</span>}
              </div>
              <button disabled={currentPage === totalPages} onClick={() => setOffset(offset + limit)}>Next &rarr;</button>
           </div>
       </div>

       {/* Manual Entry Modal */}
       {isModalOpen && (
           <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setIsModalOpen(false)}>
               <div className="modal-content" onClick={e => e.stopPropagation()}>
                    <div className="modal-header">
                        <h3>Manual Donation Entry</h3>
                        <button className="modal-close" onClick={() => setIsModalOpen(false)}>&times;</button>
                    </div>
                    <form className="modal-form" onSubmit={handleSubmitManual}>
                        <div className="form-group">
                            <label className="form-label" style={{fontSize: 12}}>Donor Name</label>
                            <input 
                                className="form-input" 
                                type="text" 
                                placeholder="Full Name" 
                                value={manualName} 
                                onChange={e => setManualName(e.target.value)} 
                                required 
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label" style={{fontSize: 12}}>Email Address</label>
                            <input 
                                className="form-input" 
                                type="email" 
                                placeholder="email@example.com" 
                                value={manualEmail} 
                                onChange={e => setManualEmail(e.target.value)} 
                                required 
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label" style={{fontSize: 12}}>Phone Number (Optional)</label>
                            <input 
                                className="form-input" 
                                type="tel" 
                                placeholder="+234..." 
                                value={manualPhone} 
                                onChange={e => setManualPhone(e.target.value)} 
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label" style={{fontSize: 12}}>Amount (NGN)</label>
                            <input 
                                className="form-input" 
                                type="number" 
                                placeholder="5000000" 
                                value={manualAmount} 
                                onChange={e => setManualAmount(e.target.value)} 
                                required 
                            />
                        </div>
                        <div className="form-group">
                            <label className="checkbox-group" style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                                <input 
                                    type="checkbox" 
                                    checked={manualIsAnonymous} 
                                    onChange={e => setManualIsAnonymous(e.target.checked)} 
                                />
                                <span style={{fontSize: 14, fontWeight: 500}}>Mark as Anonymous</span>
                            </label>
                        </div>
                        
                        <div style={{ marginTop: 10 }}>
                            <button 
                                className="btn-primary" 
                                type="submit" 
                                disabled={isSubmitting}
                                style={{ width: '100%', height: 48, borderRadius: 12, opacity: isSubmitting ? 0.6 : 1 }}
                            >
                                {isSubmitting ? 'Recording...' : 'Record Donation'}
                            </button>
                        </div>
                    </form>
               </div>
           </div>
       )}
    </div>
  );
}

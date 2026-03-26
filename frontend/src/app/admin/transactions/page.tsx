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
  const { selectedEventId } = useAdminContext();
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
         });
  };

  const handleConfirmTransfer = async (id: number) => {
    const token = localStorage.getItem('tali_admin_token');
    if (!token) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/donations/${id}/confirm-transfer/`, { 
        method: 'POST',
        headers: { 'Authorization': `Token ${token}` }
      });
      if (res.ok) fetchTransactions();
    } catch (err) {}
  };

  const handleVerifyFlutterwave = async (id: number) => {
    const token = localStorage.getItem('tali_admin_token');
    if (!token) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/donations/${id}/verify-ref/`, { 
        method: 'POST',
        headers: { 'Authorization': `Token ${token}` }
      });
      if (res.ok) fetchTransactions();
      // Silent fail — the status badge will stay as "Pending" which is the correct UX
    } catch (err) {}
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
        // Fallback for non-HTTPS contexts
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
           <h2>Transactions</h2>
           <button className="btn-secondary" onClick={handleExportCSV}>
               <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: 8}}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
               Export CSV
           </button>
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

       <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
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
                             <span className="method-pill">{tx.payment_mode === 'BANK_TRANSFER' ? 'Bank Transfer' : 'Flutterwave'}</span>
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
                                <button className="confirm-btn-mini" onClick={() => handleConfirmTransfer(tx.id)}>Confirm</button>
                             )}
                             {tx.payment_mode === 'FLUTTERWAVE' && tx.payment_status !== 'SUCCESS' && (
                                <button className="confirm-btn-mini" onClick={() => handleVerifyFlutterwave(tx.id)}>Verify</button>
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
    </div>
  );
}

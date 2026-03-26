"use client";
import React, { useEffect, useState } from 'react';
import { useAdminContext } from '../AdminContext';
import './../admin.css';

interface DashboardMetrics {
  total_raised: number;
  all_time_raised: number;
  today_raised: number;
  campaign_goal: number;
  percent_funded: number;
  donor_count: number;
  anonymous_count: number;
  methods: {
    FLUTTERWAVE: number;
    BANK_TRANSFER: number;
  };
}

interface Donation {
  id: number;
  donor_display: string;
  amount: string;
  created_at: string;
  payment_mode?: string;
}

export default function OverviewPage() {
  const { selectedEventId } = useAdminContext();
  const [range, setRange] = useState<'today' | 'week' | 'all'>('today');
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [liveDonations, setLiveDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMetrics = async () => {
    const token = localStorage.getItem('tali_admin_token');
    if (!token || !selectedEventId) return;
    
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/overview/?range=${range}&event_id=${selectedEventId}`, {
        headers: { 'Authorization': `Token ${token}` }
      });
      if (!res.ok) {
        console.error('Overview fetch failed:', res.status);
        return;
      }
      const data = await res.json();
      setMetrics(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, selectedEventId]);

  // Handle SSE for Live Feed with reconnect
  useEffect(() => {
    if (!selectedEventId) return;
    let es: EventSource | null = null;
    let retryDelay = 1000;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let isCancelled = false;

    function connect() {
      if (isCancelled) return;
      es = new EventSource(`${process.env.NEXT_PUBLIC_API_URL}/api/events/${selectedEventId}/stream/`);
      
      es.onmessage = (event) => {
        retryDelay = 1000;
        if (event.data === ': heartbeat') return;
        try {
          const data = JSON.parse(event.data);
          if (data.new_donations && data.new_donations.length > 0) {
            setLiveDonations(prev => {
               const newList = [...data.new_donations, ...prev];
               const uniqueList = Array.from(new Map(newList.map(item => [item.id, item])).values());
               return uniqueList.slice(0, 10);
            });
            fetchMetrics(); 
          }
        } catch (e) {}
      };

      es.onerror = () => {
        es?.close();
        if (!isCancelled) {
          retryTimer = setTimeout(() => {
            retryDelay = Math.min(retryDelay * 2, 30000);
            connect();
          }, retryDelay);
        }
      };
    }

    connect();
    return () => {
      isCancelled = true;
      es?.close();
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [selectedEventId]);

  const getRelativeTime = (isoString: string) => {
      const diff = Math.floor((new Date().getTime() - new Date(isoString).getTime()) / 1000);
      if (diff < 60) return `${Math.max(1, diff)} sec ago`;
      if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
      if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
      return `${Math.floor(diff / 86400)} d ago`;
  };

  return (
    <div className="overview-container">
      <div className="overview-header">
         <h2>Overview</h2>
         <div className="range-toggles">
            <button className={range === 'today' ? 'active' : ''} onClick={() => setRange('today')}>Today</button>
            <button className={range === 'week' ? 'active' : ''} onClick={() => setRange('week')}>This Week</button>
            <button className={range === 'all' ? 'active' : ''} onClick={() => setRange('all')}>All Time</button>
         </div>
      </div>

      <div className="overview-grid">
         {/* Main content left */}
         <div className="overview-main">
            <div className="metrics-row">
               <div className="metric-card">
                  <div className="metric-label">Total Raised</div>
                  <div className="metric-value">₦{metrics ? metrics.total_raised.toLocaleString() : '0'}</div>
                  <div className="metric-subtext positive">+{metrics ? metrics.today_raised.toLocaleString() : '0'} Today</div>
               </div>
               <div className="metric-card">
                  <div className="metric-label">Campaign Goal</div>
                  <div className="metric-value" style={{color: 'var(--text-secondary)'}}>₦{metrics ? metrics.campaign_goal.toLocaleString() : '0'}</div>
                  <div className="metric-subtext">Current campaign</div>
               </div>
               <div className="metric-card">
                  <div className="metric-label">% Of Goal</div>
                  <div className="metric-value">{metrics ? metrics.percent_funded.toFixed(1) : '0'}%</div>
                  <div className="progress-mini">
                     <div className="progress-mini-fill" style={{ width: `${metrics ? metrics.percent_funded : 0}%` }}></div>
                  </div>
               </div>
               <div className="metric-card">
                  <div className="metric-label">Donors</div>
                  <div className="metric-value">{metrics ? metrics.donor_count : '0'}</div>
                  <div className="metric-subtext">{metrics ? metrics.anonymous_count : '0'} anonymous</div>
               </div>
            </div>

            <div className="chart-card">
               <div className="metric-label" style={{marginBottom: 24}}>Campaign Progress</div>
               
               <div className="progress-visuals">
                   <div style={{ padding: '40px 20px', display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>
                       {metrics && metrics.campaign_goal > 0 && (
                          <div style={{ width: '100%', maxWidth: '400px', display: 'flex', gap: '4px', height: '40px', borderRadius: '4px', overflow: 'hidden' }}>
                              <div style={{ width: `${(metrics.methods.FLUTTERWAVE / metrics.campaign_goal) * 100}%`, backgroundColor: 'var(--tali-blue)', display: 'flex', alignItems: 'center', paddingLeft: '8px', color: 'white', fontSize: '12px', fontWeight: 600 }}>
                                  {metrics.methods.FLUTTERWAVE > 0 && 'FLW'}
                              </div>
                              <div style={{ width: `${(metrics.methods.BANK_TRANSFER / metrics.campaign_goal) * 100}%`, backgroundColor: '#ff9500', display: 'flex', alignItems: 'center', paddingLeft: '8px', color: 'white', fontSize: '12px', fontWeight: 600 }}>
                                  {metrics.methods.BANK_TRANSFER > 0 && 'TRF'}
                              </div>
                              <div style={{ flexGrow: 1, backgroundColor: '#f2f2f7' }}></div>
                          </div>
                       )}
                       
                       <div style={{ display: 'flex', gap: '32px', marginTop: '20px', width: '100%', justifyContent: 'center' }}>
                           <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ width: 12, height: 12, borderRadius: '2px', backgroundColor: 'var(--tali-blue)' }}></div>
                              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Flutterwave <strong style={{color: 'var(--text-primary)'}}>₦{metrics?.methods.FLUTTERWAVE.toLocaleString() ?? '0'}</strong></span>
                           </div>
                           <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ width: 12, height: 12, borderRadius: '2px', backgroundColor: '#ff9500' }}></div>
                              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Bank Transfer <strong style={{color: 'var(--text-primary)'}}>₦{metrics?.methods.BANK_TRANSFER.toLocaleString() ?? '0'}</strong></span>
                           </div>
                       </div>
                   </div>
               </div>
            </div>
         </div>

         {/* Sidebar right */}
         <div className="overview-sidebar">
            <div className="metric-label" style={{padding: '0 0 16px 0', borderBottom: '1px solid #e5e5ea', marginBottom: '16px'}}>Live Donations</div>
            <div className="live-feed">
               {liveDonations.length === 0 ? (
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', marginTop: 32 }}>Waiting for donations...</div>
               ) : (
                  liveDonations.map(don => (
                     <div key={don.id} className="feed-item">
                        <div className="feed-header">
                           <div className="feed-name">{don.donor_display}</div>
                           <div className="feed-time">{getRelativeTime(don.created_at)}</div>
                        </div>
                        <div className="feed-details">
                           <div className="feed-amount">₦{Number(don.amount).toLocaleString()}</div>
                           <div className="feed-method">{don.payment_mode === 'BANK_TRANSFER' ? 'TRF' : 'FLW'}</div>
                        </div>
                     </div>
                  ))
               )}
            </div>
         </div>
      </div>
    </div>
  );
}

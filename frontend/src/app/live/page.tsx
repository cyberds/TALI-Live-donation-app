"use client";

import React, { useEffect, useState, useRef } from 'react';
import './../globals.css';
import './live.css';

interface EventSummary {
  raised_amount: string;
  target_amount: string;
  donation_count: number;
  highest_donation: string;
  highest_donor: string;
}

interface Donation {
  id: number;
  donor_display: string;
  amount: string;
  created_at: string;
}

interface Announcement {
  id: number;
  donor: string;
  amount: string;
}

export default function LiveScreenPage() {
  const [summary, setSummary] = useState<EventSummary | null>(null);
  const [recentDonations, setRecentDonations] = useState<Donation[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  
  // Calculate Progress robustly
  const raised = summary ? Number(summary.raised_amount) : 0;
  const target = (summary && Number(summary.target_amount) > 0) ? Number(summary.target_amount) : 1;
  const percentage = Math.min((raised / target) * 100, 100);
  const amountLeft = Math.max(target - raised, 0);

  const fetchInitialData = async () => {
    try {
      // Pointing to event ID 1
      const sumRes = await fetch('http://127.0.0.1:8000/api/events/1/summary/');
      const sumData = await sumRes.json();
      setSummary(sumData);

      const recentRes = await fetch('http://127.0.0.1:8000/api/events/1/recent-donations/');
      const recentData = await recentRes.json();
      setRecentDonations(recentData);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchInitialData();

    const eventSource = new EventSource('http://127.0.0.1:8000/api/events/1/stream/');
    
    eventSource.onmessage = (event) => {
      if (event.data === ': heartbeat') return;
      try {
        const data = JSON.parse(event.data);
        
        // Push summary numbers directly
        setSummary(prev => ({
          ...prev!,
          raised_amount: data.raised_amount,
          donation_count: data.donation_count,
          highest_donation: data.highest_donation,
          highest_donor: data.highest_donor
        }));

        if (data.new_donations && data.new_donations.length > 0) {
          // Prepend new donations cleanly
          setRecentDonations(prev => {
            const newList = [...data.new_donations, ...prev];
            // Remove duplicates potentially grabbed during the transition gap
            const uniqueList = Array.from(new Map(newList.map(item => [item.id, item])).values());
            return uniqueList.slice(0, 50); // display max 50 recent donors visually
          });

          // Mount announcement cards. 
          // They stack in flex-col so they never overlap
          data.new_donations.forEach((don: any) => {
             const ann = {
               id: Date.now() + Math.random(),
               donor: don.donor_display,
               amount: don.amount
             };
             setAnnouncements(prev => [...prev, ann]);
             
             // Dismiss card automatically 
             setTimeout(() => {
               setAnnouncements(prev => prev.filter(a => a.id !== ann.id));
             }, 8000); 
          });
        }
      } catch (e) {}
    };

    return () => eventSource.close();
  }, []);

  return (
    <div className="live-container">
      {/* Announcements Container - floats right, items stack downwards */}
      <div className="announcements-wrapper">
        {announcements.map(ann => (
          <div key={ann.id} className="announcement-card slide-in-top">
            <div className="ann-icon">🎉</div>
            <div className="ann-content">
              <div className="ann-donor">New Donation from <strong>{ann.donor}</strong>!</div>
              <div className="ann-amount">₦{Number(ann.amount).toLocaleString()}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="live-header">
        <div className="qr-section">
          <h2>Scan to Donate</h2>
          <div className="qr-placeholder" style={{ width: 200, height: 200, background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 16, margin: '0 auto' }}>
            <span style={{color: '#1d1d1f', fontWeight: 'bold', fontSize: '24px'}}>QR CODE</span>
          </div>
          <p className="scan-instruction">m.theabilitylife.org/donate</p>
        </div>
        
        <div className="progress-section">
          <h1 className="main-title">Bridging the Gap</h1>
          
          <div className="stats-row top-stats">
            <div className="stat-box">
              <span className="stat-label">Target Goal</span>
              <span className="stat-value">₦{summary ? Number(summary.target_amount).toLocaleString() : '...'}</span>
            </div>
            <div className="stat-box">
              <span className="stat-label">Amount Left</span>
              <span className="stat-value">₦{amountLeft.toLocaleString()}</span>
            </div>
          </div>

          <div className="progress-bar-container">
            <div className="progress-bar-fill" style={{ width: `${percentage}%` }}></div>
            <div className="progress-text">{percentage.toFixed(1)}% Funded</div>
          </div>

          <div className="raised-huge">
            ₦{raised.toLocaleString()}
          </div>
        </div>
      </div>

      <div className="live-grid">
        <div className="highlights-panel">
          <h3>Event Highlights</h3>
          <div className="stat-box-large">
            <span className="stat-label">Total Sponsors</span>
            <span className="stat-value highlight">{summary?.donation_count || 0}</span>
          </div>
          <div className="stat-box-large">
            <span className="stat-label">Highest Single Donation</span>
            <span className="stat-value highlight">₦{summary ? Number(summary.highest_donation).toLocaleString() : '0'}</span>
          </div>
          <div className="stat-box-large">
            <span className="stat-label">Top Donor</span>
            <span className="stat-value highlight">{summary?.highest_donor || '-'}</span>
          </div>
        </div>

        <div className="recent-panel">
          <h3>Recent Donations</h3>
          <div className="recent-list">
            {recentDonations.length === 0 ? (
               <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '24px', fontWeight: 500 }}>Waiting for first donation...</div>
            ) : (
               recentDonations.map(don => (
                 <div key={don.id} className="recent-item">
                   <span className="recent-donor">{don.donor_display}</span>
                   <span className="recent-amount">₦{Number(don.amount).toLocaleString()}</span>
                 </div>
               ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

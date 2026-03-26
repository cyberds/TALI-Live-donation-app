"use client";

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import './live.css';

interface BaseStats {
  raised_amount: number;
  target_amount: number;
  donation_count: number;
  highest_donor: string;
  highest_donation: number;
  title: string;
}

interface LiveDonation {
  id: number;
  donor_display: string;
  amount: number | string;
  created_at?: string;
}

function timeAgo(dateStr?: string): string {
  if (!dateStr) return 'just now';
  try {
    const time = new Date(dateStr).getTime();
    if (isNaN(time)) return 'just now';
    const diff = Math.floor((Date.now() - time) / 1000);
    if (diff < 0 || diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} mins ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hrs ago`;
    return `${Math.floor(diff / 86400)} days ago`;
  } catch {
    return 'just now';
  }
}

export default function LiveDisplay() {
  const [stats, setStats] = useState<BaseStats | null>(null);
  const [percent, setPercent] = useState(0);
  const [recentDonors, setRecentDonors] = useState<LiveDonation[]>([]);

  // Initial Fetch
  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/events/active/summary/`)
      .then(res => res.json())
      .then(data => {
        if (!data.error) {
          setStats({
            raised_amount: Number(data.raised_amount) || 0,
            target_amount: Number(data.target_amount) || 1,
            donation_count: Number(data.donation_count) || 0,
            highest_donor: data.highest_donor || 'None',
            highest_donation: Number(data.highest_donation) || 0,
            title: data.title || 'Live Fundraiser Gala'
          });
          const p = Math.min((Number(data.raised_amount) / Number(data.target_amount)) * 100, 100);
          setPercent(p);
        }
      })
      .catch(err => console.error(err));
  }, []);

  // SSE Subscription with auto-reconnect
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let retryDelay = 1000;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let isCancelled = false;

    function connect() {
      if (isCancelled) return;
      eventSource = new EventSource(`${process.env.NEXT_PUBLIC_API_URL}/api/events/active/stream/`);

      eventSource.onmessage = (event) => {
        retryDelay = 1000; // Reset backoff on successful message
        if (event.data === ': heartbeat') return;
        try {
          const data = JSON.parse(event.data);
          if (data.error) return;

          setStats(prev => {
            if (!prev) return prev;
            const p = Math.min((Number(data.raised_amount) / prev.target_amount) * 100, 100);
            setPercent(p);
            return {
              ...prev,
              raised_amount: Number(data.raised_amount) || prev.raised_amount,
              donation_count: Number(data.donation_count) || prev.donation_count,
              highest_donation: Number(data.highest_donation) || prev.highest_donation,
              highest_donor: data.highest_donor || prev.highest_donor,
            };
          });

          if (data.new_donations && data.new_donations.length > 0) {
            setRecentDonors(prev => {
              const currentIds = new Set(prev.map(d => d.id));
              const newOnes = data.new_donations.filter((d: any) => !currentIds.has(d.id));
              return [...newOnes, ...prev].slice(0, 20);
            });
          }
        } catch (err) { /* ignore parse errors */ }
      };

      eventSource.onerror = () => {
        eventSource?.close();
        if (!isCancelled) {
          retryTimer = setTimeout(() => {
            retryDelay = Math.min(retryDelay * 2, 30000); // Exponential backoff, max 30s
            connect();
          }, retryDelay);
        }
      };
    }

    connect();

    return () => {
      isCancelled = true;
      eventSource?.close();
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, []);

  if (!stats) {
    return <div className="loading-screen"><div className="loader"></div></div>;
  }

  return (
    <div className="live-page">
      {/* ========== TOP: Logo ========== */}
      <div className="top-logo-bar">
        <Image src="https://static.wixstatic.com/media/782bc6_823dfb29a08e4cb380cc89b346e85845~mv2.png/v1/fill/w_484,h_226,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/TALI%20Logo%20Styles%20stroked-01.png" alt="TALI Logo" width={280} height={80} style={{ objectFit: 'contain' }} priority />
      </div>

      {/* ========== BANNER with photos + title ========== */}
      <div className="banner-section">
        <div className="banner-photos">
          <img src="/downsyndrome.png" alt="" className="banner-img" />
          <img src="cripplegraduate.png" alt="" className="banner-img" />
          <img src="https://static.wixstatic.com/media/782bc6_4baa798f4915408ca21383bef2a7e4b4~mv2.jpeg/v1/fill/w_660,h_1000,al_c,q_85,enc_avif,quality_auto/782bc6_4baa798f4915408ca21383bef2a7e4b4~mv2.jpeg" alt="" className="banner-img" />
          <img src="https://static.wixstatic.com/media/782bc6_16703d544cb54a4f8fd8af37f1a93adc~mv2.png/v1/fill/w_702,h_690,al_c,q_90,usm_0.66_1.00_0.01,enc_avif,quality_auto/782bc6_16703d544cb54a4f8fd8af37f1a93adc~mv2.png" alt="" className="banner-img" />
          <img src="https://static.wixstatic.com/media/782bc6_e0233827090d4b9f8e04789f027c2dd5~mv2.jpg/v1/fill/w_335,h_690,al_c,q_80,usm_0.66_1.00_0.01,enc_avif,quality_auto/782bc6_e0233827090d4b9f8e04789f027c2dd5~mv2.jpg" alt="" className="banner-img" />
          <img src="https://static.wixstatic.com/media/782bc6_4e014ed444b74103b1b2d8558aaee95b~mv2.jpg/v1/crop/x_1497,y_0,w_3022,h_4016/fill/w_602,h_790,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/Tali%20Event%2050.jpg" alt="" className="banner-img" />
        </div>
        <div className="banner-overlay"></div>
        <h1 className="banner-title">{stats.title}</h1>
      </div>

      {/* ========== PROGRESS BAR ========== */}
      <div className="progress-section">
        <div className="progress-bar-wrapper">
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${percent}%` }}></div>
          </div>
          <div className="progress-raised-pill" data-text={`₦${stats.raised_amount.toLocaleString()}`} style={{ left: `${percent}%` }}>
            <span className="pill-amount">₦{stats.raised_amount.toLocaleString()}</span>
          </div>
        </div>
        <div className="progress-meta">
          <div className="meta-left">Total Donors <i className="fa-solid fa-users"></i> {stats.donation_count}</div>
          <div className="meta-right">Target: <span className="breathing-glow">₦{stats.target_amount.toLocaleString()}</span> <i className="fa-solid fa-bullseye"></i></div>
        </div>
      </div>

      {/* ========== BOTTOM 3-COLUMN SECTION ========== */}
      <div className="bottom-section">

        {/* LEFT: Highest Donor Card */}
        <div className="highest-donor-col">
          <div className="highest-donor-card">
            <div className="hd-trophy"><i className="fa-solid fa-trophy"></i></div>
            <div className="hd-label">Highest<br />Single Donor</div>
            <div className="hd-name">{stats.highest_donor}</div>
            <div className="hd-amount">₦{stats.highest_donation.toLocaleString()}</div>
          </div>
        </div>

        {/* CENTER: Donate Instructions */}
        <div className="donate-instructions-col">
          <h2 className="donate-heading">TO DONATE</h2>
          <div className="donate-steps">
            <div className="step">
              <div className="step-icon"><i className="fa-solid fa-qrcode"></i></div>
              <p>Scan the<br />QR Code</p>
            </div>
            <div className="step">
              <div className="step-icon"><i className="fa-solid fa-mobile-screen-button"></i></div>
              <p>Fill the form<br />and your desired<br />amount</p>
            </div>
            <div className="step">
              <div className="step-icon"><i className="fa-solid fa-circle-check"></i></div>
              <p>Proceed to<br />payment</p>
            </div>
          </div>
          <div className="donate-footer">
            <p>For more information, visit</p>
            <strong>www.theabilitylife.org</strong>
          </div>
        </div>

        {/* RIGHT: Recent Donors Scrollable Feed */}
        <div className="recent-donors-col">
          <div className="donors-scroll-container">
            {recentDonors.length > 0 ? recentDonors.map(don => (
              <div key={don.id} className="donor-row">
                <div className="donor-row-left">
                  <div className="donor-row-name">{don.donor_display}</div>
                  <div className="donor-row-amount">₦{Number(don.amount).toLocaleString()}</div>
                </div>
                <div className="donor-row-time">{timeAgo(don.created_at)}</div>
              </div>
            )) : (
              <>
                <div className="donor-row placeholder-row">
                  <div className="donor-row-left">
                    <div className="donor-row-name">Waiting for first donation...</div>
                    <div className="donor-row-amount"></div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Crowd silhouette at very bottom */}
      <div className="crowd-bg"></div>
    </div>
  );
}

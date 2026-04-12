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
            title: data.title || 'ART FOR ABILITY'
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
      {/* <div className="top-logo-bar">
        <Image src="https://static.wixstatic.com/media/782bc6_823dfb29a08e4cb380cc89b346e85845~mv2.png/v1/fill/w_484,h_226,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/TALI%20Logo%20Styles%20stroked-01.png" alt="TALI Logo" width={280} height={80} style={{ objectFit: 'contain' }} priority />
      </div> */}

      {/* ========== HERO: programme artwork + signature painting ========== */}
      <header className="hero-section" aria-label="Event">
        <div className="hero-art-layer" aria-hidden />
        <div className="hero-inner">
          <div className="hero-visual">
            <div className="hero-image-frame">
              <Image
                src="/TALI%20MAIN%20PIC.png"
                alt="TALI programme artwork — celebrating ability and inclusion"
                width={720}
                height={900}
                className="hero-main-pic"
                priority
                sizes="(max-width: 900px) 100vw, 38vw"
              />
            </div>
          </div>
          <div className="hero-copy-panel">
            <p className="banner-eyebrow">Live auction · Banquet Hall, State House, Abuja</p>
            <h1 className="banner-title">{stats.title}</h1>
            <p className="banner-tagline">Where Art Meets Impact · Funding Dreams, Building Futures</p>
            <p className="banner-subtitle">Creative Inclusion &amp; Enterprise Auction</p>
          </div>
          <div className="hero-logo-container">
            <Image src="https://static.wixstatic.com/media/782bc6_823dfb29a08e4cb380cc89b346e85845~mv2.png/v1/fill/w_484,h_226,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/TALI%20Logo%20Styles%20stroked-01.png" alt="TALI Logo" width={580} height={226} style={{ objectFit: 'contain' }} priority />
          </div>
        </div>
      </header>

      {/* ========== DONATIONS PROGRESS (prominent band) ========== */}
      <section className="progress-section" aria-label="Fundraising progress">
        <div className="progress-section-head">
          <div className="progress-head-text">
            <span className="progress-kicker">Live fundraising</span>
            <h2 className="progress-heading">Donations progress</h2>
          </div>
          <div className="progress-head-stats">
            <div className="progress-stat-chip">
              <span className="progress-stat-label">Raised</span>
              <span className="progress-stat-value">₦{stats.raised_amount.toLocaleString()}</span>
            </div>
            <div className="progress-stat-chip progress-stat-chip--target">
              <span className="progress-stat-label">Target</span>
              <span className="progress-stat-value">₦{stats.target_amount.toLocaleString()}</span>
            </div>
          </div>
        </div>
        <div className="progress-bar-wrapper">
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${percent}%` }} />
          </div>
          <div
            className="progress-raised-pill"
            data-text={`₦${stats.raised_amount.toLocaleString()}`}
            style={{ left: `${percent}%` }}
          >
            <span className="pill-amount">₦{stats.raised_amount.toLocaleString()}</span>
          </div>
        </div>
        <div className="progress-meta">
          <div className="meta-left">
            Total donors <i className="fa-solid fa-users" aria-hidden /> {stats.donation_count}
          </div>
          <div className="meta-right">
            <span className="meta-right-hint">Help us reach the goal</span>
            <i className="fa-solid fa-bullseye" aria-hidden />
          </div>
        </div>
      </section>

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

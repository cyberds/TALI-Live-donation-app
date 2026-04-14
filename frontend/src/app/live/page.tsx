"use client";

import React, { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import Confetti from '@/components/magicui/confetti';
import { fireEliteCelebration } from '@/lib/confetti-presets';
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
  const lastCelebrationCount = useRef<number | null>(null);
  const lastMilestone = useRef<string | null>(null);
  const confettiRef = useRef<any>(null);

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

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let retryDelay = 1000;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let isCancelled = false;

    function connect() {
      if (isCancelled) return;
      eventSource = new EventSource(`${process.env.NEXT_PUBLIC_API_URL}/api/events/active/stream/`);

      eventSource.onmessage = (event) => {
        retryDelay = 1000;
        if (event.data === ': heartbeat') return;
        try {
          const data = JSON.parse(event.data);
          if (data.error) return;

          setStats(prev => {
            if (!prev) return prev;
            const p = Math.min((Number(data.raised_amount) / prev.target_amount) * 100, 100);
            setPercent(p);
            
            // Celebration Trigger
            if (data.celebration_count !== undefined) {
               if (lastCelebrationCount.current !== null && data.celebration_count > lastCelebrationCount.current) {
                  fireEliteCelebration(confettiRef.current?.fire);
               }
               lastCelebrationCount.current = data.celebration_count;
            }
            
            // Milestone Celebration
            if (data.milestone && data.milestone !== lastMilestone.current) {
               if (data.milestone.includes("Goal Achieved")) {
                   fireEliteCelebration(confettiRef.current?.fire);
               }
               lastMilestone.current = data.milestone;
            }

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
        } catch { /* ignore */ }
      };

      eventSource.onerror = () => {
        eventSource?.close();
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
      eventSource?.close();
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, []);

  if (!stats) {
    return <div className="loading-screen"><div className="loader"></div></div>;
  }

  return (
    <div className="live-page">
      <Confetti ref={confettiRef} manualstart />
      {/* Slim header — text + logo only; room reserved for the donation arena */}
      <header className="live-header" aria-label="Event">
        <div className="live-header-bg" aria-hidden />
        <div className="live-header-inner">
          <div className="live-header-brand">
            <Image
              src="https://static.wixstatic.com/media/782bc6_823dfb29a08e4cb380cc89b346e85845~mv2.png/v1/fill/w_484,h_226,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/TALI%20Logo%20Styles%20stroked-01.png"
              alt="TALI"
              width={200}
              height={78}
              className="live-header-logo"
              priority
            />
          </div>
          <div className="live-header-copy">
            <p className="banner-eyebrow">Live auction · Banquet Hall, State House, Abuja</p>
            <h1 className="banner-title">{stats.title}</h1>
            {/* <p className="banner-tagline">Where Art Meets Impact · Funding Dreams, Building Futures</p> */}
            {/* <p className="banner-subtitle">Creative Inclusion &amp; Enterprise Auction</p> */}
          </div>
        </div>
      </header>

      {/* Primary focal band — ~2.5× previous bar height */}
      <section className="live-donation-arena" aria-label="Fundraising progress">
        <div className="donation-arena-top">
          <div className="donation-arena-titles">
            <span className="progress-kicker">Live fundraising</span>
            <h2 className="progress-heading">Donations progress</h2>
            <p className="donation-percent-badge" aria-live="polite">
              {Math.round(percent)}% of goal
            </p>
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

        <div className="progress-bar-wrapper progress-bar-wrapper--arena">
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${percent}%` }} />
          </div>
          <div
            className="progress-raised-pill"
            data-text={`₦${stats.raised_amount.toLocaleString()}`}
            style={{ 
              left: `${percent}%`,
              transform: `translate(-${percent}%, -50%)`
            }}
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

      {/* Main stage: signature art (space to shine) + hub + live feed */}
      <main className="live-main">
        <aside className="live-art-showcase" aria-label="Programme artwork">
          {/* <div className="art-showcase-frame"> */}
            <Image
              src="/TALI%20MAIN%20PIC.png"
              alt="TALI — signature programme artwork"
              width={1200}
              height={1900}
              className="art-showcase-img"
              // sizes="(max-width: 900px) 100vw, 24vw"
              sizes="100vw"
              style={{ width: 'auto', height: '100%', objectFit: 'contain' }}
            />
          {/* </div> */}
          <p className="art-showcase-label">Art for Ability</p>
        </aside>

        <div className="live-hub">
          <section className="live-champion" aria-label="Highest donor">
            <div className="highest-donor-card highest-donor-card--compact">
              <div className="hd-trophy"><i className="fa-solid fa-trophy" aria-hidden /></div>
              <div className="hd-label">Highest single donor</div>
              <div className="hd-name">{stats.highest_donor}</div>
              <div className="hd-amount">₦{stats.highest_donation.toLocaleString()}</div>
            </div>
          </section>

          <section className="live-donate-panel" aria-label="How to donate">
            <h2 className="donate-heading">To donate</h2>
            <div className="donate-steps donate-steps--horizontal">
              <div className="step">
                <div className="step-icon"><i className="fa-solid fa-qrcode" aria-hidden /></div>
                <p>Scan the<br />QR code</p>
              </div>
              <div className="step">
                <div className="step-icon"><i className="fa-solid fa-mobile-screen-button" aria-hidden /></div>
                <p>Fill the form<br />and amount</p>
              </div>
              <div className="step">
                <div className="step-icon"><i className="fa-solid fa-circle-check" aria-hidden /></div>
                <p>Proceed to<br />payment</p>
              </div>
            </div>
            <div className="donate-footer">
              <p>For more information, visit</p>
              <strong>www.theabilitylife.org</strong>
            </div>
          </section>
        </div>

        <section className="live-feed-col" aria-label="Recent donations">
          <h3 className="live-feed-heading">Recent donations</h3>
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
              <div className="donor-row placeholder-row">
                <div className="donor-row-left">
                  <div className="donor-row-name">Waiting for first donation...</div>
                  <div className="donor-row-amount" />
                </div>
              </div>
            )}
          </div>
        </section>
      </main>

      <div className="crowd-bg" aria-hidden />
    </div>
  );
}

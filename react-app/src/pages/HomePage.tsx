import React from "react";
import { Link } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import { useAuth } from "../context/AuthContext";
import "../../../styles.css";

export default function HomePage(): JSX.Element {
  const { user } = useAuth();

  return (
    <AppLayout>
      <main className="container">
        <section className="hero">
          <div className="hero-eyebrow">
            <span className="hero-eyebrow-dot" />
            Live markets · Real predictions
          </div>
          <h1>Prediction Markets for <span className="accent">the culture.</span></h1>
          <p className="hero-sub">
            Buy YES/NO contracts on events you actually care about — from $0.01 to $1.00.
          </p>
          <div className="hero-cta">
            {user ? (
              <>
                <Link className="btn btn-primary btn-lg" to="/events">Browse markets</Link>
                <Link className="btn btn-ghost btn-lg" to="/wallet">My wallet</Link>
              </>
            ) : (
              <>
                <Link className="btn btn-primary btn-lg" to="/signup">Get started</Link>
                <Link className="btn btn-ghost btn-lg" to="/events">Browse markets</Link>
              </>
            )}
          </div>
          <button
            className="scroll-hint"
            onClick={() => document.getElementById("featured")?.scrollIntoView({ behavior: "smooth" })}
          >
            Scroll to explore
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12l7 7 7-7" />
            </svg>
          </button>
        </section>

        <section id="featured" className="slideshow-section container">
          <div className="slideshow-label">Featured markets</div>
          <div className="cards-scroll">
            <Link className="snap-card" to="/events">
              <div className="slide-card">
                <div>
                  <span className="slide-tag ccny">CCNY · ▲ trending</span>
                  <div className="slide-question">Will the shuttle bus break down next month?</div>
                  <div className="slide-meta">143 trades · Closes Mar 31</div>
                </div>
                <div className="slide-prices">
                  <div className="slide-price yes"><span className="slide-price-label">YES</span><span className="slide-price-val">$0.62</span></div>
                  <div className="slide-price no"><span className="slide-price-label">NO</span><span className="slide-price-val">$0.38</span></div>
                </div>
              </div>
            </Link>
            <Link className="snap-card" to="/events">
              <div className="slide-card">
                <div>
                  <span className="slide-tag sports">Sports · ▲ trending</span>
                  <div className="slide-question">Will the Knicks win their next 3 games?</div>
                  <div className="slide-meta">210 trades · Closes Apr 5</div>
                </div>
                <div className="slide-prices">
                  <div className="slide-price yes"><span className="slide-price-label">YES</span><span className="slide-price-val">$0.35</span></div>
                  <div className="slide-price no"><span className="slide-price-label">NO</span><span className="slide-price-val">$0.65</span></div>
                </div>
              </div>
            </Link>
            <Link className="snap-card" to="/events">
              <div className="slide-card">
                <div>
                  <span className="slide-tag politics">Politics · ▲ trending</span>
                  <div className="slide-question">Will there be a government shutdown before July?</div>
                  <div className="slide-meta">367 trades · Closes Jul 1</div>
                </div>
                <div className="slide-prices">
                  <div className="slide-price yes"><span className="slide-price-label">YES</span><span className="slide-price-val">$0.41</span></div>
                  <div className="slide-price no"><span className="slide-price-label">NO</span><span className="slide-price-val">$0.59</span></div>
                </div>
              </div>
            </Link>
          </div>
          <div className="slideshow-nav">
            <Link className="events-cta" to="/events">View all markets →</Link>
          </div>
        </section>
      </main>
    </AppLayout>
  );
}

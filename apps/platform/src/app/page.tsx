import Link from "next/link";
import {
  ArrowRight,
  Cloud,
  CodeXml,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  Sparkles
} from "lucide-react";

export default function HomePage() {
  return (
    <div className="ot-landing">
      <section className="ot-hero" aria-labelledby="ot-hero-title">
        <span className="ot-hero__eyebrow">open-think beta2</span>
        <h1 id="ot-hero-title" className="ot-hero__title">
          Your own personal AI agent,
          <br />
          on your own Cloudflare account,
          <br />
          <em>in 60 seconds.</em>
        </h1>
        <p className="ot-hero__lede">
          One scoped Cloudflare token. One worker. One agent that learns, codes,
          and remembers what matters to you — running on infrastructure you own.
        </p>
        <div className="ot-hero__cta">
          <Link className="ot-button ot-button--primary ot-button--giant" href="/deploy">
            Launch your agent
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
          <a
            className="ot-button ot-button--ghost"
            href="https://github.com/openthink/openthink2"
            target="_blank"
            rel="noreferrer"
          >
            <CodeXml size={16} aria-hidden="true" />
            View source
          </a>
        </div>
      </section>

      <section className="ot-rows" aria-label="What you get">
        <article className="ot-row">
          <div className="ot-row__icon" aria-hidden="true">
            <Cloud size={22} />
          </div>
          <div className="ot-row__copy">
            <h3>Your Cloudflare, your bill</h3>
            <p>
              The agent worker, D1, R2, Vectorize and queue all run in your
              account. We never see your token, your data, or your usage.
            </p>
          </div>
        </article>
        <article className="ot-row">
          <div className="ot-row__icon" aria-hidden="true">
            <KeyRound size={22} />
          </div>
          <div className="ot-row__copy">
            <h3>Locked behind Cloudflare Access</h3>
            <p>
              Sign-in is gated by your email — no extra auth to build. Add
              teammates one address at a time when you need them.
            </p>
          </div>
        </article>
        <article className="ot-row">
          <div className="ot-row__icon" aria-hidden="true">
            <RefreshCw size={22} />
          </div>
          <div className="ot-row__copy">
            <h3>Stays up to date by itself</h3>
            <p>
              Pull upstream improvements with one click. Your agent keeps
              learning without you re-deploying anything.
            </p>
          </div>
        </article>
      </section>

      <footer className="ot-footer">
        <span className="ot-footer__brand">
          <Sparkles size={14} aria-hidden="true" />
          open-think
          <em>v0.3.0</em>
        </span>
        <nav className="ot-footer__links" aria-label="Footer links">
          <a
            href="https://github.com/openthink/openthink2"
            target="_blank"
            rel="noreferrer"
          >
            <CodeXml size={14} aria-hidden="true" />
            GitHub
          </a>
          <Link href="/deploy">Deploy</Link>
          <Link href="/admin">
            <ShieldCheck size={14} aria-hidden="true" />
            Admin
          </Link>
        </nav>
      </footer>
    </div>
  );
}

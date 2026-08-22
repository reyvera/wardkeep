import Link from 'next/link';
import { ArrowRight, Check, HeartHandshake, ShieldCheck, Sparkles, TrendingUp } from 'lucide-react';

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[var(--bg-primary)]">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold text-content-primary">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-blue text-sm font-bold text-white">W</span>
          Wardkeep
        </Link>
        <div className="flex items-center gap-2 sm:gap-4">
          <a href="https://reyvera.github.io/wardkeep/" className="hidden text-sm text-content-secondary hover:text-content-primary sm:inline">How it works</a>
          <Link href="/login" className="btn-secondary px-3 py-2 sm:px-4">Sign in</Link>
        </div>
      </nav>

      <section className="relative mx-auto max-w-6xl px-6 pb-16 pt-14 lg:px-8 lg:pb-24 lg:pt-24">
        <div className="absolute -right-48 top-0 h-96 w-96 rounded-full bg-accent-blue opacity-[0.09] blur-3xl" />
        <div className="absolute -left-32 bottom-0 h-72 w-72 rounded-full bg-accent-green opacity-[0.06] blur-3xl" />
        <div className="relative grid items-center gap-12 lg:grid-cols-[1.05fr_.95fr]">
          <div>
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-1.5 text-xs font-medium text-content-secondary"><Sparkles size={14} className="text-accent-blue" />A clearer way to care for your household</p>
            <h1 className="max-w-3xl text-4xl font-bold leading-[1.06] tracking-tight text-content-primary sm:text-5xl lg:text-6xl">Know what matters.<br /><span className="text-accent-blue">Feel ready for what’s next.</span></h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-content-secondary">Wardkeep brings your money, upcoming obligations, and household priorities into one calm place—then helps you see what needs attention before it becomes urgent.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/register" className="btn-primary px-5 py-3">Create your account <ArrowRight size={17} /></Link>
              <Link href="/login" className="btn-secondary px-5 py-3">I already use Wardkeep</Link>
            </div>
            <p className="mt-4 text-xs text-content-tertiary">Private by design. Self-hostable. Your financial life stays yours.</p>
          </div>

          <div className="relative mx-auto w-full max-w-md rounded-2xl border border-[var(--border-hover)] bg-[var(--bg-secondary)] p-5 shadow-2xl shadow-black/20">
            <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-4"><div><p className="text-xs font-medium uppercase tracking-wider text-content-tertiary">Household readiness</p><p className="mt-1 text-sm text-content-secondary">Based on what Wardkeep can see</p></div><div className="flex h-14 w-14 items-center justify-center rounded-full border-[5px] border-accent-blue text-lg font-bold text-content-primary">—</div></div>
            <div className="space-y-3 py-5">
              <div className="rounded-xl bg-[var(--bg-elevated)] p-3"><div className="flex items-center gap-3"><ShieldCheck className="text-accent-green" size={19} /><div className="flex-1"><p className="text-sm font-medium text-content-primary">Protection</p><p className="text-xs text-content-secondary">Your cash cushion and resilience</p></div><span className="text-xs text-content-tertiary">In view</span></div></div>
              <div className="rounded-xl bg-[var(--bg-elevated)] p-3"><div className="flex items-center gap-3"><TrendingUp className="text-accent-blue" size={19} /><div className="flex-1"><p className="text-sm font-medium text-content-primary">What’s changing</p><p className="text-xs text-content-secondary">Spend, bills, and financial progress</p></div><span className="text-xs text-content-tertiary">Clear</span></div></div>
              <div className="rounded-xl border border-accent-yellow/25 bg-accent-yellow/5 p-3"><p className="text-xs font-medium text-accent-yellow">Wardkeep tells you what it knows—and what still needs attention.</p></div>
            </div>
            <div className="flex items-center gap-2 text-xs text-content-tertiary"><HeartHandshake size={15} className="text-accent-green" />Helpful, never judgmental.</div>
          </div>
        </div>
      </section>

      <section className="border-y border-[var(--border-default)] bg-[var(--bg-secondary)]">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-14 sm:grid-cols-3 lg:px-8">
          {[
            ['See the whole picture', 'Accounts, spending, debt, budgets, and recurring bills together—not scattered across apps.'],
            ['Understand your readiness', 'A plain-language view of your household’s strengths, gaps, and confidence in the data.'],
            ['Take the next right step', 'Useful signals and upcoming needs, so small actions can prevent bigger surprises.'],
          ].map(([title, text]) => <div key={title}><div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-accent-blue/10 text-sm font-semibold text-accent-blue"><Check size={17} /></div><h2 className="text-base font-semibold text-content-primary">{title}</h2><p className="mt-2 text-sm leading-6 text-content-secondary">{text}</p></div>)}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16 text-center lg:px-8">
        <h2 className="text-2xl font-semibold text-content-primary sm:text-3xl">A steady home starts with a clearer view.</h2>
        <p className="mx-auto mt-3 max-w-xl text-content-secondary">Wardkeep is built to help you prepare—not to grade you. Start with the information you have, and build from there.</p>
        <Link href="/register" className="btn-primary mt-7 px-5 py-3">Get started <ArrowRight size={17} /></Link>
        <div className="mt-10 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-content-tertiary"><a href="https://reyvera.github.io/wardkeep/" className="hover:text-content-primary">Product guide</a><a href="https://reyvera.github.io/wardkeep/roadmap.html" className="hover:text-content-primary">Roadmap</a><a href="https://github.com/reyvera/wardkeep" className="hover:text-content-primary">Technical docs &amp; source</a></div>
      </section>
    </main>
  );
}

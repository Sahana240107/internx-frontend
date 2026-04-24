import Link from 'next/link'
import { landingMetrics, landingSteps, roleTracks } from '@/lib/teamHubData'

function SectionCard({ eyebrow, title, description, children }) {
  return (
    <section className="card p-6 md:p-8 noise-bg">
      <p className="text-xs uppercase tracking-[0.24em] mb-3" style={{ color: 'var(--accent)' }}>{eyebrow}</p>
      <h2 className="text-2xl md:text-3xl mb-3" style={{ color: 'var(--ink)' }}>{title}</h2>
      <p className="text-sm md:text-base max-w-3xl mb-6" style={{ color: 'var(--ink-muted)' }}>{description}</p>
      {children}
    </section>
  )
}

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden" style={{ background: 'var(--surface)' }}>
      <section className="relative px-6 py-8 md:px-10 lg:px-14">
        <div className="absolute inset-x-0 top-0 h-[28rem]" style={{ background: 'radial-gradient(circle at top left, rgba(91,79,255,0.18), transparent 38%), radial-gradient(circle at top right, rgba(0,200,150,0.16), transparent 32%)' }} />
        <div className="relative max-w-7xl mx-auto">
          <header className="flex items-center justify-between mb-16">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center font-display font-bold text-white text-xl" style={{ background: 'linear-gradient(135deg, var(--accent) 0%, #8b7fff 100%)' }}>X</div>
              <div>
                <p className="font-display text-xl" style={{ color: 'var(--ink)' }}>InternX</p>
                <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>Team-based internship workspace</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/auth/login" className="btn-ghost">Sign In</Link>
              <Link href="/dashboard" className="btn-primary">View Demo</Link>
            </div>
          </header>

          <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-10 items-center mb-12">
            <div className="animate-fade-up">
              <p className="text-xs uppercase tracking-[0.24em] mb-4" style={{ color: 'var(--accent)' }}>Virtual internship platform</p>
              <h1 className="text-5xl md:text-6xl leading-[0.95] mb-6 max-w-4xl" style={{ color: 'var(--ink)' }}>Build real products in structured frontend, backend, and tester teams.</h1>
              <p className="text-lg md:text-xl max-w-2xl mb-8" style={{ color: 'var(--ink-soft)' }}>InternX assigns projects by difficulty, provisions team repositories, tracks sprints, and gives every team one shared dashboard for setup, docs, review, collaboration, and analytics.</p>
              <div className="flex flex-wrap gap-3 mb-10">
                <Link href="/auth/login" className="btn-primary px-6 py-3">Start Internship</Link>
                <Link href="/dashboard" className="btn-ghost px-6 py-3" style={{ background: 'white', border: '1px solid var(--border)' }}>Open Team Dashboard</Link>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {landingMetrics.map(metric => (
                  <div key={metric.label} className="card p-4">
                    <p className="text-2xl font-display mb-1" style={{ color: 'var(--ink)' }}>{metric.value}</p>
                    <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>{metric.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-6 md:p-7 animate-fade-up stagger-1" style={{ background: 'rgba(255,255,255,0.92)' }}>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Current cohort workspace</p>
                  <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>Sprint 04 - Team commerce app</p>
                </div>
                <span className="badge" style={{ color: 'var(--green)', background: 'var(--green-soft)' }}>Live</span>
              </div>
              <div className="grid gap-4">
                <div className="rounded-2xl p-4" style={{ background: 'var(--surface-2)' }}>
                  <p className="text-xs mb-2" style={{ color: 'var(--ink-muted)' }}>Difficulty-based team sizing</p>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="rounded-xl p-3" style={{ background: 'white' }}><p className="font-semibold">Easy</p><p style={{ color: 'var(--ink-muted)' }}>3 members</p></div>
                    <div className="rounded-xl p-3" style={{ background: 'white' }}><p className="font-semibold">Medium</p><p style={{ color: 'var(--ink-muted)' }}>5 members</p></div>
                    <div className="rounded-xl p-3" style={{ background: 'white' }}><p className="font-semibold">Hard</p><p style={{ color: 'var(--ink-muted)' }}>8 members</p></div>
                  </div>
                </div>
                <div className="rounded-2xl p-4" style={{ background: 'linear-gradient(135deg, var(--accent-soft) 0%, rgba(255,255,255,0.95) 100%)' }}>
                  <div className="flex items-center justify-between mb-2"><p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Repo automation</p><span className="text-xs" style={{ color: 'var(--accent)' }}>GitHub connected</span></div>
                  <p className="text-sm mb-4" style={{ color: 'var(--ink-soft)' }}>Team repositories are generated from your InternX account template with onboarding docs, recommended VS Code settings, and sprint labels already added.</p>
                  <div className="rounded-xl p-3 text-sm" style={{ background: 'white', border: '1px solid var(--border)' }}>internx-teamcommerce-medium-fe-02</div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6">
            <SectionCard eyebrow="How It Works" title="One product journey from onboarding to the next assignment" description="The MVP flow below matches the features you asked to add, while staying lean enough to keep building quickly.">
              <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
                {landingSteps.map((step, index) => (
                  <div key={step.title} className="rounded-2xl p-5" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                    <p className="text-xs mb-3" style={{ color: 'var(--accent)' }}>0{index + 1}</p>
                    <h3 className="text-lg mb-2" style={{ color: 'var(--ink)' }}>{step.title}</h3>
                    <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>{step.description}</p>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard eyebrow="Role Tracks" title="Separate team lanes with one shared source of truth" description="Every project instance creates role-based teams while keeping docs, setup, schedule, review, and teammate visibility in one place.">
              <div className="grid md:grid-cols-3 gap-4">
                {roleTracks.map(track => (
                  <div key={track.title} className="card p-5">
                    <p className="text-sm font-semibold mb-2" style={{ color: track.color }}>{track.title}</p>
                    <p className="text-sm mb-4" style={{ color: 'var(--ink-muted)' }}>{track.description}</p>
                    <ul className="space-y-2 text-sm" style={{ color: 'var(--ink-soft)' }}>{track.points.map(point => <li key={point}>- {point}</li>)}</ul>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard eyebrow="Feature Coverage" title="Pre-login marketing plus post-project continuation" description="This scaffold includes the public front page, the new dashboard modules, and a next-project selector so interns can continue after completing a project.">
              <div className="grid lg:grid-cols-2 gap-4">
                <div className="rounded-2xl p-5" style={{ background: 'white', border: '1px solid var(--border)' }}>
                  <p className="text-sm font-semibold mb-2" style={{ color: 'var(--ink)' }}>Before sign in</p>
                  <p className="text-sm mb-4" style={{ color: 'var(--ink-muted)' }}>Hero, feature overview, role tracks, stats, workflow explanation, and clear call-to-action buttons.</p>
                  <Link href="/auth/login" className="btn-primary">Sign In to Continue</Link>
                </div>
                <div className="rounded-2xl p-5" style={{ background: 'white', border: '1px solid var(--border)' }}>
                  <p className="text-sm font-semibold mb-2" style={{ color: 'var(--ink)' }}>After project completion</p>
                  <p className="text-sm mb-4" style={{ color: 'var(--ink-muted)' }}>Recommendation cards let users pick a new project based on role readiness, prior score, and preferred difficulty.</p>
                  <Link href="/projects/next" className="btn-ghost" style={{ background: 'var(--surface-2)' }}>Preview Next Project Flow</Link>
                </div>
              </div>
            </SectionCard>
          </div>
        </div>
      </section>
    </main>
  )
}

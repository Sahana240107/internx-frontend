import Link from 'next/link'
import { nextProjects } from '@/lib/teamHubData'

export default function NextProjectPage() {
  return (
    <main className="min-h-screen px-6 py-10 md:px-10" style={{ background: 'var(--surface)' }}>
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 animate-fade-up">
          <p className="text-xs uppercase tracking-[0.22em] mb-3" style={{ color: 'var(--accent)' }}>Project completion flow</p>
          <h1 className="text-4xl md:text-5xl mb-3" style={{ color: 'var(--ink)' }}>Choose a new project</h1>
          <p className="text-base md:text-lg max-w-3xl" style={{ color: 'var(--ink-soft)' }}>This page is the post-project continuation segment. It lets interns review recommendations and immediately start a new challenge.</p>
        </div>
        <div className="grid lg:grid-cols-[0.7fr_1.3fr] gap-6">
          <section className="card p-6 animate-fade-up stagger-1">
            <p className="text-sm font-semibold mb-2" style={{ color: 'var(--ink)' }}>Completion snapshot</p>
            <div className="space-y-4 text-sm" style={{ color: 'var(--ink-soft)' }}>
              <div className="rounded-2xl p-4" style={{ background: 'var(--surface-2)' }}>Final score: <strong>89 / 100</strong></div>
              <div className="rounded-2xl p-4" style={{ background: 'var(--surface-2)' }}>Badge earned: <strong>Cross-team contributor</strong></div>
              <div className="rounded-2xl p-4" style={{ background: 'var(--surface-2)' }}>Recommended difficulty: <strong>Medium or Hard</strong></div>
            </div>
            <Link href="/dashboard" className="btn-ghost mt-5" style={{ background: 'white', border: '1px solid var(--border)' }}>Back to dashboard</Link>
          </section>
          <section className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 animate-fade-up stagger-2">{nextProjects.map(project => <article key={project.title} className="card p-5 flex flex-col"><p className="text-xs uppercase tracking-[0.18em] mb-2" style={{ color: 'var(--accent)' }}>{project.difficulty} difficulty</p><h2 className="text-xl mb-2" style={{ color: 'var(--ink)' }}>{project.title}</h2><p className="text-sm mb-3" style={{ color: 'var(--ink-muted)' }}>{project.summary}</p><p className="text-sm mb-5" style={{ color: 'var(--ink-soft)' }}>Recommended role: <strong>{project.recommendedRole}</strong></p><button className="btn-primary mt-auto">Choose project</button></article>)}</section>
        </div>
      </div>
    </main>
  )
}

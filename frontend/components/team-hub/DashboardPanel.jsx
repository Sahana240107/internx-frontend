export default function DashboardPanel({ title, description, children, tone = 'white' }) {
  return (
    <section className="card p-5 md:p-6" style={{ background: tone === 'soft' ? 'linear-gradient(180deg, rgba(237,233,255,0.75) 0%, white 100%)' : 'white' }}>
      <div className="mb-4">
        <h2 className="text-xl mb-1" style={{ color: 'var(--ink)' }}>{title}</h2>
        {description && <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>{description}</p>}
      </div>
      {children}
    </section>
  )
}

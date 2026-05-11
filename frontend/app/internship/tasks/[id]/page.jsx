'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { taskApi } from '@/lib/taskApi'
import { toast } from 'sonner'
import Link from 'next/link'
import api from '@/lib/api'
import { useAuthStore } from '@/lib/store/authStore'

// ─── Role Rubrics (matches review/page.jsx & mentor.py exactly) ───────────────
const ROLE_RUBRICS = {
  frontend: {
    task_completion:          { label: 'Task Completion',           max: 35 },
    correctness_reliability:  { label: 'Correctness & Reliability', max: 20 },
    code_quality:             { label: 'Code Quality',              max: 15 },
    security_best_practices:  { label: 'Security & Best Practices', max:  8 },
    testing_signals:          { label: 'Testing Signals',           max:  7 },
    performance_reliability:  { label: 'Performance',               max:  8 },
    maintainability:          { label: 'Maintainability',           max:  7 },
  },
  backend: {
    task_completion:          { label: 'Task Completion',           max: 30 },
    correctness_reliability:  { label: 'Correctness & Reliability', max: 25 },
    code_quality:             { label: 'Code Quality',              max: 15 },
    security_best_practices:  { label: 'Security & Best Practices', max: 15 },
    testing_signals:          { label: 'Testing Signals',           max:  8 },
    performance_reliability:  { label: 'Performance',               max:  7 },
  },
  ui_ux: {
    task_completion:          { label: 'Task Completion',           max: 40 },
    visual_design_quality:    { label: 'Visual Design Quality',     max: 20 },
    accessibility_compliance: { label: 'Accessibility',             max: 15 },
    handoff_completeness:     { label: 'Handoff Completeness',      max: 15 },
    responsiveness:           { label: 'Responsiveness',            max: 10 },
  },
  tester: {
    task_completion:          { label: 'Bug Credibility',           max: 25 },
    correctness_reliability:  { label: 'Reproducibility',          max: 20 },
    code_quality:             { label: 'Report Quality',            max: 15 },
    security_best_practices:  { label: 'Security Awareness',        max: 10 },
    testing_signals:          { label: 'Testing Depth',             max: 30 },
  },
  default: {
    task_completion:          { label: 'Task Completion',           max: 40 },
    correctness_reliability:  { label: 'Correctness & Reliability', max: 25 },
    code_quality:             { label: 'Code Quality',              max: 20 },
    security_best_practices:  { label: 'Security & Best Practices', max: 10 },
    testing_signals:          { label: 'Testing Signals',           max:  5 },
  },
}

const ROLE_DISPLAY = {
  frontend: 'Frontend Developer',
  backend:  'Backend Developer',
  ui_ux:    'UI/UX Developer',
  tester:   'Tester / QA',
  default:  'Software Engineer',
}

const QA_SUBMISSION_TYPES = [
  { key: 'bug_report',    label: '🐛 Bug Report',    desc: 'Document a bug found during testing' },
  { key: 'test_plan',     label: '📋 Test Plan',      desc: 'Upload a structured test plan document' },
  { key: 'automation_pr', label: '🤖 Automation PR', desc: 'Automated test code via GitHub PR' },
]

const HANDOFF_CHECKLIST_ITEMS = [
  { key: 'spacing',       label: 'Spacing & layout documented' },
  { key: 'colors',        label: 'Color tokens / palette defined' },
  { key: 'typography',    label: 'Typography scale specified' },
  { key: 'components',    label: 'Component states covered (hover, active, disabled)' },
  { key: 'assets',        label: 'Assets exported at correct resolutions' },
  { key: 'accessibility', label: 'Accessibility annotations present' },
  { key: 'responsive',    label: 'Responsive breakpoints defined' },
  { key: 'interactions',  label: 'Interactions / animations specified' },
]

const STATUS_CONFIG = {
  todo:        { label: 'To Do',       color: '#8888a0', bg: 'var(--surface-2)' },
  in_progress: { label: 'In Progress', color: '#3b82f6', bg: 'var(--blue-soft)' },
  review:      { label: 'In Review',   color: '#f59e0b', bg: 'var(--amber-soft)' },
  done:        { label: 'Done',        color: '#00c896', bg: 'var(--green-soft)' },
}

const PRIORITY_CONFIG = {
  low:    { label: 'Low',    color: '#8888a0', bg: 'var(--surface-2)' },
  medium: { label: 'Medium', color: '#f59e0b', bg: 'var(--amber-soft)' },
  high:   { label: 'High',   color: '#ef4444', bg: 'var(--red-soft)' },
  urgent: { label: 'Urgent', color: '#dc2626', bg: '#fff1f1' },
}

const fieldBase = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  color: 'var(--ink)',
  outline: 'none',
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ScoreRing({ score }) {
  const radius = 36
  const circ   = 2 * Math.PI * radius
  const offset = circ - (score / 100) * circ
  const color  = score >= 70 ? '#00c896' : score >= 50 ? '#f59e0b' : '#ef4444'
  return (
    <div className="relative w-24 h-24 flex items-center justify-center flex-shrink-0">
      <svg width="96" height="96" viewBox="0 0 96 96" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="48" cy="48" r={radius} fill="none" stroke="var(--border)" strokeWidth="8" />
        <circle cx="48" cy="48" r={radius} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-xl font-black" style={{ color }}>{score}</span>
        <span className="text-[9px] font-semibold" style={{ color: 'var(--ink-muted)' }}>/ 100</span>
      </div>
    </div>
  )
}

function SeverityBadge({ severity }) {
  const map = {
    critical: { bg: '#fef2f2', color: '#dc2626', label: 'Critical' },
    high:     { bg: '#fff7ed', color: '#ea580c', label: 'High' },
    medium:   { bg: '#fefce8', color: '#ca8a04', label: 'Medium' },
    low:      { bg: '#f0fdf4', color: '#16a34a', label: 'Low' },
  }
  const s = map[severity] || map.low
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
      style={{ background: s.bg, color: s.color }}>{s.label}</span>
  )
}

function RoleBadge({ role }) {
  return (
    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
      style={{ background: 'var(--accent)', color: '#fff', opacity: 0.9 }}>
      {ROLE_DISPLAY[role] || role}
    </span>
  )
}

function BreakdownBar({ label, score, max }) {
  const pct   = max > 0 ? Math.min(100, Math.round((score / max) * 100)) : 0
  const color = pct >= 70 ? '#00c896' : pct >= 40 ? '#f59e0b' : '#ef4444'
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs" style={{ color: 'var(--ink-soft)' }}>
        <span>{label}</span>
        <span className="font-semibold">{score}<span className="font-normal opacity-60">/{max}</span></span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

function Label({ children }) {
  return <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--ink-soft)' }}>{children}</p>
}

function ErrorBox({ message }) {
  return (
    <p className="text-xs font-medium px-3 py-2 rounded-xl"
      style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
      {message}
    </p>
  )
}

// ─── Phase 4: Merge Conflict Banner ──────────────────────────────────────────

function MergeConflictBanner({ score, groupRepoUrl }) {
  const [copied, setCopied] = useState(false)

  const copy = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  // Derive upstream remote hint from group repo URL
  const upstreamHint = groupRepoUrl
    ? groupRepoUrl.replace('https://github.com/', 'git@github.com:') + '.git'
    : null

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ border: '2px solid #f97316', background: '#fff7ed' }}>

      {/* Header */}
      <div className="px-5 py-4 flex items-center gap-3"
        style={{ background: '#fff', borderBottom: '1px solid #fed7aa' }}>
        <span className="text-xl">🔀</span>
        <div className="flex-1">
          <p className="text-sm font-bold" style={{ color: '#c2410c' }}>Merge Conflicts Detected</p>
          <p className="text-xs mt-0.5" style={{ color: '#9a3412' }}>
            Your code scored <strong>{score}/100</strong> and passed review, but your PR has merge conflicts
            with the team repo. You must resolve them before this task can be marked complete.
          </p>
        </div>
      </div>

      {/* Steps */}
      <div className="px-5 py-4 space-y-3">
        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#c2410c' }}>
          How to fix
        </p>

        {[
          { n: 1, cmd: 'git fetch upstream',        label: 'Fetch the latest team repo changes' },
          { n: 2, cmd: 'git merge upstream/main',   label: 'Merge base branch into your branch' },
          { n: 3, cmd: null,                        label: 'Resolve conflict markers in your editor' },
          { n: 4, cmd: 'git push origin your-branch', label: 'Push the resolved branch' },
          { n: 5, cmd: null,                        label: 'Come back here and resubmit the same PR URL' },
        ].map(step => (
          <div key={step.n} className="flex items-start gap-3">
            <span className="w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold flex-shrink-0 mt-0.5"
              style={{ background: '#f97316', color: '#fff' }}>{step.n}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm" style={{ color: '#92400e' }}>{step.label}</p>
              {step.cmd && (
                <code className="text-xs font-mono block mt-1 px-2 py-1 rounded-lg"
                  style={{ background: '#fff', border: '1px solid #fed7aa', color: '#7c2d12' }}>
                  {step.cmd}
                </code>
              )}
            </div>
          </div>
        ))}

        {/* Upstream setup hint — shown if we have the group repo URL */}
        {upstreamHint && (
          <div className="rounded-xl px-4 py-3 mt-1"
            style={{ background: '#fff', border: '1px solid #fed7aa' }}>
            <p className="text-xs font-semibold mb-2" style={{ color: '#c2410c' }}>
              💡 If you haven't set up upstream yet:
            </p>
            <div className="flex items-center gap-2">
              <code className="text-[11px] font-mono flex-1 truncate px-2 py-1 rounded-lg"
                style={{ background: '#fff7ed', color: '#7c2d12', border: '1px solid #fed7aa' }}>
                git remote add upstream {upstreamHint}
              </code>
              <button onClick={() => copy(`git remote add upstream ${upstreamHint}`)}
                className="text-xs px-2 py-1 rounded-lg font-semibold flex-shrink-0 transition-all"
                style={{
                  background: copied ? '#f0fdf4' : '#f97316',
                  color: copied ? '#16a34a' : '#fff',
                  border: 'none', cursor: 'pointer',
                }}>
                {copied ? '✓' : 'Copy'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Phase 5: How-to-Submit Guide ─────────────────────────────────────────────

function HowToSubmitGuide({ groupRepoUrl, role }) {
  // Only show for code roles — design / tester have their own instructions in the form
  if (role === 'ui_ux' || role === 'tester') return null

  const repoDisplay = groupRepoUrl || 'your team repo (check the Overview tab once the team is full)'

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ border: '1px solid var(--border)', background: 'var(--surface-2)' }}>
      <div className="px-5 py-3 flex items-center gap-2"
        style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
        <span className="text-sm">📖</span>
        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--ink-muted)' }}>
          How to submit
        </p>
      </div>
      <ol className="divide-y" style={{ divideColor: 'var(--border)' }}>
        {[
          {
            n: 1,
            title: 'Fork the team repo',
            body: (
              <>
                Fork{' '}
                {groupRepoUrl
                  ? <a href={groupRepoUrl} target="_blank" rel="noopener noreferrer"
                      className="font-mono text-[11px] break-all"
                      style={{ color: 'var(--accent)' }}>{groupRepoUrl}</a>
                  : <span style={{ color: 'var(--ink-muted)' }}>{repoDisplay}</span>
                }
                {' '}on GitHub — this is your team's shared codebase, not the original template.
              </>
            ),
          },
          {
            n: 2,
            title: 'Work on a feature branch',
            body: 'Create a branch (e.g. your-name/feature-name), implement the task, then commit your changes.',
          },
          {
            n: 3,
            title: 'Open a Pull Request',
            body: (
              <>
                Open a PR <strong>from your fork → {groupRepoUrl
                  ? <a href={groupRepoUrl} target="_blank" rel="noopener noreferrer"
                      style={{ color: 'var(--accent)' }}>{groupRepoUrl.replace('https://github.com/', '')}</a>
                  : 'the team repo'
                } main</strong>. Copy the PR URL from the GitHub page.
              </>
            ),
          },
          {
            n: 4,
            title: 'Paste the PR URL below',
            body: 'Paste your PR link in the field below and click Submit for Review. The AI will fetch your diff.',
          },
          {
            n: 5,
            title: 'Auto-merge on pass',
            body: 'If you score 70+ and there are no merge conflicts, your PR is automatically squash-merged into the team repo. 🎉',
          },
        ].map(step => (
          <li key={step.n} className="flex gap-3 px-5 py-3 list-none">
            <span className="w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold flex-shrink-0 mt-0.5"
              style={{ background: 'var(--accent)', color: '#fff' }}>{step.n}</span>
            <div>
              <p className="text-xs font-semibold mb-0.5" style={{ color: 'var(--ink)' }}>{step.title}</p>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--ink-muted)' }}>{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

// ─── Document upload helper ────────────────────────────────────────────────

async function readDocumentFile(file) {
  const ext = file.name.split('.').pop().toLowerCase()
  if (ext === 'pdf') {
    alert('PDF content cannot be read directly. Please use .txt or .md for best results.')
    return { text: `[PDF uploaded: ${file.name}]`, name: file.name, size: file.size }
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve({ text: e.target.result, name: file.name, size: file.size })
    reader.onerror = () => reject(new Error('Could not read file'))
    reader.readAsText(file)
  })
}

function DocUploadZone({ doc, onUpload, onRemove, label }) {
  const ref = useRef()
  return (
    <div>
      {label && <Label>{label}</Label>}
      <div onClick={() => ref.current?.click()}
        className="rounded-xl p-4 text-center cursor-pointer transition-all"
        style={{ border: '2px dashed var(--border)', background: doc ? '#f0fdf4' : 'var(--surface)' }}>
        {doc ? (
          <div className="space-y-1">
            <p className="text-sm font-semibold" style={{ color: '#16a34a' }}>
              📄 {doc.name} <span className="font-normal text-xs opacity-70">({Math.round(doc.size / 1024)} KB)</span>
            </p>
            <button onClick={e => { e.stopPropagation(); onRemove() }}
              className="text-xs underline" style={{ color: '#dc2626' }}>Remove</button>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-2xl">📄</p>
            <p className="text-sm font-medium" style={{ color: 'var(--ink-muted)' }}>Click to upload document</p>
            <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>.txt · .md · .pdf — max 2 MB</p>
          </div>
        )}
      </div>
      <input ref={ref} type="file" accept=".txt,.md,.pdf" className="hidden"
        onChange={async e => {
          const file = e.target.files?.[0]
          if (!file) return
          if (file.size > 2 * 1024 * 1024) { alert('Max 2 MB'); return }
          try { onUpload(await readDocumentFile(file)) } catch { alert('Could not read file.') }
        }} />
    </div>
  )
}

// ─── Role-specific submission forms ──────────────────────────────────────────

function FrontendForm({ prUrl, setPrUrl, screenshot, setScreenshot, error }) {
  const fileRef = useRef()
  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setScreenshot({ base64: ev.target.result.split(',')[1], mime: file.type, name: file.name })
    reader.readAsDataURL(file)
  }
  return (
    <div className="space-y-4">
      <div>
        <Label>GitHub Pull Request URL *</Label>
        <div className="rounded-xl px-3 py-2 text-xs font-mono mb-2"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink-muted)' }}>
          Example: <span style={{ color: 'var(--accent)' }}>https://github.com/owner/repo/pull/42</span>
        </div>
        <input type="url" value={prUrl} onChange={e => setPrUrl(e.target.value)}
          placeholder="https://github.com/owner/repo/pull/42"
          className="w-full px-3 py-3 rounded-xl text-sm" style={fieldBase} />
      </div>
      <div>
        <Label>Screenshot / Preview <span className="font-normal opacity-60">(optional)</span></Label>
        <div onClick={() => fileRef.current?.click()}
          className="rounded-xl p-4 text-center cursor-pointer transition-all"
          style={{ border: '2px dashed var(--border)', background: screenshot ? '#f0fdf4' : 'var(--surface)' }}>
          {screenshot ? (
            <div className="space-y-1">
              <p className="text-sm font-semibold" style={{ color: '#16a34a' }}>✅ {screenshot.name}</p>
              <button onClick={e => { e.stopPropagation(); setScreenshot(null) }} className="text-xs underline" style={{ color: '#dc2626' }}>Remove</button>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-2xl">📸</p>
              <p className="text-sm font-medium" style={{ color: 'var(--ink-muted)' }}>Click to upload a screenshot</p>
              <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>PNG, JPG, WEBP — max 5MB</p>
            </div>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </div>
      {error && <ErrorBox message={error} />}
    </div>
  )
}

function BackendForm({ prUrl, setPrUrl, error }) {
  return (
    <div className="space-y-4">
      <div>
        <Label>GitHub Pull Request URL *</Label>
        <div className="rounded-xl px-3 py-2 text-xs font-mono mb-2"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink-muted)' }}>
          Example: <span style={{ color: 'var(--accent)' }}>https://github.com/owner/repo/pull/42</span>
        </div>
        <input type="url" value={prUrl} onChange={e => setPrUrl(e.target.value)}
          placeholder="https://github.com/owner/repo/pull/42"
          className="w-full px-3 py-3 rounded-xl text-sm" style={fieldBase} />
        <p className="text-xs mt-2" style={{ color: 'var(--ink-muted)' }}>
          The AI will fetch your diff and run a 4-layer enterprise audit — Security · Governance · Maintainability · Performance.
        </p>
      </div>
      {error && <ErrorBox message={error} />}
    </div>
  )
}

function DesignForm({ fields, setFields, error }) {
  const fileRef = useRef()
  const set = (key, val) => setFields(f => ({ ...f, [key]: val }))
  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => set('image', { base64: ev.target.result.split(',')[1], mime: file.type, name: file.name })
    reader.readAsDataURL(file)
  }
  const toggleCheck = (key) => setFields(f => ({ ...f, checklist: { ...f.checklist, [key]: !f.checklist?.[key] } }))
  const checked      = fields.checklist || {}
  const checkedCount = Object.values(checked).filter(Boolean).length

  return (
    <div className="space-y-5">
      <div className="rounded-xl px-4 py-3 text-xs space-y-1"
        style={{ background: '#f5f3ff', border: '1px solid #e9d5ff', color: '#6b21a8' }}>
        <p className="font-bold">🎨 UI/UX Design Submission</p>
        <p>No PR needed. Share your Figma link, upload screenshots, complete the handoff checklist, and explain your decisions.</p>
      </div>
      <div>
        <Label>Figma File / Prototype URL</Label>
        <input type="url" value={fields.figmaUrl || ''} onChange={e => set('figmaUrl', e.target.value)}
          placeholder="https://www.figma.com/file/..."
          className="w-full px-3 py-3 rounded-xl text-sm" style={fieldBase} />
      </div>
      <div>
        <Label>Design Screenshot / Export <span className="font-normal opacity-60">(PNG, JPG, WEBP)</span></Label>
        <div onClick={() => fileRef.current?.click()}
          className="rounded-xl p-4 text-center cursor-pointer transition-all"
          style={{ border: '2px dashed var(--border)', background: fields.image ? '#f0fdf4' : 'var(--surface)' }}>
          {fields.image ? (
            <div className="space-y-1">
              <p className="text-sm font-semibold" style={{ color: '#16a34a' }}>✅ {fields.image.name}</p>
              <button onClick={e => { e.stopPropagation(); set('image', null) }} className="text-xs underline" style={{ color: '#dc2626' }}>Remove</button>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-2xl">🖼️</p>
              <p className="text-sm font-medium" style={{ color: 'var(--ink-muted)' }}>Upload design export</p>
              <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>Max 5MB</p>
            </div>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>Handoff Checklist</Label>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{
              background: checkedCount === HANDOFF_CHECKLIST_ITEMS.length ? '#f0fdf4' : 'var(--surface-2)',
              color: checkedCount === HANDOFF_CHECKLIST_ITEMS.length ? '#16a34a' : 'var(--ink-muted)',
              border: '1px solid var(--border)',
            }}>
            {checkedCount}/{HANDOFF_CHECKLIST_ITEMS.length} items
          </span>
        </div>
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          {HANDOFF_CHECKLIST_ITEMS.map((item, i) => (
            <button key={item.key} onClick={() => toggleCheck(item.key)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all"
              style={{
                borderBottom: i < HANDOFF_CHECKLIST_ITEMS.length - 1 ? '1px solid var(--border)' : 'none',
                background: checked[item.key] ? '#f0fdf4' : 'var(--surface)',
              }}>
              <span className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 text-xs font-bold"
                style={{ background: checked[item.key] ? '#16a34a' : 'var(--border)', color: '#fff' }}>
                {checked[item.key] ? '✓' : ''}
              </span>
              <span className="text-sm" style={{ color: checked[item.key] ? '#166534' : 'var(--ink-soft)' }}>{item.label}</span>
            </button>
          ))}
        </div>
      </div>
      <div>
        <Label>Explain your design decisions *</Label>
        <textarea value={fields.explanation || ''} onChange={e => set('explanation', e.target.value)}
          placeholder="Walk the reviewer through your key design decisions. What did you prioritise? What trade-offs did you make?"
          rows={5} className="w-full px-3 py-3 rounded-xl text-sm resize-none" style={fieldBase} />
      </div>
      {error && <ErrorBox message={error} />}
    </div>
  )
}

function TesterForm({ qaType, setQaType, fields, setFields, error }) {
  const set = (key, val) => setFields(f => ({ ...f, [key]: val }))
  return (
    <div className="space-y-5">
      <div className="rounded-xl px-4 py-3 text-xs space-y-1"
        style={{ background: '#fef3c7', border: '1px solid #fde68a', color: '#92400e' }}>
        <p className="font-bold">🧪 QA Submission</p>
        <p>Choose your submission type. Each uses a tester-specific rubric that weights testing quality heavily.</p>
      </div>
      <div>
        <Label>Submission Type *</Label>
        <div className="grid grid-cols-1 gap-2">
          {QA_SUBMISSION_TYPES.map(t => (
            <button key={t.key} onClick={() => setQaType(t.key)}
              className="text-left px-4 py-3 rounded-xl transition-all"
              style={{
                background: qaType === t.key ? 'var(--accent)' : 'var(--surface)',
                color: qaType === t.key ? '#fff' : 'var(--ink)',
                border: `1.5px solid ${qaType === t.key ? 'var(--accent)' : 'var(--border)'}`,
              }}>
              <p className="text-sm font-bold">{t.label}</p>
              <p className="text-xs mt-0.5 opacity-70">{t.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {qaType === 'bug_report' && (
        <div className="space-y-4 rounded-2xl p-4"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--ink-muted)' }}>🐛 Bug Report Details</p>
          <div>
            <Label>Bug Title *</Label>
            <input type="text" value={fields.bugTitle || ''} onChange={e => set('bugTitle', e.target.value)}
              placeholder="Short, descriptive title"
              className="w-full px-3 py-2.5 rounded-xl text-sm" style={fieldBase} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Severity</Label>
              <select value={fields.bugSeverity || ''} onChange={e => set('bugSeverity', e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-sm" style={fieldBase}>
                <option value="">Select…</option>
                <option value="critical">🔴 Critical</option>
                <option value="high">🟠 High</option>
                <option value="medium">🟡 Medium</option>
                <option value="low">🟢 Low</option>
              </select>
            </div>
            <div>
              <Label>Environment</Label>
              <input type="text" value={fields.bugEnvironment || ''} onChange={e => set('bugEnvironment', e.target.value)}
                placeholder="e.g. Chrome 124, macOS"
                className="w-full px-3 py-2.5 rounded-xl text-sm" style={fieldBase} />
            </div>
          </div>
          <div>
            <Label>Steps to Reproduce *</Label>
            <textarea value={fields.bugSteps || ''} onChange={e => set('bugSteps', e.target.value)}
              placeholder={"1. Go to /login\n2. Enter credentials\n3. Observe…"}
              rows={5} className="w-full px-3 py-3 rounded-xl text-sm resize-none" style={fieldBase} />
          </div>
          <div className="grid grid-cols-1 gap-3">
            <div>
              <Label>Expected Behaviour</Label>
              <input type="text" value={fields.bugExpected || ''} onChange={e => set('bugExpected', e.target.value)}
                placeholder="What should happen?" className="w-full px-3 py-2.5 rounded-xl text-sm" style={fieldBase} />
            </div>
            <div>
              <Label>Actual Behaviour</Label>
              <input type="text" value={fields.bugActual || ''} onChange={e => set('bugActual', e.target.value)}
                placeholder="What actually happens?" className="w-full px-3 py-2.5 rounded-xl text-sm" style={fieldBase} />
            </div>
          </div>
        </div>
      )}

      {qaType === 'test_plan' && (
        <div className="space-y-4 rounded-2xl p-4"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--ink-muted)' }}>📋 Test Plan Details</p>
          <div>
            <Label>Scope *</Label>
            <input type="text" value={fields.testScope || ''} onChange={e => set('testScope', e.target.value)}
              placeholder="e.g. User authentication module"
              className="w-full px-3 py-2.5 rounded-xl text-sm" style={fieldBase} />
          </div>
          <div>
            <Label>Coverage Areas</Label>
            <input type="text" value={fields.testCoverage || ''} onChange={e => set('testCoverage', e.target.value)}
              placeholder="e.g. Happy paths, edge cases, error states"
              className="w-full px-3 py-2.5 rounded-xl text-sm" style={fieldBase} />
          </div>
          <DocUploadZone
            doc={fields.testCasesDoc || null}
            onUpload={doc => set('testCasesDoc', doc)}
            onRemove={() => set('testCasesDoc', null)}
            label="Test Cases Document * (.txt · .md · .pdf)"
          />
          {!fields.testCasesDoc && (
            <div className="rounded-xl px-3 py-2 text-xs"
              style={{ background: '#fefce8', border: '1px solid #fde68a', color: '#854d0e' }}>
              <p className="font-semibold mb-1">💡 Recommended format (given / when / then)</p>
              <pre className="whitespace-pre-wrap font-mono text-[10px] opacity-80">{`1. Given a new user
   When they submit valid credentials
   Then they are redirected to /dashboard`}</pre>
            </div>
          )}
        </div>
      )}

      {qaType === 'automation_pr' && (
        <div className="space-y-4 rounded-2xl p-4"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--ink-muted)' }}>🤖 Automation PR Details</p>
          <div>
            <Label>GitHub PR URL *</Label>
            <input type="url" value={fields.prUrl || ''} onChange={e => set('prUrl', e.target.value)}
              placeholder="https://github.com/owner/repo/pull/42"
              className="w-full px-3 py-3 rounded-xl text-sm" style={fieldBase} />
          </div>
          <div>
            <Label>Test Framework</Label>
            <select value={fields.framework || ''} onChange={e => set('framework', e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl text-sm" style={fieldBase}>
              <option value="">Select framework…</option>
              <option value="pytest">pytest (Python)</option>
              <option value="jest">Jest (JavaScript)</option>
              <option value="cypress">Cypress (E2E)</option>
              <option value="playwright">Playwright (E2E)</option>
              <option value="vitest">Vitest</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
      )}

      {error && <ErrorBox message={error} />}
    </div>
  )
}

// ─── ReviewPanel: role-aware, fixed overflow ──────────────────────────────────

function ReviewPanel({ review, score, internRole }) {
  if (!review) return null

  const role    = internRole || review.intern_role || 'default'
  const rubric  = review.rubric_maxes
    ? Object.fromEntries(
        Object.entries(review.rubric_maxes).map(([k, v]) => [
          k,
          { label: ROLE_RUBRICS[role]?.[k]?.label || k, max: v },
        ])
      )
    : ROLE_RUBRICS[role] || ROLE_RUBRICS.default

  const passed       = score >= 70
  const verdictColor = passed ? '#00c896' : '#ef4444'
  const verdictBg    = passed ? '#f0fdf4' : '#fff5f5'
  const bd           = review.breakdown || {}

  return (
    <div className="space-y-4">

      {/* Verdict banner */}
      <div className="rounded-2xl p-5 flex items-center gap-5"
        style={{ background: verdictBg, border: `1.5px solid ${verdictColor}40` }}>
        <ScoreRing score={score} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-lg font-black" style={{ color: verdictColor }}>
              {passed ? '✅ Passed' : '🔁 Needs Work'}
            </span>
            {review.confidence != null && (
              <span className="text-xs px-2 py-0.5 rounded-full"
                style={{ background: 'white', color: 'var(--ink-muted)' }}>
                {Math.round(review.confidence * 100)}% confidence
              </span>
            )}
          </div>
          {review.review_summary && (
            <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>{review.review_summary}</p>
          )}
        </div>
      </div>

      {/* Score breakdown */}
      <div className="rounded-2xl p-5 space-y-3"
        style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Score Breakdown</p>
          <RoleBadge role={role} />
        </div>
        {Object.entries(rubric).map(([key, cfg]) => (
          <BreakdownBar key={key} label={cfg.label} score={bd[key] || 0} max={cfg.max} />
        ))}
      </div>

      {/* Strengths */}
      {review.strengths?.length > 0 && (
        <div className="rounded-2xl p-5 space-y-2"
          style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
          <p className="text-sm font-semibold" style={{ color: '#15803d' }}>✅ What you did well</p>
          <ul className="space-y-1.5">
            {review.strengths.map((s, i) => (
              <li key={i} className="text-sm flex gap-2" style={{ color: '#166534' }}>
                <span>•</span><span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Blocking issues */}
      {review.blocking_issues?.length > 0 && (
        <div className="rounded-2xl p-5 space-y-3"
          style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
          <p className="text-sm font-semibold" style={{ color: '#dc2626' }}>🚧 Blocking Issues</p>
          {review.blocking_issues.map((b, i) => (
            <div key={i} className="rounded-xl p-3 space-y-1.5"
              style={{ background: '#fff', border: '1px solid #fecaca' }}>
              <div className="flex items-center gap-2 flex-wrap">
                <SeverityBadge severity={b.severity} />
                {b.file && (
                  <code className="text-xs px-1.5 py-0.5 rounded"
                    style={{ background: '#f1f5f9', color: '#475569' }}>
                    {b.file}{b.line ? `:${b.line}` : ''}
                  </code>
                )}
              </div>
              <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{b.issue}</p>
              {b.why_it_matters && (
                <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>
                  <span className="font-semibold">Why it matters: </span>{b.why_it_matters}
                </p>
              )}
              {b.fix && (
                <p className="text-xs px-2 py-1.5 rounded-lg"
                  style={{ background: '#f0fdf4', color: '#166534' }}>
                  <span className="font-semibold">Fix: </span>{b.fix}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Missing requirements */}
      {review.missing_requirements?.length > 0 && (
        <div className="rounded-2xl p-5 space-y-2"
          style={{ background: '#fff7ed', border: '1px solid #fed7aa' }}>
          <p className="text-sm font-semibold" style={{ color: '#c2410c' }}>📋 Missing Requirements</p>
          <ul className="space-y-1">
            {review.missing_requirements.map((m, i) => (
              <li key={i} className="text-sm flex gap-2" style={{ color: '#9a3412' }}>
                <span>✕</span><span>{m}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Improvements */}
      {review.improvements?.length > 0 && (
        <div className="rounded-2xl p-5 space-y-2"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>💡 Suggested Improvements</p>
          <ul className="space-y-2">
            {review.improvements.map((im, i) => (
              <li key={i} className="text-sm" style={{ color: 'var(--ink-soft)' }}>
                {im.priority && (
                  <span className="font-semibold text-xs uppercase mr-1"
                    style={{ color: im.priority === 'high' ? '#ea580c' : '#ca8a04' }}>
                    [{im.priority}]
                  </span>
                )}
                {im.item || im}
                {im.expected_outcome && (
                  <span className="block text-xs mt-0.5" style={{ color: 'var(--ink-muted)' }}>
                    → {im.expected_outcome}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Next steps */}
      {review.next_steps?.length > 0 && (
        <div className="rounded-2xl p-5 space-y-2"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>🎯 Next Steps</p>
          <ol className="space-y-1.5 list-none">
            {review.next_steps.map((s, i) => (
              <li key={i} className="text-sm flex gap-2 items-start" style={{ color: 'var(--ink-soft)' }}>
                <span className="w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold flex-shrink-0 mt-0.5"
                  style={{ background: 'var(--accent)', color: '#fff' }}>{i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function TaskDetailPage() {
  const { id } = useParams()
  const router  = useRouter()
  const { user } = useAuthStore()

  const [task,          setTask]          = useState(null)
  const [loading,       setLoading]       = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [submitting,    setSubmitting]    = useState(false)
  const [polling,       setPolling]       = useState(false)
  const [fetchMsg,      setFetchMsg]      = useState('')
  const [formError,     setFormError]     = useState('')

  // Phase 5: group repo URL
  const [groupRepoUrl, setGroupRepoUrl] = useState('')

  // Submission form state
  const [prUrl,         setPrUrl]         = useState('')
  const [screenshot,    setScreenshot]    = useState(null)
  const [designFields,  setDesignFields]  = useState({ figmaUrl: '', explanation: '', checklist: {}, image: null })
  const [qaType,        setQaType]        = useState('bug_report')
  const [qaFields,      setQaFields]      = useState({})

  useEffect(() => {
    if (id) {
      localStorage.setItem('current_task_id', id)
      loadTask()
    }
  }, [id])

  // Auto-refresh every 5 s while in review
  useEffect(() => {
    if (task?.status !== 'review') return
    const interval = setInterval(() => loadTask(), 5000)
    return () => clearInterval(interval)
  }, [task?.status])

  // Phase 5: fetch group repo URL once we know the group_id
  useEffect(() => {
    if (!task?.group_id) return
    api.get(`/api/groups/${task.group_id}`)
      .then(res => {
        const url = res.data?.repo_url
        if (url) setGroupRepoUrl(url)
      })
      .catch(() => {
        // group endpoint may not exist yet — silently ignore
      })
  }, [task?.group_id])

  const loadTask = async () => {
    try {
      const res = await taskApi.getTask(id)
      setTask(res.data)
      if (res.data.github_pr_url) setPrUrl(res.data.github_pr_url)
    } catch {
      toast.error('Task not found')
      router.push('/dashboard')
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (newStatus) => {
    setActionLoading(true)
    try {
      const res = await taskApi.updateStatus(task.id, newStatus)
      setTask(res.data)
      toast.success(`Task moved to ${STATUS_CONFIG[newStatus]?.label}`)
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to update status')
    } finally {
      setActionLoading(false)
    }
  }

  const effectiveRole = task?.intern_role || 'default'

  // ── Phase 4: parse conflict state from task.feedback ──────────────────────
  let latestReview  = null
  let mergeStatus   = null
  let mergeError    = ''
  let hasConflict   = false

  if (task?.feedback) {
    try {
      const feedbackObj = typeof task.feedback === 'string'
        ? JSON.parse(task.feedback)
        : task.feedback
      latestReview = feedbackObj.latest_review || feedbackObj
      mergeStatus  = feedbackObj.merge_status || null
      mergeError   = feedbackObj.merge_error  || ''
      hasConflict  = mergeStatus === 'conflict'
    } catch {
      // plain text feedback — ignore
    }
  }

  const hasScore = task?.score !== null && task?.score !== undefined
  const passed   = hasScore && task.score >= 70

  const validateSubmission = () => {
    const role = effectiveRole
    if (role === 'ui_ux') {
      if (!designFields.figmaUrl?.trim() && !designFields.image && !designFields.explanation?.trim())
        return 'Please provide at least a Figma URL, screenshot, or explanation.'
      if (!designFields.explanation?.trim()) return 'Please explain your design decisions.'
    } else if (role === 'tester') {
      if (qaType === 'bug_report') {
        if (!qaFields.bugTitle?.trim()) return 'Please add a bug title.'
        if (!qaFields.bugSteps?.trim()) return 'Please add steps to reproduce.'
      } else if (qaType === 'test_plan') {
        if (!qaFields.testScope?.trim()) return 'Please define the test scope.'
        if (!qaFields.testCasesDoc) return 'Please upload your test cases document.'
      } else if (qaType === 'automation_pr') {
        if (!qaFields.prUrl?.trim() || !qaFields.prUrl.includes('github.com') || !qaFields.prUrl.includes('/pull/'))
          return 'Please provide a valid GitHub PR URL.'
      }
    } else {
      if (!prUrl.trim()) return 'Please paste your GitHub PR link.'
      if (!prUrl.includes('github.com') || !prUrl.includes('/pull/'))
        return "That doesn't look like a GitHub PR link (https://github.com/owner/repo/pull/42)"
    }
    return null
  }

  // ── Phase 6: main submit handler — routes to merge-retry if in conflict ───
  const handleSubmitForReview = async () => {
    const ve = validateSubmission()
    if (ve) { setFormError(ve); return }
    setFormError(''); setSubmitting(true)
    const role   = effectiveRole
    const userId = user?.id || localStorage.getItem('user_id') || ''

    try {
      let res

      // Phase 6: if task already passed but has conflicts → skip AI, just retry merge
      if (hasConflict) {
        setFetchMsg('Re-checking merge status…')
        res = await api.post('/api/mentor/review/merge-retry', {
          task_id: task.id,
          pr_url:  prUrl.trim(),
          user_id: userId,
        })

        if (res.data?.status === 'merged') {
          toast.success('PR merged! Task is now complete 🎉')
          setFetchMsg('')
          await loadTask()
          return
        }

        if (res.data?.status === 'conflict') {
          setFormError(res.data.message || 'Still has merge conflicts. Resolve them and resubmit.')
          setFetchMsg('')
          // Reload task to refresh conflict timestamp in feedback
          await loadTask()
          return
        }

        if (res.data?.status === 'error') {
          setFormError(res.data.message || 'Merge retry failed. Try again.')
          setFetchMsg('')
          return
        }

        // Unexpected — fall through to reload
        setFetchMsg('')
        await loadTask()
        return
      }

      // ── Normal full review path ────────────────────────────────────────────
      if (role === 'ui_ux') {
        setFetchMsg('Submitting design for AI review…')
        res = await api.post('/api/mentor/review/design', {
          task_id:           task.id,
          user_id:           userId,
          figma_url:         designFields.figmaUrl?.trim() || null,
          explanation:       designFields.explanation?.trim() || '',
          handoff_checklist: designFields.checklist || {},
          image_base64:      designFields.image?.base64 || null,
          image_mime:        designFields.image?.mime || 'image/png',
        })
      } else if (role === 'tester') {
        setFetchMsg('Submitting QA work for review…')
        const payload = { task_id: task.id, user_id: userId, submission_type: qaType }
        if (qaType === 'bug_report') Object.assign(payload, {
          bug_title:       qaFields.bugTitle || '',
          bug_steps:       qaFields.bugSteps || '',
          bug_expected:    qaFields.bugExpected || '',
          bug_actual:      qaFields.bugActual || '',
          bug_severity:    qaFields.bugSeverity || '',
          bug_environment: qaFields.bugEnvironment || '',
        })
        else if (qaType === 'test_plan') Object.assign(payload, {
          test_plan_scope:      qaFields.testScope || '',
          test_cases:           qaFields.testCasesDoc?.text || '',
          test_coverage_areas:  qaFields.testCoverage || '',
        })
        else Object.assign(payload, {
          pr_url:               qaFields.prUrl?.trim() || '',
          automation_framework: qaFields.framework || '',
        })
        res = await api.post('/api/mentor/review/qa', payload)
      } else {
        setFetchMsg('Fetching your PR from GitHub…')
        await taskApi.submitPR(task.id, prUrl.trim()).catch(() => {})
        res = await api.post('/api/mentor/review', {
          task_id: task.id,
          pr_url:  prUrl.trim(),
          user_id: userId,
        })
      }

      if (res.data?.status === 'error') {
        setFormError(res.data.message || 'Submission failed.')
        setFetchMsg('')
        return
      }

      setFetchMsg(
        role === 'ui_ux' || role === 'tester'
          ? 'Submission received — AI review running…'
          : 'PR fetched ✓ — AI review running…'
      )

      setTask(t => ({ ...t, status: 'review' }))

      setPolling(true)
      let attempts = 0
      const poll = setInterval(async () => {
        attempts++
        try {
          const taskRes = await taskApi.getTask(task.id)
          const t = taskRes.data
          if (t.status !== 'review' || attempts > 24) {
            clearInterval(poll)
            setPolling(false)
            setFetchMsg('')
            setTask(t)
          }
        } catch {
          clearInterval(poll)
          setPolling(false)
          setFetchMsg('')
        }
      }, 3000)

    } catch (err) {
      setFormError(err?.response?.data?.detail || err?.response?.data?.message || 'Submission failed. Try again.')
      setFetchMsg('')
    } finally {
      setSubmitting(false)
    }
  }

  const submitLabel = () => {
    if (submitting) return effectiveRole === 'ui_ux' ? 'Uploading…' : effectiveRole === 'tester' ? 'Submitting QA…' : hasConflict ? 'Checking merge…' : 'Fetching PR…'
    if (polling)    return '⏳ Running AI review…'
    if (hasConflict) return '🔀 Resubmit after resolving →'
    if (effectiveRole === 'ui_ux')  return '🎨 Submit Design for Review'
    if (effectiveRole === 'tester') return '🧪 Submit for QA Review'
    return '🔍 Submit for Review →'
  }

  // ── Phase 4: show submit form also when in conflict state ─────────────────
  const showSubmitForm =
    task?.status === 'in_progress' ||
    hasConflict ||
    (task?.status === 'review' && hasScore && !passed)

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--surface)' }}>
      <div className="w-7 h-7 rounded-full border-2 animate-spin"
        style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
    </div>
  )

  if (!task) return null

  const status   = STATUS_CONFIG[task.status]    || STATUS_CONFIG.todo
  const priority = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done'
  const dueDate   = task.due_date
    ? new Date(task.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : null
  const resources = task.resources ? task.resources.split('\n').filter(Boolean) : []

  return (
    <div className="min-h-screen" style={{ background: 'var(--surface)' }}>
      {/* Navbar */}
      <header className="sticky top-0 z-40 px-6 h-16 flex items-center gap-4"
        style={{ background: 'rgba(248,248,252,0.8)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)' }}>
        <Link href="/dashboard" className="btn-ghost py-2 flex items-center gap-2"
          style={{ color: 'var(--ink-soft)' }}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Dashboard
        </Link>
        <div className="w-px h-4" style={{ background: 'var(--border)' }} />
        <span className="text-sm font-medium truncate" style={{ color: 'var(--ink-muted)' }}>{task.title}</span>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        <div className="space-y-5">

          {/* Task info card */}
          <div className="card p-8">
            <div className="flex items-start justify-between gap-4 mb-4">
              <h1 className="text-2xl font-display" style={{ color: 'var(--ink)' }}>{task.title}</h1>
              <span className="badge shrink-0" style={{ color: status.color, background: status.bg }}>
                <span className="w-2 h-2 rounded-full inline-block mr-1.5" style={{ background: status.color }} />
                {status.label}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-6">
              <span className="badge" style={{ color: priority.color, background: priority.bg }}>{priority.label}</span>
              {task.intern_role && <RoleBadge role={task.intern_role} />}
              {dueDate && (
                <span className="badge"
                  style={{ color: isOverdue ? 'var(--red)' : 'var(--ink-muted)', background: isOverdue ? 'var(--red-soft)' : 'var(--surface-2)' }}>
                  {isOverdue ? '⚠ Overdue · ' : '📅 '}Due: {dueDate}
                </span>
              )}
            </div>

            {task.description && (
              <>
                <h3 className="text-xs font-semibold uppercase tracking-wider mb-2"
                  style={{ color: 'var(--ink-muted)' }}>Description</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>{task.description}</p>
              </>
            )}
          </div>

          {/* Resources */}
          {resources.length > 0 && (
            <div className="card p-6">
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-3"
                style={{ color: 'var(--ink-muted)' }}>Resources</h3>
              <div className="flex flex-col gap-2">
                {resources.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--accent)' }}>
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    {url}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* AI Review Result */}
          {hasScore && (
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold font-display" style={{ color: 'var(--ink)' }}>
                  AI Review Result
                </h3>
                {!passed && !hasConflict && (
                  <span className="text-xs px-2 py-1 rounded-full font-semibold"
                    style={{ background: '#fee2e2', color: '#991b1b' }}>
                    Score below 70 — resubmit required
                  </span>
                )}
                {hasConflict && (
                  <span className="text-xs px-2 py-1 rounded-full font-semibold"
                    style={{ background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa' }}>
                    🔀 Resolve conflicts to complete
                  </span>
                )}
              </div>

              {latestReview && (latestReview.breakdown || latestReview.blocking_issues) ? (
                <ReviewPanel review={latestReview} score={task.score} internRole={effectiveRole} />
              ) : (
                <div className="rounded-2xl p-5 flex items-center gap-5"
                  style={{ background: passed ? '#f0fdf4' : '#fff5f5', border: `1.5px solid ${passed ? '#00c896' : '#ef4444'}40` }}>
                  <ScoreRing score={task.score} />
                  <div>
                    <p className="text-lg font-black" style={{ color: passed ? '#00c896' : '#ef4444' }}>
                      {passed ? '✅ Passed' : '🔁 Needs Work'}
                    </p>
                    {task.feedback && typeof task.feedback === 'string' && !task.feedback.startsWith('{') && (
                      <p className="text-sm mt-1 leading-relaxed" style={{ color: passed ? '#065f46' : '#991b1b' }}>
                        {task.feedback}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Phase 4: conflict banner — shown below review result when conflicts exist */}
              {hasConflict && (
                <div className="mt-4">
                  <MergeConflictBanner score={task.score} groupRepoUrl={groupRepoUrl} />
                </div>
              )}

              {!passed && !hasConflict && (
                <div className="mt-4 p-3 rounded-xl"
                  style={{ background: '#fff5f5', border: '1px solid #fecaca' }}>
                  <p className="text-sm font-medium" style={{ color: '#991b1b' }}>
                    Fix the issues above and resubmit below.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* PR submitted — awaiting review */}
          {task.github_pr_url && task.status === 'review' && !hasScore && (
            <div className="card p-6" style={{ border: '1.5px solid #dbeafe', background: 'var(--blue-soft)' }}>
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-2"
                style={{ color: '#1e40af' }}>PR Submitted</h3>
              <a href={task.github_pr_url} target="_blank" rel="noopener noreferrer"
                className="text-sm font-medium break-all" style={{ color: 'var(--blue)' }}>
                {task.github_pr_url}
              </a>
            </div>
          )}

          {/* ── Submit / Action card ── */}
          <div className="card p-6">
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-4"
              style={{ color: 'var(--ink-muted)' }}>Actions</h3>

            {/* Ask AI Mentor — always visible */}
            <Link href={`/mentor?task_id=${task.id}`}
              className="w-full flex items-center justify-center gap-2 py-3 mb-3"
              style={{
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                borderRadius: 12, textDecoration: 'none', color: 'white',
                fontWeight: 600, fontSize: 14,
                boxShadow: '0 2px 8px rgba(99,102,241,0.3)',
              }}>
              🤖 Ask AI Mentor
            </Link>

            {/* Start task */}
            {task.status === 'todo' && (
              <button onClick={() => handleStatusChange('in_progress')} disabled={actionLoading}
                className="btn-primary w-full justify-center py-3.5">
                {actionLoading ? 'Starting…' : '▶ Start Task'}
              </button>
            )}

            {/* Role-aware submission form */}
            {showSubmitForm && (
              <div className="space-y-4 mt-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                    {hasConflict ? 'Resubmit after resolving conflicts' : 'Submit your work'}
                  </p>
                  <RoleBadge role={effectiveRole} />
                </div>

                {/* Phase 5: How to Submit Guide — shown when not in conflict state */}
                {!hasConflict && task.status === 'in_progress' && (
                  <HowToSubmitGuide groupRepoUrl={groupRepoUrl} role={effectiveRole} />
                )}

                {(effectiveRole === 'frontend') && (
                  <FrontendForm
                    prUrl={prUrl} setPrUrl={setPrUrl}
                    screenshot={screenshot} setScreenshot={setScreenshot}
                    error={formError}
                  />
                )}
                {(effectiveRole === 'backend' || effectiveRole === 'default') && (
                  <BackendForm prUrl={prUrl} setPrUrl={setPrUrl} error={formError} />
                )}
                {effectiveRole === 'ui_ux' && (
                  <DesignForm fields={designFields} setFields={setDesignFields} error={formError} />
                )}
                {effectiveRole === 'tester' && (
                  <TesterForm
                    qaType={qaType} setQaType={setQaType}
                    fields={qaFields} setFields={setQaFields}
                    error={formError}
                  />
                )}

                {/* Phase 4: conflict resubmit hint */}
                {hasConflict && (
                  <div className="rounded-xl px-3 py-2 text-xs"
                    style={{ background: '#fff7ed', border: '1px solid #fed7aa', color: '#92400e' }}>
                    ℹ️ Your PR already passed AI review. Resubmitting will <strong>only re-check merge status</strong> — no AI re-review.
                  </div>
                )}

                {fetchMsg && (
                  <p className="text-xs font-medium px-3 py-2 rounded-xl flex items-center gap-2"
                    style={{ background: '#e0fff7', color: '#065f46', border: '1px solid #a7f3d0' }}>
                    <span className="animate-spin inline-block w-3 h-3 rounded-full border-2"
                      style={{ borderColor: '#065f46', borderTopColor: 'transparent' }} />
                    {fetchMsg}
                  </p>
                )}

                <button
                  onClick={handleSubmitForReview}
                  disabled={submitting || polling}
                  className="w-full py-3 rounded-xl text-sm font-bold transition-all"
                  style={{
                    background: submitting || polling
                      ? 'var(--border)'
                      : hasConflict
                        ? '#f97316'
                        : 'var(--accent)',
                    color: submitting || polling ? 'var(--ink-muted)' : '#fff',
                    cursor: submitting || polling ? 'not-allowed' : 'pointer',
                  }}>
                  {submitLabel()}
                </button>
              </div>
            )}

            {/* Waiting for review */}
            {task.status === 'review' && !hasScore && (
              <div className="flex items-center gap-3 p-4 rounded-xl mt-3"
                style={{ background: 'var(--amber-soft)', border: '1.5px solid #fde68a' }}>
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--amber)' }} />
                <span className="text-sm font-medium" style={{ color: '#92400e' }}>
                  Waiting for AI review…
                </span>
              </div>
            )}

            {/* Done */}
            {task.status === 'done' && (
              <div className="text-center py-4">
                <div className="text-3xl mb-2">🎉</div>
                <p className="text-sm font-semibold font-display" style={{ color: 'var(--green)' }}>Task complete!</p>
                {mergeStatus === 'merged' && (
                  <p className="text-xs mt-1" style={{ color: 'var(--ink-muted)' }}>
                    Your PR was squash-merged into the team repo.
                  </p>
                )}
                <Link href="/dashboard"
                  className="mt-3 inline-flex items-center gap-2 text-sm font-medium"
                  style={{ color: 'var(--accent)' }}>
                  ← Back to Dashboard
                </Link>
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  )
}
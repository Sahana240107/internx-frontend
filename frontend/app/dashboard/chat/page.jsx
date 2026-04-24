'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useAuthStore } from '@/lib/store/authStore'
import { createClient } from '@/lib/supabase/client'
import api from '@/lib/api'
import Image from 'next/image'

// ── constants ────────────────────────────────────────────────────────────────
const TOOLS  = { PEN: 'pen', ERASER: 'eraser', TEXT: 'text' }
const COLORS = ['#1a1a2e','#5b4fff','#3b82f6','#00c896','#f59e0b','#ec4899','#ef4444','#ffffff']
const SIZES  = [2, 4, 8, 16]

// Unified emoji packs (all in one picker)
const EMOJI_PACKS = {
  'Emoji':     ['😂','❤️','👍','😭','🙏','😍','🔥','🥺','😊','✨'],
  'Reactions': ['🎉','🚀','💯','👏','🤝','💪','🧠','⭐','🏆','🎯'],
  'Work':      ['📝','📊','💻','📅','✅','🔍','💡','📌','🗂️','⚙️'],
}

const FILE_ACCEPT = 'image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt'

// ── helpers ──────────────────────────────────────────────────────────────────
function formatTime(ts) {
  return new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
}
function formatDate(ts) {
  const d = new Date(ts), today = new Date(), yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString())     return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}
function groupByDate(messages) {
  const groups = []; let lastDate = null
  for (const msg of messages) {
    const d = formatDate(msg.created_at)
    if (d !== lastDate) { groups.push({ type: 'date', label: d }); lastDate = d }
    groups.push({ type: 'msg', data: msg })
  }
  return groups
}
function getInitials(name) {
  return (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}
function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}
function fileIcon(name = '') {
  const ext = (name.split('.').pop() || '').toLowerCase()
  if (['jpg','jpeg','png','gif','webp','svg'].includes(ext)) return '🖼️'
  if (ext === 'pdf')                                          return '📄'
  if (['doc','docx'].includes(ext))                          return '📝'
  if (['xls','xlsx'].includes(ext))                          return '📊'
  if (['ppt','pptx'].includes(ext))                          return '📋'
  return '📎'
}
function fileToBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload  = () => res(r.result)
    r.onerror = rej
    r.readAsDataURL(file)
  })
}

// ── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ member, size = 36 }) {
  if (member?.avatar_url) {
    return <Image src={member.avatar_url} alt={member.name || ''} width={size} height={size}
      className="rounded-full object-cover flex-shrink-0" style={{ width: size, height: size }} />
  }
  const clrs = ['#5b4fff','#3b82f6','#00c896','#f59e0b','#ec4899','#8b5cf6']
  const bg   = clrs[(member?.name?.charCodeAt(0) || 0) % clrs.length]
  return (
    <div className="rounded-full flex items-center justify-center font-bold text-white flex-shrink-0"
      style={{ width: size, height: size, background: bg, fontSize: size * 0.35 }}>
      {getInitials(member?.name)}
    </div>
  )
}

// ── EmojiPicker (unified: Emoji + Reactions + Work) ──────────────────────────
function EmojiPicker({ onPick, onClose }) {
  const [tab, setTab] = useState('Emoji')
  return (
    <div className="absolute bottom-12 left-0 z-40 rounded-2xl shadow-2xl border overflow-hidden"
      style={{ background: 'white', borderColor: 'var(--border)', width: 296 }}>
      <div className="px-3 py-2 border-b flex items-center justify-between"
        style={{ borderColor: 'var(--border)' }}>
        <span className="text-xs font-bold" style={{ color: 'var(--ink)' }}>Emoji</span>
        <button onClick={onClose} className="text-xs" style={{ color: 'var(--ink-muted)' }}>✕</button>
      </div>
      <div className="flex border-b" style={{ borderColor: 'var(--border)' }}>
        {Object.keys(EMOJI_PACKS).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="flex-1 py-1.5 text-[11px] font-semibold transition-colors"
            style={{
              background: tab === t ? '#5b4fff' : 'white',
              color: tab === t ? 'white' : 'var(--ink-muted)',
            }}>{t}</button>
        ))}
      </div>
      <div className="p-3 grid grid-cols-5 gap-2">
        {EMOJI_PACKS[tab].map(e => (
          <button key={e} onClick={() => { onPick(e); onClose() }}
            className="text-2xl rounded-xl hover:scale-125 transition-transform flex items-center justify-center"
            style={{ height: 40 }}>
            {e}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── FilePreview (attachment chips above input) ────────────────────────────────
function FilePreview({ files, onRemove }) {
  if (!files.length) return null
  return (
    <div className="flex gap-2 flex-wrap px-3 pt-2 pb-1">
      {files.map((f, i) => (
        <div key={i} className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs relative"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', maxWidth: 180 }}>
          <span className="text-base flex-shrink-0">{fileIcon(f.name)}</span>
          <div className="min-w-0">
            <p className="font-semibold truncate" style={{ color: 'var(--ink)', maxWidth: 100 }}>{f.name}</p>
            <p style={{ color: 'var(--ink-muted)' }}>{formatBytes(f.size)}</p>
          </div>
          <button onClick={() => onRemove(i)}
            className="ml-1 w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: '#ef4444', color: 'white', fontSize: 9, fontWeight: 700 }}>✕</button>
        </div>
      ))}
    </div>
  )
}

// ── CollaborativeWhiteboard ───────────────────────────────────────────────────
// All strokes are broadcast via Supabase Realtime broadcast (no DB write per stroke).
// Everyone on the same project sees every stroke in real-time.
function CollaborativeWhiteboard({ projectId, userId, myProfile, supabase, onClose }) {
  const canvasRef      = useRef(null)
  const drawing        = useRef(false)
  const lastPos        = useRef(null)
  const channelRef     = useRef(null)
  const cursorTimer    = useRef(null)

  const [tool,     setTool]     = useState(TOOLS.PEN)
  const [color,    setColor]    = useState('#1a1a2e')
  const [size,     setSize]     = useState(4)
  const [peers,    setPeers]    = useState([])
  const [textMode, setTextMode] = useState(null) // {x,y} in canvas coords

  const peerColorMap = useRef({})
  const PEER_COLORS  = ['#ef4444','#f59e0b','#00c896','#3b82f6','#ec4899','#8b5cf6']
  const peerColor = (uid) => {
    if (!peerColorMap.current[uid]) {
      const idx = Object.keys(peerColorMap.current).length % PEER_COLORS.length
      peerColorMap.current[uid] = PEER_COLORS[idx]
    }
    return peerColorMap.current[uid]
  }

  // ── Init canvas ────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx    = canvas.getContext('2d')
    canvas.width  = canvas.offsetWidth  || 900
    canvas.height = canvas.offsetHeight || 500
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }, [])

  // ── Realtime channel ───────────────────────────────────────────────────────
  useEffect(() => {
    const ch = supabase.channel(`whiteboard:${projectId}`, {
      config: { broadcast: { self: false } },
    })

    ch.on('broadcast', { event: 'stroke' }, ({ payload }) => {
      applyStroke(payload)
    })
    ch.on('broadcast', { event: 'clear' }, () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    })
    ch.on('broadcast', { event: 'cursor' }, ({ payload }) => {
      setPeers(prev => {
        const rest = prev.filter(p => p.id !== payload.id)
        return [...rest, payload]
      })
    })
    ch.on('broadcast', { event: 'text_stamp' }, ({ payload }) => {
      applyTextStamp(payload)
    })

    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState()
      setPeers(Object.values(state).flat().filter(p => p.id !== userId))
    })
    ch.on('presence', { event: 'leave' }, ({ leftPresences }) => {
      const leftIds = leftPresences.map(p => p.id)
      setPeers(prev => prev.filter(p => !leftIds.includes(p.id)))
    })

    ch.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await ch.track({ id: userId, name: myProfile?.name || 'You', color: peerColor(userId) })
      }
    })
    channelRef.current = ch
    return () => { ch.unsubscribe() }
  }, [projectId, userId])

  function applyStroke({ fromX, fromY, toX, toY, color: c, size: s, tool: t }) {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.beginPath()
    ctx.moveTo(fromX, fromY)
    ctx.lineTo(toX, toY)
    ctx.strokeStyle = t === TOOLS.ERASER ? '#ffffff' : c
    ctx.lineWidth   = t === TOOLS.ERASER ? s * 4 : s
    ctx.lineCap     = 'round'
    ctx.lineJoin    = 'round'
    ctx.stroke()
  }

  function applyTextStamp({ x, y, char, color: c, size: s }) {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.font      = `${Math.max(s * 5, 20)}px sans-serif`
    ctx.fillStyle = c
    ctx.fillText(char, x, y)
  }

  // ── Pointer utils ──────────────────────────────────────────────────────────
  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect()
    const src  = e.touches ? e.touches[0] : e
    return {
      x: (src.clientX - rect.left) * (canvas.width  / rect.width),
      y: (src.clientY - rect.top)  * (canvas.height / rect.height),
    }
  }

  // ── Draw handlers ──────────────────────────────────────────────────────────
  const startDraw = (e) => {
    e.preventDefault()
    if (tool === TOOLS.TEXT) return
    drawing.current = true
    lastPos.current = getPos(e, canvasRef.current)
  }

  const drawMove = (e) => {
    e.preventDefault()
    const canvas = canvasRef.current
    const pos    = getPos(e, canvas)

    // Throttle cursor broadcast
    clearTimeout(cursorTimer.current)
    cursorTimer.current = setTimeout(() => {
      channelRef.current?.send({
        type: 'broadcast', event: 'cursor',
        payload: { id: userId, name: myProfile?.name, x: pos.x, y: pos.y, color: peerColor(userId) },
      })
    }, 40)

    if (!drawing.current) return
    const ctx  = canvas.getContext('2d')
    const from = lastPos.current
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.strokeStyle = tool === TOOLS.ERASER ? '#ffffff' : color
    ctx.lineWidth   = tool === TOOLS.ERASER ? size * 4 : size
    ctx.lineCap     = 'round'
    ctx.lineJoin    = 'round'
    ctx.stroke()
    channelRef.current?.send({
      type: 'broadcast', event: 'stroke',
      payload: { fromX: from.x, fromY: from.y, toX: pos.x, toY: pos.y, color, size, tool },
    })
    lastPos.current = pos
  }

  const stopDraw = () => { drawing.current = false }

  const handleCanvasClick = (e) => {
    if (tool !== TOOLS.TEXT) return
    const pos = getPos(e, canvasRef.current)
    setTextMode(pos)
  }

  const stampText = (char, pos) => {
    applyTextStamp({ x: pos.x, y: pos.y, char, color, size })
    channelRef.current?.send({
      type: 'broadcast', event: 'text_stamp',
      payload: { x: pos.x, y: pos.y, char, color, size },
    })
    setTextMode(null)
  }

  const clearAll = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    channelRef.current?.send({ type: 'broadcast', event: 'clear', payload: {} })
  }

  const cursorStyle = tool === TOOLS.ERASER ? 'cell' : tool === TOOLS.TEXT ? 'text' : 'crosshair'

  const TOOL_BTNS = [
    { id: TOOLS.PEN,    icon: '🖊',  label: 'Pen'    },
    { id: TOOLS.ERASER, icon: '⬜', label: 'Eraser' },
    { id: TOOLS.TEXT,   icon: 'T',   label: 'Stamp'  },
  ]

  return (
    <div className="fixed inset-0 z-50 flex flex-col"
      style={{ background: 'rgba(10,10,30,0.80)', backdropFilter: 'blur(6px)' }}>
      <div className="flex-1 flex flex-col max-w-6xl w-full mx-auto my-4 rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: 'white' }}>

        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b flex-wrap"
          style={{ borderColor: 'var(--border)', background: '#fafafa' }}>

          <span className="font-bold text-sm flex-shrink-0" style={{ color: 'var(--ink)' }}>
            🖊 Live Whiteboard
          </span>

          {/* Live peer indicators */}
          {peers.length > 0 && (
            <div className="flex items-center gap-1 ml-1">
              <div className="flex -space-x-1">
                {peers.slice(0, 5).map(p => (
                  <div key={p.id} title={p.name}
                    className="w-5 h-5 rounded-full border border-white flex items-center justify-center text-[8px] font-bold text-white"
                    style={{ background: p.color || '#5b4fff' }}>
                    {getInitials(p.name)}
                  </div>
                ))}
              </div>
              <span className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                {peers.length} live
              </span>
            </div>
          )}

          <div className="w-px h-5 self-center mx-0.5" style={{ background: 'var(--border)' }} />

          {/* Tool selector */}
          <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
            {TOOL_BTNS.map(t => (
              <button key={t.id} onClick={() => setTool(t.id)} title={t.label}
                className="px-3 py-1.5 text-sm font-semibold transition-colors"
                style={{
                  background: tool === t.id ? '#5b4fff' : 'white',
                  color: tool === t.id ? 'white' : 'var(--ink-muted)',
                }}>
                {t.icon}
              </button>
            ))}
          </div>

          {/* Colors */}
          <div className="flex gap-1.5">
            {COLORS.map(c => (
              <button key={c}
                onClick={() => { setColor(c); if (tool === TOOLS.ERASER) setTool(TOOLS.PEN) }}
                className="rounded-full transition-transform hover:scale-110"
                style={{
                  width: 18, height: 18,
                  background: c,
                  border: color === c ? '2.5px solid #5b4fff' : '1.5px solid #d1d5db',
                  transform: color === c ? 'scale(1.25)' : undefined,
                }} />
            ))}
          </div>

          {/* Sizes */}
          <div className="flex gap-1.5 items-center">
            {SIZES.map(s => (
              <button key={s} onClick={() => setSize(s)}
                className="rounded-full transition-all"
                style={{
                  width: Math.max(s * 2.5, 10), height: Math.max(s * 2.5, 10),
                  background: size === s ? color : '#e2e2e8',
                  border: size === s ? '2px solid #5b4fff' : '1px solid transparent',
                }} />
            ))}
          </div>

          <div className="flex gap-2 ml-auto">
            <button onClick={clearAll}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold"
              style={{ background: '#fee2e2', color: '#ef4444', border: '1px solid #fca5a5' }}>
              🗑 Clear All
            </button>
            <button onClick={onClose}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold"
              style={{ background: 'var(--surface-2)', color: 'var(--ink-muted)', border: '1px solid var(--border)' }}>
              ✕ Close
            </button>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 relative overflow-hidden" style={{ cursor: cursorStyle }}>
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full"
            onMouseDown={startDraw} onMouseMove={drawMove} onMouseUp={stopDraw} onMouseLeave={stopDraw}
            onTouchStart={startDraw} onTouchMove={drawMove} onTouchEnd={stopDraw}
            onClick={handleCanvasClick}
          />

          {/* Remote cursors (overlay) */}
          {peers.map(p => p.x != null && (
            <div key={p.id + '-cursor'} className="absolute pointer-events-none"
              style={{
                left: `${(p.x / (canvasRef.current?.width || 900)) * 100}%`,
                top:  `${(p.y / (canvasRef.current?.height || 500)) * 100}%`,
                transform: 'translate(-4px,-4px)',
                zIndex: 10,
              }}>
              <div className="w-3 h-3 rounded-full border-2 border-white"
                style={{ background: p.color }} />
              <div className="text-[9px] font-bold px-1 rounded mt-0.5 whitespace-nowrap"
                style={{ background: p.color, color: 'white' }}>{p.name}</div>
            </div>
          ))}

          {/* Text stamp popover */}
          {textMode && (
            <div className="absolute z-20 p-3 rounded-2xl shadow-xl border"
              style={{
                left: Math.min(
                  (textMode.x / (canvasRef.current?.width || 900)) * 100 + '%',
                ),
                top: Math.min(
                  (textMode.y / (canvasRef.current?.height || 500)) * 100 + '%',
                ),
                background: 'white', borderColor: 'var(--border)', width: 256,
              }}>
              <p className="text-[11px] font-semibold mb-2" style={{ color: 'var(--ink-muted)' }}>
                Stamp emoji or type text at this spot
              </p>
              <div className="grid grid-cols-6 gap-1 mb-2">
                {QUICK_EMOJIS.concat(STICKERS['Reactions'].slice(0, 2)).map(e => (
                  <button key={e} onClick={() => stampText(e, textMode)}
                    className="text-xl rounded-lg hover:scale-125 transition-transform flex items-center justify-center"
                    style={{ height: 32 }}>{e}</button>
                ))}
              </div>
              <input autoFocus placeholder="Type text then Enter…"
                className="w-full text-sm rounded-xl px-3 py-1.5 outline-none"
                style={{ border: '1.5px solid var(--border)', color: 'var(--ink)' }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && e.target.value.trim()) stampText(e.target.value.trim(), textMode)
                  if (e.key === 'Escape') setTextMode(null)
                }} />
              <button onClick={() => setTextMode(null)}
                className="mt-1 text-[10px]" style={{ color: 'var(--ink-muted)' }}>
                Cancel (Esc)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── MessageBubble ─────────────────────────────────────────────────────────────
function MessageBubble({ item, isMe, showAvatar }) {
  const msg    = item.data
  const sender = msg.profiles || {}

  // Sticker — large emoji sent as its own message
  if (msg.message_type === 'emoji') {
    return (
      <div className={`flex gap-2 mb-1 ${isMe ? 'flex-row-reverse' : ''}`}>
        {!isMe && showAvatar ? <Avatar member={sender} size={28} /> : !isMe && <div style={{ width: 28 }} />}
        <div>
          {!isMe && showAvatar && (
            <p className="text-[10px] font-semibold mb-0.5 ml-1" style={{ color: 'var(--ink-muted)' }}>
              {sender.name}
            </p>
          )}
          <div className="text-5xl leading-none select-none" style={{ padding: '4px 0' }}>{msg.content}</div>
          <p className="text-[10px] mt-0.5" style={{ color: 'var(--ink-muted)', textAlign: isMe ? 'right' : 'left' }}>
            {formatTime(msg.created_at)}
          </p>
        </div>
      </div>
    )
  }

  // File / attachment
  if (msg.message_type === 'file') {
    let meta = {}
    try { meta = JSON.parse(msg.content) } catch { meta = { name: 'File', url: msg.content } }
    const isImage = (meta.mime || '').startsWith('image/')
    return (
      <div className={`flex gap-2 mb-1 ${isMe ? 'flex-row-reverse' : ''}`}>
        {!isMe && showAvatar ? <Avatar member={sender} size={28} /> : !isMe && <div style={{ width: 28 }} />}
        <div style={{ maxWidth: '70%' }}>
          {!isMe && showAvatar && (
            <p className="text-[10px] font-semibold mb-0.5 ml-1" style={{ color: 'var(--ink-muted)' }}>{sender.name}</p>
          )}
          {isImage ? (
            <div className="rounded-2xl overflow-hidden shadow-sm"
              style={{ border: '1.5px solid var(--border)', maxWidth: 240 }}>
              <img src={meta.url} alt={meta.name} className="block w-full"
                style={{ maxHeight: 220, objectFit: 'cover' }} />
              <div className="px-3 py-1.5 flex items-center gap-2" style={{ background: 'var(--surface-2)' }}>
                <span className="text-[10px] truncate flex-1" style={{ color: 'var(--ink-muted)' }}>{meta.name}</span>
                <span className="text-[10px]" style={{ color: 'var(--ink-muted)' }}>{formatTime(msg.created_at)}</span>
              </div>
            </div>
          ) : (
            <a href={meta.url} download={meta.name} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-2xl px-3 py-2.5 shadow-sm hover:opacity-80 transition-opacity"
              style={{
                background: isMe ? '#5b4fff' : 'white',
                border: isMe ? 'none' : '1.5px solid var(--border)',
                color: isMe ? 'white' : 'var(--ink)',
                textDecoration: 'none',
              }}>
              <span className="text-2xl flex-shrink-0">{fileIcon(meta.name)}</span>
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate" style={{ maxWidth: 140 }}>{meta.name}</p>
                <p className="text-[10px] opacity-70">{meta.size ? formatBytes(meta.size) : 'Download'}</p>
              </div>
              <span className="text-[10px] ml-auto opacity-60 flex-shrink-0">{formatTime(msg.created_at)}</span>
            </a>
          )}
        </div>
      </div>
    )
  }

  // Normal text
  return (
    <div className={`flex gap-2 mb-0.5 ${isMe ? 'flex-row-reverse' : ''}`}>
      {!isMe && showAvatar ? <Avatar member={sender} size={28} /> : !isMe && <div style={{ width: 28 }} />}
      <div style={{ maxWidth: '72%' }}>
        {!isMe && showAvatar && (
          <p className="text-[10px] font-semibold mb-0.5 ml-1" style={{ color: 'var(--ink-muted)' }}>{sender.name}</p>
        )}
        <div className={`px-3 py-2 rounded-2xl inline-block ${isMe ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}
          style={{
            background: isMe ? '#5b4fff' : 'white',
            color:      isMe ? 'white'   : 'var(--ink)',
            border:     isMe ? 'none'    : '1.5px solid var(--border)',
            boxShadow:  '0 1px 2px rgba(0,0,0,0.06)',
          }}>
          <p className="text-sm leading-snug break-words whitespace-pre-wrap">{msg.content}</p>
          <p className={`text-[10px] mt-0.5 text-right ${isMe ? 'opacity-70' : ''}`}
            style={{ color: isMe ? 'white' : 'var(--ink-muted)' }}>
            {formatTime(msg.created_at)}{isMe && <span className="ml-1">✓✓</span>}
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Main ChatPage ──────────────────────────────────────────────────────────────
export default function ChatPage() {
  const { user } = useAuthStore()
  const supabase  = createClient()

  const [loading,       setLoading]       = useState(true)
  const [project,       setProject]       = useState(null)
  const [teamMembers,   setTeamMembers]   = useState([])
  const [myRole,        setMyRole]        = useState(null)
  const [messages,      setMessages]      = useState([])
  const [input,         setInput]         = useState('')
  const [sending,       setSending]       = useState(false)
  const [showBoard,     setShowBoard]     = useState(false)
  const [meetUrl,       setMeetUrl]       = useState('https://meet.google.com/')
  const [showEmoji,     setShowEmoji]     = useState(false)
  const [attachedFiles, setAttachedFiles] = useState([]) // [{name,size,mime,dataUrl}]

  const messagesEndRef = useRef(null)
  const inputRef       = useRef(null)
  const fileInputRef   = useRef(null)
  const channelRef     = useRef(null)
  const myProfileRef   = useRef(null)

  // ── load initial data ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return
    const load = async () => {
      try {
        const meRes = await api.get('/api/auth/me')
        const me    = meRes.data

        // Guard: must have a real project_id (not null, not the placeholder UUID)
        const PLACEHOLDER_ID = 'aaaaaaaa-0000-0000-0000-000000000001'
        if (!me.project_id || me.project_id === PLACEHOLDER_ID) {
          setLoading(false)
          return
        }

        // Build myProfile from /api/auth/me data — avoids a direct Supabase
        // client call that can fail due to RLS policies (500 error).
        const myProfile = {
          id:          me.id   || user.id,
          name:        me.name || me.email || 'You',
          avatar_url:  me.avatar_url  || null,
          intern_role: me.intern_role || null,
        }
        myProfileRef.current = myProfile

        const [projectRes, msgsRes, meetRes] = await Promise.all([
          api.get(`/api/projects/${me.project_id}`),
          api.get(`/api/chat/messages/${me.project_id}`),
          api.get(`/api/chat/meet/${me.project_id}`).catch(() => ({ data: { meet_url: 'https://meet.google.com/' } })),
        ])
        setProject(projectRes.data)
        const rawMessages = msgsRes.data || []
        setMeetUrl(meetRes.data.meet_url || 'https://meet.google.com/')

        // ── Filtering logic: same project_id + same intern_role ──
        // /team returns all members of this project. We filter to those
        // who share the current user's intern_role (e.g. both "frontend").
        const teamRes = await api.get(`/api/projects/${me.project_id}/team`)
        const allTeam = teamRes.data?.team || []  // [{user_id, intern_role, name, avatar_url, ...}]

        // The current user's role comes from /me (most reliable source)
        const myRole_val = me.intern_role || null
        if (myRole_val) setMyRole(myRole_val)

        // Keep teammates who share the same intern_role.
        // If role is unknown, fall back to showing the full team so chat
        // is never silently empty.
        const teammates = myRole_val
          ? allTeam.filter(m => m.intern_role === myRole_val)
          : allTeam

        setTeamMembers(teammates)
        const teamMemberIds = new Set(teammates.map(m => m.user_id))

        // Filter initial messages to only those from teammates
        setMessages(rawMessages.filter(m => teamMemberIds.has(m.sender_id)))

        // Supabase Realtime: scoped to this project, filtered client-side by role
        const channelKey = `project_messages:${me.project_id}:${myRole_val || 'all'}`

        const channel = supabase
          .channel(channelKey)
          .on('postgres_changes', {
            event: 'INSERT', schema: 'public', table: 'project_messages',
            filter: `project_id=eq.${me.project_id}`,
          }, async (payload) => {
            // Only show messages from teammates with the same intern_role.
            // If teamMemberIds is empty fall back to allowing all (safety net).
            const senderInTeam = teamMemberIds.size === 0 || teamMemberIds.has(payload.new.sender_id)
            if (!senderInTeam) return
            const newMsg = { ...payload.new }
            if (newMsg.sender_id === user.id) {
              newMsg.profiles = myProfileRef.current
            } else {
              // Use already-loaded teammates list to avoid a direct Supabase
              // client query which fails with RLS 500 errors.
              const teammate = teammates.find(m => m.user_id === newMsg.sender_id)
              if (teammate) {
                newMsg.profiles = {
                  id:          teammate.user_id,
                  name:        teammate.name,
                  avatar_url:  teammate.avatar_url || null,
                  intern_role: teammate.intern_role || null,
                }
              } else {
                // Fallback: fetch via backend (uses service key, bypasses RLS)
                try {
                  const profileRes = await api.get(`/api/auth/profile/${newMsg.sender_id}`)
                  newMsg.profiles = profileRes.data
                } catch {
                  newMsg.profiles = { id: newMsg.sender_id, name: 'Teammate', avatar_url: null, intern_role: null }
                }
              }
            }
            setMessages(prev => {
              // Replace matching optimistic placeholder
              const oidx = prev.findIndex(
                m => m._optimistic && m.content === newMsg.content && m.sender_id === newMsg.sender_id
              )
              if (oidx !== -1) {
                const next = [...prev]; next[oidx] = newMsg; return next
              }
              if (prev.find(m => m.id === newMsg.id)) return prev
              return [...prev, newMsg]
            })
          })
          .subscribe()
        channelRef.current = channel
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
    return () => { channelRef.current?.unsubscribe() }
  }, [user])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── optimistic helper ─────────────────────────────────────────────────────
  const addOptimistic = (partial) => {
    const msg = {
      id:          `optimistic-${Date.now()}-${Math.random()}`,
      _optimistic: true,
      project_id:  project.id,
      sender_id:   user.id,
      created_at:  new Date().toISOString(),
      profiles:    myProfileRef.current,
      ...partial,
    }
    setMessages(prev => [...prev, msg])
    return msg
  }
  const rollback = (id, restoreInput) => {
    setMessages(prev => prev.filter(m => m.id !== id))
    if (restoreInput !== undefined) setInput(restoreInput)
  }

  // ── send text ─────────────────────────────────────────────────────────────
  const sendMessage = async (e) => {
    e?.preventDefault()
    if (attachedFiles.length) { await sendFiles(); return }
    const text = input.trim()
    if (!text || !project || sending) return
    setSending(true)
    setInput('')
    const opt = addOptimistic({ content: text, message_type: 'text' })
    try {
      await api.post('/api/chat/messages', { project_id: project.id, content: text, message_type: 'text' })
    } catch (err) {
      console.error(err); rollback(opt.id, text)
    }
    setSending(false)
    inputRef.current?.focus()
  }

  // ── send sticker ──────────────────────────────────────────────────────────
  const sendSticker = async (sticker) => {
    if (!project) return
    const opt = addOptimistic({ content: sticker, message_type: 'emoji' })
    try {
      await api.post('/api/chat/messages', { project_id: project.id, content: sticker, message_type: 'emoji' })
    } catch (err) { rollback(opt.id) }
  }

  // ── emoji → append to input ───────────────────────────────────────────────
  const appendEmoji = (emoji) => {
    setInput(prev => prev + emoji)
    inputRef.current?.focus()
  }

  // ── file attach ───────────────────────────────────────────────────────────
  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    const processed = await Promise.all(files.map(async f => ({
      name: f.name, size: f.size, mime: f.type, dataUrl: await fileToBase64(f),
    })))
    setAttachedFiles(prev => [...prev, ...processed])
    e.target.value = ''
  }

  const removeAttached = (idx) => setAttachedFiles(prev => prev.filter((_, i) => i !== idx))

  // ── send files ────────────────────────────────────────────────────────────
  const sendFiles = async () => {
    if (!attachedFiles.length || !project) return
    setSending(true)
    const toSend = [...attachedFiles]
    setAttachedFiles([])

    for (const f of toSend) {
      // Convert base64 dataUrl → Blob → File for multipart upload
      let savedMsg = null
      const opt = addOptimistic({
        content:      JSON.stringify({ name: f.name, size: f.size, mime: f.mime, url: f.dataUrl }),
        message_type: 'file',   // real type — DB now allows 'file'
      })
      try {
        const fetchRes = await fetch(f.dataUrl)
        const blob     = await fetchRes.blob()
        const fileObj  = new File([blob], f.name, { type: f.mime })
        const formData = new FormData()
        formData.append('file',       fileObj)
        formData.append('project_id', project.id)

        // Use api axios so the Authorization Bearer token is sent.
        // Setting Content-Type to undefined lets the browser set the
        // correct multipart/form-data boundary automatically.
        const res = await api.post('/api/chat/upload', formData, {
          headers: { 'Content-Type': undefined },
        })
        savedMsg = res.data
      } catch (err) {
        console.error('File upload failed:', err)
        rollback(opt.id)
      }
      // Replace optimistic with real saved message if we got one
      if (savedMsg) {
        setMessages(prev => {
          const idx = prev.findIndex(m => m.id === opt.id)
          if (idx === -1) return prev
          const next = [...prev]; next[idx] = { ...savedMsg, profiles: myProfileRef.current }
          return next
        })
      }
    }

    // Send any typed caption as a separate text message
    if (input.trim()) {
      const text = input.trim(); setInput('')
      const opt  = addOptimistic({ content: text, message_type: 'text' })
      try {
        await api.post('/api/chat/messages', { project_id: project.id, content: text, message_type: 'text' })
      } catch (err) { rollback(opt.id, text) }
    }
    setSending(false)
    inputRef.current?.focus()
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const closeOverlays = () => { setShowEmoji(false) }

  const canSend = input.trim() || attachedFiles.length

  // ── render ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center h-full py-20">
      <div className="flex flex-col items-center gap-3">
        <div className="w-7 h-7 rounded-full border-2 animate-spin"
          style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
        <span className="text-sm" style={{ color: 'var(--ink-muted)' }}>Loading chat…</span>
      </div>
    </div>
  )

  if (!project) return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <p className="text-2xl">💬</p>
      <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>No project yet</p>
      <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>Join a project to access the team chat.</p>
    </div>
  )

  const grouped = groupByDate(messages)

  return (
    <>
      {showBoard && (
        <CollaborativeWhiteboard
          projectId={project.id}
          userId={user.id}
          myProfile={myProfileRef.current}
          supabase={supabase}
          onClose={() => setShowBoard(false)}
        />
      )}

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept={FILE_ACCEPT} multiple className="hidden"
        onChange={handleFileChange} />

      <div className="flex flex-col animate-fade-up" onClick={closeOverlays}
        style={{ height: 'calc(100vh - 120px)', minHeight: 480 }}>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-4 py-3 rounded-t-2xl border-b flex-shrink-0"
          style={{ background: 'white', borderColor: 'var(--border)' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
            style={{
              background: `${project.company_color || '#5b4fff'}15`,
              border: `2px solid ${project.company_color || '#5b4fff'}30`,
            }}>
            {project.company_emoji || '💬'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm truncate" style={{ color: 'var(--ink)' }}>
              {project.project_title || project.company_name}
            </p>
            <p className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>
              {teamMembers.length} member{teamMembers.length !== 1 ? 's' : ''} · {myRole ? `${myRole.charAt(0).toUpperCase() + myRole.slice(1)} team` : 'Team chat'}
            </p>
          </div>
          <div className="hidden sm:flex -space-x-2 mr-2">
            {teamMembers.slice(0, 5).map(m => (
              <div key={m.user_id} title={m.name} className="ring-2 rounded-full" style={{ ringColor: 'white' }}>
                <Avatar member={m} size={28} />
              </div>
            ))}
            {teamMembers.length > 5 && (
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ring-2"
                style={{ background: 'var(--border)', color: 'var(--ink-muted)', ringColor: 'white' }}>
                +{teamMembers.length - 5}
              </div>
            )}
          </div>
          <a href={meetUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold flex-shrink-0 hover:scale-105 transition-transform"
            style={{ background: '#1a73e8', color: 'white' }}>
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15 8v8H5V8h10m1-2H4a1 1 0 00-1 1v10a1 1 0 001 1h12a1 1 0 001-1v-3.5l4 4v-11l-4 4V7a1 1 0 00-1-1z"/>
            </svg>
            Join Meet
          </a>
        </div>

        {/* ── Messages ────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1" style={{ background: '#f0f2f5' }}>
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-3 opacity-60">
              <p className="text-4xl">👋</p>
              <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>No messages yet</p>
              <p className="text-xs text-center" style={{ color: 'var(--ink-muted)' }}>
                Be the first to say something to your team!
              </p>
            </div>
          )}
          {grouped.map((item, idx) => {
            if (item.type === 'date') return (
              <div key={`date-${idx}`} className="flex items-center justify-center my-3">
                <span className="px-3 py-1 rounded-full text-[11px] font-semibold"
                  style={{ background: 'rgba(0,0,0,0.08)', color: 'var(--ink-muted)' }}>
                  {item.label}
                </span>
              </div>
            )
            const msg      = item.data
            const isMe     = msg.sender_id === user?.id
            const prev     = grouped[idx - 1]
            const prevMsg  = prev?.type === 'msg' ? prev.data : null
            const showAvatar = !isMe && (!prevMsg || prevMsg.sender_id !== msg.sender_id)
            return (
              <MessageBubble key={msg.id} item={item} isMe={isMe}
                showAvatar={showAvatar} prevIsMe={prevMsg?.sender_id === user?.id} />
            )
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* ── Input bar ───────────────────────────────────────────────────── */}
        <div className="flex-shrink-0 border-t" style={{ background: 'white', borderColor: 'var(--border)' }}>
          {/* Attachment chips */}
          <FilePreview files={attachedFiles} onRemove={removeAttached} />

          <div className="flex items-end gap-1.5 px-3 py-2.5" onClick={e => e.stopPropagation()}>

            {/* Attach file */}
            <button onClick={() => fileInputRef.current?.click()} title="Attach file (image / PDF / Word / Excel)"
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 hover:scale-105 transition-transform"
              style={{ background: 'var(--surface-2)', border: '1.5px solid var(--border)', color: 'var(--ink-muted)' }}>
              <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66L9.41 17.41a2 2 0 01-2.83-2.83l8.49-8.48"
                  strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            {/* Emoji (unified picker: append to text or send as emoji message) */}
            <div className="relative flex-shrink-0">
              <button onClick={e => { e.stopPropagation(); setShowEmoji(p => !p) }}
                title="Emoji"
                className="w-9 h-9 rounded-xl flex items-center justify-center hover:scale-105 transition-transform text-lg"
                style={{
                  background: showEmoji ? '#ede9fe' : 'var(--surface-2)',
                  border: `1.5px solid ${showEmoji ? '#5b4fff' : 'var(--border)'}`,
                }}>
                😊
              </button>
              {showEmoji && (
                <EmojiPicker
                  onPick={(e) => { appendEmoji(e) }}
                  onClose={() => setShowEmoji(false)}
                />
              )}
            </div>

            {/* Live whiteboard */}
            <button onClick={() => setShowBoard(true)} title="Open live whiteboard"
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 hover:scale-105 transition-transform"
              style={{ background: 'var(--surface-2)', border: '1.5px solid var(--border)', color: 'var(--ink-muted)' }}>
              <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <rect x="3" y="3" width="18" height="14" rx="2"/>
                <path d="M8 21h8M12 17v4" strokeLinecap="round"/>
                <path d="M7 10l2 2 5-5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            {/* Text input */}
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={attachedFiles.length ? 'Add a caption… (Enter to send)' : 'Type a message…'}
                rows={1}
                className="w-full resize-none rounded-2xl px-4 py-2.5 text-sm outline-none"
                style={{
                  background: 'var(--surface-2)',
                  border: '1.5px solid var(--border)',
                  color: 'var(--ink)',
                  maxHeight: 120,
                  lineHeight: '1.5',
                }}
              />
            </div>

            {/* Send */}
            <button onClick={sendMessage} disabled={!canSend || sending}
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all hover:scale-105"
              style={{
                background: canSend ? '#5b4fff' : 'var(--surface-2)',
                border: canSend ? 'none' : '1.5px solid var(--border)',
                color: canSend ? 'white' : 'var(--ink-muted)',
                opacity: sending ? 0.6 : 1,
              }}>
              <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
              </svg>
            </button>
          </div>
        </div>

      </div>
    </>
  )
}

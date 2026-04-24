'use client'

import { useEffect, useState, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/api'

function MentorChat() {
  const searchParams = useSearchParams()
  const taskId = searchParams.get('task_id') || null

  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isConnected, setIsConnected] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [task, setTask] = useState(null)
  const [project, setProject] = useState(null)
  const [showSuggestions, setShowSuggestions] = useState(true)
  const wsRef = useRef(null)
  const bottomRef = useRef(null)

  const userId = typeof window !== 'undefined'
    ? localStorage.getItem('user_id')
    : null

  // Fetch task or project details
  useEffect(() => {
    if (taskId) {
      api.get(`/api/tasks/${taskId}`)
        .then(res => {
          setTask(res.data)
          setMessages([{
            role: 'assistant',
            content: `👋 Hi! I'm your AI Mentor for **${res.data.title}**.\n\nI know exactly what this task requires. Ask me anything — how to approach it, what to implement, or how to fix issues in your code.`
          }])
        })
        .catch(() => {
          setMessages([{
            role: 'assistant',
            content: '👋 Hi! I\'m your AI Mentor. Ask me anything about your task.'
          }])
        })
    } else {
      api.post('/api/projects/assign', {})
        .then(res => {
          const projectData = res.data
          const companyName = projectData.company_name || ''
          const projectTitle = projectData.project_title || ''
          const projectName = companyName && projectTitle
            ? `${companyName} — ${projectTitle}`
            : projectTitle || companyName || 'your project'
          const projectDesc = projectData.project_description || ''
          const techStack = Array.isArray(projectData.tech_stack)
            ? projectData.tech_stack.join(', ')
            : projectData.tech_stack || ''
          const internRole = projectData.intern_role || ''

          setProject({ ...projectData, _name: projectName, _desc: projectDesc, _tech: techStack, _role: internRole })
          setMessages([{
            role: 'assistant',
            content: `👋 Hi! I'm your AI Mentor for **${projectName}**.\n\n${projectDesc ? `About: ${projectDesc}\n\n` : ''}${techStack ? `Tech stack: ${techStack}\n\n` : ''}${internRole ? `Your role: ${internRole} intern\n\n` : ''}I can help you understand the requirements, plan your work, or answer any technical questions. What would you like to know?`
          }])
        })
        .catch(() => {
          setProject({ _name: 'Your Project' })
          setMessages([{
            role: 'assistant',
            content: `👋 Hi! I'm your AI Mentor.\n\nI can help you with your project, tasks, and any technical questions. What would you like to know?`
          }])
        })
    }
  }, [taskId])

  // WebSocket connection — only for task mode
  useEffect(() => {
    if (!taskId) {
      setIsConnected(true)
      return
    }
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
    const wsUrl = backendUrl.replace('http', 'ws') + `/api/mentor/chat/${taskId}`
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => setIsConnected(true)
    ws.onclose = () => setIsConnected(false)

    ws.onmessage = (event) => {
      const token = event.data
      if (token === '[DONE]') {
        setIsTyping(false)
        setMessages(prev => {
          const last = prev[prev.length - 1]
          if (last?.streaming) return [...prev.slice(0, -1), { ...last, streaming: false }]
          return prev
        })
        setShowSuggestions(true)
        return
      }
      if (token.startsWith('[ERROR]')) {
        setIsTyping(false)
        setMessages(prev => [...prev, { role: 'error', content: token.replace('[ERROR] ', '') }])
        setShowSuggestions(true)
        return
      }
      setIsTyping(true)
      setShowSuggestions(false)
      setMessages(prev => {
        const last = prev[prev.length - 1]
        if (last?.role === 'assistant' && last?.streaming)
          return [...prev.slice(0, -1), { ...last, content: last.content + token }]
        return [...prev, { role: 'assistant', content: token, streaming: true }]
      })
    }

    return () => ws.close()
  }, [taskId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (overrideText) => {
    const userMessage = overrideText || input
    if (!userMessage.trim()) return
    if (!userId) { alert('Please login first'); return }

    setInput('')
    setShowSuggestions(false)
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])

    if (taskId && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ message: userMessage, user_id: userId }))
    } else {
      setIsTyping(true)
      try {
        const projectContext = project
          ? `Company: ${project.company_name || 'Unknown'}
Project: ${project.project_title || 'Unknown'}
Description: ${project.project_description || 'No description'}
Tech Stack: ${Array.isArray(project.tech_stack) ? project.tech_stack.join(', ') : project.tech_stack || 'Not specified'}
Intern Role: ${project.intern_role || 'Not specified'}
Folder Structure: ${JSON.stringify(project.folder_structure || {})}`
          : 'General internship project'

        const res = await api.post('/api/mentor/project-chat', {
          message: userMessage,
          user_id: userId,
          project_context: projectContext,
        })
        setMessages(prev => [...prev, { role: 'assistant', content: res.data.reply, streaming: false }])
        setShowSuggestions(true)
      } catch {
        setMessages(prev => [...prev, { role: 'error', content: 'Could not get a response. Please try again.' }])
        setShowSuggestions(true)
      } finally {
        setIsTyping(false)
      }
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const taskSuggestions = [
    'How should I approach this task?',
    'What technologies should I use?',
    'Show me the project structure',
    'What are common mistakes to avoid?',
  ]

  const projectSuggestions = [
    'Give me an overview of this project',
    'What is the tech stack?',
    'How should I structure my work?',
    'What are the main deliverables?',
  ]

  const displayName = task ? task.title : (project?._name || '')
  const displayDesc = task?.description || project?._desc || ''

  const renderMarkdown = (text) => {
    const elements = []
    let key = 0
    // Split out code blocks first
    const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g
    let lastIndex = 0
    let match
    while ((match = codeBlockRegex.exec(text)) !== null) {
      // Render text before code block
      if (match.index > lastIndex) {
        elements.push(...renderLines(text.slice(lastIndex, match.index), key))
        key += 100
      }
      // Render code block
      elements.push(
        <pre key={key++} style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 8, padding: '10px 14px', overflowX: 'auto',
          fontSize: 12, lineHeight: 1.6, margin: '8px 0', fontFamily: 'monospace'
        }}>
          <code>{match[2].trim()}</code>
        </pre>
      )
      lastIndex = match.index + match[0].length
    }
    // Remaining text after last code block
    if (lastIndex < text.length) {
      elements.push(...renderLines(text.slice(lastIndex), key))
    }
    return elements
  }

  const renderLines = (text, baseKey = 0) => {
    const lines = text.split('\n')
    return lines.map((line, i) => {
      const k = baseKey + i
      // Numbered list with bold: "1. **Title**: rest"
      const numBold = line.match(/^(\d+)\.\s\*\*(.+?)\*\*:?\s*(.*)/)
      if (numBold) return <div key={k} style={{ marginBottom: 4 }}><strong>{numBold[1]}. {numBold[2]}</strong>{numBold[3] ? `: ${numBold[3]}` : ''}</div>
      // Numbered list plain: "1. text"
      const numPlain = line.match(/^(\d+)\.\s(.+)/)
      if (numPlain) return <div key={k} style={{ marginBottom: 4 }}>{numPlain[1]}. {inlineBold(numPlain[2])}</div>
      // Bullet with bold: "* **Title**: rest"
      const bulletBold = line.match(/^\*\s\*\*(.+?)\*\*:?\s*(.*)/)
      if (bulletBold) return <div key={k} style={{ marginBottom: 4, paddingLeft: 12 }}>• <strong>{bulletBold[1]}</strong>{bulletBold[2] ? `: ${bulletBold[2]}` : ''}</div>
      // Sub-bullet: "    * text"
      const subBullet = line.match(/^\s{2,}\*\s(.+)/)
      if (subBullet) return <div key={k} style={{ marginBottom: 2, paddingLeft: 24 }}>◦ {inlineBold(subBullet[1])}</div>
      // Plain bullet: "* text"
      const bullet = line.match(/^\*\s(.+)/)
      if (bullet) return <div key={k} style={{ marginBottom: 4, paddingLeft: 12 }}>• {inlineBold(bullet[1])}</div>
      // Empty line = spacer
      if (line.trim() === '') return <div key={k} style={{ height: 6 }} />
      // Normal line with possible inline bold
      return <div key={k} style={{ marginBottom: 2 }}>{inlineBold(line)}</div>
    })
  }

  const inlineBold = (text) => {
    const parts = text.split(/\*\*(.+?)\*\*/)
    if (parts.length === 1) return text
    return parts.map((p, i) => i % 2 === 1 ? <strong key={i}>{p}</strong> : p)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--surface)', color: 'var(--ink)', fontFamily: 'sans-serif' }}>

      {/* Header */}
      <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface)' }}>
        <Link
          href={taskId ? `/internship/tasks/${taskId}` : '/dashboard'}
          style={{ color: 'var(--ink-muted)', textDecoration: 'none', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
          ← {taskId ? 'Back to Task' : 'Back to Dashboard'}
        </Link>
        <div style={{ width: 1, height: 16, background: 'var(--border)' }} />
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: isConnected ? '#22c55e' : '#ef4444', flexShrink: 0 }} />
        <span style={{ fontWeight: 600, fontSize: 16, color: 'var(--ink)' }}>🤖 AI Mentor</span>
        {isTyping && <span style={{ fontSize: 12, color: 'var(--ink-muted)', marginLeft: 'auto' }}>Thinking...</span>}
      </div>

      {/* Context banner */}
      {(task || project) && displayName && (
        <div style={{ padding: '12px 20px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <div style={{ flexShrink: 0, marginTop: 2 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {task ? 'Current Task' : 'Your Project'}
              </span>
              <p style={{ margin: '2px 0 0', fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
                {displayName}
              </p>
            </div>
            {task && task.priority && (
              <div style={{ marginLeft: 'auto', flexShrink: 0 }}>
                <span style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600,
                  background: task.priority === 'high' ? 'var(--red-soft)' : 'var(--blue-soft)',
                  color: task.priority === 'high' ? 'var(--red)' : 'var(--blue)',
                }}>
                  {task.priority.toUpperCase()}
                </span>
              </div>
            )}
          </div>
          {displayDesc && (
            <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--ink-muted)', lineHeight: 1.5 }}>
              {displayDesc.length > 150 ? displayDesc.slice(0, 150) + '...' : displayDesc}
            </p>
          )}
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            {msg.role !== 'user' && (
              <div style={{
                width: 28, height: 28, borderRadius: '50%', background: 'var(--accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, flexShrink: 0, marginRight: 8, marginTop: 4
              }}>
                🤖
              </div>
            )}
            <div style={{
              maxWidth: '72%', padding: '10px 14px',
              borderRadius: msg.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
              background: msg.role === 'user' ? 'var(--accent)' : msg.role === 'error' ? 'var(--red-soft)' : 'var(--surface-2)',
              color: msg.role === 'user' ? 'white' : msg.role === 'error' ? 'var(--red)' : 'var(--ink)',
              fontSize: 14, lineHeight: 1.6,
              border: msg.role === 'assistant' ? '1px solid var(--border)' : 'none',
            }}>
              {msg.role === 'assistant' ? renderMarkdown(msg.content) : msg.content}
              {msg.streaming && isTyping && (
                <span style={{ display: 'inline-block', width: 6, height: 14, background: 'var(--ink-muted)', marginLeft: 3, animation: 'blink 1s infinite', borderRadius: 2 }} />
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Quick suggestion chips */}
      {showSuggestions && (
        <div style={{ padding: '0 20px 12px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(taskId ? taskSuggestions : projectSuggestions).map(suggestion => (
            <button key={suggestion} onClick={() => sendMessage(suggestion)}
              style={{
                padding: '6px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                background: 'var(--surface-2)', border: '1px solid var(--border)',
                color: 'var(--ink-muted)', transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--ink-muted)'; }}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, background: 'var(--surface)' }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isConnected
            ? (taskId ? 'Ask about your task... (Enter to send)' : 'Ask about your project... (Enter to send)')
            : 'Connecting to mentor...'}
          disabled={!isConnected}
          rows={2}
          style={{
            flex: 1, background: 'var(--surface-2)', border: '1px solid var(--border)',
            borderRadius: 10, color: 'var(--ink)', padding: '10px 14px',
            fontSize: 14, resize: 'none', outline: 'none',
            opacity: isConnected ? 1 : 0.5, lineHeight: 1.5,
          }}
        />
        <button onClick={sendMessage} disabled={!isConnected || !input.trim()}
          style={{
            padding: '0 20px', background: 'var(--accent)', color: 'white',
            border: 'none', borderRadius: 10, cursor: 'pointer',
            fontWeight: 600, fontSize: 14, transition: 'opacity 0.15s',
            opacity: (!isConnected || !input.trim()) ? 0.4 : 1,
          }}>
          Send
        </button>
      </div>

      <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>
    </div>
  )
}

export default function MentorPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface)' }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid var(--accent)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    }>
      <MentorChat />
    </Suspense>
  )
}
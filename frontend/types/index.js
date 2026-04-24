// ─── User & Auth ─────────────────────────────────────────────
export type Role = 'intern' | 'mentor' | 'admin'

export interface User {
  id: string
  email: string
  name: string
  avatar_url?: string
  github_username?: string
  role: Role
  created_at: string
}

// ─── Internship & Tasks ──────────────────────────────────────
export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high'
export type InternRole = 'frontend' | 'backend' | 'fullstack' | 'devops' | 'design'

export interface Sprint {
  id: string
  title: string
  description: string
  start_date: string
  end_date: string
  is_active: boolean
}

export interface Task {
  id: string
  sprint_id: string
  title: string
  description: string
  assigned_to: string
  intern_role: InternRole
  status: TaskStatus
  priority: TaskPriority
  due_date: string
  github_pr_url?: string
  score?: number
  created_at: string
}

// ─── AI Mentor ───────────────────────────────────────────────
export interface MentorMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export interface MentorSession {
  id: string
  task_id: string
  user_id: string
  messages: MentorMessage[]
}

// ─── Portfolio ───────────────────────────────────────────────
export interface SkillScore {
  skill: string
  score: number
  max: number
}

export interface Certificate {
  id: string
  user_id: string
  intern_role: InternRole
  issued_at: string
  pdf_url: string
  skills: SkillScore[]
}

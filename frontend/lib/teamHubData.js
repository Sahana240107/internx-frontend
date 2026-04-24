export const teamHubNav = [
  { href: '/dashboard', label: 'Assigned Sprint' },
  { href: '/dashboard/guide', label: 'Guide to All' },
  { href: '/dashboard/chat', label: 'Chat and Meet' },
  { href: '/dashboard/calendar', label: 'Calendar' },
  { href: '/dashboard/teammates', label: 'Teammates Sprint' },
  { href: '/dashboard/review', label: 'Review' },
  { href: '/dashboard/ticket', label:'ticket'},
  { href: '/dashboard/profile', label: 'Profile' },
  { href: '/dashboard/analytics', label: 'Analytics' },
  { href: '/dashboard/report-user', label: 'Report User' },
]

export const landingMetrics = [
  { label: 'difficulty templates', value: '3' },
  { label: 'dashboard modules', value: '10' },
  { label: 'team repo automation', value: 'GitHub' },
  { label: 'next project flow', value: 'Included' },
]

export const landingSteps = [
  { title: 'Project selection', description: 'Interns join a project instance and are grouped into frontend, backend, and tester teams based on difficulty.' },
  { title: 'Workspace setup', description: 'InternX provisions a team repository, shares VS Code setup steps, and exposes reusable project documentation.' },
  { title: 'Sprint execution', description: 'The dashboard shows assigned sprint goals, teammate progress, calendar events, review queues, and collaboration links.' },
  { title: 'Completion and restart', description: 'Once a project ends, interns see their summary and can immediately choose the next project path.' },
]

export const roleTracks = [
  { title: 'Frontend team', color: 'var(--accent)', description: 'Focused on UI delivery, reusable components, handoff clarity, and sprint demo readiness.', points: ['Landing page implementation', 'Dashboard modules', 'Profile and analytics views'] },
  { title: 'Backend team', color: 'var(--green)', description: 'Handles team assignment logic, GitHub provisioning, sprint data, documentation APIs, and reporting workflows.', points: ['Difficulty-based team sizing', 'Repo automation endpoints', 'Sprint and reporting APIs'] },
  { title: 'Tester team', color: 'var(--amber)', description: 'Owns review quality, sprint verification, bug logging, and release confidence across the product.', points: ['Review suggestions', 'Regression checkpoints', 'Completion validation'] },
]

export const assignedSprint = {
  title: 'Sprint 04 - Multi-team product expansion',
  objective: 'Ship the team-based dashboard, GitHub repo automation scaffold, and the next-project selection experience.',
  teamName: 'Phoenix Pod',
  projectName: 'Team Commerce Workspace',
  projectDifficulty: 'Hard',
  progress: 68,
  blockers: ['Finalize GitHub org naming rules for automated repositories.', 'Replace mock dashboard data with live API wiring.'],
}

export const teamSummary = {
  project: 'Team Commerce Workspace',
  repoName: 'internx-team-commerce-hard-fe-02',
  repoUrl: 'https://github.com/internx-org/internx-team-commerce-hard-fe-02',
  meetUrl: 'https://meet.google.com/',
  guideVersion: 'v0.1 MVP scaffold',
}

export const dashboardModules = [
  { title: 'Guide to All', href: '/dashboard/guide', description: 'Shared product docs, roles, repo conventions, and feature references.' },
  { title: 'Setup', href: '/dashboard/setup', description: 'VS Code integration, repo creation flow, and environment onboarding steps.' },
  { title: 'Chat and Meet', href: '/dashboard/chat', description: 'Project chatbot entry point plus direct access to recurring Google Meet rooms.' },
  { title: 'Calendar', href: '/dashboard/calendar', description: 'Previous and upcoming sprint schedule with key ceremony checkpoints.' },
  { title: 'Teammates Sprint', href: '/dashboard/teammates', description: 'Quick visibility into teammate ownership, blockers, and current sprint progress.' },
  { title: 'Review', href: '/dashboard/review', description: 'Suggested review actions, QA notes, and quality gates for the current sprint.' },
  { title: 'Profile', href: '/dashboard/profile', description: 'Intern profile, role summary, completed projects, and growth focus areas.' },
  { title: 'Analytics', href: '/dashboard/analytics', description: 'Velocity, review trends, on-time completion, and team delivery metrics.' },
  { title: 'Report User', href: '/dashboard/report-user', description: 'Structured report submission for moderation or collaboration concerns.' },
]

export const guideArticles = [
  { title: 'Shared project understanding', description: 'Problem statement, target users, acceptance criteria, and demo expectations.', tags: ['product', 'shared', 'mvp'] },
  { title: 'Team responsibilities', description: 'Frontend, backend, and tester ownership boundaries for each sprint.', tags: ['roles', 'scope', 'handoff'] },
  { title: 'Branching and review rules', description: 'Naming patterns, pull request template notes, and release checklist basics.', tags: ['github', 'review', 'workflow'] },
]

export const setupChecklist = [
  'Generate a team repository from the InternX GitHub account or organization template.',
  'Open the workspace in VS Code and apply the recommended settings and extensions.',
  'Create role-based branches for frontend, backend, and tester work.',
  'Store setup status and repo metadata inside the team dashboard.',
]

export const teammateSprintDetails = [
  { name: 'Asha', role: 'Frontend', focus: 'Public landing page', status: 'In progress' },
  { name: 'Ravi', role: 'Backend', focus: 'Repo automation endpoints', status: 'Ready for review' },
  { name: 'Mira', role: 'Tester', focus: 'Review checklist and regressions', status: 'Blocked on API mocks' },
]

export const reviewSuggestions = [
  'Require one tester sign-off before marking a sprint task as done.',
  'Add repository labels for sprint, role, and severity to support automation later.',
  'Keep shared docs versioned so all teams reference the same guide content.',
]

export const calendarItems = [
  { name: 'Sprint 03 retrospective', date: '2026-04-16', type: 'previous' },
  { name: 'Sprint 04 planning', date: '2026-04-21', type: 'current' },
  { name: 'Sprint 04 demo review', date: '2026-04-28', type: 'upcoming' },
  { name: 'Sprint 05 kickoff', date: '2026-05-01', type: 'upcoming' },
]

export const analyticsCards = [
  { label: 'Sprint velocity', value: '21 pts', tone: 'var(--accent)' },
  { label: 'On-time completion', value: '83%', tone: 'var(--green)' },
  { label: 'Average review score', value: '8.6/10', tone: 'var(--amber)' },
  { label: 'Rework items', value: '4', tone: 'var(--red)' },
]

export const profileSummary = {
  name: 'Intern User',
  role: 'Frontend intern',
  currentProject: 'Team Commerce Workspace',
  completedProjects: 2,
  growthAreas: ['Team coordination', 'Review quality', 'Sprint planning'],
}

export const reportReasons = ['Missed sprint collaboration expectations', 'Repository misuse or unsafe changes', 'Inappropriate communication', 'Repeated blocker without escalation']

export const nextProjects = [
  { title: 'AI Interview Scheduler', difficulty: 'Medium', recommendedRole: 'Backend', summary: 'Adds scheduling workflows, notification APIs, and interviewer dashboards.' },
  { title: 'Intern Portfolio Studio', difficulty: 'Easy', recommendedRole: 'Frontend', summary: 'Focuses on profile polish, personalization, and certificate presentation.' },
  { title: 'Bug Triage Command Center', difficulty: 'Hard', recommendedRole: 'Tester', summary: 'Expands reporting, moderation, and release confidence tooling.' },
]

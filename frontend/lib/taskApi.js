// lib/taskApi.js
// Matches the actual backend routes in tasks.py

import api from './api'

export const taskApi = {
  // GET /api/tasks/my-tasks
  getMyTasks: () => api.get('/api/tasks/my-tasks'),

  // GET /api/tasks/project-tasks  (all tasks in current user's project — for Teammates page)
  getProjectTasks: () => api.get('/api/tasks/project-tasks'),

  // GET /api/tasks/sprints/active
  getActiveSprint: () => api.get('/api/tasks/sprints/active'),

  // GET /api/tasks/:id
  getTask: (id) => api.get(`/api/tasks/${id}`),

  // PATCH /api/tasks/:id/status
  updateStatus: (id, status) => api.patch(`/api/tasks/${id}/status`, { status }),

  // PATCH /api/tasks/:id  (submit PR url)
  submitPR: (id, pr_url) => api.patch(`/api/tasks/${id}`, { github_pr_url: pr_url }),
}
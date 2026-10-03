'use client'

import { create } from 'zustand'
import type { ViewName, SessionUser, ProjectDTO, ProjectFileDTO, BuildDTO } from '@/lib/types'

interface AppState {
  view: ViewName
  viewHistory: ViewName[]
  user: SessionUser | null
  currentProject: ProjectDTO | null
  currentBuild: BuildDTO | null
  showNewProject: boolean
  showMore: boolean
  showExplorer: boolean
  buildSource: { type: 'html' | 'kotlin'; projectId?: string } | null
  toast: string | null

  setView: (v: ViewName) => void
  goBack: () => void
  setUser: (u: SessionUser | null) => void
  openEditor: (p: ProjectDTO) => void
  openBuild: (source: { type: 'html' | 'kotlin'; projectId?: string }) => void
  openConsole: (b: BuildDTO) => void
  openReady: (b: BuildDTO) => void
  setShowNewProject: (v: boolean) => void
  setShowMore: (v: boolean) => void
  setShowExplorer: (v: boolean) => void
  showToast: (msg: string | null) => void
}

export const useApp = create<AppState>((set, get) => ({
  view: 'home',
  viewHistory: [],
  user: null,
  currentProject: null,
  currentBuild: null,
  showNewProject: false,
  showMore: false,
  showExplorer: false,
  buildSource: null,
  toast: null,

  setView: (view) => {
    const current = get().view
    // don't push to history if navigating to the same view
    if (current !== view) {
      set((state) => ({ view, viewHistory: [...state.viewHistory, current] }))
    } else {
      set({ view })
    }
  },

  goBack: () => {
    const history = get().viewHistory
    if (history.length > 0) {
      const prev = history[history.length - 1]
      set((state) => ({ view: prev, viewHistory: state.viewHistory.slice(0, -1) }))
    } else {
      // no history — go home
      set({ view: 'home' })
    }
  },

  setUser: (user) => set({ user }),
  openEditor: (currentProject) => set((state) => ({ view: 'editor', currentProject, showExplorer: false, viewHistory: [...state.viewHistory, state.view] })),
  openBuild: (buildSource) => set((state) => ({ view: 'build', buildSource, viewHistory: [...state.viewHistory, state.view] })),
  openConsole: (currentBuild) => set((state) => ({ view: 'console', currentBuild, viewHistory: [...state.viewHistory, state.view] })),
  openReady: (currentBuild) => set((state) => ({ view: 'ready', currentBuild, viewHistory: [...state.viewHistory, state.view] })),
  setShowNewProject: (showNewProject) => set({ showNewProject }),
  setShowMore: (showMore) => set({ showMore }),
  setShowExplorer: (showExplorer) => set({ showExplorer }),
  showToast: (toast) => {
    set({ toast })
    if (toast) setTimeout(() => set((s) => (s.toast === toast ? { toast: null } : {})), 2600)
  },
}))

export const initialFilesCount = 0
export type { ProjectFileDTO }

'use client'

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Layers, PanelLeft, Undo2, Redo2, Save, Play, Zap, MoreVertical, X,
  FilePlus2, FolderPlus, Upload, ChevronDown, ChevronRight, FileCode2, FileJson, FileText, Trash2, Folder,
  Copy, Search, Home, Code2, WrapText, Eye, Sparkles, ChevronLeft,
} from 'lucide-react'
import type { ProjectFileDTO } from '@/lib/types'

/* ---------------- Syntax highlighting ---------------- */

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const KW_KOTLIN =
  'package|import|class|object|interface|fun|val|var|override|private|public|protected|internal|if|else|when|for|while|return|is|as|in|super|this|null|true|false|by|lateinit|companion|data|sealed|enum|suspend|vararg|it|try|catch|finally|throw|abstract|const|do|break|continue|annotation'
const KW_JS =
  'const|let|var|function|return|if|else|for|while|class|new|import|export|from|default|async|await|true|false|null|undefined|this|typeof|of|in|try|catch|throw|switch|case|break|continue|do'

function wrap(cls: string, text: string) {
  return `<span class="${cls}">${text}</span>`
}

function highlight(code: string, lang: string): string {
  const e = escapeHtml(code)
  switch (lang) {
    case 'kotlin':
    case 'java':
      return e.replace(
        new RegExp(`(\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/)|("(?:\\\\.|[^"\\\\\\n])*"|'(?:\\\\.|[^'\\\\\\n])*')|(@\\w+)|\\b(?:${KW_KOTLIN})\\b|\\b(\\d+(?:\\.\\d+)?[fLdD]?)\\b|\\b([A-Z][A-Za-z0-9_]*)\\b`, 'g'),
        (m, c, s, ann, num, type) => {
          if (c) return wrap('text-slate-500 italic', m)
          if (s) return wrap('text-amber-300/90', m)
          if (ann) return wrap('text-yellow-400/90', m)
          if (num) return wrap('text-violet-400/90', m)
          if (type) return wrap('text-emerald-400/90', m)
          return wrap('text-fuchsia-400 font-medium', m)
        }
      )
    case 'xml':
    case 'html':
      return e.replace(
        /(&lt;!--[\s\S]*?--&gt;)|("[^"]*"|'[^']*')|(&lt;\/?[\w:.-]+|\/?&gt;)|([\w:.-]+)(?==)/g,
        (m, c, s, tag, attr) => {
          if (c) return wrap('text-slate-500 italic', m)
          if (s) return wrap('text-amber-300/90', m)
          if (tag) return wrap('text-emerald-400 font-medium', m)
          if (attr) return wrap('text-sky-300/90', m)
          return m
        }
      )
    case 'css':
      return e.replace(
        /(\/\*[\s\S]*?\*\/)|("[^"]*"|'[^']*')|(#[0-9a-fA-F]{3,8}\b)|([.#]?[a-zA-Z][\w-]*(?=[^{}]*\{))|([\w-]+)(?=\s*:)/g,
        (m, c, s, hex, sel, prop) => {
          if (c) return wrap('text-slate-500 italic', m)
          if (s) return wrap('text-amber-300/90', m)
          if (hex) return wrap('text-violet-400/90', m)
          if (sel) return wrap('text-emerald-400/90', m)
          if (prop) return wrap('text-sky-300/90', m)
          return m
        }
      )
    case 'javascript':
    case 'json':
      return e.replace(
        new RegExp(`(\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/)|("(?:\\\\.|[^"\\\\])*"|'(?:\\\\.|[^'\\\\])*'|\`(?:\\\\.|[^\`\\\\])*\`|\\btrue\\b|\\bfalse\\b|\\bnull\\b)|\\b(?:${KW_JS})\\b|\\b(\\d+(?:\\.\\d+)?)\\b|\\b([A-Z][A-Za-z0-9_]*)\\b|(\\w+)(?=\\s*\\()`, 'g'),
        (m, c, s, num, type, fn) => {
          if (c) return wrap('text-slate-500 italic', m)
          if (s) return wrap('text-amber-300/90', m)
          if (num) return wrap('text-violet-400/90', m)
          if (type) return wrap('text-emerald-400/90', m)
          if (fn) return wrap('text-sky-400/90', m)
          return wrap('text-fuchsia-400 font-medium', m)
        }
      )
    default:
      return e
  }
}

const langLabel: Record<string, string> = {
  kotlin: 'Kotlin', java: 'Java', xml: 'XML', html: 'HTML', css: 'CSS', javascript: 'JavaScript', json: 'JSON', plaintext: 'Text',
}

/* ---------------- File tree ---------------- */

interface TreeNode {
  name: string
  path: string
  isFile: boolean
  fileId?: string
  language?: string
  children: TreeNode[]
}

function buildTree(files: ProjectFileDTO[]): TreeNode {
  const root: TreeNode = { name: '', path: '', isFile: false, children: [] }
  for (const f of files) {
    const parts = f.path.split('/')
    let cur = root
    parts.forEach((part, i) => {
      const isFile = i === parts.length - 1
      let next = cur.children.find((c) => c.name === part && c.isFile === isFile)
      if (!next) {
        next = { name: part, path: parts.slice(0, i + 1).join('/'), isFile, fileId: isFile ? f.id : undefined, language: f.language, children: [] }
        cur.children.push(next)
      } else if (isFile) {
        next.fileId = f.id
        next.language = f.language
      }
      cur = next
    })
  }
  const sortNode = (n: TreeNode) => {
    n.children.sort((a, b) => (a.isFile === b.isFile ? a.name.localeCompare(b.name) : a.isFile ? 1 : -1))
    n.children.forEach(sortNode)
  }
  sortNode(root)
  return root
}

function fileIconCls(lang?: string) {
  if (lang === 'xml') return 'text-emerald-400'
  if (lang === 'kotlin' || lang === 'java') return 'text-violet-400'
  if (lang === 'html') return 'text-orange-400'
  if (lang === 'css') return 'text-sky-400'
  if (lang === 'javascript') return 'text-yellow-400'
  if (lang === 'json') return 'text-amber-400'
  return 'text-slate-400'
}

function FileIcon({ lang, className }: { lang?: string; className?: string }) {
  if (lang === 'json') return <FileJson className={`${className} ${fileIconCls(lang)}`} />
  if (lang === 'plaintext') return <FileText className={`${className} ${fileIconCls(lang)}`} />
  return <FileCode2 className={`${className} ${fileIconCls(lang)}`} />
}

function TreeItem({
  node, depth, activeId, dirty, onSelect, onDelete, expanded, toggleDir,
}: {
  node: TreeNode
  depth: number
  activeId: string | null
  dirty: Set<string>
  onSelect: (id: string) => void
  onDelete: (id: string, name: string) => void
  expanded: Set<string>
  toggleDir: (path: string) => void
}) {
  if (!node.isFile) {
    const open = expanded.has(node.path)
    return (
      <div>
        {node.path && (
          <button
            onClick={() => toggleDir(node.path)}
            className="w-full flex items-center gap-2 py-[7px] pr-2 text-slate-300 hover:bg-white/[0.04] rounded-md text-[13px] transition-colors group"
            style={{ paddingLeft: depth * 14 + 10 }}
          >
            {open ? <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
            <Folder className={`w-4 h-4 shrink-0 ${open ? 'text-amber-400/90' : 'text-amber-400/70'}`} />
            <span className="font-medium truncate">{node.name}</span>
          </button>
        )}
        {(open || !node.path) &&
          node.children.map((c) => (
            <TreeItem key={c.path} node={c} depth={node.path ? depth + 1 : depth} activeId={activeId} dirty={dirty} onSelect={onSelect} onDelete={onDelete} expanded={expanded} toggleDir={toggleDir} />
          ))}
      </div>
    )
  }
  const active = node.fileId === activeId
  return (
    <div
      className={`group flex items-center gap-2 py-[7px] pr-2 rounded-md cursor-pointer text-[13px] transition-colors ${active ? 'bg-violet-500/15 text-white' : 'text-slate-300 hover:bg-white/[0.04]'}`}
      style={{ paddingLeft: depth * 14 + 10 }}
      onClick={() => node.fileId && onSelect(node.fileId)}
    >
      <FileIcon lang={node.language} className="w-4 h-4 shrink-0" />
      <span className={`truncate flex-1 ${active ? 'font-semibold' : 'font-medium'}`}>{node.name}</span>
      {node.fileId && dirty.has(node.fileId) && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />}
      {node.fileId && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete(node.fileId!, node.name)
          }}
          className="opacity-0 group-hover:opacity-60 hover:!opacity-100 text-slate-400 hover:text-red-400 shrink-0 transition-opacity"
          aria-label={`Delete ${node.name}`}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}

/* ---------------- Preview builder ---------------- */

function buildPreview(files: ProjectFileDTO[]): string {
  const html = files.find((f) => f.path.endsWith('.html'))?.content || '<h1>No HTML file</h1>'
  const css = files.filter((f) => f.path.endsWith('.css')).map((f) => f.content).join('\n')
  const js = files.filter((f) => f.path.endsWith('.js')).map((f) => f.content).join('\n')
  let out = html
  out = out.replace(/<link[^>]*href=["'][^"']*\.css["'][^>]*>/gi, '')
  out = out.replace(/<script[^>]*src=["'][^"']*\.js["'][^>]*>\s*<\/script>/gi, '')
  const inject = `${css ? `<style>${css}</style>` : ''}\n${js ? `<script>${js}<\/script>` : ''}`
  if (out.includes('</body>')) return out.replace('</body>', `${inject}\n</body>`)
  return out + inject
}

/* ---------------- Main editor ---------------- */

export default function EditorView() {
  const { currentProject, openBuild, setView, goBack, showToast, showExplorer, setShowExplorer } = useApp()
  const [files, setFiles] = useState<ProjectFileDTO[]>(currentProject?.files || [])
  const [activeId, setActiveId] = useState<string | null>(currentProject?.files?.[0]?.id || null)
  const [dirty, setDirty] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [cursor, setCursor] = useState({ ln: 1, col: 1 })
  const [prompt, setPrompt] = useState<{ title: string; placeholder: string; action: (v: string) => void } | null>(null)
  const [promptVal, setPromptVal] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [showMore, setShowMore] = useState(false)
  const [wordWrap, setWordWrap] = useState(false)
  const [fontSize, setFontSize] = useState(16)
  const [findReplace, setFindReplace] = useState<{ find: string; replace: string } | null>(null)
  const [jumpLine, setJumpLine] = useState<string | null>(null)

  const taRef = useRef<HTMLTextAreaElement>(null)
  const preRef = useRef<HTMLPreElement>(null)
  const gutterRef = useRef<HTMLDivElement>(null)
  const undoStack = useRef<string[]>([])
  const redoStack = useRef<string[]>([])
  const selRef = useRef<{ start: number; end: number } | null>(null)

  useEffect(() => {
    if (currentProject?.id) {
      fetch(`/api/projects/${currentProject.id}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.project) {
            setFiles(d.project.files)
            setActiveId(d.project.files[0]?.id || null)
            const dirs = new Set<string>()
            d.project.files.forEach((f: ProjectFileDTO) => {
              const parts = f.path.split('/')
              parts.pop()
              let acc = ''
              parts.forEach((p: string) => {
                acc = acc ? `${acc}/${p}` : p
                dirs.add(acc)
              })
            })
            setExpanded(dirs)
          }
        })
    }
  }, [currentProject?.id])

  const active = files.find((f) => f.id === activeId) || null
  const content = active?.content ?? ''
  // Deferred copy: typing stays instant while the expensive re-highlight +
  // gutter re-render runs at low priority and never fights the caret.
  const [fileForDeferral, setFileForDeferral] = useState(activeId)
  if (activeId !== fileForDeferral) setFileForDeferral(activeId)
  const deferredContent = useDeferredValue(content)
  const renderContent = activeId === fileForDeferral ? deferredContent : content
  const tree = useMemo(() => buildTree(files), [files])
  const lines = renderContent.split('\n')
  const highlighted = useMemo(() => highlight(renderContent, active?.language || 'plaintext'), [renderContent, active?.language])

  const setContent = (val: string, pushUndo = true) => {
    if (!active) return
    if (pushUndo && active.content !== val) {
      undoStack.current.push(active.content)
      if (undoStack.current.length > 200) undoStack.current.shift()
      redoStack.current = []
    }
    setFiles((fs) => fs.map((f) => (f.id === active.id ? { ...f, content: val } : f)))
    setDirty((d) => new Set(d).add(active.id))
  }

  const undo = () => {
    if (!active || !undoStack.current.length) return
    const prev = undoStack.current.pop()!
    redoStack.current.push(active.content)
    setFiles((fs) => fs.map((f) => (f.id === active.id ? { ...f, content: prev } : f)))
    setDirty((d) => new Set(d).add(active.id))
  }

  const redo = () => {
    if (!active || !redoStack.current.length) return
    const next = redoStack.current.pop()!
    undoStack.current.push(active.content)
    setFiles((fs) => fs.map((f) => (f.id === active.id ? { ...f, content: next } : f)))
    setDirty((d) => new Set(d).add(active.id))
  }

  const save = async () => {
    if (!active || !dirty.has(active.id)) {
      if (active) showToast('All changes saved')
      return
    }
    setSaving(true)
    const res = await fetch(`/api/files/${active.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: active.content }),
    })
    setSaving(false)
    if (res.ok) {
      setDirty((d) => {
        const n = new Set(d)
        n.delete(active.id)
        return n
      })
      showToast('File saved')
    } else {
      showToast('Save failed')
    }
  }

  const saveAll = async () => {
    setSaving(true)
    for (const f of files) {
      if (!dirty.has(f.id)) continue
      await fetch(`/api/files/${f.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: f.content }),
      })
    }
    setSaving(false)
    setDirty(new Set())
    showToast('All files saved')
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        saveAll()
        return
      }
      // Native undo/redo corrupts the caret in a React-controlled textarea —
      // route ⌘Z / ⌘Y / ⇧⌘Z through our own history instead.
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        if (document.activeElement === taRef.current) {
          e.preventDefault()
          undo()
        }
      } else if (mod && ((e.key.toLowerCase() === 'z' && e.shiftKey) || e.key.toLowerCase() === 'y')) {
        if (document.activeElement === taRef.current) {
          e.preventDefault()
          redo()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const insertAtCursor = (text: string) => {
    const ta = taRef.current
    if (!ta || !active) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const val = content.slice(0, start) + text + content.slice(end)
    setContent(val)
    requestAnimationFrame(() => {
      const t = taRef.current
      if (!t) return
      t.selectionStart = t.selectionEnd = start + text.length
      selRef.current = { start: t.selectionStart, end: t.selectionEnd }
      t.focus()
      updateCursor()
      syncScroll()
    })
  }

  // ── Comment / Uncomment ──
  const toggleComment = () => {
    if (!active || !taRef.current) return
    const ta = taRef.current
    const start = ta.selectionStart
    const end = ta.selectionEnd
    selRef.current = { start, end }
    const selected = content.slice(start, end)
    if (!selected) {
      const lineStart = content.lastIndexOf('\n', start - 1) + 1
      const lineEnd = content.indexOf('\n', start)
      const line = content.slice(lineStart, lineEnd === -1 ? content.length : lineEnd)
      if (line.trimStart().startsWith('//')) {
        const newLine = line.replace(/^(\s*)\/\//, '$1')
        const newContent = content.slice(0, lineStart) + newLine + content.slice(lineEnd === -1 ? content.length : lineEnd)
        setContent(newContent)
        showToast('Uncommented')
      } else {
        const newLine = '//' + line
        const newContent = content.slice(0, lineStart) + newLine + content.slice(lineEnd === -1 ? content.length : lineEnd)
        setContent(newContent)
        showToast('Commented')
      }
    } else {
      const selLines = selected.split('\n')
      const allCommented = selLines.every((l) => l.trimStart().startsWith('//') || l.trim() === '')
      const newLines = allCommented
        ? selLines.map((l) => l.replace(/^(\s*)\/\//, '$1'))
        : selLines.map((l) => (l.trim() === '' ? l : '//' + l))
      const newContent = content.slice(0, start) + newLines.join('\n') + content.slice(end)
      setContent(newContent)
      showToast(allCommented ? 'Uncommented' : 'Commented')
    }
    setShowMore(false)
  }

  // ── Format Code ──
  const formatCode = () => {
    if (!active) return
    const lang = active.language
    let formatted = content
    if (lang === 'html' || lang === 'xml') {
      const tokens = formatted.replace(/>\s*</g, '>\n<').split('\n')
      let indent = 0
      formatted = tokens.map((token) => {
        token = token.trim()
        if (!token) return ''
        if (token.startsWith('</')) indent = Math.max(0, indent - 1)
        const line = '  '.repeat(indent) + token
        if (token.startsWith('<') && !token.startsWith('</') && !token.startsWith('<!') && !token.endsWith('/>') && !token.includes('</')) indent++
        return line
      }).filter(Boolean).join('\n')
    } else if (lang === 'kotlin' || lang === 'java' || lang === 'javascript') {
      const codeLines = formatted.split('\n')
      let indent = 0
      formatted = codeLines.map((line) => {
        const trimmed = line.trim()
        if (!trimmed) return ''
        if (trimmed.startsWith('}')) indent = Math.max(0, indent - 1)
        const formattedLine = '  '.repeat(indent) + trimmed
        const openBraces = (trimmed.match(/{/g) || []).length
        const closeBraces = (trimmed.match(/}/g) || []).length
        indent += openBraces - closeBraces
        indent = Math.max(0, indent)
        return formattedLine
      }).join('\n')
    } else if (lang === 'css') {
      formatted = formatted.replace(/\s*{\s*/g, ' {\n  ').replace(/\s*;\s*/g, ';\n  ').replace(/\s*}\s*/g, '\n}\n').replace(/\n  \n/g, '\n').replace(/\n\n+/g, '\n\n').trim()
    }
    selRef.current = { start: 0, end: 0 }
    setContent(formatted)
    showToast('Code formatted')
    setShowMore(false)
    requestAnimationFrame(syncScroll)
  }

  // ── Find & Replace ──
  const doFindReplace = () => {
    if (!findReplace || !active || !findReplace.find) return
    const escaped = findReplace.find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(escaped, 'g')
    const count = (content.match(regex) || []).length
    if (count === 0) { showToast('No matches found'); return }
    const newContent = content.replace(regex, findReplace.replace)
    selRef.current = { start: 0, end: 0 }
    setContent(newContent)
    showToast(`Replaced ${count} occurrence${count === 1 ? '' : 's'}`)
    setFindReplace(null)
  }

  // ── Jump to Line ──
  const doJumpToLine = () => {
    const ln = parseInt(jumpLine || '')
    if (!ln || ln < 1 || !taRef.current) return
    const ta = taRef.current
    // compute from the live textarea value, not a possibly-stale render copy
    const allLines = ta.value.split('\n')
    const targetLine = Math.min(ln, allLines.length)
    let pos = 0
    for (let i = 0; i < targetLine - 1; i++) {
      pos += allLines[i].length + 1
    }
    ta.focus()
    ta.setSelectionRange(pos, pos)
    selRef.current = { start: pos, end: pos }
    const lineHeight = Math.round(fontSize * 1.5)
    ta.scrollTop = Math.max(0, (targetLine - 1) * lineHeight - ta.clientHeight / 2)
    updateCursor()
    syncScroll()
    setJumpLine(null)
    setShowMore(false)
    showToast(`Jumped to line ${targetLine}`)
  }

  const updateCursor = () => {
    const ta = taRef.current
    if (!ta) return
    // read from the live DOM value, never from a stale render closure
    const upto = ta.value.slice(0, ta.selectionStart)
    const ln = upto.split('\n').length
    const col = upto.length - upto.lastIndexOf('\n')
    setCursor({ ln, col })
  }

  const rememberSel = () => {
    const ta = taRef.current
    if (!ta) return
    selRef.current = { start: ta.selectionStart, end: ta.selectionEnd }
  }

  const syncScroll = () => {
    const ta = taRef.current
    if (!ta) return
    if (preRef.current) {
      preRef.current.scrollTop = ta.scrollTop
      preRef.current.scrollLeft = ta.scrollLeft
    }
    if (gutterRef.current) gutterRef.current.scrollTop = ta.scrollTop
  }

  useEffect(() => {
    const ta = taRef.current
    if (!ta) return
    syncScroll()
  }, [content, active?.id, wordWrap, fontSize])

  // Restore the caret to where the user put it whenever the textarea value is
  // rewritten (typing race, undo/redo, insert, format, find/replace…). This is
  // the fix for "cursor in one place, text lands in another".
  useEffect(() => {
    const ta = taRef.current
    if (!ta) return
    const sel = selRef.current
    if (!sel || document.activeElement !== ta) return
    const max = ta.value.length
    const s = Math.min(sel.start, max)
    const e = Math.min(sel.end, max)
    if (ta.selectionStart !== s || ta.selectionEnd !== e) {
      try { ta.setSelectionRange(Math.min(s, e), Math.max(s, e)) } catch { /* noop */ }
      updateCursor()
    }
  }, [content, active?.id])

  // Re-sync the highlight layer when the on-screen keyboard opens or closes
  useEffect(() => {
    const vv = (window as Window & { visualViewport?: VisualViewport }).visualViewport
    if (!vv) return
    const onResize = () => syncScroll()
    vv.addEventListener('resize', onResize)
    return () => vv.removeEventListener('resize', onResize)
  }, [])

  const selectFile = (id: string) => {
    setActiveId(id)
    selRef.current = { start: 0, end: 0 }
    setCursor({ ln: 1, col: 1 })
    undoStack.current = []
    redoStack.current = []
  }

  const addFile = async (path: string) => {
    if (!currentProject || !path.trim()) return
    const res = await fetch(`/api/projects/${currentProject.id}/files`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: path.trim() }),
    })
    const data = await res.json()
    if (!res.ok) {
      showToast(data.error || 'Could not create file')
      return
    }
    setFiles((fs) => [...fs, data.file])
    setActiveId(data.file.id)
    showToast(`${path} created`)
  }

  const uploadFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files
    if (!list || !currentProject) return
    for (const file of Array.from(list)) {
      const text = await file.text()
      const res = await fetch(`/api/projects/${currentProject.id}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: file.name, content: text }),
      })
      const data = await res.json()
      if (res.ok) setFiles((fs) => [...fs, data.file])
      else showToast(data.error || `Could not import ${file.name}`)
    }
    e.target.value = ''
  }

  const deleteFile = async (id: string, name: string) => {
    if (!confirm(`Delete ${name}?`)) return
    const res = await fetch(`/api/files/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setFiles((fs) => fs.filter((f) => f.id !== id))
      if (activeId === id) setActiveId(files.find((f) => f.id !== id)?.id || null)
      showToast(`${name} deleted`)
    }
  }

  if (!currentProject) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-4 bg-[#0c0d12] text-slate-300">
        <p>No project open</p>
        <Button onClick={() => goBack()} className="bg-slate-900">Back to Home</Button>
      </div>
    )
  }

  const canRun = files.some((f) => f.path.endsWith('.html'))
  const dirtyCount = dirty.size

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-[#0c0d12]">
      {/* ───────────────────── Toolbar ───────────────────── */}
      <div className="flex items-center gap-1 px-2 sm:px-3 h-14 bg-[#13151c] border-b border-white/[0.06] shrink-0">
        {/* Left: Explorer toggle + brand */}
        <button
          onClick={() => setShowExplorer(!showExplorer)}
          className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${showExplorer ? 'bg-white/[0.08] text-white' : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'}`}
          aria-label="Toggle explorer"
        >
          <PanelLeft className="w-[18px] h-[18px]" />
        </button>

        <button
          onClick={goBack}
          className="hidden sm:flex items-center gap-2 px-2 h-9 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors"
          aria-label="Back to home"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2.5 pl-1 pr-2 sm:border-r sm:border-white/[0.06] sm:mr-1">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <Layers className="w-4 h-4 text-white" />
          </div>
          <div className="hidden sm:flex flex-col leading-tight">
            <span className="text-white font-bold text-[13px]">ApkForge</span>
            <span className="text-slate-500 text-[10px] font-medium">Editor</span>
          </div>
        </div>

        {/* Project breadcrumb */}
        <div className="hidden md:flex items-center gap-2 px-2 min-w-0">
          <span className="text-slate-600 text-xs">/</span>
          <span className="text-slate-300 text-sm font-medium truncate max-w-[200px]">{currentProject.name}</span>
          {active && (
            <>
              <span className="text-slate-600 text-xs">/</span>
              <span className="text-slate-500 text-sm truncate max-w-[180px]">{active.path.split('/').pop()}</span>
            </>
          )}
          {dirtyCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-400/15 text-amber-300 text-[10px] font-bold">
              {dirtyCount} unsaved
            </span>
          )}
        </div>

        <div className="flex-1" />

        {/* Undo / Redo (subtle, on desktop) */}
        <div className="hidden sm:flex items-center gap-0.5 mr-1">
          <button
            onClick={undo}
            disabled={!undoStack.current.length}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
            aria-label="Undo"
          >
            <Undo2 className="w-[18px] h-[18px]" />
          </button>
          <button
            onClick={redo}
            disabled={!redoStack.current.length}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
            aria-label="Redo"
          >
            <Redo2 className="w-[18px] h-[18px]" />
          </button>
        </div>

        <div className="hidden sm:block w-px h-6 bg-white/[0.06] mr-1" />

        {/* Save */}
        <button
          onClick={saveAll}
          className={`h-9 px-3 rounded-lg flex items-center gap-2 text-sm font-semibold transition-all ${
            dirtyCount > 0
              ? 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
              : 'text-slate-400 hover:bg-white/[0.05] hover:text-white'
          }`}
          aria-label="Save all"
        >
          <Save className="w-4 h-4" />
          <span className="hidden sm:inline">{saving ? 'Saving…' : 'Save'}</span>
        </button>

        {/* Run */}
        {canRun && (
          <button
            onClick={() => setPreview(buildPreview(files))}
            className="h-9 px-3 rounded-lg flex items-center gap-2 text-sm font-semibold bg-violet-500/15 text-violet-300 hover:bg-violet-500/25 transition-all"
            aria-label="Run preview"
          >
            <Play className="w-4 h-4 fill-current" />
            <span className="hidden sm:inline">Run</span>
          </button>
        )}

        {/* Build APK */}
        <button
          onClick={() => {
            saveAll()
            openBuild(currentProject.type === 'kotlin' ? { type: 'kotlin', projectId: currentProject.id } : { type: 'html', projectId: currentProject.id })
          }}
          className="h-9 px-3 rounded-lg flex items-center gap-2 text-sm font-semibold bg-gradient-to-br from-amber-400 to-orange-500 text-slate-900 shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 hover:brightness-110 transition-all"
          aria-label="Build APK"
        >
          <Zap className="w-4 h-4 fill-current" />
          <span className="hidden sm:inline">Build</span>
        </button>

        <div className="w-px h-6 bg-white/[0.06] mx-1" />

        {/* More */}
        <button
          onClick={() => setShowMore(!showMore)}
          className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${showMore ? 'bg-white/[0.08] text-white' : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'}`}
          aria-label="More options"
        >
          <MoreVertical className="w-[18px] h-[18px]" />
        </button>
      </div>

      {/* ───────────────────── More dropdown menu ───────────────────── */}
      {showMore && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowMore(false)} />
          <div className="absolute right-2 top-14 z-50 w-64 bg-[#181a23] border border-white/[0.08] rounded-xl shadow-2xl shadow-black/50 overflow-hidden max-h-[80vh] overflow-y-auto">
            {/* Section: Edit */}
            <div className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">Edit</div>
            <button onClick={() => { undo(); setShowMore(false) }} className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium text-slate-200 hover:bg-white/[0.04] transition-colors">
              <Undo2 className="w-4 h-4 text-sky-400" /> Undo
              <span className="ml-auto text-[10px] text-slate-600 font-mono">⌘Z</span>
            </button>
            <button onClick={() => { redo(); setShowMore(false) }} className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium text-slate-200 hover:bg-white/[0.04] transition-colors">
              <Redo2 className="w-4 h-4 text-sky-400" /> Redo
              <span className="ml-auto text-[10px] text-slate-600 font-mono">⌘Y</span>
            </button>
            <button onClick={toggleComment} className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium text-slate-200 hover:bg-white/[0.04] transition-colors">
              <Code2 className="w-4 h-4 text-emerald-400" /> Comment / Uncomment
              <span className="ml-auto text-[10px] text-slate-600 font-mono">⌘/</span>
            </button>
            <button onClick={formatCode} className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium text-slate-200 hover:bg-white/[0.04] transition-colors">
              <Sparkles className="w-4 h-4 text-emerald-400" /> Format Code
            </button>

            {/* Section: Search */}
            <div className="mt-1 px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 border-t border-white/[0.05]">Search</div>
            <button onClick={() => { setFindReplace({ find: '', replace: '' }); setShowMore(false) }} className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium text-slate-200 hover:bg-white/[0.04] transition-colors">
              <Search className="w-4 h-4 text-amber-400" /> Find &amp; Replace
              <span className="ml-auto text-[10px] text-slate-600 font-mono">⌘F</span>
            </button>
            <button onClick={() => { setJumpLine(''); setShowMore(false) }} className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium text-slate-200 hover:bg-white/[0.04] transition-colors">
              <Eye className="w-4 h-4 text-amber-400" /> Jump to Line
              <span className="ml-auto text-[10px] text-slate-600 font-mono">⌘G</span>
            </button>

            {/* Section: View */}
            <div className="mt-1 px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 border-t border-white/[0.05]">View</div>
            <button onClick={() => { setWordWrap(!wordWrap); setShowMore(false) }} className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium text-slate-200 hover:bg-white/[0.04] transition-colors">
              <WrapText className={`w-4 h-4 ${wordWrap ? 'text-violet-400' : 'text-slate-500'}`} /> Word Wrap
              <span className={`ml-auto text-[10px] font-bold ${wordWrap ? 'text-violet-400' : 'text-slate-600'}`}>{wordWrap ? 'ON' : 'OFF'}</span>
            </button>
            <div className="flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium text-slate-200">
              <span className="w-4 h-4 flex items-center justify-center text-violet-400 font-bold text-xs">A</span>
              Font Size
              <div className="ml-auto flex items-center gap-1.5">
                <button
                  onClick={() => setFontSize(Math.max(10, fontSize - 2))}
                  className="w-7 h-7 rounded-md bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 text-xs font-bold flex items-center justify-center transition-colors"
                >−</button>
                <span className="text-xs text-slate-400 font-mono w-7 text-center">{fontSize}px</span>
                <button
                  onClick={() => setFontSize(Math.min(28, fontSize + 2))}
                  className="w-7 h-7 rounded-md bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 text-xs font-bold flex items-center justify-center transition-colors"
                >+</button>
              </div>
            </div>

            {/* Section: Project */}
            <div className="mt-1 px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 border-t border-white/[0.05]">Project</div>
            <button onClick={() => { saveAll(); setShowMore(false) }} className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium text-slate-200 hover:bg-white/[0.04] transition-colors">
              <Save className="w-4 h-4 text-emerald-400" /> Save All Files
            </button>
            {canRun && (
              <button onClick={() => { setPreview(buildPreview(files)); setShowMore(false) }} className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium text-slate-200 hover:bg-white/[0.04] transition-colors">
                <Play className="w-4 h-4 text-violet-400" /> Run / Preview
              </button>
            )}
            <button onClick={() => { saveAll(); openBuild(currentProject.type === 'kotlin' ? { type: 'kotlin', projectId: currentProject.id } : { type: 'html', projectId: currentProject.id }); setShowMore(false) }} className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium text-slate-200 hover:bg-white/[0.04] transition-colors">
              <Zap className="w-4 h-4 text-amber-400" /> Build APK
            </button>
            <button onClick={() => { setPromptVal(''); setPrompt({ title: 'New File', placeholder: 'e.g. res/values/colors.xml', action: (v) => addFile(v) }); setShowMore(false) }} className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium text-slate-200 hover:bg-white/[0.04] transition-colors">
              <FilePlus2 className="w-4 h-4 text-sky-400" /> New File
            </button>
            <button onClick={() => { setShowExplorer(true); setShowMore(false) }} className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium text-slate-200 hover:bg-white/[0.04] transition-colors">
              <PanelLeft className="w-4 h-4 text-slate-400" /> Toggle Explorer
            </button>
            <button onClick={() => { navigator.clipboard?.writeText(active?.content || ''); showToast('File copied'); setShowMore(false) }} className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium text-slate-200 hover:bg-white/[0.04] transition-colors">
              <Copy className="w-4 h-4 text-slate-400" /> Copy File Content
            </button>

            <div className="border-t border-white/[0.05]">
              <button onClick={() => { goBack(); setShowMore(false) }} className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium text-slate-300 hover:bg-white/[0.04] transition-colors">
                <Home className="w-4 h-4 text-slate-400" /> Back to Home
              </button>
            </div>
          </div>
        </>
      )}

      {/* ───────────────────── Find & Replace modal ───────────────────── */}
      {findReplace && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setFindReplace(null)} />
          <div className="relative bg-[#181a23] w-full max-w-md rounded-2xl shadow-2xl ring-1 ring-white/[0.08] overflow-hidden">
            <div className="flex items-center justify-between px-5 h-12 border-b border-white/[0.06]">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Search className="w-4 h-4 text-amber-400" /> Find &amp; Replace
              </h3>
              <button onClick={() => setFindReplace(null)} className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:bg-white/[0.06] hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Find</label>
                <input
                  value={findReplace.find}
                  onChange={(e) => setFindReplace({ ...findReplace, find: e.target.value })}
                  placeholder="Enter text to find…"
                  className="w-full h-10 px-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500/50 focus:bg-white/[0.06] transition-colors"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Replace with</label>
                <input
                  value={findReplace.replace}
                  onChange={(e) => setFindReplace({ ...findReplace, replace: e.target.value })}
                  placeholder="Enter replacement text…"
                  className="w-full h-10 px-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500/50 focus:bg-white/[0.06] transition-colors"
                  onKeyDown={(e) => e.key === 'Enter' && doFindReplace()}
                />
              </div>
              <button
                onClick={doFindReplace}
                disabled={!findReplace.find}
                className="w-full h-10 rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 transition-all"
              >
                Replace All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────── Jump to Line modal ───────────────────── */}
      {jumpLine !== null && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setJumpLine(null)} />
          <div className="relative bg-[#181a23] w-full max-w-xs rounded-2xl shadow-2xl ring-1 ring-white/[0.08] overflow-hidden">
            <div className="flex items-center justify-between px-5 h-12 border-b border-white/[0.06]">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Eye className="w-4 h-4 text-amber-400" /> Jump to Line
              </h3>
              <button onClick={() => setJumpLine(null)} className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:bg-white/[0.06] hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Line Number <span className="text-slate-600 normal-case font-normal">(1–{lines.length})</span>
              </label>
              <input
                value={jumpLine}
                onChange={(e) => setJumpLine(e.target.value.replace(/\D/g, ''))}
                placeholder={`e.g. 42`}
                className="w-full h-10 px-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500/50 focus:bg-white/[0.06] transition-colors"
                inputMode="numeric"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && doJumpToLine()}
              />
              <button
                onClick={doJumpToLine}
                disabled={!jumpLine}
                className="w-full h-10 mt-3 rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 transition-all"
              >
                Jump to Line
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────── Tab bar ───────────────────── */}
      <div className="flex bg-[#13151c] border-b border-white/[0.06] overflow-x-auto no-scrollbar shrink-0">
        {files.map((f) => {
          const isActive = f.id === activeId
          const fname = f.path.split('/').pop()
          return (
            <div
              key={f.id}
              onClick={() => selectFile(f.id)}
              className={`group flex items-center gap-2 pl-4 pr-2 py-2.5 cursor-pointer border-r border-white/[0.04] whitespace-nowrap transition-colors ${
                isActive
                  ? 'bg-[#0c0d12] text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]'
              }`}
            >
              <span className={`absolute top-0 left-0 right-0 h-[2px] ${isActive ? 'bg-violet-500' : 'bg-transparent'}`} style={{ position: 'relative' }} />
              <FileIcon lang={f.language} className="w-3.5 h-3.5 shrink-0" />
              <span className="text-[13px] font-medium">{fname}</span>
              {dirty.has(f.id) ? (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    if (dirty.has(f.id)) {
                      showToast('Save or discard changes first')
                      return
                    }
                    const next = files.find((x) => x.id !== f.id)
                    setActiveId(next?.id || null)
                  }}
                  className="w-4 h-4 rounded flex items-center justify-center text-slate-500 opacity-0 group-hover:opacity-100 hover:bg-white/[0.1] hover:text-white transition-all shrink-0"
                  aria-label="Close tab"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* ───────────────────── Code area ───────────────────── */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Gutter */}
        <div
          ref={gutterRef}
          className="w-12 shrink-0 overflow-hidden bg-[#0c0d12] text-right select-none"
          style={{ borderRight: '1px solid rgba(255,255,255,0.04)', paddingTop: '14px' }}
        >
          {lines.map((_, i) => {
            const isCurrent = i + 1 === cursor.ln
            return (
              <div
                key={i}
                style={{
                  fontSize: `${fontSize}px`,
                  lineHeight: `${Math.round(fontSize * 1.5)}px`,
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                }}
                className={`pr-3 transition-colors ${isCurrent ? 'text-slate-300 font-semibold' : 'text-slate-600'}`}
              >
                {i + 1}
              </div>
            )
          })}
        </div>

        {/* Code */}
        <div className="flex-1 relative overflow-hidden bg-[#0c0d12]">
          <pre
            ref={preRef}
            aria-hidden
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
              fontSize: `${fontSize}px`,
              lineHeight: `${Math.round(fontSize * 1.5)}px`,
              padding: '14px',
              margin: '0',
              color: '#cbd5e1',
              whiteSpace: wordWrap ? 'pre-wrap' : 'pre',
              wordBreak: wordWrap ? 'break-all' : 'normal',
              overflow: 'hidden',
              tabSize: '2',
              WebkitTextSizeAdjust: '100%',
              textSizeAdjust: '100%',
            }}
            dangerouslySetInnerHTML={{ __html: highlighted + '\n' }}
          />
          <textarea
            ref={taRef}
            value={content}
            onChange={(e) => {
              const ta = e.target
              selRef.current = { start: ta.selectionStart, end: ta.selectionEnd }
              setContent(ta.value)
              requestAnimationFrame(() => { updateCursor(); syncScroll() })
            }}
            onScroll={syncScroll}
            onInput={syncScroll}
            onKeyUp={() => { rememberSel(); updateCursor(); syncScroll() }}
            onClick={() => { rememberSel(); updateCursor(); syncScroll() }}
            onSelect={() => { rememberSel(); updateCursor(); syncScroll() }}
            onCompositionEnd={() => { rememberSel(); updateCursor(); syncScroll() }}
            onKeyDown={(e) => {
              if (e.key === 'Tab') {
                e.preventDefault()
                insertAtCursor('  ')
              }
              setTimeout(syncScroll, 0)
            }}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            style={{
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
              fontSize: `${fontSize}px`,
              lineHeight: `${Math.round(fontSize * 1.5)}px`,
              padding: '14px',
              margin: '0',
              whiteSpace: wordWrap ? 'pre-wrap' : 'pre',
              wordBreak: wordWrap ? 'break-all' : 'normal',
              overflow: 'auto',
              tabSize: '2',
              WebkitAppearance: 'none',
              WebkitTextSizeAdjust: '100%',
              textSizeAdjust: '100%',
            }}
            className="absolute inset-0 w-full h-full resize-none bg-transparent text-transparent caret-violet-400 focus:outline-none selection:bg-violet-500/30"
          />
        </div>

        {/* Explorer drawer */}
        {showExplorer && (
          <>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-10" onClick={() => setShowExplorer(false)} />
            <div className="absolute left-0 top-0 bottom-0 z-20 w-[80%] max-w-[300px] bg-[#13151c] shadow-2xl flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between px-4 h-12 border-b border-white/[0.06]">
                <span className="text-[10px] font-bold tracking-[0.18em] uppercase text-slate-500">Explorer</span>
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => {
                      setPromptVal('')
                      setPrompt({ title: 'New File', placeholder: 'e.g. res/values/colors.xml', action: (v) => addFile(v) })
                    }}
                    className="w-8 h-8 rounded-md flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
                    aria-label="New file"
                  >
                    <FilePlus2 className="w-[18px] h-[18px]" />
                  </button>
                  <button
                    onClick={() => {
                      setPromptVal('')
                      setPrompt({
                        title: 'New Folder + File',
                        placeholder: 'e.g. res/layout/activity_main.xml',
                        action: (v) => addFile(v),
                      })
                    }}
                    className="w-8 h-8 rounded-md flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
                    aria-label="New folder"
                  >
                    <FolderPlus className="w-[18px] h-[18px]" />
                  </button>
                  <label className="w-8 h-8 rounded-md flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer" aria-label="Upload file">
                    <Upload className="w-[18px] h-[18px]" />
                    <input type="file" multiple accept=".kt,.java,.xml,.html,.htm,.css,.js,.json,.txt,.md" className="hidden" onChange={uploadFiles} />
                  </label>
                </div>
              </div>
              {/* Project name header */}
              <div className="px-3 py-3 border-b border-white/[0.04]">
                <div className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-white/[0.04] transition-colors">
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                  <Folder className="w-4 h-4 text-amber-400/80" />
                  <span className="text-white font-semibold text-[13px] flex-1 truncate">{currentProject.name}</span>
                  <span className="text-[10px] text-slate-600 font-medium">{files.length} files</span>
                </div>
              </div>
              {/* File tree */}
              <div className="px-2 py-2 overflow-y-auto flex-1">
                {tree.children.map((c) => (
                  <TreeItem
                    key={c.path}
                    node={c}
                    depth={1}
                    activeId={activeId}
                    dirty={dirty}
                    onSelect={(id) => {
                      selectFile(id)
                      if (window.innerWidth < 640) setShowExplorer(false)
                    }}
                    onDelete={deleteFile}
                    expanded={expanded}
                    toggleDir={(p) =>
                      setExpanded((s) => {
                        const n = new Set(s)
                        if (n.has(p)) n.delete(p)
                        else n.add(p)
                        return n
                      })
                    }
                  />
                ))}
                {files.length === 0 && (
                  <div className="px-3 py-8 text-center">
                    <FileText className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                    <p className="text-slate-600 text-xs">No files yet</p>
                    <button
                      onClick={() => {
                        setPromptVal('')
                        setPrompt({ title: 'New File', placeholder: 'e.g. index.html', action: (v) => addFile(v) })
                      }}
                      className="mt-2 text-violet-400 text-xs font-semibold hover:text-violet-300"
                    >
                      Create your first file →
                    </button>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ───────────────────── Shortcut bar ───────────────────── */}
      <div className="flex gap-1 px-2 py-1.5 bg-[#13151c] border-t border-white/[0.06] overflow-x-auto no-scrollbar shrink-0">
        {[
          { k: 'Tab', v: '  ' }, { k: '<', v: '<' }, { k: '>', v: '>' }, { k: '/', v: '/' },
          { k: '"', v: '"' }, { k: "'", v: "'" }, { k: '=', v: '=' }, { k: '{', v: '{' },
          { k: '}', v: '}' }, { k: '(', v: '(' }, { k: ')', v: ')' }, { k: ';', v: ';' },
        ].map((item) => (
          <button
            key={item.k}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => insertAtCursor(item.v)}
            className="min-w-[36px] h-8 rounded-md bg-white/[0.03] text-slate-300 text-xs font-mono font-semibold hover:bg-white/[0.08] hover:text-white active:scale-95 transition-all shrink-0 px-2"
          >
            {item.k}
          </button>
        ))}
      </div>

      {/* ───────────────────── Status bar ───────────────────── */}
      <div className="flex items-center gap-3 px-3 h-7 bg-[#0a0b10] text-slate-400 text-[11px] font-medium shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="text-slate-300">Ln {cursor.ln}, Col {cursor.col}</span>
        </div>
        <span className="text-slate-700">|</span>
        <span className="uppercase text-violet-400/80">{langLabel[active?.language || 'plaintext'] || 'Text'}</span>
        <span className="text-slate-700">|</span>
        <span className="hidden sm:inline">UTF-8</span>
        <span className="hidden sm:inline text-slate-700">|</span>
        <span className="hidden sm:inline">Spaces: 2</span>
        <span className="hidden sm:inline text-slate-700">|</span>
        <span className="hidden sm:inline">{content.length} chars</span>
        <div className="flex-1" />
        <span className="text-slate-500 truncate max-w-[120px] sm:max-w-none">{currentProject.name}</span>
        {dirtyCount > 0 && (
          <>
            <span className="text-slate-700">|</span>
            <span className="text-amber-400 font-semibold">{dirtyCount} unsaved</span>
          </>
        )}
      </div>

      {/* ───────────────────── Preview modal ───────────────────── */}
      {preview !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setPreview(null)} />
          <div className="relative bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl ring-1 ring-black/10">
            <div className="flex items-center justify-between px-4 h-11 bg-slate-50 border-b border-slate-200">
              <span className="font-bold text-sm text-slate-700 flex items-center gap-2">
                <Play className="w-4 h-4 text-violet-600 fill-violet-600" /> Live Preview — {currentProject.name}
              </span>
              <button onClick={() => setPreview(null)} className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:border-slate-300 transition-colors" aria-label="Close preview">
                <X className="w-4 h-4" />
              </button>
            </div>
            <iframe title="preview" srcDoc={preview} className="w-full h-[70dvh] bg-white border-0" sandbox="allow-scripts" />
          </div>
        </div>
      )}

      {/* ───────────────────── Prompt modal ───────────────────── */}
      {prompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setPrompt(null)} />
          <div className="relative bg-[#181a23] rounded-2xl w-full max-w-sm p-5 shadow-2xl ring-1 ring-white/[0.08]">
            <h3 className="font-bold text-white text-base mb-1">{prompt.title}</h3>
            <p className="text-slate-500 text-xs mb-4">Enter the path for your new file</p>
            <Input
              autoFocus
              value={promptVal}
              onChange={(e) => setPromptVal(e.target.value)}
              placeholder={prompt.placeholder}
              className="h-11 rounded-lg bg-white/[0.04] border-white/[0.08] text-white placeholder:text-slate-500 focus:border-violet-500/50"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && promptVal.trim()) {
                  prompt.action(promptVal)
                  setPrompt(null)
                }
              }}
            />
            <div className="flex gap-2 mt-4">
              <Button variant="ghost" onClick={() => setPrompt(null)} className="flex-1 rounded-lg text-slate-300 hover:bg-white/[0.05] hover:text-white">
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (promptVal.trim()) {
                    prompt.action(promptVal)
                    setPrompt(null)
                  }
                }}
                className="flex-1 rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600 hover:brightness-110 text-white border-0"
              >
                Create
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

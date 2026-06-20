'use client'

// 10B redesign — MY LIBRARY (upgraded).
//
// A teacher's personal home for EVERYTHING they created — drafts, lessons
// already assigned to a course, and published lessons/templates — organised in
// their OWN nested folders. Replaces the drafts-only view.
//
// Sources lessons from /api/lessons?include_all=true (passed in via props),
// filtered to created_by === me. Folders are personal (list-folders&mine=true)
// and the per-lesson folder membership rides along on each lesson's folder_ids.
//
// Presentational w.r.t. lessons (data in via props), but self-fetches the
// teacher's courses (GET /api/admin?action=my-courses) for the assign picker +
// the "In: <course>" labels. Folder data + handlers come from props (the page
// owns the fetches so it can refresh after mutations).

import { useEffect, useMemo, useState } from 'react'
import { Button, Card, Pill, Skeleton, EmptyState, Spinner, TextField, SegmentedControl } from '@/components/student-ui'
import FolderTree, { getFolderDepth, type Folder } from '@/components/admin-v2/FolderTree'
import { CEFR_OPTIONS, type Lesson } from '@/lib/lesson-editor/types'
import { COURSE_CATEGORIES } from '@/lib/common-issues'

// Minimal shape we need off the my-courses payload (it returns more fields).
interface CourseLite {
  id: string
  name: string
}

type StatusFilter = 'all' | 'draft' | 'assigned' | 'published'

// Lesson-type filter options (lesson.lesson_type values). 'all' = no filter.
const LESSON_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'lesson', label: 'Lesson' },
  { value: 'mid_course_test', label: 'Mid-Course Test' },
  { value: 'final_test', label: 'Final Test' },
  { value: 'review_test', label: 'Review Test' },
]

// Sentinel course-filter value for lessons with no course_id.
const COURSE_UNASSIGNED = '__unassigned__'

// What each lesson IS, for the status/location pill.
type ItemKind = 'draft' | 'assigned' | 'published'

function classifyLesson(l: Lesson): ItemKind {
  if (l.status === 'published') return 'published'
  if (l.course_id) return 'assigned'
  return 'draft'
}

// Verbatim date formatting from legacy formatDate.
function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function blockTotal(counts: Record<string, number> | undefined): number {
  if (!counts) return 0
  return Object.values(counts).reduce((a, b) => a + b, 0)
}

function Count({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center">
      <p className="text-sm font-bold text-sky-text leading-none">{value}</p>
      <p className="text-[10px] text-ink-muted mt-0.5">{label}</p>
    </div>
  )
}

export interface MyLibraryFolderHandlers {
  folders: Folder[]
  onCreateFolder: (name: string, parentId: string | null) => Promise<boolean>
  onRenameFolder: (folderId: string, name: string) => Promise<boolean>
  onDeleteFolder: (folderId: string) => Promise<boolean>
  onAssignToFolder: (lessonId: string, folderId: string) => Promise<boolean>
  onRemoveFromFolder: (lessonId: string, folderId: string) => Promise<boolean>
}

export default function MyLibraryView({
  lessons,
  loading,
  currentUserEmail,
  onOpenLesson,
  onNewLesson,
  onAssign,
  onShareToSchool,
  onUnshareFromSchool,
  onOpenSchoolLibrary,
  folderApi,
}: {
  lessons: Lesson[]
  loading: boolean
  currentUserEmail: string
  onOpenLesson: (id: string) => void
  onNewLesson: () => void
  onAssign: (lessonId: string, courseId: string) => Promise<{ ok: boolean; error?: string }>
  onShareToSchool: (lessonId: string) => Promise<{ ok: boolean; error?: string }>
  onUnshareFromSchool: (lessonId: string) => Promise<{ ok: boolean; error?: string }>
  onOpenSchoolLibrary: () => void
  folderApi: MyLibraryFolderHandlers
}) {
  // ── Self-fetched courses (for the assign picker + name mapping) ──
  const [courses, setCourses] = useState<CourseLite[]>([])
  const [coursesLoading, setCoursesLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/admin?action=my-courses')
        const data = await res.json()
        if (!cancelled) setCourses(data.courses || [])
      } catch {
        /* swallow — picker just shows no courses */
      } finally {
        if (!cancelled) setCoursesLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // course_id -> name lookup (for the "In: <course>" label + toast).
  const courseNameById = useMemo(() => {
    const map: Record<string, string> = {}
    for (const c of courses) map[c.id] = c.name
    return map
  }, [courses])

  // ── ALL my content ── mine, most-recent first. No status/type filtering here.
  const myLessons = useMemo(() => {
    return lessons
      .filter((l) => !!l.created_by && l.created_by === currentUserEmail)
      .slice()
      .sort((a, b) => {
        const ta = new Date(a.updated_at || a.lesson_date || 0).getTime()
        const tb = new Date(b.updated_at || b.lesson_date || 0).getTime()
        return tb - ta
      })
  }, [lessons, currentUserEmail])

  // ── Search + status filter (client-side over myLessons) ──
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  // ── Content filters (client-side over myLessons). '' = "All …". ──
  const [levelFilter, setLevelFilter] = useState('')
  const [courseFilter, setCourseFilter] = useState('')
  const [lessonTypeFilter, setLessonTypeFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')

  // ── Folder selection ──
  // null  = All content; '__unfiled__' = lessons in no folder; else folder id.
  const UNFILED = '__unfiled__'
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())

  const folders = folderApi.folders

  // Exact per-teacher folder counts, derived from MY lessons' folder_ids
  // (template_count from the API counts every teacher's links, so we ignore it).
  const itemCountById = useMemo(() => {
    const map: Record<string, number> = {}
    for (const l of myLessons) {
      for (const fid of l.folder_ids || []) {
        map[fid] = (map[fid] || 0) + 1
      }
    }
    return map
  }, [myLessons])

  const unfiledCount = useMemo(
    () => myLessons.filter((l) => (l.folder_ids || []).length === 0).length,
    [myLessons],
  )

  // ── Apply folder + status + search to produce the visible list ──
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return myLessons.filter((l) => {
      // Folder
      if (selectedFolderId === UNFILED) {
        if ((l.folder_ids || []).length > 0) return false
      } else if (selectedFolderId) {
        if (!(l.folder_ids || []).includes(selectedFolderId)) return false
      }
      // Status
      if (statusFilter !== 'all' && classifyLesson(l) !== statusFilter) return false
      // Level (CEFR) — matches lesson.template_level
      if (levelFilter && l.template_level !== levelFilter) return false
      // Course — matches lesson.course_id ('' = all, sentinel = no course)
      if (courseFilter === COURSE_UNASSIGNED) {
        if (l.course_id) return false
      } else if (courseFilter) {
        if (l.course_id !== courseFilter) return false
      }
      // Lesson type — matches lesson.lesson_type
      if (lessonTypeFilter && l.lesson_type !== lessonTypeFilter) return false
      // Category (IELTS/GE/BE/ESP/Other) — matches lesson.template_category
      if (categoryFilter && l.template_category !== categoryFilter) return false
      // Search (title)
      if (q && !(l.title || '').toLowerCase().includes(q)) return false
      return true
    })
  }, [myLessons, selectedFolderId, statusFilter, levelFilter, courseFilter, lessonTypeFilter, categoryFilter, search])

  // ── Optimistic share state ── lessonId -> is_shared override, applied on top
  // of lesson.is_shared so the pill + action flip instantly before props refresh.
  const [sharedOverride, setSharedOverride] = useState<Record<string, boolean>>({})

  // ── Transient toast ──
  const [toast, setToast] = useState<string | null>(null)
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(t)
  }, [toast])

  // ── Folder mutation modal state ──
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [newFolderParentId, setNewFolderParentId] = useState<string | null>(null)
  const [renamingFolder, setRenamingFolder] = useState<Folder | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [confirmDeleteFolder, setConfirmDeleteFolder] = useState<Folder | null>(null)
  // Lesson currently picking a folder via the "Move to folder" control.
  const [movingLesson, setMovingLesson] = useState<Lesson | null>(null)

  const toggleExpand = (id: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(Array.from(prev))
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleCreateFolder = async () => {
    const name = newFolderName.trim()
    if (!name) return
    const ok = await folderApi.onCreateFolder(name, newFolderParentId)
    if (ok) {
      setToast('Folder created')
      if (newFolderParentId) {
        setExpandedFolders((prev) => new Set([...Array.from(prev), newFolderParentId]))
      }
      setNewFolderName('')
      setShowNewFolder(false)
      setNewFolderParentId(null)
    } else {
      setToast('Could not create folder')
    }
  }

  const handleRenameFolder = async () => {
    if (!renamingFolder || !renameValue.trim()) return
    const ok = await folderApi.onRenameFolder(renamingFolder.id, renameValue.trim())
    setToast(ok ? 'Folder renamed' : 'Could not rename folder')
    if (ok) {
      setRenamingFolder(null)
      setRenameValue('')
    }
  }

  const handleDeleteFolder = async (folder: Folder) => {
    const ok = await folderApi.onDeleteFolder(folder.id)
    if (ok) {
      if (selectedFolderId === folder.id) setSelectedFolderId(null)
      setConfirmDeleteFolder(null)
      setToast('Folder deleted')
    } else {
      setToast('Could not delete folder')
    }
  }

  const selectedFolderName =
    selectedFolderId && selectedFolderId !== UNFILED
      ? folders.find((f) => f.id === selectedFolderId)?.name || 'Folder'
      : selectedFolderId === UNFILED
        ? 'Unfiled'
        : null

  return (
    <div className="font-rubik min-h-screen bg-surface px-4 py-6">
      <div className="max-w-6xl mx-auto">
        {/* ── Header + prominent School Library ── */}
        <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
          <div>
            <h1 className="text-2xl font-bold text-brandblue mb-1">My Library</h1>
            <p className="text-sm text-ink-muted">
              Everything you&rsquo;ve created — drafts, assigned lessons and published — in your own folders.
            </p>
          </div>
          <button
            onClick={onOpenSchoolLibrary}
            className="group flex items-center gap-3 bg-sky text-white rounded-card px-4 py-3 shadow-sm hover:bg-[#0099d6] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky/40"
          >
            <span className="text-xl leading-none" aria-hidden="true">🏫</span>
            <span className="text-left">
              <span className="block text-sm font-extrabold leading-tight">School Library</span>
              <span className="block text-[11px] font-medium text-white/85 leading-tight">
                Browse shared templates →
              </span>
            </span>
          </button>
        </div>

        {/* ── Create row ── */}
        <div className="mb-5">
          <Button variant="primary" size="md" onClick={onNewLesson}>
            ＋ New Lesson
          </Button>
        </div>

        {/* ── Search + status + content filters (sky-wash strip) ── */}
        {myLessons.length > 0 && (
          <div className="bg-sky-wash border border-sky-border rounded-card p-3 mb-5 flex flex-col gap-3">
            {/* Row 1: search + status */}
            <div className="flex flex-wrap items-end gap-3">
              <TextField
                label="Search"
                placeholder="Search by title…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 min-w-[200px]"
              />
              <div className="pb-0.5">
                <SegmentedControl<StatusFilter>
                  segments={[
                    { value: 'all', label: 'All' },
                    { value: 'draft', label: 'Drafts' },
                    { value: 'assigned', label: 'Assigned' },
                    { value: 'published', label: 'Published' },
                  ]}
                  value={statusFilter}
                  onChange={setStatusFilter}
                />
              </div>
            </div>
            {/* Row 2: compact dropdown filters */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value)}
                aria-label="Filter by level"
                className="text-[13px] font-medium text-ink-body bg-white rounded-tile border-[1.5px] border-[#e3e5e9] px-2.5 py-1.5 focus:outline-none focus:border-sky transition-colors"
              >
                <option value="">All levels</option>
                {CEFR_OPTIONS.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl}
                  </option>
                ))}
              </select>
              <select
                value={courseFilter}
                onChange={(e) => setCourseFilter(e.target.value)}
                aria-label="Filter by course"
                className="text-[13px] font-medium text-ink-body bg-white rounded-tile border-[1.5px] border-[#e3e5e9] px-2.5 py-1.5 max-w-[180px] focus:outline-none focus:border-sky transition-colors"
              >
                <option value="">All courses</option>
                <option value={COURSE_UNASSIGNED}>Unassigned</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select
                value={lessonTypeFilter}
                onChange={(e) => setLessonTypeFilter(e.target.value)}
                aria-label="Filter by lesson type"
                className="text-[13px] font-medium text-ink-body bg-white rounded-tile border-[1.5px] border-[#e3e5e9] px-2.5 py-1.5 focus:outline-none focus:border-sky transition-colors"
              >
                <option value="">All types</option>
                {LESSON_TYPE_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                aria-label="Filter by category"
                className="text-[13px] font-medium text-ink-body bg-white rounded-tile border-[1.5px] border-[#e3e5e9] px-2.5 py-1.5 max-w-[200px] focus:outline-none focus:border-sky transition-colors"
              >
                <option value="">All categories</option>
                {COURSE_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* ── Two-column: folders + content ── */}
        <div className="flex flex-col lg:flex-row gap-4">
          {/* ── Folders panel ── */}
          <div className="lg:w-56 shrink-0">
            <Card padding="sm">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-[11px] font-extrabold uppercase tracking-eyebrow text-ink-muted">
                  My Folders
                </h2>
                <button
                  onClick={() => {
                    setShowNewFolder(true)
                    setNewFolderParentId(null)
                    setNewFolderName('')
                  }}
                  className="text-xs text-sky-text hover:underline font-bold"
                >
                  + New
                </button>
              </div>

              {/* New folder input */}
              {showNewFolder && (
                <div className="mb-3">
                  <input
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateFolder()
                      if (e.key === 'Escape') {
                        setShowNewFolder(false)
                        setNewFolderName('')
                        setNewFolderParentId(null)
                      }
                    }}
                    placeholder={newFolderParentId ? 'Subfolder name…' : 'Folder name…'}
                    className="w-full px-2 py-1.5 border-[1.5px] border-[#e3e5e9] rounded-tile text-xs mb-1 focus:outline-none focus:border-sky"
                    autoFocus
                  />
                  <div className="flex gap-1">
                    <button
                      onClick={handleCreateFolder}
                      disabled={!newFolderName.trim()}
                      className="px-2 py-1 bg-sky text-white text-xs font-extrabold rounded-tile disabled:opacity-50 hover:bg-[#0099d6] transition-colors"
                    >
                      Create
                    </button>
                    <button
                      onClick={() => {
                        setShowNewFolder(false)
                        setNewFolderName('')
                        setNewFolderParentId(null)
                      }}
                      className="px-2 py-1 text-xs text-ink-muted hover:text-ink-body"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* All content */}
              <button
                onClick={() => setSelectedFolderId(null)}
                className={`w-full flex items-center justify-between text-left px-2 py-1.5 rounded-tile text-sm mb-0.5 transition-colors ${
                  selectedFolderId === null
                    ? 'bg-sky-wash text-sky-text font-semibold'
                    : 'text-ink-body hover:bg-surface'
                }`}
              >
                <span>All content</span>
                {myLessons.length > 0 && (
                  <span className="text-xs text-ink-muted">{myLessons.length}</span>
                )}
              </button>

              {/* Folder tree */}
              <FolderTree
                folders={folders}
                parentId={null}
                selectedFolderId={selectedFolderId}
                expandedFolders={expandedFolders}
                onSelectFolder={(id) => setSelectedFolderId(id)}
                onToggleExpand={toggleExpand}
                onCreateSubfolder={(parentId) => {
                  setNewFolderParentId(parentId)
                  setShowNewFolder(true)
                  setNewFolderName('')
                  setExpandedFolders((prev) => new Set([...Array.from(prev), parentId]))
                }}
                onRenameFolder={(f) => {
                  setRenamingFolder(f)
                  setRenameValue(f.name)
                }}
                onDeleteFolder={(f) => setConfirmDeleteFolder(f)}
                itemCountById={itemCountById}
              />

              {/* Unfiled */}
              {unfiledCount > 0 && (
                <button
                  onClick={() => setSelectedFolderId(UNFILED)}
                  className={`w-full flex items-center justify-between text-left px-2 py-1.5 rounded-tile text-sm mt-0.5 transition-colors ${
                    selectedFolderId === UNFILED
                      ? 'bg-sky-wash text-sky-text font-semibold'
                      : 'text-ink-muted hover:bg-surface'
                  }`}
                >
                  <span>Unfiled</span>
                  <span className="text-xs text-ink-muted">{unfiledCount}</span>
                </button>
              )}

              {folders.length === 0 && !showNewFolder && (
                <p className="text-xs text-ink-muted mt-2 px-2">
                  No folders yet. Create one to organise your content.
                </p>
              )}
            </Card>
          </div>

          {/* ── Content list ── */}
          <div className="flex-1 min-w-0">
            {/* Active context label + count */}
            <div className="flex items-baseline justify-between gap-3 mb-3">
              <h2 className="text-[11px] font-extrabold uppercase tracking-eyebrow text-ink-muted">
                {selectedFolderName || 'All content'}
              </h2>
              {!loading && (
                <span className="text-xs font-normal text-ink-muted">
                  {visible.length} item{visible.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {loading ? (
              <div className="grid sm:grid-cols-2 gap-3">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="bg-white rounded-card border border-hairline p-4">
                    <Skeleton className="h-4 w-40 mb-2" />
                    <Skeleton className="h-3 w-24 mb-4" />
                    <Skeleton className="h-7 w-full" />
                  </div>
                ))}
              </div>
            ) : visible.length === 0 ? (
              <div className="bg-white rounded-card border border-hairline">
                <EmptyState
                  icon={myLessons.length === 0 ? '📝' : '🔍'}
                  title={myLessons.length === 0 ? 'No content yet' : 'Nothing matches'}
                  hint={
                    myLessons.length === 0
                      ? 'Click ＋ New Lesson to start your first one.'
                      : 'Try clearing the search, filters or folder.'
                  }
                />
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {visible.map((lesson) => {
                  const isShared =
                    lesson.id in sharedOverride ? sharedOverride[lesson.id] : !!lesson.is_shared
                  return (
                    <ContentCard
                      key={lesson.id}
                      lesson={lesson}
                      kind={classifyLesson(lesson)}
                      courseName={lesson.course_id ? courseNameById[lesson.course_id] : undefined}
                      courses={courses}
                      coursesLoading={coursesLoading}
                      isShared={isShared}
                      onOpenLesson={onOpenLesson}
                      onMove={() => setMovingLesson(lesson)}
                      onAssign={async (courseId) => {
                        const res = await onAssign(lesson.id, courseId)
                        if (res.ok) {
                          setToast(`Assigned to ${courseNameById[courseId] || 'course'}`)
                        }
                        return res
                      }}
                      onShare={async () => {
                        // Optimistic flip, then reconcile/revert on the result.
                        setSharedOverride((prev) => ({ ...prev, [lesson.id]: true }))
                        const res = await onShareToSchool(lesson.id)
                        if (res.ok) {
                          setToast('Shared to School Library')
                        } else {
                          setSharedOverride((prev) => ({ ...prev, [lesson.id]: false }))
                          setToast(res.error || 'Could not share')
                        }
                        return res
                      }}
                      onUnshare={async () => {
                        setSharedOverride((prev) => ({ ...prev, [lesson.id]: false }))
                        const res = await onUnshareFromSchool(lesson.id)
                        if (res.ok) {
                          setToast('Removed from School Library')
                        } else {
                          setSharedOverride((prev) => ({ ...prev, [lesson.id]: true }))
                          setToast(res.error || 'Could not unshare')
                        }
                        return res
                      }}
                    />
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Rename folder modal ── */}
      {renamingFolder && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-sm shadow-xl">
            <h3 className="font-bold text-ink-black mb-3">Rename Folder</h3>
            <input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRenameFolder()}
              className="w-full px-3 py-2 text-sm text-ink-body bg-white border-[1.5px] border-[#e3e5e9] rounded-tile focus:outline-none focus:border-sky mb-4"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <Button
                variant="neutral"
                size="sm"
                onClick={() => {
                  setRenamingFolder(null)
                  setRenameValue('')
                }}
              >
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleRenameFolder} disabled={!renameValue.trim()}>
                Rename
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ── Delete folder confirmation ── */}
      {confirmDeleteFolder && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-sm shadow-xl">
            <h3 className="font-bold text-ink-black mb-2">Delete Folder?</h3>
            <p className="text-xs text-ink-muted mb-4">
              &ldquo;{confirmDeleteFolder.name}&rdquo; and all its subfolders will be deleted. Your lessons are not
              deleted — they&rsquo;re just unfiled.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="neutral" size="sm" onClick={() => setConfirmDeleteFolder(null)}>
                Cancel
              </Button>
              <button
                onClick={() => handleDeleteFolder(confirmDeleteFolder)}
                className="px-4 py-2 bg-incorrect-fg text-white text-xs font-extrabold rounded-tile hover:brightness-95 transition-all"
              >
                Delete
              </button>
            </div>
          </Card>
        </div>
      )}

      {/* ── Move to folder modal ── */}
      {movingLesson && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-sm shadow-xl">
            <h3 className="font-bold text-ink-black mb-1">Move to Folder</h3>
            <p className="text-xs text-ink-muted mb-4">
              Choose folders for &ldquo;{movingLesson.title || 'Untitled lesson'}&rdquo;. Tap to add or remove.
            </p>
            {folders.length === 0 ? (
              <p className="text-xs text-ink-muted mb-4">No folders yet. Create one first.</p>
            ) : (
              <div className="max-h-60 overflow-y-auto mb-4 border border-hairline rounded-tile">
                {folders.map((f) => {
                  const inFolder = (movingLesson.folder_ids || []).includes(f.id)
                  return (
                    <button
                      key={f.id}
                      onClick={async () => {
                        const ok = inFolder
                          ? await folderApi.onRemoveFromFolder(movingLesson.id, f.id)
                          : await folderApi.onAssignToFolder(movingLesson.id, f.id)
                        if (ok) {
                          // Optimistically update the open modal's lesson so the
                          // tick toggles instantly; props refresh shortly after.
                          setMovingLesson((prev) => {
                            if (!prev) return prev
                            const current = prev.folder_ids || []
                            return {
                              ...prev,
                              folder_ids: inFolder
                                ? current.filter((id) => id !== f.id)
                                : [...current, f.id],
                            }
                          })
                          setToast(inFolder ? 'Removed from folder' : 'Added to folder')
                        } else {
                          setToast('Could not update folder')
                        }
                      }}
                      className="w-full flex items-center justify-between text-left px-3 py-2 text-sm text-ink-body hover:bg-sky-wash transition-colors border-b border-hairline last:border-b-0"
                    >
                      <span style={{ paddingLeft: `${getFolderDepth(folders, f.id) * 16}px` }}>{f.name}</span>
                      {inFolder && <span className="text-sky-text font-bold shrink-0">✓</span>}
                    </button>
                  )
                })}
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="neutral" size="sm" onClick={() => setMovingLesson(null)}>
                Done
              </Button>
            </div>
          </Card>
        </div>
      )}

      {toast && (
        <div
          role="status"
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-ink-black text-white text-sm font-bold px-4 py-2.5 rounded-tile shadow-lg font-rubik"
        >
          {toast}
        </div>
      )}
    </div>
  )
}

// ── Content card ─────────────────────────────────────────────────────────────
// Clickable body opens the lesson. A status/location pill labels it Draft /
// In: <course> / Published. A "Move to folder" control sits in the footer. Only
// UNASSIGNED DRAFTS get the inline "Assign to course" picker; assigned/published
// items just show their label.
function ContentCard({
  lesson,
  kind,
  courseName,
  courses,
  coursesLoading,
  isShared,
  onOpenLesson,
  onMove,
  onAssign,
  onShare,
  onUnshare,
}: {
  lesson: Lesson
  kind: ItemKind
  courseName?: string
  courses: CourseLite[]
  coursesLoading: boolean
  isShared: boolean
  onOpenLesson: (id: string) => void
  onMove: () => void
  onAssign: (courseId: string) => Promise<{ ok: boolean; error?: string }>
  onShare: () => Promise<{ ok: boolean; error?: string }>
  onUnshare: () => Promise<{ ok: boolean; error?: string }>
}) {
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const blocks = blockTotal(lesson.block_counts)
  const canAssign = kind === 'draft' && !lesson.is_template

  const handleAssign = async () => {
    if (!selectedCourseId || assigning) return
    setAssigning(true)
    setError(null)
    const res = await onAssign(selectedCourseId)
    if (!res.ok) {
      setError(res.error || 'Failed to assign')
      setAssigning(false)
    }
    // On ok the parent refreshes and the card re-labels itself "In: <course>".
  }

  const handleShareToggle = async () => {
    if (sharing) return
    setSharing(true)
    if (isShared) await onUnshare()
    else await onShare()
    setSharing(false)
  }

  // The status/location pill.
  const label =
    kind === 'published'
      ? { text: 'Published', variant: 'status' as const }
      : kind === 'assigned'
        ? { text: `In: ${courseName || 'course'}`, variant: 'level' as const }
        : { text: 'Draft', variant: 'wash' as const }

  return (
    <div className="bg-white rounded-card border border-hairline flex flex-col">
      {/* Clickable body — opens the lesson */}
      <button
        onClick={() => onOpenLesson(lesson.id)}
        className="text-left p-4 flex flex-col gap-2 hover:bg-surface/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky/40 rounded-t-card"
      >
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-bold text-ink-black leading-snug line-clamp-2">
            {lesson.title || 'Untitled lesson'}
          </p>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <Pill variant={label.variant} className="whitespace-nowrap max-w-[140px] truncate">
              {label.text}
            </Pill>
            {isShared && (
              <Pill variant="status" className="whitespace-nowrap">
                🏫 Shared
              </Pill>
            )}
          </div>
        </div>
        <span className="text-xs text-ink-muted">{formatDate(lesson.lesson_date)}</span>
        <div className="flex items-center gap-5 pt-2.5 border-t border-hairline">
          <Count value={lesson.flashcard_count || 0} label="vocab" />
          <Count value={lesson.exercise_count || 0} label="exercises" />
          {blocks > 0 && <Count value={blocks} label="blocks" />}
        </div>
      </button>

      {/* Footer: move-to-folder + (drafts only) assign-to-course */}
      <div className="px-4 pb-4 pt-3 border-t border-hairline flex flex-col gap-2">
        {canAssign && (
          <div className="flex items-center gap-2">
            <select
              value={selectedCourseId}
              onChange={(e) => {
                setSelectedCourseId(e.target.value)
                setError(null)
              }}
              disabled={coursesLoading || assigning}
              aria-label="Assign to course"
              className="flex-1 min-w-0 text-[13px] font-medium text-ink-body bg-white rounded-tile border-[1.5px] border-[#e3e5e9] px-3 py-2 focus:outline-none focus:border-sky transition-colors disabled:opacity-60"
            >
              <option value="">Assign to course…</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <Button variant="primary" size="sm" disabled={!selectedCourseId || assigning} onClick={handleAssign}>
              {assigning ? <Spinner size={14} label="Assigning…" /> : 'Assign'}
            </Button>
          </div>
        )}
        {error && (
          <p role="alert" className="text-[12px] font-medium text-incorrect-fg">
            {error}
          </p>
        )}
        <div className="flex items-center gap-4">
          <button
            onClick={onMove}
            className="text-[12px] font-bold text-sky-text hover:underline"
          >
            {(lesson.folder_ids || []).length > 0 ? '🗂 Move to folder' : '🗂 Add to folder'}
          </button>
          <button
            onClick={handleShareToggle}
            disabled={sharing}
            className="text-[12px] font-bold text-sky-text hover:underline disabled:opacity-50"
          >
            {isShared ? '↩ Unshare' : '🏫 Share to School'}
          </button>
        </div>
      </div>
    </div>
  )
}

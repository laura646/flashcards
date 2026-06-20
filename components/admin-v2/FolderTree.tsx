'use client'

// 10B redesign — shared recursive folder tree.
//
// Extracted from app/admin-beta/content-bank/page.tsx so both the Content Bank
// and My Library render folders identically. Fully presentational: the caller
// owns the folder list, selection, expand/collapse state and all mutation
// handlers. Nests on parent_id (subfolders supported).
//
// The badge count is generic (`item_count`) so a caller can feed it lesson
// counts (My Library) or template counts (Content Bank) — whatever it computes.

export interface Folder {
  id: string
  name: string
  parent_id: string | null
  created_by: string
  created_at: string
  // Optional pre-supplied count from the API. My Library overrides this with an
  // exact per-teacher count via itemCountById, so it's not relied upon here.
  template_count?: number
}

export default function FolderTree({
  folders,
  parentId,
  selectedFolderId,
  expandedFolders,
  onSelectFolder,
  onToggleExpand,
  onCreateSubfolder,
  onRenameFolder,
  onDeleteFolder,
  itemCountById,
  depth = 0,
}: {
  folders: Folder[]
  parentId: string | null
  selectedFolderId: string | null
  expandedFolders: Set<string>
  onSelectFolder: (id: string | null) => void
  onToggleExpand: (id: string) => void
  onCreateSubfolder: (parentId: string) => void
  onRenameFolder: (folder: Folder) => void
  onDeleteFolder: (folder: Folder) => void
  // Per-folder count to show as a badge. When omitted, falls back to the
  // folder's template_count (if any).
  itemCountById?: Record<string, number>
  depth?: number
}) {
  const children = folders.filter((f) => f.parent_id === parentId)
  if (children.length === 0) return null

  return (
    <div>
      {children.map((folder) => {
        const hasChildren = folders.some((f) => f.parent_id === folder.id)
        const isExpanded = expandedFolders.has(folder.id)
        const isSelected = selectedFolderId === folder.id
        const count =
          itemCountById?.[folder.id] ?? folder.template_count ?? 0

        return (
          <div key={folder.id}>
            <div
              className={`group flex items-center gap-1 px-2 py-1.5 rounded-tile cursor-pointer text-sm transition-colors ${
                isSelected
                  ? 'bg-sky-wash text-sky-text font-semibold'
                  : 'text-ink-body hover:bg-surface'
              }`}
              style={{ paddingLeft: `${depth * 16 + 8}px` }}
            >
              {/* Expand/collapse arrow */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleExpand(folder.id)
                }}
                className="w-4 h-4 flex items-center justify-center text-ink-muted hover:text-sky-text shrink-0"
                aria-label={hasChildren ? (isExpanded ? 'Collapse' : 'Expand') : undefined}
              >
                {hasChildren ? (isExpanded ? '▾' : '▸') : ''}
              </button>

              {/* Folder name */}
              <button
                onClick={() => onSelectFolder(isSelected ? null : folder.id)}
                className="flex-1 text-left truncate"
              >
                {folder.name}
              </button>

              {/* Count badge */}
              {count > 0 && (
                <span className="text-xs text-ink-muted shrink-0">{count}</span>
              )}

              {/* Context actions (visible on hover) */}
              <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onCreateSubfolder(folder.id)
                  }}
                  className="w-5 h-5 flex items-center justify-center text-ink-muted hover:text-sky-text text-xs"
                  title="Add subfolder"
                >
                  +
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onRenameFolder(folder)
                  }}
                  className="w-5 h-5 flex items-center justify-center text-ink-muted hover:text-sky-text text-xs"
                  title="Rename"
                >
                  &#9998;
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onDeleteFolder(folder)
                  }}
                  className="w-5 h-5 flex items-center justify-center text-ink-muted hover:text-incorrect-fg text-xs"
                  title="Delete"
                >
                  &times;
                </button>
              </div>
            </div>

            {/* Children */}
            {hasChildren && isExpanded && (
              <FolderTree
                folders={folders}
                parentId={folder.id}
                selectedFolderId={selectedFolderId}
                expandedFolders={expandedFolders}
                onSelectFolder={onSelectFolder}
                onToggleExpand={onToggleExpand}
                onCreateSubfolder={onCreateSubfolder}
                onRenameFolder={onRenameFolder}
                onDeleteFolder={onDeleteFolder}
                itemCountById={itemCountById}
                depth={depth + 1}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// Folder depth (for indenting a flat dropdown list of folders).
export function getFolderDepth(folders: Folder[], folderId: string): number {
  let depth = 0
  let current = folders.find((f) => f.id === folderId)
  while (current?.parent_id) {
    depth++
    current = folders.find((f) => f.id === current!.parent_id)
  }
  return depth
}

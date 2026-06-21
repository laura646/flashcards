'use client'

// IELTS Reading — TEACHER authoring editor: placeholder for not-yet-built kinds.
//
// ADDITIVE: not imported by any live file. Used by the stubbed registry entries
// (matching_information, matching_features, matching_sentence_endings,
// summary_completion, table_completion, flow_chart_completion) so the union is
// fully covered and a teacher can still ADD the set (its defaultGroup seeds
// valid data) and see it in the student preview — the bespoke field editor for
// these container-shaped types lands in a later stage.
//
// The group is passed through unchanged (onChange is intentionally unused here).

import type { ReadingQuestionGroup } from '@/lib/ielts/types'
import { EmptyState } from '@/components/student-ui'

export interface ComingSoonGroupEditorProps {
  group: ReadingQuestionGroup
  onChange: (group: ReadingQuestionGroup) => void
}

export default function ComingSoonGroupEditor({ group }: ComingSoonGroupEditorProps) {
  return (
    <EmptyState
      icon="🛠️"
      title="Editor coming soon"
      hint={`This question set (“${group.kind}”) can be added with valid starter data and previewed by the student, but its field-by-field editor is still being built. Use the preview to see it, or edit another set for now.`}
    />
  )
}

// escHtml lives in its own dependency-free module (lib/esc) so API route
// handlers can import it WITHOUT pulling in the isomorphic-dompurify below
// (which crashes serverless route modules at load). Re-exported for compat.
export { escHtml } from './esc'

import DOMPurify from 'isomorphic-dompurify'

// Tags/attributes the Reading passage rich-text editor can emit. Kept tight:
// formatting marks + basic block structure only. <span style="color:…"> backs
// TipTap's text colour; <mark style="background-color:…"> backs Highlight.
const PASSAGE_ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'mark',
  'span',
  'a',
  'h1',
  'h2',
  'h3',
  'ul',
  'ol',
  'li',
  'blockquote',
]
// `style` backs text colour / highlight; `href` backs teacher-inserted links.
// DOMPurify blocks javascript:/data: URIs in href by default; we additionally
// force safe rel/target on links via the hook below.
const PASSAGE_ALLOWED_ATTR = ['style', 'href', 'target', 'rel']

// Harden every surviving <a>: open in a new tab and drop referrer/opener so a
// linked page can't reach back into the app. Registered once at module load.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (
    node.nodeName === 'A' &&
    typeof (node as Element).setAttribute === 'function'
  ) {
    ;(node as Element).setAttribute('target', '_blank')
    ;(node as Element).setAttribute('rel', 'noopener noreferrer nofollow')
  }
})

/**
 * Sanitize the reading-passage HTML stored in ArticleContent.text before it is
 * rendered to students via dangerouslySetInnerHTML. Only the formatting tags the
 * editor produces survive — bold/italic/underline/strike, highlight, inline text
 * colour, basic block structure, and safe links. Everything else (scripts, event
 * handlers, images, javascript: URIs) is stripped. Plain-text passages pass
 * through unchanged (a string with no tags is valid HTML).
 */
export function sanitizeRichText(html: string): string {
  return DOMPurify.sanitize(html ?? '', {
    ALLOWED_TAGS: PASSAGE_ALLOWED_TAGS,
    ALLOWED_ATTR: PASSAGE_ALLOWED_ATTR,
    // Defang any inline event handlers just in case.
    FORBID_ATTR: ['onerror', 'onload', 'onclick'],
  })
}

/**
 * True when a stored passage value contains HTML tags (i.e. it was authored with
 * the rich-text editor). Legacy plain-text passages return false so the renderer
 * can keep their literal line breaks with whitespace-pre-wrap.
 */
export function looksLikeHtml(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value ?? '')
}

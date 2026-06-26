/**
 * Escape HTML special characters to prevent XSS in email templates.
 *
 * Standalone + dependency-free ON PURPOSE: API route handlers import this for
 * email HTML, and must NOT pull in lib/html's isomorphic-dompurify (jsdom),
 * which crashes serverless route modules at load. Keep this file import-free.
 */
export const escHtml = (s: unknown): string =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

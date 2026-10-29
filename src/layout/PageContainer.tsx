import type { HTMLAttributes, ReactNode } from 'react';

/** Content width caps (design system section 4): 1080 px for content, 720 px for forms and long text. */
const WIDTH = {
  content: 'max-w-[calc(1080px_+_2_*_var(--page-gutter))]',
  form: 'max-w-[calc(720px_+_2_*_var(--page-gutter))]',
} as const;

/**
 * The one page frame inside the app shell: left-aligned, the page gutter (20 px phone, 32 px from tablet) on both
 * sides, and the content capped at 1080 px (or 720 px for a form page). Every shell page wraps its content in it,
 * so titles start at the same x on every screen.
 */
export function PageContainer({
  width = 'content',
  className = '',
  children,
  ...rest
}: { width?: keyof typeof WIDTH; className?: string; children: ReactNode } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-page-container={width}
      className={`w-full ${WIDTH[width]} px-[var(--page-gutter)] py-4 sm:py-6 lg:py-8 ${className}`.trim()}
      {...rest}
    >
      {children}
    </div>
  );
}

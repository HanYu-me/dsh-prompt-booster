/**
 * Small line icons (16px grid, `currentColor`, 1.5 stroke) so the plugin
 * reads like DSH's own controls instead of emoji and text glyphs.
 * @module dsh-prompt-boost/client/icons
 */

import type { ReactNode } from 'react'

/** Props of one icon. */
export interface IconProps {
  size?: number
  className?: string
}

/** Shared SVG frame. */
function Svg(props: IconProps & { children: ReactNode; fill?: boolean }): ReactNode {
  const { size = 16, className, children, fill = false } = props
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill={fill ? 'currentColor' : 'none'}
      stroke={fill ? 'none' : 'currentColor'}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}

/** The plugin mark: a four-point sparkle with a small companion. */
export function SparkleIcon(props: IconProps): ReactNode {
  return (
    <Svg {...props} fill>
      <path d="M6.5 1.75c.2 0 .37.14.42.33l.62 2.38a2.9 2.9 0 0 0 2.07 2.07l2.38.62a.44.44 0 0 1 0 .85l-2.38.62a2.9 2.9 0 0 0-2.07 2.07l-.62 2.38a.44.44 0 0 1-.85 0l-.62-2.38a2.9 2.9 0 0 0-2.07-2.07l-2.38-.62a.44.44 0 0 1 0-.85l2.38-.62a2.9 2.9 0 0 0 2.07-2.07l.62-2.38a.44.44 0 0 1 .43-.33Z" />
      <path d="M12.6 1.2c.1 0 .18.07.2.16l.17.66c.08.32.33.57.65.65l.66.17a.21.21 0 0 1 0 .41l-.66.17a.9.9 0 0 0-.65.65l-.17.66a.21.21 0 0 1-.41 0l-.17-.66a.9.9 0 0 0-.65-.65l-.66-.17a.21.21 0 0 1 0-.41l.66-.17a.9.9 0 0 0 .65-.65l.17-.66a.21.21 0 0 1 .2-.16Z" />
    </Svg>
  )
}

/** Indeterminate progress ring (animated by CSS). */
export function SpinnerIcon(props: IconProps): ReactNode {
  return (
    <Svg {...props}>
      <circle cx="8" cy="8" r="5.75" opacity="0.25" />
      <path d="M13.75 8A5.75 5.75 0 0 0 8 2.25" />
    </Svg>
  )
}

export function PencilIcon(props: IconProps): ReactNode {
  return (
    <Svg {...props}>
      <path d="M10.6 2.9a1.6 1.6 0 0 1 2.27 2.27l-7.4 7.4-3.07.8.8-3.07 7.4-7.4Z" />
      <path d="m9.5 4 2.5 2.5" />
    </Svg>
  )
}

export function PlusIcon(props: IconProps): ReactNode {
  return (
    <Svg {...props}>
      <path d="M8 3.25v9.5M3.25 8h9.5" />
    </Svg>
  )
}

export function ChevronRightIcon(props: IconProps): ReactNode {
  return (
    <Svg {...props}>
      <path d="m6 3.5 4.5 4.5L6 12.5" />
    </Svg>
  )
}

export function ChevronLeftIcon(props: IconProps): ReactNode {
  return (
    <Svg {...props}>
      <path d="M10 3.5 5.5 8l4.5 4.5" />
    </Svg>
  )
}

export function CheckIcon(props: IconProps): ReactNode {
  return (
    <Svg {...props}>
      <path d="m3.25 8.5 3 3 6.5-7" />
    </Svg>
  )
}

export function CloseIcon(props: IconProps): ReactNode {
  return (
    <Svg {...props}>
      <path d="m4 4 8 8M12 4l-8 8" />
    </Svg>
  )
}

export function AlertIcon(props: IconProps): ReactNode {
  return (
    <Svg {...props}>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4.9v3.6" />
      <circle cx="8" cy="11.1" r="0.35" fill="currentColor" />
    </Svg>
  )
}

export function UndoIcon(props: IconProps): ReactNode {
  return (
    <Svg {...props}>
      <path d="M5.5 3.5 2.75 6.25 5.5 9" />
      <path d="M2.75 6.25h6.5a3.5 3.5 0 0 1 0 7H7" />
    </Svg>
  )
}

export function CpuIcon(props: IconProps): ReactNode {
  return (
    <Svg {...props}>
      <rect x="4" y="4" width="8" height="8" rx="1.5" />
      <path d="M6.5 6.5h3v3h-3zM6 1.75V4M10 1.75V4M6 12v2.25M10 12v2.25M1.75 6H4M1.75 10H4M12 6h2.25M12 10h2.25" />
    </Svg>
  )
}

/* ---- one glyph per built-in mode ---------------------------------------- */

function WandIcon(props: IconProps): ReactNode {
  return (
    <Svg {...props}>
      <path d="m2.5 13.5 7.75-7.75M9 3.25l.5-1.5.5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5-1.5-.5 1.5-.5ZM12.75 7.5l.25-.75.25.75.75.25-.75.25-.25.75-.25-.75-.75-.25.75-.25Z" />
    </Svg>
  )
}

function ShrinkIcon(props: IconProps): ReactNode {
  return (
    <Svg {...props}>
      <path d="M2.75 4.5h10.5M4.75 8h6.5M6.5 11.5h3" />
    </Svg>
  )
}

function ListIcon(props: IconProps): ReactNode {
  return (
    <Svg {...props}>
      <path d="M6 4h7.25M6 8h7.25M6 12h7.25" />
      <circle cx="3" cy="4" r="0.6" fill="currentColor" />
      <circle cx="3" cy="8" r="0.6" fill="currentColor" />
      <circle cx="3" cy="12" r="0.6" fill="currentColor" />
    </Svg>
  )
}

function DetailIcon(props: IconProps): ReactNode {
  return (
    <Svg {...props}>
      <path d="M3 2.75h6.5L13 6.25v7H3z" />
      <path d="M9.25 2.75v3.5H13M5.75 9h4.5M8 6.75v4.5" />
    </Svg>
  )
}

function CodeIcon(props: IconProps): ReactNode {
  return (
    <Svg {...props}>
      <path d="M5.25 4.75 2 8l3.25 3.25M10.75 4.75 14 8l-3.25 3.25M9 3 7 13" />
    </Svg>
  )
}

function SearchIcon(props: IconProps): ReactNode {
  return (
    <Svg {...props}>
      <circle cx="7" cy="7" r="4.25" />
      <path d="m10.25 10.25 3.25 3.25" />
    </Svg>
  )
}

function BookIcon(props: IconProps): ReactNode {
  return (
    <Svg {...props}>
      <path d="M2.25 3.25h4a1.75 1.75 0 0 1 1.75 1.75v8.25a1.5 1.5 0 0 0-1.5-1.5H2.25zM13.75 3.25h-4A1.75 1.75 0 0 0 8 5v8.25a1.5 1.5 0 0 1 1.5-1.5h4.25z" />
    </Svg>
  )
}

function LanguageIcon(props: IconProps): ReactNode {
  return (
    <Svg {...props}>
      <path d="M2 3.5h6M5 2v1.5M3.25 3.5c.4 2.3 2 4 4.25 4.75M6.75 3.5C6.3 6 4.6 7.9 2.25 8.75M8.5 14l2.75-6.5L14 14M9.4 12h3.7" />
    </Svg>
  )
}

function BookmarkIcon(props: IconProps): ReactNode {
  return (
    <Svg {...props}>
      <path d="M4.25 2.75h7.5v10.5L8 10.75l-3.75 2.5z" />
    </Svg>
  )
}

const MODE_ICONS: Record<string, (props: IconProps) => ReactNode> = {
  general: WandIcon,
  concise: ShrinkIcon,
  structured: ListIcon,
  detailed: DetailIcon,
  coding: CodeIcon,
  research: SearchIcon,
  academic: BookIcon,
  english: LanguageIcon,
}

/**
 * The glyph of one mode: built-ins have their own, custom modes a bookmark.
 * @param props - icon props plus the mode id.
 * @returns the icon.
 */
export function ModeIcon(props: IconProps & { id: string }): ReactNode {
  const { id, ...rest } = props
  const Icon = MODE_ICONS[id] ?? BookmarkIcon
  return <Icon {...rest} />
}

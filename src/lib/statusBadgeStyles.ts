export type StatusDotBadgeTone = 'neutral' | 'success' | 'warning' | 'info' | 'destructive'

export const STATUS_DOT_BADGE_STYLES: Record<StatusDotBadgeTone, { badge: string; dot: string }> = {
  neutral: { badge: 'border-border bg-muted text-muted-foreground dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300', dot: 'bg-muted-foreground' },
  success: { badge: 'border-success/30 bg-success/10 text-(--success-hover) dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300', dot: 'bg-success dark:bg-emerald-400' },
  warning: { badge: 'border-warning/30 bg-warning/10 text-(--warning-hover) dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300', dot: 'bg-warning dark:bg-amber-400' },
  info: { badge: 'border-info/30 bg-info/10 text-(--info-hover) dark:border-sky-800 dark:bg-sky-950 dark:text-sky-300', dot: 'bg-info dark:bg-sky-400' },
  destructive: { badge: 'border-destructive/30 bg-destructive/10 text-(--destructive-hover) dark:border-red-800 dark:bg-red-950 dark:text-red-300', dot: 'bg-destructive dark:bg-red-400' },
}

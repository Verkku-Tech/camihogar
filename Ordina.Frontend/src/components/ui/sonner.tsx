import { Toaster as Sonner, ToasterProps } from 'sonner'

const Toaster = ({ ...props }: ToasterProps) => {
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  const theme = isDark ? 'dark' : 'light'

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className="toaster group"
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }

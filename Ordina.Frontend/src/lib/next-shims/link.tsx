import React from 'react'
import { Link as RouterLink } from 'react-router-dom'

export default function Link({
  href,
  children,
  className,
  replace,
  target,
  rel,
  onClick,
  ...props
}: any) {
  const to = typeof href === 'object' && href?.pathname ? href.pathname : href || ''
  return (
    <RouterLink
      to={to}
      replace={replace}
      target={target}
      rel={rel}
      onClick={onClick}
      className={className}
      {...props}
    >
      {children}
    </RouterLink>
  )
}

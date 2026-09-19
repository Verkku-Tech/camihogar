import React from 'react'

export default function Image({
  src,
  alt = '',
  width,
  height,
  className,
  style,
  fill,
  sizes,
  priority,
  ...props
}: any) {
  const finalStyle = fill
    ? {
        position: 'absolute' as const,
        height: '100%',
        width: '100%',
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        objectFit: 'cover' as const,
        ...style
      }
    : style

  return (
    <img
      src={src}
      alt={alt}
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      className={className}
      style={finalStyle}
      {...props}
    />
  )
}

import React from 'react'

export default function dynamic(
  loader: () => Promise<{ default: React.ComponentType<any> } | React.ComponentType<any>>,
  options?: {
    ssr?: boolean
    loading?: () => React.ReactNode
  }
) {
  const LazyComponent = React.lazy(async () => {
    const mod = await loader()
    if (typeof mod === 'function' || ('$$typeof' in mod && !('default' in mod))) {
      return { default: mod as React.ComponentType<any> }
    }
    return mod as { default: React.ComponentType<any> }
  })

  return function DynamicComponent(props: any) {
    return (
      <React.Suspense fallback={options?.loading ? options.loading() : null}>
        <LazyComponent {...props} />
      </React.Suspense>
    )
  }
}

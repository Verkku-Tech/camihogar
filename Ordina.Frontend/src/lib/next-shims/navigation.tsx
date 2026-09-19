import {
  useLocation,
  useNavigate,
  useParams as useRouterParams,
  useSearchParams as useRouterSearchParams
} from 'react-router-dom'

export function usePathname(): string {
  const location = useLocation()
  return location.pathname
}

export function useRouter() {
  const navigate = useNavigate()
  return {
    push: (url: string) => navigate(url),
    replace: (url: string) => navigate(url, { replace: true }),
    back: () => navigate(-1),
    forward: () => navigate(1),
    refresh: () => window.location.reload()
  }
}

export function useParams<T extends Record<string, string | string[]>>() {
  return useRouterParams() as unknown as T
}

export function useSearchParams() {
  const [searchParams] = useRouterSearchParams()
  return searchParams
}

import { useState } from 'react'

export const PAGE_SIZE = 8

export function usePagination(totalItems: number) {
  const [page, setPageState] = useState(1)
  const pageCount = Math.max(1, Math.ceil(totalItems / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const start = (currentPage - 1) * PAGE_SIZE
  const end = start + PAGE_SIZE

  const setPage = (nextPage: number) => {
    setPageState(Math.min(Math.max(nextPage, 1), pageCount))
  }

  return {
    page: currentPage,
    pageCount,
    start,
    end,
    setPage,
    isVisible: (index: number) => index >= start && index < end,
  }
}

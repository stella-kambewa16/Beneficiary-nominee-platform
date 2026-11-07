import { Icon } from './Icon'

interface PaginationProps {
  page: number
  pageCount: number
  totalItems: number
  start: number
  end: number
  onPageChange: (page: number) => void
  itemLabel?: string
}

export function Pagination({
  page,
  pageCount,
  totalItems,
  start,
  end,
  onPageChange,
  itemLabel = 'items',
}: PaginationProps) {
  if (pageCount <= 1) return null

  const firstRow = totalItems ? start + 1 : 0
  const lastRow = Math.min(end, totalItems)

  return (
    <div className="pagination">
      <p className="pagination-summary">
        Showing {firstRow}–{lastRow} of {totalItems} {itemLabel}
      </p>
      <div className="pagination-controls">
        <button
          type="button"
          className="pagination-button"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <Icon name="chevron-left" size={14} />
        </button>
        <span className="pagination-page">
          Page {page} of {pageCount}
        </span>
        <button
          type="button"
          className="pagination-button"
          aria-label="Next page"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          <Icon name="chevron-right" size={14} />
        </button>
      </div>
    </div>
  )
}

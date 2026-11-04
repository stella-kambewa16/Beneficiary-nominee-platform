import type { Nominee, Policy } from '../data/types'

export interface Segment {
  label: string
  value: number
  color: string
}

const relationshipColors: Record<string, string> = {
  Spouse: '#43a047',
  Child: '#66bb6a',
  Parent: '#81c784',
  Sibling: '#a5d6a7',
  'Extended family': '#c8e6c9',
  Other: '#94a3b8',
}

export function relationshipSegments(nominees: Nominee[]): Segment[] {
  const order = [
    'Spouse',
    'Child',
    'Parent',
    'Sibling',
    'Extended family',
    'Other',
  ]

  return order
    .map((label) => ({
      label,
      value: nominees.filter((item) => item.relationship === label).length,
      color: relationshipColors[label],
    }))
    .filter((segment) => segment.value > 0)
}

export function statusSegments(nominees: Nominee[]): Segment[] {
  return [
    {
      label: 'Verified',
      value: nominees.filter((item) => item.status === 'Verified').length,
      color: '#43a047',
    },
    {
      label: 'Pending',
      value: nominees.filter((item) => item.status === 'Pending').length,
      color: '#f59e0b',
    },
    {
      label: 'Draft',
      value: nominees.filter((item) => item.status === 'Draft').length,
      color: '#94a3b8',
    },
  ].filter((segment) => segment.value > 0)
}

export function conicGradient(segments: Segment[]): string {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0)
  if (!total) return '#eef2f7'

  let cursor = 0
  const stops = segments.map((segment) => {
    const start = cursor
    cursor += (segment.value / total) * 100
    return `${segment.color} ${start}% ${cursor}%`
  })

  return `conic-gradient(${stops.join(', ')})`
}

export function weightedAllocation(policies: Policy[]): number {
  const totalCover = policies.reduce((sum, policy) => sum + policy.cover, 0)
  if (!totalCover) return 0
  const allocatedCover = policies.reduce(
    (sum, policy) => sum + policy.cover * (policy.allocated / 100),
    0,
  )
  return Math.round((allocatedCover / totalCover) * 100)
}

export function unallocatedCover(policies: Policy[]): number {
  return policies.reduce(
    (sum, policy) => sum + policy.cover * (1 - policy.allocated / 100),
    0,
  )
}

export interface ProductStat {
  product: string
  cover: number
  allocated: number
  percent: number
}

export function productStats(policies: Policy[]): ProductStat[] {
  const products = new Map<string, { cover: number; allocated: number }>()

  policies.forEach((policy) => {
    const current = products.get(policy.product) ?? { cover: 0, allocated: 0 }
    current.cover += policy.cover
    current.allocated += policy.cover * (policy.allocated / 100)
    products.set(policy.product, current)
  })

  return Array.from(products.entries())
    .map(([product, values]) => ({
      product,
      cover: values.cover,
      allocated: Math.round(values.allocated),
      percent: values.cover
        ? Math.round((values.allocated / values.cover) * 100)
        : 0,
    }))
    .sort((a, b) => b.cover - a.cover)
}

export function initialsOf(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

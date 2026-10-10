import type { ExpenseCategory } from '@/types'

export interface CategoryMeta {
  id: ExpenseCategory
  label: string
  f7Icon: string
  materialIcon: string
  color: string
}

export const CATEGORIES: CategoryMeta[] = [
  { id: 'food', label: 'Food & Drinks', f7Icon: 'cart_fill', materialIcon: 'restaurant', color: '#f59e0b' },
  { id: 'transport', label: 'Transport', f7Icon: 'car_fill', materialIcon: 'directions_car', color: '#3b82f6' },
  { id: 'accommodation', label: 'Accommodation', f7Icon: 'bed_double_fill', materialIcon: 'hotel', color: '#8b5cf6' },
  { id: 'entertainment', label: 'Entertainment', f7Icon: 'gamecontroller_fill', materialIcon: 'sports_esports', color: '#ec4899' },
  { id: 'other', label: 'Other', f7Icon: 'square_grid_2x2_fill', materialIcon: 'category', color: '#6b7280' },
]

export function categoryMeta(id: ExpenseCategory): CategoryMeta {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1]!
}

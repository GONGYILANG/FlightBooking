import type { FlightSeats } from './types'

export interface Seat {
  id: string
  available: boolean
}

export function seatRows({ totalSeats, layout, claimedSeatNumbers }: FlightSeats): Seat[][] {
  const { columns } = layout
  const claimed = new Set(claimedSeatNumbers)
  const rows: Seat[][] = []
  for (let index = 0; index < totalSeats; index++) {
    const row = Math.floor(index / columns.length)
    const id = `${row + 1}${columns[index % columns.length]}`
    ;(rows[row] ??= []).push({ id, available: !claimed.has(id) })
  }
  return rows
}

export function toggleSeat(selected: string[], seat: Seat, limit: number): string[] {
  if (!seat.available) return selected
  if (selected.includes(seat.id)) return selected.filter((id) => id !== seat.id)
  if (selected.length >= limit) return selected
  return [...selected, seat.id]
}

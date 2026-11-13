import assert from 'node:assert/strict'
import test from 'node:test'
import { seatRows, toggleSeat } from '../checkout.ts'

test('the map includes the last partial row and disables the exact claimed seats', () => {
  const rows = seatRows({
    flightId: 'flight', totalSeats: 128, availableSeats: 126,
    layout: { columns: ['A', 'B', 'C', 'D', 'E', 'F'] },
    claimedSeatNumbers: ['1B', '22A'],
  })
  assert.equal(rows.flat().length, 128)
  assert.deepEqual(rows.at(-1), [{ id: '22A', available: false }, { id: '22B', available: true }])
  assert.deepEqual(rows.flat().filter((seat) => !seat.available).map((seat) => seat.id), ['1B', '22A'])
})

test('selection rejects unavailable/extra seats and allows deselection before replacing a seat', () => {
  const a = { id: '1A', available: true }
  const b = { id: '1B', available: true }
  const c = { id: '1C', available: true }
  let selected = toggleSeat([], a, 2)
  selected = toggleSeat(selected, b, 2)
  assert.deepEqual(selected, ['1A', '1B'])
  assert.equal(toggleSeat(selected, c, 2), selected)
  assert.equal(toggleSeat(selected, { id: '2A', available: false }, 3), selected)
  selected = toggleSeat(selected, a, 2)
  assert.deepEqual(toggleSeat(selected, c, 2), ['1B', '1C'])
  assert.deepEqual(toggleSeat([], a, 0), [])
})

# Appointment Block Overlap Fix - Visual Guide

## Problem
The FollowUpScheduler previously rendered appointment blocks using an absolute-positioned overlay layer that spanned multiple time columns. This caused blocks to visually overlap other blocks and spill into neighboring cells.

## Solution
Changed to inline rendering where appointments are shown only in their **start time cell** and stacked vertically when multiple appointments start at the same time.

## Visual Comparison

### BEFORE (Absolute Overlay)
```
┌──────────┬────────┬────────┬────────┬────────┐
│ Date     │ 09:00  │ 09:30  │ 10:00  │ 10:30  │
├──────────┼────────┼────────┼────────┼────────┤
│ Mon      │ Сул    │ Сул    │ Сул    │ Сул    │
│          │╔═══════════════════════╗│        │  ← Appointment spanning
│          │║ Patient A (60min)    ║│        │     multiple cells
│          │╚═══════════════════════╝│        │     (absolute positioned)
│          │        │╔═══════════════════════╗│  ← Overlaps next block
│          │        │║ Patient B (60min)    ║│
│          │        │╚═══════════════════════╝│
└──────────┴────────┴────────┴────────┴────────┘

Issues:
❌ Blocks span across multiple columns
❌ Blocks can overlap each other visually
❌ Blocks spill into neighboring cells
❌ Complex click handling logic
```

### AFTER (Inline Cell Rendering)
```
┌──────────┬────────┬────────┬────────┬────────┐
│ Date     │ 09:00  │ 09:30  │ 10:00  │ 10:30  │
├──────────┼────────┼────────┼────────┼────────┤
│ Mon      │┌──────┐│        │        │        │
│          ││Patient││        │        │        │  ← Each appointment
│          ││  A   ││        │        │        │     in its own cell
│          │└──────┘│        │        │        │     (start time only)
│          │┌──────┐│        │        │        │  ← When 2 start at same
│          ││Patient││        │        │        │     time, they stack
│          ││  B   ││        │        │        │     vertically
│          │└──────┘│        │        │        │
└──────────┴────────┴────────┴────────┴────────┘

Benefits:
✅ Each block stays in its own cell
✅ No overlapping or spilling
✅ Clear visual separation
✅ Simple click handling
```

## Implementation Details

### Key Changes

1. **Removed Absolute Overlay**
   - Eliminated the `position: absolute` overlay layer
   - Removed complex span calculation logic (`getAppointmentSpan`)
   - Removed lane assignment algorithm
   - Removed constants: `LANE_HEIGHT`, `LANE_PADDING`, `BLOCK_HORIZONTAL_PADDING`

2. **Inline Cell Rendering**
   - Each cell now uses `flexDirection: "column"` to stack blocks vertically
   - Appointments filtered by `getHmFromIso(apt.scheduledAt) === timeLabel`
   - Only appointments **starting** at that time are shown in that cell
   - Up to 2 blocks can be stacked in a single cell (capacity = 2)

3. **Simplified Click Handling**
   - Cell click: Opens modal for that time slot
   - Block click: Uses `e.stopPropagation()` and opens modal for that slot
   - No complex coordinate calculations needed

### Cell Layout Structure
```typescript
<div style={{
  display: "flex",
  flexDirection: "column",  // Stack blocks vertically
  gap: 2,                   // 2px spacing between blocks
  alignItems: "stretch",    // Blocks take full width
  justifyContent: "center", // Center vertically in cell
  overflow: "hidden",       // Clip overflowing content
}}>
  {appointmentsAtStart.map(apt => (
    <div style={{
      width: "100%",
      maxWidth: "100%",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      // ... styling
    }}>
      {patientName}
    </div>
  ))}
</div>
```

## Code Changes Summary

### Removed (~193 lines)
- `getColumnIndex()` - Helper to find column index
- `getAppointmentSpan()` - Calculate how many columns an appointment spans
- Lane assignment algorithm - Complex logic to prevent visual overlaps
- Absolute positioned overlay div
- Complex click coordinate calculations

### Added (~57 lines)
- Filter appointments by start time: `getHmFromIso(apt.scheduledAt) === timeLabel`
- Flexbox vertical stacking in each cell
- Simple click handler with `e.stopPropagation()`

### Net Result
- **136 fewer lines of code** (193 removed - 57 added)
- Much simpler and more maintainable
- Better visual clarity

## Behavior

### Single Appointment
When one appointment starts at a time slot:
- Shows 1 block in that cell
- Block takes full cell width
- Background: light red with border
- Shows patient name (truncated with ellipsis if too long)

### Two Appointments (Capacity = 2)
When two appointments start at the same time slot:
- Shows 2 blocks stacked vertically
- Each block takes full cell width
- 2px gap between them
- Both are clickable independently
- Backend enforces max 2 overlapping appointments, but UI will render all that exist

### Empty Slot
- Shows "Сул" (Available) text in green
- Light green background
- Clickable to book new appointment

### Booked Slot (with appointments starting elsewhere)
- Light red background
- Empty text (appointments shown in their start cells)
- Clickable to view details

## Acceptance Criteria Validation

✅ **Appointment blocks never overlap or spill into adjacent cells**
   - Each block is rendered with `width: 100%, maxWidth: 100%` and `overflow: hidden`
   - Blocks are inside their cell's flex container, can't escape

✅ **Appointments are shown only in their start time cell**
   - Filter: `getHmFromIso(apt.scheduledAt) === timeLabel`
   - No spanning logic

✅ **If 2 appointments start in the same slot, they appear as two stacked blocks**
   - Parent cell uses `flexDirection: "column"` and `gap: 2`
   - All appointments starting at that time are mapped to individual divs

✅ **Existing modals and booking/delete flows still work**
   - Cell click handlers unchanged: `handleSlotSelection()` and `handleBookedSlotClick()`
   - Block click uses `e.stopPropagation()` to call `handleBookedSlotClick()`
   - No changes to modal components

## Testing Notes

Since this is purely a visual layout change with no business logic modifications:

1. **Build Verification**: ✅ Frontend builds successfully with no TypeScript errors
2. **Visual Testing**: Requires manual verification with running app
   - Check that blocks appear only in start-time cells
   - Verify 2 blocks stack properly in same cell
   - Confirm no overlapping or spilling
   - Test click behavior on cells and blocks

## Future Considerations

- The backend enforces a capacity of 2 overlapping appointments per time slot
- The UI renders all appointments that start at the same time (no UI-side limit)
- If more than 2 appointments start at the same time, the cell will show all of them stacked
  - This scenario shouldn't occur due to backend validation, but the UI handles it gracefully
- If many appointments need to be shown in one cell, consider adjusting `MIN_ROW_HEIGHT`
- Consider adding visual indicators for appointment duration (e.g., border thickness or tooltip)

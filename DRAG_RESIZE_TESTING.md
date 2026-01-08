# Drag-and-Resize Appointment Testing Guide

## Overview
This document describes how to manually test the new drag-and-resize functionality for appointment blocks in the appointments page.

## Prerequisites
1. Start the backend server: `cd backend && npm start`
2. Start the frontend development server: `cd frontend && npm run dev`
3. Navigate to the appointments page in your browser
4. Ensure you have appointments with eligible statuses: `booked`, `confirmed`, `online`, or `other`

## Test Scenarios

### 1. Drag Appointment Within Same Doctor Column
**Steps:**
1. Find an appointment block with status `booked`, `confirmed`, `online`, or `other`
2. Click and hold the mouse button on the appointment block
3. Drag the mouse up or down
4. Observe the appointment moves and snaps to 30-minute intervals
5. Release the mouse button
6. Verify the floating "Save/Cancel" UI appears at the bottom center of the screen
7. Click "Хадгалах" (Save)
8. Verify the appointment updates on the server and the UI refreshes

**Expected Behavior:**
- Appointment shows blue border while dragging
- Position updates smoothly during drag
- Snaps to 30-minute time slots
- After release, orange border shows with save/cancel prompt
- After save, appointment persists in new position

### 2. Drag Appointment Between Doctor Columns
**Steps:**
1. Find an appointment block in one doctor's column
2. Click and hold on the appointment
3. Drag horizontally to another doctor's column
4. Drag vertically to adjust time
5. Release the mouse button
6. Click "Хадгалах" (Save)
7. Verify the appointment moves to the new doctor's column

**Expected Behavior:**
- Appointment can cross doctor column boundaries
- Visual position updates to reflect the new doctor during drag
- After save, appointment appears in the new doctor's column only

### 3. Resize Appointment Duration
**Steps:**
1. Find an appointment block with eligible status
2. Hover over the bottom 6px of the appointment block
3. Observe the cursor changes to `ns-resize` (up/down arrows)
4. Click and hold on the resize handle
5. Drag down to increase duration or up to decrease duration
6. Observe the appointment height changes and snaps to 30-minute increments
7. Release the mouse button
8. Click "Хадгалах" (Save)
9. Verify the new duration is saved

**Expected Behavior:**
- Resize handle visible at bottom of appointment block
- Cursor changes to ns-resize on hover over handle
- Appointment height updates smoothly during resize
- Minimum duration: 30 minutes
- After save, new endAt time persists

### 4. Cancel Draft Changes
**Steps:**
1. Drag or resize an appointment
2. Release the mouse button (Save/Cancel UI appears)
3. Click "Болих" (Cancel)
4. Verify the appointment returns to its original position/size

**Expected Behavior:**
- Appointment immediately reverts to original state
- Save/Cancel UI disappears
- No API call is made

### 5. Non-Eligible Status Appointments
**Steps:**
1. Find appointments with statuses: `ongoing`, `completed`, `no_show`, `cancelled`, `ready_to_pay`
2. Try to drag these appointments
3. Observe they remain non-interactive

**Expected Behavior:**
- Cursor remains `pointer` (not `move`)
- No resize handle visible
- Clicking opens details modal normally
- Cannot drag or resize

### 6. Error Handling
**Steps:**
1. Drag/resize an appointment
2. Simulate a network error (disconnect from network or backend)
3. Click "Хадгалах" (Save)
4. Observe error message appears in the floating UI
5. Reconnect and click "Хадгалах" again
6. Verify save succeeds

**Expected Behavior:**
- Error message displays in red text in floating UI
- Draft state is preserved after error
- Can retry save after fixing the issue

### 7. Existing Modal Flows
**Steps:**
1. Click on an appointment block (without dragging)
2. Verify the details modal opens
3. Click "Засварлах" (Edit) button
4. Verify the edit modal opens on top of details modal
5. Make changes and save
6. Verify changes persist

**Expected Behavior:**
- Details modal (z-index 60) opens normally
- Edit modal (z-index 70) appears above details modal
- All existing functionality works unchanged

### 8. Multiple Overlapping Appointments
**Steps:**
1. Find a time slot with 2 overlapping appointments
2. Drag one of the overlapping appointments
3. Verify it can be moved without affecting the other

**Expected Behavior:**
- Appointments in the same slot are shown side-by-side (lanes)
- Dragging one doesn't affect the other
- After save, lane positions recalculate correctly

## Visual Indicators Reference

| State | Visual Style |
|-------|--------------|
| Normal | Standard background color by status |
| Hovering (eligible) | Cursor: move |
| Hovering resize handle | Cursor: ns-resize |
| Dragging | Blue 2px border, elevated shadow, opacity 0.8 |
| Pending Save | Orange 2px border |
| Saving | Buttons disabled, "Хадгалж байна..." text |

## Status Color Legend
- `booked` (Захиалсан): Light cyan (#77f9fe)
- `confirmed` (Баталгаажсан): Light green (#bbf7d0)
- `online` (Онлайн): Purple (#a78bfa)
- `ongoing` (Явж байна): Gray (#9d9d9d)
- `ready_to_pay` (Төлбөр төлөх): Yellow (#facc15)
- `completed` (Дууссан): Pink (#fb6190)
- `no_show` (Ирээгүй): Red (#ef4444)
- `cancelled` (Цуцалсан): Blue (#1889fc)
- `other` (Бусад): Slate (#94a3b8)

## Technical Notes

### API Endpoint
- **URL:** `PATCH /api/appointments/:id`
- **Body:** `{ scheduledAt: ISO_STRING, endAt: ISO_STRING, doctorId: NUMBER }`
- **Restrictions:** Cannot change `patientId` or `branchId` via PATCH

### Frontend State Management
- `draftEdits`: Record of pending changes keyed by appointment ID
- `activeDrag`: Current drag operation state (null when not dragging)
- `pendingSaveId`: ID of appointment awaiting save/cancel decision

### Snap Behavior
- All time changes snap to 30-minute intervals
- Position calculated as: `(minutes_from_start / total_minutes) * column_height_px`
- Doctor column determined by X position: `floor((clientX - gridLeft - 80px) / 180px)`

## Common Issues & Solutions

### Issue: Appointment doesn't move when dragging
- **Cause:** Status is not eligible for editing
- **Solution:** Check appointment status is one of: booked, confirmed, online, other

### Issue: Save fails with 400 error
- **Cause:** Backend validation failed (e.g., endAt <= scheduledAt)
- **Solution:** Ensure resize resulted in valid duration (>0)

### Issue: Appointment disappears after drag
- **Cause:** Moved to different doctor's column
- **Solution:** Check the target doctor column - appointment should appear there

### Issue: Can't click appointment to open details
- **Cause:** Mouse event is being captured by drag handler
- **Solution:** This is a feature - while dragging/pending save, details modal is blocked to prevent conflicts

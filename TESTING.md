# Manual Testing Guide for Tooth Selection Fix

## Test Scenario 1: Basic Tooth Selection
**Expected:** Multiple tooth clicks should add to the same diagnosis row

1. Open an encounter page
2. Click tooth #43 in the tooth chart
3. **Verify:** A new diagnosis row is created with toothCode "43"
4. Click tooth #46 in the tooth chart
5. **Verify:** The same row's toothCode becomes "43, 46" (not a new row)

## Test Scenario 2: Save and Reset
**Expected:** After saving, the next tooth click creates a NEW row

1. Continue from Scenario 1 (row with "43, 46")
2. Click "Зөвхөн онош хадгалах" (Save diagnoses only) button
3. **Verify:** 
   - The row becomes locked (shows lock icon 🔒)
   - Tooth selection UI is cleared (no teeth selected)
4. Click tooth #26 in the tooth chart
5. **Verify:** A NEW diagnosis row is created with toothCode "26"
6. **Verify:** The previous row still shows "43, 46" (not modified)

## Test Scenario 3: All Teeth Selection
**Expected:** Clicking "Бүх шүд" should set toothCode to the label "Бүх шүд"

1. Click the "Бүх шүд" (All teeth) button in the tooth chart
2. **Verify:** All teeth in the current mode (Adult/Child) are visually selected
3. **Verify:** The active diagnosis row's toothCode shows "Бүх шүд" (not a comma-separated list)
4. Click "Зөвхөн онош хадгалах" to save
5. **Verify:** The saved row shows toothCode as "Бүх шүд"

## Test Scenario 4: Switching Between Adult/Child Modes
**Expected:** Mode switching should work with tooth selection

1. Ensure "Байнгын шүд" (Adult) mode is selected
2. Click tooth #18
3. **Verify:** Row created with "18"
4. Switch to "Сүүн шүд" (Child) mode
5. Click tooth #55
6. **Verify:** Same row's toothCode becomes "18, 55"
7. Save and verify both codes are preserved

## Test Scenario 5: Multiple Save Cycles
**Expected:** Multiple save/select cycles should work consistently

1. Select tooth #11 → verify new row with "11"
2. Save → verify row locked, selection cleared
3. Select tooth #21 → verify NEW row with "21"
4. Save → verify row locked, selection cleared
5. Select tooth #31 → verify NEW row with "31"
6. **Verify:** Three separate locked rows exist with "11", "21", and "31"

## Regression Test: Locked Row Cannot Be Modified
**Expected:** Locked rows should be immutable via tooth selection

1. Create a row with tooth #41, save it (becomes locked)
2. Try to click the toothCode input field of the locked row
3. **Verify:** Input is disabled (greyed out)
4. Click tooth #42 in the tooth chart
5. **Verify:** A NEW row is created with "42", the locked row with "41" is unchanged

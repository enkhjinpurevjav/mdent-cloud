# Manual Test Plan: Encounter Save Race Condition Fix

## Overview
This test plan validates the fixes for the encounter save race condition that was clearing sterilization indicators and services.

## Pre-Test Setup
1. Start the application (frontend + backend + database)
2. Open DevTools Network tab in browser
3. Log in as a user with encounter management permissions
4. Navigate to an existing encounter or create a new one

## Test Scenarios

### Test 1: Normal Save with Indicators ✅ PRIMARY
**Purpose**: Verify single click saves both service and indicators correctly

**Steps**:
1. Open an encounter page
2. Add a new diagnosis row (click tooth on chart or add manually)
3. Select a diagnosis (e.g., "K02.0 – Эмийн идэмхий цариес")
4. Select a sterilization indicator from dropdown
5. Select a service (e.g., "Сэргээлт" category service)
6. Open DevTools Network tab, filter for "sterilization-indicators"
7. Click "Зөвхөн онош хадгалах" button ONCE
8. Wait for save to complete
9. Observe Network tab

**Expected Results**:
- ✅ Single PUT request to `/api/encounters/{id}/diagnoses/{diagnosisId}/sterilization-indicators`
- ✅ Request body contains selected indicator IDs: `{ indicatorIds: [123] }` (not empty)
- ✅ No second request with empty array
- ✅ Success message appears
- ✅ Refresh page - indicator and service still visible

**Actual Results**: [To be filled during testing]

**Status**: [ ] Pass [ ] Fail

---

### Test 2: User Explicitly Clears Indicators
**Purpose**: Verify explicit clearing sends replace=true flag

**Steps**:
1. Open an encounter with existing indicators
2. Find a diagnosis row that already has indicators selected
3. Click the X button on each indicator tag to remove all
4. Open Network tab, filter for "sterilization-indicators"
5. Click "Зөвхөн онош хадгалах"
6. Observe the request URL and body

**Expected Results**:
- ✅ PUT request to `.../sterilization-indicators?replace=true`
- ✅ Request body: `{ indicatorIds: [] }`
- ✅ Refresh page - indicators are cleared (as intended)

**Actual Results**: [To be filled during testing]

**Status**: [ ] Pass [ ] Fail

---

### Test 3: Multiple Rapid Clicks (Re-entrancy Guard)
**Purpose**: Verify re-entrancy protection works

**Steps**:
1. Open an encounter page
2. Add diagnosis, indicator, and service
3. Click "Зөвхөн онош хадгалах" button rapidly 5 times in quick succession
4. Observe Network tab for duplicate requests
5. Wait for saves to complete
6. Refresh page

**Expected Results**:
- ✅ Only ONE set of save requests (diagnoses, indicators, services)
- ✅ Subsequent clicks ignored while saving=true
- ✅ Button becomes disabled during save
- ✅ Indicator and service persist after refresh

**Actual Results**: [To be filled during testing]

**Status**: [ ] Pass [ ] Fail

---

### Test 4: Service Without Saved Diagnosis (Validation)
**Purpose**: Verify service save validation

**Steps**:
1. Open an encounter page
2. Add a new diagnosis row (unsaved, no database ID yet)
3. Select a diagnosis from dropdown
4. Select a service from dropdown
5. DO NOT save yet
6. Try to save services (Note: Since button saves both, this tests the validation)
7. Observe error message

**Expected Results**:
- ✅ Error message appears: "Онош эхлээд хадгална уу. Онош хадгалсны дараа үйлчилгээ хадгалах боломжтой."
- ✅ Service not saved
- ✅ After saving (second click), both diagnosis and service save correctly

**Actual Results**: [To be filled during testing]

**Status**: [ ] Pass [ ] Fail

---

### Test 5: Unmodified Row (Skip Empty Indicators)
**Purpose**: Verify empty indicators not sent when row not modified

**Steps**:
1. Open an encounter with existing saved diagnosis rows
2. Find a row that has NO indicators selected
3. DO NOT modify the indicator field
4. Click "Зөвхөн онош хадгалах"
5. Observe Network tab

**Expected Results**:
- ✅ PUT request to diagnoses endpoint
- ✅ NO PUT request to sterilization-indicators for that row
- ✅ indicatorsDirty = false for unmodified row

**Actual Results**: [To be filled during testing]

**Status**: [ ] Pass [ ] Fail

---

### Test 6: Backend Safety Net
**Purpose**: Verify backend rejects empty array without replace flag

**Steps**:
1. Use curl or Postman to directly test the API
2. Find a diagnosis row ID with existing indicators
3. Send: 
   ```
   PUT /api/encounters/{id}/diagnoses/{diagnosisId}/sterilization-indicators
   Body: { indicatorIds: [] }
   (NO replace query param)
   ```
4. Check response

**Expected Results**:
- ✅ Status 200 (not 400/500)
- ✅ Response returns CURRENT indicators (not empty)
- ✅ Database unchanged

**Actual Results**: [To be filled during testing]

**Status**: [ ] Pass [ ] Fail

---

### Test 7: Multiple Diagnoses with Indicators
**Purpose**: Verify snapshot mechanism with multiple rows

**Steps**:
1. Open an encounter page
2. Create 3 diagnosis rows
3. For each row:
   - Select different diagnosis
   - Select different indicator
   - Select different service
4. Click "Зөвхөн онош хадгалах" once
5. Observe Network tab
6. Refresh page

**Expected Results**:
- ✅ 3 separate indicator PUT requests (parallel)
- ✅ Each request has correct indicator IDs
- ✅ No cross-contamination between rows
- ✅ After refresh, all 3 rows show correct indicators

**Actual Results**: [To be filled during testing]

**Status**: [ ] Pass [ ] Fail

---

### Test 8: Indicator Modification After Save
**Purpose**: Verify dirty flag reset after successful save

**Steps**:
1. Save a diagnosis with indicator
2. Remove the indicator
3. Add a different indicator
4. Save again
5. Refresh

**Expected Results**:
- ✅ First save: indicator persists
- ✅ Second save: old indicator replaced with new one
- ✅ indicatorsDirty reset to false after first save
- ✅ Set to true again when modified

**Actual Results**: [To be filled during testing]

**Status**: [ ] Pass [ ] Fail

---

## Regression Tests

### Regression 1: Existing Encounters Load Correctly
**Purpose**: Ensure no breaking changes to data loading

**Steps**:
1. Open several existing encounters with saved indicators
2. Verify indicators display correctly
3. Verify services display correctly

**Expected Results**:
- ✅ All existing data loads without errors
- ✅ indicatorsDirty defaults to false on load

**Actual Results**: [To be filled during testing]

**Status**: [ ] Pass [ ] Fail

---

### Regression 2: Other Save Operations Still Work
**Purpose**: Verify other fields still save correctly

**Steps**:
1. Test saving diagnosis problems
2. Test saving notes
3. Test saving tooth codes
4. Test saving prescription

**Expected Results**:
- ✅ All fields save successfully
- ✅ No interference from indicator changes

**Actual Results**: [To be filled during testing]

**Status**: [ ] Pass [ ] Fail

---

## Network Inspection Checklist

For each test, verify in Network tab:

- [ ] No duplicate requests to same endpoint
- [ ] No trailing requests with empty indicatorIds
- [ ] Request timing: diagnoses → indicators → services (sequential)
- [ ] Proper error handling (no 500 errors)
- [ ] Response times acceptable (< 2 seconds per request)

## Edge Cases

### Edge Case 1: Very Slow Network
- Test with Chrome DevTools "Slow 3G" throttling
- Verify no race conditions even with delayed responses

### Edge Case 2: Concurrent Users
- Two users edit same encounter in different tabs
- Last save wins (expected behavior, not a bug)

### Edge Case 3: Browser Back/Forward
- Save indicators, navigate away, click back
- Verify state still correct

## Success Criteria

All tests must pass for the fix to be considered complete:

- [ ] Test 1: Normal Save with Indicators (PRIMARY)
- [ ] Test 2: User Explicitly Clears Indicators
- [ ] Test 3: Multiple Rapid Clicks
- [ ] Test 4: Service Without Saved Diagnosis
- [ ] Test 5: Unmodified Row
- [ ] Test 6: Backend Safety Net
- [ ] Test 7: Multiple Diagnoses with Indicators
- [ ] Test 8: Indicator Modification After Save
- [ ] Regression 1: Existing Encounters Load
- [ ] Regression 2: Other Save Operations

## Known Limitations

1. **New rows (no database ID) skip indicator save** - This is intentional. User must save diagnosis first, then indicators on second save.
2. **replace query param is additive** - Old API clients without this param still work (safety net applies).

## Rollback Procedure

If critical bugs found:

1. Backend: Comment out replace flag check (lines 1130-1142 in encounters.js)
2. Frontend: Restore previous version of handleSaveDiagnoses
3. Deploy backend first, then frontend
4. No data loss risk - worst case is indicators need re-selection

## Test Environment

- [ ] Development (local)
- [ ] Staging
- [ ] Production (smoke test only)

**Tester**: ___________________  
**Date**: ___________________  
**Build/Commit**: 23ad612  
**Browser**: Chrome/Firefox/Safari version: ___________

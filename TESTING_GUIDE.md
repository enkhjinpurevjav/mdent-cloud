# Manual Testing Guide: Encounter Diagnosis Data Persistence

## Issue
Previously, encounter diagnosis data would disappear after page refresh except for diagnosis code/name and tooth numbers.

## Root Cause (Fixed)
Legacy `encounterDiagnoses.js` router had a destructive deleteMany+recreate pattern that dropped the `toothCode` field and used a route that conflicted with `encounters.js`.

## Solution
- Removed legacy `backend/src/routes/encounterDiagnoses.js` file
- Confirmed `encounters.js` uses non-destructive update-or-create pattern
- Added comprehensive documentation to prevent future regressions

## Manual Verification Steps

### Prerequisites
1. Start the backend server: `cd backend && npm start`
2. Start the frontend: `cd frontend && npm run dev`
3. Log in to the application
4. Navigate to an encounter detail page

### Test Case 1: Create New Diagnosis with All Fields
1. On encounter detail page, add a new diagnosis
2. Fill in all fields:
   - Select a diagnosis (e.g., "K02.1 - Caries of dentin")
   - Enter tooth code (e.g., "11, 12, 13")
   - Select diagnosis problems (if available)
   - Add a note (e.g., "Treatment needed urgently")
   - Select sterilization indicators (if available)
3. Click "Save" button
4. **Verify**: All fields are visible in the UI after save
5. **Refresh the page (F5 or Ctrl+R)**
6. ✅ **Expected**: All fields should still be visible:
   - Diagnosis code and name
   - Tooth code "11, 12, 13"
   - Selected problems
   - Note "Treatment needed urgently"
   - Sterilization indicators

### Test Case 2: Update Existing Diagnosis
1. Edit an existing diagnosis row
2. Change the tooth code from "11, 12, 13" to "21, 22, 23"
3. Update the note
4. Click "Save"
5. **Refresh the page**
6. ✅ **Expected**: Updated tooth code "21, 22, 23" and note should persist

### Test Case 3: Multiple Diagnosis Rows
1. Add 3 different diagnosis rows with different data:
   - Row 1: Diagnosis A, tooth "11", note "First"
   - Row 2: Diagnosis B, tooth "21", note "Second"  
   - Row 3: Diagnosis C, tooth "31", note "Third"
2. Save
3. **Refresh the page**
4. ✅ **Expected**: All 3 rows with their respective tooth codes and notes should be visible

### Test Case 4: API Response Verification
Use browser DevTools Network tab to verify API responses:

1. Refresh encounter detail page
2. Check Network tab for: `GET /api/encounters/[id]`
3. ✅ **Expected Response Structure**:
```json
{
  "id": 123,
  "encounterDiagnoses": [
    {
      "id": 456,
      "encounterId": 123,
      "diagnosisId": 789,
      "toothCode": "11, 12, 13",
      "selectedProblemIds": [1, 2, 3],
      "note": "Treatment needed urgently",
      "diagnosis": {
        "id": 789,
        "code": "K02.1",
        "name": "Caries of dentin",
        "problems": [
          {
            "id": 1,
            "label": "Pain",
            "order": 1,
            "active": true,
            "diagnosisId": 789
          }
        ]
      },
      "sterilizationIndicators": [
        {
          "id": 1,
          "encounterDiagnosisId": 456,
          "indicatorId": 101,
          "indicator": {
            "id": 101,
            "packageName": "Package A",
            "code": "IND-001",
            "branchId": 1
          }
        }
      ]
    }
  ]
}
```

4. When saving, check: `PUT /api/encounters/[id]/diagnoses`
5. ✅ **Expected**: Request body should include all fields:
```json
{
  "items": [
    {
      "id": 456,
      "diagnosisId": 789,
      "toothCode": "11, 12, 13",
      "selectedProblemIds": [1, 2, 3],
      "note": "Treatment needed urgently"
    }
  ]
}
```

## Success Criteria
- ✅ All diagnosis fields persist after page refresh
- ✅ toothCode field is not lost on save/refresh
- ✅ diagnosis.problems are included in API responses
- ✅ sterilizationIndicators are included in API responses
- ✅ Multiple diagnosis rows all persist independently
- ✅ No console errors in browser DevTools
- ✅ No 404 or 500 errors in Network tab

## Regression Testing
To prevent future issues:
1. Never use `deleteMany` + recreate pattern for encounter diagnoses
2. Always preserve existing row IDs when updating
3. Always include all fields in update operations (toothCode, note, selectedProblemIds)
4. Always include nested relations in GET responses (diagnosis.problems, sterilizationIndicators)
5. Use the non-destructive update-or-create pattern from `encounters.js`

## Related Files
- `backend/src/routes/encounters.js` - Contains correct implementation
- `frontend/pages/encounters/[id].tsx` - Frontend that uses the API
- `backend/prisma/schema.prisma` - Database schema (EncounterDiagnosis model)

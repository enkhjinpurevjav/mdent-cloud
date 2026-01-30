# Follow-Up Scheduler Testing Guide

## Overview
This guide covers manual testing for Phase 1 changes to the follow-up scheduler appointment system.

## Changes Summary

### Backend Changes
1. **New Endpoint: GET /api/login/me**
   - File: `backend/src/routes/login.js`
   - Requires: Valid JWT token in Authorization header
   - Returns: Current user info (id, name, ovog, email, role, branchId)
   - Purpose: Allow frontend to determine permissions for delete button visibility

### Frontend Changes
1. **New Auth Utility: `frontend/utils/auth.ts`**
   - `fetchCurrentUser()` - Gets current user from /api/login/me
   - `authenticatedFetch()` - Wrapper that adds Authorization header to requests
   - Note: Token storage is in-memory only (lost on refresh)

2. **Encounter Page Updates: `frontend/pages/encounters/[id].tsx`**
   - Added currentUser state
   - Fetches current user on component mount
   - Passes real currentUser.id and currentUser.role to FollowUpScheduler
   - Updated API calls to use authenticatedFetch

3. **FollowUpScheduler Component: `frontend/components/encounter/FollowUpScheduler.tsx`**
   - Already has delete button with permission checks (no changes needed)
   - Uses currentUserId and currentUserRole props for canDeleteAppointment logic

## Testing Scenarios

### Pre-requisites
- Backend server running with database
- Frontend development server running
- Valid JWT token for testing (obtain via login)
- At least one encounter with follow-up appointments

### Test 1: Backend /api/login/me Endpoint

**Setup:**
1. Start backend server
2. Obtain JWT token via POST /api/login
   ```bash
   curl -X POST http://localhost:3001/api/login \
     -H "Content-Type: application/json" \
     -d '{"username":"doctor@test.com","password":"password"}'
   ```

**Test:**
```bash
# Valid token
curl -X GET http://localhost:3001/api/login/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# Expected: 200 OK with user info
{
  "id": 1,
  "name": "John",
  "ovog": "Doe",
  "email": "doctor@test.com",
  "role": "doctor",
  "branchId": 1
}

# Invalid/missing token
curl -X GET http://localhost:3001/api/login/me

# Expected: 401 Unauthorized
{"error": "Missing or invalid token."}
```

### Test 2: Capacity Enforcement (Max 2 Overlapping)

**Setup:**
1. Login as a doctor
2. Navigate to an encounter
3. Enable "Давтан үзлэгийн цаг авах" scheduler

**Test:**
1. Select a time slot that has 0 appointments - should show "Дүүргэлт: 0/2"
2. Book first appointment - should show "Дүүргэлт: 1/2"
3. Book second appointment at overlapping time - should show "Дүүргэлт: 2/2"
4. Try to book third appointment at same time - should fail with 409 error:
   ```
   "Энэ цагт эмчийн дүүргэлт хэтэрсэн байна. Хамгийн ихдээ 2 давхцах цаг авах боломжтой."
   ```

### Test 3: Delete Button Visibility (Doctor Role)

**Setup:**
1. Create follow-up appointments from Encounter A by Doctor A
2. Create follow-up appointments from Encounter B by Doctor B
3. Login as Doctor A

**Test Cases:**

| Scenario | Expected Behavior |
|----------|-------------------|
| View Encounter A (own encounter) | Delete button visible for own follow-up appointments |
| View Encounter B (other doctor's) | Delete button NOT visible |
| Appointment from calendar (not follow-up) | Delete button NOT visible |
| Follow-up appointment in the past | Delete button NOT visible |
| Follow-up appointment in the future | Delete button visible (if own) |

**FollowUpScheduler Permission Logic:**
```typescript
// Doctors can delete only if ALL conditions are met:
- appointment.createdByUserId === currentUserId
- appointment.source === 'FOLLOW_UP_ENCOUNTER'
- appointment.sourceEncounterId === encounterId
- appointment.scheduledAt > now (future)
```

### Test 4: Delete Button Visibility (Admin/Receptionist)

**Setup:**
1. Login as admin or receptionist
2. View any encounter with follow-up appointments

**Expected:**
- Delete button visible for ALL appointments (no restrictions)

### Test 5: Delete Appointment (Doctor)

**Setup:**
1. Login as Doctor A
2. Navigate to Encounter A (created by Doctor A)
3. Create a follow-up appointment for tomorrow

**Test:**
1. Click on the appointment in the scheduler
2. Modal should show:
   - "Захиалга #1" with patient info
   - "Устгах" button (red, visible)
3. Click "Устгах" button
4. Confirm deletion in alert dialog
5. Expected: Appointment deleted, grid refreshes, success message shown

**Backend Verification:**
```sql
-- Appointment should be hard deleted from database
SELECT * FROM "Appointment" WHERE id = <appointment_id>;
-- Should return 0 rows
```

### Test 6: Delete Appointment Error Handling

**Test Cases:**

1. **Wrong Encounter:**
   - Doctor A tries to delete appointment from Encounter B
   - Expected: 403 error "Та зөвхөн одоогийн үзлэгээс үүссэн цагийг устгах боломжтой"

2. **Past Appointment:**
   - Create appointment in the past, try to delete
   - Expected: 403 error "Өнгөрсөн цагийг устгах боломжгүй"

3. **Not Created By User:**
   - Admin creates appointment, doctor tries to delete
   - Expected: 403 error "Та зөвхөн өөрийн үүсгэсэн цагийг устгах боломжтой"

4. **Not Follow-Up Source:**
   - Regular calendar appointment, doctor tries to delete
   - Expected: 403 error "Та зөвхөн давтан үзлэгийн цагийг устгах боломжтой"

### Test 7: Provenance Fields Set Correctly

**Test:**
1. Login as Doctor A (id=5)
2. Create follow-up appointment from Encounter 123
3. Check database:

```sql
SELECT id, patientId, doctorId, createdByUserId, source, sourceEncounterId
FROM "Appointment"
WHERE sourceEncounterId = 123
ORDER BY id DESC
LIMIT 1;
```

**Expected:**
- `createdByUserId` = 5 (Doctor A's ID)
- `source` = 'FOLLOW_UP_ENCOUNTER'
- `sourceEncounterId` = 123

### Test 8: Layout Stability

**Visual Test:**
1. Open follow-up scheduler with multiple appointments
2. Verify:
   - Time columns align with appointment blocks
   - Grid lines are visible through semi-transparent appointments
   - Appointment blocks span correct number of columns based on duration
   - Multiple appointments in same slot stack vertically
   - No misalignment or pixel-math issues

## Known Limitations

### Auth Token Management
- **Issue:** Token is stored in-memory only, lost on page refresh
- **Impact:** Users need to re-login after refresh
- **Future:** Consider using localStorage or httpOnly cookies

### Token Not Automatically Set
- **Issue:** Login form doesn't call `setAuthToken()` after successful login
- **Impact:** Token must be manually set or auth system needs full implementation
- **Workaround:** For testing, can manually set token in browser console:
  ```javascript
  // In browser console after getting token from login API
  import { setAuthToken } from './utils/auth';
  setAuthToken('your-jwt-token-here');
  ```

## Success Criteria

All tests pass if:
1. ✅ Backend /api/login/me returns user info with valid token
2. ✅ Cannot create more than 2 overlapping appointments (409 error)
3. ✅ Delete button shows only for permitted appointments
4. ✅ Doctors can delete only their own follow-up appointments from current encounter
5. ✅ Admin/receptionist can delete any appointment
6. ✅ Appointments have correct provenance fields
7. ✅ Scheduler layout is stable and aligned

# Manual Test Plan for Appointment Capacity and Delete Permissions

## Test Environment Setup
- Ensure backend and frontend are running
- Have test accounts ready:
  - Doctor account
  - Admin/Receptionist account
- Have test patient and encounter ready

## Test 1: Capacity Enforcement - Max 2 Overlapping Appointments

### Test 1.1: Create first appointment (should succeed)
**Steps:**
1. Navigate to an encounter page as a doctor
2. Open the Follow-Up Scheduler
3. Select a future time slot (e.g., tomorrow at 10:00 AM)
4. Create a 30-minute appointment

**Expected Result:**
- ✅ Appointment created successfully
- Slot shows "Дүүргэлт: 1/2" in green

### Test 1.2: Create second overlapping appointment (should succeed)
**Steps:**
1. While in the same encounter, select the same or overlapping time slot
2. Create another 30-minute appointment

**Expected Result:**
- ✅ Second appointment created successfully
- Slot shows "Дүүргэлт: 2/2" in red (full capacity)

### Test 1.3: Attempt third overlapping appointment (should fail with 409)
**Steps:**
1. Try to create a third appointment at the same time slot

**Expected Result:**
- ❌ Request fails with 409 Conflict
- Error message: "Энэ цагт эмчийн дүүргэлт хэтэрсэн байна. Хамгийн ихдээ 2 давхцах цаг авах боломжтой. (Одоогийн давхцал: 3)"

### Test 1.4: Partial overlap (should count correctly)
**Steps:**
1. Create appointment at 10:00-10:30
2. Create appointment at 10:15-10:45 (overlaps with first)
3. Try to create appointment at 10:20-10:50 (overlaps with both)

**Expected Result:**
- ✅ First two succeed
- ❌ Third fails with capacity error

### Test 1.5: Non-overlapping appointment (should succeed)
**Steps:**
1. With 2 appointments at 10:00-10:30, create appointment at 10:30-11:00

**Expected Result:**
- ✅ Appointment created successfully (no overlap, endAt=10:30 doesn't count)

## Test 2: Delete Permission - Source Encounter Check

### Test 2.1: Delete appointment from correct encounter (should succeed)
**Steps:**
1. As a doctor, create a follow-up appointment from Encounter #1
2. In the same Encounter #1 page, click "Устгах" button on the appointment

**Expected Result:**
- ✅ Confirmation dialog appears
- ✅ After confirming, appointment is deleted
- Success message: "Цаг амжилттай устгагдлаа"
- Availability grid refreshes

### Test 2.2: Delete button visibility - correct encounter
**Steps:**
1. Navigate to Encounter #1 that has follow-up appointments
2. Check if "Устгах" button appears for appointments where:
   - `source === 'FOLLOW_UP_ENCOUNTER'`
   - `sourceEncounterId === encounter.id`
   - `createdByUserId === current doctor id`
   - `scheduledAt` is in the future

**Expected Result:**
- ✅ Delete button visible only for matching appointments
- ❌ Delete button NOT visible for appointments from other encounters

### Test 2.3: Attempt delete from wrong encounter (should fail if forced)
**Steps:**
1. Create follow-up appointment from Encounter #1 (sourceEncounterId=1)
2. Navigate to Encounter #2
3. Manually call DELETE API with Encounter #2 id: `DELETE /api/appointments/{id}?encounterId=2`

**Expected Result:**
- ❌ Request fails with 403 Forbidden
- Error message: "Та зөвхөн одоогийн үзлэгээс үүссэн цагийг устгах боломжтой"

### Test 2.4: Delete without encounterId parameter (should fail)
**Steps:**
1. Make API call: `DELETE /api/appointments/{id}` (without encounterId query param)

**Expected Result:**
- ❌ Request fails with 400 Bad Request
- Error message: "encounterId query parameter is required for doctors"

### Test 2.5: Admin/Receptionist can delete any appointment
**Steps:**
1. As admin or receptionist, try to delete any appointment (with or without encounterId)

**Expected Result:**
- ✅ Deletion succeeds regardless of sourceEncounterId
- No encounterId parameter required

## Test 3: Provenance Fields

### Test 3.1: New appointments have correct provenance
**Steps:**
1. Create follow-up appointment via POST /api/encounters/:id/follow-up-appointments
2. Check the created appointment in database or via GET /api/appointments

**Expected Result:**
- ✅ `createdByUserId` = current doctor's user ID (from JWT)
- ✅ `source` = "FOLLOW_UP_ENCOUNTER"
- ✅ `sourceEncounterId` = encounter ID

### Test 3.2: Direct POST to /api/appointments requires auth
**Steps:**
1. Try to POST /api/appointments without Bearer token

**Expected Result:**
- ❌ Request fails with 401 Unauthorized
- Error message: "Missing or invalid token."

### Test 3.3: Appointments from other sources don't interfere
**Steps:**
1. Create regular appointment (not follow-up) with same doctor and time
2. Try to create follow-up appointment

**Expected Result:**
- ✅ Both appointments count toward capacity limit
- ✅ Regular appointment doesn't show delete button in follow-up scheduler

## Test 4: Edge Cases

### Test 4.1: Past appointment cannot be deleted
**Steps:**
1. Find or create appointment with scheduledAt in the past
2. Try to delete it as doctor

**Expected Result:**
- ❌ Request fails with 403
- Error message: "Өнгөрсөн цагийг устгах боломжгүй"

### Test 4.2: Appointment without sourceEncounterId
**Steps:**
1. Attempt to delete appointment that has source="FOLLOW_UP_ENCOUNTER" but sourceEncounterId=null

**Expected Result:**
- ❌ Request fails with 403
- Error message: "Энэ цаг үзлэгтэй холбогдоогүй байна"

### Test 4.3: Different doctor cannot delete
**Steps:**
1. Doctor A creates follow-up appointment
2. Doctor B tries to delete it from the same encounter

**Expected Result:**
- ❌ Request fails with 403
- Error message: "Та зөвхөн өөрийн үүсгэсэн цагийг устгах боломжтой"

### Test 4.4: Cancelled appointments don't count toward capacity
**Steps:**
1. Create 2 appointments (capacity full)
2. Cancel one appointment
3. Try to create a new overlapping appointment

**Expected Result:**
- ✅ New appointment can be created (cancelled doesn't count)

## Test 5: UI/UX Verification

### Test 5.1: Capacity indicator updates
**Steps:**
1. Open follow-up scheduler
2. Create appointments and observe capacity indicator changes

**Expected Result:**
- Shows "Дүүргэлт: 0/2" initially (green)
- Shows "Дүүргэлт: 1/2" after first (green)
- Shows "Дүүргэлт: 2/2" when full (red)

### Test 5.2: Delete button only appears when allowed
**Steps:**
1. Check delete button visibility for various appointment types

**Expected Result:**
- ✅ Visible for own follow-up appointments from current encounter
- ❌ Hidden for others' appointments
- ❌ Hidden for appointments from other encounters
- ❌ Hidden for past appointments
- ❌ Hidden for non-follow-up appointments

### Test 5.3: Success/error messages display correctly
**Steps:**
1. Perform various operations and observe messages

**Expected Result:**
- Success message shows after delete
- Error messages are in Mongolian
- Messages auto-hide after timeout

## Acceptance Criteria Checklist

- [ ] Cannot create more than 2 overlapping appointments for same doctor/time via POST /api/appointments
- [ ] Cannot create more than 2 overlapping appointments via follow-up scheduler
- [ ] Doctor can delete follow-up appointment only if sourceEncounterId matches current encounter
- [ ] Delete request requires encounterId query parameter for doctors
- [ ] Delete button only appears when all conditions are met
- [ ] Admin/receptionist can delete any appointment
- [ ] Provenance fields (createdByUserId, source, sourceEncounterId) are set correctly
- [ ] Past appointments cannot be deleted by doctors
- [ ] Capacity indicator shows correct values
- [ ] Error messages are user-friendly and in correct language

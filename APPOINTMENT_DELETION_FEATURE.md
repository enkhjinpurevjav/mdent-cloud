# Doctor Follow-Up Appointment Deletion Feature

## Overview
This feature allows doctors to hard-delete only their own future follow-up appointments that were created from the Encounter follow-up scheduler. Admin and reception permissions remain unchanged - they can delete any appointment.

## Implementation Summary

### Database Changes
The `Appointment` model now includes provenance tracking fields:
- `createdByUserId` (Int?, nullable) - FK to User who created the appointment
- `source` (String?, nullable) - Source of appointment creation (e.g., 'FOLLOW_UP_ENCOUNTER', 'CALENDAR')
- `sourceEncounterId` (Int?, nullable) - FK to Encounter if created from encounter flow

These fields are automatically populated when creating follow-up appointments via the encounter scheduler.

### Backend Changes

#### New Middleware (`backend/src/middleware/auth.js`)
- `optionalAuthenticateJWT` - New middleware that allows requests without authentication but populates `req.user` if a valid JWT token is provided. This ensures backward compatibility with existing code that doesn't send authentication tokens.

#### Updated Endpoints

**POST `/api/encounters/:id/follow-up-appointments`**
- Now uses `optionalAuthenticateJWT` middleware
- Sets provenance fields when creating appointments:
  ```javascript
  createdByUserId: req.user?.id || null,
  source: "FOLLOW_UP_ENCOUNTER",
  sourceEncounterId: encounterId
  ```

**DELETE `/api/appointments/:id`** (NEW)
- Requires authentication via `authenticateJWT` middleware
- Enforces role-based permissions:
  - **Doctors**: Can only delete appointments where:
    - `appointment.createdByUserId === req.user.id` (they created it)
    - `appointment.source === 'FOLLOW_UP_ENCOUNTER'` (from encounter flow)
    - `appointment.scheduledAt > now` (scheduled in the future)
  - **Admin/Receptionist**: Can delete any appointment
  - **Other roles**: No delete permission
- Returns:
  - `200` with success message on successful deletion
  - `403` with error message if permission denied
  - `404` if appointment not found
  - `401` if not authenticated

**GET `/api/appointments`**
- Now includes provenance fields in response:
  ```javascript
  {
    // ... existing fields
    createdByUserId: number | null,
    source: string | null,
    sourceEncounterId: number | null
  }
  ```

### Frontend Changes

#### FollowUpScheduler Component (`frontend/components/encounter/FollowUpScheduler.tsx`)
- New props:
  - `currentUserId?: number` - Current logged-in user ID
  - `currentUserRole?: string` - Current user role (doctor, admin, receptionist, etc.)
  - `onDeleteAppointment?: (appointmentId: number) => Promise<void>` - Delete handler
- New UI features:
  - Delete button ("Устгах") shown on appointment cards in details modal
  - Button only visible for appointments the current user can delete (based on `canDeleteAppointment` function)
  - Confirmation dialog before deletion
  - Loading state while deleting
  - Auto-reload of availability after successful deletion

#### Encounter Page (`frontend/pages/encounters/[id].tsx`)
- New function: `deleteFollowUpAppointment(appointmentId: number)`
  - Calls `DELETE /api/appointments/:id`
  - Shows success/error messages
  - Reloads availability grid after deletion
- Passes current user info to FollowUpScheduler:
  - `currentUserId={encounter?.doctorId}` (assumes doctor viewing their own encounter)
  - `currentUserRole="doctor"` (hardcoded for encounter page context)

## Deployment Instructions

### 1. Database Migration
The schema changes will be applied automatically via `prisma db push` when the Docker container starts (see `backend/docker-entrypoint.sh`).

To apply manually if needed:
```bash
cd backend
npx prisma db push
```

### 2. Environment Variables
Ensure `JWT_SECRET` is set in your environment. This is used to verify JWT tokens for authenticated requests.

### 3. Authentication Setup (IMPORTANT)

⚠️ **Critical**: The delete functionality requires proper JWT authentication to work correctly. Currently, the frontend does not send JWT tokens with API requests.

To enable full functionality, you need to:

1. **Store JWT token after login** - Update `frontend/components/LoginForm.tsx` to save the token:
   ```typescript
   if (res.ok) {
     // Store token in localStorage or secure cookie
     localStorage.setItem('token', data.token);
     // Or use a more secure method like httpOnly cookies
   }
   ```

2. **Send token with API requests** - Create a fetch wrapper that includes the Authorization header:
   ```typescript
   // frontend/utils/api.ts
   export async function authenticatedFetch(url: string, options: RequestInit = {}) {
     const token = localStorage.getItem('token');
     return fetch(url, {
       ...options,
       headers: {
         ...options.headers,
         'Authorization': token ? `Bearer ${token}` : '',
       },
     });
   }
   ```

3. **Update encounter page to use authenticated fetch** for the delete operation:
   ```typescript
   const res = await authenticatedFetch(`/api/appointments/${appointmentId}`, {
     method: "DELETE",
   });
   ```

**Temporary Workaround**: Until authentication is fully implemented:
- Follow-up appointments created without authentication will have `createdByUserId = null`
- Only admin/receptionist users (once authenticated) can delete these appointments
- Once authentication is in place, new appointments will be properly tracked and doctors will be able to delete their own

### 4. Testing Checklist

#### Backend Testing
- [ ] Start the backend with database connection
- [ ] Verify Prisma schema updated successfully (check for appointment table columns)
- [ ] Test POST `/api/encounters/:id/follow-up-appointments` without auth token (should work, createdByUserId=null)
- [ ] Test POST `/api/encounters/:id/follow-up-appointments` with valid JWT token (should work, createdByUserId=userId)
- [ ] Test DELETE `/api/appointments/:id` without auth token (should return 401)
- [ ] Test DELETE `/api/appointments/:id` as doctor for their own follow-up appointment (should work)
- [ ] Test DELETE `/api/appointments/:id` as doctor for someone else's appointment (should return 403)
- [ ] Test DELETE `/api/appointments/:id` as doctor for past appointment (should return 403)
- [ ] Test DELETE `/api/appointments/:id` as admin (should work for any appointment)

#### Frontend Testing
- [ ] Build succeeds without errors
- [ ] Navigate to an encounter page (`/encounters/[id]`)
- [ ] Enable follow-up scheduler
- [ ] Create a new follow-up appointment
- [ ] Click on an occupied time slot to open details modal
- [ ] Verify appointment details are shown
- [ ] Look for "Устгах" (Delete) button on appointments
  - If authentication is not set up, button may not appear or be disabled
- [ ] Click delete button and confirm
- [ ] Verify appointment is deleted and availability refreshes
- [ ] Verify success message appears

#### Permission Testing
Once authentication is fully implemented:
- [ ] As Doctor A, create follow-up appointment → Doctor A sees delete button
- [ ] As Doctor A, try to view Doctor B's encounter appointments → No delete button should appear
- [ ] As Admin, view any appointment → Delete button should appear
- [ ] As Receptionist, view any appointment → Delete button should appear

## Timezone Considerations

The future appointment check (`appointment.scheduledAt > now`) uses server time. The server is configured to run in Asia/Ulaanbaatar timezone (UTC+8). This is consistent with the rest of the appointment system.

## Security Notes

1. **Authentication Required for Delete**: The DELETE endpoint always requires valid JWT authentication, preventing unauthorized deletions.

2. **Role-Based Access Control**: The permission logic is implemented on the backend, not just the frontend, ensuring security even if frontend code is bypassed.

3. **Audit Trail**: The provenance fields (`createdByUserId`, `source`, `sourceEncounterId`) provide an audit trail of who created each appointment and from where.

4. **No Cascade Deletes**: Deleting an appointment does NOT delete related encounters. This prevents accidental data loss.

## Troubleshooting

### "Missing or invalid token" error when deleting
- **Cause**: Authentication not set up properly in frontend
- **Solution**: Implement JWT token storage and transmission as described in "Authentication Setup" section above

### Delete button not visible
- **Cause 1**: Current user info not passed correctly to component
- **Solution**: Check that `currentUserId` and `currentUserRole` props are being passed to FollowUpScheduler

- **Cause 2**: Appointment doesn't meet deletion criteria
- **Solution**: Verify appointment was created by current doctor, from follow-up flow, and is scheduled in future

### "Та зөвхөн өөрийн үүсгэсэн цагийг устгах боломжтой" error
- **Cause**: Doctor trying to delete appointment created by someone else
- **Solution**: This is expected behavior. Only the doctor who created the appointment (or admin/receptionist) can delete it.

### "Өнгөрсөн цагийг устгах боломжгүй" error  
- **Cause**: Trying to delete appointment in the past
- **Solution**: This is expected behavior. Past appointments cannot be deleted.

## Future Enhancements

1. **Soft Delete Option**: Consider implementing soft delete (marking as cancelled) instead of hard delete for audit purposes

2. **Delete Confirmation with Details**: Show more appointment details in the confirmation dialog

3. **Bulk Delete**: Allow deleting multiple appointments at once

4. **Delete Reasons**: Track why appointments were deleted (patient cancelled, rescheduled, etc.)

5. **Notification on Delete**: Notify patient when their appointment is deleted

## Related Files

### Backend
- `backend/prisma/schema.prisma` - Database schema with new fields
- `backend/src/middleware/auth.js` - Authentication middleware
- `backend/src/routes/appointments.js` - DELETE endpoint implementation
- `backend/src/routes/encounters.js` - Follow-up creation with provenance

### Frontend
- `frontend/components/encounter/FollowUpScheduler.tsx` - Delete UI and logic
- `frontend/pages/encounters/[id].tsx` - Delete handler and user context

## Support

For questions or issues with this feature, please contact the development team or create an issue in the repository.

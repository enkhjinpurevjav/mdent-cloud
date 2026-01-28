# M DENT SOFTWARE — COMPLETE OVERVIEW

## System Architecture

M Dent Cloud is a comprehensive dental clinic management system built with:
- **Backend**: Express.js with Prisma ORM
- **Database**: PostgreSQL
- **Frontend**: Next.js with React and TypeScript
- **Deployment**: Docker Compose with Caddy for HTTPS

## Multi-Branch Operation

### Branch Views and Permissions

The system supports multiple clinic branches with role-based access control:

#### "Бүх салбар" (All Branches) View
- Available only to **admin** and **manager** roles
- Shows aggregated data across all branches
- Used for:
  - System-wide reporting and analytics
  - Cross-branch patient lookup
  - Overall business performance monitoring
  - Staff management across all locations

#### Branch-Specific Views
- Available to all users (filtered by their assigned branch)
- Shows only data for the user's assigned branch(es)
- Used for:
  - Daily appointment scheduling
  - Patient treatment and encounters
  - Branch-specific financial reporting
  - Local inventory management

### Data Isolation Rules

1. **Appointments**: Always tied to a specific branch (`branchId`)
2. **Patients**: System-wide (can visit any branch)
3. **Encounters**: Tied to appointment branch
4. **Invoices**: Tied to encounter's branch
5. **Users/Staff**: Can be assigned to specific branches
6. **Services**: Can be branch-specific or system-wide

## Appointment Status Flow

The system uses the following appointment statuses to track the patient journey:

### Status Definitions

| Status | Mongolian | Description | Actions Available |
|--------|-----------|-------------|-------------------|
| `booked` | Захиалсан | Initial appointment scheduled | Can start encounter, edit, cancel |
| `confirmed` | Баталгаажсан | Appointment confirmed by patient/staff | Can start encounter, edit, cancel |
| `online` | Онлайн | Online consultation appointment | Can start encounter, edit, cancel |
| `ongoing` | Явагдаж байна | Treatment in progress | Can continue encounter, complete treatment |
| `ready_to_pay` | Төлбөр төлөх | Treatment completed, awaiting payment | **Can collect payment**, view encounter |
| `partial_paid` | Үлдэгдэлтэй | **Partial payment received** | **Can collect remaining payment**, view encounter |
| `completed` | Дууссан | Fully paid and finished | View only (read-only) |
| `cancelled` | Цуцалсан | Appointment cancelled | View only |
| `no_show` | Ирээгүй | Patient did not show up | View only |
| `other` | Бусад | Other status | Configurable |

### Status Transition Rules

```
booked/confirmed/online
    ↓ (start encounter)
ongoing
    ↓ (mark ready for payment)
ready_to_pay
    ↓ (receive partial payment)
partial_paid ⟷ (receive more payments)
    ↓ (fully paid)
completed
```

### Payment-Based Status Updates

After each payment settlement, the system automatically updates appointment status:

- **No payment** (`paidTotal == 0`): `ready_to_pay`
- **Partial payment** (`0 < paidTotal < finalAmount`): `partial_paid`
- **Full payment** (`paidTotal >= finalAmount`): `completed`

This logic is enforced server-side in the settlement endpoint.

## Payment and Settlement

### Settlement Rules (NEW)

**Settlement gating**: Payment can only be collected when appointment status is:
- `ready_to_pay` - Initial payment collection
- `partial_paid` - Collecting remaining balance

Attempting to settle an invoice with any other appointment status will return a **400 error**.

### Payment Methods

The system supports multiple payment methods:
- **CASH** - Cash payment
- **QPAY** - QPay digital payment
- **POS** - Credit/debit card via POS terminal
- **FIN_APP** - Finance application
- **BOOKING_ADVANCE** - Advance payment at booking
- **INSURANCE_*** - Insurance payments (pending/settled)
- **EMPLOYEE_VOUCHER** - Employee benefit vouchers
- **BARTER** - Barter/exchange transactions
- **REFUND** - Refunds

### Invoice Status

Separate from appointment status, invoices have their own status:
- `UNPAID` - No payment received
- `PARTIAL` - Partially paid
- `PAID` - Fully paid
- `INSURANCE_PENDING` - Awaiting insurance settlement

## Data Models Overview

### Core Entities

1. **Patient** - Patient demographics and medical records
2. **PatientBook** - Patient visit history
3. **Appointment** - Scheduled appointments
4. **Encounter** - Clinical visit record (diagnoses, treatments, etc.)
5. **Invoice** - Financial billing record
6. **Payment** - Payment transactions (legacy)
7. **LedgerEntry** - Financial ledger (new, recommended)

### Relationships

```
Patient
  ↓ has many
PatientBook
  ↓ has many
Encounter ← links to → Appointment
  ↓ has one
Invoice
  ↓ has many
Payment / LedgerEntry
```

## User Roles

- **admin** - Full system access, all branches
- **manager** - Management access, all branches, reporting
- **doctor** - Clinical access, assigned branch(es)
- **receptionist** - Scheduling, patient intake, assigned branch
- **accountant** - Financial access, assigned branch(es)
- **nurse** - Clinical support, assigned branch

## Key Features

### Appointment Management
- Multi-branch scheduling calendar
- Status-based workflow automation
- Patient search and booking
- Doctor assignment and schedules

### Clinical Workflow
- Digital encounter documentation
- Tooth charting
- Diagnosis recording with ICD codes
- Treatment planning and tracking
- Prescription generation
- Consent form management

### Financial Management
- Service and product pricing
- Invoice generation from encounters
- Multi-method payment settlement
- Discount management (0%, 5%, 10%)
- Collection discounts
- E-Barimt receipt integration
- Employee benefit vouchers

### Reporting
- Daily income reports (by branch/doctor)
- Patient balance reports
- Staff income summaries
- Appointment statistics
- Service utilization tracking

### Inventory
- Product catalog
- Stock tracking by branch
- Automatic stock deduction on paid invoices
- Stock movement history

## Frontend Structure

### Main Pages
- `/appointments` - Appointment calendar and list
- `/visits/booked` - Scheduled visits (Цаг захиалсан)
- `/visits/ongoing` - Active treatments (Үзлэг хийж буй)
- `/visits/completed` - Completed visits (Дууссан)
- `/patients` - Patient management
- `/reports` - Financial and operational reports
- `/admin/*` - Administrative functions

### Status Filters

The visit pages filter appointments by status:
- **Цаг захиалсан** (Booked): `booked`, `confirmed`, `online` (includes cancelled if toggled)
- **Үзлэг хийж буй** (Ongoing): `ongoing`
- **Дууссан** (Completed): `completed`, `ready_to_pay`, `partial_paid`

Note: `ready_to_pay` and `partial_paid` appear in "Дууссан" list because the clinical treatment is complete, even though financial settlement may be pending.

## API Endpoints

### Appointments
- `GET /api/appointments` - List appointments with filters
- `POST /api/appointments` - Create new appointment
- `PATCH /api/appointments/:id` - Update appointment
- `DELETE /api/appointments/:id` - Delete appointment
- `GET /api/appointments/:id/encounter` - Get encounter for payment

### Invoices
- `GET /api/invoices/:id` - Get invoice details
- `POST /api/invoices/:id/settlement` - Record payment (with status gating)

### Patients
- `GET /api/patients` - Search patients
- `POST /api/patients` - Register new patient
- `PATCH /api/patients/:id` - Update patient

## Development

### Backend Development
```bash
cd backend
npm install
npm run dev
```

### Frontend Development
```bash
cd frontend
npm install
npm run dev
```

### Database Migration
```bash
cd backend
npx prisma migrate dev
npx prisma generate
```

## Status Validation and Normalization

The backend normalizes various status input formats to standardized lowercase values:

- Frontend may send: `READY_TO_PAY`, `ReadyToPay`, `ready-to-pay`
- Backend normalizes to: `ready_to_pay`
- Same pattern for all statuses including the new `partial_paid`

This ensures consistency across the system regardless of input format.

## Best Practices

### When to Use Each Status

1. **Use `booked`** when patient first schedules
2. **Use `confirmed`** after phone/SMS confirmation
3. **Use `ongoing`** when doctor starts treatment
4. **Use `ready_to_pay`** when treatment complete but unpaid
5. **Use `partial_paid`** automatically set when partial payment received
6. **Use `completed`** automatically set when fully paid
7. **Use `cancelled`** if patient cancels before treatment
8. **Use `no_show`** if patient doesn't arrive

### Settlement Workflow

1. Patient completes treatment → Doctor marks as `ready_to_pay`
2. Receptionist opens appointment → Clicks "Төлбөр авах"
3. System validates appointment status (must be `ready_to_pay` or `partial_paid`)
4. Receptionist enters payment amount and method
5. System records payment and automatically updates status:
   - If partial → `partial_paid`
   - If full → `completed`
6. Receipt generated (e-Barimt if enabled)

### Multi-Branch Reporting

1. Admins/managers can toggle "Бүх салбар" view
2. Branch-specific users only see their assigned branch(es)
3. Reports aggregate correctly across branches
4. Patient records are system-wide but encounters are branch-specific

---

**Last Updated**: January 2026
**Version**: 2.0 with `partial_paid` status support

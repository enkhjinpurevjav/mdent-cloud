# M DENT Cloud - Sterilization Module (V1)

## Overview

The Sterilization Module manages autoclave cycles, sterilized tool tracking, and ensures proper inventory control for dental procedures. This v1 implementation introduces branch-scoped tool management, cycle tracking with PASS/FAIL certification, draft attachment workflow, and billing gates.

## Key Concepts

### 1. Branch Tool Master
- Each branch maintains its own catalog of sterilizable tools
- Tool names must be unique within a branch (can be duplicated across branches)
- Tools have a baseline quantity for reference (not enforced stock)

### 2. Autoclave Cycles
- Represent individual autoclave runs with certificate numbers (codes)
- Each cycle has:
  - **Code**: Autoclave certificate number (e.g., T-975, M-123)
  - **Machine Number**: Physical autoclave machine identifier
  - **Completion Date/Time**: When the cycle finished
  - **Result**: PASS or FAIL
  - **Operator**: Person who ran the cycle
  - **Notes**: Optional additional information
- One cycle can sterilize multiple tool types (tool lines)

### 3. Cycle Tool Lines
- Under each cycle, multiple tool lines specify what was produced
- Each line links:
  - **Tool**: Which tool was sterilized
  - **Produced Quantity**: How many units were sterilized
- Codes can overlap across tool types (same code T-975 can have lines for different tools)
- Unique constraint: One line per (cycle, tool) combination

### 4. Draft Attachments
- When doctors select sterilization during diagnosis, attachments are created as **drafts**
- Drafts do NOT decrement available inventory immediately
- Drafts record:
  - Diagnosis row
  - Cycle and tool selected
  - Requested quantity
- Drafts can be added/removed freely before encounter close

### 5. Finalization on Encounter Close
- When encounter is finished (closed), the system:
  1. Gathers all draft attachments for the encounter
  2. Groups by (cycle, tool) and sums requested quantities
  3. Checks availability: `remaining = producedQty - sum(finalized uses)`
  4. Creates finalized usage records for `min(requested, available)`
  5. Creates mismatch records for any shortfall `max(0, requested - available)`
- **Idempotency**: Closing an encounter twice will not double-finalize

### 6. Sterilization Mismatches
- Created when requested quantity exceeds available inventory
- Contains:
  - Encounter, branch, tool, cycle code
  - Required quantity, finalized quantity, mismatch quantity
  - Status: UNRESOLVED or RESOLVED
- Blocks billing until resolved

### 7. Mismatch Resolution
- Nurses, managers, or admins can resolve mismatches
- Resolution creates an **adjustment consumption** record
- Adjustment tracks:
  - Tool, code, quantity adjusted
  - Who resolved it and when
  - Optional note
- Does NOT make actual stock negative (override/manual accounting)
- Marks mismatch as RESOLVED

### 8. Billing Gate
- Invoice creation is allowed even with unresolved mismatches
- **Billing finalization (payment settlement) is blocked** if encounter has any UNRESOLVED mismatches
- Error message directs user to resolve mismatches first
- After resolution, billing can proceed normally

## User Workflows

### Nurse: Create Autoclave Cycle
1. Go to Sterilization > Cycles > New
2. Select branch
3. Enter cycle code (e.g., T-975)
4. Enter machine number
5. Set completion date/time
6. Select result: PASS or FAIL
7. Enter operator name
8. Add tool lines:
   - Select tool from branch catalog
   - Enter produced quantity
   - Add more lines as needed
9. Save cycle

**Note**: FAIL cycles are saved but hidden from doctor selection.

### Doctor: Attach Sterilization to Diagnosis
1. Open patient encounter
2. Add diagnosis entry
3. In sterilization section:
   - Select tool
   - System shows active indicators: "ToolName — Code" (PASS only, remaining > 0)
   - Select indicator and quantity
   - Click "Attach" (creates draft, does NOT decrement)
4. Continue with diagnosis
5. Can remove/change draft attachments freely

### Doctor: Close Encounter
1. Complete all diagnosis and service entries
2. Click "Finish Encounter" (Үзлэг дуусгах)
3. System automatically:
   - Finalizes sterilization draft attachments
   - Creates mismatch records if insufficient inventory
   - Transitions to ready_to_pay status

### Receptionist/Accountant: Create Invoice (with mismatches)
1. Open encounter
2. Create invoice as normal
3. **Invoice creation succeeds** even if mismatches exist
4. Cannot finalize payment until mismatches resolved

### Nurse/Manager: Resolve Mismatches
1. Go to Sterilization > Mismatches
2. View unresolved mismatches grouped by encounter
3. Click "Resolve" for an encounter
4. Enter resolver name and optional note
5. Confirm resolution
6. System creates adjustment consumption records
7. Marks all encounter mismatches as RESOLVED

### Receptionist/Accountant: Complete Billing (after resolution)
1. Return to invoice/billing page
2. Mismatch warning is gone
3. Can now process payment settlement
4. Complete transaction

## Data Models

### AutoclaveCycle
- `branchId`: Branch where cycle was run
- `code`: Certificate number (unique within branch)
- `machineNumber`: Machine identifier
- `completedAt`: Completion timestamp
- `result`: PASS or FAIL
- `operator`: Operator name
- `notes`: Optional notes

### AutoclaveCycleToolLine
- `cycleId`: Parent cycle
- `toolId`: Tool sterilized
- `producedQty`: Quantity produced

### SterilizationDraftAttachment
- `encounterDiagnosisId`: Diagnosis row
- `cycleId`: Selected cycle
- `toolId`: Selected tool
- `requestedQty`: Quantity requested

### SterilizationFinalizedUsage
- `encounterId`: Encounter
- `toolLineId`: Tool line consumed from
- `usedQty`: Quantity finalized

### SterilizationMismatch
- `encounterId`: Encounter with mismatch
- `branchId`, `toolId`, `code`: What was short
- `requiredQty`, `finalizedQty`, `mismatchQty`: Quantities
- `status`: UNRESOLVED or RESOLVED

### SterilizationAdjustmentConsumption
- `mismatchId`: Resolved mismatch
- `encounterId`, `branchId`, `toolId`, `code`: Context
- `quantity`: Adjustment amount
- `resolvedByUserId`, `resolvedByName`: Who resolved
- `note`: Optional note
- `resolvedAt`: Timestamp

## API Endpoints

### Tool Master
- `GET /api/sterilization/items?branchId={id}` - List tools by branch
- `POST /api/sterilization/items` - Create tool (requires branchId)
- `PATCH /api/sterilization/items/:id` - Update tool
- `DELETE /api/sterilization/items/:id` - Delete tool

### Cycles
- `GET /api/sterilization/cycles?branchId={id}&result={PASS|FAIL}` - List cycles
- `POST /api/sterilization/cycles` - Create cycle with tool lines
- `GET /api/sterilization/cycles/active-indicators?branchId={id}&toolId={id}` - Get active indicators for doctor selection

### Draft Attachments
- `POST /api/sterilization/draft-attachments` - Create draft
- `DELETE /api/sterilization/draft-attachments/:id` - Remove draft

### Mismatches
- `GET /api/sterilization/mismatches?encounterId={id}&status={UNRESOLVED|RESOLVED}` - List mismatches
- `POST /api/sterilization/mismatches/:encounterId/resolve` - Resolve all mismatches for encounter

### Encounters
- `PUT /api/encounters/:id/finish` - Finish encounter (auto-finalizes sterilization)

### Invoices
- `POST /api/invoices/:id/settlement` - Payment settlement (blocked if unresolved mismatches)

## Business Rules

1. **Tools are branch-scoped**: Cannot be shared across branches
2. **FAIL cycles are hidden**: Only PASS cycles appear in doctor selection
3. **Draft attachments don't decrement**: Inventory only decrements on finalization
4. **Finalization is idempotent**: Encounter can only be finalized once
5. **Mismatches block billing**: Payment settlement requires all mismatches resolved
6. **Adjustments don't affect stock**: They're accounting entries, not inventory transactions
7. **Resolution is per-encounter**: All mismatches for an encounter resolved together

## Reports & Monitoring

### For Nurses
- **Mismatch Queue**: Shows all unresolved mismatches needing attention
- **Cycle History**: Review past cycles and their results

### For Management
- **Usage Reports**: Track sterilization consumption by branch/period
- **Mismatch Trends**: Identify frequent shortfalls for inventory planning
- **Adjustment Audit**: Review manual overrides and resolutions

### For Accounting
- **Billing Blocks**: Track encounters with unresolved sterilization issues
- **Resolution Log**: Audit trail of mismatch resolutions

## Migration from Old System

The old system used `SterilizationIndicator` model which combined package concept with indicator tracking. The v1 system separates:
- **Tools** (SterilizationItem with branchId)
- **Cycles** (AutoclaveCycle)
- **Tool Lines** (AutoclaveCycleToolLine)

### Migration Steps
1. Existing SterilizationItems get assigned to first branch (via migration)
2. Admin reviews and reassigns tools to correct branches
3. Old SterilizationIndicator records remain for historical reporting
4. New entries use the v1 cycle-based workflow
5. Both systems can coexist during transition

## Future Enhancements (Not in V1)

- Automated expiry logic for cycles
- Photo/scan upload for cycle certificates
- Integration with autoclave machines for automatic cycle recording
- Barcode/QR code scanning for tool selection
- Stock forecasting based on usage patterns
- Multi-level approval for adjustments
- Email/notification for mismatch alerts

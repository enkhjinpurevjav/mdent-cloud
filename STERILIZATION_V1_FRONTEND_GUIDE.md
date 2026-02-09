# V1 Sterilization Frontend Implementation Guide

## Overview
This document describes the frontend changes needed to support the v1 branch-scoped sterilization workflow.

## Pages to Update/Create

### 1. Tool Master Settings (`/sterilization/settings.tsx`)
**Changes needed:**
- Add branch selector dropdown at the top of items section
- Update item creation form to require branch selection
- Filter items display by selected branch
- Include branch name in item list display
- Update API calls to include `branchId` parameter

**Key changes:**
```typescript
// Add to state
const [selectedBranchId, setSelectedBranchId] = useState<number | "">("");
const [branches, setBranches] = useState<Branch[]>([]);

// Load branches on mount
useEffect(() => {
  fetch("/api/branches").then(r => r.json()).then(setBranches);
}, []);

// Update create item
const createItem = async () => {
  // ... validation ...
  const res = await fetch("/api/sterilization/items", {
    method: "POST",
    body: JSON.stringify({ 
      name, 
      branchId: selectedBranchId,
      baselineAmount 
    }),
  });
};

// Update load items to filter by branch
const loadItems = async () => {
  const url = selectedBranchId 
    ? `/api/sterilization/items?branchId=${selectedBranchId}`
    : `/api/sterilization/items`;
  // ...
};
```

### 2. Cycle Creation Page (`/sterilization/cycles/new.tsx`) - NEW
**Purpose:** Create autoclave cycles with multiple tool lines

**Required fields:**
- Branch selector (required)
- Cycle code (text input, auto-prefixed with branch code)
- Machine number (text input)
- Completion date/time (datetime picker)
- Result (PASS/FAIL radio buttons)
- Operator name (text input)
- Notes (textarea, optional)
- Tool lines (dynamic list):
  - Tool selector (dropdown filtered by selected branch)
  - Produced quantity (number input)
  - Add/Remove line buttons

**Validation:**
- All required fields must be filled
- At least one tool line required
- Each tool line must have valid tool and qty >= 1
- Code must be unique within branch

**API call:**
```typescript
POST /api/sterilization/cycles
Body: {
  branchId, code, machineNumber, completedAt,
  result: "PASS" | "FAIL",
  operator, notes,
  toolLines: [{ toolId, producedQty }, ...]
}
```

### 3. Cycle List Page (`/sterilization/cycles.tsx`) - NEW
**Purpose:** View all cycles with filtering

**Features:**
- Filter by branch
- Filter by result (PASS/FAIL)
- Display columns: Code, Machine, Completed At, Result, Operator, Tool Count
- Click to expand and show tool lines
- Color code PASS (green) vs FAIL (red)

**API call:**
```typescript
GET /api/sterilization/cycles?branchId={id}&result={PASS|FAIL}
```

### 4. Doctor Diagnosis Entry - Update Draft Attachment UI
**Location:** Likely in `/encounters/[id].tsx` or diagnosis component

**Changes needed:**
1. Replace current sterilization indicator selector
2. New workflow:
   - Step 1: Select tool (dropdown with branch tools)
   - Step 2: Show active indicators for that tool (formatted as "ToolName — Code")
   - Step 3: Select indicator and quantity
   - Step 4: Click "Attach" to create draft (does NOT decrement)

**API calls:**
```typescript
// Get active indicators for tool
GET /api/sterilization/cycles/active-indicators?branchId={id}&toolId={id}

// Create draft attachment
POST /api/sterilization/draft-attachments
Body: { encounterDiagnosisId, cycleId, toolId, requestedQty }

// Remove draft
DELETE /api/sterilization/draft-attachments/{id}
```

**Display:**
- Show attached drafts in diagnosis card
- Format: "Tool: {toolName}, Code: {code}, Qty: {requestedQty}"
- Each with a remove button (X)
- Do NOT show current/remaining counts (those are for actual usage)

### 5. Mismatch Queue Page (`/sterilization/mismatches.tsx`) - NEW
**Purpose:** View and resolve sterilization mismatches

**Features:**
- List unresolved mismatches grouped by encounter
- Show: Patient, Visit Date, Tool, Code, Required, Finalized, Mismatch Qty
- "Resolve" button per encounter
- Resolution modal:
  - Display all mismatches for encounter
  - Input: Resolver name, optional note
  - Confirm button

**Role access:** Nurse, Manager, Admin only

**API calls:**
```typescript
// List mismatches
GET /api/sterilization/mismatches?status=UNRESOLVED

// Resolve
POST /api/sterilization/mismatches/{encounterId}/resolve
Body: { resolvedByName, resolvedByUserId?, note? }
```

### 6. Billing/Invoice Page - Add Mismatch Warning
**Location:** Billing or invoice page

**Changes needed:**
- Before allowing payment settlement, check encounter for mismatches
- Display warning banner if unresolved mismatches exist:
  - "⚠️ Ариутгалын тохиргоо дутуу байна. Төлбөр батлах боломжгүй."
  - Link to mismatch resolution page
  - Disable payment/settlement buttons

**Check on page load:**
```typescript
// If encounterId available
GET /api/sterilization/mismatches?encounterId={id}&status=UNRESOLVED
// If result.length > 0, show warning
```

**Error handling:**
- When settlement API returns error code "UNRESOLVED_STERILIZATION_MISMATCH"
- Display friendly Mongolian error message
- Guide user to resolve mismatches first

## Navigation Updates

Add menu items:
- Sterilization > Cycles (new)
- Sterilization > Mismatches (new, nurse/manager/admin only)

## Styling Notes

- Use existing app styles and components
- PASS cycles: green indicator/badge
- FAIL cycles: red indicator/badge (hidden from doctor selection)
- Unresolved mismatches: yellow/warning color
- Resolved mismatches: green/success color

## Testing Checklist

1. Create branch-scoped tools
2. Create PASS and FAIL cycles with tool lines
3. Verify FAIL cycles don't appear in doctor selection
4. Attach draft indicators to diagnosis
5. Finish encounter and verify finalization
6. Check mismatch creation when oversubscribed
7. Resolve mismatches
8. Verify billing gate blocks payment with unresolved mismatches
9. Verify billing works after resolution

## Migration Notes for Existing Data

- Existing SterilizationItems need branchId
- Migration will assign them to first branch
- Admin should review and reassign if needed
- Old SterilizationIndicator records remain for historical reporting
- New workflow uses AutoclaveCycle + toolLines

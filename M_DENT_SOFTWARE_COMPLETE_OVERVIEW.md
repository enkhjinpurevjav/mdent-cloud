# M DENT SOFTWARE — COMPLETE OVERVIEW

## 1. Introduction

M DENT Cloud is a comprehensive dental practice management system designed to handle patient records, appointments, treatment planning, inventory management, billing, and sterilization tracking. The system provides a unified platform for dental clinics to manage their daily operations efficiently.

## 2. System Architecture

### Technology Stack
- **Frontend**: Next.js 14 + React 18 + TypeScript 5
- **Backend**: Express.js with Node.js + Prisma ORM
- **Database**: PostgreSQL (managed by Prisma)
- **Authentication**: JWT + bcryptjs
- **Deployment**: Docker Compose with Caddy reverse proxy

### Core Components
- Multi-branch support with branch-specific data isolation
- Role-based access control (Admin, Doctor, Nurse, Receptionist)
- Real-time data synchronization
- RESTful API architecture

## 3. Key Features

### Multi-Branch Management
- Each clinic can operate multiple branches
- Branch-specific inventory and tool catalogs
- Centralized reporting and oversight
- Branch-level user assignments

### User Management
- Role-based permissions
- User authentication and authorization
- Activity logging and audit trails

### Patient Management
- Comprehensive patient records
- Medical history tracking
- Treatment plans and documentation
- Patient portal access

## 4. Core Modules

### 4.1 Patient & Appointment Management
- **Patient Records**: Demographic information, contact details, medical history
- **Appointments**: Scheduling, calendar view, reminders, status tracking
- **Treatment Plans**: Multi-visit treatment workflows, progress tracking

### 4.2 Clinical Records & Patient History
- **Treatment Documentation**: Detailed procedure notes, tooth charts
- **Digital Forms**: Consent forms, medical questionnaires
- **Document Management**: File attachments, imaging integration

#### Digital History Book System
The system implements two distinct patient-card related modules following Mongolian Health Ministry requirements:

**Үйлчлүүлэгчийн карт (Patient Card / History Book View)** - Ministry-Required Read-Only Document
- **Purpose**: Official ministry-compliant patient history record for audit and reporting
- **Access**: Read-only, printable A4 format
- **Location**: Patient profile → "Үйлчлүүлэгчийн карт" tab
- **Data Sources**:
  - **Header Section**: 
    - Clinic logo (branch-agnostic, single logo for all branches)
    - Card fill date (from patient-filled visit card signed date or fallback to created/updated date)
    - Patient demographics: Book number, ovog/name, birthDate, regNo, gender, age (calculated), phone, email, address, workPlace
    - All demographic fields sourced from Patient master record ("Үндсэн мэдээлэл")
  - **Questionnaire Sections**: 
    - Adult or Child visit card answers (VisitCard.answers JSON)
    - Prevention questions (reason for visit, previous dental visits)
    - General medical history questions
    - One card per patient (either ADULT or CHILD type)
  - **Encounter Table**: One row per diagnosis entry, not per encounter
    - Он/сар/өдөр: Encounter.visitDate
    - Шүдний дугаар: EncounterDiagnosis.toothCode (verbatim text, can be single tooth, range, or any text)
    - Бодит үзлэг, зовиур: Multi-line cell with complaint chips from EncounterDiagnosisProblemText
    - Онош: Diagnosis.code only (stripped of description, e.g., `K01.8` not `K01.8 – test onosh`)
    - Эмчилгээ: EncounterService texts assigned to diagnosis (via meta.diagnosisId), sorted by order
    - Индикатор: Sterilization tool names from EncounterDiagnosisSterilizationIndicator (format: tool/indicator)
    - Тэмдэглэл: EncounterDiagnosis.note
    - Эмч болон сувилагч: Doctor/Nurse initials format `О.Нэр`, combined as `Д.Эмч / С.Сувилагч`
- **Print Features**:
  - Print button with filter controls
  - Date range filtering for encounter rows
  - Toggles to show/hide header, questionnaire, or table sections
  - CSS @media print optimized for A4 paper
  - Page break handling for long tables

**Карт бөглөх (Patient Intake Form)** - Patient-Level Intake Questionnaire
- **Purpose**: Collect patient medical history and questionnaire responses during intake
- **Access**: Editable form for patients and staff (previously labeled "Үзлэгийн карт")
- **Location**: Patient profile → "Карт бөглөх" tab
- **Form Types**: Two distinct intake questionnaires
  - **Adult Form**: Standard adult patient intake questionnaire
  - **Child Form**: Pediatric patient intake questionnaire
- **Form Type Selection**:
  - Staff can manually choose or switch between Adult and Child form types
  - No automatic switching based on registration number (regNo) or age
  - **Important**: Switching form type always requires a new signature
- **Active Form Resolution**:
  - If both Adult and Child forms exist for a patient (legacy/test scenarios):
    - The **active/visible** form is the one with the latest saved timestamp
    - Timestamp updated when user clicks the save button ("Хадгалах")
- **Storage**: VisitCard table (one active form per patient at a time)
- **Data Fields**: 
  - Type: ADULT | CHILD (enum)
  - Answers: JSON object with all form responses
  - Patient/guardian signature: file upload with path and signedAt timestamp
  - Updated timestamp: tracks when save button was clicked (for active form resolution)
- **Signature Requirements**:
  - Signature UI is shared between form types, but label/legal text differs:
    - **Child Form**: `Урьдчилан сэргийлэх асуумжийг үнэн зөв бөглөж, эмчилгээний нөхцөлтэй танилцсан үйлчлүүлэгчийн асран хамгаалагчийн гарын үсэг`
      (Parent/guardian signature acknowledging prevention questionnaire completion and treatment conditions)
    - **Adult Form**: `Урьдчилан сэргийлэх асуумжийг үнэн зөв бөглөж, эмчилгээний нөхцөлтэй танилцсан үйлчлүүлэгчийн гарын үсэг :`
      (Patient signature acknowledging prevention questionnaire completion and treatment conditions)
  - When switching form type, the previous signature is not carried over—a new signature must be obtained
- **Save Button**: Renamed from "Үзлэгийн карт хадгалах" to "Хадгалах" (Save)
- **API Endpoints**:
  - `GET /api/patients/visit-card/by-book/:bookNumber` - Load active card
  - `PUT /api/patients/visit-card/:patientBookId` - Save/update card
  - `POST /api/patients/visit-card/:patientBookId/signature` - Upload signature
- **Functionality**: Form stays fully functional, signature capture, auto-save

### 4.3 Inventory Management
- **Product Catalog**: Branch-specific product lists with categories
- **Stock Tracking**: Real-time inventory levels, low-stock alerts
- **Purchase Orders**: Supplier management, order processing
- **Stock Adjustments**: Variance tracking, loss recording

### 4.4 Billing & Invoicing
- **Service Pricing**: Configurable price lists per branch
- **Invoice Generation**: Automated billing based on treatments
- **Payment Processing**: Multiple payment methods, partial payments
- **Financial Reports**: Revenue tracking, outstanding balances
- **Settlement Gates**: Invoice blocking based on operational constraints

### 4.5 Sterilization (Autoclave Cycles)
- **Tool Master**: Branch-specific catalog of sterilizable tools with baseline amounts
- **Autoclave Machines**: Multiple machine tracking per branch with machine numbers and names
- **Cycle Management**: 
  - Cycle codes (certificate numbers) unique per branch
  - Sterilization run numbers per machine
  - PASS/FAIL certification (only PASS cycles available for attachment)
  - Pressure, temperature, and time tracking
  - Operator documentation
- **Tool Line Production**: Multi-tool sterilization per cycle with produced quantities
- **Tool-Line Based Draft Attachments**: Doctor-side draft attachment workflow using tool lines (V1 approach)
  - **Local Selection Before Save**: Doctors can select sterilization tools on unsaved diagnosis rows
  - Tool selections stored locally in `selectedToolLineIds` array until save
  - **Dropdown Selection UX**: Click-outside handling prevents premature dropdown close, ensuring reliable tool selection
  - Simple UX: shows tool name and cycle code as chips
  - **Repeated Chip Rendering**: Each tool with `requestedQty=N` displays as N identical chips
    - Server-backed chips (from `draftAttachments`) expanded by `requestedQty`
    - Local unsaved chips from `selectedToolLineIds` array
  - Allows duplicate selections: each selection adds to array
  - Remove chip: decrements `requestedQty` by 1 for server-backed chips, removes one occurrence for local chips
  - On save: frontend aggregates duplicates by toolLineId to calculate `requestedQty`
  - Backend receives `toolLineDrafts: [{ toolLineId, requestedQty }]` per diagnosis row
  - Backend stores `SterilizationDraftAttachment` records including `toolLineId` for round-trip persistence
  - **Chips persist after save**: Refreshed from `draftAttachments` in backend response (includes toolLineId)
  - **Idempotent saves**: Clicking Save multiple times preserves existing drafts (no deletion)
  - Drafts persist across page refreshes until encounter is finished
  - Replaced previous indicator-based selection approach
- **Finalization**: On encounter finish, draft attachments are converted to finalized usages
  - Creates `SterilizationFinalizedUsage` records referencing `AutoclaveCycleToolLine`
  - Decrements active cycle remaining (calculated as: produced - used - disposed)
  - Idempotent: won't double-finalize if already completed
- **Mismatch Detection**: Automatic generation of mismatches when insufficient inventory
  - Compares requested quantity in drafts vs available quantity in tool lines
  - Creates `SterilizationMismatch` records for shortfalls
  - Status: UNRESOLVED until manually addressed
- **Mismatch Resolution**: Adjustment consumption records to resolve discrepancies
- **Bur Sterilization Compliance Log**: Compliance-only tracking of bur (dental drill bit) sterilization cycles
  - Separate from main autoclave cycles (no encounter linkage)
  - Tracks fast bur and slow bur quantities per cycle
  - Machine-specific run numbers with uniqueness validation
  - PASS/FAIL result tracking for audit compliance
  - Date range filtering and historical reporting
- **Active Cycles Report**: Real-time tracking of available sterilized tools
  - Shows today's used tools count per branch (always today's calendar date)
  - Lists only PASS cycles with remaining inventory (remaining = produced - used - disposed)
  - Branch-required filter with expandable cycle details
  - Displays produced, used, disposed, and remaining quantities per tool line
- **Disposal Workflow**: Recording and tracking of disposed/discarded sterilized tools
  - **Creation**: Modal-based disposal entry from disposal history page (Хаягдлын түүх / Устгал)
    - "Устгал нэмэх" button opens modal for creating new disposal records
    - Fetches active cycles with remaining inventory from `/api/sterilization/active-cycles`
    - User flow: select cycle → select tool line (filtered by cycle) → enter quantity (≤ remaining)
    - Supports multiple disposal lines with add/remove functionality
    - Automatically merges duplicate toolLineId entries
    - Required fields: disposedByName, at least one disposal line
    - Optional fields: disposedAt (defaults to now), reason, notes
    - Validates quantity does not exceed remaining inventory per tool line
    - Submits via `POST /api/sterilization/disposals` with branchId, disposedAt, disposedByName, reason, notes, and lines
    - On success: closes modal, shows success message, refreshes disposal history list
  - **History**: Separate disposal history page with branch and date range filtering
    - Expandable disposal details showing cycle, tool, and quantities
    - Lists all historical disposal records for selected branch and date range
  - Modal-based disposal entry also available from active cycles report page
  - Records disposal date/time, person responsible, quantity, reason, and notes
  - Linked to specific autoclave cycle tool lines
  - Decrements remaining inventory (remaining = produced - used - disposed)
- **Billing Gate**: Invoice settlement blocked when unresolved sterilization mismatches exist

### 4.6 Reporting & Analytics
- **Financial Reports**: Revenue, expenses, profitability by branch
- **Clinical Reports**: Treatment statistics, procedure frequency
- **Inventory Reports**: Stock levels, consumption patterns, wastage
- **Sterilization Reports**: Cycle tracking, tool usage, compliance metrics

## 5. Database Design Summary

### Core Tables

#### User & Authentication
- **User**: userId, username, password, role, branchId, active status
- **Session**: Session tokens, expiry, user associations

#### Branch Management
- **Branch**: branchId, name, location, contact information
- **BranchSettings**: Branch-specific configurations

#### Patient Management
- **Patient**: patientId, demographics (ovog, name, regNo, gender, birthDate), contact (phone, email, emergencyPhone), address, workPlace, bloodType, citizenship, notes, branchId, createdAt, updatedAt
- **PatientBook**: bookId, bookNumber (unique), patientId (1:1 with Patient)
- **VisitCard**: cardId, patientBookId (1:1), type (ADULT|CHILD), answers (JSON), patientSignaturePath, signedAt, createdAt, updatedAt
  - Stores patient intake forms (adult or child questionnaire variants)
  - The `updatedAt` timestamp determines the active/visible form when both ADULT and CHILD forms exist for a patient
  - Active form is the one with the latest `updatedAt` (set when save button is clicked)
  - Switching form type (ADULT ↔ CHILD) requires a new signature; previous signature is not carried over
  - Signature captured with different legal text depending on form type:
    - Child form: guardian/parent signature
    - Adult form: patient signature
- **Appointment**: appointmentId, patientId, branchId, dateTime, status, notes

#### Clinical Records
- **Encounter**: encounterId, patientBookId, doctorId, nurseId, visitDate, notes, appointmentId, patientSignaturePath, patientSignedAt, doctorSignaturePath, doctorSignedAt
- **EncounterDiagnosis**: diagnosisId, encounterId, diagnosisId (FK to Diagnosis), toothCode (verbatim text), selectedProblemIds (JSON array), note, createdAt
  - Represents one diagnosis entry (one row in patient history book)
  - toothCode stores exact text entered by user (e.g., "11,12", "16-26", "ALL_TEETH")
- **EncounterDiagnosisProblemText**: problemTextId, encounterDiagnosisId, text, order, createdAt, updatedAt
  - Complaint text lines associated with diagnosis entry
  - Displayed in "Бодит үзлэг, зовиур" column
- **EncounterDiagnosisSterilizationIndicator**: linkId, encounterDiagnosisId, indicatorId (FK to SterilizationIndicator), createdAt
  - Sterilization tools used for diagnosis entry
  - Displayed in "Индикатор" column as tool/indicator pairs
- **EncounterService**: serviceId, encounterId, serviceId (FK to Service), quantity, price, meta (JSON with diagnosisId assignment), createdAt
  - Treatment services assigned to diagnosis via meta.diagnosisId
- **EncounterServiceText**: textId, encounterServiceId, text, order, createdAt, updatedAt
  - Treatment text lines (displayed in "Эмчилгээ" column)
- **Diagnosis**: diagnosisId, code (e.g., "K01.8"), name, description
- **DiagnosisProblem**: problemId, diagnosisId, label, order, active
- **Treatment**: treatmentId, patientId, date, procedure, notes
- **TreatmentPlan**: planId, patientId, stages, completion status
- **Document**: documentId, patientId, type, filePath, uploadDate

#### Inventory Management
- **Product**: productId, name, category, unit, branchId
- **StockLevel**: productId, branchId, currentQty, minQty
- **PurchaseOrder**: orderId, supplierId, branchId, date, status, items
- **StockTransaction**: transactionId, productId, qty, type (IN/OUT), reference

#### Billing
- **Invoice**: invoiceId, patientId, branchId, date, totalAmount, status
- **InvoiceItem**: itemId, invoiceId, description, qty, price
- **Payment**: paymentId, invoiceId, amount, method, date
- **Settlement**: settlementId, invoiceId, status, constraints

#### Sterilization Module
- **SterilizationItem**: itemId, branchId, name, baselineAmount (tool master per branch)
- **AutoclaveMachine**: machineId, branchId, machineNumber, name (optional)
- **AutoclaveCycle**: cycleId, branchId, code (certificate number, unique per branch), sterilizationRunNumber, machineNumber, startedAt, finishedAt, pressure, temperature, removedFromAutoclaveAt, result (PASS/FAIL), operator, notes, createdAt, updatedAt
- **AutoclaveCycleToolLine**: lineId, cycleId, toolId (SterilizationItem), producedQty, createdAt (represents specific tool+cycle combination with produced quantity)
- **BurSterilizationCycle**: cycleId, branchId, code (unique per branch), sterilizationRunNumber (unique per machine), machineId, startedAt, finishedAt, pressure, temperature, removedFromAutoclaveAt, result (PASS/FAIL), operator, notes, fastBurQty, slowBurQty, createdAt, updatedAt (compliance-only tracking, no encounter linkage)
- **SterilizationDraftAttachment**: draftId, encounterDiagnosisId, cycleId, toolId, toolLineId (nullable, references AutoclaveCycleToolLine for round-trip persistence), requestedQty (default 1), createdAt (draft selections during encounter entry, persists across page refreshes and repeated saves)
- **SterilizationFinalizedUsage**: usageId, encounterId, toolLineId (AutoclaveCycleToolLine), usedQty, createdAt (created on encounter finish, decrements inventory)
- **SterilizationMismatch**: mismatchId, encounterId, branchId, toolId, code (cycle code), requiredQty, finalizedQty, mismatchQty, status (UNRESOLVED/RESOLVED), createdAt, updatedAt
- **SterilizationAdjustmentConsumption**: adjustmentId, mismatchId, toolId, adjustmentQty, reason, createdBy, createdAt
- **SterilizationDisposal**: disposalId, branchId, disposedAt, disposedByName, reason (optional), notes (optional), createdAt, updatedAt
- **SterilizationDisposalLine**: lineId, disposalId, toolLineId (AutoclaveCycleToolLine), quantity, createdAt

### Key Relationships
- Branch → Users (one-to-many)
- Branch → Patients (one-to-many)
- Branch → Products/Tools (one-to-many)
- Patient → Appointments (one-to-many)
- Patient → Treatments (one-to-many)
- Patient → Invoices (one-to-many)
- Invoice → Payments (one-to-many)
- Branch → AutoclaveMachines (one-to-many)
- Branch → AutoclaveCycles (one-to-many)
- Branch → SterilizationDisposals (one-to-many)
- AutoclaveCycle → CycleToolLines (one-to-many)
- AutoclaveCycle → DraftAttachments (one-to-many)
- AutoclaveCycle → FinalizedUsages (one-to-many)
- AutoclaveCycle → Mismatches (one-to-many)
- AutoclaveCycleToolLine → DisposalLines (one-to-many)
- SterilizationDisposal → DisposalLines (one-to-many)

## 6. Security & Compliance

### Data Security
- Encrypted data transmission (HTTPS)
- Password hashing with bcrypt
- JWT-based authentication
- Role-based access control
- Audit logging for sensitive operations

### HIPAA Compliance Considerations
- Patient data encryption
- Access control and authentication
- Audit trails
- Data backup and recovery
- Secure communication channels

## 7. Integration Capabilities

### External System Integration
- Payment gateway integration
- SMS/Email notification services
- Imaging system integration (PACS)
- Laboratory information systems
- Third-party reporting tools

### API Access
- RESTful API endpoints
- JSON data format
- Authentication via JWT tokens
- Rate limiting and throttling
- Comprehensive API documentation

## 8. Business Rules & Constraints

### Sterilization Module Constraints
- **Invoice Settlement Blocking**: Invoices cannot be settled when there are UNRESOLVED sterilization mismatches associated with the patient or treatment cycle
- This ensures that all tool usage discrepancies are addressed before financial settlement
- Mismatches must be reviewed and either adjusted via SterilizationAdjustmentConsumption or marked as resolved

### Inventory Constraints
- Stock levels cannot go negative
- Low stock alerts triggered at minimum quantity thresholds
- Purchase orders require approval workflow

### Billing Constraints
- Invoices require valid service entries
- Payments cannot exceed invoice total
- Settlement gates check operational prerequisites

## 9. Deployment & Operations

### Deployment Architecture
- Containerized deployment using Docker
- Caddy reverse proxy for HTTPS termination
- PostgreSQL database with automated backups
- Environment-based configuration

### Monitoring & Maintenance
- Application logging
- Error tracking and alerting
- Performance monitoring
- Regular database backups
- Security updates and patches

## 10. Future Enhancements

### Planned Features
- Mobile application for patients
- Telemedicine integration
- AI-assisted diagnosis support
- Advanced analytics and machine learning
- Multi-language support
- Enhanced reporting capabilities

## 11. Support & Documentation

### Available Documentation
- User manuals for each role
- Administrator guide
- API documentation
- Database schema documentation
- Module-specific guides (Sterilization, Inventory, etc.)
- Frontend implementation guides

### Training & Support
- Initial user training
- Video tutorials
- Knowledge base
- Technical support hotline
- Regular update webinars

---

**Document Version**: 1.0  
**Last Updated**: February 2026  
**Maintained By**: M DENT Development Team

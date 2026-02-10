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

### 4.2 Clinical Records
- **Treatment Documentation**: Detailed procedure notes, tooth charts
- **Digital Forms**: Consent forms, medical questionnaires
- **Document Management**: File attachments, imaging integration

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
  - Backend upserts `SterilizationDraftAttachment` records with unique key `(encounterDiagnosisId, cycleId, toolId)`
  - **Chips persist after save**: Refreshed from `draftAttachments` in backend response
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
  - Modal-based disposal entry from active cycles report
  - Records disposal date/time, person responsible, quantity, reason, and notes
  - Linked to specific autoclave cycle tool lines
  - Separate disposal history page with branch and date range filtering
  - Expandable disposal details showing cycle, tool, and quantities
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
- **Patient**: patientId, demographics, contact, medical history
- **Appointment**: appointmentId, patientId, branchId, dateTime, status, notes

#### Clinical Records
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
- **SterilizationDraftAttachment**: draftId, encounterDiagnosisId, cycleId, toolId, requestedQty (default 1), createdAt (draft selections during encounter entry, unique key: encounterDiagnosisId + cycleId + toolId)
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

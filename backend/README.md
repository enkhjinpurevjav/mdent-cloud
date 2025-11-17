# Backend - MDent Cloud

Express.js backend with Prisma ORM connected to PostgreSQL.

## Features

- **Database**: PostgreSQL with Prisma ORM
- **Models**: Branch, User, Patient, PatientBook, Encounter
- **Authentication**: bcrypt password hashing
- **Health Check**: `/health` endpoint with database connectivity status
- **API Routes**:
  - `GET /api/branches` - List all branches
  - `GET /api/patients` - List all patients
  - `POST /api/patients` - Create a new patient

## Environment Variables

Required environment variables:

```bash
DATABASE_URL=postgresql://user:password@host:5432/dbname
ADMIN_PASSWORD=your-secure-admin-password
RUN_SEED=true  # Set to true for initial deployment only
PORT=8080      # Optional, defaults to 8080
LOG_LEVEL=info # Optional
```

## Development

### Install dependencies

```bash
npm install
```

### Run migrations

```bash
npm run prisma:migrate:dev
```

### Generate Prisma Client

```bash
npm run prisma:generate
```

### Seed the database

```bash
npm run seed
```

This will create:
- One default branch (Main Clinic)
- One admin user (admin@mdent.cloud) with password from `ADMIN_PASSWORD` env variable

### Start the server

```bash
npm start
```

## Docker

The backend is containerized and includes:

1. **Build time**: Runs `npx prisma generate` to generate the Prisma Client
2. **Runtime**: Runs `docker-entrypoint.sh` which:
   - Executes database migrations (`npx prisma migrate deploy`)
   - Optionally runs seed script if `RUN_SEED=true`
   - Starts the Express server

### Build the image

```bash
docker build -t mdent-cloud-backend .
```

### Run the container

```bash
docker run -p 8080:8080 \
  -e DATABASE_URL="postgresql://..." \
  -e ADMIN_PASSWORD="secure-password" \
  -e RUN_SEED=false \
  mdent-cloud-backend
```

## Database Schema

### Branch
- Represents a clinic/branch location
- Fields: name, address, phone

### User
- Staff/admin users
- Fields: email (unique), passwordHash, role, firstName, lastName
- Belongs to a Branch

### Patient
- Patient records
- Fields: firstName, lastName, dateOfBirth, phone, email, address
- Belongs to a Branch

### PatientBook
- Patient medical records/notes
- Belongs to a Patient

### Encounter
- Visit/appointment records
- Fields: date, chiefComplaint, diagnosis, treatment, notes
- Belongs to Patient, Branch, and optionally User (doctor)

## API Examples

### Health Check

```bash
curl http://localhost:8080/health
```

Response:
```json
{
  "ok": true,
  "service": "mdent-backend",
  "db": true,
  "time": "2025-11-17T13:00:00.000Z"
}
```

### Get Branches

```bash
curl http://localhost:8080/api/branches
```

### Create Patient

```bash
curl -X POST http://localhost:8080/api/patients \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "phone": "+976-99999999",
    "email": "john@example.com",
    "branchId": "default-branch-id"
  }'
```

### Get Patients

```bash
curl http://localhost:8080/api/patients
```

## Security Notes

- Passwords are hashed using bcrypt with 10 salt rounds
- No secrets are committed to the repository
- `ADMIN_PASSWORD` must be set via environment variables or Portainer secrets
- Database credentials are passed via `DATABASE_URL` environment variable

# BIT Non-Teaching Staff Portal

A full-stack MERN web application for managing non-teaching staff at **Bannari Amman Institute of Technology (BIT Sathy)**.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite |
| UI Design | Stitch-generated components (Tailwind CSS + Material Symbols) |
| Component Library | Material UI (MUI) |
| Backend | Node.js + Express.js |
| Database | MongoDB + Mongoose |
| Authentication | JWT (Bearer token) |
| API Client | Axios |

## User Roles

| Role | Access |
|------|--------|
| **Admin** | Full system access — staff, departments, attendance, leave, payroll, shifts |
| **HOD** | Department-scoped — staff, attendance, leave approvals, schedules |
| **Non-Teaching Staff** | Personal portal — profile, attendance, leave applications, payroll |

---

## Prerequisites

- Node.js >= 18.x
- MongoDB (local) or MongoDB Atlas

---

## Quick Start

### 1. Clone / Navigate to project

```bash
cd BIT-Non-Teaching-Staff-Portal
```

### 2. Start Backend

```bash
cd server
npm install         # Install dependencies (first time only)
cp .env.example .env # Then edit .env with your values
npm run dev         # Starts on http://localhost:5000
```

### 3. Seed the Database

```bash
cd server
npm run seed
```

This creates:
| Role  | Employee ID  | Password   |
|-------|-------------|------------|
| Admin | BIT-ADM-001 | Admin@123  |
| HOD   | BIT-HOD-001 | Hod@123    |
| Staff | BIT-NTS-001 | Staff@123  |

### 4. Start Frontend

```bash
cd client
npm install         # Install dependencies (first time only)
cp .env.example .env # VITE_API_URL already set to http://localhost:5000/api
npm run dev         # Starts on http://localhost:5173
```

### 5. Open in browser

→ http://localhost:5173

---

## Environment Variables

### `server/.env`

```
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/bit_portal
JWT_SECRET=your_strong_jwt_secret_here
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173
SESSION_SECRET=your_strong_session_secret_here
```

### `client/.env`

```
VITE_API_URL=http://localhost:5000/api
VITE_APP_NAME=BIT Non-Teaching Staff Portal
```

---

## API Endpoints (Day 1)

| Method | Endpoint        | Auth     | Description           |
|--------|----------------|----------|-----------------------|
| POST   | `/api/auth/login`  | Public   | Login with Employee ID + Password |
| GET    | `/api/auth/me`     | JWT      | Get current user      |
| POST   | `/api/auth/logout` | JWT      | Logout                |
| GET    | `/api/health`      | Public   | Server health check   |

---

## Project Structure

```
BIT-Non-Teaching-Staff-Portal/
├── client/           # React + Vite frontend
│   └── src/
│       ├── components/  # Reusable UI components
│       ├── context/     # AuthContext
│       ├── layouts/     # Admin / HOD / Staff / Auth layouts
│       ├── pages/       # Page components per role
│       ├── routes/      # ProtectedRoute + AppRoutes
│       ├── services/    # API + Auth services
│       └── config/      # Constants (URLs, roles, routes)
│
├── server/           # Node.js + Express backend
│   ├── config/       # DB connection
│   ├── controllers/  # Route handlers
│   ├── middleware/   # Auth + Role middleware
│   ├── models/       # Mongoose schemas
│   ├── routes/       # Express routes
│   ├── services/     # Business logic
│   ├── validators/   # Input validation
│   └── seed/         # Database seeder
│
└── docs/             # Architecture documentation
```

---

## Day-by-Day Implementation Plan

| Day | Focus |
|-----|-------|
| **Day 1** ✅ | Project foundation, auth, base UI, role routing |
| Day 2 | Staff management CRUD |
| Day 3 | Attendance system |
| Day 4 | Leave management |
| Day 5 | Shift & schedule management |
| Day 6 | Payroll processing |
| Day 7 | Notifications & reports |
| Day 8 | Testing, polish & deployment |

---

## License

Internal use — Bannari Amman Institute of Technology, Sathyamangalam.

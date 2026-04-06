# Locker Management System

A full-stack production-ready application for managing student locker assignments.

## Tech Stack

| Layer    | Technology                                        |
|----------|---------------------------------------------------|
| Backend  | FastAPI, SQLAlchemy 2.0, Pydantic v2, Alembic     |
| Frontend | React 18, Vite, React Router, Axios               |
| Database | PostgreSQL 16                                      |
| Auth     | JWT (python-jose) + bcrypt                         |
| Infra    | Docker, Docker Compose, Nginx                      |

## Quick Start

```bash
# Clone or navigate to the project root
cd locker-management-system

# Start everything (DB + Backend + Frontend)
docker-compose up --build
```

Once running:

| Service   | URL                          |
|-----------|------------------------------|
| Frontend  | http://localhost:3000         |
| Backend   | http://localhost:8000         |
| API Docs  | http://localhost:8000/docs    |

## Default Credentials

| Role  | Email             | Password |
|-------|-------------------|----------|
| Admin | admin@locker.com  | admin123 |
| User  | user@locker.com   | user123  |

## Seeded Data

On first startup the seed script creates:
- 1 admin user + 1 demo user
- 100 students (random names & groups)
- 100 lockers (L-001 → L-100, random sizes/access types)

## Project Structure

```
locker-management-system/
├── docker-compose.yml
├── .env
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── alembic.ini
│   ├── alembic/
│   │   ├── env.py
│   │   ├── script.py.mako
│   │   └── versions/
│   │       └── 001_initial.py
│   └── app/
│       ├── main.py
│       ├── seed.py
│       ├── core/
│       │   ├── config.py
│       │   ├── security.py
│       │   └── dependencies.py
│       ├── db/
│       │   ├── session.py
│       │   └── base.py
│       ├── models/
│       │   ├── user.py
│       │   ├── student.py
│       │   ├── locker.py
│       │   └── assignment.py
│       ├── schemas/
│       │   ├── auth.py
│       │   ├── user.py
│       │   ├── student.py
│       │   ├── locker.py
│       │   └── assignment.py
│       ├── services/
│       │   ├── user.py
│       │   ├── student.py
│       │   ├── locker.py
│       │   └── assignment.py
│       └── routers/
│           ├── auth.py
│           ├── users.py
│           ├── students.py
│           ├── lockers.py
│           └── assignments.py
└── frontend/
    ├── Dockerfile
    ├── nginx.conf
    ├── package.json
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── index.css
        ├── api/
        │   ├── axios.js
        │   ├── auth.js
        │   ├── students.js
        │   ├── lockers.js
        │   └── assignments.js
        ├── context/
        │   └── AuthContext.jsx
        ├── components/
        │   ├── Layout.jsx
        │   ├── Navbar.jsx
        │   └── ProtectedRoute.jsx
        └── pages/
            ├── LoginPage.jsx
            ├── AdminDashboard.jsx
            ├── StudentsPage.jsx
            ├── LockersPage.jsx
            ├── AssignmentsPage.jsx
            └── UserDashboard.jsx
```

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` – Register new user
- `POST /api/v1/auth/login` – Login (returns JWT)

### Students (Admin)
- `GET    /api/v1/students`
- `POST   /api/v1/students`
- `GET    /api/v1/students/{id}`
- `PUT    /api/v1/students/{id}`
- `DELETE /api/v1/students/{id}`

### Lockers (Admin)
- `GET    /api/v1/lockers`
- `POST   /api/v1/lockers`
- `GET    /api/v1/lockers/{id}`
- `PUT    /api/v1/lockers/{id}`
- `DELETE /api/v1/lockers/{id}`

### Assignments (Admin)
- `GET  /api/v1/assignments`
- `POST /api/v1/assignments` – Assign locker
- `POST /api/v1/assignments/{id}/release` – Release

### User
- `GET /api/v1/assignments/my` – View own assignments

## Stopping

```bash
docker-compose down          # stop containers
docker-compose down -v       # stop & remove volumes (wipe DB)
```

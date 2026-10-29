# EpistemicTrace

**Team Episteme Labs**

EpistemicTrace tracks how students write code, computes a **Struggle Dynamics Index (SDI)** from that behavior, and pauses the test runner when a student is wheel-spinning (repeating the same failing approach without making progress).

## Problem

Students who get stuck often keep re-running tests and making tiny edits instead of rethinking their approach. Instructors only see the final result, not the struggle, so help arrives late or never. Blindly re-running tests also reinforces the unproductive loop.

## Users

- **Students** write and run code in the browser editor.
- **Professor** only monitors student progress and struggle signals. The professor does not edit or run student code.

## Features (MoSCoW)

**Must have**
- In-browser code editor (Monaco) with local persistence
- Telemetry capture: edit, run, and error events
- SDI computation from telemetry
- Test-runner pause when wheel-spinning is detected

**Should have**
- Professor monitoring dashboard
- Authentication and user roles
- Persistent storage of sessions and events

**Could have**
- Hints or reflection prompts when the runner is paused
- Per-assignment SDI thresholds

**Won't have (this iteration)**
- Multi-language execution beyond the initial language
- Real-time collaborative editing

## Tech Stack

- **Frontend:** React + TypeScript (Vite), Monaco Editor, Vitest
- **Backend:** Java 21, Spring Boot, Maven

## Team

- Adrian
- Noel
- Jacob

The professor only monitors; they are not a development team member.

## Repository Layout

```
frontend/   React + TypeScript (Vite) app
backend/    Spring Boot API
docs/       Project documentation
tests/      Cross-cutting tests
.github/    CI and repo config
```

## Setup

Prerequisites: Node.js 20+, JDK 21.

1. Copy the environment template and fill in values locally (never commit `.env`):
   ```
   cp .env.example .env
   ```
2. Frontend:
   ```
   cd frontend
   npm install
   npm run dev      # http://localhost:5173
   npm test
   ```
3. Backend:
   ```
   cd backend
   ./mvnw spring-boot:run     # http://localhost:8080
   curl http://localhost:8080/api/health
   ```

## Documentation

- [`AGENTS.md`](AGENTS.md): rules and context for AI agents and contributors (read before changing code)
- [`docs/PROJECT.md`](docs/PROJECT.md): requirements, architecture, data model, decisions and open questions
- [`docs/TRELLO.md`](docs/TRELLO.md): board workflow, cards, acceptance criteria and progress

> Some details in this README differ from the finalized requirements (for example, the MoSCoW priorities and the user roles). See [`docs/PROJECT.md` §16](docs/PROJECT.md#16-reconciliation-with-existing-documentation).

## Project Management

Trello board: https://trello.com/b/nwPfFX7D/episteme-labs-epistemictrace

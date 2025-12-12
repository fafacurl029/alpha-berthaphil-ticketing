# Alpha berthaphil — Local-Only IT Ticketing System

A fully functional, **local-first** ticketing system built with **HTML/CSS/Vanilla JS** using **LocalStorage + IndexedDB**.
No backend required.

## Run (fast)
1. Unzip
2. Open `index.html` in Chrome/Edge
3. Login using demo credentials

## Demo Credentials
- Admin: `admin` / `admin123`
- Supervisor: `supervisor` / `super123`
- Agent: `agent` / `agent123`
- Requester: `requester` / `req123`

## Key Features
- Role-based login (Admin/Supervisor/Agent/Requester)
- Tickets: create, assign, status workflow, tags, priority matrix, SLA timers
- Comments: public replies + internal notes
- Worklogs (time tracking)
- Attachments stored in IndexedDB
- Knowledge Base (KB)
- Reports + CSV export (Tickets + Worklogs)
- Backup/Restore (JSON)
- Branding (app name, primary color)

## Local-only / security note
This build stores all data **only in your browser** (LocalStorage + IndexedDB). It is designed for demos/offline use.

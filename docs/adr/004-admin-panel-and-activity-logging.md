# 004 - Admin Panel and Activity Logging

**Status:** Accepted

## Context
The platform needs an administrative view to oversee all veterans, employers, listings, and applications from a single interface. Additionally, there's a need to track user activity for audit, debugging, and understanding usage patterns — specifically, what clients did across their last 10 sessions.

## Decision
Implemented a full admin panel with:
1. **Separate `admins` table** with password-based auth (bcrypt), reusing the existing session system with `user_type = 'admin'`
2. **Activity logging via `activity_logs` table** that records key actions (login, register, profile update, express interest, create listing, update candidate status) with session ID, IP address, and JSONB details
3. **Session-based activity grouping** — activity can be queried by the last N distinct sessions for a given user, enabling the "last 10 sessions" view
4. **Dark-themed admin UI** at `/admin/*` with a "Command Center" aesthetic that visually distinguishes the admin experience from the veteran/employer interfaces

## Rationale
- Reusing the existing session mechanism (extending `user_type` CHECK to include 'admin') avoids duplicating auth infrastructure
- Logging at the handler level (fire-and-forget) adds minimal latency — failures are logged but don't block the request
- JSONB `details` column provides flexible structured data without requiring schema changes for each new action type
- Session-based grouping (rather than time-window grouping) gives a natural view of "what did this person do each time they visited"

## Trade-offs
**Pros:**
- Unified session system — one cookie, one middleware, three user types
- Activity logs are append-only and cheap to insert
- The admin panel provides comprehensive oversight without modifying any existing user-facing functionality
- 16 backend tests ensure admin endpoints are properly access-controlled

**Cons:**
- Activity logs table will grow indefinitely — may need periodic archival or TTL-based cleanup for production
- The seeded admin password (`admin123`) must be changed before production deployment
- No admin-to-admin management UI (create/delete admins) — currently managed via database

## Alternatives Considered
- **Separate admin service/microservice**: Discarded — adds deployment complexity for a simple dashboard
- **Time-window grouping for activity**: Discarded — session-based grouping is more natural and doesn't require arbitrary time thresholds
- **Third-party admin tools (e.g., Retool)**: Discarded — adds external dependency and doesn't integrate with the existing auth system

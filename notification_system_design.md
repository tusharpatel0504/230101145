# Notification System Design

## Stage 1 — REST API Design

Endpoints

- GET /notifications
  - Description: Fetch all notifications for the logged-in student
  - Headers: Authorization: Bearer <token>
  - Response 200:
    ```json
    [
      { "ID": 123, "Type": "Placement", "Message": "...", "Timestamp": "2026-05-14T...Z" }
    ]
    ```

- GET /notifications/:id
  - Description: Get a single notification by ID
  - Response 200:
    ```json
    { "ID": 123, "Type": "Result", "Message": "...", "Timestamp": "..." }
    ```
  - Response 404: `{ "error": "Not found" }`

- PATCH /notifications/:id/read
  - Description: Mark a notification as read for the student
  - Body: `{ }` (no fields required)
  - Response 200: `{ "success": true }`

- PATCH /notifications/read-all
  - Description: Mark all notifications as read
  - Response 200: `{ "success": true }`

- GET /notifications?type=Placement&isRead=false
  - Description: Filtered fetch
  - Response 200: list matching filters

- POST /notifications
  - Description: (admin) create notification
  - Body: `{ "type": "Placement", "message": "...", "isGlobal": true }`
  - Response 201: created resource

- DELETE /notifications/:id
  - Description: (admin) delete notification
  - Response 204: no content

Real-time mechanism

- Use WebSockets (Socket.io) for real-time delivery.
  - Reason: bi-directional, supports rooms (per-student), low-latency, push from server.
  - Compared to SSE: SSE is unidirectional (server->client) and less flexible for per-student channels.
  - Compared to Polling: Polling wastes resources and increases latency.

Event flow

- On new notification creation: server emits `new_notification` event to student's room with payload:
  ```json
  { "ID": 123, "Type": "Placement", "Message": "...", "Timestamp": "..." }
  ```

## Stage 2 — Database Design

Choice: PostgreSQL
- ACID compliance for consistent notifications delivery
- Structured schema + JSON support (jsonb) for flexible payloads
- Rich indexing and query planner

SQL Schema

```sql
CREATE TABLE students (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TYPE notification_type AS ENUM ('Placement','Result','Event');

CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  type notification_type NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_global BOOLEAN DEFAULT FALSE
);

CREATE TABLE student_notifications (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(id),
  notification_id INTEGER NOT NULL REFERENCES notifications(id),
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

Scaling concerns

- Table size: student_notifications can grow to hundreds of millions of rows
- JOINs across large tables cause slow queries
- Index bloat and write amplification with many indexes

Mitigations

- Partition student_notifications by created_at (monthly partitions)
- Archive older data to cheaper storage
- Use read replicas for reporting queries
- Use connection pooling

SQL queries for Stage 1 endpoints

- Fetch notifications for student (paginated):
```sql
SELECT n.id, n.type, n.message, sn.created_at
FROM student_notifications sn
JOIN notifications n ON n.id = sn.notification_id
WHERE sn.student_id = $1
ORDER BY sn.created_at DESC
LIMIT $2 OFFSET $3;
```

- Mark as read:
```sql
UPDATE student_notifications SET is_read = true, read_at = NOW() WHERE id = $1 AND student_id = $2;
```

- Create notification (admin):
```sql
INSERT INTO notifications (type, message, is_global) VALUES ($1, $2, $3) RETURNING id;
```

## Stage 3 — Query Optimization

Problem example

- A query using `SELECT *` on a 5M row table without index on `(studentId, isRead, createdAt)` will do a full table scan.

Fix

- Use targeted projections and proper WHERE and ORDER BY:
```sql
SELECT id, message, type, created_at
FROM student_notifications
WHERE student_id = 1042 AND is_read = false
ORDER BY created_at DESC
LIMIT 50;
```

- Add composite index:
```sql
CREATE INDEX idx_student_unread ON student_notifications(student_id, is_read, created_at DESC);
```

Tradeoffs

- Indexing every column is bad: increases write amplification and storage, slows inserts, and confuses planner.

Query for placements in last 7 days

```sql
SELECT s.id, s.name, n.message, sn.created_at
FROM student_notifications sn
JOIN students s ON sn.student_id = s.id
JOIN notifications n ON sn.notification_id = n.id
WHERE n.type = 'Placement'
  AND sn.created_at >= NOW() - INTERVAL '7 days';
```

## Stage 4 — Caching Strategy

Problems

- N DB hits per page load, inefficient repeated queries for unread counts.

Solutions

1) Redis cache: store per-student unread count and recent 20 notifications
   - TTL: 60s
   - Invalidate on new notification or read event
   - Tradeoff: slight staleness vs performance

2) HTTP cache headers
   - Use ETag/Last-Modified for public endpoints
   - Tradeoff: not suited for per-user private data

3) Pagination & cursor-based
   - Default limit 20, cursor-based for efficient reads
   - Tradeoff: client complexity

4) WebSocket push
   - Push new notifications to client instead of polling
   - Tradeoff: connection management and scaling

## Stage 5 — Bulk Notification Redesign

Problems in naive approach

- Sequential processing of 50k students with blocking calls is slow
- No retries or dead-letter handling
- Not atomic: email sent but DB save failed

Redesign

- Use message queue (BullMQ / RabbitMQ)
- Enqueue jobs per student, process with workers (e.g., 20 concurrency)
- Outbox pattern: write DB record (`pending_email`) first, separate worker picks up pending rows to send email
- Retries and dead-letter queue for failures

Revised pseudocode

```
function notify_all(student_ids, message):
  for student_id in student_ids:
    enqueue_job({ student_id, message })

async function process_job(job):
  { student_id, message } = job.data
  await save_to_db(student_id, message, status="pending")
  try:
    await send_email(student_id, message)
    await update_db_status(student_id, "email_sent")
  catch error:
    await update_db_status(student_id, "email_failed")
    raise error
  await push_to_app(student_id, message)
```

## Stage 6 — Priority Inbox

Approach

- Score = weight * 1000 + recencyBonus
  - Weight: Placement=3, Result=2, Event=1
  - Recency: give rank-based bonus after sorting by Timestamp desc

- Use a Max-Heap to extract top-k in O(n log k) time
- For streaming/new notifications: push onto heap and pop if size > k

Comparison

- Heap is better than sorting when k << n or streaming data arrives
- Sorting whole array is O(n log n) and requires full materialization

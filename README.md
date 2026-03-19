# Webhook-Driven Task Processing Pipeline

A service that receives webhooks, processes them through a job queue, and delivers results to registered subscribers. Think of it as a simplified Zapier - an inbound event triggers a processing step, and the result is forwarded to one or more destinations.

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [System Architecture](#system-architecture)
- [Design Decisions & Tradeoffs](#design-decisions--tradeoffs)
- [Getting Started](#getting-started)
- [API Reference](#api-reference)
- [Processing Actions](#processing-actions)
- [Reliability & Fault Tolerance](#reliability--fault-tolerance)
- [Security](#security)
- [Monitoring & Observability](#monitoring--observability)
- [CI/CD](#cicd)
- [Project Structure](#project-structure)
- [Requirements Fulfilled](#requirements-fulfilled)

---

## Overview

This system is a **webhook processing pipeline** built with TypeScript, PostgreSQL, and RabbitMQ. It receives incoming webhooks via HTTP, processes them through configurable actions, and delivers the results to registered subscriber endpoints.

### Pipelines

Users create **pipelines** that connect three things:

1. **A Source** — A unique webhook URL that accepts incoming data
2. **Processing Actions** — Configurable actions that transform the payload
3. **Subscribers** — One or more destination URLs where processed results get delivered

![System Components](docs/System%20Components.png)

### Infrastructure

The system runs on **PostgreSQL** for persistent storage, **RabbitMQ** for job queuing, and background **workers** for async processing and delivery.

### Data Flow Summary

1. **Ingestion** — External services POST webhooks to `/api/webhooks/{sourceId}`
2. **Persistence** — Jobs are stored in PostgreSQL with transactional outbox pattern
3. **Queuing** — RabbitMQ distributes jobs to processing and notification workers
4. **Processing** — Workers execute pipeline actions
5. **Delivery** — Processed payloads are delivered to subscriber URLs with retries

---

## Key Features

| Feature | Description |
|---------|-------------|
| **Reliable Ingestion** | Never lose a webhook — data is persisted before acknowledgment |
| **Configurable Pipelines** | Chain multiple processing actions in any order |
| **Fan-out Delivery** | Send processed results to multiple subscribers simultaneously |
| **Automatic Retries** | Failed deliveries retry with exponential backoff |
| **Idempotency** | Duplicate webhooks detected and deduplicated automatically |
| **Signature Verification** | HMAC-SHA256 validation for secure webhook sources |
| **Full Audit Trail** | Track every job from receipt through final delivery |
| **Rate Limiting** | Protection at global, user, and pipeline levels |
| **Prometheus Metrics** | Built-in observability for all operations |
| **Graceful Recovery** | Stuck jobs automatically detected and re-queued |

---

## System Architecture

The system is built on a **three-layer architecture** that separates concerns and enables independent scaling:

![System Architecture](docs/System%20Architecture.png)

### Layer 1: HTTP API

**Purpose:** Handle all external communication

**Components:**
- **Webhook Endpoint** — Receives incoming webhooks, validates signatures, creates jobs
- **Management API** — CRUD operations for pipelines, job queries, authentication
- **Rate Limiter** — Protects against abuse at multiple tiers

**Key Characteristics:**
- Stateless
- No blocking operations (processing happens asynchronously)

### Layer 2: Message Queue (RabbitMQ)

**Purpose:** Decouple ingestion from processing, ensure durability

**Queues:**
- `jobs_queue` — Newly created jobs waiting to be processed
- `notifications_queue` — Completed jobs waiting for delivery

**Key Characteristics:**
- Durable queues (survive broker restarts)
- Acknowledgment-based delivery (messages re-queued on failure)
- Separate queues allow independent scaling of processing vs. delivery

### Layer 3: Background Workers

**Purpose:** Execute the actual work asynchronously

**Workers:**
- **Job Consumer** — Processes jobs through pipeline actions
- **Notification Consumer** — Delivers results to subscriber URLs
- **Outbox Processor** — Polls database for events to publish
- **Recovery Processor** — Detects and recovers stuck jobs

**Key Characteristics:**
- Long-running processes with graceful shutdown
- Self-healing (crashed workers' jobs are recovered)

---

### Data Flow Diagrams

**1. Webhook Reception**

![Webhook Endpoint](docs/Webhook%20endpoint.png)

When a webhook arrives:
1. Validate signature (if configured)
2. Parse and optionally validate payload schema
3. Create job record + outbox entry in single transaction
4. Return `202 Accepted` with job ID
5. Outbox processor picks up event and publishes to RabbitMQ

**2. Job Processing**

![Processing Flow](docs/Processing%20flow.png)

When a job is consumed:
1. Claim the job for processing
2. Load pipeline configuration with ordered actions
3. Execute each action sequentially, passing output to next
4. Mark job as Completed, Failed, or Filtered
5. Create outbox event for notification dispatch

**3. Notification Delivery**

![Notification Flow](docs/Notification%20flow.png)

When notifications are dispatched:
1. Claim the job for delivery
2. Identify all subscribers
3. Attempt delivery to each (in parallel)
4. On failure: retry with exponential backoff (2s, 4s, 8s)
5. Record every attempt with status codes
6. Update final delivery status (Delivered/PartiallyFailed/Failed)

---

## Design Decisions & Tradeoffs

### 1. Transactional Outbox Pattern

**The Challenge:**
How do we ensure a webhook is never lost, even if the system crashes between receiving it and publishing to the message queue?

**The Solution:**
Instead of publishing directly to RabbitMQ, we write both the job AND an outbox event in a single database transaction. A background processor then reads unpublished events and publishes them.

**What I Gained:**
- **Zero data loss** — If it's in the database, it will be processed
- **Atomic operations** — No partial states possible
- **Crash recovery** — System can restart at any point safely

**What I Traded:**
- **Latency** — Adds a bit of latency between receipt and processing
- **Complexity** — Requires background processor for outbox

---

### 2. Separate Processing and Delivery Queues

**The Challenge:**
Processing a webhook (CPU-bound transformations) and delivering it (network I/O-bound with retries) have very different performance characteristics.

**The Solution:**
Two independent message queues with dedicated consumer pools. Processing claims jobs, transforms payloads, then creates outbox events for delivery. Delivery consumers handle I/O and retries.

**What I Gained:**
- **Independent scaling** — N processing workers + M delivery workers
- **Isolation** — Slow subscriber URLs don't block processing
- **Better resource utilization** — Each pool tuned for its workload

**What I Traded:**
- **Operational complexity** — Two queues to monitor instead of one
- **Slightly longer latency** — Extra hop through database outbox

---

### 3. Database-Level Job Claiming

**The Challenge:**
Multiple workers consume from the same queue. How do we prevent two workers from processing the same job simultaneously?

**The Solution:**
Use PostgreSQL's atomic UPDATE with a WHERE clause:
```sql
UPDATE jobs SET status = 'Processing'
WHERE id = $id AND status = 'Queued'
RETURNING id
```
If no rows are returned, another worker already claimed it.

**What I Gained:**
- **Simplicity** — No external locking service needed
- **Reliability** — Database ACID guarantees prevent races
- **Visibility** — Job state always reflects reality

**What I Traded:**
- **Throughput ceiling** — Single database limits horizontal scale
- **Database load** — Each claim is a transaction

---

### 4. Generic Processing Actions

**The Challenge:**
Building a pipeline system that can handle various webhook types while still providing useful transformations.

**The Solution:**
Three configurable action types that work with any JSON payload:

| Action | Purpose |
|--------|---------|
| **Validate** | Ensures payload structure (required fields, non-empty) |
| **Transform** | Normalizes data (trim strings, case conversion, rounding) |
| **Enrich** | Adds computed fields (timestamps, hashes, UUIDs) |

Each action accepts a configuration object, making them flexible for different use cases.

**What I Gained:**
- **Flexibility** — Works with any JSON webhook payload
- **Composability** — Chain actions in any order
- **Configurability** — Each action's behavior is customizable

**What I Traded:**
- **Domain specificity** — No built-in business logic for specific use cases

---

### 5. Exponential Backoff for Retries

**The Challenge:**
When a subscriber endpoint is down, how aggressively should we retry?

**The Solution:**
3 attempts with exponential backoff: 2s, 4s, 8s delays between retries.

**What I Gained:**
- **Gentle on failing services** — Don't overwhelm them while they recover
- **Fast success path** — Healthy endpoints see no delay
- **Predictable max time** — Job completes within known timeframe

**What I Traded:**
- **Slower recovery** — If endpoint recovers after 3s, must wait for second retry
- **Limited attempts** — 3 retries may not be enough for extended outages

---

## Getting Started

### Prerequisites

Docker and Docker Compose (simplest setup)

### Quick Start (Docker)

```bash
# 1. Clone the repository
git clone <repository-url>
cd zapier

# 2. Start all services
docker compose up -d

docker compose exec app npm run migrate

docker compose exec app npm run seed

# 3. Access the services:
#    - API:        http://localhost:3000
#    - RabbitMQ:   http://localhost:15672 (guest/guest)
#    - Metrics:    http://localhost:9464/metrics
```

### Environment Configuration

| Variable | Purpose | Example |
|----------|---------|---------|
| `DB_URL` | PostgreSQL connection string | `postgres://user:pass@localhost:5432/zapier` |
| `JWT_SECRET` | Secret for signing access tokens (64+ chars) | Random base64 string |
| `WEBHOOK_KEY` | Default HMAC key for signature verification | Random 32+ char string |
| `RABBITMQ_HOSTNAME` | Message broker host | `localhost` |
| `RABBITMQ_PORT` | Message broker port | `5672` |
| `RABBITMQ_USERNAME` | Message broker user | `guest` |
| `RABBITMQ_PASSWORD` | Message broker password | `guest` |

---

## API Reference

**Base URL:** `http://localhost:3000/api`

---

### Authentication

#### POST `/auth/login`

Authenticate and receive a token pair.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "yourpassword"
}
```

**Response (200):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

#### POST `/auth/refresh`

Exchange a refresh token for a new token pair.

**Request:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**Response (200):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "new-refresh-token-uuid"
}
```

---

### Pipelines

All pipeline endpoints require `Authorization: Bearer <accessToken>` header.

#### GET `/pipelines`

List all pipelines for the authenticated user.

**Response (200):**
```json
[
  {
    "id": "uuid",
    "name": "My Pipeline",
    "sourceId": "abc123",
    "webhookUrl": "/api/webhooks/abc123",
    "payloadSchema": null,
    "actions": [
      {
        "id": "uuid",
        "order": 0,
        "actionType": "Validate",
        "configuration": { "requiredFields": ["email"] },
        "name": null
      }
    ],
    "subscribers": [
      { "id": "uuid", "url": "https://example.com/webhook" }
    ],
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

#### POST `/pipelines`

Create a new pipeline.

**Request:**
```json
{
  "name": "My Pipeline",
  "subscriberUrls": ["https://example.com/webhook"],
  "payloadSchema": {
    "requiredFields": ["email", "name"]
  },
  "actions": [
    {
      "actionType": "Validate",
      "order": 0,
      "configuration": { "requiredFields": ["email"] }
    },
    {
      "actionType": "Transform",
      "order": 1,
      "configuration": { "trimStrings": true, "lowercaseFields": ["email"] }
    }
  ]
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "name": "My Pipeline",
  "sourceId": "generated-source-id",
  "webhookUrl": "/api/webhooks/generated-source-id",
  "payloadSchema": { "requiredFields": ["email", "name"] },
  "actions": [...],
  "subscribers": [...],
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

#### GET `/pipelines/:id`

Get a specific pipeline by ID.

#### PUT `/pipelines/:id`

Update an existing pipeline.

**Request:**
```json
{
  "name": "Updated Name",
  "subscriberUrls": ["https://new-url.com/webhook"],
  "actions": [...]
}
```

#### DELETE `/pipelines/:id`

Delete a pipeline. Returns `204 No Content`.

---

### Webhooks

#### POST `/webhooks/:sourceId`

Receive and queue a webhook for processing.

**Headers:**
| Header | Required | Description |
|--------|----------|-------------|
| `X-Idempotency-Key` | No | Prevents duplicate processing |
| `X-Webhook-Signature` | Conditional | Required if pipeline has `webhookSecret` configured |

**Request:**
```json
{
  "event": "user.created",
  "data": {
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

**Response (202):**
```json
{
  "id": "job-uuid",
  "status": "Queued",
  "message": "Webhook received and queued for processing."
}
```

**Duplicate Response (200):**
```json
{
  "id": "existing-job-uuid",
  "status": "Completed",
  "message": "Duplicate webhook — returning existing job."
}
```

---

### Jobs

All job endpoints require `Authorization: Bearer <accessToken>` header.

#### GET `/jobs`

List jobs with filtering and pagination.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `pipelineId` | string | Filter by pipeline |
| `status` | string | Filter by status |
| `page` | number | Page number (default: 1) |
| `pageSize` | number | Items per page (default: 20, max: 100) |

**Response (200):**
```json
{
  "items": [
    {
      "id": "uuid",
      "pipelineId": "uuid",
      "status": "Completed",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "completedAt": "2024-01-01T00:00:01.000Z"
    }
  ],
  "totalCount": 100,
  "page": 1,
  "pageSize": 20,
  "totalPages": 5
}
```

#### GET `/jobs/:id`

Get job details with delivery summary.

**Response (200):**
```json
{
  "id": "uuid",
  "pipelineId": "uuid",
  "status": "Completed",
  "incomingPayload": "{\"email\":\"user@example.com\"}",
  "processedPayload": "{\"email\":\"user@example.com\",\"_timestamp\":\"...\"}",
  "deliveries": [
    {
      "subscriberId": "uuid",
      "subscriberUrl": "https://example.com/webhook",
      "totalAttempts": 1,
      "delivered": true,
      "lastStatusCode": 200,
      "lastAttemptedAt": "2024-01-01T00:00:01.000Z",
      "lastError": null
    }
  ],
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:01.000Z",
  "completedAt": "2024-01-01T00:00:01.000Z"
}
```

#### GET `/jobs/:id/deliveries`

Get full delivery attempt history for a job.

**Response (200):**
```json
[
  {
    "id": "uuid",
    "subscriberId": "uuid",
    "subscriberUrl": "https://example.com/webhook",
    "attemptNumber": 1,
    "httpStatusCode": 500,
    "success": false,
    "errorMessage": "Internal Server Error",
    "attemptedAt": "2024-01-01T00:00:01.000Z"
  },
  {
    "id": "uuid",
    "subscriberId": "uuid",
    "subscriberUrl": "https://example.com/webhook",
    "attemptNumber": 2,
    "httpStatusCode": 200,
    "success": true,
    "errorMessage": null,
    "attemptedAt": "2024-01-01T00:00:03.000Z"
  }
]
```

**Job Statuses:** `Queued`, `Processing`, `Completed`, `Failed`, `Filtered`

---

## Processing Actions

Actions execute in order and transform the payload. Each action receives the output of the previous action.

### Validate

Ensures the payload meets structural requirements.

**Configuration:**
```json
{
  "requiredFields": ["field1", "field2"],
  "allowEmpty": false
}
```

### Transform

Normalizes and transforms data in the payload.

**Configuration:**
```json
{
  "trimStrings": true,
  "lowercaseFields": ["email"],
  "uppercaseFields": ["code"],
  "roundNumbers": 2,
  "removeNulls": false
}
```

### Enrich

Adds computed fields to the payload.

**Configuration:**
```json
{
  "addTimestamp": true,
  "addHash": "fieldName",
  "addUuid": true,
  "customFields": { "version": "1.0" }
}
```

---

## Reliability & Fault Tolerance

### Automatic Recovery Scenarios

| Scenario | How It's Handled |
|----------|------------------|
| **API crashes after DB write** | Outbox message remains, processor picks it up on restart |
| **Worker crashes mid-processing** | Recovery processor detects stuck jobs, re-queues them |
| **RabbitMQ unavailable** | Outbox messages queue in database, published when broker recovers |
| **Subscriber returns 5xx** | Retried 3 times with exponential backoff |
| **Duplicate webhook received** | Detected via `X-Idempotency-Key`, existing job returned |

### Stuck Recovery Processors

The system includes two dedicated recovery processors that detect and recover "stuck" jobs — jobs that got claimed by a worker but never completed (usually due to worker crashes or unexpected shutdowns).

**StuckJobRecoveryProcessor**
- Runs every 30 seconds
- Finds jobs stuck in `Processing` state for more than 5 minutes
- Resets them to `Queued` and creates a new outbox event to re-queue them
- Ensures no job is lost even if a worker crashes mid-processing

**StuckNotificationRecoveryProcessor**
- Runs every 30 seconds
- Finds jobs stuck in `Dispatching` delivery state for more than 5 minutes
- Resets them to `Pending` and creates a new outbox event to retry delivery
- Ensures notifications are eventually delivered even if the delivery worker crashes

Both processors use the transactional outbox pattern to guarantee that recovered jobs are properly re-queued.

### Rate Limiting Tiers

| Tier | Limit | Scope | Purpose |
|------|-------|-------|---------|
| Global | 100 req/min | Per IP | DDoS protection |
| Auth | 10 req/min | Per IP | Brute-force prevention |
| Webhooks | 30 req/min | Per pipeline | Ingestion throttling |
| API | 60 req/min | Per user | Fair usage |

### Delivery Guarantees

- **At-least-once delivery** — Webhooks may be delivered multiple times on retry
- **Eventual delivery** — Transient failures eventually succeed with retries

---

## Security

- **Password Security** — Argon2id hashing
- **Token-based Auth** — JWT access tokens with short expiry, rotating refresh tokens
- **User Isolation** — Users can only access their own pipelines and jobs
- **Webhook Integrity** — HMAC-SHA256 signature verification with timing-safe comparison
- **Replay Protection** — Idempotency keys prevent duplicate processing
- **Rate Limiting** — Multi-tier protection against abuse

---

## Monitoring & Observability

### Prometheus Metrics

Available at `http://localhost:9464/metrics`

| Metric | Type | Description |
|--------|------|-------------|
| `webhooks_received_total` | Counter | Total webhooks received |
| `jobs_processed_total` | Counter | Jobs processed by status |
| `job_processing_duration_ms` | Histogram | Processing time |
| `notifications_dispatched_total` | Counter | Delivery attempts by status |
| `stuck_jobs_recovered_total` | Counter | Jobs recovered by recovery processor |
| `stuck_notifications_recovered_total` | Counter | Notifications recovered by recovery processor |

### Logging

Structured JSON logs with levels: `info`, `warn`, `error`

---

## CI/CD

The project uses GitHub Actions for continuous integration and deployment.

### CI Pipeline

Runs on every push to `main`/`develop` and on pull requests to `main`.

| Step | Description |
|------|-------------|
| **Type Check** | Validates TypeScript types |
| **Lint** | Runs ESLint for code quality |
| **Test** | Runs the test suite with PostgreSQL and RabbitMQ services |
| **Build** | Compiles TypeScript to JavaScript |

### CD Pipeline

Runs automatically after a successful CI pipeline on `main`.

| Step | Description |
|------|-------------|
| **Build Image** | Builds the Docker image |
| **Push to Registry** | Pushes to Docker Hub with `latest` and commit SHA tags |

---

## Project Structure

```
src/
├── endpoints/              # HTTP route handlers
│   ├── auth/               # Login, refresh tokens
│   ├── pipelines/          # Pipeline CRUD
│   ├── jobs/               # Job queries
│   ├── webhooks/           # Webhook ingestion
│   └── middleware/         # Auth middleware
│
├── services/               # Core business logic
│   ├── ProcessingService   # Job execution engine
│   ├── NotificationService # Delivery with retries
│   └── SchemaValidator     # Payload validation
│
├── processing-actions/     # Pipeline action implementations
│   ├── ValidateAction      # Payload validation
│   ├── TransformAction     # Data normalization
│   └── EnrichAction        # Computed field addition
│
├── consumers/              # RabbitMQ message consumers
│   ├── RabbitMqJobConsumer
│   └── RabbitMqNotificationConsumer
│
├── processors/             # Background processors
│   ├── OutboxProcessorBase           # Event publishing
│   ├── StuckJobRecoveryProcessor     # Crashed job recovery
│   └── StuckNotificationRecoveryProcessor
│
├── publishers/             # RabbitMQ publishers
├── infrastructure/         # Dependency injection, scheduling
├── identity/               # Authentication & token management
├── db/                     # Schema, relations
├── diagnostics/            # Metrics, health checks
└── abstractions/           # Interfaces
```

---

## Requirements Fulfilled

### Core Requirements

- [x] **Webhook Ingestion** — Receive webhooks via HTTP, store in database
- [x] **Message Queue Integration** — RabbitMQ for job distribution
- [x] **Configurable Pipelines** — Multi-step processing with ordered actions
- [x] **Fan-out Delivery** — Deliver to multiple subscribers
- [x] **Retry Mechanism** — Exponential backoff for failed deliveries
- [x] **Job Tracking** — Full status tracking from receipt to delivery

### Additional Features

- [x] **Transactional Outbox Pattern** — Guaranteed message delivery without dual-write problems
- [x] **Idempotency Support** — Duplicate webhook detection via `X-Idempotency-Key`
- [x] **Signature Verification** — HMAC-SHA256 webhook validation
- [x] **Stuck Job Recovery** — Automatic detection and re-queuing of stuck jobs
- [x] **Multi-tier Rate Limiting** — Protection at global, user, and pipeline levels
- [x] **JWT Authentication** — Access + refresh token rotation
- [x] **Prometheus Metrics** — Full observability for all operations
- [x] **Structured Logging** — JSON logs with correlation
- [x] **Docker Compose Setup** — One-command local deployment

### Future Enhancements

- [ ] **Dead Letter Queue** — Store permanently failed jobs for manual review
- [ ] **Webhook Replay** — Ability to manually retry failed webhooks
- [ ] **Custom Action Plugins** — Allow users to define custom processing actions
- [ ] **Dashboard UI** — Visual interface for pipeline management and monitoring

# CORSAIR Production Readiness Roadmap

**Timeline:** 7-10 months
**Approach:** Phased delivery with continuous validation
**Philosophy:** Production-first, test-driven, incremental hardening

---

## Executive Summary

This roadmap transforms CORSAIR from MVP simulation to production-grade chaos engineering platform by addressing 8 fundamental truths identified by the Architect:

1. **Multi-tenancy:** Single-user simulation → Multi-tenant with lane serialization
2. **Authentication:** No auth → OIDC + JWT validation + RBAC
3. **State Management:** In-memory → SQLite (MVP) → PostgreSQL (scale)
4. **AWS Integration:** Simulation → Real AWS SDK with compensating transactions
5. **Secret Management:** Hardcoded → AWS Secrets Manager with rotation
6. **Evidence Attribution:** Unauthenticated → Ed25519 digital signatures
7. **Idempotency:** None → UUID-based deduplication
8. **Time Authority:** Local clock → NTP sync → RFC 3161 timestamps

**Delivery Strategy:**
- **Phase 1 (Months 1-2):** Foundation - Auth, state, idempotency
- **Phase 2 (Months 3-5):** AWS Integration - Real SDK, rollback, transaction log
- **Phase 3 (Months 6-7):** Hardening - Monitoring, secrets rotation, crash recovery
- **Phase 4 (Months 8-10):** Production - K8s, PostgreSQL, scale testing, launch

---

## 🎯 Phase 1: Foundation (Months 1-2)

**Goal:** Make current simulation safely multi-user with authentication and persistent state.

### Milestones

#### M1.1: Authentication & Authorization (Week 1-3)
- OIDC integration with Auth0/Keycloak
- JWT validation middleware
- RBAC with tenant isolation
- API key management for CLI

#### M1.2: State Persistence (Week 3-5)
- SQLite schema design
- Migration from in-memory to SQLite
- Transaction boundaries
- Connection pooling

#### M1.3: Idempotency & Attribution (Week 6-8)
- UUID-based raid deduplication
- Ed25519 signature generation
- Evidence chain with attribution
- NTP time sync (basic)

---

## 📅 Phase 1 Week-by-Week Breakdown

### **Week 1: Authentication Infrastructure**

**Monday: OIDC Provider Setup**
- **Task 1.1:** Configure Auth0 tenant for development (2 hours)
  - Create Auth0 application for CORSAIR
  - Configure callback URLs and allowed origins
  - Set up development OIDC endpoints
  - **Deliverable:** `.env.example` with Auth0 config template

- **Task 1.2:** Design authentication architecture (3 hours)
  - Create authentication middleware specification
  - Define JWT claims structure (tenant_id, user_id, roles)
  - Design API key authentication for CLI
  - **Files to create:**
    - `docs/architecture/authentication/AUTH_DESIGN.md`
    - `src/auth/types.ts`

**Tuesday: JWT Validation Middleware**
- **Task 1.3:** Write JWT validation tests (TDD - Red Phase) (4 hours)
  - **File:** `tests/auth/test_jwt_validation.test.ts`
  - Test cases:
    ```typescript
    describe("JWT Validation", () => {
      test("valid JWT with required claims passes validation");
      test("expired JWT is rejected");
      test("JWT without tenant_id claim is rejected");
      test("JWT with invalid signature is rejected");
      test("JWT with missing aud claim is rejected");
      test("JWT with invalid issuer is rejected");
    });
    ```
  - **Status:** All tests must FAIL (Red phase)
  - **Deliverable:** Commit with failing tests for approval

- **Task 1.4:** Implement JWT validation middleware (Green Phase) (4 hours)
  - **File to create:** `src/auth/jwt-middleware.ts`
  - Implementation:
    ```typescript
    import jwt from 'jsonwebtoken';
    import jwksClient from 'jwks-rsa';

    export interface JWTClaims {
      sub: string;        // user_id
      tenant_id: string;  // tenant identifier
      roles: string[];    // RBAC roles
      iss: string;        // issuer
      aud: string;        // audience
      exp: number;        // expiration
    }

    export async function validateJWT(token: string): Promise<JWTClaims> {
      // Fetch JWKS from Auth0
      // Verify signature
      // Validate claims
      // Return typed claims
    }
    ```
  - Run tests - all should pass (Green phase)
  - **Deliverable:** PR with implementation + passing tests

**Wednesday: RBAC Implementation**
- **Task 1.5:** Write RBAC tests (TDD - Red Phase) (3 hours)
  - **File:** `tests/auth/test_rbac.test.ts`
  - Test cases:
    ```typescript
    describe("RBAC Authorization", () => {
      test("admin role can execute all operations");
      test("operator role can execute raids but not delete evidence");
      test("viewer role can only read evidence");
      test("tenant isolation - users cannot access other tenant data");
      test("missing role defaults to viewer");
    });
    ```
  - **Status:** All tests must FAIL
  - **Deliverable:** Commit with failing tests

- **Task 1.6:** Implement RBAC enforcement (Green Phase) (4 hours)
  - **File to create:** `src/auth/rbac.ts`
  - Define role hierarchy:
    ```typescript
    export enum Role {
      VIEWER = "viewer",
      OPERATOR = "operator",
      ADMIN = "admin"
    }

    export interface Permission {
      operation: "recon" | "raid" | "plunder" | "chart" | "delete_evidence";
      allowed: boolean;
    }

    export function checkPermission(
      roles: Role[],
      operation: string,
      tenantId: string
    ): boolean {
      // Implement permission checks
    }
    ```
  - **Deliverable:** PR with RBAC implementation + passing tests

**Thursday: API Key Authentication**
- **Task 1.7:** Write API key auth tests (TDD - Red Phase) (3 hours)
  - **File:** `tests/auth/test_api_keys.test.ts`
  - Test cases:
    ```typescript
    describe("API Key Authentication", () => {
      test("valid API key authenticates successfully");
      test("expired API key is rejected");
      test("revoked API key is rejected");
      test("API key includes tenant scope");
      test("API key can have limited permissions");
    });
    ```

- **Task 1.8:** Implement API key system (Green Phase) (4 hours)
  - **Files to create:**
    - `src/auth/api-keys.ts`
    - `src/auth/api-key-middleware.ts`
  - Schema design (for Week 3 SQLite migration):
    ```sql
    CREATE TABLE api_keys (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      key_hash TEXT NOT NULL,
      name TEXT,
      roles TEXT, -- JSON array
      created_at TEXT NOT NULL,
      expires_at TEXT,
      revoked_at TEXT,
      last_used_at TEXT
    );
    ```
  - **Deliverable:** PR with API key implementation

**Friday: Integration & Documentation**
- **Task 1.9:** Integrate auth middleware into Corsair class (4 hours)
  - **File to modify:** `src/corsair-mvp.ts`
  - Changes:
    ```typescript
    export class Corsair {
      private authContext?: AuthContext;

      constructor(options?: CorsairOptions) {
        // Existing constructor
        if (options?.authContext) {
          this.authContext = options.authContext;
        }
      }

      private checkPermission(operation: string): void {
        if (!this.authContext) {
          throw new Error("Authentication required");
        }
        // Check RBAC permissions
      }

      async raid(snapshot: CognitoSnapshot, options: RaidOptions): Promise<RaidResult> {
        this.checkPermission("raid");
        // Existing raid logic
      }
    }
    ```
  - **Files to modify:**
    - `src/types.ts` (add AuthContext type)
    - All primitive methods (add permission checks)

- **Task 1.10:** Write authentication documentation (2 hours)
  - **File to create:** `docs/authentication/GETTING_STARTED.md`
  - **File to create:** `docs/authentication/API_KEYS.md`

**Week 1 Deliverables:**
- ✅ JWT validation middleware with tests
- ✅ RBAC enforcement with tenant isolation
- ✅ API key authentication system
- ✅ Auth integration into Corsair core
- ✅ Authentication documentation

**Week 1 Definition of Done:**
- [ ] All tests pass (TDD cycle complete)
- [ ] Auth0 tenant configured and tested
- [ ] JWT validation blocks unauthenticated requests
- [ ] RBAC prevents cross-tenant access
- [ ] API keys work from CLI
- [ ] Documentation reviewed and approved

---

### **Week 2: SQLite Schema Design**

**Monday: Schema Design & Migration Plan**
- **Task 2.1:** Design SQLite schema (4 hours)
  - **File to create:** `src/database/schema.sql`
  - Tables to design:
    ```sql
    -- Tenants
    CREATE TABLE tenants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      settings TEXT -- JSON
    );

    -- Raids (with tenant isolation)
    CREATE TABLE raids (
      raid_id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      target TEXT NOT NULL,
      vector TEXT NOT NULL,
      intensity INTEGER NOT NULL,
      success BOOLEAN,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      duration_ms INTEGER,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    );

    -- Evidence (JSONL records)
    CREATE TABLE evidence (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id TEXT NOT NULL,
      sequence INTEGER NOT NULL,
      timestamp TEXT NOT NULL,
      operation TEXT NOT NULL,
      data TEXT NOT NULL, -- JSON
      previous_hash TEXT,
      hash TEXT NOT NULL,
      signature TEXT, -- Ed25519 signature (added in Week 6)
      FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    );

    -- Provider lanes (for serialization)
    CREATE TABLE provider_lanes (
      lane_key TEXT PRIMARY KEY, -- format: tenant_id:provider:target_id
      tenant_id TEXT NOT NULL,
      locked_at TEXT,
      locked_by TEXT,
      raid_id TEXT,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    );

    -- Idempotency keys (added in Week 6)
    CREATE TABLE idempotency_keys (
      key TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      raid_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id),
      FOREIGN KEY (raid_id) REFERENCES raids(raid_id)
    );

    -- API keys
    CREATE TABLE api_keys (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      key_hash TEXT NOT NULL,
      name TEXT,
      roles TEXT, -- JSON array
      created_at TEXT NOT NULL,
      expires_at TEXT,
      revoked_at TEXT,
      last_used_at TEXT,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    );

    -- Indexes for performance
    CREATE INDEX idx_raids_tenant ON raids(tenant_id);
    CREATE INDEX idx_raids_started_at ON raids(started_at);
    CREATE INDEX idx_evidence_tenant ON evidence(tenant_id);
    CREATE INDEX idx_evidence_sequence ON evidence(tenant_id, sequence);
    CREATE INDEX idx_provider_lanes_tenant ON provider_lanes(tenant_id);
    CREATE INDEX idx_idempotency_expires ON idempotency_keys(expires_at);
    ```

- **Task 2.2:** Design migration strategy (2 hours)
  - **File to create:** `docs/database/MIGRATION_STRATEGY.md`
  - Migration approach:
    - Zero-downtime migration not required (MVP)
    - Export existing in-memory data to JSON
    - Import into SQLite on first boot
    - Versioned migrations for future schema changes

- **Task 2.3:** Create database abstraction layer spec (2 hours)
  - **File to create:** `docs/database/DATABASE_LAYER.md`
  - Interface design:
    ```typescript
    export interface Database {
      // Transactions
      beginTransaction(): Promise<Transaction>;

      // Raids
      saveRaid(raid: RaidResult, tenantId: string): Promise<void>;
      getRaid(raidId: string, tenantId: string): Promise<RaidResult | null>;
      listRaids(tenantId: string, filters?: RaidFilters): Promise<RaidResult[]>;

      // Evidence
      appendEvidence(record: PlunderRecord, tenantId: string): Promise<void>;
      getEvidenceChain(tenantId: string): Promise<PlunderRecord[]>;

      // Lanes
      acquireLane(laneKey: string, raidId: string, tenantId: string): Promise<boolean>;
      releaseLane(laneKey: string, tenantId: string): Promise<void>;

      // Idempotency
      checkIdempotency(key: string, tenantId: string): Promise<string | null>;
      recordIdempotency(key: string, raidId: string, tenantId: string): Promise<void>;
    }
    ```

**Tuesday: Database Layer Tests (TDD - Red Phase)**
- **Task 2.4:** Write database layer tests (6 hours)
  - **File to create:** `tests/database/test_sqlite_database.test.ts`
  - Test cases:
    ```typescript
    describe("SQLite Database Layer", () => {
      describe("Transaction Management", () => {
        test("begin transaction returns transaction object");
        test("commit persists changes");
        test("rollback discards changes");
        test("nested transactions not supported - throw error");
      });

      describe("Raid Persistence", () => {
        test("saveRaid persists raid to database");
        test("getRaid retrieves raid by ID and tenant");
        test("getRaid returns null for non-existent raid");
        test("getRaid rejects cross-tenant access");
        test("listRaids returns raids for tenant only");
        test("listRaids applies filters correctly");
      });

      describe("Evidence Chain", () => {
        test("appendEvidence maintains sequence ordering");
        test("appendEvidence maintains hash chain");
        test("getEvidenceChain returns records in order");
        test("getEvidenceChain isolated by tenant");
        test("evidence tamper detection via hash chain");
      });

      describe("Lane Serialization", () => {
        test("acquireLane locks successfully if available");
        test("acquireLane fails if lane already locked");
        test("releaseLane unlocks lane");
        test("lane isolation by tenant");
        test("expired lane locks are cleaned up");
      });

      describe("Idempotency", () => {
        test("checkIdempotency returns null for new key");
        test("checkIdempotency returns raid ID for existing key");
        test("recordIdempotency stores key-raid mapping");
        test("expired idempotency keys are cleaned up");
      });
    });
    ```
  - **Status:** All tests must FAIL (Red phase)
  - **Deliverable:** Commit with failing tests for approval

**Wednesday: Database Layer Implementation (Green Phase)**
- **Task 2.5:** Implement SQLite database layer (8 hours)
  - **File to create:** `src/database/sqlite-database.ts`
  - Use `better-sqlite3` for synchronous API:
    ```typescript
    import Database from 'better-sqlite3';

    export class SQLiteDatabase implements DatabaseInterface {
      private db: Database.Database;

      constructor(filepath: string) {
        this.db = new Database(filepath);
        this.initializeSchema();
      }

      private initializeSchema(): void {
        // Read schema.sql and execute
      }

      async saveRaid(raid: RaidResult, tenantId: string): Promise<void> {
        const stmt = this.db.prepare(`
          INSERT INTO raids (raid_id, tenant_id, target, vector, intensity,
                           success, started_at, completed_at, duration_ms)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(
          raid.raidId,
          tenantId,
          raid.target,
          raid.vector,
          raid.intensity,
          raid.success ? 1 : 0,
          raid.startedAt,
          raid.completedAt,
          raid.durationMs
        );
      }

      // Implement all interface methods
    }
    ```
  - Run tests - all should pass (Green phase)
  - **Deliverable:** PR with database implementation

**Thursday: Database Integration**
- **Task 2.6:** Integrate database into Corsair class (6 hours)
  - **File to modify:** `src/corsair-mvp.ts`
  - Changes:
    ```typescript
    import { SQLiteDatabase } from './database/sqlite-database';

    export class Corsair {
      private db?: DatabaseInterface;
      private authContext?: AuthContext;

      constructor(options?: CorsairOptions) {
        if (options?.database) {
          this.db = options.database;
        }
      }

      async raid(snapshot: CognitoSnapshot, options: RaidOptions): Promise<RaidResult> {
        this.checkPermission("raid");

        // Check idempotency if key provided
        if (options.idempotencyKey) {
          const existingRaidId = await this.db?.checkIdempotency(
            options.idempotencyKey,
            this.authContext!.tenantId
          );
          if (existingRaidId) {
            return await this.db!.getRaid(existingRaidId, this.authContext!.tenantId);
          }
        }

        // Acquire lane lock
        const laneKey = `${this.authContext!.tenantId}:aws-cognito:${snapshot.userPoolId}`;
        const acquired = await this.db?.acquireLane(
          laneKey,
          raidId,
          this.authContext!.tenantId
        );

        if (!acquired) {
          throw new Error(`Lane locked: ${laneKey}`);
        }

        try {
          // Execute raid (existing logic)
          const result = await this.executeRaid(snapshot, options);

          // Save to database
          await this.db?.saveRaid(result, this.authContext!.tenantId);

          // Record idempotency
          if (options.idempotencyKey) {
            await this.db?.recordIdempotency(
              options.idempotencyKey,
              result.raidId,
              this.authContext!.tenantId
            );
          }

          return result;
        } finally {
          // Release lane lock
          await this.db?.releaseLane(laneKey, this.authContext!.tenantId);
        }
      }
    }
    ```

- **Task 2.7:** Write integration tests (2 hours)
  - **File to create:** `tests/integration/test_database_integration.test.ts`
  - Test raid persistence, lane locking, idempotency

**Friday: Evidence Persistence**
- **Task 2.8:** Migrate PLUNDER to database (4 hours)
  - **File to modify:** `src/evidence.ts`
  - Changes:
    ```typescript
    export class EvidenceEngine {
      private db?: DatabaseInterface;

      async appendEvidence(
        operation: OperationType,
        data: unknown,
        tenantId: string
      ): Promise<PlunderRecord> {
        // Get last hash from database
        const chain = await this.db?.getEvidenceChain(tenantId);
        const previousHash = chain?.length ? chain[chain.length - 1].hash : null;

        // Create record with hash
        const record: PlunderRecord = {
          sequence: chain?.length || 0,
          timestamp: new Date().toISOString(),
          operation,
          data,
          previousHash,
          hash: this.computeHash(/* ... */),
        };

        // Save to database
        await this.db?.appendEvidence(record, tenantId);

        return record;
      }
    }
    ```

- **Task 2.9:** Write migration tool for existing evidence files (2 hours)
  - **File to create:** `scripts/migrate-evidence-to-sqlite.ts`
  - Read JSONL files, import into SQLite with tenant assignment

- **Task 2.10:** Update documentation (2 hours)
  - **File to create:** `docs/database/SQLITE_SETUP.md`

**Week 2 Deliverables:**
- ✅ SQLite schema with multi-tenant support
- ✅ Database abstraction layer with tests
- ✅ Database integration into Corsair core
- ✅ Evidence persistence to SQLite
- ✅ Migration tool for existing data

**Week 2 Definition of Done:**
- [ ] All database tests pass
- [ ] Raids persist to SQLite
- [ ] Evidence chain maintained in database
- [ ] Lane serialization works correctly
- [ ] Migration tool tested with existing data
- [ ] Performance benchmarks show acceptable latency (<100ms for writes)

---

### **Week 3: Idempotency Infrastructure**

**Monday-Tuesday: UUID Generation & Deduplication**
- **Task 3.1:** Write idempotency tests (TDD - Red Phase) (4 hours)
  - **File:** `tests/core/test_idempotency.test.ts`
  - Test cases:
    ```typescript
    describe("Idempotency", () => {
      test("raid with same key returns cached result");
      test("raid with different key executes normally");
      test("expired idempotency keys allow re-execution");
      test("idempotency keys scoped to tenant");
      test("concurrent requests with same key handled correctly");
    });
    ```

- **Task 3.2:** Implement idempotency in raid flow (4 hours)
  - Already integrated in Week 2 Task 2.6
  - Add configuration for TTL (default: 24 hours)

- **Task 3.3:** Add idempotency to CLI (4 hours)
  - **File to modify:** `corsair.ts`
  - Add `--idempotency-key` flag
  - Generate UUIDs automatically if not provided

**Wednesday-Thursday: Ed25519 Signatures**
- **Task 3.4:** Write signature tests (TDD - Red Phase) (4 hours)
  - **File:** `tests/evidence/test_ed25519_signatures.test.ts`
  - Test cases:
    ```typescript
    describe("Ed25519 Signatures", () => {
      test("evidence signed with tenant private key");
      test("signature verifies with public key");
      test("tampered evidence fails verification");
      test("key rotation preserves old signatures");
    });
    ```

- **Task 3.5:** Implement Ed25519 signing (6 hours)
  - **File to create:** `src/auth/signing.ts`
  - Use `@noble/ed25519` library:
    ```typescript
    import * as ed from '@noble/ed25519';

    export class EvidenceSigner {
      private privateKey: Uint8Array;

      async sign(record: PlunderRecord): Promise<string> {
        const message = JSON.stringify({
          sequence: record.sequence,
          timestamp: record.timestamp,
          operation: record.operation,
          hash: record.hash,
        });
        const signature = await ed.sign(message, this.privateKey);
        return Buffer.from(signature).toString('hex');
      }

      async verify(record: PlunderRecord, signature: string, publicKey: string): Promise<boolean> {
        const message = JSON.stringify({
          sequence: record.sequence,
          timestamp: record.timestamp,
          operation: record.operation,
          hash: record.hash,
        });
        return ed.verify(
          Buffer.from(signature, 'hex'),
          message,
          Buffer.from(publicKey, 'hex')
        );
      }
    }
    ```

- **Task 3.6:** Integrate signing into evidence engine (4 hours)
  - **File to modify:** `src/evidence.ts`
  - Sign all evidence records before database insert

**Friday: NTP Time Sync**
- **Task 3.7:** Implement basic NTP sync (4 hours)
  - **File to create:** `src/time/ntp-sync.ts`
  - Use `ntp-client` package
  - Sync with pool.ntp.org
  - Calculate drift and adjust timestamps

- **Task 3.8:** Add time sync to initialization (2 hours)
  - **File to modify:** `src/corsair-mvp.ts`
  - Sync on startup, log drift

- **Task 3.9:** Documentation (2 hours)
  - **File to create:** `docs/evidence/ATTRIBUTION.md`
  - **File to update:** `docs/evidence/EVIDENCE_CHAIN.md`

**Week 3 Deliverables:**
- ✅ UUID-based idempotency with database backing
- ✅ Ed25519 signature generation for evidence
- ✅ Signature verification utilities
- ✅ Basic NTP time synchronization
- ✅ Attribution documentation

**Week 3 Definition of Done:**
- [ ] Duplicate raids with same idempotency key return cached results
- [ ] All evidence records have valid Ed25519 signatures
- [ ] Signatures verify correctly with public keys
- [ ] NTP drift calculated and logged
- [ ] Performance impact of signing <10ms per record

---

### **Weeks 4-8: Remaining Phase 1 Tasks**

**Week 4: CLI Enhancements & API Design**
- REST API design with OpenAPI spec
- CLI authentication with API keys
- Environment-based configuration
- Error handling standardization

**Week 5: Testing & Hardening**
- Integration test suite (end-to-end scenarios)
- Load testing (concurrent raids)
- Error recovery testing
- Security audit (OWASP Top 10)

**Week 6: Multi-Tenant Testing**
- Tenant isolation validation
- Cross-tenant access prevention tests
- Performance under multi-tenant load
- Tenant onboarding automation

**Week 7: Documentation & Developer Experience**
- API documentation (OpenAPI/Swagger)
- Developer quickstart guide
- Tenant administrator guide
- Deployment guide (Docker compose)

**Week 8: Phase 1 Validation & Handoff**
- End-to-end system testing
- Security penetration testing
- Performance benchmarks
- Phase 1 retrospective
- Phase 2 planning kickoff

---

## 🔧 Phase 2: AWS Integration (Months 3-5)

**Goal:** Replace simulation with real AWS SDK calls and implement rollback safety.

### Milestones

#### M2.1: Real AWS Cognito Integration (Week 9-12)
- AWS SDK integration with retry logic
- Replace simulation fixtures with live API calls
- Error handling for AWS rate limits
- AWS credential management

#### M2.2: Compensating Transactions (Week 13-16)
- Transaction log for all AWS mutations
- Rollback engine with compensating actions
- Crash recovery from transaction log
- Orphaned resource cleanup

#### M2.3: Provider Plugin Maturity (Week 17-20)
- Plugin SDK with common patterns
- Error handling standardization
- Retry policies per provider
- Plugin testing framework

### Key File Changes - Phase 2

#### Week 9: AWS SDK Integration

**File: `plugins/aws-cognito/aws-cognito-provider.ts`**

Before (MVP simulation):
```typescript
export async function recon(userPoolId: string): Promise<ReconResult> {
  // Load from fixture file
  const snapshot = loadFixture(userPoolId);
  return { snapshot, metadata: { source: "fixture" } };
}
```

After (Real AWS):
```typescript
import {
  CognitoIdentityProviderClient,
  DescribeUserPoolCommand
} from "@aws-sdk/client-cognito-identity-provider";

export class CognitoProvider implements ProviderPlugin<CognitoSnapshot> {
  private client: CognitoIdentityProviderClient;

  constructor(config: AWSConfig) {
    this.client = new CognitoIdentityProviderClient({
      region: config.region,
      credentials: config.credentials,
      maxAttempts: 3,
      retryMode: "adaptive",
    });
  }

  async recon(userPoolId: string): Promise<ReconResult> {
    try {
      const command = new DescribeUserPoolCommand({ UserPoolId: userPoolId });
      const response = await this.client.send(command);

      const snapshot: CognitoSnapshot = {
        userPoolId: response.UserPool.Id,
        userPoolName: response.UserPool.Name,
        mfaConfiguration: response.UserPool.MfaConfiguration as MfaConfiguration,
        // Map AWS response to snapshot
      };

      return {
        snapshot,
        metadata: {
          source: "aws",
          readonly: true,
          durationMs: Date.now() - startTime,
        },
        stateModified: false,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      if (error.name === 'ThrottlingException') {
        // Exponential backoff retry
      }
      throw new ProviderError('RECON_FAILED', error);
    }
  }
}
```

**New Files to Create:**
- `src/providers/aws/aws-config.ts` - AWS credential management
- `src/providers/aws/retry-policy.ts` - Exponential backoff implementation
- `tests/providers/aws/test_cognito_provider.test.ts` - Integration tests with LocalStack

**Tests to Write (TDD):**
```typescript
describe("Real AWS Cognito Provider", () => {
  test("recon fetches user pool from AWS API");
  test("recon handles rate limiting with backoff");
  test("recon fails gracefully on invalid user pool ID");
  test("recon uses cached credentials");
  test("recon retries on transient failures");
  test("recon timeout after 30 seconds");
});
```

#### Week 13: Transaction Log & Rollback

**File: `src/transactions/transaction-log.ts`**

```typescript
export interface TransactionEntry {
  id: string;
  tenantId: string;
  raidId: string;
  operation: "CREATE" | "UPDATE" | "DELETE";
  provider: string;
  resourceType: string;
  resourceId: string;
  beforeState: unknown;
  afterState: unknown;
  compensation: CompensatingAction;
  timestamp: string;
  status: "PENDING" | "COMMITTED" | "ROLLED_BACK";
}

export interface CompensatingAction {
  type: "aws_api_call" | "custom_script";
  action: string; // e.g., "DeleteUser", "RestoreMfaConfig"
  parameters: Record<string, unknown>;
}

export class TransactionLog {
  async logMutation(
    raidId: string,
    operation: string,
    resource: string,
    beforeState: unknown,
    afterState: unknown,
    compensation: CompensatingAction,
    tenantId: string
  ): Promise<void> {
    const entry: TransactionEntry = {
      id: uuidv4(),
      tenantId,
      raidId,
      operation: "UPDATE",
      provider: "aws-cognito",
      resourceType: "user_pool_mfa_config",
      resourceId: resource,
      beforeState,
      afterState,
      compensation,
      timestamp: await this.getNTPTime(),
      status: "PENDING",
    };

    await this.db.saveTransaction(entry);
  }

  async rollback(raidId: string, tenantId: string): Promise<RollbackResult> {
    const entries = await this.db.getTransactions(raidId, tenantId);
    const reversed = entries.reverse();

    const results = [];
    for (const entry of reversed) {
      try {
        await this.executeCompensation(entry.compensation);
        await this.db.markRolledBack(entry.id);
        results.push({ success: true, entryId: entry.id });
      } catch (error) {
        results.push({ success: false, entryId: entry.id, error: error.message });
      }
    }

    return {
      raidId,
      totalEntries: entries.length,
      rolledBack: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
    };
  }

  private async executeCompensation(action: CompensatingAction): Promise<void> {
    if (action.type === "aws_api_call") {
      // Execute AWS SDK call with compensation parameters
      const client = this.getAWSClient();
      await client[action.action](action.parameters);
    } else {
      // Execute custom compensation script
      await this.executeScript(action.action, action.parameters);
    }
  }
}
```

**New Files to Create:**
- `src/transactions/transaction-log.ts`
- `src/transactions/compensating-actions.ts`
- `src/transactions/crash-recovery.ts`
- `tests/transactions/test_rollback.test.ts`

**Database Schema Changes:**
```sql
-- Add to schema.sql
CREATE TABLE transactions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  raid_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  provider TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  before_state TEXT, -- JSON
  after_state TEXT, -- JSON
  compensation TEXT NOT NULL, -- JSON
  timestamp TEXT NOT NULL,
  status TEXT NOT NULL,
  error TEXT,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (raid_id) REFERENCES raids(raid_id)
);

CREATE INDEX idx_transactions_raid ON transactions(raid_id);
CREATE INDEX idx_transactions_status ON transactions(status);
```

**Integration into RAID:**

**File: `src/corsair-mvp.ts` (Modified)**
```typescript
async raid(snapshot: CognitoSnapshot, options: RaidOptions): Promise<RaidResult> {
  // ... existing auth and lane checks ...

  const txLog = new TransactionLog(this.db);

  try {
    // Before mutation: log transaction
    await txLog.logMutation(
      raidId,
      "UPDATE",
      snapshot.userPoolId,
      { mfaConfiguration: snapshot.mfaConfiguration },
      { mfaConfiguration: "OFF" }, // simulated mutation
      {
        type: "aws_api_call",
        action: "UpdateUserPool",
        parameters: {
          UserPoolId: snapshot.userPoolId,
          MfaConfiguration: snapshot.mfaConfiguration, // restore original
        },
      },
      this.authContext!.tenantId
    );

    // Execute raid mutation
    const result = await this.executeRaid(snapshot, options);

    // Commit transaction
    await txLog.commit(raidId, this.authContext!.tenantId);

    return result;
  } catch (error) {
    // Automatic rollback on error
    await txLog.rollback(raidId, this.authContext!.tenantId);
    throw error;
  }
}
```

**Tests to Write (TDD):**
```typescript
describe("Transaction Rollback", () => {
  test("rollback restores original state after failed raid");
  test("rollback executes compensating actions in reverse order");
  test("partial rollback continues on non-critical failures");
  test("crash recovery replays uncommitted transactions");
  test("orphaned resources cleaned up after timeout");
});
```

---

## 🛡️ Phase 3: Hardening (Months 6-7)

**Goal:** Production-grade reliability, monitoring, and security.

### Milestones

#### M3.1: Secrets Management (Week 21-23)
- AWS Secrets Manager integration
- Secret rotation automation
- Encrypted configuration
- Audit logging for secret access

#### M3.2: Observability (Week 24-26)
- Structured logging (JSON)
- Metrics export (Prometheus)
- Distributed tracing (OpenTelemetry)
- Health check endpoints

#### M3.3: Reliability Engineering (Week 27-30)
- Chaos testing (internal dog-fooding)
- Crash recovery validation
- Backup and restore procedures
- Disaster recovery playbook

### Key File Changes - Phase 3

#### Week 21: AWS Secrets Manager Integration

**File: `src/secrets/secrets-manager.ts`**

```typescript
import {
  SecretsManagerClient,
  GetSecretValueCommand,
  PutSecretValueCommand,
  RotateSecretCommand,
} from "@aws-sdk/client-secrets-manager";

export class SecretsManager {
  private client: SecretsManagerClient;
  private cache: Map<string, { value: string; expiresAt: number }>;

  constructor(region: string) {
    this.client = new SecretsManagerClient({ region });
    this.cache = new Map();
  }

  async getSecret(secretId: string, tenantId: string): Promise<string> {
    // Check cache
    const cached = this.cache.get(`${tenantId}:${secretId}`);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    // Fetch from AWS Secrets Manager
    const command = new GetSecretValueCommand({
      SecretId: `corsair/${tenantId}/${secretId}`,
    });

    const response = await this.client.send(command);
    const value = response.SecretString!;

    // Cache with 5-minute TTL
    this.cache.set(`${tenantId}:${secretId}`, {
      value,
      expiresAt: Date.now() + 300000,
    });

    return value;
  }

  async rotateSecret(secretId: string, tenantId: string): Promise<void> {
    const command = new RotateSecretCommand({
      SecretId: `corsair/${tenantId}/${secretId}`,
      RotationLambdaARN: process.env.ROTATION_LAMBDA_ARN,
    });

    await this.client.send(command);

    // Invalidate cache
    this.cache.delete(`${tenantId}:${secretId}`);
  }
}
```

**Configuration Migration:**

Before:
```typescript
// .env file (insecure)
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AUTH0_CLIENT_SECRET=abc123def456
```

After:
```typescript
// .env file (references only)
AWS_REGION=us-west-2
SECRETS_MANAGER_PREFIX=corsair

// Secrets stored in AWS Secrets Manager
// - corsair/{tenant_id}/aws_credentials
// - corsair/{tenant_id}/auth0_client_secret
// - corsair/{tenant_id}/ed25519_private_key
```

**New Files:**
- `src/secrets/secrets-manager.ts`
- `src/secrets/secret-rotation.ts`
- `scripts/migrate-secrets.ts` - Migrate .env to Secrets Manager
- `tests/secrets/test_secrets_manager.test.ts`

**Integration:**
```typescript
// File: src/corsair-mvp.ts
export class Corsair {
  private secretsManager: SecretsManager;

  async initialize(): Promise<void> {
    this.secretsManager = new SecretsManager(process.env.AWS_REGION!);

    // Fetch credentials from Secrets Manager
    const awsCreds = await this.secretsManager.getSecret(
      "aws_credentials",
      this.tenantId
    );

    // Initialize AWS clients with fetched credentials
    this.initializeAWSClients(JSON.parse(awsCreds));
  }
}
```

#### Week 24: Structured Logging & Metrics

**File: `src/observability/logger.ts`**

```typescript
import pino from 'pino';

export interface LogContext {
  tenantId?: string;
  raidId?: string;
  traceId?: string;
  spanId?: string;
}

export class CorsairLogger {
  private logger: pino.Logger;

  constructor() {
    this.logger = pino({
      level: process.env.LOG_LEVEL || 'info',
      formatters: {
        level: (label) => ({ level: label }),
      },
      timestamp: pino.stdTimeFunctions.isoTime,
    });
  }

  info(message: string, context?: LogContext): void {
    this.logger.info({ ...context }, message);
  }

  error(message: string, error: Error, context?: LogContext): void {
    this.logger.error({ ...context, err: error }, message);
  }

  // Audit log for security events
  audit(event: string, actor: string, resource: string, context?: LogContext): void {
    this.logger.info({
      ...context,
      audit: true,
      event,
      actor,
      resource,
      timestamp: new Date().toISOString(),
    }, `AUDIT: ${event}`);
  }
}
```

**File: `src/observability/metrics.ts`**

```typescript
import { Registry, Counter, Histogram, Gauge } from 'prom-client';

export class CorsairMetrics {
  private registry: Registry;

  // Counters
  private raidsTotal: Counter;
  private raidsSuccessful: Counter;
  private raidsFailed: Counter;

  // Histograms
  private raidDuration: Histogram;
  private databaseQueryDuration: Histogram;

  // Gauges
  private activeRaids: Gauge;
  private lockedLanes: Gauge;

  constructor() {
    this.registry = new Registry();

    this.raidsTotal = new Counter({
      name: 'corsair_raids_total',
      help: 'Total number of raids executed',
      labelNames: ['tenant_id', 'vector', 'provider'],
      registers: [this.registry],
    });

    this.raidDuration = new Histogram({
      name: 'corsair_raid_duration_seconds',
      help: 'Raid execution duration',
      labelNames: ['tenant_id', 'vector'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
      registers: [this.registry],
    });

    // Initialize other metrics...
  }

  recordRaidStart(tenantId: string, vector: string): void {
    this.raidsTotal.inc({ tenant_id: tenantId, vector });
    this.activeRaids.inc({ tenant_id: tenantId });
  }

  recordRaidComplete(tenantId: string, vector: string, duration: number, success: boolean): void {
    this.raidDuration.observe({ tenant_id: tenantId, vector }, duration / 1000);
    this.activeRaids.dec({ tenant_id: tenantId });

    if (success) {
      this.raidsSuccessful.inc({ tenant_id: tenantId, vector });
    } else {
      this.raidsFailed.inc({ tenant_id: tenantId, vector });
    }
  }

  getMetrics(): string {
    return this.registry.metrics();
  }
}
```

**HTTP Metrics Endpoint:**
```typescript
// File: src/api/metrics-endpoint.ts
import express from 'express';
import { CorsairMetrics } from '../observability/metrics';

export function createMetricsEndpoint(metrics: CorsairMetrics): express.Router {
  const router = express.Router();

  router.get('/metrics', (req, res) => {
    res.set('Content-Type', 'text/plain');
    res.send(metrics.getMetrics());
  });

  return router;
}
```

#### Week 27: Crash Recovery Testing

**File: `tests/reliability/test_crash_recovery.test.ts`**

```typescript
describe("Crash Recovery", () => {
  test("uncommitted transactions rolled back on restart", async () => {
    // Start raid
    const promise = corsair.raid(snapshot, options);

    // Simulate crash mid-execution
    await sleep(100);
    process.kill(process.pid, 'SIGTERM');

    // Restart
    const newCorsair = new Corsair({ database: dbPath });
    await newCorsair.recoverFromCrash();

    // Verify rollback completed
    const transactions = await db.getTransactions(raidId);
    expect(transactions.every(tx => tx.status === 'ROLLED_BACK')).toBe(true);
  });

  test("orphaned lane locks released on restart", async () => {
    // Lock lane
    await db.acquireLane(laneKey, raidId, tenantId);

    // Simulate crash
    process.exit(1);

    // Restart
    const newCorsair = new Corsair({ database: dbPath });
    await newCorsair.recoverFromCrash();

    // Verify lane released
    const canAcquire = await db.acquireLane(laneKey, newRaidId, tenantId);
    expect(canAcquire).toBe(true);
  });

  test("partial evidence chain recovered", async () => {
    // Write evidence records
    await evidenceEngine.append("recon", data1, tenantId);

    // Simulate crash before hash chain update
    process.exit(1);

    // Restart and verify
    const newEngine = new EvidenceEngine(db);
    const chain = await newEngine.getChain(tenantId);
    const verification = await newEngine.verifyChain(tenantId);

    expect(verification.valid).toBe(true);
  });
});
```

**Crash Recovery Implementation:**

**File: `src/recovery/crash-recovery.ts`**

```typescript
export class CrashRecoveryManager {
  private db: DatabaseInterface;
  private txLog: TransactionLog;

  async recover(): Promise<RecoveryReport> {
    const report: RecoveryReport = {
      transactionsRolledBack: 0,
      lanesReleased: 0,
      orphanedResourcesCleaned: 0,
      errors: [],
    };

    try {
      // 1. Rollback uncommitted transactions
      const pendingTxs = await this.db.getPendingTransactions();
      for (const tx of pendingTxs) {
        try {
          await this.txLog.rollback(tx.raidId, tx.tenantId);
          report.transactionsRolledBack++;
        } catch (error) {
          report.errors.push({
            type: 'transaction_rollback',
            raidId: tx.raidId,
            error: error.message,
          });
        }
      }

      // 2. Release orphaned lane locks
      const orphanedLanes = await this.db.getOrphanedLanes(300000); // 5 min timeout
      for (const lane of orphanedLanes) {
        await this.db.releaseLane(lane.laneKey, lane.tenantId);
        report.lanesReleased++;
      }

      // 3. Clean up orphaned resources
      const orphanedResources = await this.findOrphanedResources();
      for (const resource of orphanedResources) {
        await this.cleanupResource(resource);
        report.orphanedResourcesCleaned++;
      }

      return report;
    } catch (error) {
      report.errors.push({
        type: 'recovery_failure',
        error: error.message,
      });
      throw error;
    }
  }
}
```

---

## 🚀 Phase 4: Production Launch (Months 8-10)

**Goal:** Deploy to production with Kubernetes, scale testing, and monitoring.

### Milestones

#### M4.1: Kubernetes Deployment (Week 31-34)
- Helm charts for CORSAIR
- PostgreSQL migration from SQLite
- Horizontal pod autoscaling
- StatefulSets for database

#### M4.2: Scale Testing (Week 35-37)
- Load testing (1000 concurrent raids)
- Multi-tenant stress testing
- Database connection pooling
- Performance optimization

#### M4.3: Production Readiness (Week 38-40)
- Security audit (external)
- Compliance validation (SOC2 Type 1)
- Disaster recovery testing
- Documentation finalization
- Production launch

### Key File Changes - Phase 4

#### Week 31: PostgreSQL Migration

**File: `src/database/postgres-database.ts`**

```typescript
import { Pool } from 'pg';

export class PostgresDatabase implements DatabaseInterface {
  private pool: Pool;

  constructor(config: PostgresConfig) {
    this.pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      max: 20, // connection pool size
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }

  async saveRaid(raid: RaidResult, tenantId: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(`
        INSERT INTO raids (raid_id, tenant_id, target, vector, intensity,
                          success, started_at, completed_at, duration_ms)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        raid.raidId,
        tenantId,
        raid.target,
        raid.vector,
        raid.intensity,
        raid.success,
        raid.startedAt,
        raid.completedAt,
        raid.durationMs,
      ]);

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Implement all other methods with PostgreSQL-specific optimizations
}
```

**Migration Script:**

**File: `scripts/migrate-sqlite-to-postgres.ts`**

```typescript
import { SQLiteDatabase } from '../src/database/sqlite-database';
import { PostgresDatabase } from '../src/database/postgres-database';

export async function migrate(
  sqlitePath: string,
  postgresConfig: PostgresConfig
): Promise<MigrationReport> {
  const sqlite = new SQLiteDatabase(sqlitePath);
  const postgres = new PostgresDatabase(postgresConfig);

  const report: MigrationReport = {
    tenantsCount: 0,
    raidsCount: 0,
    evidenceCount: 0,
    errors: [],
  };

  try {
    // Migrate tenants
    const tenants = await sqlite.getAllTenants();
    for (const tenant of tenants) {
      await postgres.saveTenant(tenant);
      report.tenantsCount++;
    }

    // Migrate raids
    const raids = await sqlite.getAllRaids();
    for (const raid of raids) {
      await postgres.saveRaid(raid.data, raid.tenantId);
      report.raidsCount++;
    }

    // Migrate evidence chains
    const allEvidence = await sqlite.getAllEvidence();
    for (const evidence of allEvidence) {
      await postgres.appendEvidence(evidence.data, evidence.tenantId);
      report.evidenceCount++;
    }

    return report;
  } catch (error) {
    report.errors.push(error.message);
    throw error;
  }
}
```

#### Week 33: Kubernetes Helm Chart

**File: `deploy/helm/corsair/Chart.yaml`**

```yaml
apiVersion: v2
name: corsair
description: CORSAIR Chaos Engineering Platform
type: application
version: 1.0.0
appVersion: "1.0.0"
```

**File: `deploy/helm/corsair/values.yaml`**

```yaml
replicaCount: 3

image:
  repository: corsair/corsair
  tag: "1.0.0"
  pullPolicy: IfNotPresent

service:
  type: ClusterIP
  port: 3000

ingress:
  enabled: true
  className: nginx
  hosts:
    - host: corsair.example.com
      paths:
        - path: /
          pathType: Prefix

database:
  type: postgres
  host: postgres-service
  port: 5432
  name: corsair
  existingSecret: corsair-db-secret

secrets:
  awsSecretsManager:
    region: us-west-2
    roleArn: arn:aws:iam::123456789012:role/corsair-secrets-reader

autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70

resources:
  limits:
    cpu: 2000m
    memory: 4Gi
  requests:
    cpu: 1000m
    memory: 2Gi

monitoring:
  prometheus:
    enabled: true
    port: 9090
  tracing:
    enabled: true
    jaegerEndpoint: http://jaeger-collector:14268/api/traces
```

**File: `deploy/helm/corsair/templates/deployment.yaml`**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "corsair.fullname" . }}
  labels:
    {{- include "corsair.labels" . | nindent 4 }}
spec:
  replicas: {{ .Values.replicaCount }}
  selector:
    matchLabels:
      {{- include "corsair.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      labels:
        {{- include "corsair.selectorLabels" . | nindent 8 }}
    spec:
      containers:
      - name: corsair
        image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
        ports:
        - name: http
          containerPort: 3000
        - name: metrics
          containerPort: 9090
        env:
        - name: NODE_ENV
          value: production
        - name: DATABASE_HOST
          value: {{ .Values.database.host }}
        - name: DATABASE_PORT
          value: "{{ .Values.database.port }}"
        - name: DATABASE_NAME
          value: {{ .Values.database.name }}
        - name: AWS_REGION
          value: {{ .Values.secrets.awsSecretsManager.region }}
        envFrom:
        - secretRef:
            name: {{ .Values.database.existingSecret }}
        resources:
          {{- toYaml .Values.resources | nindent 10 }}
        livenessProbe:
          httpGet:
            path: /health
            port: http
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: http
          initialDelaySeconds: 5
          periodSeconds: 5
```

#### Week 35: Load Testing

**File: `tests/load/raid-load-test.ts`**

```typescript
import { check } from 'k6';
import http from 'k6/http';

export const options = {
  stages: [
    { duration: '2m', target: 100 }, // Ramp up to 100 users
    { duration: '5m', target: 100 }, // Stay at 100 users
    { duration: '2m', target: 500 }, // Ramp up to 500 users
    { duration: '5m', target: 500 }, // Stay at 500 users
    { duration: '2m', target: 1000 }, // Ramp up to 1000 users
    { duration: '10m', target: 1000 }, // Stay at 1000 users
    { duration: '2m', target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests under 2s
    http_req_failed: ['rate<0.05'], // Error rate under 5%
  },
};

export default function () {
  const payload = JSON.stringify({
    userPoolId: 'us-west-2_TEST123',
    vector: 'mfa-bypass',
    intensity: 5,
    dryRun: false,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${__ENV.API_TOKEN}`,
    },
  };

  const res = http.post('https://corsair.example.com/api/raid', payload, params);

  check(res, {
    'status is 200': (r) => r.status === 200,
    'raid succeeded': (r) => JSON.parse(r.body).success === true,
    'response time < 2s': (r) => r.timings.duration < 2000,
  });
}
```

**Run Load Test:**
```bash
k6 run --vus 1000 --duration 30m tests/load/raid-load-test.ts
```

---

## 📊 Testing Requirements by Phase

### Phase 1 Testing (Foundation)

**Test Coverage Target:** 85%

**Test Suites:**
1. **Unit Tests** (150 tests)
   - JWT validation (15 tests)
   - RBAC enforcement (20 tests)
   - Database layer (40 tests)
   - Idempotency (15 tests)
   - Ed25519 signing (10 tests)
   - NTP sync (10 tests)

2. **Integration Tests** (50 tests)
   - End-to-end authentication flow (10 tests)
   - Multi-tenant raid execution (15 tests)
   - Evidence chain persistence (10 tests)
   - Lane serialization (15 tests)

3. **Security Tests** (30 tests)
   - JWT tampering detection (10 tests)
   - Cross-tenant access prevention (10 tests)
   - SQL injection prevention (5 tests)
   - Rate limiting (5 tests)

**Test Execution:**
```bash
bun test tests/auth/
bun test tests/database/
bun test tests/evidence/
bun test tests/integration/
```

### Phase 2 Testing (AWS Integration)

**Test Coverage Target:** 80%

**Test Suites:**
1. **AWS Integration Tests** (60 tests)
   - Cognito API calls (20 tests)
   - Retry logic (15 tests)
   - Error handling (15 tests)
   - Credential management (10 tests)

2. **Transaction Tests** (40 tests)
   - Transaction logging (15 tests)
   - Rollback execution (15 tests)
   - Crash recovery (10 tests)

3. **LocalStack Tests** (30 tests)
   - Real AWS SDK against LocalStack
   - Test all Cognito operations
   - Verify compensating transactions

**Test Execution:**
```bash
# Start LocalStack
docker-compose up -d localstack

# Run integration tests
bun test tests/providers/aws/ --env=localstack

# Run transaction tests
bun test tests/transactions/
```

### Phase 3 Testing (Hardening)

**Test Coverage Target:** 90%

**Test Suites:**
1. **Reliability Tests** (50 tests)
   - Crash recovery (20 tests)
   - Orphaned resource cleanup (15 tests)
   - Secret rotation (15 tests)

2. **Chaos Tests** (Dog-fooding)
   - Run CORSAIR against itself
   - Inject failures at random
   - Verify recovery

3. **Security Audit**
   - External penetration testing
   - OWASP Top 10 validation
   - Compliance checks

**Test Execution:**
```bash
# Chaos testing
bun run scripts/chaos-test.ts --duration=1h

# Crash recovery testing
bun run scripts/crash-recovery-test.ts --iterations=100
```

### Phase 4 Testing (Production)

**Test Coverage Target:** 85% (maintained)

**Test Suites:**
1. **Load Tests** (k6)
   - 1000 concurrent users
   - 30-minute duration
   - Multi-tenant load

2. **Performance Tests**
   - Database query optimization
   - Connection pool tuning
   - Memory leak detection

3. **Disaster Recovery**
   - Database backup/restore
   - Multi-region failover
   - Data corruption recovery

**Test Execution:**
```bash
# Load testing
k6 run tests/load/raid-load-test.ts

# Performance profiling
bun run --inspect scripts/profile-performance.ts

# Disaster recovery drill
bun run scripts/dr-drill.ts --scenario=database_failure
```

---

## ✅ Definition of Done by Milestone

### Phase 1 Milestones

**M1.1: Authentication & Authorization**
- [ ] Auth0 tenant configured and tested
- [ ] JWT validation middleware blocks unauthenticated requests
- [ ] RBAC prevents cross-tenant access (20 tests passing)
- [ ] API keys work from CLI
- [ ] Documentation: Authentication guide published
- [ ] Security review: No critical vulnerabilities found
- [ ] Performance: Auth check adds <5ms overhead

**M1.2: State Persistence**
- [ ] SQLite schema applied successfully
- [ ] All raids persist to database
- [ ] Evidence chain maintained in database (hash chain verified)
- [ ] Lane serialization prevents concurrent raids on same target
- [ ] Migration tool migrates existing data without loss
- [ ] Database tests: 40/40 passing
- [ ] Performance: Database writes <100ms p95

**M1.3: Idempotency & Attribution**
- [ ] Duplicate raids with same key return cached results
- [ ] All evidence records have valid Ed25519 signatures
- [ ] Signatures verify correctly (10/10 tests passing)
- [ ] NTP drift calculated and logged on startup
- [ ] Documentation: Evidence attribution guide published
- [ ] Performance: Signature generation <10ms per record

### Phase 2 Milestones

**M2.1: Real AWS Cognito Integration**
- [ ] Cognito provider uses real AWS SDK (not simulation)
- [ ] LocalStack integration tests passing (30/30)
- [ ] Rate limiting handled gracefully with exponential backoff
- [ ] AWS credentials loaded from Secrets Manager
- [ ] Error messages user-friendly and actionable
- [ ] Documentation: AWS setup guide published
- [ ] Performance: API calls complete <2s p95

**M2.2: Compensating Transactions**
- [ ] All mutations logged to transaction table
- [ ] Rollback restores original state (15/15 tests passing)
- [ ] Crash recovery replays uncommitted transactions
- [ ] Orphaned resources cleaned up automatically
- [ ] Transaction log auditable and tamper-evident
- [ ] Documentation: Transaction rollback guide published
- [ ] Reliability: 99.9% successful rollbacks

**M2.3: Provider Plugin Maturity**
- [ ] Plugin SDK published with documentation
- [ ] Common error handling patterns documented
- [ ] Retry policies configurable per provider
- [ ] Plugin testing framework with LocalStack support
- [ ] At least 2 providers implemented (Cognito + 1 other)
- [ ] Documentation: Plugin development guide published

### Phase 3 Milestones

**M3.1: Secrets Management**
- [ ] All secrets migrated to AWS Secrets Manager
- [ ] No secrets in .env or code
- [ ] Secret rotation tested and automated
- [ ] Audit logging for secret access
- [ ] Documentation: Secrets management guide published
- [ ] Security: External audit passes

**M3.2: Observability**
- [ ] Structured JSON logs for all operations
- [ ] Prometheus metrics endpoint exposed
- [ ] Grafana dashboards deployed
- [ ] Distributed tracing with Jaeger
- [ ] Health check and readiness endpoints working
- [ ] Documentation: Observability guide published
- [ ] Monitoring: Alerts configured for critical metrics

**M3.3: Reliability Engineering**
- [ ] Chaos testing (dog-fooding) completes without data loss
- [ ] Crash recovery validated with 100 iterations
- [ ] Backup and restore procedures tested
- [ ] Disaster recovery playbook documented and tested
- [ ] RTO <1 hour, RPO <5 minutes
- [ ] Documentation: DR playbook published

### Phase 4 Milestones

**M4.1: Kubernetes Deployment**
- [ ] Helm chart deploys successfully to staging cluster
- [ ] PostgreSQL migration completes without data loss
- [ ] Horizontal pod autoscaling tested (3-10 pods)
- [ ] StatefulSets stable under load
- [ ] Documentation: Kubernetes deployment guide published

**M4.2: Scale Testing**
- [ ] Load test: 1000 concurrent users, 95th percentile <2s
- [ ] Multi-tenant stress test: 50 tenants, no cross-tenant leakage
- [ ] Database connection pool tuned for optimal performance
- [ ] Memory leak testing: 24-hour run, no degradation
- [ ] Documentation: Performance tuning guide published

**M4.3: Production Readiness**
- [ ] External security audit passes (no critical/high findings)
- [ ] SOC2 Type 1 compliance validated
- [ ] Disaster recovery drill successful
- [ ] Production documentation finalized and reviewed
- [ ] Launch checklist: 100% complete
- [ ] Production monitoring: All dashboards operational
- [ ] On-call runbook published

---

## 🗓️ Timeline Summary

| Phase | Duration | Key Deliverables | Team Size |
|-------|----------|------------------|-----------|
| **Phase 1: Foundation** | Months 1-2 | Auth, SQLite, Idempotency | 2 engineers |
| **Phase 2: AWS Integration** | Months 3-5 | Real SDK, Rollback, Transaction Log | 3 engineers |
| **Phase 3: Hardening** | Months 6-7 | Secrets, Observability, Reliability | 3 engineers + SRE |
| **Phase 4: Production** | Months 8-10 | K8s, PostgreSQL, Scale, Launch | 4 engineers + SRE |

**Total Duration:** 7-10 months
**Team Composition:** 2-4 engineers + 1 SRE (Phase 3+)

---

## 🚨 Breaking Changes & Migration Paths

### Phase 1 Breaking Changes

**Breaking Change 1: Authentication Required**

**Impact:** All API calls now require authentication.

**Migration Path:**
1. Generate API keys for existing users:
   ```bash
   bun run scripts/generate-api-keys.ts --tenant=default
   ```

2. Update CLI usage:
   ```bash
   # Before
   corsair strike mfa

   # After
   export CORSAIR_API_KEY=your-api-key-here
   corsair strike mfa
   ```

3. Update programmatic usage:
   ```typescript
   // Before
   const corsair = new Corsair();

   // After
   const corsair = new Corsair({
     authContext: {
       tenantId: "your-tenant-id",
       userId: "your-user-id",
       roles: ["operator"],
     },
   });
   ```

**Breaking Change 2: Database Required**

**Impact:** In-memory storage no longer supported.

**Migration Path:**
1. Initialize SQLite database:
   ```bash
   bun run scripts/init-database.ts --path=./corsair.db
   ```

2. Migrate existing JSONL evidence files:
   ```bash
   bun run scripts/migrate-evidence-to-sqlite.ts \
     --input=./corsair-evidence-*.json \
     --database=./corsair.db \
     --tenant=default
   ```

### Phase 2 Breaking Changes

**Breaking Change 3: Real AWS Credentials Required**

**Impact:** Simulation fixtures no longer work by default.

**Migration Path:**
1. Configure AWS credentials in Secrets Manager:
   ```bash
   aws secretsmanager create-secret \
     --name corsair/default/aws_credentials \
     --secret-string '{"accessKeyId":"AKIA...","secretAccessKey":"..."}'
   ```

2. Update Corsair configuration:
   ```typescript
   const corsair = new Corsair({
     provider: "aws-cognito",
     providerConfig: {
       region: "us-west-2",
       credentialsSource: "secrets-manager",
     },
   });
   ```

3. Use simulation mode for testing:
   ```typescript
   const corsair = new Corsair({
     provider: "aws-cognito",
     providerConfig: {
       simulation: true, // Uses fixtures for testing
     },
   });
   ```

### Phase 4 Breaking Changes

**Breaking Change 4: PostgreSQL Required**

**Impact:** SQLite no longer supported in production.

**Migration Path:**
1. Export SQLite data:
   ```bash
   bun run scripts/export-sqlite.ts \
     --database=./corsair.db \
     --output=./migration-data.json
   ```

2. Provision PostgreSQL:
   ```bash
   helm install postgres bitnami/postgresql \
     --set auth.database=corsair \
     --set primary.persistence.size=50Gi
   ```

3. Import data to PostgreSQL:
   ```bash
   bun run scripts/import-postgres.ts \
     --input=./migration-data.json \
     --host=postgres-service \
     --database=corsair
   ```

---

## 📦 Dependencies to Add by Phase

### Phase 1 Dependencies

```json
{
  "dependencies": {
    "jsonwebtoken": "^9.0.2",
    "jwks-rsa": "^3.1.0",
    "better-sqlite3": "^9.2.2",
    "@noble/ed25519": "^2.0.0",
    "ntp-client": "^0.5.3",
    "uuid": "^9.0.1"
  },
  "devDependencies": {
    "@types/jsonwebtoken": "^9.0.5",
    "@types/better-sqlite3": "^7.6.8",
    "@types/uuid": "^9.0.7"
  }
}
```

### Phase 2 Dependencies

```json
{
  "dependencies": {
    "@aws-sdk/client-cognito-identity-provider": "^3.478.0",
    "@aws-sdk/client-secrets-manager": "^3.478.0",
    "aws-sdk-client-mock": "^3.0.0"
  }
}
```

### Phase 3 Dependencies

```json
{
  "dependencies": {
    "pino": "^8.17.2",
    "prom-client": "^15.1.0",
    "@opentelemetry/api": "^1.7.0",
    "@opentelemetry/sdk-node": "^0.45.1",
    "@opentelemetry/exporter-jaeger": "^1.19.0"
  }
}
```

### Phase 4 Dependencies

```json
{
  "dependencies": {
    "pg": "^8.11.3",
    "express": "^4.18.2"
  },
  "devDependencies": {
    "@types/pg": "^8.10.9",
    "@types/express": "^4.17.21",
    "k6": "^0.48.0"
  }
}
```

---

## 🎯 Risk Mitigation

### High-Risk Items

**Risk 1: AWS Rate Limiting**
- **Likelihood:** High
- **Impact:** Medium
- **Mitigation:**
  - Implement exponential backoff (Week 9)
  - Add request queuing with prioritization
  - Monitor AWS API quotas
  - Circuit breaker pattern for degraded service

**Risk 2: Database Migration Failure (SQLite → PostgreSQL)**
- **Likelihood:** Medium
- **Impact:** High
- **Mitigation:**
  - Comprehensive testing in staging (Week 31-32)
  - Rollback plan with SQLite backup
  - Parallel run (both databases) for validation
  - Data integrity verification scripts

**Risk 3: Crash Recovery Edge Cases**
- **Likelihood:** Medium
- **Impact:** High
- **Mitigation:**
  - 100-iteration crash testing (Week 27)
  - Formal verification of transaction log
  - Manual disaster recovery drills
  - Monitoring for uncommitted transactions

**Risk 4: Multi-Tenant Data Leakage**
- **Likelihood:** Low
- **Impact:** Critical
- **Mitigation:**
  - Mandatory tenant isolation tests (Week 6)
  - External security audit (Week 38)
  - Tenant boundary verification in CI/CD
  - Regular penetration testing

---

## 📈 Success Metrics

### Phase 1 Success Metrics
- Authentication: 100% of requests validated
- Multi-tenancy: 0 cross-tenant access incidents
- Database: <100ms p95 write latency
- Test coverage: >85%

### Phase 2 Success Metrics
- AWS integration: >99% API call success rate
- Rollback: >99.9% successful compensating transactions
- Transaction log: 0 data loss incidents

### Phase 3 Success Metrics
- Observability: <1 minute mean time to detection (MTTD)
- Reliability: <1 hour mean time to recovery (MTTR)
- Security: 0 critical/high audit findings

### Phase 4 Success Metrics
- Scale: 1000 concurrent users, <2s p95 latency
- Uptime: >99.9% availability
- Launch: 0 critical bugs in first week

---

## 🏁 Phase 1 Week 1 Quick Start

**Monday Morning (First 2 Hours):**

```bash
# 1. Create feature branch
git checkout -b phase1/authentication

# 2. Set up Auth0 tenant
# Follow: https://auth0.com/docs/get-started/auth0-overview/create-tenants

# 3. Create .env.example template
cat > .env.example << EOF
# Auth0 Configuration
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_AUDIENCE=https://corsair.example.com
AUTH0_CLIENT_ID=your-client-id

# Database
DATABASE_PATH=./corsair.db

# AWS
AWS_REGION=us-west-2
EOF

# 4. Install dependencies
bun add jsonwebtoken jwks-rsa
bun add -d @types/jsonwebtoken

# 5. Create auth types file
mkdir -p src/auth
touch src/auth/types.ts

# 6. Create test file (TDD - Red Phase)
mkdir -p tests/auth
touch tests/auth/test_jwt_validation.test.ts

# 7. Write failing tests
# (See Task 1.3 above for test cases)

# 8. Commit failing tests
git add .
git commit -m "test(auth): add JWT validation tests (Red phase)

All tests intentionally failing. Awaiting implementation.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

**You are now ready to begin Phase 1 Week 1 implementation.**

---

## 📞 Contact & Support

**Roadmap Author:** Engineering Team
**Last Updated:** 2026-02-05
**Review Cycle:** Bi-weekly during execution
**Slack Channel:** #corsair-production

---

*This roadmap is a living document. Update as implementation progresses and new information emerges.*

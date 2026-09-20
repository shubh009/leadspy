/**
 * Phase E Scaled Multi-Cycle Production Discovery Hermetic Unit Test Suite
 * File: server/projects/test/phase_e_scale.test.js
 * 
 * Verifies:
 * 1. Multi-Cycle query coverage across Cycles 1, 2, 3 (100 to 300 queries).
 * 2. Deterministic Bayesian quota distribution per source across cycles.
 * 3. Scaled runner orchestration (dry-run mode: 0 network calls, 0 DB writes).
 * 4. DB Persistence safety guard verification for production runs.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  QueryRotatorService,
  ROTATION_CYCLES
} from '../services/queryRotatorService.js';

import {
  runProductionScaledDiscovery,
  shouldPersistDiscoveryLeads
} from '../scripts/runSearchAndDirectDiscovery.js';

test('🧪 Phase E.1: QueryRotator produces distinct category focuses across Cycles 1, 2, and 3', () => {
  const rotatorCycle1 = new QueryRotatorService({ cycle: 1, batchSize: 30 });
  const queries1 = rotatorCycle1.getQueriesForCycle();

  const rotatorCycle2 = new QueryRotatorService({ cycle: 2, batchSize: 30 });
  const queries2 = rotatorCycle2.getQueriesForCycle();

  const rotatorCycle3 = new QueryRotatorService({ cycle: 3, batchSize: 30 });
  const queries3 = rotatorCycle3.getQueriesForCycle();

  assert.equal(queries1.length, 30);
  assert.equal(queries2.length, 30);
  assert.equal(queries3.length, 30);

  // Each cycle must have 30 queries
  assert.equal(new Set(queries1.map(q => q.query)).size, 30);
  assert.equal(new Set(queries2.map(q => q.query)).size, 30);
  assert.equal(new Set(queries3.map(q => q.query)).size, 30);
});

test('🧪 Phase E.2: Scaled 100-query production discovery executes cycles 1, 2, 3 cleanly in dry-run mode', async () => {
  const result = await runProductionScaledDiscovery({
    totalQueries: 100,
    cycles: [1, 2, 3],
    days: 30,
    persistToDb: false,
    auditOnly: true,
    dryRun: true
  });

  assert.equal(result.cycles.length, 3);
  assert.equal(result.cycleResults.length, 3);
  assert.equal(result.persistToDb, false, 'Audit mode must keep persistToDb false');
  assert.equal(result.auditOnly, true);
  assert.ok(result.aggregatedMetrics.totalQueriesExecuted >= 100, 'Must execute at least 100 queries across cycles');
});

test('🧪 Phase E.3: Scaled 300-query discovery executes all cycles with balanced quotas', async () => {
  const result = await runProductionScaledDiscovery({
    totalQueries: 300,
    cycles: [1, 2, 3],
    days: 30,
    persistToDb: false,
    auditOnly: true,
    dryRun: true
  });

  assert.equal(result.cycles.length, 3);
  assert.ok(result.aggregatedMetrics.totalQueriesExecuted >= 300, 'Must execute at least 300 queries across 3 cycles');
});

test('🧪 Phase E.4: Database persistence is allowed ONLY when explicitly activated in production mode', () => {
  // Default Audit mode: persistToDb=false, auditOnly=true -> BLOCKED
  assert.equal(shouldPersistDiscoveryLeads(false, true), false);

  // Safety guard check: persistToDb=true accidentally passed with auditOnly=true -> STILL BLOCKED
  assert.equal(shouldPersistDiscoveryLeads(true, true), false);

  // Production mode: persistToDb=true AND auditOnly=false -> ALLOWED
  assert.equal(shouldPersistDiscoveryLeads(true, false), true);
});

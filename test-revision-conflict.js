// Test the expectedRevisionId conflict
const { ProposedPlanManager } = require('./packages/kernel/dist/proposed-plan/proposed-plan-manager');
const { InMemoryStore } = require('./packages/kernel/dist/storage/entity-store');
const { v4: uuidv4 } = require('uuid');

async function test() {
  const goalStore = new InMemoryStore();
  const goalManager = new (require('./packages/kernel/dist/goal/goal-manager').GoalManager)(goalStore);
  const proposedPlanStore = new InMemoryStore();
  const proposedPlanManager = new ProposedPlanManager(
    proposedPlanStore,
    async (goalId) => {
      const goal = await goalManager.get(goalId);
      return goal ?? null;
    }
  );

  // Setup goal
  const goalInput = {
    title: 'Test Goal',
    description: 'A test goal',
    desiredOutcome: 'Something good',
    successCriteria: ['Criteria met'],
    constraints: {
      maxBudget: 1000,
      maxDurationMs: 3600000,
      maxMissions: 1,
      maxConcurrentMissions: 1,
      allowedDomains: ['example.com'],
      forbiddenDomains: ['evil.com'],
      allowedCapabilities: ['public_web_research'],
      forbiddenCapabilities: ['purchase'],
      allowedDataScopes: ['public_web'],
      forbiddenDataScopes: ['private'],
      forbiddenActions: ['purchase', 'submit'],
    },
    deadline: undefined,
    budget: undefined,
    frequency: 'once',
    allowedCapabilities: ['public_web_research'],
    forbiddenCapabilities: ['purchase'],
    allowedDataScopes: ['public_web'],
    forbiddenActions: ['purchase', 'submit'],
    autonomyLevel: 'assisted',
    approvalConfig: { policy: 'none' },
    notificationConfig: { policy: 'none' },
    memoryConfig: { policy: 'none' },
    terminationConditions: [],
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const goal = await goalManager.create(goalInput);
  // Allow the capability
  await goalManager.update(goal.id, {
    ...goal,
    allowedCapabilities: [...(goal.allowedCapabilities ?? []), 'public_web_research'],
    constraints: {
      ...goal.constraints,
      allowedCapabilities: [...(goal.constraints.allowedCapabilities ?? []), 'public_web_research'],
    }
  });

  // Create proposed plan
  const planInput = {
    goalId: goal.id,
    planSummary: 'Original plan',
    planTasks: [],
    requestedCapabilities: [{ capabilityId: 'public_web_research' }],
    expectedEvidence: [],
    approvalCheckpoints: [],
    completionConditions: [],
  };
  const plan1 = await proposedPlanManager.createProposedPlan(planInput);
  console.log('Created plan:', plan1.id);
  console.log('Revision number:', plan1.revisionNumber);
  console.log('ExpectedRevisionId:', plan1.expectedRevisionId);
  const storedRevisionNumber = plan1.revisionNumber;
  const storedExpectedRevisionId = plan1.expectedRevisionId;

  // Update the plan (first update)
  const updatedPlan = await proposedPlanManager.updateProposedPlan(plan1.id, {
    planSummary: 'Updated plan',
  });
  console.log('Updated plan:', updatedPlan.id);
  console.log('Revision number:', updatedPlan.revisionNumber);
  console.log('ExpectedRevisionId:', updatedPlan.expectedRevisionId);

  // Now attempt to update with the old expectedRevisionId (should fail)
  try {
    await proposedPlanManager.updateProposedPlan(plan1.id, {
      planSummary: 'Another update',
      expectedRevisionId: storedExpectedRevisionId, // stale
    });
    console.log('ERROR: Update succeeded when it should have failed!');
  } catch (err) {
    console.log('Update failed as expected:', err.message);
    if (err.name === 'ProposedPlanRevisionConflictError') {
      console.log('Correct error type');
    } else {
      console.log('Wrong error type:', err.name);
    }
  }
}

test().catch(console.error);
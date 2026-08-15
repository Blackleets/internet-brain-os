// Test script to validate the proposed plan management functionality
// This mimics the Gherkin scenarios

const { ProposedPlanManager } = require('./packages/kernel/dist/proposed-plan/proposed-plan-manager');
const { GoalManager } = require('./packages/kernel/dist/goal/goal-manager');
const { CapabilityManager } = require('./packages/kernel/dist/capability/capability-manager');
const { InMemoryStore } = require('./packages/kernel/dist/storage/entity-store');
const { v4: uuidv4 } = require('uuid');

async function runTests() {
  console.log('Starting proposed plan management tests...');

  // Setup stores and managers
  const goalStore = new InMemoryStore();
  const goalManager = new GoalManager(goalStore);
  const capabilityStore = new InMemoryStore();
  const capabilityManager = new CapabilityManager(capabilityStore);
  const proposedPlanStore = new InMemoryStore();
  const proposedPlanManager = new ProposedPlanManager(
    proposedPlanStore,
    // The getGoal function: takes a goalId and returns a Promise<UniversalGoal | null>
    // We'll implement it to use the goalManager's get method
    async (goalId) => {
      const goal = await goalManager.get(goalId);
      return goal ?? null;
    }
  );

  // Scenario 1: Create a proposed plan
  console.log('\n=== Scenario 1: Create a proposed plan ===');
  const goalId1 = `goal:${uuidv4()}`;
  const goalInput = {
    id: goalId1,
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
  const goal1 = await goalManager.create(goalInput);
  console.log(`Created goal: ${goal1.id}`);

  // Update goal to allow the capability (though it's already allowed in the input, we'll do it via update)
  const updatedGoal = {
    ...goal1,
    allowedCapabilities: [...(goal1.allowedCapabilities ?? []), 'public_web_research'],
    constraints: {
      ...goal1.constraints,
      allowedCapabilities: [...(goal1.constraints.allowedCapabilities ?? []), 'public_web_research'],
    }
  };
  await goalManager.update(goal1.id, updatedGoal);
  console.log('Updated goal to allow public_web_research capability');

  const planInput = {
    goalId: goal1.id,
    planSummary: 'Test plan',
    planTasks: [],
    requestedCapabilities: [{ capabilityId: 'public_web_research' }],
    expectedEvidence: [],
    approvalCheckpoints: [],
    completionConditions: [],
  };
  const plan1 = await proposedPlanManager.createProposedPlan(planInput);
  console.log(`Created proposed plan: ${plan1.id}`);
  console.log(`Plan status: ${plan1.status}`);
  console.log(`Plan revision number: ${plan1.revisionNumber}`);

  // Validate scenario 1
  if (plan1.status !== 'draft') {
    throw new Error(`Expected status 'draft', got '${plan1.status}'`);
  }
  if (plan1.revisionNumber !== 1) {
    throw new Error(`Expected revision number 1, got '${plan1.revisionNumber}'`);
  }
  console.log('��✅ Scenario 1 passed');

  // Scenario 2: Update a proposed plan with conflict detection
  console.log('\n=== Scenario 2: Update a proposed plan with conflict detection ===');
  const goalId2 = `goal:${uuidv4()}`;
  const goalInput2 = {
    id: goalId2,
    title: 'Test Goal 2',
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
  const goal2 = await goalManager.create(goalInput2);
  console.log(`Created goal: ${goal2.id}`);

  await goalManager.update(goal2.id, {
    ...goal2,
    allowedCapabilities: [...(goal2.allowedCapabilities ?? []), 'public_web_research'],
    constraints: {
      ...goal2.constraints,
      allowedCapabilities: [...(goal2.constraints.allowedCapabilities ?? []), 'public_web_research'],
    }
  });
  console.log('Updated goal to allow public_web_research capability');

  const planInput2 = {
    goalId: goal2.id,
    planSummary: 'Initial plan',
    planTasks: [],
    requestedCapabilities: [{ capabilityId: 'public_web_research' }],
    expectedEvidence: [],
    approvalCheckpoints: [],
    completionConditions: [],
  };
  const plan2 = await proposedPlanManager.createProposedPlan(planInput2);
  console.log(`Created proposed plan: ${plan2.id}`);
  console.log(`Initial plan status: ${plan2.status}`);
  console.log(`Initial plan revision number: ${plan2.revisionNumber}`);

  // Update the plan
  const updatedPlan = await proposedPlanManager.updateProposedPlan(plan2.id, {
    planSummary: 'Updated plan',
  });
  console.log(`Updated proposed plan: ${updatedPlan.id}`);
  console.log(`Updated plan status: ${updatedPlan.status}`);
  console.log(`Updated plan revision number: ${updatedPlan.revisionNumber}`);
  console.log(`Updated plan summary: ${updatedPlan.planSummary}`);

  // Validate scenario 2
  if (updatedPlan.status !== 'draft') {
    throw new Error(`Expected status 'draft', got '${updatedPlan.status}'`);
  }
  if (updatedPlan.revisionNumber !== 2) {
    throw new Error(`Expected revision number 2, got '${updatedPlan.revisionNumber}'`);
  }
  if (updatedPlan.planSummary !== 'Updated plan') {
    throw new Error(`Expected summary 'Updated plan', got '${updatedPlan.planSummary}'`);
  }

  // Check history
  const plansForGoal = await proposedPlanManager.listProposedPlansForGoal(goal2.id);
  console.log(`Number of plans in history for goal ${goal2.id}: ${plansForGoal.length}`);
  if (plansForGoal.length !== 2) {
    throw new Error(`Expected 2 plans in history, got ${plansForGoal.length}`);
  }
  // Check that the revisions are in descending order (latest first)
  if (plansForGoal[0].revisionNumber !== 2) {
    throw new Error(`Expected most recent plan to have revision 2, got ${plansForGoal[0].revisionNumber}`);
  }
  if (plansForGoal[1].revisionNumber !== 1) {
    throw new Error(`Expected older plan to have revision 1, got ${plansForGoal[1].revisionNumber}`);
  }
  console.log('��✅ Scenario 2 passed');

  console.log('\n���🎉 All tests passed!');
}

runTests().catch((err) => {
  console.error('��❌ Test failed:', err);
  process.exit(1);
});
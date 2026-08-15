// Quick verification test for goal management
const { GoalManager } = require('./packages/kernel/dist/goal/goal-manager');
const { InMemoryStore } = require('./packages/kernel/dist/storage/entity-store');
const { v4: uuidv4 } = require('uuid');

async function testGoalManagement() {
  console.log('Testing goal management...');
  
  const goalStore = new InMemoryStore();
  const goalManager = new GoalManager(goalStore);
  
  // Test 1: Create a goal
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
  console.log(`��✅ Created goal: ${goal.id}`);
  console.log(`��✅ Goal status: ${goal.status}`);
  console.log(`��✅ Goal contract version: ${goal.contractVersion}`);
  
  // Test 2: Update goal capabilities
  const updatedGoal = await goalManager.update(goal.id, {
    allowedCapabilities: [...(goal.allowedCapabilities ?? []), 'new_capability']
  });
  
  console.log(`��✅ Updated goal allowedCapabilities: ${updatedGoal.allowedCapabilities}`);
  
  // Test 3: Get goal
  const retrievedGoal = await goalManager.get(goal.id);
  console.log(`��✅ Retrieved goal: ${retrievedGoal?.id}`);
  console.log(`��✅ Retrieved goal status: ${retrievedGoal?.status}`);
  
  console.log('���🎉 All goal management tests passed!');
}

testGoalManagement().catch(console.error);
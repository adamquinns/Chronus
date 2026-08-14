import {
  Campaign,
  GoalCondition,
  GoalState,
  ScenarioCalibrationRule,
  ValidationIssue,
  VisibilityRule,
  WorldState,
} from './domain';
import { snapshotHash } from './audit';
import { canAccess, visibility } from './visibility';

const visibilityIssue = (
  state: WorldState,
  rule: VisibilityRule | undefined,
  path: string,
): ValidationIssue[] => {
  if (!rule) return [{ code: 'VISIBILITY_MISSING', severity: 'ERROR', message: `${path} has no visibility rule.`, path }];
  const unknownActors = rule.actorIds.filter((id) => !state.entities[id]);
  return unknownActors.map((id) => ({
    code: 'VISIBILITY_ACTOR_UNKNOWN',
    severity: 'ERROR' as const,
    message: `${path} grants visibility to unknown actor ${id}.`,
    path,
  }));
};

const validateCalibration = (rules: ScenarioCalibrationRule[]): ValidationIssue[] => {
  if (!rules.length) return [{ code: 'CALIBRATION_EMPTY', severity: 'ERROR', message: 'Scenario has no cold-start calibration rules.', path: 'manifest.calibrationRules' }];
  return rules.flatMap((rule) => {
    const issues: ValidationIssue[] = [];
    if (!rule.allowedImpactClasses.includes(rule.defaultImpactClass)) {
      issues.push({ code: 'CALIBRATION_DEFAULT_DISALLOWED', severity: 'ERROR', message: `${rule.id} defaults to a disallowed impact class.`, path: `manifest.calibrationRules.${rule.id}` });
    }
    if (!rule.mechanismKind && !rule.targetType && !rule.targetId) {
      issues.push({ code: 'CALIBRATION_UNSCOPED', severity: 'ERROR', message: `${rule.id} has no mechanism or target scope.`, path: `manifest.calibrationRules.${rule.id}` });
    }
    return issues;
  });
};

const validateGoalCondition = (state: WorldState, condition: GoalCondition, path: string): ValidationIssue[] => {
  const fields = { METRIC: 'value', RESOURCE: 'amount', ENTITY: 'status', ARC: 'progress', FACT: 'statement' } as const;
  const targetExists = condition.targetType === 'METRIC' ? condition.targetId in state.metrics
    : condition.targetType === 'RESOURCE' ? condition.targetId in state.resources
      : condition.targetType === 'ENTITY' ? condition.targetId in state.entities
        : condition.targetType === 'ARC' ? condition.targetId in state.arcs
          : condition.targetId in state.facts;
  const issues: ValidationIssue[] = [];
  if (!targetExists) issues.push({ code: 'GOAL_TARGET', severity: 'ERROR', message: `Goal condition references missing ${condition.targetType} ${condition.targetId}.`, path });
  if (condition.field !== fields[condition.targetType]) issues.push({ code: 'GOAL_FIELD', severity: 'ERROR', message: `Goal condition uses unsupported field ${condition.targetType}.${condition.field}.`, path });
  if (!['EXISTS', 'NOT_EXISTS'].includes(condition.operator) && condition.value === undefined) issues.push({ code: 'GOAL_VALUE', severity: 'ERROR', message: 'Comparative goal condition has no value.', path });
  return issues;
};

const validateGoal = (state: WorldState, goal: GoalState, path = 'goal'): ValidationIssue[] => {
  const issues = [
    ...goal.victoryRules.flatMap((rule, index) => validateGoalCondition(state, rule, `${path}.victoryRules.${index}`)),
    ...goal.failureRules.flatMap((rule, index) => validateGoalCondition(state, rule, `${path}.failureRules.${index}`)),
  ];
  for (const [index, successor] of (goal.successors ?? []).entries()) {
    if (successor.goal.id === goal.id) issues.push({ code: 'GOAL_SUCCESSOR_CYCLE', severity: 'ERROR', message: 'A goal cannot directly succeed itself.', path: `${path}.successors.${index}` });
    issues.push(...validateGoal(state, successor.goal, `${path}.successors.${index}.goal`));
  }
  return issues;
};

export const validateScenario = (campaign: Campaign): ValidationIssue[] => {
  const { state, beliefs } = campaign;
  const issues: ValidationIssue[] = [];
  if (state.schemaVersion !== 2) issues.push({ code: 'SCENARIO_SCHEMA', severity: 'ERROR', message: 'Scenario must use schema version 2.', path: 'state.schemaVersion' });
  if (!state.entities[state.manifest.playerId]) issues.push({ code: 'PLAYER_ENTITY', severity: 'ERROR', message: 'Player role references a missing entity.', path: 'manifest.playerId' });
  if (!state.manifest.playerRole.trim()) issues.push({ code: 'PLAYER_ROLE', severity: 'ERROR', message: 'Player role is required.', path: 'manifest.playerRole' });
  if (!Number.isFinite(state.manifest.timeScale.amount) || state.manifest.timeScale.amount <= 0) issues.push({ code: 'TIME_SCALE', severity: 'ERROR', message: 'Time scale must be positive.', path: 'manifest.timeScale' });
  for (const rule of state.manifest.timeScaleRules) {
    if (!(rule.condition.targetId in state.metrics) || rule.condition.field !== 'value') issues.push({ code: 'TIME_SCALE_RULE', severity: 'ERROR', message: `Time scale rule ${rule.id} references an invalid metric condition.`, path: `manifest.timeScaleRules.${rule.id}` });
    if (!Number.isFinite(rule.scale.amount) || rule.scale.amount <= 0) issues.push({ code: 'TIME_SCALE_RULE_AMOUNT', severity: 'ERROR', message: `Time scale rule ${rule.id} has invalid scale.`, path: `manifest.timeScaleRules.${rule.id}.scale` });
  }
  if (Number.isNaN(Date.parse(state.currentDateTime))) issues.push({ code: 'CURRENT_TIME', severity: 'ERROR', message: 'Current scenario time is invalid.', path: 'state.currentDateTime' });
  if (state.goal.deadlineTurn <= state.turn) issues.push({ code: 'GOAL_DEADLINE', severity: 'WARNING', message: 'Starting objective deadline is not in the future.', path: 'state.goal.deadlineTurn' });
  if (!state.goal.victoryConditions.length || !state.goal.failureConditions.length) issues.push({ code: 'GOAL_CONDITIONS', severity: 'ERROR', message: 'Scenario must define victory and failure conditions.', path: 'state.goal' });
  if (!state.goal.victoryRules.length || !state.goal.failureRules.length) issues.push({ code: 'GOAL_RULES', severity: 'ERROR', message: 'Scenario must define machine-checkable victory and failure rules.', path: 'state.goal' });
  issues.push(...validateGoal(state, state.goal));

  for (const definition of state.manifest.metricDefinitions) issues.push(...visibilityIssue(state, definition.visibility, `manifest.metricDefinitions.${definition.id}.visibility`));
  for (const resource of Object.values(state.resources)) issues.push(...visibilityIssue(state, resource.visibility, `resources.${resource.id}.visibility`));
  for (const entity of Object.values(state.entities)) {
    issues.push(...visibilityIssue(state, entity.visibility, `entities.${entity.id}.visibility`));
    if (!entity.objectives.length) issues.push({ code: 'ACTOR_OBJECTIVE', severity: 'ERROR', message: `${entity.name} has no objective.`, path: `entities.${entity.id}.objectives` });
    if (!entity.capabilities.length) issues.push({ code: 'ACTOR_CAPABILITY', severity: 'WARNING', message: `${entity.name} has no declared capability.`, path: `entities.${entity.id}.capabilities` });
    if (entity.controllerId && !state.entities[entity.controllerId]) issues.push({ code: 'ENTITY_CONTROLLER', severity: 'ERROR', message: `${entity.name} has an invalid controller.`, path: `entities.${entity.id}.controllerId` });
  }
  for (const relationship of Object.values(state.relationships)) issues.push(...visibilityIssue(state, relationship.visibility, `relationships.${relationship.id}.visibility`));
  for (const arc of Object.values(state.arcs)) {
    issues.push(...visibilityIssue(state, arc.visibility, `arcs.${arc.id}.visibility`));
    if (arc.ownerId && !state.entities[arc.ownerId]) issues.push({ code: 'ARC_OWNER', severity: 'ERROR', message: `${arc.title} has an invalid owner.`, path: `arcs.${arc.id}.ownerId` });
    for (const participantId of arc.participantIds) if (!state.entities[participantId]) issues.push({ code: 'ARC_PARTICIPANT', severity: 'ERROR', message: `${arc.title} has invalid participant ${participantId}.`, path: `arcs.${arc.id}.participantIds` });
    if (arc.threshold <= 0 || arc.progress < 0 || arc.progress > arc.threshold) issues.push({ code: 'ARC_PROGRESS', severity: 'ERROR', message: `${arc.title} has invalid progress.`, path: `arcs.${arc.id}.progress` });
  }
  for (const fact of Object.values(state.facts)) {
    issues.push(...visibilityIssue(state, fact.visibility, `facts.${fact.id}.visibility`));
    if (fact.provenance === 'VERIFIED_FACT' && !fact.sourceRefs.length) issues.push({ code: 'FACT_SOURCE', severity: 'ERROR', message: `${fact.id} is verified but has no source reference.`, path: `facts.${fact.id}.sourceRefs` });
  }
  for (const process of Object.values(state.pendingProcesses)) {
    issues.push(...visibilityIssue(state, process.visibility, `pendingProcesses.${process.id}.visibility`));
    if (!state.entities[process.ownerId]) issues.push({ code: 'PROCESS_OWNER', severity: 'ERROR', message: `${process.label} has an invalid owner.`, path: `pendingProcesses.${process.id}.ownerId` });
    for (const participantId of process.participantIds) if (!state.entities[participantId]) issues.push({ code: 'PROCESS_PARTICIPANT', severity: 'ERROR', message: `${process.label} has invalid participant ${participantId}.`, path: `pendingProcesses.${process.id}.participantIds` });
    if (process.dueTurn <= state.turn) issues.push({ code: 'PROCESS_DUE', severity: 'WARNING', message: `${process.label} begins already due.`, path: `pendingProcesses.${process.id}.dueTurn` });
  }

  for (const rule of state.manifest.authorityRules) {
    if (!state.entities[rule.actorId] || !state.entities[rule.targetId]) issues.push({ code: 'AUTHORITY_ENTITY', severity: 'ERROR', message: `Authority rule references an unknown actor or target.`, path: 'manifest.authorityRules' });
    if (!rule.mechanismKinds.length) issues.push({ code: 'AUTHORITY_SCOPE', severity: 'ERROR', message: `Authority rule ${rule.actorId} → ${rule.targetId} has no mechanism scope.`, path: 'manifest.authorityRules' });
    for (const [index, condition] of (rule.conditionRules ?? []).entries()) issues.push(...validateGoalCondition(state, condition, `manifest.authorityRules.${rule.actorId}.${rule.targetId}.conditionRules.${index}`));
  }
  if (!state.manifest.authorityRules.some((rule) => rule.actorId === state.manifest.playerId && rule.targetId === state.manifest.playerId && rule.mode === 'DIRECT')) {
    issues.push({ code: 'PLAYER_AUTHORITY', severity: 'ERROR', message: 'Player has no coherent direct self-authority rule.', path: 'manifest.authorityRules' });
  }
  for (const entity of Object.values(state.entities).filter((candidate) => candidate.status !== 'DESTROYED')) {
    if (!state.manifest.authorityRules.some((rule) => rule.actorId === entity.id && rule.targetId === entity.id)) issues.push({ code: 'ACTOR_AUTHORITY', severity: 'ERROR', message: `${entity.name} has no explicit self-authority scope.`, path: 'manifest.authorityRules' });
  }
  issues.push(...validateCalibration(state.manifest.calibrationRules));
  for (const rule of state.manifest.calibrationRules) {
    if (rule.targetId && !(rule.targetId in state.metrics) && !state.resources[rule.targetId] && !state.entities[rule.targetId] && !state.relationships[rule.targetId] && !state.arcs[rule.targetId] && !state.facts[rule.targetId]) {
      issues.push({ code: 'CALIBRATION_TARGET', severity: 'ERROR', message: `${rule.id} references missing calibration target ${rule.targetId}.`, path: `manifest.calibrationRules.${rule.id}` });
    }
  }
  for (const [role, metricId] of Object.entries(state.manifest.metricRoles ?? {})) {
    if (metricId && !(metricId in state.metrics)) issues.push({ code: 'METRIC_ROLE_TARGET', severity: 'ERROR', message: `Metric role ${role} references missing metric ${metricId}.`, path: `manifest.metricRoles.${role}` });
  }
  for (const rule of state.manifest.executableHardRules ?? []) {
    if (!rule.id.trim() || !rule.description.trim()) issues.push({ code: 'HARD_RULE_INERT', severity: 'ERROR', message: 'Executable hard rules require an id and description.', path: 'manifest.executableHardRules' });
    for (const actorId of rule.actorIds ?? []) if (!state.entities[actorId]) issues.push({ code: 'HARD_RULE_ACTOR', severity: 'ERROR', message: `${rule.id} references missing actor ${actorId}.`, path: `manifest.executableHardRules.${rule.id}` });
    for (const targetId of rule.targetIds ?? []) if (!state.entities[targetId]) issues.push({ code: 'HARD_RULE_TARGET', severity: 'ERROR', message: `${rule.id} references missing target ${targetId}.`, path: `manifest.executableHardRules.${rule.id}` });
    if (rule.effect === 'REQUIRE_RESOURCE' && (!rule.resourceId || !state.resources[rule.resourceId])) issues.push({ code: 'HARD_RULE_RESOURCE', severity: 'ERROR', message: `${rule.id} requires a missing resource.`, path: `manifest.executableHardRules.${rule.id}` });
    if (rule.effect === 'REQUIRE_CAPABILITY' && !rule.capabilityPattern) issues.push({ code: 'HARD_RULE_CAPABILITY', severity: 'ERROR', message: `${rule.id} has no capability pattern.`, path: `manifest.executableHardRules.${rule.id}` });
    for (const [index, condition] of (rule.conditions ?? []).entries()) issues.push(...validateGoalCondition(state, condition, `manifest.executableHardRules.${rule.id}.conditions.${index}`));
  }
  if (state.manifest.hardRules.length && !(state.manifest.executableHardRules?.length)) issues.push({ code: 'HARD_RULES_DOCUMENTARY_ONLY', severity: 'WARNING', message: 'Scenario has documentary hard rules but no executable hard rules.', path: 'manifest.hardRules' });
  for (const analog of state.manifest.historicalAnalogs) {
    if (!analog.sourceRefs.length) issues.push({ code: 'ANALOG_SOURCE', severity: 'ERROR', message: `${analog.id} has no source reference.`, path: 'manifest.historicalAnalogs' });
  }
  if (!state.manifest.unresolvedUncertainties.length) issues.push({ code: 'SCENARIO_UNCERTAINTY', severity: 'ERROR', message: 'Scenario must identify unresolved starting uncertainty.', path: 'manifest.unresolvedUncertainties' });
  if (['cuban_missile_crisis_black_saturday', 'american_twilight'].includes(state.manifest.id) && state.manifest.executableHardRules?.length) {
    const world = state.manifest.narrativeWorld;
    if (!world || !world.sourceMaterialRef || world.openingScene.split(/\s+/).length < 100 || !world.canonicalContext.length || !world.artifactFormats.length) {
      issues.push({ code: 'NARRATIVE_WORLD_INCOMPLETE', severity: 'ERROR', message: 'Supported scenarios require a sourced, substantial Narrative World Model.', path: 'manifest.narrativeWorld' });
    } else {
      const narrativeText = JSON.stringify(world).toLowerCase();
      for (const fact of Object.values(state.facts).filter((candidate) => !canAccess(candidate.visibility, state.manifest.playerId, state.manifest.playerId, state.gameOver))) {
        if (fact.statement.length > 24 && narrativeText.includes(fact.statement.toLowerCase())) issues.push({ code: 'NARRATIVE_WORLD_LEAK', severity: 'ERROR', message: `Narrative world exposes hidden fact ${fact.id}.`, path: 'manifest.narrativeWorld' });
      }
    }
    if (state.manifest.advisors.length < 2 || state.manifest.advisors.some((advisor) => !advisor.voice || !advisor.personalStakes || !advisor.recurringTension)) {
      issues.push({ code: 'ADVISOR_CHARACTER_INCOMPLETE', severity: 'ERROR', message: 'Supported scenarios require fully characterized recurring advisors.', path: 'manifest.advisors' });
    }
  }

  const holders = [beliefs.player, ...Object.values(beliefs.actors)];
  for (const holder of holders) {
    if (!state.entities[holder.actorId]) issues.push({ code: 'BELIEF_HOLDER_UNKNOWN', severity: 'ERROR', message: `Belief holder ${holder.actorId} is not an entity.`, path: `beliefs.${holder.actorId}` });
    for (const factId of holder.knownFactIds) {
      const fact = state.facts[factId];
      if (!fact) {
        issues.push({ code: 'BELIEF_FACT_UNKNOWN', severity: 'ERROR', message: `${holder.actorId} references missing fact ${factId}.`, path: `beliefs.${holder.actorId}.knownFactIds` });
      } else if (!canAccess(fact.visibility, holder.actorId, state.manifest.playerId, state.gameOver)) {
        issues.push({ code: 'BELIEF_VISIBILITY_LEAK', severity: 'ERROR', message: `${holder.actorId} knows inaccessible fact ${factId}.`, path: `beliefs.${holder.actorId}.knownFactIds` });
      }
    }
    for (const [key, belief] of Object.entries(holder.beliefs)) {
      if (belief.range && (belief.range[0] > belief.range[1] || belief.range.some((value) => !Number.isFinite(value)))) {
        issues.push({ code: 'BELIEF_RANGE', severity: 'ERROR', message: `${holder.actorId} has invalid range for ${key}.`, path: `beliefs.${holder.actorId}.${key}` });
      }
      for (const sourceFactId of belief.sourceFactIds) {
        const source = state.facts[sourceFactId];
        if (!source) issues.push({ code: 'BELIEF_SOURCE_UNKNOWN', severity: 'ERROR', message: `${holder.actorId} belief ${key} cites missing fact ${sourceFactId}.`, path: `beliefs.${holder.actorId}.${key}.sourceFactIds` });
        else if (!canAccess(source.visibility, holder.actorId, state.manifest.playerId, state.gameOver)) issues.push({ code: 'BELIEF_SOURCE_LEAK', severity: 'ERROR', message: `${holder.actorId} belief ${key} cites inaccessible fact ${sourceFactId}.`, path: `beliefs.${holder.actorId}.${key}.sourceFactIds` });
      }
    }
  }
  return issues;
};

export const assertValidScenario = (campaign: Campaign) => {
  const fatal = validateScenario(campaign).filter((issue) => issue.severity === 'ERROR');
  if (fatal.length) throw new Error(`Scenario validation failed: ${fatal[0].message}`);
};

const ensureActorAuthority = (state: WorldState) => {
  const mechanismKinds = ['DIRECT_ORDER', 'DIPLOMACY', 'COERCION', 'ECONOMIC_PRESSURE', 'MILITARY_OPERATION', 'INTELLIGENCE', 'DECEPTION', 'LEGAL_ACTION', 'PUBLIC_COMMUNICATION', 'COALITION_BUILDING', 'RESOURCE_TRANSFER', 'OTHER'] as const;
  for (const entity of Object.values(state.entities)) {
    if (!state.manifest.authorityRules.some((rule) => rule.actorId === entity.id && rule.targetId === entity.id)) state.manifest.authorityRules.push({
      actorId: entity.id, targetId: entity.id, mechanismKinds: [...mechanismKinds], mode: 'DIRECT', conditions: ['Migrated explicit self-authority; still bounded by declared capabilities and resources'],
    });
  }
};

export const migrateCampaign = (input: Campaign): Campaign => {
  const raw = structuredClone(input) as Campaign & { state: WorldState & { schemaVersion: number }; memories?: Campaign['memories'] };
  if (raw.state.schemaVersion === 2) {
    raw.memories ??= Object.fromEntries(Object.keys(raw.state.entities).map((actorId) => [actorId, { actorId, events: [], historicalPriorWeight: 1 }]));
    raw.storySummary ??= '';
    raw.narrativeCharacters ??= [];
    raw.narrativeThreads ??= [];
    raw.chronicle ??= raw.audits.map((audit) => ({ turn: audit.turn, date: audit.committedStateSnapshot?.dateLabel ?? `Turn ${audit.turn}`, title: audit.narrative.title, summary: audit.narrative.chronicleEntry ?? audit.narrative.immediateOutcome }));
    raw.state.manifest.unresolvedUncertainties ??= ['This migrated scenario did not explicitly record unresolved uncertainty.'];
    raw.state.manifest.timeScaleRules ??= [];
    for (const arc of Object.values(raw.state.arcs)) arc.participantIds ??= [...new Set([...(arc.ownerId ? [arc.ownerId] : []), raw.state.manifest.playerId])];
    for (const process of Object.values(raw.state.pendingProcesses)) {
      process.perTurnEffects ??= [];
      process.participantIds ??= [...new Set([process.ownerId, raw.state.manifest.playerId])];
    }
    ensureActorAuthority(raw.state);
    for (const audit of raw.audits) {
      const legacyAudit = audit as TurnAuditCompat;
      legacyAudit.modelCalls ??= [];
      legacyAudit.progressEvents ??= [];
      legacyAudit.actorSimulationPackets ??= [];
      legacyAudit.accessDecisions ??= [];
      legacyAudit.detectionRecords ??= [];
      legacyAudit.narrative.detailedReport ??= legacyAudit.narrative.immediateOutcome;
      legacyAudit.narrative.pressCoverage ??= [];
      legacyAudit.narrative.updatedStorySummary ??= '';
      legacyAudit.narrative.newCharacters ??= [];
      legacyAudit.narrative.chronicleEntry ??= legacyAudit.narrative.immediateOutcome;
      legacyAudit.narrative.storyThreadUpdates ??= [];
      legacyAudit.counterfactualBranches ??= [];
      legacyAudit.disagreement ??= { compared: false, material: false, severityScore: 0, differences: [], response: 'NONE' };
      legacyAudit.previousMemorySnapshot ??= structuredClone(raw.memories);
      legacyAudit.committedMemorySnapshot ??= structuredClone(raw.memories);
      legacyAudit.auditVersion ??= 2;
      if (!legacyAudit.previousStateSnapshot || !legacyAudit.committedStateSnapshot) {
        legacyAudit.legacyIncomplete = true;
      } else if (legacyAudit.hashVersion !== 2) {
        legacyAudit.previousStateHash = snapshotHash(legacyAudit.previousStateSnapshot);
        legacyAudit.committedStateHash = snapshotHash(legacyAudit.committedStateSnapshot);
        legacyAudit.hashVersion = 2;
      }
    }
    return raw;
  }

  const playerId = raw.state.manifest.playerId;
  raw.state.schemaVersion = 2;
  raw.state.currentDateTime = raw.state.manifest.historicalCutoff;
  raw.state.elapsedMinutes = raw.state.turn * 240;
  raw.state.manifest.timeScale = { amount: 4, unit: raw.state.manifest.timeUnit };
  raw.state.manifest.timeScaleRules = [];
  raw.state.manifest.authorityRules = [];
  raw.state.manifest.calibrationRules = [{ id: 'legacy_default', targetType: 'METRIC', allowedImpactClasses: ['NONE', 'TRIVIAL', 'MINOR', 'MODERATE', 'MAJOR'], defaultImpactClass: 'MINOR', rationale: 'Legacy campaign compatibility calibration.' }];
  raw.state.manifest.historicalAnalogs = [];
  raw.state.manifest.hardRules = [];
  raw.state.manifest.advisors = [];
  raw.state.manifest.unresolvedUncertainties = ['Legacy scenario uncertainty was not explicitly authored.'];
  raw.state.goal.victoryRules ??= [{ targetType: 'METRIC', targetId: raw.state.manifest.metricDefinitions[0]?.id ?? '', field: 'value', operator: 'GTE', value: 101 }];
  raw.state.goal.failureRules ??= [{ targetType: 'METRIC', targetId: raw.state.manifest.metricDefinitions[0]?.id ?? '', field: 'value', operator: 'GTE', value: 100 }];
  raw.state.goal.victoryMode ??= 'ALL';
  raw.state.goal.failureMode ??= 'ANY';
  raw.state.goal.terminalOnAchievement ??= true;
  raw.state.goal.terminalOnFailure ??= true;
  for (const definition of raw.state.manifest.metricDefinitions) definition.visibility ??= visibility('PLAYER_KNOWN', [playerId]);
  for (const resource of Object.values(raw.state.resources)) resource.visibility ??= visibility('ACTOR_KNOWN', [resource.ownerId]);
  for (const entity of Object.values(raw.state.entities)) {
    entity.visibility ??= visibility('PUBLIC');
    entity.fieldVisibility ??= {};
  }
  for (const relationship of Object.values(raw.state.relationships)) relationship.visibility ??= visibility('ACTOR_KNOWN', [relationship.fromId, relationship.toId]);
  for (const arc of Object.values(raw.state.arcs)) {
    arc.visibility ??= visibility('PLAYER_KNOWN', [playerId]);
    arc.onResolve ??= [];
    arc.participantIds ??= [...new Set([...(arc.ownerId ? [arc.ownerId] : []), playerId])];
  }
  for (const fact of Object.values(raw.state.facts) as Array<typeof raw.state.facts[string] & { knownBy?: string[] }>) {
    fact.visibility ??= visibility('ACTOR_KNOWN', fact.knownBy ?? []);
    fact.sourceRefs ??= fact.source ? [fact.source] : [];
  }
  for (const process of Object.values(raw.state.pendingProcesses)) {
    process.visibility ??= visibility('ACTOR_KNOWN', process.detectableBy);
    process.completed ??= false;
    process.perTurnEffects ??= [];
    process.participantIds ??= [...new Set([process.ownerId, playerId])];
  }
  raw.memories = Object.fromEntries(Object.keys(raw.state.entities).map((actorId) => [actorId, { actorId, events: [], historicalPriorWeight: 1 }]));
  raw.storySummary = '';
  raw.narrativeCharacters = [];
  raw.narrativeThreads = [];
  raw.chronicle = [];
  ensureActorAuthority(raw.state);
  for (const audit of raw.audits) {
    const legacyAudit = audit as TurnAuditCompat;
    legacyAudit.auditVersion = 2;
    legacyAudit.hashVersion = 2;
    legacyAudit.legacyIncomplete = true;
    legacyAudit.modelCalls = [];
    legacyAudit.progressEvents = [];
    legacyAudit.actorSimulationPackets = [];
    legacyAudit.accessDecisions = [];
    legacyAudit.detectionRecords = [];
    legacyAudit.counterfactualBranches = [];
    legacyAudit.disagreement = { compared: false, material: false, severityScore: 0, differences: [], response: 'NONE' };
    legacyAudit.previousMemorySnapshot = structuredClone(raw.memories);
    legacyAudit.committedMemorySnapshot = structuredClone(raw.memories);
  }
  return raw;
};

type TurnAuditCompat = Omit<Campaign['audits'][number], 'hashVersion'> & {
  auditVersion?: 2;
  hashVersion?: 2;
  legacyIncomplete?: boolean;
};

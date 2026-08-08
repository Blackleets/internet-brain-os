export type TriggerCondition =
  | { readonly type: 'price_below'; readonly field: string; readonly threshold: number }
  | { readonly type: 'new_match'; readonly field: string }
  | { readonly type: 'content_changed'; readonly field: string; readonly baselineHash: string }
  | { readonly type: 'deadline_near'; readonly field: string; readonly withinMinutes: number }
  | { readonly type: 'availability_detected'; readonly field: string };

export interface TriggerDefinition {
  readonly id: string;
  readonly goalId: string;
  readonly planId: string;
  readonly revisionId: string;
  readonly condition: TriggerCondition;
  readonly enabled: boolean;
  readonly createdAt: string;
}

export interface TriggerObservation {
  readonly observedAt: string;
  readonly sourceKey: string;
  readonly values: Readonly<Record<string, unknown>>;
}

export interface TriggerEvent {
  readonly id: string;
  readonly triggerId: string;
  readonly goalId: string;
  readonly planId: string;
  readonly revisionId: string;
  readonly sourceKey: string;
  readonly observedAt: string;
  readonly eventKey: string;
  readonly reason: string;
}

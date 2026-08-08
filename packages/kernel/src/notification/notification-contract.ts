export type NotificationPriority = 'low' | 'normal' | 'high' | 'critical';
export type NotificationSourceType = 'trigger' | 'execution' | 'opportunity' | 'system';
export type NotificationState = 'unread' | 'read' | 'dismissed';

export interface QueueNotificationInput {
  readonly dedupeKey: string;
  readonly sourceType: NotificationSourceType;
  readonly sourceId: string;
  readonly goalId?: string;
  readonly evidenceIds?: readonly string[];
  readonly title: string;
  readonly body: string;
  readonly priority: NotificationPriority;
  readonly actionRequired: boolean;
  readonly createdAt: string;
}

export interface NotificationReceipt {
  readonly sequence: number;
  readonly notificationId: string;
  readonly dedupeKey: string;
  readonly event: 'queued' | 'read' | 'dismissed';
  readonly at: string;
  readonly actor: string;
  readonly requestHash?: string;
  readonly payload?: QueueNotificationInput;
}

export interface NotificationView extends QueueNotificationInput {
  readonly id: string;
  readonly state: NotificationState;
  readonly sequence: number;
}

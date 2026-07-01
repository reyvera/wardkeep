import { Injectable } from '@nestjs/common';

import { NotificationsGateway } from './notifications.gateway';

export interface BudgetNotification {
  userId: string;
  type: 'budget_warning' | 'budget_overspent';
  categoryId: string;
  categoryName?: string;
  percentUsed: string;
  allocated: string;
  spent: string;
  createdAt: Date;
}

@Injectable()
export class NotificationsService {
  /** In-memory store of recent notifications */
  private notifications: BudgetNotification[] = [];

  constructor(private readonly gateway: NotificationsGateway) {}

  /**
   * Emits a budget threshold notification via WebSocket and stores it in memory.
   * @param notification - The budget notification to emit
   */
  emitBudgetNotification(notification: BudgetNotification): void {
    this.notifications.push(notification);
    this.gateway.sendToUser(notification.userId, 'budget_notification', notification);
  }

  /**
   * Gets recent notifications for a user.
   * @param userId - The user's ID
   * @returns Array of notifications for the user
   */
  getNotifications(userId: string): BudgetNotification[] {
    return this.notifications.filter((n) => n.userId === userId);
  }

  /**
   * Clears notifications for a user.
   * @param userId - The user's ID
   */
  clearNotifications(userId: string): void {
    this.notifications = this.notifications.filter((n) => n.userId !== userId);
  }
}

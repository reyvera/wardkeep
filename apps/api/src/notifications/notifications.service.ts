import { Injectable } from '@nestjs/common';

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
  /** In-memory store of recent notifications (will be replaced by WebSocket/DB in later task) */
  private notifications: BudgetNotification[] = [];

  /**
   * Emits a budget threshold notification.
   * Currently stores in memory; will be delivered via WebSocket in task 21.
   * @param notification - The budget notification to emit
   */
  emitBudgetNotification(notification: BudgetNotification): void {
    this.notifications.push(notification);
    // TODO: Task 21 will add WebSocket gateway delivery here
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

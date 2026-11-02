import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PreparationQueueQuery } from '../../../graphql/generated/graphql';
import { Order, OrderStatus, OrderType } from '../../../graphql/generated/schema';
import { AuthStateService } from '../../services/auth-state.service';
import { OrderError, OrderService } from '../../services/order.service';
import { formatMoney } from '../../utils/money';

/** One line in a prep-queue order, flattened for display. */
interface PrepOrderItemView {
  id: string;
  name: string;
  quantity: number;
  modifiersLabel: string;
  specialInstructions: string;
}

/** One order card in the staff preparation queue. */
interface PrepOrderView {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  statusLabel: string;
  orderTypeLabel: string;
  customerName: string | null;
  notes: string;
  totalLabel: string;
  items: PrepOrderItemView[];
}

function orderStatusLabel(status: OrderStatus): string {
  switch (status) {
    case OrderStatus.Pending:
      return 'Awaiting acceptance';
    case OrderStatus.Accepted:
      return 'Awaiting prep';
    case OrderStatus.Preparing:
      return 'Being prepared';
    case OrderStatus.Ready:
      return 'Ready';
    case OrderStatus.Completed:
      return 'Completed';
    case OrderStatus.Cancelled:
      return 'Cancelled';
    default:
      return status;
  }
}

function orderTypeLabel(type: OrderType): string {
  switch (type) {
    case OrderType.Takeaway:
      return 'Takeaway';
    case OrderType.DineIn:
      return 'Dine in';
    case OrderType.Delivery:
      return 'Delivery';
    default:
      return type;
  }
}

/**
 * The queue only contains orders the backend still considers in preparation.
 * READY orders are deliberately not carried to COMPLETED: the backend's
 * preparation-queue query does not return READY orders, so there is no reachable
 * completed-order workflow.
 */
function isQueueStatus(status: OrderStatus): boolean {
  return status === OrderStatus.Accepted || status === OrderStatus.Preparing;
}

/** Next preparation step, or null when this screen must not offer one. */
function nextPreparationStatus(status: OrderStatus): OrderStatus | null {
  switch (status) {
    case OrderStatus.Accepted:
      return OrderStatus.Preparing;
    case OrderStatus.Preparing:
      return OrderStatus.Ready;
    default:
      return null;
  }
}

function advanceLabel(status: OrderStatus): string {
  switch (status) {
    case OrderStatus.Accepted:
      return 'Start preparing';
    case OrderStatus.Preparing:
      return 'Mark ready';
    default:
      return 'Advance order';
  }
}

function toPrepOrderView(
  order: Order | PreparationQueueQuery['preparationQueue'][number],
): PrepOrderView {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    statusLabel: orderStatusLabel(order.status),
    orderTypeLabel: orderTypeLabel(order.orderType),
    customerName: order.customerName ?? null,
    notes: order.notes,
    totalLabel: formatMoney(order.total),
    items: order.items.map((item) => ({
      id: item.id,
      name: item.productName,
      quantity: item.quantity,
      modifiersLabel: item.modifiers.map((modifier) => modifier.modifierName).join(', '),
      specialInstructions: item.specialInstructions,
    })),
  };
}

function queueErrorMessage(error: unknown): string {
  if (error instanceof OrderError) {
    switch (error.code) {
      case 'FORBIDDEN':
        return 'Your role cannot view the preparation queue.';
      case 'UNAUTHENTICATED':
      case 'TOKEN_EXPIRED':
      case 'INVALID_REFRESH_TOKEN':
        return 'Your session ended. Sign in again to view the prep queue.';
      default:
        return 'We could not load the prep queue. Please try again.';
    }
  }
  return 'We could not load the prep queue. Check your connection and try again.';
}

function transitionErrorMessage(error: unknown): string {
  if (error instanceof OrderError) {
    switch (error.code) {
      case 'INVALID_STATE':
        return 'This order has already moved on. The queue has been refreshed.';
      case 'FORBIDDEN':
        return 'Your role cannot update this order.';
      case 'NOT_FOUND':
        return 'That order no longer exists.';
      case 'BAD_USER_INPUT':
        return 'That status change is not valid for this order.';
      case 'UNAUTHENTICATED':
      case 'TOKEN_EXPIRED':
      case 'INVALID_REFRESH_TOKEN':
        return 'Your session ended. Sign in again to update orders.';
      default:
        return 'We could not update the order. Please try again.';
    }
  }
  return 'We could not update the order. Check your connection and try again.';
}

function lookupErrorMessage(error: unknown): string {
  if (error instanceof OrderError) {
    switch (error.code) {
      case 'NOT_FOUND':
        return 'No order found with that ID.';
      case 'FORBIDDEN':
        return 'Your role cannot view that order.';
      case 'UNAUTHENTICATED':
      case 'TOKEN_EXPIRED':
      case 'INVALID_REFRESH_TOKEN':
        return 'Your session ended. Sign in again to look up orders.';
      default:
        return 'We could not load that order. Please try again.';
    }
  }
  return 'We could not load that order. Check your connection and try again.';
}

/**
 * Staff preparation queue.
 *
 * Baristas (and owners) load `preparationQueue`, which returns ACCEPTED and
 * PREPARING orders, and advance them with `advanceOrderStatus`
 * (ACCEPTED→PREPARING→READY). READY→COMPLETED is intentionally not offered
 * because the backend cannot retrieve READY orders. Cancellation is gated on
 * `order.cancel` and double-confirmed.
 *
 * Managers/owners also get a pending-acceptance lookup, because the prep queue
 * deliberately excludes PENDING orders. It uses the same transition operation
 * (PENDING→ACCEPTED) behind `order.update_status`. All gating is UI-only; the
 * backend remains the permission boundary and `INVALID_STATE`/`FORBIDDEN` are
 * surfaced as plain-language messages.
 */
@Component({
  selector: 'app-prep',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './prep.component.html',
  styleUrl: './prep.component.css',
})
export class PrepComponent implements OnInit {
  private readonly orderService = inject(OrderService);
  private readonly authState = inject(AuthStateService);
  private readonly fb = inject(FormBuilder);

  protected readonly canViewQueue = computed(() =>
    this.authState.hasPermission('order.read.preparation_queue'),
  );

  protected readonly canUpdateStatus = computed(() =>
    this.authState.hasPermission('order.update_status'),
  );

  protected readonly canCancel = computed(() => this.authState.hasPermission('order.cancel'));

  /**
   * Pending acceptance is scoped to managers/owners. When the token carries no
   * role claim, fall back to the permission-only check (the design's
   * authentication-only fallback); the backend still enforces the transition.
   */
  protected readonly canAcceptPending = computed(() => {
    if (!this.canUpdateStatus()) {
      return false;
    }
    const roles = this.authState.roles();
    if (roles === null) {
      return true;
    }
    return roles.includes('manager') || roles.includes('owner_admin');
  });

  protected readonly queue = signal<PrepOrderView[]>([]);
  protected readonly loadingQueue = signal(false);
  protected readonly queueError = signal<string | null>(null);
  protected readonly transitioningId = signal<string | null>(null);

  protected readonly actionError = signal<string | null>(null);
  protected readonly actionSuccess = signal<string | null>(null);
  protected readonly pendingCancelId = signal<string | null>(null);

  protected readonly lookupForm = this.fb.nonNullable.group({
    orderId: [''],
  });
  protected readonly pendingOrder = signal<PrepOrderView | null>(null);
  protected readonly pendingBusy = signal(false);
  protected readonly pendingError = signal<string | null>(null);

  ngOnInit(): void {
    if (this.canViewQueue()) {
      void this.loadQueue();
    }
  }

  /** Loads the queue; `silent` keeps the old list visible during a resync. */
  protected async loadQueue(silent = false): Promise<void> {
    if (!silent) {
      this.loadingQueue.set(true);
    }
    this.queueError.set(null);
    try {
      const orders = await this.orderService.preparationQueue();
      this.queue.set(orders.map(toPrepOrderView));
    } catch (error) {
      this.queueError.set(queueErrorMessage(error));
    } finally {
      this.loadingQueue.set(false);
    }
  }

  protected canAdvance(order: PrepOrderView): boolean {
    return this.canUpdateStatus() && nextPreparationStatus(order.status) !== null;
  }

  protected advanceButtonLabel(order: PrepOrderView): string {
    return advanceLabel(order.status);
  }

  /** Barista/owner action: move an order to its next preparation status. */
  protected advance(order: PrepOrderView): void {
    const target = nextPreparationStatus(order.status);
    if (!target) {
      return;
    }
    void this.runTransition(order, target);
  }

  protected requestCancel(order: PrepOrderView): void {
    this.actionError.set(null);
    this.actionSuccess.set(null);
    this.pendingCancelId.set(order.id);
  }

  protected dismissCancel(): void {
    this.pendingCancelId.set(null);
  }

  protected confirmCancel(order: PrepOrderView): void {
    void this.runTransition(order, OrderStatus.Cancelled);
  }

  /** Manager/owner: load a PENDING order by ID so it can be accepted. */
  protected async lookUpPendingOrder(): Promise<void> {
    if (this.pendingBusy()) {
      return;
    }
    this.pendingError.set(null);
    this.actionSuccess.set(null);
    const id = this.lookupForm.controls.orderId.value.trim();
    if (!id) {
      this.pendingError.set('Enter an order ID to look up.');
      return;
    }

    this.pendingBusy.set(true);
    try {
      const order = await this.orderService.getOrder(id);
      this.pendingOrder.set(toPrepOrderView(order));
    } catch (error) {
      this.pendingOrder.set(null);
      this.pendingError.set(lookupErrorMessage(error));
    } finally {
      this.pendingBusy.set(false);
    }
  }

  /** Manager/owner: accept the looked-up order (PENDING→ACCEPTED). */
  protected async acceptPendingOrder(): Promise<void> {
    const order = this.pendingOrder();
    if (!order || order.status !== OrderStatus.Pending || this.pendingBusy()) {
      return;
    }

    this.pendingBusy.set(true);
    this.pendingError.set(null);
    this.actionError.set(null);
    try {
      const updated = await this.orderService.advanceOrderStatus(order.id, OrderStatus.Accepted);
      this.applyUpdate(updated);
      this.actionSuccess.set(`Order #${updated.orderNumber} accepted.`);
    } catch (error) {
      this.pendingError.set(transitionErrorMessage(error));
    } finally {
      this.pendingBusy.set(false);
    }
  }

  /**
   * Applies the server's returned order to local state. Orders that leave the
   * preparation window are dropped; a stale transition triggers a silent
   * resync so the screen cannot keep acting on out-of-date statuses.
   */
  private async runTransition(order: PrepOrderView, target: OrderStatus): Promise<void> {
    if (this.transitioningId()) {
      return;
    }
    this.transitioningId.set(order.id);
    this.pendingCancelId.set(null);
    this.actionError.set(null);
    this.actionSuccess.set(null);

    try {
      const updated = await this.orderService.advanceOrderStatus(order.id, target);
      this.applyUpdate(updated);
      this.actionSuccess.set(this.successMessage(updated));
    } catch (error) {
      this.actionError.set(transitionErrorMessage(error));
      if (
        this.canViewQueue() &&
        error instanceof OrderError &&
        (error.code === 'INVALID_STATE' || error.code === 'NOT_FOUND')
      ) {
        await this.loadQueue(true);
      }
    } finally {
      this.transitioningId.set(null);
    }
  }

  private applyUpdate(order: Order): void {
    const view = toPrepOrderView(order);
    this.queue.update((orders) => {
      if (!isQueueStatus(view.status)) {
        return orders.filter((candidate) => candidate.id !== view.id);
      }
      return orders.some((candidate) => candidate.id === view.id)
        ? orders.map((candidate) => (candidate.id === view.id ? view : candidate))
        : [...orders, view];
    });
    this.pendingOrder.update((current) => (current && current.id === view.id ? view : current));
  }

  private successMessage(order: Order): string {
    switch (order.status) {
      case OrderStatus.Preparing:
        return `Order #${order.orderNumber} is now being prepared.`;
      case OrderStatus.Ready:
        return `Order #${order.orderNumber} is ready.`;
      case OrderStatus.Cancelled:
        return `Order #${order.orderNumber} cancelled.`;
      case OrderStatus.Accepted:
        return `Order #${order.orderNumber} accepted.`;
      default:
        return `Order #${order.orderNumber} updated.`;
    }
  }
}

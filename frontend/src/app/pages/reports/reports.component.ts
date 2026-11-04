import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { BaseChartDirective } from 'ng2-charts';
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  DoughnutController,
  Legend,
  LinearScale,
  Tooltip,
} from 'chart.js';
import { graphQLErrorCode } from '../../services/graphql.service';
import { AuthService } from '../../services/auth.service';
import { AuthStateService } from '../../services/auth-state.service';
import { SalesSummaryDocument } from '../../../graphql/generated/graphql';
import type { SalesSummaryQuery } from '../../../graphql/generated/graphql';
import { formatMoney, parseDecimalToCents } from '../../utils/money';

Chart.register(
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  DoughnutController,
  Legend,
  LinearScale,
  Tooltip,
);

/** Backend error surface for loading the sales summary. */
const REPORTS_ERRORS = {
  codes: {
    FORBIDDEN: "You need the report.sales.read permission to view sales reports.",
  },
  auth: 'Your session ended. Sign in again to view sales reports.',
  unknown: 'We could not load the sales report. Please try again.',
  offline: 'We could not load the sales report. Check your connection and try again.',
} as const;

interface SnapshotView {
  netSales: string;
  grossSales: string;
  orderCount: number;
  averageOrderValue: string;
  refundCount: number;
  refundTotal: string;
  empty: boolean;
}

function toSnapshotView(
  snapshot: NonNullable<SalesSummaryQuery['salesSummary']>['today'] | null,
  currency: string,
): SnapshotView {
  if (!snapshot) {
    return {
      netSales: '',
      grossSales: '',
      orderCount: 0,
      averageOrderValue: '',
      refundCount: 0,
      refundTotal: '',
      empty: true,
    };
  }
  const empty =
    (parseDecimalToCents(snapshot.netSales) ?? 0) === 0 &&
    (parseDecimalToCents(snapshot.grossSales) ?? 0) === 0 &&
    snapshot.orderCount === 0 &&
    (parseDecimalToCents(snapshot.averageOrderValue) ?? 0) === 0 &&
    snapshot.refundCount === 0 &&
    (parseDecimalToCents(snapshot.refundTotal) ?? 0) === 0;
  return {
    netSales: moneyLabel(snapshot.netSales, currency),
    grossSales: moneyLabel(snapshot.grossSales, currency),
    orderCount: snapshot.orderCount,
    averageOrderValue: moneyLabel(snapshot.averageOrderValue, currency),
    refundCount: snapshot.refundCount,
    refundTotal: moneyLabel(snapshot.refundTotal, currency),
    empty,
  };
}

/** Renders a backend Decimal money string with `$` for USD, else the ISO code prefix. */
function moneyLabel(value: string, currency: string): string {
  const formatted = formatMoney(value);
  return currency === 'USD' ? formatted : `${currency} ${formatted.replace(/^\$/, '')}`;
}

function chartValue(value: string): number {
  return (parseDecimalToCents(value) ?? 0) / 100;
}

/**
 * Staff sales reports dashboard.
 *
 * Loads `salesSummary` through `AuthService.query`, so the Phase 1
 * refresh-on-expiry orchestration applies. Permission gating is UI-only
 * (`report.sales.read`, with the authentication-only fallback when the token
 * carries no claims); the backend remains the permission boundary and surfaces
 * `FORBIDDEN`. Chart.js is imported only in this lazy chunk, keeping the
 * initial bundle untouched.
 */
@Component({
  selector: 'app-reports',
  imports: [BaseChartDirective],
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.css',
})
export class ReportsComponent {
  private readonly auth = inject(AuthService);
  private readonly authState = inject(AuthStateService);
  private readonly router = inject(Router);

  /** Shown when claims are absent or `report.sales.read` is present. */
  protected readonly canViewReports = computed(() =>
    this.authState.hasPermission('report.sales.read'),
  );

  protected readonly currency = computed(() => this.summary()?.currency ?? 'USD');
  protected readonly timezone = computed(() => this.summary()?.timezone);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly summary = signal<SalesSummaryQuery['salesSummary'] | null>(null);

  protected readonly today = computed(() => toSnapshotView(this.summary()?.today ?? null, this.currency()));
  protected readonly yesterday = computed(() => toSnapshotView(this.summary()?.yesterday ?? null, this.currency()));

  protected readonly trendPoints = computed(() => this.summary()?.trend ?? []);
  protected readonly topItems = computed(() => this.summary()?.topItems ?? []);
  protected readonly hourPoints = computed(() => this.summary()?.hours ?? []);
  protected readonly splitPoints = computed(() => this.summary()?.split ?? []);
  protected readonly refundSummary = computed(() => this.summary()?.refunds ?? { count: 0, total: '0.00' });
  protected readonly recentRefunds = computed(() => this.summary()?.recentRefunds ?? []);

  /** Exposed to the template for per-currency money display. */
  protected readonly amountLabel = moneyLabel;

  /** Whether the current error is a transport failure (retryable by the user). */
  protected readonly isOfflineError = computed(() => this.error() === REPORTS_ERRORS.offline);

  public readonly trendChart = computed(() => ({
    labels: this.trendPoints().map((point) => point.day),
    datasets: [{ label: 'Net sales', data: this.trendPoints().map((point) => chartValue(point.netSales)) }],
  }));

  public readonly hoursChart = computed(() => ({
    labels: this.hourPoints().map((point) => `${String(point.hour).padStart(2, '0')}:00`),
    datasets: [{ label: 'Orders', data: this.hourPoints().map((point) => point.orderCount) }],
  }));

  public readonly splitChart = computed(() => ({
    labels: this.splitPoints().map((point) => point.method),
    datasets: [{ label: 'Amount', data: this.splitPoints().map((point) => chartValue(point.amount)) }],
  }));

  ngOnInit(): void {
    if (this.canViewReports()) {
      void this.load();
    }
  }

  /** (Re)loads the sales summary; surfaces backend errors as plain-language messages. */
  protected async load(): Promise<void> {
    if (this.loading()) {
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    try {
      const response = await this.auth.query<SalesSummaryQuery>({ query: SalesSummaryDocument });
      const code = response.errors?.[0] && graphQLErrorCode(response.errors[0]);
      if (code === 'FORBIDDEN') {
        this.error.set(REPORTS_ERRORS.codes.FORBIDDEN);
        return;
      }
      if (code === 'UNAUTHENTICATED' || code === 'TOKEN_EXPIRED') {
        await this.router.navigate(['/login']);
        return;
      }
      const data = response.data?.salesSummary ?? null;
      if (!data) {
        this.error.set(REPORTS_ERRORS.unknown);
        return;
      }
      this.summary.set(data);
    } catch {
      // Transport failure: no backend code, so a connection problem.
      this.error.set(REPORTS_ERRORS.offline);
    } finally {
      this.loading.set(false);
    }
  }
}

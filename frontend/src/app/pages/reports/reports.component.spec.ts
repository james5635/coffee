import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideRouter } from '@angular/router';
import { PaymentMethod } from '../../../graphql/generated/schema';
import { SalesSummaryQuery } from '../../../graphql/generated/graphql';
import type { SalesSummary } from '../../../graphql/generated/schema';
import { AuthStateService } from '../../services/auth-state.service';
import { AuthService } from '../../services/auth.service';
import { ReportsComponent } from './reports.component';

type SalesSummaryData = SalesSummaryQuery['salesSummary'];

function makeSummary(overrides: Partial<SalesSummaryData> = {}): SalesSummaryData {
  return {
    currency: 'USD',
    timezone: 'America/New_York',
    today: {
      netSales: '1234.50',
      grossSales: '1450.00',
      orderCount: 42,
      averageOrderValue: '29.39',
      refundCount: 3,
      refundTotal: '45.00',
    },
    yesterday: {
      netSales: '980.00',
      grossSales: '1100.00',
      orderCount: 35,
      averageOrderValue: '28.00',
      refundCount: 1,
      refundTotal: '12.00',
    },
    trend: [
      { day: 'Mon', netSales: '100.00', orderCount: 5 },
      { day: 'Tue', netSales: '200.00', orderCount: 8 },
      { day: 'Wed', netSales: '150.00', orderCount: 6 },
    ],
    topItems: [
      { productName: 'Flat White', quantity: 10, revenue: '42.50' },
      { productName: 'Green Tea', quantity: 5, revenue: '17.50' },
    ],
    hours: [
      { hour: 10, orderCount: 4 },
      { hour: 11, orderCount: 7 },
    ],
    split: [
      { method: PaymentMethod.Cash, count: 20, amount: '300.00' },
      { method: PaymentMethod.Card, count: 22, amount: '900.00' },
    ],
    refunds: { count: 3, total: '45.00', recent: [{ orderNumber: '1001', amount: '12.00', createdAt: '2026-11-03T10:00:00Z' }] },
    ...overrides,
  };
}

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const createComponent = async (): Promise<ComponentFixture<ReportsComponent>> => {
  const fixture = TestBed.createComponent(ReportsComponent);
  fixture.detectChanges();
  await settle();
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
};

const text = (fixture: ComponentFixture<ReportsComponent>): string =>
  (fixture.nativeElement as HTMLElement).textContent as string;

const section = (fixture: ComponentFixture<ReportsComponent>, name: string): HTMLElement | null =>
  (fixture.nativeElement as HTMLElement).querySelector(`[data-section="${name}"]`);

describe('ReportsComponent', () => {
  const authService = {
    query: vi.fn(),
  };
  const router = {
    navigate: vi.fn(),
  };
  const permissions = signal<string[] | null>(null);
  const authenticated = signal(true);

  beforeEach(async () => {
    permissions.set(null);
    authenticated.set(true);
    authService.query.mockReset();
    router.navigate.mockReset();

    await TestBed.configureTestingModule({
      imports: [ReportsComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: router },
        {
          provide: AuthStateService,
          useValue: {
            permissions,
            hasPermission: (permission: string) => {
              const granted = permissions();
              if (granted === null) {
                return authenticated();
              }
              return granted.includes(permission);
            },
          },
        },
      ],
    }).compileComponents();
  });

  const loadSummary = (summary: SalesSummaryData): void => {
    authService.query.mockResolvedValue({ data: { salesSummary: summary } });
  };

  it('renders all six sections from a full SalesSummary fixture', async () => {
    loadSummary(makeSummary());
    const fixture = await createComponent();

    expect(authService.query).toHaveBeenCalledTimes(1);
    const compiled = fixture.nativeElement as HTMLElement;

    expect(section(fixture, 'today')).toBeTruthy();
    expect(section(fixture, 'yesterday')).toBeTruthy();
    expect(section(fixture, 'trend')).toBeTruthy();
    expect(section(fixture, 'top-items')).toBeTruthy();
    expect(section(fixture, 'hours')).toBeTruthy();
    expect(section(fixture, 'split')).toBeTruthy();

    expect(text(fixture)).toContain('America/New_York');
    // Decimal "1234.50" formats as "$1,234.50" via the existing money util.
    expect(
      section(fixture, 'today')?.querySelector('[data-stat="net-sales"]')?.textContent,
    ).toContain('$1234.50');
    expect(text(fixture)).toContain('Flat White');
    expect(text(fixture)).toContain('Order #1001');
  });

  it('shows per-section empty messages with no NaN or Infinity', async () => {
    loadSummary({
      ...makeSummary(),
      today: { netSales: '0.00', grossSales: '0.00', orderCount: 0, averageOrderValue: '0.00', refundCount: 0, refundTotal: '0.00' },
      yesterday: { netSales: '0.00', grossSales: '0.00', orderCount: 0, averageOrderValue: '0.00', refundCount: 0, refundTotal: '0.00' },
      trend: [],
      topItems: [],
      hours: [],
      split: [],
      refunds: { count: 0, total: '0.00', recent: [] },
    });
    const fixture = await createComponent();

    const rendered = text(fixture);
    expect(rendered).not.toContain('NaN');
    expect(rendered).not.toContain('Infinity');
    expect(section(fixture, 'today')?.querySelector('[data-empty-today]')?.textContent).toContain(
      'No sales recorded today yet.',
    );
    expect(section(fixture, 'yesterday')?.querySelector('[data-empty-yesterday]')?.textContent).toContain(
      'No sales recorded yesterday yet.',
    );
    expect(section(fixture, 'trend')?.querySelector('[data-empty-trend]')?.textContent).toContain(
      'No trend data yet.',
    );
    expect(section(fixture, 'top-items')?.querySelector('[data-empty-top-items]')?.textContent).toContain(
      'No best-sellers yet.',
    );
    expect(section(fixture, 'hours')?.querySelector('[data-empty-hours]')?.textContent).toContain(
      'No hourly data yet.',
    );
    expect(section(fixture, 'split')?.querySelector('[data-empty-split]')?.textContent).toContain(
      'No payment data yet.',
    );
    expect(section(fixture, 'split')?.querySelector('[data-empty-refunds]')?.textContent).toContain(
      'No refunds yet.',
    );
  });

  it('surfaces FORBIDDEN as a permission message', async () => {
    authService.query.mockResolvedValue({
      errors: [{ code: 'FORBIDDEN', message: 'missing report.sales.read' }],
    });
    const fixture = await createComponent();
    const rendered = text(fixture);

    expect(rendered).toContain('report.sales.read');
    expect(router.navigate).not.toHaveBeenCalled();
    expect(section(fixture, 'today')).toBeNull();
  });

  it('redirects to login on UNAUTHENTICATED', async () => {
    authService.query.mockResolvedValue({
      errors: [{ code: 'UNAUTHENTICATED', message: 'session expired' }],
    });
    const fixture = await createComponent();

    expect(router.navigate).toHaveBeenCalledWith(['/login']);
    expect(text(fixture)).not.toContain('Sales trend');
  });

  it('shows a Try-again banner on transport error and re-fetches', async () => {
    authService.query.mockRejectedValue(new Error('Network failure'));
    const fixture = await createComponent();
    let rendered = text(fixture);

    expect(rendered).toContain('Check your connection and try again');
    const banner = (fixture.nativeElement as HTMLElement).querySelector('[data-error-banner]');
    expect(banner?.querySelector('[data-try-again]')).toBeTruthy();

    loadSummary(makeSummary());
    const button = banner!.querySelector<HTMLButtonElement>('[data-try-again]')!;
    button!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    rendered = text(fixture);
    expect(authService.query).toHaveBeenCalledTimes(2);
    expect(rendered).toContain('$1234.50');
  });

  it('refresh button re-fetches the sales summary', async () => {
    loadSummary(makeSummary());
    const fixture = await createComponent();

    expect(authService.query).toHaveBeenCalledTimes(1);

    const button = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      '[data-refresh]',
    );
    expect(button).toBeTruthy();
    button!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(authService.query).toHaveBeenCalledTimes(2);
  });

  it('renders chart configs for trend, hours, and split', async () => {
    loadSummary(makeSummary());
    const fixture = await createComponent();

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('canvas[data-chart="trend"]'),
    ).toBeTruthy();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('canvas[data-chart="hours"]'),
    ).toBeTruthy();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('canvas[data-chart="split"]'),
    ).toBeTruthy();

    const component = fixture.componentInstance;
    expect(component.trendChart().labels.length).toBe(3);
    expect(component.trendChart().datasets[0].data.length).toBe(3);
    expect(component.hoursChart().labels.length).toBe(2);
    expect(component.splitChart().labels.length).toBe(2);
    expect(component.splitChart().datasets[0].data.length).toBe(2);
  });

  it('does not load when the permission is missing', async () => {
    permissions.set(['order.read.own']);
    loadSummary(makeSummary());
    const fixture = await createComponent();

    expect(authService.query).not.toHaveBeenCalled();
    expect(text(fixture)).toContain('do not have permission');
    expect(section(fixture, 'today')).toBeNull();
  });
});

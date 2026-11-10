export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  Decimal: { input: string; output: string; }
  Time: { input: string; output: string; }
};

export type AuthPayload = {
  __typename?: 'AuthPayload';
  accessToken: Scalars['String']['output'];
  expiresIn: Scalars['Int']['output'];
  refreshToken: Scalars['String']['output'];
  tokenType: Scalars['String']['output'];
};

export type Category = {
  __typename?: 'Category';
  description: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  sortOrder: Scalars['Int']['output'];
};

export type DayPoint = {
  __typename?: 'DayPoint';
  day: Scalars['String']['output'];
  netSales: Scalars['Decimal']['output'];
  orderCount: Scalars['Int']['output'];
};

export type HourPoint = {
  __typename?: 'HourPoint';
  hour: Scalars['Int']['output'];
  orderCount: Scalars['Int']['output'];
};

export type IssueRefundInput = {
  amount: Scalars['Decimal']['input'];
  externalReference?: InputMaybe<Scalars['String']['input']>;
  method: PaymentMethod;
  orderId: Scalars['ID']['input'];
};

export type Modifier = {
  __typename?: 'Modifier';
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  priceDelta: Scalars['Decimal']['output'];
  sortOrder: Scalars['Int']['output'];
};

export type ModifierGroup = {
  __typename?: 'ModifierGroup';
  id: Scalars['ID']['output'];
  isRequired: Scalars['Boolean']['output'];
  maxSelections: Scalars['Int']['output'];
  minSelections: Scalars['Int']['output'];
  modifiers: Array<Modifier>;
  name: Scalars['String']['output'];
  sortOrder: Scalars['Int']['output'];
};

export type Mutation = {
  __typename?: 'Mutation';
  advanceOrderStatus: Order;
  issueRefund: Payment;
  login: AuthPayload;
  logout: Scalars['Boolean']['output'];
  placeOrder: Order;
  recordPayment: Payment;
  refreshToken: AuthPayload;
};


export type MutationAdvanceOrderStatusArgs = {
  orderId: Scalars['ID']['input'];
  status: OrderStatus;
};


export type MutationIssueRefundArgs = {
  input: IssueRefundInput;
};


export type MutationLoginArgs = {
  email: Scalars['String']['input'];
  password: Scalars['String']['input'];
};


export type MutationPlaceOrderArgs = {
  input: PlaceOrderInput;
};


export type MutationRecordPaymentArgs = {
  input: RecordPaymentInput;
};

export type Order = {
  __typename?: 'Order';
  completedAt?: Maybe<Scalars['Time']['output']>;
  createdAt: Scalars['Time']['output'];
  currency: Scalars['String']['output'];
  customerEmail?: Maybe<Scalars['String']['output']>;
  customerName?: Maybe<Scalars['String']['output']>;
  discountAmount: Scalars['Decimal']['output'];
  id: Scalars['ID']['output'];
  items: Array<OrderItem>;
  notes: Scalars['String']['output'];
  orderNumber: Scalars['ID']['output'];
  orderType: OrderType;
  payments: Array<Payment>;
  status: OrderStatus;
  subtotal: Scalars['Decimal']['output'];
  taxAmount: Scalars['Decimal']['output'];
  total: Scalars['Decimal']['output'];
  updatedAt: Scalars['Time']['output'];
};

export type OrderItem = {
  __typename?: 'OrderItem';
  id: Scalars['ID']['output'];
  lineTotal: Scalars['Decimal']['output'];
  modifiers: Array<OrderItemModifier>;
  productId?: Maybe<Scalars['ID']['output']>;
  productName: Scalars['String']['output'];
  quantity: Scalars['Int']['output'];
  specialInstructions: Scalars['String']['output'];
  unitPrice: Scalars['Decimal']['output'];
};

export type OrderItemModifier = {
  __typename?: 'OrderItemModifier';
  id: Scalars['ID']['output'];
  modifierId?: Maybe<Scalars['ID']['output']>;
  modifierName: Scalars['String']['output'];
  priceDelta: Scalars['Decimal']['output'];
};

export enum OrderStatus {
  Accepted = 'ACCEPTED',
  Cancelled = 'CANCELLED',
  Completed = 'COMPLETED',
  Pending = 'PENDING',
  Preparing = 'PREPARING',
  Ready = 'READY'
}

export enum OrderType {
  Delivery = 'DELIVERY',
  DineIn = 'DINE_IN',
  Takeaway = 'TAKEAWAY'
}

export type Payment = {
  __typename?: 'Payment';
  amount: Scalars['Decimal']['output'];
  createdAt: Scalars['Time']['output'];
  externalReference?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  kind: PaymentKind;
  method: PaymentMethod;
  settledAt?: Maybe<Scalars['Time']['output']>;
  status: PaymentStatus;
};

export enum PaymentKind {
  Payment = 'PAYMENT',
  Refund = 'REFUND'
}

export enum PaymentMethod {
  Card = 'CARD',
  Cash = 'CASH',
  Online = 'ONLINE',
  Other = 'OTHER'
}

export type PaymentMethodPoint = {
  __typename?: 'PaymentMethodPoint';
  amount: Scalars['Decimal']['output'];
  count: Scalars['Int']['output'];
  method: PaymentMethod;
};

export enum PaymentStatus {
  Cancelled = 'CANCELLED',
  Failed = 'FAILED',
  Pending = 'PENDING',
  Succeeded = 'SUCCEEDED'
}

export type PlaceOrderInput = {
  customerEmail?: InputMaybe<Scalars['String']['input']>;
  customerName?: InputMaybe<Scalars['String']['input']>;
  items: Array<PlaceOrderItemInput>;
  notes?: InputMaybe<Scalars['String']['input']>;
  orderType: OrderType;
};

export type PlaceOrderItemInput = {
  modifierIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  productId: Scalars['ID']['input'];
  quantity: Scalars['Int']['input'];
  specialInstructions?: InputMaybe<Scalars['String']['input']>;
};

export type Product = {
  __typename?: 'Product';
  categoryId?: Maybe<Scalars['ID']['output']>;
  description: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  imageUrl: Scalars['String']['output'];
  modifierGroups: Array<ModifierGroup>;
  name: Scalars['String']['output'];
  price: Scalars['Decimal']['output'];
  sku?: Maybe<Scalars['String']['output']>;
};

export type Query = {
  __typename?: 'Query';
  categories: Array<Category>;
  me: Viewer;
  order: Order;
  preparationQueue: Array<Order>;
  products: Array<Product>;
  salesSummary: SalesSummary;
};


export type QueryOrderArgs = {
  id: Scalars['ID']['input'];
};


export type QueryProductsArgs = {
  categoryId?: InputMaybe<Scalars['ID']['input']>;
};

export type RecordPaymentInput = {
  amount: Scalars['Decimal']['input'];
  externalReference?: InputMaybe<Scalars['String']['input']>;
  method: PaymentMethod;
  orderId: Scalars['ID']['input'];
};

export type RefundLine = {
  __typename?: 'RefundLine';
  amount: Scalars['Decimal']['output'];
  createdAt: Scalars['Time']['output'];
  orderNumber: Scalars['ID']['output'];
};

export type RefundSummary = {
  __typename?: 'RefundSummary';
  count: Scalars['Int']['output'];
  recent: Array<RefundLine>;
  total: Scalars['Decimal']['output'];
};

export type SalesSnapshot = {
  __typename?: 'SalesSnapshot';
  averageOrderValue: Scalars['Decimal']['output'];
  grossSales: Scalars['Decimal']['output'];
  netSales: Scalars['Decimal']['output'];
  orderCount: Scalars['Int']['output'];
  refundCount: Scalars['Int']['output'];
  refundTotal: Scalars['Decimal']['output'];
};

export type SalesSummary = {
  __typename?: 'SalesSummary';
  currency: Scalars['String']['output'];
  hours: Array<HourPoint>;
  refunds: RefundSummary;
  split: Array<PaymentMethodPoint>;
  timezone: Scalars['String']['output'];
  today: SalesSnapshot;
  topItems: Array<TopItem>;
  trend: Array<DayPoint>;
  yesterday: SalesSnapshot;
};

export type TopItem = {
  __typename?: 'TopItem';
  productName: Scalars['String']['output'];
  quantity: Scalars['Int']['output'];
  revenue: Scalars['Decimal']['output'];
};

export type Viewer = {
  __typename?: 'Viewer';
  displayName: Scalars['String']['output'];
  email: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  roles: Array<Scalars['String']['output']>;
};

/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
import { DocumentNode } from 'graphql';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
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
  modifierGroups: Array<ModifierGroup>;
  name: Scalars['String']['output'];
  price: Scalars['Decimal']['output'];
  sku?: Maybe<Scalars['String']['output']>;
};

export type Query = {
  __typename?: 'Query';
  categories: Array<Category>;
  order: Order;
  preparationQueue: Array<Order>;
  products: Array<Product>;
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

export type LoginMutationVariables = Exact<{
  email: string;
  password: string;
}>;


export type LoginMutation = { login: { accessToken: string, tokenType: string, expiresIn: number, refreshToken: string } };

export type RefreshTokenMutationVariables = Exact<{ [key: string]: never; }>;


export type RefreshTokenMutation = { refreshToken: { accessToken: string, tokenType: string, expiresIn: number, refreshToken: string } };

export type LogoutMutationVariables = Exact<{ [key: string]: never; }>;


export type LogoutMutation = { logout: boolean };

export type CategoriesQueryVariables = Exact<{ [key: string]: never; }>;


export type CategoriesQuery = { categories: Array<{ id: string, name: string, description: string, sortOrder: number }> };

export type ProductsQueryVariables = Exact<{
  categoryId?: string | number | null | undefined;
}>;


export type ProductsQuery = { products: Array<{ id: string, categoryId: string | null, name: string, description: string, price: string, sku: string | null, modifierGroups: Array<{ id: string, name: string, minSelections: number, maxSelections: number, isRequired: boolean, sortOrder: number, modifiers: Array<{ id: string, name: string, priceDelta: string, sortOrder: number }> }> }> };

export const LoginDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"Login"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"email"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"password"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"login"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"email"},"value":{"kind":"Variable","name":{"kind":"Name","value":"email"}}},{"kind":"Argument","name":{"kind":"Name","value":"password"},"value":{"kind":"Variable","name":{"kind":"Name","value":"password"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"accessToken"}},{"kind":"Field","name":{"kind":"Name","value":"tokenType"}},{"kind":"Field","name":{"kind":"Name","value":"expiresIn"}},{"kind":"Field","name":{"kind":"Name","value":"refreshToken"}}]}}]}}]} as unknown as DocumentNode;

  @Injectable({
    providedIn: 'root'
  })
  export class LoginGQL extends Apollo.Mutation<LoginMutation, LoginMutationVariables> {
    document = LoginDocument;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }
export const RefreshTokenDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RefreshToken"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"refreshToken"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"accessToken"}},{"kind":"Field","name":{"kind":"Name","value":"tokenType"}},{"kind":"Field","name":{"kind":"Name","value":"expiresIn"}},{"kind":"Field","name":{"kind":"Name","value":"refreshToken"}}]}}]}}]} as unknown as DocumentNode;

  @Injectable({
    providedIn: 'root'
  })
  export class RefreshTokenGQL extends Apollo.Mutation<RefreshTokenMutation, RefreshTokenMutationVariables> {
    document = RefreshTokenDocument;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }
export const LogoutDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"Logout"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"logout"}}]}}]} as unknown as DocumentNode;

  @Injectable({
    providedIn: 'root'
  })
  export class LogoutGQL extends Apollo.Mutation<LogoutMutation, LogoutMutationVariables> {
    document = LogoutDocument;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }
export const CategoriesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Categories"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"categories"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"sortOrder"}}]}}]}}]} as unknown as DocumentNode;

  @Injectable({
    providedIn: 'root'
  })
  export class CategoriesGQL extends Apollo.Query<CategoriesQuery, CategoriesQueryVariables> {
    document = CategoriesDocument;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }
export const ProductsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Products"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"categoryId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"products"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"categoryId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"categoryId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"categoryId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"price"}},{"kind":"Field","name":{"kind":"Name","value":"sku"}},{"kind":"Field","name":{"kind":"Name","value":"modifierGroups"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"minSelections"}},{"kind":"Field","name":{"kind":"Name","value":"maxSelections"}},{"kind":"Field","name":{"kind":"Name","value":"isRequired"}},{"kind":"Field","name":{"kind":"Name","value":"sortOrder"}},{"kind":"Field","name":{"kind":"Name","value":"modifiers"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"priceDelta"}},{"kind":"Field","name":{"kind":"Name","value":"sortOrder"}}]}}]}}]}}]}}]} as unknown as DocumentNode;

  @Injectable({
    providedIn: 'root'
  })
  export class ProductsGQL extends Apollo.Query<ProductsQuery, ProductsQueryVariables> {
    document = ProductsDocument;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }
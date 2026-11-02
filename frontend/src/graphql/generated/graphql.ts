/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
import type * as Types from './schema';

import { DocumentNode } from 'graphql';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
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

export type OrderDetailFragment = { id: string, orderNumber: string, status: Types.OrderStatus, orderType: Types.OrderType, customerName: string | null, customerEmail: string | null, notes: string, subtotal: string, discountAmount: string, taxAmount: string, total: string, currency: string, createdAt: string, updatedAt: string, completedAt: string | null, items: Array<{ id: string, productId: string | null, productName: string, quantity: number, unitPrice: string, lineTotal: string, specialInstructions: string, modifiers: Array<{ id: string, modifierId: string | null, modifierName: string, priceDelta: string }> }>, payments: Array<{ id: string, kind: Types.PaymentKind, status: Types.PaymentStatus, method: Types.PaymentMethod, amount: string, externalReference: string | null, createdAt: string, settledAt: string | null }> };

export type OrderQueryVariables = Exact<{
  id: string | number;
}>;


export type OrderQuery = { order: { id: string, orderNumber: string, status: Types.OrderStatus, orderType: Types.OrderType, customerName: string | null, customerEmail: string | null, notes: string, subtotal: string, discountAmount: string, taxAmount: string, total: string, currency: string, createdAt: string, updatedAt: string, completedAt: string | null, items: Array<{ id: string, productId: string | null, productName: string, quantity: number, unitPrice: string, lineTotal: string, specialInstructions: string, modifiers: Array<{ id: string, modifierId: string | null, modifierName: string, priceDelta: string }> }>, payments: Array<{ id: string, kind: Types.PaymentKind, status: Types.PaymentStatus, method: Types.PaymentMethod, amount: string, externalReference: string | null, createdAt: string, settledAt: string | null }> } };

export type PlaceOrderMutationVariables = Exact<{
  input: Types.PlaceOrderInput;
}>;


export type PlaceOrderMutation = { placeOrder: { id: string, orderNumber: string, status: Types.OrderStatus, orderType: Types.OrderType, customerName: string | null, customerEmail: string | null, notes: string, subtotal: string, discountAmount: string, taxAmount: string, total: string, currency: string, createdAt: string, updatedAt: string, completedAt: string | null, items: Array<{ id: string, productId: string | null, productName: string, quantity: number, unitPrice: string, lineTotal: string, specialInstructions: string, modifiers: Array<{ id: string, modifierId: string | null, modifierName: string, priceDelta: string }> }>, payments: Array<{ id: string, kind: Types.PaymentKind, status: Types.PaymentStatus, method: Types.PaymentMethod, amount: string, externalReference: string | null, createdAt: string, settledAt: string | null }> } };

export type RecordPaymentMutationVariables = Exact<{
  input: Types.RecordPaymentInput;
}>;


export type RecordPaymentMutation = { recordPayment: { id: string, kind: Types.PaymentKind, status: Types.PaymentStatus, method: Types.PaymentMethod, amount: string, externalReference: string | null, createdAt: string, settledAt: string | null } };

export const OrderDetailFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"OrderDetail"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Order"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"orderNumber"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"orderType"}},{"kind":"Field","name":{"kind":"Name","value":"customerName"}},{"kind":"Field","name":{"kind":"Name","value":"customerEmail"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"subtotal"}},{"kind":"Field","name":{"kind":"Name","value":"discountAmount"}},{"kind":"Field","name":{"kind":"Name","value":"taxAmount"}},{"kind":"Field","name":{"kind":"Name","value":"total"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"completedAt"}},{"kind":"Field","name":{"kind":"Name","value":"items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"productId"}},{"kind":"Field","name":{"kind":"Name","value":"productName"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"unitPrice"}},{"kind":"Field","name":{"kind":"Name","value":"lineTotal"}},{"kind":"Field","name":{"kind":"Name","value":"specialInstructions"}},{"kind":"Field","name":{"kind":"Name","value":"modifiers"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"modifierId"}},{"kind":"Field","name":{"kind":"Name","value":"modifierName"}},{"kind":"Field","name":{"kind":"Name","value":"priceDelta"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"payments"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"method"}},{"kind":"Field","name":{"kind":"Name","value":"amount"}},{"kind":"Field","name":{"kind":"Name","value":"externalReference"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"settledAt"}}]}}]}}]} as unknown as DocumentNode;
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
export const OrderDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Order"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"order"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"OrderDetail"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"OrderDetail"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Order"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"orderNumber"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"orderType"}},{"kind":"Field","name":{"kind":"Name","value":"customerName"}},{"kind":"Field","name":{"kind":"Name","value":"customerEmail"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"subtotal"}},{"kind":"Field","name":{"kind":"Name","value":"discountAmount"}},{"kind":"Field","name":{"kind":"Name","value":"taxAmount"}},{"kind":"Field","name":{"kind":"Name","value":"total"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"completedAt"}},{"kind":"Field","name":{"kind":"Name","value":"items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"productId"}},{"kind":"Field","name":{"kind":"Name","value":"productName"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"unitPrice"}},{"kind":"Field","name":{"kind":"Name","value":"lineTotal"}},{"kind":"Field","name":{"kind":"Name","value":"specialInstructions"}},{"kind":"Field","name":{"kind":"Name","value":"modifiers"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"modifierId"}},{"kind":"Field","name":{"kind":"Name","value":"modifierName"}},{"kind":"Field","name":{"kind":"Name","value":"priceDelta"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"payments"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"method"}},{"kind":"Field","name":{"kind":"Name","value":"amount"}},{"kind":"Field","name":{"kind":"Name","value":"externalReference"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"settledAt"}}]}}]}}]} as unknown as DocumentNode;

  @Injectable({
    providedIn: 'root'
  })
  export class OrderGQL extends Apollo.Query<OrderQuery, OrderQueryVariables> {
    document = OrderDocument;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }
export const PlaceOrderDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"PlaceOrder"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"PlaceOrderInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"placeOrder"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"OrderDetail"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"OrderDetail"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Order"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"orderNumber"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"orderType"}},{"kind":"Field","name":{"kind":"Name","value":"customerName"}},{"kind":"Field","name":{"kind":"Name","value":"customerEmail"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"subtotal"}},{"kind":"Field","name":{"kind":"Name","value":"discountAmount"}},{"kind":"Field","name":{"kind":"Name","value":"taxAmount"}},{"kind":"Field","name":{"kind":"Name","value":"total"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"completedAt"}},{"kind":"Field","name":{"kind":"Name","value":"items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"productId"}},{"kind":"Field","name":{"kind":"Name","value":"productName"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"unitPrice"}},{"kind":"Field","name":{"kind":"Name","value":"lineTotal"}},{"kind":"Field","name":{"kind":"Name","value":"specialInstructions"}},{"kind":"Field","name":{"kind":"Name","value":"modifiers"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"modifierId"}},{"kind":"Field","name":{"kind":"Name","value":"modifierName"}},{"kind":"Field","name":{"kind":"Name","value":"priceDelta"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"payments"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"method"}},{"kind":"Field","name":{"kind":"Name","value":"amount"}},{"kind":"Field","name":{"kind":"Name","value":"externalReference"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"settledAt"}}]}}]}}]} as unknown as DocumentNode;

  @Injectable({
    providedIn: 'root'
  })
  export class PlaceOrderGQL extends Apollo.Mutation<PlaceOrderMutation, PlaceOrderMutationVariables> {
    document = PlaceOrderDocument;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }
export const RecordPaymentDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RecordPayment"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"RecordPaymentInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"recordPayment"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"method"}},{"kind":"Field","name":{"kind":"Name","value":"amount"}},{"kind":"Field","name":{"kind":"Name","value":"externalReference"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"settledAt"}}]}}]}}]} as unknown as DocumentNode;

  @Injectable({
    providedIn: 'root'
  })
  export class RecordPaymentGQL extends Apollo.Mutation<RecordPaymentMutation, RecordPaymentMutationVariables> {
    document = RecordPaymentDocument;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }
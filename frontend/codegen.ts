import type { CodegenConfig } from '@graphql-codegen/cli';

/**
 * Generates typed Apollo Angular operations from the backend GraphQL schema.
 *
 * The schema is the backend's SDL source of truth; documents are authored
 * under `src/graphql/operations/` and the generated service/document types are
 * consumed by the Apollo-backed `GraphQLService` and product screens.
 *
 * Run with `npm run codegen` (or `npm run codegen:watch`).
 */
const config: CodegenConfig = {
  schema: '../backend/graph/schema.graphqls',
  documents: 'src/graphql/operations/**/*.graphql',
  generates: {
    'src/graphql/generated/graphql.ts': {
      // `typescript` emits the schema types that the operation plugins build on.
      plugins: ['typescript', 'typescript-operations', 'typescript-apollo-angular'],
      config: {
        documentMode: 'documentNode',
        // Backend `Decimal` and `Time` scalars are formatted as strings on the wire.
        scalars: {
          Decimal: 'string',
          Time: 'string',
        },
      },
    },
  },
  ignoreNoDocuments: true,
};

export default config;

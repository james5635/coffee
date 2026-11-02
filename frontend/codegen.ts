import type { CodegenConfig } from '@graphql-codegen/cli';

/**
 * Generates typed Apollo Angular operations from the backend GraphQL schema.
 *
 * The schema is the backend's SDL source of truth; documents are authored
 * under `src/graphql/operations/` and the generated service/document types are
 * consumed by the Apollo-backed `GraphQLService` and product screens.
 *
 * Run with `npm run codegen` (or `npm run codegen:watch`). `npm run codegen:check`
 * verifies the committed output is current (dry run, no writes); it also runs
 * automatically as the `pretest` step so stale output fails `npm test`.
 */
const config: CodegenConfig = {
  schema: '../backend/graph/schema.graphqls',
  documents: 'src/graphql/operations/**/*.graphql',
  generates: {
    // Schema types live in their own file. The operations plugin regenerates any
    // input/enum type an operation references, which would otherwise duplicate
    // the schema plugin's declarations when both target one file.
    'src/graphql/generated/schema.ts': {
      plugins: ['typescript'],
      config: {
        // Backend `Decimal` and `Time` scalars are formatted as strings on the wire.
        scalars: {
          Decimal: 'string',
          Time: 'string',
        },
      },
    },
    'src/graphql/generated/graphql.ts': {
      plugins: ['typescript-operations', 'typescript-apollo-angular'],
      config: {
        documentMode: 'documentNode',
        // Reference the schema declarations instead of re-emitting them.
        importSchemaTypesFrom: './src/graphql/generated/schema',
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

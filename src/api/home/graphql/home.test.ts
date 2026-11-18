import { describe, it, expect } from 'vitest';
import { parse, Kind, type ObjectTypeDefinitionNode } from 'graphql';
import homeSchema from '../content-types/home/schema.json';
import { HOME_DEPRECATED_FIELDS, buildHomeDeprecationTypeDefs } from './home';

// Mirrors plugin-graphql's component type naming: `commons.grid-cards` -> `ComponentCommonsGridCards`.
const componentTypeName = (componentUid: string): string =>
  `Component${componentUid
    .split(/[.-]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')}`;

const attributes = homeSchema.attributes as Record<string, { type: string; component?: string }>;

describe('home GraphQL deprecations', () => {
  it('builds valid SDL that only deprecates the listed Home fields', () => {
    const doc = parse(buildHomeDeprecationTypeDefs());
    const [definition] = doc.definitions as ObjectTypeDefinitionNode[];

    expect(doc.definitions).toHaveLength(1);
    expect(definition.kind).toBe(Kind.OBJECT_TYPE_DEFINITION);
    expect(definition.name.value).toBe('Home');
    expect(definition.fields?.map((field) => field.name.value)).toEqual(
      HOME_DEPRECATED_FIELDS.map(({ field }) => field),
    );
    for (const field of definition.fields ?? []) {
      expect(field.directives?.map((directive) => directive.name.value)).toEqual(['deprecated']);
    }
  });

  it.each(HOME_DEPRECATED_FIELDS)(
    'keeps `$field` in the content-type with the same GraphQL type',
    ({ field, type }) => {
      const attribute = attributes[field];

      expect(attribute?.type).toBe('component');
      expect(componentTypeName(attribute?.component ?? '')).toBe(type);
    },
  );

  it('keeps the replacement relations wired on Home', () => {
    expect(attributes.destinations).toMatchObject({ type: 'relation' });
    expect(attributes.testimonials).toMatchObject({ type: 'relation' });
  });
});

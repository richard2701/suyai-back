import { describe, it, expect } from 'vitest';
import { GraphQLError } from 'graphql';
import { assertValidFormInput, sanitizeFormInput } from './form-validation';

const valid = {
  name: 'María José',
  lastname: "O'Higgins-Riquelme",
  email: 'maria.jose@example.cl',
  phone: '+56 9 1234 5678',
  message: 'Hola, quisiera reservar para 4 personas. ¿Tienen disponibilidad?',
  tourName: 'Valle Nevado Full Day',
  destination: 'Aeropuerto Int. Arturo Merino Benítez (SCL)',
  people: 4,
};

const issueFor = (input: Record<string, unknown>) => sanitizeFormInput(input).issues;

describe('form validation', () => {
  it('accepts realistic submissions and trims strings', () => {
    const result = assertValidFormInput({ ...valid, name: '  María José  ' });
    expect(result.name).toBe('María José');
    expect(result.people).toBe(4);
  });

  it.each(['+56912345678', '(02) 2345-6789', '9 1234 5678', '+1 (555) 123-4567'])(
    'accepts phone %s',
    (phone) => {
      expect(issueFor({ phone })).toEqual([]);
    }
  );

  it.each(['12345', 'call http://evil.example', '+56 9 1234 5678 ext 12', '1'.repeat(21)])(
    'rejects phone %s',
    (phone) => {
      expect(issueFor({ phone })).toHaveLength(1);
    }
  );

  it.each(['https://evil.test', 'Click www.evil', 'Juan visit evil.com', 'bit.ly/abc', 'HTTP:foo'])(
    'rejects URLs in names: %s',
    (name) => {
      expect(issueFor({ name })).toEqual([{ field: 'name', reason: 'contains_url' }]);
    }
  );

  it('rejects markup in names and catalog fields', () => {
    expect(issueFor({ lastname: '<b>x</b>' })).toEqual([{ field: 'lastname', reason: 'contains_markup' }]);
    expect(issueFor({ destination: 'a > b' })).toEqual([{ field: 'destination', reason: 'contains_markup' }]);
  });

  it('rejects URLs in tourName / destination', () => {
    expect(issueFor({ tourName: 'Tour https://x.io' })).toEqual([{ field: 'tourName', reason: 'contains_url' }]);
    expect(issueFor({ destination: 'go to phish.net now' })).toEqual([
      { field: 'destination', reason: 'contains_url' },
    ]);
  });

  it('enforces max lengths', () => {
    expect(issueFor({ name: 'a'.repeat(61) })).toEqual([{ field: 'name', reason: 'too_long' }]);
    expect(issueFor({ name: 'a'.repeat(60) })).toEqual([]);
    expect(issueFor({ email: `${'a'.repeat(250)}@x.cl` })).toEqual([{ field: 'email', reason: 'too_long' }]);
    expect(issueFor({ message: 'a'.repeat(2001) })).toEqual([{ field: 'message', reason: 'too_long' }]);
    expect(issueFor({ message: 'see https://ok.example' })).toEqual([]);
    expect(issueFor({ tourName: 'a'.repeat(121) })).toEqual([{ field: 'tourName', reason: 'too_long' }]);
  });

  it('allows abbreviations with a dot followed by a space', () => {
    expect(issueFor({ name: 'Ma. Fernanda', destination: 'Av. Providencia 123' })).toEqual([]);
  });

  it('leaves empty strings for the required-field check', () => {
    const { data, issues } = sanitizeFormInput({ name: '   ' });
    expect(data.name).toBe('');
    expect(issues).toEqual([]);
  });

  it('throws a BAD_USER_INPUT GraphQLError listing the offending fields', () => {
    let caught: unknown;
    try {
      assertValidFormInput({ ...valid, name: 'www.evil', phone: 'abc' });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(GraphQLError);
    const gqlError = caught as GraphQLError;
    expect(gqlError.extensions.code).toBe('BAD_USER_INPUT');
    expect(gqlError.extensions.fields).toEqual([
      { field: 'name', reason: 'contains_url' },
      { field: 'phone', reason: 'invalid_format' },
    ]);
  });

  describe('address and placeId', () => {
    it.each(['Av.Alemania 0123, Temuco', 'Cabañas Pucon.cl, Pucón', 'Hostal Sta.Maria'])(
      'accepts address %s',
      (address) => {
        expect(issueFor({ address })).toEqual([]);
      }
    );

    it.each(['http://evil.com', 'www.evil.com', 'evil.com/path', 'bit.ly/abc'])(
      'rejects URL-like address %s',
      (address) => {
        expect(issueFor({ address })).toEqual([{ field: 'address', reason: 'contains_url' }]);
      }
    );

    it('rejects markup in address', () => {
      expect(issueFor({ address: '<b>x</b>' })).toEqual([{ field: 'address', reason: 'contains_markup' }]);
    });

    it('keeps the stricter URL rule on other fields', () => {
      expect(issueFor({ destination: 'Hostal Sta.Maria' })).toEqual([
        { field: 'destination', reason: 'contains_url' },
      ]);
    });

    it('validates destination like address (up to 300 chars) when an address is present', () => {
      const address = 'Av.Alemania 0123, Temuco '.repeat(10).trim();
      expect(issueFor({ address, destination: address })).toEqual([]);
      expect(issueFor({ destination: 'a'.repeat(121) })).toEqual([{ field: 'destination', reason: 'too_long' }]);
    });

    it.each(['osm:N12345', 'curated:airport-zco', 'ChIJL68lBEHFYpYRMQkPQDzVdYQ', 'osm:W1.2'])(
      'accepts placeId %s',
      (placeId) => {
        expect(issueFor({ placeId })).toEqual([]);
      }
    );

    it.each(['osm N1', 'a/b', '<x>', 'a'.repeat(256)])('rejects placeId %s', (placeId) => {
      expect(issueFor({ placeId })).toHaveLength(1);
    });
  });
});

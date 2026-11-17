import { describe, it, expect } from 'vitest';
import {
  assertValidCoordinates,
  buildTransferEmailVars,
  fillDestinationFromAddress,
  formatTransferDirection,
  prepareTransferReservation,
} from './transfer-reservation';

describe('fillDestinationFromAddress', () => {
  it('copies address into destination when destination is missing', () => {
    expect(fillDestinationFromAddress({ address: 'Av. Providencia 123, Santiago' })).toEqual({
      address: 'Av. Providencia 123, Santiago',
      destination: 'Av. Providencia 123, Santiago',
    });
  });

  it('treats a blank destination as missing', () => {
    expect(fillDestinationFromAddress({ address: 'Lo Barnechea', destination: '   ' }).destination).toBe(
      'Lo Barnechea'
    );
  });

  it('keeps an explicit destination untouched', () => {
    const data = { address: 'Av. Providencia 123', destination: 'Hotel Plaza' };
    expect(fillDestinationFromAddress(data)).toBe(data);
  });

  it('leaves a legacy destination-only payload as is', () => {
    const data = { destination: 'Valle Nevado' };
    expect(fillDestinationFromAddress(data)).toBe(data);
  });

  it('does nothing when both are empty', () => {
    expect(fillDestinationFromAddress({ address: '' })).toEqual({ address: '' });
  });

  it('truncates the derived destination to the varchar(255) column size', () => {
    const address = 'a'.repeat(300);
    expect(fillDestinationFromAddress({ address }).destination).toHaveLength(255);
  });

  it('truncates an over-long explicit destination instead of rejecting it', () => {
    const address = 'a'.repeat(300);
    expect(fillDestinationFromAddress({ address, destination: address }).destination).toHaveLength(255);
  });
});

describe('assertValidCoordinates', () => {
  it('accepts valid, missing and null coordinates', () => {
    expect(() => assertValidCoordinates({ lat: -33.3930, lng: -70.7858 })).not.toThrow();
    expect(() => assertValidCoordinates({})).not.toThrow();
    expect(() => assertValidCoordinates({ lat: null, lng: null })).not.toThrow();
  });

  it.each([
    [{ lat: -33.39 }, 'lng'],
    [{ lng: -70.78, lat: null }, 'lat'],
  ])('rejects a lone coordinate %o', (data, field) => {
    expect(() => assertValidCoordinates(data)).toThrow(
      expect.objectContaining({
        extensions: { code: 'BAD_USER_INPUT', fields: [{ field, reason: 'incomplete_pair' }] },
      })
    );
  });

  it.each([
    [{ lat: 91 }, 'lat'],
    [{ lng: -180.5 }, 'lng'],
    [{ lat: Number.NaN }, 'lat'],
    [{ lng: '12' }, 'lng'],
  ])('rejects %o', (data, field) => {
    expect(() => assertValidCoordinates(data)).toThrow(
      expect.objectContaining({
        extensions: { code: 'BAD_USER_INPUT', fields: [{ field, reason: 'out_of_range' }] },
      })
    );
  });
});

describe('prepareTransferReservation', () => {
  it('validates coordinates and fills destination', () => {
    expect(prepareTransferReservation({ address: 'Las Condes', lat: -33.4, lng: -70.5 }).destination).toBe(
      'Las Condes'
    );
    expect(() => prepareTransferReservation({ address: 'Las Condes', lat: 200 })).toThrow('Invalid form input.');
  });
});

describe('transfer email vars', () => {
  it('labels both directions and defaults unknown values to from_airport', () => {
    expect(formatTransferDirection('from_airport')).toBe('Desde el aeropuerto');
    expect(formatTransferDirection('to_airport')).toBe('Hacia el aeropuerto');
    expect(formatTransferDirection(undefined)).toBe('Desde el aeropuerto');
  });

  it('exposes direction label and address', () => {
    const vars = buildTransferEmailVars({
      direction: 'to_airport',
      address: 'Av. Providencia 123',
      destination: 'Av. Providencia 123',
    });
    expect(vars.direction).toBe('Hacia el aeropuerto');
    expect(vars.address).toBe('Av. Providencia 123');
  });

  it('falls back to destination as the address for legacy records', () => {
    expect(buildTransferEmailVars({ destination: 'Valle Nevado', address: null }).address).toBe('Valle Nevado');
  });
});

import { GraphQLError } from 'graphql';

export type TransferDirection = 'from_airport' | 'to_airport';

export const DEFAULT_TRANSFER_DIRECTION: TransferDirection = 'from_airport';

/** Human-readable (Spanish) labels used in the notification emails. */
export const TRANSFER_DIRECTION_LABELS: Readonly<Record<TransferDirection, string>> = {
  from_airport: 'Desde el aeropuerto',
  to_airport: 'Hacia el aeropuerto',
};

// `destination` is a Strapi `string` attribute, stored as varchar(255).
const DESTINATION_MAX_LENGTH = 255;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim() !== '';

const isTransferDirection = (value: unknown): value is TransferDirection =>
  value === 'from_airport' || value === 'to_airport';

/**
 * Backward compatibility for the legacy `destination` field: when a submission carries an
 * `address` but no `destination`, copy the address into `destination` so existing queries,
 * admin views and the required-field check keep working. An explicit `destination` always wins.
 */
export const fillDestinationFromAddress = <T extends Record<string, unknown>>(data: T): T => {
  if (isNonEmptyString(data.destination) || !isNonEmptyString(data.address)) return data;
  return { ...data, destination: data.address.trim().slice(0, DESTINATION_MAX_LENGTH) };
};

const isInRange = (value: unknown, limit: number): boolean =>
  typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= limit;

/**
 * Rejects coordinates outside the valid WGS84 range. `lat` and `lng` are optional, but a
 * provided value must be a finite number within bounds (null/undefined are allowed).
 */
export const assertValidCoordinates = <T extends Record<string, unknown>>(data: T): T => {
  const issues: { field: string; reason: 'out_of_range' }[] = [];
  if (data.lat != null && !isInRange(data.lat, 90)) issues.push({ field: 'lat', reason: 'out_of_range' });
  if (data.lng != null && !isInRange(data.lng, 180)) issues.push({ field: 'lng', reason: 'out_of_range' });

  if (issues.length > 0) {
    throw new GraphQLError('Invalid form input.', {
      extensions: { code: 'BAD_USER_INPUT', fields: issues },
    });
  }
  return data;
};

/** Pre-persist transform for public transfer submissions: validate coordinates, then fill `destination`. */
export const prepareTransferReservation = <T extends Record<string, unknown>>(data: T): T =>
  fillDestinationFromAddress(assertValidCoordinates(data));

export const formatTransferDirection = (direction: unknown): string =>
  TRANSFER_DIRECTION_LABELS[isTransferDirection(direction) ? direction : DEFAULT_TRANSFER_DIRECTION];

/** Maps a stored transfer reservation to the email template placeholders. */
export const buildTransferEmailVars = (result: Record<string, unknown>): Record<string, unknown> => ({
  name: result.name,
  lastname: result.lastname,
  email: result.email,
  phone: result.phone,
  message: result.message,
  transferDate: result.transferDate,
  people: result.people,
  destination: result.destination,
  pickupTime: result.pickupTime,
  direction: formatTransferDirection(result.direction),
  // Legacy submissions only carry `destination`; show it as the address in that case.
  address: isNonEmptyString(result.address) ? result.address : (result.destination ?? ''),
});

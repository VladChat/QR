import { hash as a2hash, verify as a2verify } from '@node-rs/argon2';

export async function hashPin(pin: string) {
  if (!/^\d{4}$/.test(pin)) throw new Error('PIN must be 4 digits');
  return a2hash(pin, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
}

export async function verifyPinHash(hash: string, pin: string) {
  return a2verify(hash, pin);
}

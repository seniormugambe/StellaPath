import { createHash } from 'crypto';
import { describe, expect, it } from '@jest/globals';
import { Keypair } from 'stellar-sdk';
import { verifyWalletSignature } from '../middleware/auth';

describe('authentication middleware', () => {
  describe('verifyWalletSignature', () => {
    const message = 'Authenticate wallet GTEST at 2026-06-07T00:00:00.000Z';

    it('accepts raw Ed25519 message signatures', () => {
      const keypair = Keypair.random();
      const signature = keypair.sign(Buffer.from(message, 'utf8')).toString('base64');

      expect(verifyWalletSignature(keypair.publicKey(), signature, message)).toBe(true);
    });

    it('accepts Freighter signed-message signatures', () => {
      const keypair = Keypair.random();
      const freighterMessageHash = createHash('sha256')
        .update(`Stellar Signed Message:\n${message}`, 'utf8')
        .digest();
      const signature = keypair.sign(freighterMessageHash).toString('base64');

      expect(verifyWalletSignature(keypair.publicKey(), signature, message)).toBe(true);
    });

    it('accepts base64 encoded message signatures from legacy Freighter signBlob flows', () => {
      const keypair = Keypair.random();
      const base64Message = Buffer.from(message, 'utf8').toString('base64');
      const signature = keypair.sign(Buffer.from(base64Message, 'utf8')).toString('base64');

      expect(verifyWalletSignature(keypair.publicKey(), signature, message)).toBe(true);
    });

    it('accepts prefixed base64 message signatures from Freighter signBlob flows', () => {
      const keypair = Keypair.random();
      const base64Message = Buffer.from(message, 'utf8').toString('base64');
      const freighterMessageHash = createHash('sha256')
        .update(`Stellar Signed Message:\n${base64Message}`, 'utf8')
        .digest();
      const signature = keypair.sign(freighterMessageHash).toString('base64');

      expect(verifyWalletSignature(keypair.publicKey(), signature, message)).toBe(true);
    });

    it('rejects signatures that do not belong to the public key', () => {
      const signer = Keypair.random();
      const otherKeypair = Keypair.random();
      const signature = signer.sign(Buffer.from(message, 'utf8')).toString('base64');

      expect(verifyWalletSignature(otherKeypair.publicKey(), signature, message)).toBe(false);
    });

    it('rejects malformed public keys and signatures', () => {
      expect(verifyWalletSignature('not-a-public-key', 'not-a-signature', message)).toBe(false);
    });
  });
});

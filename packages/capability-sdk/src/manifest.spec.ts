import { describe, expect, it } from 'vitest';
import { CAPABILITY_SDK_VERSION, validateCapabilityManifest } from './index';

describe('validateCapabilityManifest', () => {
  it('accepts a compatible capability package', () => {
    expect(validateCapabilityManifest({ id: 'garden', name: 'Garden', version: '1.0.0', sdkVersion: CAPABILITY_SDK_VERSION, pillars: ['preparation'], entrypoint: './dist/index.js', description: 'Seasonal household garden planning.' })).toMatchObject({ id: 'garden' });
  });
  it('rejects unsupported contracts and invalid metadata', () => {
    expect(() => validateCapabilityManifest({ id: 'Garden', sdkVersion: '1', pillars: ['preparation'] })).toThrow('lowercase slug');
    expect(() => validateCapabilityManifest({ id: 'garden', name: 'Garden', version: '1.0.0', sdkVersion: '2', pillars: ['preparation'], entrypoint: './dist/index.js', description: 'x' })).toThrow('unsupported SDK');
  });
});

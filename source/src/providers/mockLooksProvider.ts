import { buildFixtureSession } from '../domain/stylingEngine';
import type { EditRequest, Profile, Session } from '../domain/types';
import type { LooksProvider } from './types';
let sessionCounter = 0;
/** Deterministic styling from the real retailer snapshot; no network or simulated AI inference. */
export class MockLooksProvider implements LooksProvider {
  async buildLooks(request: EditRequest, profile: Profile): Promise<Session> {
    return buildFixtureSession(request, profile, Date.now().toString(36) + '-' + sessionCounter++);
  }
}

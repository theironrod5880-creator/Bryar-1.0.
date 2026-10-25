'use strict';

/**
 * Bryar 1.0 community principles.
 * This file documents intended rules only; it does not perform automated moderation.
 * Enforce rules on the server before launch, and provide reporting and appeals.
 */
const BRYAR_COMMUNITY_RULES = Object.freeze([
  { id: 'dignity', title: 'Treat people with dignity', detail: 'No targeted harassment, threats, or dehumanizing attacks.' },
  { id: 'privacy', title: 'Protect private information', detail: 'Do not post another person’s private or identifying information without permission.' },
  { id: 'safety', title: 'Do not facilitate harm', detail: 'Do not use the service to threaten people or coordinate violence.' },
  { id: 'honesty', title: 'Be honest about AI', detail: 'AI-generated content should not be presented as a real person’s words or identity.' },
  { id: 'consent', title: 'Respect consent', detail: 'Audio and video features must require clear user permission and visible controls.' },
  { id: 'ads', title: 'Keep advertising transparent', detail: 'Clearly label paid promotions and provide a way to report deceptive ads.' }
]);

if (typeof module !== 'undefined' && module.exports) module.exports = BRYAR_COMMUNITY_RULES;
if (typeof globalThis !== 'undefined') globalThis.BRYAR_COMMUNITY_RULES = BRYAR_COMMUNITY_RULES;

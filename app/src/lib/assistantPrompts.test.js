import { describe, expect, it } from 'vitest'
import { BRAND_IDS } from '../contracts/branding'
import { buildCreateMapPrompt } from './assistantPrompts'

describe('buildCreateMapPrompt', () => {
  it('uses the Claude slash command for the default ClaudeMap brand', () => {
    expect(
      buildCreateMapPrompt('{"scope":true}', { id: BRAND_IDS.CLAUDEMAP }),
    ).toBe('/create-map {"scope":true}')
  })

  it('uses a skill invocation prompt for CodexMap', () => {
    expect(
      buildCreateMapPrompt('{"scope":true}', {
        id: BRAND_IDS.CODEXMAP,
        skillMention: '$codexmap-runtime',
      }),
    ).toBe('Use the $codexmap-runtime skill\'s create-map operation with this scope JSON: {"scope":true}')
  })
})

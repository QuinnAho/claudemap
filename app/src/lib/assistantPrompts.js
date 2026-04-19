import { BRAND_IDS } from '../contracts/branding'
import { getBrand } from './brand'

const createMapPromptBuilders = Object.freeze({
  [BRAND_IDS.CLAUDEMAP]: (scopeJson) => `/create-map ${scopeJson}`,
  [BRAND_IDS.CODEXMAP]: (scopeJson, brand) =>
    `Use the ${brand?.skillMention || '$codexmap-runtime'} skill's create-map operation with this scope JSON: ${scopeJson}`,
})

export function buildCreateMapPrompt(scopeJson, brand = getBrand()) {
  const buildPrompt =
    createMapPromptBuilders[brand?.id] || createMapPromptBuilders[BRAND_IDS.CLAUDEMAP]

  return buildPrompt(scopeJson, brand)
}

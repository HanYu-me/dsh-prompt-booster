/**
 * The boost model catalog: the same live list DSH's own model picker shows
 * (every registered provider's advertised models, built from
 * `llm.listProviders()` + `llm.listModels()`), plus the availability check
 * that guards a model chosen in the browser before it is used.
 * @module dsh-prompt-boost/models
 */

import type { ModelCatalog, ModelCatalogGroup, ModelRoute } from './shared/protocol'

/** Structural face of the LLM registry calls this module needs. */
export interface LlmCatalogFace {
  listProviders(): ReadonlyArray<{ id: string; name?: string }>
  listModels(provider: string): Promise<ReadonlyArray<{ id: string; name: string; description?: string }>>
}

/**
 * Read the catalog face off the `llm` service, or undefined when this host's
 * registry does not offer it (older runtimes).
 * @param llm - the `llm` service (untrusted shape).
 * @returns the face, or undefined.
 */
export function catalogFaceOf(llm: unknown): LlmCatalogFace | undefined {
  const candidate = llm as Partial<LlmCatalogFace> | null | undefined
  if (candidate === null || candidate === undefined) return undefined
  if (typeof candidate.listProviders !== 'function' || typeof candidate.listModels !== 'function') return undefined
  return candidate as LlmCatalogFace
}

/**
 * Build the provider-grouped catalog. A provider whose listing fails is
 * reported under `failures` and skipped, never failing the whole catalog;
 * providers with no models are dropped, exactly as DSH's own picker does.
 * @param llm - the catalog face.
 * @param fallback - the route used when no model is chosen, for display.
 * @returns the catalog.
 */
export async function buildModelCatalog(llm: LlmCatalogFace, fallback: ModelRoute | undefined): Promise<ModelCatalog> {
  const providers = llm.listProviders()
  const results = await Promise.all(providers.map(async (provider): Promise<{ group?: ModelCatalogGroup; failure?: { id: string; name: string; message: string } }> => {
    const name = typeof provider.name === 'string' && provider.name !== '' ? provider.name : provider.id
    try {
      const models = await llm.listModels(provider.id)
      return {
        group: {
          id: provider.id,
          name,
          models: models.map((model) => ({
            id: model.id,
            name: model.name,
            ...(typeof model.description === 'string' && model.description !== '' ? { description: model.description } : {}),
          })),
        },
      }
    } catch (error) {
      return { failure: { id: provider.id, name, message: error instanceof Error ? error.message : String(error) } }
    }
  }))
  const groups = results.flatMap((item) => item.group !== undefined && item.group.models.length > 0 ? [item.group] : [])
  return {
    groups,
    failures: results.flatMap((item) => item.failure !== undefined ? [item.failure] : []),
    ...(fallback !== undefined ? { fallback: nameRoute(groups, fallback) } : {}),
  }
}

/**
 * Attach a display name to a route when the catalog knows the model.
 * @param groups - the catalog groups.
 * @param route - the route.
 * @returns the route with `name` (and `providerName`) when found.
 */
function nameRoute(groups: readonly ModelCatalogGroup[], route: ModelRoute): ModelRoute {
  const group = groups.find((candidate) => candidate.id === route.provider)
  const model = group?.models.find((candidate) => candidate.id === route.model)
  return {
    provider: route.provider,
    model: route.model,
    ...(model !== undefined ? { name: model.name } : {}),
    ...(group !== undefined ? { providerName: group.name } : {}),
  }
}

/**
 * Whether a provider/model pair is currently advertised. This is what keeps a
 * browser-chosen model honest: the page can only pick from the live list.
 * @param llm - the catalog face.
 * @param provider - provider id.
 * @param model - model id.
 * @returns true when the provider is registered and lists the model.
 */
export async function isModelAvailable(llm: LlmCatalogFace, provider: string, model: string): Promise<boolean> {
  if (!llm.listProviders().some((candidate) => candidate.id === provider)) return false
  try {
    const models = await llm.listModels(provider)
    return models.some((candidate) => candidate.id === model)
  } catch {
    return false
  }
}

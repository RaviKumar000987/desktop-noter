/// AiContextService — the public API consumed by NAPI bridge.
///
/// Call order:
///   1. build_context(query, symbol_db, workspace_root) → AiContext (Rust, fast)
///   2. build_prompt(ctx, model) → AiPrompt (Rust, instant)
///   3. [JS layer] stream API call using AiPrompt → token push events
use anyhow::Result;
use crate::{
    cache::ContextCache,
    context_builder,
    models::{AiContext, AiPrompt, ProjectSummary},
    prompt_builder,
    ranker,
    retriever,
    retriever::query_parser,
};

pub struct AiContextService {
    pub workspace_root: String,
    cache: ContextCache,
}

impl AiContextService {
    pub fn new(workspace_root: String) -> Self {
        Self { workspace_root, cache: ContextCache::new() }
    }

    /// Build context for a query. Returns cached result if identical query was
    /// run within the last 5 minutes.
    pub fn build_context(
        &mut self,
        query: &str,
        symbol_db_path: &str,
        project: ProjectSummary,
    ) -> Result<AiContext> {
        // Cache hit
        if let Some(cached) = self.cache.get(query) {
            return Ok(cached.clone());
        }

        let keywords = query_parser::parse(query);

        // Layer 1: Retrieve candidates
        let candidates = retriever::retrieve(query, symbol_db_path, &self.workspace_root)?;

        // Layer 2: Rank
        let ranked = ranker::rank(candidates, query, &keywords, 20);

        // Layer 3: Build context (read file snippets)
        let ctx = context_builder::build(query, ranked, project)?;

        self.cache.insert(query, ctx.clone());
        Ok(ctx)
    }

    /// Build formatted prompt from context (Rust side — pure string formatting).
    pub fn build_prompt(&self, ctx: &AiContext, model: &str) -> AiPrompt {
        prompt_builder::build(ctx, model)
    }

    /// Invalidate all cached contexts (call when workspace changes).
    pub fn invalidate_cache(&mut self) {
        self.cache.invalidate_all();
    }
}

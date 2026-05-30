/// Symbol ranking engine.
///
/// Score = keyword_overlap (0–60) + file_path_score (0–20) + kind_bonus (0–10) + module_bonus (0–10)
/// Penalties: test files -20, config files -30
use crate::models::{ContextSymbol, RankedSymbol};

pub fn rank(
    candidates: Vec<ContextSymbol>,
    query: &str,
    keywords: &[String],
    top_n: usize,
) -> Vec<RankedSymbol> {
    let mut scored: Vec<RankedSymbol> = candidates
        .into_iter()
        .map(|sym| score_symbol(sym, query, keywords))
        .collect();

    scored.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
    scored.dedup_by_key(|r| r.symbol.id.clone());
    scored.truncate(top_n);
    scored
}

fn score_symbol(sym: ContextSymbol, _query: &str, keywords: &[String]) -> RankedSymbol {
    let name_lower   = sym.name.to_lowercase();
    let file_lower   = sym.file.to_lowercase();
    let cont_lower   = sym.container.as_deref().unwrap_or("").to_lowercase();

    let mut score  = 0f32;
    let mut reason = Vec::new();

    // ── Keyword overlap (0–60) ───────────────────────────────────────────────
    let mut kw_score = 0f32;
    for kw in keywords {
        if name_lower == *kw {
            kw_score += 20.0; // exact match
        } else if name_lower.contains(kw.as_str()) {
            kw_score += 12.0; // partial name match
        } else if file_lower.contains(kw.as_str()) {
            kw_score += 6.0;  // file path match
        } else if cont_lower.contains(kw.as_str()) {
            kw_score += 4.0;  // container match
        }
    }
    kw_score = kw_score.min(60.0);
    if kw_score > 0.0 {
        score += kw_score;
        reason.push(format!("keyword +{:.0}", kw_score));
    }

    // ── File path score (0–20) ───────────────────────────────────────────────
    let mut file_score = 0f32;
    for kw in keywords {
        if file_lower.contains(kw.as_str()) {
            file_score += 5.0;
        }
    }
    file_score = file_score.min(20.0);
    if file_score > 0.0 {
        score += file_score;
        reason.push(format!("file +{:.0}", file_score));
    }

    // ── Kind bonus (0–10) ────────────────────────────────────────────────────
    let kind_bonus = match sym.kind.as_str() {
        "function" | "method" | "constructor" | "arrow" => 10.0,
        "class"                                          => 7.0,
        "interface"                                      => 6.0,
        _                                                => 2.0,
    };
    score += kind_bonus;

    // ── Module/category bonus (0–10) ─────────────────────────────────────────
    // If query is about auth, auth/ files get bonus
    let mut module_bonus = 0f32;
    let category_hints: &[(&[&str], &str)] = &[
        (&["auth", "login", "oauth", "jwt", "session", "token"], "auth"),
        (&["db", "database", "repo", "repository", "query", "schema"], "db"),
        (&["api", "route", "endpoint", "controller", "handler", "request"], "api"),
        (&["user", "account", "profile", "member", "role"], "user"),
        (&["test", "spec", "mock"], "test"),
    ];
    for (query_hints, path_hint) in category_hints {
        let query_match = keywords.iter().any(|k| query_hints.contains(&k.as_str()));
        let file_match  = file_lower.contains(path_hint);
        if query_match && file_match { module_bonus = 10.0; break; }
    }
    if module_bonus > 0.0 {
        score += module_bonus;
        reason.push(format!("module +{:.0}", module_bonus));
    }

    // ── Penalties ────────────────────────────────────────────────────────────
    if file_lower.contains(".test.") || file_lower.contains(".spec.") || file_lower.contains("/test/") {
        score = (score - 20.0).max(0.0);
        reason.push("test-20".into());
    }
    if file_lower.ends_with(".lock") || file_lower.contains("config.") || file_lower.contains(".env") {
        score = (score - 30.0).max(0.0);
    }

    RankedSymbol {
        score,
        reason: reason.join(", "),
        symbol: sym,
    }
}

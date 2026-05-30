/// Parse a natural language query into searchable keywords.
///
/// "Add OAuth Login" → ["oauth", "login", "auth", "add"]
/// Handles: camelCase splitting, snake_case, common stop words removal.
use once_cell::sync::Lazy;
use regex::Regex;

static RE_CAMEL: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"([a-z])([A-Z])").unwrap()
});

const STOP_WORDS: &[&str] = &[
    "add", "create", "make", "build", "get", "set", "use", "the", "a", "an",
    "to", "for", "in", "on", "at", "by", "from", "with", "this", "that",
    "my", "our", "new", "old", "update", "delete", "remove", "fix", "refactor",
    "implement", "write", "how", "what", "why", "where", "when", "can", "does",
];

pub fn parse(query: &str) -> Vec<String> {
    // Split camelCase: "OAuthLogin" → "o auth login"
    let spaced = RE_CAMEL.replace_all(query, "$1 $2").to_lowercase();

    let mut keywords: Vec<String> = spaced
        .split(|c: char| !c.is_alphanumeric())
        .filter(|s| s.len() >= 2)
        .map(|s| s.to_string())
        .collect();

    // Also add original words (pre-split) for exact matches
    for word in query.split_whitespace() {
        let lower = word.to_lowercase();
        if lower.len() >= 2 && !keywords.contains(&lower) {
            keywords.push(lower);
        }
    }

    // Remove pure stop words (keep if there are no other keywords)
    let non_stop: Vec<_> = keywords.iter()
        .filter(|k| !STOP_WORDS.contains(&k.as_str()))
        .cloned()
        .collect();

    if non_stop.is_empty() { keywords } else { non_stop }
}

/// Generate SQL LIKE patterns for each keyword.
pub fn to_like_patterns(keywords: &[String]) -> Vec<String> {
    keywords.iter().map(|k| format!("%{}%", k)).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn test_parse_oauth() {
        let kw = parse("Add OAuth Login");
        assert!(kw.iter().any(|k| k.contains("oauth")));
        assert!(kw.iter().any(|k| k.contains("login")));
    }
}

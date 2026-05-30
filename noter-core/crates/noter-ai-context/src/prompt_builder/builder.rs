/// Prompt Builder — formats AiContext into a structured Claude prompt.
///
/// System prompt: project overview + code assistant role
/// User message:  task + ranked symbols + file snippets
use crate::models::{AiContext, AiPrompt};

pub fn build(ctx: &AiContext, model: &str) -> AiPrompt {
    let system = build_system(ctx);
    let user   = build_user(ctx);
    AiPrompt { system, user, model: model.to_string() }
}

fn build_system(ctx: &AiContext) -> String {
    let proj = &ctx.project;

    let mut parts = Vec::new();
    parts.push("You are an expert software engineer working inside the Noter IDE.".to_string());
    parts.push("You have deep understanding of the user's codebase — the project structure, architecture, and code relationships have been analyzed and provided to you.".to_string());
    parts.push(String::new());

    parts.push("## Project Context".to_string());
    if !proj.language.is_empty() {
        parts.push(format!("- **Language:** {}", proj.language));
    }
    if let Some(fw) = &proj.framework {
        parts.push(format!("- **Framework:** {}", fw));
    }
    if let Some(arch) = &proj.architecture {
        parts.push(format!("- **Architecture:** {}", arch));
    }
    if let Some(db) = &proj.database {
        parts.push(format!("- **Database:** {}", db));
    }
    if let Some(auth) = &proj.auth_system {
        parts.push(format!("- **Auth:** {}", auth));
    }
    parts.push(String::new());

    parts.push("## Instructions".to_string());
    parts.push("- Follow the existing project patterns and conventions.".to_string());
    parts.push("- Use the same language, framework, and libraries already in use.".to_string());
    parts.push("- Keep responses concise and actionable.".to_string());
    parts.push("- When generating code, include file paths as comments.".to_string());
    parts.push("- If you modify an existing file, show only the changed sections.".to_string());

    parts.join("\n")
}

fn build_user(ctx: &AiContext) -> String {
    let mut parts = Vec::new();

    parts.push(format!("**Task:** {}", ctx.query));
    parts.push(String::new());

    // Relevant symbols section
    if !ctx.ranked_symbols.is_empty() {
        parts.push("## Relevant Symbols".to_string());
        parts.push("The following symbols in your codebase are most relevant to this task:".to_string());
        parts.push(String::new());

        for rs in ctx.ranked_symbols.iter().take(20) {
            let s = &rs.symbol;
            let loc = format!("{}:{}", shorten_path(&s.file), s.line);
            let container = s.container.as_deref()
                .map(|c| format!(" (in {})", c))
                .unwrap_or_default();
            parts.push(format!("- `{}` [{kind}]{container} — {loc}",
                s.name, kind = s.kind, container = container, loc = loc));
        }
        parts.push(String::new());
    }

    // File snippets section
    if !ctx.file_snippets.is_empty() {
        parts.push("## Relevant Code".to_string());
        parts.push(String::new());

        for snippet in &ctx.file_snippets {
            parts.push(format!("### `{}` (lines {}-{})",
                shorten_path(&snippet.file), snippet.start_line, snippet.end_line));
            parts.push(format!("```{}", snippet.language));
            parts.push(snippet.content.clone());
            parts.push("```".to_string());
            parts.push(String::new());
        }
    }

    parts.join("\n")
}

/// Shorten absolute path to last 3 components for readability.
fn shorten_path(path: &str) -> String {
    let normalized = path.replace('\\', "/");
    let parts: Vec<&str> = normalized.split('/').collect();
    if parts.len() > 3 {
        format!("…/{}", parts[parts.len()-3..].join("/"))
    } else {
        normalized
    }
}

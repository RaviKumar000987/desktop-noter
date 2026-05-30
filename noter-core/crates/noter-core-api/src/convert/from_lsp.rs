//! Converts lsp-types protocol structs into noter-core-api internal types.
//! This is the ONLY place in the entire codebase where lsp-types appears.
//! All other crates work exclusively with noter-core-api types.

use lsp_types as lsp;
use crate::types::{
    location::{FileRef, Position, Range, Location},
    symbol::{Symbol, SymbolKind},
    diagnostic::{Diagnostic, DiagnosticSeverity},
    hover::{Hover, MarkedString},
    completion::{CompletionItem, CompletionKind},
    code_action::{TextEdit, WorkspaceEdit, Definition, Reference, InlayHint, InlayHintKind},
};
use std::collections::HashMap;

// ── Primitives ────────────────────────────────────────────────────────────────

impl From<lsp::Position> for Position {
    fn from(p: lsp::Position) -> Self {
        Self { line: p.line, character: p.character }
    }
}

impl From<lsp::Range> for Range {
    fn from(r: lsp::Range) -> Self {
        Self { start: r.start.into(), end: r.end.into() }
    }
}

// ── Symbol ────────────────────────────────────────────────────────────────────

impl From<lsp::SymbolKind> for SymbolKind {
    fn from(k: lsp::SymbolKind) -> Self {
        match k {
            lsp::SymbolKind::FILE          => SymbolKind::File,
            lsp::SymbolKind::MODULE        => SymbolKind::Module,
            lsp::SymbolKind::NAMESPACE     => SymbolKind::Namespace,
            lsp::SymbolKind::PACKAGE       => SymbolKind::Package,
            lsp::SymbolKind::CLASS         => SymbolKind::Class,
            lsp::SymbolKind::METHOD        => SymbolKind::Method,
            lsp::SymbolKind::PROPERTY      => SymbolKind::Property,
            lsp::SymbolKind::FIELD         => SymbolKind::Field,
            lsp::SymbolKind::CONSTRUCTOR   => SymbolKind::Constructor,
            lsp::SymbolKind::ENUM          => SymbolKind::Enum,
            lsp::SymbolKind::INTERFACE     => SymbolKind::Interface,
            lsp::SymbolKind::FUNCTION      => SymbolKind::Function,
            lsp::SymbolKind::VARIABLE      => SymbolKind::Variable,
            lsp::SymbolKind::CONSTANT      => SymbolKind::Constant,
            lsp::SymbolKind::STRING        => SymbolKind::String,
            lsp::SymbolKind::NUMBER        => SymbolKind::Number,
            lsp::SymbolKind::BOOLEAN       => SymbolKind::Boolean,
            lsp::SymbolKind::ARRAY         => SymbolKind::Array,
            lsp::SymbolKind::OBJECT        => SymbolKind::Object,
            lsp::SymbolKind::KEY           => SymbolKind::Key,
            lsp::SymbolKind::NULL          => SymbolKind::Null,
            lsp::SymbolKind::ENUM_MEMBER   => SymbolKind::EnumMember,
            lsp::SymbolKind::STRUCT        => SymbolKind::Struct,
            lsp::SymbolKind::EVENT         => SymbolKind::Event,
            lsp::SymbolKind::OPERATOR      => SymbolKind::Operator,
            lsp::SymbolKind::TYPE_PARAMETER => SymbolKind::TypeParameter,
            _                              => SymbolKind::Unknown,
        }
    }
}

pub fn symbol_from_lsp(sym: lsp::SymbolInformation, _workspace_root: &str) -> Symbol {
    let file = FileRef::from_uri(sym.location.uri.as_str());
    let range = sym.location.range.into();
    Symbol::new(sym.name, sym.kind.into(), file, range, sym.container_name)
}

// ── Diagnostic ────────────────────────────────────────────────────────────────

impl From<lsp::DiagnosticSeverity> for DiagnosticSeverity {
    fn from(s: lsp::DiagnosticSeverity) -> Self {
        match s {
            lsp::DiagnosticSeverity::ERROR       => DiagnosticSeverity::Error,
            lsp::DiagnosticSeverity::WARNING     => DiagnosticSeverity::Warning,
            lsp::DiagnosticSeverity::INFORMATION => DiagnosticSeverity::Information,
            lsp::DiagnosticSeverity::HINT        => DiagnosticSeverity::Hint,
            _                                    => DiagnosticSeverity::Information,
        }
    }
}

pub fn diagnostic_from_lsp(d: lsp::Diagnostic, file_uri: &str, source: &str) -> Diagnostic {
    Diagnostic {
        file: FileRef::from_uri(file_uri),
        range: d.range.into(),
        severity: d.severity.map(Into::into).unwrap_or(DiagnosticSeverity::Information),
        message: d.message,
        source: source.to_string(),
        code: d.code.map(|c| match c {
            lsp::NumberOrString::Number(n) => n.to_string(),
            lsp::NumberOrString::String(s) => s,
        }),
    }
}

// ── Hover ─────────────────────────────────────────────────────────────────────

impl From<lsp::Hover> for Hover {
    fn from(h: lsp::Hover) -> Self {
        let contents = match h.contents {
            lsp::HoverContents::Scalar(ms) => vec![marked_string_from_lsp(ms)],
            lsp::HoverContents::Array(arr) => arr.into_iter().map(marked_string_from_lsp).collect(),
            lsp::HoverContents::Markup(mu) => vec![MarkedString::Markdown { value: mu.value }],
        };
        Hover { contents, range: h.range.map(Into::into) }
    }
}

fn marked_string_from_lsp(ms: lsp::MarkedString) -> MarkedString {
    match ms {
        lsp::MarkedString::String(s)              => MarkedString::Markdown { value: s },
        lsp::MarkedString::LanguageString(ls)     => MarkedString::Code { language: ls.language, value: ls.value },
    }
}

// ── Completion ────────────────────────────────────────────────────────────────

impl From<lsp::CompletionItemKind> for CompletionKind {
    fn from(k: lsp::CompletionItemKind) -> Self {
        match k {
            lsp::CompletionItemKind::TEXT          => CompletionKind::Text,
            lsp::CompletionItemKind::METHOD        => CompletionKind::Method,
            lsp::CompletionItemKind::FUNCTION      => CompletionKind::Function,
            lsp::CompletionItemKind::CONSTRUCTOR   => CompletionKind::Constructor,
            lsp::CompletionItemKind::FIELD         => CompletionKind::Field,
            lsp::CompletionItemKind::VARIABLE      => CompletionKind::Variable,
            lsp::CompletionItemKind::CLASS         => CompletionKind::Class,
            lsp::CompletionItemKind::INTERFACE     => CompletionKind::Interface,
            lsp::CompletionItemKind::MODULE        => CompletionKind::Module,
            lsp::CompletionItemKind::PROPERTY      => CompletionKind::Property,
            lsp::CompletionItemKind::UNIT          => CompletionKind::Unit,
            lsp::CompletionItemKind::VALUE         => CompletionKind::Value,
            lsp::CompletionItemKind::ENUM          => CompletionKind::Enum,
            lsp::CompletionItemKind::KEYWORD       => CompletionKind::Keyword,
            lsp::CompletionItemKind::SNIPPET       => CompletionKind::Snippet,
            lsp::CompletionItemKind::COLOR         => CompletionKind::Color,
            lsp::CompletionItemKind::FILE          => CompletionKind::File,
            lsp::CompletionItemKind::REFERENCE     => CompletionKind::Reference,
            lsp::CompletionItemKind::FOLDER        => CompletionKind::Folder,
            lsp::CompletionItemKind::ENUM_MEMBER   => CompletionKind::EnumMember,
            lsp::CompletionItemKind::CONSTANT      => CompletionKind::Constant,
            lsp::CompletionItemKind::STRUCT        => CompletionKind::Struct,
            lsp::CompletionItemKind::EVENT         => CompletionKind::Event,
            lsp::CompletionItemKind::OPERATOR      => CompletionKind::Operator,
            lsp::CompletionItemKind::TYPE_PARAMETER => CompletionKind::TypeParameter,
            _                                      => CompletionKind::Text,
        }
    }
}

impl From<lsp::CompletionItem> for CompletionItem {
    fn from(c: lsp::CompletionItem) -> Self {
        let insert_text = c.insert_text.or_else(|| Some(c.label.clone()));
        let is_snippet = c.insert_text_format == Some(lsp::InsertTextFormat::SNIPPET);
        let documentation = c.documentation.map(|d| match d {
            lsp::Documentation::String(s) => s,
            lsp::Documentation::MarkupContent(m) => m.value,
        });
        CompletionItem {
            label: c.label,
            kind: c.kind.map(Into::into),
            detail: c.detail,
            documentation,
            insert_text,
            sort_text: c.sort_text,
            filter_text: c.filter_text,
            is_snippet,
        }
    }
}

// ── TextEdit / WorkspaceEdit ──────────────────────────────────────────────────

impl From<lsp::TextEdit> for TextEdit {
    fn from(e: lsp::TextEdit) -> Self {
        Self { range: e.range.into(), new_text: e.new_text }
    }
}

pub fn workspace_edit_from_lsp(we: lsp::WorkspaceEdit) -> WorkspaceEdit {
    let mut changes = HashMap::new();
    if let Some(map) = we.changes {
        for (uri, edits) in map {
            changes.insert(uri.to_string(), edits.into_iter().map(Into::into).collect());
        }
    }
    WorkspaceEdit { changes }
}

// ── Location / Definition / Reference ────────────────────────────────────────

impl From<lsp::Location> for Location {
    fn from(l: lsp::Location) -> Self {
        Location {
            file: FileRef::from_uri(l.uri.as_str()),
            range: l.range.into(),
        }
    }
}

pub fn definition_from_lsp(origin: Location, target: lsp::Location) -> Definition {
    Definition { origin, target: target.into() }
}

pub fn reference_from_lsp(r: lsp::Location, is_definition: bool) -> Reference {
    Reference { location: r.into(), is_definition }
}

// ── InlayHint ────────────────────────────────────────────────────────────────

pub fn inlay_hint_from_lsp(h: lsp::InlayHint, file_uri: &str) -> InlayHint {
    let label = match h.label {
        lsp::InlayHintLabel::String(s) => s,
        lsp::InlayHintLabel::LabelParts(parts) => {
            parts.into_iter().map(|p| p.value).collect::<Vec<_>>().join("")
        }
    };
    let kind = match h.kind {
        Some(lsp::InlayHintKind::PARAMETER) => InlayHintKind::Parameter,
        _ => InlayHintKind::Type,
    };
    InlayHint {
        file: FileRef::from_uri(file_uri),
        position: h.position.into(),
        label,
        kind,
    }
}

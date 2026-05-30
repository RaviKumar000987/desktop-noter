/// Layer 9 — Architecture Analyzer.
/// Verifies that the actual import graph respects the declared architecture pattern.
///
/// Rule sets:
///   MVC      — controllers must not import from controllers; models must not import controllers
///   Clean    — domain must not import infrastructure; application must not import adapters
///   Layered  — higher layers (controller→service→repo→db) only, never reverse
use crate::graph::CodeGraphData;
use crate::models::{ArchViolation, EdgeKind};

// ── Layer rule definitions ────────────────────────────────────────────────────

struct LayerRule {
    /// Layer name (for error messages)
    name: &'static str,
    /// Path segments that identify files in this layer
    markers: &'static [&'static str],
    /// Layers this layer MUST NOT import from
    forbidden_markers: &'static [&'static str],
}

const MVC_RULES: &[LayerRule] = &[
    LayerRule {
        name: "Controller",
        markers: &["controller", "controllers"],
        forbidden_markers: &["controller", "controllers"],  // controllers don't call each other
    },
    LayerRule {
        name: "Model",
        markers: &["model", "models"],
        forbidden_markers: &["controller", "controllers", "route", "routes"],  // models stay pure
    },
];

const LAYERED_RULES: &[LayerRule] = &[
    LayerRule {
        name: "Repository",
        markers: &["repository", "repositories", "repo"],
        forbidden_markers: &["service", "services", "controller", "controllers", "route"],
    },
    LayerRule {
        name: "Service",
        markers: &["service", "services"],
        forbidden_markers: &["controller", "controllers", "route", "routes"],
    },
];

const CLEAN_RULES: &[LayerRule] = &[
    LayerRule {
        name: "Domain",
        markers: &["domain"],
        forbidden_markers: &["infrastructure", "infra", "adapter", "adapters"],
    },
    LayerRule {
        name: "Application",
        markers: &["application", "usecase", "use_case"],
        forbidden_markers: &["infrastructure", "infra", "adapter", "adapters"],
    },
];

// ── Public API ────────────────────────────────────────────────────────────────

pub fn detect_violations(data: &CodeGraphData, pattern: &str) -> Vec<ArchViolation> {
    let rules = match pattern {
        "mvc" | "MVC" => MVC_RULES,
        "layered" | "Layered" => LAYERED_RULES,
        "clean" | "Clean" | "clean_architecture" => CLEAN_RULES,
        _ => return vec![],
    };

    let mut violations = Vec::new();

    // For each import edge: check if source layer is importing from forbidden target layer
    for (from_id, from_node) in data.all_file_nodes() {
        let from_file = from_node.file.to_lowercase().replace('\\', "/");

        for rule in rules {
            let from_matches = rule.markers.iter().any(|m| from_file.contains(m));
            if !from_matches { continue; }

            // Check all files this imports
            for to_id in data.edges_of_kind(from_id, EdgeKind::Imports) {
                if let Some(to_node) = data.node(to_id) {
                    let to_file = to_node.file.to_lowercase().replace('\\', "/");

                    let forbidden = rule.forbidden_markers.iter().any(|m| to_file.contains(m));
                    if forbidden {
                        violations.push(ArchViolation {
                            description: format!(
                                "{} layer imports from forbidden layer",
                                rule.name
                            ),
                            from_file: from_node.file.clone(),
                            to_file: to_node.file.clone(),
                            rule: format!(
                                "{} must not import [{}]",
                                rule.name,
                                rule.forbidden_markers.join(", ")
                            ),
                        });
                    }
                }
            }
        }
    }

    violations
}

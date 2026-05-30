use crate::models::{HealthScore, Recommendation, DeadSymbol, Cycle, ArchViolation, LargeFile, RiskItem};

pub fn compute_health(
    arch_violations: &[ArchViolation],
    cycles:          &[Cycle],
    dead_code:       &[DeadSymbol],
    large_files:     &[LargeFile],
    risk_items:      &[RiskItem],
) -> HealthScore {
    let arch_score  = 100u32.saturating_sub((arch_violations.len() as u32).saturating_mul(10));
    let debt_score  = 100u32
        .saturating_sub((dead_code.len() as u32).saturating_mul(3))
        .saturating_sub((cycles.len() as u32).saturating_mul(8));
    let comp_score  = 100u32.saturating_sub((large_files.len() as u32).saturating_mul(4).min(60));
    let criticals   = risk_items.iter().filter(|r| r.level == "critical").count() as u32;
    let risk_score  = 100u32.saturating_sub(criticals.saturating_mul(12));

    let total = (arch_score  * 25
               + debt_score  * 25
               + comp_score  * 20
               + risk_score  * 30) / 100;

    HealthScore {
        total:        total.min(100),
        architecture: arch_score.min(100),
        debt:         debt_score.min(100),
        complexity:   comp_score.min(100),
        risk:         risk_score.min(100),
    }
}

pub fn build_recommendations(
    arch_violations: &[ArchViolation],
    cycles:          &[Cycle],
    dead_code:       &[DeadSymbol],
    large_files:     &[LargeFile],
    risk_items:      &[RiskItem],
) -> Vec<Recommendation> {
    let mut recs = Vec::new();

    if !cycles.is_empty() {
        recs.push(Recommendation {
            priority: "high".into(),
            icon:     "🔴".into(),
            title:    "Break Circular Dependencies".into(),
            detail:   format!(
                "{} cycle{} detected. Extract shared interfaces to break loops.",
                cycles.len(), if cycles.len() > 1 { "s" } else { "" }
            ),
        });
    }

    let crits: Vec<_> = risk_items.iter().filter(|r| r.level == "critical").collect();
    if !crits.is_empty() {
        recs.push(Recommendation {
            priority: "high".into(),
            icon:     "🔴".into(),
            title:    "Split High-Risk Modules".into(),
            detail:   format!(
                "{} file{} many dependents. Extract smaller units to reduce blast radius.",
                crits.len(), if crits.len() > 1 { "s have" } else { " has" }
            ),
        });
    }

    if !arch_violations.is_empty() {
        recs.push(Recommendation {
            priority: "medium".into(),
            icon:     "🟡".into(),
            title:    "Fix Architecture Violations".into(),
            detail:   format!(
                "{} file{} your architecture rules.",
                arch_violations.len(),
                if arch_violations.len() > 1 { "s violate" } else { " violates" }
            ),
        });
    }

    if !dead_code.is_empty() {
        recs.push(Recommendation {
            priority: "medium".into(),
            icon:     "🟡".into(),
            title:    "Remove Dead Code".into(),
            detail:   format!(
                "{} unused export{} found. Removal reduces bundle size and confusion.",
                dead_code.len(), if dead_code.len() > 1 { "s" } else { "" }
            ),
        });
    }

    if large_files.len() > 5 {
        recs.push(Recommendation {
            priority: "low".into(),
            icon:     "🟢".into(),
            title:    "Refactor Large Files".into(),
            detail:   format!(
                "{} complex files found. Split into smaller, focused modules.",
                large_files.len()
            ),
        });
    }

    if recs.is_empty() {
        recs.push(Recommendation {
            priority: "low".into(),
            icon:     "🟢".into(),
            title:    "Project looks healthy".into(),
            detail:   "No critical issues found. Continue monitoring as the codebase grows.".into(),
        });
    }

    recs
}

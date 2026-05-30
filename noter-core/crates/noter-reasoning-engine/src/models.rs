use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskItem {
    pub file:      String,
    pub full_path: String,
    pub callers:   String,
    pub risk:      u32,
    pub level:     String,   // "critical" | "medium" | "low"
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct HealthScore {
    pub total:        u32,
    pub architecture: u32,
    pub debt:         u32,
    pub complexity:   u32,
    pub risk:         u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Recommendation {
    pub priority: String,   // "high" | "medium" | "low"
    pub icon:     String,
    pub title:    String,
    pub detail:   String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LargeFile {
    pub path: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeadSymbol {
    pub name: String,
    pub file: String,
    pub line: u32,
    pub kind: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Cycle {
    pub files: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArchViolation {
    pub description: String,
    pub from_file:   String,
    pub to_file:     String,
    pub rule:        String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ReasoningReport {
    pub dead_code:       Vec<DeadSymbol>,
    pub cycles:          Vec<Cycle>,
    pub arch_violations: Vec<ArchViolation>,
    pub large_files:     Vec<LargeFile>,
    pub risk_items:      Vec<RiskItem>,
    pub health:          HealthScore,
    pub recommendations: Vec<Recommendation>,
}

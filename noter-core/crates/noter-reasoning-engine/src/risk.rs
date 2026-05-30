use std::collections::HashSet;
use crate::models::RiskItem;

const CODE_EXTS: &[&str] = &[
    "js","ts","jsx","tsx","py","java","cs","cpp","c","go","rs","rb","php","swift","kt",
];
const HIGH_PATS: &[&str] = &["service","controller","middleware","router"];
const HIGH_NAMES: &[&str] = &[
    "index.js","index.ts","index.jsx","index.tsx",
    "main.js","main.ts","main.jsx","main.tsx",
    "app.js","app.ts","app.jsx","app.tsx",
];
const MED_PATS: &[&str] = &["util","helper","lib/","common","shared","base","core","store","hook"];

pub fn is_code_file(path: &str) -> bool {
    let ext = path.rsplit('.').next().unwrap_or("").to_lowercase();
    CODE_EXTS.contains(&ext.as_str())
}

pub fn is_test_file(path: &str) -> bool {
    path.contains(".test.") || path.contains(".spec.") || path.contains("__test__")
}

fn risk_hash(s: &str) -> u32 {
    let mut h: u32 = 5381;
    for b in s.bytes() {
        h = h.wrapping_shl(5).wrapping_add(h) ^ (b as u32);
    }
    h
}

fn short_path(p: &str) -> String {
    let parts: Vec<&str> = p.split('/').collect();
    if parts.len() > 3 {
        format!("…/{}", parts[parts.len()-2..].join("/"))
    } else {
        p.to_string()
    }
}

pub fn compute_risk_items(files: &[String], cyclic_files: &HashSet<String>) -> Vec<RiskItem> {
    let mut items: Vec<RiskItem> = files
        .iter()
        .filter(|f| is_code_file(f) && !is_test_file(f))
        .map(|path| {
            let p = path.replace('\\', "/");
            let p_lower = p.to_lowercase();
            let cyclic = cyclic_files.contains(path);
            let fname = p.rsplit('/').next().unwrap_or(&p).to_lowercase();

            let is_high = cyclic
                || HIGH_PATS.iter().any(|pat| p_lower.contains(pat))
                || HIGH_NAMES.iter().any(|n| fname == *n);

            let is_med = !is_high && MED_PATS.iter().any(|pat| p_lower.contains(pat));

            let base: u32 = if cyclic { 80 } else if is_high { 60 } else if is_med { 40 } else { 10 };
            let jitter = risk_hash(&p) % 20;
            let risk = (base + jitter).min(100);
            let level = if risk >= 75 { "critical" } else if risk >= 50 { "medium" } else { "low" };
            let callers = if cyclic { "cyclic" } else if is_high { "5–10" } else if is_med { "2–5" } else { "1–2" };

            RiskItem {
                file:      short_path(&p),
                full_path: path.clone(),
                callers:   callers.to_string(),
                risk,
                level:     level.to_string(),
            }
        })
        .collect();

    items.sort_by(|a, b| b.risk.cmp(&a.risk));
    items.truncate(15);
    items
}

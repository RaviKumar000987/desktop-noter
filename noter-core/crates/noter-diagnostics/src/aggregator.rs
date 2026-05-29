use std::collections::HashMap;
use crate::diagnostic::Diagnostic;

pub struct DiagnosticsAggregator {
    by_file: HashMap<String, Vec<Diagnostic>>,
}

impl DiagnosticsAggregator {
    pub fn new() -> Self {
        Self { by_file: HashMap::new() }
    }

    pub fn update(&mut self, source: &str, diagnostics: Vec<Diagnostic>) {
        for (_, diags) in self.by_file.iter_mut() {
            diags.retain(|d| d.source != source);
        }
        for d in diagnostics {
            self.by_file.entry(d.file.clone()).or_default().push(d);
        }
    }

    pub fn get_for_file(&self, file: &str) -> Vec<&Diagnostic> {
        self.by_file.get(file).map(|v| v.iter().collect()).unwrap_or_default()
    }

    pub fn all(&self) -> Vec<&Diagnostic> {
        self.by_file.values().flatten().collect()
    }

    pub fn error_count(&self) -> usize {
        use crate::diagnostic::DiagnosticSeverity::Error;
        self.all().iter().filter(|d| d.severity == Error).count()
    }
}

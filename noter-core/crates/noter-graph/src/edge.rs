use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EdgeKind {
    Imports,
    Calls,
    Extends,
    References,
    Exports,
}

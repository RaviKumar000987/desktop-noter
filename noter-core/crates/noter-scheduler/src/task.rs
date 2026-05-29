use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub enum TaskPriority {
    Critical = 0,
    High     = 1,
    Normal   = 2,
    Low      = 3,
    Idle     = 4,
}

pub struct Task {
    pub id: u64,
    pub name: String,
    pub priority: TaskPriority,
    pub work: Box<dyn FnOnce() + Send + 'static>,
}

impl std::fmt::Debug for Task {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Task")
            .field("id", &self.id)
            .field("name", &self.name)
            .field("priority", &self.priority)
            .finish()
    }
}

impl Task {
    pub fn new(
        id: u64,
        name: impl Into<String>,
        priority: TaskPriority,
        work: impl FnOnce() + Send + 'static,
    ) -> Self {
        Self { id, name: name.into(), priority, work: Box::new(work) }
    }
}

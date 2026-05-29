use std::sync::{Arc, Mutex};
use std::collections::BinaryHeap;
use std::cmp::Reverse;
use tokio::task;
use tracing::{info, debug};

use crate::task::Task;

pub struct BackgroundScheduler {
    queue: Arc<Mutex<BinaryHeap<Reverse<(u8, u64)>>>>,
}

impl BackgroundScheduler {
    pub fn new() -> Self {
        Self {
            queue: Arc::new(Mutex::new(BinaryHeap::new())),
        }
    }

    pub fn spawn(&self, t: Task) {
        debug!("Scheduling task '{}' priority={:?}", t.name, t.priority);
        let prio = t.priority as u8;
        let id = t.id;
        {
            self.queue.lock().unwrap().push(Reverse((prio, id)));
        }
        task::spawn_blocking(move || {
            info!("Running task '{}' (id={})", t.name, t.id);
            (t.work)();
        });
    }
}

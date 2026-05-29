use std::path::Path;
use notify::{Watcher, RecursiveMode, recommended_watcher};
use crossbeam_channel::{unbounded, Receiver};
use anyhow::Result;
use tracing::info;

use crate::event::{WatchEvent, WatchEventKind};

pub struct FileWatcher {
    _watcher: Box<dyn Watcher>,
    pub receiver: Receiver<WatchEvent>,
}

impl FileWatcher {
    pub fn watch(root: &str) -> Result<Self> {
        let (tx, rx) = unbounded();

        let mut w = recommended_watcher(move |res: notify::Result<notify::Event>| {
            if let Ok(event) = res {
                for path in &event.paths {
                    let path_str = path.to_string_lossy().to_string();
                    let kind = match event.kind {
                        notify::EventKind::Create(_) => WatchEventKind::Created,
                        notify::EventKind::Modify(_) => WatchEventKind::Modified,
                        notify::EventKind::Remove(_) => WatchEventKind::Deleted,
                        _ => continue,
                    };
                    let _ = tx.send(WatchEvent { path: path_str, kind });
                }
            }
        })?;

        w.watch(Path::new(root), RecursiveMode::Recursive)?;
        info!("Watching {root}");

        Ok(Self { _watcher: Box::new(w), receiver: rx })
    }
}

use anyhow::Result;
use tracing::info;

pub struct ExtensionHost {
    pub workspace: String,
}

impl ExtensionHost {
    pub fn new(workspace: &str) -> Self {
        Self { workspace: workspace.to_string() }
    }

    pub async fn spawn(&self) -> Result<()> {
        // Each extension runs in its own subprocess; supervisor restarts on crash
        info!("Extension host spawning for {}", self.workspace);
        // TODO: spawn noter-extension-host binary, communicate via stdio JSON-RPC
        Ok(())
    }
}

use anyhow::Result;
use tracing::info;

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt::init();
    info!("noter-core starting...");

    // TODO: start IPC server, spawn scheduler, init caches
    // noter_scheduler::Scheduler::new()
    //     .register(noter_search::SearchService::new())
    //     .register(noter_indexer::IndexerService::new())
    //     .register(noter_git::GitService::new())
    //     .start()
    //     .await?;

    info!("noter-core ready");
    Ok(())
}

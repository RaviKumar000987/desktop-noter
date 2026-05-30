use crate::service::{ServiceId, ServiceState, ServiceRegistry};
use crate::events::{EventTx, NoterEvent};
use std::future::Future;
use std::pin::Pin;
use tracing::info;

/// A single step in the deterministic boot sequence.
pub struct BootStep {
    pub service: ServiceId,
    pub name: &'static str,
    /// Async factory that starts the service. Returns Ok(()) on success.
    pub start: Box<dyn Fn() -> Pin<Box<dyn Future<Output = anyhow::Result<()>> + Send>> + Send + Sync>,
}

/// Runs services in the declared order, reporting state transitions via the event bus.
/// If a step fails, the coordinator stops and marks that service as Failed.
pub struct BootCoordinator {
    steps: Vec<BootStep>,
    registry: ServiceRegistry,
    event_tx: EventTx,
}

impl BootCoordinator {
    pub fn new(registry: ServiceRegistry, event_tx: EventTx) -> Self {
        Self { steps: Vec::new(), registry, event_tx }
    }

    pub fn add_step(&mut self, step: BootStep) {
        self.steps.push(step);
    }

    pub async fn run(&self) -> anyhow::Result<()> {
        for step in &self.steps {
            info!("Boot: starting {}", step.name);
            self.registry.set(step.service, ServiceState::Starting);
            let _ = self.event_tx.send(NoterEvent::ServiceStateChanged {
                id: step.service,
                state: ServiceState::Starting,
            });

            match (step.start)().await {
                Ok(()) => {
                    self.registry.set(step.service, ServiceState::Ready);
                    let _ = self.event_tx.send(NoterEvent::ServiceStateChanged {
                        id: step.service,
                        state: ServiceState::Ready,
                    });
                    info!("Boot: {} ready", step.name);
                }
                Err(e) => {
                    self.registry.set(step.service, ServiceState::Failed);
                    let _ = self.event_tx.send(NoterEvent::ServiceStateChanged {
                        id: step.service,
                        state: ServiceState::Failed,
                    });
                    tracing::error!("Boot: {} failed — {e}", step.name);
                    return Err(e);
                }
            }
        }
        Ok(())
    }
}

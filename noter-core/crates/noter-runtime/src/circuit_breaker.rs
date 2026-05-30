use std::time::{Duration, Instant};

const MAX_CRASHES_IN_WINDOW: u32 = 3;
const CRASH_WINDOW: Duration = Duration::from_secs(30);
const BASE_BACKOFF: Duration = Duration::from_secs(5);
const MAX_BACKOFF: Duration = Duration::from_secs(300); // 5 minutes cap

pub struct CircuitBreaker {
    crash_count: u32,
    window_start: Instant,
    backoff_until: Option<Instant>,
    total_restarts: u32,
}

pub enum CircuitDecision {
    /// Restart now.
    Restart,
    /// Back off for the given duration, then try again.
    BackOff(Duration),
    /// Permanently failed — stop trying.
    GiveUp,
}

impl CircuitBreaker {
    pub fn new() -> Self {
        Self {
            crash_count: 0,
            window_start: Instant::now(),
            backoff_until: None,
            total_restarts: 0,
        }
    }

    pub fn record_crash(&mut self) -> CircuitDecision {
        let now = Instant::now();

        // Reset window if older than CRASH_WINDOW
        if now.duration_since(self.window_start) > CRASH_WINDOW {
            self.crash_count = 0;
            self.window_start = now;
        }

        self.crash_count += 1;
        self.total_restarts += 1;

        if self.crash_count < MAX_CRASHES_IN_WINDOW {
            return CircuitDecision::Restart;
        }

        // Exponential backoff: 5s, 10s, 20s, 40s … capped at 5 min
        let backoff = (BASE_BACKOFF * 2u32.saturating_pow(self.total_restarts / MAX_CRASHES_IN_WINDOW))
            .min(MAX_BACKOFF);

        self.backoff_until = Some(now + backoff);
        self.crash_count = 0;
        self.window_start = now;

        CircuitDecision::BackOff(backoff)
    }

    pub fn is_backing_off(&self) -> bool {
        self.backoff_until.map(|t| Instant::now() < t).unwrap_or(false)
    }

    pub fn total_restarts(&self) -> u32 {
        self.total_restarts
    }
}

impl Default for CircuitBreaker {
    fn default() -> Self { Self::new() }
}

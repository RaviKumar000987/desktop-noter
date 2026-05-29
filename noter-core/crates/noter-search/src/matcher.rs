use regex::Regex;
use anyhow::Result;

pub struct Matcher {
    regex: Regex,
}

impl Matcher {
    pub fn new(pattern: &str, case_sensitive: bool) -> Result<Self> {
        let pat = if case_sensitive {
            pattern.to_string()
        } else {
            format!("(?i){pattern}")
        };
        Ok(Self { regex: Regex::new(&pat)? })
    }

    pub fn is_match(&self, text: &str) -> bool {
        self.regex.is_match(text)
    }

    pub fn find_all(&self, text: &str) -> Vec<(usize, usize)> {
        self.regex.find_iter(text).map(|m| (m.start(), m.end())).collect()
    }
}

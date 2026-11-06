use serde_json::Value;
use std::{fs, path::Path};

pub const VERSION_MESSAGE: &str =
    "Le projet a été créé avec une version plus récente. Veuillez mettre à jour PAIDEIA.";

fn version(value: &str) -> Result<Vec<u64>, String> {
    let mut parts = value
        .split('.')
        .map(|part| part.parse::<u64>().map_err(|_| VERSION_MESSAGE.to_string()))
        .collect::<Result<Vec<_>, _>>()?;
    if parts.len() != 3 {
        return Err(VERSION_MESSAGE.into());
    }
    while parts.last() == Some(&0) {
        parts.pop();
    }
    Ok(parts)
}

pub fn check_metadata(metadata: &Value) -> Result<(), String> {
    if let Some(required) = metadata.get("minimumPaideiaVersion") {
        let required = required.as_str().ok_or(VERSION_MESSAGE)?;
        if version(required)? > version(env!("CARGO_PKG_VERSION"))? {
            return Err(VERSION_MESSAGE.into());
        }
    }
    Ok(())
}

pub fn check_path(root: &Path) -> Result<(), String> {
    match fs::read(root.join("project.json")) {
        Ok(bytes) => check_metadata(
            &serde_json::from_slice::<Value>(&bytes).map_err(|error| error.to_string())?,
        ),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error.to_string()),
    }
}

pub fn stamp(root: &Path, metadata: &mut Value) -> Result<(), String> {
    check_path(root)?;
    let previous = fs::read(root.join("project.json"))
        .ok()
        .and_then(|bytes| serde_json::from_slice::<Value>(&bytes).ok());
    metadata["createdWithPaideiaVersion"] = previous
        .as_ref()
        .and_then(|value| value.get("createdWithPaideiaVersion"))
        .cloned()
        .unwrap_or(Value::String(env!("CARGO_PKG_VERSION").into()));
    metadata["minimumPaideiaVersion"] = Value::String(env!("CARGO_PKG_VERSION").into());
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn compares_build_numbers_numerically() {
        assert!(version("1.0.10").unwrap() > version("1.0.9").unwrap());
    }
    #[test]
    fn rejects_future_or_invalid_version_but_accepts_legacy() {
        assert!(check_metadata(&serde_json::json!({"minimumPaideiaVersion":"999.0.0"})).is_err());
        assert!(check_metadata(&serde_json::json!({"minimumPaideiaVersion":false})).is_err());
        assert!(check_metadata(&serde_json::json!({})).is_ok());
        assert!(check_metadata(
            &serde_json::json!({"minimumPaideiaVersion":env!("CARGO_PKG_VERSION")})
        )
        .is_ok());
    }
}

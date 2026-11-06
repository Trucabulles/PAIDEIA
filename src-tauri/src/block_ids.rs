use uuid::Uuid;

pub const BLOCK_ID_LENGTH: usize = 8;

pub fn new_block_id_candidate() -> String {
    const ALPHABET: &[u8; 36] = b"0123456789abcdefghijklmnopqrstuvwxyz";
    let mut value = Uuid::new_v4().as_u128();
    let mut encoded = [b'0'; BLOCK_ID_LENGTH];

    for slot in encoded.iter_mut().rev() {
        *slot = ALPHABET[(value % ALPHABET.len() as u128) as usize];
        value /= ALPHABET.len() as u128;
    }

    String::from_utf8(encoded.to_vec()).expect("block id alphabet is valid UTF-8")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generated_block_ids_are_short_lowercase_alphanumeric_values() {
        let first = new_block_id_candidate();
        let second = new_block_id_candidate();
        assert_eq!(first.len(), BLOCK_ID_LENGTH);
        assert!(first
            .chars()
            .all(|character| character.is_ascii_lowercase() || character.is_ascii_digit()));
        assert_ne!(first, second);
    }
}

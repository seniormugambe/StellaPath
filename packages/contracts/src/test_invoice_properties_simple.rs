//! Simple test to verify compilation

#[cfg(test)]
mod simple_test {
    #[test]
    fn test_simple() {
        assert_eq!(1 + 1, 2);
    }
}

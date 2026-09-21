use super::*;
use rodio::buffer::SamplesBuffer;

#[test]
fn vocal_gain_changes_without_restarting_or_changing_accompaniment() {
    let gain = Arc::new(AtomicU32::new(0.0f32.to_bits()));
    let mut mix = karaoke_mix::KaraokeMix {
        accompaniment: SamplesBuffer::new(1, 44100, vec![0.2; 4]),
        vocals: Some(SamplesBuffer::new(1, 44100, vec![0.4; 4])),
        gain: gain.clone(),
    };
    assert!((mix.next().unwrap() - 0.2).abs() < 0.001);
    gain.store(0.5f32.to_bits(), Ordering::Relaxed);
    assert!((mix.next().unwrap() - 0.4).abs() < 0.001);
    gain.store(1.0f32.to_bits(), Ordering::Relaxed);
    assert!((mix.next().unwrap() - 0.6).abs() < 0.001);
    gain.store(0.0f32.to_bits(), Ordering::Relaxed);
    assert!((mix.next().unwrap() - 0.2).abs() < 0.001);
    assert!(mix.next().is_none());
}

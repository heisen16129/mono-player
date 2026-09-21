use super::*;

pub(super) struct KaraokeMix<S> {
    pub accompaniment: S,
    pub vocals: Option<S>,
    pub gain: Arc<AtomicU32>,
}

impl<S: Source<Item = f32>> Iterator for KaraokeMix<S> {
    type Item = f32;
    fn next(&mut self) -> Option<f32> {
        let music = self.accompaniment.next()?;
        let vocal = self.vocals.as_mut().and_then(Iterator::next).unwrap_or(0.0);
        Some((music + vocal * f32::from_bits(self.gain.load(Ordering::Relaxed))).clamp(-1.0, 1.0))
    }
}

impl<S: Source<Item = f32>> Source for KaraokeMix<S> {
    fn current_span_len(&self) -> Option<usize> { self.accompaniment.current_span_len() }
    fn channels(&self) -> rodio::ChannelCount { self.accompaniment.channels() }
    fn sample_rate(&self) -> rodio::SampleRate { self.accompaniment.sample_rate() }
    fn total_duration(&self) -> Option<Duration> { self.accompaniment.total_duration() }
    fn try_seek(&mut self, position: Duration) -> Result<(), SeekError> {
        self.accompaniment.try_seek(position)?;
        if let Some(vocals) = &mut self.vocals { vocals.try_seek(position)?; }
        Ok(())
    }
}

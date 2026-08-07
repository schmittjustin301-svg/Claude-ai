// Reads live microphone loudness so the JARVIS orb can react to the voice.
//
// This opens a second getUserMedia stream alongside the one SpeechRecognition
// uses internally. That works on desktop but can be refused on some mobile
// browsers, so every failure path degrades to a synthetic pulse rather than
// breaking voice input itself.

export interface MicMeter {
  stop(): void;
}

export function startMicMeter(onLevel: (level: number) => void): Promise<MicMeter> {
  return (async () => {
    let stream: MediaStream | null = null;
    let audioCtx: AudioContext | null = null;
    let frame = 0;
    let stopped = false;

    const cleanup = () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((t) => t.stop());
      void audioCtx?.close().catch(() => {});
      onLevel(0);
    };

    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioCtor =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtx = new AudioCtor();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.75;
      source.connect(analyser);

      const buffer = new Uint8Array(analyser.frequencyBinCount);
      let smoothed = 0;

      const loop = () => {
        if (stopped) return;
        analyser.getByteTimeDomainData(buffer);
        // RMS around the 128 midpoint of the time-domain waveform.
        let sumSquares = 0;
        for (let i = 0; i < buffer.length; i++) {
          const deviation = (buffer[i] - 128) / 128;
          sumSquares += deviation * deviation;
        }
        const rms = Math.sqrt(sumSquares / buffer.length);
        // Speech sits well below full scale, so scale up and clamp.
        const level = Math.min(1, rms * 4);
        smoothed = smoothed * 0.7 + level * 0.3;
        onLevel(smoothed);
        frame = requestAnimationFrame(loop);
      };
      loop();

      return { stop: cleanup };
    } catch {
      // No mic meter available — animate a gentle synthetic pulse instead so
      // the orb still reads as "live" while listening.
      cleanup();
      stopped = false;
      const started = performance.now();
      const pulse = () => {
        if (stopped) return;
        const t = (performance.now() - started) / 1000;
        onLevel(0.25 + Math.sin(t * 3) * 0.15);
        frame = requestAnimationFrame(pulse);
      };
      pulse();
      return {
        stop: () => {
          stopped = true;
          cancelAnimationFrame(frame);
          onLevel(0);
        },
      };
    }
  })();
}

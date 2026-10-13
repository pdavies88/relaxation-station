"""Generates every audio file the app ships with. Nothing is downloaded at runtime.

    .tts/venv/bin/python audio-tools/generate_audio.py            # everything
    .tts/venv/bin/python audio-tools/generate_audio.py sounds     # soundscapes only
    .tts/venv/bin/python audio-tools/generate_audio.py meditations [id ...]
    .tts/venv/bin/python audio-tools/generate_audio.py sounds [id ...]

Soundscapes are synthesized from filtered noise and tones, and made to loop seamlessly.
Meditations are spoken by the Kokoro open-source voice model (Apache 2.0), timed to an exact
length, softened, and mixed over one of several background beds with a bell at the start and end. Output is AAC (.m4a),
encoded with macOS's built-in afconvert.

Setup (once): see audio-tools/README.md.
"""

from __future__ import annotations

import hashlib
import zlib
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy import signal

ROOT = Path(__file__).resolve().parent.parent
CATALOG = json.loads((ROOT / "content" / "catalog.json").read_text())
SCRIPTS = ROOT / "content" / "meditations.txt"
OUT_SOUNDS = ROOT / "assets" / "audio" / "sounds"
OUT_MEDITATIONS = ROOT / "assets" / "audio" / "meditations"
AUDIO_MAP = ROOT / "src" / "content" / "audio-files.ts"
TTS_DIR = ROOT / ".tts"
TTS_CACHE = TTS_DIR / "cache"

SR = 44100
# The narrator: Kokoro voice "Bella" (American English) at her natural speed, with a short silence
# between sentences in one line.
VOICE = "af_bella"
VOICE_LANG = "en-us"
VOICE_SPEED = 1.0
SENTENCE_GAP = 0.45


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def white(rng: np.random.Generator, n: int) -> np.ndarray:
    return rng.standard_normal(n)


def pink(rng: np.random.Generator, n: int) -> np.ndarray:
    # Paul Kellet's economy filter: white noise in, roughly 1/f noise out.
    b = [0.049922035, -0.095993537, 0.050612699, -0.004408786]
    a = [1, -2.494956002, 2.017265875, -0.522189400]
    return signal.lfilter(b, a, white(rng, n))


def brown(rng: np.random.Generator, n: int) -> np.ndarray:
    # Leaky integrator so the signal can't drift.
    out = signal.lfilter([1.0], [1.0, -0.997], white(rng, n))
    return highpass(out, 20)


def sos(kind: str, freq, order: int = 2):
    return signal.butter(order, freq, btype=kind, fs=SR, output="sos")


def lowpass(x, f, order=2):
    return signal.sosfilt(sos("lowpass", f, order), x)


def highpass(x, f, order=2):
    return signal.sosfilt(sos("highpass", f, order), x)


def bandpass(x, lo, hi, order=2):
    return signal.sosfilt(sos("bandpass", [lo, hi], order), x)


def smooth_noise(rng, n: int, rate_hz: float) -> np.ndarray:
    """Slowly varying random curve in roughly 0..1, for gusts and swells."""
    points = max(4, int(n / SR * rate_hz) + 4)
    knots = rng.random(points)
    x = np.linspace(0, points - 3, n)
    return np.interp(x, np.arange(points), knots)


def envelope(n: int, attack: float, decay: float) -> np.ndarray:
    t = np.arange(n) / SR
    env = np.minimum(1.0, t / max(attack, 1e-4)) * np.exp(-np.maximum(0, t - attack) / max(decay, 1e-4))
    return env


def place(dst: np.ndarray, src: np.ndarray, start: int) -> None:
    end = min(len(dst), start + len(src))
    if start < len(dst):
        dst[start:end] += src[: end - start]


def place_wrap(dst: np.ndarray, src: np.ndarray, start: int) -> None:
    """Adds src into dst, wrapping anything past the end back to the start (for seamless loops)."""
    n = len(dst)
    idx = (start + np.arange(len(src))) % n
    np.add.at(dst, idx, src)


def circular_reverb(x: np.ndarray, rng, seconds: float = 2.5, wet: float = 0.35) -> np.ndarray:
    """A simple room reverb (decaying noise impulse) applied as a circular convolution, so the
    reverb tail at the end of a loop rings into its start instead of being cut off."""
    n = len(x)
    length = int(SR * seconds)
    ir = rng.standard_normal(length) * np.exp(-np.arange(length) / (SR * seconds / 6))
    ir = lowpass(ir, 5000)
    ir /= np.sqrt(np.sum(ir ** 2)) + 1e-12
    kernel = np.zeros(n)
    kernel[:length] = ir
    tail = np.real(np.fft.irfft(np.fft.rfft(x) * np.fft.rfft(kernel), n))
    return (1 - wet) * x + wet * tail


def stereo(rng, mono_fn, n: int, width: float = 0.5) -> np.ndarray:
    """Builds a stereo pair from a shared signal plus independent signals per side."""
    common = mono_fn(rng, n)
    left = (1 - width) * common + width * mono_fn(rng, n)
    right = (1 - width) * common + width * mono_fn(rng, n)
    return np.stack([left, right], axis=1)


def normalize(x: np.ndarray, rms_db: float = -20.0, peak_db: float = -1.5) -> np.ndarray:
    """Sets the average level, then softly limits peaks so spiky sounds (rain) aren't quieter."""
    limit = 10 ** (peak_db / 20)
    for _ in range(3):
        rms = np.sqrt(np.mean(x ** 2)) + 1e-12
        x = x * (10 ** (rms_db / 20) / rms)
        x = limit * np.tanh(x / limit)
    return x


def make_loop(x: np.ndarray, loop_samples: int) -> np.ndarray:
    """Turns a signal longer than the loop into a seamless loop.

    The extra audio after the loop point is crossfaded into the start, so the last sample
    flows directly into the first one when the file repeats.
    """
    fade = len(x) - loop_samples
    assert fade > 0
    out = x[:loop_samples].copy()
    t = np.linspace(0, np.pi / 2, fade)
    fade_in, fade_out = np.sin(t), np.cos(t)
    if x.ndim == 2:
        fade_in, fade_out = fade_in[:, None], fade_out[:, None]
    out[:fade] = x[:fade] * fade_in + x[loop_samples:] * fade_out
    return out


def encode(wav: np.ndarray, out_path: Path, bitrate: int) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(suffix=".wav") as tmp:
        sf.write(tmp.name, wav.astype(np.float32), SR, subtype="PCM_16")
        subprocess.run(
            ["afconvert", "-f", "m4af", "-d", "aac", "-b", str(bitrate), tmp.name, str(out_path)],
            check=True,
        )
    print(f"  wrote {out_path.relative_to(ROOT)} ({out_path.stat().st_size / 1e6:.1f} MB)")


# ---------------------------------------------------------------------------
# Soundscapes
# ---------------------------------------------------------------------------

LOOP_SECONDS = 120
CROSSFADE_SECONDS = 6


def droplets(rng, n, per_second, lo, hi, decay_ms, gain=1.0):
    impulses = np.zeros(n)
    count = int(n / SR * per_second)
    idx = rng.integers(0, n, count)
    impulses[idx] = rng.random(count) ** 3 * gain
    rung = bandpass(impulses, lo, hi, order=2)
    kernel = np.exp(-np.arange(int(SR * decay_ms / 1000)) / (SR * decay_ms / 4000))
    return signal.fftconvolve(rung, kernel)[:n]


def sound_rain(rng, n):
    """Light rain: a soft, low hiss with a few rounded drops, and no sharp high end."""
    def mono(r, k):
        hiss = lowpass(bandpass(pink(r, k), 250, 2500), 2000)
        drops = droplets(r, k, 40, 700, 2200, 22, gain=2.0)
        swell = 0.85 + 0.15 * smooth_noise(r, k, 0.08)
        return (hiss + 0.3 * drops) * swell
    return stereo(rng, mono, n, 0.7)


def sound_ocean(rng, n):
    """Low, rolling surf. Kept below about 1.5 kHz so there is no hiss; the wash of each wave
    is a gentle mid-range swell rather than bright noise."""
    swell = np.zeros(n)
    t = 0.0
    while t < n / SR:
        period = rng.uniform(8, 12)
        length = int(SR * period * 1.4)
        wave = envelope(length, period * 0.35, period * 0.35) * rng.uniform(0.6, 1.0)
        place(swell, wave, int(t * SR))
        t += period
    swell = 0.25 + swell / swell.max()
    wash = np.maximum(0, np.gradient(signal.savgol_filter(swell, 2001, 2))) * SR
    wash = lowpass(wash / (wash.max() + 1e-9), 3)

    def side(r):
        body = lowpass(brown(r, n) / 20 + 0.5 * pink(r, n), 700, order=4)
        surf = bandpass(pink(r, n), 250, 1400, order=2)
        return body * swell + 0.45 * surf * (0.3 * swell + wash)

    left, right = side(rng), side(rng)
    pan = 0.5 + 0.15 * np.sin(2 * np.pi * np.arange(n) / SR / 23)
    return np.stack([left * (1 - pan) + right * pan * 0.5, right * pan + left * (1 - pan) * 0.5], axis=1)


NOTE = {name: 440.0 * 2 ** ((midi - 69) / 12) for name, midi in {
    "C3": 48, "F3": 53, "G3": 55, "A3": 57, "C4": 60, "D4": 62, "E4": 64, "F4": 65,
    "G4": 67, "A4": 69, "B4": 71, "C5": 72,
}.items()}

# Brahms' Lullaby (Wiegenlied, 1868, public domain), simplified, in C major. (note, beats)
LULLABY_MELODY = [
    ("E4", 1), ("E4", 1), ("G4", 4), ("E4", 1), ("E4", 1), ("G4", 4),
    ("E4", 1), ("G4", 1), ("C5", 2), ("B4", 1), ("A4", 2), ("A4", 1), ("G4", 3),
    ("D4", 1), ("E4", 1), ("F4", 2), ("D4", 1), ("D4", 1), ("E4", 1), ("F4", 3),
    ("D4", 1), ("F4", 1), ("B4", 1), ("A4", 1), ("G4", 2), ("B4", 1), ("C5", 3),
    ("C4", 1), ("C4", 1), ("C5", 4), ("A4", 1), ("F4", 1), ("G4", 4),
    ("E4", 1), ("C4", 1), ("F4", 1), ("G4", 1), ("A4", 2), ("G4", 4),
    ("C4", 1), ("C4", 1), ("C5", 4), ("A4", 1), ("F4", 1), ("G4", 4),
    ("E4", 1), ("C4", 1), ("F4", 1), ("E4", 1), ("D4", 1), ("C4", 6),
]
# One bass note per phrase, roughly following the harmony.
LULLABY_BASS = ["C3", "C3", "C3", "G3", "G3", "C3", "F3", "C3", "F3", "G3", "C3"]


def music_box(freq: float, seconds: float = 3.5) -> np.ndarray:
    n = int(SR * seconds)
    t = np.arange(n) / SR
    tone = (
        np.sin(2 * np.pi * freq * t) * np.exp(-t / 1.1)
        + 0.35 * np.sin(2 * np.pi * freq * 2.0 * t) * np.exp(-t / 0.5)
        + 0.12 * np.sin(2 * np.pi * freq * 3.98 * t) * np.exp(-t / 0.2)
    )
    return tone * np.minimum(1, t / 0.003)


def soft_bass(freq: float, seconds: float) -> np.ndarray:
    n = int(SR * seconds)
    t = np.arange(n) / SR
    tone = np.sin(2 * np.pi * freq * t) + 0.2 * np.sin(2 * np.pi * 2 * freq * t)
    return tone * envelope(n, 0.4, seconds / 2.5)


LULLABY_BPM = 75


def sound_lullaby(rng, n):
    """Brahms' Lullaby on a music box over a warm bass, laid out as an exact circle.

    The loop is two full passes at a slow 75 BPM (about 2 minutes 20 seconds), so its length
    comes from the music rather than from `n`."""
    beats = sum(b for _, b in LULLABY_MELODY)
    repeats = 2
    beat = 60 / LULLABY_BPM
    n = int(round(beats * repeats * beat * SR))
    melody = np.zeros(n)
    bass = np.zeros(n)
    cursor = 0.0
    for rep in range(repeats):
        phrase = 0
        beat_in_phrase = 0.0
        place_wrap(bass, soft_bass(NOTE[LULLABY_BASS[0]], beat * 8), int(cursor * SR))
        for index, (name, length) in enumerate(LULLABY_MELODY):
            gain = 0.75 + 0.25 * rng.random()
            # Tiny timing variation so it doesn't sound mechanical.
            jitter = rng.uniform(-0.012, 0.012)
            place_wrap(melody, music_box(NOTE[name]) * gain, int((cursor + jitter) * SR) % n)
            cursor += length * beat
            beat_in_phrase += length
            if beat_in_phrase >= 9 and index < len(LULLABY_MELODY) - 1:
                phrase += 1
                beat_in_phrase = 0.0
                root = LULLABY_BASS[min(phrase, len(LULLABY_BASS) - 1)]
                place_wrap(bass, soft_bass(NOTE[root], beat * 8), int(cursor * SR) % n)
    mix = melody / np.max(np.abs(melody)) + 0.35 * bass / np.max(np.abs(bass))
    left = circular_reverb(mix, rng, 2.8, 0.4)
    right = circular_reverb(mix, rng, 2.8, 0.4)
    return np.stack([left, right], axis=1)


def sound_fire(rng, n):
    def mono(r, k):
        roar = lowpass(brown(r, k), 350) * (0.8 + 0.2 * smooth_noise(r, k, 0.3))
        roar = roar / (np.sqrt(np.mean(roar ** 2)) + 1e-9)
        crackle = np.zeros(k)
        for start in r.integers(0, k, int(k / SR * 9)):
            burst = r.integers(1, 6)
            for j in range(burst):
                length = int(SR * r.uniform(0.003, 0.012))
                click = white(r, length) * np.exp(-np.arange(length) / (length / 4))
                place(crackle, click * r.uniform(0.3, 1.0), int(start + j * SR * r.uniform(0.005, 0.04)))
        pops = np.zeros(k)
        for start in r.integers(0, k, int(k / SR * 0.6)):
            length = int(SR * 0.05)
            pop = white(r, length) * np.exp(-np.arange(length) / (length / 6))
            place(pops, pop * 3, int(start))
        return 0.9 * roar + 0.35 * bandpass(crackle, 900, 5000) + 0.5 * bandpass(pops, 250, 3000)
    return stereo(rng, mono, n, 0.5)


def sound_fan(rng, n):
    def mono(r, k):
        air = lowpass(0.5 * pink(r, k) + brown(r, k) / 25, 1800)
        return air
    out = stereo(rng, mono, n, 0.3)
    t = np.arange(n) / SR
    hum = 0.02 * np.sin(2 * np.pi * 59.7 * t) + 0.01 * np.sin(2 * np.pi * 119.4 * t)
    blade = 1 + 0.03 * np.sin(2 * np.pi * 11.5 * t)
    out = out / (np.sqrt(np.mean(out ** 2)) + 1e-9) * 0.1
    return out * blade[:, None] + hum[:, None]


def sound_brown_noise(rng, n):
    return stereo(rng, lambda r, k: lowpass(brown(r, k), 900), n, 0.6)


def drone(n: int, seconds_per_cycle: float, rng=None) -> np.ndarray:
    """Warm drifting chord in A major. LFO rates are whole cycles per loop, so it loops cleanly."""
    t = np.arange(n) / SR
    length = n / SR
    # Round each pitch to a whole number of cycles per file, so the end joins the start cleanly.
    notes = [round(f * length) / length for f in (110.0, 164.81, 220.0, 277.18, 329.63, 440.0)]
    left = np.zeros(n)
    right = np.zeros(n)
    for i, f in enumerate(notes):
        cycles = 1 + (i * 3) % 5
        lfo = 0.55 + 0.45 * np.sin(2 * np.pi * cycles * t / seconds_per_cycle + i)
        amp = 1.0 / (1 + i * 0.6)
        for detune, side in ((-36 / length, left), (36 / length, right)):
            tone = np.sin(2 * np.pi * (f + detune) * t) + 0.25 * np.sin(2 * np.pi * 2 * (f + detune) * t)
            side += tone * lfo * amp
    # Filter the signal as a circle (run through it twice, keep the second pass) so the filter's
    # start-up doesn't create a click where the file loops.
    def circular_lowpass(x):
        return lowpass(np.concatenate([x, x]), 1500)[n:]

    return np.stack([circular_lowpass(left), circular_lowpass(right)], axis=1)


PENTATONIC = [293.66, 329.63, 369.99, 440.0, 493.88, 587.33, 659.25, 739.99, 880.0]  # D major pentatonic


def chime(freq: float, seconds: float = 5.0) -> np.ndarray:
    n = int(SR * seconds)
    t = np.arange(n) / SR
    tone = np.zeros(n)
    for ratio, amp, decay in ((1.0, 1.0, 2.2), (2.76, 0.35, 1.0), (5.4, 0.12, 0.45)):
        tone += amp * np.sin(2 * np.pi * freq * ratio * t) * np.exp(-t / decay)
    return tone * np.minimum(1, t / 0.004)


def sound_bells(rng, n):
    """Slow, sparse wind chimes and the occasional low singing bowl, with a long soft reverb."""
    left = np.zeros(n)
    right = np.zeros(n)
    t = 0.0
    while t < n / SR:
        freq = PENTATONIC[rng.integers(len(PENTATONIC))]
        strike = chime(freq) * rng.uniform(0.35, 0.8)
        pan = rng.uniform(0.2, 0.8)
        place_wrap(left, strike * (1 - pan), int(t * SR))
        place_wrap(right, strike * pan, int(t * SR))
        t += rng.uniform(1.4, 4.5)
    for start in np.arange(0, n / SR, 20.0):
        bowl = bell(14.0, rng.choice([146.83, 196.0])) * 0.55
        offset = int((start + rng.uniform(0, 6)) * SR)
        place_wrap(left, bowl, offset)
        place_wrap(right, bowl, offset)
    left = circular_reverb(left, rng, 3.5, 0.45)
    right = circular_reverb(right, rng, 3.5, 0.45)
    return np.stack([left, right], axis=1)


def circular_filter(x: np.ndarray, fn) -> np.ndarray:
    """Runs a filter over the signal twice and keeps the second pass, so a looping file has no
    click where the end joins the start."""
    n = len(x)
    return fn(np.concatenate([x, x]))[n:]


def loop_curve(n: int, cycles: list[tuple[int, float]], phase: float = 0.0) -> np.ndarray:
    """A slow 0..1 curve made of sine waves with whole cycles per file, so it loops cleanly."""
    t = np.arange(n) / n
    curve = sum(weight * np.sin(2 * np.pi * count * t + phase * count) for count, weight in cycles)
    total = sum(weight for _, weight in cycles)
    return 0.5 + 0.5 * curve / total


CHIME_NOTES = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5]  # C major pentatonic, like a tuned chime set


def wind_chime(freq: float, seconds: float = 7.0) -> np.ndarray:
    """One metal tube: the inharmonic partials of a free bar, a light strike and a long ring."""
    n = int(SR * seconds)
    t = np.arange(n) / SR
    tone = np.zeros(n)
    for ratio, amp, decay in ((1.0, 1.0, 3.2), (2.76, 0.4, 1.5), (5.40, 0.15, 0.7), (8.93, 0.05, 0.3)):
        shimmer = 1 + 0.03 * np.sin(2 * np.pi * 4.5 * t * ratio)
        tone += amp * np.sin(2 * np.pi * freq * ratio * t) * np.exp(-t / decay) * shimmer
    return tone * np.minimum(1, t / 0.002)


def sound_chimes(rng, n):
    """Wind chimes on a gentle breeze. The breeze rises and falls, and the chimes ring in small
    clusters when it gusts. Built as an exact circle, so it loops without a crossfade."""
    gust = loop_curve(n, [(3, 1.0), (7, 0.5), (11, 0.25)], phase=rng.uniform(0, 6))
    breeze = stereo(rng, lambda r, k: pink(r, k), n, 0.6)
    for side in range(2):
        breeze[:, side] = circular_filter(breeze[:, side], lambda x: bandpass(x, 150, 1100))
    breeze = breeze / (np.sqrt(np.mean(breeze ** 2)) + 1e-9) * 0.03 * (0.4 + 0.6 * gust)[:, None]

    left = np.zeros(n)
    right = np.zeros(n)
    t = rng.uniform(0, 2)
    while t < n / SR:
        strength = gust[int(t * SR) % n]
        for _ in range(int(rng.integers(1, 2 + int(4 * strength)))):
            note = wind_chime(CHIME_NOTES[rng.integers(len(CHIME_NOTES))]) * rng.uniform(0.25, 0.6 + 0.4 * strength)
            pan = rng.uniform(0.25, 0.75)
            place_wrap(left, note * (1 - pan), int(t * SR) % n)
            place_wrap(right, note * pan, int(t * SR) % n)
            t += rng.uniform(0.12, 0.5)
        t += rng.uniform(1.5, 6.0) * (1.3 - strength)
    left = circular_reverb(left, rng, 2.5, 0.35)
    right = circular_reverb(right, rng, 2.5, 0.35)
    chimes = np.stack([left, right], axis=1)
    chimes = chimes / (np.max(np.abs(chimes)) + 1e-9)
    return chimes + breeze


HEART_BPM = 60


def heart_thump(freq: float, decay: float) -> np.ndarray:
    """One heart sound: a low, quickly falling thud."""
    n = int(SR * 0.4)
    t = np.arange(n) / SR
    pitch = freq * (1 + 0.6 * np.exp(-t / 0.02))
    phase = 2 * np.pi * np.cumsum(pitch) / SR
    tone = np.sin(phase) + 0.45 * np.sin(2 * phase) + 0.15 * np.sin(3 * phase)
    return tone * np.minimum(1, t / 0.004) * np.exp(-t / decay)


def sound_heartbeat(rng, n):
    """A slow, steady heartbeat at 60 BPM, as heard from inside: a deep "lub", a softer "dub",
    and a warm whoosh that swells with each beat. The loop holds a whole number of beats."""
    beat = 60 / HEART_BPM
    beats = int(round(n / SR / beat))
    n = int(round(beats * beat * SR))
    pulse = np.zeros(n)
    for i in range(beats):
        start = i * beat + rng.uniform(-0.008, 0.008)
        gain = rng.uniform(0.9, 1.0)
        place_wrap(pulse, heart_thump(58, 0.07) * gain, int(start * SR) % n)
        place_wrap(pulse, heart_thump(72, 0.05) * 0.6 * gain, int((start + 0.3) * SR) % n)
    pulse = circular_filter(pulse, lambda x: lowpass(x, 400))
    pulse = pulse / (np.max(np.abs(pulse)) + 1e-9)

    t = np.arange(n) / SR
    swell = 0.55 + 0.45 * np.cos(2 * np.pi * (t - 0.1) / beat) ** 2
    whoosh = circular_filter(brown(rng, n), lambda x: lowpass(x, 300))
    whoosh = whoosh / (np.sqrt(np.mean(whoosh ** 2)) + 1e-9) * 0.08 * swell
    mono = pulse + whoosh
    return np.stack([mono, mono], axis=1)


def note_freq(name: str) -> float:
    """Converts a note name such as "C4" or "F#3" to its frequency in Hz."""
    steps = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
    semitone = steps[name[0]] + (1 if "#" in name else 0)
    octave = int(name[-1])
    return 440.0 * 2 ** ((12 * (octave + 1) + semitone - 69) / 12)


def guitar_pluck(freq: float, seconds: float = 4.0, pluck_point: float = 0.2) -> np.ndarray:
    """A nylon-string pluck: harmonics shaped by where the string is plucked, with the higher
    harmonics fading faster, plus a slight string stiffness."""
    n = int(SR * seconds)
    t = np.arange(n) / SR
    tone = np.zeros(n)
    for k in range(1, 24):
        f = k * freq * np.sqrt(1 + 0.00008 * k * k)
        if f > 7000:
            break
        amp = abs(np.sin(np.pi * k * pluck_point)) / k ** 1.4
        decay = 2.8 / (1 + 0.35 * (k - 1))
        tone += amp * np.sin(2 * np.pi * f * t) * np.exp(-t / decay)
    return tone * np.minimum(1, t / 0.003) / (np.max(np.abs(tone)) + 1e-9)


# Fingerpicked chords in 3/4: bass, then the three upper notes up and back down.
GUITAR_CHORDS = {
    "C": ["C3", "G3", "C4", "E4"],
    "Am": ["A2", "E3", "A3", "C4"],
    "F": ["F2", "C3", "F3", "A3"],
    "G": ["G2", "D3", "G3", "B3"],
    "Em": ["E2", "B2", "E3", "G3"],
}
# One bar each: the chord, then two melody notes on beats 1 and 3. An original tune.
GUITAR_TUNE = [
    ("C", "E5", "G4"), ("Am", "C5", "E5"), ("F", "A4", "C5"), ("G", "B4", "D5"),
    ("C", "C5", "E5"), ("Em", "B4", "G4"), ("F", "A4", "F4"), ("G", "G4", "B4"),
    ("Am", "A4", "C5"), ("Em", "G4", "B4"), ("F", "F4", "A4"), ("C", "E4", "G4"),
    ("F", "A4", "C5"), ("G", "B4", "D5"), ("C", "C5", "G4"), ("C", "E4", "C4"),
]
GUITAR_BPM = 66


def sound_guitar(rng, n):
    """A soft fingerpicked guitar lullaby in 3/4, played three times through, laid out as an exact
    circle. The loop length comes from the music rather than from `n`."""
    eighth = 60 / GUITAR_BPM / 2
    repeats = 3
    n = int(round(len(GUITAR_TUNE) * 6 * eighth * repeats * SR))
    left = np.zeros(n)
    right = np.zeros(n)
    pattern = [0, 1, 2, 3, 2, 1]
    bar_start = 0.0
    for _ in range(repeats):
        for chord, first, second in GUITAR_TUNE:
            notes = GUITAR_CHORDS[chord]
            for step, string in enumerate(pattern):
                at = bar_start + step * eighth + rng.uniform(-0.01, 0.01)
                gain = (0.55 if string == 0 else 0.32) * rng.uniform(0.85, 1.0)
                pluck = guitar_pluck(note_freq(notes[string]), pluck_point=0.22) * gain
                pan = 0.4 + 0.06 * string
                place_wrap(left, pluck * (1 - pan), int(at * SR) % n)
                place_wrap(right, pluck * pan, int(at * SR) % n)
            for beat_eighth, name in ((0, first), (4, second)):
                at = bar_start + beat_eighth * eighth + 0.02 + rng.uniform(-0.01, 0.01)
                pluck = guitar_pluck(note_freq(name), 5.0, pluck_point=0.15) * 0.6 * rng.uniform(0.9, 1.0)
                place_wrap(left, pluck * 0.45, int(at * SR) % n)
                place_wrap(right, pluck * 0.55, int(at * SR) % n)
            bar_start += 6 * eighth
    left = circular_filter(left, lambda x: lowpass(x, 5000))
    right = circular_filter(right, lambda x: lowpass(x, 5000))
    left = circular_reverb(left, rng, 2.2, 0.3)
    right = circular_reverb(right, rng, 2.2, 0.3)
    return np.stack([left, right], axis=1)


def sound_car(rng, n):
    """A car ride: the deep rumble of tires on a highway, a soft engine hum, and now and then the
    gentle "ba-dum" of the wheels crossing a seam in the road. Kept dark and steady for naps."""
    t = np.arange(n) / SR

    def road(r, k):
        rumble = lowpass(brown(r, k), 180)
        rumble = rumble / (np.sqrt(np.mean(rumble ** 2)) + 1e-9)
        tires = bandpass(pink(r, k), 250, 1000)
        tires = tires / (np.sqrt(np.mean(tires ** 2)) + 1e-9)
        drift = 0.85 + 0.15 * smooth_noise(r, k, 0.05)
        return (rumble + 0.25 * tires) * drift

    out = stereo(rng, road, n, 0.4)
    out = out / (np.sqrt(np.mean(out ** 2)) + 1e-9)

    # Engine: a low hum whose pitch wanders a little, as the speed changes.
    wander = 1 + 0.02 * (smooth_noise(rng, n, 0.03) - 0.5)
    phase = 2 * np.pi * np.cumsum(55.0 * wander) / SR
    engine = np.sin(phase) + 0.5 * np.sin(2 * phase) + 0.2 * np.sin(3 * phase)
    out += 0.12 * engine[:, None]

    # Road seams: front wheels, then back wheels a moment later.
    bumps = np.zeros(n)
    length = int(SR * 0.18)
    bt = np.arange(length) / SR
    thump = np.sin(2 * np.pi * 70 * bt) * np.exp(-bt / 0.04) * np.minimum(1, bt / 0.004)
    at = rng.uniform(2, 6)
    while at < n / SR - 1:
        gain = rng.uniform(0.5, 1.0)
        place(bumps, thump * gain, int(at * SR))
        place(bumps, thump * gain * 0.8, int((at + rng.uniform(0.11, 0.14)) * SR))
        at += rng.uniform(5, 14)
    out += 0.6 * bumps[:, None]
    return np.stack([lowpass(out[:, 0], 1500), lowpass(out[:, 1], 1500)], axis=1)


SHUSH_PERIOD = 3.6  # seconds per "shhhh" and the breath in before the next one
SHUSH_SECONDS = 3.0


def shush_breath(rng, seconds: float) -> np.ndarray:
    """One long "shhhh". Real /sh/ is breath noise with a broad peak, here near 2.5 kHz for a soft,
    rounded-lip sound, and very little below 1 kHz. The peak drifts down a little as the breath runs out, and the loudness rises
    and falls slowly with a slight flutter, so it sounds like a person and not a rattle."""
    nper, hop = 2048, 512
    n = int(SR * seconds)
    frames = n // hop + 2
    f = np.fft.rfftfreq(nper, 1 / SR)
    t = np.arange(frames) * hop / SR
    peak = 2500 - 400 * np.clip(t / seconds, 0, 1)
    logf = np.log2(np.maximum(f, 20))[:, None]
    shape = np.exp(-0.5 * ((logf - np.log2(peak)[None, :]) / 0.55) ** 2)
    shape *= np.clip((f[:, None] - 650) / 1100, 0, 1)
    spectrum = shape * np.exp(2j * np.pi * rng.random(shape.shape))
    _, x = signal.istft(spectrum, SR, nperseg=nper, noverlap=nper - hop)
    x = np.real(x[:n])
    tt = np.arange(len(x)) / SR
    rise = 0.5 - 0.5 * np.cos(np.pi * np.clip(tt / 0.6, 0, 1))
    fall = 0.5 - 0.5 * np.cos(np.pi * np.clip((seconds - tt) / 1.2, 0, 1))
    flutter = 1 + 0.05 * np.sin(2 * np.pi * rng.uniform(4, 6) * tt + rng.uniform(0, 6))
    return x * rise * fall * flutter


def sound_shush(rng, n):
    """A soft, steady "shhhh... shhhh..." like a parent settling a child, over a faint low
    whoosh, with a little room echo. The loop holds a whole number of shushes."""
    count = int(round(n / SR / SHUSH_PERIOD))
    n = int(round(count * SHUSH_PERIOD * SR))
    voice = np.zeros(n)
    for i in range(count):
        breath = shush_breath(rng, SHUSH_SECONDS * rng.uniform(0.95, 1.0)) * rng.uniform(0.85, 1.0)
        place_wrap(voice, breath, int((i * SHUSH_PERIOD + rng.uniform(-0.05, 0.05)) * SR) % n)
    voice = voice / (np.sqrt(np.mean(voice ** 2)) + 1e-9)
    voice = circular_reverb(voice, rng, 0.5, 0.15)
    voice = voice / (np.sqrt(np.mean(voice ** 2)) + 1e-9)
    bed = circular_filter(pink(rng, n), lambda x: lowpass(x, 400))
    bed = bed / (np.sqrt(np.mean(bed ** 2)) + 1e-9)
    mono = voice + 0.12 * bed
    return np.stack([mono, mono], axis=1)


SOUNDS = {
    "rain": sound_rain,
    "chimes": sound_chimes,
    "ocean": sound_ocean,
    "lullaby": sound_lullaby,
    "heartbeat": sound_heartbeat,
    "fire": sound_fire,
    "guitar": sound_guitar,
    "fan": sound_fan,
    "brown-noise": sound_brown_noise,
    "bells": sound_bells,
    "car": sound_car,
    "shush": sound_shush,
}

# Sounds built as exact circles (no crossfade needed): their notes and reverb wrap around.
CIRCULAR_SOUNDS = {"lullaby", "bells", "chimes", "heartbeat", "guitar", "shush"}

# Per-sound loudness, so the set feels consistent when switching between them.
SOUND_LEVEL_DB = {"rain": -29, "lullaby": -23, "bells": -24, "chimes": -25, "heartbeat": -22, "guitar": -23, "fan": -21, "car": -26, "shush": -29}


def generate_sounds(only: list[str]) -> None:
    print("Soundscapes")
    loop = SR * LOOP_SECONDS
    for index, item in enumerate(CATALOG["soundscapes"]):
        sid = item["id"]
        if only and sid not in only:
            continue
        rng = np.random.default_rng(1000 + index)
        if sid in CIRCULAR_SOUNDS:
            audio = SOUNDS[sid](rng, loop)
        else:
            audio = make_loop(SOUNDS[sid](rng, loop + SR * CROSSFADE_SECONDS), loop)
        audio = normalize(audio, SOUND_LEVEL_DB.get(sid, -20))
        encode(audio, OUT_SOUNDS / f"{sid}.m4a", 128000)


# ---------------------------------------------------------------------------
# Meditations
# ---------------------------------------------------------------------------

LEAD_IN = 5.0   # bell, then the voice begins
TAIL = 12.0     # closing bell and fade out
FLEX_MIN = 0.6  # shortest pause between lines
LONG_PAUSE = 8.0  # timed pauses this long are silent practice time, and can shrink to make a script fit
LONG_PAUSE_MIN_SCALE = 0.4  # ...down to 40%. Shorter timed pauses, such as a count of four, never change.


def parse_scripts() -> dict[str, tuple[str, list[tuple[str, object]]]]:
    """Reads content/meditations.txt into {id: (background bed, [(kind, value), ...])}."""
    scripts: dict[str, tuple[str, list[tuple[str, object]]]] = {}
    items: list[tuple[str, object]] = []
    for raw in SCRIPTS.read_text().splitlines():
        line = raw.strip()
        if not line or (line.startswith("#") and not line.startswith("##")):
            continue
        if line.startswith("## "):
            parts = line[3:].split()
            mid, bed = parts[0], (parts[1] if len(parts) > 1 else "warm")
            if bed not in BEDS:
                raise SystemExit(f"{mid}: unknown background bed {bed!r}. Use one of: {', '.join(BEDS)}")
            items = []
            scripts[mid] = (bed, items)
        elif line == "~":
            items.append(("flex", 3.0))
        elif re.fullmatch(r"\[\d+(\.\d+)?\]", line):
            items.append(("fixed", float(line[1:-1])))
        else:
            items.append(("say", line))
            items.append(("flex", 1.0))
    return scripts


_kokoro = None


def speak(text: str) -> np.ndarray:
    """Speaks one line, sentence by sentence, with a short pause between sentences."""
    sentences = [part for part in re.split(r"(?<=[.!?])\s+", text.strip()) if part]
    gap = np.zeros(int(SR * SENTENCE_GAP))
    pieces: list[np.ndarray] = []
    for index, sentence in enumerate(sentences):
        if index:
            pieces.append(gap)
        pieces.append(speak_sentence(sentence))
    return np.concatenate(pieces)


def speak_sentence(text: str) -> np.ndarray:
    """Speaks one sentence with Kokoro, resampled to 44.1 kHz. Results are cached by voice and text."""
    global _kokoro
    key = hashlib.sha1(f"{VOICE}|{VOICE_SPEED}|{text}".encode()).hexdigest()
    cached = TTS_CACHE / f"{key}.npy"
    if cached.exists():
        return np.load(cached)
    if _kokoro is None:
        from kokoro_onnx import Kokoro

        _kokoro = Kokoro(str(TTS_DIR / "kokoro-v1.0.onnx"), str(TTS_DIR / "voices-v1.0.bin"))
    samples, rate = _kokoro.create(text, voice=VOICE, speed=VOICE_SPEED, lang=VOICE_LANG)
    audio = signal.resample_poly(np.asarray(samples, dtype=np.float64), SR, rate)
    # Trim the model's leading and trailing silence so pauses are under our control.
    loud = np.flatnonzero(np.abs(audio) > 0.01)
    if len(loud):
        audio = audio[max(0, loud[0] - int(0.03 * SR)) : loud[-1] + int(0.08 * SR)]
    TTS_CACHE.mkdir(parents=True, exist_ok=True)
    np.save(cached, audio)
    return audio


def bell(seconds: float = 9.0, base: float = 196.0) -> np.ndarray:
    """A soft singing-bowl strike: inharmonic partials with a slow beat and long decay."""
    n = int(SR * seconds)
    t = np.arange(n) / SR
    tone = np.zeros(n)
    for ratio, amp, decay in ((1.0, 1.0, 3.2), (2.71, 0.5, 2.2), (5.2, 0.25, 1.4), (8.4, 0.1, 0.8)):
        f = base * ratio
        beat = 0.8 + 0.2 * np.cos(2 * np.pi * 0.9 * ratio * t)
        tone += amp * np.sin(2 * np.pi * f * t) * np.exp(-t / decay) * beat
    attack = np.minimum(1, t / 0.008)
    return tone * attack / np.max(np.abs(tone))


def reverb(x: np.ndarray, rng, seconds: float, wet: float) -> np.ndarray:
    """A soft room or hall: the signal convolved with a decaying noise burst. Not looped."""
    length = int(SR * seconds)
    ir = rng.standard_normal(length) * np.exp(-np.arange(length) / (SR * seconds / 5))
    ir /= np.sqrt(np.sum(ir ** 2)) + 1e-9
    return (1 - wet) * x + wet * signal.fftconvolve(x, ir)[: len(x)]


def bed_warm(rng, n):
    """A warm, slowly drifting chord in A major."""
    return drone(n, n / SR).mean(axis=1)


def bed_air(rng, n):
    """An open, airy chord in D with a soft breath of wind moving through it."""
    t = np.arange(n) / SR
    out = np.zeros(n)
    for i, f in enumerate((146.83, 220.0, 293.66, 369.99, 440.0, 587.33)):
        swell = 0.5 + 0.5 * np.sin(2 * np.pi * t / rng.uniform(18, 40) + rng.uniform(0, 6))
        tone = np.sin(2 * np.pi * (f - 0.25) * t) + np.sin(2 * np.pi * (f + 0.25) * t)
        out += tone * swell / (1 + 0.5 * i)
    out /= np.sqrt(np.mean(out ** 2)) + 1e-9
    breath = bandpass(pink(rng, n), 400, 2500) * (0.3 + 0.7 * smooth_noise(rng, n, 0.04))
    breath /= np.sqrt(np.mean(breath ** 2)) + 1e-9
    return lowpass(out + 0.3 * breath, 3000)


def bed_ocean(rng, n):
    """Distant, slow waves on a far-off shore."""
    return lowpass(sound_ocean(rng, n).mean(axis=1), 1000)


def piano_note(freq: float, seconds: float = 7.0) -> np.ndarray:
    """A soft felt piano note: two slightly detuned strings, upper partials fading first."""
    n = int(SR * seconds)
    t = np.arange(n) / SR
    tone = np.zeros(n)
    for k in range(1, 9):
        f = k * freq * np.sqrt(1 + 0.0004 * k * k)
        decay = 3.2 / (1 + 0.6 * (k - 1))
        for detune in (-0.3, 0.3):
            tone += np.sin(2 * np.pi * (f + detune) * t) * np.exp(-t / decay) / k ** 1.6
    return tone * np.minimum(1, t / 0.006) / (np.max(np.abs(tone)) + 1e-9)


PIANO_NOTES = [146.83, 164.81, 185.0, 220.0, 246.94, 293.66, 329.63, 369.99, 440.0]  # D major pentatonic


def bed_piano(rng, n):
    """Sparse, unhurried piano notes over a faint low hum, with a little hall."""
    out = np.zeros(n)
    at = rng.uniform(1, 3)
    while at < n / SR:
        index = int(rng.integers(len(PIANO_NOTES)))
        gain = rng.uniform(0.4, 0.8)
        place(out, piano_note(PIANO_NOTES[index]) * gain, int(at * SR))
        if rng.random() < 0.25:
            other = PIANO_NOTES[min(index + 2, len(PIANO_NOTES) - 1)]
            place(out, piano_note(other) * gain * 0.7, int((at + rng.uniform(0.25, 0.5)) * SR))
        at += rng.uniform(3.5, 7.0)
    t = np.arange(n) / SR
    hum = np.sin(2 * np.pi * 73.42 * t) + 0.5 * np.sin(2 * np.pi * 110.0 * t)
    out = out / (np.sqrt(np.mean(out ** 2)) + 1e-9) + 0.15 * hum
    return reverb(out, rng, 2.5, 0.35)


def bed_bowls(rng, n):
    """Singing bowls struck now and then, ringing out over a soft low hum."""
    out = np.zeros(n)
    at = rng.uniform(1, 4)
    while at < n / SR:
        base = float(rng.choice([146.83, 196.0, 220.0, 293.66]))
        place(out, bell(14.0, base) * rng.uniform(0.6, 1.0), int(at * SR))
        at += rng.uniform(14, 22)
    t = np.arange(n) / SR
    hum = (np.sin(2 * np.pi * 98.0 * t) + 0.6 * np.sin(2 * np.pi * 147.0 * t)) * (0.7 + 0.3 * np.sin(2 * np.pi * 0.05 * t))
    out = out / (np.sqrt(np.mean(out ** 2)) + 1e-9) + 0.2 * hum
    return reverb(out, rng, 3.0, 0.25)


# Background beds a meditation can use. Each script names one in content/meditations.txt, so a
# listener hears a different bed from one session to the next.
BEDS = {"warm": bed_warm, "air": bed_air, "ocean": bed_ocean, "piano": bed_piano, "bowls": bed_bowls}
BED_LEVEL_DB = -27  # loud enough to hear in the pauses
BED_DUCK = 0.4  # the bed dips by this much (about 4 dB) while Bella speaks


def soften_voice(voice: np.ndarray, rng) -> np.ndarray:
    """Takes the edge off the voice for a quiet, close sound: less high-end hiss and sibilance,
    and a touch of soft room around it."""
    voice = voice - 0.35 * highpass(voice, 5000)
    return reverb(voice, rng, 0.9, 0.12)


def build_meditation(mid: str, minutes: int, bed: str, items: list[tuple[str, object]]) -> np.ndarray:
    total = int(SR * minutes * 60)
    clips = [(kind, speak(value) if kind == "say" else value) for kind, value in items]
    # Drop the flexible pause after the very last line; the tail covers it.
    while clips and clips[-1][0] == "flex":
        clips.pop()

    speech = sum(len(c) for k, c in clips if k == "say") / SR
    fixed = sum(c for k, c in clips if k == "fixed")
    long_fixed = sum(c for k, c in clips if k == "fixed" and c >= LONG_PAUSE)
    weights = sum(c for k, c in clips if k == "flex")
    budget = minutes * 60 - LEAD_IN - TAIL - speech
    # Pauses give way before lines do. First the flexible pauses shrink, down to FLEX_MIN for the
    # shortest one. If that is not enough, the long timed pauses shrink too.
    min_weight = min((c for k, c in clips if k == "flex"), default=1.0)
    flex_floor = weights * FLEX_MIN / min_weight
    long_scale = 1.0
    if long_fixed and budget - fixed < flex_floor:
        long_scale = max(LONG_PAUSE_MIN_SCALE, 1 - (flex_floor - (budget - fixed)) / long_fixed)
    available = budget - fixed + long_fixed * (1 - long_scale)
    unit = available / weights if weights else 0
    min_flex = min_weight * unit
    print(
        f"  {mid} ({bed}): speech {speech:.0f}s of {minutes * 60}s, shortest pause {min_flex:.1f}s,"
        f" long pauses at {long_scale:.0%}"
    )
    if min_flex < FLEX_MIN - 1e-6:
        raise SystemExit(f"{mid}: script is too long for {minutes} minutes, even with the shortest pauses.")

    voice = np.zeros(total)
    cursor = LEAD_IN
    for kind, clip in clips:
        if kind == "say":
            place(voice, clip, int(cursor * SR))
            cursor += len(clip) / SR
        elif kind == "fixed":
            cursor += clip * long_scale if clip >= LONG_PAUSE else clip
        else:
            cursor += clip * unit
    rng = np.random.default_rng(zlib.crc32(mid.encode()))
    voice = soften_voice(voice, rng)
    voice = voice / (np.max(np.abs(voice)) + 1e-9) * 10 ** (-4 / 20)

    pad = BEDS[bed](rng, total)
    pad = pad / (np.sqrt(np.mean(pad ** 2)) + 1e-9) * 10 ** (BED_LEVEL_DB / 20)
    # Duck the bed gently while Bella is speaking, and let it come back up in the pauses.
    speaking = (lowpass(np.abs(voice), 4) > 0.01).astype(float)
    pad *= 1 - BED_DUCK * np.clip(lowpass(speaking, 1.0), 0, 1)
    fade = np.ones(total)
    fade_in, fade_out = int(SR * 6), int(SR * 9)
    fade[:fade_in] = np.linspace(0, 1, fade_in)
    fade[-fade_out:] = np.linspace(1, 0, fade_out)
    pad *= fade

    bells = np.zeros(total)
    strike = bell() * 10 ** (-12 / 20)
    place(bells, strike, int(SR * 0.3))
    place(bells, strike, total - int(SR * (TAIL - 0.5)))

    mix = voice + pad + bells
    mix[-int(SR * 0.5):] *= np.linspace(1, 0, int(SR * 0.5))
    return np.clip(mix, -0.99, 0.99)


def generate_meditations(only: list[str]) -> None:
    print("Meditations")
    scripts = parse_scripts()
    for category in CATALOG["categories"]:
        for item in category["meditations"]:
            mid = item["id"]
            if only and mid not in only:
                continue
            if mid not in scripts:
                raise SystemExit(f"No script for {mid} in {SCRIPTS.name}")
            bed, items = scripts[mid]
            audio = build_meditation(mid, item["minutes"], bed, items)
            encode(audio, OUT_MEDITATIONS / f"{mid}.m4a", 64000)


# ---------------------------------------------------------------------------
# App map: React Native bundles audio only through static require() calls.
# ---------------------------------------------------------------------------

def write_audio_map() -> None:
    lines = [
        "// Generated by audio-tools/generate_audio.py. Do not edit by hand.",
        "// Metro only bundles files referenced by a static require(), so every file is listed here.",
        "",
        "export const MEDITATION_AUDIO: Record<string, number> = {",
    ]
    for category in CATALOG["categories"]:
        for item in category["meditations"]:
            lines.append(f"  '{item['id']}': require('../../assets/audio/meditations/{item['id']}.m4a'),")
    lines += ["};", "", "export const SOUNDSCAPE_AUDIO: Record<string, number> = {"]
    for item in CATALOG["soundscapes"]:
        lines.append(f"  '{item['id']}': require('../../assets/audio/sounds/{item['id']}.m4a'),")
    lines += ["};", ""]
    AUDIO_MAP.parent.mkdir(parents=True, exist_ok=True)
    AUDIO_MAP.write_text("\n".join(lines))
    print(f"  wrote {AUDIO_MAP.relative_to(ROOT)}")


if __name__ == "__main__":
    # all | sounds [id ...] | meditations [id ...] | map
    args = sys.argv[1:]
    target = args[0] if args else "all"
    rest = args[1:]
    if target in ("all", "sounds"):
        generate_sounds(rest if target == "sounds" else [])
    if target in ("all", "meditations"):
        generate_meditations(rest if target == "meditations" else [])
    write_audio_map()

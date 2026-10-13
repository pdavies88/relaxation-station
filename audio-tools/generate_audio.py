"""Generates every audio file the app ships with. Nothing is downloaded at runtime.

    .tts/venv/bin/python audio-tools/generate_audio.py            # everything
    .tts/venv/bin/python audio-tools/generate_audio.py sounds     # soundscapes only
    .tts/venv/bin/python audio-tools/generate_audio.py meditations [bella|george] [id ...]
    .tts/venv/bin/python audio-tools/generate_audio.py sounds [id ...]

Soundscapes are synthesized from filtered noise and tones, and made to loop seamlessly.
Meditations are spoken by the Kokoro open-source voice model (Apache 2.0), timed to an exact
length, and mixed over a soft drone with a bell at the start and end. Output is AAC (.m4a),
encoded with macOS's built-in afconvert.

Setup (once): see audio-tools/README.md.
"""

from __future__ import annotations

import hashlib
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
# Narrators the user can choose between. Kokoro voice id and language for each.
VOICES = {
    "bella": {"voice": "af_bella", "lang": "en-us"},
    "george": {"voice": "bm_george", "lang": "en-gb"},
}
VOICE_SPEED = 0.82


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
    def mono(r, k):
        hiss = bandpass(pink(r, k), 400, 5000)
        drops = droplets(r, k, 160, 1200, 4500, 16, gain=2.5)
        swell = 0.85 + 0.15 * smooth_noise(r, k, 0.1)
        return lowpass(hiss + 0.5 * drops, 6000) * swell
    return stereo(rng, mono, n, 0.7)


def sound_thunderstorm(rng, n):
    """Heavy rain with thunderclaps: a sharp crack, then a long rolling rumble."""
    def mono(r, k):
        hiss = bandpass(pink(r, k), 200, 6000)
        drops = droplets(r, k, 650, 900, 4500, 20, gain=3.0)
        body = lowpass(brown(r, k), 600) * 0.6
        swell = 0.8 + 0.2 * smooth_noise(r, k, 0.15)
        return (hiss + 0.5 * drops + body) * swell
    rain = stereo(rng, mono, n, 0.7)
    rain = rain / (np.sqrt(np.mean(rain ** 2)) + 1e-9)

    thunder = np.zeros((n, 2))
    usable = n - int(SR * (CROSSFADE_SECONDS + 14))
    for start in np.sort(rng.choice(np.arange(int(SR * 4), usable, SR * 15), 5, replace=False)):
        start = int(start + rng.uniform(0, 6) * SR)
        crack_len = int(SR * rng.uniform(0.25, 0.5))
        crack = highpass(white(rng, crack_len), 300) * np.exp(-np.arange(crack_len) / (SR * 0.06))
        crack = lowpass(crack, 5000)
        rumble_len = int(SR * rng.uniform(7, 11))
        rumble = lowpass(brown(rng, rumble_len), rng.uniform(110, 200), order=4)
        rumble *= envelope(rumble_len, 0.15, rng.uniform(2.2, 3.5)) * (0.6 + 0.4 * smooth_noise(rng, rumble_len, 4))
        clap = np.zeros(rumble_len)
        clap[:crack_len] += crack / (np.max(np.abs(crack)) + 1e-9) * 0.9
        clap += rumble / (np.max(np.abs(rumble)) + 1e-9)
        pan = rng.uniform(0.3, 0.7)
        place(thunder[:, 0], clap * (1 - pan) * 2, start)
        place(thunder[:, 1], clap * pan * 2, start)
    return 0.55 * rain + 6.0 * thunder


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


def sound_wind(rng, n):
    def mono(r, k):
        noise = white(r, k)
        bands = [(150, 400), (300, 800), (600, 1600), (1200, 3000)]
        out = np.zeros(k)
        for i, (lo, hi) in enumerate(bands):
            gust = smooth_noise(r, k, 0.12 + 0.05 * i) ** 2
            out += bandpass(noise, lo, hi) * gust * (1.0 / (i + 1))
        return out + 0.3 * lowpass(brown(r, k), 120)
    return stereo(rng, mono, n, 0.5)


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


def cricket(rng, n, carrier, chirp_period, pulses, distance):
    """One field cricket: chirps of a few short pulses, each with a quick attack, a slight
    downward pitch glide and a natural decay. Timing, loudness and pulse count all wander."""
    out = np.zeros(n)
    pulse_len = int(SR * 0.018)
    pt = np.arange(pulse_len) / SR
    t = rng.uniform(0, chirp_period)
    while t < n / SR:
        count = int(np.clip(round(rng.normal(pulses, 0.7)), 2, 6))
        chirp_gain = rng.uniform(0.6, 1.0)
        f0 = carrier * rng.uniform(0.985, 1.015)
        for p in range(count):
            freq = f0 * (1 - 0.03 * pt / pt[-1])
            pulse = np.sin(2 * np.pi * np.cumsum(freq) / SR)
            pulse *= np.minimum(1, pt / 0.002) * np.exp(-pt / 0.007)
            place(out, pulse * chirp_gain * rng.uniform(0.7, 1.0), int((t + p * rng.uniform(0.028, 0.036)) * SR))
        t += chirp_period * rng.uniform(0.75, 1.35)
        if rng.random() < 0.06:
            t += rng.uniform(1, 4)  # crickets pause now and then
    # Distance: quieter, duller and more reverberant.
    out = lowpass(out, 9000 - 4000 * distance) * (1 - 0.75 * distance)
    return out


def sound_night(rng, n):
    """A warm evening: a soft breeze, a distant cricket chorus, and a few nearer crickets."""
    bed = stereo(rng, lambda r, k: lowpass(bandpass(pink(r, k), 120, 1500) * (0.6 + 0.4 * smooth_noise(r, k, 0.1)), 1500), n, 0.8)
    bed = bed / (np.sqrt(np.mean(bed ** 2)) + 1e-9) * 0.05
    out = bed.copy()
    # Far-off chorus: many crickets blending into a gentle shimmer.
    for _ in range(8):
        voice = cricket(rng, n, rng.uniform(3900, 4700), rng.uniform(0.45, 0.8), 3, rng.uniform(0.8, 0.95))
        pan = rng.uniform(0.1, 0.9)
        out[:, 0] += voice * (1 - pan) * 0.5
        out[:, 1] += voice * pan * 0.5
    # A few nearer crickets with their own rhythm.
    for _ in range(3):
        voice = cricket(rng, n, rng.uniform(4100, 4900), rng.uniform(0.55, 1.0), 4, rng.uniform(0.3, 0.6))
        pan = rng.uniform(0.15, 0.85)
        out[:, 0] += voice * (1 - pan) * 0.5
        out[:, 1] += voice * pan * 0.5
    room = rng
    out[:, 0] = 0.7 * out[:, 0] + 0.3 * signal.fftconvolve(out[:, 0], np.exp(-np.arange(int(SR * 0.6)) / (SR * 0.12)) * room.standard_normal(int(SR * 0.6)) * 0.05)[:n]
    out[:, 1] = 0.7 * out[:, 1] + 0.3 * signal.fftconvolve(out[:, 1], np.exp(-np.arange(int(SR * 0.6)) / (SR * 0.12)) * room.standard_normal(int(SR * 0.6)) * 0.05)[:n]
    return out


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


SOUNDS = {
    "rain": sound_rain,
    "thunderstorm": sound_thunderstorm,
    "ocean": sound_ocean,
    "lullaby": sound_lullaby,
    "wind": sound_wind,
    "fire": sound_fire,
    "night": sound_night,
    "fan": sound_fan,
    "brown-noise": sound_brown_noise,
    "bells": sound_bells,
}

# Sounds built as exact circles (no crossfade needed): their notes and reverb wrap around.
CIRCULAR_SOUNDS = {"lullaby", "bells"}

# Per-sound loudness, so the set feels consistent when switching between them.
SOUND_LEVEL_DB = {"rain": -27, "lullaby": -23, "bells": -24, "night": -27, "fan": -21}


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
FLEX_MIN = 1.2  # shortest pause between lines


def parse_scripts() -> dict[str, list[tuple[str, object]]]:
    scripts: dict[str, list[tuple[str, object]]] = {}
    current = None
    for raw in SCRIPTS.read_text().splitlines():
        line = raw.strip()
        if not line or (line.startswith("#") and not line.startswith("##")):
            continue
        if line.startswith("## "):
            current = line[3:].strip()
            scripts[current] = []
        elif line == "~":
            scripts[current].append(("flex", 3.0))
        elif re.fullmatch(r"\[\d+(\.\d+)?\]", line):
            scripts[current].append(("fixed", float(line[1:-1])))
        else:
            scripts[current].append(("say", line))
            scripts[current].append(("flex", 1.0))
    return scripts


_kokoro = None


def speak(text: str, narrator: str) -> np.ndarray:
    """Speaks one line with Kokoro, resampled to 44.1 kHz. Results are cached by voice and text."""
    global _kokoro
    voice, lang = VOICES[narrator]["voice"], VOICES[narrator]["lang"]
    key = hashlib.sha1(f"{voice}|{VOICE_SPEED}|{text}".encode()).hexdigest()
    cached = TTS_CACHE / f"{key}.npy"
    if cached.exists():
        return np.load(cached)
    if _kokoro is None:
        from kokoro_onnx import Kokoro

        _kokoro = Kokoro(str(TTS_DIR / "kokoro-v1.0.onnx"), str(TTS_DIR / "voices-v1.0.bin"))
    samples, rate = _kokoro.create(text, voice=voice, speed=VOICE_SPEED, lang=lang)
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


def build_meditation(mid: str, minutes: int, items: list[tuple[str, object]], narrator: str) -> np.ndarray:
    total = int(SR * minutes * 60)
    clips = [(kind, speak(value, narrator) if kind == "say" else value) for kind, value in items]
    # Drop the flexible pause after the very last line; the tail covers it.
    while clips and clips[-1][0] == "flex":
        clips.pop()

    speech = sum(len(c) for k, c in clips if k == "say") / SR
    fixed = sum(c for k, c in clips if k == "fixed")
    weights = sum(c for k, c in clips if k == "flex")
    available = minutes * 60 - LEAD_IN - TAIL - speech - fixed
    unit = available / weights if weights else 0
    min_flex = min((c * unit for k, c in clips if k == "flex"), default=99)
    print(f"  {narrator}/{mid}: speech {speech:.0f}s of {minutes * 60}s, shortest pause {min_flex:.1f}s")
    if min_flex < FLEX_MIN:
        raise SystemExit(f"{mid}: script is too long for {minutes} minutes. Remove some lines.")

    voice = np.zeros(total)
    cursor = LEAD_IN
    for kind, clip in clips:
        if kind == "say":
            place(voice, clip, int(cursor * SR))
            cursor += len(clip) / SR
        elif kind == "fixed":
            cursor += clip
        else:
            cursor += clip * unit
    voice = voice / (np.max(np.abs(voice)) + 1e-9) * 10 ** (-3 / 20)

    pad = drone(total, minutes * 60).mean(axis=1)
    pad = pad / (np.sqrt(np.mean(pad ** 2)) + 1e-9) * 10 ** (-34 / 20)
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


def generate_meditations(narrators: list[str], only: list[str]) -> None:
    print("Meditations")
    scripts = parse_scripts()
    for narrator in narrators:
        for category in CATALOG["categories"]:
            for item in category["meditations"]:
                mid = item["id"]
                if only and mid not in only:
                    continue
                if mid not in scripts:
                    raise SystemExit(f"No script for {mid} in {SCRIPTS.name}")
                audio = build_meditation(mid, item["minutes"], scripts[mid], narrator)
                encode(audio, OUT_MEDITATIONS / narrator / f"{mid}.m4a", 64000)


# ---------------------------------------------------------------------------
# App map: React Native bundles audio only through static require() calls.
# ---------------------------------------------------------------------------

def write_audio_map() -> None:
    lines = [
        "// Generated by audio-tools/generate_audio.py. Do not edit by hand.",
        "// Metro only bundles files referenced by a static require(), so every file is listed here.",
        "",
        f"export const NARRATORS = {json.dumps(list(VOICES))} as const;",
        "export type Narrator = (typeof NARRATORS)[number];",
        "",
        "export const MEDITATION_AUDIO: Record<Narrator, Record<string, number>> = {",
    ]
    for narrator in VOICES:
        lines.append(f"  {narrator}: {{")
        for category in CATALOG["categories"]:
            for item in category["meditations"]:
                lines.append(
                    f"    '{item['id']}': require('../../assets/audio/meditations/{narrator}/{item['id']}.m4a'),"
                )
        lines.append("  },")
    lines += ["};", "", "export const SOUNDSCAPE_AUDIO: Record<string, number> = {"]
    for item in CATALOG["soundscapes"]:
        lines.append(f"  '{item['id']}': require('../../assets/audio/sounds/{item['id']}.m4a'),")
    lines += ["};", ""]
    AUDIO_MAP.parent.mkdir(parents=True, exist_ok=True)
    AUDIO_MAP.write_text("\n".join(lines))
    print(f"  wrote {AUDIO_MAP.relative_to(ROOT)}")


if __name__ == "__main__":
    # all | sounds [id ...] | meditations [bella|george ...] [id ...] | map
    args = sys.argv[1:]
    target = args[0] if args else "all"
    rest = args[1:]
    if target in ("all", "sounds"):
        generate_sounds(rest if target == "sounds" else [])
    if target in ("all", "meditations"):
        narrators = [a for a in rest if a in VOICES] or list(VOICES)
        generate_meditations(narrators, [a for a in rest if a not in VOICES])
    write_audio_map()

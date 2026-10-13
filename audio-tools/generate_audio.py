"""Generates every audio file the app ships with. Nothing is downloaded at runtime.

    .tts/venv/bin/python audio-tools/generate_audio.py            # everything
    .tts/venv/bin/python audio-tools/generate_audio.py sounds     # soundscapes only
    .tts/venv/bin/python audio-tools/generate_audio.py meditations [id ...]

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
VOICE = "af_heart"
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
        hiss = bandpass(pink(r, k), 500, 9000)
        drops = droplets(r, k, 220, 1800, 6500, 14, gain=3.0)
        swell = 0.85 + 0.15 * smooth_noise(r, k, 0.1)
        return (hiss + 0.6 * drops) * swell
    return stereo(rng, mono, n, 0.7)


def sound_thunderstorm(rng, n):
    def mono(r, k):
        hiss = bandpass(pink(r, k), 250, 7000)
        drops = droplets(r, k, 420, 1200, 5000, 18, gain=3.0)
        low = lowpass(brown(r, k), 500) * 0.5
        return hiss + 0.5 * drops + low
    rain = stereo(rng, mono, n, 0.7)
    thunder = np.zeros(n)
    usable = n - int(SR * (CROSSFADE_SECONDS + 12))
    for start in np.sort(rng.integers(int(SR * 6), usable, 4)):
        length = int(SR * rng.uniform(7, 11))
        rumble = lowpass(brown(rng, length), rng.uniform(90, 180), order=4)
        rumble *= envelope(length, rng.uniform(0.2, 0.8), rng.uniform(1.8, 3.2))
        rumble *= 0.6 + 0.4 * smooth_noise(rng, length, 3)
        place(thunder, rumble / (np.max(np.abs(rumble)) + 1e-9), int(start))
    rain = rain / (np.sqrt(np.mean(rain ** 2)) + 1e-9)
    pan = np.stack([thunder * 0.9, thunder * 1.1], axis=1)
    return rain + 2.2 * pan


def sound_ocean(rng, n):
    base = lowpass(0.6 * brown(rng, n) / 30 + pink(rng, n), 1400)
    foam = bandpass(white(rng, n), 2500, 9000)
    swell = np.zeros(n)
    t = 0.0
    while t < n / SR:
        period = rng.uniform(8, 12)
        length = int(SR * period * 1.4)
        wave = envelope(length, period * 0.35, period * 0.35) * rng.uniform(0.6, 1.0)
        place(swell, wave, int(t * SR))
        t += period
    swell = 0.25 + swell / swell.max()
    crash = np.maximum(0, np.gradient(signal.savgol_filter(swell, 2001, 2))) * SR
    crash = lowpass(crash / (crash.max() + 1e-9), 3)
    mono_l = base * swell + 0.35 * foam * crash
    pan = 0.5 + 0.2 * np.sin(2 * np.pi * np.arange(n) / SR / 23)
    other = lowpass(pink(rng, n), 1400) * swell + 0.35 * bandpass(white(rng, n), 2500, 9000) * crash
    return np.stack([mono_l * (1 - pan) + other * pan * 0.6, mono_l * pan + other * (1 - pan) * 0.6], axis=1)


def sound_stream(rng, n):
    def mono(r, k):
        rush = bandpass(pink(r, k), 300, 3500) * 0.8
        bubbles = np.zeros(k)
        for start in r.integers(0, k, int(k / SR * 55)):
            length = int(SR * r.uniform(0.02, 0.07))
            t = np.arange(length) / SR
            f0 = r.uniform(400, 1500)
            freq = f0 * (1 + 2.5 * t / t[-1] * 0.3)
            blip = np.sin(2 * np.pi * np.cumsum(freq) / SR) * np.exp(-t / (t[-1] / 3))
            place(bubbles, blip * r.uniform(0.2, 1.0), int(start))
        return rush + 1.4 * bubbles * (0.7 + 0.3 * smooth_noise(r, k, 0.5))
    return stereo(rng, mono, n, 0.6)


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


def sound_night(rng, n):
    bed = stereo(rng, lambda r, k: bandpass(pink(r, k), 200, 2500) * 0.15, n, 0.8)
    out = bed.copy()
    crickets = [(4600, 0.62, 0.3), (4300, 0.75, 0.7), (4900, 0.55, 0.5), (4100, 0.9, 0.15)]
    for freq, interval, pan in crickets:
        voice = np.zeros(n)
        t = rng.uniform(0, interval)
        pulse_len = int(SR * 0.014)
        pulse_t = np.arange(pulse_len) / SR
        pulse = np.sin(2 * np.pi * freq * pulse_t) * np.sin(np.pi * pulse_t / pulse_t[-1])
        while t < n / SR:
            for p in range(rng.integers(2, 5)):
                place(voice, pulse, int((t + p * 0.022) * SR))
            t += interval * rng.uniform(0.9, 1.1)
        voice *= 0.5 + 0.5 * smooth_noise(rng, n, 0.05)
        out[:, 0] += voice * (1 - pan) * 0.35
        out[:, 1] += voice * pan * 0.35
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


def sound_drone(rng, n):
    return drone(n, LOOP_SECONDS)


SOUNDS = {
    "rain": sound_rain,
    "thunderstorm": sound_thunderstorm,
    "ocean": sound_ocean,
    "stream": sound_stream,
    "wind": sound_wind,
    "fire": sound_fire,
    "night": sound_night,
    "fan": sound_fan,
    "brown-noise": sound_brown_noise,
    "drone": sound_drone,
}

# Per-sound loudness, so the set feels consistent when switching between them.
SOUND_LEVEL_DB = {"drone": -22, "night": -24, "fan": -21}


def generate_sounds() -> None:
    print("Soundscapes")
    loop = SR * LOOP_SECONDS
    for index, item in enumerate(CATALOG["soundscapes"]):
        sid = item["id"]
        rng = np.random.default_rng(1000 + index)
        if sid == "drone":
            # The drone's slow LFOs complete whole cycles in the loop, so no crossfade is needed.
            audio = drone(loop, LOOP_SECONDS)
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


def speak(text: str) -> np.ndarray:
    """Speaks one line with Kokoro, resampled to 44.1 kHz. Results are cached by text."""
    global _kokoro
    key = hashlib.sha1(f"{VOICE}|{VOICE_SPEED}|{text}".encode()).hexdigest()
    cached = TTS_CACHE / f"{key}.npy"
    if cached.exists():
        return np.load(cached)
    if _kokoro is None:
        from kokoro_onnx import Kokoro

        _kokoro = Kokoro(str(TTS_DIR / "kokoro-v1.0.onnx"), str(TTS_DIR / "voices-v1.0.bin"))
    samples, rate = _kokoro.create(text, voice=VOICE, speed=VOICE_SPEED, lang="en-us")
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


def build_meditation(mid: str, minutes: int, items: list[tuple[str, object]]) -> np.ndarray:
    total = int(SR * minutes * 60)
    clips = [(kind, speak(value) if kind == "say" else value) for kind, value in items]
    # Drop the flexible pause after the very last line; the tail covers it.
    while clips and clips[-1][0] == "flex":
        clips.pop()

    speech = sum(len(c) for k, c in clips if k == "say") / SR
    fixed = sum(c for k, c in clips if k == "fixed")
    weights = sum(c for k, c in clips if k == "flex")
    available = minutes * 60 - LEAD_IN - TAIL - speech - fixed
    unit = available / weights if weights else 0
    min_flex = min((c * unit for k, c in clips if k == "flex"), default=99)
    print(f"  {mid}: speech {speech:.0f}s of {minutes * 60}s, shortest pause {min_flex:.1f}s")
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
            audio = build_meditation(mid, item["minutes"], scripts[mid])
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
    args = sys.argv[1:]
    target = args[0] if args else "all"
    if target in ("all", "sounds"):
        generate_sounds()
    if target in ("all", "meditations"):
        generate_meditations(args[1:])
    write_audio_map()

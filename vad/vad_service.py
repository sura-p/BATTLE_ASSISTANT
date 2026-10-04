import sys
import numpy as np
import torch

from silero_vad import load_silero_vad


# ============================================================
# CONFIG
# ============================================================

SAMPLE_RATE = 16000

# Silero VAD uses 512 samples for 16 kHz audio.
CHUNK_SAMPLES = 512

BYTES_PER_SAMPLE = 2

CHUNK_BYTES = (
    CHUNK_SAMPLES *
    BYTES_PER_SAMPLE
)

# Probability required to consider a frame speech.
SPEECH_THRESHOLD = 0.5

# Minimum energy (int16 RMS) a frame must have to count as
# speech. Silero scores some stationary noise (fan, hum)
# above the probability threshold; the energy floor rejects
# it. Raise if VAD still triggers on empty air, lower if
# quiet speech doesn't trigger.
RMS_SPEECH_FLOOR = 150.0

# Require several speech frames before declaring speech start.
START_FRAMES = 3

# Require sustained silence before declaring speech end.
#
# 512 / 16000 = 32 ms per frame
#
# 25 frames ~= 800 ms silence.
END_SILENCE_FRAMES = 25


# ============================================================
# LOAD MODEL
# ============================================================

print(
    "[vad-python] loading Silero VAD...",
    file=sys.stderr,
    flush=True
)

model = load_silero_vad()

print(
    "[vad-python] ready",
    file=sys.stderr,
    flush=True
)


# ============================================================
# STATE
# ============================================================

buffer = bytearray()

speaking = False

speech_frames = 0

silence_frames = 0


# ============================================================
# READ 16 KHZ PCM FROM NODE
# ============================================================

while True:

    data = sys.stdin.buffer.read(1024)

    if not data:

        print(
            "[vad-python] stdin closed",
            file=sys.stderr,
            flush=True
        )

        break


    buffer.extend(data)


    # ========================================================
    # PROCESS 512 SAMPLE FRAMES
    # ========================================================

    while len(buffer) >= CHUNK_BYTES:

        chunk = bytes(
            buffer[:CHUNK_BYTES]
        )

        del buffer[:CHUNK_BYTES]


        # ----------------------------------------------------
        # int16 PCM
        # ----------------------------------------------------

        pcm_int16 = np.frombuffer(
            chunk,
            dtype="<i2"
        )

        peak = int(
            np.max(
                np.abs(
                    pcm_int16.astype(np.int32)
                )
            )
        )

        rms = float(
            np.sqrt(
                np.mean(
                    pcm_int16.astype(np.float32) ** 2
                )
            )
        )

        # ----------------------------------------------------
        # Silero expects float32 [-1, 1]
        # ----------------------------------------------------

        pcm_float = (
            pcm_int16.astype(np.float32)
            / 32768.0
        )


        audio_tensor = torch.from_numpy(
            pcm_float
        )


        # ----------------------------------------------------
        # VAD probability
        # ----------------------------------------------------

        with torch.no_grad():

            probability = model(
                audio_tensor,
                SAMPLE_RATE
            ).item()


        # ----------------------------------------------------
        # DEBUG (uncomment to see frame values)
        # ----------------------------------------------------

        # print(
        #     f"[vad] probability={probability:.3f} rms={rms:.0f}",
        #     file=sys.stderr,
        #     flush=True
        # )


        # ----------------------------------------------------
        # A frame is speech only when BOTH hold: Silero is
        # confident AND the audio actually has energy.
        # ----------------------------------------------------

        is_speech = (
            probability >= SPEECH_THRESHOLD
            and
            rms >= RMS_SPEECH_FLOOR
        )


        # ====================================================
        # NOT CURRENTLY SPEAKING
        # ====================================================

        if not speaking:

            if is_speech:

                speech_frames += 1

            else:

                speech_frames = 0


            if speech_frames >= START_FRAMES:

                speaking = True

                speech_frames = 0

                silence_frames = 0


                # Protocol message for Node
                print(
                    "SPEECH_START",
                    flush=True
                )


                print(
                    "[vad-python] speech started",
                    file=sys.stderr,
                    flush=True
                )


        # ====================================================
        # CURRENTLY SPEAKING
        # ====================================================

        else:

            if not is_speech:

                silence_frames += 1

            else:

                silence_frames = 0


            if silence_frames >= END_SILENCE_FRAMES:

                speaking = False

                silence_frames = 0

                speech_frames = 0


                # Protocol message for Node
                print(
                    "SPEECH_END",
                    flush=True
                )


                print(
                    "[vad-python] speech ended",
                    file=sys.stderr,
                    flush=True
                )
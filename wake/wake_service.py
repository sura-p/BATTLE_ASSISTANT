import sys
import numpy as np
from openwakeword.model import Model


# ============================================================
# CONFIG
# ============================================================

THRESHOLD = 0.5

# openWakeWord: 1280 samples @ 16 kHz = 80 ms
CHUNK_SAMPLES = 1280

# int16 = 2 bytes
BYTES_PER_SAMPLE = 2

CHUNK_BYTES = CHUNK_SAMPLES * BYTES_PER_SAMPLE


# ============================================================
# LOAD MODEL
# ============================================================

print(
    "[wake-python] loading model...",
    file=sys.stderr,
    flush=True
)

model = Model(
    wakeword_models=["hey_jarvis"],
    inference_framework="onnx"
)

print(
    "[wake-python] ready",
    file=sys.stderr,
    flush=True
)


# ============================================================
# AUDIO BUFFER
# ============================================================

buffer = bytearray()


# ============================================================
# READ AUDIO FROM NODE
# ============================================================

while True:

    # Node sends raw:
    # 16kHz / mono / signed int16 / little-endian PCM
    data = sys.stdin.buffer.read(1024)

    if not data:
        print(
            "[wake-python] stdin closed",
            file=sys.stderr,
            flush=True
        )
        break

    buffer.extend(data)


    # ========================================================
    # PROCESS 1280-SAMPLE FRAMES
    # ========================================================

    while len(buffer) >= CHUNK_BYTES:

        # Get exactly 2560 bytes
        chunk = bytes(
            buffer[:CHUNK_BYTES]
        )

        del buffer[:CHUNK_BYTES]


        # ----------------------------------------------------
        # BYTES -> INT16 PCM
        # ----------------------------------------------------

        pcm = np.frombuffer(
            chunk,
            dtype="<i2"
        )


        # ----------------------------------------------------
        # AUDIO LEVEL DEBUG
        # ----------------------------------------------------

        peak = int(
            np.max(
                np.abs(
                    pcm.astype(np.int32)
                )
            )
        )

        # print(
        #     f"[audio] peak={peak}",
        #     file=sys.stderr,
        #     flush=True
        # )


        # ----------------------------------------------------
        # OPENWAKEWORD INFERENCE
        # ----------------------------------------------------

        prediction = model.predict(
            pcm
        )


        # ----------------------------------------------------
        # CHECK MODEL OUTPUT
        # ----------------------------------------------------

        for wakeword, score in prediction.items():

            score = float(score)

            # Show interesting scores
            if score > 0.01:

                print(
                    f"[score] {wakeword}: {score:.4f}",
                    file=sys.stderr,
                    flush=True
                )


            # ------------------------------------------------
            # WAKE DETECTED
            # ------------------------------------------------

            if score >= THRESHOLD:

                # stdout = protocol to Node
                print(
                    "WAKE",
                    flush=True
                )

                # stderr = logs
                print(
                    f"[wake-python] detected "
                    f"{wakeword} "
                    f"score={score:.3f}",
                    file=sys.stderr,
                    flush=True
                )
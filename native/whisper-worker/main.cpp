#include "whisper.h"

#include <algorithm>
#include <cstdint>
#include <cstdlib>
#include <cstring>
#include <iostream>
#include <string>
#include <vector>
#include <thread>


// ============================================================
// CONFIG
// ============================================================

static constexpr int SAMPLE_RATE = 16000;

// ============================================================
// PROTOCOL COMMANDS
// ============================================================

// Node sends 0 to tell Whisper:
// "The current utterance is finished."
static constexpr uint32_t CMD_FINALIZE =
    0x00000000;


// Node sends 0xffffffff to tell Whisper:
// "Decode what you have so far, but DO NOT clear the audio."
static constexpr uint32_t CMD_PARTIAL =
    0xffffffff;


// ============================================================
// CONVERT INT16 PCM → FLOAT32
// ============================================================

static std::vector<float> pcm16_to_float(
    const std::vector<int16_t>& input
) {

    std::vector<float> output;

    output.resize(
        input.size()
    );


    for (
        size_t i = 0;
        i < input.size();
        i++
    ) {

        output[i] =
            static_cast<float>(
                input[i]
            ) / 32768.0f;
    }


    return output;
}


// ============================================================
// TRANSCRIBE
// ============================================================

static std::string transcribe(
    whisper_context* ctx,
    const std::vector<int16_t>& pcm
) {

    if (
        pcm.empty()
    ) {
        return "";
    }


    std::vector<float> audio =
        pcm16_to_float(
            pcm
        );


    whisper_full_params params =
        whisper_full_default_params(
            WHISPER_SAMPLING_GREEDY
        );


    // English only.
    params.language = "en";


    // We only want text.
    params.print_progress = false;
    params.print_realtime = false;
    params.print_timestamps = false;
    params.print_special = false;


    // Don't translate.
    params.translate = false;


    // Start simple.
    params.no_context = true;


    unsigned int threads =
        std::thread::hardware_concurrency();


    params.n_threads =
        std::max(
            1u,
            std::min(
                8u,
                threads
            )
        );


    std::cerr
        << "[whisper-worker] decoding "
        << pcm.size()
        << " samples"
        << std::endl;


    int result =
        whisper_full(
            ctx,
            params,
            audio.data(),
            static_cast<int>(
                audio.size()
            )
        );


    if (
        result != 0
    ) {

        std::cerr
            << "[whisper-worker] whisper_full failed: "
            << result
            << std::endl;

        return "";
    }


    std::string text;


    const int segments =
        whisper_full_n_segments(
            ctx
        );


    for (
        int i = 0;
        i < segments;
        i++
    ) {

        const char* segment =
            whisper_full_get_segment_text(
                ctx,
                i
            );


        if (
            segment
        ) {

            text += segment;
        }
    }


    return text;
}


// ============================================================
// MAIN
// ============================================================

int main(
    int argc,
    char** argv
) {

    if (
        argc < 2
    ) {

        std::cerr
            << "Usage: whisper-worker <model-path>"
            << std::endl;

        return 1;
    }


    const char* model_path =
        argv[1];


    std::cerr
        << "[whisper-worker] loading model: "
        << model_path
        << std::endl;


    whisper_context_params context_params =
        whisper_context_default_params();


    whisper_context* ctx =
        whisper_init_from_file_with_params(
            model_path,
            context_params
        );


    if (
        ctx == nullptr
    ) {

        std::cerr
            << "[whisper-worker] failed to load model"
            << std::endl;

        return 1;
    }


    std::cerr
        << "[whisper-worker] model ready"
        << std::endl;


    // stdout = protocol for Node.
    std::cout
        << "READY"
        << std::endl;


    // Audio for the current user turn.
    std::vector<int16_t> audio_buffer;


    // ========================================================
    // PROTOCOL
    //
    // stdin:
    //
    // [4-byte little-endian uint32 length]
    // [payload]
    //
    // length > 0:
    //     payload = PCM int16 audio
    //
    // length == 0:
    //     finalize current utterance
    //
    // This lets us safely send binary audio + a control event
    // through one stream without corrupting PCM.
    // ========================================================

    while (true) {

        uint32_t payload_size = 0;


        std::cin.read(
            reinterpret_cast<char*>(
                &payload_size
            ),
            sizeof(payload_size)
        );


        if (
            !std::cin
        ) {
            break;
        }

// ====================================================
// PARTIAL TRANSCRIPTION
// ====================================================

if (
    payload_size == CMD_PARTIAL
) {

    // Nothing has been received yet.
    if (
        audio_buffer.empty()
    ) {

        std::cout
            << "PARTIAL|"
            << std::endl;

        continue;
    }


    std::cerr
        << "[whisper-worker] partial request: "
        << audio_buffer.size()
        << " samples"
        << std::endl;


    // Decode everything collected so far.
    std::string text =
        transcribe(
            ctx,
            audio_buffer
        );


    // Send result back to Node.
    std::cout
        << "PARTIAL|"
        << text
        << std::endl;


    // IMPORTANT:
    //
    // DO NOT clear audio_buffer here.
    //
    // The user is still speaking and the next
    // audio packets belong to this same utterance.

    continue;
}
        // ====================================================
        // FINALIZE
        // ====================================================

        if (
            payload_size == CMD_FINALIZE
        ) {

            if (
                audio_buffer.empty()
            ) {

                std::cout
                    << "FINAL|"
                    << std::endl;

                continue;
            }
std::cerr
    << "[whisper-worker] final request: "
    << audio_buffer.size()
    << " samples"
    << std::endl;

            std::string text =
                transcribe(
                    ctx,
                    audio_buffer
                );


            std::cout
                << "FINAL|"
                << text
                << std::endl;


            audio_buffer.clear();

            continue;
        }


        // Sanity protection: don't accept an absurd packet.
        if (
            payload_size >
            1024 * 1024
        ) {

            std::cerr
                << "[whisper-worker] invalid payload size: "
                << payload_size
                << std::endl;

            break;
        }
// PCM int16 requires exactly 2 bytes per sample.
// Therefore packet size must always be even.
if (
    payload_size %
    sizeof(int16_t) != 0
) {

    std::cerr
        << "[whisper-worker] invalid PCM payload size: "
        << payload_size
        << std::endl;

    break;
}

        std::vector<char> payload(
            payload_size
        );


        std::cin.read(
            payload.data(),
            payload_size
        );


        if (
            !std::cin
        ) {
            break;
        }


        const size_t sample_count =
            payload_size /
            sizeof(int16_t);


        const int16_t* samples =
            reinterpret_cast<const int16_t*>(
                payload.data()
            );


        audio_buffer.insert(
            audio_buffer.end(),
            samples,
            samples + sample_count
        );
    }


    whisper_free(
        ctx
    );


    return 0;
}
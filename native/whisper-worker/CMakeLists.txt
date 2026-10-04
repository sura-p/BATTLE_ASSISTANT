cmake_minimum_required(VERSION 3.16)

project(
    battle_whisper_worker
    LANGUAGES CXX
)


set(
    CMAKE_CXX_STANDARD
    17
)


set(
    CMAKE_CXX_STANDARD_REQUIRED
    ON
)


# ------------------------------------------------------------
# WHISPER.CPP
# ------------------------------------------------------------

if(
    NOT DEFINED WHISPER_CPP_DIR
)

    message(
        FATAL_ERROR
        "WHISPER_CPP_DIR is required"
    )

endif()


add_subdirectory(
    ${WHISPER_CPP_DIR}
    whisper.cpp-build
)


# ------------------------------------------------------------
# WORKER
# ------------------------------------------------------------

add_executable(
    battle-whisper-worker
    main.cpp
)


target_link_libraries(
    battle-whisper-worker
    PRIVATE
    whisper
)
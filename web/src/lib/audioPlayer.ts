type StopCallback = () => void;

let currentAudio: HTMLAudioElement | null = null;
let currentStop: StopCallback | null = null;

export const audioPlayer = {
  play(url: string, onStop: StopCallback): HTMLAudioElement {
    if (currentAudio) {
      currentAudio.pause();
      currentStop?.();
      currentAudio = null;
      currentStop = null;
    }

    const audio = new Audio(url);
    currentAudio = audio;
    currentStop = onStop;

    audio.addEventListener("ended", () => {
      currentAudio = null;
      currentStop = null;
      onStop();
    });

    audio.addEventListener("error", () => {
      currentAudio = null;
      currentStop = null;
      onStop();
    });

    return audio;
  },

  stop() {
    if (currentAudio) {
      currentAudio.pause();
      currentStop?.();
      currentAudio = null;
      currentStop = null;
    }
  },

  isPlaying(audio: HTMLAudioElement | null): boolean {
    return audio !== null && audio === currentAudio;
  },
};

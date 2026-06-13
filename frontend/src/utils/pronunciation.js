import { fetchDictionaryDefinition } from '../api/dictionaryApi';

// Plays a real MP3 from the Free Dictionary API if available,
// otherwise falls back to the best English voice in Web Speech API.
export async function pronounceWord(text) {
  if (!text) return;

  // 1. Try Free Dictionary API audio (real human pronunciation)
  const result = await fetchDictionaryDefinition(text);
  if (result.audioUrl) {
    const audio = new Audio(result.audioUrl);
    audio.play().catch(() => fallbackSpeech(text));
    return;
  }

  // 2. Fallback: Web Speech API with best available English voice
  fallbackSpeech(text);
}

function getBestEnglishVoice() {
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find(v => v.lang === 'en-US' && v.name.includes('Google')) ||
    voices.find(v => v.lang === 'en-US' && v.name.includes('Microsoft')) ||
    voices.find(v => v.lang === 'en-US') ||
    voices.find(v => v.lang.startsWith('en')) ||
    null
  );
}

function fallbackSpeech(text) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = 0.9;

  const speak = () => {
    const best = getBestEnglishVoice();
    if (best) utterance.voice = best;
    window.speechSynthesis.speak(utterance);
  };

  // Voices may not be loaded yet on first call — wait for them
  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) {
    speak();
  } else {
    window.speechSynthesis.addEventListener('voiceschanged', speak, { once: true });
  }
}

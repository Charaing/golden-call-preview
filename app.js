const timer = document.querySelector('#call-timer');
const speaker = document.querySelector('#speaker');
const mute = document.querySelector('#mute');
const startedAt = performance.now();
setInterval(updateTimer, 250);
let audio;
let ringInterval;
let playingTones = [];

function updateTimer() {
  const seconds = Math.floor((performance.now() - startedAt) / 1000);
  const minutes = Math.floor(seconds / 60);
  const minutesDisplay = String(minutes).padStart(2, '0');
  const secondsDisplay = String(seconds % 60).padStart(2, '0');
  const display = `${minutesDisplay}:${secondsDisplay}`;
  if (timer.textContent === display) return;
  timer.textContent = display;
  timer.dateTime = `PT${seconds}S`;
  const elapsed = minutes ? `${minutes}분 ${seconds % 60}초` : `${seconds}초`;
  timer.setAttribute('aria-label', `경과 시간 ${elapsed}`);
}

function playRing() {
  const at = audio.currentTime;
  const volume = audio.createGain();
  volume.gain.setValueAtTime(0, at);
  volume.gain.linearRampToValueAtTime(0.045, at + 0.04);
  volume.gain.setValueAtTime(0.045, at + 1.04);
  volume.gain.linearRampToValueAtTime(0, at + 1.12);
  volume.connect(audio.destination);
  playingTones = [440, 480].map(frequency => {
    const oscillator = audio.createOscillator();
    oscillator.frequency.value = frequency;
    oscillator.connect(volume);
    oscillator.start(at);
    oscillator.stop(at + 1.12);
    return oscillator;
  });
  playingTones[0].onended = () => volume.disconnect();
}

function stopRing() {
  clearInterval(ringInterval);
  ringInterval = undefined;
  for (const tone of playingTones) tone.stop();
  playingTones = [];
}

async function updateRing() {
  stopRing();
  const wantsRing = () => speaker.getAttribute('aria-pressed') === 'true' && mute.getAttribute('aria-pressed') === 'false';
  if (!wantsRing()) return;
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (!Audio) return;

  try {
    audio ??= new Audio();
    if (audio.state === 'suspended') await audio.resume();
    if (wantsRing() && !ringInterval) {
      playRing();
      ringInterval = setInterval(playRing, 4000);
    }
  } catch {
    stopRing();
  }
}

for (const button of [speaker, mute]) {
  button.addEventListener('click', () => {
    button.setAttribute('aria-pressed', String(button.getAttribute('aria-pressed') !== 'true'));
    updateRing();
  });
}

for (const type of ['gesturestart', 'gesturechange']) {
  document.addEventListener(type, event => event.preventDefault(), { passive: false });
}
document.addEventListener('wheel', event => {
  if (event.ctrlKey || event.metaKey) event.preventDefault();
}, { passive: false });
document.addEventListener('keydown', event => {
  if ((event.ctrlKey || event.metaKey) && ['+', '=', '-', '0'].includes(event.key)) event.preventDefault();
});

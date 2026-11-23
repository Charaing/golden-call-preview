const screen = document.querySelector('#call-screen');
const statusLabel = document.querySelector('#call-status');
const timer = document.querySelector('#call-timer');
const activeControls = document.querySelector('#active-controls');
const endedControls = document.querySelector('#ended-controls');
const speaker = document.querySelector('#speaker');
const mute = document.querySelector('#mute');
const video = document.querySelector('#video');
const more = document.querySelector('#more');
const moreDialog = document.querySelector('#more-dialog');
const keypad = document.querySelector('#keypad');
const keypadDialog = document.querySelector('#keypad-dialog');
const digitsOutput = document.querySelector('#digits');
const deleteDigit = document.querySelector('#delete-digit');
const connect = document.querySelector('#connect');
const end = document.querySelector('#end-call');
const restart = document.querySelector('#restart');

let stage = 'dialing';
let startedAt = performance.now();
let clock = setInterval(updateTimer, 250);
let digits = '';
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
  const wantsRing = () => stage === 'dialing' && speaker.getAttribute('aria-pressed') === 'true';
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

function setDigits(value) {
  digits = value.slice(0, 32);
  digitsOutput.textContent = digits;
  deleteDigit.disabled = digits.length === 0;
}

function setStage(nextStage, mode = 'voice') {
  stage = nextStage;
  screen.dataset.stage = stage;
  const isDialing = stage === 'dialing';
  const isEnded = stage === 'ended';
  const isVideo = stage === 'connected' && mode === 'video';

  statusLabel.textContent = isVideo ? '영상 통화 중' : { dialing: '발신 중', connected: '음성 통화 중', ended: '통화 종료' }[stage];
  video.setAttribute('aria-pressed', String(isVideo));
  connect.hidden = !isDialing && !isVideo;
  activeControls.hidden = isEnded;
  endedControls.hidden = !isEnded;

  if (isDialing || isEnded) {
    clearInterval(clock);
    if (isDialing) {
      startedAt = performance.now();
      clock = setInterval(updateTimer, 250);
    }
    updateTimer();
    speaker.setAttribute('aria-pressed', 'false');
    mute.setAttribute('aria-pressed', 'false');
    setDigits('');
  }

  updateRing();
}

function toggle(button) {
  button.setAttribute('aria-pressed', String(button.getAttribute('aria-pressed') !== 'true'));
}

speaker.addEventListener('click', () => {
  toggle(speaker);
  updateRing();
});
mute.addEventListener('click', () => toggle(mute));
video.addEventListener('click', () => {
  const mode = video.getAttribute('aria-pressed') === 'true' ? 'voice' : 'video';
  setStage('connected', mode);
});
connect.addEventListener('click', () => {
  moreDialog.close();
  setStage('connected');
  end.focus();
});
end.addEventListener('click', () => { setStage('ended'); restart.focus(); });
restart.addEventListener('click', () => { setStage('dialing'); speaker.focus(); });
document.querySelector('#reset-call').addEventListener('click', () => {
  moreDialog.close();
  setStage('dialing');
});

for (const [button, dialog] of [[keypad, keypadDialog], [more, moreDialog]]) {
  button.addEventListener('click', () => {
    button.focus();
    dialog.showModal();
  });
  dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target === dialog) dialog.close();
  });
}
document.querySelector('#digit-grid').addEventListener('click', event => {
  const button = event.target.closest('button[data-digit]');
  if (button) setDigits(digits + button.dataset.digit);
});
deleteDigit.addEventListener('click', () => setDigits(digits.slice(0, -1)));
keypadDialog.addEventListener('keydown', event => {
  if (event.ctrlKey || event.altKey || event.metaKey) return;
  if (/^[0-9*#]$/.test(event.key)) {
    event.preventDefault();
    setDigits(digits + event.key);
  } else if (event.key === 'Backspace' || event.key === 'Delete') {
    event.preventDefault();
    setDigits(digits.slice(0, -1));
  }
});

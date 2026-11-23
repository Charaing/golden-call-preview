const screen = document.querySelector('#call-screen');
const statusLabel = document.querySelector('#call-status');
const timer = document.querySelector('#call-timer');
const activeControls = document.querySelector('#active-controls');
const endedControls = document.querySelector('#ended-controls');
const speaker = document.querySelector('#speaker');
const mute = document.querySelector('#mute');
const keypad = document.querySelector('#keypad');
const keypadDialog = document.querySelector('#keypad-dialog');
const digitsOutput = document.querySelector('#digits');
const deleteDigit = document.querySelector('#delete-digit');
const connect = document.querySelector('#connect');
const end = document.querySelector('#end-call');
const restart = document.querySelector('#restart');

let stage = 'dialing';
let connectedAt = 0;
let clock;
let digits = '';
let audio;
let ringInterval;
let playingTones = [];

function updateTimer() {
  const seconds = Math.floor((Date.now() - connectedAt) / 1000);
  const minutesDisplay = String(Math.floor(seconds / 60)).padStart(2, '0');
  const secondsDisplay = String(seconds % 60).padStart(2, '0');
  timer.textContent = `${minutesDisplay}:${secondsDisplay}`;
  timer.dateTime = `PT${seconds}S`;
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

function setStage(nextStage) {
  stage = nextStage;
  screen.dataset.stage = stage;
  const isDialing = stage === 'dialing';
  const isConnected = stage === 'connected';
  const isEnded = stage === 'ended';

  statusLabel.textContent = { dialing: '발신 중', connected: '연결됨', ended: '통화 종료' }[stage];
  timer.hidden = !isConnected;
  connect.hidden = !isDialing;
  activeControls.hidden = isEnded;
  endedControls.hidden = !isEnded;

  clearInterval(clock);
  if (isConnected) {
    connectedAt = Date.now();
    updateTimer();
    clock = setInterval(updateTimer, 250);
  } else {
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
connect.addEventListener('click', () => { setStage('connected'); end.focus(); });
end.addEventListener('click', () => { setStage('ended'); restart.focus(); });
restart.addEventListener('click', () => { setStage('dialing'); connect.focus(); });

keypad.addEventListener('click', () => {
  keypad.focus();
  keypadDialog.showModal();
});
document.querySelector('#close-keypad').addEventListener('click', () => keypadDialog.close());
keypadDialog.addEventListener('click', event => {
  if (event.target === keypadDialog) keypadDialog.close();
});
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

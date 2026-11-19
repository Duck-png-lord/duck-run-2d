// Music player
const musicFiles = [
    'assets/music/track1.mp3',
    'assets/music/track2.mp3',
    'assets/music/track3.mp3',
    'assets/music/track4.mp3'
];
let currentTrack = 0;
let audio = new Audio(musicFiles[currentTrack]);

// Start music
function startMusic() {
    audio.play().catch(e => console.log("Autoplay blocked:", e));
    audio.loop = false;
    audio.addEventListener('ended', () => {
        currentTrack = (currentTrack + 1) % musicFiles.length;
        audio.src = musicFiles[currentTrack];
        audio.play();
    });
}

// Stop music
function stopMusic() {
    audio.pause();
    audio.currentTime = 0;
}

// Toggle music
document.addEventListener('keydown', (e) => {
    if (e.code === 'KeyM') {
        if (audio.paused) {
            audio.play();
        } else {
            audio.pause();
        }
    }
});

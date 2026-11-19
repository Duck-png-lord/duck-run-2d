// Simple music player that works with any file in the music folder
let audio = new Audio();
let currentTrack = 0;
let musicFiles = [
    'assets/music/track1.mp3',
    'assets/music/track2.mp3',
    'assets/music/track3.mp3',
    'assets/music/track4.mp3'
];

// Start music
function startMusic() {
    audio.src = musicFiles[currentTrack];
    audio.loop = false;
    audio.volume = 0.3;
    audio.play().catch(e => console.log("Autoplay blocked:", e));

    audio.addEventListener('ended', () => {
        currentTrack = (currentTrack + 1) % musicFiles.length;
        startMusic();
    });
}

// Stop music
function stopMusic() {
    audio.pause();
    audio.currentTime = 0;
}

// Toggle music with M key
document.addEventListener('keydown', (e) => {
    if (e.code === 'KeyM') {
        if (audio.paused) {
            audio.play();
        } else {
            audio.pause();
        }
    }
});

// Music player - now works with ANY music file in the folder
let audio = new Audio();
let musicFiles = [];
let currentTrack = 0;

// Load all music files from the folder
function loadMusicFiles() {
    // This is a workaround since we can't directly list files in a folder via JS
    // Instead, we'll use a predefined list of possible extensions
    const extensions = ['.mp3', '.wav', '.ogg', '.m4a'];
    const basePath = 'assets/music/';

    // Try to load files with common names (you can customize this)
    const commonNames = ['track1', 'track2', 'track3', 'track4', 'music1', 'music2', 'song1', 'background'];

    // Try all combinations of names and extensions
    for (const name of commonNames) {
        for (const ext of extensions) {
            const filePath = basePath + name + ext;
            // Test if file exists by trying to load it
            const testAudio = new Audio(filePath);
            testAudio.load(); // This will trigger an error if file doesn't exist
            testAudio.onerror = function() {
                // File doesn't exist, skip it
            };
            testAudio.oncanplay = function() {
                // File exists, add to our playlist
                musicFiles.push(filePath);
                // Start playing if this is the first file
                if (musicFiles.length === 1) {
                    startMusic();
                }
            };
        }
    }

    // If no files found with common names, try to load all possible files
    if (musicFiles.length === 0) {
        console.log("No music files found with common names. Trying dynamic loading...");
        // This is a fallback - in a real app you'd need server-side help
        // For this demo, we'll just use some default tracks
        musicFiles = [
            'assets/music/track1.mp3',
            'assets/music/track2.mp3',
            'assets/music/track3.mp3',
            'assets/music/track4.mp3'
        ];
        startMusic();
    }
}

// Start music playback
function startMusic() {
    if (musicFiles.length === 0) {
        console.log("No music files found");
        return;
    }

    audio.src = musicFiles[currentTrack];
    audio.play().catch(e => console.log("Autoplay blocked:", e));
    audio.loop = false;
    audio.addEventListener('ended', () => {
        currentTrack = (currentTrack + 1) % musicFiles.length;
        startMusic(); // Recursively play next track
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

// Initialize music system
loadMusicFiles();

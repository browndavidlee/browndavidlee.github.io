// --- GLOBAL VARIABLE DECLARATIONS ---
const body = document.body;
const htmlElement = document.documentElement; 
const readingProgressBar = document.getElementById('readingProgressBar');
const backToTopButton = document.getElementById('backToTopBtn');
const darkModeButton = document.querySelector('.dark-mode-toggle');
const effectsToggleButton = document.getElementById('effects-toggle-btn'); 

// Background animation elements
const gradientBg = document.getElementById('gradient-pan-bg');
const waveOverlayBg = document.getElementById('wave-overlay-bg');
const atmosphereLayer = document.getElementById('atmosphere-layer');
// const portfolioContainer = document.querySelector('.portfolio-container'); // Not directly manipulated after init

// Modal Elements
const modal = document.getElementById('artifactModal');
const modalContent = modal ? modal.querySelector('.modal-content') : null;
const modalTitleEl = document.getElementById('modalTitle');
const modalArtifactNumberingEl = document.getElementById('modalArtifactNumbering');
const modalDescriptionEl = document.getElementById('modalDescription');
const modalPdfImageEmbedContainerEl = document.getElementById('modalPdfImageEmbedContainer');
const modalVideoTranscriptPlayerEl = document.getElementById('modalVideoTranscriptPlayer');
const modalTranscriptContainerEl = document.getElementById('modal-transcript-container');
const modalVideoLangSelectorEl = document.getElementById('video-language-selector');
const modalDownloadLinkEl = document.getElementById('modalDownloadLink');
const modalOpenNewTabLinkEl = document.getElementById('modalOpenNewTabLink');
const closeModalButton = modal ? modal.querySelector('.modal-close') : null;
const modalPrevButton = document.getElementById('modalPrevArtifact');
const modalNextButton = document.getElementById('modalNextArtifact');
const portfolioModalVideoPlayerDiv = document.getElementById('portfolioModalVideoPlayer');

// Modal State & Navigation & Other Global State
let currentModalTranscripts = {};
let currentModalCues = [];
let currentModalLanguage = '';
let currentModalHighlightIndex = -1;
let currentModalTranscriptPath = '';
let ytPlayer;
let timeUpdateInterval;
let isYTAPIReady = false;
let pendingPlayerDetails = null; 
let allNavigableArtifactLinks = [];
let currentNavigableArtifactIndex = -1;
const ARTIFACT_TRANSITION_DURATION = 250;
let originalBodyOverflow = ''; 
let ytApiLoadTimeout; 
let lastFocusedElementBeforeModal; // For focus management

// --- HELPER FUNCTION DEFINITIONS ---

// --- Theme Functions ---
function getStoredTheme() { 
    try {
        const storedTheme = localStorage.getItem('theme');
        if (storedTheme) return storedTheme;
        // If no theme stored, check OS preference
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return 'dark';
        }
        return 'light'; // Default
    } catch (e) {
        console.warn("localStorage unavailable. Falling back to OS preference or 'light' theme.", e);
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return 'dark';
        }
        return 'light';
    }
}
function setStoredTheme(theme) { 
    try { localStorage.setItem('theme', theme); } catch (e) { console.error("Error setting theme in localStorage", e); } 
}

function applyTheme(theme) { 
    if (!htmlElement || !body) {
        console.error("applyTheme: htmlElement or body not found");
        return;
    }
    htmlElement.setAttribute('data-theme', theme);
    body.classList.toggle('dark-mode', theme === 'dark'); 
    if (darkModeButton) {
        darkModeButton.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    }
    updateGradientPosition(); 
}

function handleToggleTheme() {
    if (!htmlElement) return;
    const currentTheme = htmlElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme); 
    setStoredTheme(newTheme);
}

// --- Effects Toggle Functions ---
function getStoredEffectsStatus() { 
    try {
        return localStorage.getItem('effectsStatus') || 'on'; 
    } catch (e) {
        console.warn("Error getting effects status from localStorage, defaulting to 'on'.", e);
        return 'on'; // No OS preference for this, so just default
    }
}
function setStoredEffectsStatus(status) { 
    try { localStorage.setItem('effectsStatus', status); } catch (e) { console.error("Error setting effects status in localStorage", e); } 
}

function applyEffectsStatus(status) {
    if (!htmlElement) return;
    htmlElement.classList.toggle('effects-off', status === 'off');
    if (effectsToggleButton) {
        effectsToggleButton.setAttribute('aria-label', status === 'off' ? 'Turn visual effects on' : 'Turn visual effects off');
    }
}

function handleToggleEffects() {
    if (!htmlElement) return;
    const isCurrentlyOff = htmlElement.classList.contains('effects-off');
    const newStatus = isCurrentlyOff ? 'on' : 'off'; 
    applyEffectsStatus(newStatus);
    setStoredEffectsStatus(newStatus);
}

// --- UI Update Functions ---
function updateReadingProgress() { 
    if (!readingProgressBar) return;
    const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
    readingProgressBar.style.width = scrollableHeight <= 0 ? '0%' : `${Math.min((window.scrollY / scrollableHeight) * 100, 100)}%`;
}

function updateGradientPosition() { 
    if (!gradientBg || !atmosphereLayer || !waveOverlayBg) return;
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const docHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight, document.body.offsetHeight, document.documentElement.offsetHeight, document.body.clientHeight, document.documentElement.clientHeight) - window.innerHeight;
    const scrollPercentage = docHeight > 0 ? Math.min(scrollTop / docHeight, 1) : 0;
    const gradientPosition = scrollPercentage * 100;
    if (gradientBg) gradientBg.style.backgroundPosition = `50% ${gradientPosition}%`;
    let atmOpacity = 0.4, waveOpacityVal = 0.5;
    if (scrollPercentage < 0.04) {}
    else if (scrollPercentage < 0.74) { const p = (scrollPercentage - 0.04) / 0.70; atmOpacity = 0.4 + (p * 0.5); waveOpacityVal = 0.5 + (p * 0.4); }
    else if (scrollPercentage < 0.90) { atmOpacity = 0.1; waveOpacityVal = 0.2; }
    else if (scrollPercentage < 0.98) { const p = (scrollPercentage - 0.90) / 0.08; atmOpacity = 0.1 + (p * 0.3); waveOpacityVal = 0.2 + (p * 0.3); }
    if (atmosphereLayer) atmosphereLayer.style.opacity = atmOpacity;
    if (waveOverlayBg) waveOverlayBg.style.opacity = waveOpacityVal;
}

function setupBackToTopButton() {
    if (!backToTopButton) return;
    let isBackToTopVisible = false;
    window.addEventListener('scroll', () => {
        const shouldBeVisible = window.scrollY > 350;
        if (shouldBeVisible && !isBackToTopVisible) {
            backToTopButton.style.display = 'flex';
            requestAnimationFrame(() => backToTopButton.style.opacity = '1');
            isBackToTopVisible = true;
        } else if (!shouldBeVisible && isBackToTopVisible) {
            backToTopButton.style.opacity = '0';
            isBackToTopVisible = false;
            const handleTransitionEnd = () => {
                if (!isBackToTopVisible) backToTopButton.style.display = 'none';
                backToTopButton.removeEventListener('transitionend', handleTransitionEnd);
            };
            if (parseFloat(getComputedStyle(backToTopButton).transitionDuration) > 0) {
                backToTopButton.addEventListener('transitionend', handleTransitionEnd, { once: true });
            } else {
                backToTopButton.style.display = 'none';
            }
        }
    });
    backToTopButton.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

// --- MODAL, SRT, YOUTUBE PLAYER FUNCTIONS OBJECT ---
const modalFunctions = {
    srtTimeToSeconds: function(timeString) {
        const [hours, minutes, secondsMillis] = timeString.split(':');
        const [seconds, milliseconds] = secondsMillis.split(',');
        return parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds) + parseInt(milliseconds) / 1000;
    },
    parseSRT: function(srtText) {
        const subtitleBlocks = srtText.trim().replace(/\r/g, '').split(/\n\n/);
        return subtitleBlocks.map(block => {
            const lines = block.split('\n');
            if (lines.length < 3) return null;
            const id = lines[0];
            const timeMatch = lines[1].match(/(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/);
            if (!timeMatch) return null;
            const startTime = this.srtTimeToSeconds(timeMatch[1]); 
            const endTime = this.srtTimeToSeconds(timeMatch[2]);   
            const text = lines.slice(2).join(' ').trim();
            return { id, startTime, endTime, text };
        }).filter(cue => cue !== null);
    },
    displayModalTranscript: function(parsedCues) {
        if (!modalTranscriptContainerEl) return;
        modalTranscriptContainerEl.innerHTML = '';
        if (!parsedCues || parsedCues.length === 0) {
            modalTranscriptContainerEl.innerHTML = `<p>Transcript for this language is not available or empty.</p>`;
            return;
        }
        parsedCues.forEach((cue, index) => {
            const p = document.createElement('p');
            p.classList.add('transcript-segment');
            p.textContent = cue.text;
            p.dataset.startTime = cue.startTime;
            p.dataset.cueIndex = index;
            cue.element = p; 
            p.addEventListener('click', () => {
                if (ytPlayer && typeof ytPlayer.seekTo === 'function') {
                    ytPlayer.seekTo(cue.startTime, true);
                    if (ytPlayer.getPlayerState() !== YT.PlayerState.PLAYING) {
                        ytPlayer.playVideo();
                    }
                }
            });
            modalTranscriptContainerEl.appendChild(p);
        });
        currentModalHighlightIndex = -1; 
        this.synchronizeModalTranscript(); 
    },
    synchronizeModalTranscript: function() {
        if (!currentModalCues.length || !ytPlayer || typeof ytPlayer.getCurrentTime !== 'function' || typeof ytPlayer.getPlayerState !== 'function' || !modalTranscriptContainerEl) return;
        const playerState = ytPlayer.getPlayerState();
        if (playerState === YT.PlayerState.UNSTARTED || playerState === YT.PlayerState.CUED || playerState === -1) {
            if (currentModalHighlightIndex !== -1 && currentModalCues[currentModalHighlightIndex] && currentModalCues[currentModalHighlightIndex].element) {
                currentModalCues[currentModalHighlightIndex].element.classList.remove('highlight');
            }
            currentModalHighlightIndex = -1;
            return;
        }
        const currentTime = ytPlayer.getCurrentTime();
        let activeCueIndex = -1;
        for (let i = 0; i < currentModalCues.length; i++) {
            const cue = currentModalCues[i];
            if (currentTime >= cue.startTime && currentTime < cue.endTime) {
                activeCueIndex = i;
                break;
            }
        }
        if (activeCueIndex !== currentModalHighlightIndex) {
            if (currentModalHighlightIndex !== -1 && currentModalCues[currentModalHighlightIndex] && currentModalCues[currentModalHighlightIndex].element) {
                currentModalCues[currentModalHighlightIndex].element.classList.remove('highlight');
            }
            if (activeCueIndex !== -1 && currentModalCues[activeCueIndex] && currentModalCues[activeCueIndex].element) {
                currentModalCues[activeCueIndex].element.classList.add('highlight');
                currentModalCues[activeCueIndex].element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
            currentModalHighlightIndex = activeCueIndex;
        }
    },
    loadAndSetModalTranscript: async function(lang) {
        if (!modalTranscriptContainerEl || !modalVideoLangSelectorEl) return;
        if (currentModalLanguage === lang && currentModalTranscripts[lang] && currentModalTranscripts[lang].length > 0) {
            currentModalCues = currentModalTranscripts[lang];
            this.displayModalTranscript(currentModalCues); 
            modalVideoLangSelectorEl.querySelectorAll('button').forEach(btn => btn.classList.toggle('active', btn.dataset.lang === lang));
            return;
        }
        modalTranscriptContainerEl.innerHTML = '<p>Loading transcript...</p>';
        const srtPath = `${currentModalTranscriptPath}${lang}.srt`;
        const controller = new AbortController();
        const fetchTimeoutId = setTimeout(() => controller.abort(), 8000); // 8-second timeout

        try {
            let srtText;
            if (typeof fetch === 'function') {
                const response = await fetch(srtPath, { signal: controller.signal });
                clearTimeout(fetchTimeoutId);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status} for ${srtPath}`);
                srtText = await response.text();
            } else { // Fallback for XMLHttpRequest
                clearTimeout(fetchTimeoutId); // XHR has its own timeout, but clear this one
                srtText = await new Promise((resolve, reject) => {
                    const xhr = new XMLHttpRequest();
                    xhr.open('GET', srtPath, true);
                    xhr.timeout = 8000; // 8-second timeout for XHR
                    xhr.onload = () => {
                        if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.responseText);
                        else reject(new Error(`HTTP error! status: ${xhr.status} for ${srtPath}`));
                    };
                    xhr.onerror = () => reject(new Error('Network error loading transcript'));
                    xhr.ontimeout = () => reject(new Error('Network timeout loading transcript (XHR)'));
                    xhr.send();
                });
            }

            if (!currentModalTranscripts[lang] || currentModalTranscripts[lang].length === 0) {
                currentModalTranscripts[lang] = this.parseSRT(srtText); 
            }
            currentModalCues = currentModalTranscripts[lang];
            currentModalLanguage = lang;
            this.displayModalTranscript(currentModalCues); 
            modalVideoLangSelectorEl.querySelectorAll('button').forEach(btn => btn.classList.toggle('active', btn.dataset.lang === lang));
        } catch (error) {
            clearTimeout(fetchTimeoutId); // Ensure timeout is cleared on error too
            console.error(`Error loading transcript for ${lang} from ${srtPath}:`, error);
            let errorMessage = `Error loading ${lang} transcript.`;
            if (error.name === 'AbortError' || (error.message && error.message.includes('timeout'))) {
                errorMessage += ' Network timeout. Please check your connection.';
            } else {
                errorMessage += ' Please check file path and format, or try again later.';
            }
            modalTranscriptContainerEl.innerHTML = `<p style="color: red;">${errorMessage}</p>`;
            currentModalCues = [];
        }
    },
    setupModalVideoLangSelector: function(availableLangsStr, defaultLang = 'en') {
        if (!modalVideoLangSelectorEl || !modalTranscriptContainerEl) return;
        modalVideoLangSelectorEl.innerHTML = '';
        if (!availableLangsStr) {
            modalTranscriptContainerEl.innerHTML = '<p>No transcript languages specified for this video.</p>';
            return;
        }
        const langs = availableLangsStr.split(',').map(s => s.trim()).filter(s => s);
        if (langs.length === 0) {
             modalTranscriptContainerEl.innerHTML = '<p>No transcript languages configured.</p>';
             return;
        }
        langs.forEach(langCode => {
            const button = document.createElement('button');
            button.dataset.lang = langCode;
            let langName = langCode.toUpperCase();
            if (langCode === 'en') langName = 'English';
            if (langCode === 'ko') langName = '한국어';
            if (langCode === 'zh') langName = '中文';
            if (langCode === 'ar') langName = 'العربية';
            button.textContent = langName;
            button.addEventListener('click', () => this.loadAndSetModalTranscript(langCode)); 
            modalVideoLangSelectorEl.appendChild(button);
        });
        const langToLoad = langs.includes(defaultLang) ? defaultLang : (langs.length > 0 ? langs[0] : null);
        if (langToLoad) {
            this.loadAndSetModalTranscript(langToLoad); 
        } else {
            modalTranscriptContainerEl.innerHTML = '<p>No transcripts available.</p>';
        }
    },
    onYouTubeIframeAPIReady: function() { 
        if (ytApiLoadTimeout) clearTimeout(ytApiLoadTimeout);
        isYTAPIReady = true; 
        console.log("YouTube Iframe API is ready.");
        if (pendingPlayerDetails) { 
            this.createYTPlayer(pendingPlayerDetails.videoId, pendingPlayerDetails.transcriptPath, pendingPlayerDetails.availableLangs); 
            pendingPlayerDetails = null; 
        } 
    },
    createYTPlayer: function(videoId, transcriptPath, availableLangs) {
        if (!portfolioModalVideoPlayerDiv) { console.error("Player div 'portfolioModalVideoPlayer' not found."); return; }
        
        if (typeof YT === 'undefined' || typeof YT.Player === 'undefined') {
            console.error("YouTube API not loaded or YT.Player is undefined.");
            portfolioModalVideoPlayerDiv.innerHTML = `<p style="color:red; text-align:center; padding:20px;">Video player components are not available. Please try refreshing. <br><a href="https://www.youtube.com/watch?v=${videoId}" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:underline;">Watch on YouTube</a></p>`;
            if (!isYTAPIReady) { 
                 pendingPlayerDetails = { videoId: videoId, transcriptPath: transcriptPath, availableLangs: availableLangs };
            }
            return;
        }

        portfolioModalVideoPlayerDiv.innerHTML = '';
        if (ytPlayer && typeof ytPlayer.destroy === 'function') { ytPlayer.destroy(); ytPlayer = null; }
        clearInterval(timeUpdateInterval);
        let currentOrigin = window.location.protocol + '//' + window.location.hostname;
        if (window.location.port) currentOrigin += ':' + window.location.port;
        if (window.location.protocol === "file:") currentOrigin = undefined;
        
        const self = this; 
        ytPlayer = new YT.Player('portfolioModalVideoPlayer', {
            height: '100%', width: '100%', videoId: videoId,
            playerVars: { 'playsinline': 1, 'rel': 0, 'modestbranding': 1, 'origin': currentOrigin },
            events: {
                'onReady': () => { currentModalTranscriptPath = transcriptPath; self.setupModalVideoLangSelector(availableLangs); console.log(`YouTube player ready for videoId: ${videoId}`); },
                'onStateChange': (event) => {
                    if (event.data === YT.PlayerState.PLAYING) { clearInterval(timeUpdateInterval); timeUpdateInterval = setInterval(() => self.synchronizeModalTranscript(), 250); } 
                    else { clearInterval(timeUpdateInterval); }
                    if (event.data === YT.PlayerState.ENDED || event.data === YT.PlayerState.PAUSED) { self.synchronizeModalTranscript(); }
                },
                'onError': (event) => { 
                    console.error("YouTube Player Error Code:", event.data, "for videoId:", videoId); 
                    let errorMsg = "An error occurred with the YouTube video player.";
                    if (event.data === 2) errorMsg = "Invalid YouTube video ID or video is private.";
                    else if (event.data === 5) errorMsg = "HTML5 Player error.";
                    else if (event.data === 100) errorMsg = "Video not found or has been removed.";
                    else if (event.data === 101 || event.data === 150) errorMsg = "Embedding disabled by the video owner.";
                    if (portfolioModalVideoPlayerDiv) {
                        portfolioModalVideoPlayerDiv.innerHTML = `<p style="color:red; text-align:center; padding:20px;">${errorMsg}<br><small>(Error code: ${event.data})</small> <br><a href="https://www.youtube.com/watch?v=${videoId}" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:underline;">Watch on YouTube</a></p>`;
                    }
                }
            }
        });
    },
    _updateModalDOMWithArtifactData: function(data) {
        if (!modalTitleEl) { return; } 
        modalTitleEl.textContent = data.title || "Artifact";
        if (modalDescriptionEl) modalDescriptionEl.textContent = data.description || "";
        if (modalArtifactNumberingEl) {
            if (currentNavigableArtifactIndex !== -1 && allNavigableArtifactLinks.length > 0) {
                modalArtifactNumberingEl.textContent = `${currentNavigableArtifactIndex + 1} / ${allNavigableArtifactLinks.length}`;
                modalArtifactNumberingEl.style.display = 'inline';
            } else {
                modalArtifactNumberingEl.textContent = '';
                modalArtifactNumberingEl.style.display = 'none';
            }
        }
        if(modalPdfImageEmbedContainerEl) { modalPdfImageEmbedContainerEl.style.display = 'none'; modalPdfImageEmbedContainerEl.innerHTML = ''; }
        if(modalVideoTranscriptPlayerEl) modalVideoTranscriptPlayerEl.style.display = 'none';
        if(portfolioModalVideoPlayerDiv) portfolioModalVideoPlayerDiv.innerHTML = ''; 
        if(modalVideoLangSelectorEl) { modalVideoLangSelectorEl.style.display = 'none'; modalVideoLangSelectorEl.innerHTML = ''; }
        if(modalTranscriptContainerEl) modalTranscriptContainerEl.innerHTML = '<p>Select a language to load the transcript.</p>';
        currentModalTranscripts = {}; currentModalCues = []; currentModalLanguage = ''; currentModalHighlightIndex = -1;
        currentModalTranscriptPath = data.transcriptPath || '';
        if (modalDownloadLinkEl && modalOpenNewTabLinkEl) {
            if (data.fileUrl) {
                modalDownloadLinkEl.href = data.fileUrl; modalOpenNewTabLinkEl.href = data.fileUrl;
                modalDownloadLinkEl.style.display = 'inline-block'; modalOpenNewTabLinkEl.style.display = 'inline-block';
            } else {
                modalDownloadLinkEl.style.display = 'none'; modalOpenNewTabLinkEl.style.display = 'none';
            }
        }
        if (data.videoId && data.transcriptPath && data.availableLangs) {
            if(modalVideoTranscriptPlayerEl) modalVideoTranscriptPlayerEl.style.display = 'flex'; 
            if(modalVideoLangSelectorEl) modalVideoLangSelectorEl.style.display = 'block'; 
            if (isYTAPIReady && typeof YT !== 'undefined' && YT.Player) { 
                this.createYTPlayer(data.videoId, data.transcriptPath, data.availableLangs); 
            } else { 
                if(portfolioModalVideoPlayerDiv) portfolioModalVideoPlayerDiv.innerHTML = '<p>Initializing video player...</p>'; 
                pendingPlayerDetails = { videoId: data.videoId, transcriptPath: data.transcriptPath, availableLangs: data.availableLangs }; 
                if (!isYTAPIReady) {
                    if (ytApiLoadTimeout) clearTimeout(ytApiLoadTimeout);
                    ytApiLoadTimeout = setTimeout(() => {
                        if (!isYTAPIReady && pendingPlayerDetails && portfolioModalVideoPlayerDiv && modal && modal.style.display === 'flex' && modalVideoTranscriptPlayerEl && modalVideoTranscriptPlayerEl.style.display !== 'none' && pendingPlayerDetails.videoId === data.videoId) {
                            console.warn("YouTube Iframe API still not ready after 10 seconds. Video might not load.");
                            portfolioModalVideoPlayerDiv.innerHTML = `<p style="color:red; text-align:center; padding:20px;">Video player failed to initialize. Please check your connection or try refreshing. <br><a href="https://www.youtube.com/watch?v=${data.videoId}" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:underline;">Watch on YouTube</a></p>`;
                        }
                    }, 10000); 
                }
            }
            if (modalDownloadLinkEl && modalOpenNewTabLinkEl) {
                if (data.type === 'pdf' && data.fileUrl) { modalDownloadLinkEl.textContent = "Download Plan (PDF)"; modalOpenNewTabLinkEl.textContent = "Open Plan in New Tab";  } 
                else if (data.fileUrl) { modalDownloadLinkEl.textContent = "Download Associated PDF"; modalOpenNewTabLinkEl.textContent = "Open Associated PDF in New Tab"; } 
                else { modalDownloadLinkEl.style.display = 'none'; modalOpenNewTabLinkEl.style.display = 'none'; }
            }
        } else if (data.type === 'pdf' && data.fileUrl) { 
            if(modalPdfImageEmbedContainerEl) modalPdfImageEmbedContainerEl.style.display = 'block';
            const embedElement = document.createElement('iframe'); embedElement.src = data.fileUrl; embedElement.title = (data.title || "PDF") + " PDF Preview"; embedElement.type = "application/pdf";
            if(modalPdfImageEmbedContainerEl) modalPdfImageEmbedContainerEl.appendChild(embedElement);
            if (modalDownloadLinkEl) modalDownloadLinkEl.textContent = "Download PDF"; if(modalOpenNewTabLinkEl) modalOpenNewTabLinkEl.textContent = "Open PDF in New Tab";
        } else if (data.type === 'image' && data.fileUrl) { 
            if(modalPdfImageEmbedContainerEl) modalPdfImageEmbedContainerEl.style.display = 'block';
            const imgElement = document.createElement('img'); imgElement.src = data.fileUrl; imgElement.alt = (data.title || "Image") + " Preview";
            if(modalPdfImageEmbedContainerEl) modalPdfImageEmbedContainerEl.appendChild(imgElement);
            if (modalDownloadLinkEl) modalDownloadLinkEl.textContent = "Download Image"; if(modalOpenNewTabLinkEl) modalOpenNewTabLinkEl.textContent = "Open Image in New Tab";
        } else { 
             if(modalPdfImageEmbedContainerEl) { modalPdfImageEmbedContainerEl.style.display = 'block'; modalPdfImageEmbedContainerEl.innerHTML = '<p>Preview not available for this artifact type.</p>';}
             if (modalDownloadLinkEl) modalDownloadLinkEl.style.display = 'none'; if(modalOpenNewTabLinkEl) modalOpenNewTabLinkEl.style.display = 'none';
        }
    },
    updateNavigationArrowStates: function() {
        if (!modalPrevButton || !modalNextButton || !modal) return;
        const canNavigate = modal.style.display === 'flex' && allNavigableArtifactLinks.length > 1;
        modalPrevButton.style.display = canNavigate ? 'flex' : 'none';
        modalNextButton.style.display = canNavigate ? 'flex' : 'none';
        if (canNavigate) { modalPrevButton.disabled = (currentNavigableArtifactIndex <= 0); modalNextButton.disabled = (currentNavigableArtifactIndex >= allNavigableArtifactLinks.length - 1); } 
        else { modalPrevButton.disabled = true; modalNextButton.disabled = true; }
    },
    navigateToArtifact: async function(newIndex) {
        if (newIndex < 0 || newIndex >= allNavigableArtifactLinks.length || newIndex === currentNavigableArtifactIndex) return; 
        if (!modalContent || !allNavigableArtifactLinks[newIndex]) { return; }
        modalContent.classList.add('is-transitioning');
        await new Promise(resolve => setTimeout(resolve, ARTIFACT_TRANSITION_DURATION * 0.8)); 
        if (ytPlayer && typeof ytPlayer.destroy === 'function') { ytPlayer.destroy(); ytPlayer = null; }
        clearInterval(timeUpdateInterval);
        currentNavigableArtifactIndex = newIndex;
        const linkToLoad = allNavigableArtifactLinks[currentNavigableArtifactIndex];
        const artifactItem = linkToLoad.closest('.artifact-item');
        if (!artifactItem) { 
            console.error("Could not find artifact item for navigation.");
            if (modalContent) modalContent.classList.remove('is-transitioning'); 
            return; 
        }
        const titleEl = artifactItem.querySelector('strong');
        const descriptionEl = artifactItem.querySelector('.description');
        const artifactData = {
            title: titleEl ? titleEl.textContent : "Artifact", description: descriptionEl ? descriptionEl.textContent : "View this artifact.",
            fileUrl: linkToLoad.href, type: linkToLoad.dataset.type, videoId: linkToLoad.dataset.videoId,
            transcriptPath: linkToLoad.dataset.transcriptPath, availableLangs: linkToLoad.dataset.availableLangs
        };
        this._updateModalDOMWithArtifactData(artifactData); 
        this.updateNavigationArrowStates(); 
        requestAnimationFrame(() => { requestAnimationFrame(() => { if (modalContent) modalContent.classList.remove('is-transitioning'); }); });
    },
    showNextNavigableArtifact: function() { this.navigateToArtifact(currentNavigableArtifactIndex + 1); },
    showPreviousNavigableArtifact: function() { this.navigateToArtifact(currentNavigableArtifactIndex - 1); },
    
    // Wrapped version of openInitialModal for error handling
    safeOpenInitialModal: async function(artifactLinkElement) {
        try {
            await this.openInitialModal(artifactLinkElement);
        } catch (error) {
            console.error("Error opening modal:", error, "Attempting to open link in new tab as fallback.");
            if (artifactLinkElement && artifactLinkElement.href) {
                window.open(artifactLinkElement.href, '_blank', 'noopener,noreferrer');
            } else {
                alert("Sorry, there was an error displaying this artifact, and a fallback link is not available.");
            }
        }
    },

    openInitialModal: async function(artifactLinkElement) { // Original logic, now called by safeOpenInitialModal
        if (!modal || !modalContent || !artifactLinkElement) { 
            console.error("Modal, modalContent, or artifactLinkElement is missing.");
            throw new Error("Modal component missing for openInitialModal"); // Throw to be caught by safeOpenInitialModal
        }
        
        lastFocusedElementBeforeModal = document.activeElement; // Store focus

        currentNavigableArtifactIndex = allNavigableArtifactLinks.indexOf(artifactLinkElement);
        const artifactItem = artifactLinkElement.closest('.artifact-item');
        if (!artifactItem) { 
            console.error("Could not find artifact item for modal open.");
            throw new Error("Artifact item not found for openInitialModal");
        }
        const titleEl = artifactItem.querySelector('strong');
        const descriptionEl = artifactItem.querySelector('.description');
        const artifactData = {
            title: titleEl ? titleEl.textContent : "Artifact", description: descriptionEl ? descriptionEl.textContent : "View this artifact.",
            fileUrl: artifactLinkElement.href, type: artifactLinkElement.dataset.type, videoId: artifactLinkElement.dataset.videoId,
            transcriptPath: artifactLinkElement.dataset.transcriptPath, availableLangs: artifactLinkElement.dataset.availableLangs
        };
        if (body) { 
            originalBodyOverflow = body.style.overflow; 
            body.style.overflow = 'hidden';
        }
        modalContent.classList.add('is-transitioning'); modal.style.display = 'flex'; 
        this._updateModalDOMWithArtifactData(artifactData); 
        this.updateNavigationArrowStates(); 
        requestAnimationFrame(() => { requestAnimationFrame(() => {
            if (modalContent) modalContent.classList.remove('is-transitioning');
            const firstFocusableElement = modal.querySelector('.modal-close, button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
            if (firstFocusableElement) firstFocusableElement.focus();
        }); });
    },
    closePortfolioModal: function() {
        if (!modal) return;
        if (ytApiLoadTimeout) clearTimeout(ytApiLoadTimeout);
        if (ytPlayer && typeof ytPlayer.stopVideo === 'function') ytPlayer.stopVideo();
        if (ytPlayer && typeof ytPlayer.destroy === 'function') { ytPlayer.destroy(); ytPlayer = null; }
        clearInterval(timeUpdateInterval);
        if (modalArtifactNumberingEl) modalArtifactNumberingEl.textContent = '';
        currentNavigableArtifactIndex = -1;
        modal.style.display = 'none';
        if (modalContent) modalContent.classList.remove('is-transitioning');
        this.updateNavigationArrowStates(); 
        if (body) { 
            body.style.overflow = originalBodyOverflow;
        }
        if (lastFocusedElementBeforeModal) { // Restore focus
            try {
                lastFocusedElementBeforeModal.focus();
            } catch (e) {
                console.warn("Could not restore focus to previous element:", e);
            }
            lastFocusedElementBeforeModal = null;
        }
    },
    setupSwipeNavigation: function() {
        if (!modal || !modalContent) return;
        let touchStartX = 0, touchEndX = 0, touchStartY = 0, touchEndY = 0;
        const swipeThreshold = 50; const swipeMaxVertical = 75; 
        modalContent.addEventListener('touchstart', (event) => {
            if (event.target.closest('button, a, iframe, embed, #portfolioModalVideoPlayer, #modalTranscriptContainer, .modal-glide-arrow') || allNavigableArtifactLinks.length <= 1) { touchStartX = 0; return; }
            touchStartX = event.changedTouches[0].screenX; touchStartY = event.changedTouches[0].screenY;
        }, { passive: true });
        modalContent.addEventListener('touchend', (event) => {
            if (touchStartX === 0 || allNavigableArtifactLinks.length <= 1) return;
            touchEndX = event.changedTouches[0].screenX; touchEndY = event.changedTouches[0].screenY;
            const deltaX = touchEndX - touchStartX; const deltaY = touchEndY - touchStartY;
            if (Math.abs(deltaX) > swipeThreshold && Math.abs(deltaY) < swipeMaxVertical) {
                if (deltaX < 0) this.showNextNavigableArtifact(); else this.showPreviousNavigableArtifact(); 
            }
            touchStartX = 0; touchStartY = 0;
        }, { passive: true });
    }
};
window.onYouTubeIframeAPIReady = () => modalFunctions.onYouTubeIframeAPIReady();


// --- DOMContentLoaded ---
document.addEventListener('DOMContentLoaded', () => {
    applyTheme(getStoredTheme()); 
    applyEffectsStatus(getStoredEffectsStatus()); 
    updateReadingProgress();
    updateGradientPosition();
    setupBackToTopButton();

    allNavigableArtifactLinks = Array.from(document.querySelectorAll('.artifact-link[data-nav-sequence]'))
        .sort((a, b) => {
            const seqA = parseInt(a.dataset.navSequence, 10);
            const seqB = parseInt(b.dataset.navSequence, 10);
            if (isNaN(seqA) && isNaN(seqB)) return 0;
            if (isNaN(seqA)) return 1;
            if (isNaN(seqB)) return -1;
            return seqA - seqB;
        });

    document.querySelectorAll('.artifact-link[data-type]').forEach(link => {
        link.addEventListener('click', function(event) {
            event.preventDefault(); 
            modalFunctions.safeOpenInitialModal(this); // Use the safe wrapper
        });
    });

    if (closeModalButton) closeModalButton.addEventListener('click', () => modalFunctions.closePortfolioModal());
    if (modalPrevButton) modalPrevButton.addEventListener('click', () => modalFunctions.showPreviousNavigableArtifact());
    if (modalNextButton) modalNextButton.addEventListener('click', () => modalFunctions.showNextNavigableArtifact());
    
    if (effectsToggleButton) {
        effectsToggleButton.addEventListener('click', handleToggleEffects);
    } else {
        console.error('CRITICAL: effectsToggleButton (id="effects-toggle-btn") NOT FOUND in DOMContentLoaded!');
    }
    
    if (darkModeButton) {
        darkModeButton.addEventListener('click', handleToggleTheme);
    } else {
        console.error('CRITICAL: darkModeButton (class="dark-mode-toggle") NOT FOUND in DOMContentLoaded!');
    }
        
    window.addEventListener('click', (event) => { 
        if (modal && event.target === modal) modalFunctions.closePortfolioModal(); 
    });
    window.addEventListener('keydown', (event) => { 
        if (modal && modal.style.display === 'flex') {
            if (event.key === 'Escape') modalFunctions.closePortfolioModal(); 
            if (allNavigableArtifactLinks.length > 1) {
                if (event.key === 'ArrowLeft') modalFunctions.showPreviousNavigableArtifact(); 
                if (event.key === 'ArrowRight') modalFunctions.showNextNavigableArtifact(); 
            }
        }
    });

    modalFunctions.setupSwipeNavigation(); 

    try { 
        const currentStoredTheme = localStorage.getItem('theme'); // Check if user has already set a theme
        if (!currentStoredTheme) { // Only apply OS preference if no theme is stored
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
            if (prefersDark.matches) {
                applyTheme('dark');
                // No need to setStoredTheme here, as it's an OS preference, not user choice yet
            }
            
            prefersDark.addEventListener('change', (e) => { 
                // Only update if user hasn't manually set a theme
                if (!localStorage.getItem('theme')) { 
                    applyTheme(e.matches ? 'dark' : 'light'); 
                }
            });
        }
    } catch (e) { console.warn("Could not access OS color scheme preference or localStorage:", e); }

    const toggleWelcomeTextBtn = document.getElementById('toggleWelcomeTextBtn');
    const moreWelcomeText = document.getElementById('moreWelcomeText');
    if (toggleWelcomeTextBtn && moreWelcomeText) {
        toggleWelcomeTextBtn.addEventListener('click', () => {
            const isExpanded = moreWelcomeText.style.display === 'block';
            moreWelcomeText.style.display = isExpanded ? 'none' : 'block';
            toggleWelcomeTextBtn.textContent = isExpanded ? 'See More' : 'See Less';
            toggleWelcomeTextBtn.setAttribute('aria-expanded', String(!isExpanded));
        });
    }
});

window.addEventListener('scroll', () => { updateReadingProgress(); updateGradientPosition(); });
window.addEventListener('resize', () => { updateReadingProgress(); updateGradientPosition(); });
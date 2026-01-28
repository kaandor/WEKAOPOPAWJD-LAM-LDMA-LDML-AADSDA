
let isInputControl = false;
let currentFocus = null;
let deviceMode = null;

export function getDeviceMode() {
  if (deviceMode) return deviceMode;
  
  // Check localStorage override
  const manualMode = typeof localStorage !== 'undefined' ? localStorage.getItem('klyx_tv_mode') : null;
  if (manualMode === 'true') {
    deviceMode = 'tv';
    if (typeof document !== "undefined" && document.body) {
      document.body.dataset.deviceMode = deviceMode;
    }
    return deviceMode;
  }

  // Auto-detect TV via User Agent (if not explicitly disabled)
  if (manualMode !== 'false') {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent.toLowerCase() : '';
    const isSmartTV = 
      ua.includes('smart-tv') || 
      ua.includes('smarttv') || 
      ua.includes('googletv') || 
      ua.includes('android tv') || 
      ua.includes('webos') || 
      ua.includes('web0s') || 
      ua.includes('tizen') ||
      ua.includes('bravia') ||
      ua.includes('netcast') ||
      ua.includes('viera') ||
      ua.includes('large screen');
    
    if (isSmartTV) {
      deviceMode = 'tv';
      if (typeof document !== "undefined" && document.body) {
        document.body.dataset.deviceMode = deviceMode;
      }
      return deviceMode;
    }
  }

  const isTouch =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(pointer: coarse)").matches;
  const width =
    typeof window !== "undefined" && window.innerWidth
      ? window.innerWidth
      : document.documentElement.clientWidth;
  const height =
    typeof window !== "undefined" && window.innerHeight
      ? window.innerHeight
      : document.documentElement.clientHeight;
  const isLandscape = width >= height;
  if (!isTouch) {
    deviceMode = "desktop";
  } else if (isTouch && isLandscape && width >= 960) {
    deviceMode = "tv";
  } else {
    deviceMode = "mobile";
  }
  if (typeof document !== "undefined" && document.body) {
    document.body.dataset.deviceMode = deviceMode;
  }
  return deviceMode;
}

// Key codes map
export const KEYS = {
  LEFT: 37,
  UP: 38,
  RIGHT: 39,
  DOWN: 40,
  ENTER: 13,
  BACK: 8, // Backspace
  ESCAPE: 27,
  // TV Remote specific codes (WebOS, Tizen, Android TV)
  RED: 403,
  GREEN: 404,
  YELLOW: 405,
  BLUE: 406,
  RW: 412,
  PAUSE: 19,
  FF: 417,
  PLAY: 415,
  STOP: 413,
  REC: 416,
  BACK_TIZEN: 10009,
  BACK_WEBOS: 461
};

let initialized = false;

export function initInput() {
  if (initialized) return;
  const mode = getDeviceMode();
  // Only initialize TV input controls if actually in TV mode
  if (mode !== "tv") return;
  initialized = true;

  console.log("Initializing TV Input Control...");
  
  // Detect first interaction
  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('mousemove', handleMouseMove);
  
  // Initial focus if needed (optional)
  // focusFirstElement();
}

function handleMouseMove() {
  if (isInputControl) {
    isInputControl = false;
    document.body.classList.remove('using-keyboard');
    // Optional: blur current focus?
    // if (currentFocus) currentFocus.blur();
  }
}

function handleKeyDown(e) {
  const code = e.keyCode;
  
  // Map TV back keys to Backspace/Escape logic
  if (code === KEYS.BACK_TIZEN || code === KEYS.BACK_WEBOS) {
    window.history.back();
    return;
  }
  
  // If it's a navigation key
  if ([KEYS.LEFT, KEYS.UP, KEYS.RIGHT, KEYS.DOWN, KEYS.ENTER, KEYS.BACK, KEYS.ESCAPE].includes(code)) {
    if (!isInputControl) {
      isInputControl = true;
      document.body.classList.add('using-keyboard');
      
      // If nothing is focused, focus the first element
      if (!document.activeElement || document.activeElement === document.body) {
        focusFirstElement();
        e.preventDefault();
        return;
      }
    }
    
    // Handle navigation
    switch (code) {
      case KEYS.LEFT:
        moveFocus('left');
        e.preventDefault();
        break;
      case KEYS.RIGHT:
        moveFocus('right');
        e.preventDefault();
        break;
      case KEYS.UP:
        moveFocus('up');
        e.preventDefault();
        break;
      case KEYS.DOWN:
        moveFocus('down');
        e.preventDefault();
        break;
      case KEYS.ENTER:
        // Trigger click for elements that don't natively handle Enter (like divs)
        if (document.activeElement) {
          const tag = document.activeElement.tagName;
          if (tag !== 'BUTTON' && tag !== 'A' && tag !== 'INPUT') {
             document.activeElement.click();
          }
        }
        break;
      case KEYS.BACK:
      case KEYS.ESCAPE:
        window.history.back();
        break;
    }
  }
}

function getAllFocusables() {
  // Select all elements with class 'focusable' that are visible
  const elements = Array.from(document.querySelectorAll('.focusable, a[href], button, input, [tabindex]:not([tabindex="-1"])'));
  return elements.filter(el => {
    return el.offsetParent !== null && !el.classList.contains('hidden') && el.style.display !== 'none';
  });
}

function focusFirstElement() {
  const focusables = getAllFocusables();
  if (focusables.length > 0) {
    focus(focusables[0]);
  }
}

function focus(element) {
  if (!element) return;
  currentFocus = element;
  element.focus({ preventScroll: true }); // We handle scroll manually for better control
  element.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
}

function moveFocus(direction) {
  const current = document.activeElement;
  if (!current || current === document.body) {
    focusFirstElement();
    return;
  }

  const rect = current.getBoundingClientRect();
  const candidates = getAllFocusables().filter(el => el !== current);
  
  let bestCandidate = null;
  let minDistance = Infinity;

  // Center of current element
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  // Helper to calculate distance
  const getDist = (candidate, strict = true) => {
    const cRect = candidate.getBoundingClientRect();
    const ccx = cRect.left + cRect.width / 2;
    const ccy = cRect.top + cRect.height / 2;
    
    const dx = ccx - cx;
    const dy = ccy - cy;
    
    let isValid = false;
    
    // Strict cone check
    if (strict) {
      switch (direction) {
        case 'left': if (dx < 0 && Math.abs(dy) < Math.abs(dx)) isValid = true; break;
        case 'right': if (dx > 0 && Math.abs(dy) < Math.abs(dx)) isValid = true; break;
        case 'up': if (dy < 0 && Math.abs(dx) < Math.abs(dy)) isValid = true; break;
        case 'down': if (dy > 0 && Math.abs(dx) < Math.abs(dy)) isValid = true; break;
      }
    } else {
      // Relaxed check: just basic direction
      switch (direction) {
        case 'left': if (dx < 0) isValid = true; break;
        case 'right': if (dx > 0) isValid = true; break;
        case 'up': if (dy < 0) isValid = true; break;
        case 'down': if (dy > 0) isValid = true; break;
      }
    }

    if (!isValid) return Infinity;

    // Distance calculation
    const distX = Math.abs(dx);
    const distY = Math.abs(dy);
    let dist = 0;

    // Weight axis differently based on direction
    if (direction === 'left' || direction === 'right') {
       dist = Math.sqrt(distX*distX + distY*distY*4); // Penalize Y distance
    } else {
       dist = Math.sqrt(distX*distX*4 + distY*distY); // Penalize X distance
    }
    return dist;
  };

  // First pass: Strict cone check
  for (const candidate of candidates) {
    const dist = getDist(candidate, true);
    if (dist < minDistance) {
      minDistance = dist;
      bestCandidate = candidate;
    }
  }

  // Second pass: If no candidate found, relax constraints
  if (!bestCandidate) {
    for (const candidate of candidates) {
      const dist = getDist(candidate, false);
      if (dist < minDistance) {
        minDistance = dist;
        bestCandidate = candidate;
      }
    }
  }

  if (bestCandidate) {
    focus(bestCandidate);
  }
}

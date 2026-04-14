/**
 * Polystrike Arena - Mobile Touch Controls
 * Provides a virtual joystick, look swipe area, and action buttons.
 */
const touchInput = {
  active: false,
  move: { x: 0, y: 0 },
  lookDelta: { x: 0, y: 0 },
  fire: false,
  jump: false,
  
  _joystickTouchId: null,
  _lookTouchId: null,
  _joystickOrigin: { x: 0, y: 0 },
  _lastLookPos: { x: 0, y: 0 },
  
  init: function() {
    // Only initialize if the device supports touch
    if (!('ontouchstart' in window) && navigator.maxTouchPoints <= 0) return;
    
    this.active = true;
    this.createUI();
    this.bindEvents();
    
    console.log("Touch controls initialized.");
  },
  
  createUI: function() {
    const container = document.createElement('div');
    container.id = 'touch-controls-overlay';
    Object.assign(container.style, {
      position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
      pointerEvents: 'none', zIndex: '9999', display: 'flex', userSelect: 'none',
      touchAction: 'none' // Prevent browser zooming/scrolling
    });
    
    // Joystick base
    this.joystickBase = document.createElement('div');
    Object.assign(this.joystickBase.style, {
      position: 'absolute', width: '120px', height: '120px',
      borderRadius: '50%', background: 'rgba(255, 255, 255, 0.15)', 
      border: '2px solid rgba(255, 255, 255, 0.3)',
      display: 'none', pointerEvents: 'none', transform: 'translate(-50%, -50%)'
    });
    
    // Joystick knob
    this.joystickKnob = document.createElement('div');
    Object.assign(this.joystickKnob.style, {
      position: 'absolute', top: '50%', left: '50%', width: '50px', height: '50px',
      borderRadius: '50%', background: 'rgba(255, 255, 255, 0.5)',
      transform: 'translate(-50%, -50%)', pointerEvents: 'none'
    });
    
    this.joystickBase.appendChild(this.joystickKnob);
    
    // Action buttons container (bottom right)
    const actionArea = document.createElement('div');
    Object.assign(actionArea.style, {
      position: 'absolute', bottom: '30px', right: '30px',
      display: 'flex', gap: '15px', pointerEvents: 'auto'
    });
    
    // Jump button
    const jumpBtn = document.createElement('div');
    Object.assign(jumpBtn.style, {
      width: '65px', height: '65px', borderRadius: '50%',
      background: 'rgba(255, 255, 255, 0.2)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', color: '#fff',
      fontWeight: 'bold', fontFamily: 'sans-serif', fontSize: '12px',
      border: '2px solid rgba(255, 255, 255, 0.4)', userSelect: 'none'
    });
    jumpBtn.innerText = 'JUMP';
    
    jumpBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.jump = true; });
    jumpBtn.addEventListener('touchend', (e) => { e.preventDefault(); this.jump = false; });
    jumpBtn.addEventListener('touchcancel', (e) => { e.preventDefault(); this.jump = false; });
    
    actionArea.appendChild(jumpBtn);
    
    container.appendChild(this.joystickBase);
    container.appendChild(actionArea);
    document.body.appendChild(container);
  },
  
  bindEvents: function() {
    document.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
    document.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
    const handleEnd = this.handleTouchEnd.bind(this);
    document.addEventListener('touchend', handleEnd, { passive: false });
    document.addEventListener('touchcancel', handleEnd, { passive: false });
  },
  
  handleTouchStart: function(e) {
    if (!this.active || e.target.tagName === 'BUTTON') return;
    
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      const halfWidth = window.innerWidth / 2;
      
      // Left half of screen: Movement Joystick
      if (t.clientX < halfWidth && this._joystickTouchId === null) {
        this._joystickTouchId = t.identifier;
        this._joystickOrigin = { x: t.clientX, y: t.clientY };
        this.joystickBase.style.display = 'block';
        this.joystickBase.style.left = t.clientX + 'px';
        this.joystickBase.style.top = t.clientY + 'px';
      } 
      // Right half of screen (not on a button): Look / Shoot
      else if (t.clientX >= halfWidth && this._lookTouchId === null && e.target.id === 'touch-controls-overlay') {
        this._lookTouchId = t.identifier;
        this._lastLookPos = { x: t.clientX, y: t.clientY };
        this.fire = true; // Initial tap triggers fire
      }
    }
  },
  
  handleTouchMove: function(e) {
    if (!this.active) return;
    e.preventDefault(); // Prevent zooming/scrolling
    
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      
      if (t.identifier === this._joystickTouchId) {
        const dx = t.clientX - this._joystickOrigin.x;
        const dy = t.clientY - this._joystickOrigin.y;
        const dist = Math.min(Math.hypot(dx, dy), 60); // 60px max radius
        const angle = Math.atan2(dy, dx);
        
        const moveX = Math.cos(angle) * dist;
        const moveY = Math.sin(angle) * dist;
        
        this.joystickKnob.style.transform = `translate(calc(-50% + ${moveX}px), calc(-50% + ${moveY}px))`;
        
        // Normalize between -1 and 1
        this.move.x = moveX / 60;
        this.move.y = moveY / 60;
        
      } else if (t.identifier === this._lookTouchId) {
        const dx = t.clientX - this._lastLookPos.x;
        const dy = t.clientY - this._lastLookPos.y;
        
        this.lookDelta.x += dx;
        this.lookDelta.y += dy;
        
        this._lastLookPos = { x: t.clientX, y: t.clientY };
      }
    }
  },
  
  handleTouchEnd: function(e) {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      
      if (t.identifier === this._joystickTouchId) {
        this._joystickTouchId = null;
        this.move = { x: 0, y: 0 };
        this.joystickBase.style.display = 'none';
        this.joystickKnob.style.transform = `translate(-50%, -50%)`;
      } else if (t.identifier === this._lookTouchId) {
        this._lookTouchId = null;
        this.fire = false;
      }
    }
  },
  
  // Call this at the end of your main update loop in game.js to prevent spinning
  resetDeltas: function() {
    this.lookDelta.x = 0;
    this.lookDelta.y = 0;
  }
};

window.touchInput = touchInput;
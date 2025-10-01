import React, { useState, useEffect } from 'react';
import './App.css';

function BirthdayCake() {
  const [candles, setCandles] = useState([
    { id: 1, lit: true, poofing: false },
    { id: 2, lit: true, poofing: false },
    { id: 3, lit: true, poofing: false },
    { id: 4, lit: true, poofing: false },
    { id: 5, lit: true, poofing: false },
  ]);

  const [gameComplete, setGameComplete] = useState(false);
  const [showMessage, setShowMessage] = useState(false);

  const blowOutCandle = (candleId) => {
    setCandles(prev => prev.map(candle => 
      candle.id === candleId 
        ? { ...candle, lit: false, poofing: true }
        : candle
    ));

    // Remove poofing effect after animation
    setTimeout(() => {
      setCandles(prev => prev.map(candle => 
        candle.id === candleId 
          ? { ...candle, poofing: false }
          : candle
      ));
    }, 500);

    // Check if all candles are out
    setTimeout(() => {
      const allOut = candles.filter(c => c.id !== candleId).every(c => !c.lit);
      if (allOut) {
        setGameComplete(true);
        setShowMessage(true);
        // Play ta-da sound (we'll use a simple audio approach)
        playTadaSound();
      }
    }, 100);
  };

  const playTadaSound = () => {
    // Create a simple ta-da sound using Web Audio API
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // Create a cheerful melody for ta-da
    const frequencies = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    
    frequencies.forEach((freq, index) => {
      setTimeout(() => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(freq, audioContext.currentTime);
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
      }, index * 150);
    });
  };

  const resetGame = () => {
    setCandles([
      { id: 1, lit: true, poofing: false },
      { id: 2, lit: true, poofing: false },
      { id: 3, lit: true, poofing: false },
      { id: 4, lit: true, poofing: false },
      { id: 5, lit: true, poofing: false },
    ]);
    setGameComplete(false);
    setShowMessage(false);
  };

  return (
    <div className="birthday-game">
      <h1 className="birthday-title">🎂 Happy Birthday! 🎂</h1>
      <p className="instructions">Click the candles to blow them out!</p>
      
      <div className="cake-container">
        <div className="cake">
          <div className="cake-layer cake-bottom"></div>
          <div className="cake-layer cake-middle"></div>
          <div className="cake-layer cake-top"></div>
          
          <div className="candles">
            {candles.map(candle => (
              <div 
                key={candle.id} 
                className={`candle ${candle.lit ? 'lit' : ''} ${candle.poofing ? 'poofing' : ''}`}
                onClick={() => candle.lit && blowOutCandle(candle.id)}
              >
                <div className="candle-wick"></div>
                {candle.lit && (
                  <div className="flame">
                    <div className="flame-inner"></div>
                  </div>
                )}
                {candle.poofing && <div className="poof">💨</div>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {showMessage && (
        <div className="celebration">
          <div className="tada-message">
            <h2>🎉 Ta-Da! 🎉</h2>
            <p>All candles blown out! Happy Birthday!</p>
            <button onClick={resetGame} className="reset-button">
              Blow out candles again!
            </button>
          </div>
          <div className="confetti">
            {[...Array(20)].map((_, i) => (
              <div key={i} className={`confetti-piece confetti-${i % 5}`}></div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function App() {
  return (
    <div className="App">
      <BirthdayCake />
    </div>
  );
}

export default App;

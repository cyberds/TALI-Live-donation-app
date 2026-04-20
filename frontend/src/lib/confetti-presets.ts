import confetti, { CreateTypes as ConfettiInstance, Options as ConfettiOptions } from "canvas-confetti";

export const fireConfettiGun = () => {
  const end = Date.now() + 3 * 1000; // 3 seconds gun
  const colors = ["#a786ff", "#fd8bbc", "#eca184", "#f8deb1"];

  const frame = () => {
    if (Date.now() > end) return;

    confetti({
      particleCount: 2,
      angle: 60,
      spread: 55,
      startVelocity: 60,
      origin: { x: 0, y: 1 },
      colors: colors,
    });
    confetti({
      particleCount: 2,
      angle: 120,
      spread: 55,
      startVelocity: 60,
      origin: { x: 1, y: 1 },
      colors: colors,
    });

    requestAnimationFrame(frame);
  };

  frame();
};

export const fireSideCannons = () => {
  const end = Date.now() + 5 * 1000;

  (function frame() {
    confetti({
      particleCount: 2,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 1 },
    });
    confetti({
      particleCount: 2,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 1 },
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  })();
};

export const fireOversizedSprinkles = () => {
  const scalar = 3; // Huge sprinkles
  const triangle = confetti.shapeFromPath({ path: "M0 10 L5 0 L10 10z" });

  confetti({
    shapes: [triangle, "circle"],
    particleCount: 80,
    scalar,
    spread: 120,
    origin: { y: 0.4 },
    colors: ["#ff0000", "#00ff00", "#0000ff", "#ffff00", "#ff00ff"],
  });
};

export const fireEliteCelebration = (instance?: (options?: ConfettiOptions) => void) => {
    const fire = instance || (confetti as any);
    const end = Date.now() + 5 * 1000;
    const colors = ["#1F305C", "#D24B25", "#9BCB6C", "#d4af37", "#722f37"];
    
    // 1. Initial "Gun" burst from center
    fire({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      colors,
      zIndex: 99999,
      scalar: 2 // Larger center particles
    });

    // 2. Side Cannons "Shooter" effect
    const interval = setInterval(function() {
      const timeLeft = end - Date.now();
      if (timeLeft <= 0) return clearInterval(interval);

      const particleCount = 40 * (timeLeft / (5 * 1000));
      
      // Side salvos
      fire({ 
        particleCount, 
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.8 }, 
        colors,
        zIndex: 99999,
        scalar: 1.2
      });
      fire({ 
        particleCount, 
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.8 }, 
        colors,
        zIndex: 99999,
        scalar: 1.2
      });
      
      // 3. Oversized Sprinkles
      if (Math.random() > 0.6) {
          fire({
            particleCount: 3,
            origin: { x: Math.random(), y: Math.random() - 0.2 },
            colors: ['#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ffff00'],
            scalar: Math.random() * 2 + 2, // 2 to 4 scalar (VERY LARGE)
            gravity: 0.7,
            ticks: 200,
            zIndex: 99999
          });
      }
    }, 250);
};

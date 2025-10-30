import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, RotateCcw, Star, Trophy, Zap } from 'lucide-react';

const ParticleUniverse = () => {
  const canvasRef = useRef(null);
  const [isRunning, setIsRunning] = useState(false);
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [shield, setShield] = useState(100);
  const [timeLeft, setTimeLeft] = useState(30);
  const [collectedStars, setCollectedStars] = useState(0);
  const [targetStars, setTargetStars] = useState(5);
  const [gameState, setGameState] = useState('ready');
  const [highScore, setHighScore] = useState(0);
  const [laserCount, setLaserCount] = useState(1);
  const [rocketCount, setRocketCount] = useState(0);
  
  const gameStateRef = useRef({
    player: null,
    stars: [],
    enemies: [],
    bosses: [],
    bullets: [],
    enemyBullets: [],
    rockets: [],
    playerRockets: [],
    powerups: [],
    explosions: [],
    portal: null,
    starfield: [],
    shield: 100,
    collectedStars: 0,
    score: 0,
    shootCooldown: 0,
    powerupTimer: 0,
    swarmTimer: 0,
    activeRangeBoost: 0,
    activeSpeedBoost: 0,
    laserCount: 1,
    rocketCount: 0,
    rocketCooldown: 0,
    teleportEffect: 0
  });
  
  const animationRef = useRef(null);
  const mousePos = useRef({ x: 400, y: 300 });
  const isMouseDown = useRef(false);
  const keysPressed = useRef({ up: false, down: false, left: false, right: false });
  const lastTime = useRef(performance.now());
  const frameCount = useRef(0);

  const generateStarfield = (width, height) => {
    const stars = [];
    for (let i = 0; i < 150; i++) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        z: Math.random() * 3,
        size: Math.random() * 2 + 0.5,
        speed: Math.random() * 0.5 + 0.2,
        twinkle: Math.random() * Math.PI * 2
      });
    }
    return stars;
  };

  const generateLevel = useCallback((lvl) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = canvas.width;
    const height = canvas.height;

    gameStateRef.current.player = {
      x: width / 2,
      y: height - 100,
      vx: 0,
      vy: 0,
      angle: -Math.PI / 2,
      engineParticles: [],
      thrust: false
    };

    gameStateRef.current.starfield = generateStarfield(width, height);

    const starCount = Math.min(5 + lvl, 15);
    gameStateRef.current.stars = [];
    for (let i = 0; i < starCount; i++) {
      gameStateRef.current.stars.push({
        x: 100 + Math.random() * (width - 200),
        y: 50 + Math.random() * (height - 200),
        collected: false,
        pulse: Math.random() * Math.PI * 2,
        rotation: 0
      });
    }

    // Skalierung der Gegner nach Level - sanftere Kurve
    let enemyCount;
    if (lvl === 1) {
      enemyCount = 1; // Tutorial: nur 1 Gegner
    } else if (lvl <= 4) {
      enemyCount = 2; // Sanfter Einstieg
    } else if (lvl <= 7) {
      enemyCount = 3; // Lernen
    } else if (lvl <= 11) {
      enemyCount = 4; // Vorbereitung
    } else if (lvl <= 15) {
      enemyCount = 5; // Nach erstem Boss
    } else if (lvl <= 20) {
      enemyCount = 5 + Math.floor((lvl - 15) / 2); // Langsam steigern: 5-7
    } else if (lvl <= 25) {
      enemyCount = 7 + Math.floor((lvl - 20) / 2); // 7-9
    } else {
      enemyCount = Math.min(9 + Math.floor((lvl - 25) / 3), 12); // Ab Level 25: max 12
    }
    
    const enemyCooldown = Math.max(50, 140 - lvl * 3);
    gameStateRef.current.enemies = [];
    for (let i = 0; i < enemyCount; i++) {
      // Ab Level 22: Elite Gegner, aber nur 20%
      const eliteChance = lvl >= 22 ? 0.2 : 0;
      const isElite = lvl >= 22 && Math.random() < eliteChance;
      
      gameStateRef.current.enemies.push({
        x: 150 + Math.random() * (width - 300),
        y: 100 + Math.random() * (height - 300),
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        angle: Math.random() * Math.PI * 2,
        engineParticles: [],
        health: isElite ? 8 : 5,
        maxHealth: isElite ? 8 : 5,
        shootCooldown: Math.random() * enemyCooldown,
        baseCooldown: isElite ? enemyCooldown * 0.7 : enemyCooldown,
        isElite: isElite,
        dualShot: isElite
      });
    }

    gameStateRef.current.bosses = [];
    if (lvl % 3 === 0 && lvl >= 12) {
      const bossType = ((lvl / 3) - 4) % 3; // Startet bei 0 für Level 12
      
      // Boss-Stats abhängig vom Level - progressive Steigerung
      let bossConfig;
      if (lvl === 12) {
        // Erster Boss - Tutorial Boss
        bossConfig = { health: 25, size: 1.5, shootRate: 120 };
      } else if (lvl === 15) {
        // Zweiter Boss - etwas härter
        bossConfig = { health: 35, size: 1.7, shootRate: 100 };
      } else if (lvl === 18) {
        // Dritter Boss - das wird ernst
        bossConfig = { health: 50, size: 1.9, shootRate: 85 };
      } else if (lvl <= 27) {
        // Level 21, 24, 27 - schwer
        const tier = Math.floor((lvl - 21) / 3);
        bossConfig = {
          health: 60 + tier * 15,
          size: 2.1 + tier * 0.15,
          shootRate: 70 - tier * 10
        };
      } else {
        // Level 30+ - extrem schwer
        const tier = Math.floor((lvl - 30) / 3);
        bossConfig = {
          health: 100 + tier * 20,
          size: 2.4 + Math.min(tier * 0.1, 0.3),
          shootRate: Math.max(40 - tier * 5, 25)
        };
      }
      
      gameStateRef.current.bosses.push({
        x: width / 2,
        y: 100,
        vx: 1.5,
        vy: 0,
        angle: Math.PI / 2,
        health: bossConfig.health,
        maxHealth: bossConfig.health,
        shootCooldown: 0,
        engineParticles: [],
        type: bossType >= 0 ? bossType : 0,
        size: bossConfig.size,
        shootRate: bossConfig.shootRate
      });
    }

    gameStateRef.current.bullets = [];
    gameStateRef.current.enemyBullets = [];
    gameStateRef.current.rockets = [];
    gameStateRef.current.playerRockets = [];
    gameStateRef.current.powerups = [];
    gameStateRef.current.explosions = [];
    gameStateRef.current.portal = null;
    gameStateRef.current.shield = 100;
    gameStateRef.current.collectedStars = 0;
    gameStateRef.current.score = score;
    gameStateRef.current.shootCooldown = 0;
    gameStateRef.current.rocketCooldown = 0;
    gameStateRef.current.powerupTimer = Math.random() * 300 + 300;
    gameStateRef.current.swarmTimer = lvl >= 18 ? 400 : 0;
    gameStateRef.current.activeRangeBoost = 0;
    gameStateRef.current.activeSpeedBoost = 0;
    gameStateRef.current.laserCount = laserCount;
    gameStateRef.current.rocketCount = rocketCount;
    gameStateRef.current.teleportEffect = 60;

    setTargetStars(starCount);
    setCollectedStars(0);
    setTimeLeft(30 + lvl * 5);
    setShield(100);
    setGameState('ready');
  }, [score, laserCount, rocketCount]);

  useEffect(() => {
    generateLevel(level);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'r') {
        resetLevel();
      } else if (e.key === 'ArrowUp') {
        keysPressed.current.up = true;
        e.preventDefault();
      } else if (e.key === 'ArrowDown') {
        keysPressed.current.down = true;
        e.preventDefault();
      } else if (e.key === 'ArrowLeft') {
        keysPressed.current.left = true;
        e.preventDefault();
      } else if (e.key === 'ArrowRight') {
        keysPressed.current.right = true;
        e.preventDefault();
      }
    };

    const handleKeyUp = (e) => {
      if (e.key === 'ArrowUp') {
        keysPressed.current.up = false;
      } else if (e.key === 'ArrowDown') {
        keysPressed.current.down = false;
      } else if (e.key === 'ArrowLeft') {
        keysPressed.current.left = false;
      } else if (e.key === 'ArrowRight') {
        keysPressed.current.right = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useEffect(() => {
    if (gameState !== 'playing') return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setGameState('lost');
          setIsRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      mousePos.current.x = (e.clientX - rect.left) * scaleX;
      mousePos.current.y = (e.clientY - rect.top) * scaleY;
    };

    const handleMouseDown = () => {
      isMouseDown.current = true;
    };

    const handleMouseUp = () => {
      isMouseDown.current = false;
    };

    canvas.addEventListener('mousemove', handleMouseMove, { passive: true });
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseup', handleMouseUp);

    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const drawSpaceship = (ctx, x, y, angle, scale = 1, color = '#60a5fa') => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(scale, scale);

    ctx.beginPath();
    ctx.moveTo(0, -20);
    ctx.lineTo(8, 10);
    ctx.lineTo(5, 15);
    ctx.lineTo(-5, 15);
    ctx.lineTo(-8, 10);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#bfdbfe';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, -5, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#93c5fd';
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(-8, 10);
    ctx.lineTo(-15, 5);
    ctx.lineTo(-12, 12);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(8, 10);
    ctx.lineTo(15, 5);
    ctx.lineTo(12, 12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  };

  const drawEnemyShip = (ctx, x, y, angle, scale = 1, isElite = false) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(scale, scale);

    const color = isElite ? '#9333ea' : '#dc2626';
    const lightColor = isElite ? '#c084fc' : '#fca5a5';

    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(12, 0);
    ctx.lineTo(10, 12);
    ctx.lineTo(-10, 12);
    ctx.lineTo(-12, 0);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = lightColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-4, -8);
    ctx.lineTo(4, -8);
    ctx.lineTo(6, 2);
    ctx.lineTo(-6, 2);
    ctx.closePath();
    ctx.fillStyle = isElite ? '#581c87' : '#7f1d1d';
    ctx.fill();

    ctx.fillStyle = isElite ? '#6b21a8' : '#991b1b';
    ctx.fillRect(-2, -15, 4, 8);
    
    // Doppel-Laser für Elite
    if (isElite) {
      ctx.fillStyle = '#a855f7';
      ctx.fillRect(-6, -12, 2, 5);
      ctx.fillRect(4, -12, 2, 5);
    }

    ctx.restore();
  };

  const drawBoss = (ctx, x, y, angle, type, size) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(size, size);

    if (type === 0) {
      // Standard Boss
      ctx.beginPath();
      ctx.moveTo(0, -25);
      ctx.lineTo(20, -10);
      ctx.lineTo(22, 15);
      ctx.lineTo(-22, 15);
      ctx.lineTo(-20, -10);
      ctx.closePath();
      ctx.fillStyle = '#7f1d1d';
      ctx.fill();
      ctx.strokeStyle = '#fca5a5';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#450a0a';
      ctx.fillRect(-4, -30, 8, 15);
    } else if (type === 1) {
      // Dreadnought - breiter
      ctx.beginPath();
      ctx.moveTo(0, -20);
      ctx.lineTo(30, -5);
      ctx.lineTo(28, 20);
      ctx.lineTo(-28, 20);
      ctx.lineTo(-30, -5);
      ctx.closePath();
      ctx.fillStyle = '#581c87';
      ctx.fill();
      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 2;
      ctx.stroke();

      for (let i = -20; i <= 20; i += 10) {
        ctx.fillStyle = '#3b0764';
        ctx.fillRect(i - 2, -10, 4, 15);
      }
    } else {
      // Fortress - massiv
      ctx.beginPath();
      ctx.moveTo(0, -28);
      ctx.lineTo(25, -18);
      ctx.lineTo(35, 10);
      ctx.lineTo(30, 25);
      ctx.lineTo(-30, 25);
      ctx.lineTo(-35, 10);
      ctx.lineTo(-25, -18);
      ctx.closePath();
      ctx.fillStyle = '#065f46';
      ctx.fill();
      ctx.strokeStyle = '#6ee7b7';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#064e3b';
      ctx.fillRect(-15, -20, 30, 25);
      ctx.strokeRect(-15, -20, 30, 25);
    }

    ctx.restore();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    const width = canvas.width;
    const height = canvas.height;

    const animate = (now) => {
      frameCount.current++;
      const deltaTime = Math.min((now - lastTime.current) / 16.67, 3);
      lastTime.current = now;

      const gs = gameStateRef.current;
      const player = gs.player;

      gs.starfield.forEach(star => {
        star.y += star.speed * star.z * deltaTime;
        star.twinkle += 0.05;
        if (star.y > height) {
          star.y = 0;
          star.x = Math.random() * width;
        }
      });

      if (isRunning && gameState === 'playing' && player) {
        
        // Teleport effect
        if (gs.teleportEffect > 0) gs.teleportEffect--;

        // Swarm spawning - ab Level 18
        if (gs.swarmTimer > 0) {
          gs.swarmTimer--;
          if (gs.swarmTimer === 0) {
            const swarmCount = level === 18 ? 2 : Math.min(2 + Math.floor((level - 18) / 2), 6);
            const side = Math.random() < 0.5 ? 0 : width;
            const enemyCooldown = Math.max(30, 120 - level * 4);
            
            for (let i = 0; i < swarmCount; i++) {
              gs.enemies.push({
                x: side,
                y: 100 + i * 80,
                vx: (side === 0 ? 1 : -1) * (1.5 + Math.random()),
                vy: (Math.random() - 0.5) * 0.5,
                angle: side === 0 ? 0 : Math.PI,
                engineParticles: [],
                health: 5,
                maxHealth: 5,
                shootCooldown: Math.random() * enemyCooldown,
                baseCooldown: enemyCooldown,
                isElite: false,
                dualShot: false
              });
            }
            
            gs.swarmTimer = Math.max(400, 800 - level * 15);
          }
        }

        // Powerup Timer
        gs.powerupTimer--;
        if (gs.powerupTimer <= 0 && gs.powerups.length < 2) {
          const types = ['range', 'speed', 'shield', 'laser', 'rocket'];
          gs.powerups.push({
            x: 100 + Math.random() * (width - 200),
            y: 100 + Math.random() * (height - 200),
            type: types[Math.floor(Math.random() * types.length)],
            pulse: 0
          });
          gs.powerupTimer = Math.random() * 500 + 400;
        }

        if (gs.activeRangeBoost > 0) gs.activeRangeBoost--;
        if (gs.activeSpeedBoost > 0) gs.activeSpeedBoost--;

        const speedMult = gs.activeSpeedBoost > 0 ? 1.5 : 1;

        // Tastatur-Steuerung
        const keys = keysPressed.current;
        if (keys.up || keys.down || keys.left || keys.right) {
          let dx = 0;
          let dy = 0;
          
          if (keys.up) dy -= 1;
          if (keys.down) dy += 1;
          if (keys.left) dx -= 1;
          if (keys.right) dx += 1;
          
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len > 0) {
            dx /= len;
            dy /= len;
            
            const force = 0.4 * speedMult;
            player.vx += dx * force;
            player.vy += dy * force;
            player.angle = Math.atan2(dy, dx) + Math.PI / 2;
            player.thrust = true;

            if (frameCount.current % 2 === 0) {
              const exhaustX = player.x - Math.cos(player.angle - Math.PI / 2) * 15;
              const exhaustY = player.y - Math.sin(player.angle - Math.PI / 2) * 15;
              gs.player.engineParticles.push({
                x: exhaustX + (Math.random() - 0.5) * 5,
                y: exhaustY + (Math.random() - 0.5) * 5,
                vx: -Math.cos(player.angle - Math.PI / 2) * 2 + (Math.random() - 0.5),
                vy: -Math.sin(player.angle - Math.PI / 2) * 2 + (Math.random() - 0.5),
                life: 30,
                size: Math.random() * 3 + 1
              });
            }
          } else {
            player.thrust = false;
          }
        } else if (isMouseDown.current) {
          const dx = mousePos.current.x - player.x;
          const dy = mousePos.current.y - player.y;
          const distSq = dx * dx + dy * dy;
          
          if (distSq > 25) {
            const dist = Math.sqrt(distSq);
            const force = 0.3 * speedMult;
            player.vx += (dx / dist) * force;
            player.vy += (dy / dist) * force;
            player.angle = Math.atan2(dy, dx) + Math.PI / 2;
            player.thrust = true;

            if (frameCount.current % 2 === 0) {
              const exhaustX = player.x - Math.cos(player.angle - Math.PI / 2) * 15;
              const exhaustY = player.y - Math.sin(player.angle - Math.PI / 2) * 15;
              gs.player.engineParticles.push({
                x: exhaustX + (Math.random() - 0.5) * 5,
                y: exhaustY + (Math.random() - 0.5) * 5,
                vx: -Math.cos(player.angle - Math.PI / 2) * 2 + (Math.random() - 0.5),
                vy: -Math.sin(player.angle - Math.PI / 2) * 2 + (Math.random() - 0.5),
                life: 30,
                size: Math.random() * 3 + 1
              });
            }
          } else {
            player.thrust = false;
          }
        } else {
          player.thrust = false;
        }

        player.x += player.vx * deltaTime;        player.y += player.vy * deltaTime;
        player.vx *= 0.98;
        player.vy *= 0.98;

        if (player.x < 30) {
          player.x = 30;
          player.vx *= -0.5;
        } else if (player.x > width - 30) {
          player.x = width - 30;
          player.vx *= -0.5;
        }
        if (player.y < 30) {
          player.y = 30;
          player.vy *= -0.5;
        } else if (player.y > height - 30) {
          player.y = height - 30;
          player.vy *= -0.5;
        }

        gs.player.engineParticles = gs.player.engineParticles.filter(p => {
          p.x += p.vx;
          p.y += p.vy;
          p.life--;
          return p.life > 0;
        });

        // Auto-Shoot
        gs.shootCooldown--;
        const shootRange = gs.activeRangeBoost > 0 ? 350 : 200;
        
        if (gs.shootCooldown <= 0) {
          const targets = [...gs.enemies, ...gs.bosses];
          const inRange = targets.filter(t => {
            const dx = t.x - player.x;
            const dy = t.y - player.y;
            return Math.sqrt(dx * dx + dy * dy) < shootRange;
          });

          if (inRange.length > 0) {
            const nearest = inRange[0];
            
            for (let i = 0; i < gs.laserCount; i++) {
              const spreadAngle = (i - (gs.laserCount - 1) / 2) * 0.15;
              const baseAngle = Math.atan2(nearest.y - player.y, nearest.x - player.x);
              const angle = baseAngle + spreadAngle;
              
              gs.bullets.push({
                x: player.x,
                y: player.y,
                vx: Math.cos(angle) * 8,
                vy: Math.sin(angle) * 8,
                life: 60
              });
            }
            gs.shootCooldown = 15;
          }
        }

        // Player Rockets
        gs.rocketCooldown--;
        if (gs.rocketCooldown <= 0 && gs.rocketCount > 0) {
          const targets = [...gs.enemies, ...gs.bosses];
          if (targets.length > 0) {
            const nearest = targets[0];
            
            for (let i = 0; i < gs.rocketCount; i++) {
              const spreadX = (i - (gs.rocketCount - 1) / 2) * 10;
              gs.playerRockets.push({
                x: player.x + spreadX,
                y: player.y,
                vx: 0,
                vy: -2,
                targetX: nearest.x,
                targetY: nearest.y,
                angle: -Math.PI / 2,
                life: 150,
                trail: []
              });
            }
            gs.rocketCooldown = 90;
          }
        }

        gs.playerRockets = gs.playerRockets.filter(r => {
          // Homing
          const dx = r.targetX - r.x;
          const dy = r.targetY - r.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 10) {
            r.vx += (dx / dist) * 0.15;
            r.vy += (dy / dist) * 0.15;
            const speed = Math.sqrt(r.vx * r.vx + r.vy * r.vy);
            if (speed > 5) {
              r.vx = (r.vx / speed) * 5;
              r.vy = (r.vy / speed) * 5;
            }
          }
          
          r.x += r.vx;
          r.y += r.vy;
          r.angle = Math.atan2(r.vy, r.vx) + Math.PI / 2;
          r.life--;
          
          r.trail.push({ x: r.x, y: r.y });
          if (r.trail.length > 8) r.trail.shift();
          
          return r.life > 0 && r.x > 0 && r.x < width && r.y > 0 && r.y < height;
        });

        gs.bullets = gs.bullets.filter(b => {
          b.x += b.vx;
          b.y += b.vy;
          b.life--;
          return b.life > 0 && b.x > 0 && b.x < width && b.y > 0 && b.y < height;
        });

        gs.enemyBullets = gs.enemyBullets.filter(b => {
          b.x += b.vx;
          b.y += b.vy;
          b.life--;
          
          const dx = b.x - player.x;
          const dy = b.y - player.y;
          if (dx * dx + dy * dy < 400) {
            gs.shield = Math.max(0, gs.shield - 5);
            if (frameCount.current % 5 === 0) setShield(Math.round(gs.shield));
            if (gs.shield <= 0) {
              setGameState('lost');
              setIsRunning(false);
            }
            return false;
          }
          
          return b.life > 0 && b.x > 0 && b.x < width && b.y > 0 && b.y < height;
        });

        gs.rockets = gs.rockets.filter(r => {
          const dx = player.x - r.x;
          const dy = player.y - r.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 10) {
            r.vx += (dx / dist) * 0.1;
            r.vy += (dy / dist) * 0.1;
            const speed = Math.sqrt(r.vx * r.vx + r.vy * r.vy);
            if (speed > 4) {
              r.vx = (r.vx / speed) * 4;
              r.vy = (r.vy / speed) * 4;
            }
          }
          
          r.x += r.vx;
          r.y += r.vy;
          r.angle = Math.atan2(r.vy, r.vx) + Math.PI / 2;
          r.life--;
          
          r.trail.push({ x: r.x, y: r.y });
          if (r.trail.length > 10) r.trail.shift();
          
          const pdx = r.x - player.x;
          const pdy = r.y - player.y;
          if (pdx * pdx + pdy * pdy < 500) {
            gs.shield = Math.max(0, gs.shield - 15);
            setShield(Math.round(gs.shield));
            if (gs.shield <= 0) {
              setGameState('lost');
              setIsRunning(false);
            }
            
            gs.explosions.push({ x: r.x, y: r.y, size: 0, maxSize: 40, life: 30 });
            return false;
          }
          
          return r.life > 0;
        });

        // Explosions
        gs.explosions = gs.explosions.filter(e => {
          e.life--;
          e.size = e.maxSize * (1 - e.life / 30);
          return e.life > 0;
        });

        gs.powerups = gs.powerups.filter(p => {
          p.pulse += 0.1;
          const dx = p.x - player.x;
          const dy = p.y - player.y;
          if (dx * dx + dy * dy < 900) {
            if (p.type === 'range') {
              gs.activeRangeBoost = 300;
            } else if (p.type === 'speed') {
              gs.activeSpeedBoost = 300;
            } else if (p.type === 'shield') {
              gs.shield = Math.min(100, gs.shield + 30);
              setShield(Math.round(gs.shield));
            } else if (p.type === 'laser') {
              gs.laserCount++;
              setLaserCount(gs.laserCount);
            } else if (p.type === 'rocket') {
              gs.rocketCount++;
              setRocketCount(gs.rocketCount);
            }
            return false;
          }
          return true;
        });

        // Stars
        for (let i = 0; i < gs.stars.length; i++) {
          const star = gs.stars[i];
          if (!star.collected) {
            star.pulse += 0.08;
            star.rotation += 0.05;
            const dx = star.x - player.x;
            const dy = star.y - player.y;
            const distSq = dx * dx + dy * dy;
            
            if (distSq < 900) {
              star.collected = true;
              gs.collectedStars++;
              gs.score += 50;
              setCollectedStars(gs.collectedStars);
              setScore(gs.score);
              
              if (gs.collectedStars >= targetStars) {
                gs.portal = { x: width / 2, y: height / 2, size: 0, rotation: 0 };
              }
            }
          }
        }

        // Portal
        if (gs.portal) {
          gs.portal.size = Math.min(gs.portal.size + 2, 80);
          gs.portal.rotation += 0.1;
          
          const dx = gs.portal.x - player.x;
          const dy = gs.portal.y - player.y;
          if (dx * dx + dy * dy < 3600 && gs.portal.size >= 80) {
            const bonus = Math.floor(timeLeft * 10);
            const newScore = gs.score + 100 + bonus;
            setScore(newScore);
            if (newScore > highScore) {
              setHighScore(newScore);
            }
            
            setLevel(prev => prev + 1);
            setTimeout(() => {
              generateLevel(level + 1);
              setIsRunning(true);
              setGameState('playing');
            }, 100);
          }
        }

        // Enemies
        for (let i = gs.enemies.length - 1; i >= 0; i--) {
          const enemy = gs.enemies[i];
          enemy.x += enemy.vx * deltaTime;
          enemy.y += enemy.vy * deltaTime;
          enemy.angle = Math.atan2(enemy.vy, enemy.vx) + Math.PI / 2;

          if (enemy.x < 30 || enemy.x > width - 30) {
            enemy.vx *= -1;
            enemy.x = enemy.x < 30 ? 30 : width - 30;
          }
          if (enemy.y < 30 || enemy.y > height - 30) {
            enemy.vy *= -1;
            enemy.y = enemy.y < 30 ? 30 : height - 30;
          }

          if (frameCount.current % 3 === 0) {
            const exhaustX = enemy.x - Math.cos(enemy.angle - Math.PI / 2) * 12;
            const exhaustY = enemy.y - Math.sin(enemy.angle - Math.PI / 2) * 12;
            enemy.engineParticles.push({
              x: exhaustX,
              y: exhaustY,
              vx: -enemy.vx * 0.5,
              vy: -enemy.vy * 0.5,
              life: 20,
              size: Math.random() * 2 + 0.5
            });
          }

          enemy.engineParticles = enemy.engineParticles.filter(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.life--;
            return p.life > 0;
          });

          // Enemy shoot
          enemy.shootCooldown--;
          if (enemy.shootCooldown <= 0) {
            const dx = player.x - enemy.x;
            const dy = player.y - enemy.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (enemy.dualShot) {
              // Doppelschuss für Elite
              const perpX = -dy / dist;
              const perpY = dx / dist;
              const offset = 8;
              
              gs.enemyBullets.push({
                x: enemy.x + perpX * offset,
                y: enemy.y + perpY * offset,
                vx: (dx / dist) * 6,
                vy: (dy / dist) * 6,
                life: 100
              });
              
              gs.enemyBullets.push({
                x: enemy.x - perpX * offset,
                y: enemy.y - perpY * offset,
                vx: (dx / dist) * 6,
                vy: (dy / dist) * 6,
                life: 100
              });
            } else {
              gs.enemyBullets.push({
                x: enemy.x,
                y: enemy.y,
                vx: (dx / dist) * 5,
                vy: (dy / dist) * 5,
                life: 100
              });
            }
            enemy.shootCooldown = enemy.baseCooldown;
          }

          for (let j = gs.bullets.length - 1; j >= 0; j--) {
            const bullet = gs.bullets[j];
            const bdx = bullet.x - enemy.x;
            const bdy = bullet.y - enemy.y;
            if (bdx * bdx + bdy * bdy < 400) {
              gs.bullets.splice(j, 1);
              enemy.health--;
              if (enemy.health <= 0) {
                gs.explosions.push({ x: enemy.x, y: enemy.y, size: 0, maxSize: enemy.isElite ? 40 : 30, life: 25 });
                gs.enemies.splice(i, 1);
                gs.score += enemy.isElite ? 50 : 25;
                setScore(gs.score);
              }
              break;
            }
          }

          // Player Rocket collision
          for (let j = gs.playerRockets.length - 1; j >= 0; j--) {
            const rocket = gs.playerRockets[j];
            const rdx = rocket.x - enemy.x;
            const rdy = rocket.y - enemy.y;
            if (rdx * rdx + rdy * rdy < 500) {
              gs.playerRockets.splice(j, 1);
              gs.explosions.push({ x: rocket.x, y: rocket.y, size: 0, maxSize: 35, life: 28 });
              enemy.health -= 3;
              if (enemy.health <= 0) {
                gs.explosions.push({ x: enemy.x, y: enemy.y, size: 0, maxSize: enemy.isElite ? 40 : 30, life: 25 });
                gs.enemies.splice(i, 1);
                gs.score += enemy.isElite ? 50 : 25;
                setScore(gs.score);
              }
              break;
            }
          }

          if (gs.enemies[i]) {
            const cdx = enemy.x - player.x;
            const cdy = enemy.y - player.y;
            const distSq = cdx * cdx + cdy * cdy;
            
            if (distSq < 1200) {
              gs.shield = Math.max(0, gs.shield - 1);
              if (frameCount.current % 5 === 0) setShield(Math.round(gs.shield));
              
              if (gs.shield <= 0) {
                setGameState('lost');
                setIsRunning(false);
              }
              
              const cdist = Math.sqrt(distSq);
              const nx = cdx / cdist;
              const ny = cdy / cdist;
              player.vx += nx * 2;
              player.vy += ny * 2;
              enemy.vx -= nx;
              enemy.vy -= ny;
            }
          }
        }

        // Bosses
        for (let i = gs.bosses.length - 1; i >= 0; i--) {
          const boss = gs.bosses[i];
          boss.x += boss.vx * deltaTime * 0.7;
          
          if (boss.x < 80 || boss.x > width - 80) {
            boss.vx *= -1;
          }

          if (frameCount.current % 2 === 0) {
            boss.engineParticles.push({
              x: boss.x + (Math.random() - 0.5) * 40 * boss.size,
              y: boss.y + 30 * boss.size,
              vx: (Math.random() - 0.5) * 2,
              vy: 2,
              life: 25,
              size: Math.random() * 3 + 1
            });
          }

          boss.engineParticles = boss.engineParticles.filter(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.life--;
            return p.life > 0;
          });

          boss.shootCooldown--;
          if (boss.shootCooldown <= 0) {
            if (boss.type === 1) {
              // Dreadnought - 3 rockets
              for (let j = -1; j <= 1; j++) {
                gs.rockets.push({
                  x: boss.x + j * 20,
                  y: boss.y + 20,
                  vx: j * 0.5,
                  vy: 2,
                  angle: Math.PI / 2,
                  life: 200,
                  trail: []
                });
              }
            } else if (boss.type === 2) {
              // Fortress - bullet spread
              for (let j = -2; j <= 2; j++) {
                const angle = Math.PI / 2 + j * 0.3;
                gs.enemyBullets.push({
                  x: boss.x,
                  y: boss.y + 30,
                  vx: Math.cos(angle) * 6,
                  vy: Math.sin(angle) * 6,
                  life: 100
                });
              }
            } else {
              // Standard - single rocket
              gs.rockets.push({
                x: boss.x,
                y: boss.y + 20,
                vx: 0,
                vy: 2,
                angle: Math.PI / 2,
                life: 200,
                trail: []
              });
            }
            boss.shootCooldown = boss.shootRate;
          }

          for (let j = gs.bullets.length - 1; j >= 0; j--) {
            const bullet = gs.bullets[j];
            const dx = bullet.x - boss.x;
            const dy = bullet.y - boss.y;
            if (dx * dx + dy * dy < 2500 * boss.size) {
              gs.bullets.splice(j, 1);
              boss.health--;
              if (boss.health <= 0) {
                gs.explosions.push({ x: boss.x, y: boss.y, size: 0, maxSize: 80, life: 40 });
                gs.bosses.splice(i, 1);
                gs.score += 200;
                setScore(gs.score);
                
                gs.powerups.push({
                  x: boss.x,
                  y: boss.y,
                  type: 'laser',
                  pulse: 0
                });
              }
              break;
            }
          }

          // Boss rocket collision
          for (let j = gs.playerRockets.length - 1; j >= 0; j--) {
            const rocket = gs.playerRockets[j];
            const dx = rocket.x - boss.x;
            const dy = rocket.y - boss.y;
            if (dx * dx + dy * dy < 2500 * boss.size) {
              gs.playerRockets.splice(j, 1);
              gs.explosions.push({ x: rocket.x, y: rocket.y, size: 0, maxSize: 45, life: 30 });
              boss.health -= 5;
              if (boss.health <= 0) {
                gs.explosions.push({ x: boss.x, y: boss.y, size: 0, maxSize: 80, life: 40 });
                gs.bosses.splice(i, 1);
                gs.score += 200;
                setScore(gs.score);
                
                gs.powerups.push({
                  x: boss.x,
                  y: boss.y,
                  type: 'laser',
                  pulse: 0
                });
              }
              break;
            }
          }
        }
      }

      // Drawing
      ctx.fillStyle = '#050510';
      ctx.fillRect(0, 0, width, height);

      gs.starfield.forEach(star => {
        const alpha = 0.3 + Math.sin(star.twinkle) * 0.3;
        const gradient = ctx.createLinearGradient(star.x, star.y - star.z * 15, star.x, star.y);
        gradient.addColorStop(0, `rgba(200, 220, 255, 0)`);
        gradient.addColorStop(1, `rgba(200, 220, 255, ${alpha * star.z / 3})`);
        
        ctx.beginPath();
        ctx.moveTo(star.x, star.y - star.z * 15);
        ctx.lineTo(star.x, star.y);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = star.size * star.z;
        ctx.stroke();
        
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size * star.z, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.fill();
      });

      // Portal
      if (gs.portal && gs.portal.size > 0) {
        ctx.save();
        ctx.translate(gs.portal.x, gs.portal.y);
        ctx.rotate(gs.portal.rotation);
        
        for (let i = 3; i > 0; i--) {
          const size = gs.portal.size * (i / 3);
          const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size);
          gradient.addColorStop(0, `rgba(138, 43, 226, ${0.8 * i / 3})`);
          gradient.addColorStop(0.5, `rgba(75, 0, 130, ${0.5 * i / 3})`);
          gradient.addColorStop(1, `rgba(138, 43, 226, 0)`);
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(0, 0, size, 0, Math.PI * 2);
          ctx.fill();
        }
        
        ctx.strokeStyle = '#9333ea';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, gs.portal.size * 0.8, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.restore();
      }

      // Powerups
      gs.powerups.forEach(p => {
        const size = 12 + Math.sin(p.pulse) * 3;
        const colors = {
          range: { main: '#f59e0b', glow: 'rgba(245, 158, 11, 0.4)' },
          speed: { main: '#10b981', glow: 'rgba(16, 185, 129, 0.4)' },
          shield: { main: '#3b82f6', glow: 'rgba(59, 130, 246, 0.4)' },
          laser: { main: '#a855f7', glow: 'rgba(168, 85, 247, 0.4)' },
          rocket: { main: '#ef4444', glow: 'rgba(239, 68, 68, 0.4)' }
        };
        
        const color = colors[p.type];
        
        ctx.beginPath();
        ctx.arc(p.x, p.y, size + 8, 0, Math.PI * 2);
        ctx.fillStyle = color.glow;
        ctx.fill();
        
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fillStyle = color.main;
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.fillStyle = 'white';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (p.type === 'range') ctx.fillText('R', p.x, p.y);
        else if (p.type === 'speed') ctx.fillText('S', p.x, p.y);
        else if (p.type === 'shield') ctx.fillText('⛨', p.x, p.y);
        else if (p.type === 'laser') ctx.fillText('⚡', p.x, p.y);
        else ctx.fillText('🚀', p.x, p.y);
      });

      // Stars
      gs.stars.forEach(star => {
        if (!star.collected) {
          const size = 18 + Math.sin(star.pulse) * 3;
          
          ctx.save();
          ctx.translate(star.x, star.y);
          ctx.rotate(star.rotation);
          
          const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size + 10);
          gradient.addColorStop(0, 'rgba(255, 215, 0, 0.5)');
          gradient.addColorStop(1, 'rgba(255, 215, 0, 0)');
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(0, 0, size + 10, 0, Math.PI * 2);
          ctx.fill();
          
          ctx.fillStyle = '#FFD700';
          ctx.beginPath();
          for (let i = 0; i < 5; i++) {
            const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
            const r = i % 2 === 0 ? size : size / 2;
            const x = Math.cos(angle) * r;
            const y = Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = '#FFA500';
          ctx.lineWidth = 2;
          ctx.stroke();
          
          ctx.restore();
        }
      });

      // Explosions
      gs.explosions.forEach(e => {
        const alpha = e.life / 30;
        const gradient = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.size);
        gradient.addColorStop(0, `rgba(255, 200, 50, ${alpha})`);
        gradient.addColorStop(0.4, `rgba(255, 100, 0, ${alpha * 0.8})`);
        gradient.addColorStop(1, `rgba(139, 0, 0, 0)`);
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.size, 0, Math.PI * 2);
        ctx.fill();
        
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2;
          const dist = e.size * 0.7;
          ctx.beginPath();
          ctx.moveTo(e.x, e.y);
          ctx.lineTo(e.x + Math.cos(angle) * dist, e.y + Math.sin(angle) * dist);
          ctx.strokeStyle = `rgba(255, 150, 0, ${alpha * 0.6})`;
          ctx.lineWidth = 3;
          ctx.stroke();
        }
      });

      // Rockets (Boss)
      gs.rockets.forEach(r => {
        if (r.trail.length > 1) {
          ctx.beginPath();
          ctx.moveTo(r.trail[0].x, r.trail[0].y);
          for (let i = 1; i < r.trail.length; i++) {
            ctx.lineTo(r.trail[i].x, r.trail[i].y);
          }
          ctx.strokeStyle = 'rgba(255, 100, 0, 0.4)';
          ctx.lineWidth = 4;
          ctx.stroke();
        }
        
        ctx.save();
        ctx.translate(r.x, r.y);
        ctx.rotate(r.angle);
        
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(-3, -12, 6, 16);
        ctx.fillStyle = '#991b1b';
        ctx.beginPath();
        ctx.moveTo(0, -12);
        ctx.lineTo(-3, -16);
        ctx.lineTo(3, -16);
        ctx.closePath();
        ctx.fill();
        
        ctx.fillStyle = '#450a0a';
        ctx.fillRect(-5, 4, 10, 4);
        
        ctx.restore();
      });

      // Player Rockets
      gs.playerRockets.forEach(r => {
        if (r.trail.length > 1) {
          ctx.beginPath();
          ctx.moveTo(r.trail[0].x, r.trail[0].y);
          for (let i = 1; i < r.trail.length; i++) {
            ctx.lineTo(r.trail[i].x, r.trail[i].y);
          }
          ctx.strokeStyle = 'rgba(34, 211, 238, 0.4)';
          ctx.lineWidth = 3;
          ctx.stroke();
        }
        
        ctx.save();
        ctx.translate(r.x, r.y);
        ctx.rotate(r.angle);
        
        ctx.fillStyle = '#22d3ee';
        ctx.fillRect(-2, -10, 4, 14);
        ctx.fillStyle = '#06b6d4';
        ctx.beginPath();
        ctx.moveTo(0, -10);
        ctx.lineTo(-2, -14);
        ctx.lineTo(2, -14);
        ctx.closePath();
        ctx.fill();
        
        ctx.fillStyle = '#0891b2';
        ctx.fillRect(-4, 4, 8, 3);
        
        ctx.restore();
      });

      // Enemy bullets
      gs.enemyBullets.forEach(b => {
        ctx.beginPath();
        ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#ef4444';
        ctx.fill();
        
        ctx.beginPath();
        ctx.moveTo(b.x - b.vx * 2, b.y - b.vy * 2);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();
      });

      // Bullets
      gs.bullets.forEach(b => {
        ctx.beginPath();
        ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#22d3ee';
        ctx.fill();
        ctx.strokeStyle = '#67e8f9';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(b.x - b.vx * 3, b.y - b.vy * 3);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = 'rgba(34, 211, 238, 0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();
      });

      // Bosses
      gs.bosses.forEach(boss => {
        boss.engineParticles.forEach(p => {
          const alpha = p.life / 25;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 50, 0, ${alpha * 0.8})`;
          ctx.fill();
        });

        drawBoss(ctx, boss.x, boss.y, boss.angle, boss.type, boss.size);
        
        ctx.fillStyle = '#450a0a';
        ctx.fillRect(boss.x - 40, boss.y - 60, 80, 4);
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(boss.x - 40, boss.y - 60, (boss.health / boss.maxHealth) * 80, 4);
        ctx.strokeStyle = '#fca5a5';
        ctx.strokeRect(boss.x - 40, boss.y - 60, 80, 4);
      });

      // Enemies
      gs.enemies.forEach(enemy => {
        enemy.engineParticles.forEach(p => {
          const alpha = p.life / 20;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 100, 50, ${alpha * 0.7})`;
          ctx.fill();
        });

        drawEnemyShip(ctx, enemy.x, enemy.y, enemy.angle, 1, enemy.isElite);
        
        if (enemy.health < enemy.maxHealth) {
          const barColor = enemy.isElite ? '#581c87' : '#7f1d1d';
          const fillColor = enemy.isElite ? '#9333ea' : '#dc2626';
          ctx.fillStyle = barColor;
          ctx.fillRect(enemy.x - 15, enemy.y - 30, 30, 3);
          ctx.fillStyle = fillColor;
          ctx.fillRect(enemy.x - 15, enemy.y - 30, (enemy.health / enemy.maxHealth) * 30, 3);
        }
      });

      // Player
      if (player) {
        player.engineParticles.forEach(p => {
          const alpha = p.life / 30;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(100, 180, 255, ${alpha * 0.8})`;
          ctx.fill();
        });

        // Teleport effect
        if (gs.teleportEffect > 0) {
          const alpha = gs.teleportEffect / 60;
          for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.arc(player.x, player.y, 30 + i * 15, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(138, 43, 226, ${alpha * (1 - i / 3)})`;
            ctx.lineWidth = 3;
            ctx.stroke();
          }
        }

        drawSpaceship(ctx, player.x, player.y, player.angle);
        
        if (gs.shield < 100 && gs.shield > 0) {
          ctx.beginPath();
          ctx.arc(player.x, player.y, 25, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(96, 165, 250, ${gs.shield / 200})`;
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        
        if (gs.activeRangeBoost > 0) {
          ctx.beginPath();
          ctx.arc(player.x, player.y, 350, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(245, 158, 11, 0.2)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isRunning, gameState, targetStars, timeLeft, highScore, level]);

  const startGame = () => {
    setIsRunning(true);
    setGameState('playing');
  };

  const resetLevel = () => {
    generateLevel(level);
    setScore(prev => Math.max(0, prev - 50));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-4">
          <h1 className="text-4xl font-bold text-white mb-2">🚀 Space Collector</h1>
          <p className="text-indigo-200">Sammle Sterne, bekämpfe Feinde und Bosse, überlebe die Schwärme!</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-7 gap-3 mb-4">
          <div className="bg-slate-800/70 backdrop-blur rounded-lg p-3 border border-indigo-500/30 text-center">
            <div className="text-indigo-300 text-sm">Level</div>
            <div className="text-2xl font-bold text-white">{level}</div>
          </div>
          <div className="bg-slate-800/70 backdrop-blur rounded-lg p-3 border border-yellow-500/30 text-center">
            <div className="text-yellow-300 text-sm">Punkte</div>
            <div className="text-2xl font-bold text-white">{score}</div>
          </div>
          <div className="bg-slate-800/70 backdrop-blur rounded-lg p-3 border border-green-500/30 text-center">
            <div className="text-green-300 text-sm flex items-center justify-center gap-1">
              <Star size={14} /> Sterne
            </div>
            <div className="text-2xl font-bold text-white">{collectedStars}/{targetStars}</div>
          </div>
          <div className="bg-slate-800/70 backdrop-blur rounded-lg p-3 border border-blue-500/30 text-center">
            <div className="text-blue-300 text-sm">Zeit</div>
            <div className="text-2xl font-bold text-white">{timeLeft}s</div>
          </div>
          <div className="bg-slate-800/70 backdrop-blur rounded-lg p-3 border border-cyan-500/30 text-center">
            <div className="text-cyan-300 text-sm">🛡️ Schild</div>
            <div className="text-2xl font-bold text-white">{shield}%</div>
          </div>
          <div className="bg-slate-800/70 backdrop-blur rounded-lg p-3 border border-purple-500/30 text-center">
            <div className="text-purple-300 text-sm flex items-center justify-center gap-1">
              <Zap size={14} /> Laser
            </div>
            <div className="text-2xl font-bold text-white">{laserCount}</div>
          </div>
          <div className="bg-slate-800/70 backdrop-blur rounded-lg p-3 border border-red-500/30 text-center">
            <div className="text-red-300 text-sm">🚀 Raketen</div>
            <div className="text-2xl font-bold text-white">{rocketCount}</div>
          </div>
        </div>

        {highScore > 0 && (
          <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 backdrop-blur rounded-lg p-3 mb-4 border border-yellow-500/30 text-center">
            <div className="flex items-center justify-center gap-2 text-yellow-300">
              <Trophy size={20} />
              <span className="font-bold">Highscore: {highScore}</span>
            </div>
          </div>
        )}

        <div className="bg-slate-800/50 backdrop-blur rounded-xl p-4 mb-4 border border-indigo-500/30">
          <div className="flex flex-wrap gap-3 justify-center items-center">
            {gameState === 'ready' && (
              <button
                onClick={startGame}
                className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition text-lg font-bold"
              >
                <Play size={24} />
                Start Mission
              </button>
            )}
            
            {gameState === 'playing' && (
              <button
                onClick={() => setIsRunning(!isRunning)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition"
              >
                {isRunning ? <Pause size={20} /> : <Play size={20} />}
                {isRunning ? 'Pause' : 'Weiter'}
              </button>
            )}

            <button
              onClick={resetLevel}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition"
            >
              <RotateCcw size={20} />
              Neustart (R)
            </button>
          </div>
        </div>

        {gameState === 'lost' && (
          <div className="bg-red-500/20 backdrop-blur rounded-xl p-6 mb-4 border border-red-500/50 text-center">
            <h2 className="text-3xl font-bold text-red-300 mb-2">Mission gescheitert! 💥</h2>
            <p className="text-red-200">Versuche es erneut!</p>
          </div>
        )}

        <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-indigo-500/30">
          <div className="relative w-full bg-slate-950 rounded-lg" style={{ paddingBottom: '75%' }}>
            <canvas
              ref={canvasRef}
              width={800}
              height={600}
              className="absolute top-0 left-0 w-full h-full rounded-lg shadow-2xl cursor-crosshair"
              style={{ touchAction: 'none' }}
            />
          </div>
          <div className="mt-4 text-center text-indigo-200 text-sm space-y-2">
            <p>🖱️ Maus: Klicke und halte • ⌨️ Tastatur: Pfeiltasten • 🔫 Auto-Kanone • 🛡️ Schild</p>
            <p>⚡ Power-Ups: <span className="text-amber-400">R=Reichweite</span> <span className="text-green-400">S=Speed</span> <span className="text-blue-400">⛨=Schild</span> <span className="text-purple-400">⚡=Laser</span> <span className="text-red-400">🚀=Rakete</span></p>
            <p>📈 Lvl 1-11: Tutorial • 🎯 Bosse ab Lvl 12 • 🚀 Schwärme ab Lvl 18 • 💜 Elite-Feinde ab Lvl 18 • 🔥 Hardcore ab Lvl 18</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ParticleUniverse;
# Contrasteroids: spec

> **Author:** Claude Code (spec writer, from an interview with Charlie)
> **Date:** 2026-11-15
> **Status:** decided-by-user for the choices marked (U); proposed-by-agent for everything else

## Premise

Space has no atmosphere, so there is no fill light. Anything not lit directly by the sun is pure black, and shadows have razor edges. Contrasteroids is a rock-shooting arcade game built on that idea: solid 3D white objects, one offscreen sun, and a strictly 1-bit picture. It is inspired by the genre, not a copy of any game: no vector look, no saucers, our own ships and enemies.

## Look

- Strict 1-bit output (U). Every pixel on screen is pure black or pure white, including the HUD and title text. No dithering, no grey.
- One directional light coming from the upper-left of the screen, at 15° elevation above the play plane. Charlie first chose 45° (U), then said to lower it if that looked better (U). At 45° the rocks were nearly all white, so I chose 15° (proposed-by-agent, tune with the dev keys). No ambient light. Hard shadow maps, so objects self-shadow (crater floors, lumps) and shadow each other when they overlap.
- Dark sides are not helped in any way (U). No outline, no rim light; the lit shape implies the rest.
- Sparse white starfield behind everything (U), one physical pixel per star (U). Rocks block stars naturally.
- Orthographic camera looking straight down (U). The 3D shows only through lighting.
- Self-lit things, which ignore the sun: bullets, the ship's thrust flame, sparks, blinking mine lights, and a brief explosion flash that lights nearby objects from the blast point.
- Dev-only tuning (backtick toggles): J/L nudge the light's azimuth and I/K its elevation, shown on the HUD.

Implementation: render the lit scene to an MSAA render target, then a fullscreen pass thresholds it to 0 or 1. The HUD is drawn to a 2D canvas and thresholded in the same pass.

## Objects

- **Rocks:** smooth, lumpy, and cratered (U), procedurally generated so no two match. Three sizes; large splits into two medium, medium into two small. Each tumbles on its own random axis. Rocks that collide split the same way (Charlie's request); two small rocks bounce off each other, and a fresh fragment ignores other rocks for about a second so one split can't chain into more.
- **Ship:** classic inertial handling (U): rotate, thrust with drag, fire, hyperspace, screen wrap. Charlie asked for the ship to show the contrast effect more (U), so I gave it a sharp center ridge with steep flanks: one flank is lit and the other black, and they swap as it turns. A fin and two engine pods cast shadows on the hull. It used to bank about 55° into turns, but Charlie found that made the ship hard to read, so it stays level (U).
- **Aliens** (original designs):
  - **Skiff:** a fast spindle that crosses the screen on a weaving path and fires aimed shots. From wave 1.
  - **Layer:** a slow ring with a hub that drops proximity mines. From wave 2.
  - **Hunter:** a sharp double pyramid that steers toward the ship with a limited turn rate and rams it. From wave 4.
- **Mines:** spiky balls with a blinking self-lit core; they drift toward the ship when it's close and expire after a while.
- **Explosions:** tumbling solid fragments that shrink away, white sparks, and the flash light.

## Game

- Title screen, score, lives (3, extra life every 10,000), waves of increasing rock count and speed, and a local high score (localStorage).
- Scores: large rock 20, medium 50, small 100, mine 50, Skiff 200, Layer 500, Hunter 1,000.
- Screen wrap for everything except alien entries/exits; objects wrap once fully offscreen.
- Respawn in the center with a short blinking invulnerability.

## Controls

Keyboard (U):

- Left/Right or A/D rotate, Up or W thrust, Space fire, Shift or Down/S hyperspace
- Enter start, P pause, M mute

Touch (Charlie asked for touch controls, U), shown on coarse-pointer devices or after the first touch: rotate left/right buttons bottom left; thrust, fire, and a small H (hyperspace) bottom right; mute and pause top right. Sliding a thumb between buttons switches without lifting. Tapping open screen starts the game or resumes from pause. The overlay is DOM, drawn black and white to match. The world keeps its fixed height, so portrait is cramped and the title screen suggests turning sideways.

## Sound

Synthesized with WebAudio, no files. Everything runs through a reverb send and a master compressor. Charlie asked for real subwoofer weight (U) and then for more drama (U):

- Rocks breaking thud and boom rather than bang (Charlie's request, U): no high crack, a soft attack, and a low-passed body and sub boom that drop in pitch as rocks get bigger (small about 95 Hz falling to 42 Hz, large 50 Hz falling to 22 Hz).
- Alien and ship explosions layer a crack, a filtered body, a debris rattle, a 25–60 Hz sub boom, and a driven thud. Bass management routes the sub content to a subwoofer (a browser can't address the LFE channel directly).
- Alien deaths add a metallic ring; the player's death adds a falling driven saw, a long rumble, and a sub tail.
- Shots carry a low kick; hyperspace is a rising sweep with a whoosh; each wave opens with a slow low swell.
- Background (Charlie asked for something haunting that speeds up as rocks thin, U): a low drone (a fifth plus filtered saws) whose filter opens and wobbles faster as the wave clears, a thin high whistle near the end of a wave, and a pulse that walks a four-note figure (E, E, G, F#) and speeds up from 1.0 s to 0.28 s.
- Also thrust (noise plus a sub rumble), a Skiff hum, a Hunter whine, mine beeps, and an extra-life chime.

## Stack

three.js and Vite (U: web), building static files with relative paths so the game can be hosted anywhere later. Local only for now; hosting is undecided.

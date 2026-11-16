# Contrasteroids: spec

> **Author:** Claude Code (spec writer, from an interview with Charlie)
> **Date:** 2026-11-15
> **Status:** decided-by-user for the choices marked (U); proposed-by-agent for everything else

## Premise

Space has no atmosphere, so there is no fill light. Anything not lit directly is pure black, and shadows have razor edges. Contrasteroids is a rock-shooting arcade game built on that idea: solid 3D white objects lit only by the ship's own lamp, its bullets, and explosions. (Until 2026-11-16 the light was one offscreen sun and the picture was strictly 1-bit.) It is inspired by the genre, not a copy of any game: no vector look, no saucers, our own ships and enemies.

## Look

> **Author:** Claude Code (spec writer, from a discussion with Charlie)
> **Date:** 2026-11-16
> **Status:** decided-by-user for the choices marked (U); proposed-by-agent for everything else

This section replaces the 2026-11-15 sun lighting. Charlie found the game too easy, and we moved the light onto the ship so seeing becomes part of the challenge.

- **No sun, from wave 1 (U).** The only light sources are the ship, bullets, and explosions. No ambient light. Anything unlit is pure black.
- **Ship spotlight (U):** a cone of light from the ship's nose, 50° wide (U), with a hard edge. It casts hard shadows, so a rock in the beam hides rocks behind it. Aiming and seeing are the same act.
- **Ship halo (U):** a small omni light around the ship so nothing reaches it in total darkness. I set its radius to 16 units (one large-rock diameter) at about half brightness, to be tuned. Not confirmed.
- **Bullets carry light (U):** each of our shots lights a small area around it as it flies, so firing into the dark shows what's there. Shots are slower (U; I set 55 units/s, was 85, with a longer life so range drops only from 81 to 71) and sparkle (U): the core flickers and sheds a thin trail of short-lived sparks, and its light flickers with it. Bullet lights cast no shadows, for performance on phones (proposed).
- **Distance falloff in greyscale (U).** Light fades with distance, and the picture is no longer strictly 1-bit: far surfaces are grey, fading to black. No dithering (U). I'm assuming the surface angle stays binary, so terminators and shadow edges stay razor sharp and only distance makes grey. Charlie said "fade with distance" and didn't mention angle; not confirmed. I propose a falloff that stays near full white close to the ship and reaches black at a set range, rather than pure inverse-square, which never reaches zero.
- **Black rocks show only by blocking stars (U, from Charlie's first pitch).** Stars are one CSS pixel (two physical on Retina) and a bit denser so the holes read (proposed). They twinkle like the sparkle setting on Christmas lights (U): each rests at its own brightness and briefly flares to white on its own rhythm.
- **Ships light themselves (U, 2026-11-16):** ours and the aliens' are always visible, shaded from a fixed key direction in the shader, and cast and receive no shadows. Mines are not ships; they are lit like rocks and show by their blinking cores (proposed).
- **Title screen:** with no sun, the attract screen needs light. I propose a ship parked at center, slowly turning so its beam sweeps the drifting rocks. Not confirmed. The README banner, site card image, and `public/og.png` are regenerated from it.
- **Between death and respawn** the only light is the death explosion's flash. Proposed.
- The HUD stays pure black and white.
- Self-lit things, which glow without being lit: bullets, the ship's thrust flame, sparks, blinking mine lights, and the explosion flash, which also lights nearby objects from the blast point.
- Dark sides are not helped in any way (U, 2026-11-15). No outline, no rim light.
- Orthographic camera looking straight down (U, 2026-11-15).
- Dev-only tuning (backtick toggles): keys to adjust cone width, halo radius, and falloff range, shown on the HUD. Replaces the sun azimuth and elevation keys.

Implementation (proposed): the rock and alien materials compute lit or unlit per light from surface angle and shadow, then multiply by that light's distance falloff, so the post pass no longer thresholds to 0 or 1. The post pass keeps the HUD at pure black and white. A spotlight shadow is one shadow map; the halo and bullet lights don't cast shadows, to avoid cube-map shadows on phones.

### Superseded (2026-11-15)

- ~~Strict 1-bit output (U). Every pixel on screen is pure black or pure white.~~ Replaced by greyscale distance falloff (U, 2026-11-16).
- ~~One directional light from the upper-left at 15° elevation.~~ Replaced by the ship's lights (U, 2026-11-16).
- ~~Sparse white starfield, one physical pixel per star (U).~~ Density under review so black rocks can be seen against it.

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

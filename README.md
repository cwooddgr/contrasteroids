<p align="center"><a href="https://dgrlabs.co/contrasteroids/"><img src="docs/banner.jpg" alt="The Contrasteroids title screen: white rocks on a black starfield with the game's name in white capitals" width="100%"></a></p>

# Contrasteroids

A rock-shooting arcade game drawn in pure black and white. Play it at [dgrlabs.co/contrasteroids](https://dgrlabs.co/contrasteroids/).

Space has no air to scatter light, so anything the sun doesn't hit directly is black. The game is built on that idea. The rocks and ships are solid 3D models lit by one sun off the edge of the screen, with no fill light and hard-edged shadows. Every pixel ends up either black or white, so you read a rock's shape from where its lit face ends and from the shadows its craters cast.

Shoot the rocks and they split into smaller ones. Rocks that collide with each other split too. Three kinds of alien ships show up as the waves go on. One crosses the screen firing at you, one lays mines, and one hunts you down and rams you.

## Controls

On a keyboard:

| Key | Action |
| --- | --- |
| ← → or A D | Rotate |
| ↑ or W | Thrust |
| Space | Fire |
| Shift, ↓, or S | Hyperspace |
| Enter | Start |
| P | Pause |
| M | Sound on or off |

On a phone or tablet, buttons appear on screen. Your left thumb rotates and your right thumb thrusts and fires. H jumps to hyperspace. Tap the screen to start, and to carry on after a pause. The screen is roomier if you hold the phone sideways.

## Scoring

Large rocks are worth 20 points, medium rocks 50, and small rocks 100. A mine is worth 50. The aliens are worth 200, 500, and 1,000 in the order they appear. You get an extra ship every 10,000 points, and your high score is saved in the browser.

## How it's made

It's three.js and Vite, with no image or audio files. The scene renders with a single directional light and shadow maps, and a final shader pass turns every lit pixel white and everything else black. The rocks are generated as the game runs, so no two look alike. Every sound is synthesized with the Web Audio API, including a low drone that tightens as you clear each wave.

## Running it

```
npm install
npm run dev
```

`npm run build` writes a static copy to `dist/` with relative paths, so it can be hosted from any folder. `npm run publish:site` builds it and copies it into a sibling `dgrlabs_co` checkout at `contrasteroids/`.

## License

MIT. See [LICENSE](LICENSE).

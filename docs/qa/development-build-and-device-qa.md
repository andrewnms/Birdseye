# development build and physical-device qa

## purpose and boundaries

this guide proves the product on a physical phone. it is not an expo go flow and
it does not use paid eas builds. the `development` profile in `eas.json` is
reserved for a future internal-distribution build; the working loop below uses
local compilation with the installed `expo-dev-client`.

sdk 57 runs entirely on React Native's new architecture and cannot disable it.
`react-native-webrtc` is the required realtime transport and its current native
directory metadata does not yet mark it as tested there. keep that warning visible
in `npx expo-doctor` and treat the physical-device realtime check as mandatory.

the stage path is a cached paper-crane lesson because it is deterministic. the
live planner must use the same lesson contract for practical goals beyond
origami, including pcb assembly, woodworking preparation, and cooking
preparation. do not use the app as safety clearance for power tools, mains
electronics, heat, blades, or food-allergy decisions.

## prerequisites

- node 22.13 or later. sdk 57 targets react native 0.86 and requires node
  22.13 or later.
- an iPhone with developer mode enabled and Xcode installed, or an Android
  phone with USB debugging enabled and Android Studio's SDK installed.
- the Mac and phone connected to the same Wi-Fi network. if venue Wi-Fi blocks
  local peers, connect both to the Mac's personal hotspot instead.
- a local OpenAI development key for the companion server. it stays on the Mac
  and must never be copied into app code or an `EXPO_PUBLIC_*` value.

## configure the local environment

1. install the lockfile-defined dependencies with `npm ci`.
2. create a private `.env.local` file from `.env.example`. the local server
   loads this file, and Expo exposes only the `EXPO_PUBLIC_*` value to the app.
3. find the Mac's active Wi-Fi or hotspot IPv4 address. on macOS,
   `ipconfig getifaddr en0` commonly returns it. use the active interface if
   `en0` is not Wi-Fi.
4. set `EXPO_PUBLIC_API_URL` to `http://<mac-lan-ip>:3000`. it must use the
   Mac's reachable LAN address, not `localhost`, `127.0.0.1`, or a public URL.
5. set `OPENAI_API_KEY` only in `.env.local`. keep the default `PORT=3000` unless
   both the server and `EXPO_PUBLIC_API_URL` are changed together.
6. before opening the app, verify that the phone can reach
   `http://<mac-lan-ip>:3000/health` in its browser. a failure here is a network
   problem, not an app problem. check the firewall, correct LAN address, and
   whether the venue network isolates clients. retry on the Mac hotspot.

the API base URL is intentionally public to the JavaScript bundle because it is
only an address. `OPENAI_API_KEY` is a server-only secret and never receives the
`EXPO_PUBLIC_` prefix.

## one-time local development-client install

run this after cloning, after removing the generated native folders, or whenever
a native dependency, config plugin, or `app.json` permission changes. `prebuild`
generates ignored `ios/` and `android/` folders locally.

```sh
npx expo prebuild
```

then compile and install onto the attached physical device. choose one command.

```sh
# iPhone, with the device trusted by Xcode
npx expo run:ios --device

# Android, with USB debugging authorized
npx expo run:android --device
```

these commands create a local debug development client. they do not invoke EAS
Build or consume EAS build credits. after the first install, use the two-command
daily session in the project README. rebuild and reinstall before qa whenever
the native runtime changes; restarting Metro alone cannot add a native module or
change a permission usage string.

## lan acceptance check

1. start the companion server and wait for its `/health` endpoint to respond.
2. start Metro with `--dev-client --lan`.
3. open the installed `birdseye` app, select the LAN server, and confirm the
   phone loads the current JavaScript bundle.
4. turn off the Mac's network briefly. the development client should lose the
   bundle connection. turn it back on and reload to prove the phone was using
   LAN, not a stale local bundle.
5. if discovery fails, keep the same network and enter the Metro LAN URL shown
   in the terminal manually in the development client. do not switch the API
   URL to `localhost`.

## physical qa checklist

run this in order on a real phone. record the device model, OS version, commit,
and LAN IP with the result.

### native foundation

- [ ] launch the installed development client, not expo go.
- [ ] first launch shows the Birdseye camera and microphone permission text.
- [ ] grant both permissions. a full-screen live camera preview appears within
      five seconds with no crash.
- [ ] background the app, revoke either permission in system settings, return,
      and confirm the app presents its recovery action rather than a broken or
      frozen preview.
- [ ] use `Open Settings` if the OS has permanently denied access, grant both
      permissions, return to the app, and confirm the live preview recovers.
- [ ] rotate the phone left, right, up, and down. the transparent overlay shows
      the camera everywhere except its annotations, and annotations remain
      visually anchored during ordinary hand motion.

### cached crane, the stage path

- [ ] open the `Cached crane lesson`. it begins on `Step 1 of 6` with the
      matching visible instruction, narration, and `Overlay for step 1`.
- [ ] tap `Next` or say `done`. it advances exactly one step and updates the
      header, instruction, narration, and overlay together.
- [ ] repeat through steps 2 to 6. no transition may display narration from one
      step with the overlay from another.
- [ ] after the final `Next`, `Lesson complete` appears, `Next` is gone, and
      the app says `You made a paper crane.`
- [ ] complete a second clean run after a reload. the run must not require a
      laptop action other than the already-running server and Metro processes.

### live-lesson smoke test

- [ ] enter a goal outside origami, such as `place parts for a simple pcb`,
      `prepare a woodworking cut list`, or `mise en place for a vegetable
      stir-fry`.
- [ ] while the plan is generated, `Planning…` remains visible and responsive.
- [ ] the lesson opens with a validated multi-step plan. complete one step and
      verify the same narration and overlay synchronization as the cached run.
- [ ] retry once after a deliberately unavailable server. the app must show a
      recoverable error rather than crash or silently use an invalid plan.

## fallback recording checklist

make a fresh fallback recording before a presentation and after any native,
planner, or executor change. use the exact physical device and installed client
that will be demonstrated.

- [ ] enable device screen recording with microphone or system audio capture,
      then verify the resulting file includes spoken guidance before the final
      take.
- [ ] start recording before launching birdseye. show the live camera preview
      and the first crane instruction in the same continuous take.
- [ ] complete all six crane steps using the visible `Next` control or spoken
      `done`. keep the camera, overlay, step header, and spoken guidance in
      frame throughout.
- [ ] capture `Lesson complete` and the spoken `You made a paper crane.` with
      no editing, laptop interaction, reconnect, or permission prompt in the
      middle.
- [ ] play back the entire file on a second device. confirm the image is legible
      and audio is present, synchronized, and understandable.
- [ ] store the original video in the agreed demo-evidence location and record
      its path, SHA-256, device, OS, app commit, date, and reviewer in the demo
      handoff. do not claim the fallback is ready until that playback check has
      passed.

## deterministic checks

run these after code changes and before a device handoff. they require no
external service or API key.

```sh
npm run lint
npm test
npm run build
```

run the integration suite only when its dependencies are available and explicitly
requested:

```sh
npm run test:integration
```

the production check is `npm run build`. do not add remote build-time fetches,
including hosted fonts. prefer local assets and `next/font/local` if a web
surface is introduced.

## sources checked

- [expo sdk 57 reference](https://docs.expo.dev/versions/v57.0.0/)
- [expo local development builds](https://docs.expo.dev/guides/local-app-development/)
- [expo EAS build profile reference](https://docs.expo.dev/build/eas-json/)

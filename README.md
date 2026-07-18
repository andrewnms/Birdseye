# birdseye

birdseye turns a practical goal into a camera-guided, step-by-step lesson. the
cached paper-crane run is the reliable stage path. live lessons prove the same
experience for goals such as pcb assembly, woodworking preparation, and cooking
preparation.

## physical-device development

this app requires a custom development client. it uses native camera, sensor,
and WebRTC modules, so it must not be opened in expo go.

read [the sdk 57 reference](https://docs.expo.dev/versions/v57.0.0/) before
changing expo configuration or native dependencies. the exact one-time install,
lan setup, physical qa, and recording procedure live in
[docs/qa/development-build-and-device-qa.md](docs/qa/development-build-and-device-qa.md).

## daily device session

after the development client is installed and `.env.local` is configured, use only
these two commands. keep both processes running while testing.

```sh
# terminal 1: binds the companion server to the lan
npx tsx server/src/index.ts

# terminal 2: serves the JavaScript bundle to the installed development client
npx expo start --dev-client --lan
```

open the installed `birdseye` development client on the phone, then choose the
lan development server. do not use `localhost` for the API URL: on a phone it
points back to the phone, not the development Mac.

## quality gates

before handing off a device build, run the deterministic checks documented in
the qa guide. a native dependency or `app.json` change requires a new local
development-client install before device qa resumes.

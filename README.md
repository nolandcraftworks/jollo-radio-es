### about

- this is a simplified version of the radio system running on `irc.jollo.org`
- it is basically a live streaming mp3 server and a chatroom
- tracks can be added to the live stream by typing in URLs into a chatroom
- the system will download the songs as they are added and queue it into a playlist
- it doesn't use icecast/shoutcast, but creates a live mp3 stream simliar to shoutcast

### requirements

assuming you are using linux with sudo priveleges, make sure you have the latest `node.js`, `ffmpeg`, and `youtube-dl` installed. if you need help installing those packages, please see EXTRA.md

also, if you dont have `PM2` installed please do so also via

```
sudo npm install -g pm2
```

### installation

```
cd ~
git clone https://github.com/nolandcraftworks/jollo-radio-es
cd jollo-radio-es
npm install
node setup
```

### start service

```
pm2 start radio-stream.js --name "radio-stream"
pm2 start radio-api.js --name "radio-api"
pm2 start radio-cron.js --name "radio-cron"
```

### start chatroom

- optional: you can require a password for the chatroom
- open `radio-chat.js` and at the very top change the value of the variable `requirepassword` to `true`
- also change the value of the variable `password` to be whatever you like
- now run:

```
pm2 start radio-chat.js --name "radio-chat"
```

### usage

- the chatroom is available on `http://localhost:3000`
- the mp3 stream is available on `http://localhost:3000/radio`
- the chatroom uses websockets running on port `9302`
- the system will also be using using ports `48887-48889` for ipc communication

### controlling the radio

- you can type regular chat text (not just audio urls) in the chatroom
- if your chat text has an audio url in it (mp3, bandcamp, youtube, soundcloud) it will queue that track
- you can skip the currently playing song by typing: `radio: next`
- you can play a random track from the playlist history by typing: `radio: random`
- you can mix two songs by typing: `radio: mix urla urlb` where `urla` is an audio url and `urlb` is an audio url
- you can also do something like `radio: mix urla random` or `radio: mix random random` if you want

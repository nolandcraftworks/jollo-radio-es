const maxlisteners = 30
const ipcport = 48889

let debug = false

let oob = Number.MAX_SAFE_INTEGER - 10000

let nextflag = false
let realtrackplaying = false
let realfilename = null

const axios = require('axios')

function emergency() {
  setTimeout(()=>{
    process.exit()
  },1000)
}

const db = require('./database.js')
const fs = require('fs')
const PassThroughStream = require('stream').PassThrough

let bucket = new PassThroughStream()
let broadcast = new PassThroughStream()
let subscriber = new PassThroughStream()

const lame = require('lame')
const encoder = new lame.Encoder({
  channels: 2,       
  bitDepth: 16,      
  sampleRate: 44100, 
  bitRate: 128,
  outSampleRate: 44100,
  mode: lame.STEREO 
})

const decoder = new lame.Decoder()
function onFormat (format) {
  decoder.pipe(encoder).pipe(broadcast)
}

decoder.on('format', onFormat)
bucket.pipe(decoder)

function transmit(e) {
  subscriber.write(e)  
}

broadcast.on("data", transmit)

const chunksize = 4000
let currenttrack = null
let lasttimeout = 250
var buffer = Buffer.alloc(chunksize)

let start
let accum = 0
let keepalivecyclecount = -1
async function keepalive() {
  keepalivecyclecount++
  let results = await db.all(`
    SELECT 
      uuid, 
      nick
    FROM tracks
    WHERE status = 0
    ORDER BY rowid ASC 
    LIMIT 1
  `)
  if (results) {
    results = results[0]
  }

  let file = ""
  if (!results || results.length === 0) {
    realtrackplaying = false
    file = "./wave128.mp3"
    currenttrack = null   
  }
  else {
    let uuid = results.uuid
    currenttrack = uuid
    await db.run(`
      UPDATE tracks
      SET status = 1
      WHERE uuid = "${uuid}"
    `)
    file = `./tracks/${uuid}.mp3`
    realtrackplaying = true
  }
  if (debug) {
    console.log(`keepalive ${keepalivecyclecount} ${(new Date())} ${file}`)
  }  
  realfilename = file  
  try {
    await axios({
      method: 'post',
      url: 'http://localhost:48887/api',
      data: {
        type: 'position',
        body: currenttrack
      }
    })  
  }
  catch(e) {
    // console.error(e)
  }
  try {
    fs.open(file, 'r', function(err, fd) {
      if (err) {
        throw err
      }
      accum = 0
      start = + new Date()
      function read() {
        fs.read(fd, buffer, 0, chunksize, null, function(err, nread, sum) {
          if (err) {
            throw err
          }
          if (nread === 0) {
            fs.close(fd, function(err) {
              if (err) {
                throw err
              }
              keepalive()
            })
            return
          }
          if (nextflag && realtrackplaying) {
            nextflag = false
            fs.close(fd, function(err) {
              if (err) {
                throw err
              }
              keepalive()
            })
            return            
          }
          if (nread < chunksize) {
            data = buffer.slice(0,nread)
          }
          else {
            data = buffer
          }
          let timeout = ~~((nread / chunksize) * 250)
          bucket.write(data)
          let now = + new Date()
          var timediff = now - start
          let phase = timediff - accum
          accum = accum + timeout
          setTimeout(read, timeout-phase)
        })
      }
      read()
    })
  }
  catch(e) {
    console.error(e)
    emergency()
  }
}

keepalive()

const map = new Map()
const http = require('http')

let listeners = 0
let server = http.createServer(async function(req, res) {
  const url = require('url')
  let requrl = url.parse(req.url).pathname.toLowerCase()
  if (requrl === "/") {
    res.writeHead(200)
    fs.readFile("./public/index.html", function (err, html) {
      if (err) {
        res.writeHead(500)
        console.error(err)
        res.end("")
        return
      }
      res.end(html)
    })
    return
  }
  if (requrl !== "/radio") {
    res.writeHead(404)
    res.end("not found")
    req.destroy()
    return
  }
  if (listeners > maxlisteners) {
    res.writeHead(503)
    res.end("server overloaded please try back later\n")
    req.destroy()
    return
  }
  let ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress
  if (ip.substr(0, 7) == "::ffff:") {
    ip = ip.substr(7)
  }
  if (!map.get(ip)) {
    map.set(ip, 1)
  }
  else {
    if (map.get(ip) > 8) {
      res.writeHead(429)
      res.end("too many connections on your ip\n")
      req.destroy()
      return
    }
    map.set(ip, map.get(ip) + 1 )
  }
  listeners++
  res.removeHeader('Transfer-Encoding')
  res.writeHead(200, {
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-cache',
    'Content-Type': 'audio/mpeg',
    'Pragma': 'no-cache',
    'Server': 'jollo-radio-ephemeral-stream'
  })
  function send(e) {

    res.write(e, "buffer")
    return
  }  
  
  function close() {
    listeners--
    map.set(ip, map.get(ip) - 1)
    req.destroy()
    subscriber.removeListener("data", send)
    return
  }

  subscriber.on("data", send)
  
  req.on("close", function() {
    close()
    return
  })
  req.on("end", function() {
    close()
    return
  })
})

const api = {
  next: (data) => {
    nextflag = true
    return true
  },
  position: () => {
    return currenttrack
  }
}

subscriber.on("data", (e) => {
  
})

require('./ipc.js')(api, ipcport)
server.listen(3000)

const ipcport = 48888

let maxresources = 2
const axios = require('axios')
const util = require('util')
const uuid = require('node-uuid')
const exec = util.promisify(require('child_process').exec)
const { spawn } = require('child_process')
const fs = require('fs')
const db = require('./database.js')

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

let dispatch = null

let bucket = {
  queue: new Map(),
  processing: new Map(),
  finished: new Map()
}

const requestprocessingevent = {
  
  youtubedl: async function(id, urldata, postprocessing) {
    try {
      relaystatus()
      let data = urldata.substring(0,1000)
      function respawn(id, url) {
        console.log(`respawn with ${id} and ${url}`)
        return new Promise((resolve, reject) => {
          let blink = `tracks/${id}.%(ext)s`
          const spawnres = spawn('youtube-dl', [
            "--extract-audio", 
            "--audio-format", 
            "mp3", 
            "--audio-quality", 
            "0", 
            "--output",
            blink, 
            url
          ])
          spawnres.on('close', (code) => {
            resolve("done")
            return
          })
        })
      }  
      await respawn(id, data)
      const path = `./tracks/${id}.mp3`
      if (!fs.existsSync(path)) {
        return 0
      }
      var checkfile = `tracks/${id}.mp3`
      let probestring = `ffprobe ${checkfile}`
      const { stdout, stderr } = await exec(probestring)
      let details = stderr
      if (!details || details.length === 0) {
        return 0
      }
      let multistream = false
      multistream = (details.indexOf("Stream #0:1") > -1) 
      let mp3val = details.split("Input #0, ")[1].split(",")[0]
      if (mp3val !== "mp3") {
        return 0
      }
      let streamval = details.split(" Hz, ")[0].slice(-5)
      let channelval = details.split(" Hz, ")[1].substring(0,6)
      // must force
      //if (multistream || streamval !== "44100" || channelval !== "stereo") {
      let conversion = `ffmpeg -y -i tracks/${id}.mp3 -map a -ac 2 -ar 44100 -codec:a libmp3lame -b:a 320k -map_metadata -1 tracks/dupe-${id}.mp3`
      await exec(conversion)
      let move = fs.unlinkSync(`tracks/${id}.mp3`)
      let rename = fs.renameSync(`tracks/dupe-${id}.mp3`, `tracks/${id}.mp3`)
      if (!fs.existsSync(path)) {
        return 0
      }      
      //}
      return 1
    }
    catch(e) {
      return 0
    }
  },
  
  mixdown: async function(id, urlidarray, postprocessing) {
    // try {
    //   let string = `ffmpeg -i tmp/${urlidarray[0]}.mp3 -i tmp/${urlidarray[1]}.mp3 -filter_complex amix=inputs=2:duration=shortest:dropout_transition=2 "tmp/${id}.mp3"`
    //   await exec(string)    
    //   const path = `./tmp/${id}.mp3`
    //   if (!fs.existsSync(path)) {
    //     return 0
    //   }    
    //   return 1
    // }
    // catch(e) {
    //   return 0
    // }
    return 0
  }
  
  
}

async function satisfied(id) {
  let status = false
  for (let i=0;i<1000;i++) {
    if (bucket.finished.get(id) !== undefined) {
      let code = bucket.finished.get(id)
      bucket.finished.delete(id)
      if (code === 1) {
        status = true
      }
      else {
        status = false
      }
      break
    }
    else {
      await sleep(1000)
    }
  }
  return status
}

async function relaystatus() {
  try {
    await axios({
      method: 'post',
      timeout: 60 * 10 * 1000,
      url: 'http://localhost:48887/api',
      data: {
        type: 'status',
        body: {
          maxresources,
          queuesize: bucket.queue.size,
          processingsize: bucket.processing.size  
        }
      }
    })      
  }
  catch(e) {
    // console.error(e)
  }
}

async function processitem() {
  let topmost = Array.from(bucket.queue)[0]
  let id = topmost[0]
  let data = topmost[1]
  relaystatus()
  bucket.queue.delete(id)
  bucket.processing.set(id, data)
  const {route, urldata, postprocessing} = data
  let code = await requestprocessingevent[route](id, urldata, postprocessing)
  bucket.processing.delete(id)
  relaystatus()
  bucket.finished.set(id, code)  
}

async function processbucket() {
  if (bucket.queue.size > 0) {
    if (bucket.processing.size < maxresources) {
      processitem()
    }
  }
  else {
    if (dispatch !== null) {
      clearInterval(dispatch)
      dispatch = null
    }
  }
}  

function newbucketitem(id, data) {
  bucket.queue.set(id, data)
  relaystatus()
  processbucket()
  if (dispatch === null) {
    dispatch = setInterval(()=>{
      processbucket()
    },250)    
  }
}

let wordIsAValidMusicLink = require('./common.js').wordIsAValidMusicLink

async function addentrytodatabase(id, url, nick) {
  await db.run(`
    INSERT INTO tracks (
      uuid, 
      url,
      status,
      nick
    )
    VALUES (
      "${id}",
      "${db.mres(url)}",
      0,
      "${db.mres(nick)}"
    )
  `)
  return      
}

const api = {
  
  position: async function() {
    let results = await axios({
      method: 'post',
      url: 'http://localhost:48889/api',
      data: {
        type: 'position',
        body: null
      }
    })
    return results.data
  },
  
  status: async function() {
    return {
      maxresources,
      queuesize: bucket.queue.size,
      processingsize: bucket.processing.size  
    }
  },
  
  random: async function(nick) {
    
  //   SELECT url
  //   FROM tracks
  //   WHERE url NOT LIKE "mix"
  //   ORDER BY RAND()
  //   LIMIT 1
    
    return {status: 0}
  },
  
  // getalltracks: async function() {
  //   let tracks = await db.all(`
  //     SELECT url, status
  //     FROM tracks
  //   `)
  //   return tracks
  // },
  
  // clearplaylist: async function() {
  //   await db.run(`
  //     DELETE FROM tracks
  //   `)
  //   return null
  // },
  
  mix: async function(urls, nick) {
    
    //  update for sqlite
      
    //  // urls are ["url", "url"]
    //  // it will eventually have a postprocessing arg as well
    //  
    //  let alltracks = {
    //    0: null,
    //    1: null
    //  }
    //  
    //  if (urls[0] === "random") {
    //    let aurl = (await promises.pool(`
    //      SELECT url
    //      FROM tracks
    //      WHERE url NOT LIKE "mix"
    //      ORDER BY RAND()
    //      LIMIT 1
    //    `))[0].url      
    //    urls[0] = aurl
    //  }
    //  
    //  if (urls[1] === "random") {
    //    let burl = (await promises.pool(`
    //      SELECT url
    //      FROM tracks
    //      WHERE url NOT LIKE "mix"
    //      ORDER BY RAND()
    //      LIMIT 1
    //    `))[0].url    
    //    urls[1] = burl
    //  }
    //    
    //  let validate = true
    //  for (let i=0;i<urls.length;i++) {
    //    if (!wordIsAValidMusicLink(urls[i])) {
    //      validate = false
    //      break
    //    }      
    //  }
    //  if (!validate) {
    //    return {status: 0}      
    //  }
    //  
    //  validate = true
    //  
    //  for (let i=0;i<urls.length;i++) {
    //    let id = (+ new Date()).toString() + "-" + uuid.v4()
    //    alltracks[i] = id
    //    let urldata = urls[i]
    //    let data = {
    //      route: "youtubedl",
    //      urldata,
    //      postprocessing: null
    //    }
    //    newbucketitem(id, data)
    //    let satisfy = await satisfied(id)
    //    if (satisfy !== true) {
    //      validate = false
    //      break
    //    }
    //  }
    //  if (!validate) {
    //    return {status: 0}
    //  }
    //  
    //  let id = (+ new Date()).toString() + "-" + uuid.v4()
    //  let data = {
    //    route: "mixdown", 
    //    urldata: [alltracks[0], alltracks[1]],
    //    postprocessing: null
    //  }
    //  
    //  newbucketitem(id, data)
    //  let satisfy = await satisfied(id)
    //  if (satisfy === true) {
    //    await addentrytodatabase(id, "mix")
    //    return {status: 1, processed: "mix", id}
    //  }
    //  else {
    //    return {status: 0, processed: "mix"}
    //  }
    return {status: 0}
    
  },
  
  next: async function() {
    await axios({
      method: 'post',
      url: 'http://localhost:48889/api',
      data: {
        type: 'next',
        body: null
      }
    })
    return true
  },
  
  parse: async function(data) {
    
    let {chat, nick} = data
    let status = null    
    
    if (chat === `radio: next`) {
      api.next()
      return status
    }
    
    // else if (chat.startsWith("radio: mix ")) {
    //   chat = chat.slice(11)
    //   if (chat.length === 0) {
    //     return status
    //   }
    //   chat = chat.split(" ")
    //   if (chat.length !== 2) {
    //     return status
    //   }
    //   let urls = [chat[0], chat[1]]
    //   let queue = await api.mix(urls, nick)
    //   console.log(queue)
    //   return status
    // }
    
    // else if (chat === "radio: random") {
    //   return await api.random(nick)
    // }
    
    let url = null
    let array = chat.split(" ")
    for (let i=0;i<array.length;i++) {
      let word = array[i]
      if (wordIsAValidMusicLink(word)) {
        url = word
        break
      }
    }
    if (!nick || nick.length === 0 || nick.length > 9) {
      nick = "-"
    }
    if (url) {
      status = await api.queue(url, nick)
    }
    return status
  },
  
  queue: async function(url, nick) {
    if (!wordIsAValidMusicLink(url)) {
      return {status: 0}
    }
    let id = (+ new Date()).toString() + "-" + uuid.v4()
    let data = {
      route: "youtubedl", 
      urldata: url,
      postprocessing: null
    }
    newbucketitem(id, data)
    let satisfy = await satisfied(id)
    if (satisfy === true) {
      await addentrytodatabase(id, url, nick)
      return {status: 1, processed: url, id, nick}
    }
    else {
      return {status: 0, processed: url}
    }
  }
  
}

require('./ipc.js')(api, ipcport)
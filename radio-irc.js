const ipcport = 48886

let blip = String.fromCharCode(3)
let green = `${blip}3`
let red = `${blip}5`
let purple = `${blip}6`
let orange = `${blip}7`

var config = {
  userName: 'radio',
  channels: ['#jfjfoiwaejf'],
  server: 'irc.jollo.org',
  port: 9999,
  secure: true,
  selfSigned: true,
  floodProtection: false,
}

var irc = require('irc')
var nbod = new irc.Client(config.server, config.userName, { 
  channels: config.channels,
  port: config.port,
  secure: config.secure,
  selfSigned: config.selfSigned,
  floodProtection: config.floodProtection,
  realName: config.realName,
})

nbod.addListener('error', function(message) {})

let api = {
  event: (data) => {
    console.log(data)
    return null
    let events = {
      next: () => {
        return null
        return `${purple}...`
      },
      random: (data) => {
        console.log("rando---")
        console.log(data)
        return null

      },
      queue: (data) => {
        console.log("que---")
        console.log(data)
        return null
        if (data.status === 1) {
          return `${green}${data.processed}`
        }
        else {
          return `${red}${data.processed}`
        }
      },
      mix: (data) => {
        console.log(data)
        return null
        if (data.status === 1) {
          return `${green}mixed`
        }
        else {
          return `${red}xxxxx`
        }  
      }
    }
  }
}

const axios = require('axios')
function messages(nick, channel, chat) {
  console.log(chat)
  try {
    axios({
      method: 'post',
      timeout: 120 * 10 * 1000,
      url: 'http://localhost:48888/api',
      data: {
        type: 'parse',
        body: { 
          nick, 
          chat 
        }
      }
    })
  }
  catch(e) {
    console.error(e)
  }
  return null
}

nbod.addListener('message#', async function(nick, channel, chat) {
  messages(nick, channel, chat)
})

require('./ipc.js')(api, ipcport)
let requirepassword = false
let password = "abcdefg"

const ipcport = 48887
const httpserverport = 3000
const wsport = 9302

const app = {}
const axios = require('axios')
const db = require('./database.js')
const fs = require('fs')

let currenttrack = undefined
let api = {}
let history = []

app.handler = {}

app.handler["message"] = async function(wsc, data) {
  try {
    let blurb = data
    data = data
      .replace(/(?:\r\n|\r|\n)/g, " ")
      .replace(/\&/g, "&amp;")
      .replace(/\</g, "&lt;")
      .replace(/\>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/\'/g, "&#39;")
      .substring(0,1000)
    
    if (data.length === 0) {
      return
    }
    let statement = `
      INSERT INTO chat (
        nick,
        chat
      )
      VALUES (
        "${db.mres(wsc.nick)}",
        "${db.mres(data)}"
      )
    `
    await db.run(statement)    
    app.server.broadcast({type: "message", data: {
      nick: wsc.nick,
      chat: data
    }})
    let response = await axios({
      method: 'post',
      timeout: 60 * 10 * 1000,
      url: 'http://localhost:48888/api',
      data: {
        type: 'parse',
        body: {
          nick: wsc.nick,
          chat: blurb
        }
      }
    })
    if (response && response.data) {
      api.parse(response.data)
    }
  }
  catch(e) {
    // console.error(e)
  }
}


app.server = {
  
  clients: new Map(),
  
  broadcast: (json) => {
    app.server.clients.forEach((client) => {
      client.sendUTF(JSON.stringify(json))
    })
  },
  
  broadcastexceptme: (wsc, json) => {
    app.server.clients.forEach((client, key) => {
      if (wsc.socket._peername.port !== key) {
        client.sendUTF(JSON.stringify(json))
      }
    })
  },
  
  send: (wsc, json) => {
    wsc.sendUTF(JSON.stringify(json))      
  },
  
  listen: () => {
    let clients = app.server.clients
    const http = require('http')
    const httpServer = http.createServer()
    const websocketserver = require('websocket').server
    const wss = new websocketserver({ httpServer })  
    httpServer.listen(wsport)
    wss.on('request', async function(request) {
      let unlocked = false
      let nick = null
      const wsc = request.accept(null, request.origin)
      clients.set(wsc.socket._peername.port, wsc)
      let tracks = await db.all(`
        SELECT url, uuid, status, nick
        FROM tracks
        ORDER BY rowid DESC
        LIMIT 200
      `)
      tracks = tracks.reverse()
      app.server.send(wsc, {type: "songhistory", data:tracks})
      let statement = `
        SELECT *
        FROM chat
        ORDER BY rowid DESC
        LIMIT 50
      `
      let history = await db.all(statement)
      history = history.reverse()
      app.server.send(wsc, {type: "position", data:currenttrack})
      app.server.send(wsc, {type: "messagehistory", data:history})
      
      let response = await axios({
        method: 'post',
        url: 'http://localhost:48888/api',
        data: {
          type: 'status',
          body: null
        }
      })
      if (response && response.data) {
        api.status(response.data)
      }      
      wsc.on('message', function(msg) {
        try {
          let json = JSON.parse(msg.utf8Data)
          if (!nick) {
            let trynick = json.data.replace(/[^a-zA-Z0-9]/g, "").toLowerCase().substring(0,8)
            if (!trynick || trynick.length === 0) {
              return
            }
            nick = trynick
            wsc.nick = trynick
            if (requirepassword && !unlocked) {
              app.server.send(wsc, {type: "promptpassword", data:null})
            }
          }
          else {
            if (requirepassword && !unlocked) {
              console.log(json)
              if (json && json.type === "message" && json.data === password) {
                unlocked = true
                app.server.send(wsc, {type: "unlocked", data:password})
                return
              }
            }
            else {
              app.handler[json.type] ? app.handler[json.type](wsc, json.data) : () => {}
            }
          }
        }
        catch(e) {
          // console.error(e)
        }
      })
      wsc.on('close', function(e) {
        clients.delete(wsc.socket._peername.port)
      })
    }) 
  }
}

api = {
  status: (data) => {
    app.server.broadcast({type: "status", data})
    return null
  },
  position: (data) => {
    currenttrack = data
    if (app && app.server && app.server.broadcast) {
      app.server.broadcast({type: "position", data: currenttrack})      
    }    
    return null
  },
  parse: (data) => {
    if (data !== null) {
      let resp = async function(body) {
        let statement = `
          INSERT INTO chat (
            nick,
            chat
          )
          VALUES (
            "${db.mres("/")}",
            "${db.mres(body)}"
          )
        `
        await db.run(statement)          
        app.server.broadcast({type: "message", data: {
          nick: "/",
          chat: body
        }})
      }
      let {processed, id, status, nick} = data
      let body
      if (data.status === 0) {
        body = `<strike>${processed}</strike>`
      }
      else {
        body = processed
        app.server.broadcast({type: "song", data:{
          url: processed, 
          status, 
          uuid: id,
          nick
        }})
      }
      resp(body)
    }
    return
  }
}

app.server.listen()
require('./ipc.js')(api, ipcport)

;(async function(){
  try {
    let results = await axios({
      method: 'post',
      url: 'http://localhost:48888/api',
      data: {
        type: 'position',
        body: null
      }
    })
    if (results) {
      currenttrack = results.data
      if (app && app.server && app.server.broadcast) {
        app.server.broadcast({type: "position", data: currenttrack})      
      }
    }
  }
  catch(e) {
    // console.error(e)
  }
})();
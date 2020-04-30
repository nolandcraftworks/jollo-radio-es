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
    
    try {
      await axios({
        method: 'post',
        timeout: 120 * 10 * 1000,
        url: 'http://localhost:48888/api',
        data: {
          type: 'parse',
          body: {
            nick: wsc.nick,
            chat: blurb
          }
        }
      })
    }
    catch(e) {
      console.error(e)
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
      if (requirepassword && json && json.type === "message" && !client.unlocked) {
        return
      }
      client.sendUTF(JSON.stringify(json))
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
      wsc.unlocked = false
      clients.set(wsc.socket._peername.port, wsc)
      let tracks = await db.all(`
        SELECT url, uuid, status, nick
        FROM tracks
        ORDER BY rowid DESC
        LIMIT 200
      `)
      tracks = tracks.reverse()
      app.server.send(wsc, {type: "songhistory", data:tracks})
      if (!requirepassword) {
        var statement = `
          SELECT *
          FROM chat
          ORDER BY rowid DESC
          LIMIT 50
        `
        var history = await db.all(statement)
        history = history.reverse()
        app.server.send(wsc, {type: "messagehistory", data:history})
      }
      app.server.send(wsc, {type: "position", data:currenttrack})
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
      wsc.on('message', async function(msg) {
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
              if (json && json.type === "message" && json.data === password) {
                unlocked = true
                wsc.unlocked = true
                app.server.send(wsc, {type: "unlocked", data:password})
                var statement = `
                  SELECT *
                  FROM chat
                  ORDER BY rowid DESC
                  LIMIT 50
                `
                var history = await db.all(statement)
                history = history.reverse()
                app.server.send(wsc, {type: "messagehistory", data:history})                
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
  event: (data) => {    
    let {type, body} = data
    let linechat = async function(status, chat) {
      if (!status) {
        chat = `<strike>${chat}</strike>`
      }
      let statement = `
        INSERT INTO chat (
          nick,
          chat
        )
        VALUES (
          "${db.mres("/")}",
          "${db.mres(chat)}"
        )
      `
      await db.run(statement)          
      app.server.broadcast({type: "message", data: {
        nick: "/",
        chat
      }})
    }
    let events = {
      next: () => {
        linechat(true, "...")
      },
      queue: (data) => {
        linechat(data.status, data.processed)
        if (data.status === 1) {
          app.server.broadcast({type: "song", data:{
            url: data.processed, 
            status: data.status, 
            uuid: data.id,
            nick: data.nick
          }})
        }
        return null
      },
      mix: (data) => {
        linechat(data.status, "mix") 
        if (data.status === 1) {
          app.server.broadcast({type: "song", data:{
            url: "mix", 
            status: data.status, 
            uuid: data.id,
            nick: data.nick
          }})
        }
        return null
      }
    }
    events[type] && events[type](body)
    return null
  },
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
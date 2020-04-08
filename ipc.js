const http = require('http')
const ipcserver = http.createServer()

const post = function(req) {
  return new Promise((resolve, reject) => {
    let incoming = ""
    req.on('data', (data) => {
      incoming += data
      if (incoming.length > 1e6) {
        incoming = ""
        req.connection.destroy()
        reject()
        return
      }
    })
    req.on('end', () => {
      resolve(incoming)
      return
    })  
  })
}

module.exports = (api, ipcport) => {
  ipcserver.on('request', async function(req, res) {
    var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    if (ip.substr(0, 7) == "::ffff:") {
      ip = ip.substr(7)
    }
    if (ip !== "127.0.0.1") {
      console.error(`unauthorized attempt from ${ip}`)
      res.writeHead(403)
      res.end("")
      return
    }
    if (req.method.toLowerCase() === 'post') {
      try {
        if (req.url.slice(1) !== "api") {
          res.writeHead(404)
          res.end()        
        }
        let blob = await post(req)
        let data = null
        if (!blob) {
          res.writeHead(400)
          res.end()  
        } 
        else {      
          data = JSON.parse(blob)
        }
        const {type, body} = data
        if (!api[type]) {
          res.writeHead(400)
          res.end()          
          return
        }
        let results = await api[type](body)
        if (results || results === null) {
          res.end(JSON.stringify(results))
        }
        else {
          res.end()
        }
        return
      }
      catch(e) {
        res.writeHead(500)
        res.end()
        return
      }
    } 
    else if (req.method.toLowerCase() === "get") {
      res.end(JSON.stringify({}))
    }
  })
  ipcserver.listen(ipcport)
  console.log(`ipc listening on ${ipcport}`)
}
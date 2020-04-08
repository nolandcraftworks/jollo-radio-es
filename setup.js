const db = require('./database.js')
const fs = require('fs')

console.log("setting up database");

(async function main() {
  try {
    let statement = `
      CREATE TABLE IF NOT EXISTS tracks (
        uuid    VARCHAR(255),
        url     TEXT,
        nick    VARCHAR(9),
        status  TINYINT(1)
      )
    `
    await db.run(statement)
    statement = `
      CREATE TABLE IF NOT EXISTS chat (
        nick    VARCHAR(9),
        chat    TEXT
      )
    `
    await db.run(statement)
    console.log("database is set up")
    var dir = './tracks'
    if (!fs.existsSync(dir)) {
      console.log("creating tracks directory")
      fs.mkdirSync(dir)
    }
  } 
  catch (e) {
    console.error(e)
  }
})();
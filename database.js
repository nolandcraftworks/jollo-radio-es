const sqlite3 = require('sqlite3')
const db = new sqlite3.Database('./database.db')

const processes = {
  mres: function(stringToEscape) {
    if (stringToEscape === 0) {
      return 0
    }
    else if (!stringToEscape) {
      return ""
    }
    else if (stringToEscape == '') {
      return stringToEscape;
    }
    return stringToEscape.toString()
      .replace(/\\/g, "\\\\")
      .replace(/\'/g, "\\\'")
      .replace(/\"/g, "\\\"")
      .replace(/\n/g, "\\\n")
      .replace(/\r/g, "\\\r")
      .replace(/\x00/g, "\\\x00")
      .replace(/\x1a/g, "\\\x1a")
  },
  get: function (sql) {
    return new Promise(function (resolve, reject) {
      db.get(sql, function (err, row) {
        if (err) {
          reject(err)
        }
        else {
          resolve(row)
        }
      })
    })
  },
  all: function (sql) {
    return new Promise(function (resolve, reject) {
      db.all(sql, function (err, rows) {
        if (err) {
          reject(err)
        }
        else {
          resolve(rows)
        }
      })
    })
  },
  run: function (sql) {
    return new Promise(function (resolve, reject) {
      db.run(sql, function(err) {
        if (err) {
          reject(err)
        }
        else {
          resolve()
        }
      })
    })
  }
}



module.exports = processes